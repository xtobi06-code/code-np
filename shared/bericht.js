// Monatsbericht als PDF: eine A4-Seite mit dem gewählten Monat (Balken gegen das Budget),
// den beiden Vormonaten (Kreisdiagramme) und dem Langzeitverlauf.
import { uebersicht, verlauf, monatName, monatKey, status } from './finance.js';
import { MON, pad } from './util.js';

const rgb = (hex) => {
  const h = String(hex || '#8e8e93').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const Z2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const Z0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const eur = (n) => `${Z2.format(Math.round(n * 100) / 100)} €`;
const eur0 = (n) => `${Z0.format(Math.round(n))} €`;
const datum = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

const TEXT = '#14161a'; const GRAU = '#6b7280'; const HELL = '#9aa1ad'; const SPUR = '#eceef2'; const LINIE = '#dfe2e7';
const ROT = '#e5484d'; const GRUEN = '#1f9d55'; const ORANGE = '#e08600'; const BLAU = '#0a7aff';

// Welche Monate sich für einen Bericht anbieten: alle mit Buchungen plus der laufende, neuester zuerst.
export function berichtMonate(kosten, jetzt = new Date()) {
  const set = new Set((kosten?.buchungen || []).filter((b) => !b.storniert).map((b) => b.datum.slice(0, 7)));
  set.add(monatKey(jetzt));
  return [...set].filter((k) => k <= monatKey(jetzt)).sort().reverse().slice(0, 12);
}
// In den ersten fünf Tagen ist der abgeschlossene Vormonat vorgewählt (falls es dort Daten gibt), sonst der laufende.
export function berichtVorwahl(kosten, jetzt = new Date()) {
  const monate = berichtMonate(kosten, jetzt);
  const vor = monatKey(new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 1));
  return jetzt.getDate() <= 5 && monate.includes(vor) ? vor : monatKey(jetzt);
}
export const berichtName = (monat) => `Monatsbericht-${monat}.pdf`;

