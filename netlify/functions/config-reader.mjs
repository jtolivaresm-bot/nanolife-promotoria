/**
 * config-reader — lee Promotores, Salas, Stock, VentasB2B y Marcaciones.
 * GET /.netlify/functions/config-reader
 * Cache: 5 minutos
 */

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

async function sheetValues(token, sheetId, range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers:{ Authorization:`Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`Sheet ${range}: ${r.status} ${await r.text()}`);
  return (await r.json()).values || [];
}

function toObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0].map(x => String(x||"").trim());
  return rows.slice(1)
    .filter(r => r.some(c => c?.toString().trim()))
    .map(r => {
      const o = {};
      h.forEach((k,i) => { o[k] = String(r[i]||"").trim(); });
      return o;
    });
}

async function buildTraining(token, folderId) {
  async function driveList(fid) {
    const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,webViewLink)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers:{ Authorization:`Bearer ${token}` } }
    );
    if (!r.ok) return [];
    return (await r.json()).files || [];
  }
  // Cada subcarpeta es una sección. El nombre de la carpeta es el título de la sección.
  // Prefijo numérico opcional ("01 Presentación") solo controla el orden; se quita del título.
  const cleanLabel = name => name.replace(/^\s*\d+\s*[-._)]?\s+/, "").trim() || name.trim();
  const slug = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "seccion";

  const subfolders = await driveList(folderId);
  // Solo carpetas, en el orden que devuelve Drive (orderBy=name → los prefijos numéricos ordenan bien)
  const folders = subfolders.filter(sf => sf.mimeType === "application/vnd.google-apps.folder");
  const result = [];
  let orden = 0;
  for (const sf of folders) {
    const label = cleanLabel(sf.name);
    const categoria = slug(label);
    const files = await driveList(sf.id);
    for (const f of files) {
      if (f.mimeType === "application/vnd.google-apps.folder") continue;
      const ext = f.name.split(".").pop()?.toLowerCase();
      const tipo = ["mp4","mov","avi","webm","m4v"].includes(ext) ? "video"
        : ["jpg","jpeg","png","gif","webp"].includes(ext) ? "imagen"
        : "documento";
      result.push({ id:f.id, tipo, categoria, categoriaLabel:label, orden, titulo:f.name.replace(/\.[^.]+$/,""), desc:"", dur:"—", url:f.webViewLink });
    }
    orden++;
  }
  return result;
}

export const handler = async () => {
  const headers = { "Content-Type":"application/json", "Cache-Control":"public, max-age=300" };

  try {
    const KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const configSheetId = process.env.GOOGLE_CONFIG_SHEET_ID;
    const salesSheetId  = process.env.GOOGLE_SHEET_ID;
    const folderId      = process.env.GOOGLE_CAPACITACION_FOLDER;
    // Sheet de retail intelligence (pestaña Precios_Competencia). Configurable por env var;
    // si no está, se usa el sheet conocido — así funciona sin tocar Netlify.
    const preciosSheetId = process.env.GOOGLE_PRECIOS_SHEET_ID || "1a6ubAF5sZjVrqmtesLbgpi8mOl-6hIs2xkkMlbik5lY";

    // Token para Sheets y para Drive (en paralelo)
    const [tokenSheet, tokenDrive] = await Promise.all([
      getToken(KEY, "https://www.googleapis.com/auth/spreadsheets.readonly"),
      getToken(KEY, "https://www.googleapis.com/auth/drive.readonly"),
    ]);

    // Leer config (promotores/salas/stock) y ventas en paralelo
    // Capacitación y Marcaciones son opcionales y no bloquean
    const [promRows, salaRows, stockRows, b2bRows, marcRows, capacRows, preciosRows, training] = await Promise.all([
      sheetValues(tokenSheet, configSheetId, "Promotores!A:Z"),
      sheetValues(tokenSheet, configSheetId, "Salas!A:Z"),
      sheetValues(tokenSheet, configSheetId, "Stock!A:Z"),
      salesSheetId ? sheetValues(tokenSheet, salesSheetId, "VentasB2B!A:O").catch(()=>[]) : Promise.resolve([]),
      salesSheetId ? sheetValues(tokenSheet, salesSheetId, "Marcaciones!A:L").catch(()=>[]) : Promise.resolve([]),
      // Progreso de capacitación (opcional; no bloquea si la hoja aún no existe)
      salesSheetId ? sheetValues(tokenSheet, salesSheetId, "CapacitacionProgreso!A:G").catch(()=>[]) : Promise.resolve([]),
      // Precios de competencia (sheet aparte de retail intelligence; opcional)
      preciosSheetId ? sheetValues(tokenSheet, preciosSheetId, "Precios_Competencia!A:J").catch(()=>[]) : Promise.resolve([]),
      folderId ? buildTraining(tokenDrive, folderId).catch(()=>[]) : Promise.resolve([]),
    ]);

    // Promotores
    const promotores = toObjects(promRows).map(p=>{
      const fechaCols = {};
      Object.entries(p).forEach(([k,v])=>{ if (k.startsWith("salaId_") && v) fechaCols[k] = v; });
      return {
        id:     p.id||p.ID,
        nombre: p.nombre||p.Nombre,
        rut:    (p.rut||p.RUT||p.Rut||"").replace(/[.\-\s]/g,"").toUpperCase(),
        salaId: p.salaId||p.SalaID||p.sala_id||"",
        ...fechaCols,
      };
    }).filter(p=>p.id&&p.nombre);

    // Salas
    const salas = toObjects(salaRows).map(s=>({
      id:        s.id||s.ID,
      codigo:    s.codigo||s.Código||"",
      nombre:    s.nombre||s.Nombre,
      ciudad:    s.ciudad||s.Ciudad,
      lat:       parseFloat(s.lat||s.Latitud||0),
      lng:       parseFloat(s.lng||s.Longitud||0),
      reponedor: s.reponedor||s.Reponedor||null,
      fono:      (s.fono||s.Fono||"").replace(/\s/g,"")||null,
      productos: (s.productos||s.Productos) ? (s.productos||s.Productos).split(",").map(x=>x.trim()).filter(Boolean) : null,
    })).filter(s=>s.id&&s.nombre);

    // Stock
    const stock = {};
    toObjects(stockRows).forEach(r=>{
      const sid = r.salaId||r.SalaID||r.sala_id;
      const pid = r.productoId||r.ProductoID||r.producto_id;
      const u   = parseInt(r.unidades||r.Unidades||0,10);
      if (!sid||!pid) return;
      if (!stock[sid]) stock[sid]={};
      stock[sid][pid] = u;
    });

    // Ventas B2B
    const ventasB2B = toObjects(b2bRows).map(r=>{
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

    // Marcaciones
    const marcaciones = toObjects(marcRows).map(r=>({
      fecha:    r["Fecha"]||r["fecha"]||"",
      promotor: r["Promotor"]||r["promotor"]||"",
      sala:     r["Sala"]||r["sala"]||"",
      turno:    (r["Turno"]||r["turno"]||"").toUpperCase(),
      tipo:     r["Tipo"]||r["tipo"]||"",
      hora:     r["Hora"]||r["hora"]||"",
    })).filter(r=>r.fecha && r.promotor);

    // Progreso de capacitación: una fila por (promotorId, itemId) visto
    const capacitacion = toObjects(capacRows).map(r=>({
      promotorId: r["PromotorId"]||r["promotorId"]||"",
      itemId:     r["ItemId"]||r["itemId"]||"",
      fecha:      r["Fecha"]||r["fecha"]||"",
    })).filter(r=>r.promotorId && r.itemId);

    // Precios de competencia → comparativo precio por litro, para que el promotor tenga el
    // argumento a mano en sala. Solo se envía la medición MÁS RECIENTE de cada cadena
    // (la planilla acumula histórico) y solo filas con litraje y precio, que son las
    // únicas comparables litro a litro.
    const precios = (()=>{
      const filas = toObjects(preciosRows).map(r=>{
        const num = v => {
          const n = parseFloat(String(v||"").replace(/[^0-9.,]/g,"").replace(/\.(?=\d{3}\b)/g,"").replace(",","."));
          return isNaN(n) ? 0 : n;
        };
        const ml     = num(r["ml"]);
        const precio = num(r["precio_normal"]);
        const prod   = r["producto"]||"";
        const cat    = (r["categoria"]||"").trim();
        // "limpiador" mezcla limpiapisos con antigrasa/multiuso: los de piso se separan
        // en su propia categoría para poder compararlos entre sí.
        const categoria = (cat==="limpiador" && /piso/i.test(prod)) ? "limpiapisos" : cat;
        return {
          fecha:    r["fecha"]||"",
          cadena:   (r["cadena"]||"").trim().toUpperCase(),
          categoria,
          marca:    (r["marca"]||"").trim(),
          producto: prod,
          precio,
          ml,
          litro:    ml>0 ? Math.round(precio/(ml/1000)) : 0,
          esNanolife: /nanolife/i.test(r["marca"]||""),
        };
      }).filter(r=>r.cadena && r.categoria && r.ml>0 && r.precio>0);

      // Última fecha medida por cadena (cada cadena se releva en días distintos)
      const ultima = {};
      filas.forEach(r=>{ if(r.fecha > (ultima[r.cadena]||"")) ultima[r.cadena] = r.fecha; });
      return filas.filter(r=>r.fecha === ultima[r.cadena]);
    })();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ promotores, salas, stock, training, ventasB2B, marcaciones, capacitacion, precios }),
    };

  } catch(err) {
    console.error("config-reader error:", err.message);
    return { statusCode:500, headers, body:JSON.stringify({ error:err.message }) };
  }
};
