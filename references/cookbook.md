# Cookbook

Tested recipes. Full working versions of most of them are in `examples/nobody-remembers-your-slides/scenes/` (file names in brackets). Imports assumed: `import * as THREE from 'three'; import { kit, ease, clamp, damp } from 'god-slide';`

## Contents
1. Statement on a living backdrop (normal-mode workhorse)
2. Swap headlines between beats
3. A big number that counts up
4. A real chart that draws itself
5. The boring opener that breaks [01-office]
6. The idea as a place: sea and a floating object [03-place]
7. Numbers as objects to scale, pinned labels, live HUD [04-size]
8. Falling objects, a few caught [02-four]
9. One, then thousands: the swarm reveal
10. A city whose lights come on
11. A dark hall, a projector, a live counter [05-audience]
12. Everyone alive: the globe
13. A screenshot or photo as a physical card (demo days)
14. A custom shader world (when no kit piece fits)
15. Interactive split with a draggable divider [06-split]
16. The callback wall [07-wall]
17. The bookend: retype and tilt [08-questions]
18. Camera moves across several beats
19. Sound cues

---

## 1. Statement on a living backdrop

```js
export default {
  id: 'why', title: 'Why now', enter: 'fade', hud: { color: '#f3ede2' },
  beats: [{ dur: 3, notes: '...' }, { dur: 2.5, notes: '...' }],
  html: `
    <h1 class="display big light tl" data-beat="0">It got cheap<br>this year.</h1>
    <p class="source tl" style="top:420px" data-beat="0" data-delay="1">Source, Month Year</p>
    <p class="display mid light bl" data-beat="1" data-fx="chars">So everyone can.</p>`,
  create(ctx) {
    const bg = kit.backdrop(ctx, 'gradient', { colors: ['#0d1220', '#24304f', '#7a4a5e', '#e0a56b'] });
    return { render: bg.render };
  },
};
```
Backdrops: `paper` (cream with fibres; use `.ink` text), `gradient` (four colours), `aurora`, `ink` (`set({amount})` blooms it), `grid` (blueprint), `stars`, `spotlight` (`center:[x,y]`, `amount`), `halftone`, `solid`. Animate with `bg.set({...})` in `update`.

## 2. Swap headlines between beats

```html
<h1 class="display big light tl" data-beat="0" data-until="1" data-out-dur="0.5">First thought.</h1>
<h1 class="display big light tl" data-beat="1" data-delay="0.7">Second thought.</h1>
```
The first rises out as beat 1 starts; the second rises in 0.7 s later. Going back reverses both.

## 3. A big number that counts up

```html
<p class="display huge light bl num" data-beat="1" data-fx="count" data-from="0" data-to="1280" data-dur="2.5">1,280</p>
<p class="source light" style="left:124px;top:1000px" data-beat="1" data-delay="1">metres, step thirty</p>
```
For a number inside a headline, nest it; it rises with its line:
`<h1 class="display mid ink tl" data-beat="0">= <span data-beat="0" data-fx="count" data-to="100" data-delay="0.6" data-dur="4">100</span> hours.</h1>`

## 4. A real chart that draws itself

```html
<h1 class="display mid light tl" data-beat="0">Revenue, by quarter.</h1>
<p class="source tl" style="top:230px" data-beat="0" data-delay="0.8">Company filings, 2025</p>
<svg style="left:120px;top:330px" width="1680" height="620" viewBox="0 0 1680 620"
     data-beat="0" data-fx="draw" data-delay="0.6" data-dur="2.6">
  <path d="M0 600 H1680" stroke="#ffffff33" stroke-width="2" fill="none"/>
  <path d="M0 560 C 300 540, 560 520, 840 430 S 1360 160, 1660 40" stroke="#fbf6ec" stroke-width="6" fill="none" stroke-linecap="round"/>
</svg>
<div style="left:1752px;top:340px;width:28px;height:28px;border-radius:50%;background:#e3241b" data-beat="1" data-fx="pop"></div>
<p class="label light" style="left:1360px;top:420px" data-beat="1" data-delay="0.3">$4.1M ARR</p>
```
With `kit.backdrop(ctx, 'grid', { colors: ['#0b1a33', '#4f7cc9'] })`. Compute the path from real data in JS (`html: () => ...`) rather than drawing it by eye: map values to the 1680×620 box, linear unless log is honest and labelled.

## 5. The boring opener that breaks [01-office]

