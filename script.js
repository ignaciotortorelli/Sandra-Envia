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
  const firstImg = catProducts[0]?.images?.[0];
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
      <a href="${href}" target="_blank" rel="noopener noreferrer"
         class="btn btn-wa card-btn"
         aria-label="Consultar por WhatsApp sobre ${cat.name}">
        ${WA_ICON} Consultar por WhatsApp
      </a>
    </div>`;

  return card;
}

function getPriceRange(products) {
  const prices = products.map(p => p.price).filter(Boolean);
  if (!prices.length) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const fmt = n => '$' + Number(n).toLocaleString('es-AR');
  return min === max ? `Desde ${fmt(min)}` : `${fmt(min)} – ${fmt(max)}`;
}

function getMinOrder(products) {
  const mins = products.map(p => p.minOrder).filter(Boolean);
  if (!mins.length) return '[a confirmar]';
  return Math.min(...mins) + ' u.';
}

// ── Render all individual products ────────────────────────────
function renderAllProducts(products, categories) {
  const grid = document.getElementById('allProductsGrid');
  if (!grid) return;

  const sorted = [...products].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));

  if (!sorted.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;grid-column:1/-1">Próximamente.</p>';
    return;
  }

  grid.innerHTML = '';
  sorted.forEach((prod, i) => {
    const cat   = categories.find(c => c.id === prod.categoryId);
    const img   = prod.images?.[0];
    const grad  = cat?.gradient ?? 'linear-gradient(135deg,#FF4D6D,#C9184A)';
    const name  = encodeURIComponent(prod.name ?? '');
    const href  = `${WA_BASE}${name}%20de%20Sandra%20Envia`;

    const imgHtml = img
      ? `<img src="${img}" alt="${prod.name ?? ''}" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`
      : `<span class="card-emoji">${cat?.emoji ?? '👗'}</span>`;

    const price    = prod.price   ? `<p class="card-note">Desde <strong>$${Number(prod.price).toLocaleString('es-AR')}</strong></p>` : '';
    const minOrder = prod.minOrder ? `<p class="card-note">Mín. <strong>${prod.minOrder} u.</strong></p>` : '';
    const badge    = prod.inStock === false
      ? '<span class="prod-badge-out">Sin stock</span>'
      : '<span class="prod-badge-in">En stock</span>';

    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('role', 'listitem');
    card.style.transitionDelay = `${i * 40}ms`;
    card.innerHTML = `
      <div class="card-img" style="background:${grad};position:relative;">
        ${imgHtml}
        ${badge}
      </div>
      <div class="card-body">
        <h3 class="card-name">${prod.name ?? '—'}</h3>
        ${cat ? `<p class="card-cat-tag">${cat.emoji ?? ''} ${cat.name}</p>` : ''}
        ${price}${minOrder}
        <a href="${href}" target="_blank" rel="noopener noreferrer"
           class="btn btn-wa card-btn"
           aria-label="Consultar por WhatsApp sobre ${prod.name ?? 'este producto'}">
          ${WA_ICON} Consultar
        </a>
      </div>`;
    grid.appendChild(card);
  });
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

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  setupRevealObserver();
  setupHeader();
  setupMenu();
  setupSmoothScroll();
  setupFloating();
});
