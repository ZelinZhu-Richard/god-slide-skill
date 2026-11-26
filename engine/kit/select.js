// The editor selection box: the signature motif. The presenter "edits" the world:
// selects a word, a chart, the Sun. Thin blue frame, hollow circle handles, a rotation knob.
//
//   const box = ctx.select();             // lives in this scene's layer
//   box.wrap('#better', 22);              // frame an element (stage units of padding)
//   box.show(s.k(1, 0.2, 0.9, ease.linear));  // in update(): 0..1 appear with an overshoot
import { ease, clamp, lerp } from '../core/ease.js';
import { stageRect } from '../core/dom.js';

export function createSelect(layer, opts = {}) {
  const o = { color: null, handles: true, knob: true, dashed: false, tag: '', glow: 0, ...opts };
  const el = document.createElement('div');
  el.className = 'gs-sel' + (o.dashed ? ' dashed' : '');
  if (o.color) el.style.setProperty('--sel', o.color);
  if (o.handles) for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) { const i = document.createElement('i'); i.className = h; el.append(i); }
  if (o.knob) { const b = document.createElement('b'); b.className = 'stem'; const k = document.createElement('i'); k.className = 'knob'; el.append(b, k); }
  if (o.tag) { const t = document.createElement('span'); t.className = 'gs-sel-tag'; t.textContent = o.tag; el.append(t); }
  el.style.opacity = 0;
  layer.append(el);
  const r = { x: 0, y: 0, w: 10, h: 10, rot: 0 };
  const handles = [...el.querySelectorAll('i')];
  let shown = -1;
  const box = {
    el,
    rect(x, y, w, h, rot = 0) {
      Object.assign(r, { x, y, w, h, rot });
      el.style.width = w + 'px'; el.style.height = h + 'px';
      el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
      return box;
    },
    /** Frame an element (selector or node) with padding, in stage units. */
    wrap(target, pad = 18, padY = pad * 0.6) {
      const t = typeof target === 'string' ? layer.querySelector(target) : target;
      const q = stageRect(t, layer);
      return box.rect(q.x - pad, q.y - padY, q.w + pad * 2, q.h + padY * 2, r.rot);
    },
    /** Tween between two rects (objects with x,y,w,h[,rot]) by t in 0..1. */
    tween(a, b, t) {
      return box.rect(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.w, b.w, t), lerp(a.h, b.h, t), lerp(a.rot || 0, b.rot || 0, t));
    },
    /** Appear (0..1): frame fades in fast, handles pop with an overshoot. */
    show(e) {
      e = clamp(e);
      if (Math.abs(e - shown) < 1e-4) return box;
      shown = e;
      el.style.opacity = Math.min(1, e * 3);
      const s = Math.max(0.01, ease.outBack(e, 2.2));
      for (const h of handles) h.style.transform = `scale(${s})`;
      if (o.glow) el.style.boxShadow = `0 0 ${24 * o.glow}px rgba(43,92,255,${0.5 * o.glow * e})`;
      return box;
    },
    hide() { return box.show(0); },
    get r() { return { ...r }; },
  };
  return box;
}
