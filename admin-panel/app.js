// ══════════════════════════════════════════
//  SANDRA ENVÍA — Admin Panel app.js
// ══════════════════════════════════════════
import { initializeApp }                                    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc,
         updateDoc, deleteDoc, doc, serverTimestamp }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, googleClientId }                   from '../firebase.config.js';
import { initGoogleAuth, requestToken, uploadFileToDrive,
         deleteFileFromDrive, driveFileIdFromUrl,
         getDriveUserInfo, signOutDrive }                   from './google-drive.js';

const fmtARS = n => n != null
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  : '—';

// ── Init Firebase ──────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── State ──────────────────────────────────────────────────
let categories = [];
let products   = [];
let pendingImages = []; // { file, url } during product form

let productSort  = { field: 'name', dir: 1 };
let categorySort = { field: 'order', dir: 1 };
let selectedProds = new Set();
let selectedCats  = new Set();

// ── Firebase status indicator ──────────────────────────────
function setStatus(state) {
  const dot  = document.getElementById('firebaseStatus')?.querySelector('.status-dot');
  const text = document.getElementById('firebaseStatus')?.querySelector('.status-text');
  if (!dot || !text) return;
  dot.className  = 'status-dot ' + (state === 'ok' ? 'connected' : state === 'error' ? 'error' : '');
  text.textContent = state === 'ok' ? 'Conectado' : state === 'error' ? 'Sin conexión' : 'Conectando…';
}

// ── Load data from Firestore ───────────────────────────────
async function loadData() {
  try {
    const [catSnap, prodSnap] = await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'products')),
    ]);
    categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                             .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    products   = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setStatus('ok');
  } catch (e) {
    console.error(e);
    setStatus('error');
    toast('Error al conectar con Firebase. Revisá la configuración.', 'error');
  }
}

// ══════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════
const ROUTES = {
  '/':           renderDashboard,
  '/productos':  renderProducts,
  '/categorias': renderCategories,
};

function router() {
  const hash = location.hash.replace('#', '') || '/';
  const render = ROUTES[hash] ?? renderDashboard;

  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + hash);
  });

  const titles = { '/': 'Dashboard', '/productos': 'Productos', '/categorias': 'Categorías' };
  document.getElementById('topbarTitle').textContent = titles[hash] ?? 'Admin';
  document.getElementById('topbarActions').innerHTML = '';

  render();
}

window.addEventListener('hashchange', router);

// ══════════════════════════════════════════
//  SEED / TEST DATA
// ══════════════════════════════════════════
const SEED_CATS = [
  { name: 'Damas',      emoji: '👗', gradient: 'linear-gradient(135deg,#FF4D6D,#C9184A)', order: 1, active: true },
  { name: 'Caballeros', emoji: '👔', gradient: 'linear-gradient(135deg,#1A1A2E,#2D2D44)', order: 2, active: true },
  { name: 'Niños',      emoji: '🧒', gradient: 'linear-gradient(135deg,#74B9FF,#0984E3)', order: 3, active: true },
  { name: 'Deportivo',  emoji: '🏃', gradient: 'linear-gradient(135deg,#FFD166,#FF9A3C)', order: 4, active: true },
  { name: 'Accesorios', emoji: '👜', gradient: 'linear-gradient(135deg,#845EC2,#C9184A)', order: 5, active: true },
];

const SEED_PRODS = [
  // catIdx → index in SEED_CATS; imgStart → first image index from that category's pool
  { name: 'Conjunto verano dama',    price: 15000, minOrder:  6, inStock: true,  catIdx: 0, imgs: 2, imgStart: 0 },
  { name: 'Vestido floral',          price: 18500, minOrder:  3, inStock: true,  catIdx: 0, imgs: 2, imgStart: 1 },
  { name: 'Blusa manga corta',       price:  8900, minOrder: 12, inStock: true,  catIdx: 0, imgs: 1, imgStart: 2 },
  { name: 'Pantalón palazzo',        price: 12000, minOrder:  6, inStock: false, catIdx: 0, imgs: 2, imgStart: 0 },
  { name: 'Remera básica caballero', price:  7500, minOrder: 12, inStock: true,  catIdx: 1, imgs: 2, imgStart: 0 },
  { name: 'Jean slim fit',           price: 22000, minOrder:  3, inStock: true,  catIdx: 1, imgs: 2, imgStart: 1 },
  { name: 'Camisa casual',           price: 14000, minOrder:  6, inStock: false, catIdx: 1, imgs: 1, imgStart: 2 },
  { name: 'Conjunto niña verano',    price:  9500, minOrder:  6, inStock: true,  catIdx: 2, imgs: 2, imgStart: 0 },
  { name: 'Remera niño estampada',   price:  5500, minOrder: 12, inStock: true,  catIdx: 2, imgs: 1, imgStart: 1 },
  { name: 'Calza deportiva',         price: 11000, minOrder:  6, inStock: true,  catIdx: 3, imgs: 2, imgStart: 0 },
  { name: 'Buzo con capucha',        price: 19500, minOrder:  3, inStock: true,  catIdx: 3, imgs: 2, imgStart: 1 },
  { name: 'Remera dry-fit',          price:  8500, minOrder: 12, inStock: false, catIdx: 3, imgs: 1, imgStart: 2 },
  { name: 'Cartera cuero eco',       price: 25000, minOrder:  3, inStock: true,  catIdx: 4, imgs: 2, imgStart: 0 },
  { name: 'Cinturón trenzado',       price:  6500, minOrder:  6, inStock: true,  catIdx: 4, imgs: 1, imgStart: 1 },
  { name: 'Bufanda tejida',          price:  9000, minOrder:  6, inStock: true,  catIdx: 4, imgs: 2, imgStart: 0 },
];

