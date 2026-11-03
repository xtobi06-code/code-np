import { F, ladeAlle, aendere, routine, beiFehler, FehlerToken } from './shared/core.js';
import { offene, erledigte, metaText, titelHtml, farbeVon, istHeute } from './shared/tasks.js';
import { uebersicht, verlauf, status, katSymbol, monatName, monatKey } from './shared/finance.js';
import { holeWetter, wetterHtml, starteZyklus, toast } from './shared/app.js';
import { icon } from './shared/icons.js';
import { headerText, esc, euro, euro0, uid, isoZeit, fmtDM, parseBetrag, MON } from './shared/util.js';

const $ = (id) => document.getElementById(id);
const DATEIEN = ['einstellungen.json', 'regeln.json', 'aufgaben.json', 'einkauf.json', 'kosten.json', 'kategorien.json', 'dauerkosten.json'];
const TITEL = { finanzen: 'Finanzen', einkauf: 'Einkauf', todos: 'To-dos' };

const merk = (() => { try { return JSON.parse(localStorage.getItem('np-ansicht') || '{}'); } catch { return {}; } })();
const S = { tab: 'todos', finAnsicht: 'uebersicht', zeitraum: 'monat', todoListe: 'studium', verlaufKat: '', offenKat: null, zeigeErledigt: false, ...merk, offenKat: null, zeigeErledigt: false };
function merken() {
  try { localStorage.setItem('np-ansicht', JSON.stringify({ tab: S.tab, finAnsicht: S.finAnsicht, zeitraum: S.zeitraum, todoListe: S.todoListe, verlaufKat: S.verlaufKat })); } catch { /* egal */ }
}

beiFehler((e) => toast(e instanceof FehlerToken ? 'Token ungültig, bitte in den Einstellungen erneuern' : 'Speichern fehlgeschlagen, bitte Verbindung prüfen'));

$('zahnrad').innerHTML = icon('regler', 18);
$('fab').innerHTML = icon('plus', 20, 2.6);
$('tb-finanzen').innerHTML = icon('geldbeutel', 25, 1.8) + 'Finanzen';
$('tb-einkauf').innerHTML = icon('wagen', 25, 1.8) + 'Einkauf';
$('tb-todos').innerHTML = icon('liste', 25, 1.8) + 'To-dos';
$('plus-einkauf').innerHTML = icon('plus', 14, 2.5);
$('plus-leben').innerHTML = icon('plus', 14, 2.5);

/* ---------- Navigation ---------- */
function zeigeTab() {
  for (const t of Object.keys(TITEL)) {
    $(`tab-${t}`).hidden = t !== S.tab;
    $(`tb-${t}`).classList.toggle('an', t === S.tab);
  }
  $('titel').textContent = TITEL[S.tab];
  $('fab').hidden = S.tab !== 'finanzen';
  document.querySelectorAll('.segment').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('an', S[seg.dataset.seg] === b.dataset.v));
  });
  $('fin-uebersicht').hidden = S.finAnsicht !== 'uebersicht';
  $('fin-verlauf').hidden = S.finAnsicht !== 'verlauf';
  $('leben-eingabe').hidden = S.todoListe !== 'leben';
  render();
}
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  S.tab = b.dataset.tab;
  merken();
  zeigeTab();
  scrollTo(0, 0);
});
document.querySelectorAll('.segment').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  S[seg.dataset.seg] = b.dataset.v;
  S.offenKat = null;
  merken();
  zeigeTab();
}));

function render() {
  if (S.tab === 'finanzen') (S.finAnsicht === 'verlauf' ? renderVerlauf : renderFinanzen)();
  if (S.tab === 'einkauf') renderEinkauf();
  if (S.tab === 'todos') renderTodos();
}

