'use strict';
/* ══════════════════════════════════════════
   SANDRA ENVÍA — script.js
   ══════════════════════════════════════════ */

/* ── Product categories ── */
const CATEGORIES = [
  { name: 'Nuestros Combos',                emoji: '🎁', grad: 'linear-gradient(135deg,#FF4D6D,#C9184A)',    msg: 'Nuestros%20Combos' },
  { name: 'Joginetas, Palazos y Calzas',    emoji: '🩳', grad: 'linear-gradient(135deg,#FF85A1,#FF4D6D)',    msg: 'Joginetas%2C%20Palazos%20y%20Calzas' },
  { name: 'Remeras, Buzos y Sweaters Dama', emoji: '👚', grad: 'linear-gradient(135deg,#FFB3C6,#F72585)',    msg: 'Remeras%2C%20Buzos%20y%20Sweaters%20Dama' },
  { name: 'Damas',                          emoji: '👗', grad: 'linear-gradient(135deg,#F72585,#C9184A)',    msg: 'Damas' },
  { name: 'Hombres',                        emoji: '👔', grad: 'linear-gradient(135deg,#1A1A2E,#2D2D44)',    msg: 'Hombres' },
  { name: 'Niños',                          emoji: '🧒', grad: 'linear-gradient(135deg,#FFD166,#FF9A3C)',    msg: 'Ni%C3%B1os' },
  { name: 'Camperas y Chalecos',            emoji: '🧥', grad: 'linear-gradient(135deg,#6B2D5E,#C9184A)',    msg: 'Camperas%20y%20Chalecos' },
  { name: 'Talles Especiales',              emoji: '✨', grad: 'linear-gradient(135deg,#845EC2,#C9184A)',    msg: 'Talles%20Especiales' },
  { name: 'Camisetas de Argentina',         emoji: '🇦🇷', grad: 'linear-gradient(135deg,#74B9FF,#0984E3)',  msg: 'Camisetas%20de%20Argentina' },
  { name: 'Sastreros',                      emoji: '🎩', grad: 'linear-gradient(135deg,#2D3436,#636E72)',    msg: 'Sastreros' },
];

const WA_NUM  = '5491121802212';
const WA_BASE = `https://wa.me/${WA_NUM}?text=Hola!%20Quiero%20consultar%20por%20`;
const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

/* ── Build product grid ── */
function buildGrid() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  CATEGORIES.forEach((cat, i) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('role', 'listitem');
    card.style.transitionDelay = `${i * 55}ms`;

    const href = `${WA_BASE}${cat.msg}%20de%20Sandra%20Envia`;

    card.innerHTML = `
      <div class="card-img" style="background:${cat.grad}">
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
}

/* ── Intersection observer (scroll reveal + product cards) ── */
function setupReveal() {
  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  );

  document.querySelectorAll('.reveal, .product-card').forEach(el => io.observe(el));
}

/* ── Sticky header shadow ── */
function setupHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── Mobile menu toggle ── */
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

/* ── Smooth scroll for in-page anchors ── */
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

/* ── Floating WhatsApp button visibility ── */
function setupFloating() {
  const btn = document.getElementById('floatingWa');
  if (!btn) return;
  const onScroll = () => btn.classList.toggle('visible', window.scrollY > 380);
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  buildGrid();
  setupReveal();
  setupHeader();
  setupMenu();
  setupSmoothScroll();
  setupFloating();
});
