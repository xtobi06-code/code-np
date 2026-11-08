import { F, ladeAlle, ausCache, aendere, aendereOp, nachholen, beiOffline, offenNachzureichen, routine, beiFehler, FehlerToken } from './shared/core.js';
import { erzeugen, badgeHtml, kwVon, offene, erledigte, metaText, titelHtml, farbeVon, farbStil, istHeute, ueberfaellig, module, modulFarbe } from './shared/tasks.js';
import { uebersicht, verlauf, status, katSymbol, monatName, monatKey, aktive } from './shared/finance.js';
import { holeWetter, starteZyklus, toast } from './shared/app.js';
import { erstelleSzene } from './shared/scene.js';
import { panelEinst, szenenDatum } from './shared/core.js';
import { icon, wetterSymbol } from './shared/icons.js';
import { haptik, rausfahren, merkeNeu, zeigeNeue, weich, wischLoeschen } from './shared/bewegung.js';
import { headerText, esc, euro, euro0, uid, isoZeit, isoDate, fmtDM, fmtWtDM, parseBetrag, MON, addDays, dunkler, montag, kwKey, kwLabel, isoWeek } from './shared/util.js';

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
// Wischen zum Löschen in To-dos und „Zuletzt“ (kurz: Knopf zeigen, ganz durch: löschen)
const W = wischLoeschen({ zeile: '#todo-liste .task, #fin-letzte .task' });
// Platzhalter, solange noch nie Daten geladen wurden
let bereit = false;
const phZeilen = (n) => Array.from({ length: n }, (_, i) => `<div class="zeile platzhalter" aria-hidden="true"><span class="ph-kreis"></span><span class="ph-balken" style="width:${[62, 44, 70, 52, 38][i % 5]}%"></span></div>`).join('');
const platzhalter = (n = 4) => `<div class="gruppe">${phZeilen(n)}</div>`;
const leer = (ic, farbe, titel, text, extra = '') => `<div class="gruppe"><div class="leer"><span class="leer-ic" style="--lc:${farbe}">${icon(ic, 28, 2.2)}</span><b>${titel}</b><span>${text}</span>${extra}</div></div>`;
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
function wochenKarte() {
  const jetzt = new Date();
  const k = kwKey(jetzt);
  const mo = isoDate(montag(jetzt));
  const so = isoDate(addDays(montag(jetzt), 6));
  const alle = F['aufgaben.json']?.aufgaben || [];
  // Ganze Woche: vorhandene Aufgaben plus die, die in den nächsten Tagen noch entstehen
  const kommend = erzeugen(F['einstellungen.json'], F['regeln.json']?.regeln || [], alle, addDays(montag(jetzt), 6)).map((a) => ({ ...a, status: 'offen' }));
  const auf = [...alle, ...kommend].filter((a) => a.liste === 'studium' && a.regel && a.status !== 'geloescht' && (a.kw ? a.kw === k : a.datum >= mo && a.datum <= so));
  if (!auf.length) return '';
  const fertig = auf.filter((a) => a.status === 'erledigt').length;
  const nach = {};
  auf.forEach((a) => { const m = nach[a.modul] || (nach[a.modul] = { g: 0, f: 0 }); m.g++; if (a.status === 'erledigt') m.f++; });
  const zeilen = Object.entries(nach).map(([m, v]) => `<div class="zeile wk"><span class="wk-m">${badgeHtml(m)}</span><span class="wk-bar"><i data-w="wk-${esc(m)}" style="width:${(v.f / v.g) * 100}%;background:${modulFarbe(m)}"></i></span><span class="neben">${v.f}/${v.g}</span></div>`).join('');
  return `<div class="gruppe-titel"><span>Diese Woche · KW ${isoWeek(jetzt)}</span><span class="zahl"><span data-n="wk-fertig" data-v="${fertig}">${fertig}</span> von ${auf.length} erledigt</span></div><div class="gruppe">${zeilen}</div>`;
}
function renderTodos() {
  $('woche-karte').innerHTML = S.todoListe === 'studium' ? wochenKarte() : '';
  weich($('woche-karte'));
  const alle = F['aufgaben.json']?.aufgaben || [];
  const liste = S.todoListe;
  const auf = offene(alle, liste);
  const ueber = auf.filter((a) => ueberfaellig(a));
  const h = auf.filter((a) => !ueberfaellig(a) && istHeute(a) && (a.faellig || a.regel));
  const rest = auf.filter((a) => !ueber.includes(a) && !h.includes(a));
  $('todo-liste').innerHTML = !bereit ? platzhalter(5) : auf.length
    ? gruppe('Überfällig', ueber) + gruppe('Heute', h) + gruppe(h.length || ueber.length ? 'Offen' : 'Alle offenen', rest)
    : leer('check', '#30d158', 'Alles erledigt', liste === 'studium' ? 'Neue Aufgaben entstehen automatisch nach deinem Stundenplan.' : 'Nichts offen. Neue Aufgaben tippst du oben ein.');
  const erl = erledigte(alle, liste);
  $('erledigt-umschalten').hidden = !erl.length;
  $('erledigt-umschalten').textContent = S.zeigeErledigt ? 'Erledigte ausblenden' : `Erledigte anzeigen (${erl.length})`;
  $('erledigt-liste').innerHTML = S.zeigeErledigt && erl.length ? `<div class="gruppe">${erl.slice(0, 80).map((a) => taskHtml(a, true)).join('')}</div>` : '';
  zeigeNeue($('todo-liste'));
  zeigeNeue($('erledigt-liste'));
  zubehoer();
}
$('erledigt-umschalten').onclick = () => { S.zeigeErledigt = !S.zeigeErledigt; renderTodos(); };

