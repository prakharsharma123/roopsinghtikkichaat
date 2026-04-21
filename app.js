// ============================================================
// ROOP SINGH TIKKI CHAAT CORNER — app.js (Fixed & Enhanced)
// ============================================================

// ===== MENU DATA =====
const menuItems = [
    {
        id: 'golgappe-25',
        name: 'Classic Golgappe',
        description: 'Crispy semolina balls served with spicy flavored water.',
        price: 100,
        category: 'Golgappe',
        quantityInfo: '25 pieces',
        options: ['Hing', 'Normal', 'Khatta', 'Tikha', 'Mixed (All-in-one)'],
        bestseller: true,
        image: 'photos/golgappe.jpg'
    },
    {
        id: 'dahi-golgappe-6',
        name: 'Dahi Chatni Golgappe (6)',
        description: 'Filled with yogurt, tamarind and mint chutneys.',
        price: 40,
        category: 'Golgappe',
        quantityInfo: '6 pieces',
        image: 'photos/dahi-puri.jpg'
    },
    {
        id: 'dahi-golgappe-10',
        name: 'Dahi Chatni Golgappe (10)',
        description: 'Filled with yogurt, tamarind and mint chutneys.',
        price: 80,
        category: 'Golgappe',
        quantityInfo: '10 pieces',
        image: 'photos/dahi-puri.jpg'
    },
    {
        id: 'tikki-half',
        name: 'Aloo Tikki (Half)',
        description: 'Crispy potato patty served with mutter and chutneys.',
        price: 40,
        category: 'Tikki',
        quantityInfo: 'Single Tikki',
        bestseller: true,
        image: 'photos/tikki.jpg'
    },
    {
        id: 'tikki-full',
        name: 'Aloo Tikki (Full)',
        description: 'Double potato patties served with mutter and chutneys.',
        price: 75,
        category: 'Tikki',
        quantityInfo: 'Double Tikki',
        image: 'photos/tikki.jpg'
    },
    {
        id: 'special-chaat',
        name: 'Roop Singh Special Chaat',
        description: 'Our signature mixed chaat with a blend of flavors you\'ll love.',
        price: 120,
        category: 'Specials',
        image: 'photos/special.jpg',
        bestseller: true
    },
    {
        id: 'dahi-bhalla',
        name: 'Dahi Bhalla',
        description: 'Soft lentil dumplings soaked in sweet yogurt with chutneys.',
        price: 60,
        category: 'Specials',
        quantityInfo: '4 pieces',
        image: 'photos/dahi-puri.jpg'
    }
];

// ===== STATE =====
let cart = [];
let activeCategory = 'All';
let searchQuery = '';
let favorites = JSON.parse(localStorage.getItem('rs_favorites')) || [];
let currentDistance = 0.5;
let appliedCoupon = null;
let isOrderActive = JSON.parse(localStorage.getItem('isOrderActive')) || false;
let orderHistory = [];
let cancelTimerInterval = null;

// Current user from localStorage (set by login.html)
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// ===== HELPERS =====
function setOrderActive(val) {
    isOrderActive = val;
    localStorage.setItem('isOrderActive', JSON.stringify(val));
    updateActiveOrderStatus();
}

function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

function refreshIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ===== NAVIGATION =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`${screenId}-screen`);
    if (screen) screen.classList.add('active');

    // Sync bottom nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        const span = item.querySelector('span');
        if (span) {
            item.classList.toggle('active', span.innerText.toLowerCase() === screenId ||
                (screenId === 'shop' && span.innerText.toLowerCase() === 'about') ||
                (screenId === 'favorites' && span.innerText.toLowerCase() === 'saved'));
        }
    });

    if (screenId === 'tracking') {
        const activeContent = document.getElementById('tracking-active-content');
        const emptyState   = document.getElementById('tracking-empty-state');
        if (isOrderActive) {
            activeContent.style.display = 'block';
            emptyState.style.display = 'none';
            loadTrackingData();
            startCancelTimer();
        } else {
            activeContent.style.display = 'none';
            emptyState.style.display   = 'flex';
        }
    }

    if (screenId === 'checkout') {
        if (cart.length === 0) { showScreen('home'); showToast('Your cart is empty!'); return; }
        renderCartSummary();
        calculateBill();
    }

    if (screenId === 'favorites') renderFavorites();
    if (screenId === 'orders')    renderOrders();

    window.scrollTo(0, 0);
    updateCartUI();
    updateActiveOrderStatus();
    refreshIcons();
}

