// 03 — Make the idea a place. A paper boat on a golden sea; beat 2 changes the weather.
// The same world transforms between beats: that is what a beat is for.
import * as THREE from 'three';
import { kit, ease } from 'god-slide';

/** Origami boat: flat-shaded paper folds. Reused by the split scene. */
export function paperBoat(color = '#f2eee6') {
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  const K0 = [-1.05, 0, 0], K1 = [1.05, 0, 0];
  const L0 = [-1.85, 0.72, 0.46], L1 = [1.85, 0.72, 0.46], R0 = [-1.85, 0.72, -0.46], R1 = [1.85, 0.72, -0.46];
  tri(K0, K1, L1); tri(K0, L1, L0); tri(K0, R1, K1); tri(K0, R0, R1);
  tri(K1, R1, L1); tri(K0, L0, R0);
  const S = [0, 2.25, 0], a = [-1.2, 0.72, 0], b = [1.2, 0.72, 0], m = [0, 0.72, 0.34], n = [0, 0.72, -0.34];
  tri(a, m, S); tri(m, b, S); tri(a, S, n); tri(n, S, b);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide, flatShading: true }));
  mesh.castShadow = true;
  return mesh;
}

export default {
  id: 'place',
  title: 'Make it a place',
  enter: 'wash',
  hud: { color: '#fff4e4' },
  beats: [
    { dur: 5, notes: 'An idea is easier to remember when it is somewhere. This one is a small boat on a calm sea.' },
    { dur: 6, sfx: ['swell', { dur: 4 }], notes: 'Then you do not change the slide. You change the weather.\nSame boat, same sea. Now it is a story.' },
  ],
  html: `
    <h1 class="display big light tl shadow" data-beat="0" data-until="1" data-out-dur="0.5">Make each idea<br>a place.</h1>
    <h1 class="display big light tl shadow" data-beat="1" data-delay="1.4">Then change<br>the weather.</h1>
  `,
  create(ctx) {
    const scene = new THREE.Scene();
    const camera = ctx.camera(38, 0.1, 8000);
    const sky = kit.sky({ preset: 'golden', clouds: 0.38, sunAzimuth: 26 });
    scene.add(sky.mesh);
    const sea = kit.ocean({ sky, amp: 0.45 });
    scene.add(sea.mesh);
    const boat = paperBoat();
    boat.scale.setScalar(0.9);
    scene.add(boat);
    const L = kit.lights(scene, { dir: sky.sunDir, color: '#ffcf9a', intensity: 2.6, sky: '#8d9bbd', ground: '#2c241d', fill: 0.55 });
    const rig = kit.rig(camera, [
      { pos: [-3.5, 1.9, 10.5], look: [0.6, 1.4, -6], fov: 36 },
      { pos: [-5.5, 3.6, 16], look: [0.5, 2.2, -10], fov: 40 },
    ]);
    const up = new THREE.Vector3(0, 1, 0), tilt = new THREE.Quaternion(), yaw = new THREE.Quaternion().setFromAxisAngle(up, 0.5);
    return {
      scene, camera,
      post: (s) => ({ preset: 'film', bloom: 0.42, halation: 0.35, exposure: 0.92 - 0.22 * s.k(1, 0, 4), grad: 0.7 }),
      update(s) {
        const storm = s.k(1, 0, 4.5, ease.io2);
        sea.set({ amp: 0.45 + 1.9 * storm, foam: 0.4 + 0.6 * storm });
        sky.blend('golden', 'dusk', storm * 0.85);
        sky.set({ clouds: 0.38 + 0.45 * storm });
        sky.setSun(6 - 4 * storm, 26); // keep our sun position while the colours change
        L.setDir(sky.sunDir);
        sea.update(s.t * (1 + 0.4 * storm), camera);
        sky.update(s.t);
        const w = sea.sample(0, 0, s.t * (1 + 0.4 * storm));
        boat.position.set(0, w.y + 0.05, 0);
        tilt.setFromUnitVectors(up, w.normal);
        boat.quaternion.copy(tilt).multiply(yaw);
        rig.at(s.k(1, 0, 5, ease.smoother));
        rig.shake(0.03 + 0.12 * storm, s.t, 0.6);
      },
    };
  },
};