function setzeStatus(id, neu) {
  const zeit = new Date().toISOString();
  return aendereOp('aufgaben.json', { liste: 'aufgaben', ids: [id], felder: { status: neu, erledigt: neu === 'erledigt' ? zeit : null } },
    neu === 'erledigt' ? 'Abgehakt' : neu === 'geloescht' ? 'Gelöscht' : 'Wiederhergestellt').catch(() => {});
}
const zurueckholen = (id) => { setzeStatus(id, 'offen'); merkeNeu(id); renderTodos(); badges(); };
$('tab-todos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aktion]');
  if (!b) return;
  const zeile = b.closest('[data-id]');
  const id = zeile.dataset.id;
  if (b.dataset.aktion === 'loeschen') {
    const weg = () => { setzeStatus(id, 'geloescht'); renderTodos(); badges(); toast('Gelöscht', { label: 'Rückgängig', fn: () => zurueckholen(id) }); };
    if (zeile.classList.contains('weg')) { weg(); return; } // schon weggewischt
    zeile.classList.add('weg');
    haptik();
    rausfahren(zeile).then(weg);
    return;
  }
  if (W.eben()) return;
  if (W.offen()) { W.zu(); return; }
  if (zeile.classList.contains('weg')) return;
  if (b.dataset.aktion === 'bearbeiten') { aufgabeBlatt(id); return; }
  zeile.classList.add('weg');
  if (b.dataset.aktion === 'erledigt') {
    b.classList.add('an');
    haptik();
    setTimeout(() => rausfahren(zeile, 260).then(() => {
      setzeStatus(id, 'erledigt');
      renderTodos();
      badges();
      toast('Erledigt', { label: 'Rückgängig', fn: () => zurueckholen(id) });
    }), 220);
  } else {
    b.classList.remove('an');
    rausfahren(zeile).then(() => zurueckholen(id));
  }
});

