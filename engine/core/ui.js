// Presenter chrome: keyboard, click/touch, notes panel, presenter window, overview grid,
// help card, toasts, black screen, URL hash, idle cursor. Nothing shows until asked for.
export const KEYS = [
  ['Next', '→  space  click'],
  ['Back', '←'],
  ['First / last', 'Home / End'],
  ['Full screen', 'F'],
  ['Play by itself', 'A'],
  ['Sound on or off', 'M'],
  ['Speaker notes', 'N'],
  ['Notes in a second window', 'P'],
  ['All slides', 'O'],
  ['Black screen', '. or B'],
  ['This help', '? or H'],
];

export function createUI(deck, root) {
  const el = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
  let notes = null, over = null, help = null, win = null, started = 0;
  const clock = () => {
    if (!started) return '0:00';
    const s = Math.floor((performance.now() - started) / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const toast = (msg) => {
    const t = el('gs-toast', msg); root.append(t);
    setTimeout(() => (t.style.opacity = 0), 1300);
    setTimeout(() => t.remove(), 1800);
  };

  function refresh() {
    const i = deck.info();
    const meta = `${clock()}<br>${i.index + 1} / ${i.count} · ${i.beat + 1} / ${i.beats}`;
    if (notes) { notes.querySelector('p').textContent = i.notes || ''; notes.querySelector('.meta').innerHTML = meta; }
    if (win && !win.closed) {
      const d = win.document;
      d.getElementById('s').textContent = i.title;
      d.getElementById('n').textContent = i.notes || '';
      d.getElementById('x').textContent = i.next ? 'Next: ' + i.next : '';
      d.getElementById('m').innerHTML = meta;
    }
  }
  function syncHash() {
    const i = deck.info();
    try { history.replaceState(null, '', '#' + i.id + (i.beat ? '/' + (i.beat + 1) : '')); } catch { /* sandboxed */ }
  }
  deck.on('move', () => { if (!started) started = performance.now(); refresh(); syncHash(); });
  setInterval(refresh, 1000);

  const toggleNotes = () => {
    if (notes) { notes.remove(); notes = null; return; }
    notes = el('gs-notes', '<p></p><div class="meta"></div>');
    root.append(notes); refresh();
  };
  const toggleOverview = () => {
    if (over) { over.remove(); over = null; return; }
    over = el('gs-over');
    deck.scenes.forEach((sc, k) => {
      const b = document.createElement('button');
      const th = deck.thumbURL(sc.id);
      b.innerHTML = `<div class="th"${th ? ` style="background-image:url(${th})"` : ''}>${th ? '' : `<em>${sc.title || sc.id}</em>`}</div><span>${k + 1}. ${sc.title || sc.id}</span>`;
      b.setAttribute('aria-current', deck.info().index === k);
      b.onclick = () => { toggleOverview(); deck.jump(sc.id); };
      over.append(b);
    });
    root.append(over);
    over.querySelector('[aria-current=true]')?.focus();
  };
  const toggleHelp = () => {
    if (help) { help.remove(); help = null; return; }
    help = el('gs-help', KEYS.map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join(''));
    root.append(help);
  };
  const openPresenter = () => {
    try {
      win = window.open('', 'gs-presenter', 'width=960,height=640');
      if (!win) throw new Error('blocked');
      win.document.title = 'Speaker notes — ' + (deck.title || '');
      win.document.body.innerHTML = '<style>body{margin:0;background:#101218;color:#f2f4f8;font:28px/1.45 system-ui,sans-serif;padding:40px;display:grid;gap:22px;align-content:start}#n{white-space:pre-line}#s,#m,#x{color:#a4abb8;font-size:20px;font-variant-numeric:tabular-nums}#x{white-space:pre-line;opacity:.8}</style><div id="s"></div><div id="n"></div><div id="x"></div><div id="m"></div>';
      win.document.onkeydown = onKey;
      refresh();
    } catch { if (!notes) toggleNotes(); }
  };

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    deck.audio.unlock();
    if (over && !['Escape', 'o', 'O'].includes(k)) return;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); if (!e.repeat) deck.next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); if (!e.repeat) deck.prev(); }
    else if (k === 'Home') deck.jump(0);
    else if (k === 'End') deck.jump(deck.scenes.length - 1);
    else if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
    else if (k === 'a' || k === 'A') { deck.setAuto(!deck.auto); toast(deck.auto ? 'Playing by itself' : 'Manual'); }
    else if (k === 'm' || k === 'M') { const on = deck.audio.toggle(); toast(on ? 'Sound on' : 'Sound off'); }
    else if (k === 'n' || k === 'N') toggleNotes();
    else if (k === 'p' || k === 'P') openPresenter();
    else if (k === 'o' || k === 'O') toggleOverview();
    else if (k === '?' || k === 'h' || k === 'H') toggleHelp();
    else if (k === '.' || k === 'b' || k === 'B') deck.toggleBlack();
    else if (k === 'Escape') { if (over) toggleOverview(); if (help) toggleHelp(); }
  }
  addEventListener('keydown', onKey);

  // Click / tap: advance, unless the scene is interactive or the pointer was dragged.
  let down = null;
  addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener('pointerup', (e) => {
    if (!down || e.target.closest('.gs-over,.gs-help,.gs-notes,button,a,input,textarea,[data-interactive]')) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
    const cur = deck.current();
    if (!moved && !(cur && cur.def.interactive)) {
      if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.3) deck.prev(); else deck.next();
    } else if (moved && e.pointerType === 'touch' && !(cur && cur.def.interactive)) {
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 60) (dx < 0 ? deck.next() : deck.prev());
    }
    down = null;
  });

  let idle;
  const wake = () => {
    document.body.classList.remove('gs-idle');
    clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.add('gs-idle'), 2200);
  };
  addEventListener('pointermove', wake); wake();

  addEventListener('hashchange', () => {
    const m = /^#([\w-]+)(?:\/(\d+))?$/.exec(location.hash);
    if (!m) return;
    const i = deck.info();
    const beat = m[2] ? +m[2] - 1 : 0;
    if (m[1] !== i.id || beat !== i.beat) deck.jump(m[1], beat);
  });

  return { toast, refresh };
}
