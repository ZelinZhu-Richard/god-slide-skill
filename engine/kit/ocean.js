// Gerstner-wave ocean that reflects the shared sky, glitters toward the sun and foams on
// the crests. heightAt() runs the same waves on the CPU so a boat (or anything) can float.
//
//   const sea = kit.ocean({ sky, size: 3000 });
//   scene.add(sea.mesh);
//   update(s){ sea.set({ amp: 0.6 + 1.6 * s.k(1) }); sea.update(s.t, camera); }
import * as THREE from 'three';
import { LIB } from '../core/glsl.js';
import { SKY_GLSL } from './sky.js';

const WAVES = [
  // dir.x, dir.y, steepness, wavelength (m)
  [1.0, 0.2, 0.16, 38], [0.7, 0.75, 0.13, 22], [-0.3, 1.0, 0.11, 14],
  [0.95, -0.4, 0.09, 9], [0.2, 0.9, 0.07, 5.5], [-0.8, 0.5, 0.05, 3.4],
];

export function ocean({ sky, size = 3000, segments = 384, amp = 1, deep = [0.002, 0.016, 0.03], shallow = [0.01, 0.11, 0.12], foam = 0.5, fogDensity = 0.0005 } = {}) {
  if (!sky) throw new Error('ocean needs { sky }');
  const waves = WAVES.map((w) => new THREE.Vector4(...w));
  const uniforms = {
    ...sky.uniforms,
    uW: { value: waves }, uAmp: { value: amp }, uT: { value: 0 },
    uDeep: { value: new THREE.Vector3(...deep) }, uShallow: { value: new THREE.Vector3(...shallow) },
    uFoam: { value: foam }, uFogD: { value: fogDensity }, uCamXZ: { value: new THREE.Vector2() },
  };
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: /* glsl */ `
      uniform vec4 uW[6]; uniform float uAmp, uT; uniform vec2 uCamXZ;
      out vec3 vW; out vec3 vN; out float vCrest;
      void main(){
        vec2 p=position.xz+uCamXZ;
        float fade=1.-smoothstep(300.,1400.,length(position.xz));
        vec3 o=vec3(p.x,0.,p.y); vec3 tx=vec3(1.,0.,0.), tz=vec3(0.,0.,1.);
        float crest=0.;
        for(int i=0;i<6;i++){
          vec2 d=normalize(uW[i].xy); float st=uW[i].z*uAmp*fade; float k=6.28318/uW[i].w;
          float c=sqrt(9.8/k); float f=k*(dot(d,p)-c*uT); float a=st/k;
          float sf=sin(f), cf=cos(f);
          o.x+=d.x*a*cf; o.z+=d.y*a*cf; o.y+=a*sf;
          tx+=vec3(-d.x*d.x*st*sf, d.x*st*cf, -d.x*d.y*st*sf);
          tz+=vec3(-d.x*d.y*st*sf, d.y*st*cf, -d.y*d.y*st*sf);
          crest+=max(sf,0.)*st;
        }
        vN=normalize(cross(tz,tx));
        vCrest=crest;
        vW=o;
        gl_Position=projectionMatrix*viewMatrix*vec4(o,1.);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; in vec3 vW; in vec3 vN; in float vCrest; out vec4 o;
      uniform vec3 uDeep, uShallow; uniform float uFoam, uFogD, uT, uAmp;
      ${LIB} ${SKY_GLSL}
      void main(){
        vec3 V=normalize(cameraPosition-vW);
        float dist=length(cameraPosition-vW);
        // small ripples, fading with distance
        float rf=exp(-dist*.004);
        vec2 q=vW.xz*.35+uT*.4;
        vec2 g=vec2(fbmLo(q)-fbmLo(q+vec2(.13,0.)), fbmLo(q)-fbmLo(q+vec2(0.,.13)))*2.2*rf;
        vec3 N=normalize(vN+vec3(g.x,0.,g.y));
        float fres=.02+.9*pow(1.-max(dot(N,V),0.),5.);
        vec3 R=reflect(-V,N); R.y=abs(R.y);
        vec3 refl=skyColor(R,false);
        float sss=pow(max(dot(V,-uSunDir)*.5+.5,0.),3.)*smoothstep(.0,1.6,vCrest);
        vec3 body=mix(uDeep,uShallow,clamp(vCrest*.5+sss*.6,0.,1.));
        body+=uShallow*uSunC*sss*.12;
        vec3 c=mix(body,refl,fres);
        // sun glitter: sharp highlight + sparkle
        vec3 H=normalize(uSunDir+V);
        float spec=pow(max(dot(N,H),0.),900.)*40.+pow(max(dot(N,H),0.),120.)*.6;
        float sparkle=step(.996,hash13(floor(vW*vec3(3.,1.,3.))+floor(uT*6.)))*pow(max(dot(N,H),0.),40.)*6.;
        c+=uSunC*(spec+sparkle*rf)*smoothstep(-.02,.05,uSunDir.y);
        // foam on steep crests
        float fm=smoothstep(.55,1.1,vCrest*(.7+.6*fbm(vW.xz*.25+uT*.2)))*uFoam*min(uAmp,1.5);
        c=mix(c,vec3(.85,.9,.92)*(.4+.6*max(uSunDir.y,.1))+uSunC*.05,fm*rf);
        // distance haze into the horizon
        float fog=1.-exp(-dist*uFogD);
        c=mix(c,skyColor(normalize(vec3(-V.x,.002,-V.z)),false),clamp(fog,0.,1.));
        o=vec4(c,1.);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const O = {
    mesh, uniforms, material: mat,
    set({ amp: a, foam: f, deep: d, shallow: s } = {}) {
      if (a != null) uniforms.uAmp.value = a;
      if (f != null) uniforms.uFoam.value = f;
      if (d) uniforms.uDeep.value.set(...d);
      if (s) uniforms.uShallow.value.set(...s);
      return O;
    },
    /** call every frame: time in seconds; camera keeps the grid centred under it */
    update(t, camera) {
      uniforms.uT.value = t;
      if (camera) { const g = size / segments; uniforms.uCamXZ.value.set(Math.round(camera.position.x / g) * g, Math.round(camera.position.z / g) * g); }
      return O;
    },
    /** Surface height and normal at world x,z (CPU, same waves). */
    sample(x, z, t = uniforms.uT.value) {
      let y = 0; const tx = [1, 0, 0], tz = [0, 0, 1];
      const A = uniforms.uAmp.value;
      for (const w of waves) {
        const len = Math.hypot(w.x, w.y), dx = w.x / len, dz = w.y / len;
        const st = w.z * A, k = (Math.PI * 2) / w.w, c = Math.sqrt(9.8 / k);
        const f = k * (dx * x + dz * z - c * t), a = st / k, sf = Math.sin(f), cf = Math.cos(f);
        y += a * sf;
        tx[0] -= dx * dx * st * sf; tx[1] += dx * st * cf; tx[2] -= dx * dz * st * sf;
        tz[0] -= dx * dz * st * sf; tz[1] += dz * st * cf; tz[2] -= dz * dz * st * sf;
      }
      const n = new THREE.Vector3(...tz).cross(new THREE.Vector3(...tx)).normalize();
      return { y, normal: n };
    },
    heightAt(x, z, t) { return O.sample(x, z, t).y; },
  };
  return O;
}
