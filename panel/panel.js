import { F, ladeAlle, aendereOp, nachholen, offenNachzureichen, beiOffline, routine, beiFehler, FehlerToken, panelEinst, lichtModi } from '../shared/core.js';
import { module as modulListe, kwVon, erzeugen, offene, metaText, titelHtml, farbeVon, farbStil, istHeute, ueberfaellig, termineAm, modulFarbe, badgeHtml } from '../shared/tasks.js';
import { uebersicht, status as budgetStatus } from '../shared/finance.js';
import { holeWetter, starteZyklus, haltWachen, toast } from '../shared/app.js';
import { icon, wetterSymbol } from '../shared/icons.js';
import { erstelleSzene } from '../shared/scene.js';
import { ordner, rohdatei } from '../shared/github.js';
import { uid, isoZeit, WT_LANG, MON_LANG, isoWeek, clockText, isoDate, esc, euro, euro0, hexRgba, kwKey, montag, addDays, fmtDM } from '../shared/util.js';

const $ = (id) => document.getElementById(id);
const DATEIEN = ['einstellungen.json', 'regeln.json', 'aufgaben.json', 'einkauf.json', 'termine.json', 'kosten.json', 'kategorien.json', 'dauerkosten.json'];
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } },
};

const szene = erstelleSzene($('szene'));
let wetter = null;
let seite = 0;
let letzteBeruehrung = Date.now();
let wachBis = 0;
let nacht = false;
let tagGeladen = '';
let fotoListe = '';

beiFehler((e) => toast(e instanceof FehlerToken ? e.message : 'Speichern fehlgeschlagen'));
beiOffline(() => toast('Offline gespeichert, wird nachgereicht'));
$('einst').innerHTML = icon('regler', 18);
$('ic-studium').innerHTML = icon('kappe', 16, 2.2);
$('ic-studium').style.setProperty('--ic', 'linear-gradient(160deg, #4aa8ff, #1f6fe0)');
$('ic-leben').innerHTML = icon('haus', 16, 2.2);
$('ic-leben').style.setProperty('--ic', 'linear-gradient(160deg, #a3a1ff, #6461f0)');
$('ic-licht').innerHTML = icon('lampe', 16, 2.2);
$('ic-licht').style.setProperty('--ic', 'linear-gradient(160deg, #ffd84d, #ffaa00)');
$('ic-einkauf').innerHTML = icon('wagen', 16, 2.2);
$('ic-einkauf').style.setProperty('--ic', 'linear-gradient(160deg, #ffb340, #ff8a00)');
document.querySelectorAll('.plus-k').forEach((b) => { b.innerHTML = icon('plus', 18, 2.6); });