// Unsplash photo IDs per category (clothing/fashion, CORS-enabled CDN).
// Products in the same category share this pool — we upload each once.
const SEED_IMG_POOLS = [
  // 0 Damas
  ['1515886657613-9f3515b0c78f', '1469334031218-e382a71b716b', '1558618666-fcd25c85cd64'],
  // 1 Caballeros
  ['1516257984-b1b4f45c0b93', '1507003211169-0a1dd7228f2d', '1552374196-1ab2a1c593e8'],
  // 2 Niños
  ['1622290291468-a28f7a7dc6a8', '1503919545889-aef636e10ad4'],
  // 3 Deportivo
  ['1571902943202-507ec2618e8f', '1556909114-44e3e70034e2', '1538805060514-2d5b2e3d5d7c'],
  // 4 Accesorios
  ['1548036161-18aafe94b13b', '1584917865442-de89df76afd3'],
];
const SEED_TOTAL_IMGS = SEED_IMG_POOLS.reduce((s, p) => s + p.length, 0);

window.seedTestData = () => {
  document.getElementById('modalTitle').textContent = '🧪 Datos de prueba';
  document.getElementById('modalBody').innerHTML = `
    <p>Se van a agregar los siguientes datos de prueba a Firestore (sin borrar los existentes):</p>
    <ul class="seed-summary">
      <li><strong>${SEED_CATS.length} categorías</strong> — ${SEED_CATS.map(c => c.emoji + ' ' + c.name).join(', ')}</li>
      <li><strong>${SEED_PRODS.length} productos</strong> con fotos de ropa subidas a Google Drive</li>
    </ul>
    <p class="seed-note">Se descargarán ${SEED_TOTAL_IMGS} fotos de Unsplash y se subirán a Drive. Puede tardar ~1 minuto. Podés borrar todo luego con la selección múltiple.</p>
    <div id="seedProgress" style="display:none;text-align:center;margin-top:1.25rem">
      <div class="spinner" style="margin:0 auto .6rem"></div>
      <p id="seedProgressText" style="font-size:.875rem;color:var(--muted)"></p>
    </div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-primary" id="seedConfirmBtn">Generar datos</button>`;
  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('seedConfirmBtn').onclick = runSeed;
  openModal();
};

