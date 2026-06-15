/**
 * test-google — endpoint de diagnóstico.
 * Abre en el navegador: https://TU-SITIO.netlify.app/.netlify/functions/test-google
 * Te dice exactamente qué está bien y qué está mal con la conexión a Google.
 */

async function getToken(key, scope) {
  const k = JSON.parse(key);
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
  return d;
}

export const handler = async () => {
  const results = { checks: [] };
  const add = (name, ok, detail) => results.checks.push({ name, ok, detail });

  // 1. ¿Existe la variable de la service account?
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  add("Variable GOOGLE_SERVICE_ACCOUNT_KEY existe", !!keyRaw, keyRaw ? `${keyRaw.length} caracteres` : "FALTA - agrégala en Netlify");

  if (!keyRaw) return { statusCode: 200, body: JSON.stringify(results, null, 2) };

  // 2. ¿Es JSON válido?
  let key;
  try {
    key = JSON.parse(keyRaw);
    add("El JSON de la service account es válido", true, `client_email: ${key.client_email}`);
  } catch (e) {
    add("El JSON de la service account es válido", false, `ERROR: ${e.message}`);
    return { statusCode: 200, body: JSON.stringify(results, null, 2) };
  }

  // 3. ¿Tiene private_key?
  add("Tiene private_key", !!key.private_key, key.private_key ? `${key.private_key.length} caracteres` : "FALTA");

  // 4. ¿El private_key tiene \n literales (problema)?
  const hasLiteral = key.private_key?.includes('\\n');
  add("Private key necesita fix de \\n", hasLiteral, hasLiteral ? "Sí (el fix lo corrige automáticamente)" : "No, formato correcto");

  // 5. ¿Las variables de los IDs existen?
  add("GOOGLE_SHEET_ID existe", !!process.env.GOOGLE_SHEET_ID, process.env.GOOGLE_SHEET_ID || "FALTA");
  add("GOOGLE_CONFIG_SHEET_ID existe", !!process.env.GOOGLE_CONFIG_SHEET_ID, process.env.GOOGLE_CONFIG_SHEET_ID || "FALTA (opcional)");
  add("GOOGLE_CAPACITACION_FOLDER existe", !!process.env.GOOGLE_CAPACITACION_FOLDER, process.env.GOOGLE_CAPACITACION_FOLDER || "FALTA (opcional)");

  // 6. ¿Se puede autenticar con Google?
  try {
    const tokenRes = await getToken(keyRaw, "https://www.googleapis.com/auth/drive.file");
    if (tokenRes.access_token) {
      add("Autenticación con Google", true, "✓ Token obtenido correctamente");
    } else {
      add("Autenticación con Google", false, `ERROR: ${JSON.stringify(tokenRes)}`);
    }
  } catch (e) {
    add("Autenticación con Google", false, `ERROR: ${e.message}`);
  }

  // 7. ¿Se puede escribir en el Sheet?
  if (process.env.GOOGLE_SHEET_ID) {
    try {
      const tokenRes = await getToken(keyRaw, "https://www.googleapis.com/auth/spreadsheets");
      const testRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}`,
        { headers: { Authorization: `Bearer ${tokenRes.access_token}` } }
      );
      if (testRes.ok) {
        const sheet = await testRes.json();
        const tabs = sheet.sheets?.map(s => s.properties.title).join(", ");
        add("Acceso al Google Sheet de ventas", true, `Pestañas: ${tabs}`);
      } else {
        add("Acceso al Google Sheet de ventas", false, `ERROR ${testRes.status}: revisa que compartiste el sheet con ${key.client_email}`);
      }
    } catch (e) {
      add("Acceso al Google Sheet de ventas", false, `ERROR: ${e.message}`);
    }
  }

  const allOk = results.checks.every(c => c.ok || c.detail?.includes("opcional"));
  results.resumen = allOk ? "✅ TODO OK - las integraciones deberían funcionar" : "❌ Hay problemas - revisa los checks marcados como false";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(results, null, 2),
  };
};
