import { F, ladeAlle, aendere, aendereOp, nachholen, beiOffline, offenNachzureichen, routine, beiFehler, FehlerToken } from './shared/core.js';
import { kwVon, offene, erledigte, metaText, titelHtml, farbeVon, farbStil, istHeute, ueberfaellig, module, modulFarbe } from './shared/tasks.js';
import { uebersicht, verlauf, status, katSymbol, monatName, monatKey, aktive } from './shared/finance.js';
import { holeWetter, starteZyklus, toast } from './shared/app.js';
import { erstelleSzene } from './shared/scene.js';
import { panelEinst, szenenDatum } from './shared/core.js';
import { icon, wetterSymbol } from './shared/icons.js';
import { headerText, esc, euro, euro0, uid, isoZeit, isoDate, fmtDM, fmtWtDM, parseBetrag, MON, addDays, dunkler } from './shared/util.js';

const $ = (id) => document.getElementById(id);
const DATEIEN = ['einstellungen.json', 'regeln.json', 'aufgaben.json', 'einkauf.json', 'kosten.json', 'kategorien.json', 'dauerkosten.json'];
const TABS = ['todos', 'einkauf', 'finanzen'];
const TITEL = { finanzen: 'Finanzen', einkauf: 'Einkauf', todos: 'To-dos' };
const TAB_FARBE = { todos: '#0a84ff', einkauf: '#ff9f0a', finanzen: '#30d158' };
const TINT = { todos: 'rgba(0, 122, 255, .17)', einkauf: 'rgba(255, 149, 0, .17)', finanzen: 'rgba(52, 199, 89, .17)' };

const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } },
};
const S = { tab: 'todos', finAnsicht: 'uebersicht', zeitraum: 'monat', todoListe: 'studium', verlaufKat: '', ...LS.get('np-ansicht', {}), offenKat: null, zeigeErledigt: false, neuModul: '', neuFaellig: '' };
if (!TABS.includes(S.tab)) S.tab = 'todos';
let offeneZeile = null;
let wischZeit = 0;
const merken = () => LS.set('np-ansicht', { tab: S.tab, finAnsicht: S.finAnsicht, zeitraum: S.zeitraum, todoListe: S.todoListe, verlaufKat: S.verlaufKat });
const heute = () => isoDate(new Date());
const morgen = () => isoDate(addDays(new Date(), 1));

beiFehler((e) => toast(e instanceof FehlerToken ? 'Token ungültig, bitte in den Einstellungen erneuern' : 'Speichern fehlgeschlagen, Verbindung prüfen'));
beiOffline((n) => toast(`Offline gespeichert · ${n} ${n === 1 ? 'Änderung wird' : 'Änderungen werden'} nachgereicht`));

$('zahnrad').innerHTML = icon('regler', 19, 2);
$('neu').innerHTML = icon('plus', 21, 2.4);
$('tb-todos').innerHTML = `${icon('liste', 24, 1.9)}To-dos`;
$('tb-einkauf').innerHTML = `${icon('wagen', 24, 1.9)}Einkauf`;
$('tb-finanzen').innerHTML = `${icon('geldbeutel', 24, 1.9)}Finanzen`;
$('plus-todo').innerHTML = icon('plus', 13, 2.6);
$('todo-senden').innerHTML = icon('hoch', 18, 2.8);
$('plus-einkauf').innerHTML = icon('plus', 13, 2.6);
document.querySelectorAll('[data-zu]').forEach((b) => { b.innerHTML = icon('x', 18, 2.4); });
$('kosten-sichern').innerHTML = icon('check', 19, 2.8);
$('aufgabe-sichern').innerHTML = icon('check', 19, 2.8);

/* ---------- Navigation ---------- */
function segmenteSetzen() {
  document.querySelectorAll('.segment[data-seg]').forEach((seg) => {
    const btns = [...seg.querySelectorAll('button')];
    const i = btns.findIndex((b) => b.dataset.v === S[seg.dataset.seg]);
    btns.forEach((b, k) => b.classList.toggle('an', k === i));
    seg.style.setProperty('--i', Math.max(0, i));
  });
}
function zeigeTab() {
  for (const t of TABS) {
    $(`tab-${t}`).hidden = t !== S.tab;
    $(`tb-${t}`).classList.toggle('an', t === S.tab);
  }
  $('tabbar').style.setProperty('--i', TABS.indexOf(S.tab));
  $('titel').textContent = TITEL[S.tab];
  document.documentElement.style.setProperty('--tint-farbe', TINT[S.tab]);
  document.documentElement.style.setProperty('--tab-farbe', TAB_FARBE[S.tab]);
  $('neu').setAttribute('aria-label', S.tab === 'finanzen' ? 'Ausgabe hinzufügen' : S.tab === 'einkauf' ? 'Artikel hinzufügen' : 'Aufgabe hinzufügen');
  segmenteSetzen();
  $('fin-uebersicht').hidden = S.finAnsicht !== 'uebersicht';
  $('fin-verlauf').hidden = S.finAnsicht !== 'verlauf';
  $('todo-input').placeholder = S.todoListe === 'studium' ? 'Neue Aufgabe' : 'Neue Aufgabe';
  render();
}
$('tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (S.tab === b.dataset.tab) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.tab = b.dataset.tab;
  merken();
  zeigeTab();
  scrollTo(0, 0);
});
document.querySelectorAll('.segment[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  S[seg.dataset.seg] = b.dataset.v;
  S.offenKat = null;
  merken();
  zeigeTab();
}));
$('neu').onclick = () => {
  if (S.tab === 'finanzen') kostenBlatt();
  else (S.tab === 'einkauf' ? $('einkauf-input') : $('todo-input')).focus();
};

