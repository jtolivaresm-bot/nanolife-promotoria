/**
 * TEMPORAL — diagnóstico para inspeccionar la estructura del Sheet de precios de
 * competencia antes de construir la feature real. Borrar este archivo una vez
 * confirmada la estructura (tabs, headers, columnas).
 * GET /.netlify/functions/_debug-precios
 */

const PRECIOS_SHEET_ID = "1a6ubAF5sZjVrqmtesLbgpi8mOl-6hIs2xkkMlbik5lY";

async function getToken(key, scope) {
  const k = JSON.parse(key);
  if (k.private_key?.includes('\\n')) k.private_key = k.private_key.replace(/\\n/g, '\n');
  const b64 = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const header = b64(JSON.stringify({ alg:"RS256", typ:"JWT" }));
  const now = Math.floor(Date.now()/1000);
  const claim = b64(JSON.stringify({ iss:k.client_email, scope, aud:"https://oauth2.googleapis.com/token", exp:now+3600, iat:now }));
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

export const handler = async () => {
  const headers = { "Content-Type": "application/json" };
  try {
    const token = await getToken(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, "https://www.googleapis.com/auth/spreadsheets.readonly");

    // 1. Metadata: lista de tabs (nombre + gid)
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${PRECIOS_SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) throw new Error(`metadata: ${metaRes.status} ${await metaRes.text()}`);
    const meta = await metaRes.json();
    const tabs = (meta.sheets||[]).map(s=>s.properties);

    // 2. Primeras filas de cada tab, para ver headers/estructura
    const muestras = {};
    for (const t of tabs) {
      const range = `${t.title}!A1:J15`;
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${PRECIOS_SHEET_ID}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      muestras[t.title] = r.ok ? (await r.json()).values || [] : `ERROR ${r.status}`;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ tabs, muestras }, null, 2) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
