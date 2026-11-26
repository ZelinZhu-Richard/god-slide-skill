// 06 — Same facts, different picture. Left: the default template. Right: the world.
// The divider sweeps on its own, and the presenter can drag it live (data-interactive).
import * as THREE from 'three';
import { kit, ease, clamp, damp } from 'god-slide';
import { paperBoat } from './03-place.js';

export default {
  id: 'split',
  title: 'Same facts, different picture',
  enter: 'tear',
  hud: { color: (s) => '#ffffff' },
  beats: [
    { dur: 3.5, notes: 'Same facts. On the left, the template we all use. On the right, the same sentence as a place.\n(You can drag the line. Do it if someone asks which one they would remember.)' },
    { dur: 4, notes: 'Different picture. Which one will they describe to someone at dinner?' },
  ],
  html: `
    <div class="group" id="left">
      <h2 class="office-h" style="top:110px">Our Strategy</h2>
      <ul class="office-ul" style="top:290px"><li>Stay calm under pressure</li><li>Adapt to change</li><li>Navigate uncertainty</li></ul>
    </div>
    <div class="group" id="right">
      <h1 class="display mid light shadow" style="left:1030px;top:110px;white-space:nowrap" data-beat="0" data-delay="0.6">Same facts.</h1>
      <h1 class="display mid light shadow" style="left:1030px;top:220px;white-space:nowrap" data-beat="1" data-delay="0.9">Different picture.</h1>
    </div>
    <div id="handle" data-interactive style="top:0;width:120px;height:1080px;margin-left:-60px;touch-action:none">
      <div style="position:absolute;left:58px;top:0;width:4px;height:1080px;background:#fff;box-shadow:0 0 18px rgba(0,0,0,.25)"></div>
      <div style="position:absolute;left:34px;top:516px;width:52px;height:52px;border-radius:50%;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.3)"></div>
    </div>
  `,
  create(ctx) {
    // the world on the right: a quieter version of the sea scene
    const scene = new THREE.Scene();
    const camera = ctx.camera(38, 0.1, 8000);
    const sky = kit.sky({ preset: 'golden', clouds: 0.4, sunAzimuth: 30 });
    scene.add(sky.mesh);
    const sea = kit.ocean({ sky, amp: 0.55 });
    scene.add(sea.mesh);
    const boat = paperBoat();
    scene.add(boat);
    kit.lights(scene, { dir: sky.sunDir, color: '#ffcf9a', intensity: 2.6, sky: '#8d9bbd', ground: '#2c241d', fill: 0.55 });
    camera.position.set(4, 2.1, 10); camera.lookAt(1.2, 1.2, -6);
    const world = ctx.target({ type: 'half' });
    const comp = ctx.pass(`
      uniform sampler2D tW; uniform float uX;
      void main(){
        vec3 w=texture(tW,vUv).rgb;
        vec3 paper=vec3(1.);
        o=vec4(vUv.x<uX?paper:w,1.);
      }`, { tW: null, uX: 0.5 });

    const left = ctx.$('#left'), right = ctx.$('#right'), handle = ctx.$('#handle');
    let x = 1, dragging = false, manual = null;
    // event-driven, so even a quick flick between two frames is caught
    const follow = (e) => { manual = clamp(e.clientX / innerWidth, 0.02, 0.98); };
    handle.addEventListener('pointerdown', (e) => { dragging = true; handle.setPointerCapture(e.pointerId); follow(e); e.stopPropagation(); });
    handle.addEventListener('pointermove', (e) => { if (dragging) follow(e); });
    handle.addEventListener('pointerup', (e) => { dragging = false; follow(e); handle.releasePointerCapture(e.pointerId); e.stopPropagation(); });
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), yaw = new THREE.Quaternion().setFromAxisAngle(up, 0.6);
    const toStage = (u) => ctx.view.x0 + u * ctx.view.w;

    return {
      enter() { manual = null; x = 1; },
      update(s) {
        const scripted = 1 - 0.47 * s.k(0, 0, 1.6, ease.io4) - 0.41 * s.k(1, 0, 2.2, ease.io4);
        x = manual != null ? damp(x, manual, 14, s.dt) : scripted;
        const sx = toStage(x);
        left.style.clipPath = `polygon(-4000px -4000px, ${sx}px -4000px, ${sx}px 5000px, -4000px 5000px)`;
        right.style.clipPath = `polygon(${sx}px -4000px, 6000px -4000px, 6000px 5000px, ${sx}px 5000px)`;
        handle.style.left = sx + 'px';
        sea.update(s.t, camera); sky.update(s.t);
        const w = sea.sample(0, 0, s.t);
        boat.position.set(0, w.y + 0.05, 0);
        q.setFromUnitVectors(up, w.normal); boat.quaternion.copy(q).multiply(yaw);
      },
      render(out) {
        ctx.post.render(scene, camera, world, { preset: 'film', bloom: 0.4, halation: 0.3, exposure: 0.92, grad: 0.5 });
        comp.u.tW = world.texture;
        comp.u.uX = x;
        comp.render(out);
      },
    };
  },
};
