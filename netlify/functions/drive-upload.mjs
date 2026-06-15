/**
 * drive-upload — sube archivos a Google Drive sin dependencias externas.
 * POST /.netlify/functions/drive-upload
 * Body: { dataUrl, fileName, folderId, mimeType? }
 */

async function getToken(key) {
  const k = JSON.parse(key);
  const b64 = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const header = b64(JSON.stringify({ alg:"RS256", typ:"JWT" }));
  const now = Math.floor(Date.now()/1000);
  const claim = b64(JSON.stringify({
    iss:k.client_email,
    scope:"https://www.googleapis.com/auth/drive.file",
    aud:"https://oauth2.googleapis.com/token",
    exp:now+3600, iat:now
  }));
  const msg = `${header}.${claim}`;
  const pem = k.private_key.replace(/-----[^-]+-----/g,'').replace(/\n/g,'');
  const bin = Uint8Array.from(atob(pem), c=>c.charCodeAt(0));
  const ck = await crypto.subtle.importKey("pkcs8", bin.buffer, { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["sign"]);
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
    if (!dataUrl||!fileName||!folderId) return { statusCode:400, body:JSON.stringify({ error:"Missing fields" }) };

    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return { statusCode:400, body:JSON.stringify({ error:"Invalid dataUrl" }) };
    const mime = mimeType||matches[1];
    const fileData = matches[2];

    const token = await getToken(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const boundary = "nl_bound_xyz";
    const meta = JSON.stringify({ name:fileName, parents:[folderId] });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileData}\r\n--${boundary}--`;

    const up = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":`multipart/related; boundary=${boundary}` }, body }
    );
    if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);
    const file = await up.json();

    // Make publicly readable
    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method:"POST",
      headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
      body:JSON.stringify({ role:"reader", type:"anyone" })
    });

    return { statusCode:200, headers:{"Content-Type":"application/json"}, body:JSON.stringify({ fileId:file.id, webViewLink:file.webViewLink }) };
  } catch(err) {
    console.error("drive-upload error:", err);
    return { statusCode:500, body:JSON.stringify({ error:err.message }) };
  }
};