function render() {
  badges();
  if (S.tab === 'finanzen') (S.finAnsicht === 'verlauf' ? renderVerlauf : renderFinanzen)();
  if (S.tab === 'einkauf') renderEinkauf();
  if (S.tab === 'todos') renderTodos();
}
function badges() {
  const auf = F['aufgaben.json']?.aufgaben || [];
  const dringend = auf.filter((a) => a.status === 'offen' && (ueberfaellig(a) || (istHeute(a) && (a.faellig || a.regel)))).length;
  const einkauf = (F['einkauf.json']?.artikel || []).filter((a) => a.status === 'offen').length;
  const setze = (id, n) => {
    const b = $(id);
    let p = b.querySelector('.punkt');
    if (!n) { p?.remove(); return; }
    if (!p) { p = document.createElement('span'); p.className = 'punkt'; b.appendChild(p); }
    p.textContent = n;
  };
  setze('tb-todos', dringend);
  setze('tb-einkauf', einkauf);
}

/* ---------- To-dos ---------- */
function taskHtml(a, erl = false) {
  let meta = erl ? (a.erledigt ? fmtDM(a.erledigt) : '') : metaText(a);
  const ueber = !erl && ueberfaellig(a);
  const heuteTag = !erl && istHeute(a) && (a.faellig || a.regel);
  if (heuteTag) meta = 'Heute';
  if (ueber) meta = a.faellig ? fmtWtDM(a.faellig) : kwVon(a) ? metaText(a) : fmtWtDM(a.datum);
  return `<div class="zeile task${erl ? ' erl' : ''}" style="${farbStil(farbeVon(a))}" data-id="${esc(a.id)}"><div class="vorn">
    <button class="kreis${erl ? ' an' : ''}" data-aktion="${erl ? 'wieder' : 'erledigt'}" aria-label="${erl ? 'Wiederherstellen' : 'Erledigt'}">${icon('check', 14, 3.2)}</button>
    <span class="haupt titel" data-aktion="bearbeiten">${titelHtml(a)}</span>${meta ? `<span class="neben${heuteTag ? ' heute' : ''}${ueber ? ' ueber' : ''}">${esc(meta)}</span>` : ''}</div>${erl ? '' : '<button class="loesch" data-aktion="loeschen">Löschen</button>'}</div>`;
}
function gruppe(titel, liste) {
  if (!liste.length) return '';
  return `<div class="gruppe-titel"><span>${titel}</span><span class="zahl">${liste.length}</span></div><div class="gruppe">${liste.map((a) => taskHtml(a)).join('')}</div>`;
}
function renderTodos() {
  offeneZeile = null;
  const alle = F['aufgaben.json']?.aufgaben || [];
  const liste = S.todoListe;
  const auf = offene(alle, liste);
  const ueber = auf.filter((a) => ueberfaellig(a));
  const h = auf.filter((a) => !ueberfaellig(a) && istHeute(a) && (a.faellig || a.regel));
  const rest = auf.filter((a) => !ueber.includes(a) && !h.includes(a));
  $('todo-liste').innerHTML = auf.length
    ? gruppe('Überfällig', ueber) + gruppe('Heute', h) + gruppe(h.length || ueber.length ? 'Offen' : 'Alle offenen', rest)
    : `<div class="gruppe"><div class="leer">${icon('check', 40, 2.4)}<b>Alles erledigt</b>${liste === 'studium' ? 'Neue Aufgaben entstehen automatisch nach Stundenplan.' : 'Nichts offen.'}</div></div>`;
  const erl = erledigte(alle, liste);
  $('erledigt-umschalten').hidden = !erl.length;
  $('erledigt-umschalten').textContent = S.zeigeErledigt ? 'Erledigte ausblenden' : `Erledigte anzeigen (${erl.length})`;
  $('erledigt-liste').innerHTML = S.zeigeErledigt && erl.length ? `<div class="gruppe">${erl.slice(0, 80).map((a) => taskHtml(a, true)).join('')}</div>` : '';
  zubehoer();
}
$('erledigt-umschalten').onclick = () => { S.zeigeErledigt = !S.zeigeErledigt; renderTodos(); };

