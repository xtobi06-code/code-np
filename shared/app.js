import { ladeWetter, KLEIDUNG_STANDARD, REGEN_SCHWELLE } from './weather.js';
import { icon, wetterSymbol } from './icons.js';
import { esc } from './util.js';

export async function holeWetter(einst) {
  const k = einst?.kleidung;
  return ladeWetter(k?.stufen || KLEIDUNG_STANDARD, k?.regenSchwelle ?? REGEN_SCHWELLE);
}

export function wetterHtml(w, size = 22) {
  const e = w.empfehlung;
  const kleidung = e ? esc(e.kleidung) + (e.schirm ? ' · Schirm' : '') : '';
  return `<span class="w-ic">${icon(wetterSymbol(w.code), size)}</span>`
    + `<span class="w-temp">${w.temperatur}°</span>`
    + (kleidung ? `<span class="w-kl">${w.morgen ? 'Morgen: ' : ''}${kleidung}</span>` : '');
}

export function starteZyklus(fn, sekunden) {
  const lauf = () => { if (!document.hidden) fn(); };
  setInterval(lauf, sekunden * 1000);
  document.addEventListener('visibilitychange', lauf);
}

let lock = null;
export function haltWachen() {
  if (!('wakeLock' in navigator)) return;
  const an = async () => {
    if (lock && !lock.released) return;
    try { lock = await navigator.wakeLock.request('screen'); } catch { /* braucht evtl. Tippen */ }
  };
  an();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) an(); });
  document.addEventListener('pointerdown', an);
}

let toastTimer = null;
export function toast(text, aktion, dauer = 5000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>${esc(text)}</span>${aktion ? `<button type="button">${esc(aktion.label)}</button>` : ''}`;
  const gezeigt = Date.now();
  // Taps direkt nach dem Einblenden (z. B. Nach-Tipper) lösen "Rückgängig" nicht aus
  if (aktion) el.querySelector('button').onclick = () => { if (Date.now() - gezeigt < 900) return; el.classList.remove('an'); aktion.fn(); };
  el.classList.add('an');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('an'), dauer);
}
