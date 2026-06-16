/**
 * drive-upload — genera un upload URL resumable para subir archivos directo a Drive.
 * POST /.netlify/functions/drive-upload
 * Body: { fileName, folderId, mimeType, dataUrl }
 *
 * El archivo se sube en dos pasos:
 * 1. Esta función genera el upload URL (autenticado con service account)
 * 2. La función sube el archivo usando ese URL (sin cuota de service account)
 *
 * Requiere: GOOGLE_SERVICE_ACCOUNT_KEY
 */

async function getToken(key) {
  const k = JSON.parse(key);
  if (k.private_key?.includes('\\n')) k.private_key = k.private_key.replace(/\\n/g, '\n');
  const b64 = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const header = b64(JSON.stringify({ alg:"RS256", typ:"JWT" }));
  const now = Math.floor(Date.now()/1000);
  const claim = b64(JSON.stringify({
    iss: k.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now+3600, iat: now
  }));
  const msg = `${header}.${claim}`;
  const pem = k.private_key.replace(/-----[^-]+-----/g,'').replace(/\n/g,'');
  const bin = Uint8Array.from(atob(pem), c=>c.charCodeAt(0));
  const ck = await crypto.subtle.importKey("pkcs8", bin.buffer,
    { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", ck, new TextEncoder().encode(msg));
  const jwt = `${msg}.${b64(String.fromCharCode(...new Uint8Array(sig)))}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("Auth failed: "+JSON.stringify(d));
  return d.access_token;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode:405, body:"Method Not Allowed" };

  try {
    const { dataUrl, fileName, folderId, mimeType } = JSON.parse(event.body);
    if (!dataUrl || !fileName || !folderId) {
      return { statusCode:400, body:JSON.stringify({ error:"Missing fields" }) };
    }

    // Parse base64
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!matches) return { statusCode:400, body:JSON.stringify({ error:"Invalid dataUrl" }) };
    const mime = mimeType || matches[1];
    const fileBytes = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));

    const token = await getToken(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    // Paso 1: iniciar upload resumable — esto crea el archivo en la carpeta del OWNER
    // (la carpeta pertenece al usuario real, no a la service account)
    const initRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mime,
          "X-Upload-Content-Length": fileBytes.length,
        },
        body: JSON.stringify({
          name: fileName,
          parents: [folderId],
          mimeType: mime,
        }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Init upload failed: ${initRes.status} ${errText}`);
    }

    // El header Location tiene el URL de upload
    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) throw new Error("No upload URL received");

    // Paso 2: subir el contenido al URL resumable
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "Content-Length": fileBytes.length,
      },
      body: fileBytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed: ${uploadRes.status} ${errText}`);
    }

    const file = await uploadRes.json();

    // Hacer el archivo accesible públicamente (reader)
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/permissions?supportsAllDrives=true`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        }
      );
    } catch(e) {
      console.warn("No se pudo hacer público el archivo:", e.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: file.id, webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view` }),
    };

  } catch(err) {
    console.error("drive-upload error:", err.message);
    return { statusCode:500, body:JSON.stringify({ error: err.message }) };
  }
};
