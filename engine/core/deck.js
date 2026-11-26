// The deck runtime: scenes, beats, transitions, the render loop and the public API.
//
// A scene is one idea. A beat is one reveal inside it. Each beat has a timeline (dur seconds)
// that plays forward when the presenter advances and rewinds when they go back, so motion is
// choreographed like film but paced by the speaker.
import * as THREE from 'three';
import { createGfx } from './gfx.js';
import { createPost } from '../fx/post.js';
import { TRANSITIONS, resetLayer } from '../fx/transitions.js';
import { createStage, prepareLayer, applyLayer, createPin, stageRect } from './dom.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { ease, clamp, fib, fmt } from './ease.js';
import { createSelect } from '../kit/select.js';

const ASSETS = () => window.__GS_ASSETS || {};

function hexToRGB(hex) {
  const c = new THREE.Color();
  c.setStyle(hex, THREE.LinearSRGBColorSpace); // keep the hex numbers as-is: our targets are display-encoded
  return [c.r, c.g, c.b];
}

function counterLabel(mode, g) {
  if (typeof mode === 'function') return mode(g);
  if (mode === 'none') return '';
  if (mode === 'fibonacci') {
    const v = fib(g + 1);
    return v >= 1e15 ? fmt(v, 'sci') : fmt(v);
  }
  return String(g + 1);
}

