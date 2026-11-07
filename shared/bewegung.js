// Gemeinsame Bewegungen: Zeilen ein- und ausfahren, Zahlen weich ändern, Haptik, Wischen zum Löschen.
import { euro } from './util.js';

const AUS = 'cubic-bezier(.23, 1, .32, 1)';
const MQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
export const reduziert = () => MQ.matches;
// iOS zeigt :active (Druck-Feedback) nur, wenn irgendwo ein touchstart-Listener hängt
if (typeof document !== 'undefined') document.addEventListener('touchstart', () => {}, { passive: true });

/* ---------- Haptik ---------- */
// Android: vibrate. iOS (ab 18): ein versteckter Schalter, der beim Umschalten kurz klickt. iPad hat keinen Taptic-Motor.
let schalter = null;
export function haptik() {
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    if (!schalter) {
      schalter = document.createElement('label');
      schalter.setAttribute('aria-hidden', 'true');
      schalter.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.setAttribute('switch', '');
      i.tabIndex = -1;
      schalter.appendChild(i);
      document.body.appendChild(schalter);
    }
    schalter.click();
  } catch { /* egal */ }
}

/* ---------- Zeilen ---------- */
// Zeile schrumpft weg (Höhe und Deckkraft), danach kann neu gezeichnet werden, ohne dass die Liste springt.
export function rausfahren(el, ms = 240) {
  if (!el || !el.isConnected || reduziert() || !el.animate) return Promise.resolve();
  const h = el.getBoundingClientRect().height;
  const cs = getComputedStyle(el);
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  const a = el.animate([
    { height: `${h}px`, minHeight: '0px', opacity: 1, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom },
    { height: '0px', minHeight: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
  ], { duration: ms, easing: AUS, fill: 'forwards' });
  return a.finished.catch(() => {});
}
export function reinfahren(el, ms = 280) {
  if (!el || reduziert() || !el.animate) return;
  const h = el.getBoundingClientRect().height;
  if (!h) return;
  const ov = el.style.overflow;
  el.style.overflow = 'hidden';
  const a = el.animate([
    { height: '0px', minHeight: '0px', opacity: 0, transform: 'translateY(-4px)' },
    { height: `${h}px`, minHeight: '0px', opacity: 1, transform: 'none' },
  ], { duration: ms, easing: AUS });
  a.finished.catch(() => {}).then(() => { el.style.overflow = ov; });
}
// Neue Einträge merken; nach dem nächsten Zeichnen fahren sie ein.
const neue = new Set();
export function merkeNeu(...ids) { ids.flat().forEach((id) => id && neue.add(String(id))); }
export function zeigeNeue(wurzel) {
  if (!neue.size || !wurzel) return;
  wurzel.querySelectorAll('[data-id], [data-buchung]').forEach((el) => {
    const id = el.dataset.id || el.dataset.buchung;
    if (neue.has(id) && !el.closest('.eintraege')) { neue.delete(id); reinfahren(el); }
  });
}

/* ---------- Zahlen und Balken weich ändern ---------- */
// data-w="schlüssel" + style width  → Breite gleitet vom alten Wert
// data-d="schlüssel" + stroke-dasharray → Ring gleitet
// data-n="schlüssel" data-v="123.4" data-f="euro|int" → Zahl zählt
const alt = new Map();
const FMT = { euro: (v) => euro(v), int: (v) => String(Math.round(v)) };
export function weich(wurzel) {
  if (!wurzel) return;
  const an = !reduziert();
  wurzel.querySelectorAll('[data-w]').forEach((el) => {
    const k = `w:${el.dataset.w}`;
    const ziel = el.style.width;
    const vorher = alt.get(k);
    alt.set(k, ziel);
    if (!an || vorher == null || vorher === ziel) return;
    el.style.transition = 'none';
    el.style.width = vorher;
    el.getBoundingClientRect();
    el.style.transition = `width .7s ${AUS}`;
    el.style.width = ziel;
  });
  wurzel.querySelectorAll('[data-d]').forEach((el) => {
    const k = `d:${el.dataset.d}`;
    const ziel = el.getAttribute('stroke-dasharray');
    const vorher = alt.get(k);
    alt.set(k, ziel);
    if (!an || vorher == null || vorher === ziel) return;
    el.style.transition = 'none';
    el.style.strokeDasharray = vorher;
    el.getBoundingClientRect();
    el.style.transition = `stroke-dasharray .8s ${AUS}`;
    el.style.strokeDasharray = ziel;
  });
  wurzel.querySelectorAll('[data-n]').forEach((el) => {
    const k = `n:${el.dataset.n}`;
    const ziel = Number(el.dataset.v);
    const vorher = alt.get(k);
    alt.set(k, ziel);
    if (!an || vorher == null || vorher === ziel || !Number.isFinite(ziel)) return;
    const f = FMT[el.dataset.f] || FMT.int;
    const t0 = performance.now();
    const ms = 600;
    const schritt = (t) => {
      if (!el.isConnected) return;
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - p) ** 3;
      el.textContent = f(vorher + (ziel - vorher) * e);
      if (p < 1) requestAnimationFrame(schritt);
    };
    el.textContent = f(vorher);
    requestAnimationFrame(schritt);
  });
}

