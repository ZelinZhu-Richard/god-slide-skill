// 07 — The callback. Every slide of this talk, stacked as a wall in the sky (real
// thumbnails, rendered by snap.mjs). Beat 2 finds the one picture people keep.
import * as THREE from 'three';
import { kit, ease } from 'god-slide';

const IDS = ['office', 'four', 'place', 'size', 'audience', 'split'];

export default {
  id: 'wall',
  title: 'What they keep',
  enter: 'portal',
  hud: { color: '#ffffff' },
  beats: [
    { dur: 6, notes: 'Here is everything I have shown you, stacked up.\nNobody will remember most of it. That is fine.' },
    { dur: 5, sfx: ['chime', { f: 660 }], notes: 'They will remember one picture. Usually the boat.\nDecide which picture yours is before you make a single slide.' },
  ],
  html: `
    <h1 class="display big light tl shadow" data-beat="0" data-until="1" data-out-dur="0.5">Nobody remembers<br>your slides.</h1>
    <h1 class="display mid light bl shadow" data-beat="1" data-delay="1.6">They remember<br>one picture.</h1>
  `,
  create(ctx) {
    const scene = new THREE.Scene();
    const camera = ctx.camera(40, 0.1, 6000);
    const sky = kit.sky({ preset: 'noon', clouds: 0.5, cloudScale: 0.4, sunElevation: 35, sunAzimuth: 205 });
    scene.add(sky.mesh);
    kit.env(ctx, scene, sky);
    kit.lights(scene, { dir: sky.sunDir, color: '#fff0dc', intensity: 1.2, fill: 0.35 });
    const wall = kit.wall(ctx, IDS, { w: 16, gap: 1.0, border: 0.22 });
    wall.group.position.set(0, -3, 0);
    scene.add(wall.group);
    const keep = wall.cards[IDS.indexOf('place')];
    const confetti = kit.particles({ count: 1500, mode: 'dust', box: [60, 70, 40], center: [0, 10, -5], size: 0.35, color: '#ffffff', alpha: 0.5, additive: false });
    scene.add(confetti.points);
    const target = new THREE.Vector3();
    const rig = kit.rig(camera, [
      { pos: [-16, -9, 26], look: [0, 26, 0], fov: 48 },
      { pos: [-12, 4, 30], look: [0, 22, -2], fov: 40 },
      { pos: [-9, 25, 36], look: [-3.5, 22.5, 0], fov: 32 },
    ]);
    return {
      scene, camera,
      post: (s) => ({ preset: 'film', bloom: 0.25, exposure: 1 - 0.08 * s.k(1), grad: 0.35 }),
      update(s) {
        sky.update(s.t);
        confetti.update(s.t, ctx.gfx);
        // other cards dim while the kept one stays lit
        const focus = s.k(1, 0.5, 3.5);
        wall.cards.forEach((c) => { c.material.emissiveIntensity = c === keep ? 0.55 + 0.35 * focus : 0.55 * (1 - 0.6 * focus); });
        rig.at(s.k(0, 0, 6, ease.smoother) + s.k(1, 0, 4.5, ease.smoother));
        keep.group.getWorldPosition(target);
      },
    };
  },
};
