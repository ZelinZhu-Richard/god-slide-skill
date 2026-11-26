// HTML type layer. Every scene gets a 1920x1080 <section>, scaled to fit the window
// (letterboxed), so text is always laid out in the same "stage units" no matter the screen.
// Elements with data-beat reveal themselves on that beat's timeline.
//
//   <h1 class="display" data-beat="0" data-delay="0.4">Let go.</h1>
//   data-beat   beat index that reveals it
//   data-fx     rise | chars | fade | up | blur | pop | wipe | wipe-up | type | count | draw | grow | grow-x | none
//   data-delay  seconds into the beat (default 0)
//   data-dur    reveal length in seconds (default depends on fx)
//   data-until  beat index that hides it again (optional)
//   data-stagger per-line / per-char stagger in seconds
//   count:  data-from, data-to, data-format (comma|fixed|sci|auto), data-decimals
import { ease, clamp, fmt } from './ease.js';

export const STAGE_W = 1920, STAGE_H = 1080;

export function createStage(root) {
  const stage = document.createElement('div');
  stage.id = 'gs-stage';
  root.append(stage);
  const view = { x0: 0, y0: 0, x1: STAGE_W, y1: STAGE_H, w: STAGE_W, h: STAGE_H, scale: 1, left: 0, top: 0, W: STAGE_W, H: STAGE_H };
  function layout(W, H) {
    const scale = Math.min(W / STAGE_W, H / STAGE_H);
    const left = (W - STAGE_W * scale) / 2, top = (H - STAGE_H * scale) / 2;
    stage.style.transform = `translate(${left}px,${top}px) scale(${scale})`;
    Object.assign(view, { scale, left, top, W, H, x0: -left / scale, y0: -top / scale, x1: (W - left) / scale, y1: (H - top) / scale });
    view.w = view.x1 - view.x0;
    view.h = view.y1 - view.y0;
  }
  return { stage, view, layout };
}

const DEFAULT_FX = (el) => {
  const t = el.tagName;
  if (/^H[1-3]$/.test(t) || el.classList.contains('display')) return 'rise';
  return 'up';
};
const DUR = { rise: 1.1, chars: 0.9, fade: 0.8, up: 0.9, down: 0.9, blur: 1.1, pop: 0.7, wipe: 1.0, 'wipe-up': 1.0, type: 0, count: 2.0, draw: 1.6, grow: 1.2, 'grow-x': 1.2, none: 0.001 };
const STAGGER = { rise: 0.09, chars: 0.028 };

// Wrap every word of every text node (keeping nested inline markup) in a mask span.
function splitWords(el) {
  const words = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); continue; }
          const m = document.createElement('span'); m.className = 'gs-wm';
          const w = document.createElement('span'); w.className = 'gs-wi'; w.textContent = part;
          m.append(w); frag.append(m); words.push(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && (child.hasAttribute('data-beat') || child.classList.contains('gs-keep'))) {
        // an element with its own reveal (e.g. a count-up) rides in one mask with its line
        const m = document.createElement('span'); m.className = 'gs-wm';
        const w = document.createElement('span'); w.className = 'gs-wi';
        child.before(m); m.append(w); w.append(child); words.push(w);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    }
  };
  walk(el);
  return words;
}

function splitChars(words) {
  const chars = [];
  for (const w of words) {
    const text = w.textContent; w.textContent = '';
    for (const ch of text) {
      const c = document.createElement('span'); c.className = 'gs-ci'; c.textContent = ch;
      w.append(c); chars.push(c);
    }
  }
  return chars;
}

function splitType(el) {
  const chars = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent) {
          const c = document.createElement('span'); c.className = 'gs-ti'; c.textContent = ch;
          frag.append(c); chars.push(c);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    }
  };
  walk(el);
  const caret = document.createElement('span'); caret.className = 'gs-caret';
  el.append(caret);
  return { chars, caret };
}

/** Line index per word, from layout (call after fonts are ready). */
function lineIndex(words) {
  let line = -1, lastTop = -1e9;
  return words.map((w) => {
    const top = w.parentElement.offsetTop;
    if (Math.abs(top - lastTop) > 4) { line++; lastTop = top; }
    return line;
  });
}

