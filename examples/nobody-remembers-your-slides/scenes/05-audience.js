// 05 — The presenter's view: a dark hall of 300 people, lit by the screen behind you,
// the projector glaring from the back. Beat 2 starts a live counter of the hours this
// room has spent on you since the slide opened.
import * as THREE from 'three';
import { kit, ease } from 'god-slide';

/** Seat positions: curved, stepped rows, front row first (that is also the reveal order). */
function hall(target = 300) {
  const pts = [];
  for (let row = 0; pts.length < target * 3; row++) {
    const r = 8 + row * 1.3, y = row * 0.52;
    const n = Math.floor((r * 1.7) / 1.0);
    for (let k = 0; k < n && pts.length < target * 3; k++) {
      const a = -0.85 + (1.7 * (k + 0.5)) / n;
      pts.push(Math.sin(a) * r, y, -Math.cos(a) * r - 3);
    }
  }
  return new Float32Array(pts);
}

export default {
  id: 'audience',
  title: 'Three hundred people',
  enter: 'dip',
  hud: { color: '#f1e6d4' },
  beats: [
    { dur: 4.5, notes: 'This is what you see from the stage. Three hundred people. Each of them gave you twenty minutes.' },
    { dur: 3, notes: 'Keep talking while the counter runs. It never stops.\n(Every second this slide is up, the room spends another five minutes.)' },
  ],
  html: `
    <h1 class="display big light tl shadow" data-beat="0" data-until="1" data-out-dur="0.5"><span data-beat="0" data-fx="count" data-to="300" data-dur="3.4">300</span> people.</h1>
    <p class="display small light tl shadow" data-beat="1" data-delay="0.5">Since this slide opened,<br>this room has spent</p>
    <p class="display light shadow num" style="left:116px;top:300px;font-size:150px;line-height:1.1;white-space:nowrap" data-beat="1" data-fx="fade" data-delay="1.1"><span id="hrs">0</span><span class="small"> hours on you.</span></p>
  `,
  create(ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030304');
    scene.fog = new THREE.FogExp2('#05050a', 0.03);
    const camera = ctx.camera(42, 0.1, 300);
    const P = hall(300);
    const N = P.length / 3;
    // people: seat back, body, head (instanced), dimly lit from the screen behind the camera
    const dark = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const seat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.95, 0.12), dark('#1a1a20'), N);
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), dark('#2a2522'), N);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 16, 12), dark('#6b5446'), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const place = (mesh, i, dy, dz) => {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      q.setFromAxisAngle(up, Math.atan2(-x, -(z + 3)));
      const off = new THREE.Vector3(0, 0, dz).applyQuaternion(q);
      m.compose(new THREE.Vector3(x + off.x, y + dy, z + off.z), q, one);
      mesh.setMatrixAt(i, m);
    };
    for (let i = 0; i < N; i++) { place(seat, i, 0.5, -0.25); place(body, i, 0.75, -0.05); place(head, i, 1.3, 0); }
    scene.add(seat, body, head);
    const screenLight = new THREE.DirectionalLight('#c9d6ff', 0.0);
    screenLight.position.set(0, 4, 14); scene.add(screenLight);
    scene.add(new THREE.HemisphereLight('#1d2030', '#000000', 0.25));
    // faces catch a little warm light: one soft point per person, revealed front row first
    const faces = new Float32Array(P.length);
    for (let i = 0; i < N; i++) { faces[i * 3] = P[i * 3]; faces[i * 3 + 1] = P[i * 3 + 1] + 1.3; faces[i * 3 + 2] = P[i * 3 + 2] + 0.2; }
    const glow = kit.particles({ positions: faces, mode: 'field', size: 0.9, color: '#ffcf96', color2: '#dfe8ff', sizeVar: 0.25, alpha: 0.55 });
    scene.add(glow.points);
    const projector = kit.glare({ color: '#fff1dc', size: 46, rays: 22, spread: 1.2 });
    projector.mesh.position.set(0, 14, -36);
    scene.add(projector.mesh);
    const dust = kit.particles({ count: 2500, mode: 'dust', box: [26, 14, 30], center: [0, 4, -18], size: 0.07, color: '#ffe9cc', alpha: 0.4 });
    scene.add(dust.points);
    const rig = kit.rig(camera, [{ pos: [0, 2.0, 7], look: [0, 4.2, -16], fov: 42 }, { pos: [1.2, 2.3, 5], look: [0, 4.8, -18], fov: 44 }]);
    const odo = kit.odometer(ctx.$('#hrs'), { decimals: 1 });
    return {
      scene, camera,
      post: { preset: 'film', bloom: 0.5, threshold: 1.0, halation: 0.5, vignette: 0.4, grad: 0.2 },
      update(s) {
        const fill = s.k(0, 0.3, 3.8, ease.io2);
        glow.set({ on: fill });
        screenLight.intensity = 1.6 * s.k(0, 0, 1.5);
        projector.set({ intensity: 0.5 + 0.5 * s.k(0, 0, 2) });
        glow.update(s.t, ctx.gfx); dust.update(s.t, ctx.gfx); projector.update(s.t);
        // live: 300 people x seconds since the slide opened / 3600 = hours
        odo.set((300 * s.t) / 3600);
        rig.at(s.k(1, 0, 3, ease.smoother));
        rig.shake(0.02, s.t, 0.4);
      },
    };
  },
};