function setzeStatus(id, neu) {
  const zeit = new Date().toISOString();
  return aendereOp('aufgaben.json', { liste: 'aufgaben', ids: [id], felder: { status: neu, erledigt: neu === 'erledigt' ? zeit : null } },
    neu === 'erledigt' ? 'Abgehakt' : neu === 'geloescht' ? 'Gelöscht' : 'Wiederhergestellt').catch(() => {});
}
$('tab-todos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aktion]');
  if (!b) return;
  const id = b.closest('[data-id]').dataset.id;
  if (b.dataset.aktion === 'loeschen') {
    setzeStatus(id, 'geloescht');
    renderTodos();
    badges();
    toast('Gelöscht', { label: 'Rückgängig', fn: () => { setzeStatus(id, 'offen'); renderTodos(); badges(); } });
    return;
  }
  if (Date.now() - wischZeit < 350) return;
  if (offeneZeile) { schliesseZeile(); return; }
  if (b.dataset.aktion === 'bearbeiten') { aufgabeBlatt(id); return; }
  if (b.dataset.aktion === 'erledigt') {
    b.classList.add('an');
    setTimeout(() => {
      setzeStatus(id, 'erledigt');
      renderTodos();
      badges();
      toast('Erledigt', { label: 'Rückgängig', fn: () => { setzeStatus(id, 'offen'); renderTodos(); badges(); } });
    }, 280);
  } else {
    setzeStatus(id, 'offen');
    renderTodos();
    badges();
  }
});

// Eingabe mit Zubehör (Modul und Fälligkeit)
function faelligChips(wert, id) {
  const opt = [['', 'Kein Datum'], [heute(), 'Heute'], [morgen(), 'Morgen']];
  const eigen = wert && wert !== heute() && wert !== morgen();
  return opt.map(([v, t]) => `<button class="chip${wert === v ? ' an' : ''}" data-faellig="${v}">${t}</button>`).join('')
    + `<label class="chip${eigen ? ' an' : ''}" style="position:relative">${icon('kalender', 15, 2.2)}${eigen ? fmtWtDM(wert) : 'Datum'}<input type="date" data-datum="${id}" value="${eigen ? wert : ''}" style="position:absolute;inset:0;opacity:0"></label>`;
}
function modulChips(wert) {
  return [['', 'Ohne Modul']].concat(Object.keys(module()).map((k) => [k, k])).map(([v, t]) =>
    `<button class="chip${wert === v ? ' an' : ''}" data-modul="${v}" style="${v ? `--c:${dunkler(modulFarbe(v), 0.5)}` : ''}">${esc(t)}</button>`).join('');
}
function zubehoer() {
  $('todo-module').hidden = S.todoListe !== 'studium';
  $('todo-module').innerHTML = modulChips(S.neuModul);
  $('todo-faellig').innerHTML = faelligChips(S.neuFaellig, 'neu');
}
const zub = $('todo-zubehoer');
$('todo-input').addEventListener('focus', () => { zub.hidden = false; zubehoer(); });
$('todo-input').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('todo-input') && !zub.contains(document.activeElement)) zub.hidden = true; }, 150));
zub.addEventListener('pointerdown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
zub.addEventListener('click', (e) => {
  const m = e.target.closest('[data-modul]');
  const f = e.target.closest('[data-faellig]');
  if (!m && !f) return; // Klick auf das Datumsfeld darf es nicht neu zeichnen, sonst schließt der Kalender
  if (m) S.neuModul = m.dataset.modul;
  if (f) S.neuFaellig = f.dataset.faellig;
  zubehoer();
});
// Datum: erst nach dem Schließen des Kalenders neu zeichnen, sonst bricht iOS die Auswahl ab
zub.addEventListener('change', (e) => { if (e.target.dataset.datum === 'neu') S.neuFaellig = e.target.value; });
zub.addEventListener('focusout', (e) => {
  if (e.target.dataset.datum !== 'neu') return;
  setTimeout(() => { zubehoer(); $('todo-input').focus(); }, 80);
});
function todoSenden() {
  const feld = $('todo-input');
  const titel = feld.value.trim();
  if (!titel) return;
  feld.value = '';
  const neu = { id: uid('a'), liste: S.todoListe, titel, status: 'offen', erstellt: isoZeit(new Date()), erledigt: null };
  if (S.todoListe === 'studium' && S.neuModul) neu.modul = S.neuModul;
  if (S.neuFaellig) neu.faellig = S.neuFaellig;
  S.neuFaellig = '';
  S.neuModul = '';
  sendeKnopf();
  zubehoer();
  aendereOp('aufgaben.json', { liste: 'aufgaben', neu }, 'Neue Aufgabe').catch(() => {});
  renderTodos();
  badges();
}
function sendeKnopf() { $('todo-senden').hidden = !$('todo-input').value.trim(); }
$('todo-input').addEventListener('input', sendeKnopf);
$('todo-senden').addEventListener('pointerdown', (e) => e.preventDefault());
$('todo-senden').addEventListener('click', todoSenden);
$('todo-input').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  todoSenden();
});