// Eingabe mit Zubehör (Modul und Fälligkeit)
// effektiv: Datum oder Woche, das eine automatisch erzeugte Aufgabe schon hat (wird als gewählt angezeigt, ohne es zu ändern)
function faelligChips(wert, id, effektiv = '') {
  const opt = [['', 'Kein Datum'], [heute(), 'Heute'], [morgen(), 'Morgen']];
  const eigen = wert && wert !== heute() && wert !== morgen();
  const vorhanden = !wert && effektiv;
  const nichts = opt.map(([v, t]) => (v === '' ? `<button class="chip${wert === v && !vorhanden ? ' an' : ''}" data-faellig="">${t}</button>` : `<button class="chip${wert === v ? ' an' : ''}" data-faellig="${v}">${t}</button>`)).join('');
  return nichts
    + `<label class="chip${eigen || vorhanden ? ' an' : ''}" style="position:relative">${icon('kalender', 15, 2.2)}${eigen ? fmtWtDM(wert) : vorhanden ? esc(effektiv) : 'Datum'}<input type="date" data-datum="${id}" value="${eigen ? wert : ''}" style="position:absolute;inset:0;opacity:0"></label>`;
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
  merkeNeu(neu.id);
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
  const eff = a.faellig ? '' : kwVon(a) ? kwLabel(kwVon(a)) : a.datum ? fmtWtDM(a.datum) : '';
  bearbeite = { id, titel: a.titel, liste: a.liste, modul: a.modul || '', faellig: a.faellig || '', regel: !!a.regel, eff };
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
  $('aufgabe-faellig').innerHTML = faelligChips(b.faellig, 'bearbeiten', b.eff);
  $('aufgabe-loeschen').textContent = b.regel ? 'Aufgabe ausblenden' : 'Aufgabe löschen';
}
$('aufgabe-liste').addEventListener('click', (e) => { const x = e.target.closest('button'); if (x) { bearbeite.liste = x.dataset.v; aufgabeZeichnen(); } });
$('blatt-aufgabe').addEventListener('click', (e) => {
  const m = e.target.closest('[data-modul]');
  const f = e.target.closest('[data-faellig]');
  if (m) { bearbeite.modul = m.dataset.modul; aufgabeZeichnen(); }
  if (f) { bearbeite.faellig = f.dataset.faellig; bearbeite.eff = ''; aufgabeZeichnen(); }
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
  toast('Gelöscht', { label: 'Rückgängig', fn: () => { setzeStatus(id, 'offen'); merkeNeu(id); render(); } });
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
  $('einkauf-liste').innerHTML = !bereit ? platzhalter(4) : offen.length || erl.length
    ? (offen.length ? `<div class="gruppe-titel"><span>Einkaufsliste</span><span class="zahl">${offen.length}</span></div><div class="gruppe">${offen.map(zeile).join('')}</div>` : '')
      + (erl.length ? `<div class="gruppe-titel"><span>Im Wagen</span><span class="zahl">${erl.length}</span></div><div class="gruppe">${erl.map(zeile).join('')}</div>` : '')
    : leer('wagen', '#ff9f0a', 'Liste ist leer', 'Tippe oben einen Artikel ein, mehrere mit Komma trennen.');
  zeigeNeue($('einkauf-liste'));
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
  merkeNeu(neu.map((a) => a.id));
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
  if (zeile.classList.contains('weg')) return;
  const status = jetzt.status === 'erledigt' ? 'offen' : 'erledigt';
  zeile.classList.add('weg');
  zeile.querySelector('.kreis')?.classList.toggle('an', status === 'erledigt');
  if (status === 'erledigt') haptik();
  // Haken zeigen, Zeile schrumpft weg, danach taucht sie in der anderen Gruppe auf
  setTimeout(() => rausfahren(zeile).then(() => {
    merkeNeu(id);
    einkaufAendern({ ids: [id], felder: { status, erledigt: status === 'erledigt' ? isoZeit(new Date()) : null } }, 'Einkauf abgehakt');
  }), 160);
});
$('einkauf-aufraeumen').onclick = () => {
  const ids = (F['einkauf.json']?.artikel || []).filter((a) => a.status === 'erledigt').map((a) => a.id);
  const zeilen = [...document.querySelectorAll('#einkauf-liste .artikel.erl')];
  Promise.all(zeilen.map((z) => rausfahren(z))).then(() => {
    einkaufAendern({ ids, felder: { status: 'archiv' } }, 'Erledigte entfernt');
    toast(`${ids.length} entfernt`, { label: 'Rückgängig', fn: () => { merkeNeu(ids); einkaufAendern({ ids, felder: { status: 'erledigt' } }, 'Wiederhergestellt'); } });
  });
};

