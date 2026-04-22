'use strict';
// ══════════════════════════════════════════
//  SANDRA ENVÍA — script.js
//  Lee productos y categorías desde Firebase
// ══════════════════════════════════════════
import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig }                         from './firebase.config.js';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Convert any Drive URL to the embeddable thumbnail format
function driveImgUrl(url) {
  if (!url) return null;
  const m = url.match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url;
}

const fmtARS = n => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : null;

const WA_NUM  = '5491121802212';
const WA_BASE = `https://wa.me/${WA_NUM}?text=Hola!%20Quiero%20consultar%20por%20`;

const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

// ── Load categories and products from Firestore ────────────
async function loadCatalog() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  try {
    const [catSnap, prodSnap] = await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'products')),
    ]);

    const categories = catSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.active !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

    const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    grid.innerHTML = '';

    if (!categories.length) {
      renderFallbackCategories(grid);
      return;
    }

    categories.forEach((cat, i) => {
      const catProducts = products.filter(p => p.categoryId === cat.id && p.inStock !== false);
      const card = buildCategoryCard(cat, catProducts, i);
      grid.appendChild(card);
    });

    renderAllProducts(products, categories);
    setupRevealObserver();

  } catch (err) {
    console.error('Firebase error:', err);
    renderFallbackCategories(grid);
  }
}

// ── Build a category card ──────────────────────────────────
function buildCategoryCard(cat, catProducts, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.setAttribute('role', 'listitem');
  card.style.transitionDelay = `${index * 55}ms`;

  const name    = encodeURIComponent(cat.name);
  const href    = `${WA_BASE}${name}%20de%20Sandra%20Envia`;
  const grad    = cat.gradient ?? 'linear-gradient(135deg,#FF4D6D,#C9184A)';
  const emoji   = cat.emoji ?? '👗';

  // Show first product image if available, else gradient + emoji
  const firstImg = driveImgUrl(catProducts[0]?.images?.[0]);
  const imgHtml  = firstImg
    ? `<img src="${firstImg}" alt="${cat.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`
    : `<span class="card-emoji">${emoji}</span><span class="card-label">Ver productos</span>`;

  const priceRange = getPriceRange(catProducts);
  const stockBadge = catProducts.length === 0
    ? '<span style="font-size:.7rem;color:rgba(255,255,255,.7);position:absolute;bottom:.5rem;left:50%;transform:translateX(-50%)">Consultá disponibilidad</span>'
    : '';

  card.innerHTML = `
    <div class="card-img" style="background:${grad};position:relative;">
      ${imgHtml}
      ${stockBadge}
    </div>
    <div class="card-body">
      <h3 class="card-name">${cat.name}</h3>
      ${priceRange ? `<p class="card-note">${priceRange}</p>` : ''}
      <p class="card-note">Compra mínima: <strong>${getMinOrder(catProducts)}</strong></p>
      <button class="btn btn-primary card-btn" onclick="openCategoryProducts('${cat.id}')"
              aria-label="Ver productos de ${cat.name}">
        Ver Productos →
      </button>
    </div>`;

  return card;
}

function getPriceRange(products) {
  const prices = products.map(p => p.price).filter(Boolean);
  if (!prices.length) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `Desde ${fmtARS(min)}` : `${fmtARS(min)} – ${fmtARS(max)}`;
}

function getMinOrder(products) {
  const mins = products.map(p => p.minOrder).filter(Boolean);
  if (!mins.length) return '[a confirmar]';
  return Math.min(...mins) + ' u.';
}

