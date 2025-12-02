#!/usr/bin/env python3
import cv2
import csv
import json
import base64
import numpy as np
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from pyzbar.pyzbar import decode
import os
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = 'library_secret_key_2024'  # Change this in production

def extract_barcode_only(decoded_list):
    """Return only barcodes, ignore QR codes."""
    for code in decoded_list:
        if code.type.upper() != "QRCODE":
            return code.data.decode("utf-8"), code.type
    return None, None


# Initialize CSV files
def init_csv_files():
    # Initialize books.csv if it doesn't exist
    if not os.path.exists('books.csv'):
        with open('books.csv', 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['barcode', 'name', 'price', 'details', 'date_added', 'quantity'])
    
    # Initialize transactions.csv if it doesn't exist - Flattened format
    if not os.path.exists('transactions.csv'):
        with open('transactions.csv', 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['transaction_id', 'item_name', 'item_quantity', 'item_price', 'customer_name', 'date', 'processed_by'])


# Global variables for camera scanning
camera_active = {}
scanning_active = {}
scan_results = {}

# Barcode scanning functions (adapted from your code)
def decode_barcode_from_image(img_data):
    """Decode barcode from base64 image data"""
    try:
        # Decode base64 image
        img_bytes = base64.b64decode(img_data.split(',')[1])
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        # Decode barcode
        barcodes = decode(img)
        if barcodes:
            return barcodes[0].data.decode('utf-8')
        return None
    except Exception as e:
        print(f"Error decoding barcode: {e}")
        return None

def continuous_scan_opencv(session_id, scan_type):
    """Continuous barcode scanning using OpenCV with enhanced detection"""
    try:
        # Initialize camera
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        print(f"🎥 Starting continuous scan for session {session_id}, type: {scan_type}")
        
        while camera_active.get(session_id, False) and scanning_active.get(session_id, False):
            success, img = cap.read()
            if not success:
                continue
            
            # Try multiple preprocessing techniques for better detection
            # 1. Try original image
            barcodes = decode(img)
            if barcodes:
                barcode_data = barcodes[0].data.decode('utf-8')
                print(f"🎯 Desktop barcode detected (original): {barcode_data}")
                scan_results[session_id] = barcode_data
                camera_active[session_id] = False
                scanning_active[session_id] = False
                cap.release()
                return barcode_data
            
            # 2. Try grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            barcodes = decode(gray)
            if barcodes:
                barcode_data = barcodes[0].data.decode('utf-8')
                print(f"🎯 Desktop barcode detected (grayscale): {barcode_data}")
                scan_results[session_id] = barcode_data
                camera_active[session_id] = False
                scanning_active[session_id] = False
                cap.release()
                return barcode_data
            
            # 3. Try with increased contrast
            gray_eq = cv2.equalizeHist(gray)
            barcodes = decode(gray_eq)
            if barcodes:
                barcode_data = barcodes[0].data.decode('utf-8')
                print(f"🎯 Desktop barcode detected (contrast): {barcode_data}")
                scan_results[session_id] = barcode_data
                camera_active[session_id] = False
                scanning_active[session_id] = False
                cap.release()
                return barcode_data
            
            # 4. Try with thresholding
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            barcodes = decode(thresh)
            if barcodes:
                barcode_data = barcodes[0].data.decode('utf-8')
                print(f"🎯 Desktop barcode detected (threshold): {barcode_data}")
                scan_results[session_id] = barcode_data
                camera_active[session_id] = False
                scanning_active[session_id] = False
                cap.release()
                return barcode_data
            
            # Small delay to prevent excessive CPU usage
            import time
            time.sleep(0.1)
        
        cap.release()
        print(f"📹 Camera released for session {session_id}")
        return None
        
    except Exception as e:
        print(f"❌ Desktop scan error: {e}")
        camera_active[session_id] = False
        scanning_active[session_id] = False
        return None

