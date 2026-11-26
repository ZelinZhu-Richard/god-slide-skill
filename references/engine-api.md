# Engine API

## Contents
1. Files and commands
2. Deck config
3. Scene definition
4. Beat state `s`
5. Scene context `ctx`
6. Type layer: `data-*` reveals
7. Kit reference
8. Transitions
9. Post settings
10. Runtime: keys, URL parameters, headless API

---

## 1. Files and commands

```
<deck-dir>/
  deck.js          default-exports the deck config
  scenes/*.js      one scene per file (convention)
  deck.css         optional extra CSS
  assets/          images, video, audio, fonts → ctx.texture('x.jpg'), ctx.asset('x.mp4')
  outline.md       the script (not built)
  .thumbs/         written by snap.mjs; embedded by the next build
  dist/<slug>.html the deliverable (one self-contained file)
  snaps/           screenshots, contact.jpg, report.json
```

```bash
node $KIT/scripts/new-deck.mjs <dir> --mode normal|supreme --title "..."
node $KIT/scripts/build.mjs <dir> [--out file.html] [--dev]          # --dev = unminified
node $KIT/scripts/snap.mjs <dir> [--only id,id] [--transitions] [--frames] [--no-thumbs] [--w 1920 --h 1080]
```

`build.mjs` bundles with esbuild (`'god-slide'` resolves to `engine/index.js`, `'three'` to the kit's `node_modules`) and inlines CSS, the fonts the deck actually uses, every file in `assets/`, and thumbnails. `snap.mjs` drives headless Chrome: one JPEG per beat (`--frames` adds 35% and 70% frames; `--transitions` adds 25/50/75% frames of every transition), `contact.jpg`, `.thumbs/thumb-<id>.jpg` from each scene's last beat, and `report.json` (console errors, beats missing notes). It exits with code 1 if the page logged errors.

## 2. Deck config (`deck.js`)

```js
export default {
  title: 'Talk title',          // document title
  mode: 'normal',               // informational: 'normal' | 'supreme'
  counter: 'pages',             // 'pages' | 'fibonacci' | 'none' | (globalBeatIndex) => string
  sound: false,                 // true starts with sound on (the presenter can still press M)
  scenes: [a, b, c],
  transitions: { myWipe: { dur: 1, frag: '...', dom(p, outLayer, inLayer, view) {} } },  // optional
  quality: 1, maxDpr: 1.5,      // render scale; ?hd and ?lite override
};
```

## 3. Scene definition

```js
{
  id: 'tower',                  // unique, [a-z0-9-]; used in #hash, thumbnails, ctx.thumb
  title: 'The real chart',      // overview grid / presenter window
  enter: 'portal',              // transition INTO this scene (first scene: 'cut')
  bg: '#000000',                // flat background when create() returns no picture
  className: 'my-scene',        // extra class on the layer
  css: '.my-scene h1 { ... }',  // scene-scoped CSS (prefix selectors yourself)
  interactive: false,           // true: clicks don't advance (keys still do)
  hud: { color, font, alpha, hide },   // each may be a value or (s) => value. font: mono|arial|display|text|pixel|jb
  beats: [{ dur: 4, hold: 3, delay: 0.8, page: '21', notes: '...', sfx: 'whoosh' | ['swell', { dur: 3 }] }],
  notes: ['...'],               // alternative to per-beat notes
  html: `...` | () => `...`,    // the type layer (1920x1080 stage units)
  create(ctx) { return inst },  // once, lazily; the layer is laid out (invisible) while it runs
}
```

Beat fields: `dur` (seconds of choreography, default 3), `hold` (autoplay wait after the timeline ends, default 3), `delay` (seconds before this beat's timeline starts; beat 0 defaults to about half the enter transition), `page` (HUD label), `notes`, `sfx`.

The `create(ctx)` return value (all optional):

| Field | Meaning |
|---|---|
| `scene`, `camera` | Rendered through the film pipeline with `post` |
| `post` | Post settings object or `(s) => settings` |
| `render(out, s)` | Full control: draw into the render target `out` yourself (use for backdrops, composites, custom passes) |
| `update(s)` | Every frame while visible (also during transitions) |
| `enter(s)`, `exit(s)` | Called when the scene starts / after it leaves |
| `resize(view, gfx)` | Window resized |
| `page(s)` | Live HUD label (used when the beat has no `page`) |
| `init()` | Async setup (awaited once) |

## 4. Beat state `s`

| Member | Meaning |
|---|---|
| `s.t`, `s.dt` | Seconds since the scene entered; frame delta |
| `s.beat`, `s.n` | Current beat index; number of beats |
| `s.p[i]` | Beat i's timeline progress 0..1. Plays forward when reached (3× faster if skipped past), rewinds 2.4× faster when you go back |
| `s.at(i)` | Seconds into beat i's timeline (`p[i] * dur`) |
| `s.k(i, t0, t1, ease)` | **The choreography primitive**: eased 0..1 as beat i's timeline goes from t0 to t1 seconds. Defaults: t0 = 0, t1 = dur, `ease.io3` |
| `s.since(i)` | Wall-clock seconds since beat i was triggered |
| `s.done(i)` | `p[i] >= 1` |
| `s.cue(i, t, fn)` | Fire `fn` once when beat i's timeline passes t going forward (sounds, one-off events) |
| `s.dir` | 1 forward, -1 going back |
| `s.mouse`, `s.view` | Pointer state and the window rect in stage units |

Combine beats additively for multi-beat moves: `rig.at(s.k(0, 0, 4) + s.k(1, 0, 5))` moves through rig keys 0→1→2.

## 5. Scene context `ctx`

| Member | Meaning |
|---|---|
| `ctx.THREE`, `ctx.gfx`, `ctx.renderer`, `ctx.post` | three.js, the renderer wrapper, the shared film pipeline |
| `ctx.camera(fov = 35, near, far)` | Perspective camera that follows the window aspect and always keeps the 16:9 frame in view |
| `ctx.$(sel)`, `ctx.$$(sel)`, `ctx.layer` | Query the scene's type layer |
| `ctx.rect(selOrEl)` | `{x, y, w, h}` of an element in stage units (layout, ignores transforms). Call in `create()` |
| `ctx.pin(selOrEl)` | `{ at(vec3, camera), set(x, y), alpha(a) }`: a DOM element that follows a 3D point |
| `ctx.select(opts)` | Selection box (see kit) |
| `ctx.texture(name, {srgb, repeat})` | THREE.Texture from `assets/` (cached) |
| `ctx.asset(name)` | Data URL of an asset (video, audio, JSON) |
| `ctx.thumb(id)` | Texture of another scene's thumbnail (placeholder until `snap.mjs` has run and you rebuild) |
| `ctx.target(opts)`, `ctx.pass(frag, uniforms)` | Render target, fullscreen GLSL pass (see below) |
| `ctx.sfx(name, opts)` | Play a sound cue (only if sound is on) |
| `ctx.mouse` | `{x, y}` stage units, `nx, ny` -1..1, `down`, `wheel` |
| `ctx.view` | `{x0, y0, x1, y1, w, h, scale}` window rect in stage units (x0 < 0 on wide screens) |
| `ctx.deck` | The deck API |

**Passes:** `ctx.pass(glslBody, uniforms)` compiles a fullscreen shader. The body reads `vUv`, writes `o` (vec4) and can use `uRes`, `uTime`, `uAsp` plus the shared library: `hash12/13/22/33`, `vnoise`, `vnoise3`, `fbm`, `fbm3`, `fbmLo`, `rot2`, `sdRoundBox`, `toLin`, `toSRGB`, `luma`, `agxTone`, `acesFilm`. Set uniforms with `pass.u.name = value`, run with `pass.render(target)`. Targets: `ctx.target({ type: 'half'|'byte', scale: 0.5, samples: 4, depth: true, w, h })`.

Scene renders go into `out` in **display-encoded** colour. The film pipeline handles tone mapping; when you write your own pass, finish with `toSRGB(linearColor)`.

## 6. Type layer: `data-*` reveals

Every element with `data-beat` reveals on that beat's timeline.

| Attribute | Default | Meaning |
|---|---|---|
| `data-beat` | — | Beat index that reveals it |
| `data-fx` | `rise` for h1–h3 and `.display`, else `up` | `rise` (words rise from line masks), `chars` (per character), `fade`, `up`, `down`, `blur`, `pop`, `wipe`, `wipe-up`, `type` (typewriter + caret), `count` (number), `draw` (SVG strokes), `grow` (scaleY from bottom), `grow-x`, `none` |
| `data-delay` | 0 | Seconds into the beat |
| `data-dur` | per fx | Reveal length (for `rise`/`chars`: per line/char) |
| `data-stagger` | 0.09 / 0.028 | Per line (`rise`) or per char (`chars`) |
| `data-until` | — | Beat index that hides it (fades out; `rise` exits upward) |
| `data-out-delay`, `data-out-dur` | 0, 0.6 | Exit timing on that beat |
| `data-from`, `data-to`, `data-format`, `data-decimals` | 0, text | For `count`. Formats: `comma`, `fixed`, `sci`, `auto` |
| `data-speed`, `data-caret="keep"` | 0.055 | For `type`: seconds per character; keep the caret blinking afterwards |
| `data-interactive` | — | Element receives pointer events (drag handles, buttons) |

Elements are absolutely positioned on the stage (`style="left:..;top:.."` or `.tl .tr .bl .br .center`). Group elements with `<div class="group">` (a full-stage box whose children are absolutely positioned) to transform them together, for example to tilt a whole slide. A reveal element nested inside a rising headline (such as a `count` span) rides with its line.

## 7. Kit reference

All return plain objects; add the `.mesh`, `.group` or `.points` to your scene and call `update(t)` every frame where listed.

| Call | Returns / notes |
|---|---|
| `kit.backdrop(ctx, kind, { colors[4], amount, speed, grain, vignette, center[2], seed })` | `{ render(out), set({...}) }`. Kinds: `solid paper gradient aurora ink grid stars spotlight halftone`. Use as a scene's `render` |
| `kit.sky({ preset, clouds, cloudScale, cloudSpeed, sunElevation, sunAzimuth, haze, stars, exposure })` | `{ mesh, sunDir, set(), setSun(elev, azim), blend(a, b, t), fog(scene, density), update(t), fogColor(), sunColor() }`. Presets: `noon morning golden dusk dawn overcast night space`. Azimuth 0 = straight ahead of an unrotated camera |
| `kit.env(ctx, scene, sky)` | Bakes the sky into `scene.environment` for PBR lighting |
| `kit.ocean({ sky, amp, foam, deep, shallow, size })` | `{ mesh, set({amp, foam}), update(t, camera), sample(x, z) → {y, normal}, heightAt }` |
| `kit.city({ radius, seed, minH, maxH, core, night, lights, windowColor, heightFn })` | `{ mesh, lots, set({night, lights, tint}), setHeight(i, h), tallest() }` (instanced, shadows, lit windows) |
| `kit.ground({ size, color })` | Shadow-receiving plane |
| `kit.terrain({ size, height, seed, flat, flatEdge, snow, colors })` | `{ mesh, heightAt(x, z) }` |
| `kit.particles({ count, mode, radius, height, box, size, color, color2, alpha, on, center, positions, additive })` | `{ points, set({on, size, alpha, spread, speed, bright}), update(t, ctx.gfx) }`. Modes: `swarm dust rise stars field`. `on` = fraction shown in a fixed order (k/count shows exactly k points) |
| `kit.globe({ radius, sun[3], lights, clouds, land, atmosphere })` | `{ group, set({lights, clouds, sun}), update(t) }` |
| `kit.card({ map, w, h, radius, border, emissive, lit, shadow })` | `{ group, face, material }`. A physical card for slides, photos, screenshots |
| `kit.wall(ctx, ids, { w, gap, cols, border, emissive })` | `{ group, cards, w, h }`: earlier scenes' thumbnails as a stack |
| `kit.glare({ color, size, rays, intensity, spread })` | `{ mesh, set(), update(t) }`: a light you look into |
| `kit.rig(camera, keys[{pos, look, fov, roll}])` | `{ at(u), shake(amount, t, freq) }`. u from 0 to keys.length - 1 along a smooth path |
| `kit.lights(scene, { dir, color, intensity, sky, ground, fill, shadow, target })` | `{ sun, hemi, setDir(v) }`. `shadow` = half-size of the shadow box in world units (0 = none) |
| `kit.textMesh(text, { font, weight, size, color, height, lit })` | A plane with text, for in-world numbers and signs |
| `kit.odometer(el, { decimals, comma })` | `{ set(value) }`: rolling digits, call every frame |
| `kit.officeChart(el, { type: 'bar'|'line', labels, series, title, unit })` | Default-office-styled SVG chart, for the boring opener |
| `ctx.select({ color, handles, knob, dashed, tag, glow })` | `{ wrap(el, pad), rect(x, y, w, h, rot), tween(a, b, t), show(0..1), hide() }` |
| Helpers from `'god-slide'` | `ease.*` (io2–io5, in/out variants, outBack, smoother, outExpo), `clamp lerp remap smoothstep damp rng fmt fib TAU` |

## 8. Transitions

Set on the incoming scene (`enter`). Going back plays the same transition in reverse, faster.

| Name | Duration | Picture | Use |
|---|---|---|---|
| `cut` | 0 | Hard cut | Rarely; for shock |
| `fade` | 0.9 | Crossfade | Default, neutral |
| `dip` | 1.2 | Through black | Change of chapter, into a dark room |
| `push` | 1.1 | Slide left with motion blur | Sequences, "next" |
| `portal` | 2.0 | The next scene arrives as a picture that grows until you are inside it | Entering a world |
| `portal-out` | 1.9 | The current scene shrinks into a picture floating over the next | Stepping back, "it was a slide all along" |
| `wash` | 2.4 | A sheet of water washes over the glass and drains | Into sea, weather, emotion |
| `flaps` | 2.2 | Split-flap tiles flip | Data, departures boards, rapid change |
| `line` | 1.8 | Collapses into a vibrating string, opens into the next | Compression, signal, "the thread" |
| `tear` | 1.9 | Torn away like paper | Breaking with the old, contrasts |
| `daybreak` | 2.4 | Overexposes to white, the next develops out of the light | Revelation, from white scenes, dawn |
| `slam` | 1.1 | The next slams down with a shake | Impact, a hard number |
| `fold` | 2.0 | The right half folds over like a page, then slides away | Paper, documents, turning a page |

Custom transitions: `{ dur, frag, dom(p, outLayer, inLayer, view) }` where `frag` reads `tA`, `tB`, `p` and writes `o`. Text layers are HTML, so `dom` moves them in step (opacity, transform, clip-path).

## 9. Post settings

`post: { preset, exposure, bloom, threshold, knee, halation, tone: 'agx'|'aces'|'none', contrast, saturation, vignette, grain, grainSize, ca, grad, gradStart, lift[3], gain[3], tint[3], fade, fadeColor }`. Presets: `film soft crisp dream noir flat`. Emissive colours above 1.0 (for example `new THREE.Color(2.6, 2.2, 1.8)`) bloom.

For multi-pass scenes: `ctx.post.render(scene, camera, target, settings)` renders a world into any target; `ctx.post.finish(hdrTarget, out, settings)` grades an HDR target you filled yourself.

## 10. Runtime

**Keys:** → ↓ space Enter PageDown next · ← ↑ Backspace PageUp back · Home/End · F full screen · A autoplay (uses `hold`) · M sound · N notes panel · P presenter window · O overview · . or B black · ? or H help · Esc closes overlays. Click or tap advances (tap the left third to go back; swipe works). The cursor hides after 2 s idle.

**URL:** `#scene-id` or `#scene-id/3` (beat 3) opens there. `?quick` skips shader warm-up. `?lite` lowers resolution. `?hd` allows full device pixel ratio. `?fixed` disables adaptive resolution. `?headless&w=1920&h=1080` is for automation.

**Headless API** (`window.__deck`): `list()`, `snap(id, beat, { frac })`, `snapTransition(toId, p)`, `endSnapTransition()`, `jump(id, beat)`, `next()`, `prev()`, `info()`, `on('move', fn)`. `window.ready` becomes true when the deck has started.

**Fallback:** without WebGL 2 the deck shows a short message asking for a current browser.