function navCenterClick() {
    if (cart.length > 0) {
        showScreen('checkout');
    } else {
        showScreen('home');
        showToast('Add items to your cart first!');
    }
}

function updateActiveOrderStatus() {
    const floatingIndicator = document.getElementById('floating-order-indicator');
    const orderBadge = document.getElementById('order-badge');
    if (isOrderActive) {
        floatingIndicator && floatingIndicator.classList.remove('inactive');
        orderBadge && orderBadge.classList.remove('hidden');
    } else {
        floatingIndicator && floatingIndicator.classList.add('inactive');
        orderBadge && orderBadge.classList.add('hidden');
    }
}

// ===== GEOLOCATION =====
async function detectLocation() {
    const tagEl = document.getElementById('location-tag');
    const titleEl = document.getElementById('header-title');
    if (tagEl) tagEl.innerText = 'Detecting location…';

    if (!navigator.geolocation) {
        if (tagEl) tagEl.innerText = 'Geolocation not supported';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            if (tagEl) tagEl.innerText = 'Finding address…';
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                const data = await res.json();
                const addr = data.address;
                const short = [addr.road, addr.suburb, addr.city].filter(Boolean).join(', ')
                              || data.display_name.split(',').slice(0, 2).join(', ');
                if (tagEl) tagEl.innerText = short;
                const co = document.getElementById('current-address');
                if (co) co.innerText = short;
            } catch {
                if (tagEl) tagEl.innerText = 'Could not fetch address';
            }
        },
        (err) => {
            const msgs = { 1: 'Permission denied. Allow in settings.', 2: 'Location unavailable', 3: 'Request timed out' };
            if (tagEl) tagEl.innerText = msgs[err.code] || 'Location error';
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

// ===== RENDER MENU =====
function renderMenu() {
    let items = activeCategory === 'All'
        ? menuItems
        : menuItems.filter(i => i.category === activeCategory);

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        );
    }

    const grid = document.getElementById('menu-grid');
    const noRes = document.getElementById('no-results');

    if (items.length === 0) {
        grid.innerHTML = '';
        if (noRes) noRes.classList.remove('hidden');
        return;
    }
    if (noRes) noRes.classList.add('hidden');

    grid.innerHTML = items.map(item => {
        const inCart = cart.find(c => c.id === item.id);
        const qty = inCart ? inCart.quantity : 0;
        const isFav = favorites.includes(item.id);

        return `
        <div class="menu-card">
            <button class="fav-btn-card ${isFav ? 'active' : ''}" onclick="toggleFavorite('${item.id}')" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                <i data-lucide="heart" style="${isFav ? 'fill:#e63946;color:#e63946;' : ''}"></i>
            </button>
            <div class="card-img">
                <img src="${item.image}" alt="${item.name}"
                     onerror="this.onerror=null;this.src='https://placehold.co/400x300/f7cb46/1a1a1a?text=${encodeURIComponent(item.name)}'">
                ${item.quantityInfo ? `<span class="qty-tag">${item.quantityInfo}</span>` : ''}
            </div>
            <div class="card-info">
                <div class="diet-tags">
                    <span class="diet-tag veg">🌿 Pure Veg</span>
                    ${item.bestseller ? '<span class="diet-tag bestseller-badge">🔥 Bestseller</span>' : ''}
                </div>
                <div class="info-top">
                    <h4>${item.name}</h4>
                    <span class="price">₹${item.price}</span>
                </div>
                <p>${item.description}</p>
            </div>
            <div class="card-actions">
                ${item.bestseller ? `<span class="bestseller-tag">⭐ Bestseller</span>` : '<div></div>'}
                ${qty > 0
                    ? `<div class="qty-control">
                           <button onclick="updateQty('${item.id}', -1)">−</button>
                           <span>${qty}</span>
                           <button onclick="updateQty('${item.id}', 1)">+</button>
                       </div>`
                    : `<button class="add-btn" onclick="handleAddItem('${item.id}')">ADD</button>`
                }
            </div>
        </div>`;
    }).join('');

    refreshIcons();
}

