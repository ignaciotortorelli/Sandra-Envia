// ══════════════════════════════════════════
//  Google Drive integration
//  admin-panel/google-drive.js
// ══════════════════════════════════════════

const SCOPE            = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const DRIVE_FOLDER_NAME = 'Sandra Envía – Productos';
const TOKEN_KEY        = 'se_drive_token';

let tokenClient   = null;
let accessToken   = null;
let driveFolderId = null;

// ── Token cache (sessionStorage, 55-min expiry) ────────────
function saveToken(token) {
  accessToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
      token,
      expiry: Date.now() + 55 * 60 * 1000,
    }));
  } catch (_) {}
}

function loadCachedToken() {
  try {
    const d = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null');
    if (d?.token && d.expiry > Date.now()) { accessToken = d.token; return true; }
  } catch (_) {}
  return false;
}

function clearToken() {
  accessToken   = null;
  driveFolderId = null;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
}

// ── Init OAuth client ──────────────────────────────────────
export function initGoogleAuth(clientId) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {},
  });
}

// ── Request token (uses cache, no forced consent screen) ───
export function requestToken() {
  if (loadCachedToken()) return Promise.resolve(accessToken);
  return new Promise((resolve, reject) => {
    tokenClient.callback = resp => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      saveToken(resp.access_token);
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export const isSignedIn = () => loadCachedToken();

// ── Sign out ───────────────────────────────────────────────
export function signOutDrive() {
  if (accessToken) {
    try { window.google.accounts.oauth2.revoke(accessToken, () => {}); } catch (_) {}
  }
  clearToken();
}

// ── Get signed-in user info ────────────────────────────────
export async function getDriveUserInfo() {
  try {
    await requestToken();
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return res.json(); // { email, name, picture }
  } catch (_) { return null; }
}

// ── Extract Drive file ID from stored URL ──────────────────
export function driveFileIdFromUrl(url) {
  const m = url?.match(/[?&]id=([^&]+)/);
  return m ? m[1] : null;
}

// ── Delete a file from Drive ───────────────────────────────
export async function deleteFileFromDrive(fileId) {
  await requestToken();
  let res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    clearToken();
    await requestToken();
    res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (!res.ok && res.status !== 404) throw new Error(`Error al borrar de Drive: ${res.status}`);
}

// ── Generic authenticated fetch ────────────────────────────
async function gFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Error ${res.status}`);
  }
  return res.json();
}

// ── Get or create Drive folder ─────────────────────────────
async function getOrCreateFolder() {
  if (driveFolderId) return driveFolderId;

  const q = encodeURIComponent(
    `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const search = await gFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`
  );

  if (search.files?.length) {
    driveFolderId = search.files[0].id;
    return driveFolderId;
  }

  const folder = await gFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  await gFetch(`https://www.googleapis.com/drive/v3/files/${folder.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  driveFolderId = folder.id;
  return driveFolderId;
}

// ── Upload a local File to Drive, return public URL ────────
export async function uploadFileToDrive(file, onProgress) {
  await requestToken();
  const folderId = await getOrCreateFolder();

  onProgress?.('Subiendo imagen a Google Drive…');

  const form = new FormData();
  form.append('metadata', new Blob(
    [JSON.stringify({ name: file.name, parents: [folderId] })],
    { type: 'application/json' }
  ));
  form.append('file', file, file.name);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  if (!res.ok) throw new Error('Error al subir la imagen a Drive');
  const uploaded = await res.json();

  onProgress?.('Configurando acceso público…');
  await gFetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w800`;
}
