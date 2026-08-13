# Módulo de Capacitación — estructura de Drive y permisos

Guía para administrar los videos/material del módulo **Capacitación** de la app de promotores.
No requiere tocar código: todo se controla desde Google Drive.

---

## Cómo funciona

- La app lee una **carpeta raíz de capacitación** en Google Drive (definida por la variable de
  entorno `GOOGLE_CAPACITACION_FOLDER` en Netlify).
- **Cada subcarpeta directa de esa carpeta raíz = una sección** del curso.
- **Cada archivo dentro de una subcarpeta = un ítem** (video / imagen / documento).
- El backend ([`netlify/functions/config-reader.mjs`](../netlify/functions/config-reader.mjs),
  función `buildTraining`) lista todo y se lo entrega a la app
  ([`src/App.jsx`](../src/App.jsx), componente `Capacitacion`), que arma las secciones,
  el reproductor embebido y la barra de avance.

### IDs / cuentas de referencia

| Qué | Valor |
|---|---|
| Carpeta raíz de capacitación (`GOOGLE_CAPACITACION_FOLDER`) | `1lIYAUxuJwciNT5i4eHI_9VLYUODV1c2K` ("Capacitación Nanolife") |
| Service account (lee Drive y Sheets) | `nanolofe-bot@nanolife-promotoria.iam.gserviceaccount.com` |
| Sheet de ventas (`GOOGLE_SHEET_ID`, incluye hoja de progreso) | `1TKubWjDq2OWNDY_rPFjm6ftn13XfbrMB3kNWNANNyA0` |

---

## Estructura correcta en Drive

Las carpetas de sección van **directamente** dentro de la carpeta raíz. **No** las anides
dentro de otra carpeta intermedia (ese fue un error inicial: si hay un nivel de más, la app
no encuentra los videos).

```
📁 Capacitación Nanolife            ← carpeta raíz (GOOGLE_CAPACITACION_FOLDER)
├── 📁 01 Uniforme y Presentación Personal   → sección "Uniforme y Presentación Personal"
│     ├── 🎬 saludo-y-postura.mp4              → video "saludo-y-postura"
│     └── 🎬 uniforme-correcto.mp4
├── 📁 02 Nanolife
│     └── 🎬 introduccion.mp4
├── 📁 03 Detergentes
├── 📁 04 Limpiapisos
├── 📁 05 Técnicas de Venta
└── 📁 06 Aplicación
```

### Reglas de nombres

- **Prefijo numérico opcional** (`01`, `02`, …) en la carpeta: solo controla el **orden** de las
  secciones y se **quita** del título mostrado. Deja un **espacio** después del número
  (`01 Detergentes`, no `01-Detergentes`).
- **Nombre de la carpeta** = título de la sección en la app.
- **Nombre del archivo** = título del video en la app (sin la extensión). Renombra los archivos
  con el título final antes/después de subirlos; el cambio se refleja solo.
- Una sección **vacía no aparece** en la app hasta que tenga al menos un archivo.

### Formatos reconocidos

| Tipo en la app | Extensiones |
|---|---|
| `video` | `.mp4`, `.mov`, `.avi`, `.webm`, `.m4v` |
| `imagen` | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` |
| `documento` | cualquier otra (ej. `.pdf`) |

---

## Permisos (¡los dos son necesarios!)

La carpeta raíz de capacitación (y por herencia su contenido) necesita **dos** comparticiones
distintas:

1. **Para que el backend LISTE los videos** → comparte la carpeta con la service account
   **`nanolofe-bot@nanolife-promotoria.iam.gserviceaccount.com`** con rol **Lector**.
   Sin esto, la app muestra 0 videos aunque existan.

2. **Para que el promotor REPRODUZCA el video** → comparte como
   **"Cualquiera con el enlace → Lector"**. Sin esto, el reproductor embebido queda en negro
   (los promotores no tienen sesión de Google).

> Ambos permisos se heredan a las subcarpetas y archivos, así que basta configurarlos en la
> carpeta raíz.

---

## Progreso de los promotores

- Cuando un promotor marca un video como visto, se agrega una fila a la hoja
  **`CapacitacionProgreso`** del Sheet de ventas (`GOOGLE_SHEET_ID`).
- Encabezado exacto de esa hoja:
  ```
  Fecha | PromotorId | Promotor | ItemId | Titulo | Categoria | Hora
  ```
- El progreso también se guarda localmente en el teléfono (optimista) y se reconcilia con el
  Sheet; si no hay señal, se reintenta y no se pierde.

---

## Verificar cambios / troubleshooting

- El backend cachea la respuesta **5 minutos**. Para forzar una lectura fresca al probar,
  agrega un parámetro cualquiera a la URL:
  ```
  https://nanolife-promotoria.netlify.app/.netlify/functions/config-reader?cachebust=123
  ```
  En la respuesta, el arreglo `training` lista los videos detectados (con `categoria`,
  `categoriaLabel`, `orden`, `titulo`, `url`).
- **La app muestra 0 videos** → revisa, en este orden:
  1. ¿Las carpetas de sección están **directamente** bajo la carpeta raíz (sin nivel de más)?
  2. ¿Las subcarpetas tienen **archivos** adentro (no solo más carpetas)?
  3. ¿La carpeta está compartida con la **service account** como Lector?
- **El video no reproduce (queda en negro)** → falta el permiso "Cualquiera con el enlace".
