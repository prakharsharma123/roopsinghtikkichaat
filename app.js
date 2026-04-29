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

];

// ===== STATE =====
let cart = [];
let activeCategory = 'All';
let searchQuery = '';
let favorites = JSON.parse(localStorage.getItem('rs_favorites')) || [];
let currentDistance = null;   // null = not yet detected
let userLat = null, userLng = null;
// Shop location — Alambagh, Lucknow (Precise coordinates)
const SHOP_LAT = 26.8111, SHOP_LNG = 80.9008; // Store 2, 551 Jha/190, Ram Nagar, Alambagh, Lucknow, UP 226005, Lucknow
const SHOP_NAME = "Roop Singh Tikki Chaat Corner, Lucknow";
const SHOP_WHATSAPP = "918182843657";
const SHOP_OPEN_HOUR = 15;    // 3:00 PM
const SHOP_CLOSE_HOUR = 22;    // 10:00 PM
// Sunday = 0, Monday = 1 ... Saturday = 6
const SHOP_CLOSED_DAYS = [0]; // Sunday closed
let appliedCoupon = null;
let customDeliveryFee = null; // New: allow setting any amount
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

// Haversine distance in km (straight-line distance)
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ===== ACCURATE ROAD DISTANCE CALCULATION =====
// Uses OSRM API to get real driving distance (like Google Maps)
// Falls back to estimated distance if API fails
async function getAccurateDistance(userLat, userLng, shopLat, shopLng) {
    // Try OSRM first (free public routing API - no key needed)
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${shopLng},${shopLat}?overview=false`;
        const response = await fetch(url, { 
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const route = data.routes[0];
            const distanceInKm = route.distance / 1000;
            const durationInSeconds = route.duration;
            
            console.log('✅ Using OSRM road distance:', distanceInKm.toFixed(2), 'km');
            
            return {
                distance: distanceInKm,
                duration: Math.ceil(durationInSeconds / 60),
                method: 'road'
            };
        }
    } catch (err) {
        console.log('⚠️ OSRM failed:', err.message, '- using estimated distance');
    }
    
    // Fallback: Haversine with road multiplier (roads are typically 30-50% longer than straight line)
    const straightDistance = haversine(userLat, userLng, shopLat, shopLng);
    const estimatedRoadDistance = straightDistance * 1.4; // 40% longer for city roads
    
    console.log('📍 Estimated distance:', estimatedRoadDistance.toFixed(2), 'km (straight line:', straightDistance.toFixed(2), 'km × 1.4)');
    
    return {
        distance: estimatedRoadDistance,
        duration: null,
        method: 'estimated'
    };
}

// ===== SHOP STATUS =====
function getShopStatus() {
    const now = new Date();
    const day = now.getDay(); // 0=Sunday
    const timeDecimal = now.getHours() + now.getMinutes() / 60;

    if (SHOP_CLOSED_DAYS.includes(day)) {
        return { open: false, reason: "Aaj dukaan band hai 🙏 Kal 3:00 PM se aayein!" };
    }
    if (timeDecimal < SHOP_OPEN_HOUR || timeDecimal >= SHOP_CLOSE_HOUR) {
        const openStr = "3:00 PM";
        const closeStr = "10:00 PM";
        const isBeforeOpen = timeDecimal < SHOP_OPEN_HOUR;
        const reason = isBeforeOpen
            ? `Dukaan ${openStr} se khulti hai! Thodi der mein aayein 🕒`
            : `Dukaan aaj ke liye band ho gayi (${closeStr} tak thi) 🌙 Kal ${openStr} se milein!`;
        return { open: false, reason };
    }
    return { open: true, reason: "" };
}

function checkShopAndShowBanner() {
    const status = getShopStatus();
    let banner = document.getElementById('shop-closed-banner');
    if (!banner) return;
    if (!status.open) {
        banner.style.display = 'flex';
        document.getElementById('shop-closed-reason').innerText = status.reason;
        // Disable place order btn
        const placeBtn = document.querySelector('.place-order-btn');
        if (placeBtn) { placeBtn.disabled = true; placeBtn.style.opacity = '0.5'; }
    } else {
        banner.style.display = 'none';
    }
}

// ===== ESTIMATED DELIVERY TIME =====
function getEstimatedDelivery(distKm) {
    if (distKm === null) return '20 – 35 min';
    const prepTime = 10; // min
    const travelTime = Math.ceil(distKm * 6); // ~6 min per km
    const low = prepTime + travelTime;
    const high = low + 10;
    return `${low} – ${high} min`;
}

function setAddressUI(shortAddr, lat, lng, distKm) {
    userLat = lat; userLng = lng;
    currentDistance = distKm;

    const tagEl   = document.getElementById('location-tag');
    const addrEl  = document.getElementById('current-address');
    const distEl  = document.getElementById('distance-val');
    const headerTitle = document.getElementById('header-title');
    
    const eta = getEstimatedDelivery(distKm);

    if (tagEl)   tagEl.innerText  = shortAddr;
    if (addrEl)  addrEl.innerText = shortAddr;
    if (distEl)  distEl.innerText = distKm.toFixed(1) + ' km';
    if (headerTitle) headerTitle.innerText = `Delivery in ${eta.split(' – ')[0]} mins`;
    
    calculateBill();
}

function openInGoogleMaps() {
    const addrEl = document.getElementById('current-address');
    const addr = addrEl ? addrEl.innerText : '';
    if (addr && addr !== '📍 Tap \'Auto-Detect\' to get your location') {
        if (userLat && userLng) {
            window.open(`https://www.google.com/maps?q=${userLat},${userLng}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(addr)}`, '_blank');
        }
    } else {
        showToast('Detect or enter your location first');
    }
}

