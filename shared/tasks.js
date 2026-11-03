import { isoDate, parseDate, addDays, isoDow, montag, kwKey, kwLabel, fmtDM, fmtWtDM, dunkler, esc } from './util.js';

// Farben wie im TUM-Stundenplan
export const MODULE_STANDARD = {
  HM: { name: 'Höhere Mathematik 1', farbe: '#3FCDFF' },
  TM: { name: 'Technische Mechanik 1', farbe: '#FF7C80' },
  WK: { name: 'Werkstoffkunde 1', farbe: '#92D050' },
  NPP: { name: 'Nachhaltige Produktionstechnik', farbe: '#FFCC66' },
  IT: { name: 'Informatik (IT1)', farbe: '#CC99FF' },
  CAX: { name: 'CAx 1', farbe: '#FFFF66' },
};
let MODULE = { ...MODULE_STANDARD };
export function setzeModule(m) { MODULE = { ...MODULE_STANDARD, ...(m || {}) }; }
export const module = () => MODULE;
export const LEBEN_FARBE = '#8E8CF8';
export const modulFarbe = (m) => MODULE[m]?.farbe || '#A0A4AE';
export const farbeVon = (a) => (a.liste === 'leben' && !a.modul ? LEBEN_FARBE : modulFarbe(a.modul));
export const farbStil = (c) => `--c:${c};--cd:${dunkler(c)}`;

export function inPause(d, e) {
  const s = isoDate(d);
  return (e.pausen || []).some((p) => s >= p.von && s <= p.bis);
}
function imSemester(d, e) {
  const s = isoDate(d);
  return s >= e.semester.von && s <= e.semester.bis;
}
function regelGilt(r, d, e) {
  const s = isoDate(d);
  if (r.aktiv === false) return false;
  if (r.von && s < r.von) return false;
  if (r.bis && s > r.bis) return false;
  if (r.rhythmus === '2wochen') {
    const basis = montag(parseDate(r.von || e.semester.von));
    const w = Math.round((montag(d) - basis) / (7 * 864e5));
    if (w % 2 !== 0) return false;
  }
  return true;
}
export function istTermin(r, d, e) {
  return r.art === 'tag' && regelGilt(r, d, e) && (r.tage || []).includes(isoDow(d)) && imSemester(d, e) && !inPause(d, e);
}

// Erzeugt fehlende Aufgaben aus den Regeln. Alles bis einschließlich Stichtag entsteht als erledigt.
export function erzeugen(e, regeln, vorhanden, jetzt = new Date()) {
  if (!e?.semester?.von || !e?.semester?.bis) return [];
  const ids = new Set(vorhanden.map((a) => a.id));
  const neu = [];
  const add = (a) => {
    if (ids.has(a.id)) return;
    ids.add(a.id);
    const fertig = e.stichtag && a.ab <= e.stichtag;
    neu.push({ ...a, liste: 'studium', status: fertig ? 'erledigt' : 'offen', erledigt: fertig ? `${a.ab}T12:00:00` : null });
  };
  const von = parseDate(e.semester.von);
  const bis = parseDate(e.semester.bis);
  const h = parseDate(isoDate(jetzt));
  const ende = h < bis ? h : bis;
  const kwGesehen = new Set();

  for (let d = von; d <= ende; d = addDays(d, 1)) {
    if (inPause(d, e)) continue;
    const s = isoDate(d);
    for (const r of regeln) {
      if (r.art === 'tag' && istTermin(r, d, e)) {
        add({ id: `${r.id}-${s}`, regel: r.id, modul: r.modul, typ: r.typ, titel: `${r.modul} ${r.typ}`, datum: s, ab: s });
      }
      if (r.art === 'kw' && regelGilt(r, d, e) && isoDow(d) >= ((r.tage && r.tage[0]) || 1)) {
        const k = kwKey(d);
        if (kwGesehen.has(r.id + k)) continue;
        kwGesehen.add(r.id + k);
        add({ id: `${r.id}-${k}`, regel: r.id, modul: r.modul, typ: r.typ, titel: `${r.modul} ${r.typ}`, kw: k, datum: s, ab: s });
      }
    }
  }
  for (const r of regeln.filter((x) => x.art === 'video' && x.aktiv !== false)) {
    const ziel = regeln.find((x) => x.id === r.fuer);
    if (!ziel) continue;
    for (let v = von; v <= bis; v = addDays(v, 1)) {
      if (!istTermin(ziel, v, e) || !regelGilt(r, v, e)) continue;
      const ab = addDays(montag(v), 7 * (r.ab?.wochen ?? -1) + ((r.ab?.tag ?? 4) - 1));
      if (ab > h) continue;
      const vs = isoDate(v);
      add({ id: `${r.id}-${vs}`, regel: r.id, modul: r.modul, typ: r.typ, titel: `${r.modul} ${r.typ}`, datum: vs, ab: isoDate(ab) });
    }
  }
  return neu;
}