/** Parse reveal items in a layer. Safe to call once per layer, after fonts load. */
export function prepareLayer(layer) {
  const items = [];
  for (const el of layer.querySelectorAll('[data-beat]')) {
    const fx = el.dataset.fx || DEFAULT_FX(el);
    const it = {
      el, fx,
      beat: +el.dataset.beat,
      delay: +(el.dataset.delay || 0),
      dur: el.dataset.dur != null ? +el.dataset.dur : DUR[fx] ?? 0.9,
      until: el.dataset.until != null ? +el.dataset.until : null,
      outDelay: +(el.dataset.outDelay || 0),
      outDur: el.dataset.outDur != null ? +el.dataset.outDur : 0.6,
      stagger: el.dataset.stagger != null ? +el.dataset.stagger : STAGGER[fx] ?? 0.05,
      last: -1,
    };
    if (fx === 'rise' || fx === 'chars') {
      const words = splitWords(el);
      it.words = words;
      it.unit = it.dur;
      if (fx === 'chars') {
        it.parts = splitChars(words);
        it.dur = it.unit + Math.max(0, it.parts.length - 1) * it.stagger;
      } else {
        const li = lineIndex(words);
        it.parts = words; it.order = li;
        it.dur = it.unit + (li.length ? li[li.length - 1] : 0) * it.stagger;
      }
      el.style.opacity = 1;
    } else if (fx === 'type') {
      const { chars, caret } = splitType(el);
      it.parts = chars; it.caret = caret;
      if (!el.dataset.dur) it.dur = Math.max(0.3, chars.length * (+el.dataset.speed || 0.055));
      it.keepCaret = el.dataset.caret === 'keep';
      el.style.opacity = 1;
    } else if (fx === 'count') {
      it.from = +(el.dataset.from || 0);
      it.to = +(el.dataset.to ?? (parseFloat(el.textContent.replace(/[^0-9.\-]/g, '')) || 0));
      it.format = el.dataset.format || 'comma';
      it.decimals = +(el.dataset.decimals || 0);
    } else if (fx === 'draw') {
      it.paths = [...el.querySelectorAll('path,line,polyline,circle,rect')].map((p) => {
        const len = p.getTotalLength ? p.getTotalLength() : 1000;
        p.style.strokeDasharray = `${len} ${len}`;
        return { p, len };
      });
    }
    items.push(it);
    apply(it, 0, 0);
  }
  return items;
}

const T = (el, v) => { el.style.transform = v; };