// ===== OPTIONS MODAL =====
let currentItemWithOptions = null;
let selectedOption = null;

function handleAddItem(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    if (item.options && item.options.length > 0) {
        showOptionsModal(item);
    } else {
        addToCart(item);
        showToast(`${item.name} added to cart ✓`);
    }
}

function showOptionsModal(item) {
    currentItemWithOptions = item;
    selectedOption = item.options[0];
    const modal = document.getElementById('options-modal');
    const list = document.getElementById('options-list');
    modal.classList.remove('hidden');

    list.innerHTML = item.options.map(opt => `
        <div class="option-item ${opt === selectedOption ? 'active' : ''}" onclick="selectOption('${opt}')">
            ${opt}
        </div>`).join('');

    document.getElementById('confirm-options-btn').onclick = () => {
        addToCart(currentItemWithOptions, selectedOption);
        showToast(`${currentItemWithOptions.name} (${selectedOption}) added ✓`);
        closeModal();
    };
    refreshIcons();
}

function selectOption(opt) {
    selectedOption = opt;
    document.querySelectorAll('.option-item').forEach(el => {
        el.classList.toggle('active', el.innerText.trim() === opt);
    });
}

function closeModal() {
    document.getElementById('options-modal').classList.add('hidden');
    currentItemWithOptions = null;
}

// ===== CART =====
function addToCart(item, option = null) {
    const existing = cart.find(c => c.id === item.id && c.option === option);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1, option });
    }
    updateCartUI();
    renderMenu();
}

function updateQty(itemId, delta) {
    const idx = cart.findIndex(c => c.id === itemId);
    if (idx === -1) return;
    cart[idx].quantity += delta;
    if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    updateCartUI();
    renderMenu();
    if (document.getElementById('checkout-screen').classList.contains('active')) {
        renderCartSummary();
        calculateBill();
    }
    if (document.getElementById('favorites-screen').classList.contains('active')) renderFavorites();
}

function toggleFavorite(itemId) {
    const idx = favorites.indexOf(itemId);
    if (idx > -1) {
        favorites.splice(idx, 1);
        showToast('Removed from favorites');
    } else {
        favorites.push(itemId);
        showToast('Added to favorites ❤️');
    }
    localStorage.setItem('rs_favorites', JSON.stringify(favorites));
    renderMenu();
    if (document.getElementById('favorites-screen').classList.contains('active')) renderFavorites();
}

