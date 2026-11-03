import { F, ladeAlle, aendere, config } from './shared/core.js';
import { saveConfig, lesen } from './shared/github.js';
import { icon, LICHT_SYMBOLE } from './shared/icons.js';
import { katSymbol } from './shared/finance.js';
import { modulFarbe } from './shared/tasks.js';
import { esc, uid, parseBetrag, euro } from './shared/util.js';

const $ = (id) => document.getElementById(id);
const vomPanel = document.referrer.includes('/panel/');
$('zurueck').href = vomPanel ? 'panel/' : './';
$('zurueck').innerHTML = icon('pfeil', 22, 2.5) + (vomPanel ? 'Panel' : 'Zurück');

const DATEIEN = ['einstellungen.json', 'regeln.json', 'kategorien.json', 'dauerkosten.json'];
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
let S = null;
const offen = new Set();

function kopie() {
  const e = structuredClone(F['einstellungen.json'] || {});
  return {
    e,
    regeln: structuredClone(F['regeln.json']?.regeln || []),
    kats: structuredClone(F['kategorien.json']?.kategorien || []),
    dauer: structuredClone(F['dauerkosten.json']?.posten || []),
    licht: structuredClone(e.licht || []),
    pausen: structuredClone(e.pausen || []),
    stufen: structuredClone(e.kleidung?.stufen || []),
  };
}

const schalter = (pfad, an) => `<label class="schalter"><input type="checkbox" data-p="${pfad}" ${an ? 'checked' : ''}><span></span></label>`;
const knoepfe = (id, zweit) => `<div class="knopfzeile"><button class="knopf" data-sichern="${id}">Sichern</button>${zweit || ''}</div><div class="meldung" id="m-${id}"></div>`;

function verbindungHtml() {
  const c = config();
  return `<div class="gruppe-titel">Verbindung</div>
  <div class="gruppe">
    <div class="zeile"><span class="lbl">Konto</span><input id="c-owner" value="${esc(c.owner)}" autocapitalize="none" autocorrect="off"></div>
    <div class="zeile"><span class="lbl">Daten-Repo</span><input id="c-repo" value="${esc(c.repo)}" autocapitalize="none" autocorrect="off"></div>
    <div class="zeile"><span class="lbl">Token</span><input id="c-token" type="password" value="${esc(c.token)}" placeholder="github_pat_…" autocapitalize="none" autocorrect="off"></div>
  </div>
  <div class="knopfzeile"><button class="knopf" id="c-sichern">Speichern und testen</button></div>
  <div class="meldung" id="m-verbindung"></div>
  <p class="fuss">Das Token bleibt nur in diesem Browser auf diesem Gerät. Es braucht Zugriff nur auf das Daten-Repo mit „Contents: Read and write“.</p>`;
}