Arial template (`.office-title`, `.office-sub`, `.office-h`, `.office-ul`, `kit.officeChart`), grey Arial HUD, then on the last beat:
```js
create(ctx) {
  const h = ctx.rect('#agenda-h'), u = ctx.rect('#bullets'), a = ctx.rect('#again');
  const all = { x: h.x - 28, y: h.y - 22, w: Math.max(h.w, u.w) + 56, h: u.y + u.h - h.y + 30 };
  const field = { x: a.x - 26, y: a.y - 8, w: a.w + 52, h: a.h + 16 };
  const box = ctx.select();
  return { update(s) {
    box.tween(all, field, s.k(2, 1.3, 1.9, ease.io4));          // select all -> becomes a text box
    box.show(s.k(2, 0, 0.5, ease.linear) * (1 - s.k(2, 3.8, 4.4)));
  } };
}
```
The bullets hide with `data-until="2" data-out-delay="1.0" data-out-dur="0.2"` (the "delete"), and the new line types with `data-fx="type" data-caret="keep"`. HUD: `hud: { font: (s) => s.beat < 2 ? 'arial' : 'mono', color: (s) => s.beat < 2 ? '#7f7f7f' : '#14161c' }`. Variation: the slide is remade into a bold poster (huge `.anton` or `.display.bold` word plus one red disc with `data-fx="pop"`).

## 6. The idea as a place: sea and a floating object [03-place]

```js
const sky = kit.sky({ preset: 'golden', sunAzimuth: 26 }); scene.add(sky.mesh);
const sea = kit.ocean({ sky, amp: 0.45 }); scene.add(sea.mesh);
const L = kit.lights(scene, { dir: sky.sunDir, color: '#ffcf9a', intensity: 2.6, sky: '#8d9bbd', ground: '#2c241d' });
// update(s):
const storm = s.k(1, 0, 4.5, ease.io2);
sea.set({ amp: 0.45 + 1.9 * storm }); sky.blend('golden', 'dusk', storm * 0.85); sky.setSun(6 - 4 * storm, 26);
sea.update(s.t, camera); sky.update(s.t);
const w = sea.sample(0, 0, s.t);                         // float anything on the waves
boat.position.y = w.y; boat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), w.normal);
```
Post: `{ preset: 'film', bloom: 0.42, halation: 0.35, grad: 0.7 }`. The `grad` keeps the top-left headline readable over the bright sky.

## 7. Numbers as objects to scale [04-size]

One instance per unit, revealed by count; a person for scale; labels pinned to the top; the HUD reads the count.
```js
const floors = new THREE.InstancedMesh(floorGeo, mat, 100); floors.count = 0;   // set matrices once
return {
  scene, camera, page: () => String(Math.round(shown)),     // live HUD label
  update(s) {
    shown = 100 * s.k(0, 0.6, 5.2, ease.io2);
    floors.count = Math.ceil(shown);
    pinTop.at(new THREE.Vector3(21, Math.ceil(shown) * 3.4, 0), camera);
  },
};
```
Pair it with a source line, or `illustration` when it is arithmetic. Beat 2 moves the camera to the base looking up (`fov` 55–60).

## 8. Falling objects, a few caught [02-four]

Per object, store a start position, start time `t0` and spin; drive everything from `const t = s.at(1)`:
```js
const u = t - d.t0; d.group.visible = u > 0;
if (d.caught) { const k = ease.out4(clamp(u / 1.7)); d.group.position.lerpVectors(d.start, d.slot, k); }
else d.group.position.set(d.start.x, d.start.y - 7 * u * u, d.start.z);         // gravity
```
Because it is a pure function of the timeline, going back rewinds it perfectly. Glowing frames: `MeshBasicMaterial` with an HDR colour (`setRGB(2.6, 2.25, 1.85)`) so they bloom.

## 9. One, then thousands: the swarm reveal

```js
const swarm = kit.particles({ count: 200000, mode: 'swarm', radius: 300, height: 40, size: 1.4, color: '#ffcf8a', center: [0, 60, 0] });
scene.add(swarm.points);
// update(s): exactly one point on beat 0, 30,000 on beat 1, all on beat 2
swarm.set({ on: (1 + 29999 * s.k(1, 0, 3) + 170000 * s.k(2, 0, 5)) / 200000 });
swarm.update(s.t, ctx.gfx);
```
`on = k / count` shows exactly k points, and the first point sits at the centre. Pair it with a `count` reveal or the odometer.

## 10. A city whose lights come on

```js
const sky = kit.sky({ preset: 'dusk' }); scene.add(sky.mesh); sky.fog(scene, 0.0009);
const town = kit.city({ radius: 380, seed: 5 }); scene.add(town.mesh, kit.ground({ size: 3000, color: '#2a2622' }));
kit.lights(scene, { dir: sky.sunDir, color: '#ffb47a', intensity: 2, shadow: 300 });
// update(s):
town.set({ night: s.k(1, 0, 3), lights: s.k(1, 1, 5) }); sky.blend('dusk', 'night', s.k(1, 0, 3)); sky.update(s.t);
```
Post: `(s) => ({ preset: 'film', bloom: 0.5 + 0.4 * s.k(1), exposure: 1 - 0.3 * s.k(1) })`.

## 11. A dark hall, a projector, a live counter [05-audience]

Custom positions for particles (`kit.particles({ positions })`), instanced silhouettes, `kit.glare` for the projector, and `kit.odometer(ctx.$('#hrs'), { decimals: 1 })` set every frame from `s.t`. The counter is honest arithmetic (people × seconds / 3600). Say so in the notes.

