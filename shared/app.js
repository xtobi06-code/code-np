import { lesen, FehlerToken } from './github.js';
import { ladeWetter, wetterZeile, KLEIDUNG_STANDARD, REGEN_SCHWELLE } from './weather.js';

export async function aktualisiereWetter(el) {
  let stufen = KLEIDUNG_STANDARD;
  let regen = REGEN_SCHWELLE;
  try {
    const s = await lesen('einstellungen.json');
    if (s && s.data.kleidung) {
      stufen = s.data.kleidung.stufen || stufen;
      regen = s.data.kleidung.regenSchwelle ?? regen;
    }
  } catch { /* Standardwerte */ }
  try {
    el.textContent = wetterZeile(await ladeWetter(stufen, regen));
  } catch {
    el.textContent = 'Wetter nicht verfügbar';
  }
}

// Zeigt den Verbindungsstatus zum Daten-Repo und liefert die Einstellungen zurück.
export async function pruefeSync(el) {
  try {
    const s = await lesen('einstellungen.json');
    if (!s) { el.innerHTML = '<span class="punkt warn"></span>Keine Daten gefunden'; return null; }
    el.innerHTML = `<span class="punkt ${s.offline ? 'warn' : 'ok'}"></span>${s.offline ? 'Offline, Zwischenspeicher' : 'Verbunden'}`;
    return s.data;
  } catch (e) {
    const kein = e instanceof FehlerToken;
    el.innerHTML = `<span class="punkt bad"></span>${kein ? 'Nicht verbunden' : 'Fehler'}`;
    el.title = e.message;
    return null;
  }
}

export function starteZyklus(fn, sekunden) {
  const lauf = () => { if (!document.hidden) fn(); };
  setInterval(lauf, sekunden * 1000);
  document.addEventListener('visibilitychange', lauf);
}

export async function haltWachen() {
  if (!('wakeLock' in navigator)) return;
  const an = async () => { try { await navigator.wakeLock.request('screen'); } catch { /* ignorieren */ } };
  await an();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) an(); });
}
