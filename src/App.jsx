import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Home, MapPin, GraduationCap, Clock, LogIn, LogOut,
  CheckCircle2, Circle, Camera, Mic, Square, Trash2, X,
  AlertCircle, Store, FileText, Video, Image as ImageIcon,
  ChevronRight, RefreshCw, Crown, ShieldCheck, Phone
} from "lucide-react";

const STORAGE_KEY = "nanolife_v5";

// Stock por sala — número plano de unidades totales disponibles
// Se sobreescribe desde Google Sheets al cargar
let STOCK_SALAS = {
  s01: { p1:12, p2:8,  p3:15, p4:6,  p5:4  },
  s02: { p1:22, p2:18, p3:8,  p4:12, p5:6  },
  s03: { p1:20, p2:12, p3:20, p4:8,  p5:6  },
  s04: { p1:6,  p2:6,  p3:4,  p4:4,  p5:2  },
  s05: { p1:24, p2:20, p3:12, p4:14, p5:8  },
  s06: { p1:14, p2:8,  p3:20, p4:6,  p5:8  },
  s07: { p1:28, p2:24, p3:20, p4:12, p5:8  },
  s08: { p1:18, p2:14, p3:10, p4:12, p5:4  },
  s09: { p1:22, p2:18, p3:12, p4:10, p5:8  },
  s10: { p1:10, p2:12, p3:12, p4:6,  p5:4  },
  sdemo: { p1:36, p2:24, p3:28, p4:20, p5:14 },
};

const PRODUCTOS = [
  { id: "p1", nombre: "Limpiapisos Summer",            precio: 2890,  comision: 200 },
  { id: "p2", nombre: "Limpiapisos Lavanda",           precio: 2890,  comision: 200 },
  { id: "p3", nombre: "Detergente 10x Regular",        precio: 3990,  comision: 250 },
  { id: "p4", nombre: "Detergente 10x Hipoalergénico", precio: 3990,  comision: 250 },
  { id: "p5", nombre: "Detergente 25x Regular",        precio: 9990,  comision: 400 },
];

// productos: array de ids de los que están exhibidos en esa sala (todos si null)
let SALAS = [
  { id:"s01", codigo:"091", nombre:"Hiper Lider - Zenteno 21",              ciudad:"Antofagasta",  lat:-23.6524,lng:-70.3954, reponedor:null,                fono:null,            productos:null },
  { id:"s02", codigo:"089", nombre:"Hiper Lider - Talcahuano 9000",         ciudad:"Hualpén",      lat:-36.7882,lng:-73.0989, reponedor:"MARCELO BARRIENTOS", fono:"56934511141",   productos:null },
  { id:"s03", codigo:"",    nombre:"Hiper Lider - Francisco Aguirre", ciudad:"La Serena",    lat:-29.9045,lng:-71.2494, reponedor:"VALERIA OLIVA",      fono:"56990032325",   productos:null },
  { id:"s04", codigo:"619", nombre:"Lider Express - Mons. Munita",  ciudad:"Puerto Montt", lat:-41.4693,lng:-72.9416, reponedor:null,                fono:null,            productos:null },
  { id:"s05", codigo:"003", nombre:"Hiper Lider - Irarrázaval",    ciudad:"Ñuñoa",        lat:-33.4570,lng:-70.6156, reponedor:null,                fono:null,            productos:null },
  { id:"s06", codigo:"057", nombre:"Hiper Lider - Buenaventura 1770",       ciudad:"Vitacura",     lat:-33.3924,lng:-70.5952, reponedor:"MARCELA FERNANDEZ",  fono:"56992464302",   productos:null },
  { id:"s07", codigo:"075", nombre:"Hiper Lider - Pajaritos",      ciudad:"Maipú",        lat:-33.5103,lng:-70.7574, reponedor:"VICTORIA PLAZA",     fono:"56950188900",   productos:null },
  { id:"s08", codigo:"095", nombre:"Hiper Lider - Alessandri",   ciudad:"La Reina",     lat:-33.4580,lng:-70.5527, reponedor:"CAMILA GONZALES",    fono:"56946853781",   productos:null },
  { id:"s09", codigo:"097", nombre:"Hiper Lider - Las Condes",    ciudad:"Lo Barnechea", lat:-33.3682,lng:-70.5039, reponedor:"EDUARDO MARTINEZ",   fono:"56966334302",   productos:null },
  { id:"s10", codigo:"120", nombre:"Hiper Lider - Gabriela Mistral",  ciudad:"Temuco",       lat:-38.7408,lng:-72.5990, reponedor:"ILSE DIAZ",          fono:"56991312037",   productos:null },
  // Sala DEMO — siempre disponible, no depende del sheet
  { id:"sdemo", codigo:"DEMO", nombre:"Hiper Lider - Sala Ejemplo", ciudad:"Santiago", lat:-33.4372,lng:-70.6506, reponedor:"CARLOS DEMO", fono:"56912345678", productos:null },
];

// Promotores, Salas y Stock se cargan desde Google Sheets al abrir la app.
// Estos valores son el fallback mientras carga (o si hay error de red).
// El promotor DEMO siempre está disponible y no se sobreescribe con el sheet.
const PROMOTOR_DEMO = {
  id:"udemo", nombre:"Promotor Ejemplo ⭐", rut:"111111111",
  _esDemo: true,
  // Jornadas de ejemplo para toda la campaña
  salaId_20jun:"sdemo", salaId_21jun:"sdemo",
  salaId_27jun:"sdemo", salaId_28jun:"sdemo",
  salaId_04jul:"sdemo", salaId_05jul:"sdemo",
};
// Proxy que siempre resuelve salaId a sdemo para cualquier fecha
function getSalaIdParaHoy(promotor) {
  if (!promotor) return null;
  if (promotor._esDemo) return "sdemo";
  const d = new Date();
  const dia = String(d.getDate()).padStart(2,"0");
  const meses = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mes = meses[d.getMonth()];
  const key = `salaId_${dia}${mes}`;
  if (promotor[key]) return promotor[key];
  if (promotor.salaId) return promotor.salaId;
  return null;
}

let PROMOTORES = [
  { id:"u1", nombre:"Camila Rojas",  rut:"",  salaId:"s07" },
  { id:"u2", nombre:"Diego Fuentes", rut:"",  salaId:"s08" },
  { id:"u3", nombre:"Valentina Soto",rut:"",  salaId:"s06" },
];

// categoria: "marca" | "limpiapisos" | "detergente"
const SEED_TRAINING = [
  { id:"t0", tipo:"uniforme", categoria:"marca",        titulo:"Uniforme y presentación",        desc:"Cómo debe lucir tu presentación en sala. Bata blanca, pantalón negro, zapatos lustrados.", dur:"—" },
  { id:"t1", tipo:"video",    categoria:"marca",        titulo:"Introducción a Nanolife",         desc:"Quiénes somos, nuestra misión y propuesta de valor.", dur:"3:45" },
  { id:"t2", tipo:"pdf",      categoria:"marca",        titulo:"Argumentario de marca 2026",      desc:"Cómo presentar Nanolife, respuestas a objeciones frecuentes.", dur:"8 pág." },
  { id:"t3", tipo:"video",    categoria:"limpiapisos",  titulo:"Limpiapisos Summer y Lavanda",    desc:"Beneficios, diferencias entre fragancias y técnica de demostración.", dur:"4:12" },
  { id:"t4", tipo:"pdf",      categoria:"limpiapisos",  titulo:"Guía de exhibición Limpiapisos",  desc:"Cómo montar la góndola y el material POP para Limpiapisos.", dur:"4 pág." },
  { id:"t5", tipo:"video",    categoria:"detergente",   titulo:"Detergente en Cápsulas 10x y 25x", desc:"Ventajas del formato, cómo explicar las dosis y el ahorro.", dur:"5:08" },
  { id:"t6", tipo:"pdf",      categoria:"detergente",   titulo:"Guía de exhibición Detergente",   desc:"Planograma y material POP para Detergente en Cápsulas.", dur:"4 pág." },
];

const DEFAULT_CONFIG = { geofenceRadio: 200 };

const TURNOS = {
  am: { label:"Turno AM", horario:"11:00 – 15:00" },
  pm: { label:"Turno PM", horario:"16:00 – 20:00" },
};
const turnoActual = () => new Date().getHours() < 15 ? "am" : "pm";

const uid = () => Math.random().toString(36).slice(2,9);
const fmtCLP = (n) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Math.round(n||0));
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
const elapsed = (a,b) => { const m=Math.floor(Math.max(0,(b||Date.now())-a)/60000); return `${Math.floor(m/60)}h ${m%60}m`; };

const haversine=(a,b,c,d)=>{const R=6371000,r=x=>x*Math.PI/180,da=r(c-a),db=r(d-b),s=Math.sin(da/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(db/2)**2;return Math.round(R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s)));};

function getGPS(){
  return new Promise(res=>{
    if(!navigator.geolocation)return res(null);
    const timer = setTimeout(()=>res(null), 4000); // 4s máximo
    navigator.geolocation.getCurrentPosition(
      p=>{ clearTimeout(timer); res({lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy)}); },
      ()=>{ clearTimeout(timer); res(null); },
      {enableHighAccuracy:true,timeout:4000,maximumAge:30000}
    );
  });
}

function compressImage(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>res(e.target.result);
    r.onerror=rej; r.readAsDataURL(file);
  });
}

// Sube archivos a Drive via Google Apps Script (evita CORS y problemas de cuota)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyigkOEq7Y1JyFmUg-gqxIQt6Io95l2hEJQsvjv_fWU5X-J8QwE9Z1UVGx7XjQ7is0/exec";

async function uploadToDriveDirect(dataUrl, fileName, folderId, mimeType) {
  const tipo = (mimeType||"").includes("audio") ? "audio" : "foto";
  // mode: no-cors evita bloqueo CORS — fire and forget
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ dataUrl, fileName, folderId, tipo }),
  });
  // Retornamos inmediatamente sin esperar respuesta (no-cors no permite leerla)
  console.log(`↑ Enviando ${tipo}: ${fileName}`);
  return { fileId: null, webViewLink: null };
}

function loadDB(){try{const r=localStorage.getItem(STORAGE_KEY);return r?JSON.parse(r):null;}catch{return null;}}
function saveDB(db){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}catch{}}

// cada turno: { entrada, salida, cantidades:{pid:qty}, fotosProducto:{pid:dataURL} }
// fotosProducto solo existe en AM

const emptyTurno = () => ({ entrada:null, salida:null, cantidades:{}, fotosProducto:{} });
const emptyRec = (pid,fecha) => ({
  promotorId:pid, fecha,
  turnos:{ am:emptyTurno(), pm:emptyTurno() },
  audio:null,
});

