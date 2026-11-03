import { F, ladeAlle, ladeDatei, aendere, routine, beiFehler, FehlerToken } from '../shared/core.js';
import { offene, metaText, titelHtml, farbeVon, istHeute, termineAm, modulFarbe } from '../shared/tasks.js';
import { uebersicht } from '../shared/finance.js';
import { holeWetter, wetterHtml, starteZyklus, haltWachen, toast } from '../shared/app.js';
import { icon } from '../shared/icons.js';
import { WT_LANG, MON_LANG, isoWeek, clockText, isoDate, esc, euro, hexRgba } from '../shared/util.js';

const $ = (id) => document.getElementById(id);
const DATEIEN = ['einstellungen.json', 'regeln.json', 'aufgaben.json', 'termine.json', 'kosten.json', 'kategorien.json', 'dauerkosten.json'];
let tagGeladen = '';

$('einst').innerHTML = icon('regler', 16) + 'Einstellungen';
beiFehler((e) => toast(e instanceof FehlerToken ? e.message : 'Speichern fehlgeschlagen'));

function uhr() {
  const d = new Date();
  $('uhr').textContent = clockText(d);
  $('wt').textContent = WT_LANG[d.getDay()];
  $('dt').textContent = `${d.getDate()}. ${MON_LANG[d.getMonth()]}`;
  $('kw').textContent = `KW ${isoWeek(d)}`;
  const h = d.getHours();
  document.body.classList.toggle('nacht', h >= 23 || h < 6);
}

function status(art, text) {
  $('sync').innerHTML = `<span class="punktstatus ${art}"></span>${esc(text)}`;
}

function zeileHtml(a) {
  const c = farbeVon(a);
  const meta = metaText(a);
  return `<div class="task${istHeute(a) ? ' heute' : ''}" data-id="${esc(a.id)}" style="--c:${c}">
    <span class="kreis">${icon('check', 18, 3)}</span>
    <span class="titel">${titelHtml(a, esc)}</span>${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</div>`;
}

// Zeigt so viele Zeilen, wie in die Karte passen, und darunter „+ n weitere“.
function einpassen(box, gesamt) {
  const rows = [...box.querySelectorAll('.task')];
  if (!rows.length) return;
  const max = box.clientHeight - 34;
  let sichtbar = rows.length;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].offsetTop - box.offsetTop + rows[i].offsetHeight > (i === rows.length - 1 ? box.clientHeight : max)) { sichtbar = i; break; }
  }
  rows.slice(sichtbar).forEach((r) => r.remove());
  if (sichtbar < gesamt) box.insertAdjacentHTML('beforeend', `<div class="mehr">+ ${gesamt - sichtbar} weitere</div>`);
}

function liste(name) {
  const box = $(name);
  const auf = offene(F['aufgaben.json']?.aufgaben || [], name);
  $(`n-${name}`).textContent = auf.length ? `${auf.length} offen` : '';
  if (!auf.length) {
    box.innerHTML = `<div class="leer">${icon('check', 34, 2.5)}<span>Alles erledigt</span></div>`;
    return;
  }
  box.innerHTML = auf.map(zeileHtml).join('');
  einpassen(box, auf.length);
}

function termine() {
  const e = F['einstellungen.json'];
  const regeln = F['regeln.json']?.regeln || [];
  const kal = F['termine.json']?.termine || [];
  if (!e?.semester) return;
  const jetzt = new Date();
  let tag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  let liste = termineAm(tag, e, regeln, kal);
  const jetztZeit = clockText(jetzt);
  let titel = 'Heute';
  if (jetzt.getHours() >= 18 && !liste.some((t) => t.zeit >= jetztZeit)) {
    tag = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate() + 1);
    liste = termineAm(tag, e, regeln, kal);
    titel = 'Morgen';
  }
  $('heute-titel').textContent = titel;
  if (!liste.length) {
    $('termine').innerHTML = '<div class="termin vorbei"><span class="t">Keine Termine</span></div>';
    return;
  }
  $('termine').innerHTML = liste.map((t) => {
    const vorbei = titel === 'Heute' && t.zeit && t.zeit < jetztZeit && !t.kalender ? ' vorbei' : '';
    const c = t.kalender ? '#FF9F0A' : modulFarbe(t.modul);
    return `<div class="termin${vorbei}" style="--c:${c}"><span class="zeit">${esc(t.zeit || 'ganzt.')}</span><span class="punkt"></span><span class="t">${esc(t.titel)}</span></div>`;
  }).join('');
}

