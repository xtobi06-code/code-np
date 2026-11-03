const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const pad = (n) => String(n).padStart(2, '0');

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}

export function headerText(d) {
  return `${WT[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]} · KW ${isoWeek(d)}`;
}

export function clockText(d, mitSekunden = false) {
  const s = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return mitSekunden ? `${s}:${pad(d.getSeconds())}` : s;
}

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startClock(el, mitSekunden = false) {
  const tick = () => { el.textContent = clockText(new Date(), mitSekunden); };
  tick();
  return setInterval(tick, 1000);
}

export function startHeader(el) {
  const tick = () => { el.textContent = headerText(new Date()); };
  tick();
  return setInterval(tick, 60000);
}