function normalizeRec(r,pid,fecha){
  if(!r) return emptyRec(pid,fecha);
  const base = emptyRec(pid,fecha);
  return {
    ...base, ...r,
    turnos:{
      am:{ ...emptyTurno(), ...(r.turnos?.am||{}) },
      pm:{ ...emptyTurno(), ...(r.turnos?.pm||{}) },
    },
  };
}

function calcTurno(t){ const c=t?.cantidades||{}; let v=0,b=0,u=0; PRODUCTOS.forEach(p=>{const q=c[p.id]||0;if(q>0){v+=q*p.precio;b+=q*p.comision;u+=q;}}); return{ventasTotal:v,base:b,unidades:u}; }

function calcDia(rec){
  const am=calcTurno(rec.turnos.am), pm=calcTurno(rec.turnos.pm);
  return{am,pm,ventasTotal:am.ventasTotal+pm.ventasTotal,base:am.base+pm.base,unidades:am.unidades+pm.unidades,total:am.base+pm.base};
}

function jornadaSteps(rec, sala){
  const prods = sala?.productos ? PRODUCTOS.filter(p=>sala.productos.includes(p.id)) : PRODUCTOS;
  const amT = rec.turnos.am;
  const pmT = rec.turnos.pm;
  const fotosOk = prods.every(p => amT.fotosProducto?.[p.id]);
  const ventasAM = Object.values(amT.cantidades||{}).reduce((s,q)=>s+(q||0),0)>0;
  const ventasPM = Object.values(pmT.cantidades||{}).reduce((s,q)=>s+(q||0),0)>0;
  return [
    { k:"Entrada AM",         done: !!amT.entrada },
    { k:"Fotos góndola",      done: fotosOk },
    { k:"Salida AM + ventas", done: !!amT.salida && ventasAM },
    { k:"Entrada PM",         done: !!pmT.entrada },
    { k:"Salida PM + ventas", done: !!pmT.salida && ventasPM },
    { k:"Audio de cierre",    done: !!rec.audio },
  ];
}

const CSS = `.nl-root *{box-sizing:border-box;margin:0;padding:0}
.nl-root{
--teal:#0E6F76;--teal-d:#0A4C52;--mint:#2FD9C5;--mint-d:#16b8a6;
--ink:#0B2A2D;--muted:#5C7679;--bg:#EAF3F2;--surface:#FFFFFF;
--line:#DCEAE9;--coral:#FF6B5B;--green:#16A34A;--amber:#E0922F;
font-family:system-ui,sans-serif;color:var(--ink);
background:linear-gradient(160deg,#dfeeee,#eef5f4);min-height:100%;
display:flex;align-items:center;justify-content:center;padding:18px;
}
.nl-phone{
width:100%;max-width:432px;height:min(884px,100dvh);background:var(--bg);
border-radius:30px;overflow:hidden;position:relative;display:flex;flex-direction:column;
box-shadow:0 30px 70px -20px rgba(10,76,82,.45),0 0 0 1px rgba(14,111,118,.08);
}
.nl-screen{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 16px 96px}
.nl-screen::-webkit-scrollbar{width:0}
.disp{font-family:'Segoe UI',system-ui,sans-serif}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
/* topbar */
.nl-top{padding:18px 16px 14px;background:linear-gradient(150deg,var(--teal),var(--teal-d));color:#fff}
.nl-top .row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.brand{display:flex;align-items:center;gap:9px}
.brand .drop{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--mint),#7ef0e2);display:flex;align-items:center;justify-content:center;color:var(--teal-d);font-weight:700;box-shadow:0 4px 12px rgba(47,217,197,.5)}
.brand .nm{font-family:'Segoe UI',system-ui;font-weight:700;font-size:17px;letter-spacing:-.02em;line-height:1}
.brand .sub{font-size:10px;opacity:.8;letter-spacing:.04em}
.who{margin-top:12px;display:flex;align-items:center;gap:10px;background:none;border:none;color:#fff;text-align:left;cursor:pointer;width:100%;padding:0}
.who .av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Segoe UI',system-ui;border:1.5px solid rgba(255,255,255,.35);flex-shrink:0}
.who .nm{font-weight:600;font-size:15px;line-height:1.2}
.who .lc{font-size:11.5px;opacity:.85;display:flex;align-items:center;gap:4px;margin-top:1px}
.iconbtn{background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.iconbtn:active{transform:scale(.94)}
/* segmented turno */
.seg{display:flex;gap:5px;background:rgba(255,255,255,.14);padding:4px;border-radius:13px;margin-top:12px}
.seg button{flex:1;border:none;background:transparent;color:rgba(255,255,255,.8);font-family:system-ui;font-weight:600;font-size:13px;padding:8px 6px;border-radius:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1.2}
.seg button .h{font-size:10px;font-weight:500;opacity:.8}
.seg button.on{background:#fff;color:var(--teal-d)}
.seg button.on .h{opacity:.7}
/* cards */
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;margin-top:14px;box-shadow:0 1px 2px rgba(11,42,45,.03)}
.card.tight{padding:14px}
.sec-title{font-family:'Segoe UI',system-ui;font-weight:600;font-size:13px;color:var(--muted);margin:20px 2px 2px;letter-spacing:.02em;display:flex;align-items:center;gap:7px}
/* ring */
.ring-wrap{display:flex;align-items:center;gap:16px}
.ring-meta .big{font-family:'Segoe UI',system-ui;font-weight:700;font-size:24px;line-height:1}
.ring-meta .lbl{font-size:12px;color:var(--muted);margin-top:2px}
.steps{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}
.step{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted)}
.step.on{color:var(--ink);font-weight:600}
/* commission hero */
.comm{background:linear-gradient(155deg,var(--teal-d),#063b40);color:#fff;border:none}
.comm .amt{font-family:'Segoe UI',system-ui;font-weight:700;font-size:34px;letter-spacing:-.02em;line-height:1;margin-top:4px}
.comm .lbl{font-size:11px;opacity:.8;letter-spacing:.08em;text-transform:uppercase;font-weight:600}
/* buttons */
.btn{border:none;border-radius:14px;font-family:system-ui;font-weight:600;font-size:14.5px;padding:13px 16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .08s}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-block{width:100%}
.btn-primary{background:var(--teal);color:#fff}
.btn-coral{background:var(--coral);color:#fff}
.btn-out{background:transparent;border:1.5px solid var(--line);color:var(--ink)}
.btn-soft{background:#E4F4F1;color:var(--teal-d)}
.btn-ghost{background:transparent;color:var(--teal);padding:8px}
/* inputs */
.inp,.sel{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:12px 13px;font-family:system-ui;font-size:15px;background:var(--surface);color:var(--ink);outline:none}
.inp:focus,.sel:focus{border-color:var(--mint-d)}
.field-lbl{font-size:12px;font-weight:600;color:var(--muted);margin:0 2px 5px;display:block}
/* chips */
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:5px 10px;border-radius:99px}
.chip-ok{background:#DCFCE7;color:#15803D}
.chip-warn{background:#FEF3E2;color:var(--amber)}
.chip-off{background:#F1F5F4;color:var(--muted)}
.badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em}
/* rows */
.row-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.row-item:last-child{border-bottom:none}
.muted{color:var(--muted)}
.amount{font-family:'Segoe UI',system-ui;font-weight:600;font-variant-numeric:tabular-nums}
/* product rows + stepper */
.prod-row{display:flex;align-items:center;gap:10px;padding:11px 10px;border-radius:13px}
.stepper{display:flex;align-items:center;background:var(--bg);border-radius:11px;padding:3px;flex-shrink:0}
.stepper button{width:30px;height:30px;border:none;background:var(--surface);border-radius:8px;font-size:18px;font-weight:700;color:var(--teal);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(11,42,45,.08)}
.stepper button:active{transform:scale(.92)}
.stepper button:disabled{opacity:.35;cursor:not-allowed}
.stepper input{width:34px;border:none;background:transparent;text-align:center;font-family:'Segoe UI',system-ui;font-weight:700;font-size:15px;color:var(--ink);outline:none;-moz-appearance:textfield}
.stepper input::-webkit-outer-spin-button,.stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
/* photo grid */
.pgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px}
.pgrid .ph{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#eef5f4;display:flex;align-items:center;justify-content:center}
.pgrid .ph img{width:100%;height:100%;object-fit:cover}
.pgrid .ph .tag{position:absolute;left:5px;bottom:5px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(11,42,45,.78);color:#fff;pointer-events:none}
.pgrid .ph .del{position:absolute;top:4px;right:4px;background:rgba(11,42,45,.7);border:none;color:#fff;width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.ph-empty{border:2px dashed var(--line);cursor:pointer;flex-direction:column;gap:6px;color:var(--muted);font-size:10.5px;font-weight:600;text-align:center}
.ph-empty:active{background:#e4f4f1}
/* tabbar */
.nl-tabs{position:absolute;bottom:0;left:0;right:0;height:74px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-top:1px solid var(--line);display:flex;padding:8px 6px 16px}
.tab{flex:1;border:none;background:none;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--muted);cursor:pointer;padding-top:6px}
.tab.on{color:var(--teal)}
.tab .ic{width:22px;height:22px;display:flex;align-items:center;justify-content:center}
/* sheet / modal */
.scrim{position:absolute;inset:0;background:rgba(8,40,43,.5);display:flex;align-items:flex-end;z-index:30;animation:fade .2s}
.sheet{width:100%;background:var(--bg);border-radius:24px 24px 0 0;max-height:90%;overflow-y:auto;padding:8px 16px 28px;animation:rise .25s cubic-bezier(.2,.8,.2,1)}
.sheet::-webkit-scrollbar{width:0}
.grab{width:42px;height:4px;border-radius:99px;background:var(--line);margin:10px auto 6px}
@keyframes fade{from{opacity:0}}
@keyframes rise{from{transform:translateY(30px);opacity:.6}}
@keyframes pulse{50%{opacity:.45}}
.rec-dot{width:9px;height:9px;border-radius:50%;background:var(--coral);animation:pulse 1s infinite}
.spin{animation:spin2 1s linear infinite}
@keyframes spin2{to{transform:rotate(360deg)}}
.empty{text-align:center;color:var(--muted);padding:26px 10px;font-size:13.5px}
.splash{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--teal-d)}
.st-g{background:#E4F4F1;color:var(--teal-d);font-weight:700;font-size:13px;font-family:'Segoe UI',system-ui;padding:3px 10px;border-radius:7px;min-width:32px;text-align:center}
.st-g0{background:#FEE2E2;color:#DC2626;font-weight:700;font-size:13px;font-family:'Segoe UI',system-ui;padding:3px 10px;border-radius:7px;min-width:32px;text-align:center}
.st-b{background:#F0FAF9;color:var(--teal-d);font-weight:700;font-size:13px;font-family:'Segoe UI',system-ui;padding:3px 10px;border-radius:7px;min-width:32px;text-align:center}
.st-b0{background:#F5F5F5;color:var(--muted);font-weight:700;font-size:13px;font-family:'Segoe UI',system-ui;padding:3px 10px;border-radius:7px;min-width:32px;text-align:center}
.stk-row{display:flex;align-items:center;padding:10px 14px;gap:10px}.stk-nm{flex:1;font-size:13px;font-weight:500}.stk-vals{display:flex;gap:6px;align-items:center}
.rep-bar{background:#F0FAF9;border-top:1px solid var(--line);padding:12px 14px}.rep-txt{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-bottom:6px}.rep-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.rep-call{background:var(--mint);border-radius:11px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none}`;