/* ---------- To-dos ---------- */
function taskHtml(a, erl = false) {
  const meta = erl ? (a.erledigt ? fmtDM(a.erledigt) : '') : metaText(a);
  const heute = !erl && istHeute(a) && a.liste === 'studium';
  return `<div class="zeile task${erl ? ' erl' : ''}" style="--c:${farbeVon(a)}" data-id="${esc(a.id)}">
    <button class="kreis${erl ? ' an' : ''}" data-aktion="${erl ? 'wieder' : 'erledigt'}" aria-label="${erl ? 'Wiederherstellen' : 'Erledigt'}">${icon('check', 14, 3)}</button>
    <span class="haupt titel">${titelHtml(a, esc)}</span>${meta ? `<span class="neben${heute ? ' heute' : ''}">${heute ? 'Heute' : esc(meta)}</span>` : ''}</div>`;
}
function renderTodos() {
  const alle = F['aufgaben.json']?.aufgaben || [];
  const liste = S.todoListe;
  const auf = offene(alle, liste);
  let html = '';
  if (!auf.length) {
    html = `<div class="gruppe"><div class="leer">${icon('check', 30, 2.5)}Alles erledigt</div></div>`;
  } else if (liste === 'studium') {
    const h = auf.filter((a) => istHeute(a));
    const r = auf.filter((a) => !istHeute(a));
    if (h.length) html += `<div class="gruppe-titel"><span>Heute</span><span>${h.length}</span></div><div class="gruppe">${h.map((a) => taskHtml(a)).join('')}</div>`;
    if (r.length) html += `<div class="gruppe-titel"><span>Offen</span><span>${r.length}</span></div><div class="gruppe">${r.map((a) => taskHtml(a)).join('')}</div>`;
  } else {
    html = `<div class="gruppe">${auf.map((a) => taskHtml(a)).join('')}</div>`;
  }
  $('todo-liste').innerHTML = html;
  const erl = erledigte(alle, liste);
  $('erledigt-umschalten').textContent = S.zeigeErledigt ? 'Erledigte ausblenden' : `Erledigte anzeigen (${erl.length})`;
  $('erledigt-liste').innerHTML = S.zeigeErledigt && erl.length
    ? `<div class="gruppe">${erl.slice(0, 60).map((a) => taskHtml(a, true)).join('')}</div>` : '';
}
$('erledigt-umschalten').onclick = () => { S.zeigeErledigt = !S.zeigeErledigt; renderTodos(); };
function setzeStatus(id, offen) {
  const zeit = new Date().toISOString();
  return aendere('aufgaben.json', (d) => {
    const a = d.aufgaben.find((x) => x.id === id);
    if (a) { a.status = offen ? 'offen' : 'erledigt'; a.erledigt = offen ? null : zeit; }
    return d;
  }, offen ? 'Wiederhergestellt' : 'Abgehakt').catch(() => {});
}
$('tab-todos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aktion]');
  if (!b) return;
  const id = b.closest('[data-id]').dataset.id;
  if (b.dataset.aktion === 'erledigt') {
    b.classList.add('an');
    setTimeout(() => {
      setzeStatus(id, false);
      renderTodos();
      toast('Erledigt', { label: 'Rückgängig', fn: () => { setzeStatus(id, true); renderTodos(); } });
    }, 300);
  } else {
    setzeStatus(id, true);
    renderTodos();
  }
});
$('leben-input').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const titel = e.target.value.trim();
  if (!titel) return;
  e.target.value = '';
  const neu = { id: uid('l'), liste: 'leben', titel, status: 'offen', erstellt: isoZeit(new Date()), erledigt: null };
  aendere('aufgaben.json', (d) => { if (!d.aufgaben.some((a) => a.id === neu.id)) d.aufgaben.push(neu); return d; }, 'Neue Aufgabe').catch(() => {});
  renderTodos();
});

