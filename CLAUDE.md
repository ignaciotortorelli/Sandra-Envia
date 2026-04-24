# CLAUDE.md — Sandra Envía

## Folder structure

```
/                          Base public site
├── index.html             Main page (468 lines) — sections: hero, avisos, cómo comprar,
│                          catálogo, productos (3D carousel), nosotros, envíos, testimonios,
│                          redes, contacto. WA links have class="wa-link".
├── script.js              Base site JS (1394 lines) — see map below
├── style.css              Base site CSS (2073 lines) — see map below
├── Logo.png               Hero logo (static, overridable via settings.logoUrl)
├── ellas-logo.png         Ellas Ituzaingó logo (static, overridable)
├── firebase.config.js     Firebase + Google OAuth credentials (DO NOT LOG)
└── admin-panel/
    ├── index.html         Admin shell (128 lines) — sidebar nav, modal containers
    ├── app.js             Admin JS (2064 lines) — see map below
    ├── style.css          Admin CSS (1138 lines)
    └── google-drive.js    Drive OAuth + upload/delete helpers (188 lines)
```

## Key entry points

| File | Role |
|------|------|
| `script.js:138` `loadCatalog()` | Fetches categories, products, notices, testimonios, refs from Firestore; renders everything |
| `script.js:36` `loadSettings()` | Fetches `settings/main` and calls `applySettings()` — runs on DOMContentLoaded |
| `script.js:43` `applySettings(s)` | Updates WA links, phone, logos, carriers, min order in the DOM |
| `admin-panel/app.js:45` `loadData()` | Loads all 6 Firestore collections for admin |
| `admin-panel/app.js:82` `router()` | Hash-based routing — maps `/`, `/productos`, `/categorias`, `/avisos`, `/testimonios`, `/ajustes` |
| `admin-panel/app.js:1890` `saveSettings()` | Writes `settings/main` via `setDoc` |

## Firestore collections

| Collection | Used by |
|------------|---------|
| `categories` | Catalog carousels, admin table |
| `products` | All product cards, cart, 3D carousel |
| `notices` | Avisos 2D ticker on base site |
| `testimonios` | Testimonios 2D ticker on base site |
| `settings` (doc: `main`) | WA number, carriers, min order, logos, social links |

## Architecture patterns

- **Pure static site** — no build step, no bundler. ES modules via CDN (Firebase v10.12.2).
- **Admin routing** — hash-based (`#/productos`). `topbarActions.innerHTML = ''` clears on every route change.
- **Inline onclick handlers** — functions exposed via `window.X` to be reachable from HTML strings built with template literals.
- **Settings-driven base site** — `applySettings()` updates DOM after Firestore load. Fallback = hardcoded HTML values.
- **Drive images** — always stored as `https://drive.google.com/thumbnail?id=X&sz=w800`. `driveImgUrl()` converts share links.
- **Carousel 2D** — CSS `animation: tRun` infinite ticker. JS takes over on drag via `toJS()`/`toCSS()` in `initTickerDrag`.
- **Carousel 3D** — pure JS `requestAnimationFrame` loop (CSS animation removed on init). See `initCarousel3d()` at `script.js:1269`.

## Where to find what

| What | Where |
|------|-------|
| WA number / message | `firebase.config.js` (default) → overridden by `settings/main.waNumber` |
| Carrier definitions | `admin-panel/app.js` → Settings form; saved to `settings/main.carriers[]` |
| Min purchase enforcement | `script.js:853` `renderCart()` — reads `window._siteSettings.minOrderARS` |
| Effective price logic | `script.js:778` `effectivePrice(item)` (cart) · `script.js:395` `prodEffectivePrice(p)` (modal filter) |
| Drive upload | `admin-panel/google-drive.js:159` `uploadFileToDrive()` |
| Drive delete | `admin-panel/google-drive.js:90` `deleteFileFromDrive()` |
| Seed test data | `admin-panel/app.js:127` `SEED_CATS/SEED_PRODS/SEED_IMG_POOLS/SEED_NOTICES/SEED_TESTIMONIOS` |
| All-products modal filters | `script.js:374` module-level state + `renderModalControls()` / `renderModalProducts()` |
| Dark mode toggle | `script.js:1031` `setupThemeToggle()` · `admin-panel/app.js` `setupThemeToggle()` (separate copies) |
| Category drag-to-reorder | `admin-panel/app.js:955` `catDragStart/Over/Leave/Drop/End` |
| Aviso / testimonio popup | `script.js:1226` `showTickerPopup(item)` |