async function fetchImageAsFile(unsplashId, filename) {
  const url = `https://images.unsplash.com/photo-${unsplashId}?w=600&h=600&fit=crop&q=80`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

async function runSeed() {
  const btn       = document.getElementById('seedConfirmBtn');
  const cancelBtn = document.getElementById('modalCancel');
  const progress  = document.getElementById('seedProgress');
  const progText  = document.getElementById('seedProgressText');

  btn.disabled = true;
  btn.textContent = 'Generando…';
  cancelBtn.style.display = 'none';
  progress.style.display = 'block';

  try {
    // Step 1 — Upload each unique photo to Drive once, cache the Drive URL
    const poolDriveUrls = SEED_IMG_POOLS.map(pool => Array(pool.length).fill(null));
    let uploadsDone = 0;
    for (let ci = 0; ci < SEED_IMG_POOLS.length; ci++) {
      for (let ii = 0; ii < SEED_IMG_POOLS[ci].length; ii++) {
        uploadsDone++;
        progText.textContent = `Subiendo foto ${uploadsDone}/${SEED_TOTAL_IMGS} a Drive…`;
        try {
          const file = await fetchImageAsFile(
            SEED_IMG_POOLS[ci][ii],
            `ropa-seed-cat${ci}-img${ii}.jpg`
          );
          poolDriveUrls[ci][ii] = await uploadFileToDrive(file);
        } catch (e) {
          console.warn(`Foto ${ci}-${ii} falló:`, e);
        }
      }
    }

    // Step 2 — Create categories
    const catIds = [];
    for (let i = 0; i < SEED_CATS.length; i++) {
      progText.textContent = `Creando categoría ${i + 1}/${SEED_CATS.length}…`;
      const ref = await addDoc(collection(db, 'categories'), {
        ...SEED_CATS[i], createdAt: serverTimestamp(),
      });
      catIds.push(ref.id);
    }

    // Step 3 — Create products, assigning Drive URLs from the pool
    for (let i = 0; i < SEED_PRODS.length; i++) {
      const p    = SEED_PRODS[i];
      const pool = poolDriveUrls[p.catIdx];
      progText.textContent = `Creando producto ${i + 1}/${SEED_PRODS.length}…`;
      const images = Array.from({ length: p.imgs }, (_, j) =>
        pool[(p.imgStart + j) % pool.length]
      ).filter(Boolean);
      await addDoc(collection(db, 'products'), {
        name:       p.name,
        categoryId: catIds[p.catIdx],
        price:      p.price,
        minOrder:   p.minOrder,
        inStock:    p.inStock,
        images,
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });
    }

    closeModal();
    toast(`✓ ${SEED_CATS.length} categorías y ${SEED_PRODS.length} productos creados con fotos en Drive`, 'success');
    await loadData();
    renderDashboard();
  } catch (e) {
    console.error(e);
    toast('Error al generar datos: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Reintentar';
    cancelBtn.style.display = '';
  }
}

// ══════════════════════════════════════════
//  VIEWS
// ══════════════════════════════════════════

// ── Dashboard ─────────────────────────────
function renderDashboard() {
  const outOfStock = products.filter(p => !p.inStock).length;
  const content = document.getElementById('appContent');
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">${products.length}</div>
        <div class="stat-lbl">Productos</div>
      </div>
      <div class="stat-card green">
        <div class="stat-num">${categories.length}</div>
        <div class="stat-lbl">Categorías</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-num">${outOfStock}</div>
        <div class="stat-lbl">Sin stock</div>
      </div>
    </div>
    <div class="quick-links">
      <div class="quick-card" onclick="location.hash='#/productos'">
        <div class="quick-card-icon">👗</div>
        <h3>Productos</h3>
        <p>Agregá, editá o eliminá productos del catálogo.</p>
      </div>
      <div class="quick-card" onclick="location.hash='#/categorias'">
        <div class="quick-card-icon">📂</div>
        <h3>Categorías</h3>
        <p>Gestioná las categorías del sitio.</p>
      </div>
      <div class="quick-card" onclick="window.open('../', '_blank')">
        <div class="quick-card-icon">🌐</div>
        <h3>Ver Sitio</h3>
        <p>Abrí el sitio público para verificar los cambios.</p>
      </div>
    </div>
    <div class="seed-zone">
      <div class="seed-zone-inner">
        <div>
          <p class="seed-zone-title">🧪 Datos de prueba</p>
          <p class="seed-zone-desc">Generá ${SEED_CATS.length} categorías y ${SEED_PRODS.length} productos de ejemplo para testear el sistema.</p>
        </div>
        <button class="btn btn-ghost seed-btn" onclick="seedTestData()">Generar datos de prueba</button>
      </div>
    </div>`;
}

// ── Sort helper ───────────────────────────
function sortItems(items, field, dir, type) {
  return items.sort((a, b) => {
    let va, vb;
    if (type === 'product') {
      if (field === 'category') {
        va = (categories.find(c => c.id === a.categoryId)?.name ?? '').toLowerCase();
        vb = (categories.find(c => c.id === b.categoryId)?.name ?? '').toLowerCase();
      } else if (field === 'inStock') {
        va = a.inStock ? 1 : 0; vb = b.inStock ? 1 : 0;
      } else {
        va = a[field] ?? ''; vb = b[field] ?? '';
      }
    } else {
      if (field === 'prodCount') {
        va = products.filter(p => p.categoryId === a.id).length;
        vb = products.filter(p => p.categoryId === b.id).length;
      } else if (field === 'active') {
        va = a.active !== false ? 1 : 0; vb = b.active !== false ? 1 : 0;
      } else {
        va = a[field] ?? ''; vb = b[field] ?? '';
      }
    }
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
}

// ── Products ──────────────────────────────
function renderProducts() {
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = `<button class="btn btn-primary" id="btnNewProduct">+ Nuevo Producto</button>`;
  document.getElementById('btnNewProduct').onclick = () => openProductModal();

  const content = document.getElementById('appContent');

  if (!products.length) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👗</div>
        <p>Todavía no hay productos. ¡Creá el primero!</p>
        <button class="btn btn-primary" onclick="document.getElementById('btnNewProduct').click()">+ Nuevo Producto</button>
      </div>`;
    return;
  }

  const sorted = sortItems([...products], productSort.field, productSort.dir, 'product');

  const rows = sorted.map(p => {
    const cat    = categories.find(c => c.id === p.categoryId);
    const imgs   = (p.images ?? []).slice(0, 3);
    const thumbs = imgs.length
      ? imgs.map(url => `<img class="thumb" src="${url}" alt="" loading="lazy" onclick="openAdminPhotoGallery('${p.id}')" style="cursor:zoom-in">`).join('')
      : `<div class="thumb-placeholder">📷</div>`;
    const sel = selectedProds.has(p.id);
    return `
      <tr class="${sel ? 'row-checked' : ''}">
        <td class="td-check"><input type="checkbox" class="row-check" ${sel ? 'checked' : ''} onchange="toggleProd('${p.id}',this.checked)"></td>
        <td><div class="thumb-list">${thumbs}</div></td>
        <td><strong>${p.name ?? '—'}</strong></td>
        <td>${cat?.name ?? '—'}</td>
        <td>${p.price != null ? fmtARS(p.price) : '—'}</td>
        <td>${p.minOrder ? p.minOrder + ' u.' : '—'}</td>
        <td><span class="badge ${p.inStock ? 'badge-green' : 'badge-red'}">${p.inStock ? '✓ En stock' : '✗ Sin stock'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon edit"   onclick="openProductModal('${p.id}')" title="Editar">✏️</button>
            <button class="btn-icon delete" onclick="confirmDelete('product','${p.id}','${p.name?.replace(/'/g, "\\'")}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  const allChecked = sorted.length > 0 && sorted.every(p => selectedProds.has(p.id));
  const thP = (field, label) => {
    const active = productSort.field === field;
    const arrow  = active ? (productSort.dir === 1 ? ' ↑' : ' ↓') : '';
    return `<th class="th-sort${active ? ' th-active' : ''}" onclick="sortProds('${field}')">${label}${arrow}</th>`;
  };

  const bulkBar = selectedProds.size ? `
    <div class="bulk-bar">
      <span>${selectedProds.size} producto(s) seleccionado(s)</span>
      <button class="btn btn-danger btn-sm" onclick="bulkDeleteProds()">🗑️ Eliminar seleccionados</button>
      <button class="btn btn-ghost btn-sm" onclick="clearProdSelection()">✕ Deseleccionar</button>
    </div>` : '';

  content.innerHTML = `
    ${bulkBar}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="td-check"><input type="checkbox" id="checkAllProds" ${allChecked ? 'checked' : ''} onchange="toggleAllProds(this.checked)"></th>
            <th>Imagen</th>
            ${thP('name', 'Nombre')}
            ${thP('category', 'Categoría')}
            ${thP('price', 'Precio')}
            ${thP('minOrder', 'Mínimo')}
            ${thP('inStock', 'Stock')}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Categories ────────────────────────────
function renderCategories() {
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = `<button class="btn btn-primary" id="btnNewCat">+ Nueva Categoría</button>`;
  document.getElementById('btnNewCat').onclick = () => openCategoryModal();

  const content = document.getElementById('appContent');

  if (!categories.length) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <p>Todavía no hay categorías.</p>
        <button class="btn btn-primary" onclick="document.getElementById('btnNewCat').click()">+ Nueva Categoría</button>
      </div>`;
    return;
  }

  const sorted = sortItems([...categories], categorySort.field, categorySort.dir, 'category');

  const rows = sorted.map(c => {
    const prodCount = products.filter(p => p.categoryId === c.id).length;
    const sel = selectedCats.has(c.id);
    return `
      <tr class="${sel ? 'row-checked' : ''}">
        <td class="td-check"><input type="checkbox" class="row-check" ${sel ? 'checked' : ''} onchange="toggleCat('${c.id}',this.checked)"></td>
        <td><div class="grad-preview" style="background:${c.gradient ?? '#ccc'}">${c.emoji ?? ''}</div></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.order ?? 0}</td>
        <td>${prodCount}</td>
        <td><span class="badge ${c.active !== false ? 'badge-green' : 'badge-gray'}">${c.active !== false ? 'Activa' : 'Inactiva'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon edit"   onclick="openCategoryModal('${c.id}')" title="Editar">✏️</button>
            <button class="btn-icon delete" onclick="confirmDelete('category','${c.id}','${c.name?.replace(/'/g, "\\'")}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  const allChecked = sorted.length > 0 && sorted.every(c => selectedCats.has(c.id));
  const thC = (field, label) => {
    const active = categorySort.field === field;
    const arrow  = active ? (categorySort.dir === 1 ? ' ↑' : ' ↓') : '';
    return `<th class="th-sort${active ? ' th-active' : ''}" onclick="sortCats('${field}')">${label}${arrow}</th>`;
  };

  const bulkBar = selectedCats.size ? `
    <div class="bulk-bar">
      <span>${selectedCats.size} categoría(s) seleccionada(s)</span>
      <button class="btn btn-danger btn-sm" onclick="bulkDeleteCats()">🗑️ Eliminar seleccionadas</button>
      <button class="btn btn-ghost btn-sm" onclick="clearCatSelection()">✕ Deseleccionar</button>
    </div>` : '';

  content.innerHTML = `
    ${bulkBar}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="td-check"><input type="checkbox" id="checkAllCats" ${allChecked ? 'checked' : ''} onchange="toggleAllCats(this.checked)"></th>
            <th>Vista previa</th>
            ${thC('name', 'Nombre')}
            ${thC('order', 'Orden')}
            ${thC('prodCount', 'Productos')}
            ${thC('active', 'Estado')}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ══════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════

const GRADIENTS = [
  'linear-gradient(135deg,#FF4D6D,#C9184A)',
  'linear-gradient(135deg,#FF85A1,#FF4D6D)',
  'linear-gradient(135deg,#FFB3C6,#F72585)',
  'linear-gradient(135deg,#F72585,#C9184A)',
  'linear-gradient(135deg,#1A1A2E,#2D2D44)',
  'linear-gradient(135deg,#FFD166,#FF9A3C)',
  'linear-gradient(135deg,#6B2D5E,#C9184A)',
  'linear-gradient(135deg,#845EC2,#C9184A)',
  'linear-gradient(135deg,#74B9FF,#0984E3)',
  'linear-gradient(135deg,#2D3436,#636E72)',
];

// Expose to inline onclick handlers
window.openProductModal  = openProductModal;
window.openCategoryModal = openCategoryModal;
window.confirmDelete     = confirmDelete;

// ── Sort / select global handlers ─────────
window.sortProds = (field) => {
  if (productSort.field === field) productSort.dir = -productSort.dir;
  else { productSort.field = field; productSort.dir = 1; }
  renderProducts();
};
window.sortCats = (field) => {
  if (categorySort.field === field) categorySort.dir = -categorySort.dir;
  else { categorySort.field = field; categorySort.dir = 1; }
  renderCategories();
};
window.toggleProd = (id, checked) => {
  if (checked) selectedProds.add(id); else selectedProds.delete(id);
  renderProducts();
};
window.toggleAllProds = (checked) => {
  products.forEach(p => checked ? selectedProds.add(p.id) : selectedProds.delete(p.id));
  renderProducts();
};
window.toggleCat = (id, checked) => {
  if (checked) selectedCats.add(id); else selectedCats.delete(id);
  renderCategories();
};
window.toggleAllCats = (checked) => {
  categories.forEach(c => checked ? selectedCats.add(c.id) : selectedCats.delete(c.id));
  renderCategories();
};
window.clearProdSelection = () => { selectedProds.clear(); renderProducts(); };
window.clearCatSelection  = () => { selectedCats.clear(); renderCategories(); };

window.bulkDeleteProds = () => {
  const ids = [...selectedProds];
  if (!ids.length) return;
  const overlay = document.getElementById('confirmOverlay');
  document.getElementById('confirmTitle').textContent  = '¿Confirmar eliminación?';
  document.getElementById('confirmMessage').textContent =
    `¿Eliminar ${ids.length} producto(s)? Las imágenes de Drive también se borrarán. Esta acción no se puede deshacer.`;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('confirmCancel').onclick = () => {
    overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true');
  };
  document.getElementById('confirmOk').onclick = async () => {
    overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true');
    selectedProds.clear();
    let driveErrors = 0;
    for (const id of ids) {
      try { driveErrors += await deleteSingleProduct(id); }
      catch (e) { console.error(e); toast('Error al eliminar producto: ' + e.message, 'error'); }
    }
    if (driveErrors) toast(`Advertencia: ${driveErrors} imagen(es) no se pudieron borrar de Drive`, 'error');
    toast(`${ids.length} producto(s) eliminado(s)`, 'success');
    await loadData();
    renderProducts();
  };
};

window.bulkDeleteCats = () => {
  const ids = [...selectedCats];
  if (!ids.length) return;

  const catProdsMap = Object.fromEntries(
    ids.map(id => [id, products.filter(p => p.categoryId === id)])
  );
  const totalProds = ids.reduce((sum, id) => sum + catProdsMap[id].length, 0);
  const allCatProds = ids.flatMap(id => catProdsMap[id]);

  const catNames = ids.map(id => categories.find(c => c.id === id)?.name ?? id);

  document.getElementById('modalTitle').textContent = `Eliminar ${ids.length} categoría(s)`;

  let bodyHtml = `<p>Categorías seleccionadas: <strong>${catNames.join(', ')}</strong></p>`;
  if (totalProds > 0) {
    const prodList = allCatProds.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return `<li>${p.name ?? '(sin nombre)'} <span style="color:var(--muted);font-size:.8rem">(${cat?.name ?? '—'})</span></li>`;
    }).join('');
    bodyHtml += `
      <p style="margin-top:.75rem">Estas categorías contienen <strong>${totalProds} producto(s)</strong>:</p>
      <ul class="delete-prod-list">${prodList}</ul>
      <p style="margin-top:1rem">¿Qué querés hacer con estos productos?</p>`;
  } else {
    bodyHtml += `<p style="margin-top:.75rem">Esta acción no se puede deshacer.</p>`;
  }

  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = totalProds > 0 ? `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-secondary" id="bulkCatOnly">Solo eliminar las categorías</button>
    <button class="btn btn-danger" id="bulkCatAndProds">Eliminar categorías y productos</button>` : `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-danger" id="bulkCatOnly">Eliminar</button>`;

  document.getElementById('modalCancel').onclick = closeModal;

  const runBulkCatDelete = async (withProds) => {
    closeModal();
    selectedCats.clear();
    let driveErrors = 0;
    if (withProds) {
      for (const prod of allCatProds) {
        try { driveErrors += await deleteSingleProduct(prod.id); }
        catch (e) { console.error(e); }
      }
    }
    for (const id of ids) {
      try { await deleteDoc(doc(db, 'categories', id)); }
      catch (e) { console.error(e); toast('Error al eliminar categoría: ' + e.message, 'error'); }
    }
    if (driveErrors) toast(`Advertencia: ${driveErrors} imagen(es) no se pudieron borrar de Drive`, 'error');
    toast(`${ids.length} categoría(s) eliminada(s)${withProds && totalProds ? ` y ${totalProds} producto(s)` : ''}`, 'success');
    await loadData();
    renderCategories();
  };

  document.getElementById('bulkCatOnly').onclick = () => runBulkCatDelete(false);
  if (totalProds > 0) {
    document.getElementById('bulkCatAndProds').onclick = () => runBulkCatDelete(true);
  }
  openModal();
};

function openModal()  {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalOverlay').setAttribute('aria-hidden', 'false');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalOverlay').setAttribute('aria-hidden', 'true');
  pendingImages = [];
}

// ── Product modal ─────────────────────────
async function openProductModal(id) {
  const prod = id ? products.find(p => p.id === id) : null;
  pendingImages = (prod?.images ?? []).map(url => ({ url, file: null }));

  document.getElementById('modalTitle').textContent = prod ? 'Editar Producto' : 'Nuevo Producto';

  const catOptions = categories.map(c =>
    `<option value="${c.id}" ${prod?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  document.getElementById('modalBody').innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <input class="form-input" id="pName" value="${prod?.name ?? ''}" placeholder="Ej: Conjunto dama verano">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="pCategory">
            <option value="">— Sin categoría —</option>
            ${catOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Precio ($)</label>
          <input class="form-input" id="pPrice" type="number" min="0" value="${prod?.price ?? ''}" placeholder="Ej: 15000">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Cantidad mínima (unidades)</label>
        <input class="form-input" id="pMinOrder" type="number" min="1" value="${prod?.minOrder ?? ''}" placeholder="Ej: 6">
      </div>

      <div class="form-group">
        <label class="form-label">Estado de stock</label>
        <div class="stock-toggle">
          <label class="toggle-opt ${prod?.inStock !== false ? 'selected-yes' : ''}" id="toggleYes">
            <input type="radio" name="stock" value="yes" ${prod?.inStock !== false ? 'checked' : ''}> ✓ En stock
          </label>
          <label class="toggle-opt ${prod?.inStock === false ? 'selected-no' : ''}" id="toggleNo">
            <input type="radio" name="stock" value="no" ${prod?.inStock === false ? 'checked' : ''}> ✗ Sin stock
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Imágenes</label>
        <div style="margin-bottom:.6rem">
          <label class="btn btn-ghost" style="cursor:pointer;display:inline-flex;align-items:center;gap:.4rem">
            📁 Seleccionar imágenes
            <input type="file" id="imgInput" accept="image/*" multiple style="display:none">
          </label>
          <span style="font-size:.8rem;color:var(--muted);margin-left:.8rem">Se subirán a Google Drive al guardar</span>
        </div>
        <div class="image-previews" id="imagePreviews"></div>
        <div class="upload-progress" id="uploadProgress"></div>
      </div>
    </div>`;

  renderPreviews();
  setupFileInput();
  setupStockToggle();

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-primary" id="modalSave">Guardar</button>`;

  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('modalSave').onclick   = () => saveProduct(id);
  openModal();
}

function setupStockToggle() {
  const radios = document.querySelectorAll('input[name="stock"]');
  radios.forEach(r => r.addEventListener('change', () => {
    document.getElementById('toggleYes').className = 'toggle-opt ' + (r.value === 'yes' && r.checked ? 'selected-yes' : '');
    document.getElementById('toggleNo').className  = 'toggle-opt ' + (r.value === 'no'  && r.checked ? 'selected-no'  : '');
    if (document.querySelector('input[name="stock"]:checked')?.value === 'yes') {
      document.getElementById('toggleYes').className = 'toggle-opt selected-yes';
      document.getElementById('toggleNo').className  = 'toggle-opt';
    } else {
      document.getElementById('toggleYes').className = 'toggle-opt';
      document.getElementById('toggleNo').className  = 'toggle-opt selected-no';
    }
  }));
}

function setupFileInput() {
  const input = document.getElementById('imgInput');
  if (input) input.addEventListener('change', () => handleFiles([...input.files]));
}

function handleFiles(files) {
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { toast('Imagen demasiado grande (máx 5 MB)', 'error'); return; }
    const url = URL.createObjectURL(file);
    pendingImages.push({ file, url });
  });
  renderPreviews();
}

function renderPreviews() {
  const container = document.getElementById('imagePreviews');
  if (!container) return;
  container.innerHTML = pendingImages.map((img, i) => `
    <div class="preview-item">
      <img src="${img.url}" alt="Preview ${i+1}">
      <button class="preview-remove" onclick="removeImage(${i})" title="Eliminar">✕</button>
    </div>`).join('');
}
window.removeImage = (i) => { pendingImages.splice(i, 1); renderPreviews(); };

async function uploadImages() {
  const progress = document.getElementById('uploadProgress');
  const urls = [];

  for (let i = 0; i < pendingImages.length; i++) {
    const img = pendingImages[i];

    // Already a permanent Drive URL
    if (!img.file) { urls.push(img.url); continue; }

    if (progress) progress.textContent = `Subiendo imagen ${i + 1} de ${pendingImages.length}…`;
    try {
      const url = await uploadFileToDrive(img.file, p => {
        if (progress) progress.textContent = p;
      });
      urls.push(url);
    } catch (e) {
      toast('Error al subir imagen: ' + e.message, 'error');
    }
  }

  if (progress) progress.textContent = '';
  return urls;
}


async function saveProduct(id) {
  const name     = document.getElementById('pName')?.value.trim();
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }

  const saveBtn = document.getElementById('modalSave');
  saveBtn.textContent = 'Guardando…';
  saveBtn.disabled = true;

  try {
    const imageUrls = await uploadImages();
    const data = {
      name,
      categoryId: document.getElementById('pCategory')?.value || null,
      price:      parseFloat(document.getElementById('pPrice')?.value) || null,
      minOrder:   parseInt(document.getElementById('pMinOrder')?.value) || null,
      inStock:    document.querySelector('input[name="stock"]:checked')?.value !== 'no',
      images:     imageUrls,
      updatedAt:  serverTimestamp(),
    };

    if (id) {
      await updateDoc(doc(db, 'products', id), data);
      toast('Producto actualizado ✓', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'products'), data);
      toast('Producto creado ✓', 'success');
    }

    closeModal();
    await loadData();
    renderProducts();
  } catch (e) {
    console.error(e);
    toast('Error al guardar: ' + e.message, 'error');
    saveBtn.textContent = 'Guardar';
    saveBtn.disabled = false;
  }
}

