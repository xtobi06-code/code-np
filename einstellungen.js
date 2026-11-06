import { F, ladeAlle, aendere, config, PANEL_STANDARD } from './shared/core.js';
import { saveConfig, lesen, ordner, rohdatei, hochladen, loeschen } from './shared/github.js';
import { icon, LICHT_SYMBOLE } from './shared/icons.js';
import { katSymbol, KAT_ICONS } from './shared/finance.js';
import { modulFarbe, MODULE_STANDARD, setzeModule } from './shared/tasks.js';
import { esc, uid, parseBetrag, euro } from './shared/util.js';

const $ = (id) => document.getElementById(id);
const vomPanel = document.referrer.includes('/panel/');
$('zurueck').href = vomPanel ? 'panel/' : './';
$('zurueck').innerHTML = icon('pfeil', 22, 2.5);
$('zurueck').setAttribute('aria-label', vomPanel ? 'Zurück zum Panel' : 'Zurück');

const DATEIEN = ['einstellungen.json', 'regeln.json', 'kategorien.json', 'dauerkosten.json'];
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
let S = null;
const offen = new Set();

function kopie() {
  const e = structuredClone(F['einstellungen.json'] || {});
  return {
    e,
    regeln: structuredClone(F['regeln.json']?.regeln || []),
    kats: structuredClone(F['kategorien.json']?.kategorien || []).map((k) => ({ ...k, _alt: k.name })),
    dauer: structuredClone(F['dauerkosten.json']?.posten || []),
    licht: structuredClone(e.licht || []),
    pausen: structuredClone(e.pausen || []),
    stufen: structuredClone(e.kleidung?.stufen || []),
    module: Object.entries({ ...MODULE_STANDARD, ...(e.module || {}) }).map(([k, v]) => ({ k, name: v.name || '', farbe: v.farbe || '#A0A4AE' })),
    panel: { ...PANEL_STANDARD, ...(e.panel || {}) },
  };
}