---

## High token cost zones ⚠️

These files are large and frequently read in full when only a small part is needed.

| File | Lines | Expensive because | Surgical approach |
|------|-------|-------------------|-------------------|
| `admin-panel/app.js` | 2064 | Monolithic — all admin logic in one file | Grep for function name first, then `Read` with `offset`+`limit` |
| `script.js` | 1394 | All base-site JS in one file | Same — grep line number, read ±30 lines |
| `style.css` | 2073 | Entire CSS for base site | Grep class name, read ±20 lines |
| `admin-panel/style.css` | 1138 | Same | Same |

**Specific hot spots:**
- `renderCart()` at `script.js:853` — 120-line function, frequently edited. Read lines 853–980.
- `openProductModal()` at `admin-panel/app.js:1114` — 90-line modal build. Read 1114–1205.
- `renderDashboard()` at `admin-panel/app.js:351` — includes inline seed zone template. Read 351–470.
- `applySettings()` at `script.js:43` — 95 lines. Read 43–140.
- `initTickerDrag()` at `script.js:1103` — 125 lines of carousel logic. Read 1103–1230.

---

## Working with this codebase

**Commonly edited functions and their locations:**

```
script.js
  renderCart()          :853   — cart layout, min purchase, carriers
  effectivePrice()      :778   — pricing logic (also prodEffectivePrice :395)
  applySettings()       :43    — what settings fields update in the DOM
  buildProductCard()    :256   — card HTML, badges, carousel setup
  renderAllProducts()   :315   — 3D carousel slot generation
  initTickerDrag()      :1103  — 2D drag/momentum/popup
  initCarousel3d()      :1269  — 3D rotation/drag/click

admin-panel/app.js
  loadData()            :45    — add new Firestore collections here
  router() / ROUTES     :82    — add new admin routes here
  renderProducts()      :498   — products table with sort/select
  renderAjustes()       :1717  — settings form layout
  saveSettings()        :1877  — settings fields saved to Firestore
  SEED_PRODS            :130   — test data products array
  openProductModal()    :1114  — product edit form HTML
```

**Sensitive files — handle carefully:**
- `firebase.config.js` — contains live API keys and OAuth client ID. Never log full contents.
- `admin-panel/google-drive.js` — OAuth token logic. The `accessToken` variable holds live credentials in memory.

**CSS conventions:**
- Base site dark mode: `[data-theme="dark"]` overrides at the bottom of `style.css` (~line 1580+)
- Admin dark mode: same pattern in `admin-panel/style.css` (~line 800+)
- Discount color: `#16a34a` (green) — `badge-discount`, `.price-discounted`, `.cart-price-note--discount`
- Wholesale color: `#0984E3` (blue) — `card-note-bulk`, `prod-badge-bulk`

---

## Session rules

1. **Confirm scope first.** Before editing, state which file + line range you'll touch. If the task touches >3 functions across >2 files, ask whether to split into a new session.

2. **Read surgically.** Always `grep` for a function name to get its line number, then `Read` with `offset`+`limit`. Never load a full file unless you need its complete structure (e.g., checking imports or a new architectural change).

3. **Flag large tasks.** If a request would require reading `admin-panel/app.js` and `script.js` in their entirety (e.g., "refactor all carousels"), flag it as a candidate for a dedicated session with a fresh context window.

4. **Prefer targeted edits.** Use `Edit` over `Write` for existing files. When the old_string might appear more than once, add extra context lines to make it unique.

5. **Commit atomically.** Group logically related changes in one commit. Don't batch unrelated features.