// ── Build a single product card with carousel ──────────────
function buildProductCard(prod, index) {
  const cat    = window._categoryMap?.[prod.categoryId];
  const images = (prod.images ?? []).map(driveImgUrl).filter(Boolean);
  const grad   = cat?.gradient ?? 'linear-gradient(135deg,#FF4D6D,#C9184A)';

  window._productImages          = window._productImages ?? {};
  window._productImages[prod.id] = images;

  const firstImg = images[0];
  const imgHtml  = firstImg
    ? `<img class="carousel-img" data-pid="${prod.id}" src="${firstImg}" alt="${prod.name ?? ''}" loading="lazy">`
    : `<span class="card-emoji">${cat?.emoji ?? '👗'}</span>`;

  const carouselControls = images.length > 1 ? `
    <button class="carousel-btn carousel-prev" onclick="carouselGo(event,'${prod.id}',-1)" aria-label="Anterior">‹</button>
    <button class="carousel-btn carousel-next" onclick="carouselGo(event,'${prod.id}',1)"  aria-label="Siguiente">›</button>
    <div class="carousel-dots">
      ${images.map((_, i) => `<span class="carousel-dot${i===0?' active':''}" data-pid="${prod.id}" data-idx="${i}"></span>`).join('')}
    </div>` : '';

  const badge    = prod.inStock === false ? '<span class="prod-badge-out">Sin stock</span>' : '<span class="prod-badge-in">En stock</span>';
  const price    = prod.price    ? `<p class="card-note">${fmtARS(prod.price)}</p>` : '';
  const minOrder = prod.minOrder ? `<p class="card-note">Mín. <strong>${prod.minOrder} u.</strong></p>` : '';

  const card = document.createElement('article');
  card.className = 'product-card';
  card.setAttribute('role', 'listitem');
  card.style.transitionDelay = `${index * 40}ms`;
  card.innerHTML = `
    <div class="card-img card-img-carousel" style="background:${grad}">
      ${imgHtml}${carouselControls}${badge}
      ${images.length ? `<button class="carousel-zoom" onclick="openProductLightbox('${prod.id}')" aria-label="Ver fotos">🔍</button>` : ''}
    </div>
    <div class="card-body">
      <h3 class="card-name">${prod.name ?? '—'}</h3>
      ${cat ? `<p class="card-cat-tag">${cat.emoji ?? ''} ${cat.name}</p>` : ''}
      ${price}${minOrder}
      <button class="btn btn-primary card-btn" onclick="addToCart('${prod.id}')"
              ${prod.inStock === false ? 'disabled' : ''}>
        🛒 Agregar al carrito
      </button>
    </div>`;
  return card;
}

// ── Render all individual products ────────────────────────────
function renderAllProducts(products, categories) {
  window._productMap  = Object.fromEntries(products.map(p => [p.id, p]));
  window._categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const grid = document.getElementById('allProductsGrid');
  if (!grid) return;

  const sorted = [...products].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));

  if (!sorted.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;grid-column:1/-1">Próximamente.</p>';
    return;
  }
  grid.innerHTML = '';
  sorted.forEach((prod, i) => grid.appendChild(buildProductCard(prod, i)));
}

// ── Category products modal ────────────────────────────────
window.openCategoryProducts = function(catId) {
  const cat      = window._categoryMap?.[catId];
  const prods    = Object.values(window._productMap ?? {})
    .filter(p => p.categoryId === catId)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));

  document.getElementById('catModalTitle').textContent = `${cat?.emoji ?? ''} ${cat?.name ?? ''}`;
  const grid = document.getElementById('catModalGrid');
  grid.innerHTML = '';
  if (!prods.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;color:var(--text-muted);text-align:center;padding:2rem">No hay productos en esta categoría todavía.</p>';
  } else {
    prods.forEach((p, i) => grid.appendChild(buildProductCard(p, i)));
  }
  const overlay = document.getElementById('catModalOverlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
};

