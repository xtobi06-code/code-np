import { lesen, aendern, FehlerToken, config, zwischenstand } from './github.js';
import { erzeugen, setzeModule } from './tasks.js';
import { dauerFaellig } from './finance.js';

export { FehlerToken, config };

export const STANDARD = {
  'einstellungen.json': { name: '', semester: { von: '', bis: '' }, pausen: [], stichtag: '', monatsbudget: 500, kleidung: null, licht: [], module: null, panel: null },
  'regeln.json': { regeln: [] },
  'aufgaben.json': { aufgaben: [] },
  'einkauf.json': { artikel: [] },
  'kosten.json': { buchungen: [] },
  'kategorien.json': { kategorien: [] },
  'dauerkosten.json': { posten: [] },
  'termine.json': { termine: [] },
};

export const F = {};
const pending = {};
const queues = {};
let fehlerMelden = () => {};
export function beiFehler(fn) { fehlerMelden = fn; }

// Merkt je Datei, ob der letzte Abruf nur aus dem Zwischenspeicher kam.
const offlineStand = {};
export const istOffline = () => Object.values(offlineStand).some(Boolean);

export async function ladeDatei(p) {
  if (pending[p]) return F[p];
  const r = await lesen(p);
  offlineStand[p] = !!(r && r.offline);
  F[p] = r ? r.data : structuredClone(STANDARD[p]);
  for (const e of wsLesen()) if (e.p === p) F[p] = anwenden(e.op)(F[p]);
  if (p === 'einstellungen.json') setzeModule(F[p].module);
  return F[p];
}
// Sofort den letzten Stand zeigen, bis GitHub antwortet. Gibt zurück, ob überhaupt etwas da war.
export function ausCache(pfade) {
  let da = false;
  for (const p of pfade) {
    if (F[p]) { da = true; continue; }
    const c = zwischenstand(p);
    if (!c || !c.data) continue;
    F[p] = c.data;
    for (const e of wsLesen()) if (e.p === p) { try { F[p] = anwenden(e.op)(F[p]); } catch { /* egal */ } }
    if (p === 'einstellungen.json') setzeModule(F[p].module);
    da = true;
  }
  return da;
}
export async function ladeAlle(pfade) {
  await Promise.all(pfade.map(ladeDatei));
}

// Ändert lokal sofort und schreibt danach in Reihenfolge auf GitHub (bei Konflikt mit frischen Daten neu).
export function aendere(p, fn, nachricht, still = false) {
  F[p] = fn(structuredClone(F[p] ?? STANDARD[p]));
  pending[p] = (pending[p] || 0) + 1;
  const job = () => aendern(p, fn, nachricht, structuredClone(STANDARD[p]));
  const prom = (queues[p] || Promise.resolve()).then(job);
  queues[p] = prom.catch(() => {});
  return prom.then(
    (r) => { pending[p]--; offlineStand[p] = false; if (!pending[p]) F[p] = r.data; if (p === 'einstellungen.json') setzeModule(F[p].module); return r; },
    async (e) => {
      pending[p]--;
      if (!still) fehlerMelden(e);
      if (!pending[p]) { try { await ladeDatei(p); } catch { /* offline */ } }
      throw e;
    },
  );
}

export async function routine(jetzt = new Date()) {
  const jobs = [];
  const e = F['einstellungen.json'];
  if (e && F['regeln.json'] && F['aufgaben.json']) {
    const neu = erzeugen(e, F['regeln.json'].regeln || [], F['aufgaben.json'].aufgaben || [], jetzt);
    if (neu.length) {
      // Über die Warteschlange: Ohne Netz bleiben die neuen Aufgaben sichtbar und werden später nachgereicht.
      jobs.push(aendereOp('aufgaben.json', { liste: 'aufgaben', neu }, `Aufgaben erzeugt (${neu.length})`, true));
    }
  }
  if (F['dauerkosten.json'] && F['kosten.json']) {
    const b = dauerFaellig(F['dauerkosten.json'], F['kosten.json'], jetzt);
    if (b.length) {
      jobs.push(aendereOp('kosten.json', { liste: 'buchungen', neu: b }, 'Dauerkosten gebucht', true));
    }
  }
  await Promise.allSettled(jobs);
}

