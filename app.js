// Library Inventory Management System
class LibraryInventorySystem {
    constructor() {
        this.books = JSON.parse(localStorage.getItem('libraryBooks') || '[]');
        this.currentBill = [];
        this.isLoggedIn = false;
        this.scannerAdd = null;
        this.scannerBill = null;
        this.currentUser = null;
        
        // Default admin credentials (in production, use proper authentication)
        this.adminCredentials = {
            username: 'admin',
            password: 'admin123'
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.showLoginScreen();
    }
    
    bindEvents() {
        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.screen);
            });
        });
        
        // Add Book
        document.getElementById('start-scan-add').addEventListener('click', () => {
            this.startScanner('add');
        });
        
        document.getElementById('stop-scan-add').addEventListener('click', () => {
            this.stopScanner('add');
        });
        
        document.getElementById('add-book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });
        
        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearBookForm();
        });
        
        // Billing
        document.getElementById('start-scan-bill').addEventListener('click', () => {
            this.startScanner('bill');
        });
        
        document.getElementById('stop-scan-bill').addEventListener('click', () => {
            this.stopScanner('bill');
        });
        
        document.getElementById('clear-bill').addEventListener('click', () => {
            this.clearBill();
        });
        
        document.getElementById('process-bill').addEventListener('click', () => {
            this.processBill();
        });
        
        // Search
        document.getElementById('search-books').addEventListener('input', (e) => {
            this.searchBooks(e.target.value);
        });
        
        document.getElementById('clear-search').addEventListener('click', () => {
            document.getElementById('search-books').value = '';
            this.displayBooks();
        });
        
        // Test camera buttons
        document.getElementById('test-camera-add').addEventListener('click', () => {
            this.testCameraAccess('add');
        });
        
        document.getElementById('test-camera-bill').addEventListener('click', () => {
            this.testCameraAccess('bill');
        });
        
        // Manual barcode input
        document.getElementById('use-manual-add').addEventListener('click', () => {
            this.useManualBarcode('add');
        });
        
        document.getElementById('use-manual-bill').addEventListener('click', () => {
            this.useManualBarcode('bill');
        });
        
        // Allow Enter key for manual barcode input
        document.getElementById('manual-barcode-add').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.useManualBarcode('add');
            }
        });
        
        document.getElementById('manual-barcode-bill').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.useManualBarcode('bill');
            }
        });
    }
    
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard-screen').classList.add('hidden');
    }
    
    showDashboard() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');
        this.updateStats();
        this.displayBooks();
        document.getElementById('welcome-text').textContent = `Welcome, ${this.currentUser}`;
    }
    
    handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (username === this.adminCredentials.username && 
            password === this.adminCredentials.password) {
            this.isLoggedIn = true;
            this.currentUser = username;
            this.showMessage('Login successful!', 'success');
            this.showDashboard();
        } else {
            this.showMessage('Invalid credentials! Use admin/admin123', 'error');
        }
        
        // Clear form
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }
    
    handleLogout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.stopAllScanners();
        this.showLoginScreen();
        this.showMessage('Logged out successfully!', 'success');
    }
    
    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-screen="${sectionName}"]`).classList.add('active');
        
        // Update sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
        
        // Stop scanners when switching sections
        this.stopAllScanners();
        
        // Update content based on section
        if (sectionName === 'inventory') {
            this.updateStats();
            this.displayBooks();
        } else if (sectionName === 'billing') {
            this.displayBill();
        }
    }
    
    async startScanner(type) {
        try {
            const scannerId = type === 'add' ? 'scanner-add' : 'scanner-bill';
            const startBtn = document.getElementById(`start-scan-${type}`);
            const stopBtn = document.getElementById(`stop-scan-${type}`);
            
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            
            // Show info message
            this.showMessage('Starting camera... Please allow access when prompted.', 'info', 3000);
            
            // Enhanced QuaggaJS configuration for reliable barcode detection
            const config = {
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector(`#${scannerId}`),
                    constraints: {
                        width: 640,
                        height: 480,
                        facingMode: "environment"
                    },
                    area: { // Define scanning area
                        top: "0%",
                        right: "0%", 
                        left: "0%",
                        bottom: "0%"
                    },
                    singleChannel: false // Use color processing
                },
                locator: {
                    patchSize: "large", // Increased for better detection
                    halfSample: false   // Use full resolution
                },
                numOfWorkers: navigator.hardwareConcurrency || 4,
                decoder: {
                    readers: [
                        "code_128_reader", // Most common
                        "ean_reader",      // Products
                        "ean_8_reader",
                        "code_39_reader",  // Library/Inventory
                        "code_39_vin_reader",
                        "codabar_reader",
                        "upc_reader", 
                        "upc_e_reader",
                        "i2of5_reader",
                        "code_93_reader"
                    ],
                    debug: {
                        drawBoundingBox: true,
                        showFrequency: true,
                        drawScanline: true,
                        showPattern: true
                    }
                },
                locate: true,
                frequency: 5, // Reduced frequency for better accuracy
                debug: true
            };
            
            // Initialize QuaggaJS
            console.log('🔧 Initializing QuaggaJS with config:', config);
            
            Quagga.init(config, (err) => {
                if (err) {
                    console.error('❌ QuaggaJS init error:', err);
                    this.handleCameraError(err);
                    this.resetScannerUI(type);
                    return;
                }
                
                console.log("🚀 QuaggaJS initialization finished. Ready to start");
                console.log("📋 Available readers:", config.decoder.readers);
                console.log("🎥 Camera constraints:", config.inputStream.constraints);
                
                Quagga.start();
                
                document.getElementById(scannerId).classList.add('active');
                this.showMessage('Scanner started! Point camera at barcode and hold steady.', 'success');
                
                // Store the scanner type for cleanup
                if (type === 'add') {
                    this.scannerAdd = 'active';
                } else {
                    this.scannerBill = 'active';
                }
                
                // Add scanning tips after a delay
                setTimeout(() => {
                    this.showMessage('💡 TIP: Try different angles and distances if not detecting', 'info', 3000);
                }, 5000);
                
                // Optional: Auto-stop after 60 seconds
                setTimeout(() => {
                    if ((type === 'add' && this.scannerAdd) || (type === 'bill' && this.scannerBill)) {
                        this.showMessage('⏰ Scanner auto-stopped after 1 minute. Click to restart.', 'warning');
                        this.stopScanner(type);
                    }
                }, 60000);
            });
            
            // Handle successful barcode detection
            Quagga.onDetected((result) => {
                const code = result.codeResult.code;
                const format = result.codeResult.format;
                const confidence = result.codeResult.decodedCodes[result.codeResult.decodedCodes.length - 1].error || 0;
                
                console.log('🎯 BARCODE SUCCESSFULLY DETECTED!');
                console.log('Code:', code);
                console.log('Format:', format);
                console.log('Confidence:', confidence);
                console.log('Full result:', result);
                
                // Validate barcode length (basic validation)
                if (code && code.length >= 3) {
                    // Show detection feedback
                    this.showMessage(`✅ Barcode detected: ${code} (${format})`, 'success', 5000);
                    
                    this.handleScanResult(code, type);
                    this.stopScanner(type);
                } else {
                    console.warn('⚠️ Invalid barcode detected:', code);
                    this.showMessage(`Invalid barcode: ${code}. Continuing scan...`, 'warning', 2000);
                }
            });
            
            // Handle processing with detailed debugging
            Quagga.onProcessed((result) => {
                const drawingCtx = Quagga.canvas.ctx.overlay;
                const drawingCanvas = Quagga.canvas.dom.overlay;

                if (result) {
                    // Clear previous drawings
                    if (drawingCtx && drawingCanvas) {
                        drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                    }
                    
                    // Draw candidate boxes (green)
                    if (result.boxes) {
                        console.log('📦 Detected boxes:', result.boxes.length);
                        result.boxes.filter((box) => box !== result.box).forEach((box, index) => {
                            if (drawingCtx) {
                                Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                            }
                        });
                    }

                    // Draw main detection box (blue)
                    if (result.box) {
                        console.log('🔵 Main box detected');
                        if (drawingCtx) {
                            Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
                        }
                    }

                    // Draw successful scan line (red) and log details
                    if (result.codeResult) {
                        if (result.codeResult.code) {
                            console.log('🔴 SCAN LINE DETECTED - Code found:', result.codeResult.code);
                            if (drawingCtx) {
                                Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
                            }
                        } else {
                            console.log('🟡 Scan attempt - no code yet. Format:', result.codeResult.format);
                        }
                    }
                } else {
                    // No result at all
                    console.log('⚪ No detection patterns found in this frame');
                }
            });
            
        } catch (err) {
            console.error('Error starting scanner:', err);
            this.handleCameraError(err);
            this.resetScannerUI(type);
        }
    }
    
    async stopScanner(type) {
        try {
            // Stop QuaggaJS scanner
            if (Quagga && typeof Quagga.stop === 'function') {
                Quagga.stop();
                console.log('QuaggaJS scanner stopped');
            }
            
            // Clear scanner references
            if (type === 'add') {
                this.scannerAdd = null;
            } else {
                this.scannerBill = null;
            }
            
        } catch (err) {
            console.error('Error stopping scanner:', err);
        }
        
        const scannerId = type === 'add' ? 'scanner-add' : 'scanner-bill';
        const scannerElement = document.getElementById(scannerId);
        scannerElement.classList.remove('active');
        
        // Clear the scanner container
        scannerElement.innerHTML = '';
        
        this.resetScannerUI(type);
    }
    
    resetScannerUI(type) {
        const startBtn = document.getElementById(`start-scan-${type}`);
        const stopBtn = document.getElementById(`stop-scan-${type}`);
        
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }
    
    stopAllScanners() {
        try {
            // Stop QuaggaJS completely
            if (Quagga && typeof Quagga.stop === 'function') {
                Quagga.stop();
                console.log('All QuaggaJS scanners stopped');
            }
            
            // Clear all scanner references
            this.scannerAdd = null;
            this.scannerBill = null;
            
            // Clear scanner containers
            const scannerAdd = document.getElementById('scanner-add');
            const scannerBill = document.getElementById('scanner-bill');
            
            if (scannerAdd) {
                scannerAdd.classList.remove('active');
                scannerAdd.innerHTML = '';
            }
            
            if (scannerBill) {
                scannerBill.classList.remove('active');
                scannerBill.innerHTML = '';
            }
            
            // Reset UI
            this.resetScannerUI('add');
            this.resetScannerUI('bill');
            
        } catch (err) {
            console.error('Error stopping all scanners:', err);
        }
    }
    
    useManualBarcode(type) {
        const inputId = type === 'add' ? 'manual-barcode-add' : 'manual-barcode-bill';
        const barcode = document.getElementById(inputId).value.trim();
        
        if (!barcode) {
            this.showMessage('Please enter a barcode first.', 'error');
            return;
        }
        
        this.handleScanResult(barcode, type);
        document.getElementById(inputId).value = ''; // Clear input after use
    }

    handleScanResult(barcode, type) {
        this.showMessage(`Using barcode: ${barcode}`, 'success');
        
        if (type === 'add') {
            document.getElementById('book-barcode').value = barcode;
            document.getElementById('book-name').focus();
        } else if (type === 'bill') {
            this.addToBill(barcode);
        }
    }
    
    addBook() {
        const barcode = document.getElementById('book-barcode').value.trim();
        const name = document.getElementById('book-name').value.trim();
        const price = parseFloat(document.getElementById('book-price').value);
        const details = document.getElementById('book-details').value.trim();
        
        if (!barcode || !name || !price) {
            this.showMessage('Please fill in all required fields.', 'error');
            return;
        }
        
        // Check if book already exists
        const existingBook = this.books.find(book => book.barcode === barcode);
        if (existingBook) {
            this.showMessage('A book with this barcode already exists!', 'error');
            return;
        }
        
        const book = {
            id: Date.now(),
            barcode: barcode,
            name: name,
            price: price,
            details: details,
            dateAdded: new Date().toISOString()
        };
        
        this.books.push(book);
        this.saveBooks();
        this.clearBookForm();
        this.showMessage('Book added successfully!', 'success');
        
        // Switch to inventory to show the added book
        this.switchSection('inventory');
    }
    
    clearBookForm() {
        document.getElementById('book-barcode').value = '';
        document.getElementById('book-name').value = '';
        document.getElementById('book-price').value = '';
        document.getElementById('book-details').value = '';
    }
    
    deleteBook(id) {
        if (confirm('Are you sure you want to delete this book?')) {
            this.books = this.books.filter(book => book.id !== id);
            this.saveBooks();
            this.displayBooks();
            this.updateStats();
            this.showMessage('Book deleted successfully!', 'success');
        }
    }
    
    editBook(id) {
        const book = this.books.find(book => book.id === id);
        if (!book) return;
        
        const newName = prompt('Enter new book name:', book.name);
        if (newName && newName.trim()) {
            book.name = newName.trim();
        }
        
        const newPrice = prompt('Enter new price:', book.price);
        if (newPrice && !isNaN(parseFloat(newPrice))) {
            book.price = parseFloat(newPrice);
        }
        
        const newDetails = prompt('Enter new details:', book.details);
        if (newDetails !== null) {
            book.details = newDetails.trim();
        }
        
        this.saveBooks();
        this.displayBooks();
        this.updateStats();
        this.showMessage('Book updated successfully!', 'success');
    }
    
    searchBooks(query) {
        const filteredBooks = this.books.filter(book =>
            book.name.toLowerCase().includes(query.toLowerCase()) ||
            book.barcode.includes(query) ||
            book.details.toLowerCase().includes(query.toLowerCase())
        );
        this.displayBooks(filteredBooks);
    }
    
    displayBooks(booksToShow = this.books) {
        const booksListElement = document.getElementById('books-list');
        
        if (booksToShow.length === 0) {
            booksListElement.innerHTML = '<div class="no-books">No books found.</div>';
            return;
        }
        
        const booksHTML = booksToShow.map(book => `
            <div class="book-item">
                <span class="book-barcode">${book.barcode}</span>
                <span class="book-name" title="${book.details}">${book.name}</span>
                <span class="book-price">$${book.price.toFixed(2)}</span>
                <span class="item-actions">
                    <button class="edit-btn" onclick="library.editBook(${book.id})">Edit</button>
                    <button class="delete-btn" onclick="library.deleteBook(${book.id})">Delete</button>
                </span>
            </div>
        `).join('');
        
        booksListElement.innerHTML = booksHTML;
    }
    
    addToBill(barcode) {
        const book = this.books.find(book => book.barcode === barcode);
        
        if (!book) {
            this.showMessage('Book not found in inventory!', 'error');
            return;
        }
        
        const existingItem = this.currentBill.find(item => item.barcode === barcode);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.currentBill.push({
                barcode: book.barcode,
                name: book.name,
                price: book.price,
                quantity: 1
            });
        }
        
        this.displayBill();
        this.showMessage(`Added ${book.name} to bill`, 'success');
    }
    
    removeFromBill(barcode) {
        this.currentBill = this.currentBill.filter(item => item.barcode !== barcode);
        this.displayBill();
        this.showMessage('Item removed from bill', 'success');
    }
    
    updateBillItemQuantity(barcode, change) {
        const item = this.currentBill.find(item => item.barcode === barcode);
        if (!item) return;
        
        item.quantity += change;
        
        if (item.quantity <= 0) {
            this.removeFromBill(barcode);
        } else {
            this.displayBill();
        }
    }
    
    displayBill() {
        const billItemsList = document.getElementById('bill-items-list');
        const billTotalElement = document.getElementById('bill-total');
        
        if (this.currentBill.length === 0) {
            billItemsList.innerHTML = '<div class="no-items">No items in bill.</div>';
            billTotalElement.textContent = '0.00';
            return;
        }
        
        const billHTML = this.currentBill.map(item => {
            const total = item.price * item.quantity;
            return `
                <div class="bill-item">
                    <span class="item-name">${item.name}</span>
                    <span class="item-price">$${item.price.toFixed(2)}</span>
                    <span class="quantity-controls">
                        <button class="qty-btn" onclick="library.updateBillItemQuantity('${item.barcode}', -1)">-</button>
                        <span class="qty-display">${item.quantity}</span>
                        <button class="qty-btn" onclick="library.updateBillItemQuantity('${item.barcode}', 1)">+</button>
                    </span>
                    <span class="item-total">$${total.toFixed(2)}</span>
                    <span class="item-actions">
                        <button class="delete-btn" onclick="library.removeFromBill('${item.barcode}')">Remove</button>
                    </span>
                </div>
            `;
        }).join('');
        
        billItemsList.innerHTML = billHTML;
        
        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        billTotalElement.textContent = total.toFixed(2);
    }
    
    clearBill() {
        if (this.currentBill.length === 0) {
            this.showMessage('Bill is already empty.', 'warning');
            return;
        }
        
        if (confirm('Are you sure you want to clear the current bill?')) {
            this.currentBill = [];
            this.displayBill();
            this.showMessage('Bill cleared successfully!', 'success');
        }
    }
    
    processBill() {
        if (this.currentBill.length === 0) {
            this.showMessage('No items in bill to process.', 'error');
            return;
        }
        
        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (confirm(`Process payment of $${total.toFixed(2)}?`)) {
            // In a real application, you would process the payment here
            // and save the transaction to a database
            
            const transaction = {
                id: Date.now(),
                items: [...this.currentBill],
                total: total,
                date: new Date().toISOString(),
                processedBy: this.currentUser
            };
            
            // Save transaction to localStorage (in production, use a proper database)
            const transactions = JSON.parse(localStorage.getItem('libraryTransactions') || '[]');
            transactions.push(transaction);
            localStorage.setItem('libraryTransactions', JSON.stringify(transactions));
            
            this.currentBill = [];
            this.displayBill();
            this.showMessage(`Payment processed successfully! Total: $${total.toFixed(2)}`, 'success');
        }
    }
    
    updateStats() {
        const totalBooksElement = document.getElementById('total-books');
        const totalValueElement = document.getElementById('total-value');
        
        const totalBooks = this.books.length;
        const totalValue = this.books.reduce((sum, book) => sum + book.price, 0);
        
        totalBooksElement.textContent = totalBooks;
        totalValueElement.textContent = `$${totalValue.toFixed(2)}`;
    }
    
    saveBooks() {
        localStorage.setItem('libraryBooks', JSON.stringify(this.books));
    }
    
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }
    
    handleCameraError(error) {
        console.error('Camera error:', error);
        
        // Simple error message - let user figure out the issue
        if (error.name === 'NotAllowedError' || error.message.includes('Permission')) {
            this.showMessage('Camera permission denied. Please allow camera access and try again.', 'error');
        } else if (error.name === 'NotFoundError') {
            this.showMessage('No camera found on this device.', 'error');
        } else {
            this.showMessage('Unable to start camera. Please check your device and browser settings.', 'error');
        }
    }
    
    testCameraAccess(type) {
        const testBtn = document.getElementById(`test-camera-${type}`);
        const originalText = testBtn.textContent;
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;
        
        // Simple camera test - let browser handle permissions
        navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        })
        .then(stream => {
            // Camera access successful
            stream.getTracks().forEach(track => track.stop());
            this.showMessage('✅ Camera access works! You can now scan barcodes.', 'success');
            testBtn.textContent = '✅ Camera OK';
            testBtn.style.background = '#28a745';
        })
        .catch(error => {
            console.error('Camera test failed:', error);
            this.showMessage('❌ Camera access failed. Please allow camera permissions and try again.', 'error');
            testBtn.textContent = '❌ Try Again';
            testBtn.style.background = '#dc3545';
        })
        .finally(() => {
            testBtn.disabled = false;
            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.style.background = '';
            }, 3000);
        });
    }

    showMessage(message, type = 'success', duration = 5000) {
        const messageContainer = document.getElementById('message-container');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        // Handle multi-line messages
        if (message.includes('\n')) {
            const lines = message.split('\n');
            messageElement.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
        } else {
            messageElement.textContent = message;
        }
        
        messageContainer.appendChild(messageElement);
        
        // Auto remove after specified duration
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, duration);
        
        // Allow manual removal by clicking
        messageElement.addEventListener('click', () => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        });
    }
}

// Initialize the application
let library;

document.addEventListener('DOMContentLoaded', () => {
    library = new LibraryInventorySystem();
});

// Handle page visibility changes to stop scanners when page is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden && library) {
        library.stopAllScanners();
    }
});

// Handle window beforeunload to clean up scanners
window.addEventListener('beforeunload', () => {
    if (library) {
        library.stopAllScanners();
    }
});