function detectLocation() {
    const tagEl = document.getElementById('location-tag');
    if (tagEl) tagEl.innerText = 'Detecting location…';
    detectLocationCore(tagEl);
}

function detectLocationForCheckout() {
    showToast('Detecting your location… 📍');
    detectLocationCore(null);
}

async function detectLocationCore(tagEl) {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported on this device');
        if (tagEl) tagEl.innerText = 'Not supported';
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
                const short = [addr.road, addr.suburb, addr.city_district, addr.city].filter(Boolean).join(', ')
                              || data.display_name.split(',').slice(0, 3).join(', ');
                
                // Get accurate road distance (not straight-line)
                const distData = await getAccurateDistance(latitude, longitude, SHOP_LAT, SHOP_LNG);
                const dist = distData.distance;
                
                setAddressUI(short, latitude, longitude, dist);
                showToast('Location detected ✓');
            } catch {
                const fallback = 'Could not fetch address';
                if (tagEl) tagEl.innerText = fallback;
                showToast('Could not get address. Enter manually.');
            }
        },
        (err) => {
            const msgs = { 1: 'Permission denied — enter manually', 2: 'Location unavailable', 3: 'Request timed out' };
            const msg = msgs[err.code] || 'Location error';
            if (tagEl) tagEl.innerText = msg;
            showToast(msg);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function openManualAddressModal() {
    // Clear previous entries
    ['addr-house','addr-line1','addr-line2','addr-pin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Reset city to default
    const cityEl = document.getElementById('addr-city');
    if (cityEl) cityEl.value = 'Lucknow';
    // Hide preview
    const prev = document.getElementById('addr-preview');
    if (prev) prev.style.display = 'none';

    document.getElementById('manual-address-modal').classList.remove('hidden');
    refreshIcons();
}

function closeManualAddressModal() {
    document.getElementById('manual-address-modal').classList.add('hidden');
}

// Live address preview as user types
function updateAddressPreview() {
    const house = (document.getElementById('addr-house')?.value || '').trim();
    const line1 = (document.getElementById('addr-line1')?.value || '').trim();
    const line2 = (document.getElementById('addr-line2')?.value || '').trim();
    const city  = (document.getElementById('addr-city')?.value  || '').trim();
    const pin   = (document.getElementById('addr-pin')?.value   || '').trim();

    const parts = [house, line1, line2, city, pin].filter(Boolean);
    const prev = document.getElementById('addr-preview');
    const prevText = document.getElementById('addr-preview-text');

    if (parts.length >= 2) {
        prev.style.display = 'block';
        prevText.textContent = parts.join(', ');
    } else {
        prev.style.display = 'none';
    }
}

// Save structured address — builds precise geocoding query from PIN+area+city
async function saveStructuredAddress() {
    const house = (document.getElementById('addr-house')?.value || '').trim();
    const line1 = (document.getElementById('addr-line1')?.value || '').trim();
    const line2 = (document.getElementById('addr-line2')?.value || '').trim();
    const city  = (document.getElementById('addr-city')?.value  || '').trim();
    const pin   = (document.getElementById('addr-pin')?.value   || '').trim();

    if (!house) { showToast('Please enter House / Flat No.'); document.getElementById('addr-house').focus(); return; }
    if (!line1) { showToast('Please enter Street / Road name'); document.getElementById('addr-line1').focus(); return; }
    if (!city)  { showToast('Please enter City'); document.getElementById('addr-city').focus(); return; }
    if (!pin || pin.length < 5) { showToast('Please enter a valid PIN / ZIP code'); document.getElementById('addr-pin').focus(); return; }

    // Full display address (what user sees)
    const displayParts = [house, line1, line2, city, pin].filter(Boolean);
    const displayAddr  = displayParts.join(', ');

    // Geocoding query: use PIN + area/locality + city — most geocodable combo
    // PIN code alone is very precise for Nominatim; area adds locality context
    const geocodeParts = [line2 || line1, city, pin, 'India'].filter(Boolean);
    const geocodeQuery = geocodeParts.join(', ');

    showToast('Finding your location on map… 📍');

    try {
        let lat = null, lng = null, dist = null;

        // Strategy 1: Most precise — full street + area + city + PIN query
        const fullQuery = [line1, line2, city, pin, 'India'].filter(Boolean).join(', ');
        try {
            const fullRes = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=3&addressdetails=1&countrycodes=in`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const fullData = await fullRes.json();
            if (fullData && fullData.length > 0) {
                // Pick result closest to our shop city (Lucknow area ~26.8, 80.9)
                let best = fullData[0];
                let minDist = Infinity;
                fullData.forEach(r => {
                    const d = Math.abs(parseFloat(r.lat) - 26.85) + Math.abs(parseFloat(r.lon) - 80.95);
                    if (d < minDist) { minDist = d; best = r; }
                });
                lat = parseFloat(best.lat);
                lng = parseFloat(best.lon);
            }
        } catch(e) {}

        // Strategy 2: area + city + PIN (if street not found)
        if (!lat) {
            const areaQuery = [(line2 || line1), city, pin, 'India'].filter(Boolean).join(', ');
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(areaQuery)}&limit=1&countrycodes=in`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            if (data && data.length > 0) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
        }

        // Strategy 3: Fallback — PIN only (least precise, center of pincode area)
        if (!lat && pin.length === 6) {
            const pinRes = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pin + ' Lucknow India')}&limit=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const pinData = await pinRes.json();
            if (pinData && pinData.length > 0) { lat = parseFloat(pinData[0].lat); lng = parseFloat(pinData[0].lon); }
        }

        if (lat && lng) {
            const distData = await getAccurateDistance(lat, lng, SHOP_LAT, SHOP_LNG);
            dist = distData.distance;
            showToast(`📍 Location found! Distance: ${dist.toFixed(1)} km`);
        } else {
            dist = currentDistance || 2.0;
            showToast('⚠️ Could not pin exact location — using area estimate');
        }

        setAddressUI(displayAddr, lat, lng, dist);
        closeManualAddressModal();

    } catch (err) {
        console.error('Geocoding error:', err);
        const fallbackDist = currentDistance || 2.0;
        setAddressUI(displayAddr, null, null, fallbackDist);
        closeManualAddressModal();
        showToast('Network error — using estimate distance');
    }
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

    // Group by category when showing All
    let html = '';
    if (activeCategory === 'All' && !searchQuery.trim()) {
        const categories = [...new Set(items.map(i => i.category))];
        categories.forEach(cat => {
            const catItems = items.filter(i => i.category === cat);
            const catEmoji = cat === 'Golgappe' ? '🫧' : cat === 'Tikki' ? '🥔' : '🌿';
            html += `<div style="grid-column:1/-1;margin:8px 0 4px;"><span style="font-size:12px;font-weight:900;color:#1a1a1a;padding:4px 14px;background:#f7cb46;border-radius:50px;">${catEmoji} ${cat}</span></div>`;
            catItems.forEach(item => {
                const inCart = cart.find(c => c.id === item.id);
                const qty = inCart ? inCart.quantity : 0;
                const isFav = favorites.includes(item.id);
                html += buildMenuCard(item, qty, isFav);
            });
        });
    } else {
        items.forEach(item => {
            const inCart = cart.find(c => c.id === item.id);
            const qty = inCart ? inCart.quantity : 0;
            const isFav = favorites.includes(item.id);
            html += buildMenuCard(item, qty, isFav);
        });
    }
    grid.innerHTML = html;
    refreshIcons();
}

