import { lesen, aendern, FehlerToken, config } from './github.js';
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

export async function ladeDatei(p) {
  if (pending[p]) return F[p];
  const r = await lesen(p);
  F[p] = r ? r.data : structuredClone(STANDARD[p]);
  for (const e of wsLesen()) if (e.p === p) F[p] = anwenden(e.op)(F[p]);
  if (p === 'einstellungen.json') setzeModule(F[p].module);
  return F[p];
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
    (r) => { pending[p]--; if (!pending[p]) F[p] = r.data; if (p === 'einstellungen.json') setzeModule(F[p].module); return r; },
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
      jobs.push(aendere('aufgaben.json', (d) => {
        const ids = new Set(d.aufgaben.map((a) => a.id));
        d.aufgaben.push(...neu.filter((a) => !ids.has(a.id)));
        return d;
      }, `Aufgaben erzeugt (${neu.length})`));
    }
  }
  if (F['dauerkosten.json'] && F['kosten.json']) {
    const b = dauerFaellig(F['dauerkosten.json'], F['kosten.json'], jetzt);
    if (b.length) {
      jobs.push(aendere('kosten.json', (d) => {
        const ids = new Set(d.buchungen.map((x) => x.id));
        d.buchungen.push(...b.filter((x) => !ids.has(x.id)));
        return d;
      }, 'Dauerkosten gebucht'));
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

export function aendereOp(p, op, nachricht) {
  const eintrag = { id: Math.random().toString(36).slice(2), p, op, nachricht };
  wsSchreiben([...wsLesen(), eintrag]);
  return aendere(p, anwenden(op), nachricht, true).then(
    (r) => { wsSchreiben(wsLesen().filter((e) => e.id !== eintrag.id)); return r; },
    (e) => {
      if (e instanceof FehlerToken) { wsSchreiben(wsLesen().filter((x) => x.id !== eintrag.id)); fehlerMelden(e); } else offlineMelden(wsLesen().length);
      throw e;
    },
  );
}

let holtNach = false;
export async function nachholen() {
  if (holtNach) return 0;
  holtNach = true;
  let erledigt = 0;
  try {
    for (const e of wsLesen()) {
      try {
        const r = await aendern(e.p, anwenden(e.op), e.nachricht, structuredClone(STANDARD[e.p]));
        if (!pending[e.p]) F[e.p] = r.data;
        wsSchreiben(wsLesen().filter((x) => x.id !== e.id));
        erledigt++;
      } catch (err) {
        if (err instanceof FehlerToken) break;
        break;
      }
    }
  } finally { holtNach = false; }
  return erledigt;
}