// Aufgabe bearbeiten
let bearbeite = null;
function aufgabeBlatt(id) {
  const a = (F['aufgaben.json']?.aufgaben || []).find((x) => x.id === id);
  if (!a) return;
  bearbeite = { id, titel: a.titel, liste: a.liste, modul: a.modul || '', faellig: a.faellig || '', regel: !!a.regel };
  $('aufgabe-titel').value = a.titel;
  aufgabeZeichnen();
  oeffne('blatt-aufgabe');
}
function aufgabeZeichnen() {
  const b = bearbeite;
  const seg = $('aufgabe-liste');
  [...seg.querySelectorAll('button')].forEach((x, i) => { x.classList.toggle('an', x.dataset.v === b.liste); if (x.dataset.v === b.liste) seg.style.setProperty('--i', i); });
  $('aufgabe-modul-box').hidden = b.liste !== 'studium';
  $('aufgabe-module').innerHTML = modulChips(b.modul);
  $('aufgabe-faellig').innerHTML = faelligChips(b.faellig, 'bearbeiten');
  $('aufgabe-loeschen').textContent = b.regel ? 'Aufgabe ausblenden' : 'Aufgabe löschen';
}
$('aufgabe-liste').addEventListener('click', (e) => { const x = e.target.closest('button'); if (x) { bearbeite.liste = x.dataset.v; aufgabeZeichnen(); } });
$('blatt-aufgabe').addEventListener('click', (e) => {
  const m = e.target.closest('[data-modul]');
  const f = e.target.closest('[data-faellig]');
  if (m) { bearbeite.modul = m.dataset.modul; aufgabeZeichnen(); }
  if (f) { bearbeite.faellig = f.dataset.faellig; aufgabeZeichnen(); }
});
$('blatt-aufgabe').addEventListener('change', (e) => { if (e.target.dataset.datum === 'bearbeiten') bearbeite.faellig = e.target.value; });
$('blatt-aufgabe').addEventListener('focusout', (e) => { if (e.target.dataset.datum === 'bearbeiten') setTimeout(aufgabeZeichnen, 80); });
$('aufgabe-sichern').onclick = () => {
  const b = bearbeite;
  const titel = $('aufgabe-titel').value.trim() || b.titel;
  const felder = { titel, liste: b.liste };
  const weg = [];
  if (b.liste === 'studium' && b.modul) felder.modul = b.modul; else if (!b.regel) weg.push('modul');
  if (b.faellig) felder.faellig = b.faellig; else weg.push('faellig');
  aendereOp('aufgaben.json', { liste: 'aufgaben', ids: [b.id], felder, weg }, 'Aufgabe geändert').catch(() => {});
  schliesse();
  render();
};
$('aufgabe-loeschen').onclick = () => {
  const id = bearbeite.id;
  setzeStatus(id, 'geloescht');
  schliesse();
  render();
  toast('Gelöscht', { label: 'Rückgängig', fn: () => { setzeStatus(id, 'offen'); render(); } });
};

/* ---------- Einkauf ---------- */
const norm = (t) => t.trim().toLowerCase();
function renderEinkauf() {
  const alle = F['einkauf.json']?.artikel || [];
  const art = alle.filter((a) => a.status !== 'archiv');
  const offen = art.filter((a) => a.status === 'offen').sort((a, b) => (a.zeit || '').localeCompare(b.zeit || ''));
  const erl = art.filter((a) => a.status === 'erledigt').sort((a, b) => (b.erledigt || '').localeCompare(a.erledigt || ''));
  const zeile = (a) => {
    const e = a.status === 'erledigt';
    return `<div class="zeile artikel${e ? ' erl' : ''}" data-id="${esc(a.id)}" style="--c:#ff9500;--cd:#e08600">
      <button class="kreis${e ? ' an' : ''}" aria-label="Abhaken">${icon('check', 14, 3.2)}</button><span class="haupt">${esc(a.text)}</span></div>`;
  };
  $('einkauf-liste').innerHTML = offen.length || erl.length
    ? (offen.length ? `<div class="gruppe-titel"><span>Einkaufsliste</span><span class="zahl">${offen.length}</span></div><div class="gruppe">${offen.map(zeile).join('')}</div>` : '')
      + (erl.length ? `<div class="gruppe-titel"><span>Im Wagen</span><span class="zahl">${erl.length}</span></div><div class="gruppe">${erl.map(zeile).join('')}</div>` : '')
    : `<div class="gruppe"><div class="leer">${icon('wagen', 40, 2)}<b>Liste ist leer</b>Tippe oben einen Artikel ein, mehrere mit Komma trennen.</div></div>`;
  $('einkauf-aufraeumen').hidden = !erl.length;
  // Vorschläge aus der Historie
  const offenSet = new Set(offen.map((a) => norm(a.text)));
  const zaehler = {};
  for (const a of alle) {
    const k = norm(a.text);
    if (!k || offenSet.has(k)) continue;
    const z = zaehler[k] || (zaehler[k] = { text: a.text.trim(), n: 0, zeit: '' });
    z.n++;
    if ((a.zeit || '') > z.zeit) z.zeit = a.zeit || '';
  }
  const vor = Object.values(zaehler).sort((a, b) => b.n - a.n || b.zeit.localeCompare(a.zeit)).slice(0, 12);
  $('vorschlaege').innerHTML = vor.length ? `<div class="unterlabel">Schnell hinzufügen</div><div class="chips">${vor.map((v) => `<button class="chip" data-vorschlag="${esc(v.text)}">${icon('plus', 13, 2.6)}${esc(v.text)}</button>`).join('')}</div>` : '';
}
function einkaufAendern(op, msg) {
  aendereOp('einkauf.json', { liste: 'artikel', ...op }, msg).catch(() => {});
  renderEinkauf();
  badges();
}
function artikelNeu(texte) {
  const neu = texte.map((text) => ({ id: uid('e'), text, status: 'offen', zeit: isoZeit(new Date()), erledigt: null }));
  einkaufAendern({ neu }, 'Einkauf hinzugefügt');
}
$('einkauf-input').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const teile = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
  if (!teile.length) return;
  e.target.value = '';
  artikelNeu(teile);
});
$('vorschlaege').addEventListener('click', (e) => { const b = e.target.closest('[data-vorschlag]'); if (b) artikelNeu([b.dataset.vorschlag]); });
$('einkauf-liste').addEventListener('click', (e) => {
  const zeile = e.target.closest('[data-id]');
  if (!zeile) return;
  const id = zeile.dataset.id;
  const jetzt = (F['einkauf.json']?.artikel || []).find((x) => x.id === id);
  if (!jetzt) return;
  const status = jetzt.status === 'erledigt' ? 'offen' : 'erledigt';
  einkaufAendern({ ids: [id], felder: { status, erledigt: status === 'erledigt' ? isoZeit(new Date()) : null } }, 'Einkauf abgehakt');
});
$('einkauf-aufraeumen').onclick = () => {
  const ids = (F['einkauf.json']?.artikel || []).filter((a) => a.status === 'erledigt').map((a) => a.id);
  einkaufAendern({ ids, felder: { status: 'archiv' } }, 'Erledigte entfernt');
  toast(`${ids.length} entfernt`, { label: 'Rückgängig', fn: () => einkaufAendern({ ids, felder: { status: 'erledigt' } }, 'Wiederhergestellt') });
};

