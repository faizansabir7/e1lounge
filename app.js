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
        this.checkLoginStatus();
    }

    checkLoginStatus() {
        // Simple session check (could be enhanced with localStorage session)
        if (!this.isLoggedIn) {
            this.showLoginScreen();
        } else {
            this.showDashboard();
        }
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

        const userDisplay = document.getElementById('user-name-display');
        if (userDisplay) {
            userDisplay.textContent = this.currentUser || 'Admin';
        }
    }

    handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === this.adminCredentials.username &&
            password === this.adminCredentials.password) {
            this.isLoggedIn = true;
            this.currentUser = username;
            this.showToast('Login successful!', 'success');
            this.showDashboard();
        } else {
            this.showToast('Invalid credentials! Use admin/admin123', 'error');
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
        this.showToast('Logged out successfully!', 'success');
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
            const scannerWrapper = document.getElementById(scannerId);

            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            scannerWrapper.classList.remove('hidden');

            this.showToast('Starting camera...', 'info');

            // QuaggaJS configuration
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
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: navigator.hardwareConcurrency || 4,
                decoder: {
                    readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "upc_reader"]
                },
                locate: true
            };

            Quagga.init(config, (err) => {
                if (err) {
                    console.error('QuaggaJS init error:', err);
                    this.showToast('Camera access failed. Please check permissions.', 'error');
                    this.resetScannerUI(type);
                    return;
                }

                Quagga.start();
                this.showToast('Scanner started!', 'success');

                if (type === 'add') {
                    this.scannerAdd = 'active';
                } else {
                    this.scannerBill = 'active';
                }
            });

            Quagga.onDetected((result) => {
                const code = result.codeResult.code;
                if (code && code.length >= 3) {
                    this.showToast(`Barcode detected: ${code}`, 'success');
                    this.handleScanResult(code, type);
                    this.stopScanner(type);
                }
            });

        } catch (err) {
            console.error('Error starting scanner:', err);
            this.showToast('Error starting scanner', 'error');
            this.resetScannerUI(type);
        }
    }

    stopScanner(type) {
        try {
            if (Quagga && typeof Quagga.stop === 'function') {
                Quagga.stop();
            }

            if (type === 'add') {
                this.scannerAdd = null;
            } else {
                this.scannerBill = null;
            }

        } catch (err) {
            console.error('Error stopping scanner:', err);
        }

        const scannerId = type === 'add' ? 'scanner-add' : 'scanner-bill';
        const scannerWrapper = document.getElementById(scannerId);

        // Clear the scanner container but keep the wrapper structure
        // We only want to remove the video/canvas elements added by Quagga
        const video = scannerWrapper.querySelector('video');
        const canvas = scannerWrapper.querySelector('canvas');
        if (video) video.remove();
        if (canvas) canvas.remove();

        scannerWrapper.classList.add('hidden');
        this.resetScannerUI(type);
    }

    resetScannerUI(type) {
        const startBtn = document.getElementById(`start-scan-${type}`);
        const stopBtn = document.getElementById(`stop-scan-${type}`);

        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
    }

    stopAllScanners() {
        if (this.scannerAdd) this.stopScanner('add');
        if (this.scannerBill) this.stopScanner('bill');
    }

    useManualBarcode(type) {
        const inputId = type === 'add' ? 'manual-barcode-add' : 'manual-barcode-bill';
        const input = document.getElementById(inputId);
        const barcode = input.value.trim();

        if (!barcode) {
            this.showToast('Please enter a barcode first.', 'warning');
            return;
        }

        this.handleScanResult(barcode, type);
        input.value = '';
    }

    handleScanResult(barcode, type) {
        if (type === 'add') {
            document.getElementById('book-barcode').value = barcode;
            document.getElementById('book-name').focus();
            this.showToast('Barcode set!', 'success');
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
            this.showToast('Please fill in all required fields.', 'error');
            return;
        }

        const existingBook = this.books.find(book => book.barcode === barcode);
        if (existingBook) {
            this.showToast('A book with this barcode already exists!', 'error');
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
        this.showToast('Book added successfully!', 'success');

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
            this.showToast('Book deleted successfully!', 'success');
        }
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
        const booksContainer = document.getElementById('books-container');
        if (!booksContainer) return;

        if (booksToShow.length === 0) {
            booksContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No books found.</td></tr>';
            return;
        }

        const booksHTML = booksToShow.map(book => `
            <tr>
                <td style="font-family: monospace; font-weight: 600;">${book.barcode}</td>
                <td style="font-weight: 500;">${book.name}</td>
                <td>₹${book.price.toFixed(2)}</td>
                <td style="color: var(--text-secondary); font-size: 0.9em;">${book.details || '-'}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="library.deleteBook(${book.id})">
                        <span class="material-icons-round" style="font-size: 16px;">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');

        booksContainer.innerHTML = booksHTML;
    }

    addToBill(barcode) {
        const book = this.books.find(book => book.barcode === barcode);

        if (!book) {
            this.showToast('Book not found in inventory!', 'error');
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
        this.showToast(`Added ${book.name} to bill`, 'success');
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

    processBill() {
        if (this.currentBill.length === 0) {
            this.showToast('No items in bill to process.', 'warning');
            return;
        }

        const total = this.currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (confirm(`Process payment of ₹${total.toFixed(2)}?`)) {
            // In a real app, you would save this transaction
            this.currentBill = [];
            this.displayBill();
            this.showToast(`Payment of ₹${total.toFixed(2)} processed!`, 'success');
        }
    }

    updateStats() {
        const totalBooksElement = document.getElementById('total-books');
        const totalValueElement = document.getElementById('total-value');

        if (totalBooksElement && totalValueElement) {
            const totalBooks = this.books.length;
            const totalValue = this.books.reduce((sum, book) => sum + book.price, 0);

            totalBooksElement.textContent = totalBooks;
            totalValueElement.textContent = `₹${totalValue.toFixed(2)}`;
        }
    }

    saveBooks() {
        localStorage.setItem('libraryBooks', JSON.stringify(this.books));
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