function renderFavorites() {
    const container = document.getElementById('favorites-list');
    const favItems = menuItems.filter(i => favorites.includes(i.id));
    if (favItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="heart"></i>
                <h3>No favorites yet</h3>
                <p>Tap the heart icon on any item to save it here</p>
                <button class="primary-btn" onclick="showScreen('home')" style="width:160px;font-size:13px;">Browse Menu</button>
            </div>`;
    } else {
        container.innerHTML = favItems.map(item => {
            const inCart = cart.find(c => c.id === item.id);
            const qty = inCart ? inCart.quantity : 0;
            return `
            <div class="menu-card" style="flex-direction:row;gap:12px;padding:14px;">
                <button class="fav-btn-card active" onclick="toggleFavorite('${item.id}')" style="top:10px;right:10px;">
                    <i data-lucide="heart" style="fill:#e63946;color:#e63946;"></i>
                </button>
                <div style="width:80px;height:80px;border-radius:12px;overflow:hidden;flex-shrink:0;">
                    <img src="${item.image}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${item.name}" onerror="this.src='https://placehold.co/80x80/f7cb46/1a1a1a?text=RS'">
                </div>
                <div style="flex:1;min-width:0;">
                    <h4 style="font-size:14px;font-weight:800;margin-bottom:2px;">${item.name}</h4>
                    <p style="font-size:11px;color:#888;margin-bottom:8px;font-weight:600;">₹${item.price}</p>
                    ${qty > 0
                        ? `<div class="qty-control" style="width:fit-content;">
                               <button onclick="updateQty('${item.id}', -1)">−</button>
                               <span>${qty}</span>
                               <button onclick="updateQty('${item.id}', 1)">+</button>
                           </div>`
                        : `<button class="add-btn" onclick="handleAddItem('${item.id}')">ADD</button>`
                    }
                </div>
            </div>`;
        }).join('');
    }
    refreshIcons();
}

function updateCartUI() {
    const count    = cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    const cc  = document.getElementById('cart-count');
    const cbt = document.getElementById('cart-bar-total');
    const scb = document.getElementById('sticky-cart-bar');

    if (cc)  cc.innerText  = `${count} ${count === 1 ? 'Item' : 'Items'}`;
    if (cbt) cbt.innerText = `₹${subtotal}`;

    const isCheckout = document.getElementById('checkout-screen').classList.contains('active');
    const isSuccess  = document.getElementById('success-screen').classList.contains('active');
    const isTracking = document.getElementById('tracking-screen').classList.contains('active');

    if (count > 0 && !isCheckout && !isSuccess && !isTracking) {
        scb && scb.classList.remove('hidden');
    } else {
        scb && scb.classList.add('hidden');
    }
    refreshIcons();
}

// ===== ORDER HISTORY =====
function renderOrders() {
    const container = document.getElementById('orders-content');
    if (orderHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="shopping-bag"></i>
                <h3>No orders yet</h3>
                <p>Your order history will appear here</p>
                <button class="primary-btn" onclick="showScreen('home')" style="width:160px;font-size:13px;">Order Now</button>
            </div>`;
    } else {
        container.innerHTML = orderHistory.map(order => `
            <div class="checkout-card order-history-card" style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                    <div>
                        <h4 style="font-size:14px;font-weight:800;">Order #${order.id}</h4>
                        <small style="color:#999;font-weight:600;">${order.date}</small>
                    </div>
                    <span style="font-size:10px;font-weight:800;padding:4px 12px;border-radius:50px;background:${order.status === 'In Progress' ? '#fff9e6' : '#ecfdf5'};color:${order.status === 'In Progress' ? '#d97706' : '#059669'};">
                        ${order.status}
                    </span>
                </div>
                <p style="font-size:12px;color:#666;margin-bottom:10px;">${order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</p>
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f5f5f5;padding-top:10px;">
                    <strong style="font-size:14px;">₹${order.total}</strong>
                    ${order.status === 'In Progress'
                        ? `<button class="text-link" onclick="startTracking()" style="font-size:12px;">Track Order →</button>`
                        : `<button class="text-link" style="font-size:12px;color:#999;">Delivered ✓</button>`}
                </div>
            </div>`).join('');
    }
    refreshIcons();
}

