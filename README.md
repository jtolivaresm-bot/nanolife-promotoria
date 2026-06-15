# Nanolife Promotoría — Deploy en Netlify

## Arquitectura

```
[App React] → [Netlify Functions] → [Google Drive]  (fotos + audios)
                                  → [Google Sheets] (marcaciones + ventas)
```

---

## PASO 1 — Crear la Service Account de Google

Una Service Account es un "robot" de Google que puede escribir en Drive y Sheets sin login manual.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo (ej: "Nanolife Promotoria")
3. Activa las APIs:
   - **Menú** → APIs y Servicios → Biblioteca
   - Busca y activa: `Google Drive API`
   - Busca y activa: `Google Sheets API`
4. Crea la Service Account:
   - **Menú** → APIs y Servicios → Credenciales
   - `+ Crear credenciales` → `Cuenta de servicio`
   - Nombre: `nanolife-bot`
   - Rol: `Editor`
   - Clic en la cuenta creada → pestaña **Claves** → `Agregar clave` → `JSON`
   - Se descarga un archivo `.json` — **guárdalo seguro**

---

## PASO 2 — Configurar Google Drive

1. En Google Drive, crea dos carpetas:
   - `Nanolife / Fotos Góndola`
   - `Nanolife / Audios Cierre`
2. Para cada carpeta:
   - Clic derecho → `Compartir`
   - Agrega el email de la service account (está en el JSON, campo `client_email`)
   - Rol: `Editor`
3. Copia el ID de cada carpeta desde la URL
4. Pega los IDs en `src/config.js`

---

## PASO 3 — Configurar Google Sheets

1. Crea un nuevo Google Sheet llamado `Nanolife Promotoria`
2. Crea estas 3 hojas (tabs) con exactamente estos nombres:

### Hoja: `Marcaciones`
| Fecha | Promotor | Sala | Ciudad | Turno | Tipo | Hora | Latitud | Longitud | Precisión (m) | Distancia al local (m) | En local |

### Hoja: `Ventas`
| Fecha | Promotor | Sala | Ciudad | Turno | Producto | Unidades | Precio unitario | Comisión unitaria | Comisión total |

### Hoja: `Cierres`
| Fecha | Promotor | Sala | Ciudad | Comisión AM | Comisión PM | Comisión Total | Audio URL |

3. Comparte el Sheet con el email de la service account (Rol: Editor)
4. Copia el ID del Sheet desde la URL:  
   `docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit`

---

## PASO 4 — Subir a GitHub

```bash
# Clona o inicia el repo
git init
git add .
git commit -m "Nanolife Promotoria v1"

# Crea un repo en github.com y conecta
git remote add origin https://github.com/TU_USUARIO/nanolife-promotoria.git
git branch -M main
git push -u origin main
```

---

## PASO 5 — Deploy en Netlify

1. Ve a [app.netlify.com](https://app.netlify.com) → `Add new site` → `Import from Git`
2. Conecta GitHub y selecciona el repo
3. Build settings (Netlify los detecta solos con el `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Antes de hacer deploy, agrega las **variables de entorno**:
   - Ve a `Site configuration` → `Environment variables`
   - Agrega:

| Variable | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Pega el JSON completo del archivo descargado (en una línea) |
| `GOOGLE_SHEET_ID` | `1TKubWjDq2OWNDY_rPFjm6ftn13XfbrMB3kNWNANNyA0` |

   > Para poner el JSON en una línea: `cat tu-archivo.json | tr -d '\n'`

5. Clic en **Deploy site**

---

## PASO 6 — Verificar que funciona

Después del deploy, abre la URL de Netlify y prueba:
1. Selecciona un promotor → elige turno AM → marca entrada
2. Revisa el Google Sheet `Marcaciones` — debe aparecer la fila
3. Sube una foto de góndola → revisa la carpeta de Drive

---

## Estructura del proyecto

```
nanolife-promotoria/
├── src/
│   ├── App.jsx          ← App principal React
│   ├── main.jsx         ← Entry point
│   ├── index.css        ← Reset CSS
│   ├── googleApi.js     ← Cliente que llama a las Netlify Functions
│   ├── useGoogleSync.js ← Hooks de sincronización (cuándo llamar a qué)
│   └── config.js        ← IDs de carpetas Drive ← COMPLETAR
├── netlify/
│   └── functions/
│       ├── drive-upload.mjs   ← Sube archivos a Drive
│       ├── sheets-append.mjs  ← Escribe filas en Sheets
│       └── package.json       ← Deps de las functions
├── public/
│   └── index.html
├── netlify.toml         ← Config de build + functions
├── vite.config.js
└── package.json
```

---

## Agregar promotores reales

Edita en `src/App.jsx` el array `PROMOTORES`:

```js
const PROMOTORES = [
  { id:"u1", nombre:"NOMBRE COMPLETO", salaId:"s01" },
  // salaId debe coincidir con el id en el array SALAS
];
```

Y el array `SALAS` ya tiene las 10 tiendas Lider configuradas.

---

## Soporte

Si algo no funciona, revisa los logs de las Netlify Functions en:
`app.netlify.com → tu sitio → Functions → drive-upload / sheets-append`
