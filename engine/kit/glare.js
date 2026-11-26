// A light you look into: hot core, soft halo, faint rays. Billboarded, additive, HDR.
// Projectors at the back of a hall, a lantern in the dark, the sun seen from space.
//
//   const g = kit.glare({ color: '#ffe6c4', size: 30, rays: 18 });
//   g.mesh.position.set(0, 12, -40); scene.add(g.mesh);
//   update(s){ g.set({ intensity: s.k(0) }); g.update(s.t); }
import * as THREE from 'three';
import { LIB } from '../core/glsl.js';

export function glare({ color = '#ffe6c4', size = 20, rays = 16, intensity = 1, core = 1, spread = 1 } = {}) {
  const c = new THREE.Color(color);
  const U = {
    uC: { value: new THREE.Vector3(c.r, c.g, c.b) }, uI: { value: intensity }, uT: { value: 0 },
    uRays: { value: rays }, uCore: { value: core }, uSpread: { value: spread },
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: 'out vec2 vP; void main(){ vP=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `precision highp float; in vec2 vP; out vec4 o; uniform vec3 uC; uniform float uI, uT, uRays, uCore, uSpread; ${LIB}
      void main(){
        float d=length(vP); if(d>1.) discard;
        float a=atan(vP.y,vP.x);
        float edge=smoothstep(1.,.55,d);
        float core=exp(-d*d*900.)*30.*uCore+exp(-d*40.)*3.*uCore;
        float halo=exp(-d*7./uSpread)*.6+exp(-d*2.5/uSpread)*.12;
        float r=pow(abs(sin(a*uRays*.5+vnoise(vec2(a*3.,uT*.2))*2.)),6.)*.5+fbm(vec2(a*uRays*.6,uT*.15))*.5;
        float rays=r*exp(-d*3.2/uSpread)*.55;
        o=vec4(uC*(core+halo+rays)*uI*edge,1.);
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.onBeforeRender = (r, s, cam) => { mesh.quaternion.copy(cam.quaternion); mesh.updateMatrixWorld(); };
  const G = {
    mesh, uniforms: U,
    set({ intensity: i, color: col, spread: sp } = {}) {
      if (i != null) U.uI.value = i;
      if (sp != null) U.uSpread.value = sp;
      if (col) { const k = new THREE.Color(col); U.uC.value.set(k.r, k.g, k.b); }
      return G;
    },
    update(t) { U.uT.value = t; return G; },
  };
  return G;
}
