import { lesen, aendern, FehlerToken, config } from './github.js';
import { erzeugen } from './tasks.js';
import { dauerFaellig } from './finance.js';

export { FehlerToken, config };

export const STANDARD = {
  'einstellungen.json': { semester: { von: '', bis: '' }, pausen: [], stichtag: '', monatsbudget: 500, kleidung: null, licht: [] },
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
  return F[p];
}
export async function ladeAlle(pfade) {
  await Promise.all(pfade.map(ladeDatei));
}

// Ändert lokal sofort und schreibt danach in Reihenfolge auf GitHub (bei Konflikt mit frischen Daten neu).
export function aendere(p, fn, nachricht) {
  F[p] = fn(structuredClone(F[p] ?? STANDARD[p]));
  pending[p] = (pending[p] || 0) + 1;
  const job = () => aendern(p, fn, nachricht, structuredClone(STANDARD[p]));
  const prom = (queues[p] || Promise.resolve()).then(job);
  queues[p] = prom.catch(() => {});
  return prom.then(
    (r) => { pending[p]--; if (!pending[p]) F[p] = r.data; return r; },
    async (e) => {
      pending[p]--;
      fehlerMelden(e);
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