// ── Category modal ────────────────────────
function openCategoryModal(id) {
  const cat = id ? categories.find(c => c.id === id) : null;

  document.getElementById('modalTitle').textContent = cat ? 'Editar Categoría' : 'Nueva Categoría';

  const gradPicker = GRADIENTS.map((g, i) =>
    `<div class="grad-opt ${(cat?.gradient ?? GRADIENTS[0]) === g ? 'selected' : ''}"
          style="background:${g}"
          data-grad="${g}"
          onclick="selectGrad(this)"></div>`
  ).join('');

  document.getElementById('modalBody').innerHTML = `
    <div class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-input" id="cName" value="${cat?.name ?? ''}" placeholder="Ej: Damas">
        </div>
        <div class="form-group">
          <label class="form-label">Emoji</label>
          <input class="form-input" id="cEmoji" value="${cat?.emoji ?? ''}" placeholder="Ej: 👗" maxlength="4">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Color de fondo</label>
        <div class="grad-picker" id="gradPicker">${gradPicker}</div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Orden (posición)</label>
          <input class="form-input" id="cOrder" type="number" min="0" value="${cat?.order ?? 0}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-select" id="cActive">
            <option value="true"  ${cat?.active !== false ? 'selected' : ''}>Activa</option>
            <option value="false" ${cat?.active === false  ? 'selected' : ''}>Inactiva</option>
          </select>
        </div>
      </div>
    </div>`;

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-primary" id="modalSave">Guardar</button>`;

  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('modalSave').onclick   = () => saveCategory(id);
  openModal();
}

