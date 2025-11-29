# 📚 Library Inventory System - Python Backend

A reliable library inventory management system using Python Flask backend with **pyzbar** for professional barcode scanning.

##  **Features**

- **✅ Reliable Barcode Scanning**: Uses Python `pyzbar` + `opencv` (much more reliable than JavaScript libraries)
- **📱 Mobile-Friendly**: Responsive web interface that works on all devices
- **🔐 Admin Authentication**: Secure login system
- **📊 Inventory Management**: Add, view, search books with barcode scanning
- **💳 Billing System**: Scan items to create bills and process payments
- **💾 CSV Storage**: Simple file-based storage (easily upgradeable to database)
- **📈 Real-time Stats**: Total books and inventory value tracking

## 🔧 **Installation & Setup**

### **Prerequisites**
- Python 3.7 or higher
- Webcam/Camera access
- Modern web browser

### **1. Install Dependencies**

```bash
# Install Python packages
pip install -r requirements.txt

# On Ubuntu/Debian (if you get opencv errors):
sudo apt-get update
sudo apt-get install libzbar0

# On macOS (if you get zbar errors):
brew install zbar

# On Windows: Dependencies should install automatically
```

### **2. Run the Application**

```bash
# Start the Flask server
python app.py
```

### **3. Access the System**

- **Web Interface**: http://localhost:5000
- **Login Credentials**: 
  - Username: `admin`
  - Password: `admin123`

## 📁 **File Structure**

```
library-inventory/
├── app.py                 # Flask backend with barcode scanning
├── requirements.txt       # Python dependencies
├── books.csv             # Book inventory storage (auto-created)
├── transactions.csv      # Transaction history (auto-created)
├── templates/
│   ├── index.html        # Main application interface
│   └── login.html        # Login page
└── static/
    └── app.js           # Frontend JavaScript
```

## 🎯 **How to Use**

### **1. Adding Books**
1. Go to "➕ Add Book" section
2. Click "Start Camera" 
3. Point camera at barcode and click "Scan Barcode"
4. Fill in book details
5. Click "Add Book"

### **2. Billing**
1. Go to "💳 Billing" section  
2. Click "Start Camera"
3. Scan items by clicking "Scan Item"
4. Adjust quantities as needed
5. Click "Process Payment"

### **3. Inventory Management**
1. Go to "📊 Inventory" section
2. View all books and statistics
3. Search by name, barcode, or details

## 🔍 **Barcode Scanning**

### **Supported Formats**
- Code 128 (most common)
- EAN-13/EAN-8 (products)
- UPC-A/UPC-E (US products)
- Code 39 (library/inventory)
- Data Matrix
- QR Codes
- And many more via pyzbar

### **Scanning Tips**
- **Good Lighting**: Ensure adequate lighting
- **Steady Hold**: Keep camera steady for 1-2 seconds
- **Distance**: Try different distances (6-12 inches usually works best)
- **Angle**: Keep barcode parallel to camera
- **Clean Codes**: Ensure barcode is not damaged or dirty

## 🔧 **Technical Details**

### **Backend (Python)**
- **Flask**: Web framework
- **pyzbar**: Professional barcode decoding
- **OpenCV**: Image processing and camera handling
- **CSV**: Simple file-based storage

### **Frontend**
- **Vanilla JavaScript**: No framework dependencies
- **Responsive CSS**: Mobile-first design
- **Canvas API**: Image capture from video stream
- **Fetch API**: Communication with Flask backend

### **Data Storage**
- **books.csv**: Barcode, Name, Price, Details, Date Added
- **transactions.csv**: Transaction ID, Items, Total, Date, Processed By

##  **Why This is Better**

### **vs JavaScript Barcode Libraries:**
- ✅ **More Reliable**: pyzbar is industry-standard
- ✅ **Better Detection**: Professional image processing
- ✅ **More Formats**: Supports many more barcode types
- ✅ **Consistent Results**: Works across all devices/browsers

### **vs Your Original Code:**
- ✅ **Web-Based**: No command line interface needed
- ✅ **Mobile Friendly**: Works on phones/tablets
- ✅ **User Interface**: Professional web interface
- ✅ **Multi-User Ready**: Can be accessed from multiple devices

## 🔒 **Security Notes**

**For Production Use:**
1. **Change Secret Key**: Update `app.secret_key` in app.py
2. **Use HTTPS**: Deploy with SSL certificate
3. **Database**: Replace CSV with proper database (PostgreSQL, MySQL)
4. **Authentication**: Implement proper user management
5. **Input Validation**: Add server-side validation
6. **Environment Variables**: Use environment variables for sensitive data

## 🔄 **Upgrading to Database**

To upgrade from CSV to database:

```python
# Example with SQLite
import sqlite3

# Create tables
conn = sqlite3.connect('library.db')
conn.execute('''CREATE TABLE books 
                (barcode TEXT PRIMARY KEY, name TEXT, price REAL, details TEXT, date_added TEXT)''')
conn.execute('''CREATE TABLE transactions 
                (id TEXT PRIMARY KEY, items TEXT, total REAL, date TEXT, processed_by TEXT)''')
```

## 📱 **Mobile App Conversion**

This web app can easily be converted to a mobile app using:
- **Cordova/PhoneGap**: Wrap web app as mobile app
- **React Native**: Port to React Native
- **Flutter**: Create Flutter version
- **PWA**: Convert to Progressive Web App

## 🛠️ **Troubleshooting**

### **Camera Issues**
- **HTTPS Required**: For production, use HTTPS
- **Permissions**: Allow camera access in browser
- **Multiple Cameras**: System will use default camera

### **Barcode Not Detected**
- **Image Quality**: Ensure good lighting and focus
- **Distance**: Try different distances from barcode
- **Barcode Quality**: Ensure barcode is clean and undamaged
- **Browser Console**: Check for error messages

### **Installation Issues**
```bash
# If opencv installation fails:
pip install opencv-python-headless

# If zbar installation fails:
pip install pyzbar --no-cache-dir

# Clear pip cache:
pip cache purge
```

## 📞 **Support**

1. **Check Console**: Open browser dev tools (F12) for errors
2. **Camera Permissions**: Ensure camera access is allowed
3. **Python Logs**: Check terminal where you ran `python app.py`
4. **Test Barcode**: Try with a clear, well-lit barcode first

## 🎉 **Success!**

Your library inventory system is now running with professional-grade Python barcode scanning! The system uses the same reliable `pyzbar` library from your original code but in a modern web interface.

**Access your system at: http://localhost:5000**