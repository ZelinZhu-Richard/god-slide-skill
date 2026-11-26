// Ridged fbm terrain (mountains, dunes, a far range on the horizon). CPU heights, so
// heightAt() is exact and the mesh takes standard lights, shadows and fog.
//
//   const land = kit.terrain({ size: 2400, height: 220, flat: 300 });   // flat valley in the middle
//   scene.add(land.mesh);
import * as THREE from 'three';
import { rng } from '../core/ease.js';

function makeNoise(seed) {
  const R = rng(seed);
  const perm = new Uint8Array(512), val = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = R(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
  const h = (x, y) => val[perm[(perm[x & 255] + y) & 255]];
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return { n, ridged(x, y, oct = 6) { let s = 0, a = 0.5, f = 1, w = 1; for (let i = 0; i < oct; i++) { let r = 1 - Math.abs(n(x * f, y * f) * 2 - 1); r *= r * w; w = Math.min(1, r * 2); s += r * a; f *= 2.03; a *= 0.5; } return s; },
    fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; f *= 2.03; a *= 0.5; } return s; } };
}

export function terrain({
  size = 2400, segments = 256, height = 180, seed = 3, scale = 1 / 520, ridged = 0.75,
  flat = 0, flatEdge = 300, snow = 0.62, colors = {}, offset = [0, 0], roughness = 0.95,
} = {}) {
  const N = makeNoise(seed);
  const C = {
    low: new THREE.Color(colors.low || '#7d7461'), mid: new THREE.Color(colors.mid || '#9a8f7a'),
    rock: new THREE.Color(colors.rock || '#6f6a64'), snow: new THREE.Color(colors.snow || '#f4f4f2'),
  };
  const hAt = (x, z) => {
    const X = (x + offset[0]) * scale, Z = (z + offset[1]) * scale;
    let h = N.ridged(X, Z) * ridged + N.fbm(X * 1.7 + 9, Z * 1.7) * (1 - ridged);
    h = Math.pow(Math.max(0, h - 0.18), 1.35) * height * 1.6;
    if (flat > 0) { const d = Math.hypot(x, z); h *= THREE.MathUtils.smoothstep(d, flat, flat + flatEdge); }
    return h;
  };
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / (height * 1.2), slope = 1 - nor.getY(i);
    c.copy(C.low).lerp(C.mid, THREE.MathUtils.smoothstep(y, 0.05, 0.35));
    c.lerp(C.rock, THREE.MathUtils.smoothstep(slope, 0.18, 0.42));
    c.lerp(C.snow, THREE.MathUtils.smoothstep(y, snow, snow + 0.12) * (1 - THREE.MathUtils.smoothstep(slope, 0.35, 0.6)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  return { mesh, heightAt: hAt };
}