## 12. Everyone alive: the globe

```js
const sky = kit.sky({ preset: 'space' }); scene.add(sky.mesh);
const earth = kit.globe({ radius: 10, sun: [-0.55, 0.28, 0.78] }); scene.add(earth.group);
// update(s): earth.set({ lights: s.k(1, 0, 3) }); earth.update(s.t + 20);
```
Camera at about `[0, 4, 38]`, fov 30. Night lights read best with the camera on the dark side and the sun behind the planet's limb.

## 13. A screenshot or photo as a physical card

Put the file in `<deck>/assets/`.
```js
const card = kit.card({ map: ctx.texture('screenshot.jpg'), w: 16, h: 9, border: 0.2, emissive: 0.5 });
card.group.rotation.set(-0.08, -0.32, 0); scene.add(card.group);
kit.env(ctx, scene, sky);                 // reflections and soft light on the card
```
Post: `crisp`. `emissive` (0.4–0.7) keeps the screenshot readable when it is backlit. For a demo video, use a `THREE.VideoTexture` on an HTML `<video src="${ctx.asset('demo.mp4')}" muted loop playsinline>` you create in `create()`.

## 14. A custom shader world

When no kit piece fits, draw the world in one fullscreen pass. Work in linear colour and finish with `toSRGB`.
```js
create(ctx) {
  const pass = ctx.pass(`
    uniform float uR;
    void main(){
      vec2 q=(vUv-.5)*vec2(uAsp,1.);
      vec3 ground=mix(vec3(.05,.04,.03),vec3(.32,.26,.17),fbm(q*5.)*.6+fbm(q*22.)*.4);
      float pool=exp(-pow(length(q-vec2(-.35,-.12))/max(uR,1e-3),2.));
      vec3 c=ground*vec3(1.,.72,.42)*pool*2.2;
      o=vec4(toSRGB(c),1.);
    }`, { uR: 0 });
  return { update(s) { pass.u.uR = 0.18 * s.k(0, 0, 3, ease.out3); }, render(out) { pass.render(out); } };
}
```
To pin a label to shader space: stage x = 960 + q.x × 1080, stage y = 540 − q.y × 1080, then `pin.set(x, y)`.

## 15. Interactive split [06-split]

Render the world into a target, composite it with a flat left half, clip the two type groups with `clip-path: polygon(...)` at the divider, and add a drag handle with `data-interactive`:
```js
const follow = (e) => { manual = clamp(e.clientX / innerWidth, 0.02, 0.98); };   // event-driven, not in update()
handle.addEventListener('pointerdown', (e) => { dragging = true; handle.setPointerCapture(e.pointerId); follow(e); e.stopPropagation(); });
handle.addEventListener('pointermove', (e) => { if (dragging) follow(e); });
handle.addEventListener('pointerup', (e) => { dragging = false; follow(e); e.stopPropagation(); });
// update(s): x = manual != null ? damp(x, manual, 14, s.dt) : scripted;
render(out) { ctx.post.render(scene, camera, world, { preset: 'film' }); comp.u.tW = world.texture; comp.u.uX = x; comp.render(out); }
```

## 16. The callback wall [07-wall]

`kit.wall(ctx, ['office', 'four', 'place', ...], { w: 16, gap: 1, border: 0.22 })` stacks real thumbnails (after the first snap and rebuild). Dim the others and keep one lit through `card.material.emissiveIntensity`. Move the camera up the stack across beats.

## 17. The bookend [08-questions]

Page in WebGL (`bg: '#ffffff'`), type in a `.group` so it can tilt, a dark `#void` div behind it that appears as it tilts:
```js
const k = s.k(2, 3, 7, ease.io3);
sheet.style.transform = `rotate(${k}deg) scale(${1 - 0.06 * k})`;
voidEl.style.opacity = Math.min(1, k * 4);
```
Set `page: '1'` on its beats so the counter returns to the start.

## 18. Camera moves across several beats

```js
const rig = kit.rig(camera, [
  { pos: [0, 2, 14], look: [0, 1, 0] },              // beat 0
  { pos: [8, 6, 30], look: [0, 4, 0], fov: 40 },      // after beat 1
  { pos: [0, 40, 60], look: [0, 0, 0], fov: 50 },     // after beat 2
]);
// update(s):
rig.at(s.k(1, 0, 5, ease.smoother) + s.k(2, 0, 6, ease.smoother));
rig.shake(0.02, s.t, 0.5);   // a held frame stays alive
```

## 19. Sound cues

Off until the presenter presses M. Per beat: `{ dur: 6, sfx: ['swell', { dur: 4 }] }`. Inside a beat: `s.cue(1, 2.4, () => ctx.sfx('thud', { gain: 0.3 }))`. Voices: `tick`, `type`, `whoosh` (`dur`, `from`, `to`), `swell` (`dur`, `f`), `thud`, `chime` (`f`), `rise` (`dur`), `hit`.