/* ---------- Wischen zum Löschen ---------- */
// Kurz wischen öffnet den Löschen-Knopf, ganz durchwischen (oder schnell und weit) löscht sofort.
// Gelöscht wird, indem der Löschen-Knopf der Zeile angeklickt wird; die Seiten behandeln den Klick wie bisher.
export function wischLoeschen({ wurzel = document, zeile, breite = 96, vorn = '.vorn', knopf = '.loesch', ignorieren = null }) {
  let offen = null;
  let zeit = 0;
  let d = null;
  const breiteVon = () => (typeof breite === 'function' ? breite() : breite);
  const setze = (z, t) => {
    const v = z.querySelector(vorn);
    const k = z.querySelector(knopf);
    if (v) v.style.transform = t ? `translateX(${t}px)` : '';
    if (k) k.style.width = t ? `${-t}px` : '';
  };
  const zu = () => {
    if (!offen) return;
    if (offen.isConnected) { offen.classList.remove('auf', 'voll'); setze(offen, 0); }
    offen = null;
  };
  const loeschen = (z) => {
    const W = z.getBoundingClientRect().width;
    z.classList.add('auf', 'voll', 'weg');
    setze(z, -W);
    offen = null;
    setTimeout(() => rausfahren(z, 220).then(() => {
      zeit = 0;
      z.querySelector(knopf)?.click();
    }), 170);
  };
  wurzel.addEventListener('pointerdown', (e) => {
    if (!e.target.closest) return;
    const z = e.target.closest(zeile);
    if (!z || (ignorieren && e.target.closest(ignorieren))) { if (!e.target.closest(knopf)) zu(); return; }
    if (e.target.closest(knopf)) return; // Antippen von Löschen darf die Zeile nicht erst schließen
    if (!z.querySelector(knopf) || z.classList.contains('weg')) return;
    if (offen && offen !== z) zu();
    d = { x: e.clientX, y: e.clientY, z, id: e.pointerId, start: offen === z ? -breiteVon() : 0, t: 0, aktiv: false, spur: [] };
  });
  wurzel.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.aktiv) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { d = null; return; }
      if (Math.abs(dx) < 8) return;
      d.aktiv = true;
      d.W = d.z.getBoundingClientRect().width;
      d.z.classList.add('zieht');
      try { d.z.setPointerCapture(e.pointerId); } catch { /* egal */ }
    }
    let t = d.start + dx;
    if (t > 0) t = 0;
    if (t < -d.W) t = -d.W;
    d.t = t;
    setze(d.z, t);
    const voll = -t > Math.max(breiteVon() * 1.9, d.W * 0.55);
    if (voll !== d.z.classList.contains('voll')) { d.z.classList.toggle('voll', voll); if (voll) haptik(); }
    d.spur.push([e.timeStamp, e.clientX]);
    if (d.spur.length > 6) d.spur.shift();
  });
  const ende = (e) => {
    if (!d || (e && e.pointerId !== d.id)) return;
    const x = d;
    d = null;
    if (!x.aktiv) return;
    zeit = Date.now();
    x.z.classList.remove('zieht');
    const B = breiteVon();
    const [a, b] = [x.spur[0], x.spur[x.spur.length - 1]];
    const v = a && b && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; // px pro ms
    if (x.z.classList.contains('voll') || (v < -1.4 && -x.t > B * 1.2)) { loeschen(x.z); return; }
    const auf = v < -0.4 ? true : v > 0.4 ? false : -x.t > B / 2;
    x.z.classList.remove('voll');
    if (auf) { setze(x.z, -B); x.z.classList.add('auf'); offen = x.z; } else { setze(x.z, 0); x.z.classList.remove('auf'); if (offen === x.z) offen = null; }
  };
  wurzel.addEventListener('pointerup', ende);
  wurzel.addEventListener('pointercancel', ende);
  return {
    zu,
    offen: () => (offen && offen.isConnected ? offen : null),
    eben: () => Date.now() - zeit < 350,
  };
}
