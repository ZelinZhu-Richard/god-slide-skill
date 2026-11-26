// Camera rigs and lighting helpers.
//
//   const rig = kit.rig(camera, [
//     { pos: [0, 2, 12], look: [0, 1.5, 0], fov: 35 },
//     { pos: [6, 30, 60], look: [0, 18, 0], fov: 42 },
//   ]);
//   update(s){ rig.at(s.k(1, 0, 6, ease.smoother)); rig.shake(0.02 * s.k(2), s.t); }
import * as THREE from 'three';
import { clamp, lerp, ease } from '../core/ease.js';

export function rig(camera, keys) {
  const pts = keys.map((k) => new THREE.Vector3(...k.pos));
  const curve = pts.length > 1 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5) : null;
  const looks = keys.map((k) => new THREE.Vector3(...(k.look || [0, 0, 0])));
  const look = new THREE.Vector3(), off = new THREE.Vector3();
  const R = {
    camera, keys, u: 0,
    /** u in [0, keys.length - 1]: 0 = first key, 1 = second key... fractional = in between */
    at(u) {
      const n = keys.length;
      u = clamp(u, 0, n - 1);
      R.u = u;
      if (curve) camera.position.copy(curve.getPoint(n > 1 ? u / (n - 1) : 0));
      else camera.position.copy(pts[0]);
      const i = Math.min(n - 2, Math.floor(u)), f = n > 1 ? u - Math.max(0, i) : 0;
      const a = keys[Math.max(0, i)], b = keys[Math.min(n - 1, Math.max(0, i) + 1)];
      const e = ease.smoother(f);
      look.lerpVectors(looks[Math.max(0, i)], looks[Math.min(n - 1, Math.max(0, i) + 1)], e);
      camera.lookAt(look);
      if (a.roll != null || b.roll != null) camera.rotateZ(THREE.MathUtils.degToRad(lerp(a.roll || 0, b.roll || 0, e)));
      const fa = a.fov ?? camera.userData.fov16x9 ?? camera.fov, fb = b.fov ?? fa;
      const fov = lerp(fa, fb, e);
      if (Math.abs((camera.userData.fov16x9 ?? camera.fov) - fov) > 1e-4) {
        camera.userData.fov16x9 = fov;
        // keep the 16:9 frame inside narrow windows
        if (camera.aspect < 16 / 9) camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * (16 / 9) / camera.aspect));
        else camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      return R;
    },
    /** Sum of eased beat moves: rig.at(rig.u + ...) is awkward, so use rig.path([k1, k2, ...]) */
    path(parts) { return R.at(parts.reduce((a, b) => a + b, 0)); },
    /** Handheld shake (amount in world units), call after at(). */
    shake(amount, t, freq = 1) {
      if (!amount) return R;
      off.set(Math.sin(t * 1.7 * freq) + Math.sin(t * 3.1 * freq) * 0.5, Math.sin(t * 2.3 * freq + 1) + Math.sin(t * 4.7 * freq) * 0.3, 0).multiplyScalar(amount);
      camera.position.add(off.applyQuaternion(camera.quaternion));
      return R;
    },
    lookAt() { return look.clone(); },
  };
  R.at(0);
  return R;
}

/**
 * Sun + sky/ground fill (+ shadows) in one call.
 * kit.lights(scene, { dir: sky.sunDir, color: '#fff1d6', intensity: 3, sky: '#9fc3ff', ground: '#6b5f50', shadow: 120 })
 */
export function lights(scene, { dir = [0.5, 1, 0.3], color = '#ffffff', intensity = 2.5, sky = '#bcd4ff', ground = '#6d655c', fill = 0.6, shadow = 0, shadowRes = 2048, target = [0, 0, 0] } = {}) {
  const hemi = new THREE.HemisphereLight(sky, ground, fill);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(color, intensity);
  const d = Array.isArray(dir) ? new THREE.Vector3(...dir) : dir.clone();
  d.normalize();
  sun.position.copy(d).multiplyScalar(shadow ? shadow * 2 : 100).add(new THREE.Vector3(...target));
  sun.target.position.set(...target);
  scene.add(sun, sun.target);
  if (shadow) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    const c = sun.shadow.camera;
    c.left = -shadow; c.right = shadow; c.top = shadow; c.bottom = -shadow; c.near = 0.5; c.far = shadow * 5;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
  }
  return {
    hemi, sun,
    setDir(v) { const n = (Array.isArray(v) ? new THREE.Vector3(...v) : v.clone()).normalize(); sun.position.copy(n).multiplyScalar(shadow ? shadow * 2 : 100).add(sun.target.position); },
  };
}
