/**
 * useGoogleSync.js
 * 
 * Llama a las Netlify Functions en los momentos clave:
 *   - Al marcar entrada/salida → sheets Marcaciones + fotos a Drive
 *   - Al registrar ventas (salida) → sheets Ventas
 *   - Al guardar audio de cierre → Drive + sheets Cierres
 * 
 * Configuración requerida en src/config.js:
 *   DRIVE_FOTOS_FOLDER_ID  — ID carpeta Drive para fotos
 *   DRIVE_AUDIO_FOLDER_ID  — ID carpeta Drive para audios
 */

import { uploadFotoToDrive, uploadAudioToDrive, appendMarcacion, appendVentas, appendCierre } from "./googleApi.js";
import { DRIVE_FOTOS_FOLDER_ID, DRIVE_AUDIO_FOLDER_ID } from "./config.js";
import { PRODUCTOS } from "./App.jsx";

/**
 * Sincroniza una marcación de entrada o salida.
 * - Sube fotos a Drive (solo entrada AM)
 * - Registra en Sheets
 */
export async function syncMarcacion({ promotor, sala, fecha, turno, tipo, stamp, fotosProducto, cantidades }) {
  const errors = [];
  const driveLinks = {};

  // 1. Subir fotos de góndola a Drive (solo entrada AM)
  if (tipo === "entrada" && turno === "am" && fotosProducto) {
    for (const [pid, dataUrl] of Object.entries(fotosProducto)) {
      if (!dataUrl) continue;
      const prod = PRODUCTOS.find(p => p.id === pid);
      const fileName = `${fecha}_${promotor.nombre.replace(/ /g,"_")}_${sala.codigo||sala.id}_${prod?.nombre.replace(/ /g,"_")}.jpg`;
      try {
        const { webViewLink } = await uploadFotoToDrive(dataUrl, fileName, DRIVE_FOTOS_FOLDER_ID);
        driveLinks[pid] = webViewLink;
      } catch (e) {
        errors.push(`Foto ${pid}: ${e.message}`);
      }
    }
  }

  // 2. Registrar marcación en Sheets
  try {
    await appendMarcacion({
      fecha,
      promotor: promotor.nombre,
      sala: sala.nombre,
      ciudad: sala.ciudad,
      turno: turno.toUpperCase(),
      tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
      hora: new Date(stamp.ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      lat: stamp.lat ?? "",
      lng: stamp.lng ?? "",
      acc: stamp.acc ?? "",
      dist: stamp.dist ?? "",
      enLocal: stamp.dist != null && stamp.dist <= 200,
    });
  } catch (e) {
    errors.push(`Marcación sheet: ${e.message}`);
  }

  return { driveLinks, errors };
}

/**
 * Sincroniza las ventas de un turno al marcar la salida.
 */
export async function syncVentas({ promotor, sala, fecha, turno, cantidades }) {
  if (!cantidades || Object.keys(cantidades).length === 0) return { errors: [] };
  const errors = [];
  const rows = [];

  for (const [pid, qty] of Object.entries(cantidades)) {
    if (!qty) continue;
    const prod = PRODUCTOS.find(p => p.id === pid);
    if (!prod) continue;
    rows.push({
      fecha,
      promotor: promotor.nombre,
      sala: sala.nombre,
      ciudad: sala.ciudad,
      turno: turno.toUpperCase(),
      producto: prod.nombre,
      unidades: qty,
      precio: prod.precio,
      comisionUnit: prod.comision,
      comisionTotal: qty * prod.comision,
    });
  }

  if (rows.length > 0) {
    try {
      await appendVentas(rows);
    } catch (e) {
      errors.push(`Ventas sheet: ${e.message}`);
    }
  }

  return { errors };
}

/**
 * Sincroniza el audio de cierre y el resumen del día.
 */
export async function syncCierre({ promotor, sala, fecha, audioDataUrl, audioFileName, comm }) {
  const errors = [];
  let audioUrl = "";

  // 1. Subir audio a Drive
  if (audioDataUrl) {
    try {
      const fileName = audioFileName || `${fecha}_${promotor.nombre.replace(/ /g,"_")}_cierre.webm`;
      const { webViewLink } = await uploadAudioToDrive(audioDataUrl, fileName, DRIVE_AUDIO_FOLDER_ID);
      audioUrl = webViewLink;
    } catch (e) {
      errors.push(`Audio Drive: ${e.message}`);
    }
  }

  // 2. Registrar cierre en Sheets
  try {
    await appendCierre({
      fecha,
      promotor: promotor.nombre,
      sala: sala.nombre,
      ciudad: sala.ciudad,
      comisionAM: comm.am.base,
      comisionPM: comm.pm.base,
      comisionTotalDia: comm.total,
      audioUrl,
    });
  } catch (e) {
    errors.push(`Cierre sheet: ${e.message}`);
  }

  return { audioUrl, errors };
}