// ===== CHECKOUT =====
function renderCartSummary() {
    const list = document.getElementById('cart-items-list');
    if (!list) return;
    list.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="item-img">
                    <img src="${item.image}" alt="${item.name}" onerror="this.src='https://placehold.co/48x48/f7cb46/1a1a1a?text=RS'">
                </div>
                <div class="item-details">
                    <h4>${item.name}</h4>
                    ${item.option ? `<p>${item.option}</p>` : ''}
                    <span class="item-qty-price">${item.quantity} × ₹${item.price}</span>
                </div>
            </div>
            <strong>₹${item.price * item.quantity}</strong>
        </div>`).join('');
}

function calculateBill() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    let discount = 0;
    if (appliedCoupon === 'SAVE10' && subtotal >= 250) {
        discount = Math.floor(subtotal * 0.1);
    }

    let delivery = 0;
    if (subtotal > 0) {
        if (subtotal >= 250 && currentDistance <= 1) {
            delivery = 0;
        } else if (currentDistance <= 1) {
            delivery = 10;
        } else if (currentDistance <= 3) {
            delivery = 20;
        } else {
            delivery = 30;
        }
    }

    const total = subtotal - discount + delivery;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('bill-subtotal', `₹${subtotal}`);
    set('bill-discount', `-₹${discount}`);
    set('bill-delivery', delivery === 0 && subtotal > 0 ? 'FREE 🎉' : `₹${delivery}`);
    set('bill-total', `₹${total}`);
    set('btn-total', `₹${total}`);
}

// ===== COUPON =====
function applyCoupon() {
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    if (code === 'SAVE10') {
        if (subtotal >= 250) {
            appliedCoupon = 'SAVE10';
            document.getElementById('applied-coupon').classList.remove('hidden');
            document.getElementById('coupon-input-area').classList.add('hidden');
            document.getElementById('coupon-name').innerText = "'SAVE10' Applied";
            document.getElementById('coupon-savings').innerText = `You saved ₹${Math.floor(subtotal * 0.1)}`;
            calculateBill();
            showToast('Coupon SAVE10 applied! 🎉');
        } else {
            showToast(`Minimum order ₹250 for SAVE10 (need ₹${250 - subtotal} more)`);
        }
    } else if (code === '') {
        showToast('Please enter a coupon code');
    } else {
        showToast('Invalid coupon code');
    }
}

function removeCoupon() {
    appliedCoupon = null;
    document.getElementById('applied-coupon').classList.add('hidden');
    document.getElementById('coupon-input-area').classList.remove('hidden');
    document.getElementById('coupon-code').value = '';
    calculateBill();
    showToast('Coupon removed');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Category clicks
    document.querySelectorAll('.cat-item').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cat-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategory = tab.dataset.category;
            renderMenu();
        });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchQuery = e.target.value;
            renderMenu();
        });
    }

    // Distance slider
    const slider = document.getElementById('distance-slider');
    const distVal = document.getElementById('distance-val');
    if (slider) {
        slider.addEventListener('input', e => {
            currentDistance = parseFloat(e.target.value);
            if (distVal) distVal.innerText = `${currentDistance.toFixed(1)} km`;
            calculateBill();
        });
    }

    // Payment options
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            const radio = opt.querySelector('input');
            if (radio) radio.checked = true;
        });
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// ===== PLACE ORDER =====
function placeOrder() {
    if (cart.length === 0) { showToast('Your cart is empty!'); return; }

    const orderId = 'RSTC-' + Math.floor(10000 + Math.random() * 90000);
    const currentAddr = document.getElementById('current-address');
    const addr = currentAddr ? currentAddr.innerText : 'Your location';

    // Update success screen
    const soId = document.getElementById('success-order-id');
    const soAddr = document.getElementById('success-delivery-address');
    if (soId) soId.innerText = '#' + orderId;
    if (soAddr) soAddr.innerText = addr;

    // Persist for tracking
    const orderItems = [...cart];
    localStorage.setItem('lastOrderItems', JSON.stringify(orderItems));
    localStorage.setItem('lastOrderId', orderId);
    const now = new Date();
    localStorage.setItem('lastOrderTime', now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    localStorage.setItem('orderTimestamp', Date.now());
    setOrderActive(true);

    // Calculate final total
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = (appliedCoupon === 'SAVE10' && subtotal >= 250) ? Math.floor(subtotal * 0.1) : 0;
    const delivery = (subtotal >= 250 && currentDistance <= 1) ? 0 : (currentDistance <= 3 ? 20 : 30);
    const total = subtotal - discount + delivery;

    // Add to history
    orderHistory.unshift({
        id: orderId,
        date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: orderItems,
        total,
        status: 'In Progress'
    });

    // Populate tracking preview
    const trackList = document.getElementById('track-items-list');
    const trackTotal = document.getElementById('track-total-val');
    if (trackList) {
        trackList.innerHTML = orderItems.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="item-img"><img src="${item.image}" onerror="this.src='https://placehold.co/48x48/f7cb46/1a1a1a?text=RS'"></div>
                    <div class="item-details"><h4>${item.name}</h4><span class="item-qty-price">${item.quantity} × ₹${item.price}</span></div>
                </div>
                <strong>₹${item.price * item.quantity}</strong>
            </div>`).join('');
    }
    if (trackTotal) trackTotal.innerText = `₹${total}`;

    const trackOrderId = document.getElementById('track-order-id');
    if (trackOrderId) trackOrderId.innerText = orderId;

    const placedTime = document.getElementById('placed-time');
    if (placedTime) placedTime.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Confetti
    if (typeof confetti !== 'undefined') {
        confetti({ particleCount: 160, spread: 75, origin: { y: 0.6 }, colors: ['#f7cb46', '#27ae60', '#e63946'] });
    }

    // Clear cart and go to success
    setTimeout(() => {
        cart = [];
        appliedCoupon = null;
        updateCartUI();
        showScreen('success');
        simulateTrackingProgress();
    }, 1200);
}

