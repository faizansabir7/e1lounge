# Library Inventory Management System

A mobile-friendly web application for managing library inventory with QR/barcode scanning capabilities.

## Features

- **Admin Authentication**: Secure login for inventory management
- **Mobile-First Design**: Optimized for mobile browsers and tablets
- **QR/Barcode Scanning**: Add books and process billing using camera scanning
- **Inventory Management**: Add, edit, delete, and search books
- **Billing System**: Scan items to add to bill and process payments
- **Local Storage**: Data persistence using browser local storage
- **Real-time Stats**: View total books and inventory value

## Setup Instructions

1. **No Installation Required**: This is a pure HTML/CSS/JavaScript application
2. **Serve the Files**: Use any web server to serve the files (required for camera access)
3. **HTTPS Required**: Camera access requires HTTPS or localhost

### Quick Start Options:

#### Option 1: Python Simple Server
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

#### Option 2: Node.js http-server
```bash
npm install -g http-server
http-server -p 8000
```

#### Option 3: PHP Built-in Server
```bash
php -S localhost:8000
```

Then open: `http://localhost:8000`

## Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

> **Security Note**: In production, implement proper authentication with encrypted passwords and secure session management.

## Usage Guide

### 1. Login
- Use the default credentials to access the admin portal

### 2. Add Books
- Navigate to "Add Book" section
- Click "Scan Barcode" to use camera scanning, or manually enter barcode
- Fill in book details (name, price, additional details)
- Click "Add Book" to save to inventory

### 3. Manage Inventory
- View all books in the "Inventory" section
- Search books by name, barcode, or details
- Edit or delete existing books
- View total books count and inventory value

### 4. Billing System
- Navigate to "Billing" section
- Click "Scan Item to Add to Bill" to scan products for billing
- Adjust quantities using +/- buttons
- Remove items if needed
- Click "Process Payment" to complete the transaction

## Browser Compatibility

### Camera Scanning Requirements:
- **HTTPS**: Required for camera access (except localhost)
- **Modern Browsers**: Chrome 53+, Firefox 49+, Safari 11+, Edge 18+
- **Mobile Support**: iOS Safari 11+, Chrome Mobile 53+

### Supported Barcode Formats:
- QR Codes
- Code 128
- Code 39
- EAN-13
- EAN-8
- UPC-A
- UPC-E

## Data Storage

- **Local Storage**: All data is stored in browser's localStorage
- **No Database Required**: Perfect for simple deployments
- **Data Persistence**: Data survives browser restarts
- **Manual Backup**: Export/import functionality can be added if needed

## File Structure

```
library-inventory/
├── index.html          # Main application HTML
├── styles.css          # Responsive CSS styling
├── app.js             # Application logic and scanner integration
└── README.md          # Documentation
```

## Customization

### Modify Admin Credentials
Edit the `adminCredentials` object in `app.js`:
```javascript
this.adminCredentials = {
    username: 'your_username',
    password: 'your_password'
};
```

### Add More Book Fields
1. Update the HTML form in `index.html`
2. Modify the `addBook()` method in `app.js`
3. Update the display methods accordingly

### Styling Changes
- Modify `styles.css` for visual customizations
- Update CSS variables for color themes
- Adjust responsive breakpoints as needed

## Troubleshooting

### Camera Not Working
1. **Check HTTPS**: Camera requires HTTPS or localhost
2. **Browser Permissions**: Allow camera access when prompted
3. **Browser Support**: Use a modern, supported browser
4. **Mobile Issues**: Ensure good lighting and steady hands

### Performance Issues
1. **Large Inventory**: Consider pagination for 1000+ books
2. **Scanner Performance**: Reduce FPS in scanner config if needed
3. **Mobile Performance**: Close other browser tabs

### Data Loss Prevention
1. **Regular Exports**: Implement backup functionality
2. **Cloud Storage**: Consider integrating with cloud services
3. **Database Migration**: Move to server-side database for production

## Security Considerations

⚠️ **Important for Production Use**:

1. **Authentication**: Implement proper user authentication
2. **HTTPS**: Always use HTTPS in production
3. **Input Validation**: Add server-side validation
4. **Data Encryption**: Encrypt sensitive data
5. **Access Control**: Implement role-based permissions

## Future Enhancements

- [ ] Multi-user support with roles
- [ ] Cloud database integration
- [ ] Inventory reports and analytics
- [ ] Barcode generation for new books
- [ ] Receipt printing
- [ ] Export/import functionality
- [ ] Book cover image support
- [ ] Low stock alerts
- [ ] Transaction history viewing

## License

This project is open source and available under the [MIT License](https://opensource.org/licenses/MIT).

## Support

For issues and questions:
1. Check the troubleshooting section
2. Verify browser compatibility
3. Test camera permissions and HTTPS setup