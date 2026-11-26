// 02 — A hero scene: the idea as a place. Replace the world with your metaphor.
import * as THREE from 'three';
import { kit, ease } from 'god-slide';

export default {
  id: 'hero',
  title: 'The idea as a place',
  enter: 'portal',
  hud: { color: '#ffffff' },
  beats: [
    { dur: 4, notes: 'Set the scene calmly.' },
    { dur: 5, notes: 'Change one thing in the world. That change is the point.' },
  ],
  html: `
    <h1 class="display big light tl shadow" data-beat="0" data-until="1" data-out-dur="0.5">Headline one.</h1>
    <h1 class="display big light tl shadow" data-beat="1" data-delay="1">Headline two.</h1>
  `,
  create(ctx) {
    const scene = new THREE.Scene();
    const camera = ctx.camera(38, 0.1, 8000);
    const sky = kit.sky({ preset: 'golden', sunAzimuth: 24 });
    scene.add(sky.mesh);
    const sea = kit.ocean({ sky, amp: 0.5 });
    scene.add(sea.mesh);
    const rig = kit.rig(camera, [
      { pos: [0, 3, 14], look: [0, 1.5, -10] },
      { pos: [0, 7, 24], look: [0, 2.5, -20], fov: 42 },
    ]);
    return {
      scene, camera,
      post: { preset: 'film', grad: 0.5 },
      update(s) {
        sea.set({ amp: 0.5 + 1.2 * s.k(1, 0, 4) });
        sea.update(s.t, camera);
        sky.update(s.t);
        rig.at(s.k(1, 0, 5, ease.smoother));
      },
    };
  },
};