const schalter = (pfad, an) => `<label class="schalter"><input type="checkbox" data-p="${pfad}" ${an ? 'checked' : ''}><span></span></label>`;
const knoepfe = () => '';
const wisch = (weg, html) => {
  const m = html.match(/ data-reihe="(\w+)"/);
  const inner = m ? html.replace(m[0], '') : html;
  return `<div class="wisch"${m ? ` data-reihe="${m[1]}"` : ''}><div class="vorn">${inner}</div><button class="loesch" data-weg="${weg}">Löschen</button></div>`;
};
const GRIFF = '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>';
const griff = (k, i) => `<span class="griff" data-sort="${k}.${i}" aria-label="Verschieben">${GRIFF}</span>`;

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
  <div class="gruppe">${S.kats.map((k, i) => {
    const auf = katOffen.has(i);
    const zeile = `<div class="zeile" data-reihe="kats" style="--einzug:58px">
    <span class="symbol" data-kat-auf="${i}" style="background:${esc(k.farbe)}">${icon(katSymbol(k.name, k.symbol), 17, 2.2)}</span><span class="lbl" data-kat-auf="${i}">${esc(k.name || 'Ohne Namen')}</span>
    <input class="zahl" inputmode="decimal" data-p="kats.${i}.budget" value="${esc(k.budget ?? '')}"> €${griff('kats', i)}</div>
    ${auf ? `<div class="regel"><div class="koerper">
      ${k.name === 'Sonstiges' ? '' : `<div class="reihe"><span>Name</span><input style="flex:1" data-p="kats.${i}.name" value="${esc(k.name)}" placeholder="Name"></div>`}
      <div class="reihe"><span>Farbe</span><input type="color" class="farbe" data-p="kats.${i}.farbe" value="${esc(k.farbe || '#8E8E93')}"></div>
      <div class="reihe"><span>Symbol</span><div class="symbole">${KAT_ICONS.map((sy) => `<button class="${sy === katSymbol(k.name, k.symbol) ? 'an' : ''}" data-ksym="${i}:${sy}">${icon(sy, 18)}</button>`).join('')}</div></div>
    </div></div>` : ''}`;
    return k.name === 'Sonstiges' ? zeile : wisch(`kats.${i}`, zeile);
  }).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="kats">Kategorie hinzufügen</button></div></div>
  <p class="fuss">Tippe auf eine Kategorie, um Name, Farbe und Symbol zu ändern. Nach links wischen löscht sie: Ihre bisherigen Ausgaben wandern zu Sonstiges, der alte Name steht dann als Notiz dabei.</p>
  <div class="gruppe-titel">Dauerkosten (am Monatsersten gebucht)</div>
  <div class="gruppe">${S.dauer.map((d, i) => wisch(`dauer.${i}`, `<div class="zeile" data-reihe="dauer" style="flex-wrap:wrap;row-gap:4px">
    ${schalter(`dauer.${i}.aktiv`, d.aktiv !== false)}
    <input class="links" style="flex:1 1 120px" data-p="dauer.${i}.name" value="${esc(d.name)}" placeholder="Name, z. B. Mobilfunk">
    ${griff('dauer', i)}
    <div style="flex-basis:100%;display:flex;align-items:center;gap:10px;padding-left:63px;font-size:15px">
      <span style="flex:1"></span><input class="zahl" style="width:64px" inputmode="decimal" data-p="dauer.${i}.betrag" value="${esc(d.betrag)}"> € pro Monat</div></div>`)).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="dauer">${'Dauerkosten hinzufügen'}</button></div></div>
  ${knoepfe('finanzen')}`;
}

const lichtOffen = new Set();
const katOffen = new Set();
function lichtHtml() {
  return `<div class="gruppe-titel"><span>Licht-Modi</span><span style="font-weight:400;color:var(--t2)">${S.licht.filter((l) => l.favorit).length} Favoriten</span></div>
  <div class="gruppe">${S.licht.map((l, i) => {
    const auf = lichtOffen.has(i);
    return wisch(`licht.${i}`, `<div class="regel" data-reihe="licht">
    <div class="kopf" data-licht-auf="${i}"><span class="symbol" style="background:${esc(l.farbe || '#FFD60A')};color:#111">${icon(l.symbol || 'lampe', 17, 2.2)}</span>
      <span class="name">${esc(l.name || 'Ohne Namen')}<small>${esc(l.kurzbefehl || 'Kurzbefehl fehlt')}</small></span>
      <button class="x" style="color:${l.favorit ? '#ffcc00' : 'var(--t3)'}" data-fav="${i}" aria-label="Favorit">${icon('stern', 21, l.favorit ? 2.6 : 2)}</button>
      <span style="color:var(--t3)">${icon(auf ? 'hoch' : 'runter', 18)}</span>${griff('licht', i)}</div>
    ${auf ? `<div class="koerper">
      <div class="reihe"><span>Name</span><input style="flex:1" data-p="licht.${i}.name" value="${esc(l.name)}" placeholder="Name"></div>
      <div class="reihe"><span>Kurzbefehl</span><input style="flex:1" data-p="licht.${i}.kurzbefehl" value="${esc(l.kurzbefehl || '')}" placeholder="Exakter Name" autocapitalize="none" autocorrect="off"></div>
      <div class="reihe"><span>Farbe</span><input type="color" class="farbe" data-p="licht.${i}.farbe" value="${esc(l.farbe || '#FFD60A')}"></div>
      <div class="reihe"><span>Symbol</span><div class="symbole">${LICHT_SYMBOLE.map((s) => `<button class="${s === l.symbol ? 'an' : ''}" data-symbol="${i}:${s}">${icon(s, 18)}</button>`).join('')}</div></div>
    </div>` : ''}</div>`);
  }).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="licht">Modus hinzufügen</button></div></div>
  <p class="fuss">Stern = Favorit: Die ersten vier Favoriten stehen auf der Übersicht des Panels, alle Modi auf der Licht-Seite (nach links wischen oder „Alle“). Der Kurzbefehl muss genau so heißen wie in der Kurzbefehle-App, z. B. eine Govee-Tap-to-Run-Aktion, die du „Zu Siri hinzugefügt“ hast.</p>
  ${knoepfe('licht')}`;
}

function semesterHtml() {
  return `<div class="gruppe-titel">Vorlesungszeit</div>
  <div class="gruppe">
    <div class="zeile"><span class="lbl">Beginn</span><input type="date" class="datum" data-p="e.semester.von" value="${esc(S.e.semester?.von || '')}"></div>
    <div class="zeile"><span class="lbl">Ende</span><input type="date" class="datum" data-p="e.semester.bis" value="${esc(S.e.semester?.bis || '')}"></div>
  </div>
  <div class="gruppe-titel">Pausen und freie Tage</div>
  <div class="gruppe">${S.pausen.map((p, i) => wisch(`pausen.${i}`, `<div class="zeile" style="flex-wrap:wrap;row-gap:8px">
    <input class="links" style="flex:1 1 140px" data-p="pausen.${i}.name" value="${esc(p.name)}" placeholder="Name">
    <div style="flex-basis:100%;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:var(--t2)">
      <input type="date" class="datum" style="width:128px" data-p="pausen.${i}.von" value="${esc(p.von)}"> bis
      <input type="date" class="datum" style="width:128px" data-p="pausen.${i}.bis" value="${esc(p.bis)}"></div></div>`)).join('')}
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
    </div>` : ''}</div>`;
}

function regelnHtml() {
  return `<div class="gruppe-titel">Wiederkehrende Aufgaben (Studium)</div>
  <div class="gruppe">${S.regeln.map((r, i) => wisch(`regeln.${i}`, regelHtml(r, i))).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="regeln">Regel hinzufügen</button></div></div>
  <p class="fuss">Tippe auf eine Regel zum Bearbeiten. Änderungen wirken auf neu entstehende Aufgaben, bestehende bleiben unverändert.</p>
  ${knoepfe('regeln')}`;
}

function kleidungHtml() {
  return `<div class="gruppe-titel">Kleidungsempfehlung (gefühlte Temperatur 7 bis 20 Uhr, kälteste Stunde)</div>
  <div class="gruppe">${S.stufen.map((s, i) => wisch(`stufen.${i}`, `<div class="zeile"><span class="lbl" style="flex:none;color:var(--t2)">&lt;</span>
    <span style="display:flex;align-items:baseline;gap:2px;flex:none"><input class="zahl" style="width:2.6em;min-width:2.6em;flex:none;padding:0;text-align:right" size="3" inputmode="numeric" data-p="stufen.${i}.bis" value="${esc(s.bis)}"><span style="color:var(--t2)">°C</span></span>
    <input class="links" style="flex:1" data-p="stufen.${i}.text" value="${esc(s.text)}">
    </div>`)).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="stufen">Stufe hinzufügen</button></div>
    <div class="zeile"><span class="lbl">Schirm ab Regenrisiko</span><input class="zahl" style="width:50px" inputmode="numeric" data-p="e.kleidung.regenSchwelle" value="${esc(S.e.kleidung?.regenSchwelle ?? 40)}"> %</div>
  </div>
  ${knoepfe('kleidung')}`;
}

function moduleHtml() {
  return `<div class="gruppe-titel">Module</div>
  <div class="gruppe">${S.module.map((m, i) => wisch(`module.${i}`, `<div class="zeile" data-reihe="module">
    <input type="color" class="farbe" data-p="module.${i}.farbe" value="${esc(m.farbe)}">
    <input class="links" style="width:64px;font-weight:600" data-p="module.${i}.k" value="${esc(m.k)}" autocapitalize="characters">
    <input class="links" style="flex:1" data-p="module.${i}.name" value="${esc(m.name)}" placeholder="Voller Name">
    ${griff('module', i)}</div>`)).join('')}
    <div class="zeile"><button class="textknopf" style="padding:0" data-neu="module">Modul hinzufügen</button></div></div>
  <p class="fuss">Die Farben stammen aus deinem TUM-Stundenplan. Das Kürzel muss zu den Regeln passen.</p>
  ${knoepfe('module')}`;
}

function panelHtml() {
  const p = S.panel;
  return `<div class="gruppe-titel">Panel</div>
  <div class="gruppe">
    <div class="zeile"><span class="lbl">Dein Name (Begrüßung)</span><input data-p="e.name" value="${esc(S.e.name || '')}" placeholder="Tobias"></div>
    <div class="zeile"><span class="lbl">Wetter-Ort</span><select data-p="e.ort">${[['garching', 'Garching'], ['prackenbach', 'Prackenbach'], ['auto', 'Automatisch (Standort des Geräts)']].map(([v, n]) => `<option value="${v}" ${(S.e.ort || 'garching') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="zeile"><span class="lbl">Nachtuhr ab</span><input type="time" data-p="panel.nachtVon" value="${esc(p.nachtVon)}"></div>
    <div class="zeile"><span class="lbl">Nachtuhr bis</span><input type="time" data-p="panel.nachtBis" value="${esc(p.nachtBis)}"></div>
    <div class="zeile"><span class="lbl">Bewegter Hintergrund</span>${schalter('panel.bewegung', p.bewegung !== false)}</div>
    <div class="zeile"><span class="lbl">Karten wechseln automatisch</span>${schalter('panel.stapelAuto', p.stapelAuto === true)}</div>
    <div class="zeile"><span class="lbl">Glas-Effekt</span>${schalter('panel.glas', p.glas !== false)}</div>
    <div class="zeile"><span class="lbl">Tageszeit des Hintergrunds</span><select data-p="panel.szeneZeit">${[['', 'Automatisch'], ['08:00', 'Morgen'], ['12:00', 'Mittag'], ['16:20', 'Abenddämmerung'], ['22:00', 'Nacht']].map(([v, n]) => `<option value="${v}" ${(p.szeneZeit || '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="zeile"><span class="lbl">Hintergrund</span><select data-p="panel.hintergrund" data-neu-zeichnen>${[['landschaft','Bayerischer Wald'],['gebirge','Hochgebirge'],['duenen','Hügel'],['aurora','Himmel (ruhig)'],['abendrot','Abendrot'],['ozean','Ozean'],['minze','Minze'],['violett','Violett'],['graphit','Graphit'],['fotos','Eigene Fotos']].map(([v, n]) => `<option value="${v}" ${(p.hintergrund || 'landschaft') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    ${p.hintergrund === 'fotos' ? `<div class="zeile"><span class="lbl">Foto wechseln alle</span><input class="zahl" style="width:50px" inputmode="numeric" data-p="panel.fotoMinuten" value="${esc(p.fotoMinuten)}"> Min.</div>` : ''}
  </div>
  <p class="fuss">Nachts zeigt das Panel nur eine gedimmte rote Uhr, Antippen weckt es für 90 Sekunden. Läuft das iPad ruckelig oder warm, schalte Bewegung oder Glas-Effekt aus.</p>
  ${knoepfe('panel')}
  ${p.hintergrund === 'fotos' ? `<div class="gruppe-titel"><span>Eigene Fotos</span><span id="foto-status"></span></div>
  <div class="gruppe"><div class="fotos" id="fotos"><span class="fuss" style="margin:0">Lade …</span></div>
    <div class="zeile"><button class="textknopf" style="padding:0" id="foto-wahl">Fotos hinzufügen</button><input type="file" id="foto-datei" accept="image/*" multiple hidden></div></div>
  <p class="fuss">Querformat-Fotos wirken am besten. Sie werden verkleinert und privat im Daten-Repo gespeichert.</p>` : ''}`;
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

const APP_DATEIEN = ['./', 'index.html', 'einstellungen.html', 'phone.js', 'phone.css', 'einstellungen.js', 'panel/', 'panel/index.html', 'panel/panel.js', 'panel/panel.css',
  'shared/app.js', 'shared/core.js', 'shared/finance.js', 'shared/github.js', 'shared/icons.js', 'shared/scene.css', 'shared/scene.js', 'shared/style.css', 'shared/tasks.js', 'shared/util.js', 'shared/weather.js'];
function appHtml() {
  return `<div class="gruppe-titel">App</div>
  <div class="gruppe"><div class="zeile"><button class="textknopf" style="padding:0" id="app-neu">App neu laden (neueste Version holen)</button></div></div>
  <p class="fuss" id="app-neu-m">Holt alle Dateien frisch vom Server. Danach die App einmal komplett schließen und neu öffnen.</p>`;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#app-neu')) return;
  const m = $('app-neu-m');
  m.textContent = 'Lade …';
  await Promise.allSettled(APP_DATEIEN.map((d) => fetch(d, { cache: 'reload' })));
  m.textContent = 'Fertig. Jetzt die App schließen und neu öffnen.';
});

function zeichne() {
  offeneWisch = null;
  $('inhalt').innerHTML = verbindungHtml() + (S ? finanzenHtml() + lichtHtml() + panelHtml() + regelnHtml() + moduleHtml() + semesterHtml() + kleidungHtml() + anleitungHtml() + appHtml() : '');
  if (S && S.panel.hintergrund === 'fotos') fotosZeigen();
}

/* Eigene Fotos */
const vorschau = {};
async function fotosZeigen() {
  const box = $('fotos');
  if (!box) return;
  try {
    const liste = (await ordner('bilder')).filter((d) => /\.(jpe?g|png|webp)$/i.test(d.name));
    if (!liste.length) { box.innerHTML = '<span class="fuss" style="margin:0">Noch keine Fotos.</span>'; return; }
    box.innerHTML = liste.map((d) => `<div class="foto" data-pfad="${esc(d.path)}"><img alt=""><button data-foto-weg="${esc(d.path)}|${esc(d.sha)}" aria-label="Löschen">${icon('x', 14, 2.6)}</button></div>`).join('');
    for (const d of liste) {
      if (!vorschau[d.sha]) vorschau[d.sha] = URL.createObjectURL(await rohdatei(d.path));
      const img = box.querySelector(`[data-pfad="${CSS.escape(d.path)}"] img`);
      if (img) img.src = vorschau[d.sha];
    }
  } catch (err) { box.innerHTML = `<span class="fuss" style="margin:0">${esc(err.message)}</span>`; }
}
function verkleinern(datei, max = 2400) {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * f);
      c.height = Math.round(img.height * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', 0.84).split(',')[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => fehler(new Error('Bild konnte nicht gelesen werden'));
    img.src = URL.createObjectURL(datei);
  });
}
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'foto-datei') return;
  const dateien = [...e.target.files];
  const st = $('foto-status');
  for (let i = 0; i < dateien.length; i++) {
    st.textContent = `Lade hoch ${i + 1}/${dateien.length} …`;
    try {
      const b64 = await verkleinern(dateien[i]);
      await hochladen(`bilder/${Date.now().toString(36)}${i}.jpg`, b64, 'Hintergrundfoto hinzugefügt');
    } catch (err) { st.textContent = err.message; return; }
  }
  st.textContent = 'Fertig';
  fotosZeigen();
});
async function fotoLoeschen(wert) {
  const [pfad, sha] = wert.split('|');
  try { await loeschen(pfad, sha, 'Hintergrundfoto gelöscht'); fotosZeigen(); } catch (err) { $('foto-status').textContent = err.message; }
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
  if (el.type === 'color') return farbVorschau(el); // nicht neu zeichnen, sonst schließt iOS die Farbauswahl
  if (el.hasAttribute('data-neu-zeichnen') || el.type === 'checkbox' || el.dataset.p.endsWith('.modul') || el.dataset.p.endsWith('.typ') || el.dataset.p.startsWith('kats')) zeichne();
});
function farbVorschau(el) {
  const [k, i] = el.dataset.p.split('.');
  const feld = k === 'kats' ? document.querySelector(`.symbol[data-kat-auf="${i}"]`) : k === 'licht' ? document.querySelector(`[data-licht-auf="${i}"] .symbol`) : null;
  if (feld) feld.style.background = el.value;
}
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-p]');
  if (!el || !S || el.type === 'checkbox' || el.tagName === 'SELECT') return;
  setze(el.dataset.p, wertVon(el));
  if (el.type === 'color') farbVorschau(el);
});

const NEU = {
  dauer: () => ({ id: uid('d'), name: '', betrag: 0, aktiv: true }),
  licht: () => ({ name: 'Neu', kurzbefehl: '', symbol: 'lampe', farbe: '#FFD60A', favorit: false }),
  module: () => ({ k: 'NEU', name: '', farbe: '#A0A4AE' }),
  pausen: () => ({ name: 'Feiertag', von: '', bis: '' }),
  regeln: () => { const r = { id: uid('r'), modul: 'NEU', typ: 'VO', art: 'tag', tage: [1], rhythmus: 'woche', aktiv: true }; offen.add(r.id); return r; },
  stufen: () => ({ bis: 25, text: '' }),
  kats: () => ({ name: 'Neu', farbe: '#0A84FF', budget: 0, symbol: 'punkte', _alt: null }),
};
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-neu],[data-weg],[data-kat-auf],[data-ksym],[data-hoch],[data-tag],[data-symbol],[data-auf],[data-sichern],[data-fav],[data-foto-weg],[data-licht-auf],#c-sichern,#foto-wahl');
  if (!t) return;
  if (t.id === 'c-sichern') return verbinden();
  if (t.id === 'foto-wahl') return $('foto-datei').click();
  if (t.dataset.fotoWeg) return fotoLoeschen(t.dataset.fotoWeg);
  if (t.dataset.katAuf) { const i = Number(t.dataset.katAuf); katOffen.has(i) ? katOffen.delete(i) : katOffen.add(i); return zeichne(); }
  if (t.dataset.ksym) { const [i, sy] = t.dataset.ksym.split(':'); S.kats[Number(i)].symbol = sy; return zeichne(); }
  if (t.dataset.fav) { const l = S.licht[Number(t.dataset.fav)]; l.favorit = !l.favorit; return zeichne(); }
  if (t.dataset.lichtAuf) { const i = Number(t.dataset.lichtAuf); lichtOffen.has(i) ? lichtOffen.delete(i) : lichtOffen.add(i); return zeichne(); }
  if (t.dataset.neu) { S[t.dataset.neu].push(NEU[t.dataset.neu]()); if (t.dataset.neu === 'licht') lichtOffen.add(S.licht.length - 1); if (t.dataset.neu === 'kats') katOffen.add(S.kats.length - 1); return zeichne(); }
  if (t.dataset.weg) { const [k, i] = t.dataset.weg.split('.'); S[k].splice(Number(i), 1); if (k === 'licht') lichtOffen.clear(); if (k === 'kats') katOffen.clear(); return zeichne(); }
  if (t.dataset.hoch) { const [k, i] = t.dataset.hoch.split('.'); const n = Number(i); if (n > 0) [S[k][n - 1], S[k][n]] = [S[k][n], S[k][n - 1]]; if (k === 'licht' && n > 0) { lichtOffen.delete(n); lichtOffen.add(n - 1); } return zeichne(); }
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
  });

async function sichern(was) {
  {
    if (was === 'finanzen') {
      const orig = (F['kategorien.json']?.kategorien || []).map((k) => k.name);
      const kats = S.kats.filter((k) => (k.name || '').trim()).map(({ _alt, ...k }) => ({ ...k, name: k.name.trim() }));
      const behalten = new Set(S.kats.filter((k) => k._alt).map((k) => k._alt));
      const umbenannt = Object.fromEntries(S.kats.filter((k) => k._alt && k._alt !== (k.name || '').trim() && (k.name || '').trim()).map((k) => [k._alt, k.name.trim()]));
      const weg = orig.filter((n) => !behalten.has(n));
      if (weg.length || Object.keys(umbenannt).length) {
        await aendere('kosten.json', (d) => {
          for (const b of d.buchungen || []) {
            if (umbenannt[b.kategorie]) b.kategorie = umbenannt[b.kategorie];
            else if (weg.includes(b.kategorie)) { b.text = b.text ? `${b.kategorie}: ${b.text}` : b.kategorie; b.kategorie = 'Sonstiges'; }
          }
          return d;
        }, 'Kategorien geändert');
      }
      await aendere('einstellungen.json', (d) => ({ ...d, monatsbudget: S.e.monatsbudget }), 'Budget geändert');
      await aendere('kategorien.json', (d) => ({ ...d, kategorien: kats }), 'Kategorien geändert');
      await aendere('dauerkosten.json', (d) => ({ ...d, posten: S.dauer.filter((x) => x.name) }), 'Dauerkosten geändert');
    }
    if (was === 'licht') await aendere('einstellungen.json', (d) => ({ ...d, licht: S.licht }), 'Licht-Modi geändert');
    if (was === 'panel') await aendere('einstellungen.json', (d) => ({ ...d, name: S.e.name || '', ort: S.e.ort || 'garching', panel: { ...S.panel, fotoMinuten: Number(S.panel.fotoMinuten) || 15 } }), 'Panel geändert');
    if (was === 'module') {
      const module = {};
      S.module.filter((m) => m.k.trim()).forEach((m) => { module[m.k.trim().toUpperCase()] = { name: m.name, farbe: m.farbe }; });
      await aendere('einstellungen.json', (d) => ({ ...d, module }), 'Module geändert');
      setzeModule(module);
    }
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
  }
}

/* Gemeinsamer Sichern-Knopf */
const teile = () => ({
  finanzen: JSON.stringify([S.e.monatsbudget, S.kats, S.dauer]),
  licht: JSON.stringify(S.licht),
  panel: JSON.stringify([S.e.name, S.e.ort, S.panel]),
  module: JSON.stringify(S.module),
  semester: JSON.stringify([S.e.semester, S.pausen]),
  regeln: JSON.stringify(S.regeln),
  kleidung: JSON.stringify([S.stufen, S.e.kleidung]),
});
let stand = null;
const geaendert = () => (S && stand ? Object.keys(stand).filter((k) => stand[k] !== teile()[k]) : []);
function sichernZeigen() {
  const b = $('sichern');
  b.hidden = !S;
  b.classList.toggle('an', geaendert().length > 0);
}
let speichert = false;
async function alleSichern() {
  if (speichert) return false;
  const liste = geaendert();
  if (!liste.length) return true;
  speichert = true;
  const b = $('sichern');
  b.textContent = 'Speichere …';
  try {
    for (const k of liste) await sichern(k);
    stand = teile();
    b.textContent = 'Gespeichert';
    setTimeout(() => { b.textContent = 'Sichern'; sichernZeigen(); }, 1400);
    speichert = false;
    sichernZeigen();
    return true;
  } catch (err) {
    b.textContent = 'Fehler';
    b.title = err.message || '';
    setTimeout(() => { b.textContent = 'Sichern'; sichernZeigen(); }, 2500);
    speichert = false;
    return false;
  }
}
$('sichern').addEventListener('click', alleSichern);
['input', 'change', 'click', 'pointerup'].forEach((t) => document.addEventListener(t, () => setTimeout(sichernZeigen, 0)));

/* Zurück: bei ungesicherten Änderungen nachfragen */
$('zurueck').addEventListener('click', (e) => {
  if (!geaendert().length) return;
  e.preventDefault();
  const ziel = $('zurueck').href;
  const bl = document.createElement('div');
  bl.className = 'frage';
  bl.innerHTML = `<div class="frage-box"><button class="frage-zu" data-f="bleib" aria-label="Schließen">${icon('x', 18, 2.4)}</button><b>Änderungen sichern?</b><p>Du hast Änderungen gemacht, die noch nicht gesichert sind.</p>
    <button class="knopf" data-f="sichern">Sichern</button><button class="knopf leicht" data-f="weg">Verwerfen</button></div>`;
  document.body.appendChild(bl);
  bl.addEventListener('click', async (ev) => {
    const w = ev.target.closest('[data-f]')?.dataset.f;
    if (!w) { if (ev.target === bl) bl.remove(); return; }
    if (w === 'bleib') return bl.remove();
    if (w === 'weg') return (location.href = ziel);
    ev.target.textContent = 'Speichere …';
    if (await alleSichern()) location.href = ziel; else { bl.remove(); }
  });
});

/* Wischen zum Löschen (wie bei den To-dos) */
const BR = 96;
let offeneWisch = null;
let wischZeit = 0;
function wischSetze(w, t, anim) {
  w.querySelector('.vorn').style.transform = t ? `translateX(${t}px)` : '';
  w.querySelector('.loesch').style.width = `${-t}px`;
  w.classList.toggle('auf', t < 0);
}
function wischZu() {
  if (!offeneWisch) return;
  wischSetze(offeneWisch, 0);
  offeneWisch = null;
}
{
  let d = null;
  document.addEventListener('pointerdown', (e) => {
    const vorn = e.target.closest('.wisch > .vorn');
    if (!vorn || e.target.closest('.griff')) { if (!e.target.closest('.loesch')) wischZu(); return; }
    const w = vorn.parentElement;
    if (offeneWisch && offeneWisch !== w) wischZu();
    d = { x: e.clientX, y: e.clientY, w, start: offeneWisch === w ? -BR : 0, aktiv: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.aktiv) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { d = null; return; }
      if (Math.abs(dx) < 8) return;
      d.aktiv = true;
      d.w.classList.add('zieht');
    }
    d.t = Math.max(-BR - 24, Math.min(0, d.start + dx));
    wischSetze(d.w, d.t);
  });
  const ende = () => {
    if (!d) return;
    const x = d;
    d = null;
    if (!x.aktiv) return;
    wischZeit = Date.now();
    x.w.classList.remove('zieht');
    if (x.t < -BR / 2) { wischSetze(x.w, -BR); offeneWisch = x.w; } else { wischSetze(x.w, 0); if (offeneWisch === x.w) offeneWisch = null; }
  };
  document.addEventListener('pointerup', ende);
  document.addEventListener('pointercancel', ende);
  // Klicks direkt nach dem Wischen oder auf eine geöffnete Zeile nicht als Antippen werten
  document.addEventListener('click', (e) => {
    if (e.target.closest('.loesch')) return;
    if (Date.now() - wischZeit < 350) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (offeneWisch && e.target.closest('.wisch')) { e.stopImmediatePropagation(); e.preventDefault(); wischZu(); }
  }, true);
}

/* Reihenfolge per Ziehen am Griff */
document.addEventListener('pointerdown', (e) => {
  const g = e.target.closest('.griff');
  if (!g || !S) return;
  e.preventDefault();
  const [k, is] = g.dataset.sort.split('.');
  const i = Number(is);
  const reihe = g.closest('[data-reihe]');
  const alle = [...reihe.parentElement.children].filter((c) => c.dataset.reihe === k);
  const rects = alle.map((c) => c.getBoundingClientRect());
  const h = rects[i].height;
  const mitte = rects.map((r) => r.top + r.height / 2);
  const y0 = e.clientY;
  let j = i;
  g.setPointerCapture(e.pointerId);
  reihe.classList.add('zieht');
  alle.forEach((c) => { if (c !== reihe) c.style.transition = 'transform .15s'; });
  const bewegt = (ev) => {
    const dy = ev.clientY - y0;
    reihe.style.transform = `translateY(${dy}px)`;
    const mz = mitte[i] + dy;
    j = i;
    alle.forEach((_, n) => { if (n > i && mz > mitte[n]) j = n; });
    if (j === i) alle.forEach((_, n) => { if (n < i && mz < mitte[n]) { j = n; } });
    if (j < i) j = alle.findIndex((_, n) => n < i && mz < mitte[n]);
    alle.forEach((c, n) => {
      if (c === reihe) return;
      c.style.transform = j > i && n > i && n <= j ? `translateY(${-h}px)` : j < i && n >= j && n < i ? `translateY(${h}px)` : '';
    });
  };
  const fertig = () => {
    g.removeEventListener('pointermove', bewegt);
    g.removeEventListener('pointerup', fertig);
    g.removeEventListener('pointercancel', fertig);
    if (j !== i) {
      const [x] = S[k].splice(i, 1);
      S[k].splice(j, 0, x);
      if (k === 'licht') lichtOffen.clear();
      if (k === 'kats') katOffen.clear();
    }
    zeichne();
    sichernZeigen();
  };
  g.addEventListener('pointermove', bewegt);
  g.addEventListener('pointerup', fertig);
  g.addEventListener('pointercancel', fertig);
});

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
    stand = teile();
  } catch { S = null; }
  zeichne();
  sichernZeigen();
  if (S) $('m-verbindung').textContent = '';
}

zeichne();
laden();