window.selectGrad = (el) => {
  document.querySelectorAll('.grad-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
};

async function saveCategory(id) {
  const name = document.getElementById('cName')?.value.trim();
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }

  const saveBtn = document.getElementById('modalSave');
  saveBtn.textContent = 'Guardando…';
  saveBtn.disabled = true;

  try {
    const selected = document.querySelector('.grad-opt.selected');
    const data = {
      name,
      emoji:    document.getElementById('cEmoji')?.value.trim() || '',
      gradient: selected?.dataset.grad ?? GRADIENTS[0],
      order:    parseInt(document.getElementById('cOrder')?.value) || 0,
      active:   document.getElementById('cActive')?.value !== 'false',
    };

    if (id) {
      await updateDoc(doc(db, 'categories', id), data);
      toast('Categoría actualizada ✓', 'success');
    } else {
      await addDoc(collection(db, 'categories'), data);
      toast('Categoría creada ✓', 'success');
    }

    closeModal();
    await loadData();
    renderCategories();
  } catch (e) {
    console.error(e);
    toast('Error al guardar: ' + e.message, 'error');
    saveBtn.textContent = 'Guardar';
    saveBtn.disabled = false;
  }
}

// ══════════════════════════════════════════
//  DELETE
// ══════════════════════════════════════════
function confirmDelete(type, id, name) {
  if (type === 'category') {
    const catProds = products.filter(p => p.categoryId === id);
    showCategoryDeleteModal(id, name, catProds);
    return;
  }

  const overlay = document.getElementById('confirmOverlay');
  document.getElementById('confirmTitle').textContent  = '¿Confirmar eliminación?';
  document.getElementById('confirmMessage').textContent =
    `¿Querés eliminar "${name}"? Esta acción no se puede deshacer.`;

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');

  document.getElementById('confirmCancel').onclick = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  };
  document.getElementById('confirmOk').onclick = async () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    await doDelete(type, id);
  };
}

