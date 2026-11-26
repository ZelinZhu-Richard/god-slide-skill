// 04 — Show numbers as things. 300 people x 20 minutes = 100 hours of attention,
// built as a tower of 100 floors next to a person. The counter reads the floors.
import * as THREE from 'three';
import { kit, ease } from 'god-slide';

const FLOORS = 100, FH = 3.2, GAP = 0.22;

export default {
  id: 'size',
  title: 'One hundred hours',
  enter: 'line',
  hud: { color: '#1d2733', alpha: 0.8 },
  beats: [
    { dur: 6, notes: 'Do the arithmetic for your own talk. Three hundred people, twenty minutes each. That is a hundred hours of other people\'s lives.\nEach floor is one hour.' },
    { dur: 6, sfx: ['rise', { dur: 3 }], notes: 'Stand at the bottom and look up. Numbers land when they have a size you can stand next to.\n(This one is arithmetic, not a measurement. Say so if asked.)' },
  ],
  html: `
    <h1 class="display mid ink tl" data-beat="0" data-until="1" data-out-dur="0.5">300 people × 20 minutes<br>= <span class="bold" data-beat="0" data-fx="count" data-from="0" data-to="100" data-delay="0.6" data-dur="4.6">100</span> hours.</h1>
    <p class="source tl" style="top:330px;color:#41505f" data-beat="0" data-delay="1.4" data-until="1" data-out-dur="0.4">Illustration: one talk, one room of 300</p>
    <h1 class="display mid ink tl" data-beat="1" data-delay="1.6">Make them look up.</h1>
    <p class="label ink" id="p-top" style="white-space:nowrap;font-size:34px" data-beat="1" data-fx="fade" data-delay="2.6">hour 100</p>
    <p class="label ink" id="p-bot" style="white-space:nowrap;font-size:34px" data-beat="0" data-fx="fade" data-delay="1.2">hour 1</p>
  `,
  create(ctx) {
    const scene = new THREE.Scene();
    const camera = ctx.camera(36, 0.5, 12000);
    const sky = kit.sky({ preset: 'noon', clouds: 0.42, cloudScale: 0.45 });
    scene.add(sky.mesh);
    sky.fog(scene, 0.00032);
    const land = kit.terrain({ size: 9000, segments: 220, height: 420, flat: 900, flatEdge: 1400, seed: 9, colors: { low: '#a49a86', mid: '#8b8474' } });
    scene.add(land.mesh);
    kit.env(ctx, scene, sky);
    kit.lights(scene, { dir: sky.sunDir, color: '#fff3e0', intensity: 3.2, sky: '#b9cff5', ground: '#8f8676', fill: 0.4, shadow: 260, target: [0, 120, 0] });

    const floorGeo = new THREE.BoxGeometry(40, FH, 40);
    floorGeo.translate(0, FH / 2, 0);
    const floors = new THREE.InstancedMesh(floorGeo, new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.55 }), FLOORS);
    const m = new THREE.Matrix4();
    for (let i = 0; i < FLOORS; i++) { m.makeTranslation(0, i * (FH + GAP), 0); floors.setMatrixAt(i, m); }
    floors.castShadow = floors.receiveShadow = true;
    floors.count = 0;
    scene.add(floors);
    // a person for scale (1.75 m)
    const person = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.2, 6, 12), new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.8 }));
    person.position.set(24, 0.86, 22); person.castShadow = true;
    scene.add(person);

    const pTop = ctx.pin('#p-top'), pBot = ctx.pin('#p-bot');
    const topV = new THREE.Vector3(), botV = new THREE.Vector3(21.5, FH * 0.6, 0);
    const rig = kit.rig(camera, [
      { pos: [330, 110, 520], look: [-60, 175, 0], fov: 38 },
      { pos: [36, 1.7, 40], look: [4, 150, -4], fov: 58 },
    ]);
    let shown = 0;
    return {
      scene, camera,
      post: { preset: 'film', bloom: 0.2, contrast: 1.08 },
      // the counter in the corner reads the floors as they are built
      page: (s) => String(Math.round(shown)),
      update(s) {
        shown = FLOORS * s.k(0, 0.6, 5.2, ease.io2);
        floors.count = Math.max(0, Math.ceil(shown));
        topV.set(21.5, Math.max(1, Math.ceil(shown)) * (FH + GAP), 0);
        sky.update(s.t);
        rig.at(s.k(1, 0, 5.5, ease.smoother));
        pTop.at(topV, camera);
        pBot.at(botV, camera);
      },
    };
  },
};
