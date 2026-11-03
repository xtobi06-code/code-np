// Lebendiger Hintergrund: Hügelketten wie im Bayerischen Wald, Himmel nach Sonnenstand und Wetter.
import { mischen } from './util.js';

const RAD = Math.PI / 180;

export function sonnenstand(d = new Date(), lat = 48.25, lon = 11.65) {
  const t = d.getTime() / 864e5 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * t) % 360;
  const g = ((357.528 + 0.9856003 * t) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * t) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = ((280.46061837 + 360.98564736629 * t) % 360) * RAD;
  const ha = gmst + lon * RAD - ra;
  const phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const azS = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { el: el / RAD, az: ((azS / RAD + 180) % 360 + 360) % 360 };
}

const KEYS = [
  { el: -18, oben: '#02040b', mitte: '#060b1c', horizont: '#0e1630', dunkel: '#010207', nebel: '#1a2342', glanz: '#000000', sterne: 1 },
  { el: -9, oben: '#060f2c', mitte: '#132152', horizont: '#323a73', dunkel: '#03050d', nebel: '#2b3364', glanz: '#1a1430', sterne: 0.7 },
  { el: -4, oben: '#112152', mitte: '#3f4686', horizont: '#b76a72', dunkel: '#080a17', nebel: '#62597f', glanz: '#ff7d5c', sterne: 0.2 },
  { el: 0, oben: '#1d3a78', mitte: '#7569a0', horizont: '#f0965f', dunkel: '#100f22', nebel: '#c39e9d', glanz: '#ffa868', sterne: 0 },
  { el: 5, oben: '#2a5aa3', mitte: '#86a9d4', horizont: '#ffcf96', dunkel: '#15202c', nebel: '#f0d9c3', glanz: '#ffd394', sterne: 0 },
  { el: 14, oben: '#2c6cc2', mitte: '#7cafe2', horizont: '#d6e6f1', dunkel: '#13212a', nebel: '#e6eef4', glanz: '#fff1d2', sterne: 0 },
  { el: 45, oben: '#2668cc', mitte: '#70a8e6', horizont: '#cfe3f5', dunkel: '#122028', nebel: '#edf3f8', glanz: '#ffffff', sterne: 0 },
];
const FARBEN = ['oben', 'mitte', 'horizont', 'dunkel', 'nebel', 'glanz'];

export function palette(el, code = 0) {
  let i = 0;
  while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (el - a.el) / (b.el - a.el)));
  const p = { sterne: a.sterne + (b.sterne - a.sterne) * t };
  for (const k of FARBEN) p[k] = mischen(a[k], b[k], t);
  // Wetter: Wolken entsättigen und dämpfen den Himmel
  const bedeckt = code === 2 ? 0.2 : code === 3 ? 0.5 : code === 45 || code === 48 ? 0.55 : code >= 51 ? 0.62 : 0;
  if (bedeckt) {
    const hell = Math.max(0, Math.min(1, (el + 6) / 20));
    const grau = mischen('#1c2029', '#9ba3ae', hell);
    for (const k of ['oben', 'mitte', 'horizont', 'glanz']) p[k] = mischen(p[k], grau, bedeckt);
    p.nebel = mischen(p.nebel, grau, bedeckt * 0.6);
    p.sterne *= 1 - bedeckt * 1.4;
  }
  p.sterne = Math.max(0, p.sterne);
  p.bedeckt = bedeckt;
  p.regen = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  p.schnee = (code >= 71 && code <= 77) || code === 85 || code === 86;
  p.nebelStark = code === 45 || code === 48;
  return p;
}