export const PANEL_STANDARD = { nachtVon: '23:00', nachtBis: '06:30', bewegung: true, glas: true, hintergrund: 'landschaft', fotoMinuten: 15 };
export const panelEinst = () => ({ ...PANEL_STANDARD, ...(F['einstellungen.json']?.panel || {}) });
// Datum für die Szene: normalerweise jetzt, zur Vorschau eine feste Uhrzeit.
export function szenenDatum() {
  const z = panelEinst().szeneZeit;
  const d = new Date();
  if (!z) return d;
  const [h, m] = String(z).split(':').map(Number);
  d.setHours(h, m || 0, 0, 0);
  return d;
}
export const lichtModi = () => F['einstellungen.json']?.licht || [];

/* Offline-Warteschlange: Änderungen als beschreibbare Operationen, die bei Netzproblemen
   im Browser gespeichert und später nachgereicht werden. Alle Operationen sind idempotent. */
const WS = 'np-warteschlange';
function wsLesen() { try { return JSON.parse(localStorage.getItem(WS)) || []; } catch { return []; } }
function wsSchreiben(l) { try { localStorage.setItem(WS, JSON.stringify(l)); } catch { /* voll oder gesperrt */ } }
export const offenNachzureichen = () => wsLesen().length;

// op = { liste, neu?: Eintrag oder Liste, ids?: [...], felder?: {...}, weg?: [Feldnamen] }
export function anwenden(op) {
  return (d) => {
    d = d || {};
    const arr = d[op.liste] || (d[op.liste] = []);
    if (op.neu) for (const n of [].concat(op.neu)) if (!arr.some((x) => x.id === n.id)) arr.push(n);
    if (op.ids) {
      for (const x of arr) {
        if (!op.ids.includes(x.id)) continue;
        Object.assign(x, op.felder || {});
        for (const k of op.weg || []) delete x[k];
      }
    }
    return d;
  };
}

let offlineMelden = () => {};
export function beiOffline(fn) { offlineMelden = fn; }

// Wendet alle wartenden Operationen einer Datei in ihrer Reihenfolge an. So kann eine ältere,
// noch nicht nachgereichte Änderung nie eine neuere überschreiben.
function alleOps(p) {
  const fn = (d) => {
    const es = wsLesen().filter((e) => e.p === p);
    fn.ids = es.map((e) => e.id);
    return es.reduce((x, e) => anwenden(e.op)(x), d);
  };
  return fn;
}
const wsOhne = (ids) => { const weg = new Set(ids); wsSchreiben(wsLesen().filter((e) => !weg.has(e.id))); };
const wsSichtbar = () => wsLesen().filter((e) => !e.auto).length;

// auto: vom System erzeugt (z. B. neue Aufgaben nach Stundenplan), ohne Offline-Meldung
export function aendereOp(p, op, nachricht, auto = false) {
  const eintrag = { id: Math.random().toString(36).slice(2), p, op, nachricht };
  if (auto) eintrag.auto = true;
  wsSchreiben([...wsLesen(), eintrag]);
  const fn = alleOps(p);
  return aendere(p, fn, nachricht, true).then(
    (r) => { wsOhne([...(fn.ids || []), eintrag.id]); return r; },
    (e) => {
      if (e instanceof FehlerToken) { wsOhne([eintrag.id]); fehlerMelden(e); } else if (!auto) offlineMelden(wsSichtbar());
      throw e;
    },
  );
}

let holtNach = false;
// Reicht alles Wartende nach, je Datei in einem Schreibvorgang. Gibt die Zahl der eigenen Änderungen zurück.
export async function nachholen() {
  if (holtNach) return 0;
  holtNach = true;
  let erledigt = 0;
  try {
    for (const p of [...new Set(wsLesen().map((e) => e.p))]) {
      const fn = alleOps(p);
      const n = wsLesen().filter((e) => e.p === p).length;
      const job = () => aendern(p, fn, n === 1 ? wsLesen().find((e) => e.p === p)?.nachricht || 'Nachgereicht' : `Nachgereicht (${n})`, structuredClone(STANDARD[p]));
      const prom = (queues[p] || Promise.resolve()).then(job);
      queues[p] = prom.catch(() => {});
      try {
        const r = await prom;
        offlineStand[p] = false;
        if (!pending[p]) F[p] = r.data;
        const ids = new Set(fn.ids || []);
        erledigt += wsLesen().filter((e) => ids.has(e.id) && !e.auto).length;
        wsOhne([...ids]);
      } catch { break; }
    }
  } finally { holtNach = false; }
  return erledigt;
}