/* ---------- Finanzen ---------- */
const kats = () => F['kategorien.json']?.kategorien || [];
const katVon = (n) => kats().find((k) => k.name === n) || { name: n, farbe: '#8e8e93' };
function ring(anteil, farbe, groesse = 64) {
  const R = 26;
  const U = 2 * Math.PI * R;
  return `<svg class="ring" viewBox="0 0 64 64" width="${groesse}" height="${groesse}"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--karte2)" stroke-width="7"/>
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="${farbe}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(Math.min(1, anteil) * U).toFixed(1)} ${U.toFixed(1)}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle">${Math.round(anteil * 100)}%</text></svg>`;
}
function renderFinanzen() {
  const k = kats();
  if (!k.length) { $('fin-held').innerHTML = '<div class="unter">Keine Kategorien angelegt.</div>'; $('fin-kat').innerHTML = ''; $('fin-letzte').innerHTML = ''; return; }
  const u = uebersicht(F['kosten.json'], k, F['einstellungen.json'], S.zeitraum);
  const basis = Math.max(u.budget, u.wert) || 1;
  const stapel = u.kats.filter((x) => x.wert > 0).map((x) => `<span style="width:${(x.wert / basis) * 100}%;background:${x.farbe}"></span>`).join('');
  const st = status(u.wert, u.budget);
  const farbe = st === 'bad' ? 'var(--bad)' : st === 'warn' ? 'var(--warn)' : 'var(--ok)';
  if (u.N === 1) {
    const ueber = u.rest < 0;
    $('fin-held').innerHTML = `<div class="reihe"><div><div class="klein">${ueber ? 'Über Budget' : `Übrig im ${monatName(monatKey(new Date()))}`}</div>
      <div class="gross" style="${ueber ? 'color:var(--bad)' : ''}">${euro(Math.abs(u.rest))}</div>
      <div class="unter">${ueber ? 'Ab jetzt bitte sparsam.' : `<b>${euro(u.restTag)}</b> pro Tag verfügbar`}</div></div>${ring(u.budget ? u.summe / u.budget : 0, farbe)}</div>
      <div class="stapelbalken">${stapel}</div><div class="unter" style="margin-top:8px">${euro(u.summe)} von ${euro0(u.budget)} ausgegeben${u.fix ? ` · ${euro0(u.fix)} Fixkosten` : ''}</div>`;
    $('fin-hinweis').textContent = 'Ausgaben / Budget';
  } else {
    $('fin-held').innerHTML = `<div class="reihe"><div><div class="klein">Ø pro Monat</div>
      <div class="gross" style="${u.wert > u.budget ? 'color:var(--bad)' : ''}">${euro(u.wert)}</div>
      <div class="unter"><b>${euro(u.summe)}</b> gesamt · ${u.n} ${u.n === 1 ? 'Monat' : 'Monate'}</div></div>${ring(u.budget ? u.wert / u.budget : 0, farbe)}</div>
      <div class="stapelbalken">${stapel}</div><div class="unter" style="margin-top:8px">Budget ${euro0(u.budget)} pro Monat</div>`;
    $('fin-hinweis').textContent = 'Ø pro Monat / Budget';
  }
  $('fin-kat').innerHTML = u.kats.filter((x) => !(x.fix > 0 && x.wert === 0)).map((x) => {
    const s = status(x.wert, Number(x.budget));
    const breite = x.budget ? Math.min(100, (x.wert / x.budget) * 100) : (x.wert ? 100 : 0);
    const offen = S.offenKat === x.name && x.eintraege.length > 0;
    const eintraege = offen ? `<div class="eintraege">${x.eintraege.length ? x.eintraege.map((b) => `
      <div class="eintrag" data-buchung="${esc(b.id)}"><span class="neben">${fmtDM(b.datum)}</span><span class="haupt">${esc(b.text || x.name)}</span><span class="neben">${euro(b.betrag)}</span></div>`).join('') : '<div class="eintrag"><span class="haupt neben">Keine Einträge in diesem Zeitraum</span></div>'}</div>` : '';
    return `<div class="zeile kat" data-kat="${esc(x.name)}"><span class="symbol" style="background:${x.farbe}">${icon(katSymbol(x.name), 17, 2.2)}</span>
      <div class="haupt"><div class="oben"><span>${esc(x.name)}</span><span class="betrag">${euro(x.wert)}${x.budget ? ` <small>/ ${euro0(x.budget)}</small>` : ''}</span></div>
      <div class="balken"><span class="${s}" style="width:${breite}%"></span></div></div></div>${eintraege}`;
  }).join('');
  const letzte = aktive(F['kosten.json']).filter((b) => b.quelle !== 'dauer').sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 5);
  $('fin-letzte').innerHTML = letzte.length ? `<div class="gruppe-titel"><span>Zuletzt</span></div><div class="gruppe">${letzte.map((b) => {
    const kk = katVon(b.kategorie);
    return `<div class="zeile buchung" data-buchung="${esc(b.id)}"><span class="symbol" style="background:${kk.farbe}">${icon(katSymbol(kk.name), 17, 2.2)}</span>
      <div class="haupt"><div>${esc(b.text || kk.name)}</div><div class="unter">${esc(fmtWtDM(b.datum))}${b.text ? ` · ${esc(kk.name)}` : ''}</div></div><span class="betrag">${euro(b.betrag)}</span></div>`;
  }).join('')}</div>` : '';
}
$('tab-finanzen').addEventListener('click', (e) => {
  const b = e.target.closest('[data-buchung]');
  if (b) { kostenBlatt(b.dataset.buchung); return; }
  const z = e.target.closest('[data-kat]');
  if (!z) return;
  S.offenKat = S.offenKat === z.dataset.kat ? null : z.dataset.kat;
  renderFinanzen();
});

