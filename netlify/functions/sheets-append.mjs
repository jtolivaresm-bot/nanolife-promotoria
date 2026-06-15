/**
 * Netlify Function: sheets-append
 * POST /.netlify/functions/sheets-append
 *
 * Body: { sheet: "Marcaciones"|"Ventas"|"Cierres", row? {}, rows? [] }
 * Returns: { updated }
 *
 * Requiere en Netlify Environment Variables:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — JSON completo de la service account
 *   GOOGLE_SHEET_ID             — ID del Google Sheet (de la URL)
 */

import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

// Columnas de cada hoja (deben coincidir con las cabeceras del Sheet)
const SHEET_COLUMNS = {
  Marcaciones: [
    "Fecha", "Promotor", "Sala", "Ciudad", "Turno", "Tipo",
    "Hora", "Latitud", "Longitud", "Precisión (m)", "Distancia al local (m)", "En local",
  ],
  Ventas: [
    "Fecha", "Promotor", "Sala", "Ciudad", "Turno",
    "Producto", "Unidades", "Precio unitario", "Comisión unitaria", "Comisión total",
  ],
  Cierres: [
    "Fecha", "Promotor", "Sala", "Ciudad",
    "Comisión AM", "Comisión PM", "Comisión Total", "Audio URL",
  ],
};

function rowToArray(sheet, data) {
  const cols = SHEET_COLUMNS[sheet];
  const keyMap = {
    // Marcaciones
    fecha: "Fecha", promotor: "Promotor", sala: "Sala", ciudad: "Ciudad",
    turno: "Turno", tipo: "Tipo", hora: "Hora",
    lat: "Latitud", lng: "Longitud", acc: "Precisión (m)",
    dist: "Distancia al local (m)", enLocal: "En local",
    // Ventas
    producto: "Producto", unidades: "Unidades",
    precio: "Precio unitario", comisionUnit: "Comisión unitaria", comisionTotal: "Comisión total",
    // Cierres
    comisionAM: "Comisión AM", comisionPM: "Comisión PM",
    comisionTotalDia: "Comisión Total", audioUrl: "Audio URL",
  };
  return cols.map(col => {
    const key = Object.entries(keyMap).find(([, v]) => v === col)?.[0];
    const val = data[key] ?? data[col] ?? "";
    if (typeof val === "boolean") return val ? "Sí" : "No";
    return String(val);
  });
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { sheet, row, rows } = JSON.parse(event.body);

    if (!sheet || (!row && !rows)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing sheet or row(s)" }) };
    }

    const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new GoogleAuth({
      credentials: keyJson,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const values = rows
      ? rows.map(r => rowToArray(sheet, r))
      : [rowToArray(sheet, row)];

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheet}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updated: res.data.updates?.updatedRows ?? values.length }),
    };
  } catch (err) {
    console.error("sheets-append error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
