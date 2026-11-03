export const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MON_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const pad = (n) => String(n).padStart(2, '0');

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function isoZeit(d) {
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function parseDate(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
export function heute() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export const isoDow = (d) => d.getDay() || 7;
export const montag = (d) => addDays(d, 1 - isoDow(d));

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}
export const isoWeekYear = (d) => addDays(d, 4 - isoDow(d)).getFullYear();
export const kwKey = (d) => `${isoWeekYear(d)}-W${pad(isoWeek(d))}`;
export const kwLabel = (key) => `KW ${Number(key.slice(-2))}`;

export function fmtDM(s) {
  const d = parseDate(s);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}
export function fmtWtDM(s) {
  return `${WT[parseDate(s).getDay()]} ${fmtDM(s)}`;
}
export function headerText(d) {
  return `${WT[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]} · KW ${isoWeek(d)}`;
}
export function clockText(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const EUR0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const euro = (n) => EUR.format(Math.round(n * 100) / 100);
export const euro0 = (n) => EUR0.format(Math.round(n));

export function parseBetrag(s) {
  let t = String(s).trim().replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function hexRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