def get_book_by_barcode(barcode):
    """Get book details by barcode from CSV"""
    try:
        with open('books.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if row['barcode'] == barcode:
                    return {
                        'barcode': row['barcode'],
                        'name': row['name'],
                        'price': float(row['price']),
                        'details': row['details'],
                        'date_added': row['date_added'],
                        'quantity': int(row.get('quantity', 1))
                    }
        return None
    except Exception as e:
        print(f"Error reading books CSV: {e}")
        return None

def add_book_to_csv(barcode, name, price, details, quantity=1):
    """Add new book to CSV or update quantity if exists"""
    try:
        existing_book = get_book_by_barcode(barcode)
        
        if existing_book:
            # Book exists, update quantity
            new_quantity = existing_book['quantity'] + quantity
            success = update_book_quantity(barcode, new_quantity)
            if success:
                return True, f"Book quantity updated. New quantity: {new_quantity}"
            else:
                return False, "Failed to update book quantity"
        else:
            # New book, add to CSV
            with open('books.csv', 'a', newline='', encoding='utf-8') as file:
                writer = csv.writer(file)
                writer.writerow([barcode, name, price, details, datetime.now().isoformat(), quantity])
            return True, f"Book added successfully with quantity: {quantity}"
    except Exception as e:
        print(f"Error adding book: {e}")
        return False, f"Error: {e}"

def get_all_books():
    """Get all books from CSV"""
    books = []
    try:
        with open('books.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                books.append({
                    'barcode': row['barcode'],
                    'name': row['name'],
                    'price': float(row['price']),
                    'details': row['details'],
                    'date_added': row['date_added'],
                    'quantity': int(row.get('quantity', 1))
                })
    except Exception as e:
        print(f"Error reading books: {e}")
    return books