function showCategoryDeleteModal(id, name, catProds) {
  document.getElementById('modalTitle').textContent = `Eliminar categoría "${name}"`;

  let bodyHtml;
  if (catProds.length === 0) {
    bodyHtml = `<p>¿Confirmar eliminación de la categoría <strong>${name}</strong>? Esta acción no se puede deshacer.</p>`;
  } else {
    const prodList = catProds.map(p => `<li>${p.name ?? '(sin nombre)'}</li>`).join('');
    const otherCats = catProds.filter(p => {
      const otherRef = categories.find(c => c.id !== id && c.id === p.categoryId);
      return !!otherRef;
    });
    const warning = otherCats.length
      ? `<p class="delete-warning">⚠️ ${otherCats.length} de estos productos también figuran en otras categorías.</p>`
      : '';
    bodyHtml = `
      <p>Esta categoría contiene <strong>${catProds.length} producto(s)</strong>:</p>
      <ul class="delete-prod-list">${prodList}</ul>
      ${warning}
      <p style="margin-top:1rem">¿Qué querés hacer con estos productos?</p>`;
  }

  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = catProds.length === 0 ? `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-danger" id="deleteCatOnly">Eliminar</button>` : `
    <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
    <button class="btn btn-secondary" id="deleteCatOnly">Solo eliminar la categoría</button>
    <button class="btn btn-danger" id="deleteCatAndProds">Eliminar categoría y productos</button>`;

  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('deleteCatOnly').onclick = async () => {
    closeModal(); await doDeleteCategory(id, false, catProds);
  };
  if (catProds.length > 0) {
    document.getElementById('deleteCatAndProds').onclick = async () => {
      closeModal(); await doDeleteCategory(id, true, catProds);
    };
  }
  openModal();
}