/* ---------- Finanzen ---------- */
const kats = () => F['kategorien.json']?.kategorien || [];
const katVon = (n) => kats().find((k) => k.name === n) || { name: n, farbe: '#8e8e93' };
function ring(anteil, farbe, groesse = 64, key = 'ring') {
  const R = 26;
  const U = 2 * Math.PI * R;
  return `<svg class="ring" viewBox="0 0 64 64" width="${groesse}" height="${groesse}"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--karte2)" stroke-width="7"/>
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="${farbe}" stroke-width="7" stroke-linecap="round"${anteil > 0 ? '' : ' stroke-opacity="0"'} data-d="${key}" stroke-dasharray="${(Math.min(1, anteil) * U).toFixed(1)} ${U.toFixed(1)}" transform="rotate(-90 32 32)"/>
    ${(() => { const p = Math.round(anteil * 100); return p >= 1000 ? '<text x="32" y="37" text-anchor="middle" style="font-size:12px">>999%</text>' : `<text x="32" y="37" text-anchor="middle"${p >= 100 ? ' style="font-size:12.5px"' : ''}><tspan data-n="${key}-p" data-v="${p}">${p}</tspan>%</text>`; })()}</svg>`;
}
function renderFinanzen() {
  const k = kats();
  if (!bereit) { $('fin-held').innerHTML = '<div class="ph-balken" style="width:40%;height:12px"></div><div class="ph-balken" style="width:62%;height:38px;margin:10px 0"></div><div class="ph-balken" style="width:100%;height:10px;margin-top:18px"></div>'; $('fin-kat').innerHTML = phZeilen(4); $('fin-letzte').innerHTML = ''; return; }
  if (!k.length) { $('fin-held').innerHTML = `<div class="leer" style="padding:14px 6px 8px"><span class="leer-ic" style="--lc:#30d158">${icon('geldbeutel', 28, 2.2)}</span><b>Noch keine Kategorien</b><span>Lege in den <a href="einstellungen.html">Einstellungen</a> Kategorien mit Budget an.</span></div>`; $('fin-kat').innerHTML = ''; $('fin-letzte').innerHTML = ''; return; }
  const u = uebersicht(F['kosten.json'], k, F['einstellungen.json'], S.zeitraum);
  const basis = Math.max(u.budget, u.wert) || 1;
  const z = S.zeitraum;
  const stapel = u.kats.filter((x) => x.wert > 0).map((x) => `<span data-w="st-${z}-${esc(x.name)}" style="width:${(x.wert / basis) * 100}%;background:${x.farbe}"></span>`).join('');
  const st = status(u.wert, u.budget);
  const farbe = st === 'bad' ? 'var(--bad)' : st === 'warn' ? 'var(--warn)' : 'var(--ok)';
  if (u.N === 1) {
    const ueber = u.rest < 0;
    $('fin-held').innerHTML = `<div class="reihe"><div><div class="klein">${ueber ? 'Über Budget' : `Übrig im ${monatName(monatKey(new Date()))}`}</div>
      <div class="gross${euro(Math.abs(u.rest)).length > 10 ? ' lang' : ''}" style="${ueber ? 'color:var(--bad)' : ''}" data-n="held-${z}" data-v="${Math.abs(u.rest)}" data-f="euro">${euro(Math.abs(u.rest))}</div>
      <div class="unter">${ueber ? 'Ab jetzt bitte sparsam.' : `<b data-n="tag-${z}" data-v="${u.restTag}" data-f="euro">${euro(u.restTag)}</b> pro Tag verfügbar`}</div></div>${ring(u.budget ? u.summe / u.budget : 0, farbe, 64, `ring-${z}`)}</div>
      <div class="stapelbalken">${stapel}</div><div class="unter" style="margin-top:8px">${euro(u.summe)} von ${euro0(u.budget)} ausgegeben${u.fix ? ` · ${euro0(u.fix)} Fixkosten` : ''}</div>`;
    $('fin-hinweis').textContent = 'Ausgaben / Budget';
  } else {
    $('fin-held').innerHTML = `<div class="reihe"><div><div class="klein">Ø pro Monat</div>
      <div class="gross${euro(u.wert).length > 10 ? ' lang' : ''}" style="${u.wert > u.budget ? 'color:var(--bad)' : ''}" data-n="held-${z}" data-v="${u.wert}" data-f="euro">${euro(u.wert)}</div>
      <div class="unter"><b>${euro(u.summe)}</b> gesamt · ${u.n} ${u.n === 1 ? 'Monat' : 'Monate'}</div></div>${ring(u.budget ? u.wert / u.budget : 0, farbe, 64, `ring-${z}`)}</div>
      <div class="stapelbalken">${stapel}</div><div class="unter" style="margin-top:8px">Budget ${euro0(u.budget)} pro Monat</div>`;
    $('fin-hinweis').textContent = 'Ø pro Monat / Budget';
  }
  $('fin-kat').innerHTML = u.kats.filter((x) => !(x.fix > 0 && x.wert === 0)).map((x) => {
    const s = status(x.wert, Number(x.budget));
    const breite = x.budget ? Math.min(100, (x.wert / x.budget) * 100) : (x.wert ? 100 : 0);
    const offen = S.offenKat === x.name && x.eintraege.length > 0;
    const eintraege = offen ? `<div class="eintraege">${x.eintraege.length ? x.eintraege.map((b) => `
      <div class="eintrag" data-buchung="${esc(b.id)}"><span class="neben">${fmtDM(b.datum)}</span><span class="haupt">${esc(b.text || x.name)}</span><span class="neben">${euro(b.betrag)}</span></div>`).join('') : '<div class="eintrag"><span class="haupt neben">Keine Einträge in diesem Zeitraum</span></div>'}</div>` : '';
    return `<div class="zeile kat" data-kat="${esc(x.name)}"><span class="symbol" style="background:${x.farbe}">${icon(katSymbol(x.name, x.symbol), 17, 2.2)}</span>
      <div class="haupt"><div class="oben"><span>${esc(x.name)}</span><span class="betrag">${euro(x.wert)}${x.budget ? ` <small>/ ${euro0(x.budget)}</small>` : ''}</span></div>
      <div class="balken"><span class="${s}" data-w="kat-${z}-${esc(x.name)}" style="width:${breite}%"></span></div></div></div>${eintraege}`;
  }).join('');
  const letzte = aktive(F['kosten.json']).filter((b) => b.quelle !== 'dauer').sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 5);
  $('fin-letzte').innerHTML = !letzte.length
    ? `<div class="gruppe-titel"><span>Zuletzt</span></div><div class="gruppe"><div class="leer klein"><span>Noch keine Ausgaben. Tippe oben auf <b>+</b>.</span></div></div>`
    : `<div class="gruppe-titel"><span>Zuletzt</span></div><div class="gruppe">${letzte.map((b) => {
    const kk = katVon(b.kategorie);
    return `<div class="zeile task buchung" data-buchung="${esc(b.id)}"><div class="vorn"><span class="symbol" style="background:${kk.farbe}">${icon(katSymbol(kk.name, kk.symbol), 17, 2.2)}</span>
      <div class="haupt"><div>${esc(kk.name)}</div><div class="unter">${esc(fmtWtDM(b.datum))}${b.text ? ` · ${esc(b.text)}` : ''}</div></div><span class="betrag">${euro(b.betrag)}</span></div><button class="loesch" data-bloesch="${esc(b.id)}">Löschen</button></div>`;
  }).join('')}</div>`;
  weich($('fin-held'));
  weich($('fin-kat'));
  zeigeNeue($('fin-letzte'));
}
$('tab-finanzen').addEventListener('click', (e) => {
  const bl = e.target.closest('[data-bloesch]');
  if (bl) {
    const id = bl.dataset.bloesch;
    const zeile = bl.closest('.task');
    const setze = (v) => { aendereOp('kosten.json', { liste: 'buchungen', ids: [id], felder: { storniert: v } }, v ? 'Ausgabe gelöscht' : 'Ausgabe wiederhergestellt').catch(() => {}); if (!v) merkeNeu(id); render(); };
    const weg = () => { setze(true); toast('Ausgabe gelöscht', { label: 'Rückgängig', fn: () => setze(false) }); };
    if (zeile.classList.contains('weg')) { weg(); return; }
    zeile.classList.add('weg');
    haptik();
    rausfahren(zeile).then(weg);
    return;
  }
  const b = e.target.closest('[data-buchung]');
  if (b && b.classList.contains('task')) {
    if (W.eben()) return;
    if (W.offen()) { W.zu(); return; }
  }
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
// Solange ein Blatt offen ist, scrollt nichts dahinter mit
document.addEventListener('touchmove', (e) => {
  if (!offenesBlatt) return;
  const b = $(offenesBlatt);
  if (!(b.contains(e.target) && b.scrollHeight > b.clientHeight + 1)) e.preventDefault();
}, { passive: false });
function schliesse() {
  if (!offenesBlatt) return;
  $(offenesBlatt).classList.remove('an');
  $('schleier').classList.remove('an');
  offenesBlatt = null;
  document.activeElement?.blur();
}
$('schleier').onclick = schliesse;
document.querySelectorAll('[data-zu]').forEach((b) => { b.onclick = schliesse; });

// Blatt nach unten wegwischen: folgt dem Finger, ein kurzer Wisch reicht, nach oben gibt es nur zäh nach.
for (const bl of document.querySelectorAll('.blatt')) {
  let z = null;
  const schl = $('schleier');
  bl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { z = null; return; }
    const t = e.touches[0];
    z = { x: t.clientX, y: t.clientY, aktiv: false, dy: 0, spur: [], kopf: !!e.target.closest('.griff, .kopfzeile') };
  }, { passive: true });
  bl.addEventListener('touchmove', (e) => {
    if (!z) return;
    const t = e.touches[0];
    const dx = t.clientX - z.x;
    const dy = t.clientY - z.y;
    if (!z.aktiv) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { z = null; return; } // Chips seitlich scrollen
      if (Math.abs(dy) < 6) return;
      if (!(dy > 0 && (z.kopf || bl.scrollTop <= 0))) { z = null; return; } // sonst normal scrollen
      z.aktiv = true;
      z.y = t.clientY;
      bl.classList.add('zieht');
      schl.style.transition = 'none';
    }
    e.preventDefault();
    let d = t.clientY - z.y;
    if (d < 0) d = -((-d) ** 0.7); // Gummiband nach oben
    z.dy = d;
    bl.style.transform = `translateY(${d}px)`;
    schl.style.opacity = String(Math.max(0, 1 - d / (bl.offsetHeight || 400)));
    z.spur.push([e.timeStamp, t.clientY]);
    if (z.spur.length > 6) z.spur.shift();
  }, { passive: false });
  const ende = () => {
    if (!z) return;
    const x = z;
    z = null;
    if (!x.aktiv) return;
    const [a, b] = [x.spur[0], x.spur[x.spur.length - 1]];
    const v = a && b && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0;
    bl.classList.remove('zieht');
    bl.style.transform = '';
    schl.style.transition = '';
    schl.style.opacity = '';
    if (x.dy > Math.min(140, bl.offsetHeight * 0.3) || (v > 0.4 && x.dy > 24)) schliesse();
  };
  bl.addEventListener('touchend', ende);
  bl.addEventListener('touchcancel', ende);
}