function buildMenuCard(item, qty, isFav) {
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
        openSpecialInstructionsModal(item, null);
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
        const item = currentItemWithOptions;
        const opt  = selectedOption;
        closeModal();
        openSpecialInstructionsModal(item, opt);
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

// ===== SPECIAL INSTRUCTIONS MODAL =====
let _siItem = null;
let _siOption = null;

function openSpecialInstructionsModal(item, option) {
    _siItem = item;
    _siOption = option || null;
    const nameEl = document.getElementById('si-item-name');
    if (nameEl) nameEl.innerText = item.name + (option ? ' (' + option + ')' : '');
    const noteEl = document.getElementById('si-note-input');
    if (noteEl) noteEl.value = '';
    document.getElementById('special-instructions-modal').classList.remove('hidden');
}

function closeSpecialInstructionsModal() {
    document.getElementById('special-instructions-modal').classList.add('hidden');
}

function addSITag(tag) {
    const el = document.getElementById('si-note-input');
    if (!el) return;
    el.value = el.value ? el.value + ', ' + tag : tag;
}

function confirmAddWithNote(withNote) {
    if (!_siItem) return;
    const note = withNote ? (document.getElementById('si-note-input').value.trim()) : '';
    addToCart(_siItem, _siOption, note);
    closeSpecialInstructionsModal();
    showToast(_siItem.name + ' added to cart ✓');
    _siItem = null; _siOption = null;
    renderMenu();
}

// ===== CART =====
function addToCart(item, option = null, note = '') {
    const existing = cart.find(c => c.id === item.id && c.option === option);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1, option, note: note || '' });
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
    // Use full SECRET_COUPONS system — all 7 codes supported
    let discount = 0;
    if (appliedCoupon && typeof SECRET_COUPONS !== 'undefined' && SECRET_COUPONS[appliedCoupon] && subtotal >= SECRET_COUPONS[appliedCoupon].minOrder) {
        discount = getCouponDiscount(appliedCoupon, subtotal);
    }

    let delivery = 0;
    if (customDeliveryFee !== null) {
        delivery = customDeliveryFee;
    } else if (subtotal > 0 && currentDistance !== null) {
        const distanceCharge = Math.round(currentDistance * 10); // ₹10 per km
        if (subtotal >= 250) {
            delivery = distanceCharge; // Free base delivery, only pay distance charge
        } else {
            delivery = 40 + distanceCharge; // ₹40 base fee + distance charge for small orders
        }
    }

    const total = subtotal - discount + delivery;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('bill-subtotal', `₹${subtotal}`);
    set('bill-discount', `-₹${discount}`);
    set('bill-delivery', customDeliveryFee !== null ? `₹${delivery}` : (delivery === 0 && subtotal > 0 ? 'FREE 🎉' : `₹${delivery}`));
    set('bill-total', `₹${total}`);
    set('btn-total', `₹${total}`);

    // Min order warning
    const minWarn = document.getElementById('min-order-warning');
    if (minWarn) {
        if (subtotal > 0 && subtotal < 250) {
            minWarn.style.display = 'block';
            minWarn.innerText = `💡 Tip: ₹250 se kam ke orders par ₹40 extra delivery charge lagta hai. ₹${250 - subtotal} aur add karke bacha sakte hain!`;
        } else {
            minWarn.style.display = 'none';
        }
    }
}