// ===== TRACKING =====
function startTracking() {
    showScreen('tracking');
}

function loadTrackingData() {
    const orderId = localStorage.getItem('lastOrderId') || 'RSTC-00000';
    const orderTime = localStorage.getItem('lastOrderTime') || '--:--';
    const lastItems = JSON.parse(localStorage.getItem('lastOrderItems')) || [];

    const trackId = document.getElementById('track-order-id');
    const placedTime = document.getElementById('placed-time');
    if (trackId) trackId.innerText = orderId;
    if (placedTime) placedTime.innerText = orderTime;

    const list = document.getElementById('track-items-list');
    const totalVal = document.getElementById('track-total-val');
    let total = 0;

    if (list) {
        list.innerHTML = lastItems.map(item => {
            total += item.price * item.quantity;
            return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="item-img">
                        <img src="${item.image}" onerror="this.src='https://placehold.co/48x48/f7cb46/1a1a1a?text=RS'" alt="${item.name}">
                    </div>
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <span class="item-qty-price">${item.quantity} × ₹${item.price}</span>
                    </div>
                </div>
                <strong>₹${item.price * item.quantity}</strong>
            </div>`;
        }).join('');
    }

    if (totalVal) totalVal.innerText = `₹${total}`;
    refreshIcons();
}

function simulateTrackingProgress() {
    const stepIds = ['step-placed', 'step-preparing', 'step-onway', 'step-delivered'];
    const steps   = stepIds.map(id => document.getElementById(id)).filter(Boolean);
    let current = 0;

    // Reset
    steps.forEach((s, i) => {
        s.classList.remove('active', 'in-progress');
        if (i === 0) { s.classList.add('active'); const ic = s.querySelector('.step-icon'); if (ic) ic.innerHTML = '<i data-lucide="check"></i>'; }
        else { const ic = s.querySelector('.step-icon'); if (ic) ic.innerHTML = ''; }
    });
    refreshIcons();

    const interval = setInterval(() => {
        if (current < steps.length - 1) {
            steps[current].classList.remove('in-progress');
            steps[current].classList.add('active');
            const ic = steps[current].querySelector('.step-icon');
            if (ic) ic.innerHTML = '<i data-lucide="check"></i>';
            current++;
            steps[current].classList.add('in-progress');

            // Move delivery icon
            const icon = document.getElementById('delivery-icon');
            if (icon) {
                const positions = [
                    { left: '45%', top: '40%' },
                    { left: '50%', top: '38%' },
                    { left: '58%', top: '50%' },
                    { left: '65%', top: '45%' }
                ];
                const pos = positions[current] || positions[positions.length - 1];
                icon.style.left = pos.left;
                icon.style.top  = pos.top;
            }
            refreshIcons();
        } else {
            clearInterval(interval);
            setTimeout(() => {
                setOrderActive(false);
                if (orderHistory.length > 0) orderHistory[0].status = 'Delivered';
                showToast('Order delivered! Enjoy your meal 😊');
            }, 5000);
        }
    }, 8000);
}

// Cancel order (in-app tracking screen)
function startCancelTimer() {
    if (cancelTimerInterval) clearInterval(cancelTimerInterval);
    const timestamp = parseInt(localStorage.getItem('orderTimestamp'));
    if (!timestamp) return;

    const cancelBar = document.getElementById('cancel-bar');
    const timerEl   = document.getElementById('timer-count');
    const cancelBtn = document.getElementById('btn-cancel-order');

    function tick() {
        const remaining = (2 * 60 * 1000) - (Date.now() - timestamp);
        if (remaining <= 0) {
            if (cancelBar) cancelBar.classList.add('hidden');
            clearInterval(cancelTimerInterval);
            return;
        }
        if (cancelBar) cancelBar.classList.remove('hidden');
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        if (timerEl) timerEl.innerText = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    tick();
    cancelTimerInterval = setInterval(tick, 1000);
}

function cancelOrder() {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    clearInterval(cancelTimerInterval);
    setOrderActive(false);
    localStorage.removeItem('orderTimestamp');
    if (orderHistory.length > 0) orderHistory[0].status = 'Cancelled';
    showToast('Order cancelled');
    showScreen('home');
}

// ===== MAKE CALL / CHAT =====
function makeCall() {
    window.location.href = 'tel:9876543210';
}

function openChat() {
    document.getElementById('chat-modal').classList.remove('hidden');
    refreshIcons();
}

function closeChat() {
    document.getElementById('chat-modal').classList.add('hidden');
}

function sendChatMsg() {
    const input = document.getElementById('chat-input');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;
    const msgs = document.getElementById('chat-messages');
    if (msgs) {
        msgs.innerHTML += `<div style="background:#f7cb46;padding:11px 15px;border-radius:16px 4px 16px 16px;align-self:flex-end;max-width:82%;font-size:13px;font-weight:600;color:#1a1a1a;">${msg}</div>`;
        msgs.scrollTop = msgs.scrollHeight;
    }
    if (input) input.value = '';
    // Simulate reply
    setTimeout(() => {
        if (msgs) {
            msgs.innerHTML += `<div style="background:#f1f1f1;padding:11px 15px;border-radius:4px 16px 16px 16px;align-self:flex-start;max-width:82%;font-size:13px;font-weight:600;color:#333;">On my way! Will be there soon. 🏍️</div>`;
            msgs.scrollTop = msgs.scrollHeight;
        }
    }, 1500);
}

// ===== PARTNER PROFILE =====
function openPartnerProfile() {
    const modal = document.getElementById('partner-profile-modal');
    if (modal) { modal.classList.remove('hidden'); refreshIcons(); }
}

function closePartnerProfile() {
    const modal = document.getElementById('partner-profile-modal');
    if (modal) modal.classList.add('hidden');
}

// ===== AUTH =====
function openLoginPage() {
    closeAuthModal();
    window.location.href = 'login.html';
}

function openAuthModal() {
    if (currentUser) {
        showAuthLoggedIn();
    } else {
        document.getElementById('auth-modal').classList.remove('hidden');
        refreshIcons();
    }
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function updateAuthUI() {
    const authBtn = document.getElementById('auth-btn');
    if (!authBtn) return;

    if (currentUser) {
        authBtn.outerHTML = `
            <div class="user-pill" onclick="openAuthModal()" id="header-user-pill" title="Account">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}" alt="User" onerror="this.src='https://placehold.co/26x26/f7cb46/1a1a1a?text=U'">
                <span>${currentUser.name.split(' ')[0]}</span>
            </div>`;
        const titleEl = document.getElementById('header-title');
        if (titleEl) titleEl.innerText = `Hi, ${currentUser.name.split(' ')[0]} 👋`;
    } else {
        const pill = document.getElementById('header-user-pill');
        if (pill) {
            pill.outerHTML = `<button class="icon-btn" id="auth-btn" onclick="openAuthModal()" title="Account"><i data-lucide="user"></i></button>`;
        }
    }
    refreshIcons();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    closeAuthModal();
    updateAuthUI();
    showToast('Logged out successfully');
}

function showAuthLoggedIn() {
    const modal = document.getElementById('auth-modal');
    const content = document.getElementById('auth-modal-content');
    if (!modal || !content) return;
    modal.classList.remove('hidden');

    content.innerHTML = `
        <div>
            <div style="background:linear-gradient(135deg,#f7cb46,#f59e0b);padding:40px 24px 28px;text-align:center;border-radius:28px 28px 0 0;position:relative;">
                <button onclick="closeAuthModal()" class="close-btn" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.3);color:#1a1a1a;"><i data-lucide="x"></i></button>
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}" style="width:80px;height:80px;border-radius:50%;border:4px solid white;margin-bottom:12px;background:white;display:block;margin-left:auto;margin-right:auto;" onerror="this.src='https://placehold.co/80x80/fff/1a1a1a?text=U'">
                <h3 style="font-size:20px;font-weight:900;margin:0 0 4px;color:#1a1a1a;">${currentUser.name}</h3>
                <p style="opacity:0.75;font-size:13px;margin:0;font-weight:600;color:#1a1a1a;">${currentUser.phone || ''}</p>
                ${currentUser.email ? `<p style="opacity:0.65;font-size:11px;margin:4px 0 0;color:#1a1a1a;">${currentUser.email}</p>` : ''}
            </div>
            <div style="padding:22px 22px 28px;display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;gap:12px;">
                    <div style="flex:1;background:#f8f8f8;border-radius:14px;padding:14px;text-align:center;">
                        <strong style="font-size:20px;display:block;">${orderHistory.length}</strong>
                        <small style="color:#999;font-weight:700;font-size:10px;text-transform:uppercase;">Orders</small>
                    </div>
                    <div style="flex:1;background:#f8f8f8;border-radius:14px;padding:14px;text-align:center;">
                        <strong style="font-size:20px;display:block;">${favorites.length}</strong>
                        <small style="color:#999;font-weight:700;font-size:10px;text-transform:uppercase;">Favourites</small>
                    </div>
                </div>
                <button onclick="showScreen('orders');closeAuthModal();" class="secondary-btn" style="margin:0;">View My Orders</button>
                <button onclick="handleLogout();" style="background:#fff0f0;color:#e63946;border:1.5px solid #ffcdd2;border-radius:50px;padding:14px;font-weight:800;font-size:14px;cursor:pointer;width:100%;font-family:'Inter',sans-serif;">Sign Out</button>
            </div>
        </div>`;
    refreshIcons();
}

// ===== INIT =====
function init() {
    renderMenu();
    updateCartUI();
    updateActiveOrderStatus();
    updateAuthUI();
    setupEventListeners();
    detectLocation();
    refreshIcons();
}

init();