function finanzenHtml() {
  const summe = S.kats.reduce((s, k) => s + (Number(k.budget) || 0), 0);
  return `<div class="gruppe-titel">Budget</div>
  <div class="gruppe">
    <div class="zeile"><span class="lbl">Monatsbudget</span><input class="zahl" inputmode="decimal" data-p="e.monatsbudget" value="${esc(S.e.monatsbudget ?? '')}"> €</div>
  </div>
  <div class="gruppe-titel"><span>Budget pro Kategorie</span><span>Summe ${euro(summe)}</span></div>
  <div class="gruppe">${S.kats.map((k, i) => `<div class="zeile" style="--einzug:58px">
    <span class="symbol" style="background:${k.farbe}">${icon(katSymbol(k.name), 17, 2.2)}</span><span class="lbl">${esc(k.name)}</span>
    <input class="zahl" inputmode="decimal" data-p="kats.${i}.budget" value="${esc(k.budget ?? '')}"> €</div>`).join('')}</div>
  <div class="gruppe-titel">Dauerkosten (am Monatsersten gebucht)</div>
  <div class="gruppe">${S.dauer.map((d, i) => `<div class="zeile">
    ${schalter(`dauer.${i}.aktiv`, d.aktiv !== false)}
    <input class="links" style="flex:1" data-p="dauer.${i}.name" value="${esc(d.name)}" placeholder="Name">
    <select data-p="dauer.${i}.kategorie">${S.kats.map((k) => `<option ${k.name === d.kategorie ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
    <input class="zahl" style="width:64px" inputmode="decimal" data-p="dauer.${i}.betrag" value="${esc(d.betrag)}"> €
    <button class="x" data-weg="dauer.${i}" aria-label="Entfernen">${icon('x', 18)}</button></div>`).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="dauer">${'Dauerkosten hinzufügen'}</button></div></div>
  ${knoepfe('finanzen')}`;
}

function lichtHtml() {
  return `<div class="gruppe-titel">Licht-Buttons (Panel)</div>
  <div class="gruppe">${S.licht.map((l, i) => `<div class="regel">
    <div class="kopf"><span class="symbol" style="background:${esc(l.farbe || '#FFD60A')};color:#111">${icon(l.symbol || 'lampe', 17, 2.2)}</span>
      <input class="links" style="flex:1;border:0;background:none;font-size:17px;padding:0" data-p="licht.${i}.name" value="${esc(l.name)}" placeholder="Name">
      <button class="x" style="color:var(--t2)" data-hoch="licht.${i}" aria-label="Nach oben">${icon('hoch', 18)}</button>
      <button class="x" data-weg="licht.${i}" aria-label="Entfernen">${icon('x', 18)}</button></div>
    <div class="koerper">
      <div class="reihe"><span>Kurzbefehl</span><input style="flex:1" data-p="licht.${i}.kurzbefehl" value="${esc(l.kurzbefehl || '')}" placeholder="Exakter Name" autocapitalize="none" autocorrect="off"></div>
      <div class="reihe"><span>Farbe</span><input type="color" class="farbe" data-p="licht.${i}.farbe" value="${esc(l.farbe || '#FFD60A')}"></div>
      <div class="reihe"><span>Symbol</span><div class="symbole">${LICHT_SYMBOLE.map((s) => `<button class="${s === l.symbol ? 'an' : ''}" data-symbol="${i}:${s}">${icon(s, 18)}</button>`).join('')}</div></div>
    </div></div>`).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="licht">Button hinzufügen</button></div></div>
  <p class="fuss">Der Name des Kurzbefehls muss genau so heißen wie in der Kurzbefehle-App, z. B. die Govee-Tap-to-Run-Aktion, die du „Zu Siri hinzugefügt“ hast.</p>
  ${knoepfe('licht')}`;
}

function semesterHtml() {
  return `<div class="gruppe-titel">Vorlesungszeit</div>
  <div class="gruppe">
    <div class="zeile"><span class="lbl">Beginn</span><input type="date" class="datum" data-p="e.semester.von" value="${esc(S.e.semester?.von || '')}"></div>
    <div class="zeile"><span class="lbl">Ende</span><input type="date" class="datum" data-p="e.semester.bis" value="${esc(S.e.semester?.bis || '')}"></div>
  </div>
  <div class="gruppe-titel">Pausen und freie Tage</div>
  <div class="gruppe">${S.pausen.map((p, i) => `<div class="zeile">
    <input class="links" style="flex:1" data-p="pausen.${i}.name" value="${esc(p.name)}" placeholder="Name">
    <input type="date" class="datum" style="width:118px" data-p="pausen.${i}.von" value="${esc(p.von)}">
    <input type="date" class="datum" style="width:118px" data-p="pausen.${i}.bis" value="${esc(p.bis)}">
    <button class="x" data-weg="pausen.${i}" aria-label="Entfernen">${icon('x', 18)}</button></div>`).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="pausen">Pause hinzufügen</button></div></div>
  <p class="fuss">In Pausen und außerhalb der Vorlesungszeit entstehen keine Aufgaben. Für einen einzelnen Feiertag Beginn und Ende gleich setzen.</p>
  ${knoepfe('semester')}`;
}

function regelHtml(r, i) {
  const art = r.art || 'tag';
  const tage = r.tage || [];
  const zielOpt = S.regeln.filter((x) => x.art === 'tag').map((x) => `<option value="${esc(x.id)}" ${x.id === r.fuer ? 'selected' : ''}>${esc(x.modul)} ${esc(x.typ)}</option>`).join('');
  const zeiten = art === 'tag' && tage.length ? `<div class="reihe"><span>Uhrzeit</span><div class="zeiten">${[...tage].sort().map((t) => `<label>${WT[t - 1]} <input type="time" data-p="regeln.${i}.zeiten.${t}" value="${esc(r.zeiten?.[t] || '')}"></label>`).join('')}</div></div>` : '';
  const auf = offen.has(r.id);
  const beschr = art === 'tag' ? tage.map((t) => WT[t - 1]).join(', ') : art === 'kw' ? `wöchentlich ab ${WT[(tage[0] || 1) - 1]}` : 'Vorbereitung';
  return `<div class="regel">
    <div class="kopf" data-auf="${esc(r.id)}"><span class="dot" style="background:${modulFarbe(r.modul)}"></span>
      <span class="name">${esc(r.modul)} ${esc(r.typ)}<small>${esc(beschr)}${r.rhythmus === '2wochen' ? ', alle 2 Wochen' : ''}</small></span>
      ${schalter(`regeln.${i}.aktiv`, r.aktiv !== false)}</div>
    ${auf ? `<div class="koerper">
      <div class="reihe"><span>Modul, Typ</span><input class="kurz" data-p="regeln.${i}.modul" value="${esc(r.modul)}"><input class="kurz" style="width:110px" data-p="regeln.${i}.typ" value="${esc(r.typ)}"></div>
      <div class="reihe"><span>Art</span><select data-p="regeln.${i}.art" data-neu-zeichnen>
        <option value="tag" ${art === 'tag' ? 'selected' : ''}>Am Termin (mit Datum)</option>
        <option value="kw" ${art === 'kw' ? 'selected' : ''}>Einmal pro Woche (mit KW)</option>
        <option value="video" ${art === 'video' ? 'selected' : ''}>Vorbereitung vor Termin</option></select></div>
      ${art === 'video' ? `<div class="reihe"><span>Für</span><select data-p="regeln.${i}.fuer">${zielOpt}</select></div>
        <div class="reihe"><span>Erscheint</span><select data-p="regeln.${i}.ab.tag">${WT.map((w, j) => `<option value="${j + 1}" ${(r.ab?.tag ?? 4) === j + 1 ? 'selected' : ''}>${w}</option>`).join('')}</select>
        <select data-p="regeln.${i}.ab.wochen">${[0, -1, -2].map((w) => `<option value="${w}" ${(r.ab?.wochen ?? -1) === w ? 'selected' : ''}>${w === 0 ? 'derselben Woche' : w === -1 ? 'der Vorwoche' : '2 Wochen vorher'}</option>`).join('')}</select></div>`
        : `<div class="reihe"><span>${art === 'kw' ? 'Erscheint am' : 'Tage'}</span><div class="tage">${WT.map((w, j) => `<button class="${tage.includes(j + 1) ? 'an' : ''}" data-tag="${i}:${j + 1}">${w}</button>`).join('')}</div></div>`}
      ${zeiten}
      <div class="reihe"><span>Rhythmus</span><select data-p="regeln.${i}.rhythmus"><option value="woche" ${r.rhythmus !== '2wochen' ? 'selected' : ''}>Jede Woche</option><option value="2wochen" ${r.rhythmus === '2wochen' ? 'selected' : ''}>Alle 2 Wochen</option></select></div>
      <div class="reihe"><span>Gültig</span><input type="date" data-p="regeln.${i}.von" value="${esc(r.von || '')}"> bis <input type="date" data-p="regeln.${i}.bis" value="${esc(r.bis || '')}"></div>
      <div class="reihe"><button class="textknopf" style="padding:0;color:var(--bad)" data-weg="regeln.${i}">Regel löschen</button></div>
    </div>` : ''}</div>`;
}

function regelnHtml() {
  return `<div class="gruppe-titel">Wiederkehrende Aufgaben (Studium)</div>
  <div class="gruppe">${S.regeln.map(regelHtml).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="regeln">Regel hinzufügen</button></div></div>
  <p class="fuss">Tippe auf eine Regel zum Bearbeiten. Änderungen wirken auf neu entstehende Aufgaben, bestehende bleiben unverändert.</p>
  ${knoepfe('regeln')}`;
}

function kleidungHtml() {
  return `<div class="gruppe-titel">Kleidungsempfehlung (gefühlte Temperatur 7 bis 20 Uhr, kälteste Stunde)</div>
  <div class="gruppe">${S.stufen.map((s, i) => `<div class="zeile"><span class="lbl" style="flex:none;color:var(--t2)">unter</span>
    <input class="zahl" style="width:44px" inputmode="numeric" data-p="stufen.${i}.bis" value="${esc(s.bis)}">°
    <input class="links" style="flex:1" data-p="stufen.${i}.text" value="${esc(s.text)}">
    <button class="x" data-weg="stufen.${i}" aria-label="Entfernen">${icon('x', 18)}</button></div>`).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="stufen">Stufe hinzufügen</button></div>
    <div class="zeile"><span class="lbl">Schirm ab Regenwahrscheinlichkeit</span><input class="zahl" style="width:50px" inputmode="numeric" data-p="e.kleidung.regenSchwelle" value="${esc(S.e.kleidung?.regenSchwelle ?? 40)}"> %</div>
  </div>
  ${knoepfe('kleidung')}`;
}

function anleitungHtml() {
  const c = config();
  const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/inbox/[Dateiname].json`;
  return `<div class="gruppe-titel">Kurzbefehle</div>
  <div class="gruppe"><details><summary class="zeile"><span class="lbl">Kurzbefehl „Ausgabe“ einrichten</span>${icon('runter', 18)}</summary>
  <div class="anleitung">In der Kurzbefehle-App einen neuen Kurzbefehl anlegen und diese Aktionen der Reihe nach hinzufügen:
  <ol>
    <li><b>Liste</b> mit den Kategorien: ${S.kats.map((k) => esc(k.name)).join(', ')}.</li>
    <li><b>Aus Liste auswählen</b> (Eingabeaufforderung „Kategorie“). Ergebnis: <i>Gewählter Eintrag</i>.</li>
    <li><b>Nach Eingabe fragen</b>, Typ Zahl, Text „Betrag“.</li>
    <li><b>Text</b> leer lassen, danach <b>Variable festlegen</b> „Notiz“.</li>
    <li><b>Wenn</b> <i>Gewählter Eintrag</i> ist „Sonstiges“: <b>Nach Eingabe fragen</b> (Text, „Wofür?“) und <b>Variable festlegen</b> „Notiz“. Ende Wenn.</li>
    <li><b>Aktuelles Datum</b>, dann <b>Datum formatieren</b>: Format „ISO 8601“, Uhrzeit einschließen. Ergebnis heißt „Zeit“.</li>
    <li><b>Text</b> mit genau diesem Inhalt (Variablen an den Stellen einsetzen):<pre>{"typ":"kosten","kategorie":"[Gewählter Eintrag]","betrag":"[Eingegebene Zahl]","text":"[Notiz]","zeit":"[Zeit]"}</pre></li>
    <li><b>Base64-Kodierung</b> des Texts, Zeilenumbrüche: Keine.</li>
    <li><b>Aktuelles Datum</b>, <b>Datum formatieren</b> mit eigenem Format <code>yyyyMMdd-HHmmss</code> (Ergebnis „Dateiname“).</li>
    <li><b>Inhalte von URL abrufen</b>: URL <code>${esc(url)}</code>, Methode <b>PUT</b>, Header <code>Authorization</code> = <code>Bearer DEIN_TOKEN</code> und <code>Accept</code> = <code>application/vnd.github+json</code>, Anfragetext JSON: <code>message</code> = „Ausgabe“, <code>content</code> = <i>Base64-kodiert</i>.</li>
    <li>Optional <b>Mitteilung zeigen</b> „Gespeichert“.</li>
  </ol>
  Innerhalb von etwa einer Minute erscheint die Ausgabe in der App. Für die Einkaufsliste geht dasselbe mit <code>{"typ":"einkauf","text":"Milch, Brot"}</code>.
  Läuft das Token ab, muss es auch hier ersetzt werden.</div></details></div>`;
}

function zeichne() {
  $('inhalt').innerHTML = verbindungHtml() + (S ? finanzenHtml() + lichtHtml() + regelnHtml() + semesterHtml() + kleidungHtml() + anleitungHtml() : '');
}

/* Werte setzen über Pfade wie "kats.2.budget" */
function setze(pfad, wert) {
  const teile = pfad.split('.');
  let o = S;
  for (let i = 0; i < teile.length - 1; i++) {
    const k = teile[i];
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[teile[teile.length - 1]] = wert;
}
function wertVon(el) {
  if (el.type === 'checkbox') return el.checked;
  const p = el.dataset.p;
  if (/\.(budget|betrag)$/.test(p) || p === 'e.monatsbudget') { const n = parseBetrag(el.value); return Number.isFinite(n) ? n : null; }
  if (/\.(bis|regenSchwelle)$/.test(p) && p.startsWith('stufen') || p.endsWith('regenSchwelle') || /\.ab\.(tag|wochen)$/.test(p)) return Number(el.value);
  return el.value;
}
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-p]');
  if (!el || !S) return;
  setze(el.dataset.p, wertVon(el));
  if (el.hasAttribute('data-neu-zeichnen') || el.type === 'checkbox' || el.dataset.p.endsWith('.modul') || el.dataset.p.endsWith('.typ') || el.dataset.p.startsWith('kats') || el.type === 'color') zeichne();
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-p]');
  if (!el || !S || el.type === 'checkbox' || el.tagName === 'SELECT') return;
  setze(el.dataset.p, wertVon(el));
});

const NEU = {
  dauer: () => ({ id: uid('d'), name: '', kategorie: 'Digital', betrag: 0, aktiv: true }),
  licht: () => ({ name: 'Neu', kurzbefehl: '', symbol: 'lampe', farbe: '#FFD60A' }),
  pausen: () => ({ name: 'Feiertag', von: '', bis: '' }),
  regeln: () => { const r = { id: uid('r'), modul: 'NEU', typ: 'VO', art: 'tag', tage: [1], rhythmus: 'woche', aktiv: true }; offen.add(r.id); return r; },
  stufen: () => ({ bis: 25, text: '' }),
};
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-neu],[data-weg],[data-hoch],[data-tag],[data-symbol],[data-auf],[data-sichern],#c-sichern');
  if (!t) return;
  if (t.id === 'c-sichern') return verbinden();
  if (t.dataset.neu) { S[t.dataset.neu].push(NEU[t.dataset.neu]()); return zeichne(); }
  if (t.dataset.weg) { const [k, i] = t.dataset.weg.split('.'); S[k].splice(Number(i), 1); return zeichne(); }
  if (t.dataset.hoch) { const [k, i] = t.dataset.hoch.split('.'); const n = Number(i); if (n > 0) [S[k][n - 1], S[k][n]] = [S[k][n], S[k][n - 1]]; return zeichne(); }
  if (t.dataset.tag) {
    const [i, tag] = t.dataset.tag.split(':').map(Number);
    const r = S.regeln[i];
    if (r.art === 'kw') r.tage = [tag];
    else r.tage = (r.tage || []).includes(tag) ? r.tage.filter((x) => x !== tag) : [...(r.tage || []), tag].sort();
    return zeichne();
  }
  if (t.dataset.symbol) { const [i, s] = t.dataset.symbol.split(':'); S.licht[Number(i)].symbol = s; return zeichne(); }
  if (t.dataset.auf) {
    if (e.target.closest('.schalter')) return;
    offen.has(t.dataset.auf) ? offen.delete(t.dataset.auf) : offen.add(t.dataset.auf);
    return zeichne();
  }
  if (t.dataset.sichern) sichern(t.dataset.sichern);
});