// ===== SECRET COUPON SYSTEM =====
// These codes are only shared by the owner for marketing
const SECRET_COUPONS = {
    'ROOP20':  { discount: 20, type: 'flat',    minOrder: 150, desc: 'Flat ₹20 off' },
    'CHAAT15': { discount: 15, type: 'percent', minOrder: 200, desc: '15% off' },
    'TIKKI30': { discount: 30, type: 'flat',    minOrder: 250, desc: 'Flat ₹30 off' },
    'LUCKY50': { discount: 50, type: 'flat',    minOrder: 300, desc: 'Flat ₹50 off' },
    'INSTA25': { discount: 25, type: 'percent', minOrder: 200, desc: '25% off (Instagram Special)' },
    'VIRAL40': { discount: 40, type: 'flat',    minOrder: 280, desc: 'Flat ₹40 off (Viral Share)' },
    'SHARE35': { discount: 35, type: 'flat',    minOrder: 260, desc: 'Flat ₹35 off (WhatsApp Share)' },
    'SAVE10':  { discount: 10, type: 'percent', minOrder: 250, desc: '10% off' }
};

function getUsedCoupons() {
    return JSON.parse(localStorage.getItem('rs_used_coupons') || '[]');
}
function markCouponUsed(code) {
    const used = getUsedCoupons();
    if (!used.includes(code)) { used.push(code); localStorage.setItem('rs_used_coupons', JSON.stringify(used)); }
}
function getCouponDiscount(code, subtotal) {
    const c = SECRET_COUPONS[code];
    if (!c) return 0;
    if (c.type === 'flat') return c.discount;
    if (c.type === 'percent') return Math.floor(subtotal * c.discount / 100);
    return 0;
}

// ===== COUPON =====
function applyCoupon() {
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    if (code === '') { showToast('Please enter a coupon code'); return; }
    const usedCoupons = getUsedCoupons();
    if (usedCoupons.includes(code)) { showToast('This coupon has already been used! Each code works only once.'); return; }
    const coupon = SECRET_COUPONS[code];
    if (!coupon) { showToast('Invalid coupon code ❌'); return; }
    if (subtotal < coupon.minOrder) { showToast(`Minimum order ₹${coupon.minOrder} required (need ₹${coupon.minOrder - subtotal} more)`); return; }
    appliedCoupon = code;
    const savedAmt = getCouponDiscount(code, subtotal);
    document.getElementById('applied-coupon').classList.remove('hidden');
    document.getElementById('coupon-input-area').classList.add('hidden');
    document.getElementById('coupon-name').innerText = `'${code}' Applied — ${coupon.desc}`;
    document.getElementById('coupon-savings').innerText = `You saved ₹${savedAmt} 🎉`;
    calculateBill();
    showToast(`Coupon ${code} applied! Saved ₹${savedAmt} 🎉`);
}

function removeCoupon() {
    appliedCoupon = null;
    document.getElementById('applied-coupon').classList.add('hidden');
    document.getElementById('coupon-input-area').classList.remove('hidden');
    document.getElementById('coupon-code').value = '';
    calculateBill();
    showToast('Coupon removed');
}

