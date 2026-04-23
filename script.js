'use strict';
// ══════════════════════════════════════════
//  SANDRA ENVÍA — script.js
//  Lee productos y categorías desde Firebase
// ══════════════════════════════════════════
import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs,
         getDoc, doc as fsDoc }                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig }                         from './firebase.config.js';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Convert any Drive URL to the embeddable thumbnail format
function driveImgUrl(url) {
  if (!url) return null;
  // ?id=FILE_ID  (old export/open links)
  let m = url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
  // /file/d/FILE_ID/  (standard share links)
  m = url.match(/\/file\/d\/([^/?]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
  return url;
}

const fmtARS = n => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : null;

let WA_NUM  = '5491121802212';
let WA_BASE = `https://wa.me/${WA_NUM}?text=Hola!%20Quiero%20consultar%20por%20`;

const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

// ── Settings ────────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(fsDoc(db, 'settings', 'main'));
    if (snap.exists()) applySettings(snap.data());
  } catch (_) {}
}

function applySettings(s) {
  if (!s) return;
  window._siteSettings = s;

  // Update carriers in the shipping section
  const carriersEl = document.getElementById('carriersGrid');
  if (carriersEl && s.carriers?.length) {
    const active = s.carriers.filter(c => c.active !== false && c.name);
    if (active.length) {
      carriersEl.innerHTML = active.map(c => `
        <div class="carrier reveal" role="listitem">
          <div class="carrier-badge">${c.name.replace(/\s+.*/, '').slice(0,3).toUpperCase()}</div>
          <span class="carrier-name">${c.name}</span>
          ${c.price       ? `<span class="carrier-price">${fmtARS(c.price)}</span>` : ''}
          ${c.businessDays? `<span class="carrier-days">~${c.businessDays} días hábiles</span>` : ''}
        </div>`).join('');
    }
  }

  // WhatsApp number — update module vars and all .wa-link hrefs
  if (s.waNumber) {
    WA_NUM  = s.waNumber;
    WA_BASE = `https://wa.me/${WA_NUM}?text=Hola!%20Quiero%20consultar%20por%20`;
    document.querySelectorAll('a.wa-link').forEach(a => {
      a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${s.waNumber}`);
    });
  }
  if (s.waMessage) {
    document.querySelectorAll('a.wa-link').forEach(a => {
      const url = new URL(a.href);
      url.searchParams.set('text', s.waMessage);
      a.href = url.toString();
    });
  }

  // Phone
  if (s.phone) {
    const tel = s.phone.replace(/\s/g, '');
    const cp = document.getElementById('contactPhone');
    if (cp) { cp.textContent = s.phone; cp.href = `tel:${tel}`; }
    const fp = document.getElementById('footerPhone');
    if (fp) { fp.textContent = s.phone; fp.href = `tel:${tel}`; }
  }

  // Min order in ARS
  if (s.minOrderARS) {
    const label = fmtARS(s.minOrderARS);
    const mo = document.getElementById('heroMinOrder');
    if (mo) mo.textContent = label;
    const co = document.getElementById('catalogMinOrder');
    if (co) co.textContent = label;
  }

  // Hours
  const ch = document.getElementById('contactHours');
  if (ch && s.hours) ch.innerHTML = `💬 ${s.hours}`;

  // Social links
  const fb = document.getElementById('socialFb');
  if (fb && s.facebook) fb.href = s.facebook;
  const ig = document.getElementById('socialIg');
  if (ig && s.instagram) ig.href = s.instagram;
  const igh = document.getElementById('igHandle');
  if (igh && s.instagramHandle) igh.textContent = s.instagramHandle;
  const tt = document.getElementById('socialTt');
  if (tt && s.tiktok) tt.href = s.tiktok;
  const tth = document.getElementById('ttHandle');
  if (tth && s.tiktokHandle) tth.textContent = s.tiktokHandle;

  // Social logos
  if (s.facebookLogoUrl) {
    const el = document.getElementById('fbLogoImg');
    if (el) el.src = driveImgUrl(s.facebookLogoUrl) || s.facebookLogoUrl;
  }
  const setSocialLogo = (spanId, url, alt) => {
    const el = document.getElementById(spanId);
    if (!el || !url) return;
    const src = driveImgUrl(url) || url;
    el.textContent = '';
    const img = document.createElement('img');
    img.src = src; img.alt = alt; img.className = 'social-custom-logo';
    el.appendChild(img);
    el.classList.add('has-logo');
  };
  setSocialLogo('igLogoArea', s.instagramLogoUrl, 'Instagram');
  setSocialLogo('ttLogoArea', s.tiktokLogoUrl,    'TikTok');

  // Logos
  if (s.logoUrl) {
    const lg = document.getElementById('heroLogo');
    if (lg) lg.src = s.logoUrl;
  }
}

// ── Load categories and products from Firestore ────────────
async function loadCatalog() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  try {
    const [catSnap, prodSnap, noticeSnap, refSnap] = await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'notices')),
      getDocs(collection(db, 'references')),
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
      attachCarouselAuto(card, `cat_${cat.id}`);
    });

    renderAllProducts(products, categories);

    const activeNotices = noticeSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(n => n.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const activeRefs = refSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    renderNotices(activeNotices);
    renderRefs(activeRefs);

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

  const grad  = cat.gradient ?? 'linear-gradient(135deg,#FF4D6D,#C9184A)';
  const emoji = cat.emoji ?? '👗';
  const cid   = `cat_${cat.id}`;

  const allImgs = catProducts.map(p => driveImgUrl(p.images?.[0])).filter(Boolean);
  window._carouselImages      = window._carouselImages ?? {};
  window._carouselImages[cid] = allImgs;

  let imgHtml;
  if (allImgs.length > 0) {
    imgHtml = `<img class="carousel-img" data-cid="${cid}" src="${allImgs[0]}" alt="${cat.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`;
  } else {
    imgHtml = `<span class="card-emoji">${emoji}</span><span class="card-label">Ver productos</span>`;
  }

  const carouselControls = allImgs.length > 1 ? `
    <button class="carousel-btn carousel-prev" onclick="carouselGo(event,'${cid}',-1)" aria-label="Anterior">‹</button>
    <button class="carousel-btn carousel-next" onclick="carouselGo(event,'${cid}',1)"  aria-label="Siguiente">›</button>
    <div class="carousel-dots">
      ${allImgs.map((_, i) => `<span class="carousel-dot${i===0?' active':''}" data-cid="${cid}" data-idx="${i}"></span>`).join('')}
    </div>
    <div class="carousel-bar" data-cid="${cid}"></div>` : '';

  const priceRange = getPriceRange(catProducts);
  const stockBadge = catProducts.length === 0
    ? '<span style="font-size:.7rem;color:rgba(255,255,255,.7);position:absolute;bottom:.5rem;left:50%;transform:translateX(-50%)">Consultá disponibilidad</span>'
    : '';

  card.innerHTML = `
    <div class="card-img card-img-carousel" style="background:${grad};position:relative;">
      ${imgHtml}${carouselControls}${stockBadge}
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
  const lo = Math.min(...mins), hi = Math.max(...mins);
  return lo === hi ? `${lo} u.` : `${lo} – ${hi} u.`;
}

// ── Build a single product card with carousel ──────────────
function buildProductCard(prod, index) {
  const cat    = window._categoryMap?.[prod.categoryId];
  const images = (prod.images ?? []).map(driveImgUrl).filter(Boolean);
  const grad   = cat?.gradient ?? 'linear-gradient(135deg,#FF4D6D,#C9184A)';
  const cid    = prod.id;

  window._carouselImages      = window._carouselImages ?? {};
  window._carouselImages[cid] = images;

  const firstImg = images[0];
  const imgHtml  = firstImg
    ? `<img class="carousel-img" data-cid="${cid}" src="${firstImg}" alt="${prod.name ?? ''}" loading="lazy">`
    : `<span class="card-emoji">${cat?.emoji ?? '👗'}</span>`;

  const carouselControls = images.length > 1 ? `
    <button class="carousel-btn carousel-prev" onclick="carouselGo(event,'${cid}',-1)" aria-label="Anterior">‹</button>
    <button class="carousel-btn carousel-next" onclick="carouselGo(event,'${cid}',1)"  aria-label="Siguiente">›</button>
    <div class="carousel-dots">
      ${images.map((_, i) => `<span class="carousel-dot${i===0?' active':''}" data-cid="${cid}" data-idx="${i}"></span>`).join('')}
    </div>
    <div class="carousel-bar" data-cid="${cid}"></div>` : '';

  const badge       = prod.inStock === false ? '<span class="prod-badge-out">Sin stock</span>' : '<span class="prod-badge-in">En stock</span>';
  const discPct     = prod.discount > 0 ? prod.discount : null;
  const discBadge   = discPct ? `<span class="prod-badge-discount">−${discPct}%</span>` : '';
  const bulkBadge   = (prod.bulkMinQty && prod.bulkPrice) ? `<span class="prod-badge-bulk">Mayor ×${prod.bulkMinQty}</span>` : '';
  const discPrice   = (prod.price && discPct) ? Math.round(prod.price * (1 - discPct / 100)) : null;
  const price       = prod.price
    ? `<p class="card-note">${discPrice
        ? `<s class="price-original">${fmtARS(prod.price)}</s> <strong class="price-discounted">${fmtARS(discPrice)}</strong>`
        : fmtARS(prod.price)}</p>`
    : '';
  const minOrder    = prod.minOrder ? `<p class="card-note">Mín. <strong>${prod.minOrder} u.</strong></p>` : '';
  const bulkNote    = (prod.bulkMinQty && prod.bulkPrice)
    ? `<p class="card-note card-note-bulk">Precio por mayor ×${prod.bulkMinQty}: <strong>${fmtARS(prod.bulkPrice)}</strong></p>`
    : '';

  const card = document.createElement('article');
  card.className = 'product-card';
  card.setAttribute('role', 'listitem');
  card.style.transitionDelay = `${index * 40}ms`;
  card.innerHTML = `
    <div class="card-img card-img-carousel" style="background:${grad}"
         ${images.length ? `onclick="openProductLightbox('${cid}')"` : ''}>
      ${imgHtml}${carouselControls}${badge}${discBadge}${bulkBadge}
    </div>
    <div class="card-body">
      <h3 class="card-name">${prod.name ?? '—'}</h3>
      ${cat ? `<p class="card-cat-tag">${cat.emoji ?? ''} ${cat.name}</p>` : ''}
      ${price}${minOrder}${bulkNote}
      <button class="btn btn-primary card-btn" onclick="addToCart('${prod.id}')"
              ${prod.inStock === false ? 'disabled' : ''}>
        🛒 Agregar al carrito
      </button>
    </div>`;
  return card;
}

// ── Render all individual products — 3D carousel ──────────────
function renderAllProducts(products, categories) {
  window._productMap  = Object.fromEntries(products.map(p => [p.id, p]));
  window._categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const carousel = document.getElementById('carousel3d');
  if (!carousel) return;
  if (!products.length) return;

  // Always fill 10 slots — cycle through products if fewer than 10
  const slots = Array.from({ length: 10 }, (_, i) => products[i % products.length]);

  carousel.innerHTML = slots.map(prod => {
    const cat      = window._categoryMap?.[prod.categoryId];
    const img      = driveImgUrl(prod.images?.[0]);
    const grad     = cat?.gradient ?? 'linear-gradient(135deg,#FF4D6D,#C9184A)';
    const discPct  = prod.discount > 0 ? prod.discount : null;
    const discPrice = (prod.price && discPct) ? Math.round(prod.price * (1 - discPct / 100)) : null;
    const effPrice  = discPrice ?? prod.price;

    const stockBadge = prod.inStock === false
      ? '<span class="prod-badge-out">Sin stock</span>'
      : '<span class="prod-badge-in">En stock</span>';
    const discBadge = discPct ? `<span class="prod-badge-discount">−${discPct}%</span>` : '';
    const bulkBadge = (prod.bulkMinQty && prod.bulkPrice)
      ? `<span class="prod-badge-bulk">Mayor ×${prod.bulkMinQty}</span>` : '';

    return `
      <div>
        <div class="prod-3d-img" style="background:${grad}">
          ${img ? `<img src="${img}" alt="${prod.name ?? ''}" loading="lazy">` : `<span class="card-emoji">${cat?.emoji ?? '👗'}</span>`}
          ${stockBadge}${discBadge}${bulkBadge}
        </div>
        <div class="prod-3d-body">
          <p class="prod-3d-name">${prod.name ?? '—'}</p>
          ${effPrice ? `<p class="prod-3d-price">${fmtARS(effPrice)}</p>` : ''}
          <button class="prod-3d-btn" onclick="addToCart('${prod.id}')"
                  ${prod.inStock === false ? 'disabled' : ''}>🛒 Agregar</button>
        </div>
      </div>`;
  }).join('');
}

window.openAllProductsModal = function() {
  // Sync search from the main-page input if present
  const mainInp = document.getElementById('carouselSearch');
  if (mainInp) modalSearch = mainInp.value;

  document.getElementById('catModalTitle').textContent = '👗 Todos los productos';
  renderModalControls();
  renderModalProducts();
  const overlay = document.getElementById('catModalOverlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
};

// ── All-products modal state ───────────────────────────────
let modalSearch   = '';
let modalCategory = '';
let modalPriceMin = '';
let modalPriceMax = '';
let modalDiscount = false;
let modalWholesale = false;
let modalSort    = 'alpha';
let modalSortDir = 1;

window.setModalSearch   = v => { modalSearch   = v; renderModalProducts(); };
window.onModalCategory  = v => { modalCategory = v; renderModalProducts(); };
window.onModalPriceMin  = v => { modalPriceMin = v; renderModalProducts(); };
window.onModalPriceMax  = v => { modalPriceMax = v; renderModalProducts(); };
window.onModalDiscount  = v => { modalDiscount = v; renderModalProducts(); };
window.onModalWholesale = v => { modalWholesale = v; renderModalProducts(); };
window.onModalSort = key => {
  if (modalSort === key) modalSortDir = -modalSortDir;
  else { modalSort = key; modalSortDir = key === 'discount' ? -1 : 1; }
  renderModalProducts();
};

function prodEffectivePrice(p) {
  if (p.price == null) return null;
  if (p.discount > 0) return Math.round(p.price * (1 - p.discount / 100));
  return p.price;
}

function renderModalControls() {
  const el = document.getElementById('catModalControls');
  if (!el) return;
  const cats = Object.values(window._categoryMap ?? {})
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const catOpts = cats.map(c =>
    `<option value="${c.id}" ${modalCategory === c.id ? 'selected' : ''}>${c.emoji ?? ''} ${c.name}</option>`
  ).join('');
  const SORT_LABELS = { alpha: 'A–Z', price: 'Precio', discount: 'Descuento', wholesale: 'Por mayor' };
  const sortBtns = Object.keys(SORT_LABELS).map(k => `
    <button class="msort-btn ${modalSort === k ? 'msort-active' : ''}" onclick="onModalSort('${k}')">
      ${SORT_LABELS[k]}${modalSort === k ? (modalSortDir === 1 ? ' ↑' : ' ↓') : ''}
    </button>`).join('');

  el.innerHTML = `
    <div class="mctrl-search">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="mctrl-search-input" type="search" placeholder="Buscar productos…"
             value="${modalSearch.replace(/"/g,'&quot;')}"
             oninput="setModalSearch(this.value)" autocomplete="off">
    </div>
    <div class="mctrl-filters">
      <select class="mctrl-select" onchange="onModalCategory(this.value)">
        <option value="">Todas las categorías</option>${catOpts}
      </select>
      <div class="mctrl-price">
        <input class="mctrl-price-input" type="number" min="0" placeholder="$ mín"
               value="${modalPriceMin}" oninput="onModalPriceMin(this.value)">
        <span>–</span>
        <input class="mctrl-price-input" type="number" min="0" placeholder="$ máx"
               value="${modalPriceMax}" oninput="onModalPriceMax(this.value)">
      </div>
      <label class="mctrl-check"><input type="checkbox" ${modalDiscount ? 'checked' : ''} onchange="onModalDiscount(this.checked)"> Con descuento</label>
      <label class="mctrl-check"><input type="checkbox" ${modalWholesale ? 'checked' : ''} onchange="onModalWholesale(this.checked)"> Precio por mayor</label>
    </div>
    <div class="mctrl-sort">
      <span class="mctrl-sort-label">Ordenar:</span>
      ${sortBtns}
    </div>`;
}

function renderModalProducts() {
  const searchWasFocused = document.activeElement?.classList.contains('mctrl-search-input');
  const allProds = Object.values(window._productMap ?? {});
  const q = modalSearch.toLowerCase().trim();

  let result = allProds.filter(p => {
    if (q && !p.name?.toLowerCase().includes(q)) return false;
    if (modalCategory && p.categoryId !== modalCategory) return false;
    const eff = prodEffectivePrice(p);
    if (modalPriceMin !== '' && eff != null && eff < parseFloat(modalPriceMin)) return false;
    if (modalPriceMax !== '' && eff != null && eff > parseFloat(modalPriceMax)) return false;
    if (modalDiscount  && !(p.discount > 0)) return false;
    if (modalWholesale && !(p.bulkMinQty && p.bulkPrice)) return false;
    return true;
  });

  result.sort((a, b) => {
    if (modalSort === 'alpha')
      return (a.name ?? '').localeCompare(b.name ?? '', 'es') * modalSortDir;
    if (modalSort === 'price')
      return ((prodEffectivePrice(a) ?? Infinity) - (prodEffectivePrice(b) ?? Infinity)) * modalSortDir;
    if (modalSort === 'discount')
      return ((a.discount ?? 0) - (b.discount ?? 0)) * modalSortDir;
    if (modalSort === 'wholesale')
      return ((a.bulkPrice ?? Infinity) - (b.bulkPrice ?? Infinity)) * modalSortDir;
    return 0;
  });

  // Re-render sort buttons (direction may have changed)
  renderModalControls();

  const grid = document.getElementById('catModalGrid');
  grid.innerHTML = '';
  if (!result.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);text-align:center;padding:2rem">Sin resultados${q ? ` para "<strong>${modalSearch}</strong>"` : ''}.</p>`;
    return;
  }
  result.forEach((prod, i) => {
    const card = buildProductCard(prod, i);
    card.classList.add('visible');
    grid.appendChild(card);
    attachCarouselAuto(card, prod.id);
  });

  // Restore search focus if it was active before re-render
  if (searchWasFocused) {
    const inp = document.querySelector('.mctrl-search-input');
    if (inp) { inp.focus(); inp.setSelectionRange(modalSearch.length, modalSearch.length); }
  }
}

