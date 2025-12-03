// Library Inventory Management System
class LibraryInventorySystem {
    constructor() {
        this.books = [];
        this.currentBill = [];
        this.isLoggedIn = false;
        this.scannerAdd = null;
        this.scannerBill = null;
        this.currentUser = null;
        this.currentStream = null;
        this.scanningActive = false;
        this.flashlightOn = false;
        this.isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.allBooks = []; // Cache for autocomplete
        this.currentExistingBook = null; // For update quantity mode

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkLoginStatus();

        // Show server error if exists
        if (window.serverError) {
            this.showToast(window.serverError, 'error');
        }
    }

    checkLoginStatus() {
        // Use server-provided state
        this.isLoggedIn = window.isAuthenticated;
        this.currentUser = window.currentUser;

        if (this.isLoggedIn) {
            this.showDashboard();
            this.fetchBooks(); // Fetch books from server
        } else {
            this.showLoginScreen();
        }
    }

    bindEvents() {
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/logout';
        });

        // Navigation (Sidebar & Mobile)
        const navHandler = (e) => {
            const btn = e.currentTarget;
            const screen = btn.dataset.screen;
            if (screen) {
                this.switchSection(screen);
            }
        };

        document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
            btn.addEventListener('click', navHandler);
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
        
        // Update quantity mode buttons
        document.getElementById('update-quantity-btn').addEventListener('click', () => {
            this.confirmUpdateQuantity();
        });
        
        document.getElementById('cancel-update-btn').addEventListener('click', () => {
            this.hideUpdateQuantityMode();
        });
        
        // Auto-calculate new total when quantity changes
        document.getElementById('quantity-to-add').addEventListener('input', (e) => {
            this.updateNewTotal();
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
        const searchInput = document.getElementById('search-books');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchBooks(e.target.value);
            });
        }

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

        // Manual Barcode Input for Billing with Autocomplete
        const manualBarcodeInput = document.getElementById('manual-barcode-bill');
        const suggestionsList = document.getElementById('barcode-suggestions');
        
        if (manualBarcodeInput && suggestionsList) {
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
        }
        
        // Flashlight buttons
        const flashBtnAdd = document.getElementById('flash-btn-add');
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
    }

    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard-screen').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');

        const userDisplay = document.getElementById('user-name-display');
        if (userDisplay) {
            userDisplay.textContent = this.currentUser || 'Admin';
        }
    }

    handleLogout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.stopAllScanners();
        this.showLoginScreen();
    }

    switchSection(sectionName) {
        // Update navigation (both sidebar and mobile)
        document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
            if (btn.dataset.screen === sectionName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Stop scanners when switching sections
        this.stopAllScanners();

        // Update content based on section
        if (sectionName === 'inventory') {
            this.fetchBooks(); // Refresh inventory
        } else if (sectionName === 'billing') {
            this.displayBill();
        }
    }

    // API Interactions
    async fetchBooks() {
        try {
            const response = await fetch('/api/books');
            const data = await response.json();

            if (data.books) {
                this.books = data.books;
                this.allBooks = data.books; // Cache for autocomplete
                this.updateStats();
                this.displayBooks();
            }
        } catch (error) {
            console.error('Error fetching books:', error);
            this.showToast('Failed to load inventory', 'error');
        }
    }

    showBarcodeSuggestions(query) {
        const suggestionsList = document.getElementById('barcode-suggestions');
        if (!suggestionsList) return;
        
        if (!query || query.length < 1) {
            suggestionsList.innerHTML = '';
            return;
        }
        
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

    async addBook() {
        const barcode = document.getElementById('book-barcode').value.trim();
        const name = document.getElementById('book-name').value.trim();
        const price = document.getElementById('book-price').value;
        const quantity = document.getElementById('book-quantity').value;
        const details = document.getElementById('book-details').value.trim();

        if (!barcode || !name || !price) {
            this.showToast('Please fill in all required fields.', 'error');
            return;
        }

        // Note: Duplicate check is now handled in handleScanResult for scanned barcodes
        // This path is only for manually typed barcodes in the form

        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    name,
                    price,
                    details,
                    quantity: parseInt(quantity)
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Book added successfully!', 'success');
                this.clearBookForm();
                this.fetchBooks(); // Refresh list
                this.switchSection('inventory');
            } else {
                this.showToast(data.error || 'Failed to add book', 'error');
            }
        } catch (error) {
            console.error('Error adding book:', error);
            this.showToast('Server error while adding book', 'error');
        }
    }

    async deleteBook(barcode) {
        if (!confirm('Are you sure you want to delete this book?')) return;

        try {
            const response = await fetch('/api/delete_book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Book deleted successfully!', 'success');
                this.fetchBooks(); // Refresh list
            } else {
                this.showToast(data.error || 'Failed to delete book', 'error');
            }
        } catch (error) {
            console.error('Error deleting book:', error);
            this.showToast('Server error while deleting book', 'error');
        }
    }

    async addToBill(barcode) {
        // Check local inventory first for immediate feedback
        const book = this.books.find(book => book.barcode === barcode);

        if (!book) {
            // Try fetching from server just in case
            try {
                const response = await fetch(`/api/book/${barcode}`);
                const data = await response.json();

                if (data.book) {
                    this.processAddToBill(data.book);
                } else {
                    this.showToast('Book not found in inventory!', 'error');
                }
            } catch (error) {
                this.showToast('Error checking book details', 'error');
            }
        } else {
            this.processAddToBill(book);
        }
    }

    processAddToBill(book) {
        const existingItem = this.currentBill.find(item => item.barcode === book.barcode);

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
        this.showToast(`Added ${book.name} to bill`, 'success');
    }

    async processBill() {
        if (this.currentBill.length === 0) {
            this.showToast('No items in bill to process.', 'warning');
            return;
        }

        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (!confirm(`Process payment of ₹${total.toFixed(2)}?`)) return;

        try {
            const response = await fetch('/api/process_bill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: this.currentBill,
                    total: total,
                    customer_name: 'Walk-in Customer' // You might want to add a field for this
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(`Payment processed! ID: ${data.transaction_id}`, 'success');
                this.currentBill = [];
                this.displayBill();
                this.fetchBooks(); // Update inventory quantities
            } else {
                this.showToast(data.error || 'Transaction failed', 'error');
            }
        } catch (error) {
            console.error('Error processing bill:', error);
            this.showToast('Server error processing bill', 'error');
        }
    }

    // ... (Scanner logic remains mostly the same, just calling addToBill/handleScanResult) ...

    async startScanner(type) {
        const video = document.getElementById(`video-${type}`);
        const canvas = document.getElementById(`canvas-${type}`);
        const startBtn = document.getElementById(`start-scan-${type}`);
        const stopBtn = document.getElementById(`stop-scan-${type}`);
        const scannerWrapper = document.getElementById(`scanner-${type}`);
        const flashBtn = document.getElementById(`flash-btn-${type}`);
        
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
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            scannerWrapper.classList.remove('hidden');
            
            // Enable flashlight button if available
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            
            if (capabilities.torch && flashBtn) {
                flashBtn.style.display = 'inline-block';
                flashBtn.disabled = false;
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
                        this.showToast(`Camera active with ${targetZoom}x zoom!`, 'success');
                    } else {
                        console.log('⚠️ Zoom not supported on this device');
                        this.showToast('Camera active!', 'success');
                    }
                } catch (zoomError) {
                    console.warn('⚠️ Could not apply zoom:', zoomError);
                }
                
                this.continuousScan(type, video, canvas);
            }, { once: true });
            
        } catch (error) {
            console.error('Scanner error:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showToast('Camera permission denied. Please allow camera access.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showToast('No camera found on this device.', 'error');
            } else {
                this.showToast(`Error: ${error.message}`, 'error');
            }
            
            this.resetScannerUI(type);
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
            
            const flashBtn = document.getElementById(`flash-btn-${type}`);
            if (flashBtn) {
                flashBtn.textContent = this.flashlightOn ? '🔦 Flash: ON' : '💡 Flash: OFF';
                flashBtn.classList.toggle('flash-active', this.flashlightOn);
            }
            
            console.log(`🔦 Flashlight ${this.flashlightOn ? 'ON' : 'OFF'}`);
        } catch (error) {
            console.error('❌ Flashlight toggle error:', error);
        }
    }

    async continuousScan(type, video, canvas) {
        const ctx = canvas.getContext('2d');
        let scanCount = 0;
        const maxScans = 200; // Auto-stop after ~1 minute
        
        const scanFrame = async () => {
            if (!this.scanningActive) {
                console.log('🛑 Scanning stopped by user');
                return;
            }
            
            scanCount++;
            
            // Auto-stop after max scans
            if (scanCount >= maxScans) {
                console.log('⏰ Auto-stopping scanner after timeout');
                this.showToast('Scanner timed out. Please try again.', 'warning');
                this.stopScanner(type);
                return;
            }
            
            try {
                // Capture frame exactly as displayed (with zoom applied)
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

    stopScanner(type) {
        this.scanningActive = false;
        
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        const video = document.getElementById(`video-${type}`);
        const scannerWrapper = document.getElementById(`scanner-${type}`);
        const flashBtn = document.getElementById(`flash-btn-${type}`);
        
        if (video) {
            video.srcObject = null;
            video.style.display = 'none';
        }
        
        if (flashBtn) {
            flashBtn.style.display = 'none';
            flashBtn.disabled = true;
            flashBtn.classList.remove('flash-active');
            flashBtn.textContent = '💡 Flash: OFF';
        }
        
        if (scannerWrapper) {
            scannerWrapper.classList.add('hidden');
        }
        
        this.flashlightOn = false;
        this.resetScannerUI(type);
        
        console.log('📹 Scanner stopped');
    }

    resetScannerUI(type) {
        const startBtn = document.getElementById(`start-scan-${type}`);
        const stopBtn = document.getElementById(`stop-scan-${type}`);

        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
    }

    stopAllScanners() {
        if (this.scanningActive) {
            this.stopScanner('add');
            this.stopScanner('bill');
        }
    }

    async useManualBarcode(type) {
        const inputId = type === 'add' ? 'manual-barcode-add' : 'manual-barcode-bill';
        const input = document.getElementById(inputId);
        const barcode = input.value.trim();

        if (!barcode) {
            this.showToast('Please enter a barcode first.', 'warning');
            return;
        }

        await this.handleScanResult(barcode, type);
        input.value = '';
    }

    async handleScanResult(barcode, type) {
        if (type === 'add') {
            // Check if book already exists
            const existingBook = this.books.find(b => b.barcode === barcode);
            
            if (existingBook) {
                // Book exists - show update quantity mode
                this.showUpdateQuantityMode(existingBook);
            } else {
                // New book - show form
                document.getElementById('book-barcode').value = barcode;
                document.getElementById('book-name').focus();
                this.showToast('Barcode set! Enter book details.', 'success');
            }
        } else if (type === 'bill') {
            this.addToBill(barcode);
        }
    }

    showUpdateQuantityMode(book) {
        this.currentExistingBook = book;
        
        // Hide the normal form
        document.getElementById('add-book-form').style.display = 'none';
        
        // Show the update quantity mode
        document.getElementById('update-quantity-mode').style.display = 'block';
        
        // Populate existing book details
        document.getElementById('existing-barcode').textContent = book.barcode;
        document.getElementById('existing-name').textContent = book.name;
        document.getElementById('existing-quantity').textContent = book.quantity || 1;
        
        // Reset quantity to add
        document.getElementById('quantity-to-add').value = '1';
        
        // Update new total
        this.updateNewTotal();
        
        this.showToast('Book exists! Update quantity below.', 'info');
    }

    hideUpdateQuantityMode() {
        // Show the normal form
        document.getElementById('add-book-form').style.display = 'block';
        
        // Hide the update quantity mode
        document.getElementById('update-quantity-mode').style.display = 'none';
        
        this.currentExistingBook = null;
        this.clearBookForm();
    }

    updateNewTotal() {
        if (!this.currentExistingBook) return;
        
        const currentQty = this.currentExistingBook.quantity || 1;
        const toAdd = parseInt(document.getElementById('quantity-to-add').value) || 0;
        const newTotal = currentQty + toAdd;
        
        document.getElementById('new-total-quantity').textContent = newTotal;
    }

    async confirmUpdateQuantity() {
        if (!this.currentExistingBook) return;
        
        const quantityToAdd = parseInt(document.getElementById('quantity-to-add').value);
        
        if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            return;
        }
        
        const newQuantity = (this.currentExistingBook.quantity || 1) + quantityToAdd;
        
        try {
            const response = await fetch('/api/update_book_quantity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    barcode: this.currentExistingBook.barcode, 
                    quantity: newQuantity 
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(`Quantity updated! New total: ${newQuantity}`, 'success');
                this.hideUpdateQuantityMode();
                this.fetchBooks();
                this.switchSection('inventory');
            } else {
                this.showToast(data.error || 'Failed to update quantity', 'error');
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            this.showToast('Server error while updating quantity', 'error');
        }
    }

    clearBookForm() {
        document.getElementById('book-barcode').value = '';
        document.getElementById('book-name').value = '';
        document.getElementById('book-price').value = '';
        document.getElementById('book-quantity').value = '1';
        document.getElementById('book-details').value = '';
    }

    searchBooks(query) {
        const filteredBooks = this.books.filter(book =>
            book.name.toLowerCase().includes(query.toLowerCase()) ||
            book.barcode.includes(query) ||
            (book.details && book.details.toLowerCase().includes(query.toLowerCase()))
        );
        this.displayBooks(filteredBooks);
    }

    downloadCSV(type) {
        const endpoint = type === 'inventory' ? '/api/download_inventory' : '/api/download_transactions';
        
        this.showToast(`Downloading ${type}...`, 'info');
        
        window.location.href = endpoint;
    }

    displayBooks(booksToShow = this.books) {
        const booksContainer = document.getElementById('books-container');
        if (!booksContainer) return;

        if (booksToShow.length === 0) {
            booksContainer.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No books found.</td></tr>';
            return;
        }

        const booksHTML = booksToShow.map(book => `
            <tr>
                <td style="font-family: monospace; font-weight: 600;">${book.barcode}</td>
                <td style="font-weight: 500;">${book.name}</td>
                <td>₹${book.price.toFixed(2)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <button class="btn btn-secondary" style="padding: 2px 6px; height: 24px; font-size: 0.75rem;" onclick="library.updateQuantity('${book.barcode}', -1)">-</button>
                        <span style="font-weight: 600; min-width: 30px; text-align: center;">${book.quantity || 1}</span>
                        <button class="btn btn-secondary" style="padding: 2px 6px; height: 24px; font-size: 0.75rem;" onclick="library.updateQuantity('${book.barcode}', 1)">+</button>
                    </div>
                </td>
                <td style="color: var(--text-secondary); font-size: 0.9em;">${book.details || '-'}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="library.deleteBook('${book.barcode}')">
                        <span class="material-icons-round" style="font-size: 16px;">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');

        booksContainer.innerHTML = booksHTML;
    }

    async updateQuantity(barcode, change) {
        const book = this.books.find(b => b.barcode === barcode);
        if (!book) return;

        const newQuantity = (book.quantity || 1) + change;
        if (newQuantity < 0) {
            this.showToast('Quantity cannot be negative', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/update_book_quantity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, quantity: newQuantity })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(`Quantity updated to ${newQuantity}`, 'success');
                this.fetchBooks(); // Refresh list
            } else {
                this.showToast(data.error || 'Failed to update quantity', 'error');
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            this.showToast('Server error while updating quantity', 'error');
        }
    }

    removeFromBill(barcode) {
        this.currentBill = this.currentBill.filter(item => item.barcode !== barcode);
        this.displayBill();
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
        const billItemsList = document.getElementById('bill-items');
        const billTotalElement = document.getElementById('bill-total');
        const billSubtotalElement = document.getElementById('bill-subtotal');

        if (!billItemsList) return;

        if (this.currentBill.length === 0) {
            billItemsList.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No items in bill.</td></tr>';
            if (billTotalElement) billTotalElement.textContent = '₹0.00';
            if (billSubtotalElement) billSubtotalElement.textContent = '₹0.00';
            return;
        }

        const billHTML = this.currentBill.map(item => {
            const total = item.price * item.quantity;
            return `
                <tr>
                    <td style="font-weight: 500;">${item.name}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <button class="btn btn-secondary" style="padding: 2px 6px; height: 24px;" onclick="library.updateBillItemQuantity('${item.barcode}', -1)">-</button>
                            <span style="font-weight: 600; min-width: 20px; text-align: center;">${item.quantity}</span>
                            <button class="btn btn-secondary" style="padding: 2px 6px; height: 24px;" onclick="library.updateBillItemQuantity('${item.barcode}', 1)">+</button>
                        </div>
                    </td>
                    <td>₹${item.price.toFixed(2)}</td>
                    <td style="font-weight: 600;">₹${total.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-danger" style="padding: 2px 6px; height: 24px;" onclick="library.removeFromBill('${item.barcode}')">
                            <span class="material-icons-round" style="font-size: 14px;">close</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        billItemsList.innerHTML = billHTML;

        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (billTotalElement) billTotalElement.textContent = `₹${total.toFixed(2)}`;
        if (billSubtotalElement) billSubtotalElement.textContent = `₹${total.toFixed(2)}`;
    }

    clearBill() {
        if (this.currentBill.length === 0) return;

        if (confirm('Are you sure you want to clear the current bill?')) {
            this.currentBill = [];
            this.displayBill();
            this.showToast('Bill cleared', 'info');
        }
    }

    updateStats() {
        const totalBooksElement = document.getElementById('total-books');
        const totalValueElement = document.getElementById('total-value');

        if (totalBooksElement && totalValueElement) {
            const totalBooks = this.books.length;
            const totalValue = this.books.reduce((sum, book) => sum + (book.price * (book.quantity || 1)), 0);

            totalBooksElement.textContent = totalBooks;
            totalValueElement.textContent = `₹${totalValue.toFixed(2)}`;
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'info';
        if (type === 'success') icon = 'check_circle';
        if (type === 'error') icon = 'error';
        if (type === 'warning') icon = 'warning';

        toast.innerHTML = `
            <span class="material-icons-round" style="color: inherit;">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize
let library;
document.addEventListener('DOMContentLoaded', () => {
    library = new LibraryInventorySystem();
});