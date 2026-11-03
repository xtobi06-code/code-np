const LAT = 48.25;
const LON = 11.65;

// Schwellen auf die gefühlte Temperatur (°C), bewusst früh: Jacke an, bevor es zu kalt wird.
export const KLEIDUNG_STANDARD = [
  { bis: 3, text: 'Winterjacke, Mütze, Handschuhe' },
  { bis: 9, text: 'Winterjacke, Pullover' },
  { bis: 15, text: 'Jacke, Pullover' },
  { bis: 20, text: 'Leichte Jacke' },
  { bis: 99, text: 'T-Shirt' },
];
export const REGEN_SCHWELLE = 40;

export function empfehlung(stunden, stufen = KLEIDUNG_STANDARD, regenSchwelle = REGEN_SCHWELLE) {
  if (!stunden.length) return null;
  const kaelteste = Math.min(...stunden.map((s) => s.gefuehlt));
  const regen = Math.max(...stunden.map((s) => s.regen ?? 0));
  const sortiert = [...stufen].sort((a, b) => a.bis - b.bis);
  const stufe = sortiert.find((s) => kaelteste < s.bis) || sortiert[sortiert.length - 1];
  return { kaelteste, regen, kleidung: stufe.text, schirm: regen >= regenSchwelle };
}

export function auswerten(daten, jetzt = new Date(), stufen, regenSchwelle) {
  const tag = jetzt.getHours() >= 19 ? 1 : 0;
  const ziel = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tag);
  const prefix = `${ziel.getFullYear()}-${String(ziel.getMonth() + 1).padStart(2, '0')}-${String(ziel.getDate()).padStart(2, '0')}`;
  const stunden = [];
  daten.hourly.time.forEach((t, i) => {
    if (!t.startsWith(prefix)) return;
    const h = Number(t.slice(11, 13));
    if (h < 7 || h > 20) return;
    stunden.push({ gefuehlt: daten.hourly.apparent_temperature[i], regen: daten.hourly.precipitation_probability[i] });
  });
  return {
    temperatur: Math.round(daten.current.temperature_2m),
    code: daten.current.weather_code ?? 3,
    morgen: tag === 1,
    empfehlung: empfehlung(stunden, stufen, regenSchwelle),
  };
}

export async function ladeWetter(stufen, regenSchwelle) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
    + '&current=temperature_2m,weather_code&hourly=apparent_temperature,precipitation_probability'
    + '&forecast_days=2&timezone=Europe%2FBerlin';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Wetter: Status ${r.status}`);
  return auswerten(await r.json(), new Date(), stufen, regenSchwelle);
}
