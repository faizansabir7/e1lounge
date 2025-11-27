#!/usr/bin/env python3
import cv2
import csv
import json
import base64
import numpy as np
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from pyzbar.pyzbar import decode
import os
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = 'library_secret_key_2024'  # Change this in production

# Initialize CSV files
def init_csv_files():
    # Initialize books.csv if it doesn't exist
    if not os.path.exists('books.csv'):
        with open('books.csv', 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['barcode', 'name', 'price', 'details', 'date_added'])
    
    # Initialize transactions.csv if it doesn't exist
    if not os.path.exists('transactions.csv'):
        with open('transactions.csv', 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['id', 'items', 'total', 'date', 'processed_by'])

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
    """Continuous barcode scanning using OpenCV like your original code"""
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
                
            # Try to decode barcode from current frame
            barcodes = decode(img)
            if barcodes:
                barcode_data = barcodes[0].data.decode('utf-8')
                print(f"🎯 Barcode detected: {barcode_data}")
                
                # Store the result
                scan_results[session_id] = barcode_data
                
                # Stop scanning once barcode is found
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
        print(f"Error in continuous scan: {e}")
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
                        'date_added': row['date_added']
                    }
        return None
    except Exception as e:
        print(f"Error reading books CSV: {e}")
        return None

def add_book_to_csv(barcode, name, price, details):
    """Add new book to CSV"""
    try:
        # Check if book already exists
        if get_book_by_barcode(barcode):
            return False, "Book with this barcode already exists"
        
        with open('books.csv', 'a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow([barcode, name, price, details, datetime.now().isoformat()])
        return True, "Book added successfully"
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
                    'date_added': row['date_added']
                })
    except Exception as e:
        print(f"Error reading books: {e}")
    return books

def save_transaction(items, total, processed_by):
    """Save transaction to CSV"""
    try:
        transaction_id = datetime.now().strftime('%Y%m%d%H%M%S')
        with open('transactions.csv', 'a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow([
                transaction_id,
                json.dumps(items),
                total,
                datetime.now().isoformat(),
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
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        img_data = data.get('image')
        
        if not img_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        barcode = decode_barcode_from_image(img_data)
        
        if barcode:
            return jsonify({'success': True, 'barcode': barcode})
        else:
            return jsonify({'success': False, 'error': 'No barcode detected'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
        
        if not all([barcode, name, price]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        try:
            price = float(price)
        except ValueError:
            return jsonify({'error': 'Invalid price format'}), 400
        
        success, message = add_book_to_csv(barcode, name, price, details)
        
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

@app.route('/api/process_bill', methods=['POST'])
def process_bill():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        items = data.get('items', [])
        total = data.get('total', 0)
        
        if not items:
            return jsonify({'error': 'No items in bill'}), 400
        
        success, transaction_id = save_transaction(items, total, session['user'])
        
        if success:
            return jsonify({
                'success': True,
                'transaction_id': transaction_id,
                'message': f'Transaction processed successfully. ID: {transaction_id}'
            })
        else:
            return jsonify({'error': f'Failed to save transaction: {transaction_id}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats')
def stats():
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    books = get_all_books()
    total_books = len(books)
    total_value = sum(book['price'] for book in books)
    
    return jsonify({
        'total_books': total_books,
        'total_value': total_value
    })

if __name__ == '__main__':
    init_csv_files()
    print("🚀 Library Inventory System Starting...")
    print("📚 Using reliable Python barcode scanning with pyzbar")
    print("🌐 Access at: http://localhost:8080")
    print("👤 Login: admin / admin123")
    app.run(debug=True, host='0.0.0.0', port=8080)