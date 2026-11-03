const KEY = 'np-config';
const STANDARD = { owner: 'xtobi06-code', repo: 'data-np', token: '' };

export function config() {
  try { return { ...STANDARD, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...STANDARD }; }
}
export function saveConfig(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* Speicher gesperrt */ }
}

function enc(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function dec(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function cacheGet(path) {
  try { return JSON.parse(localStorage.getItem('np-cache:' + path)); } catch { return null; }
}
function cacheSet(path, val) {
  try { localStorage.setItem('np-cache:' + path, JSON.stringify(val)); } catch { /* ignorieren */ }
}

function url(path) {
  const c = config();
  return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`;
}
function headers() {
  return { Authorization: `Bearer ${config().token}`, Accept: 'application/vnd.github+json' };
}

export class FehlerToken extends Error {}
export class FehlerKonflikt extends Error {}

// Liest eine JSON-Datei. Gibt { data, sha } zurück oder null, wenn es sie nicht gibt.
// Ohne Netz oder bei Fehlern liefert sie den Zwischenspeicher (mit offline: true), falls vorhanden.
export async function lesen(path) {
  if (!config().token) throw new FehlerToken('Kein Token hinterlegt. Bitte in den Einstellungen eintragen.');
  try {
    const r = await fetch(url(path), { headers: headers(), cache: 'no-store' });
    if (r.status === 401 || r.status === 403) throw new FehlerToken('Token ungültig oder abgelaufen. Bitte in den Einstellungen erneuern.');
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub: Status ${r.status}`);
    const j = await r.json();
    const res = { data: JSON.parse(dec(j.content)), sha: j.sha };
    cacheSet(path, res);
    return res;
  } catch (e) {
    if (e instanceof FehlerToken) throw e;
    const c = cacheGet(path);
    if (c) return { ...c, offline: true };
    throw e;
  }
}

export async function schreiben(path, data, sha, nachricht = 'Update') {
  const body = { message: nachricht, content: enc(JSON.stringify(data, null, 2) + '\n') };
  if (sha) body.sha = sha;
  const r = await fetch(url(path), {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 401 || r.status === 403) throw new FehlerToken('Token ungültig oder ohne Schreibrecht.');
  if (r.status === 409 || r.status === 422) throw new FehlerKonflikt('Die Datei wurde zwischenzeitlich geändert.');
  if (!r.ok) throw new Error(`GitHub: Status ${r.status}`);
  const j = await r.json();
  const res = { data, sha: j.content.sha };
  cacheSet(path, res);
  return res;
}

// Liest, wendet fn auf die Daten an und schreibt zurück. Bei einem Konflikt wird einmal neu gelesen und wiederholt.
export async function aendern(path, fn, nachricht = 'Update', standard = null) {
  for (let versuch = 0; versuch < 3; versuch++) {
    const aktuell = await lesen(path);
    const basis = aktuell ? aktuell.data : standard;
    const neu = fn(structuredClone(basis));
    try {
      return await schreiben(path, neu, aktuell ? aktuell.sha : null, nachricht);
    } catch (e) {
      if (!(e instanceof FehlerKonflikt) || versuch === 2) throw e;
    }
  }
}
