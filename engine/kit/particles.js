// GPU point clouds: swarms of agents, dust in light, embers, star fields, grids of lights.
// `on` reveals a fraction of the points (0..1), which is how "one, then thirty thousand,
// then a million" works: create the million once, animate `on`.
//
//   const swarm = kit.particles({ count: 200000, mode: 'swarm', radius: 300, color: '#ffcf8a' });
//   scene.add(swarm.points);
//   update(s){ swarm.set({ on: 1e-5 + s.k(1) * 0.03 + s.k(2) }); swarm.update(s.t); }
import * as THREE from 'three';
import { rng } from '../core/ease.js';
import { LIB } from '../core/glsl.js';

export function particles({
  count = 20000, mode = 'swarm', radius = 100, height = 20, size = 2.2, color = '#ffd9a0', color2 = null,
  seed = 1, speed = 1, alpha = 1, on = 1, additive = true, center = [0, 0, 0], box = null, sizeVar = 0.6,
  positions = null, // optional Float32Array (x,y,z,...) for your own layout; count follows it
} = {}) {
  if (positions) count = positions.length / 3;
  const R = rng(seed);
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  const [cx, cy, cz] = center;
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    if (mode === 'swarm' || mode === 'field') {
      const r = radius * Math.sqrt(R()) * (mode === 'field' ? 1 : 0.15 + 0.85 * R() ** 0.5), a = R() * Math.PI * 2;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = mode === 'field' ? 0 : (R() - 0.5) * height * (1 - r / radius * 0.6);
    } else if (mode === 'stars') {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      x = s * Math.cos(a) * radius; y = u * radius; z = s * Math.sin(a) * radius;
    } else { // dust, rise: box volume
      const b = box || [radius * 2, height, radius * 2];
      x = (R() - 0.5) * b[0]; y = R() * b[1]; z = (R() - 0.5) * b[2];
    }
    if (i === 0 && (mode === 'swarm' || mode === 'field')) { x = 0; y = 0; z = 0; } // the first one sits at the centre
    if (positions) { x = positions[i * 3]; y = positions[i * 3 + 1]; z = positions[i * 3 + 2]; }
    pos.set([x + cx, y + cy, z + cz], i * 3);
    // w = reveal order: on = k / count shows exactly k points
    rnd.set([R(), R(), R(), (i + 0.5) / count], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(rnd, 4));
  const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 || color);
  const MODES = { swarm: 0, dust: 1, rise: 2, stars: 3, field: 4 };
  const U = {
    uT: { value: 0 }, uSize: { value: size }, uPx: { value: 1 }, uAlpha: { value: alpha }, uOn: { value: on },
    uSpeed: { value: speed }, uSpread: { value: 1 }, uC1: { value: new THREE.Vector3(c1.r, c1.g, c1.b) },
    uC2: { value: new THREE.Vector3(c2.r, c2.g, c2.b) }, uMode: { value: MODES[mode] ?? 0 }, uH: { value: height },
    uCenter: { value: new THREE.Vector3(cx, cy, cz) }, uSizeVar: { value: sizeVar }, uBright: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      in vec4 aR; uniform float uT, uSize, uPx, uOn, uSpeed, uSpread, uMode, uH, uSizeVar;
      uniform vec3 uCenter; out vec4 vR; out float vFade;
      ${LIB}
      void main(){
        vR=aR;
        vec3 p=position-uCenter;
        float t=uT*uSpeed;
        if(uMode<.5){ // swarm: orbit + wander
          float r=length(p.xz); float a=atan(p.z,p.x)+t*(.02+.06*aR.x)*(1.+12./(r+12.));
          r*=uSpread;
          p=vec3(cos(a)*r, p.y*uSpread+sin(t*(.6+aR.y)+aR.z*6.28)*1.2, sin(a)*r);
          p+=vec3(sin(t*.7+aR.w*6.28),0.,cos(t*.6+aR.x*6.28))*.8;
        } else if(uMode<1.5){ // dust drifting
          p+=vec3(sin(t*.11+aR.x*6.28)*3.,sin(t*.07+aR.y*6.28)*2.,cos(t*.09+aR.z*6.28)*3.)*(.5+aR.w);
        } else if(uMode<2.5){ // rise and wrap
          p.y=mod(p.y+t*(2.+3.*aR.x),uH);
          p.x+=sin(t*.8+aR.y*6.28)*1.5;
        } else if(uMode<3.5){ // stars: static
        } else { // field: lights on a plane, gentle pulse
          p.y+=sin(t*1.5+aR.x*6.28)*.05;
        }
        p+=uCenter;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        float visible=step(aR.w,uOn);
        float sz=uSize*(1.+uSizeVar*(aR.y-.5)*2.);
        gl_PointSize=visible*sz*uPx*(300./max(-mv.z,1.));
        vFade=visible;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; in vec4 vR; in float vFade; out vec4 o;
      uniform vec3 uC1, uC2; uniform float uAlpha, uBright;
      void main(){
        float d=length(gl_PointCoord-.5)*2.;
        if(d>1.) discard;
        float core=exp(-d*d*9.); float halo=exp(-d*3.5)*.35;
        vec3 c=mix(uC1,uC2,vR.z);
        float a=(core+halo)*uAlpha*vFade;
        o=vec4(c*a*uBright,a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const P = {
    points, uniforms: U, material: mat, count,
    set({ on: o, size: s, alpha: a, spread: sp, speed: v, bright: b } = {}) {
      if (o != null) U.uOn.value = o;
      if (s != null) U.uSize.value = s;
      if (a != null) U.uAlpha.value = a;
      if (sp != null) U.uSpread.value = sp;
      if (v != null) U.uSpeed.value = v;
      if (b != null) U.uBright.value = b;
      return P;
    },
    update(t, gfx) { U.uT.value = t; if (gfx) U.uPx.value = gfx.h / 1080; return P; },
  };
  return P;
}