async function sichern(was) {
  const m = $(`m-${was}`);
  m.className = 'meldung';
  m.textContent = 'Speichere …';
  try {
    if (was === 'finanzen') {
      await aendere('einstellungen.json', (d) => ({ ...d, monatsbudget: S.e.monatsbudget }), 'Budget geändert');
      await aendere('kategorien.json', (d) => ({ ...d, kategorien: S.kats }), 'Kategorien geändert');
      await aendere('dauerkosten.json', (d) => ({ ...d, posten: S.dauer.filter((x) => x.name) }), 'Dauerkosten geändert');
    }
    if (was === 'licht') await aendere('einstellungen.json', (d) => ({ ...d, licht: S.licht }), 'Licht-Buttons geändert');
    if (was === 'semester') {
      const pausen = S.pausen.filter((p) => p.von).map((p) => ({ ...p, bis: p.bis || p.von }));
      await aendere('einstellungen.json', (d) => ({ ...d, semester: S.e.semester, pausen }), 'Semester geändert');
    }
    if (was === 'regeln') {
      const regeln = S.regeln.map((r) => {
        const x = { ...r };
        if (x.art !== 'tag') delete x.zeiten;
        if (x.zeiten) for (const k of Object.keys(x.zeiten)) if (!x.zeiten[k] || !(x.tage || []).includes(Number(k))) delete x.zeiten[k];
        if (x.art === 'video') { delete x.tage; x.ab = x.ab || { tag: 4, wochen: -1 }; }
        if (!x.von) delete x.von;
        if (!x.bis) delete x.bis;
        return x;
      });
      await aendere('regeln.json', (d) => ({ ...d, regeln }), 'Regeln geändert');
    }
    if (was === 'kleidung') {
      const stufen = S.stufen.filter((s) => s.text).sort((a, b) => a.bis - b.bis);
      await aendere('einstellungen.json', (d) => ({ ...d, kleidung: { ...(d.kleidung || {}), stufen, regenSchwelle: Number(S.e.kleidung?.regenSchwelle ?? 40) } }), 'Kleidung geändert');
    }
    m.className = 'meldung ok';
    m.textContent = 'Gespeichert';
  } catch (err) {
    m.className = 'meldung bad';
    m.textContent = err.message || 'Speichern fehlgeschlagen';
  }
}

async function verbinden() {
  saveConfig({ owner: $('c-owner').value.trim(), repo: $('c-repo').value.trim(), token: $('c-token').value.trim() });
  const m = $('m-verbindung');
  m.className = 'meldung';
  m.textContent = 'Teste …';
  try {
    const r = await lesen('einstellungen.json');
    m.className = r ? 'meldung ok' : 'meldung bad';
    m.textContent = r ? 'Verbunden' : 'Verbunden, aber keine Daten gefunden';
    if (r) await laden();
  } catch (err) {
    m.className = 'meldung bad';
    m.textContent = err.message;
  }
}

async function laden() {
  try {
    await ladeAlle(DATEIEN);
    S = kopie();
  } catch { S = null; }
  zeichne();
  if (S) $('m-verbindung').textContent = '';
}

zeichne();
laden();
