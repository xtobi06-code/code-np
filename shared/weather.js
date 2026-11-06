export const ORTE = { garching: [48.25, 11.65], prackenbach: [49.05, 12.92] };

// "auto": Standort des Geräts; bei Fehler der zuletzt bekannte oder Garching
function standort(ort) {
  if (ort !== 'auto') return Promise.resolve(ORTE[ort] || ORTE.garching);
  let alt = null;
  try { alt = JSON.parse(localStorage.getItem('np-ort')); } catch { /* egal */ }
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(alt || ORTE.garching);
    navigator.geolocation.getCurrentPosition((p) => {
      const c = [Math.round(p.coords.latitude * 100) / 100, Math.round(p.coords.longitude * 100) / 100];
      try { localStorage.setItem('np-ort', JSON.stringify(c)); } catch { /* egal */ }
      ok(c);
    }, () => ok(alt || ORTE.garching), { timeout: 6000, maximumAge: 30 * 60 * 1000 });
  });
}

// Schwellen auf die gefühlte Temperatur (°C), bewusst früh: Jacke an, bevor es zu kalt wird.
export const KLEIDUNG_STANDARD = [
  { bis: 3, text: 'Winterjacke, Mütze, Handschuhe' },
  { bis: 9, text: 'Winterjacke, Pullover' },
  { bis: 15, text: 'Jacke, Pullover' },
  { bis: 20, text: 'Leichte Jacke' },
  { bis: 99, text: 'T-Shirt' },
];
export const REGEN_SCHWELLE = 40;

export function zustand(code) {
  if (code === 0) return 'Klar';
  if (code === 1) return 'Überwiegend klar';
  if (code === 2) return 'Teilweise bewölkt';
  if (code === 3) return 'Bedeckt';
  if (code === 45 || code === 48) return 'Nebel';
  if (code >= 51 && code <= 57) return 'Nieselregen';
  if (code >= 61 && code <= 67) return 'Regen';
  if (code >= 71 && code <= 77) return 'Schnee';
  if (code >= 80 && code <= 82) return 'Regenschauer';
  if (code === 85 || code === 86) return 'Schneeschauer';
  if (code >= 95) return 'Gewitter';
  return '';
}

export function empfehlung(stunden, stufen = KLEIDUNG_STANDARD, regenSchwelle = REGEN_SCHWELLE) {
  if (!stunden.length) return null;
  const kaelteste = Math.min(...stunden.map((s) => s.gefuehlt));
  const regen = Math.max(...stunden.map((s) => s.regen ?? 0));
  const sortiert = [...stufen].sort((a, b) => a.bis - b.bis);
  const stufe = sortiert.find((s) => kaelteste < s.bis) || sortiert[sortiert.length - 1];
  return { kaelteste, regen, kleidung: stufe.text, schirm: regen >= regenSchwelle };
}

const tagKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function auswerten(daten, jetzt = new Date(), stufen, regenSchwelle) {
  const H = daten.hourly;
  const tag = jetzt.getHours() >= 19 ? 1 : 0;
  const ziel = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tag);
  const prefix = tagKey(ziel);
  const stunden = [];
  H.time.forEach((t, i) => {
    if (!t.startsWith(prefix)) return;
    const h = Number(t.slice(11, 13));
    if (h < 7 || h > 20) return;
    stunden.push({ gefuehlt: H.apparent_temperature[i], regen: H.precipitation_probability[i] });
  });
  const jetztKey = `${tagKey(jetzt)}T${String(jetzt.getHours()).padStart(2, '0')}:00`;
  const start = Math.max(0, H.time.indexOf(jetztKey));
  const verlauf = H.time.slice(start, start + 13).map((t, k) => ({
    zeit: t.slice(11, 16),
    temp: H.temperature_2m ? H.temperature_2m[start + k] : H.apparent_temperature[start + k],
    regen: H.precipitation_probability[start + k],
    code: H.weather_code ? H.weather_code[start + k] : null,
  }));
  const d = daten.daily;
  const di = d ? Math.max(0, d.time.indexOf(prefix)) : 0;
  const code = daten.current.weather_code ?? 3;
  return {
    temperatur: Math.round(daten.current.temperature_2m),
    code,
    tag: daten.current.is_day !== 0,
    zustand: zustand(code),
    morgen: tag === 1,
    min: d ? Math.round(d.temperature_2m_min[di]) : null,
    max: d ? Math.round(d.temperature_2m_max[di]) : null,
    zielCode: d && d.weather_code ? d.weather_code[di] : code,
    verlauf,
    empfehlung: empfehlung(stunden, stufen, regenSchwelle),
  };
}

export async function ladeWetter(stufen, regenSchwelle, ort = 'garching') {
  const [LAT, LON] = await standort(ort);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
    + '&current=temperature_2m,weather_code,is_day'
    + '&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code'
    + '&daily=temperature_2m_max,temperature_2m_min,weather_code'
    + '&forecast_days=2&timezone=Europe%2FBerlin';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Wetter: Status ${r.status}`);
  return auswerten(await r.json(), new Date(), stufen, regenSchwelle);
}