let wahl = null;
let kostenId = null;
function katwahl() {
  $('katwahl').innerHTML = kats().map((k) => `<button style="--c:${k.farbe}" data-k="${esc(k.name)}" class="${k.name === wahl ? 'an' : ''}"><span class="symbol" style="background:${k.farbe}">${icon(katSymbol(k.name, k.symbol), 17, 2.2)}</span>${esc(k.name)}</button>`).join('');
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
    merkeNeu(b.id);
    toast(`${euro(betrag)} · ${wahl}`);
  }
  schliesse();
  render();
};
$('kosten-loeschen').onclick = () => {
  const id = kostenId;
  const setze = (v) => { aendereOp('kosten.json', { liste: 'buchungen', ids: [id], felder: { storniert: v } }, v ? 'Ausgabe gelöscht' : 'Ausgabe wiederhergestellt').catch(() => {}); if (!v) merkeNeu(id); render(); };
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
    if (!bereit) { bereit = true; if (!offenesBlatt) render(); }
    if (erst) await routine();
    geladen = true;
    if (offenNachzureichen()) { const n = await nachholen(); if (n) toast(`${n} ${n === 1 ? 'Änderung' : 'Änderungen'} nachgereicht`); }
  } catch (e) {
    bereit = true;
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
bereit = ausCache(DATEIEN);
zeigeTab();
await laden(true);
wetter();
starteZyklus(() => laden(), 60);
starteZyklus(wetter, 900);
addEventListener('online', () => laden());
starteZyklus(() => routine().then(() => { if (geladen && !offenesBlatt) render(); }), 1800);



/* ---------- Hintergrund: gleiche Szene wie am Panel, aber ruhig ---------- */
let wetterCode = 0;
const szene = erstelleSzene(document.getElementById('szene'));
szene.bewegung(false);
function szeneTakt() {
  const st = panelEinst().hintergrund;
  szene.setzeStil(st === 'fotos' ? 'landschaft' : st);
  szene.aktualisiere(szenenDatum(), panelEinst().wetterSzene === false ? 0 : wetterCode);
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