// ===== DELIVERY FEE OVERRIDE =====
function editDeliveryFee() {
    const amount = prompt("Enter delivery fee amount (₹):", customDeliveryFee !== null ? customDeliveryFee : "");
    if (amount === null) return; // Cancelled
    
    if (amount === "" || isNaN(amount)) {
        customDeliveryFee = null; // Reset to auto
        showToast('Delivery fee reset to automatic calculation');
    } else {
        customDeliveryFee = parseFloat(amount);
        showToast(`Delivery fee set to ₹${customDeliveryFee}`);
    }
    calculateBill();
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

    // Distance slider removed — real GPS distance used

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

// ===== CUSTOMER INFO + VALIDATION =====
function validateAndPlaceOrder() {
    const name  = (document.getElementById('cust-name')  || {value:''}).value.trim();
    const phone = (document.getElementById('cust-phone') || {value:''}).value.trim();
    const email = (document.getElementById('cust-email') || {value:''}).value.trim();
    const addrEl = document.getElementById('current-address');
    const addr  = addrEl ? addrEl.innerText.trim() : '';

    if (!name)  { showToast('Please enter your name'); document.getElementById('cust-name').focus(); return; }
    if (!phone || phone.length !== 10 || isNaN(phone)) { showToast('Please enter a valid 10-digit mobile number'); document.getElementById('cust-phone').focus(); return; }
    if (!addr || addr.startsWith('📍 Tap')) { showToast('Please detect or enter your delivery address'); return; }
    if (currentDistance === null) { showToast('We need your location to calculate delivery. Please detect or enter address.'); return; }
    const shopStatus = getShopStatus();
    if (!shopStatus.open) { showToast(shopStatus.reason); return; }

    // Show confirmation modal
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = (appliedCoupon && typeof SECRET_COUPONS !== 'undefined' && SECRET_COUPONS[appliedCoupon] && subtotal >= SECRET_COUPONS[appliedCoupon].minOrder) ? getCouponDiscount(appliedCoupon, subtotal) : 0;
    const distanceCharge = Math.round(currentDistance * 10);
    const delivery = (subtotal >= 250) ? distanceCharge : (40 + distanceCharge);
    const total = subtotal - discount + delivery;

    const summaryEl = document.getElementById('confirm-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>👤 Name</span><strong>${name}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>📱 Mobile</span><strong>${phone}</strong></div>
            ${email ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>📧 Email</span><strong style="font-size:11px;">${email}</strong></div>` : ''}
            <div style="border-top:1px dashed #ddd;margin:8px 0;"></div>
            <div style="margin-bottom:4px;"><span>📍 Delivery Address</span><br><strong style="font-size:12px;">${addr}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>📏 Distance</span><strong>${currentDistance.toFixed(1)} km</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>🛵 Delivery Fee</span><strong>${delivery === 0 ? 'FREE 🎉' : '₹' + delivery}</strong></div>
            <div style="border-top:1px dashed #ddd;margin:8px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:15px;"><span>💰 Total</span><strong>₹${total}</strong></div>`;
    }
    document.getElementById('order-confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('order-confirm-modal').classList.add('hidden');
}

function confirmAndPlaceOrder() {
    document.getElementById('order-confirm-modal').classList.add('hidden');
    
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    
    if (paymentMethod === 'online') {
        openPaymentModal();
    } else {
        placeOrder();
    }
}

// ===== PAYMENT MODAL LOGIC =====
let paymentTimer = null;

function openPaymentModal() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = (appliedCoupon && typeof SECRET_COUPONS !== 'undefined' && SECRET_COUPONS[appliedCoupon] && subtotal >= SECRET_COUPONS[appliedCoupon].minOrder) ? getCouponDiscount(appliedCoupon, subtotal) : 0;
    const distanceCharge = Math.round(currentDistance * 10);
    const delivery = (subtotal >= 250) ? distanceCharge : (40 + distanceCharge);
    const total = subtotal - discount + delivery;

    document.getElementById('payment-amount').innerText = total;
    // verify-amount removed (not in HTML)
    document.getElementById('payment-txid').innerText = '#TX-' + Math.floor(100000 + Math.random() * 900000);
    
    // Generate QR Code using Google Chart API or QRServer
    // UPI Format: upi://pay?pa=neeraj.rajput30@axl&pn=RoopSingh&am=TOTAL&cu=INR
    const upiLink = `upi://pay?pa=neeraj.rajput30@axl&pn=Neeraj%20Rajput&am=${total}&cu=INR&tn=Order%20from%20Roop%20Singh`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;
    
    // Update QR image (id="main-qr-img" since we redesigned the modal)
    const mainQr = document.getElementById('main-qr-img');
    if (mainQr) mainQr.src = qrUrl;

    const modal = document.getElementById('payment-modal');
    modal.classList.remove('hidden');
    modal.style.zIndex = '9998';
    startPaymentTimer(300); // 5 minutes
    refreshIcons();
}

function closePaymentModal() {
    if (confirm("Are you sure you want to cancel the payment? Your order will not be placed.")) {
        document.getElementById('payment-modal').classList.add('hidden');
        clearInterval(paymentTimer);
    }
}

function startPaymentTimer(duration) {
    let timer = duration, minutes, seconds;
    clearInterval(paymentTimer);
    paymentTimer = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        document.getElementById('p-timer').textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(paymentTimer);
            alert("Payment session expired. Please try again.");
            document.getElementById('payment-modal').classList.add('hidden');
        }
    }, 1000);
}

function payViaApp(app) {
    const amount = document.getElementById('payment-amount').innerText;
    const upiLink = `upi://pay?pa=neeraj.rajput30@axl&pn=Neeraj%20Rajput&am=${amount}&cu=INR&tn=Order%20Roop%20Singh%20Tikki%20Chaat`;
    
    // Attempt to open the UPI app
    window.location.href = upiLink;
    
    showToast(`Opening ${app.toUpperCase()}...`);
}

function simulateNetBanking(bank) {
    showToast(`Redirecting to ${bank} Secure Login...`);
    setTimeout(() => {
        if (confirm(`Simulate successful payment from ${bank}?`)) {
            verifyAndPlaceOrder();
        }
    }, 1500);
}

function showAllBanks() {
    alert("This feature will be available soon with more bank integrations.");
}

// ===== PAYMENT PROOF HELPERS =====
let paymentScreenshotData = null;  // stores base64 of screenshot

function onProofInput() {
    const txnId = document.getElementById('upi-txn-id').value.trim();
    const hasScreenshot = paymentScreenshotData !== null;
    const btn = document.getElementById('confirm-payment-btn');
    if (!btn) return;
    if (txnId.length >= 8 || hasScreenshot) {
        btn.disabled = false;
        btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 4px 14px rgba(34,197,94,0.4)';
        btn.innerText = '✅ Confirm & Place Order';
    } else {
        btn.disabled = true;
        btn.style.background = '#ccc';
        btn.style.cursor = 'not-allowed';
        btn.style.boxShadow = 'none';
        btn.innerText = '🔒 Enter Proof to Confirm Order';
    }
}