function shortcutUrl(name) {
  const zurueck = encodeURIComponent(location.href.split('#')[0]);
  return `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(name)}&x-success=${zurueck}&x-cancel=${zurueck}&x-error=${zurueck}`;
}

function licht() {
  const knoepfe = F['einstellungen.json']?.licht || [];
  $('licht').innerHTML = knoepfe.map((k, i) => {
    const c = k.farbe || '#FFD60A';
    const breit = knoepfe.length % 2 === 1 && i === knoepfe.length - 1 ? ' breit' : '';
    return `<a class="lb${breit}" href="${esc(shortcutUrl(k.kurzbefehl || k.name))}" style="background:${hexRgba(c, 0.2)};border:1px solid ${hexRgba(c, 0.28)}">
      <span class="knopf" style="background:${c}">${icon(k.symbol || 'lampe', 24, 2.2)}</span><span class="name">${esc(k.name)}</span></a>`;
  }).join('');
}

function budget() {
  const kats = F['kategorien.json']?.kategorien;
  if (!kats?.length || !F['kosten.json']) { $('budget').textContent = ''; return; }
  const u = uebersicht(F['kosten.json'], kats, F['einstellungen.json'], 'monat');
  $('budget').innerHTML = u.rest >= 0
    ? `Budget heute <b>${euro(u.restTag)}</b> · ${euro(u.rest)} übrig im Monat`
    : `<b style="color:#FF453A">${euro(-u.rest)} über Budget</b>`;
}

function alles() {
  liste('studium');
  liste('leben');
  termine();
  licht();
  budget();
}

async function laden(dateien = DATEIEN) {
  try {
    await ladeAlle(dateien);
    $('hinweis').style.display = 'none';
    const h = isoDate(new Date());
    if (tagGeladen !== h || dateien === DATEIEN) { tagGeladen = h; await routine(); }
    status('ok', 'Aktuell ' + clockText(new Date()));
  } catch (e) {
    if (e instanceof FehlerToken) { $('hinweis').style.display = 'grid'; status('bad', 'Nicht verbunden'); return; }
    status('warn', 'Offline');
  }
  alles();
}

async function wetter() {
  try { $('wetter').innerHTML = wetterHtml(await holeWetter(F['einstellungen.json']), 28); } catch { /* alter Stand bleibt */ }
}

$('studium').parentElement.parentElement.addEventListener('click', abhaken);
function abhaken(ev) {
  const row = ev.target.closest('.task');
  if (!row || row.classList.contains('fertig')) return;
  const id = row.dataset.id;
  row.classList.add('fertig');
  const jetzt = new Date().toISOString();
  setTimeout(() => {
    aendere('aufgaben.json', (d) => {
      const a = d.aufgaben.find((x) => x.id === id);
      if (a) { a.status = 'erledigt'; a.erledigt = jetzt; }
      return d;
    }, 'Abgehakt').catch(() => {});
    alles();
    const a = F['aufgaben.json'].aufgaben.find((x) => x.id === id);
    toast(`„${a ? a.titel : 'Aufgabe'}“ erledigt`, { label: 'Rückgängig', fn: () => {
      aendere('aufgaben.json', (d) => {
        const b = d.aufgaben.find((x) => x.id === id);
        if (b) { b.status = 'offen'; b.erledigt = null; }
        return d;
      }, 'Rückgängig').catch(() => {});
      alles();
    } }, 6000);
  }, 450);
}

uhr();
setInterval(uhr, 5000);
await laden();
wetter();
haltWachen();
starteZyklus(() => laden(['aufgaben.json', 'einstellungen.json', 'termine.json']), 45);
starteZyklus(() => laden(), 300);
starteZyklus(wetter, 900);
let breite = innerWidth;
addEventListener('resize', () => { if (innerWidth !== breite) { breite = innerWidth; alles(); } });