function renderVerlauf() {
  const k = kats();
  $('verlauf-chips').innerHTML = [{ name: '', farbe: 'var(--accent)' }, ...k].map((x) =>
    `<button class="chip${S.verlaufKat === x.name ? ' an' : ''}" style="--c:${x.farbe}" data-vk="${esc(x.name)}">${esc(x.name || 'Gesamt')}</button>`).join('');
  const daten = verlauf(F['kosten.json'], S.verlaufKat || null);
  const kat = k.find((x) => x.name === S.verlaufKat);
  const budget = kat ? Number(kat.budget) || 0 : (Number(F['einstellungen.json']?.monatsbudget) || k.reduce((s, x) => s + (Number(x.budget) || 0), 0));
  const farbe = kat ? kat.farbe : getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#007aff';
  const W = 340; const H = 190; const L = 40; const R = 12; const T = 12; const B = 24;
  const max = Math.max(budget, ...daten.map((d) => d.wert), 10) * 1.12;
  const n = daten.length;
  const x = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const stufe = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => max / s <= 5) || 1000;
  let g = '';
  for (let v = 0; v <= max; v += stufe) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  // weiche Kurve
  const P = daten.map((d, i) => [x(i), y(d.wert)]);
  let pfad = P.length ? `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}` : '';
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1]; const [x1, y1] = P[i]; const m = (x1 - x0) / 2;
    pfad += ` C${(x0 + m).toFixed(1)},${y0.toFixed(1)} ${(x1 - m).toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const flaeche = n > 1 ? `${pfad} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';
  const labels = daten.map((d, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${MON[Number(d.monat.slice(5)) - 1]}</text>`).join('');
  const punkte = daten.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.wert)}" r="${i === n - 1 ? 5 : 3.5}" fill="${i === n - 1 ? 'var(--karte)' : farbe}" stroke="${farbe}" stroke-width="${i === n - 1 ? 3 : 0}"/>`).join('');
  const bl = budget ? `<line x1="${L}" x2="${W - R}" y1="${y(budget)}" y2="${y(budget)}" stroke="${farbe}" stroke-dasharray="4 5" stroke-opacity=".6"/><text x="${W - R}" y="${y(budget) - 6}" text-anchor="end">Budget</text>` : '';
  $('verlauf-svg').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="color:var(--text)"><defs><linearGradient id="vg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${farbe}" stop-opacity=".28"/><stop offset="1" stop-color="${farbe}" stop-opacity="0"/></linearGradient></defs>${g}${bl}
    ${flaeche ? `<path d="${flaeche}" fill="url(#vg)"/>` : ''}<path d="${pfad}" fill="none" stroke="${farbe}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>${punkte}${labels}</svg>`;
  const werte = daten.map((d) => d.wert);
  const voll = werte.slice(0, -1);
  const schnitt = voll.length ? voll.reduce((a, b) => a + b, 0) / voll.length : werte[werte.length - 1] || 0;
  $('verlauf-zahlen').innerHTML = `<div class="kennzahl"><div class="k">Dieser Monat</div><div class="v">${euro(werte[werte.length - 1] || 0)}</div></div>
    <div class="kennzahl"><div class="k">${voll.length ? `Ø ${voll.length} volle Monate` : 'Ø pro Monat'}</div><div class="v">${euro(schnitt)}</div></div>`;
}
$('verlauf-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vk]');
  if (!b) return;
  S.verlaufKat = b.dataset.vk;
  merken();
  renderVerlauf();
});