function onScreenshotSelected(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        paymentScreenshotData = e.target.result;
        document.getElementById('screenshot-preview').style.display = 'block';
        document.getElementById('screenshot-img').src = e.target.result;
        document.getElementById('screenshot-label').style.borderColor = '#22c55e';
        document.getElementById('screenshot-label-text').innerText = file.name;
        document.getElementById('screenshot-label-text').style.color = '#15803d';
        onProofInput(); // re-check button state
    };
    reader.readAsDataURL(file);
}

function removeScreenshot() {
    paymentScreenshotData = null;
    window._paymentScreenshotData = null;
    document.getElementById('payment-screenshot').value = '';
    document.getElementById('screenshot-preview').style.display = 'none';
    document.getElementById('screenshot-label').style.borderColor = '#d97706';
    document.getElementById('screenshot-label-text').innerText = 'Tap to Upload Screenshot';
    document.getElementById('screenshot-label-text').style.color = '#d97706';
    onProofInput();
}

function verifyAndPlaceOrder() {
    const txnId = document.getElementById('upi-txn-id')?.value.trim() || '';
    const hasScreenshot = paymentScreenshotData !== null;

    // Block if no proof given
    if (txnId.length < 8 && !hasScreenshot) {
        showToast('⚠️ Please enter UPI Transaction ID or upload payment screenshot!');
        return;
    }

    // Store proof for WhatsApp message
    window._paymentProof = txnId ? `UPI Txn ID: ${txnId}` : 'Screenshot uploaded';
    // Store screenshot for WhatsApp sharing
    window._paymentScreenshotData = paymentScreenshotData || null;

    const overlay = document.getElementById('payment-success-overlay');
    if (overlay) overlay.classList.remove('hidden');
    refreshIcons();
    clearInterval(paymentTimer);

    setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
        document.getElementById('payment-modal').classList.add('hidden');
        placeOrder();
    }, 2000);
}



// ===== SHARE SCREENSHOT TO WHATSAPP =====
function sendScreenshotToWhatsApp(base64Data) {
    if (!base64Data) return;

    // Try Web Share API first (works on Android Chrome/mobile)
    if (navigator.share && navigator.canShare) {
        // Convert base64 to blob
        const byteString = atob(base64Data.split(',')[1]);
        const mimeType = base64Data.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: mimeType });
        const file = new File([blob], 'payment_screenshot.jpg', { type: mimeType });

        if (navigator.canShare({ files: [file] })) {
            navigator.share({
                files: [file],
                title: 'Payment Screenshot',
                text: `Payment proof for order from Roop Singh Tikki Chaat Corner`
            }).catch(() => fallbackScreenshotShare(base64Data));
            return;
        }
    }
    // Fallback: open image in new tab with instructions
    fallbackScreenshotShare(base64Data);
}

function fallbackScreenshotShare(base64Data) {
    // Open screenshot in new tab — user can long-press and share to WhatsApp
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(`
            <html><head><title>Payment Screenshot</title>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <style>
                body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;}
                img{max-width:100%;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.5);}
                .msg{color:white;text-align:center;padding:16px;font-size:14px;font-weight:700;line-height:1.6;}
                .btn{margin-top:16px;padding:12px 24px;background:#25D366;color:white;border:none;border-radius:50px;font-size:14px;font-weight:900;cursor:pointer;}
            </style></head>
            <body>
                <div class="msg">📸 Payment Screenshot<br><small style="opacity:0.6;font-weight:400;">Long press on image → Share → WhatsApp</small></div>
                <img src="${base64Data}" alt="Payment Screenshot">
                <div class="msg" style="font-size:12px;opacity:0.7;">Share this screenshot to Neeraj Bhaiya on WhatsApp as payment proof</div>
            </body></html>
        `);
        win.document.close();
    }
}