function closeCategoryModal() {
  const overlay = document.getElementById('catModalOverlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ── Carousel ───────────────────────────────────────────────
window._carouselIdx = {};
window.carouselGo = function(event, productId, dir) {
  event.stopPropagation();
  const images = window._productImages?.[productId] ?? [];
  if (images.length <= 1) return;
  const next = ((window._carouselIdx[productId] ?? 0) + dir + images.length) % images.length;
  window._carouselIdx[productId] = next;
  document.querySelectorAll(`.carousel-img[data-pid="${productId}"]`).forEach(el => { el.src = images[next]; });
  document.querySelectorAll(`.carousel-dot[data-pid="${productId}"]`).forEach((dot, i) => dot.classList.toggle('active', i === next));
};

// ── Lightbox ───────────────────────────────────────────────
let _lbImages = [];
let _lbIndex  = 0;

window.openProductLightbox = function(productId) {
  event?.stopPropagation?.();
  const images = window._productImages?.[productId] ?? [];
  if (!images.length) return;
  const name = window._productMap?.[productId]?.name ?? '';
  _lbImages = images;
  _lbIndex  = window._carouselIdx?.[productId] ?? 0;
  renderLightbox(name);
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function renderLightbox(title) {
  const img     = document.getElementById('lbImg');
  const counter = document.getElementById('lbCounter');
  const caption = document.getElementById('lbCaption');
  if (img)     img.src = _lbImages[_lbIndex] ?? '';
  if (counter) counter.textContent = `${_lbIndex + 1} / ${_lbImages.length}`;
  if (caption && title) caption.textContent = title;
  document.getElementById('lbPrev')?.classList.toggle('hidden', _lbImages.length <= 1);
  document.getElementById('lbNext')?.classList.toggle('hidden', _lbImages.length <= 1);
}

window.lbNext = function() { _lbIndex = (_lbIndex + 1) % _lbImages.length; renderLightbox(); };
window.lbPrev = function() { _lbIndex = (_lbIndex - 1 + _lbImages.length) % _lbImages.length; renderLightbox(); };

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function setupLightbox() {
  document.getElementById('lbClose')?.addEventListener('click', closeLightbox);
  document.getElementById('lightbox')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox')?.classList.contains('open')) return;
    if (e.key === 'ArrowRight') window.lbNext();
    if (e.key === 'ArrowLeft')  window.lbPrev();
    if (e.key === 'Escape')     closeLightbox();
  });
  document.getElementById('catModalClose')?.addEventListener('click', closeCategoryModal);
  document.getElementById('catModalOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeCategoryModal(); });
}

// ── Fallback categories (hardcoded) if Firebase not configured ──
const FALLBACK_CATEGORIES = [
  { name: 'Nuestros Combos',                emoji: '🎁', gradient: 'linear-gradient(135deg,#FF4D6D,#C9184A)',  msg: 'Nuestros%20Combos' },
  { name: 'Joginetas, Palazos y Calzas',    emoji: '🩳', gradient: 'linear-gradient(135deg,#FF85A1,#FF4D6D)',  msg: 'Joginetas%2C%20Palazos%20y%20Calzas' },
  { name: 'Remeras, Buzos y Sweaters Dama', emoji: '👚', gradient: 'linear-gradient(135deg,#FFB3C6,#F72585)',  msg: 'Remeras%2C%20Buzos%20y%20Sweaters%20Dama' },
  { name: 'Damas',                          emoji: '👗', gradient: 'linear-gradient(135deg,#F72585,#C9184A)',  msg: 'Damas' },
  { name: 'Hombres',                        emoji: '👔', gradient: 'linear-gradient(135deg,#1A1A2E,#2D2D44)',  msg: 'Hombres' },
  { name: 'Niños',                          emoji: '🧒', gradient: 'linear-gradient(135deg,#FFD166,#FF9A3C)',  msg: 'Ni%C3%B1os' },
  { name: 'Camperas y Chalecos',            emoji: '🧥', gradient: 'linear-gradient(135deg,#6B2D5E,#C9184A)',  msg: 'Camperas%20y%20Chalecos' },
  { name: 'Talles Especiales',              emoji: '✨', gradient: 'linear-gradient(135deg,#845EC2,#C9184A)',  msg: 'Talles%20Especiales' },
  { name: 'Camisetas de Argentina',         emoji: '🇦🇷', gradient: 'linear-gradient(135deg,#74B9FF,#0984E3)', msg: 'Camisetas%20de%20Argentina' },
  { name: 'Sastreros',                      emoji: '🎩', gradient: 'linear-gradient(135deg,#2D3436,#636E72)',  msg: 'Sastreros' },
];

function renderFallbackCategories(grid) {
  grid.innerHTML = '';
  FALLBACK_CATEGORIES.forEach((cat, i) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('role', 'listitem');
    card.style.transitionDelay = `${i * 55}ms`;

    const href = `${WA_BASE}${cat.msg}%20de%20Sandra%20Envia`;
    card.innerHTML = `
      <div class="card-img" style="background:${cat.gradient}">
        <span class="card-emoji">${cat.emoji}</span>
        <span class="card-label">Ver productos</span>
      </div>
      <div class="card-body">
        <h3 class="card-name">${cat.name}</h3>
        <p class="card-note">Compra mínima: <strong>[a confirmar]</strong></p>
        <a href="${href}" target="_blank" rel="noopener noreferrer"
           class="btn btn-wa card-btn"
           aria-label="Consultar por WhatsApp sobre ${cat.name}">
          ${WA_ICON} Consultar por WhatsApp
        </a>
      </div>`;
    grid.appendChild(card);
  });
  setupRevealObserver();
}

// ── Intersection observer ──────────────────────────────────
function setupRevealObserver() {
  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  );
  document.querySelectorAll('.reveal, .product-card').forEach(el => io.observe(el));
}

// ── Sticky header ──────────────────────────────────────────
function setupHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  window.addEventListener('scroll', () =>
    header.classList.toggle('scrolled', window.scrollY > 40), { passive: true });
}

// ── Mobile menu ────────────────────────────────────────────
function setupMenu() {
  const btn  = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;

  const close = () => {
    menu.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  btn.addEventListener('click', () => {
    const opening = !menu.classList.contains('open');
    menu.classList.toggle('open', opening);
    btn.classList.toggle('open', opening);
    btn.setAttribute('aria-expanded', String(opening));
    document.body.style.overflow = opening ? 'hidden' : '';
  });

  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// ── Smooth scroll ──────────────────────────────────────────
function setupSmoothScroll() {
  const headerH = () => parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--header-h') || '70'
  );
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.offsetTop - headerH(), behavior: 'smooth' });
    });
  });
}

// ── Floating WhatsApp ──────────────────────────────────────
function setupFloating() {
  const btn = document.getElementById('floatingWa');
  if (!btn) return;
  window.addEventListener('scroll', () =>
    btn.classList.toggle('visible', window.scrollY > 380), { passive: true });
}

