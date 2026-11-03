import { isoDate, parseDate, addDays, isoDow, montag, kwKey, kwLabel, fmtDM, fmtWtDM } from './util.js';

export const MODUL_FARBEN = { HM: '#0A84FF', TM: '#FF9F0A', WK: '#30B556', NPP: '#12A6C9', IT: '#AF52DE', CAX: '#FF375F' };
export const LEBEN_FARBE = '#5E5CE6';
export const modulFarbe = (m) => MODUL_FARBEN[m] || '#8E8E93';
export const farbeVon = (a) => (a.liste === 'leben' ? LEBEN_FARBE : modulFarbe(a.modul));

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
      add({ id: `${r.id}-${vs}`, regel: r.id, modul: r.modul, typ: r.typ, titel: `${r.modul} ${r.typ} · VO ${fmtDM(vs)}`, datum: vs, ab: isoDate(ab) });
    }
  }
  return neu;
}

const sk = (a) => a.ab || a.datum || a.erstellt || '';
export function istHeute(a, jetzt = new Date()) {
  const h = isoDate(jetzt);
  return a.ab === h || a.datum === h || (a.erstellt || '').startsWith(h);
}
export function offene(aufgaben, liste, jetzt = new Date()) {
  return aufgaben
    .filter((a) => a.liste === liste && a.status === 'offen')
    .sort((x, y) => (istHeute(y, jetzt) - istHeute(x, jetzt)) || sk(x).localeCompare(sk(y)) || x.titel.localeCompare(y.titel));
}
export function erledigte(aufgaben, liste) {
  return aufgaben.filter((a) => a.liste === liste && a.status === 'erledigt')
    .sort((x, y) => (y.erledigt || '').localeCompare(x.erledigt || ''));
}
export function metaText(a) {
  if (a.kw) return kwLabel(a.kw);
  if (a.typ === 'Videos') return '';
  if (a.liste === 'studium' && a.datum) return fmtWtDM(a.datum);
  return '';
}
export function titelHtml(a, esc) {
  if (a.liste === 'leben' || !a.modul || !a.titel.startsWith(a.modul)) return esc(a.titel);
  return `<b>${esc(a.modul)}</b>${esc(a.titel.slice(a.modul.length))}`;
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
