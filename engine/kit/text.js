// Type in the world and type that counts.
//
//   kit.textMesh('30', { font: 'display', weight: 300, height: 6, color: '#2b2b2b' })  -> a lit plane
//   const odo = kit.odometer(ctx.$('#years'), { decimals: 1 }); odo.set(14.37)   -> rolling digits
import * as THREE from 'three';

const ROLES = {
  display: ['Unbounded', 300], displayBold: ['Unbounded', 800], text: ['Geist', 400], textMed: ['Geist', 500],
  mono: ['"Geist Mono"', 500], serif: ['Newsreader', 400], anton: ['Anton', 400], pixel: ['Silkscreen', 400],
  jb: ['"JetBrains Mono"', 700], arial: ['Arial, Arimo, "Liberation Sans", Helvetica', 400],
};

export function textCanvas(text, { font = 'display', weight, size = 200, color = '#ffffff', align = 'left', leading = 1.15, pad = 0.25, italic = false, tracking = 0 } = {}) {
  const [fam, w0] = ROLES[font] || [font, 400];
  const css = `${italic ? 'italic ' : ''}${weight ?? w0} ${size}px ${fam}, sans-serif`;
  const lines = String(text).split('\n');
  const m = document.createElement('canvas').getContext('2d');
  m.font = css;
  if (tracking && 'letterSpacing' in m) m.letterSpacing = tracking * size + 'px';
  const widths = lines.map((l) => m.measureText(l).width);
  const P = Math.ceil(size * pad);
  const W = Math.ceil(Math.max(...widths)) + P * 2, H = Math.ceil(size * leading * lines.length) + P * 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.font = css; g.fillStyle = color; g.textBaseline = 'alphabetic';
  if (tracking && 'letterSpacing' in g) g.letterSpacing = tracking * size + 'px';
  lines.forEach((l, i) => {
    const x = align === 'center' ? (W - widths[i]) / 2 : align === 'right' ? W - P - widths[i] : P;
    g.fillText(l, x, P + size * (0.88 + i * leading));
  });
  return { canvas: c, width: W, height: H, pad: P };
}

export function textTexture(text, opts) {
  const r = textCanvas(text, opts);
  const t = new THREE.CanvasTexture(r.canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, aspect: r.width / r.height, ...r };
}

/** A plane with text on it, `height` world units tall (one line, including padding). */
export function textMesh(text, { height = 1, lit = false, opacity = 1, ...opts } = {}) {
  const r = textTexture(text, opts);
  const lines = String(text).split('\n').length;
  const H = height * lines * (r.height / lines) / ((opts.size || 200) * 1.15);
  const W = H * r.aspect;
  const mat = lit
    ? new THREE.MeshStandardMaterial({ map: r.texture, transparent: true, roughness: 0.9, opacity, depthWrite: false })
    : new THREE.MeshBasicMaterial({ map: r.texture, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  mesh.userData.size = { w: W, h: H };
  return mesh;
}

/**
 * Rolling-digit counter in a DOM element (like an odometer, last digit rolls smoothly).
 * set(value) every frame; digits carry like real wheels.
 */
export function odometer(el, { decimals = 0, comma = true, minDigits = 1 } = {}) {
  el.classList.add('num');
  el.style.display = el.style.display || 'inline-block';
  let cols = [], lastLen = -1;
  const build = (len) => {
    el.textContent = '';
    cols = [];
    for (let i = 0; i < len; i++) {
      const wrap = document.createElement('span');
      wrap.style.cssText = 'display:inline-block;overflow:hidden;height:1.1em;line-height:1.1em;vertical-align:top;position:relative';
      const strip = document.createElement('span');
      strip.style.cssText = 'display:block;will-change:transform';
      strip.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<span style="display:block">${d}</span>`).join('');
      wrap.append(strip); el.append(wrap); cols.push({ wrap, strip, sep: null });
    }
    lastLen = len;
  };
  return {
    set(v) {
      v = Math.max(0, v);
      const scaled = v * 10 ** decimals;
      const intDigits = Math.max(minDigits + decimals, Math.floor(scaled).toString().length);
      if (intDigits !== lastLen) build(intDigits);
      // k = 0 is the last digit. It rolls continuously; every other wheel only turns while
      // the wheel to its right passes from 9 to 0 (a real odometer carry).
      let prev = 0;
      for (let k = 0; k < intDigits; k++) {
        const col = cols[intDigits - 1 - k];
        const shown = k === 0 ? scaled % 10 : (Math.floor(scaled / 10 ** k) % 10) + Math.max(0, prev - 9);
        col.strip.style.transform = `translateY(${-shown * 1.1}em)`;
        prev = shown;
      }
      // separators
      el.querySelectorAll('.odo-sep').forEach((s) => s.remove());
      if (decimals > 0) { const s = document.createElement('span'); s.className = 'odo-sep'; s.textContent = '.'; cols[intDigits - decimals].wrap.before(s); }
      if (comma) {
        const intPart = intDigits - decimals;
        for (let i = intPart - 3; i > 0; i -= 3) { const s = document.createElement('span'); s.className = 'odo-sep'; s.textContent = ','; cols[i].wrap.before(s); }
      }
      return this;
    },
  };
}