/* ---------- Seiten und Gesten ---------- */
function zeige(i, sofort = false) {
  seite = Math.max(0, Math.min(2, i));
  const s = $('seiten');
  if (sofort) { s.style.transition = 'none'; requestAnimationFrame(() => { s.style.transition = ''; }); }
  s.style.transform = `translate3d(${-seite * 33.3333}%, 0, 0)`;
  document.querySelectorAll('#punkte button').forEach((b, k) => b.classList.toggle('an', k === seite));
}
let start = null;
let gewischt = 0;
$('app').addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
$('app').addEventListener('pointerup', (e) => {
  if (!start) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  start = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.3) { gewischt = Date.now(); zeige(seite + (dx < 0 ? 1 : -1)); }
});
document.addEventListener('click', (e) => {
  if (Date.now() - gewischt < 350) { e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener('pointerdown', () => {
  letzteBeruehrung = Date.now();
  if (nacht) {
    wachBis = Date.now() + 90000;
    if (!document.body.classList.contains('nacht-wach')) { document.body.classList.add('nacht-wach'); document.body.classList.remove('nachtmodus'); zeige(0); }
  }
}, true);
document.querySelectorAll('[data-seite]').forEach((b) => b.addEventListener('click', () => zeige(Number(b.dataset.seite))));

/* ---------- Zeit, Nacht, Einbrennschutz ---------- */
const minuten = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
function istNacht(d, p) {
  const jetzt = d.getHours() * 60 + d.getMinutes();
  const von = minuten(p.nachtVon);
  const bis = minuten(p.nachtBis);
  return von > bis ? jetzt >= von || jetzt < bis : jetzt >= von && jetzt < bis;
}
let letzteUhr = '';
function takt() {
  const d = new Date();
  const u = clockText(d);
  if (u !== letzteUhr) {
    letzteUhr = u;
    $('uhr').textContent = u;
    $('r-uhr').textContent = u;
    $('datum').innerHTML = `${WT_LANG[d.getDay()]}, ${d.getDate()}. ${MON_LANG[d.getMonth()]}<span class="kw">KW ${isoWeek(d)}</span>`;
    $('r-datum').textContent = `${WT_LANG[d.getDay()]}, ${d.getDate()}. ${MON_LANG[d.getMonth()]}`;
  }
  const p = panelEinst();
  const n = istNacht(d, p);
  if (n !== nacht) {
    nacht = n;
    document.body.classList.toggle('nachtmodus', n);
    document.body.classList.remove('nacht-wach');
    szene.bewegung(!n && p.bewegung);
    zeige(n ? 2 : 0);
  }
  if (nacht && wachBis && Date.now() > wachBis) {
    wachBis = 0;
    document.body.classList.remove('nacht-wach');
    document.body.classList.add('nachtmodus');
    zeige(2);
  }
  if (!nacht && seite !== 0 && Date.now() - letzteBeruehrung > 90000) zeige(0);
}
function pixelVersatz() {
  const x = Math.round((Math.random() - 0.5) * 10);
  const y = Math.round(Math.random() * 6);
  $('app').style.transform = `translate(${x}px, ${y}px)`;
}

/* ---------- Aufgaben ---------- */
function zeileHtml(a) {
  const ueber = ueberfaellig(a);
  const meta = ueber ? (a.faellig ? fmtDM(a.faellig) : kwVon(a) ? metaText(a) : fmtDM(a.datum)) : metaText(a);
  const heute = !ueber && istHeute(a) && meta !== '';
  return `<div class="task${heute ? ' heute' : ''}${ueber ? ' ueber' : ''}" data-id="${esc(a.id)}" style="${farbStil(farbeVon(a))}">
    <span class="kreis">${icon('check', 16, 3.2)}</span><span class="titel">${titelHtml(a)}</span>${meta ? `<span class="meta">${esc(heute ? 'Heute' : meta)}</span>` : ''}</div>`;
}
function einpassen(box, gesamt) {
  const rows = [...box.querySelectorAll('.task')];
  if (!rows.length) return;
  const reserve = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.6;
  const top = box.getBoundingClientRect().top;
  let sichtbar = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const unten = rows[i].getBoundingClientRect().bottom - top;
    const grenze = i === rows.length - 1 ? box.clientHeight : box.clientHeight - reserve;
    if (unten > grenze + 1) { sichtbar = i; break; }
  }
  rows.slice(sichtbar).forEach((r) => r.remove());
  if (sichtbar < gesamt) box.insertAdjacentHTML('beforeend', `<div class="mehr">+ ${gesamt - sichtbar} weitere</div>`);
}
function kuerzlichErledigt(name) {
  const grenze = Date.now() - 48 * 3600 * 1000;
  return (F['aufgaben.json']?.aufgaben || [])
    .filter((a) => a.liste === name && a.status === 'erledigt' && a.erledigt && !a.erledigt.endsWith('T12:00:00') && new Date(a.erledigt).getTime() >= grenze)
    .sort((x, y) => y.erledigt.localeCompare(x.erledigt));
}
function liste(name) {
  const box = $(name);
  const auf = offene(F['aufgaben.json']?.aufgaben || [], name);
  const erl = kuerzlichErledigt(name);
  $(`n-${name}`).textContent = auf.length ? String(auf.length) : '';
  if (!auf.length && !erl.length) { box.innerHTML = `<div class="leer">${icon('check', 38, 2.4)}<span>Alles erledigt</span></div>`; return; }
  const alt = box.scrollTop;
  box.innerHTML = auf.map(zeileHtml).join('') + erl.map((a) => zeileHtml(a).replace('class="task', 'class="task erledigt')).join('');
  box.scrollTop = alt;
}
$('app').addEventListener('click', (e) => {
  const row = e.target.closest('.task');
  if (!row || row.classList.contains('fertig')) return;
  const id = row.dataset.id;
  if (row.classList.contains('erledigt')) {
    aendereOp('aufgaben.json', { liste: 'aufgaben', ids: [id], felder: { status: 'offen', erledigt: null } }, 'Rückgängig').catch(() => {});
    listen();
    return;
  }
  row.classList.add('fertig');
  const zeit = new Date().toISOString();
  setTimeout(() => {
    const setze = (offen) => aendereOp('aufgaben.json', { liste: 'aufgaben', ids: [id], felder: { status: offen ? 'offen' : 'erledigt', erledigt: offen ? null : zeit } }, offen ? 'Rückgängig' : 'Abgehakt').catch(() => {});
    setze(false);
    listen();
    const a = F['aufgaben.json'].aufgaben.find((x) => x.id === id);
    toast(`${a ? a.titel : 'Aufgabe'} erledigt`, { label: 'Rückgängig', fn: () => { setze(true); listen(); } }, 6000);
  }, 420);
});
function listen() { liste('studium'); liste('leben'); }

/* ---------- Licht ---------- */
function shortcutUrl(name) {
  // Ohne Rücksprung-URL: Die würde in Safari statt in der Web-App landen.
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}
function kachel(m, i, gross) {
  const c = m.farbe || '#FFD60A';
  return `<a class="kachel" data-licht="${i}" href="${esc(shortcutUrl(m.kurzbefehl || m.name))}">
    <span class="k-ic" style="--c:${c};--glow:${hexRgba(c, 0.45)}">${icon(m.symbol || 'lampe', 22, 2.2)}</span>
    ${gross && m.favorit ? `<span class="stern-mark">${icon('stern', 16, 2.2)}</span>` : ''}
    <span class="k-text"><span class="k-name">${esc(m.name)}</span></span></a>`;
}
function licht() {
  const modi = lichtModi();
  let fav = modi.map((m, i) => [m, i]).filter(([m]) => m.favorit);
  if (!fav.length) fav = modi.map((m, i) => [m, i]);
  $('licht-fav').innerHTML = fav.slice(0, 4).map(([m, i]) => kachel(m, i, false)).join('');
  $('n-licht').textContent = modi.length > 4 ? `(${modi.length})` : '';
  $('licht-alle').innerHTML = modi.map((m, i) => kachel(m, i, true)).join('');
  $('licht-zuletzt').textContent = '';
}
document.addEventListener('click', (e) => {
  const k = e.target.closest('[data-licht]');
  if (!k) return;
  const m = lichtModi()[Number(k.dataset.licht)];
  if (!m) return;
  setTimeout(() => { if (seite === 1) zeige(0); }, 300);
});

/* ---------- Wetter ---------- */
function wetterKurz() {
  if (!wetter) return;
  const w = wetter;
  $('wetter-kurz').innerHTML = `${icon(wetterSymbol(w.code, !w.tag), 22, 2)}<span>${w.temperatur}° ${esc(w.zustand)}</span>${w.max != null ? `<span class="hl">H ${w.max}° T ${w.min}°</span>` : ''}`;
  const e = w.empfehlung;
  const k = $('kleidung');
  k.hidden = !e;
  if (e) k.innerHTML = `${icon('shirt', 20, 2)}<span>${w.morgen ? 'Morgen: ' : ''}${esc(e.kleidung)}${e.schirm ? ' · Schirm' : ''}</span>`;
}
async function ladeWetter() {
  try { wetter = await holeWetter(F['einstellungen.json']); } catch { return; }
  wetterKurz();
  szenenTakt();
  stapelRendern();
  ruheInfo();
}
function szenenTakt() { szene.aktualisiere(new Date(), wetter ? wetter.code : 0); }

/* ---------- Smart Stack ---------- */
function termineKarte() {
  const e = F['einstellungen.json'];
  if (!e?.semester) return null;
  const regeln = F['regeln.json']?.regeln || [];
  const kal = F['termine.json']?.termine || [];
  const jetzt = new Date();
  const jz = clockText(jetzt);
  let tag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  let alle = termineAm(tag, e, regeln, kal);
  let kommend = alle.filter((t) => !t.zeit || t.zeit >= jz);
  let label = 'Heute';
  if (!kommend.length) {
    for (let i = 1; i <= 7; i++) {
      tag = addDays(tag, 1);
      alle = termineAm(tag, e, regeln, kal);
      if (alle.length) { kommend = alle; label = i === 1 ? 'Morgen' : WT_LANG[tag.getDay()]; break; }
    }
  }
  const lc = '#ff9f0a';
  if (!kommend.length) {
    return `<div class="k-label" style="--lc:${lc}">${icon('kalender', 16, 2.2)}Termine</div><div class="k-gross">Keine Termine</div><div class="k-zeit">Diese Woche ist nichts mehr geplant.</div>`;
  }
  const n = kommend[0];
  let bis = '';
  if (label === 'Heute' && n.zeit) {
    const diff = minuten(n.zeit) - (jetzt.getHours() * 60 + jetzt.getMinutes());
    bis = diff <= 0 ? 'jetzt' : diff < 60 ? `in ${diff} Min.` : `in ${Math.floor(diff / 60)} Std.${diff % 60 ? ` ${diff % 60} Min.` : ''}`;
  }
  const titel = n.modul ? `${badgeHtml(n.modul)}<span>${esc(n.titel.slice(n.modul.length).trim())}</span>` : `<span>${esc(n.titel)}</span>`;
  const rest = kommend.slice(1, 4).map((t) => `<div class="k-zeile" style="--c:${t.kalender ? lc : modulFarbe(t.modul)}"><span class="z">${esc(t.zeit || 'ganzt.')}</span><span class="p"></span><span class="t">${esc(t.titel)}</span></div>`).join('');
  return `<div class="k-label" style="--lc:${lc}">${icon('kalender', 16, 2.2)}${esc(label)}</div>
    <div class="k-gross">${titel}</div><div class="k-zeit"><b>${esc(n.zeit || 'Ganztägig')}</b>${bis ? ` · ${bis}` : ''}</div>
    <div class="k-liste">${rest}</div>`;
}
function wetterKarte() {
  if (!wetter) return null;
  const w = wetter;
  const nachtStunde = (z) => { const h = Number(z.slice(0, 2)); return h < 7 || h >= 17; };
  const stunden = w.verlauf.filter((_, i) => i % 2 === 0).slice(0, 6).map((h, i) => `<div><small>${i === 0 ? 'Jetzt' : h.zeit.slice(0, 2)}</small>${icon(wetterSymbol(h.code ?? w.code, nachtStunde(h.zeit)), 18, 2)}<span>${Math.round(h.temp)}°</span><span class="regen">${h.regen >= 30 ? `${h.regen} %` : ''}</span></div>`).join('');
  const e = w.empfehlung;
  const regenAb = w.verlauf.slice(1).find((h) => h.regen >= 40);
  const regenText = w.verlauf[0] && w.verlauf[0].regen >= 40 ? 'Gerade Regen möglich' : regenAb ? `Regen ab etwa ${regenAb.zeit.slice(0, 2)} Uhr (${regenAb.regen} %)` : '';
  return `<div class="k-label" style="--lc:#64d2ff">${icon('wolke-sonne', 16, 2.2)}Garching</div>
    <div class="w-reihe"><span class="w-temp">${w.temperatur}°</span>${icon(wetterSymbol(w.code, !w.tag), 40, 1.8)}
    <span class="w-zust">${esc(w.zustand)}${w.max != null ? `<small>H ${w.max}° · T ${w.min}°</small>` : ''}</span></div>
    ${e ? `<div class="k-zeit" style="margin-top:.7rem">${w.morgen ? 'Morgen' : 'Heute'}: <b>${esc(e.kleidung)}</b>${e.schirm ? ' · Schirm mitnehmen' : ''}</div>` : ''}
    ${regenText ? `<div class="k-zeit" style="color:#64d2ff;font-size:.9375rem">${esc(regenText)}</div>` : ''}
    <div class="stunden">${stunden}</div>`;
}
function budgetKarte() {
  const kats = F['kategorien.json']?.kategorien;
  if (!kats?.length || !F['kosten.json']) return null;
  const u = uebersicht(F['kosten.json'], kats, F['einstellungen.json'], 'monat');
  const anteil = u.budget ? Math.min(1, u.summe / u.budget) : 0;
  const st = budgetStatus(u.summe, u.budget);
  const farbe = st === 'bad' ? '#ff453a' : st === 'warn' ? '#ff9f0a' : '#30d158';
  const R = 30;
  const U = 2 * Math.PI * R;
  const ring = `<svg class="ring" viewBox="0 0 76 76" width="76" height="76" style="width:4.75rem;height:4.75rem"><circle cx="38" cy="38" r="${R}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="8"/>
    <circle cx="38" cy="38" r="${R}" fill="none" stroke="${farbe}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(anteil * U).toFixed(1)} ${U.toFixed(1)}" transform="rotate(-90 38 38)"/>
    <text x="38" y="43" text-anchor="middle">${Math.round(anteil * 100)}%</text></svg>`;
  const top = u.kats.filter((k) => k.wert > 0).sort((a, b) => b.wert - a.wert).slice(0, 3).map((k) =>
    `<div class="b-zeile" style="--c:${k.farbe}"><span class="name">${esc(k.name)}</span><span class="bar"><i style="width:${Math.min(100, k.budget ? (k.wert / k.budget) * 100 : 100)}%"></i></span><span class="n">${euro0(k.wert)}</span></div>`).join('');
  const letzter = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const tage = letzter - new Date().getDate() + 1;
  return `<div class="k-label" style="--lc:#30d158">${icon('geldbeutel', 16, 2.2)}Budget</div>
    <div class="b-reihe"><div><div class="b-klein" style="margin:0">${u.rest >= 0 ? 'Heute verfügbar' : 'Über Budget'}</div><div class="b-gross" style="${u.rest < 0 ? 'color:#ff6b61' : ''}">${euro(u.rest >= 0 ? u.restTag : -u.rest)}</div>
    <div class="b-klein">${euro0(Math.max(0, u.rest))} übrig · noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'}</div></div>${ring}</div>
    <div class="b-fuss">${top}</div>`;
}
function wocheKarte() {
  const jetzt = new Date();
  const k = kwKey(jetzt);
  const mo = isoDate(montag(jetzt));
  const so = isoDate(addDays(montag(jetzt), 6));
  const alle = F['aufgaben.json']?.aufgaben || [];
  // Die komplette Woche: schon erzeugte Aufgaben plus die, die in den nächsten Tagen noch entstehen.
  const kommend = erzeugen(F['einstellungen.json'], F['regeln.json']?.regeln || [], alle, addDays(montag(jetzt), 6)).map((a) => ({ ...a, status: 'offen' }));
  const auf = [...alle, ...kommend].filter((a) => a.liste === 'studium' && a.regel && (a.kw ? a.kw === k : a.datum >= mo && a.datum <= so));
  if (!auf.length) return null;
  const fertig = auf.filter((a) => a.status === 'erledigt').length;
  const nachModul = {};
  auf.forEach((a) => { const m = nachModul[a.modul] || (nachModul[a.modul] = { g: 0, f: 0 }); m.g++; if (a.status === 'erledigt') m.f++; });
  const zeilen = Object.entries(nachModul).slice(0, 6).map(([m, v]) =>
    `<div class="b-zeile" style="--c:${modulFarbe(m)}"><span class="name" style="width:3.2rem">${badgeHtml(m)}</span><span class="bar"><i style="width:${(v.f / v.g) * 100}%"></i></span><span class="n" style="width:2.6rem">${v.f}/${v.g}</span></div>`).join('');
  return `<div class="k-label" style="--lc:#d98cff">${icon('kappe', 16, 2.2)}Woche · KW ${isoWeek(jetzt)}</div>
    <div class="k-gross">${fertig} von ${auf.length} erledigt</div><div class="b-fuss" style="margin-top:auto">${zeilen}</div>`;
}
let stapelIndex = 0;
let stapelPause = 0;
let stapelIds = [];
function stapelRendern() {
  const h = new Date().getHours();
  const karten = { termine: termineKarte(), wetter: wetterKarte(), budget: budgetKarte(), woche: wocheKarte() };
  const reihenfolge = h < 10 ? ['wetter', 'termine', 'woche', 'budget'] : h < 18 ? ['termine', 'wetter', 'woche', 'budget'] : ['termine', 'budget', 'woche', 'wetter'];
  const ids = reihenfolge.filter((id) => karten[id]);
  const aktuell = stapelIds[stapelIndex];
  if (ids.join() !== stapelIds.join()) stapelIndex = ids.length !== stapelIds.length ? 0 : Math.max(0, ids.indexOf(aktuell));
  stapelIds = ids;
  $('stapel-karten').innerHTML = ids.map((id, i) => `<div class="karte${i === stapelIndex ? ' an' : ''}">${karten[id]}</div>`).join('');
  $('stapel-punkte').innerHTML = ids.length > 1 ? ids.map((_, i) => `<i class="${i === stapelIndex ? 'an' : ''}"></i>`).join('') : '';
}
function stapelWeiter() {
  if (!stapelIds.length) return;
  stapelIndex = (stapelIndex + 1) % stapelIds.length;
  document.querySelectorAll('#stapel-karten .karte').forEach((k, i) => k.classList.toggle('an', i === stapelIndex));
  document.querySelectorAll('#stapel-punkte i').forEach((k, i) => k.classList.toggle('an', i === stapelIndex));
}
$('stapel').addEventListener('click', () => { stapelPause = Date.now() + 45000; stapelWeiter(); });
setInterval(() => { if (panelEinst().stapelAuto === true && Date.now() > stapelPause && !nacht && seite === 0) stapelWeiter(); }, 14000);

/* ---------- Ruhe-Zifferblatt ---------- */
function ruheInfo() {
  const teile = [];
  if (wetter) teile.push(`<span>${icon(wetterSymbol(wetter.code, !wetter.tag), 22, 2)}${wetter.temperatur}°${wetter.max != null ? ` · H ${wetter.max}° T ${wetter.min}°` : ''}</span>`);
  const e = F['einstellungen.json'];
  if (e?.semester) {
    const jetzt = new Date();
    const morgen = jetzt.getHours() >= 15 || jetzt.getHours() < 5;
    let tag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    if (morgen && jetzt.getHours() >= 15) tag = addDays(tag, 1);
    const t = termineAm(tag, e, F['regeln.json']?.regeln || [], F['termine.json']?.termine || []).filter((x) => morgen || !x.zeit || x.zeit >= clockText(jetzt))[0];
    if (t) teile.push(`<span>${icon('kalender', 22, 2)}${morgen ? (jetzt.getHours() >= 15 ? 'Morgen ' : 'Heute ') : ''}${esc(t.zeit)} ${esc(t.titel)}</span>`);
  }
  if (wetter?.empfehlung && (wetter.morgen || new Date().getHours() < 10)) teile.push(`<span>${icon('shirt', 22, 2)}${esc(wetter.empfehlung.kleidung)}${wetter.empfehlung.schirm ? ' · Schirm' : ''}</span>`);
  $('r-info').innerHTML = teile.join('');
}

/* ---------- Hintergrund ---------- */
const blobCache = {};
async function hintergrund() {
  const p = panelEinst();
  document.body.classList.toggle('ohne-glas', p.glas === false);
  szene.bewegung(!nacht && p.bewegung !== false);
  szene.setzeStil(p.hintergrund);
  if (p.hintergrund !== 'fotos') { if (fotoListe) { fotoListe = ''; szene.setzeFotos([]); } return; }
  try {
    const dateien = (await ordner('bilder')).filter((d) => /\.(jpe?g|png|webp|heic)$/i.test(d.name));
    const key = dateien.map((d) => d.sha).join();
    if (key === fotoListe) return;
    fotoListe = key;
    const urls = [];
    for (const d of dateien) {
      if (!blobCache[d.sha]) blobCache[d.sha] = URL.createObjectURL(await rohdatei(d.path));
      urls.push(blobCache[d.sha]);
    }
    szene.setzeFotos(urls, p.fotoMinuten || 15);
  } catch { /* Landschaft bleibt */ }
}

/* ---------- Laden ---------- */
function status(art, text) {
  const el = $('status');
  el.hidden = !art;
  el.className = `ecke links status${art === 'bad' ? ' bad' : ''}`;
  if (art) el.innerHTML = `<i></i>${esc(text)}`;
}
function alles() {
  listen();
  einkaufVorschau();
  licht();
  stapelRendern();
  ruheInfo();
}
async function laden(dateien = DATEIEN) {
  try {
    await ladeAlle(dateien);
    $('hinweis').style.display = 'none';
    const h = isoDate(new Date());
    if (tagGeladen !== h || dateien === DATEIEN) { tagGeladen = h; await routine(); }
    if (offenNachzureichen()) await nachholen();
    status(null);
  } catch (e) {
    if (e instanceof FehlerToken) { $('hinweis').style.display = 'grid'; status('bad', 'Nicht verbunden'); return; }
    status('warn', 'Offline · zeige letzten Stand');
  }
  alles();
}

zeige(0, true);
takt();
szenenTakt();
setInterval(takt, 1000);
setInterval(pixelVersatz, 180000);
await laden();
hintergrund();
ladeWetter();
haltWachen();
starteZyklus(() => laden(['aufgaben.json', 'einkauf.json', 'einstellungen.json', 'termine.json']).then(hintergrund), 45);
starteZyklus(() => { laden(); hintergrund(); }, 300);
starteZyklus(ladeWetter, 900);
starteZyklus(() => { szenenTakt(); stapelRendern(); ruheInfo(); }, 60);
let breite = innerWidth;
addEventListener('resize', () => { if (innerWidth !== breite) { breite = innerWidth; listen(); } });

// iPadOS verschiebt manchmal die Ansicht; immer zurück nach oben links.
{
  const zurueck = () => { if (scrollY || scrollX) scrollTo(0, 0); };
  ['resize', 'orientationchange', 'pageshow', 'scroll'].forEach((n) => addEventListener(n, zurueck, { passive: true }));
  document.addEventListener('visibilitychange', zurueck);
}

// Diagnose: dreimal schnell auf das Datum tippen zeigt Fenstermaße.
{
  let taps = [];
  let box = null;
  const info = () => {
    const v = window.visualViewport || {};
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99;background:rgba(0,0,0,.85);color:#fff;font:16px/1.5 ui-monospace,monospace;padding:16px 20px;border-radius:14px;white-space:pre';
    const sa = document.createElement('div');
    sa.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(sa);
    const c = getComputedStyle(sa);
    t.textContent = `inner ${innerWidth}x${innerHeight}\nscreen ${screen.width}x${screen.height}\nvv ${Math.round(v.width)}x${Math.round(v.height)} off ${Math.round(v.offsetLeft)},${Math.round(v.offsetTop)} page ${Math.round(v.pageLeft)},${Math.round(v.pageTop)}\nscroll ${scrollX},${scrollY}\nsafe T${c.paddingTop} R${c.paddingRight} B${c.paddingBottom} L${c.paddingLeft}\nstandalone ${navigator.standalone}`;
    sa.remove();
    t.onclick = () => t.remove();
    document.body.appendChild(t);
  };
  window.addEventListener('pointerup', (e) => {
    if (!e.target.closest || !e.target.closest('.sperr')) return;
    const n = Date.now();
    taps = taps.filter((x) => n - x < 900).concat(n);
    if (taps.length >= 3) { taps = []; info(); }
  });
}


/* ---------- Dialoge: Aufgabe hinzufügen, Einkaufsliste ---------- */
const dlg = $('dialog');
let dlgArt = null;
let dlgZeit = 0;
function dialogAuf(html, art) {
  dlg.innerHTML = html;
  dlgArt = art;
  dlgZeit = Date.now();
  document.body.classList.add('dialog-an');
  const f = dlg.querySelector('.d-feld');
  if (f) setTimeout(() => f.focus(), 60);
}
function dialogZu() {
  document.body.classList.remove('dialog-an');
  dlgArt = null;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
$('dialog-schleier').addEventListener('click', dialogZu);
setInterval(() => { if (dlgArt && Date.now() - dlgZeit > 120000) dialogZu(); }, 5000);
dlg.addEventListener('pointerdown', () => { dlgZeit = Date.now(); });
dlg.addEventListener('input', () => { dlgZeit = Date.now(); });

function kopf(titel) {
  return `<div class="d-kopf"><b>${esc(titel)}</b><button class="d-zu" data-zu aria-label="Schließen">${icon('x', 18, 2.4)}</button></div>`;
}
function aufgabeDialog(listeName) {
  const st = listeName === 'studium';
  const mods = Object.keys(modulListe());
  const chips = (name, opts, wahl) => `<div class="d-chips">${opts.map(([v, t]) => `<button class="d-chip${wahl === v ? ' an' : ''}" data-${name}="${esc(v)}">${esc(t)}</button>`).join('')}</div>`;
  const zeichne = () => {
    const a = dlgArt;
    dlg.innerHTML = `${kopf(st ? 'Neue Aufgabe · Studium' : 'Neue Aufgabe · Leben')}
      <input class="d-feld" id="d-titel" placeholder="Was ist zu tun?" enterkeyhint="done" autocomplete="off" value="${esc(a.titel)}">
      ${st ? `<div class="d-label">Modul</div>${chips('modul', [['', 'Keins'], ...mods.map((m) => [m, m])], a.modul)}` : ''}
      <div class="d-label">Fällig</div>${chips('faellig', [['', 'Ohne Datum'], ['heute', 'Heute'], ['morgen', 'Morgen']], a.faellig)}
      <button class="d-ok" id="d-ok" ${a.titel.trim() ? '' : 'disabled'}>Hinzufügen</button>`;
  };
  dialogAuf('', { typ: 'aufgabe', liste: listeName, titel: '', modul: '', faellig: '', zeichne });
  zeichne();
  setTimeout(() => $('d-titel') && $('d-titel').focus(), 60);
}
function aufgabeSpeichern() {
  const a = dlgArt;
  const titel = a.titel.trim();
  if (!titel) return;
  const neu = { id: uid('a'), liste: a.liste, titel, status: 'offen', erstellt: isoZeit(new Date()), erledigt: null };
  if (a.liste === 'studium' && a.modul) neu.modul = a.modul;
  if (a.faellig) neu.faellig = isoDate(addDays(new Date(), a.faellig === 'morgen' ? 1 : 0));
  aendereOp('aufgaben.json', { liste: 'aufgaben', neu }, 'Neue Aufgabe').catch(() => {});
  dialogZu();
  listen();
  toast('Aufgabe hinzugefügt');
}

function einkaufArtikel() { return (F['einkauf.json']?.artikel || []).filter((a) => a.status !== 'archiv'); }
function einkaufVorschau() {
  const offen = einkaufArtikel().filter((a) => a.status === 'offen').sort((x, y) => (x.zeit || '').localeCompare(y.zeit || ''));
  $('n-einkauf').textContent = offen.length ? String(offen.length) : '';
  $('einkauf-vorschau').innerHTML = offen.length
    ? `<p>${offen.map((a) => esc(a.text)).join('<i>,</i> ')}</p>`
    : '<p class="leise">Liste ist leer</p>';
}
function einkaufDialog() {
  const offen = einkaufArtikel().filter((a) => a.status === 'offen').sort((x, y) => (x.zeit || '').localeCompare(y.zeit || ''));
  const erl = einkaufArtikel().filter((a) => a.status === 'erledigt').sort((x, y) => (y.erledigt || '').localeCompare(x.erledigt || ''));
  const zeile = (a) => `<button class="d-art${a.status === 'erledigt' ? ' erl' : ''}" data-art="${esc(a.id)}"><span class="kreis">${icon('check', 14, 3.2)}</span>${esc(a.text)}</button>`;
  const alt = dlg.querySelector('.d-feld');
  const text = alt ? alt.value : '';
  dlg.innerHTML = `${kopf('Einkauf')}
    <input class="d-feld" id="d-einkauf" placeholder="Artikel hinzufügen (mehrere mit Komma)" enterkeyhint="done" autocomplete="off" value="${esc(text)}">
    <div class="d-liste">${offen.length || erl.length ? offen.map(zeile).join('') + erl.map(zeile).join('') : '<div class="d-art" style="color:rgba(255,255,255,.5)">Liste ist leer</div>'}</div>
    ${erl.length ? '<button class="d-text-knopf" data-aufraeumen>Erledigte entfernen</button>' : ''}`;
  einkaufVorschau();
}
function einkaufOp(op, msg) {
  aendereOp('einkauf.json', { liste: 'artikel', ...op }, msg).catch(() => {});
  einkaufDialog();
}
$('einkauf-widget').addEventListener('click', () => { dialogAuf('', { typ: 'einkauf' }); einkaufDialog(); const f = $('d-einkauf'); if (f) f.focus(); });
document.addEventListener('click', (e) => {
  const neuBtn = e.target.closest('[data-neu]');
  if (neuBtn) { aufgabeDialog(neuBtn.dataset.neu); return; }
  if (!dlgArt || !dlg.contains(e.target)) return;
  if (e.target.closest('[data-zu]')) return dialogZu();
  if (dlgArt.typ === 'aufgabe') {
    const m = e.target.closest('[data-modul]');
    const f = e.target.closest('[data-faellig]');
    if (m) { dlgArt.modul = m.dataset.modul; dlgArt.zeichne(); $('d-titel').focus(); }
    else if (f) { dlgArt.faellig = f.dataset.faellig; dlgArt.zeichne(); $('d-titel').focus(); }
    else if (e.target.closest('#d-ok')) aufgabeSpeichern();
  } else if (dlgArt.typ === 'einkauf') {
    const a = e.target.closest('[data-art]');
    if (a) {
      const art = einkaufArtikel().find((x) => x.id === a.dataset.art);
      if (!art) return;
      const status = art.status === 'erledigt' ? 'offen' : 'erledigt';
      einkaufOp({ ids: [art.id], felder: { status, erledigt: status === 'erledigt' ? isoZeit(new Date()) : null } }, 'Einkauf abgehakt');
    } else if (e.target.closest('[data-aufraeumen]')) {
      const ids = einkaufArtikel().filter((x) => x.status === 'erledigt').map((x) => x.id);
      einkaufOp({ ids, felder: { status: 'archiv' } }, 'Erledigte entfernt');
    }
  }
});
dlg.addEventListener('input', (e) => {
  if (dlgArt && dlgArt.typ === 'aufgabe' && e.target.id === 'd-titel') {
    dlgArt.titel = e.target.value;
    const ok = $('d-ok');
    if (ok) ok.disabled = !dlgArt.titel.trim();
  }
});
dlg.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !dlgArt) return;
  e.preventDefault();
  if (dlgArt.typ === 'aufgabe' && e.target.id === 'd-titel') aufgabeSpeichern();
  if (dlgArt.typ === 'einkauf' && e.target.id === 'd-einkauf') {
    const teile = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
    if (!teile.length) return;
    e.target.value = '';
    const neu = teile.map((text) => ({ id: uid('e'), text, status: 'offen', zeit: isoZeit(new Date()), erledigt: null }));
    einkaufOp({ neu }, 'Einkauf hinzugefügt');
    $('d-einkauf').focus();
  }
});

// Nach Rückkehr aus den Einstellungen (Seite kommt aus dem Cache): frisch laden, Hintergrund anwenden.
const auffrischen = () => laden(['aufgaben.json', 'einkauf.json', 'einstellungen.json', 'termine.json']).then(hintergrund);
addEventListener('pageshow', (e) => { if (e.persisted) auffrischen(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auffrischen(); });
