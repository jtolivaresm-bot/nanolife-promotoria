/**
 * Netlify Function: drive-upload
 * POST /.netlify/functions/drive-upload
 *
 * Body: { dataUrl, fileName, folderId, mimeType? }
 * Returns: { fileId, webViewLink }
 *
 * Requiere en Netlify Environment Variables:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — JSON completo de la service account (en una sola línea)
 */

import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";
import { Readable } from "stream";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { dataUrl, fileName, folderId, mimeType } = JSON.parse(event.body);

    if (!dataUrl || !fileName || !folderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
    }

    // Parse base64
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return { statusCode: 400, body: JSON.stringify({ error: "Invalid dataUrl" }) };
    const detectedMime = mimeType || matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    // Auth con service account
    const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new GoogleAuth({
      credentials: keyJson,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    const stream = Readable.from(buffer);

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: detectedMime,
      },
      media: { mimeType: detectedMime, body: stream },
      fields: "id,webViewLink",
    });

    // Hacer el archivo accesible con link (lectura)
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: res.data.id,
        webViewLink: res.data.webViewLink,
      }),
    };
  } catch (err) {
    console.error("drive-upload error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