// ── Category products modal ────────────────────────────────
window.openCategoryProducts = function(catId) {
  document.getElementById('catModalControls').innerHTML = '';
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
    prods.forEach((p, i) => {
      const card = buildProductCard(p, i);
      card.classList.add('visible');
      grid.appendChild(card);
      attachCarouselAuto(card, p.id);
    });
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
window._carouselImages = {};
window._carouselIdx    = {};
window._carouselTimers = {};

window.carouselGo = function(event, cid, dir) {
  event?.stopPropagation?.();
  const images = window._carouselImages?.[cid] ?? [];
  if (images.length <= 1) return;
  const next = ((window._carouselIdx[cid] ?? 0) + dir + images.length) % images.length;
  window._carouselIdx[cid] = next;
  document.querySelectorAll(`.carousel-img[data-cid="${cid}"]`).forEach(el => {
    let back = el.parentElement.querySelector('.carousel-img-back');
    if (!back) {
      back = document.createElement('img');
      back.className = 'carousel-img-back';
      el.parentElement.insertBefore(back, el);
    }
    back.src = images[next];
    el.style.opacity = '0';
    setTimeout(() => {
      el.style.transition = 'none';
      el.src = images[next];
      el.style.opacity = '1';
      void el.offsetWidth;
      el.style.transition = '';
    }, 750);
  });
  document.querySelectorAll(`.carousel-dot[data-cid="${cid}"]`).forEach((dot, i) => dot.classList.toggle('active', i === next));
  restartProgressBar(cid);
};

function restartProgressBar(cid) {
  document.querySelectorAll(`.carousel-bar[data-cid="${cid}"]`).forEach(bar => {
    bar.classList.remove('running');
    void bar.offsetWidth;
    bar.classList.add('running');
  });
}

function startCarouselAuto(cid) {
  if (window._carouselTimers[cid]) return;
  if ((window._carouselImages[cid] ?? []).length <= 1) return;
  restartProgressBar(cid);
  window._carouselTimers[cid] = setInterval(() => window.carouselGo(null, cid, 1), 3000);
}

function stopCarouselAuto(cid) {
  clearInterval(window._carouselTimers[cid]);
  delete window._carouselTimers[cid];
  document.querySelectorAll(`.carousel-bar[data-cid="${cid}"]`).forEach(bar => bar.classList.remove('running'));
}

function attachCarouselAuto(card, cid) {
  const imgDiv = card.querySelector('.card-img-carousel');
  if (!imgDiv) return;
  imgDiv.addEventListener('mouseenter', () => stopCarouselAuto(cid));
  imgDiv.addEventListener('mouseleave', () => startCarouselAuto(cid));
  startCarouselAuto(cid);
}

// ── Lightbox ───────────────────────────────────────────────
let _lbImages = [];
let _lbIndex  = 0;

window.openProductLightbox = function(cid) {
  event?.stopPropagation?.();
  const images = window._carouselImages?.[cid] ?? [];
  if (!images.length) return;
  const name = window._productMap?.[cid]?.name ?? '';
  _lbImages = images;
  _lbIndex  = window._carouselIdx?.[cid] ?? 0;
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
let selectedCarrierId = null;

window.selectCarrier = name => { selectedCarrierId = name; renderCart(); };

function addBusinessDays(date, n) {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}
function deliveryDateStr(businessDays) {
  return addBusinessDays(new Date(), businessDays)
    .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function loadCartFromStorage() {
  try { cart = JSON.parse(localStorage.getItem('se_cart') ?? '[]'); } catch { cart = []; }
}
function saveCartToStorage() {
  localStorage.setItem('se_cart', JSON.stringify(cart));
}

function effectivePrice(item) {
  if (item.price == null) return null;
  if (item.bulkMinQty && item.bulkPrice && item.qty >= item.bulkMinQty) return item.bulkPrice;
  if (item.discount > 0) return Math.round(item.price * (1 - item.discount / 100));
  return item.price;
}

window.addToCart = function(id) {
  const prod = window._productMap?.[id];
  if (!prod) return;
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    const minQty = prod.minOrder ?? 1;
    cart.push({
      id:           prod.id,
      name:         prod.name,
      price:        prod.price      ?? null,
      discount:     prod.discount   ?? null,
      bulkMinQty:   prod.bulkMinQty ?? null,
      bulkPrice:    prod.bulkPrice  ?? null,
      image:        driveImgUrl(prod.images?.[0]) ?? null,
      categoryName: window._categoryMap?.[prod.categoryId]?.name ?? null,
      minOrder:     minQty,
      qty:          minQty,
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
  const min = item.minOrder ?? 1;
  item.qty = Math.max(min, item.qty + delta);
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

  container.innerHTML = cart.map(item => {
    const eff    = effectivePrice(item);
    const min    = item.minOrder ?? 1;
    const isBulk = item.bulkMinQty && item.bulkPrice && item.qty >= item.bulkMinQty;
    const isDisc = item.discount > 0 && !isBulk;
    const priceHtml = eff != null
      ? `<p class="cart-item-price">
           ${fmtARS(eff)}
           ${isBulk ? `<span class="cart-price-note">precio por mayor</span>` : ''}
           ${isDisc ? `<span class="cart-price-note cart-price-note--discount">−${item.discount}%</span>` : ''}
         </p>`
      : `<p class="cart-item-price cart-item-price--consult">A consultar</p>`;
    const bulkHint = (item.bulkMinQty && item.bulkPrice && item.qty < item.bulkMinQty)
      ? `<p class="cart-bulk-hint">×${item.bulkMinQty} u. → ${fmtARS(item.bulkPrice)} c/u</p>`
      : '';
    return `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.image ? `<img src="${item.image}" alt="${item.name}" loading="lazy">` : `<span>👗</span>`}
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        ${item.categoryName ? `<p class="cart-item-cat">${item.categoryName}</p>` : ''}
        ${priceHtml}${bulkHint}
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateCartQty('${item.id}',-1)"
                ${item.qty <= min ? 'disabled' : ''} aria-label="Restar">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateCartQty('${item.id}',1)" aria-label="Sumar">+</button>
        <button class="cart-remove" onclick="removeFromCart('${item.id}')" aria-label="Eliminar">✕</button>
      </div>
    </div>`;
  }).join('');

  const totalUnits    = cart.reduce((s, i) => s + i.qty, 0);
  const totalItems    = cart.length;
  const allHavePrice  = cart.every(i => effectivePrice(i) != null);
  const prodTotal     = cart.reduce((s, i) => s + (effectivePrice(i) ?? 0) * i.qty, 0);

  const settings       = window._siteSettings ?? {};
  const minPurchaseARS = settings.minOrderARS ?? null;
  const activeCarriers = (settings.carriers ?? []).filter(c => c.active !== false && c.name);
  const carrier        = activeCarriers.find(c => c.name === selectedCarrierId) ?? null;
  const carrierPrice   = carrier?.price ?? 0;
  const grandTotal     = prodTotal + carrierPrice;
  const meetsMin       = !minPurchaseARS || !allHavePrice || prodTotal >= minPurchaseARS;
  const remaining      = minPurchaseARS && allHavePrice ? Math.max(0, minPurchaseARS - prodTotal) : 0;
  const minPct         = minPurchaseARS ? Math.min(100, (prodTotal / minPurchaseARS) * 100) : 100;

  const WA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

  footer.innerHTML = `
    <div class="cart-curva-note">
      <span>ℹ️</span>
      <p><strong>Talles y colores surtidos (por curva).</strong> En compras mayoristas los artículos vienen en una mezcla de talles y/o colores según stock. Si necesitás una combinación específica, consultanos antes de confirmar.</p>
    </div>

    ${activeCarriers.length ? `
    <div class="cart-shipping">
      <p class="cart-section-label">Modalidad de envío</p>
      <div class="cart-carriers">
        ${activeCarriers.map(c => `
          <label class="carrier-opt ${selectedCarrierId === c.name ? 'selected' : ''}">
            <input type="radio" name="carrier" value="${c.name}"
                   ${selectedCarrierId === c.name ? 'checked' : ''}
                   onchange="selectCarrier('${c.name}')">
            <div class="carrier-opt-body">
              <strong>${c.name}</strong>
              <span>${c.price ? fmtARS(c.price) : 'A consultar'} · ~${c.businessDays} días hábiles · est. ${deliveryDateStr(c.businessDays)}</span>
            </div>
          </label>`).join('')}
      </div>
    </div>` : ''}

    <div class="cart-totals">
      <div class="cart-total-row"><span>Productos</span><strong>${totalItems} artículo${totalItems !== 1 ? 's' : ''}</strong></div>
      <div class="cart-total-row"><span>Unidades</span><strong>${totalUnits} u.</strong></div>
      ${carrier ? `<div class="cart-total-row"><span>Envío (${carrier.name})</span><strong>${carrier.price ? fmtARS(carrier.price) : 'A confirmar'}</strong></div>` : ''}
      <div class="cart-total-row cart-total-price">
        <span>Total${carrier ? ' con envío' : ''}</span>
        <strong>${allHavePrice ? fmtARS(grandTotal) : 'A consultar'}</strong>
      </div>
    </div>

    ${minPurchaseARS ? `
    <div class="cart-min-purchase">
      <div class="cart-min-header">
        <span>Compra mínima: ${fmtARS(minPurchaseARS)}</span>
        <span class="cart-min-status ${meetsMin ? 'met' : ''}">${meetsMin ? '✓ Alcanzada' : `Faltan ${fmtARS(remaining)}`}</span>
      </div>
      <div class="cart-min-bar"><div class="cart-min-fill ${meetsMin ? 'met' : ''}" style="width:${minPct}%"></div></div>
    </div>` : ''}

    ${!meetsMin ? `<p class="cart-min-warning">Completá la compra mínima para enviar el pedido.</p>` : ''}

    <button class="btn btn-wa cart-wa-btn" id="cartSendWa" ${!meetsMin ? 'disabled' : ''}>
      ${WA_SVG} Enviar pedido por WhatsApp
    </button>
    <button class="cart-clear-btn" id="cartClear">Vaciar carrito</button>`;

  document.getElementById('cartSendWa').onclick = sendCartWhatsApp;
  document.getElementById('cartClear').onclick  = () => {
    cart = []; saveCartToStorage(); updateCartBadge(); renderCart();
  };
}

function sendCartWhatsApp() {
  const settings     = window._siteSettings ?? {};
  const carrier      = (settings.carriers ?? []).find(c => c.name === selectedCarrierId) ?? null;
  const allHavePrice = cart.every(i => effectivePrice(i) != null);
  const prodTotal    = cart.reduce((s, i) => s + (effectivePrice(i) ?? 0) * i.qty, 0);
  const carrierPrice = carrier?.price ?? 0;
  const grandTotal   = prodTotal + carrierPrice;
  const totalUnits   = cart.reduce((s, i) => s + i.qty, 0);

  const lines = cart.map(i => {
    const eff    = effectivePrice(i);
    const isBulk = i.bulkMinQty && i.bulkPrice && i.qty >= i.bulkMinQty;
    const isDisc = i.discount > 0 && !isBulk;
    let priceStr = eff != null ? ` — ${fmtARS(eff)} c/u` : '';
    if (isBulk) priceStr += ' (precio por mayor)';
    else if (isDisc) priceStr += ` (−${i.discount}%)`;
    return `• ${i.qty} u. de *${i.name}*${priceStr}`;
  });

  const totalBlock = allHavePrice
    ? `*Subtotal productos: ${fmtARS(prodTotal)}*`
      + (carrier ? `\n*Envío ${carrier.name}: ${carrier.price ? fmtARS(carrierPrice) : 'a confirmar'}*\n*Total: ${fmtARS(grandTotal)}*` : '')
    : `*Total: ${totalUnits} unidades (precios a confirmar)*`;

  const shipLine = carrier
    ? `📦 Envío: ${carrier.name} (~${carrier.businessDays} días hábiles, est. ${deliveryDateStr(carrier.businessDays)})`
    : '';

  const msg = [
    'Hola Sandra! Te hago el siguiente pedido 🛒',
    '',
    ...lines,
    '',
    totalBlock,
    shipLine,
    '',
    '_Nota: talles y colores surtidos por curva._',
    '',
    '¿Podés confirmar disponibilidad?',
  ].filter(l => l !== '').join('\n');

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

// ── Dark mode toggle ───────────────────────────────────────
function setupThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('se_theme', next);
    btn.setAttribute('aria-label', next === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro');
  });
}

// ── Avisos — carousel 2D ───────────────────────────────────
function renderNotices(notices) {
  const section = document.getElementById('avisos');
  const grid    = document.getElementById('avisosGrid');
  if (!section || !grid) return;
  if (!notices.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  const ICON = { info: 'ℹ️', promo: '🎉', warning: '⚠️' };
  const qty  = notices.length;

  const items = notices.map((n, i) => `
    <div class="item" style="--position: ${i + 1}">
      <div class="aviso-2d aviso-${n.type ?? 'info'}">
        <span class="aviso-2d-icon" aria-hidden="true">${ICON[n.type] ?? 'ℹ️'}</span>
        <div class="aviso-2d-content">
          <strong class="aviso-2d-title">${n.title}</strong>
          ${n.body ? `<p class="aviso-2d-body">${n.body}</p>` : ''}
        </div>
        ${n.image ? `<img src="${driveImgUrl(n.image)}" class="aviso-2d-img" alt="" loading="lazy">` : ''}
      </div>
    </div>`).join('');

  grid.innerHTML = `
    <div class="t-slider" style="--quantity:${qty}; --width:220px; --height:110px; --dur:24s">
      <div class="t-list">${items}</div>
    </div>`;
}

// ── Testimonios carousel (CSS-only infinite ticker) ────────
function renderRefs(refs) {
  const section = document.getElementById('testimonios');
  const grid    = document.getElementById('testimoniosGrid');
  if (!section || !grid) return;
  if (!refs.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  const qty   = refs.length;
  const items = refs.map((r, i) => `
    <div class="item" style="--position: ${i + 1}">
      <div class="t-screenshot">
        ${r.image
          ? `<img src="${driveImgUrl(r.image)}" alt="${r.title ?? 'Testimonio'}" loading="lazy">`
          : `<div class="t-screenshot-ph">💬</div>`}
        ${r.title ? `<p class="t-caption">${r.title}</p>` : ''}
      </div>
    </div>`).join('');

  grid.innerHTML = `
    <div class="t-slider" style="--quantity: ${qty}">
      <div class="t-list">${items}</div>
    </div>`;
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupCart();
  setupLightbox();
  loadSettings();
  loadCatalog();
  setupRevealObserver();
  setupHeader();
  setupMenu();
  setupSmoothScroll();
  setupFloating();
});
