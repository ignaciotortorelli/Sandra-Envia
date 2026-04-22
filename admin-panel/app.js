// ══════════════════════════════════════════
//  SANDRA ENVÍA — Admin Panel app.js
// ══════════════════════════════════════════
import { initializeApp }                                    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc,
         updateDoc, deleteDoc, doc, serverTimestamp }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, googleClientId }                   from '../firebase.config.js';
import { initGoogleAuth, requestToken, uploadFileToDrive,
         deleteFileFromDrive, driveFileIdFromUrl }          from './google-drive.js';

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
    </div>`;
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

  const rows = products.map(p => {
    const cat  = categories.find(c => c.id === p.categoryId);
    const imgs = (p.images ?? []).slice(0, 3);
    const thumbs = imgs.length
      ? imgs.map(url => `<img class="thumb" src="${url}" alt="" loading="lazy" onclick="openAdminPhotoGallery('${p.id}')" style="cursor:zoom-in">`).join('')
      : `<div class="thumb-placeholder">📷</div>`;

    return `
      <tr>
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

  content.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Mínimo</th>
            <th>Stock</th>
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

  const rows = categories.map(c => `
    <tr>
      <td><div class="grad-preview" style="background:${c.gradient ?? '#ccc'}">${c.emoji ?? ''}</div></td>
      <td><strong>${c.name}</strong></td>
      <td>${c.order ?? 0}</td>
      <td><span class="badge ${c.active !== false ? 'badge-green' : 'badge-gray'}">${c.active !== false ? 'Activa' : 'Inactiva'}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon edit"   onclick="openCategoryModal('${c.id}')" title="Editar">✏️</button>
          <button class="btn-icon delete" onclick="confirmDelete('category','${c.id}','${c.name?.replace(/'/g, "\\'")}')" title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  content.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Vista previa</th>
            <th>Nombre</th>
            <th>Orden</th>
            <th>Estado</th>
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
  const overlay = document.getElementById('confirmOverlay');
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

async function doDelete(type, id) {
  try {
    if (type === 'product') {
      const prod = products.find(p => p.id === id);
      let driveErrors = 0;
      for (const url of (prod?.images ?? [])) {
        const fileId = driveFileIdFromUrl(url);
        if (fileId) {
          try { await deleteFileFromDrive(fileId); }
          catch (e) { console.warn('Drive delete failed:', e); driveErrors++; }
        }
      }
      if (driveErrors) toast(`Advertencia: ${driveErrors} imagen(es) no se pudieron borrar de Drive`, 'error');
      await deleteDoc(doc(db, 'products', id));
      toast('Producto eliminado', 'success');
      await loadData();
      renderProducts();
    } else {
      await deleteDoc(doc(db, 'categories', id));
      toast('Categoría eliminada', 'success');
      await loadData();
      renderCategories();
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
async function init() {
  setupMobileMenu();
  setupModalClose();

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
  }

  await loadData();
  router();
}

init();