function NanoLogo({height=30}){
  return <img src="/logo-nanolife.png" alt="Nanolife" style={{height:height, objectFit:"contain"}}/>;
}

function UniformeImg(){
  const [src,setSrc] = useState(null);
  useEffect(()=>{
    try{const r=localStorage.getItem("nanolife_uniforme");if(r)setSrc(r);}catch{}
  },[]);
  if(!src) return <div style={{padding:40,textAlign:"center",color:"var(--muted)"}}>
    <div style={{fontSize:40,marginBottom:12}}>👔</div>
    <div style={{fontSize:14,fontWeight:600}}>Uniforme y presentación</div>
    <div style={{fontSize:12,marginTop:8}}>Bata blanca · Pantalón negro · Zapatos lustrados</div>
    <div style={{fontSize:11,marginTop:16,opacity:.7}}>Imagen disponible al conectar el sistema.</div>
  </div>;
  return <img src={src} alt="Uniforme" style={{width:"100%",display:"block"}}/>;
}

function ShiftRing({ pct, size=86 }) {
  const r=(size-12)/2, c=2*Math.PI*r;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E0EEED" strokeWidth="9"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#g)" strokeWidth="9"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct)}
        style={{transition:"stroke-dashoffset .6s ease"}}/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#16b8a6"/><stop offset="1" stopColor="#2FD9C5"/>
      </linearGradient></defs>
    </svg>
  );
}

