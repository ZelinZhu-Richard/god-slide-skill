// A city of instanced buildings with procedural windows. Standard PBR material (so it takes
// sun, shadows, fog and environment light) with windows injected: glassy by day, lit by night.
//
//   const town = kit.city({ radius: 420, seed: 4 });
//   scene.add(town.mesh);
//   update(s){ town.set({ night: s.k(1), lights: s.k(1, 1, 4) }); }
import * as THREE from 'three';
import { rng } from '../core/ease.js';

export function city({
  radius = 420, seed = 7, block = 16, street = 7, minH = 4, maxH = 70, core = 0.28,
  max = 12000, color = '#e9e6df', tint = [1, 1, 1], night = 0, lights = 0,
  windowColor = [2.4, 1.55, 0.8], center = [0, 0], skip = 0.12, heightFn = null,
} = {}) {
  const R = rng(seed);
  const lots = [];
  const pitch = block + street;
  const n = Math.ceil(radius / pitch);
  for (let gx = -n; gx <= n; gx++) for (let gz = -n; gz <= n; gz++) {
    const bx = center[0] + gx * pitch, bz = center[1] + gz * pitch;
    const d = Math.hypot(bx - center[0], bz - center[1]);
    if (d > radius) continue;
    const split = R() < 0.6 ? 2 : 1;
    const sz = block / split;
    for (let i = 0; i < split; i++) for (let j = 0; j < split; j++) {
      if (R() < skip) continue;
      const w = sz * (0.6 + 0.35 * R()), dp = sz * (0.6 + 0.35 * R());
      const x = bx - block / 2 + sz * (i + 0.5) + (R() - 0.5) * (sz - w) * 0.6;
      const z = bz - block / 2 + sz * (j + 0.5) + (R() - 0.5) * (sz - dp) * 0.6;
      const fall = Math.exp(-((d / (radius * core)) ** 2)) * 0.85 + Math.exp(-d / (radius * 0.55)) * 0.35;
      let h = heightFn ? heightFn(x, z, d, R) : minH + (maxH - minH) * fall * (0.25 + 0.75 * R() ** 2.2);
      h = Math.max(minH * 0.6, h);
      lots.push({ x, z, w, d: dp, h, r: R() });
      if (lots.length >= max) break;
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const U = {
    uNight: { value: night }, uLights: { value: lights }, uTint: { value: new THREE.Vector3(...tint) },
    uWin: { value: new THREE.Vector3(...windowColor) },
  };
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGsW; varying vec3 vGsN; flat varying float vGsR;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 gsP = vec4(transformed, 1.0);
        vec3 gsN = objectNormal;
        #ifdef USE_INSTANCING
          gsP = instanceMatrix * gsP; gsN = mat3(instanceMatrix) * gsN;
        #endif
        vGsW = (modelMatrix * gsP).xyz;
        vGsN = normalize(mat3(modelMatrix) * gsN);
        vGsR = fract(sin(float(gl_InstanceID) * 12.9898 + 1.7) * 43758.5453);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGsW; varying vec3 vGsN; flat varying float vGsR;
        uniform float uNight, uLights; uniform vec3 uTint, uWin;
        float gsH(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
        vec3 gsWin(){
          vec3 N=normalize(vGsN);
          if(abs(N.y)>.5) return vec3(0.);
          float u=abs(N.x)>.5?vGsW.z:vGsW.x;
          vec2 g=vec2(u/3.1,vGsW.y/3.5); vec2 id=floor(g), f=fract(g);
          float m=step(.16,f.x)*step(f.x,.84)*step(.26,f.y)*step(f.y,.82)*step(2.2,vGsW.y);
          float on=step(gsH(vec3(id,vGsR*91.)),uLights*(.3+.7*vGsR));
          return vec3(m,on,gsH(vec3(id+3.,vGsR*13.)));
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 gw=gsWin();
        float gsBase=smoothstep(0.,8.,vGsW.y);
        diffuseColor.rgb*=uTint*mix(.84,1.1,vGsR)*mix(.6,1.,gsBase);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb*vec3(.42,.5,.6),vec3(.035,.04,.05),uNight),gw.x*.8);
        diffuseColor.rgb*=mix(1.,.16,uNight);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.18,gw.x);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance+=gw.x*gw.y*uWin*(.45+.9*gw.z)*uNight;`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, lots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  lots.forEach((L, i) => { p.set(L.x, 0, L.z); s.set(L.w, L.h, L.d); m.compose(p, q, s); mesh.setMatrixAt(i, m); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const C = {
    mesh, lots, material: mat, count: lots.length,
    set({ night: nt, lights: l, tint: t, windowColor: w } = {}) {
      if (nt != null) U.uNight.value = nt;
      if (l != null) U.uLights.value = l;
      if (t) U.uTint.value.set(...t);
      if (w) U.uWin.value.set(...w);
      return C;
    },
    /** Change one building's height (e.g. grow a tower) */
    setHeight(i, h) {
      const L = lots[i]; L.h = h; p.set(L.x, 0, L.z); s.set(L.w, h, L.d); m.compose(p, q, s);
      mesh.setMatrixAt(i, m); mesh.instanceMatrix.needsUpdate = true; return C;
    },
    tallest() { return lots.reduce((a, L, i) => (L.h > lots[a].h ? i : a), 0); },
  };
  return C;
}

/** Simple ground plane that takes shadows. */
export function ground({ size = 4000, color = '#cfccc4', roughness = 1 } = {}) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness }));
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}