function apply(it, e, eo) {
  const { el, fx } = it;
  const vis = e * (1 - eo);
  switch (fx) {
    case 'rise': {
      const n = it.parts.length;
      for (let i = 0; i < n; i++) {
        const k = it.order ? it.order[i] : i;
        const raw = clamp((e * it.dur - k * it.stagger) / it.unit);
        const ein = ease.out4(raw);
        const eout = ease.in3(eo);
        T(it.parts[i], `translate3d(0,${(1 - ein) * 112 - eout * 112}%,0)`);
      }
      el.style.opacity = eo >= 1 ? 0 : 1;
      el.style.visibility = e <= 0 ? 'hidden' : '';
      break;
    }
    case 'chars': {
      const n = it.parts.length;
      for (let i = 0; i < n; i++) {
        const raw = clamp((e * it.dur - i * it.stagger) / it.unit);
        const ein = ease.out4(raw);
        T(it.parts[i], `translate3d(0,${(1 - ein) * 110 - ease.in3(eo) * 110}%,0)`);
      }
      el.style.visibility = e <= 0 ? 'hidden' : '';
      el.style.opacity = eo >= 1 ? 0 : 1;
      break;
    }
    case 'type': {
      const n = it.parts.length;
      const shown = Math.round(clamp(e) * n);
      for (let i = 0; i < n; i++) it.parts[i].style.visibility = i < shown ? 'visible' : 'hidden';
      const typing = e > 0 && e < 1;
      it.caret.style.display = (typing || (it.keepCaret && e >= 1) || (e > 0 && it.keepCaret)) && eo < 1 ? '' : 'none';
      it.caret.classList.toggle('gs-blink', !typing);
      // keep the caret right after the last visible char
      if (shown < n) it.parts[shown].before(it.caret); else it.parts[n - 1]?.after(it.caret);
      el.style.opacity = 1 - eo;
      break;
    }
    case 'count': {
      const v = it.from + (it.to - it.from) * ease.out3(e);
      el.textContent = fmt(v, it.format, it.decimals);
      el.style.opacity = Math.min(1, e * 4) * (1 - eo);
      break;
    }
    case 'draw':
      for (const { p, len } of it.paths) p.style.strokeDashoffset = len * (1 - ease.io3(e));
      el.style.opacity = (e > 0 ? 1 : 0) * (1 - eo);
      break;
    case 'fade': el.style.opacity = ease.out3(e) * (1 - ease.io2(eo)); break;
    case 'up': el.style.opacity = ease.out3(e) * (1 - ease.io2(eo)); T(el, `translate3d(0,${(1 - ease.out4(e)) * 36 - ease.in2(eo) * 20}px,0)`); break;
    case 'down': el.style.opacity = ease.out3(e) * (1 - ease.io2(eo)); T(el, `translate3d(0,${-(1 - ease.out4(e)) * 36}px,0)`); break;
    case 'blur':
      el.style.opacity = ease.out3(e) * (1 - ease.io2(eo));
      el.style.filter = `blur(${(1 - ease.out3(e)) * 16 + eo * 10}px)`;
      break;
    case 'pop': el.style.opacity = Math.min(1, e * 3) * (1 - eo); T(el, `scale(${0.82 + 0.18 * ease.outBack(e)})`); break;
    case 'wipe': el.style.opacity = 1 - eo; el.style.clipPath = `inset(-20% ${(1 - ease.io3(e)) * 100}% -20% -1%)`; break;
    case 'wipe-up': el.style.opacity = 1 - eo; el.style.clipPath = `inset(${(1 - ease.io3(e)) * 100}% -5% -5% -5%)`; break;
    case 'grow': el.style.opacity = e > 0 ? 1 - eo : 0; T(el, `scaleY(${ease.out4(e)})`); el.style.transformOrigin = '50% 100%'; break;
    case 'grow-x': el.style.opacity = e > 0 ? 1 - eo : 0; T(el, `scaleX(${ease.out4(e)})`); el.style.transformOrigin = '0 50%'; break;
    default: el.style.opacity = vis > 0 ? 1 : 0;
  }
}

/** Drive all reveal items of a layer from the scene state. */
export function applyLayer(items, s) {
  if (!items) return;
  for (const it of items) {
    const b = Math.min(it.beat, s.n - 1);
    const tIn = (s.tl ? s.tl(b) : s.at(b)) - it.delay;
    const e = clamp(tIn / Math.max(1e-3, it.dur));
    let eo = 0;
    if (it.until != null && it.until < s.n) eo = clamp(((s.tl ? s.tl(it.until) : s.at(it.until)) - it.outDelay) / Math.max(1e-3, it.outDur));
    const key = e * 1000 + eo;
    if (key === it.last) continue;
    it.last = key;
    apply(it, e, eo);
  }
}

/** Position of an element in stage units, from layout (ignores transforms). */
export function stageRect(el, layer) {
  let x = 0, y = 0, n = el;
  while (n && n !== layer) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** A DOM element that follows a 3D point (or a stage-unit position). */
export function createPin(el, view) {
  el.classList.add('gs-pin');
  const tmp = { x: 0, y: 0, z: 0 };
  return {
    el,
    visible: true,
    set(x, y) { el.style.transform = `translate3d(${x}px,${y}px,0)`; return this; },
    /** v: THREE.Vector3 (world), camera: THREE.Camera. Returns stage coords. */
    at(v, camera) {
      const p = v.clone().project(camera);
      const behind = p.z > 1 || p.z < -1;
      const x = view.x0 + (p.x * 0.5 + 0.5) * view.w;
      const y = view.y0 + (-p.y * 0.5 + 0.5) * view.h;
      el.style.visibility = behind ? 'hidden' : '';
      tmp.x = x; tmp.y = y; tmp.z = p.z;
      this.set(x, y);
      return tmp;
    },
    alpha(a) { el.style.opacity = a; return this; },
  };
}