export async function createDeck(config) {
  const qs = new URLSearchParams(location.search);
  const headless = qs.has('headless') || !!window.__GS_HEADLESS;
  const cfg = {
    title: document.title,
    counter: 'pages',
    sound: false,
    quality: qs.has('lite') ? 0.75 : 1,
    maxDpr: qs.has('hd') ? 3 : qs.has('lite') ? 1 : 1.5,
    ...config,
  };
  if (config.title) document.title = config.title;
  const defs = cfg.scenes;
  if (!defs || !defs.length) throw new Error('createDeck: no scenes');
  const transitions = { ...TRANSITIONS, ...(cfg.transitions || {}) };

  // --- DOM skeleton --------------------------------------------------------------------
  document.body.classList.add('gs');
  const canvas = document.getElementById('gs-canvas') || Object.assign(document.createElement('canvas'), { id: 'gs-canvas' });
  if (!canvas.parentNode) document.body.append(canvas);
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'The presentation');
  const domRoot = document.getElementById('gs-dom') || Object.assign(document.createElement('div'), { id: 'gs-dom' });
  if (!domRoot.parentNode) document.body.append(domRoot);
  const uiRoot = document.getElementById('gs-ui') || Object.assign(document.createElement('div'), { id: 'gs-ui' });
  if (!uiRoot.parentNode) document.body.append(uiRoot);
  if (headless) document.body.classList.add('gs-headless');

  let gfx;
  try {
    gfx = createGfx(canvas, { headless, maxDpr: cfg.maxDpr, quality: cfg.quality });
  } catch (err) {
    console.error(err);
    const m = document.createElement('div');
    m.className = 'gs-help gs-fatal';
    m.textContent = 'This presentation needs WebGL 2. Open it in a current Chrome, Edge, Safari or Firefox on a computer.';
    uiRoot.append(m);
    throw err;
  }
  const { stage, view, layout } = createStage(domRoot);
  const post = createPost(gfx);
  const hud = createHud(uiRoot);
  const audio = createAudio();
  if (cfg.sound === true) audio.set(true);
  const flat = gfx.pass('uniform vec3 uC; void main(){ o=vec4(uC,1.); }', { uC: new THREE.Vector3() });

  const rtA = gfx.target({ type: 'half' });
  const rtB = gfx.target({ type: 'half' });
  const rtT = gfx.target({ type: 'half' });

  const mouse = { x: 960, y: 540, nx: 0, ny: 0, down: false, dx: 0, dy: 0, wheel: 0 };
  const listeners = {};
  const emit = (name, data) => (listeners[name] || []).forEach((f) => f(data));

  const textureCache = {};
  const loader = new THREE.TextureLoader();
  const asset = (name) => ASSETS()[name] || 'assets/' + name;
  const pendingLoads = [];
  function texture(name, { srgb = true, repeat = false } = {}) {
    if (textureCache[name]) return textureCache[name];
    let done;
    pendingLoads.push(new Promise((r) => (done = r)));
    const t = loader.load(asset(name), done, undefined, () => { console.warn('[god-slide] could not load asset ' + name); done(); });
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return (textureCache[name] = t);
  }
  function thumbURL(id) { return ASSETS()['thumb-' + id + '.jpg'] || null; }
  function thumb(id) {
    const url = thumbURL(id);
    if (url) return texture('thumb-' + id + '.jpg');
    // placeholder card until snap.mjs has rendered real thumbnails
    if (textureCache['__ph' + id]) return textureCache['__ph' + id];
    const c = document.createElement('canvas'); c.width = 800; c.height = 450;
    const g = c.getContext('2d');
    g.fillStyle = '#2a2d34'; g.fillRect(0, 0, 800, 450);
    g.fillStyle = '#e8e4da'; g.font = '300 44px Unbounded, sans-serif';
    const def = defs.find((d) => d.id === id);
    g.fillText(def ? def.title || id : id, 48, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (textureCache['__ph' + id] = t);
  }

  // Cameras managed by the deck: aspect follows the window and the 16:9 frame always fits.
  const cameras = new Set();
  function fitCamera(cam) {
    cam.aspect = gfx.aspect;
    const base = cam.userData.fov16x9 ?? cam.fov;
    cam.userData.fov16x9 = base;
    if (gfx.aspect < 16 / 9) {
      const h = Math.tan(THREE.MathUtils.degToRad(base) / 2) * (16 / 9) / gfx.aspect;
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h));
    } else cam.fov = base;
    cam.updateProjectionMatrix();
  }

  // --- scene runners -----------------------------------------------------------------
  class Runner {
    constructor(def, index) {
      this.def = def;
      this.i = index;
      def.id = def.id || 'scene' + (index + 1);
      const enterT = transitions[def.enter || (index ? 'fade' : 'cut')] || transitions.fade;
      const raw = def.beats && def.beats.length ? def.beats : [{}];
      this.beats = raw.map((b, i) => ({
        dur: b.dur ?? 3,
        hold: b.hold ?? 3,
        delay: b.delay ?? (i === 0 ? Math.min(1.6, enterT.dur * 0.55) : 0),
        page: b.page,
        notes: b.notes ?? (def.notes ? def.notes[i] : '') ?? '',
        sfx: b.sfx,
      }));
      const n = this.beats.length;
      const B = this.beats;
      const s = (this.s = {
        t: 0, dt: 0, beat: 0, n, dir: 1, i: index, def,
        p: new Array(n).fill(0), _since: new Array(n).fill(0), _cues: new Map(),
        mouse, view,
        /** seconds into beat i's timeline */
        at: (i) => s.p[i] * B[i].dur,
        /** like at(), but keeps counting after the timeline ends (lets late reveals finish) */
        tl: (i) => (s.p[i] < 1 ? s.p[i] * B[i].dur : B[i].dur + Math.max(0, s._since[i] - B[i].delay - B[i].dur)),
        /** eased 0..1 as beat i's timeline goes from t0 to t1 seconds */
        k: (i, t0 = 0, t1 = B[i].dur, e = ease.io3) => e(clamp((s.p[i] * B[i].dur - t0) / Math.max(1e-4, t1 - t0))),
        since: (i) => s._since[i],
        done: (i) => s.p[i] >= 1,
        /** fire fn once when beat i's timeline passes t going forward */
        cue: (i, t, fn) => {
          const key = i + ':' + t;
          const prev = s._cues.get(key) ?? -1;
          const cur = s.p[i] * B[i].dur;
          if (prev < t && cur >= t && s.dt > 0 && cur - prev < 0.5) fn();
          s._cues.set(key, cur);
        },
      });
      this.layer = document.createElement('section');
      this.layer.className = 'gs-layer ' + (def.className || '');
      this.layer.dataset.scene = def.id;
      if (def.html) this.layer.innerHTML = typeof def.html === 'function' ? def.html() : def.html;
      if (def.css) { const st = document.createElement('style'); st.textContent = def.css; this.layer.prepend(st); }
      stage.append(this.layer);
      this.items = null;
      this.inst = null;
      this.ready = false;
      this.bg = hexToRGB(def.bg || '#000000');
    }
    async init() {
      if (this.ready) return;
      if (this._init) return this._init;
      this._init = (async () => {
        const L = this.layer;
        L.style.display = 'block'; L.style.visibility = 'hidden';
        const ctx = sceneCtx(this);
        let inst = {};
        try {
          inst = (this.def.create && this.def.create(ctx)) || {};
          if (inst.init) await inst.init();
          await Promise.all(pendingLoads.splice(0)); // images used by this scene are decoded before it shows
        } catch (err) { console.error(`[god-slide] scene "${this.def.id}" create() failed`, err); inst = {}; }
        if (inst.camera && inst.camera.isPerspectiveCamera && inst.fit !== false) { cameras.add(inst.camera); fitCamera(inst.camera); }
        this.items = prepareLayer(L);
        L.style.display = ''; L.style.visibility = '';
        this.inst = inst;
        this.ready = true;
      })();
      return this._init;
    }
    reset(beat = 0, completed = false) {
      const s = this.s;
      s.t = 0; s.beat = Math.min(beat, s.n - 1); s.dir = 1;
      for (let i = 0; i < s.n; i++) {
        s.p[i] = completed && i <= s.beat ? 1 : 0;
        s._since[i] = completed && i <= s.beat ? 30 : 0;
      }
      s._cues.clear();
    }
    step(dt) {
      const s = this.s, B = this.beats;
      s.dt = dt; s.t += dt;
      for (let i = 0; i < s.n; i++) {
        if (i <= s.beat) {
          s._since[i] += dt;
          if (s._since[i] >= B[i].delay) s.p[i] = Math.min(1, s.p[i] + (dt / B[i].dur) * (i < s.beat ? 3 : 1));
        } else {
          s._since[i] = 0;
          s.p[i] = Math.max(0, s.p[i] - (dt / B[i].dur) * 2.4);
        }
      }
      if (this.inst && this.inst.update) {
        try { this.inst.update(s); } catch (err) { if (!this._warned) { this._warned = 1; console.error(`[god-slide] scene "${this.def.id}" update()`, err); } }
      }
      applyLayer(this.items, s);
    }
    render(out) {
      const inst = this.inst || {};
      try {
        if (inst.render) inst.render(out, this.s);
        else if (inst.scene && inst.camera) {
          const pc = typeof inst.post === 'function' ? inst.post(this.s) : inst.post ?? this.def.post;
          post.render(inst.scene, inst.camera, out, pc);
        } else { flat.u.uC.set(...this.bg); flat.render(out); }
      } catch (err) {
        if (!this._rwarned) { this._rwarned = 1; console.error(`[god-slide] scene "${this.def.id}" render()`, err); }
        flat.u.uC.set(...this.bg); flat.render(out);
      }
    }
    show(on) { this.layer.classList.toggle('gs-on', on); if (!on) resetLayer(this.layer); }
  }

  function sceneCtx(R) {
    const layer = R.layer;
    return {
      THREE, gfx, renderer: gfx.renderer, post, view, mouse, layer, s: R.s, def: R.def, deck: api,
      $: (sel) => layer.querySelector(sel),
      $$: (sel) => [...layer.querySelectorAll(sel)],
      asset, texture, thumb,
      pin: (el) => createPin(typeof el === 'string' ? layer.querySelector(el) : el, view),
      rect: (el) => stageRect(typeof el === 'string' ? layer.querySelector(el) : el, layer),
      sfx: (name, opts) => audio.play(name, opts),
      select: (opts) => createSelect(layer, opts),
      camera: (fov = 35, near = 0.1, far = 5000) => {
        const c = new THREE.PerspectiveCamera(fov, gfx.aspect, near, far);
        c.userData.fov16x9 = fov; cameras.add(c); fitCamera(c); return c;
      },
      fitCamera,
      target: (o) => gfx.target(o),
      pass: (frag, u, o) => gfx.pass(frag, u, o),
      hex: hexToRGB,
    };
  }

  const R = defs.map((d, i) => new Runner(d, i));
  let cur = -1, trans = null, auto = false, autoT = 0, black = 0, blackTarget = 0;

  // --- navigation ------------------------------------------------------------------------
  function transitionFor(name) { return transitions[name] || transitions.fade; }
  function getPass(T) {
    if (!T._pass) T._pass = gfx.pass(T.frag, { tA: null, tB: null, p: 0 });
    return T._pass;
  }
  async function go(i, { with: w = 'fade', reverse = false, beat = 0, completed = false } = {}) {
    if (i === cur || i < 0 || i >= R.length) return;
    if (trans) finishTransition();
    const to = R[i];
    await to.init();
    to.reset(beat, completed);
    to.show(true);
    if (to.inst.enter) to.inst.enter(to.s);
    if (cur < 0 || w === 'none') {
      if (cur >= 0) { R[cur].show(false); R[cur].inst?.exit?.(R[cur].s); }
      cur = i; emit('move'); return;
    }
    const T = transitionFor(w);
    trans = { from: cur, to: i, T, t: 0, dur: Math.max(1e-3, T.dur * (reverse ? 0.6 : 1)), speed: 1, reverse };
    emit('move');
  }
  function finishTransition() {
    if (!trans) return;
    const from = R[trans.from], to = R[trans.to];
    from.show(false); resetLayer(to.layer);
    from.inst?.exit?.(from.s);
    cur = trans.to; trans = null; autoT = 0;
  }
  function next() {
    if (trans) { trans.speed = 3.5; return; }
    const r = R[cur];
    if (r.s.beat < r.s.n - 1) {
      r.s.beat++; r.s.dir = 1; autoT = 0;
      const b = r.beats[r.s.beat];
      if (b.sfx) audio.play(...[].concat(b.sfx));
      emit('move');
    } else if (cur < R.length - 1) go(cur + 1, { with: R[cur + 1].def.enter || 'fade' });
  }
  function prev() {
    if (trans) { trans.speed = 3.5; return; }
    const r = R[cur];
    r.s.dir = -1;
    if (r.s.beat > 0) { r.s.beat--; autoT = 0; emit('move'); }
    else if (cur > 0) go(cur - 1, { with: r.def.enter || 'fade', reverse: true, beat: R[cur - 1].s.n - 1, completed: true });
  }
  async function jump(id, beat = 0) {
    const i = typeof id === 'number' ? id : R.findIndex((r) => r.def.id === id);
    if (i < 0) return;
    if (i === cur) {
      const r = R[cur];
      r.reset(beat, true); emit('move'); return;
    }
    await go(i, { with: 'none', beat, completed: beat > 0 });
  }

  // --- HUD label ---------------------------------------------------------------------------
  const globalBeat = (ri, b) => R.slice(0, ri).reduce((a, r) => a + r.s.n, 0) + b;
  function hudFor(r) {
    const h = r.def.hud || {};
    const s = r.s;
    const b = r.beats[s.beat];
    const pick = (v, d) => (typeof v === 'function' ? v(s) : v ?? d);
    let label = b.page;
    if (label == null) label = r.inst && r.inst.page ? r.inst.page(s) : counterLabel(cfg.counter, globalBeat(r.i, s.beat));
    return { text: pick(h.hide, false) ? '' : label, color: pick(h.color, '#ffffff'), font: pick(h.font, 'mono'), alpha: pick(h.alpha, 0.75) };
  }

  // --- loop --------------------------------------------------------------------------------
  let last = performance.now(), frames = 0, slowT = 0;
  function frame(dt) {
    gfx.time += dt;
    black += (blackTarget - black) * (1 - Math.exp(-dt * 8));
    if (trans) {
      trans.t += dt * trans.speed;
      const raw = clamp(trans.t / trans.dur);
      const p = trans.reverse ? 1 - raw : raw;
      const from = R[trans.from], to = R[trans.to];
      from.step(dt); to.step(dt);
      // shader convention: tA -> tB as p goes 0 -> 1. Reverse plays the "to" side as A.
      const A = trans.reverse ? to : from, B = trans.reverse ? from : to;
      A.render(rtA); B.render(rtB);
      const pass = getPass(trans.T);
      pass.u.tA = rtA.texture; pass.u.tB = rtB.texture; pass.u.p = p;
      pass.render(rtT);
      trans.T.dom?.(p, A.layer, B.layer, view);
      gfx.present(rtT, black);
      hudSet(raw > 0.5 ? to : from);
      if (raw >= 1) finishTransition();
    } else if (cur >= 0) {
      const r = R[cur];
      r.step(dt);
      r.render(rtA);
      gfx.present(rtA, black);
      hudSet(r);
      if (auto) {
        const b = r.beats[r.s.beat];
        if (r.s.p[r.s.beat] >= 1) { autoT += dt; if (autoT >= b.hold) { autoT = 0; next(); } }
      }
    }
    hud.tick(dt);
  }
  function hudSet(r) { const h = hudFor(r); hud.set(h.text, h); }

  function loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); // keeps real time down to 10 fps
    last = now;
    frame(dt);
    // adaptive resolution: keep the presenter's laptop smooth
    if (!headless && !qs.has('fixed')) {
      frames++; slowT += dt;
      if (slowT > 1.5) {
        const fps = frames / slowT; frames = 0; slowT = 0;
        if (fps < 40 && gfx.quality > 0.55) { gfx.quality = Math.max(0.55, gfx.quality - 0.1); gfx.resize(innerWidth, innerHeight); }
        else if (fps > 58 && gfx.quality < cfg.quality) { gfx.quality = Math.min(cfg.quality, gfx.quality + 0.05); gfx.resize(innerWidth, innerHeight); }
      }
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    const W = headless ? +(qs.get('w') || innerWidth) : innerWidth;
    const H = headless ? +(qs.get('h') || innerHeight) : innerHeight;
    gfx.resize(W, H);
    layout(W, H);
    hud.layout(view);
    for (const c of cameras) fitCamera(c);
    for (const r of R) if (r.ready && r.inst.resize) r.inst.resize(view, gfx);
  }
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => {
    const x = view.x0 + (e.clientX / innerWidth) * view.w, y = view.y0 + (e.clientY / innerHeight) * view.h;
    mouse.dx = x - mouse.x; mouse.dy = y - mouse.y; mouse.x = x; mouse.y = y;
    mouse.nx = (e.clientX / innerWidth) * 2 - 1; mouse.ny = -(e.clientY / innerHeight) * 2 + 1;
  });
  addEventListener('pointerdown', () => (mouse.down = true));
  addEventListener('pointerup', () => (mouse.down = false));
  addEventListener('wheel', (e) => (mouse.wheel += e.deltaY), { passive: true });

  // --- public API ---------------------------------------------------------------------------
  const api = {
    title: cfg.title,
    config: cfg,
    gfx, post, view, audio, mouse, THREE,
    scenes: defs,
    runners: R,
    get auto() { return auto; },
    get index() { return cur; },
    on(name, f) { (listeners[name] = listeners[name] || []).push(f); return api; },
    next, prev, jump, go: (i, o) => go(i, o),
    setAuto(v) { auto = !!v; autoT = 0; },
    toggleBlack() { blackTarget = blackTarget > 0.5 ? 0 : 1; },
    current: () => (cur >= 0 ? R[cur] : null),
    thumbURL,
    info() {
      const r = R[trans ? trans.to : Math.max(cur, 0)];
      const b = r.s.beat;
      const nb = b < r.s.n - 1 ? r.beats[b + 1].notes : R[r.i + 1] ? R[r.i + 1].beats[0].notes : '';
      return { index: r.i, id: r.def.id, title: r.def.title || r.def.id, count: R.length, beat: b, beats: r.s.n, notes: r.beats[b].notes, next: (nb || '').split('\n')[0] };
    },
    async warm(progress) {
      for (let i = 0; i < R.length; i++) {
        await R[i].init();
        R[i].reset(0);
        R[i].step(0);
        R[i].render(rtB); // compiles its shaders now, not mid-talk
        progress && progress((i + 1) / R.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    },
    /** Headless: show scene `id` at beat `beat`, timeline at fraction `frac` (1 = settled). */
    async snap(id, beat = 0, { frac = 1, settle = 2.5, fps = 30 } = {}) {
      if (trans) finishTransition();
      const i = typeof id === 'number' ? id : R.findIndex((r) => r.def.id === id);
      const r = R[i];
      await r.init();
      if (cur !== i) { if (cur >= 0) R[cur].show(false); cur = i; r.show(true); }
      r.reset(beat, true);
      r.beats.forEach((b, k) => { if (k < beat) r.s.p[k] = 1; });
      const B = r.beats[beat];
      r.s.p[beat] = 0; r.s._since[beat] = 0;
      r.s.t = r.beats.slice(0, beat).reduce((a, b) => a + b.dur + b.hold * 0.5, 0);
      if (r.inst.enter) r.inst.enter(r.s);
      const target = Math.max(0, Math.min(1, frac));
      const steps = Math.ceil((B.delay + B.dur * target) * fps);
      const dt = 1 / fps;
      for (let k = 0; k < steps; k++) {
        r.step(dt);
        if (r.s.p[beat] >= target) break;
      }
      r.s.p[beat] = target;
      // let damped/ambient motion settle with the timeline frozen
      const frozen = r.s.p.slice();
      for (let k = 0; k < Math.round(settle * fps * (target >= 1 ? 1 : 0.2)); k++) { r.step(dt); r.s.p.splice(0, frozen.length, ...frozen); }
      gfx.time += 0.5;
      r.step(1e-4); r.s.p.splice(0, frozen.length, ...frozen);
      r.render(rtA); gfx.present(rtA, 0);
      hudSet(r); hud.tick(10);
      emit('move');
      return { id: r.def.id, beat, beats: r.s.n, title: r.def.title || r.def.id };
    },
    /** Headless: freeze the transition INTO scene `toId` at progress p (0..1). */
    async snapTransition(toId, p = 0.5) {
      if (trans) finishTransition();
      const ti = typeof toId === 'number' ? toId : R.findIndex((r) => r.def.id === toId);
      if (ti < 1) return null;
      const A = R[ti - 1], B = R[ti];
      await A.init(); await B.init();
      for (const r of R) if (r !== A && r !== B) r.show(false);
      A.reset(A.s.n - 1, true); B.reset(0, false);
      A.show(true); B.show(true);
      const T = transitionFor(B.def.enter || 'fade');
      const dt = 1 / 30;
      for (let k = 0; k < Math.round(T.dur * p * 30); k++) { A.step(dt); B.step(dt); }
      A.render(rtA); B.render(rtB);
      const pass = getPass(T);
      pass.u.tA = rtA.texture; pass.u.tB = rtB.texture; pass.u.p = p;
      pass.render(rtT);
      T.dom?.(p, A.layer, B.layer, view);
      gfx.present(rtT, 0);
      cur = ti;
      return { from: A.def.id, to: B.def.id, name: B.def.enter || 'fade', p };
    },
    /** Headless: clear transition styles after snapTransition. */
    endSnapTransition() { for (const r of R) { resetLayer(r.layer); r.show(r.i === cur); } },
    list: () => R.map((r) => ({ id: r.def.id, title: r.def.title || r.def.id, beats: r.s.n, enter: r.def.enter || (r.i ? 'fade' : 'cut'), notes: r.beats.map((b) => b.notes) })),
  };

  // --- start --------------------------------------------------------------------------------
  resize();
  try { await document.fonts.ready; } catch { /* old browser */ }
  window.__deck = api;
  if (!headless && !qs.has('quick')) {
    const ld = document.createElement('div');
    ld.className = 'gs-load';
    ld.innerHTML = '<p>Opening presentation</p><div><i></i></div>';
    uiRoot.append(ld);
    const bar = ld.querySelector('i');
    await new Promise((r) => requestAnimationFrame(r));
    await api.warm((f) => (bar.style.width = Math.round(f * 100) + '%'));
    ld.remove();
  }
  const m = /^#([\w-]+)(?:\/(\d+))?$/.exec(location.hash || '');
  const startId = m && R.some((r) => r.def.id === m[1]) ? m[1] : R[0].def.id;
  const startBeat = m && m[2] ? +m[2] - 1 : 0;
  await go(R.findIndex((r) => r.def.id === startId), { with: 'none', beat: startBeat, completed: startBeat > 0 });
  if (!headless) {
    createUI(api, uiRoot);
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
    canvas.focus({ preventScroll: true });
  }
  window.ready = true;
  return api;
}
