/**
 * TEMPORAL — diagnóstico para inspeccionar el Sheet de precios de competencia antes de
 * construir la feature real. Borrar este archivo una vez confirmada la estructura.
 * GET /.netlify/functions/debug-precios
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

    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${PRECIOS_SHEET_ID}/values/${encodeURIComponent("Precios_Competencia!A:J")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const rows = (await r.json()).values || [];
    const head = rows[0] || [];
    const body = rows.slice(1);
    const col = n => head.indexOf(n);

    const iCat = col("categoria"), iMarca = col("marca"), iCadena = col("cadena"), iFecha = col("fecha"), iMl = col("ml");

    // Resumen agregado (evita devolver miles de filas)
    const cuenta = (idx) => {
      const m = {};
      body.forEach(r => { const v = (r[idx]||"(vacío)").trim(); m[v] = (m[v]||0)+1; });
      return Object.entries(m).sort((a,b)=>b[1]-a[1]);
    };

    const iProd = col("producto"), iNorm = col("precio_normal"), iTarj = col("precio_tarjeta");
    // "limpiador" mezcla limpiapisos con antigrasa/multiuso: filtramos por nombre de producto.
    const esPiso = r => (r[iCat]||"").toLowerCase()==="limpiador"
      && /piso/i.test(r[iProd]||"");
    const pisos = body.filter(esPiso).map(r=>({
      fecha:r[iFecha], cadena:r[iCadena], marca:r[iMarca], producto:r[iProd],
      normal:r[iNorm], tarjeta:r[iTarj], ml:r[iMl],
    }));
    const nanolife = body.filter(r => (r[iMarca]||"").toLowerCase().includes("nanolife"));

    return { statusCode: 200, headers, body: JSON.stringify({
      totalFilas: body.length,
      headers: head,
      categorias: cuenta(iCat),
      cadenas: cuenta(iCadena),
      fechas: cuenta(iFecha).slice(0,10),
      marcasTop: cuenta(iMarca).slice(0,25),
      pisosCount: pisos.length,
      pisos,
      nanolifeCount: nanolife.length,
      nanolifeFilas: nanolife.slice(0,40),
    }, null, 2) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