def update_book_quantity(barcode, new_quantity):
    """Update the quantity of a book in CSV"""
    try:
        books = []
        updated = False
        
        # Read all books
        with open('books.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            fieldnames = reader.fieldnames
            for row in reader:
                if row['barcode'] == barcode:
                    row['quantity'] = str(new_quantity)
                    updated = True
                books.append(row)
        
        if not updated:
            return False
        
        # Write back all books
        with open('books.csv', 'w', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(books)
        
        return True
    except Exception as e:
        print(f"Error updating book quantity: {e}")
        return False

def reduce_book_quantity(barcode, quantity_to_reduce):
    """Reduce the quantity of a book when billing"""
    try:
        book = get_book_by_barcode(barcode)
        if not book:
            return False, "Book not found"
        
        current_qty = book['quantity']
        if current_qty < quantity_to_reduce:
            return False, f"Insufficient quantity. Available: {current_qty}"
        
        new_quantity = current_qty - quantity_to_reduce
        success = update_book_quantity(barcode, new_quantity)
        
        if success:
            return True, f"Quantity reduced. Remaining: {new_quantity}"
        else:
            return False, "Failed to update quantity"
    except Exception as e:
        print(f"Error reducing quantity: {e}")
        return False, f"Error: {e}"

def save_transaction(items, total, customer_name, processed_by):
    """Save transaction to CSV - one row per item for easy Excel viewing"""
    try:
        transaction_id = datetime.now().strftime('%Y%m%d%H%M%S')
        transaction_date = datetime.now().isoformat()
        
        with open('transactions.csv', 'a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            
            # Write one row per item
            for item in items:
                writer.writerow([
                    transaction_id,
                    item.get('name', 'Unknown'),
                    item.get('quantity', 1),
                    item.get('price', 0),
                    customer_name,
                    transaction_date,
                    processed_by
                ])
        
        return True, transaction_id
    except Exception as e:
        print(f"Error saving transaction: {e}")
        return False, str(e)

# Routes
@app.route('/')
def index():
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Simple admin check (in production, use proper authentication)
        if username == 'admin' and password == 'admin123':
            session['user'] = username
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error='Invalid credentials')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/api/download_inventory')
def download_inventory():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        if os.path.exists('books.csv'):
            return send_file(
                'books.csv',
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'inventory_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
        else:
            return jsonify({'error': 'Inventory file not found'}), 404
    except Exception as e:
        print(f"Error downloading inventory: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download_transactions')
def download_transactions():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        if not os.path.exists('transactions.csv'):
            return jsonify({'error': 'Transactions file not found'}), 404
        
        # Transactions CSV is already in the correct flat format, just send it
        return send_file(
            'transactions.csv',
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'transactions_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )
            
    except Exception as e:
        print(f"Error downloading transactions: {e}")
        return jsonify({'error': str(e)}), 500

# API Routes
@app.route('/api/start_continuous_scan', methods=['POST'])
def start_continuous_scan():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        scan_type = data.get('type', 'add')  # 'add' or 'bill'
        session_id = session.get('user') + '_' + scan_type
        
        # Start continuous scanning
        camera_active[session_id] = True
        scanning_active[session_id] = True
        
        # Start scanning in background thread
        import threading
        scan_thread = threading.Thread(target=continuous_scan_opencv, args=(session_id, scan_type))
        scan_thread.daemon = True
        scan_thread.start()
        
        return jsonify({'success': True, 'session_id': session_id, 'message': 'Continuous scanning started'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop_continuous_scan', methods=['POST'])
def stop_continuous_scan():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        scan_type = data.get('type', 'add')
        session_id = session.get('user') + '_' + scan_type
        
        # Stop scanning
        camera_active[session_id] = False
        scanning_active[session_id] = False
        
        return jsonify({'success': True, 'message': 'Scanning stopped'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_scan_result', methods=['POST'])
def check_scan_result():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        scan_type = data.get('type', 'add')
        session_id = session.get('user') + '_' + scan_type
        
        # Check if we have a scan result
        if session_id in scan_results:
            barcode = scan_results[session_id]
            
            # Cleanup after returning result
            if session_id in scan_results:
                del scan_results[session_id]
            if session_id in camera_active:
                del camera_active[session_id]
            if session_id in scanning_active:
                del scanning_active[session_id]
                
            return jsonify({'scanning': False, 'barcode': barcode, 'success': True})
        
        # Check if scanning is still active
        elif scanning_active.get(session_id, False):
            return jsonify({'scanning': True, 'barcode': None})
        else:
            # Scanning stopped without result
            if session_id in camera_active:
                del camera_active[session_id]
            if session_id in scanning_active:
                del scanning_active[session_id]
            return jsonify({'scanning': False, 'barcode': None})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scan_barcode', methods=['POST'])
def scan_barcode():
    """Scan barcode from mobile device image"""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        img_data = data.get('image')
        scan_type = data.get('type', 'add')
        
        if not img_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        img_bytes = base64.b64decode(img_data.split(',')[1])
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'detected': False, 'barcode': None, 'error': 'Failed to decode image'})
        
        # Try multiple preprocessing techniques for better detection
        barcodes = []
        
        # 1. Try original image
        decoded = decode(img)
        barcode_data, code_type = extract_barcode_only(decoded)

        if barcode_data:
            print(f"🎯 Detected {code_type}: {barcode_data}")
            return jsonify({'detected': True, 'barcode': barcode_data, 'success': True})
        else:
            print("⚪ QR or no barcode — ignored")

        
        # 2. Try grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        decoded = decode(gray)
        barcode_data, code_type = extract_barcode_only(decoded)

        if barcode_data:
            print(f"🎯 Detected {code_type}: {barcode_data}")
            return jsonify({'detected': True, 'barcode': barcode_data, 'success': True})
        
        # 3. Try with increased contrast
        gray = cv2.equalizeHist(gray)
        decoded = decode(gray)
        barcode_data, code_type = extract_barcode_only(decoded)

        if barcode_data:
            print(f"🎯 Detected {code_type}: {barcode_data}")
            return jsonify({'detected': True, 'barcode': barcode_data, 'success': True})
        
        # 4. Try with thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        decoded = decode(thresh)
        barcode_data, code_type = extract_barcode_only(decoded)

        if barcode_data:
            print(f"🎯 Detected {code_type}: {barcode_data}")
            return jsonify({'detected': True, 'barcode': barcode_data, 'success': True})
        
        # 5. Try inverted
        inverted = cv2.bitwise_not(thresh)
        decoded = decode(inverted)
        barcode_data, code_type = extract_barcode_only(decoded)
        if barcode_data:
            print(f"🎯 Detected {code_type}: {barcode_data}")
            return jsonify({'detected': True, 'barcode': barcode_data, 'success': True})
        
        # No barcode found
        print("⚪ No barcode detected in frame")
        return jsonify({'detected': False, 'barcode': None, 'continue': True})
    
    except Exception as e:
        print(f"❌ Scan error: {e}")
        return jsonify({'detected': False, 'error': str(e)}), 500

@app.route('/api/books', methods=['GET', 'POST'])
def books_api():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    if request.method == 'GET':
        books = get_all_books()
        return jsonify({'books': books})
    
    elif request.method == 'POST':
        data = request.get_json()
        barcode = data.get('barcode')
        name = data.get('name')
        price = data.get('price')
        details = data.get('details', '')
        quantity = data.get('quantity', 1)
        
        if not all([barcode, name, price]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        try:
            price = float(price)
            quantity = int(quantity)
            if quantity < 1:
                return jsonify({'error': 'Quantity must be at least 1'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid price or quantity format'}), 400
        
        success, message = add_book_to_csv(barcode, name, price, details, quantity)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'error': message}), 400

@app.route('/api/book/<barcode>')
def get_book(barcode):
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    book = get_book_by_barcode(barcode)
    if book:
        return jsonify({'book': book})
    else:
        return jsonify({'error': 'Book not found'}), 404

@app.route('/api/update_book_quantity', methods=['POST'])
def update_book_quantity_api():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        barcode = data.get('barcode')
        quantity = data.get('quantity')
        
        if not barcode or quantity is None:
            return jsonify({'error': 'Missing barcode or quantity'}), 400
        
        try:
            quantity = int(quantity)
            if quantity < 0:
                return jsonify({'error': 'Quantity cannot be negative'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid quantity format'}), 400
        
        # Check if book exists
        book = get_book_by_barcode(barcode)
        if not book:
            return jsonify({'error': 'Book not found'}), 404
        
        # Update quantity
        success = update_book_quantity(barcode, quantity)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Quantity updated to {quantity}'
            })
        else:
            return jsonify({'error': 'Failed to update quantity'}), 500
            
    except Exception as e:
        print(f"Error updating quantity: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete_book', methods=['POST'])
def delete_book_api():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        barcode = data.get('barcode')
        
        if not barcode:
            return jsonify({'error': 'Missing barcode'}), 400
        
        # Check if book exists
        book = get_book_by_barcode(barcode)
        if not book:
            return jsonify({'error': 'Book not found'}), 404
        
        # Delete book from CSV
        books = []
        deleted = False
        
        with open('books.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            fieldnames = reader.fieldnames
            for row in reader:
                if row['barcode'] != barcode:
                    books.append(row)
                else:
                    deleted = True
        
        if deleted:
            with open('books.csv', 'w', newline='', encoding='utf-8') as file:
                writer = csv.DictWriter(file, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(books)
            
            return jsonify({
                'success': True,
                'message': 'Book deleted successfully'
            })
        else:
            return jsonify({'error': 'Failed to delete book'}), 500
            
    except Exception as e:
        print(f"Error deleting book: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/process_bill', methods=['POST'])
def process_bill():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        items = data.get('items', [])
        total = data.get('total', 0)
        customer_name = data.get('customer_name', '').strip()
        
        if not items:
            return jsonify({'error': 'No items in bill'}), 400
        
        if not customer_name:
            return jsonify({'error': 'Customer name is required'}), 400
        
        # Reduce quantity for each item in the bill
        insufficient_items = []
        for item in items:
            barcode = item.get('barcode')
            quantity = item.get('quantity', 1)
            
            success, message = reduce_book_quantity(barcode, quantity)
            if not success:
                insufficient_items.append(f"{item.get('name')}: {message}")
        
        if insufficient_items:
            return jsonify({
                'error': 'Insufficient quantity for items',
                'details': insufficient_items
            }), 400
        
        success, transaction_id = save_transaction(items, total, customer_name, session['user'])
        
        if success:
            return jsonify({
                'success': True,
                'transaction_id': transaction_id,
                'message': f'Transaction processed successfully for {customer_name}. ID: {transaction_id}'
            })
        else:
            return jsonify({'error': f'Failed to save transaction: {transaction_id}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        # Read flattened transactions and group by transaction_id
        transactions_dict = {}
        
        with open('transactions.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                trans_id = row['transaction_id']
                
                if trans_id not in transactions_dict:
                    transactions_dict[trans_id] = {
                        'id': trans_id,
                        'customer_name': row['customer_name'],
                        'items': [],
                        'total': 0,
                        'date': row['date'],
                        'processed_by': row['processed_by']
                    }
                
                # Add item to transaction
                item_price = float(row['item_price'])
                item_qty = int(row['item_quantity'])
                
                transactions_dict[trans_id]['items'].append({
                    'name': row['item_name'],
                    'quantity': item_qty,
                    'price': item_price
                })
                
                transactions_dict[trans_id]['total'] += item_price * item_qty
        
        # Convert to list and sort by date
        transactions = list(transactions_dict.values())
        transactions.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({'transactions': transactions})
        
    except Exception as e:
        print(f"Error reading transactions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats')
def stats():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    books = get_all_books()
    total_books = len(books)
    total_quantity = sum(book['quantity'] for book in books)
    total_value = sum(book['price'] * book['quantity'] for book in books)
    
    return jsonify({
        'total_books': total_books,
        'total_quantity': total_quantity,
        'total_value': total_value
    })

if __name__ == '__main__':
    init_csv_files()
    print(" Library Inventory System Starting...")
    print("📚 Using reliable Python barcode scanning with pyzbar")
    print("🌐 Access at: https://localhost:8080")
    print("👤 Login: admin / admin123")
    # app.run(debug=True, host='0.0.0.0', port=8080)  # Use SSL in production
    app.run(debug=True, host='0.0.0.0', port=8080,ssl_context=('cert.pem', 'key.pem'))  # Use SSL in productionF