export function zeichneBericht(JsPDF, { kosten, kats, einst, dauer }, monat, jetzt = new Date()) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const L = 18; const R = 192; const B = R - L;
  const [jahr, mon] = monat.split('-').map(Number);
  const laufend = monat === monatKey(jetzt);
  // Abgeschlossene Monate werden zum Monatsende gerechnet, der laufende zum heutigen Tag
  const stand = (k) => (k === monatKey(jetzt) ? jetzt : new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0, 12));
  const u = uebersicht(kosten, kats, einst, 'monat', stand(monat));
  const vormonate = [1, 2].map((i) => {
    const k = monatKey(new Date(jahr, mon - 1 - i, 1));
    return { k, u: uebersicht(kosten, kats, einst, 'monat', stand(k)) };
  });
  const lang = verlauf(kosten, null, stand(monat));

  const farbe = (c, art = 'text') => { const [r, g, b] = rgb(c); if (art === 'text') doc.setTextColor(r, g, b); else if (art === 'fill') doc.setFillColor(r, g, b); else doc.setDrawColor(r, g, b); };
  const text = (s, x, y, { size = 10, fett = false, c = TEXT, align = 'left', sperr = 0 } = {}) => {
    doc.setFont('helvetica', fett ? 'bold' : 'normal');
    doc.setFontSize(size);
    farbe(c);
    doc.text(String(s), x, y, { align, charSpace: sperr });
  };
  const breite = (s, size, fett = false) => { doc.setFont('helvetica', fett ? 'bold' : 'normal'); doc.setFontSize(size); return doc.getTextWidth(String(s)); };
  const balken = (x, y, w, h, c) => { if (w <= 0) return; farbe(c, 'fill'); doc.roundedRect(x, y, Math.max(w, h), h, h / 2, h / 2, 'F'); };
  const titel = (s, y) => text(s.toUpperCase(), L, y, { size: 8, fett: true, c: GRAU, sperr: 0.35 });
  const strich = (y) => { farbe(LINIE, 'draw'); doc.setLineWidth(0.25); doc.line(L, y, R, y); };

  /* ---------- Kopf ---------- */
  text('Monatsbericht', L, 23, { size: 22, fett: true });
  text(`${monatName(monat)} ${jahr}`, R, 23, { size: 14, fett: true, align: 'right' });
  text(`Stand ${datum(jetzt)}`, L, 29.5, { size: 9.5, c: GRAU });
  strich(34);

  /* ---------- Gewählter Monat ---------- */
  titel(`Ausgaben im ${monatName(monat)}`, 43);
  const summeText = eur(u.summe);
  text(summeText, L, 56, { size: 26, fett: true });
  text(`von ${eur0(u.budget)} Budget`, L + breite(summeText, 26, true) + 3, 56, { size: 11, c: GRAU });
  const ueber = u.rest < 0;
  text(ueber ? 'über Budget' : 'übrig', R, 48.5, { size: 8.5, c: GRAU, align: 'right' });
  text(eur(Math.abs(u.rest)), R, 56, { size: 16, fett: true, c: ueber ? ROT : GRUEN, align: 'right' });
  const st = status(u.summe, u.budget);
  balken(L, 60.5, B, 3.2, SPUR);
  balken(L, 60.5, B * Math.min(1, u.budget ? u.summe / u.budget : 0), 3.2, st === 'bad' ? ROT : st === 'warn' ? ORANGE : GRUEN);

  const zeilen = u.kats;
  const zh = Math.min(9, (138 - 70) / Math.max(1, zeilen.length));
  const bx = L + 46; const bw = 78;
  const maxOhne = Math.max(1, ...zeilen.filter((k) => !k.budget).map((k) => k.wert));
  zeilen.forEach((k, i) => {
    const y = 72 + i * zh;
    farbe(k.farbe, 'fill'); doc.circle(L + 1.6, y - 1.3, 1.5, 'F');
    text(k.name.length > 20 ? `${k.name.slice(0, 19)}…` : k.name, L + 6, y, { size: 10 });
    const drueber = k.budget && k.wert > k.budget;
    balken(bx, y - 2.9, bw, 3, SPUR);
    balken(bx, y - 2.9, bw * Math.min(1, k.budget ? k.wert / k.budget : k.wert / maxOhne), 3, drueber ? ROT : k.farbe);
    const rechts = k.budget ? ` / ${eur0(k.budget)}` : '';
    if (rechts) text(rechts, R, y, { size: 9, c: HELL, align: 'right' });
    text(eur(k.wert), R - (rechts ? breite(rechts, 9) : 0), y, { size: 10, fett: true, c: drueber ? ROT : TEXT, align: 'right' });
  });
  const yFix = 72 + zeilen.length * zh + 1.5;
  if (u.fix > 0) {
    const namen = (dauer?.posten || []).filter((p) => p.aktiv !== false && Number(p.betrag) > 0).map((p) => p.name).join(', ');
    text(`Fixkosten${namen ? ` (${namen})` : ''}: ${eur0(u.fix)} pro Monat, vom Monatsbudget ${eur0(u.budget + u.fix)} bereits abgezogen`, L, yFix, { size: 8.5, c: GRAU });
  }

  /* ---------- Vormonate ---------- */
  strich(145);
  titel('Vergleich mit den Vormonaten', 154);
  const ring = (cx, cy, v) => {
    const Ra = 18.5; const Ri = 11.5;
    const teile = v.u.kats.filter((k) => k.wert > 0);
    const ges = teile.reduce((s, k) => s + k.wert, 0);
    const keil = (a0, a1, c) => {
      const pts = [];
      const n = Math.max(2, Math.ceil((a1 - a0) / 0.05));
      for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + Ra * Math.cos(a), cy + Ra * Math.sin(a)]); }
      for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + Ri * Math.cos(a), cy + Ri * Math.sin(a)]); }
      const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
      farbe(c, 'fill'); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
      doc.lines(rel, pts[0][0], pts[0][1], [1, 1], ges && teile.length > 1 ? 'FD' : 'F', true);
    };
    if (!ges) keil(0, Math.PI * 2, SPUR);
    else { let a = -Math.PI / 2; for (const k of teile) { const b = a + (k.wert / ges) * Math.PI * 2; keil(a, b, k.farbe); a = b; } }
    text(ges ? eur0(ges) : '–', cx, cy + 1.4, { size: 9.5, fett: true, c: ges ? TEXT : HELL, align: 'center' });
    text(`${monatName(v.k)} ${v.k.slice(0, 4)}`, cx, cy + Ra + 7, { size: 10, fett: true, align: 'center' });
    text(ges ? (v.u.budget ? `${Math.round((ges / v.u.budget) * 100)} % vom Budget` : 'gesamt') : 'noch keine Daten', cx, cy + Ra + 11.8, { size: 8.5, c: GRAU, align: 'center' });
    return ges;
  };
  const gesamt = vormonate.map((v, i) => ring(L + 22 + i * 52, 180, v));
  // Tabelle rechts: Kategorien mit den Beträgen beider Monate
  const tx = L + 104; const s1 = R - 26; const s2 = R;
  const kurz = (k) => `${MON[Number(k.slice(5, 7)) - 1]}.`.replace('Mai.', 'Mai');
  text(kurz(vormonate[0].k), s1, 163, { size: 8.5, fett: true, c: GRAU, align: 'right' });
  text(kurz(vormonate[1].k), s2, 163, { size: 8.5, fett: true, c: GRAU, align: 'right' });
  const th = Math.min(6.2, 40 / Math.max(1, kats.length));
  kats.forEach((k, i) => {
    const y = 169.5 + i * th;
    farbe(k.farbe, 'fill'); doc.circle(tx + 1.3, y - 1.1, 1.2, 'F');
    text(k.name.length > 16 ? `${k.name.slice(0, 15)}…` : k.name, tx + 5, y, { size: 9 });
    vormonate.forEach((v, j) => {
      const w = v.u.kats.find((x) => x.name === k.name)?.wert || 0;
      text(gesamt[j] ? eur0(w) : '–', j ? s2 : s1, y, { size: 9, c: w ? TEXT : HELL, align: 'right' });
    });
  });
  const ys = 169.5 + kats.length * th + 1.5;
  farbe(LINIE, 'draw'); doc.setLineWidth(0.25); doc.line(tx, ys - 4.2, R, ys - 4.2);
  text('Gesamt', tx + 5, ys, { size: 9, fett: true });
  gesamt.forEach((g, j) => text(g ? eur0(g) : '–', j ? s2 : s1, ys, { size: 9, fett: true, c: g ? TEXT : HELL, align: 'right' }));

  /* ---------- Langzeit ---------- */
  strich(219);
  titel(`Verlauf${lang.length > 1 ? ` der letzten ${lang.length} Monate` : ''}`, 228);
  const cx0 = L + 11; const cx1 = R - 2; const cy0 = 238; const cy1 = 274;
  const werte = lang.map((d) => d.wert);
  const max = Math.max(...werte, 10) * 1.18;
  const stufe = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find((s) => max / s <= 4) || 10000;
  const py = (v) => cy1 - ((cy1 - cy0) * v) / max;
  const px = (i) => (lang.length === 1 ? (cx0 + cx1) / 2 : cx0 + 6 + ((cx1 - cx0 - 12) * i) / (lang.length - 1));
  doc.setLineWidth(0.2);
  for (let v = 0; v <= max; v += stufe) {
    farbe(v === 0 ? LINIE : SPUR, 'draw'); doc.line(cx0, py(v), cx1, py(v));
    text(Z0.format(v), cx0 - 2, py(v) + 1, { size: 7.5, c: HELL, align: 'right' });
  }
  if (lang.length === 1) {
    farbe(BLAU, 'fill'); doc.roundedRect(px(0) - 7, py(werte[0]), 14, Math.max(0.6, cy1 - py(werte[0])), 1.2, 1.2, 'F');
  } else {
    farbe(BLAU, 'draw'); doc.setLineWidth(0.9); doc.setLineJoin('round'); doc.setLineCap('round');
    const rel = werte.slice(1).map((w, i) => [px(i + 1) - px(i), py(w) - py(werte[i])]);
    doc.lines(rel, px(0), py(werte[0]), [1, 1], 'S', false);
  }
  lang.forEach((d, i) => {
    const offen = d.monat === monatKey(jetzt); // laufender Monat: noch nicht vollständig
    if (lang.length > 1) {
      farbe(offen ? '#ffffff' : BLAU, 'fill'); farbe(BLAU, 'draw'); doc.setLineWidth(0.7);
      doc.circle(px(i), py(d.wert), 1.25, 'FD');
    }
    text(eur0(d.wert), px(i), py(d.wert) - 2.6, { size: 7.5, fett: true, align: 'center' });
    text(`${MON[Number(d.monat.slice(5)) - 1]}${Number(d.monat.slice(5)) === 1 || i === 0 ? ` ${d.monat.slice(2, 4)}` : ''}`, px(i), cy1 + 4.5, { size: 7.5, c: GRAU, align: 'center' });
  });
  const volle = lang.filter((d) => d.monat !== monatKey(jetzt));
  const basis = volle.length ? volle : lang;
  const schnitt = basis.reduce((s, d) => s + d.wert, 0) / Math.max(1, basis.length);
  if (lang.length > 1) {
    const zahl = eur0(schnitt);
    text(zahl, R, 230.5, { size: 15, fett: true, align: 'right' });
    text(`Ø pro ${volle.length && volle.length < lang.length ? 'abgeschlossenem ' : ''}Monat`, R - breite(zahl, 15, true) - 2.5, 230.5, { size: 8.5, c: GRAU, align: 'right' });
  } else {
    text('Die Kurve entsteht, sobald ein zweiter Monat dazukommt.', R, 230.5, { size: 8.5, c: GRAU, align: 'right' });
  }
  return doc;
}

// Lädt die PDF-Bibliothek erst bei Bedarf (liegt im eigenen Repo, kein fremder Server).
let lib = null;
function ladeBibliothek() {
  if (lib) return lib;
  lib = new Promise((ok, fehler) => {
    if (window.jspdf?.jsPDF) return ok(window.jspdf.jsPDF);
    const s = document.createElement('script');
    s.src = new URL('./vendor/jspdf.umd.min.js', import.meta.url).href;
    s.onload = () => (window.jspdf?.jsPDF ? ok(window.jspdf.jsPDF) : fehler(new Error('PDF-Bibliothek nicht geladen')));
    s.onerror = () => { lib = null; fehler(new Error('PDF-Bibliothek nicht erreichbar')); };
    document.head.appendChild(s);
  });
  return lib;
}
export async function berichtDatei(daten, monat, jetzt = new Date()) {
  const JsPDF = await ladeBibliothek();
  const blob = zeichneBericht(JsPDF, daten, monat, jetzt).output('blob');
  return new File([blob], berichtName(monat), { type: 'application/pdf' });
}