/* ---------- Sheets ---------- */
let offenesBlatt = null;
function oeffne(id) {
  offenesBlatt = id;
  $(id).classList.add('an');
  $('schleier').classList.add('an');
}
function schliesse() {
  if (!offenesBlatt) return;
  $(offenesBlatt).classList.remove('an');
  $('schleier').classList.remove('an');
  offenesBlatt = null;
  document.activeElement?.blur();
}
$('schleier').onclick = schliesse;
document.querySelectorAll('[data-zu]').forEach((b) => { b.onclick = schliesse; });

let wahl = null;
let kostenId = null;
function katwahl() {
  $('katwahl').innerHTML = kats().map((k) => `<button style="--c:${k.farbe}" data-k="${esc(k.name)}" class="${k.name === wahl ? 'an' : ''}"><span class="symbol" style="background:${k.farbe}">${icon(katSymbol(k.name), 17, 2.2)}</span>${esc(k.name)}</button>`).join('');
}
function kostenBlatt(id = null) {
  const b = id ? aktive(F['kosten.json']).find((x) => x.id === id) : null;
  kostenId = b ? b.id : null;
  wahl = b ? b.kategorie : null;
  $('kosten-titel').textContent = b ? 'Ausgabe bearbeiten' : 'Neue Ausgabe';
  $('betrag').value = b ? String(b.betrag).replace('.', ',') : '';
  $('notiz').value = b ? b.text || '' : '';
  $('kosten-datum').value = b ? b.datum.slice(0, 10) : heute();
  $('kosten-loeschen').hidden = !b;
  $('kosten-fehler').textContent = '';
  katwahl();
  oeffne('blatt-kosten');
  if (!b) setTimeout(() => $('betrag').focus(), 350);
}
$('katwahl').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  wahl = b.dataset.k;
  katwahl();
  $('notiz').placeholder = wahl === 'Sonstiges' ? 'Wofür? (nötig bei Sonstiges)' : 'Notiz (optional)';
  $('kosten-fehler').textContent = '';
});
[$('betrag'), $('notiz')].forEach((el) => el.addEventListener('input', () => { $('kosten-fehler').textContent = ''; }));
$('kosten-sichern').onclick = () => {
  const betrag = parseBetrag($('betrag').value);
  const text = $('notiz').value.trim();
  const tag = $('kosten-datum').value || heute();
  if (!(betrag > 0)) { $('kosten-fehler').textContent = 'Gib einen Betrag ein.'; return; }
  if (!wahl) { $('kosten-fehler').textContent = 'Wähle eine Kategorie.'; return; }
  if (wahl === 'Sonstiges' && !text) { $('kosten-fehler').textContent = 'Bei Sonstiges bitte angeben, wofür.'; return; }
  const jetzt = new Date();
  const datum = tag === heute() ? isoZeit(jetzt) : `${tag}T12:00:00`;
  if (kostenId) {
    const id = kostenId;
    const alt = aktive(F['kosten.json']).find((x) => x.id === id);
    const neuDatum = alt && alt.datum.slice(0, 10) === tag ? alt.datum : datum;
    aendereOp('kosten.json', { liste: 'buchungen', ids: [id], felder: { betrag, text, kategorie: wahl, datum: neuDatum } }, 'Ausgabe geändert').catch(() => {});
  } else {
    const b = { id: uid('b'), datum, kategorie: wahl, betrag, text, quelle: 'app' };
    aendereOp('kosten.json', { liste: 'buchungen', neu: b }, `Ausgabe ${wahl}`).catch(() => {});
    toast(`${euro(betrag)} · ${wahl}`);
  }
  schliesse();
  render();
};
$('kosten-loeschen').onclick = () => {
  const id = kostenId;
  const setze = (v) => { aendereOp('kosten.json', { liste: 'buchungen', ids: [id], felder: { storniert: v } }, v ? 'Ausgabe gelöscht' : 'Ausgabe wiederhergestellt').catch(() => {}); render(); };
  setze(true);
  schliesse();
  toast('Ausgabe gelöscht', { label: 'Rückgängig', fn: () => setze(false) });
};