/* ---------- Einkauf ---------- */
function renderEinkauf() {
  const art = (F['einkauf.json']?.artikel || []).filter((a) => a.status !== 'archiv');
  const offen = art.filter((a) => a.status === 'offen').sort((a, b) => (a.zeit || '').localeCompare(b.zeit || ''));
  const erl = art.filter((a) => a.status === 'erledigt').sort((a, b) => (b.erledigt || '').localeCompare(a.erledigt || ''));
  $('einkauf-liste').innerHTML = [...offen, ...erl].map((a) => {
    const e = a.status === 'erledigt';
    return `<div class="zeile artikel${e ? ' erl' : ''}" data-id="${esc(a.id)}" style="--c:var(--accent)">
      <button class="kreis${e ? ' an' : ''}" aria-label="Abhaken">${icon('check', 14, 3)}</button><span class="haupt">${esc(a.text)}</span></div>`;
  }).join('');
  $('einkauf-aufraeumen').hidden = !erl.length;
}
function einkaufAendern(fn, msg) {
  aendere('einkauf.json', fn, msg).catch(() => {});
  renderEinkauf();
}
$('einkauf-input').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const teile = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
  if (!teile.length) return;
  e.target.value = '';
  const neu = teile.map((text) => ({ id: uid('e'), text, status: 'offen', zeit: isoZeit(new Date()), erledigt: null }));
  einkaufAendern((d) => { const ids = new Set(d.artikel.map((a) => a.id)); d.artikel.push(...neu.filter((a) => !ids.has(a.id))); return d; }, 'Einkauf hinzugefügt');
});
$('einkauf-liste').addEventListener('click', (e) => {
  const zeile = e.target.closest('[data-id]');
  if (!zeile) return;
  const id = zeile.dataset.id;
  const zeit = isoZeit(new Date());
  einkaufAendern((d) => {
    const a = d.artikel.find((x) => x.id === id);
    if (a) { a.status = a.status === 'erledigt' ? 'offen' : 'erledigt'; a.erledigt = a.status === 'erledigt' ? zeit : null; }
    return d;
  }, 'Einkauf abgehakt');
});
$('einkauf-aufraeumen').onclick = () => {
  const ids = (F['einkauf.json']?.artikel || []).filter((a) => a.status === 'erledigt').map((a) => a.id);
  einkaufAendern((d) => { d.artikel.forEach((a) => { if (ids.includes(a.id)) a.status = 'archiv'; }); return d; }, 'Erledigte entfernt');
  toast(`${ids.length} entfernt`, { label: 'Rückgängig', fn: () => einkaufAendern((d) => { d.artikel.forEach((a) => { if (ids.includes(a.id)) a.status = 'erledigt'; }); return d; }, 'Wiederhergestellt') });
};

/* ---------- Finanzen ---------- */
const kats = () => F['kategorien.json']?.kategorien || [];
function renderFinanzen() {
  const k = kats();
  if (!k.length) { $('fin-held').innerHTML = '<div class="unter">Keine Kategorien angelegt.</div>'; $('fin-kat').innerHTML = ''; return; }
  const u = uebersicht(F['kosten.json'], k, F['einstellungen.json'], S.zeitraum);
  const basis = Math.max(u.budget, u.wert) || 1;
  const stapel = u.kats.filter((x) => x.wert > 0).map((x) => `<span style="width:${(x.wert / basis) * 100}%;background:${x.farbe}"></span>`).join('');
  if (u.N === 1) {
    const ueber = u.rest < 0;
    $('fin-held').innerHTML = `<div class="klein">${ueber ? 'Über Budget' : `Übrig im ${monatName(monatKey(new Date()))}`}</div>
      <div class="gross" style="${ueber ? 'color:var(--bad)' : ''}">${euro(Math.abs(u.rest))}</div>
      <div class="unter">${ueber ? '' : `<b>${euro(u.restTag)}</b> pro Tag · `}${euro(u.summe)} von ${euro0(u.budget)}</div>
      <div class="stapel">${stapel}</div>`;
    $('fin-hinweis').textContent = 'Ausgaben / Budget';
  } else {
    $('fin-held').innerHTML = `<div class="klein">Ø pro Monat</div>
      <div class="gross" style="${u.wert > u.budget ? 'color:var(--bad)' : ''}">${euro(u.wert)}</div>
      <div class="unter"><b>${euro(u.summe)}</b> gesamt über ${u.n} ${u.n === 1 ? 'Monat' : 'Monate'} · Budget ${euro0(u.budget)}</div>
      <div class="stapel">${stapel}</div>`;
    $('fin-hinweis').textContent = 'Ø pro Monat / Budget';
  }
  $('fin-kat').innerHTML = u.kats.map((x) => {
    const st = status(x.wert, Number(x.budget));
    const breite = x.budget ? Math.min(100, (x.wert / x.budget) * 100) : (x.wert ? 100 : 0);
    const offen = S.offenKat === x.name;
    const eintraege = offen ? `<div class="eintraege">${x.eintraege.length ? x.eintraege.map((b) => `
      <div class="eintrag" data-buchung="${esc(b.id)}"><span class="neben">${fmtDM(b.datum)}</span><span class="haupt">${esc(b.text || x.name)}</span><span class="neben">${euro(b.betrag)}</span>
      <button data-storno="${esc(b.id)}" aria-label="Löschen">${icon('x', 16)}</button></div>`).join('') : '<div class="eintrag"><span class="haupt neben">Keine Einträge</span></div>'}</div>` : '';
    return `<div class="zeile kat" data-kat="${esc(x.name)}"><span class="symbol" style="background:${x.farbe}">${icon(katSymbol(x.name), 17, 2.2)}</span>
      <div class="haupt"><div class="oben"><span>${esc(x.name)}</span><span class="betrag">${euro(x.wert)}${x.budget ? ` <small>/ ${euro0(x.budget)}</small>` : ''}</span></div>
      <div class="balken"><span class="${st}" style="width:${breite}%"></span></div></div></div>${eintraege}`;
  }).join('');
}
$('fin-kat').addEventListener('click', (e) => {
  const st = e.target.closest('[data-storno]');
  if (st) {
    const id = st.dataset.storno;
    const setze = (v) => { aendere('kosten.json', (d) => { const b = d.buchungen.find((x) => x.id === id); if (b) b.storniert = v; return d; }, v ? 'Buchung gelöscht' : 'Buchung wiederhergestellt').catch(() => {}); renderFinanzen(); };
    setze(true);
    toast('Buchung gelöscht', { label: 'Rückgängig', fn: () => setze(false) });
    return;
  }
  const z = e.target.closest('[data-kat]');
  if (!z) return;
  S.offenKat = S.offenKat === z.dataset.kat ? null : z.dataset.kat;
  renderFinanzen();
});

