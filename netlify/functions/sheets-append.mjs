/**
 * sheets-append — escribe filas en Google Sheets sin dependencias externas.
 * POST /.netlify/functions/sheets-append
 * Body: { sheet, row? {}, rows? [] }
 */

async function getToken(key) {
  const k = JSON.parse(key);
  const b64 = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const header = b64(JSON.stringify({ alg:"RS256", typ:"JWT" }));
  const now = Math.floor(Date.now()/1000);
  const claim = b64(JSON.stringify({
    iss:k.client_email,
    scope:"https://www.googleapis.com/auth/spreadsheets",
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

const COLS = {
  Marcaciones: ["Fecha","Promotor","Sala","Ciudad","Turno","Tipo","Hora","Latitud","Longitud","Precisión (m)","Distancia al local (m)","En local"],
  Ventas:      ["Fecha","Promotor","Sala","Ciudad","Turno","Producto","Unidades","Precio unitario","Comisión unitaria","Comisión total"],
  Cierres:     ["Fecha","Promotor","Sala","Ciudad","Comisión AM","Comisión PM","Comisión Total","Audio URL"],
};
const KEYS = {
  fecha:"Fecha", promotor:"Promotor", sala:"Sala", ciudad:"Ciudad",
  turno:"Turno", tipo:"Tipo", hora:"Hora", lat:"Latitud", lng:"Longitud",
  acc:"Precisión (m)", dist:"Distancia al local (m)", enLocal:"En local",
  producto:"Producto", unidades:"Unidades", precio:"Precio unitario",
  comisionUnit:"Comisión unitaria", comisionTotal:"Comisión total",
  comisionAM:"Comisión AM", comisionPM:"Comisión PM",
  comisionTotalDia:"Comisión Total", audioUrl:"Audio URL",
};

function toRow(sheet, data) {
  return COLS[sheet].map(col => {
    const key = Object.entries(KEYS).find(([,v])=>v===col)?.[0];
    const val = data[key]??data[col]??"";
    return typeof val==="boolean" ? (val?"Sí":"No") : String(val);
  });
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode:405, body:"Method Not Allowed" };
  try {
    const { sheet, row, rows } = JSON.parse(event.body);
    if (!sheet||(!row&&!rows)) return { statusCode:400, body:JSON.stringify({ error:"Missing sheet or row(s)" }) };

    const token = await getToken(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const values = rows ? rows.map(r=>toRow(sheet,r)) : [toRow(sheet,row)];

    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheet+"!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify({ values }) }
    );
    if (!r.ok) throw new Error(`Sheets error: ${r.status} ${await r.text()}`);
    const d = await r.json();
    return { statusCode:200, headers:{"Content-Type":"application/json"}, body:JSON.stringify({ updated:d.updates?.updatedRows??values.length }) };
  } catch(err) {
    console.error("sheets-append error:", err);
    return { statusCode:500, body:JSON.stringify({ error:err.message }) };
  }
};