function zufall(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const W = 1600;
const H = 1000;
function kette(r, basis, amp, baeume) {
  const wellen = Array.from({ length: 5 }, (_, i) => ({ f: ((0.55 + r() * 0.9) * (i + 1) * Math.PI * 2) / W, p: r() * Math.PI * 2, a: amp / (i * 1.7 + 1) }));
  const hoehe = (x) => basis - wellen.reduce((s, w) => s + w.a * (0.5 + 0.5 * Math.sin(w.f * x + w.p)), 0);
  const pkt = [];
  if (!baeume) {
    for (let x = -20; x <= W + 20; x += 8) pkt.push([x, hoehe(x)]);
  } else {
    let x = -20;
    while (x <= W + 20) {
      const y = hoehe(x);
      const h = baeume[0] + r() * (baeume[1] - baeume[0]);
      const w = h * (0.22 + r() * 0.1);
      pkt.push([x - w, y], [x - w * 0.15, y - h * 0.82], [x, y - h], [x + w * 0.15, y - h * 0.82], [x + w, y]);
      x += w * (1.2 + r() * 0.9);
    }
  }
  return `M-20,${H} ` + pkt.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W + 20},${H} Z`;
}

const EBENEN = [
  { basis: 610, amp: 105, mix: 0.12, baeume: [2, 4] },
  { basis: 670, amp: 95, mix: 0.3, baeume: [3, 6] },
  { basis: 740, amp: 90, mix: 0.5, baeume: [5, 11] },
  { basis: 830, amp: 85, mix: 0.72, baeume: [10, 22] },
  { basis: 935, amp: 75, mix: 0.92, baeume: [22, 48] },
];
const NEBEL = [{ nach: 0, top: 53, hoehe: 14, dauer: 300, deck: 0.5 }, { nach: 2, top: 64, hoehe: 15, dauer: 220, deck: 0.42 }, { nach: 3, top: 76, hoehe: 16, dauer: 160, deck: 0.32 }];

function nebelBild() {
  const r = zufall(7);
  const teile = [];
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 8.5 + r() * 3;
    const y = 45 + r() * 15;
    const w = 12 + r() * 10;
    for (const off of [0, 50]) teile.push(`radial-gradient(ellipse ${w}% ${55 + r() * 20}% at ${x + off}% ${y}%, var(--nebel) 0%, transparent 72%)`);
  }
  return teile.join(',');
}

export function erstelleSzene(root) {
  const r = zufall(1979);
  const sterne = Array.from({ length: 140 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 600).toFixed(0)}" r="${(0.5 + r() * r() * 1.6).toFixed(2)}" fill="#fff" opacity="${(0.35 + r() * 0.65).toFixed(2)}"/>`).join('');
  const pfade = EBENEN.map((e) => kette(r, e.basis, e.amp, e.baeume));
  const nb = nebelBild();
  let html = `<div class="sz-himmel"></div>
    <svg class="sz-ebene sz-sterne" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">${sterne}</svg>
    <div class="sz-sonne"><i></i></div>`;
  EBENEN.forEach((e, i) => {
    html += `<svg class="sz-ebene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><path d="${pfade[i]}"/></svg>`;
    NEBEL.filter((n) => n.nach === i).forEach((n) => {
      html += `<div class="sz-nebel" style="top:${n.top}%;height:${n.hoehe}%;--deck:${n.deck}"><div style="background:${nb};animation-duration:${n.dauer}s"></div></div>`;
    });
  });
  html += '<div class="sz-regen"><div></div></div><div class="sz-schnee"><div></div></div><div class="sz-foto"><img alt=""><img alt=""></div><div class="sz-schleier"></div>';
  root.innerHTML = html;
  root.classList.add('szene');
  const himmel = root.querySelector('.sz-himmel');
  const sonne = root.querySelector('.sz-sonne');
  const sternSvg = root.querySelector('.sz-sterne');
  const ebenen = [...root.querySelectorAll('.sz-ebene:not(.sz-sterne) path')];
  const fotoBox = root.querySelector('.sz-foto');
  const bilder = [...fotoBox.querySelectorAll('img')];
  let fotos = [];
  let fotoIndex = 0;
  let fotoTimer = null;

  function aktualisiere(jetzt = new Date(), code = 0) {
    const { el, az } = sonnenstand(jetzt);
    const p = palette(el, code);
    himmel.style.background = `linear-gradient(180deg, ${p.oben} 0%, ${p.mitte} 42%, ${p.horizont} 70%, ${p.horizont} 100%)`;
    root.style.setProperty('--nebel', p.nebel);
    root.style.setProperty('--glanz', p.glanz);
    sternSvg.style.opacity = p.sterne.toFixed(2);
    const ferne = mischen(mischen(p.mitte, p.horizont, 0.35), p.nebel, 0.2);
    ebenen.forEach((pf, i) => {
      pf.style.fill = mischen(ferne, p.dunkel, EBENEN[i].mix);
    });
    const x = Math.max(4, Math.min(96, ((az - 90) / 180) * 100));
    const y = 62 - (Math.max(-8, el) / 32) * 50;
    const mond = el < -7;
    sonne.classList.toggle('mond', mond);
    sonne.style.left = mond ? '78%' : `${x}%`;
    sonne.style.top = mond ? '17%' : `${y}%`;
    sonne.style.opacity = mond ? (0.9 - p.bedeckt) : el > -7 ? Math.min(1, (el + 7) / 6) * (1 - p.bedeckt * 0.9) : 0;
    const morgenNebel = el > -6 && el < 12 && az < 180 ? 1 : 0.55;
    root.style.setProperty('--nebel-staerke', (p.nebelStark ? 1.6 : morgenNebel).toFixed(2));
    root.classList.toggle('regnet', p.regen);
    root.classList.toggle('schneit', p.schnee);
    root.classList.toggle('nacht', el < -6);
    return { el, p };
  }

  function zeigeFoto() {
    if (!fotos.length) return;
    const neu = bilder[fotoIndex % 2];
    const alt = bilder[(fotoIndex + 1) % 2];
    neu.onload = () => { neu.classList.add('an'); alt.classList.remove('an'); };
    neu.src = fotos[fotoIndex % fotos.length];
    fotoIndex++;
  }
  function setzeFotos(urls, minuten = 15) {
    fotos = urls || [];
    clearInterval(fotoTimer);
    root.classList.toggle('mit-foto', fotos.length > 0);
    if (fotos.length) {
      zeigeFoto();
      if (fotos.length > 1) fotoTimer = setInterval(zeigeFoto, minuten * 60000);
    }
  }
  function bewegung(an) { root.classList.toggle('still', !an); }

  return { aktualisiere, setzeFotos, bewegung };
}