function renderVerlauf() {
  const k = kats();
  $('verlauf-chips').innerHTML = [{ name: '', farbe: '#007aff' }, ...k].map((x) =>
    `<button class="chip${S.verlaufKat === x.name ? ' an' : ''}" style="--c:${x.farbe}" data-vk="${esc(x.name)}">${esc(x.name || 'Gesamt')}</button>`).join('');
  const daten = verlauf(F['kosten.json'], S.verlaufKat || null);
  const kat = k.find((x) => x.name === S.verlaufKat);
  const budget = kat ? Number(kat.budget) || 0 : (Number(F['einstellungen.json']?.monatsbudget) || k.reduce((s, x) => s + (Number(x.budget) || 0), 0));
  const farbe = kat ? kat.farbe : getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#007aff';
  const W = 340; const H = 190; const L = 40; const R = 10; const T = 12; const B = 24;
  const max = Math.max(budget, ...daten.map((d) => d.wert), 10) * 1.12;
  const n = daten.length;
  const x = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const stufe = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => max / s <= 5) || 1000;
  let g = '';
  for (let v = 0; v <= max; v += stufe) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".12"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  const pfad = daten.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.wert).toFixed(1)}`).join(' ');
  const flaeche = n > 1 ? `${pfad} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';
  const labels = daten.map((d, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${MON[Number(d.monat.slice(5)) - 1].slice(0, 3)}</text>`).join('');
  const punkte = daten.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.wert)}" r="3.5" fill="${farbe}"/>`).join('');
  const bl = budget ? `<line x1="${L}" x2="${W - R}" y1="${y(budget)}" y2="${y(budget)}" stroke="${farbe}" stroke-dasharray="4 4" stroke-opacity=".7"/>` : '';
  $('verlauf-svg').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="color:var(--text)">${g}${bl}
    ${flaeche ? `<path d="${flaeche}" fill="${farbe}" fill-opacity=".12"/>` : ''}<path d="${pfad}" fill="none" stroke="${farbe}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${punkte}${labels}</svg>`;
  const werte = daten.map((d) => d.wert);
  const abgeschlossen = werte.slice(0, -1);
  const schnitt = abgeschlossen.length ? abgeschlossen.reduce((a, b) => a + b, 0) / abgeschlossen.length : werte[werte.length - 1] || 0;
  $('verlauf-zahlen').innerHTML = `<div class="kennzahl"><div class="k">Dieser Monat</div><div class="v">${euro(werte[werte.length - 1] || 0)}</div></div>
    <div class="kennzahl"><div class="k">${abgeschlossen.length ? `Ø ${abgeschlossen.length} volle Mon.` : 'Ø pro Monat'}</div><div class="v">${euro(schnitt)}</div></div>`;
}
$('verlauf-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vk]');
  if (!b) return;
  S.verlaufKat = b.dataset.vk;
  merken();
  renderVerlauf();
});

