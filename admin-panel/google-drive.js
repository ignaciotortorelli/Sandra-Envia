// ══════════════════════════════════════════
//  Google Photos → Drive integration
//  admin-panel/google-drive.js
// ══════════════════════════════════════════

const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const DRIVE_FOLDER_NAME = 'Sandra Envía – Productos';

let tokenClient  = null;
let accessToken  = null;
let driveFolderId = null;

// ── Init OAuth client ──────────────────────────────────────
export function initGoogleAuth(clientId) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
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
    // Skip consent screen if we already have a token
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

// ── List Google Photos ─────────────────────────────────────
export async function listPhotos(pageToken = null) {
  const params = new URLSearchParams({ pageSize: '24' });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(
    `https://photoslibrary.googleapis.com/v1/mediaItems?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Error al listar fotos: ${res.status}`);
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

  // Create folder
  const folder = await gFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  // Make folder publicly readable
  await gFetch(`https://www.googleapis.com/drive/v3/files/${folder.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  driveFolderId = folder.id;
  return driveFolderId;
}

// ── Copy photo from Google Photos to Drive ─────────────────
// Returns the permanent public URL of the Drive file
export async function copyPhotoToDrive(mediaItem, onProgress) {
  const folderId = await getOrCreateFolder();

  // Download original from Google Photos
  onProgress?.('Descargando foto de Google Photos…');
  const downloadUrl = `${mediaItem.baseUrl}=d`;
  const imgRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!imgRes.ok) throw new Error('No se pudo descargar la foto de Google Photos');
  const blob = await imgRes.blob();

  // Upload to Google Drive (multipart)
  onProgress?.('Subiendo a Google Drive…');
  const filename = mediaItem.filename || `foto_${Date.now()}.jpg`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', blob, filename);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  if (!uploadRes.ok) throw new Error('Error al subir la foto a Drive');
  const file = await uploadRes.json();

  // Set file as publicly readable
  onProgress?.('Configurando acceso público…');
  await gFetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return `https://drive.google.com/uc?export=view&id=${file.id}`;
}
