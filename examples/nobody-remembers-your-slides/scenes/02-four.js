// 02 — Four slots. A measured fact made physical: working memory holds about four things.
// Beat 2 drops ninety bullet-point cards through the dark. Four are caught. The rest fall.
import * as THREE from 'three';
import { kit, ease, rng, clamp } from 'god-slide';

// Paper cards with fake bullet text (drawn once, reused).
function bulletTextures(n = 8) {
  const R = rng(11);
  return Array.from({ length: n }, (_, k) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 288;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#2b2b2b'; g.fillRect(36, 34, 150 + R() * 180, 22);
    const lines = 2 + Math.floor(R() * 3);
    for (let i = 0; i < lines; i++) {
      const y = 92 + i * 52;
      g.beginPath(); g.arc(48, y + 8, 6, 0, 7); g.fillStyle = '#555'; g.fill();
      g.fillStyle = '#9a978f'; g.fillRect(70, y, 140 + R() * 260, 16);
    }
    if (k % 3 === 2) { g.fillStyle = '#4472C4'; for (let i = 0; i < 4; i++) { const h = 20 + R() * 70; g.fillRect(330 + i * 34, 250 - h, 24, h); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  });
}

export default {
  id: 'four',
  title: 'Four slots',
  enter: 'daybreak',
  hud: { color: '#e9e4d8' },
  beats: [
    { dur: 4.5, notes: 'People who measure working memory put it at about four things at once.\nFour slots. That is your whole budget.' },
    { dur: 7, sfx: ['whoosh', { dur: 1.8 }], notes: 'A normal deck hands the room ninety bullet points. Four stick. The rest fall through.\n(Say nothing until the last card has fallen.)' },
  ],
  html: `
    <h1 class="display mid light tl" data-beat="0" data-until="1" data-out-dur="0.5">Your audience can hold<br>about four things.</h1>
    <p class="source tl" style="top:316px" data-beat="0" data-delay="1.2" data-until="1" data-out-dur="0.4">Working-memory capacity, Cowan 2001</p>
    <h1 class="display mid light tl" data-beat="1" data-delay="0.7">You gave them ninety.</h1>
  `,
  create(ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050506');
    scene.fog = new THREE.FogExp2('#050506', 0.012);
    const camera = ctx.camera(34, 0.1, 400);

    // four slots: thin glowing frames with a pool of light under each
    const slotX = [-8.1, -2.7, 2.7, 8.1];
    const W = 4.6, H = 2.6;
    const frameMats = [];
    const slots = slotX.map((x) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
      frameMats.push(mat);
      const bar = (w, h, px, py) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), mat); m.position.set(px, py, 0); g.add(m); };
      const t = 0.035;
      bar(W + t, t, 0, H / 2); bar(W + t, t, 0, -H / 2); bar(t, H, -W / 2, 0); bar(t, H, W / 2, 0);
      g.position.set(x, 0, 0);
      scene.add(g);
      const spot = new THREE.SpotLight('#ffe2bd', 0, 30, 0.32, 0.6, 1.2);
      spot.position.set(x, 9, 3); spot.target.position.set(x, -1, 0);
      scene.add(spot, spot.target);
      return { g, spot };
    });
    scene.add(new THREE.HemisphereLight('#26262c', '#000000', 0.35));
    const rim = new THREE.DirectionalLight('#9fb6ff', 0.6); rim.position.set(-6, 4, -8); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -6.5; scene.add(floor);

    // ninety cards; the first four are the ones that get caught
    const tex = bulletTextures();
    const R = rng(4);
    const cards = Array.from({ length: 90 }, (_, i) => {
      const c = kit.card({ map: tex[i % tex.length], w: W * 0.92, h: H * 0.92, roughness: 0.7, emissive: 0.08 });
      const caught = i < 4;
      const d = {
        c, caught,
        start: new THREE.Vector3((R() - 0.5) * 34, 13 + R() * 14, -8 + R() * 10),
        rot: new THREE.Euler(R() * 6, R() * 6, R() * 6),
        spin: new THREE.Vector3((R() - 0.5) * 5, (R() - 0.5) * 5, (R() - 0.5) * 5),
        t0: caught ? 0.4 + i * 0.55 : 0.15 + R() * 3.6,
        slot: caught ? new THREE.Vector3(slotX[[1, 3, 0, 2][i]], 0, 0.06) : null,
      };
      if (caught) d.start.set(d.slot.x + (R() - 0.5) * 6, 14 + R() * 3, -2);
      c.group.visible = false;
      scene.add(c.group);
      return d;
    });
    const dust = kit.particles({ count: 2500, mode: 'dust', radius: 18, height: 14, box: [36, 16, 16], size: 0.12, color: '#ffe8c8', alpha: 0.35, center: [0, -5, -2] });
    scene.add(dust.points);
    const rig = kit.rig(camera, [{ pos: [0, 0.4, 27], look: [0, 0.6, 0] }, { pos: [0, 1.4, 31], look: [0, 1.2, 0] }]);
    const e = new THREE.Euler(), zero = new THREE.Quaternion();

    return {
      scene, camera,
      post: { preset: 'film', bloom: 0.55, threshold: 0.9, vignette: 0.32 },
      update(s) {
        slots.forEach((sl, i) => {
          const on = s.k(0, 0.5 + i * 0.4, 1.3 + i * 0.4, ease.out3);
          frameMats[i].color.setRGB(2.6 * on, 2.25 * on, 1.85 * on);
          sl.spot.intensity = 60 * on;
        });
        const t = s.at(1);
        for (const d of cards) {
          const u = t - d.t0;
          d.c.group.visible = u > 0;
          if (u <= 0) continue;
          if (d.caught) {
            const k = ease.out4(clamp(u / 1.7));
            d.c.group.position.lerpVectors(d.start, d.slot, k);
            e.set(d.rot.x * (1 - k), d.rot.y * (1 - k), d.rot.z * (1 - k));
            d.c.group.quaternion.setFromEuler(e).slerp(zero, k);
          } else {
            d.c.group.position.set(d.start.x + d.spin.x * u * 0.3, d.start.y - 7 * u * u, d.start.z + d.spin.z * u * 0.2);
            e.set(d.rot.x + d.spin.x * u, d.rot.y + d.spin.y * u, d.rot.z + d.spin.z * u);
            d.c.group.quaternion.setFromEuler(e);
            d.c.group.visible = d.c.group.position.y > -12;
          }
        }
        dust.update(s.t);
        rig.at(s.k(1, 0, 5, ease.smoother));
        rig.shake(0.015, s.t, 0.5);
      },
    };
  },
};
