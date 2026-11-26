// The deliberately boring chart: default-office look (blue/orange/grey, light gridlines,
// legend at the bottom). For the "boring opener" device, where the deck starts as the
// dullest possible slide before it breaks open.
//
//   html: `<div class="office-chart" id="chart"></div>`
//   create(ctx){ kit.officeChart(ctx.$('#chart'), { labels:['2021','2022','2023','2024'], series:[{name:'Adoption', values:[3,5,8,13]}] }) }
const PALETTE = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];

export function officeChart(el, { type = 'bar', labels = [], series = [], title = '', yMax = null, w = 1460, h = 700, unit = '' } = {}) {
  const pad = { l: 110, r: 40, t: title ? 90 : 40, b: 130 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const all = series.flatMap((s) => s.values);
  const top = yMax ?? niceMax(Math.max(...all, 1));
  const ticks = 5;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="font-family:Arial,Arimo,'Liberation Sans',Helvetica,sans-serif">`;
  if (title) svg += `<text x="${w / 2}" y="52" text-anchor="middle" font-size="40" fill="#595959">${esc(title)}</text>`;
  for (let i = 0; i <= ticks; i++) {
    const y = pad.t + ch - (ch * i) / ticks;
    svg += `<line x1="${pad.l}" x2="${pad.l + cw}" y1="${y}" y2="${y}" stroke="#D9D9D9" stroke-width="1.5"/>`;
    svg += `<text x="${pad.l - 18}" y="${y + 10}" text-anchor="end" font-size="28" fill="#595959">${fmtTick((top * i) / ticks)}${unit}</text>`;
  }
  const n = labels.length, gw = cw / Math.max(1, n);
  if (type === 'bar') {
    const bw = (gw * 0.62) / series.length;
    series.forEach((s, si) => s.values.forEach((v, i) => {
      const bh = (ch * v) / top, x = pad.l + gw * i + gw * 0.19 + bw * si;
      svg += `<rect x="${x}" y="${pad.t + ch - bh}" width="${bw - 4}" height="${bh}" fill="${PALETTE[si % PALETTE.length]}"/>`;
    }));
  } else {
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => `${pad.l + gw * (i + 0.5)},${pad.t + ch - (ch * v) / top}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="6" stroke-linejoin="round"/>`;
      s.values.forEach((v, i) => { svg += `<circle cx="${pad.l + gw * (i + 0.5)}" cy="${pad.t + ch - (ch * v) / top}" r="8" fill="${PALETTE[si % PALETTE.length]}"/>`; });
    });
  }
  labels.forEach((l, i) => { svg += `<text x="${pad.l + gw * (i + 0.5)}" y="${pad.t + ch + 44}" text-anchor="middle" font-size="28" fill="#595959">${esc(l)}</text>`; });
  const lx0 = w / 2 - series.length * 110;
  series.forEach((s, si) => {
    const x = lx0 + si * 220;
    svg += `<rect x="${x}" y="${h - 46}" width="22" height="22" fill="${PALETTE[si % PALETTE.length]}"/><text x="${x + 32}" y="${h - 27}" font-size="28" fill="#595959">${esc(s.name || 'Series ' + (si + 1))}</text>`;
  });
  svg += '</svg>';
  el.innerHTML = svg;
  return el.firstChild;
}

function niceMax(v) { const e = 10 ** Math.floor(Math.log10(v)); const m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }
function fmtTick(v) { return Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : +v.toFixed(2) + ''; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