// ===== PLACE ORDER =====
function placeOrder() {
    if (cart.length === 0) { showToast('Your cart is empty!'); return; }
    // Reset payment proof state for next order
    paymentScreenshotData = null;

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
    localStorage.setItem('lastPaymentMethod', document.querySelector('input[name="payment"]:checked')?.value || 'online');
    setOrderActive(true);
    // Mark coupon as used (single-use system)
    if (appliedCoupon) { markCouponUsed(appliedCoupon); }

    // Calculate final total
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = (appliedCoupon && typeof SECRET_COUPONS !== 'undefined' && SECRET_COUPONS[appliedCoupon] && subtotal >= SECRET_COUPONS[appliedCoupon].minOrder) ? getCouponDiscount(appliedCoupon, subtotal) : 0;
    const delivery = (currentDistance !== null)
        ? (subtotal >= 250 && currentDistance <= 1 ? 0
           : currentDistance <= 1 ? 26
           : currentDistance <= 3 ? 49 : 79)
        : 0;
    const total = subtotal - discount + delivery;

    // Capture customer info
    const custName  = (document.getElementById('cust-name')  || {value:''}).value.trim();
    const custPhone = (document.getElementById('cust-phone') || {value:''}).value.trim();
    const custEmail = (document.getElementById('cust-email') || {value:''}).value.trim();

    // Add to history (addr already contains full structured address from modal)
    orderHistory.unshift({
        id: orderId,
        date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: orderItems,
        total,
        status: 'In Progress',
        customer: { name: custName, phone: custPhone, email: custEmail, address: addr }
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
    localStorage.setItem('lastOrderTotal', total);

    const trackOrderId = document.getElementById('track-order-id');
    if (trackOrderId) trackOrderId.innerText = orderId;

    const placedTime = document.getElementById('placed-time');
    if (placedTime) placedTime.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Confetti
    if (typeof confetti !== 'undefined') {
        confetti({ particleCount: 160, spread: 75, origin: { y: 0.6 }, colors: ['#f7cb46', '#27ae60', '#e63946'] });
    }

    // Build WhatsApp message for OWNER
    // addr already contains the full structured address (house + street + area + city + PIN)
    const itemLines = orderItems.map(i => `  • ${i.name}${i.option ? ' (' + i.option + ')' : ''}${i.note ? ' [' + i.note + ']' : ''} x${i.quantity} = ₹${i.price * i.quantity}`).join('%0A');
    const etaWA = getEstimatedDelivery(currentDistance);
    // Build Google Maps link from customer address
    let gmapsLink = '';
    if (userLat && userLng) {
        gmapsLink = `%0A📍 *Map:* https://www.google.com/maps?q=${userLat},${userLng}`;
    } else {
        const addrEncoded = encodeURIComponent(addr + ', Lucknow');
        gmapsLink = `%0A📍 *Map:* https://www.google.com/maps/search/${addrEncoded}`;
    }

    const waOwnerMsg = `🛵 *New Order Alert!*%0A%0A*Order ID:* ${orderId}%0A*Customer:* ${custName}%0A*Mobile:* ${custPhone}${custEmail ? '%0A*Email:* ' + custEmail : ''}%0A%0A*Delivery Address:*%0A${addr}${gmapsLink}%0A*Distance:* ${currentDistance !== null ? currentDistance.toFixed(1) + ' km' : 'N/A'}%0A*ETA:* ${etaWA}%0A%0A*Items:*%0A${itemLines}%0A%0A*Subtotal:* ₹${subtotal}${discount > 0 ? '%0A*Discount:* -₹' + discount : ''}%0A*Delivery:* ${delivery === 0 ? 'FREE' : '₹' + delivery}%0A*Total:* ₹${total}%0A%0A*Payment:* ${document.querySelector('input[name=payment]:checked')?.value === 'cod' ? 'Cash on Delivery' : 'Online Payment'}${window._paymentProof ? '%0A*Payment Proof:* ' + window._paymentProof : ''}`;

    // Store for success screen share button
    window._lastOrderWAMsg = waOwnerMsg;
    window._lastOrderId = orderId;
    window._lastOrderTotal = total;

    // Auto-open WhatsApp for owner notification
    setTimeout(() => {
        // Step 1: Send text order details to WhatsApp
        window.open(`https://wa.me/${SHOP_WHATSAPP}?text=${waOwnerMsg}`, '_blank');

        // Step 2: If screenshot exists, share it separately after a delay
        if (window._paymentScreenshotData) {
            setTimeout(() => {
                sendScreenshotToWhatsApp(window._paymentScreenshotData);
            }, 2500);
        }
    }, 1500);

    // Update estimated delivery on success screen
    const etaSuccessEl = document.getElementById('success-eta');
    if (etaSuccessEl) etaSuccessEl.innerText = getEstimatedDelivery(currentDistance);

    // Clear cart and go to success
    setTimeout(() => {
        cart = [];
        appliedCoupon = null;
        updateCartUI();
        showScreen('success');
        simulateTrackingProgress();
    }, 1200);
}

// ===== SHARE ORDER ON WHATSAPP (customer) =====
function shareOrderOnWhatsApp() {
    const msg = window._lastOrderWAMsg || '';
    if (msg) {
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    } else {
        showToast('Order details not available');
    }
}

// ===== TRACKING =====
function startTracking() {
    showScreen('tracking');
    // Always run simulation logic to update checkpoints correctly
    simulateTrackingProgress();
    showCodPanelIfNeeded();
}
// ===== COD PAYMENT PANEL (shown on tracking screen for cash orders) =====
function showCodPanelIfNeeded() {
    const payMethod = localStorage.getItem('lastPaymentMethod') || 'online';
    const panel = document.getElementById('cod-payment-panel');
    if (!panel) return;
    if (payMethod === 'cod') {
        panel.style.display = 'block';
        const total = localStorage.getItem('lastOrderTotal') || '0';
        const amtEl = document.getElementById('cod-amount');
        const verifyEl = document.getElementById('cod-verify-amt');
        if (amtEl) amtEl.innerText = total;
        if (verifyEl) verifyEl.innerText = total;
        // Generate QR for COD online payment option
        // QR is pre-rendered in HTML with neeraj.rajput30@axl — just update amount display
        const upiLink = `upi://pay?pa=neeraj.rajput30@axl&pn=Neeraj%20Rajput&am=${total}&cu=INR&tn=COD%20Order%20Roop%20Singh%20Tikki%20Chaat`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;
        const qrEl = document.getElementById('cod-qr');
        if (qrEl) qrEl.innerHTML = `<img src="${qrUrl}" style="width:100%;height:100%;border-radius:8px;" alt="Scan to Pay">`;
    } else {
        panel.style.display = 'none';
    }
}

function codPayOnline() {
    const panel = document.getElementById('cod-online-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function codPayOnDelivery() {
    showToast('✅ Pay on delivery confirmed! Keep exact change ready. 💵');
    const panel = document.getElementById('cod-online-panel');
    if (panel) panel.style.display = 'none';
}

function codPayViaApp(app) {
    const amount = localStorage.getItem('lastOrderTotal') || '0';
    const upiLink = `upi://pay?pa=neeraj.rajput30@axl&pn=Neeraj%20Rajput&am=${amount}&cu=INR&tn=Order%20Roop%20Singh%20Tikki%20Chaat`;
    window.location.href = upiLink;
    showToast(`Opening ${app.toUpperCase()}...`);
}

function codVerifyPayment() {
    showToast('🎉 Payment received! Thank you!');
    const panel = document.getElementById('cod-payment-panel');
    if (panel) panel.style.display = 'none';
    localStorage.setItem('lastPaymentMethod', 'online'); // mark as paid
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

    const lastTotal = localStorage.getItem('lastOrderTotal');
    if (totalVal && lastTotal) totalVal.innerText = `₹${lastTotal}`;
    else if (totalVal) totalVal.innerText = `₹${total}`;
    refreshIcons();
}

let trackingInterval = null;

function simulateTrackingProgress() {
    const stepIds = ['step-placed', 'step-preparing', 'step-onway', 'step-delivered'];
    const steps   = stepIds.map(id => document.getElementById(id)).filter(Boolean);
    
    if (trackingInterval) clearInterval(trackingInterval);
    
    // Get actual ETA in minutes
    const etaText = document.getElementById('success-eta') ? document.getElementById('success-eta').innerText : "20 mins";
    const etaMinutes = parseInt(etaText) || 20;
    const totalMs = etaMinutes * 60 * 1000;

    // Reset steps
    steps.forEach((s, i) => {
        s.classList.remove('active', 'in-progress');
        const ic = s.querySelector('.step-icon');
        if (i === 0) {
            s.classList.add('active');
            if (ic) ic.innerHTML = '<i data-lucide="check"></i>';
        } else if (ic) ic.innerHTML = '';
    });
    refreshIcons();

    // Logic to update steps based on elapsed time
    const startTimestamp = parseInt(localStorage.getItem('orderTimestamp')) || Date.now();
    
    function updateSteps() {
        const elapsed = Date.now() - startTimestamp;
        const remainingMs = Math.max(totalMs - elapsed, 0);
        const remainingMins = Math.ceil(remainingMs / 60000);
        const progress = Math.min(elapsed / totalMs, 1);
        
        // Update ETA text live
        const etaTextEl = document.getElementById('tracking-eta-text');
        if (etaTextEl) {
            if (progress >= 1.0) etaTextEl.innerText = "Order Delivered!";
            else etaTextEl.innerText = `Arriving in ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`;
        }

        let currentStep = 0;
        if (progress >= 1.0) currentStep = 3;      // Delivered
        else if (progress >= 0.6) currentStep = 2; // On the way
        else if (progress >= 0.1) currentStep = 1; // Preparing (started earlier)
        else currentStep = 0;                     // Placed

        steps.forEach((s, i) => {
            s.classList.remove('active', 'in-progress');
            const ic = s.querySelector('.step-icon');
            if (i < currentStep) {
                s.classList.add('active');
                if (ic) ic.innerHTML = '<i data-lucide="check"></i>';
            } else if (i === currentStep) {
                if (progress >= 1.0) {
                    s.classList.add('active');
                    if (ic) ic.innerHTML = '<i data-lucide="check"></i>';
                } else {
                    s.classList.add('in-progress');
                }
            }
        });

        // Move delivery icon
        const icon = document.getElementById('delivery-icon');
        if (icon) {
            const positions = [
                { left: '45%', top: '40%' },
                { left: '50%', top: '38%' },
                { left: '58%', top: '50%' },
                { left: '65%', top: '45%' }
            ];
            const pos = positions[currentStep] || positions[positions.length - 1];
            icon.style.left = pos.left;
            icon.style.top  = pos.top;
        }

        if (progress >= 1.0) {
            // Final icon refresh to show all checkmarks
            refreshIcons();
            setOrderActive(false);
            if (orderHistory.length > 0 && orderHistory[0].status !== 'Delivered') {
                orderHistory[0].status = 'Delivered';
                showToast('Order delivered! Enjoy your meal 😊');
            }
            return true; // Finished
        }
        refreshIcons();
        return false;
    }

    // Initial run
    updateSteps();
    
    trackingInterval = setInterval(() => {
        if (updateSteps()) clearInterval(trackingInterval);
    }, 5000);
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
function openZomatoStall() {
    // Try Zomato app deep link first (works on mobile), fallback to browser
    const appLink = 'zomato://restaurant/roop-singh-tikki-chaat-center-alambagh';
    const webLink = 'https://www.zomato.com/lucknow/roop-singh-tikki-chaat-center-alambagh';
    
    // On mobile: attempt app deep link, fallback to web after 1.5s
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
        const start = Date.now();
        window.location.href = appLink;
        setTimeout(() => {
            if (Date.now() - start < 2000) {
                window.open(webLink, '_blank');
            }
        }, 1500);
    } else {
        window.open(webLink, '_blank');
    }
}

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
// ===== INIT =====
// (defined below)
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
