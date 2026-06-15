/**
 * googleApi.js
 * Calls our own Netlify Functions which hold the Google credentials securely.
 * The React app never sees the service-account key.
 */

const BASE = "/.netlify/functions";

/* ─── GOOGLE DRIVE ─── */

/**
 * Sube una foto (base64 dataURL) a Google Drive y devuelve el fileId + webViewLink.
 * @param {string} dataUrl   - "data:image/jpeg;base64,..."
 * @param {string} fileName  - e.g. "entrada_AM_Camila_2026-06-14.jpg"
 * @param {string} folderId  - ID de la carpeta destino en Drive
 */
export async function uploadFotoToDrive(dataUrl, fileName, folderId) {
  const res = await fetch(`${BASE}/drive-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, fileName, folderId }),
  });
  if (!res.ok) throw new Error(`Drive upload error: ${res.status}`);
  return res.json(); // { fileId, webViewLink }
}

/**
 * Sube el audio (base64 dataURL) a Google Drive.
 */
export async function uploadAudioToDrive(dataUrl, fileName, folderId) {
  const res = await fetch(`${BASE}/drive-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, fileName, folderId, mimeType: "audio/webm" }),
  });
  if (!res.ok) throw new Error(`Drive audio upload error: ${res.status}`);
  return res.json();
}

/* ─── GOOGLE SHEETS ─── */

/**
 * Registra una marcación (entrada o salida) en el Sheet de marcaciones.
 */
export async function appendMarcacion(row) {
  // row: { promotor, sala, fecha, turno, tipo, hora, lat, lng, dist, enLocal }
  const res = await fetch(`${BASE}/sheets-append`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet: "Marcaciones", row }),
  });
  if (!res.ok) throw new Error(`Sheets marcacion error: ${res.status}`);
  return res.json();
}

/**
 * Registra las ventas de un turno en el Sheet de ventas.
 * Se llama al marcar la salida de cada turno.
 */
export async function appendVentas(rows) {
  // rows: array de { promotor, sala, fecha, turno, producto, unidades, precio, comision }
  const res = await fetch(`${BASE}/sheets-append`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet: "Ventas", rows }),
  });
  if (!res.ok) throw new Error(`Sheets ventas error: ${res.status}`);
  return res.json();
}

/**
 * Registra el audio de cierre en el Sheet de cierres.
 */
export async function appendCierre(row) {
  // row: { promotor, sala, fecha, audioUrl, comisionAM, comisionPM, comisionTotal }
  const res = await fetch(`${BASE}/sheets-append`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet: "Cierres", row }),
  });
  if (!res.ok) throw new Error(`Sheets cierre error: ${res.status}`);
  return res.json();
}
