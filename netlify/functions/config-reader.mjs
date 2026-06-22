/**
 * config-reader — lee Promotores, Salas, Stock y Capacitación desde Google.
 * GET /.netlify/functions/config-reader
 *
 * Env vars:
 *   GOOGLE_SERVICE_ACCOUNT_KEY
 *   GOOGLE_CONFIG_SHEET_ID       — Sheet "Config Nanolife"
 *   GOOGLE_CAPACITACION_FOLDER   — ID carpeta raíz "Capacitación Nanolife" en Drive
 */

async function getToken(key, scope) {
  const k = JSON.parse(key);
  // FIX: Netlify guarda \n como texto literal — restaurar saltos de línea reales
  if (k.private_key && k.private_key.includes('\\n')) {
    k.private_key = k.private_key.replace(/\\n/g, '\n');
  }
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

async function sheetValues(token, sheetId, range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers:{ Authorization:`Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`Sheet ${range}: ${r.status} ${await r.text()}`);
  return (await r.json()).values || [];
}

function toObjects(rows) {
  if (rows.length < 2) return [];
  const h = rows[0].map(x=>x.trim());
  return rows.slice(1).filter(r=>r.some(c=>c?.trim())).map(r=>{
    const o={}; h.forEach((k,i)=>{ o[k]=(r[i]||"").trim(); }); return o;
  });
}

// List files inside a Drive folder
async function driveList(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,webViewLink)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers:{ Authorization:`Bearer ${token}` } }
  );
  if (!r.ok) return [];
  return (await r.json()).files || [];
}

// List subfolders then files within each → training items
async function buildTraining(token, rootFolderId) {
  const subfolders = await driveList(token, rootFolderId);
  const CATEGORY_MAP = {
    "marca":"marca", "nanolife":"marca",
    "limpiapisos":"limpiapisos",
    "detergente":"detergente",
  };

  const items = [];
  await Promise.all(subfolders.map(async folder => {
    if (!folder.mimeType.includes("folder")) return;
    const catKey = Object.keys(CATEGORY_MAP).find(k => folder.name.toLowerCase().includes(k));
    const categoria = catKey ? CATEGORY_MAP[catKey] : "marca";
    const files = await driveList(token, folder.id);
    files.forEach(f => {
      if (f.mimeType.includes("folder")) return;
      const isVideo = f.mimeType.includes("video") || f.name.match(/\.(mp4|mov|avi|webm)$/i);
      const isPdf   = f.mimeType.includes("pdf")   || f.name.match(/\.pdf$/i);
      const isImg   = f.mimeType.includes("image") || f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      items.push({
        id:        f.id,
        tipo:      isVideo ? "video" : isPdf ? "pdf" : isImg ? "imagen" : "pdf",
        categoria,
        titulo:    f.name.replace(/\.[^.]+$/, ''), // sin extensión
        desc:      `${folder.name}`,
        dur:       "—",
        url:       f.webViewLink,
      });
    });
  }));

  return items.sort((a,b) => a.categoria.localeCompare(b.categoria) || a.titulo.localeCompare(b.titulo));
}

export const handler = async (event) => {
  const headers = { "Content-Type":"application/json", "Cache-Control":"public, max-age=300" };
  try {
    const tokenSheet = await getToken(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      "https://www.googleapis.com/auth/spreadsheets.readonly"
    );
    const tokenDrive = await getToken(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      "https://www.googleapis.com/auth/drive.readonly"
    );
    const sheetId = process.env.GOOGLE_CONFIG_SHEET_ID;
    const salesSheetId = process.env.GOOGLE_SHEET_ID;
    const folderId = process.env.GOOGLE_CAPACITACION_FOLDER;

    const [promRows, salaRows, stockRows, training, b2bRows, marcRows] = await Promise.all([
      sheetValues(tokenSheet, sheetId, "Promotores!A:Z"),
      sheetValues(tokenSheet, sheetId, "Salas!A:Z"),
      sheetValues(tokenSheet, sheetId, "Stock!A:Z"),
      folderId ? buildTraining(tokenDrive, folderId) : Promise.resolve([]),
      salesSheetId ? sheetValues(tokenSheet, salesSheetId, "VentasB2B!A:O").catch(()=>[]) : Promise.resolve([]),
      salesSheetId ? sheetValues(tokenSheet, salesSheetId, "Marcaciones!A:L").catch(()=>[]) : Promise.resolve([]),
    ]);

    const promotores = toObjects(promRows).map(p=>{
      // Recoger todas las columnas salaId_DDmmm dinámicamente
      const fechaCols = {};
      Object.entries(p).forEach(([k,v])=>{
        if (k.startsWith("salaId_") && v) fechaCols[k] = v;
      });
      return {
        id:     p.id||p.ID,
        nombre: p.nombre||p.Nombre,
        rut:    (p.rut||p.RUT||p.Rut||"").replace(/[.\-\s]/g,"").toUpperCase(),
        salaId: p.salaId||p.SalaID||p.sala_id||"",
        ...fechaCols,
      };
    }).filter(p=>p.id&&p.nombre);

    const salas = toObjects(salaRows).map(s=>({
      id:        s.id||s.ID,
      codigo:    s.codigo||s.Código||"",
      nombre:    s.nombre||s.Nombre,
      ciudad:    s.ciudad||s.Ciudad,
      lat:       parseFloat(s.lat||s.Latitud||0),
      lng:       parseFloat(s.lng||s.Longitud||0),
      reponedor: s.reponedor||s.Reponedor||null,
      fono:      (s.fono||s.Fono||"").replace(/\s/g,"") || null,
      productos: (s.productos||s.Productos) ? (s.productos||s.Productos).split(",").map(x=>x.trim()).filter(Boolean) : null,
    })).filter(s=>s.id&&s.nombre);

    const stock = {};
    toObjects(stockRows).forEach(r=>{
      const sid = r.salaId||r.SalaID||r.sala_id;
      const pid = r.productoId||r.ProductoID||r.producto_id;
      const u   = parseInt(r.unidades||r.Unidades||0,10);
      if (!sid||!pid) return;
      if (!stock[sid]) stock[sid]={};
      stock[sid][pid] = u;
    });

    // Parsear ventas B2B
    const ventasB2B = toObjects(b2bRows).map(r=>{
      // Normalizar fecha: acepta DD-MM-YYYY, DD/MM/YYYY o YYYY-MM-DD
      let fecha = r["Fecha"]||"";
      if (fecha.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        const [d,m,y] = fecha.split(/[-\/]/);
        fecha = `${y}-${m}-${d}`;
      }
      return {
        fecha,
        storeNbr:  String(parseInt(r["Store Nbr"]||0)),
        storeName: r["Store Name"]||"",
        city:      r["City"]||"",
        itemDesc:  r["Item Desc 1"]||"",
        posQty:    parseFloat(r["POS Qty"]||0),
        posSales:  parseFloat((r["POS Sales"]||"0").replace(/[$,]/g,"")),
      };
    }).filter(r=>r.fecha && r.posQty > 0);

    // Parsear marcaciones del sheet
    const marcaciones = toObjects(marcRows).map(r=>({
      fecha:    r["Fecha"]||r["fecha"]||"",
      promotor: r["Promotor"]||r["promotor"]||"",
      sala:     r["Sala"]||r["sala"]||"",
      ciudad:   r["Ciudad"]||r["ciudad"]||"",
      turno:    (r["Turno"]||r["turno"]||"").toUpperCase(),
      tipo:     r["Tipo"]||r["tipo"]||"",
      hora:     r["Hora"]||r["hora"]||"",
    })).filter(r=>r.fecha && r.promotor);

    return { statusCode:200, headers, body:JSON.stringify({ promotores, salas, stock, training, ventasB2B, marcaciones }) };
  } catch(err) {
    console.error("config-reader error:", err);
    return { statusCode:500, headers, body:JSON.stringify({ error:err.message }) };
  }
};