/* ---------- Neue Ausgabe ---------- */
let wahl = null;
function blatt(an) {
  $('blatt').classList.toggle('an', an);
  $('schleier').classList.toggle('an', an);
  if (an) {
    wahl = null;
    $('betrag').value = '';
    $('notiz').value = '';
    $('blatt-fehler').textContent = '';
    $('katwahl').innerHTML = kats().map((k) => `<button style="--c:${k.farbe}" data-k="${esc(k.name)}"><span class="symbol" style="background:${k.farbe}">${icon(katSymbol(k.name), 17, 2.2)}</span>${esc(k.name)}</button>`).join('');
  } else {
    document.activeElement?.blur();
  }
}
$('fab').onclick = () => blatt(true);
$('schleier').onclick = () => blatt(false);
$('blatt-abbrechen').onclick = () => blatt(false);
$('katwahl').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  wahl = b.dataset.k;
  $('katwahl').querySelectorAll('button').forEach((x) => x.classList.toggle('an', x === b));
  $('notiz').placeholder = wahl === 'Sonstiges' ? 'Wofür? (nötig)' : 'Notiz (optional)';
  $('blatt-fehler').textContent = '';
  $('betrag').focus();
});
[$('betrag'), $('notiz')].forEach((el) => el.addEventListener('input', () => { $('blatt-fehler').textContent = ''; }));
$('blatt-sichern').onclick = () => {
  const betrag = parseBetrag($('betrag').value);
  const text = $('notiz').value.trim();
  if (!wahl) { $('blatt-fehler').textContent = 'Wähle eine Kategorie.'; return; }
  if (!(betrag > 0)) { $('blatt-fehler').textContent = 'Gib einen Betrag ein.'; return; }
  if (wahl === 'Sonstiges' && !text) { $('blatt-fehler').textContent = 'Bei Sonstiges bitte angeben, wofür.'; return; }
  const b = { id: uid('b'), datum: isoZeit(new Date()), kategorie: wahl, betrag, text, quelle: 'app' };
  aendere('kosten.json', (d) => { if (!d.buchungen.some((x) => x.id === b.id)) d.buchungen.push(b); return d; }, `Ausgabe ${wahl}`).catch(() => {});
  blatt(false);
  render();
  toast(`${euro(betrag)} · ${wahl}`);
};

/* ---------- Laden ---------- */
async function laden(erst = false) {
  try {
    await ladeAlle(DATEIEN);
    $('banner').innerHTML = '';
    if (erst) await routine();
  } catch (e) {
    $('banner').innerHTML = e instanceof FehlerToken
      ? `<div class="banner">${icon('aus', 20)}<span>Noch nicht verbunden. <a href="einstellungen.html">Token eintragen</a></span></div>`
      : `<div class="banner">${icon('wolke', 20)}<span>Offline, zeige gespeicherten Stand.</span></div>`;
  }
  if (!document.activeElement || !['INPUT'].includes(document.activeElement.tagName)) render();
}
async function wetter() {
  try { $('wetter').innerHTML = wetterHtml(await holeWetter(F['einstellungen.json']), 16); } catch { $('wetter').innerHTML = ''; }
}
function datum() { $('datum').textContent = headerText(new Date()); }

datum();
setInterval(datum, 60000);
zeigeTab();
await laden(true);
wetter();
starteZyklus(() => laden(), 60);
starteZyklus(wetter, 900);
starteZyklus(() => routine().then(render), 1800);