// Normaliza RUT: quita puntos, guion, espacios y pone K en mayúscula
function normRut(r) {
  return r.replace(/[.\-\s]/g,"").toUpperCase();
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);
  const [db, setDb] = useState({ config:DEFAULT_CONFIG, records:{}, training:SEED_TRAINING });
  const [pid, setPid] = useState(null); // null = no ha hecho login
  const [tab, setTab] = useState("inicio");
  const [turno, setTurno] = useState(turnoActual());
  const [coordOpen, setCoordOpen] = useState(false);
  const fecha = todayISO();

  useEffect(()=>{
    // Restore session
    const savedPid = localStorage.getItem("nanolife_pid");
    if(savedPid) setPid(savedPid);

    // Load local data immediately so the app is usable offline
    const d=loadDB();
    if(d) setDb({config:{...DEFAULT_CONFIG,...d.config},records:d.records||{},training:d.training||SEED_TRAINING});
    setReady(true);

    // Load config from Google in background
    fetch("/.netlify/functions/config-reader")
      .then(r=>r.ok ? r.json() : Promise.reject(r.status))
      .then(({promotores, salas, stock, training})=>{
        if(promotores?.length) {
          PROMOTORES.splice(0, PROMOTORES.length, ...promotores);
          // El promotor DEMO siempre está al final, nunca se sobreescribe
          if (!PROMOTORES.find(p=>p.id==="udemo")) PROMOTORES.push(PROMOTOR_DEMO);
        }
        if(salas?.length)      SALAS.splice(0, SALAS.length, ...salas);
        if(stock && Object.keys(stock).length) {
          Object.keys(STOCK_SALAS).forEach(k=>delete STOCK_SALAS[k]);
          Object.assign(STOCK_SALAS, stock);
        }
        // Update training from Drive if available
        if(training?.length) {
          setDb(prev=>({ ...prev, training }));
        }
        setConfigVersion(v=>v+1);
      })
      .catch(err=>console.warn("Config load failed (using defaults):", err));
  },[]);

  useEffect(()=>{ if(ready) saveDB(db); },[db,ready]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const promotor = useMemo(()=>{
    if (!pid) return null;
    if (pid==="udemo") return PROMOTOR_DEMO;
    return PROMOTORES.find(p=>p.id===pid)||null;
  },[pid,configVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const salaId = useMemo(()=>getSalaIdParaHoy(promotor),[promotor,configVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sala = useMemo(()=>salaId ? SALAS.find(s=>s.id===salaId)||null : null,[salaId,configVersion]);
  const rid = `${pid}__${fecha}`;
  const rec = useMemo(()=>normalizeRec(db.records[rid],pid,fecha),[db.records,rid,pid,fecha]);

  const updateRec = useCallback((fn)=>{
    setDb(prev=>{
      const cur=normalizeRec(prev.records[rid],pid,fecha);
      return{...prev,records:{...prev.records,[rid]:fn(cur)}};
    });
  },[rid,pid,fecha]);

  const comm = useMemo(()=>calcDia(rec),[rec]);
  const steps = useMemo(()=>jornadaSteps(rec,sala),[rec,sala]);
  const doneCount = steps.filter(s=>s.done).length;
  const pct = doneCount/steps.length;

  if(!ready) return (
    <div className="nl-root"><style>{CSS}</style>
      <div className="nl-phone"><div className="splash">
        <NanoLogo height={36}/>
        <RefreshCw className="spin" size={22} style={{color:"var(--teal)"}}/>
        <div className="muted disp" style={{fontSize:14}}>Cargando…</div>
      </div></div>
    </div>
  );

  // LOGIN: no ha ingresado todavía
  if(!pid) return (
    <div className="nl-root"><style>{CSS}</style>
      <div className="nl-phone">
        <LoginScreen
          promotores={[...PROMOTORES.filter(p=>p.id!=="udemo"), PROMOTOR_DEMO]}
          salas={SALAS}
          onLogin={id=>{setPid(id); localStorage.setItem("nanolife_pid",id);}}
          configVersion={configVersion}/>
      </div>
    </div>
  );

  const TABS = [
    {k:"inicio",   ic:Home,        lbl:"Inicio"},
    {k:"marcar",   ic:MapPin,      lbl:"Marcar"},
    {k:"capacita", ic:GraduationCap, lbl:"Capacitación"},
  ];

  const salaNombre = sala
    ? sala.nombre.replace("Hiper Lider - ","").replace("Lider Express - ","")
    : "Sin jornada hoy";

  const handleLogout = () => { localStorage.removeItem("nanolife_pid"); setPid(null); };

  return (
    <div className="nl-root">
      <style>{CSS}</style>
      <div className="nl-phone">
        {/* TOP BAR */}
        <div className="nl-top">
          <div className="row">
            <div className="brand">
              <NanoLogo height={30}/>
              <div><div className="nm">Promotoría</div><div className="sub">Campaña Lider 2026</div></div>
            </div>
            <button className="iconbtn" onClick={()=>setCoordOpen(true)}><ShieldCheck size={18}/></button>
          </div>
          <button className="who" onClick={handleLogout} title="Toca para cerrar sesión">
            <div className="av">{promotor?.nombre.split(" ").map(w=>w[0]).join("").slice(0,2)||"?"}</div>
            <div style={{flex:1}}>
              <div className="nm">{promotor?.nombre||"—"}</div>
              <div className="lc"><Store size={11}/> {salaNombre}</div>
            </div>
            <LogOut size={15} opacity={.7}/>
          </button>
          {tab==="marcar" && (
            <div className="seg">
              {Object.entries(TURNOS).map(([k,t])=>(
                <button key={k} className={turno===k?"on":""} onClick={()=>setTurno(k)}>
                  <span>{t.label}</span><span className="h">{t.horario}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SCREENS */}
        <div className="nl-screen">
          {tab==="inicio"   && <Inicio   rec={rec} comm={comm} steps={steps} doneCount={doneCount} pct={pct} fecha={fecha} sala={sala} setTab={setTab} setTurno={setTurno} pid={pid} db={db}/>}
          {tab==="marcar"   && <Marcar   rec={rec} updateRec={updateRec} sala={sala} cfg={db.config} turno={turno} comm={comm} pid={pid}/>}
          {tab==="capacita" && <Capacitacion training={db.training}/>}
        </div>

        {/* TAB BAR */}
        <div className="nl-tabs">
          {TABS.map(t=>{const Ic=t.ic; return(
            <button key={t.k} className={`tab ${tab===t.k?"on":""}`} onClick={()=>setTab(t.k)}>
              <span className="ic"><Ic size={21}/></span>{t.lbl}
            </button>
          );})}
        </div>

        {coordOpen && <CoordinadorSheet db={db} setDb={setDb} fecha={fecha} close={()=>setCoordOpen(false)}/>}
      </div>
    </div>
  );
}

function Inicio({ rec, comm, steps, doneCount, pct, fecha, sala, setTab, setTurno, pid, db }) {
  const fechaTxt = new Date(fecha+"T12:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"});
  const go = (k) => { setTurno(k); setTab("marcar"); };
  const stock = sala ? (STOCK_SALAS[sala.id] || {}) : {};
  // Si todo el stock está en 0 (no actualizado), mostrar todos los productos
  const stockVacio = Object.keys(stock).length === 0 || Object.values(stock).every(v => (typeof v==="number" ? v : 0) === 0);
  const prods = PRODUCTOS.filter(p => {
    if (sala?.productos && !sala.productos.includes(p.id)) return false;
    if (stockVacio) return true;
    const s = stock[p.id];
    if (s === undefined || s === null) return true;
    return (typeof s === "number" ? s : 0) > 0;
  });
  const lf=(()=>{const d=new Date(),day=d.getDay();d.setDate(d.getDate()-((day===0?2:day===6?1:day-5+7)%7||7));return d.toLocaleDateString("es-CL",{day:"numeric",month:"long"});})();

  // Calcular jornadas comprometidas del mes actual
  const promotorObj = pid==="udemo" ? PROMOTOR_DEMO : PROMOTORES.find(p=>p.id===pid);
  const meses = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const hoy = new Date();
  const mesActualNum = hoy.getMonth(); // 0-11
  const anioActual = hoy.getFullYear();

  const jornadasComprometidas = promotorObj ? Object.entries(promotorObj)
    .filter(([k,v]) => k.startsWith("salaId_") && v)
    .map(([k,v]) => {
      // key: salaId_19jun → dia=19, mes="jun"
      const match = k.match(/salaId_(\d{2})([a-z]{3})/);
      if (!match) return null;
      const dia = parseInt(match[1]);
      const mesIdx = meses.indexOf(match[2]);
      if (mesIdx === -1) return null;
      // Solo mostrar del mes actual
      if (mesIdx !== mesActualNum) return null;
      const fechaJornada = `${anioActual}-${String(mesIdx+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
      const salaJornada = SALAS.find(s=>s.id===v);
      const esHoy = fechaJornada === fecha;
      const esPasado = fechaJornada < fecha;
      const recJornada = db.records?.[`${pid}__${fechaJornada}`];
      const recNorm = recJornada ? normalizeRec(recJornada, pid, fechaJornada) : null;
      const amOk = !!recNorm?.turnos?.am?.entrada && !!recNorm?.turnos?.am?.salida;
      const pmOk = !!recNorm?.turnos?.pm?.entrada && !!recNorm?.turnos?.pm?.salida;
      const completada = amOk && pmOk;
      return { fechaJornada, dia, mesIdx, salaJornada, esHoy, esPasado, completada, amOk, pmOk };
    })
    .filter(Boolean)
    .sort((a,b) => a.fechaJornada.localeCompare(b.fechaJornada))
  : [];

  const fmtFechaJornada = (f) => new Date(f+"T12:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"});

  const TurnoMini = ({k}) => {
    const tt=TURNOS[k], tr=rec.turnos[k], c=comm[k];
    const estado = tr.salida?"cerrado":tr.entrada?"en curso":"sin iniciar";
    const chipCls = tr.salida?"chip-ok":tr.entrada?"chip-warn":"chip-off";
    return (
      <div className="card tight">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:700,fontFamily:"Segoe UI,system-ui"}}>{tt.label}</div><div className="muted" style={{fontSize:11.5}}>{tt.horario}</div></div>
          <span className={`chip ${chipCls}`} style={{textTransform:"capitalize"}}>{estado}</span>
        </div>
        <div style={{display:"flex",gap:14,marginTop:10}}>
          <MiniStat icon={LogIn}  label="Entrada" val={tr.entrada?hhmm(tr.entrada.ts):"—"}/>
          <MiniStat icon={LogOut} label="Salida"  val={tr.salida?hhmm(tr.salida.ts):"—"}/>
          <MiniStat icon={Camera} label="Comisión" val={fmtCLP(c.base)} accent/>
        </div>
        <button className="btn btn-soft btn-block" style={{marginTop:10,padding:"10px"}} onClick={()=>go(k)}>
          <MapPin size={15}/> {!tr.entrada?"Marcar entrada":!tr.salida?"Marcar salida":"Ver turno"}
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="sec-title" style={{marginTop:16,textTransform:"capitalize"}}>{fechaTxt}</div>

      {/* Sin jornada hoy */}
      {!sala && (
        <div style={{background:"#FEF3E2",border:"1px solid #F5C842",borderRadius:16,padding:"16px",marginTop:10,display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:28,flexShrink:0}}>📅</span>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:"#92610A",marginBottom:4}}>No tienes jornada asignada hoy</div>
            <div style={{fontSize:13,color:"#A07020",lineHeight:1.5}}>Tu próxima jornada es el viernes o sábado según el calendario de la campaña. Puedes revisar el material de capacitación mientras tanto.</div>
          </div>
        </div>
      )}

      {/* JORNADAS COMPROMETIDAS DEL MES */}
      {jornadasComprometidas.length > 0 && (
        <>
          <div className="sec-title">Mis jornadas este mes</div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            {jornadasComprometidas.map((j,i) => {
              const borderColor = j.esHoy ? "var(--teal)" : j.completada ? "#16A34A" : j.esPasado ? "var(--coral)" : "var(--line)";
              const bg = j.esHoy ? "#E4F4F1" : j.completada ? "#F0FDF4" : "var(--surface)";
              return (
                <div key={j.fechaJornada} style={{
                  display:"flex", alignItems:"flex-start", gap:12,
                  padding:"12px 14px",
                  borderBottom: i<jornadasComprometidas.length-1 ? "1px solid var(--line)" : undefined,
                  borderLeft: `3px solid ${borderColor}`,
                  background: bg,
                }}>
                  {/* Icono estado */}
                  <div style={{flexShrink:0, marginTop:2}}>
                    {j.completada
                      ? <CheckCircle2 size={18} color="#16A34A"/>
                      : j.esHoy
                      ? <MapPin size={18} color="var(--teal)"/>
                      : j.esPasado && !j.completada
                      ? <AlertCircle size={18} color="var(--coral)"/>
                      : <Circle size={18} color="var(--muted)"/>
                    }
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                      <div style={{fontWeight:700, fontSize:13.5, textTransform:"capitalize", color: j.esHoy?"var(--teal-d)":"var(--ink)"}}>
                        {fmtFechaJornada(j.fechaJornada)}
                        {j.esHoy && <span style={{fontSize:11,background:"var(--teal)",color:"#fff",borderRadius:6,padding:"1px 7px",marginLeft:8,fontWeight:600}}>HOY</span>}
                      </div>
                    </div>
                    <div className="muted" style={{fontSize:12, marginTop:3, display:"flex", alignItems:"center", gap:4}}>
                      <Store size={11}/>
                      {j.salaJornada?.nombre || "Sala por confirmar"}
                    </div>
                    {j.salaJornada?.ciudad && (
                      <div className="muted" style={{fontSize:11.5, marginTop:1}}>
                        {j.salaJornada.ciudad}{j.salaJornada.codigo ? ` · Sala ${j.salaJornada.codigo}` : ""}
                      </div>
                    )}
                    {/* Chips AM/PM si ya trabajó ese día */}
                    {(j.amOk || j.pmOk) && (
                      <div style={{display:"flex", gap:6, marginTop:5}}>
                        <span className={`chip ${j.amOk?"chip-ok":"chip-off"}`} style={{fontSize:10,padding:"2px 7px"}}>AM {j.amOk?"✓":"—"}</span>
                        <span className={`chip ${j.pmOk?"chip-ok":"chip-off"}`} style={{fontSize:10,padding:"2px 7px"}}>PM {j.pmOk?"✓":"—"}</span>
                      </div>
                    )}
                  </div>
                  {/* Pago estimado */}
                  <div style={{flexShrink:0, textAlign:"right"}}>
                    <div className="amount" style={{fontSize:13, color: j.completada ? "#16A34A" : "var(--muted)"}}>
                      {j.completada ? fmtCLP(PAGO_JORNADA) : j.esPasado && !j.completada ? "Incompleta" : fmtCLP(PAGO_JORNADA)}
                    </div>
                    <div className="muted" style={{fontSize:10.5}}>jornada</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* SALA ASIGNADA HOY */}
      {sala && (
        <div style={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:16,padding:"14px",marginTop:10,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:11,background:"#E4F4F1",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Store size={19} color="var(--teal)"/>
          </div>
          <div style={{flex:1}}>
            <div className="eyebrow" style={{marginBottom:3}}>Sala asignada hoy</div>
            <div style={{fontWeight:700,fontSize:14,lineHeight:1.25}}>{sala?.nombre || "—"}</div>
            <div className="muted" style={{fontSize:12,marginTop:1}}>{sala?.ciudad}{sala?.codigo ? ` · Sala ${sala.codigo}` : ""}</div>
          </div>
        </div>
      )}

      {/* TODO LO SIGUIENTE SOLO SI HAY JORNADA HOY */}
      {sala && <>
      <div className="card">
        <div className="ring-wrap">
          <div style={{position:"relative"}}>
            <ShiftRing pct={pct}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div className="disp" style={{fontWeight:700,fontSize:19}}>{doneCount}/{steps.length}</div>
            </div>
          </div>
          <div className="ring-meta">
            <div className="big disp">Tu jornada</div>
            <div className="lbl">{doneCount===steps.length?"¡Jornada completa! 🎉":"Pasos pendientes"}</div>
            <div className="steps">
              {steps.map(s=>(
                <div key={s.k} className={`step ${s.done?"on":""}`}>
                  {s.done?<CheckCircle2 size={14} color="#16b8a6"/>:<Circle size={14} color="#C3D6D4"/>}
                  {s.k}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TURNOS */}
      <div className="sec-title">Turnos</div>
      <TurnoMini k="am"/>
      <TurnoMini k="pm"/>

      {/* STOCK POR PRODUCTO */}
      <div className="sec-title">Stock en sala</div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"10px 14px 6px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid var(--line)"}}>
          <span style={{fontSize:12,fontWeight:600,color:"var(--muted)"}}>Actualizado al viernes {lf}</span>
          <span style={{fontSize:11,color:"var(--muted)"}}>Unidades</span>
        </div>
        {prods.map((p,i)=>{
          const s = stock[p.id];
          const total = typeof s === "number" ? s : null;
          const cero = total === 0;
          return (
            <div key={p.id} className="stk-row" style={{borderBottom:i<prods.length-1?"1px solid var(--line)":undefined}}>
              <div className="stk-nm">{p.nombre}</div>
              <span className={cero?"st-g0":"st-g"}>{total ?? "—"}</span>
            </div>
          );
        })}
        <div className="rep-bar">
          <div className="rep-txt"><AlertCircle size={13}/> {sala?.reponedor?"Si tienes quiebres de stock, comunícate con el/la reponedor para solicitar más mercadería.":"Si tienes quiebres de stock, contacta a tu coordinador/a."}</div>
          {sala?.reponedor&&<div className="rep-row"><div><div style={{fontWeight:700,fontSize:13.5}}>{sala.reponedor}</div><div className="muted" style={{fontSize:11.5}}>{sala.fono}</div></div><a href={`tel:+${sala.fono}`} className="rep-call"><Phone size={18} color="var(--teal-d)"/></a></div>}
        </div>
      </div>

      {/* COMISIÓN HOY */}
      <div className="card comm" style={{marginBottom:4}}>
        <div className="lbl">Comisión aproximada del día</div>
        <div className="amt">{fmtCLP(comm.total)}</div>
        <div style={{display:"flex",gap:20,fontSize:12,marginTop:10,opacity:.88}}>
          <span>{comm.unidades} unidades</span>
          <span>Venta {fmtCLP(comm.ventasTotal)}</span>
        </div>
        <div style={{marginTop:12,background:"rgba(255,255,255,.1)",borderRadius:10,padding:"9px 12px",fontSize:11.5,lineHeight:1.5,opacity:.9}}>
          ⚠️ Las comisiones serán confirmadas según la venta reportada por sistema B2B de Lider. Este es un cálculo preliminar.
        </div>
      </div>

      </>} {/* fin guard sala */}

      {/* HISTORIAL — siempre visible */}
      <ResumenCampana pid={pid} db={db}/>

      {/* Capacitación siempre visible cuando no hay jornada */}
      {!sala && (
        <div className="card" style={{marginTop:14,display:"flex",alignItems:"center",gap:12,background:"#E4F4F1",border:"none"}}>
          <GraduationCap size={22} color="var(--teal)"/>
          <div>
            <div style={{fontWeight:600,fontSize:14,color:"var(--teal-d)"}}>Revisa el material de capacitación</div>
            <div className="muted" style={{fontSize:12}}>Disponible en la pestaña Capacitación</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ RESUMEN CAMPAÑA ============================ */

const PAGO_JORNADA = 22000; // CLP fijo por jornada activada (AM+PM ambos completos)

function ResumenCampana({ pid, db }) {
  const mesActual = todayISO().slice(0, 7); // "YYYY-MM"

  const registros = Object.entries(db.records||{})
    .filter(([k]) => k.startsWith(pid+"__") && k.split("__")[1]?.startsWith(mesActual))
    .map(([k, r]) => {
      const fecha = k.split("__")[1];
      const rec = normalizeRec(r, pid, fecha);
      const comm = calcDia(rec);
      const amOk = !!rec.turnos.am.entrada && !!rec.turnos.am.salida;
      const pmOk = !!rec.turnos.pm.entrada && !!rec.turnos.pm.salida;
      const jornadaCompleta = amOk && pmOk;
      const pagoJornada = jornadaCompleta ? PAGO_JORNADA : 0;
      return { fecha, comm, amOk, pmOk, jornadaCompleta, pagoJornada };
    })
    .filter(r => r.amOk || r.pmOk || r.comm.unidades > 0)
    .sort((a,b) => b.fecha.localeCompare(a.fecha));

  if (!registros.length) return null;

  const totalComision = registros.reduce((s,r)=>s+r.comm.total, 0);
  const totalJornadas = registros.reduce((s,r)=>s+r.pagoJornada, 0);
  const totalUnidades = registros.reduce((s,r)=>s+r.comm.unidades, 0);
  const gran_total = totalComision + totalJornadas;
  const jornadasCompletas = registros.filter(r=>r.jornadaCompleta).length;

  const fmtFecha = f => {
    const d = new Date(f+"T12:00");
    return d.toLocaleDateString("es-CL",{weekday:"short",day:"numeric",month:"short"});
  };

  const mesNombre = new Date(mesActual+"-15").toLocaleDateString("es-CL",{month:"long",year:"numeric"});

  return (
    <>
      <div className="sec-title" style={{marginTop:20}}>
        Mi resumen · <span style={{textTransform:"capitalize"}}>{mesNombre}</span>
      </div>

      {/* Totales acumulados */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
        <div style={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:16,padding:"14px 12px"}}>
          <div className="eyebrow" style={{marginBottom:6}}>Jornadas</div>
          <div className="amount" style={{fontSize:22,color:"var(--teal)"}}>{jornadasCompletas}</div>
          <div className="muted" style={{fontSize:11.5,marginTop:2}}>{fmtCLP(totalJornadas)} acum.</div>
        </div>
        <div style={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:16,padding:"14px 12px"}}>
          <div className="eyebrow" style={{marginBottom:6}}>Unidades</div>
          <div className="amount" style={{fontSize:22,color:"var(--teal)"}}>{totalUnidades}</div>
          <div className="muted" style={{fontSize:11.5,marginTop:2}}>{fmtCLP(totalComision)} acum.</div>
        </div>
      </div>

      {/* Total acumulado */}
      <div style={{background:"linear-gradient(135deg,var(--teal-d),#063b40)",borderRadius:16,padding:"16px",marginTop:10,color:"#fff"}}>
        <div style={{fontSize:11,fontWeight:700,opacity:.8,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Total estimado del mes</div>
        <div style={{fontFamily:"'Segoe UI',system-ui",fontWeight:700,fontSize:30,letterSpacing:"-.02em"}}>{fmtCLP(gran_total)}</div>
        <div style={{fontSize:11,marginTop:4,opacity:.75}}>Jornadas {fmtCLP(totalJornadas)} + Comisiones {fmtCLP(totalComision)}</div>
        <div style={{marginTop:10,background:"rgba(255,255,255,.1)",borderRadius:8,padding:"8px 10px",fontSize:11,lineHeight:1.5,opacity:.9}}>
          ⚠️ Montos aproximados. Las comisiones reales se confirman por el sistema B2B de Lider.
        </div>
      </div>

      {/* Detalle por día */}
      <div className="card" style={{padding:0,overflow:"hidden",marginTop:10}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,fontWeight:600,color:"var(--muted)"}}>Detalle por jornada</span>
          <span style={{fontSize:11,color:"var(--muted)"}}>Jornada + Comisión</span>
        </div>
        {registros.map((r,i) => (
          <div key={r.fecha} style={{display:"flex",alignItems:"center",padding:"11px 14px",borderBottom:i<registros.length-1?"1px solid var(--line)":undefined,gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13.5,textTransform:"capitalize"}}>{fmtFecha(r.fecha)}</div>
              <div style={{display:"flex",gap:6,marginTop:3}}>
                <span className={`chip ${r.amOk?"chip-ok":"chip-off"}`} style={{fontSize:10,padding:"2px 7px"}}>AM {r.amOk?"✓":"—"}</span>
                <span className={`chip ${r.pmOk?"chip-ok":"chip-off"}`} style={{fontSize:10,padding:"2px 7px"}}>PM {r.pmOk?"✓":"—"}</span>
                {r.jornadaCompleta
                  ? <span className="chip chip-ok" style={{fontSize:10,padding:"2px 7px"}}>Jornada ✓</span>
                  : <span className="chip chip-warn" style={{fontSize:10,padding:"2px 7px"}}>Incompleta</span>
                }
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div className="amount" style={{fontSize:14,color:r.jornadaCompleta?"var(--teal)":"var(--muted)"}}>{fmtCLP(r.pagoJornada + r.comm.total)}</div>
              <div className="muted" style={{fontSize:10.5,marginTop:1}}>{fmtCLP(r.pagoJornada)} + {fmtCLP(r.comm.total)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MiniStat({icon:Ic,label,val,accent}){
  return(
    <div style={{flex:1}}>
      <div className="muted" style={{fontSize:10.5,display:"flex",alignItems:"center",gap:3}}><Ic size={11}/> {label}</div>
      <div className="amount" style={{fontSize:13.5,marginTop:2,color:accent?"var(--teal)":"var(--ink)"}}>{val}</div>
    </div>
  );
}

// El flujo de marcación integra fotos (entrada AM) y ventas (salida AM y PM)

function Marcar({ rec, updateRec, sala, cfg, turno, comm, pid }) {
  const [loading, setLoading] = useState(false);
  const tr = rec.turnos[turno];
  const tt = TURNOS[turno];

  const stock = sala ? (STOCK_SALAS[sala.id] || {}) : {};
  // Si todo el stock está en 0 (no actualizado), mostrar todos los productos
  const stockVacio = Object.keys(stock).length === 0 || Object.values(stock).every(v => (typeof v==="number" ? v : 0) === 0);
  const prods = PRODUCTOS.filter(p => {
    if (sala?.productos && !sala.productos.includes(p.id)) return false;
    if (stockVacio) return true;
    const s = stock[p.id];
    if (s === undefined || s === null) return true;
    return (typeof s === "number" ? s : 0) > 0;
  });

  const [gpsPreview, setGpsPreview] = useState(null);
  const gpsCacheRef = useRef(null); // GPS prefetcheado en background

  // Prefetch GPS en background cuando aparece la pantalla de salida
  // así cuando el promotor toca "Marcar salida" ya está listo
  useEffect(() => {
    const needsGps = (tr.entrada && !tr.salida);
    if (!needsGps) return;
    let cancelled = false;
    gpsCacheRef.current = null;
    getGPS().then(gps => {
      if (!cancelled) gpsCacheRef.current = gps;
    });
    return () => { cancelled = true; };
  }, [!!tr.entrada, !!tr.salida]);

  async function iniciarMarcacion(tipo) {
    setLoading(true);
    // Usar GPS prefetcheado si está disponible, sino esperar
    const gps = gpsCacheRef.current || await getGPS();
    gpsCacheRef.current = null;
    setLoading(false);
    setGpsPreview({ ...(gps || { lat:null, lng:null, acc:null }), tipo });
  }

  async function confirmarMarcacion() {
    const { lat, lng, acc, tipo } = gpsPreview;
    setGpsPreview(null);
    setLoading(true);

    const stamp = { ts:Date.now() };
    if (lat) { stamp.lat=lat; stamp.lng=lng; stamp.acc=acc; }

    // Capturar fotos y cantidades ANTES de updateRec
    const fotosActuales = tipo==="salida" && turno==="am"
      ? { ...rec.turnos.am.fotosProducto }
      : {};
    const cantidadesActuales = tipo==="salida"
      ? { ...rec.turnos[turno].cantidades }
      : {};

    // Guardar localmente
    updateRec(r=>({...r, turnos:{...r.turnos,[turno]:{...r.turnos[turno],[tipo]:stamp}}}));

    const promotorObj = pid==="udemo" ? PROMOTOR_DEMO : PROMOTORES.find(p=>p.id===pid)||{nombre:"Promotor"};

    try {
      // 1. Marcación → Sheets
      const marcRes = await fetch("/.netlify/functions/sheets-append", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sheet:"Marcaciones", row:{
          fecha: todayISO(),
          promotor: promotorObj.nombre,
          sala: sala.nombre,
          ciudad: sala.ciudad,
          turno: turno.toUpperCase(),
          tipo: tipo==="entrada"?"Entrada":"Salida",
          hora: hhmm(stamp.ts),
          lat: stamp.lat!=null ? stamp.lat.toFixed(6) : "",
          lng: stamp.lng!=null ? stamp.lng.toFixed(6) : "",
          acc: stamp.acc??"",
          dist: "",
          enLocal: "",
        }})
      });
      if(!marcRes.ok) console.error("Sheets marcacion error:", await marcRes.text());

      if (tipo==="salida") {
        // 2. Ventas → Sheets
        const rows = PRODUCTOS.filter(p=>cantidadesActuales[p.id]>0).map(p=>({
          fecha: todayISO(),
          promotor: promotorObj.nombre,
          sala: sala.nombre,
          ciudad: sala.ciudad,
          turno: turno.toUpperCase(),
          producto: p.nombre,
          unidades: cantidadesActuales[p.id],
          precio: p.precio,
          comisionUnit: p.comision,
          comisionTotal: cantidadesActuales[p.id]*p.comision,
        }));
        if(rows.length>0) {
          const ventasRes = await fetch("/.netlify/functions/sheets-append", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ sheet:"Ventas", rows })
          });
          if(!ventasRes.ok) console.error("Sheets ventas error:", await ventasRes.text());
        }

        // 3. Fotos → Drive (solo salida AM)
        if (turno==="am") {
          const fotoEntries = Object.entries(fotosActuales).filter(([,v])=>v);
          for (const [prodId, dataUrl] of fotoEntries) {
            const prod = PRODUCTOS.find(p=>p.id===prodId);
            const fileName = `${todayISO()}_${promotorObj.nombre.replace(/ /g,"_")}_${sala.codigo||sala.id}_${(prod?.nombre||prodId).replace(/ /g,"_")}.jpg`;
            try {
              const {fileId} = await uploadToDriveDirect(dataUrl, fileName, "1SSaJ_YJIhiVouHUzxfU1n273tK_aR7D7");
              console.log(`✓ Foto: ${fileName} (${fileId})`);
            } catch(e) { console.error(`✗ Foto ${fileName}:`, e.message); }
          }
        }
      }
    } catch(e) { console.error("Sync error:", e); }

    setLoading(false);
  }

  // Pantalla de confirmación con mapa
  if (gpsPreview) return (
    <GpsConfirm
      gps={gpsPreview}
      sala={sala}
      turno={turno}
      onConfirmar={confirmarMarcacion}
      onCancelar={()=>setGpsPreview(null)}
    />
  );

  const fotosOk = prods.every(p=>tr.fotosProducto?.[p.id]);

  // ENTRADA AM: primero fotos, luego marcar entrada
  if (turno==="am" && !tr.entrada) return (
    <EntradaAM loading={loading} onMarcar={()=>iniciarMarcacion("entrada")}
      sala={sala} tr={tr} prods={prods} updateRec={updateRec}/>
  );
  // SALIDA AM: ventas + marcar salida
  if (turno==="am" && tr.entrada && !tr.salida) return (
    <SalidaConVentas tr={tr} tt={tt} loading={loading} onMarcar={()=>iniciarMarcacion("salida")}
      prods={prods} updateRec={updateRec} turno="am" rec={rec} sala={sala} comm={comm} tipo="AM"/>
  );
  // ENTRADA PM: solo botón
  if (turno==="pm" && !tr.entrada) return (
    <MarcarEntrada loading={loading} onMarcar={()=>iniciarMarcacion("entrada")} sala={sala} tipo="PM"/>
  );
  // SALIDA PM: ventas + audio + marcar salida
  if (turno==="pm" && tr.entrada && !tr.salida) return (
    <SalidaConVentas tr={tr} tt={tt} loading={loading} onMarcar={()=>iniciarMarcacion("salida")}
      prods={prods} updateRec={updateRec} turno="pm" rec={rec} sala={sala} comm={comm} tipo="PM"/>
  );
  return <TurnoCerrado tr={tr} tt={tt} comm={comm} turno={turno} sala={sala} prods={prods}/>;
}

function EntradaAM({ loading, onMarcar, sala, tr, prods, updateRec }) {
  const fileRef = useRef(null);
  const prodRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const fotosOk = prods.every(p => tr.fotosProducto?.[p.id]);
  const fotosDone = prods.filter(p => tr.fotosProducto?.[p.id]).length;

  function pickFoto(pid) { prodRef.current = pid; fileRef.current.value = ""; fileRef.current.click(); }
  async function onFile(e) {
    const f = e.target.files[0]; if (!f) return;
    setBusy(true);
    try {
      const img = await compressImage(f);
      updateRec(r => ({ ...r, turnos: { ...r.turnos, am: { ...r.turnos.am, fotosProducto: { ...(r.turnos.am.fotosProducto || {}), [prodRef.current]: img } } } }));
    } catch {}
    setBusy(false);
  }
  function delFoto(pid) { updateRec(r => ({ ...r, turnos: { ...r.turnos, am: { ...r.turnos.am, fotosProducto: { ...(r.turnos.am.fotosProducto || {}), [pid]: null } } } })); }

  return (
    <>
      <div className="sec-title" style={{ marginTop: 16 }}>Fotos de góndola <span className="muted" style={{ fontWeight: 400 }}>({fotosDone}/{prods.length})</span></div>
      <p className="muted" style={{ fontSize: 13, margin: "4px 2px 10px" }}>
        Fotografía cada producto en góndola antes de marcar tu entrada.
      </p>
      <div className="pgrid">
        {prods.map(p => {
          const foto = tr.fotosProducto?.[p.id];
          return foto ? (
            <div className="ph" key={p.id}>
              <img src={foto} alt={p.nombre} />
              <span className="tag">{p.nombre.split(" ").slice(-1)[0]}</span>
              <button className="del" onClick={() => delFoto(p.id)}><X size={13} /></button>
            </div>
          ) : (
            <div className="ph ph-empty" key={p.id} onClick={() => pickFoto(p.id)}>
              <Camera size={20} color="var(--muted)" />
              <span>{p.nombre.split(" ").slice(0, 2).join(" ")}</span>
            </div>
          );
        })}
      </div>
      {busy && <div className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>Procesando…</div>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
      <div className="card" style={{ marginTop: 14 }}>
        {!fotosOk && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px", background: "#FEF3E2", borderRadius: 10, marginBottom: 12 }}>
            <AlertCircle size={15} color="var(--amber)" />
            <span style={{ fontSize: 13 }}>Completa las {prods.length} fotos para poder marcar entrada.</span>
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={loading || !fotosOk} onClick={onMarcar}>
          {loading ? <RefreshCw size={18} className="spin" /> : <LogIn size={18} />}
          {loading ? "Obteniendo ubicación…" : "Marcar entrada AM"}
        </button>
      </div>
    </>
  );
}

function MarcarEntrada({ loading, onMarcar, sala, tipo = "AM" }) {
  return (
    <>
      <div className="sec-title" style={{ marginTop: 16 }}>Turno {tipo}</div>
      <div className="card tight" style={{ display: "flex", alignItems: "center", gap: 10, background: "#E4F4F1", border: "none" }}>
        <Store size={17} color="var(--teal)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{sala?.nombre}</div>
          <div className="muted" style={{ fontSize: 12 }}>{sala?.ciudad}{sala?.codigo ? ` · Sala ${sala.codigo}` : ""}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <button className="btn btn-primary btn-block" disabled={loading} onClick={onMarcar}>
          {loading ? <RefreshCw size={18} className="spin" /> : <LogIn size={18} />}
          {loading ? "Obteniendo ubicación…" : `Marcar entrada ${tipo}`}
        </button>
      </div>
    </>
  );
}

/* SALIDA AM y PM: ventas + (audio si PM) + marcar salida */
function SalidaConVentas({ tr, tt, loading, onMarcar, prods, updateRec, turno, rec, sala, comm, tipo }) {
  const sub = calcTurno(tr);
  return (
    <>
      {/* Confirmación de entrada */}
      <div className="card tight" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, background: "#E4F4F1", border: "none" }}>
        <CheckCircle2 size={17} color="var(--teal)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Entrada {tipo} · {hhmm(tr.entrada.ts)} hrs</div>
          <GPSChip data={tr.entrada} sala={sala} />
        </div>
      </div>

      {/* Fotos resumen (solo AM) */}
      {tipo === "AM" && Object.keys(tr.fotosProducto || {}).length > 0 && (
        <>
          <div className="sec-title">Fotos de góndola ✓</div>
          <div className="pgrid" style={{ marginTop: 6 }}>
            {prods.map(p => {
              const foto = tr.fotosProducto?.[p.id];
              return foto ? (
                <div className="ph" key={p.id}>
                  <img src={foto} alt={p.nombre} />
                  <span className="tag">{p.nombre.split(" ").slice(-1)[0]}</span>
                </div>
              ) : null;
            })}
          </div>
        </>
      )}

      {/* Ventas */}
      <div className="sec-title">Ventas Turno {tipo}</div>
      <VentasForm tr={tr} prods={prods} updateRec={updateRec} turno={turno} />

      {/* Audio (solo PM) */}
      {tipo === "PM" && (
        <>
          <div className="sec-title">Audio de cierre</div>
          <AudioCierre rec={rec} updateRec={updateRec} />
        </>
      )}

      {/* Botón salida */}
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn btn-coral btn-block" disabled={loading} onClick={onMarcar}>
          {loading ? <RefreshCw size={18} className="spin" /> : <LogOut size={18} />}
          {loading ? "Obteniendo ubicación…" : `Marcar salida ${tipo}`}
        </button>
      </div>
    </>
  );
}

/* turno ya cerrado */
function TurnoCerrado({ tr, tt, comm, turno, sala, prods }) {
  const sub = comm[turno];
  return (
    <>
      <div className="sec-title" style={{marginTop:16}}>{tt.label} · Completado</div>
      <div className="card tight">
        <div style={{display:"flex",gap:14}}>
          <MiniStat icon={LogIn}  label="Entrada" val={hhmm(tr.entrada.ts)}/>
          <MiniStat icon={LogOut} label="Salida"  val={hhmm(tr.salida.ts)}/>
          <MiniStat icon={Clock}  label="Duración" val={elapsed(tr.entrada.ts,tr.salida.ts)}/>
        </div>
        <div style={{borderTop:"1px solid var(--line)",marginTop:12,paddingTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13}}>{sub.unidades} unidades · {fmtCLP(sub.ventasTotal)}</span>
          <span className="amount" style={{fontSize:18,color:"var(--teal)"}}>{fmtCLP(sub.base)}</span>
        </div>
      </div>
      {turno==="am" && Object.keys(tr.fotosProducto||{}).length>0 && (
        <>
          <div className="sec-title">Fotos de góndola</div>
          <div className="pgrid" style={{marginTop:8}}>
            {prods.map(p=>{
              const f=tr.fotosProducto?.[p.id];
              return f?(
                <div className="ph" key={p.id}><img src={f} alt={p.nombre}/><span className="tag">{p.nombre.split(" ").slice(-1)[0]}</span></div>
              ):(
                <div className="ph ph-empty" key={p.id} style={{cursor:"default"}}><Camera size={16} color="#ccc"/><span style={{color:"#ccc"}}>{p.nombre.split(" ")[0]}</span></div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ---- sub-componentes compartidos ---- */

/* ============================ GPS CONFIRM ============================ */

function GpsConfirm({ gps, sala, turno, onConfirmar, onCancelar }) {
  const tt = TURNOS[turno];
  const tipo = gps.tipo;
  const tipoLabel = tipo === "entrada" ? "Entrada" : "Salida";
  const hora = new Date().toLocaleTimeString("es-CL", {hour:"2-digit", minute:"2-digit"});

  const mapUrl = null; // no external map needed
  const [mapError, setMapError] = useState(false);

  return (
    <div style={{marginTop:16}}>
      <div className="sec-title">Confirmar {tipoLabel} {tt.label}</div>

      {/* Ubicación */}
      <div style={{borderRadius:16,overflow:"hidden",marginTop:10,background:"linear-gradient(135deg,#0A4C52,#0E6F76)",position:"relative",padding:"20px 16px",minHeight:160,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <MapPin size={18} color="rgba(255,255,255,.9)"/>
          <span style={{color:"rgba(255,255,255,.9)",fontSize:13,fontWeight:600}}>Tu ubicación en este momento</span>
        </div>
        {gps.lat ? (
          <div style={{marginTop:16}}>
            <div style={{fontFamily:"monospace",fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:2}}>
              <div>📍 {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</div>
              <div style={{fontSize:11,opacity:.7}}>Precisión: ±{gps.acc} metros</div>
            </div>
          </div>
        ) : (
          <div style={{marginTop:16,color:"rgba(255,255,255,.7)",fontSize:13}}>
            <AlertCircle size={16} style={{marginRight:6}}/> GPS no disponible en este momento
          </div>
        )}
        <div style={{position:"absolute",top:10,right:12,background:"rgba(0,0,0,.35)",borderRadius:8,padding:"4px 10px",color:"#fff",fontSize:13,fontWeight:700}}>
          {hora} hrs
        </div>
      </div>

      {/* Coordenadas */}
      <div className="card tight" style={{marginTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontWeight:600,fontSize:14}}>Tu ubicación registrada</span>
          {gps.lat
            ? <span className="chip chip-ok" style={{fontSize:11}}><CheckCircle2 size={12}/> GPS activo</span>
            : <span className="chip chip-warn" style={{fontSize:11}}><AlertCircle size={12}/> Sin GPS</span>}
        </div>
        {gps.lat ? (
          <div style={{fontFamily:"monospace",fontSize:12,color:"var(--muted)",lineHeight:1.8,background:"var(--bg)",borderRadius:8,padding:"8px 12px"}}>
            <div>Latitud:   <b style={{color:"var(--ink)"}}>{gps.lat.toFixed(6)}</b></div>
            <div>Longitud:  <b style={{color:"var(--ink)"}}>{gps.lng.toFixed(6)}</b></div>
            <div>Precisión: <b style={{color:"var(--ink)"}}>±{gps.acc} m</b></div>
          </div>
        ) : (
          <p className="muted" style={{fontSize:12}}>No se pudo obtener tu ubicación. La marcación se registrará sin coordenadas.</p>
        )}
        <div style={{fontSize:11,color:"var(--muted)",marginTop:8,lineHeight:1.5}}>
          📍 Esta ubicación y hora quedarán registradas en tu marcación de {tipoLabel.toLowerCase()} del {tt.label}.
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginTop:14}}>
        <button className="btn btn-out" style={{flex:1}} onClick={onCancelar}>Cancelar</button>
        <button className={`btn ${tipo==="entrada"?"btn-primary":"btn-coral"}`} style={{flex:2}} onClick={onConfirmar}>
          {tipo==="entrada" ? <LogIn size={18}/> : <LogOut size={18}/>}
          Confirmar {tipoLabel}
        </button>
      </div>
    </div>
  );
}

function GPSChip({ data, sala }) {
  if(!data?.lat) return <span className="muted" style={{fontSize:11.5,display:"flex",alignItems:"center",gap:4}}><AlertCircle size={11}/> Sin GPS</span>;
  const esDemo = sala?.id==="sdemo";
  const tolerancia = esDemo ? 999999 : 200;
  const enLocal = sala && data.dist!=null && data.dist<=tolerancia;
  if (esDemo) return (
    <span className="chip chip-ok" style={{marginTop:2,fontSize:11}}>
      <CheckCircle2 size={12}/> En el local (demo)
    </span>
  );
  return (
    <span className={`chip ${enLocal?"chip-ok":"chip-warn"}`} style={{marginTop:2,fontSize:11}}>
      {enLocal?<CheckCircle2 size={12}/>:<AlertCircle size={12}/>}
      {enLocal?"En el local":`A ${data.dist} m`}
    </span>
  );
}

function VentasForm({ tr, prods, updateRec, turno }) {
  const cant = tr.cantidades||{};
  const sub = calcTurno(tr);
  const setQty = (pid,q)=>{
    const n=Math.max(0,Math.round(Number(q)||0));
    updateRec(r=>{
      const next={...(r.turnos[turno].cantidades||{})};
      if(n===0) delete next[pid]; else next[pid]=n;
      return{...r,turnos:{...r.turnos,[turno]:{...r.turnos[turno],cantidades:next}}};
    });
  };
  const bump=(pid,d)=>setQty(pid,(cant[pid]||0)+d);
  return (
    <>
      <div className="card" style={{padding:6}}>
        {prods.map(p=>{
          const q=cant[p.id]||0;
          return(
            <div key={p.id} className="prod-row" style={{background:q>0?"#F1FAF8":"transparent"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13.5,lineHeight:1.25}}>{p.nombre}</div>
                <div className="muted" style={{fontSize:11.5,marginTop:2}}>
                  {fmtCLP(p.precio)} · <span style={{color:"var(--teal)",fontWeight:600}}>{fmtCLP(p.comision)} c/u</span>
                </div>
                {q>0 && <div className="amount" style={{fontSize:12,color:"var(--teal-d)",marginTop:2}}>Comisión {fmtCLP(q*p.comision)}</div>}
              </div>
              <div className="stepper">
                <button onClick={()=>bump(p.id,-1)} disabled={q===0}>−</button>
                <input value={q} onChange={e=>setQty(p.id,e.target.value.replace(/\D/g,""))} inputMode="numeric"/>
                <button onClick={()=>bump(p.id,1)}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {sub.unidades>0 && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 4px 0"}}>
          <span className="muted" style={{fontSize:13}}>{sub.unidades} u · {fmtCLP(sub.ventasTotal)}</span>
          <span className="amount" style={{fontSize:18,color:"var(--teal)"}}>{fmtCLP(sub.base)}</span>
        </div>
      )}
    </>
  );
}

function LineaR({ l, v }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
      <span style={{fontSize:13}}>{l}</span>
      <span className="amount" style={{fontSize:14}}>{fmtCLP(v)}</span>
    </div>
  );
}

function AudioCierre({ rec, updateRec }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const mr=useRef(null), chunks=useRef([]), timer=useRef(null), startT=useRef(0);
  const fmtS=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  async function startRec(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks.current=[];
      const m=new MediaRecorder(stream);
      m.ondataavailable=e=>e.data.size&&chunks.current.push(e.data);
      m.onstop=async()=>{
        const blob=new Blob(chunks.current,{type:"audio/webm"});
        const reader=new FileReader();
        reader.onload=async(ev)=>{
          const dataUrl=ev.target.result;
          setAudioURL(URL.createObjectURL(blob));
          updateRec(r=>{
            const prom = pid==="udemo" ? PROMOTOR_DEMO : PROMOTORES.find(p=>p.id===r.promotorId)||{nombre:"Promotor"};
            const salaObj=SALAS.find(s=>s.id===getSalaIdParaHoy(prom));
            const fileName=`${r.fecha}_${prom.nombre.replace(/ /g,"_")}_cierre.webm`;
            // Subir audio (fire and forget — no-cors no permite leer respuesta)
            uploadToDriveDirect(dataUrl, fileName, "1H_VkKpCwXnZISX-OAvhZnFF42uGRxwt2", "audio/webm");
            // Registrar cierre en Sheets inmediatamente
            const comm=calcDia(r);
            fetch("/.netlify/functions/sheets-append",{
              method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({sheet:"Cierres",row:{
                fecha:r.fecha, promotor:prom.nombre,
                sala:salaObj?.nombre||"", ciudad:salaObj?.ciudad||"",
                comisionAM:comm.am.base, comisionPM:comm.pm.base,
                comisionTotalDia:comm.total, audioUrl:""
              }})
            }).catch(()=>{});
            return{...r,audio:{dur:secs,ts:Date.now()}};
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t=>t.stop());
      };
      m.start(); mr.current=m; startT.current=Date.now(); setSecs(0); setRecording(true);
      timer.current=setInterval(()=>setSecs(Math.floor((Date.now()-startT.current)/1000)),250);
    }catch{ alert("No se pudo acceder al micrófono. Por favor permite el acceso al micrófono en tu navegador."); }
  }
  function stopRec(){ mr.current?.stop(); clearInterval(timer.current); setRecording(false); }
  function clear(){ setAudioURL(null); updateRec(r=>({...r,audio:null})); }

  if(rec.audio) return (
    <div className="card tight" style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:40,height:40,borderRadius:12,background:"#E4F4F1",display:"flex",alignItems:"center",justifyContent:"center"}}><Mic size={19} color="var(--teal)"/></div>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:14}}>Mensaje grabado ✓</div>
        <div className="muted" style={{fontSize:12}}>{hhmm(rec.audio.ts)} hrs · {fmtS(rec.audio.dur||0)}</div>
      </div>
      {audioURL && <audio controls src={audioURL} style={{display:"none"}}/>}
      <button className="btn-ghost" style={{color:"var(--coral)"}} onClick={clear}><Trash2 size={16}/></button>
    </div>
  );

  return (
    <div className="card tight">
      <p className="muted" style={{fontSize:13,marginBottom:12}}>
        Graba un breve mensaje contando cómo estuvo el turno: afluencia, ventas, incidencias.
      </p>
      {!recording ? (
        <button className="btn btn-primary btn-block" onClick={startRec}>
          <Mic size={18}/> Grabar mensaje de cierre
        </button>
      ) : (
        <button className="btn btn-block" style={{background:"#FFEDEA",color:"var(--coral)"}} onClick={stopRec}>
          <span className="rec-dot"/> Grabando {fmtS(secs)} · Toca para detener <Square size={15}/>
        </button>
      )}
    </div>
  );
}

const CAT_CONFIG = {
  marca:       { label:"Nanolife",               color:"#1E3A6E", bg:"#EEF2FF" },
  limpiapisos: { label:"Limpiapisos + Recarga",  color:"#0E6F76", bg:"#E4F4F1" },
  detergente:  { label:"Detergente en Cápsulas", color:"#7C3AED", bg:"#F5F3FF" },
};

function Capacitacion({ training }) {
  const [unifOpen, setUnifOpen] = useState(false);
  const cats = ["marca","limpiapisos","detergente"];
  const icon = t => t==="video"?<Video size={17}/>:t==="pdf"?<FileText size={17}/>:t==="imagen"?<ImageIcon size={17}/>:<FileText size={17}/>;
  const uniforme = training.find(m=>m.tipo==="uniforme");
  const resto = training.filter(m=>m.tipo!=="uniforme");
  function openItem(m) {
    if (m.url) { window.open(m.url, "_blank"); return; }
    if (m.tipo==="uniforme") setUnifOpen(true);
  }
  return (
    <>
      <div style={{display:"flex",justifyContent:"center",padding:"20px 0 4px"}}>
        <NanoLogo height={42}/>
      </div>
      <p className="muted" style={{fontSize:13,textAlign:"center",margin:"4px 12px 0"}}>
        Repasa estos contenidos antes y durante la campaña.
      </p>
      {uniforme && (
        <>
          <div className="sec-title"><span style={{width:10,height:10,borderRadius:3,background:"#1E3A6E",display:"inline-block",flexShrink:0}}/> Presentación</div>
          <button onClick={()=>openItem(uniforme)} style={{width:"100%",background:"#EEF2FF",border:"1px solid #1E3A6E22",borderRadius:16,padding:"14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",marginTop:10}}>
            <div style={{width:52,height:52,borderRadius:11,background:"#1E3A6E",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:24}}>👔</span></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,color:"#1E3A6E"}}>{uniforme.titulo}</div>
              <div className="muted" style={{fontSize:12.5,marginTop:2}}>{uniforme.desc}</div>
            </div>
            <ChevronRight size={18} color="#1E3A6E"/>
          </button>
        </>
      )}
      {cats.map(cat => {
        const cfg = CAT_CONFIG[cat];
        const items = resto.filter(m=>m.categoria===cat);
        if(!items.length) return null;
        return (
          <div key={cat}>
            <div className="sec-title"><span style={{width:10,height:10,borderRadius:3,background:cfg.color,display:"inline-block",flexShrink:0}}/> {cfg.label}</div>
            {items.map(m => (
              <button key={m.id} onClick={()=>openItem(m)}
                style={{width:"100%",background:cfg.bg,border:`1px solid ${cfg.color}22`,borderRadius:16,padding:"14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",marginTop:10}}>
                <div style={{width:42,height:42,borderRadius:11,background:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:cfg.color,boxShadow:"0 1px 4px rgba(0,0,0,.08)"}}>{icon(m.tipo)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13.5,color:cfg.color}}>{m.titulo}</div>
                  <div className="muted" style={{fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{m.desc}</div>
                </div>
                <ChevronRight size={17} color={cfg.color}/>
              </button>
            ))}
          </div>
        );
      })}
      {!training.length && <div className="empty" style={{marginTop:20}}>El coordinador aún no ha subido material de capacitación.</div>}
      {unifOpen && !uniforme?.url && (
        <div className="scrim" onClick={()=>setUnifOpen(false)} style={{alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"calc(100% - 24px)",maxHeight:"90%",background:"#fff",borderRadius:22,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid var(--line)"}}>
              <b>Uniforme y presentación</b>
              <button style={{background:"var(--bg)",border:"none",borderRadius:9,width:34,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setUnifOpen(false)}><X size={18}/></button>
            </div>
            <div style={{overflowY:"auto"}}><UniformeImg/></div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ LOGIN SCREEN ============================ */

function LoginScreen({ promotores, salas, onLogin, configVersion }) {
  const [step, setStep] = useState("nombre"); // "nombre" | "rut"
  const [selId, setSelId] = useState(null);
  const [rut, setRut] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selProm = promotores.find(p=>p.id===selId);

  function handleSelectNombre(id) {
    setSelId(id); setRut(""); setError(""); setStep("rut");
  }

  function handleLogin() {
    const rutInput = normRut(rut);
    const rutGuardado = normRut(selProm?.rut||"");
    if (!rutInput) { setError("Ingresa tu RUT"); return; }
    // Si el promotor no tiene RUT configurado en el sheet, bloquear
    if (!rutGuardado) { setError("Tu RUT no está configurado aún. Contacta a tu coordinador/a."); return; }
    if (rutInput !== rutGuardado) { setError("RUT incorrecto. Intenta de nuevo."); return; }
    setLoading(true);
    setTimeout(()=>{ onLogin(selId); setLoading(false); }, 400);
  }

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#0A4C52,#0E6F76)"}}>
      {/* Header */}
      <div style={{padding:"48px 28px 28px",textAlign:"center"}}>
        <NanoLogo height={48}/>
        <div style={{color:"rgba(255,255,255,.9)",fontSize:15,fontWeight:600,marginTop:16}}>Plataforma de Promotoría</div>
        <div style={{color:"rgba(255,255,255,.65)",fontSize:13,marginTop:4}}>Campaña Lider 2026</div>
      </div>

      {/* Card */}
      <div style={{flex:1,background:"var(--bg)",borderRadius:"28px 28px 0 0",padding:"28px 20px",overflowY:"auto"}}>

        {step==="nombre" && (
          <>
            <div style={{fontFamily:"'Segoe UI',system-ui",fontWeight:700,fontSize:22,color:"var(--ink)",marginBottom:6}}>¡Hola! 👋</div>
            <div className="muted" style={{fontSize:14,marginBottom:20}}>Selecciona tu nombre para continuar.</div>
            {promotores.length === 0 && (
              <div className="empty">Cargando promotores… <br/><span style={{fontSize:12}}>Si esto demora, verifica la conexión.</span></div>
            )}
            {[...promotores.filter(p=>p.id!=="udemo" && !p._esDemo), PROMOTOR_DEMO].map((p,idx,arr)=>{
              const sl = salas.find(s=>s.id===getSalaIdParaHoy(p));
              const isDemo = p._esDemo || p.id==="udemo";
              const showSep = isDemo && idx > 0;
              return (
                <div key={p.id}>
                  {showSep && (
                    <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0 8px"}}>
                      <div style={{flex:1,height:1,background:"var(--line)"}}/>
                      <span style={{fontSize:11,color:"var(--muted)",fontWeight:600,letterSpacing:".06em"}}>MODO DEMO</span>
                      <div style={{flex:1,height:1,background:"var(--line)"}}/>
                    </div>
                  )}
                  <button onClick={()=>handleSelectNombre(p.id)}
                    style={{width:"100%",background:isDemo?"#FFF8E7":"var(--surface)",border:isDemo?"1.5px dashed #F5A623":"1px solid var(--line)",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",marginBottom:10,boxShadow:"0 1px 3px rgba(11,42,45,.06)"}}>
                    <div style={{background:isDemo?"#FEF3E2":"#E4F4F1",color:isDemo?"#92610A":"var(--teal)",border:isDemo?"1.5px solid #F5A623":"1.5px solid var(--mint)",width:44,height:44,flexShrink:0,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15}}>
                      {isDemo ? "⭐" : p.nombre.split(" ").map(w=>w[0]).join("").slice(0,2)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:isDemo?"#92610A":"var(--ink)"}}>{p.nombre}</div>
                      <div className="muted" style={{fontSize:12,marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                        <Store size={11}/>
                        {sl ? sl.nombre.replace("Hiper Lider - ","").replace("Lider Express - ","") : isDemo ? "Sala de ejemplo · Santiago" : "Sin jornada hoy"}
                      </div>
                    </div>
                    <ChevronRight size={18} color={isDemo?"#F5A623":"var(--muted)"}/>
                  </button>
                </div>
              );
            })}
          </>
        )}

        {step==="rut" && selProm && (
          <>
            <button onClick={()=>{setStep("nombre");setError("");}}
              style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"var(--teal)",cursor:"pointer",fontWeight:600,fontSize:14,marginBottom:20,padding:0}}>
              <ChevronRight size={16} style={{transform:"rotate(180deg)"}}/> Volver
            </button>

            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <div className="av" style={{background:"#E4F4F1",color:"var(--teal)",border:"2px solid var(--mint)",width:52,height:52,flexShrink:0,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18}}>
                {selProm.nombre.split(" ").map(w=>w[0]).join("").slice(0,2)}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:17,color:"var(--ink)"}}>{selProm.nombre}</div>
                <div className="muted" style={{fontSize:12}}>Ingresa tu RUT para confirmar</div>
              </div>
            </div>

            <label className="field-lbl">RUT (sin puntos ni guión)</label>
            <input className="inp" type="text" inputMode="numeric"
              placeholder={selProm?._esDemo ? "111111111" : "Ej: 208583662"}
              value={rut}
              onChange={e=>{setRut(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              style={{fontSize:18,letterSpacing:2,textAlign:"center"}}
              autoFocus
            />
            {selProm?._esDemo && (
              <div style={{fontSize:12,color:"#92610A",textAlign:"center",marginTop:6,background:"#FEF3E2",borderRadius:8,padding:"6px 12px"}}>
                RUT de acceso demo: <b>111111111</b>
              </div>
            )}
            {error && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px",background:"#FEE2E2",borderRadius:10,marginTop:10}}>
                <AlertCircle size={15} color="#DC2626"/>
                <span style={{fontSize:13,color:"#DC2626",fontWeight:500}}>{error}</span>
              </div>
            )}
            <button className="btn btn-primary btn-block" style={{marginTop:16,padding:"15px"}}
              disabled={loading||!rut} onClick={handleLogin}>
              {loading ? <RefreshCw size={18} className="spin"/> : <CheckCircle2 size={18}/>}
              {loading ? "Verificando…" : "Ingresar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CoordinadorSheet({ db, setDb, fecha, close }) {
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
          <Crown size={18} color="var(--amber)"/><b className="disp" style={{fontSize:17}}>Panel de coordinación</b>
        </div>
        <div className="sec-title">Equipo hoy</div>
        {PROMOTORES.map(p=>{
          const r=normalizeRec(db.records[`${p.id}__${fecha}`],p.id,fecha);
          const sl=SALAS.find(s=>s.id===p.salaId);
          const c=calcDia(r);
          const am=r.turnos.am.salida?"✓":r.turnos.am.entrada?"•":"–";
          const pm=r.turnos.pm.salida?"✓":r.turnos.pm.entrada?"•":"–";
          return(
            <div className="row-item" key={p.id}>
              <div className="av" style={{width:40,height:40,borderRadius:11,background:"#E4F4F1",color:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontFamily:"Segoe UI,system-ui",flexShrink:0}}>
                {p.nombre.split(" ").map(w=>w[0]).join("").slice(0,2)}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13.5}}>{p.nombre.split(" ")[0]}</div>
                <div className="muted" style={{fontSize:11.5}}>{sl?.ciudad||"—"} · AM {am} · PM {pm} · {c.unidades}u</div>
              </div>
              <span className="amount" style={{fontSize:14,color:"var(--teal)"}}>{fmtCLP(c.total)}</span>
            </div>
          );
        })}
        <div className="sec-title">Comisión por producto</div>
        <div className="card tight">
          {PRODUCTOS.map(p=>(
            <div className="row-item" key={p.id}>
              <div style={{flex:1,fontSize:13,fontWeight:600}}>{p.nombre}</div>
              <span className="amount" style={{fontSize:14,color:"var(--teal)"}}>{fmtCLP(p.comision)} c/u</span>
            </div>
          ))}
        </div>
        <div className="sec-title">Subir capacitación</div>
        <div className="card tight">
          <p className="muted" style={{fontSize:12}}>Próximamente disponible para subir material desde coordinación.</p>
        </div>
        <button className="btn btn-out btn-block" style={{marginTop:18}} onClick={close}>Cerrar</button>
      </div>
    </div>
  );
}
/* ENTRADA AM: fotos de góndola primero, luego botón marcar entrada */
