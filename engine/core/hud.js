// The counter in the bottom-right corner. It is a second narrator: page numbers by default,
// or anything that grows with the talk (Fibonacci pages, years, dollars...).
export const FONT_ROLES = {
  mono: '500 22px "Geist Mono", ui-monospace, monospace',
  arial: '400 22px Arial, Arimo, "Liberation Sans", Helvetica, sans-serif',
  display: '300 22px Unbounded, sans-serif',
  text: '500 22px Geist, system-ui, sans-serif',
  pixel: '400 22px Silkscreen, monospace',
  jb: '700 22px "JetBrains Mono", monospace',
};

export function createHud(root) {
  const el = document.createElement('div');
  el.id = 'gs-hud';
  el.innerHTML = '<span class="gs-hud-cur"></span><span class="gs-hud-old"></span>';
  root.append(el);
  const cur = el.firstChild, old = el.lastChild;
  let label = null, font = '', color = '', t = 1;
  return {
    el,
    layout(view) {
      el.style.transform = `translate(${-60 * view.scale}px, ${-54 * view.scale}px) scale(${view.scale})`;
    },
    set(text, { color: c = '#ffffff', font: f = 'mono', alpha = 0.75 } = {}) {
      text = text == null ? '' : String(text);
      if (f !== font) { font = f; el.style.font = FONT_ROLES[f] || f; }
      if (c !== color) { color = c; el.style.color = c; }
      el.style.opacity = alpha;
      if (text !== label) {
        old.textContent = label ?? '';
        cur.textContent = text;
        label = text;
        t = font === 'arial' ? 1 : 0;
      }
    },
    tick(dt) {
      if (t >= 1) { old.style.opacity = 0; cur.style.transform = ''; return; }
      t = Math.min(1, t + dt * 2.2);
      const e = 1 - (1 - t) ** 4;
      cur.style.transform = `translateY(${(1 - e) * 1.1}em)`;
      cur.style.opacity = e;
      old.style.transform = `translateY(${-e * 1.1}em)`;
      old.style.opacity = 1 - e;
    },
    hide(h) { el.style.display = h ? 'none' : ''; },
  };
}