// ══════════════════════════════════════════
//  CART
// ══════════════════════════════════════════
let cart = [];

function loadCartFromStorage() {
  try { cart = JSON.parse(localStorage.getItem('se_cart') ?? '[]'); } catch { cart = []; }
}
function saveCartToStorage() {
  localStorage.setItem('se_cart', JSON.stringify(cart));
}

window.addToCart = function(id) {
  const prod = window._productMap?.[id];
  if (!prod) return;
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id:           prod.id,
      name:         prod.name,
      price:        prod.price ?? null,
      image:        driveImgUrl(prod.images?.[0]) ?? null,
      categoryName: window._categoryMap?.[prod.categoryId]?.name ?? null,
      minOrder:     prod.minOrder ?? null,
      qty:          1,
    });
  }
  saveCartToStorage();
  updateCartBadge();
  renderCart();
  openCart();
};

window.removeFromCart = function(id) {
  cart = cart.filter(i => i.id !== id);
  saveCartToStorage();
  updateCartBadge();
  renderCart();
};

window.updateCartQty = function(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCartToStorage();
  updateCartBadge();
  renderCart();
};

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  badge.textContent = total > 0 ? total : '';
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
  document.getElementById('cartOverlay').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').setAttribute('aria-hidden', 'true');
  document.getElementById('cartOverlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const footer    = document.getElementById('cartFooter');
  if (!container || !footer) return;

  if (!cart.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <span>🛍️</span>
        <p>Tu carrito está vacío.</p>
        <p style="font-size:.8rem;color:var(--text-muted)">Agregá productos desde el catálogo.</p>
      </div>`;
    footer.innerHTML = '';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}" loading="lazy">`
          : `<span>👗</span>`}
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        ${item.categoryName ? `<p class="cart-item-cat">${item.categoryName}</p>` : ''}
        <p class="cart-item-price">${item.price != null ? fmtARS(item.price) : 'A consultar'}</p>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateCartQty('${item.id}',-1)" aria-label="Restar">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateCartQty('${item.id}',1)" aria-label="Sumar">+</button>
        <button class="cart-remove" onclick="removeFromCart('${item.id}')" aria-label="Eliminar">✕</button>
      </div>
    </div>`).join('');

  const totalUnits = cart.reduce((s, i) => s + i.qty, 0);
  const totalItems = cart.length;
  const allHavePrice = cart.every(i => i.price != null);
  const totalPrice  = cart.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  footer.innerHTML = `
    <div class="cart-totals">
      <div class="cart-total-row">
        <span>Productos</span>
        <strong>${totalItems} artículo${totalItems !== 1 ? 's' : ''}</strong>
      </div>
      <div class="cart-total-row">
        <span>Unidades</span>
        <strong>${totalUnits} u.</strong>
      </div>
      <div class="cart-total-row cart-total-price">
        <span>Total</span>
        <strong>${allHavePrice ? fmtARS(totalPrice) : 'A consultar'}</strong>
      </div>
    </div>
    <button class="btn btn-wa cart-wa-btn" id="cartSendWa">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Enviar pedido por WhatsApp
    </button>
    <button class="cart-clear-btn" id="cartClear">Vaciar carrito</button>`;

  document.getElementById('cartSendWa').onclick = sendCartWhatsApp;
  document.getElementById('cartClear').onclick  = () => {
    cart = [];
    saveCartToStorage();
    updateCartBadge();
    renderCart();
  };
}

function sendCartWhatsApp() {
  const lines = cart.map(i => {
    const price = i.price != null ? ` — ${fmtARS(i.price)} c/u` : '';
    return `• ${i.qty} u. de *${i.name}*${price}`;
  });

  const totalUnits = cart.reduce((s, i) => s + i.qty, 0);
  const allHavePrice = cart.every(i => i.price != null);
  const totalPrice   = cart.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  const totalLine    = allHavePrice ? `*Total: ${totalUnits} unidades · ${fmtARS(totalPrice)}*` : `*Total: ${totalUnits} unidades*`;

  const msg = [
    'Hola Sandra! Te hago el siguiente pedido 🛒',
    '',
    ...lines,
    '',
    totalLine,
    '',
    '¿Podés confirmar disponibilidad y coordinar el envío?',
  ].join('\n');

  window.open(`https://wa.me/${WA_NUM}?text=${encodeURIComponent(msg)}`, '_blank');
}

function setupCart() {
  loadCartFromStorage();
  updateCartBadge();
  renderCart();
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupCart();
  setupLightbox();
  loadCatalog();
  setupRevealObserver();
  setupHeader();
  setupMenu();
  setupSmoothScroll();
  setupFloating();
});