const ohneTermin = (a) => !(a.faellig || a.datum || a.ab || kwVon(a));
const sk = (a) => a.faellig || a.datum || a.ab || (a.erstellt || '').slice(0, 10) || '';
// Kalenderwoche einer Aufgabe: bei Wochenaufgaben und Videos (nach Datum der Vorlesung).
export const kwVon = (a) => a.kw || (a.typ === 'Videos' && a.datum ? kwKey(parseDate(a.datum)) : null);
export function istHeute(a, jetzt = new Date()) {
  const h = isoDate(jetzt);
  if (a.faellig) return a.faellig === h;
  return a.ab === h || a.datum === h || (!a.regel && (a.erstellt || '').startsWith(h));
}
export function ueberfaellig(a, jetzt = new Date()) {
  if (a.faellig) return a.faellig < isoDate(jetzt);
  if (kwVon(a)) return kwVon(a) < kwKey(jetzt); // Wochenaufgaben sind bis Wochenende fällig
  return !!(a.regel && a.datum) && a.datum < isoDate(jetzt);
}
export function offene(aufgaben, liste, jetzt = new Date()) {
  return aufgaben
    .filter((a) => a.liste === liste && a.status === 'offen')
    .sort((x, y) => (ohneTermin(x) - ohneTermin(y)) || (ueberfaellig(y, jetzt) - ueberfaellig(x, jetzt)) || (istHeute(y, jetzt) - istHeute(x, jetzt)) || sk(x).localeCompare(sk(y)) || (x.modul || '').localeCompare(y.modul || '') || x.titel.localeCompare(y.titel));
}
export function erledigte(aufgaben, liste) {
  return aufgaben.filter((a) => a.liste === liste && a.status === 'erledigt')
    .sort((x, y) => (y.erledigt || '').localeCompare(x.erledigt || ''));
}
export function metaText(a, jetzt = new Date()) {
  if (a.faellig) {
    const h = isoDate(jetzt);
    if (a.faellig === h) return 'Heute';
    if (a.faellig === isoDate(addDays(jetzt, 1))) return 'Morgen';
    return (a.faellig < h ? 'Überfällig · ' : '') + fmtWtDM(a.faellig);
  }
  if (kwVon(a)) return kwLabel(kwVon(a));
  if (a.regel && a.datum) return fmtWtDM(a.datum);
  return '';
}
export const badgeHtml = (m) => `<span class="badge" style="${farbStil(modulFarbe(m))}">${esc(m)}</span>`;
export function titelHtml(a) {
  if (!a.modul) return `<span class="txt">${esc(a.titel)}</span>`;
  const rest = (a.titel.startsWith(a.modul) ? a.titel.slice(a.modul.length).trim() : a.titel).replace(/\s*·\s*VO\s.*$/, '');
  return `${badgeHtml(a.modul)}<span class="txt">${esc(rest)}</span>`;
}

// Termine eines Tages aus den Regeln (mit Uhrzeit) und dem Kalender.
export function termineAm(d, e, regeln, kalender) {
  const out = [];
  const s = isoDate(d);
  for (const r of regeln) {
    if (r.art !== 'tag' || !istTermin(r, d, e)) continue;
    const zeit = r.zeiten && r.zeiten[String(isoDow(d))];
    if (zeit) out.push({ zeit, titel: `${r.modul} ${r.typ}`, modul: r.modul });
  }
  for (const t of kalender || []) {
    if (!t.start || !t.start.startsWith(s)) continue;
    out.push({ zeit: t.ganztag ? '' : t.start.slice(11, 16), titel: t.titel, kalender: true });
  }
  return out.sort((a, b) => (a.zeit || '').localeCompare(b.zeit || ''));
}
