// Library Inventory System - Python Backend Integration
class LibrarySystem {
    constructor() {
        this.currentBill = [];
        this.books = [];
        this.videoStreams = {};
        this.scanningIntervals = {};
        this.isMobileDevice = this.detectMobile();
        this.init();
    }

    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    }

    init() {
        this.bindEvents();
        this.loadBooks();
        this.updateStats();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });

        // Camera controls - Add Book (Continuous Scanning)
        document.getElementById('start-camera').addEventListener('click', () => {
            this.startContinuousScanning('add');
        });
        
        document.getElementById('stop-camera').addEventListener('click', () => {
            this.stopContinuousScanning('add');
        });

        // Camera controls - Billing (Continuous Scanning)
        document.getElementById('start-camera-bill').addEventListener('click', () => {
            this.startContinuousScanning('bill');
        });
        
        document.getElementById('stop-camera-bill').addEventListener('click', () => {
            this.stopContinuousScanning('bill');
        });

        // Form handling
        document.getElementById('add-book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });

        document.getElementById('clear-form').addEventListener('click', () => {
            this.clearBookForm();
        });

        // Search
        document.getElementById('search-books').addEventListener('input', (e) => {
            this.searchBooks(e.target.value);
        });

        document.getElementById('clear-search').addEventListener('click', () => {
            document.getElementById('search-books').value = '';
            this.displayBooks();
        });

        // Billing
        document.getElementById('clear-bill').addEventListener('click', () => {
            this.clearBill();
        });

        document.getElementById('process-bill').addEventListener('click', () => {
            this.processBill();
        });
    }

    switchSection(sectionName) {
        // Stop all cameras when switching sections
        this.stopAllCameras();

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update sections
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.getElementById(`${sectionName}-section`).classList.add('active');

        // Load data for specific sections
        if (sectionName === 'inventory') {
            this.loadBooks();
            this.updateStats();
        } else if (sectionName === 'billing') {
            this.displayBill();
        }
    }

    async startContinuousScanning(type) {
        try {
            const startBtn = type === 'add' ? 
                document.getElementById('start-camera') : 
                document.getElementById('start-camera-bill');
            const stopBtn = type === 'add' ? 
                document.getElementById('stop-camera') : 
                document.getElementById('stop-camera-bill');
            const resultDiv = type === 'add' ? 
                document.getElementById('scan-result') : 
                document.getElementById('scan-result-bill');
            const video = type === 'add' ? 
                document.getElementById('video') : 
                document.getElementById('video-bill');

            // Start live camera preview first
            const deviceType = this.isMobileDevice ? '📱 Mobile' : '💻 Desktop';
            this.showMessage(`${deviceType} - Starting camera...`, 'info');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });

            video.srcObject = stream;
            video.style.display = 'block';
            this.videoStreams[type] = stream;

            // Update button states
            startBtn.disabled = true;
            stopBtn.disabled = false;
            startBtn.textContent = '🔄 Scanning...';

            resultDiv.style.display = 'block';
            resultDiv.className = 'scan-result';

            if (this.isMobileDevice) {
                // MOBILE: Start frame capture and send to backend
                this.showMessage('📱 Mobile scanning active! Point at barcode!', 'success');
                resultDiv.textContent = '📱 Scanning... Point camera at barcode';
                this.startMobileContinuousCapture(type);
            } else {
                // DESKTOP: Start server-side OpenCV scanning
                this.showMessage('💻 Desktop scanning active! Point at barcode!', 'success');
                resultDiv.textContent = '💻 Scanning... Point camera at barcode';
                
                // Start continuous scanning on backend
                const response = await fetch('/api/start_continuous_scan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ type: type, is_mobile: false })
                });

                const result = await response.json();
                
                if (result.success) {
                    this.pollForScanResult(type);
                } else {
                    this.showMessage('Failed to start scanning: ' + result.error, 'error');
                    this.resetScanButtons(type);
                }
            }

        } catch (error) {
            console.error('Scan error:', error);
            this.showMessage('Failed to start scanning. Please allow camera access.', 'error');
            this.resetScanButtons(type);
        }
    }

    startMobileContinuousCapture(type) {
        const video = type === 'add' ? 
            document.getElementById('video') : 
            document.getElementById('video-bill');
        const canvas = type === 'add' ? 
            document.getElementById('canvas') : 
            document.getElementById('canvas-bill');
        const ctx = canvas.getContext('2d');
        const resultDiv = type === 'add' ? 
            document.getElementById('scan-result') : 
            document.getElementById('scan-result-bill');

        let frameCount = 0;

        // Capture and send frames every 500ms (2 FPS)
        this.scanningIntervals[type] = setInterval(async () => {
            try {
                frameCount++;
                
                // Set canvas size to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Draw current frame
                ctx.drawImage(video, 0, 0);

                // Convert to base64
                const imageData = canvas.toDataURL('image/jpeg', 0.7);

                // Send to server for barcode detection
                const response = await fetch('/api/scan_barcode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        image: imageData,
                        type: type
                    })
                });

                const result = await response.json();

                // Update status
                resultDiv.textContent = `📱 Scanning... (${frameCount} frames checked)`;

                if (result.detected && result.barcode) {
                    // Barcode found! Stop scanning
                    console.log('🎯 Barcode detected:', result.barcode);
                    this.stopMobileContinuousCapture(type);
                    this.showScanResult(result.barcode, type, true);
                    this.handleScanResult(result.barcode, type);
                    this.resetScanButtons(type);
                } else if (result.stopped) {
                    // Scanning was stopped
                    this.stopMobileContinuousCapture(type);
                }

            } catch (error) {
                console.error('Mobile capture error:', error);
            }
        }, 500); // Capture every 500ms

        console.log('📱 Mobile continuous capture started for', type);
    }

    stopMobileContinuousCapture(type) {
        if (this.scanningIntervals[type]) {
            clearInterval(this.scanningIntervals[type]);
            delete this.scanningIntervals[type];
            console.log('📱 Mobile continuous capture stopped for', type);
        }
    }

    async stopContinuousScanning(type) {
        try {
            // Stop mobile capture if active
            this.stopMobileContinuousCapture(type);

            // Stop live camera feed
            const video = type === 'add' ? 
                document.getElementById('video') : 
                document.getElementById('video-bill');

            if (this.videoStreams[type]) {
                this.videoStreams[type].getTracks().forEach(track => track.stop());
                delete this.videoStreams[type];
            }
            video.srcObject = null;
            video.style.display = 'none';

            // Stop scanning on backend (for desktop mode)
            if (!this.isMobileDevice) {
                await fetch('/api/stop_continuous_scan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ type: type })
                });
            }

            this.resetScanButtons(type);
            this.showMessage('Camera and scanning stopped.', 'info');

        } catch (error) {
            console.error('Stop scan error:', error);
            this.resetScanButtons(type);
        }
    }

    resetScanButtons(type) {
        // Stop mobile capture if active
        this.stopMobileContinuousCapture(type);

        const startBtn = type === 'add' ? 
            document.getElementById('start-camera') : 
            document.getElementById('start-camera-bill');
        const stopBtn = type === 'add' ? 
            document.getElementById('stop-camera') : 
            document.getElementById('stop-camera-bill');
        const resultDiv = type === 'add' ? 
            document.getElementById('scan-result') : 
            document.getElementById('scan-result-bill');
        const video = type === 'add' ? 
            document.getElementById('video') : 
            document.getElementById('video-bill');

        startBtn.disabled = false;
        stopBtn.disabled = true;
        startBtn.textContent = '🚀 Start Auto-Scanning';
        
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }

        // Hide video if still showing
        if (video) {
            video.style.display = 'none';
        }

        // Stop any remaining video streams
        if (this.videoStreams[type]) {
            this.videoStreams[type].getTracks().forEach(track => track.stop());
            delete this.videoStreams[type];
        }
    }

    async pollForScanResult(type) {
        try {
            const response = await fetch('/api/check_scan_result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type: type })
            });

            const result = await response.json();

            if (result.scanning) {
                // Still scanning, check again in 500ms
                setTimeout(() => this.pollForScanResult(type), 500);
            } else if (result.barcode) {
                // Barcode found!
                this.showScanResult(result.barcode, type, true);
                this.handleScanResult(result.barcode, type);
                this.resetScanButtons(type);
            } else {
                // Scanning stopped without result
                this.showScanResult('Scanning stopped - no barcode detected', type, false);
                this.resetScanButtons(type);
            }

        } catch (error) {
            console.error('Poll error:', error);
            this.resetScanButtons(type);
        }
    }

    stopAllCameras() {
        this.stopContinuousScanning('add');
        this.stopContinuousScanning('bill');
    }

    async captureAndScanBarcode(videoId, type) {
        try {
            const video = document.getElementById(videoId);
            const canvasId = videoId === 'video' ? 'canvas' : 'canvas-bill';
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');

            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current frame to canvas
            ctx.drawImage(video, 0, 0);

            // Convert canvas to base64
            const imageData = canvas.toDataURL('image/jpeg', 0.8);

            this.showMessage('Scanning barcode...', 'info');

            // Send to Python backend for processing
            const response = await fetch('/api/scan_barcode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData })
            });

            const result = await response.json();

            if (result.success) {
                const barcode = result.barcode;
                this.showScanResult(barcode, type, true);
                this.handleScanResult(barcode, type);
            } else {
                this.showScanResult(result.error || 'No barcode detected', type, false);
            }

        } catch (error) {
            console.error('Scan error:', error);
            this.showMessage('Failed to scan barcode. Please try again.', 'error');
        }
    }

    showScanResult(message, type, success) {
        const resultId = type === 'add' ? 'scan-result' : 'scan-result-bill';
        const resultDiv = document.getElementById(resultId);
        
        resultDiv.textContent = message;
        resultDiv.className = `scan-result ${success ? 'success' : 'error'}`;
        resultDiv.style.display = 'block';

        // Hide after 5 seconds
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 5000);
    }

    handleScanResult(barcode, type) {
        if (type === 'add') {
            document.getElementById('book-barcode').value = barcode;
            document.getElementById('book-name').focus();
            this.showMessage(`Barcode scanned: ${barcode}`, 'success');
        } else if (type === 'bill') {
            this.addToBill(barcode);
        }
    }

    async loadBooks() {
        try {
            const response = await fetch('/api/books');
            const data = await response.json();
            
            if (data.books) {
                this.books = data.books;
                this.displayBooks();
            }
        } catch (error) {
            console.error('Error loading books:', error);
            this.showMessage('Failed to load books.', 'error');
        }
    }

    displayBooks(booksToShow = this.books) {
        const container = document.getElementById('books-container');
        
        if (booksToShow.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No books found.</div>';
            return;
        }

        const booksHTML = booksToShow.map(book => `
            <div class="book-item">
                <span>${book.barcode}</span>
                <span>${book.name}</span>
                <span>$${parseFloat(book.price).toFixed(2)}</span>
                <span>${book.details || 'N/A'}</span>
                <span>${new Date(book.date_added).toLocaleDateString()}</span>
            </div>
        `).join('');

        container.innerHTML = booksHTML;
    }

    searchBooks(query) {
        if (!query.trim()) {
            this.displayBooks();
            return;
        }

        const filteredBooks = this.books.filter(book =>
            book.name.toLowerCase().includes(query.toLowerCase()) ||
            book.barcode.includes(query) ||
            (book.details && book.details.toLowerCase().includes(query.toLowerCase()))
        );

        this.displayBooks(filteredBooks);
    }

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            document.getElementById('total-books').textContent = data.total_books;
            document.getElementById('total-value').textContent = `$${data.total_value.toFixed(2)}`;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    async addBook() {
        const barcode = document.getElementById('book-barcode').value.trim();
        const name = document.getElementById('book-name').value.trim();
        const price = document.getElementById('book-price').value;
        const details = document.getElementById('book-details').value.trim();

        if (!barcode || !name || !price) {
            this.showMessage('Please fill in all required fields.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    barcode: barcode,
                    name: name,
                    price: parseFloat(price),
                    details: details
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Book added successfully!', 'success');
                this.clearBookForm();
                this.loadBooks();
                this.updateStats();
                // Switch to inventory to show the added book
                this.switchSection('inventory');
            } else {
                this.showMessage(result.error, 'error');
            }

        } catch (error) {
            console.error('Error adding book:', error);
            this.showMessage('Failed to add book. Please try again.', 'error');
        }
    }

    clearBookForm() {
        document.getElementById('book-barcode').value = '';
        document.getElementById('book-name').value = '';
        document.getElementById('book-price').value = '';
        document.getElementById('book-details').value = '';
    }

    async addToBill(barcode) {
        try {
            const response = await fetch(`/api/book/${barcode}`);
            
            if (!response.ok) {
                this.showMessage('Book not found in inventory!', 'error');
                return;
            }

            const data = await response.json();
            const book = data.book;

            // Check if item already in bill
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

        } catch (error) {
            console.error('Error adding to bill:', error);
            this.showMessage('Failed to add item to bill.', 'error');
        }
    }

    displayBill() {
        const container = document.getElementById('bill-items');
        const totalElement = document.getElementById('bill-total');

        if (this.currentBill.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No items in bill.</div>';
            totalElement.textContent = '0.00';
            return;
        }

        const billHTML = this.currentBill.map((item, index) => {
            const itemTotal = item.price * item.quantity;
            return `
                <div class="bill-item">
                    <span>${item.name}</span>
                    <span>$${item.price.toFixed(2)}</span>
                    <div class="quantity-controls">
                        <button class="qty-btn" onclick="library.updateQuantity(${index}, -1)">-</button>
                        <span style="margin: 0 10px;">${item.quantity}</span>
                        <button class="qty-btn" onclick="library.updateQuantity(${index}, 1)">+</button>
                    </div>
                    <span>$${itemTotal.toFixed(2)}</span>
                    <button class="delete-btn" onclick="library.removeFromBill(${index})">Remove</button>
                </div>
            `;
        }).join('');

        container.innerHTML = billHTML;

        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalElement.textContent = total.toFixed(2);
    }

    updateQuantity(index, change) {
        if (index < 0 || index >= this.currentBill.length) return;

        this.currentBill[index].quantity += change;

        if (this.currentBill[index].quantity <= 0) {
            this.currentBill.splice(index, 1);
        }

        this.displayBill();
    }

    removeFromBill(index) {
        if (index >= 0 && index < this.currentBill.length) {
            this.currentBill.splice(index, 1);
            this.displayBill();
            this.showMessage('Item removed from bill', 'info');
        }
    }

    clearBill() {
        if (this.currentBill.length === 0) {
            this.showMessage('Bill is already empty.', 'info');
            return;
        }

        if (confirm('Are you sure you want to clear the current bill?')) {
            this.currentBill = [];
            this.displayBill();
            this.showMessage('Bill cleared successfully!', 'success');
        }
    }

    async processBill() {
        if (this.currentBill.length === 0) {
            this.showMessage('No items in bill to process.', 'error');
            return;
        }

        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (confirm(`Process payment of $${total.toFixed(2)}?`)) {
            try {
                const response = await fetch('/api/process_bill', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        items: this.currentBill,
                        total: total
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this.showMessage(`Payment processed! Transaction ID: ${result.transaction_id}`, 'success');
                    this.currentBill = [];
                    this.displayBill();
                } else {
                    this.showMessage(result.error, 'error');
                }

            } catch (error) {
                console.error('Error processing bill:', error);
                this.showMessage('Failed to process payment. Please try again.', 'error');
            }
        }
    }

    showMessage(message, type = 'success') {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        document.body.appendChild(messageElement);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 5000);
        
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
    library = new LibrarySystem();
});

// Handle page visibility changes to stop cameras when page is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden && library) {
        library.stopAllCameras();
    }
});

// Handle window beforeunload to clean up cameras
window.addEventListener('beforeunload', () => {
    if (library) {
        library.stopAllCameras();
    }
});