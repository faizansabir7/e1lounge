// Library Inventory Management System - Flask API Integration
class LibraryInventorySystem {
    constructor() {
        this.currentBill = [];
        this.isMobileDevice = this.checkMobile();
        this.scanningActive = false;
        this.scanCheckInterval = null;
        this.currentStream = null;
        this.allBooks = []; // Cache for autocomplete
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadInventory();
        this.updateStats();
    }
    
    checkMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });
        
        // Add Book Form
        document.getElementById('add-book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });
        
        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearBookForm();
        });
        
        // Check for existing book when barcode is entered
        document.getElementById('book-barcode').addEventListener('blur', async (e) => {
            const barcode = e.target.value.trim();
            if (barcode) {
                await this.checkExistingBook(barcode);
            }
        });
        
        // Add Book Scanner
        document.getElementById('start-camera').addEventListener('click', () => {
            this.startScanner('add');
        });
        
        document.getElementById('stop-camera').addEventListener('click', () => {
            this.stopScanner('add');
        });
        
        // Billing Scanner
        document.getElementById('start-camera-bill').addEventListener('click', () => {
            this.startScanner('bill');
        });
        
        document.getElementById('stop-camera-bill').addEventListener('click', () => {
            this.stopScanner('bill');
        });
        
        // Flashlight buttons
        const flashBtnAdd = document.getElementById('flash-btn');
        const flashBtnBill = document.getElementById('flash-btn-bill');
        
        if (flashBtnAdd) {
            flashBtnAdd.addEventListener('click', () => {
                this.toggleFlashlight('add');
            });
        }
        
        if (flashBtnBill) {
            flashBtnBill.addEventListener('click', () => {
                this.toggleFlashlight('bill');
            });
        }
        
        // Manual Barcode Input for Billing
        const manualBarcodeInput = document.getElementById('manual-barcode-bill');
        const suggestionsList = document.getElementById('barcode-suggestions');
        
        manualBarcodeInput.addEventListener('input', (e) => {
            this.showBarcodeSuggestions(e.target.value);
        });
        
        manualBarcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const barcode = e.target.value.trim();
                if (barcode) {
                    this.addToBill(barcode);
                    e.target.value = '';
                    suggestionsList.innerHTML = '';
                }
            }
        });
        
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!manualBarcodeInput.contains(e.target) && !suggestionsList.contains(e.target)) {
                suggestionsList.innerHTML = '';
            }
        });
        
        // Search
        document.getElementById('search-books').addEventListener('input', (e) => {
            this.searchBooks(e.target.value);
        });
        
        document.getElementById('clear-search').addEventListener('click', () => {
            document.getElementById('search-books').value = '';
            this.loadInventory();
        });
        
        // Billing
        document.getElementById('clear-bill').addEventListener('click', () => {
            this.clearBill();
        });
        
        document.getElementById('process-bill').addEventListener('click', () => {
            this.processBill();
        });
        
        // Download Buttons
        document.getElementById('download-inventory-btn').addEventListener('click', () => {
            this.downloadInventory();
        });
        
        document.getElementById('download-transactions-btn').addEventListener('click', () => {
            this.downloadTransactions();
        });
    }
    
    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Update sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
        
        // Stop any active scanning
        this.stopScanner('add');
        this.stopScanner('bill');
        
        // Clear suggestions
        document.getElementById('barcode-suggestions').innerHTML = '';
        
        // Update content
        if (sectionName === 'inventory') {
            this.loadInventory();
            this.updateStats();
        } else if (sectionName === 'billing') {
            this.displayBill();
            this.loadBooksForAutocomplete();
        }
    }
    
    async loadBooksForAutocomplete() {
        try {
            const response = await fetch('/api/books');
            const data = await response.json();
            this.allBooks = data.books || [];
        } catch (error) {
            console.error('Error loading books for autocomplete:', error);
        }
    }
    
    showBarcodeSuggestions(query) {
        const suggestionsList = document.getElementById('barcode-suggestions');
        
        if (!query || query.length < 1) {
            suggestionsList.innerHTML = '';
            return;
        }
        
        // Filter books by barcode or name
        const matches = this.allBooks.filter(book => 
            book.barcode.toLowerCase().includes(query.toLowerCase()) ||
            book.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5); // Limit to 5 suggestions
        
        if (matches.length === 0) {
            suggestionsList.innerHTML = '<div class="suggestion-item no-match">No matching books found</div>';
            return;
        }
        
        suggestionsList.innerHTML = matches.map(book => `
            <div class="suggestion-item" data-barcode="${book.barcode}">
                <div class="suggestion-barcode">${book.barcode}</div>
                <div class="suggestion-name">${book.name}</div>
                <div class="suggestion-price">₹${parseFloat(book.price).toFixed(2)}</div>
            </div>
        `).join('');
        
        // Add click handlers to suggestions
        suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const barcode = item.dataset.barcode;
                if (barcode) {
                    this.addToBill(barcode);
                    document.getElementById('manual-barcode-bill').value = '';
                    suggestionsList.innerHTML = '';
                }
            });
        });
    }
    
    async startScanner(type) {
        const scanType = type === 'add' ? '' : '-bill';
        const video = document.getElementById(`video${scanType}`);
        const canvas = document.getElementById(`canvas${scanType}`);
        const startBtn = document.getElementById(`start-camera${scanType}`);
        const stopBtn = document.getElementById(`stop-camera${scanType}`);
        const resultDiv = document.getElementById(`scan-result${scanType}`);
        const flashBtn = document.getElementById(`flash-btn${scanType}`);
        
        try {
            // Request camera access with advanced settings
            const constraints = {
                video: {
                    facingMode: this.isMobileDevice ? 'environment' : 'user',
                    width: { ideal: 1280 },  // Higher resolution for better zoom quality
                    height: { ideal: 720 }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentStream = stream;
            
            video.srcObject = stream;
            video.style.display = 'block';
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // Enable flashlight button if available
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            
            if (capabilities.torch) {
                if (flashBtn) {
                    flashBtn.style.display = 'inline-block';
                    flashBtn.disabled = false;
                }
            }
            
            // Start continuous scanning
            this.scanningActive = true;
            this.flashlightOn = false;
            
            // Wait for video to be ready
            video.addEventListener('loadedmetadata', async () => {
                console.log(`✅ Video ready: ${video.videoWidth}x${video.videoHeight}`);
                
                // Apply 2x zoom for better macro focusing
                try {
                    const capabilities = track.getCapabilities();
                    if (capabilities.zoom) {
                        const settings = track.getSettings();
                        const maxZoom = capabilities.zoom.max;
                        const minZoom = capabilities.zoom.min;
                        const currentZoom = settings.zoom || minZoom;
                        
                        // Set to 2x zoom or max available (whichever is lower)
                        const targetZoom = Math.min(2.0, maxZoom);
                        
                        await track.applyConstraints({
                            advanced: [{ zoom: targetZoom }]
                        });
                        
                        console.log(`✅ Zoom applied: ${targetZoom}x (Range: ${minZoom}-${maxZoom})`);
                        resultDiv.textContent = `📹 Camera active with ${targetZoom}x zoom! Point at barcode...`;
                    } else {
                        console.log('⚠️ Zoom not supported on this device');
                    }
                } catch (zoomError) {
                    console.warn('⚠️ Could not apply zoom:', zoomError);
                }
                
                this.continuousScan(type, video, canvas, resultDiv);
            }, { once: true });
            
        } catch (error) {
            console.error('Scanner error:', error);
            resultDiv.style.display = 'block';
            resultDiv.className = 'scan-result error';
            
            if (error.name === 'NotAllowedError') {
                resultDiv.textContent = '❌ Camera permission denied. Please allow camera access and try again.';
            } else if (error.name === 'NotFoundError') {
                resultDiv.textContent = '❌ No camera found on this device.';
            } else {
                resultDiv.textContent = `❌ Error: ${error.message}`;
            }
            
            startBtn.disabled = false;
            stopBtn.disabled = true;
            if (flashBtn) {
                flashBtn.style.display = 'none';
            }
        }
    }
    
    async toggleFlashlight(type) {
        if (!this.currentStream) return;
        
        const track = this.currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        
        if (!capabilities.torch) {
            console.log('⚠️ Flashlight not supported on this device');
            return;
        }
        
        try {
            this.flashlightOn = !this.flashlightOn;
            await track.applyConstraints({
                advanced: [{ torch: this.flashlightOn }]
            });
            
            const scanType = type === 'add' ? '' : '-bill';
            const flashBtn = document.getElementById(`flash-btn${scanType}`);
            if (flashBtn) {
                flashBtn.textContent = this.flashlightOn ? '🔦 Flash: ON' : '💡 Flash: OFF';
                flashBtn.classList.toggle('flash-active', this.flashlightOn);
            }
            
            console.log(`🔦 Flashlight ${this.flashlightOn ? 'ON' : 'OFF'}`);
        } catch (error) {
            console.error('❌ Flashlight toggle error:', error);
        }
    }
    
    async continuousScan(type, video, canvas, resultDiv) {
        const ctx = canvas.getContext('2d');
        let scanCount = 0;
        const maxScans = 200; // Auto-stop after ~1 minute (200 * 300ms)
        
        const scanFrame = async () => {
            if (!this.scanningActive) {
                console.log('🛑 Scanning stopped by user');
                return;
            }
            
            scanCount++;
            
            // Auto-stop after max scans
            if (scanCount >= maxScans) {
                console.log('⏰ Auto-stopping scanner after timeout');
                resultDiv.className = 'scan-result error';
                resultDiv.textContent = '⏰ Scanner timed out. Please try again.';
                this.stopScanner(type);
                return;
            }
            
            try {
                // Capture frame exactly as displayed (with zoom applied)
                // This ensures the zoomed-in view is what gets sent for decoding
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Convert to base64 with good quality for barcode recognition
                const imageData = canvas.toDataURL('image/jpeg', 0.9);
                
                // Send to backend for processing
                const response = await fetch('/api/scan_barcode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageData, type })
                });
                
                const data = await response.json();
                
                if (data.detected && data.barcode) {
                    console.log('✅ Barcode detected:', data.barcode);
                    this.handleScanResult(data.barcode, type);
                    this.stopScanner(type);
                    return;
                } else if (data.error) {
                    console.warn('⚠️ Scan error:', data.error);
                }
                
                // Update status every 10 scans
                if (scanCount % 10 === 0) {
                    resultDiv.textContent = `📹 Scanning... (${scanCount} attempts) - Hold barcode steady`;
                }
                
                // Continue scanning
                if (this.scanningActive) {
                    setTimeout(scanFrame, 300); // Scan every 300ms
                }
                
            } catch (error) {
                console.error('❌ Scan frame error:', error);
                if (this.scanningActive) {
                    setTimeout(scanFrame, 300);
                }
            }
        };
        
        // Start scanning
        console.log('🎬 Starting continuous scan with zoom applied');
        scanFrame();
    }
    
    async stopScanner(type) {
        const scanType = type === 'add' ? '' : '-bill';
        const video = document.getElementById(`video${scanType}`);
        const startBtn = document.getElementById(`start-camera${scanType}`);
        const stopBtn = document.getElementById(`stop-camera${scanType}`);
        const flashBtn = document.getElementById(`flash-btn${scanType}`);
        
        console.log('🛑 Stopping scanner');
        this.scanningActive = false;
        this.flashlightOn = false;
        
        if (this.scanCheckInterval) {
            clearInterval(this.scanCheckInterval);
            this.scanCheckInterval = null;
        }
        
        // Turn off flashlight before stopping
        if (this.currentStream) {
            const track = this.currentStream.getVideoTracks()[0];
            try {
                await track.applyConstraints({
                    advanced: [{ torch: false }]
                });
            } catch (e) {
                // Ignore errors when turning off torch
            }
        }
        
        // Stop video stream
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
                console.log('🎥 Stopped track:', track.kind);
            });
            this.currentStream = null;
        }
        
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        
        video.style.display = 'none';
        
        startBtn.disabled = false;
        stopBtn.disabled = true;
        
        // Hide and reset flashlight button
        if (flashBtn) {
            flashBtn.style.display = 'none';
            flashBtn.disabled = true;
            flashBtn.textContent = '💡 Flash: OFF';
            flashBtn.classList.remove('flash-active');
        }
    }
    
    async handleScanResult(barcode, type) {
        const scanType = type === 'add' ? '' : '-bill';
        const resultDiv = document.getElementById(`scan-result${scanType}`);
        
        resultDiv.style.display = 'block';
        resultDiv.className = 'scan-result success';
        resultDiv.textContent = `✅ Barcode detected: ${barcode}`;
        
        if (type === 'add') {
            document.getElementById('book-barcode').value = barcode;
            // Check if book exists immediately after scan
            await this.checkExistingBook(barcode);
        } else if (type === 'bill') {
            this.addToBill(barcode);
        }
    }
    
    async checkExistingBook(barcode) {
        if (!barcode) return;
        
        try {
            const checkResponse = await fetch(`/api/book/${barcode}`);
            
            if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (checkData.book) {
                    // Book exists, show options dialog immediately
                    this.showExistingBookDialog(checkData.book);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Check existing book error:', error);
            return false;
        }
    }
    
    async addBook() {
        const barcode = document.getElementById('book-barcode').value.trim();
        const name = document.getElementById('book-name').value.trim();
        const price = document.getElementById('book-price').value.trim();
        const quantity = document.getElementById('book-quantity').value.trim();
        const details = document.getElementById('book-details').value.trim();
        
        if (!barcode) {
            this.showMessage('Please enter a barcode', 'error');
            return;
        }
        
        try {
            // Check if book already exists
            const exists = await this.checkExistingBook(barcode);
            if (exists) {
                return; // Dialog already shown
            }
            
            // New book - validate all fields
            if (!name || !price) {
                this.showMessage('Please fill all required fields (Name and Price)', 'error');
                return;
            }
            
            // Proceed with adding new book
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, name, price, quantity: quantity || 1, details })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage(data.message || 'Book added successfully!', 'success');
                this.clearBookForm();
                this.switchSection('inventory');
            } else {
                this.showMessage(data.error || 'Failed to add book', 'error');
            }
            
        } catch (error) {
            console.error('Add book error:', error);
            this.showMessage('Error adding book', 'error');
        }
    }
    
    showExistingBookDialog(book) {
        // Replace the form content with existing book options
        const formContainer = document.getElementById('add-book-form');
        
        // Store original form HTML to restore later
        if (!this.originalFormHTML) {
            this.originalFormHTML = formContainer.innerHTML;
        }
        
        formContainer.innerHTML = `
            <div class="existing-book-container">
                <div class="alert alert-warning">
                    <strong>⚠️ Book Already Exists in Inventory</strong>
                </div>
                
                <div class="existing-book-details">
                    <h3>Current Book Information</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Barcode:</label>
                            <span>${book.barcode}</span>
                        </div>
                        <div class="info-item">
                            <label>Book Name:</label>
                            <span>${book.name}</span>
                        </div>
                        <div class="info-item">
                            <label>Price:</label>
                            <span>₹${parseFloat(book.price).toFixed(2)}</span>
                        </div>
                        <div class="info-item">
                            <label>Current Quantity:</label>
                            <span class="quantity-badge">${book.quantity}</span>
                        </div>
                        <div class="info-item full-width">
                            <label>Details:</label>
                            <span>${book.details || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="update-section">
                    <h3>Update Quantity</h3>
                    <div class="input-group">
                        <label for="new-quantity">Set New Quantity:</label>
                        <input type="number" id="new-quantity" min="0" value="${book.quantity}" class="quantity-input">
                        <small style="color: #7f8c8d; display: block; margin-top: 0.5rem;">
                            Enter 0 to mark as out of stock, or any positive number
                        </small>
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: 2rem;">
                    <button type="button" class="btn btn-danger" onclick="library.deleteBook('${book.barcode}')">
                        Delete Book
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="library.restoreAddBookForm()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" onclick="library.updateBookQuantity('${book.barcode}')">
                        qUpdate Quantity
                    </button>
                </div>
            </div>
        `;
    }
    
    restoreAddBookForm() {
        const formContainer = document.getElementById('add-book-form');
        if (this.originalFormHTML) {
            formContainer.innerHTML = this.originalFormHTML;
        }
        this.clearBookForm();
    }
    
    async updateBookQuantity(barcode) {
        const newQuantity = document.getElementById('new-quantity').value;
        
        if (newQuantity === '' || newQuantity < 0) {
            this.showMessage('Please enter a valid quantity (0 or greater)', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/update_book_quantity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    barcode: barcode, 
                    quantity: parseInt(newQuantity) 
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage(data.message || 'Quantity updated successfully!', 'success');
                this.restoreAddBookForm();
                this.loadInventory();
                this.updateStats();
            } else {
                this.showMessage(data.error || 'Failed to update quantity', 'error');
            }
            
        } catch (error) {
            console.error('Update quantity error:', error);
            this.showMessage('Error updating quantity', 'error');
        }
    }
    
    async deleteBook(barcode) {
        if (!confirm('Are you sure you want to delete this book from inventory? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch('/api/delete_book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode: barcode })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage('Book deleted successfully!', 'success');
                this.restoreAddBookForm();
                this.loadInventory();
                this.updateStats();
            } else {
                this.showMessage(data.error || 'Failed to delete book', 'error');
            }
            
        } catch (error) {
            console.error('Delete book error:', error);
            this.showMessage('Error deleting book', 'error');
        }
    }
    
    clearBookForm() {
        document.getElementById('book-barcode').value = '';
        document.getElementById('book-name').value = '';
        document.getElementById('book-price').value = '';
        document.getElementById('book-quantity').value = '1';
        document.getElementById('book-details').value = '';
    }
    
    async loadInventory() {
        try {
            const response = await fetch('/api/books');
            const data = await response.json();
            
            this.allBooks = data.books || [];
            this.displayBooks(this.allBooks);
            
        } catch (error) {
            console.error('Load inventory error:', error);
            this.showMessage('Error loading inventory', 'error');
        }
    }
    
    displayBooks(books) {
        const container = document.getElementById('books-container');
        
        if (books.length === 0) {
            container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #7f8c8d;">No books found</td></tr>';
            return;
        }
        
        container.innerHTML = books.map(book => `
            <tr>
                <td>${book.barcode}</td>
                <td>${book.name}</td>
                <td>₹${parseFloat(book.price).toFixed(2)}</td>
                <td>${book.quantity || 0}</td>
                <td>${book.details || 'N/A'}</td>
                <td>${new Date(book.date_added).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }
    
    async searchBooks(query) {
        const filtered = this.allBooks.filter(book =>
            book.name.toLowerCase().includes(query.toLowerCase()) ||
            book.barcode.includes(query) ||
            (book.details && book.details.toLowerCase().includes(query.toLowerCase()))
        );
        
        this.displayBooks(filtered);
    }
    
    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            document.getElementById('total-books').textContent = data.total_books || 0;
            document.getElementById('total-quantity').textContent = data.total_quantity || 0;
            document.getElementById('total-value').textContent = `₹${(data.total_value || 0).toFixed(2)}`;
            
        } catch (error) {
            console.error('Update stats error:', error);
        }
    }
    
    async addToBill(barcode) {
        try {
            const response = await fetch(`/api/book/${barcode}`);
            const data = await response.json();
            
            if (response.ok && data.book) {
                const book = data.book;
                
                // Check if book has stock
                if (book.quantity <= 0) {
                    this.showMessage(`${book.name} is out of stock`, 'error');
                    return;
                }
                
                const existing = this.currentBill.find(item => item.barcode === barcode);
                
                if (existing) {
                    // Check if adding more exceeds available stock
                    if (existing.quantity >= book.quantity) {
                        this.showMessage(`Cannot add more. Only ${book.quantity} available in stock`, 'error');
                        return;
                    }
                    existing.quantity += 1;
                } else {
                    this.currentBill.push({
                        barcode: book.barcode,
                        name: book.name,
                        price: parseFloat(book.price),
                        quantity: 1,
                        availableStock: book.quantity
                    });
                }
                
                this.displayBill();
                this.showMessage(`Added ${book.name} to bill`, 'success');
            } else {
                this.showMessage('Book not found in inventory', 'error');
            }
            
        } catch (error) {
            console.error('Add to bill error:', error);
            this.showMessage('Error adding to bill', 'error');
        }
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
    
    removeFromBill(barcode) {
        this.currentBill = this.currentBill.filter(item => item.barcode !== barcode);
        this.displayBill();
    }
    
    displayBill() {
        const container = document.getElementById('bill-items');
        const totalElement = document.getElementById('bill-total');
        
        if (this.currentBill.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="empty-bill">No items in bill</td></tr>';
            totalElement.textContent = '0.00';
            return;
        }
        
        container.innerHTML = this.currentBill.map(item => {
            const total = item.price * item.quantity;
            return `
                <tr>
                    <td class="item-name">${item.name}</td>
                    <td>₹${item.price.toFixed(2)}</td>
                    <td>
                        <div class="quantity-controls">
                            <button class="qty-btn" onclick="library.updateBillItemQuantity('${item.barcode}', -1)">-</button>
                            <span class="qty-display">${item.quantity}</span>
                            <button class="qty-btn" onclick="library.updateBillItemQuantity('${item.barcode}', 1)">+</button>
                        </div>
                    </td>
                    <td>₹${total.toFixed(2)}</td>
                    <td>
                        <button class="delete-btn" onclick="library.removeFromBill('${item.barcode}')">Remove</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalElement.textContent = total.toFixed(2);
    }
    
    clearBill() {
        if (this.currentBill.length === 0) {
            this.showMessage('Bill is already empty', 'info');
            return;
        }
        
        if (confirm('Clear current bill?')) {
            this.currentBill = [];
            this.displayBill();
            document.getElementById('customer-name').value = '';
            this.showMessage('Bill cleared', 'success');
        }
    }
    
    async processBill() {
        if (this.currentBill.length === 0) {
            this.showMessage('No items in bill', 'error');
            return;
        }
        
        const customerName = document.getElementById('customer-name').value.trim();
        
        if (!customerName) {
            this.showMessage('Please enter customer name', 'error');
            document.getElementById('customer-name').focus();
            return;
        }
        
        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (!confirm(`Process payment of ₹${total.toFixed(2)} for ${customerName}?`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/process_bill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: this.currentBill,
                    total: total,
                    customer_name: customerName
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage(`Payment processed! Transaction ID: ${data.transaction_id}`, 'success');
                this.currentBill = [];
                this.displayBill();
                document.getElementById('customer-name').value = '';
                // Reload inventory to show updated quantities
                this.loadInventory();
                this.updateStats();
            } else {
                if (data.details) {
                    this.showMessage(`${data.error}: ${data.details.join(', ')}`, 'error');
                } else {
                    this.showMessage(data.error || 'Failed to process payment', 'error');
                }
            }
            
        } catch (error) {
            console.error('Process bill error:', error);
            this.showMessage('Error processing payment', 'error');
        }
    }
    
    showMessage(message, type = 'info') {
        const container = document.createElement('div');
        container.className = `message ${type}`;
        container.textContent = message;
        container.style.cursor = 'pointer';
        
        document.body.appendChild(container);
        
        const remove = () => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        };
        
        container.addEventListener('click', remove);
        setTimeout(remove, 5000);
    }
    
    downloadInventory() {
        window.location.href = '/api/download_inventory';
        this.showMessage('Downloading inventory CSV...', 'success');
    }
    
    downloadTransactions() {
        window.location.href = '/api/download_transactions';
        this.showMessage('Downloading transactions CSV...', 'success');
    }
}

// Initialize
let library;
document.addEventListener('DOMContentLoaded', () => {
    library = new LibraryInventorySystem();
});