/* ---------- Laden ---------- */
let geladen = false;
async function laden(erst = false) {
  try {
    await ladeAlle(DATEIEN);
    $('banner').innerHTML = '';
    if (erst) await routine();
    geladen = true;
    if (offenNachzureichen()) { const n = await nachholen(); if (n) toast(`${n} ${n === 1 ? 'Änderung' : 'Änderungen'} nachgereicht`); }
  } catch (e) {
    $('banner').innerHTML = e instanceof FehlerToken
      ? `<div class="banner">${icon('aus', 20)}<span>Noch nicht verbunden. <a href="einstellungen.html">Token eintragen</a></span></div>`
      : `<div class="banner">${icon('wolke', 20)}<span>Offline, zeige gespeicherten Stand.</span></div>`;
  }
  const tippt = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (!tippt && !offenesBlatt) render(); else badges();
}
async function wetter() {
  try {
    const w = await holeWetter(F['einstellungen.json']);
    wetterCode = w.code || 0;
    szeneTakt();
    const e = w.empfehlung;
    $('wetter').innerHTML = `${icon(wetterSymbol(w.code, !w.tag), 17, 2)}<b>${w.temperatur}°</b>${e ? `<span>· ${w.morgen ? 'Morgen: ' : ''}${esc(e.kleidung)}${e.schirm ? ', Schirm' : ''}</span>` : ''}`;
  } catch { $('wetter').innerHTML = ''; }
}
function datum() { $('datum').textContent = headerText(new Date()); }

datum();
setInterval(datum, 60000);
zeigeTab();
await laden(true);
wetter();
starteZyklus(() => laden(), 60);
starteZyklus(wetter, 900);
addEventListener('online', () => laden());
starteZyklus(() => routine().then(() => { if (geladen && !offenesBlatt) render(); }), 1800);



/* ---------- Wischen zum Löschen ---------- */
const BREITE = 96;
function schliesseZeile() {
  if (!offeneZeile) return;
  offeneZeile.classList.remove('auf');
  offeneZeile.querySelector('.vorn').style.transform = '';
  offeneZeile.querySelector('.loesch').style.width = '';
  offeneZeile = null;
}
{
  let d = null;
  const liste = $('todo-liste');
  liste.addEventListener('pointerdown', (e) => {
    const vorn = e.target.closest('.vorn');
    if (!vorn) { schliesseZeile(); return; }
    const zeile = vorn.parentElement;
    if (offeneZeile && offeneZeile !== zeile) schliesseZeile();
    d = { x: e.clientX, y: e.clientY, zeile, vorn, start: offeneZeile === zeile ? -BREITE : 0, aktiv: false };
  });
  liste.addEventListener('pointermove', (e) => {
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.aktiv) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { d = null; return; }
      if (Math.abs(dx) < 8) return;
      d.aktiv = true;
      d.zeile.classList.add('zieht');
      try { liste.setPointerCapture(e.pointerId); } catch { /* egal */ }
    }
    const t = Math.max(-BREITE - 24, Math.min(0, d.start + dx));
    d.vorn.style.transform = `translateX(${t}px)`;
    d.zeile.querySelector('.loesch').style.width = `${-t}px`;
    d.t = t;
  });
  const ende = () => {
    if (!d) return;
    const x = d;
    d = null;
    if (!x.aktiv) return;
    wischZeit = Date.now();
    x.zeile.classList.remove('zieht');
    const lo = x.zeile.querySelector('.loesch');
    if (x.t < -BREITE / 2) { x.vorn.style.transform = `translateX(${-BREITE}px)`; lo.style.width = `${BREITE}px`; x.zeile.classList.add('auf'); offeneZeile = x.zeile; } else { x.vorn.style.transform = ''; lo.style.width = ''; x.zeile.classList.remove('auf'); if (offeneZeile === x.zeile) offeneZeile = null; }
  };
  liste.addEventListener('pointerup', ende);
  liste.addEventListener('pointercancel', ende);
}


/* ---------- Hintergrund: gleiche Szene wie am Panel, aber ruhig ---------- */
let wetterCode = 0;
const szene = erstelleSzene(document.getElementById('szene'));
szene.bewegung(false);
function szeneTakt() {
  const st = panelEinst().hintergrund;
  szene.setzeStil(st === 'fotos' ? 'landschaft' : st);
  szene.aktualisiere(szenenDatum(), wetterCode);
}
szeneTakt();
starteZyklus(szeneTakt, 120);

/* ---------- Diagnose: dreimal auf das Datum tippen ---------- */
{
  let taps = [];
  document.getElementById('datum').addEventListener('click', () => {
    const n = Date.now();
    taps = taps.filter((x) => n - x < 900).concat(n);
    if (taps.length < 3) return;
    taps = [];
    const v = window.visualViewport || {};
    const sa = document.createElement('div');
    sa.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0';
    document.body.appendChild(sa);
    const c = getComputedStyle(sa);
    const tb = document.getElementById('tabbar').getBoundingClientRect();
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:99;background:rgba(0,0,0,.9);color:#fff;font:14px/1.5 ui-monospace,monospace;padding:14px 18px;border-radius:14px;white-space:pre';
    t.textContent = `inner ${innerWidth}x${innerHeight}\nscreen ${screen.width}x${screen.height}\nvv ${Math.round(v.width)}x${Math.round(v.height)} off ${Math.round(v.offsetTop)}\nscroll ${scrollY} doc ${document.documentElement.scrollHeight}\nsafe T${c.paddingTop} B${c.paddingBottom}\ntabbar bottom ${Math.round(tb.bottom)} (inner-${Math.round(innerHeight - tb.bottom)})`;
    sa.remove();
    t.onclick = () => t.remove();
    document.body.appendChild(t);
  });
}
