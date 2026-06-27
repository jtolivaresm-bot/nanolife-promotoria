/**
 * check-marcaciones — consulta el estado de marcaciones del día para un promotor.
 * GET /.netlify/functions/check-marcaciones?promotor=Rodrigo+Correa&fecha=2026-06-27
 */

async function getToken(key) {
  const k = JSON.parse(key);
  if (k.private_key?.includes('\\n')) k.private_key = k.private_key.replace(/\\n/g, '\n');
  const b64 = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const header = b64(JSON.stringify({ alg:"RS256", typ:"JWT" }));
  const now = Math.floor(Date.now()/1000);
  const claim = b64(JSON.stringify({
    iss: k.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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
  if (!d.access_token) throw new Error("Auth failed");
  return d.access_token;
}

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const { promotor, fecha } = event.queryStringParameters || {};
    if (!promotor || !fecha) {
      return { statusCode:400, headers, body: JSON.stringify({ error:"Faltan parámetros" }) };
    }

    const token = await getToken(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Marcaciones!A:G")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) throw new Error(`Sheet error: ${r.status}`);
    const { values = [] } = await r.json();

    if (values.length < 2) {
      return { statusCode:200, headers, body: JSON.stringify({ amE:false, amS:false, pmE:false, pmS:false }) };
    }

    const hdrs = values[0].map(h => String(h).trim());
    const iFecha    = hdrs.indexOf("Fecha");
    const iPromotor = hdrs.indexOf("Promotor");
    const iTurno    = hdrs.indexOf("Turno");
    const iTipo     = hdrs.indexOf("Tipo");

    const rows = values.slice(1).filter(r =>
      String(r[iFecha]||"").trim() === fecha &&
      String(r[iPromotor]||"").trim() === promotor
    );

    const tiene = (turno, tipo) => rows.some(r =>
      String(r[iTurno]||"").trim().toUpperCase() === turno &&
      String(r[iTipo]||"").trim() === tipo
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        amE: tiene("AM","Entrada"),
        amS: tiene("AM","Salida"),
        pmE: tiene("PM","Entrada"),
        pmS: tiene("PM","Salida"),
      }),
    };
  } catch(err) {
    console.error("check-marcaciones error:", err.message);
    return { statusCode:500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
