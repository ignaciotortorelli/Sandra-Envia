// ══════════════════════════════════════════
//  Google Drive integration
//  admin-panel/google-drive.js
// ══════════════════════════════════════════

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'Sandra Envía – Productos';

let tokenClient  = null;
let accessToken  = null;
let driveFolderId = null;

// ── Init OAuth client ──────────────────────────────────────
export function initGoogleAuth(clientId) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {},
  });
}

// ── Request / refresh token ────────────────────────────────
export function requestToken() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = resp => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

export const isSignedIn = () => !!accessToken;

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

  return `https://drive.google.com/uc?export=view&id=${uploaded.id}`;
}