async function doDeleteCategory(id, withProducts, catProds) {
  try {
    if (withProducts) {
      let driveErrors = 0;
      for (const prod of catProds) {
        driveErrors += await deleteSingleProduct(prod.id);
      }
      if (driveErrors) toast(`Advertencia: ${driveErrors} imagen(es) no se pudieron borrar de Drive`, 'error');
    }
    await deleteDoc(doc(db, 'categories', id));
    toast(`Categoría eliminada${withProducts && catProds.length ? ` y ${catProds.length} producto(s) eliminado(s)` : ''}`, 'success');
    await loadData();
    renderCategories();
  } catch (e) {
    console.error(e);
    toast('Error al eliminar: ' + e.message, 'error');
  }
}

window.openAdminPhotoGallery = function(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod?.images?.length) return;
  const images = prod.images;
  let idx = 0;

  document.getElementById('modalTitle').textContent = prod.name ?? 'Fotos';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1rem">
      <div style="position:relative;width:100%;max-height:420px;display:flex;align-items:center;justify-content:center;background:#000;border-radius:8px;overflow:hidden">
        <img id="galleryMainImg" src="${images[0]}" style="max-width:100%;max-height:420px;object-fit:contain">
        ${images.length > 1 ? `
          <button onclick="galleryPrev()" style="position:absolute;left:.5rem;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:1.2rem;cursor:pointer">‹</button>
          <button onclick="galleryNext()" style="position:absolute;right:.5rem;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:1.2rem;cursor:pointer">›</button>
        ` : ''}
        <span id="galleryCounter" style="position:absolute;bottom:.5rem;right:.75rem;background:rgba(0,0,0,.5);color:#fff;font-size:.75rem;padding:.2rem .5rem;border-radius:99px">1 / ${images.length}</span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">
        ${images.map((url, i) => `<img src="${url}" onclick="galleryGoTo(${i})" style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid ${i===0?'var(--pink)':'transparent'}" id="galleryThumb${i}">`).join('')}
      </div>
    </div>`;

  window.galleryImages = images;
  window.galleryIdx    = idx;
  window.galleryGoTo   = (i) => {
    window.galleryIdx = i;
    document.getElementById('galleryMainImg').src = images[i];
    document.getElementById('galleryCounter').textContent = `${i+1} / ${images.length}`;
    images.forEach((_, j) => {
      const t = document.getElementById(`galleryThumb${j}`);
      if (t) t.style.border = j === i ? '2px solid var(--pink)' : '2px solid transparent';
    });
  };
  window.galleryPrev = () => window.galleryGoTo((window.galleryIdx - 1 + images.length) % images.length);
  window.galleryNext = () => window.galleryGoTo((window.galleryIdx + 1) % images.length);

  document.getElementById('modalFooter').innerHTML = `<button class="btn btn-ghost" id="modalCancel">Cerrar</button>`;
  document.getElementById('modalCancel').onclick = closeModal;
  openModal();
};

async function deleteSingleProduct(id) {
  const prod = products.find(p => p.id === id);
  let driveErrors = 0;
  for (const url of (prod?.images ?? [])) {
    const fileId = driveFileIdFromUrl(url);
    if (fileId) {
      try { await deleteFileFromDrive(fileId); }
      catch (e) { console.warn('Drive delete failed:', e); driveErrors++; }
    }
  }
  await deleteDoc(doc(db, 'products', id));
  return driveErrors;
}

async function doDelete(type, id) {
  try {
    if (type === 'product') {
      const driveErrors = await deleteSingleProduct(id);
      if (driveErrors) toast(`Advertencia: ${driveErrors} imagen(es) no se pudieron borrar de Drive`, 'error');
      toast('Producto eliminado', 'success');
      await loadData();
      renderProducts();
    }
  } catch (e) {
    console.error(e);
    toast('Error al eliminar: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] ?? 'ℹ'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}

// ══════════════════════════════════════════
//  MOBILE MENU
// ══════════════════════════════════════════
function setupMobileMenu() {
  const sidebar  = document.getElementById('sidebar');
  const toggle   = document.getElementById('menuToggle');
  const closeBtn = document.getElementById('sidebarClose');

  const open  = () => sidebar.classList.add('open');
  const close = () => sidebar.classList.remove('open');

  toggle?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);

  document.querySelectorAll('.nav-item').forEach(a =>
    a.addEventListener('click', () => { if (window.innerWidth < 768) close(); })
  );
}

// ══════════════════════════════════════════
//  MODAL CLOSE HELPERS
// ══════════════════════════════════════════
function setupModalClose() {
  document.getElementById('modalClose').onclick   = closeModal;
  document.getElementById('modalOverlay').onclick = e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('confirmOverlay').classList.remove('open');
    }
  });
}


// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
// ── Drive connection status ────────────────────────────────
function setDriveStatus(email) {
  const el   = document.getElementById('driveStatus');
  const btn  = document.getElementById('driveConnectBtn');
  if (!el) return;
  if (email) {
    el.querySelector('.status-dot').classList.add('connected');
    el.querySelector('.status-text').textContent = email;
    el.title = email;
    if (btn) btn.style.display = 'none';
  } else {
    el.querySelector('.status-dot').classList.remove('connected');
    el.querySelector('.status-text').textContent = 'Drive: desconectado';
    if (btn) btn.style.display = 'block';
  }
}

async function connectDrive() {
  try {
    const user = await getDriveUserInfo();
    setDriveStatus(user?.email ?? null);
  } catch (_) {
    setDriveStatus(null);
  }
}

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

async function init() {
  setupMobileMenu();
  setupModalClose();
  setupThemeToggle();

  // Init Google Auth once GIS script is loaded
  const waitForGIS = () => new Promise(resolve => {
    if (window.google?.accounts) { resolve(); return; }
    const interval = setInterval(() => {
      if (window.google?.accounts) { clearInterval(interval); resolve(); }
    }, 100);
  });
  await waitForGIS();
  if (googleClientId && googleClientId !== 'REEMPLAZAR_CON_TU_CLIENT_ID') {
    initGoogleAuth(googleClientId);
    // Auto-connect with cached token; if none, show connect button
    connectDrive().catch(() => setDriveStatus(null));
    document.getElementById('driveConnectBtn')?.addEventListener('click', connectDrive);
  }

  await loadData();
  router();
}

init();
