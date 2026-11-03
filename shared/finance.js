import { isoDate, MON_LANG } from './util.js';

export const KAT_SYMBOLE = {
  Lebensmittel: 'korb', Essen: 'besteck', Supplements: 'pille', Kleidung: 'shirt', Haushalt: 'haus',
  Freizeit: 'stern', 'Mobilität': 'bus', Digital: 'handy', Sonstiges: 'punkte',
};
export const katSymbol = (n) => KAT_SYMBOLE[n] || 'punkte';

export const aktive = (kosten) => (kosten?.buchungen || []).filter((b) => !b.storniert);
export const monatKey = (d) => isoDate(d).slice(0, 7);
export const monatName = (key) => MON_LANG[Number(key.slice(5, 7)) - 1];

export function letzteMonate(n, jetzt) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monatKey(new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1)));
  return out;
}

export function uebersicht(kosten, kats, einst, zeitraum, jetzt = new Date()) {
  const N = zeitraum === '3m' ? 3 : zeitraum === '12m' ? 12 : 1;
  const bs = aktive(kosten);
  let monate = letzteMonate(N, jetzt);
  if (N > 1) {
    const erste = bs.map((b) => b.datum.slice(0, 7)).sort()[0];
    if (erste) monate = monate.filter((m) => m >= erste);
    if (!monate.length) monate = [monatKey(jetzt)];
  }
  const set = new Set(monate);
  const n = monate.length;
  const alleIm = bs.filter((b) => set.has(b.datum.slice(0, 7)));
  // Dauerkosten sind fix: Sie werden vom Budget abgezogen und tauchen nicht als Ausgaben auf.
  const im = alleIm.filter((b) => b.quelle !== 'dauer');
  const fixKat = (name) => alleIm.filter((b) => b.quelle === 'dauer' && b.kategorie === name).reduce((s, b) => s + b.betrag, 0) / n;
  const fix = alleIm.filter((b) => b.quelle === 'dauer').reduce((s, b) => s + b.betrag, 0) / n;
  const summe = im.reduce((s, b) => s + b.betrag, 0);
  const katSumme = kats.reduce((s, k) => s + (Number(k.budget) || 0), 0);
  const budget = Math.max(0, (Number(einst?.monatsbudget) || katSumme) - fix);
  const bekannt = new Set(kats.map((k) => k.name));
  const ks = kats.map((k) => {
    const e = im.filter((b) => b.kategorie === k.name || (k.name === 'Sonstiges' && !bekannt.has(b.kategorie)));
    const s = e.reduce((x, b) => x + b.betrag, 0);
    return { ...k, budget: k.budget ? Math.max(0, Number(k.budget) - fixKat(k.name)) : k.budget, fix: fixKat(k.name), summe: s, wert: s / n, eintraege: e.sort((a, b) => b.datum.localeCompare(a.datum)) };
  });
  let rest = null;
  let restTag = null;
  if (N === 1) {
    rest = budget - summe;
    const letzter = new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 0).getDate();
    restTag = rest / (letzter - jetzt.getDate() + 1);
  }
  return { N, n, monate, summe, wert: summe / n, fix, budget, rest, restTag, kats: ks };
}

export function verlauf(kosten, kat, jetzt = new Date()) {
  const fest = aktive(kosten).filter((b) => b.quelle !== 'dauer'); // Fixkosten sagen nichts über Sparpotenzial aus
  const bs = fest.filter((b) => !kat || b.kategorie === kat);
  const alle = fest.map((b) => b.datum.slice(0, 7)).sort();
  let monate = letzteMonate(12, jetzt);
  if (alle[0]) monate = monate.filter((m) => m >= alle[0]);
  return monate.map((m) => ({ monat: m, wert: bs.filter((b) => b.datum.startsWith(m)).reduce((s, b) => s + b.betrag, 0) }));
}

export function dauerFaellig(dauer, kosten, jetzt = new Date()) {
  const m = monatKey(jetzt);
  const ids = new Set((kosten?.buchungen || []).map((b) => b.id));
  return (dauer?.posten || [])
    .filter((p) => p.aktiv !== false && Number(p.betrag) > 0)
    .map((p) => ({ id: `dauer-${p.id}-${m}`, datum: `${m}-01T00:00:00`, kategorie: p.kategorie || '', betrag: Number(p.betrag), text: p.name, quelle: 'dauer' }))
    .filter((b) => !ids.has(b.id));
}

export function status(wert, budget) {
  if (!budget) return 'neutral';
  const q = wert / budget;
  return q > 1 ? 'bad' : q >= 0.8 ? 'warn' : 'ok';
}
