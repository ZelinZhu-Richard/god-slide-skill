// A procedural planet: continents, ice caps, ocean glint, night-side city lights, a cloud
// shell and an atmosphere rim. Good for "everyone on Earth", "a country of them", scale.
//
//   const earth = kit.globe({ radius: 10, lights: 0 });
//   scene.add(earth.group);
//   update(s){ earth.set({ lights: s.k(1) }); earth.update(s.t); }
import * as THREE from 'three';
import { LIB } from '../core/glsl.js';

export function globe({
  radius = 10, seed = 2.3, land = 0.53, sun = [-0.55, 0.28, 0.78], lights = 0, clouds = 0.5,
  atmosphere = [0.3, 0.55, 1.0], spin = 0.02, detail = 128,
} = {}) {
  const U = {
    uSun: { value: new THREE.Vector3(...sun).normalize() }, uSeed: { value: seed }, uLand: { value: land },
    uLights: { value: lights }, uT: { value: 0 }, uCloud: { value: clouds }, uAtm: { value: new THREE.Vector3(...atmosphere) },
    uSunC: { value: new THREE.Vector3(2.2, 2.1, 1.95) },
  };
  const group = new THREE.Group();
  const surf = new THREE.Mesh(new THREE.SphereGeometry(radius, detail, detail / 2), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: U,
    vertexShader: `out vec3 vO; out vec3 vN; out vec3 vW; void main(){ vO=normalize(position); vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; in vec3 vO; in vec3 vN; in vec3 vW; out vec4 o;
      uniform vec3 uSun, uSunC; uniform float uSeed, uLand, uLights, uT; ${LIB}
      void main(){
        vec3 n=vO;
        float h=fbm3(n*1.9+uSeed)*.75+fbm3(n*5.3+uSeed*2.)*.25;
        float landM=smoothstep(uLand-.012,uLand+.012,h);
        float lat=abs(n.y);
        vec3 sea=mix(vec3(.004,.02,.06),vec3(.01,.06,.12),smoothstep(uLand-.25,uLand,h));
        vec3 lc=mix(vec3(.05,.09,.03),vec3(.18,.15,.09),smoothstep(uLand+.02,uLand+.2,h));
        lc=mix(lc,vec3(.32,.26,.16),smoothstep(.15,.0,lat)*.6*smoothstep(uLand+.05,uLand+.15,h));
        vec3 c=mix(sea,lc,landM);
        float ice=smoothstep(.8,.9,lat+fbm3(n*7.)*.1);
        c=mix(c,vec3(.75,.78,.82),ice);
        vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float ndl=dot(N,uSun);
        float day=smoothstep(-.12,.25,ndl);
        vec3 col=c*(max(ndl,0.)*uSunC+.012);
        vec3 H=normalize(uSun+V);
        col+=(1.-landM)*(1.-ice)*uSunC*pow(max(dot(N,H),0.),90.)*.6*day;
        // night lights: fine sparks clustered along coasts and in populated regions
        float coast=1.-smoothstep(0.,.06,h-uLand);
        float region=smoothstep(.55,.8,fbm3(n*7.+4.))*.8+coast*.5;
        region*=smoothstep(.35,.75,fbm3(n*16.+uSeed*5.));
        vec3 cell=floor(n*900.);
        float spark=step(.93-region*.12,hash13(cell))*landM*(1.-ice)*step(.05,region);
        float glowR=smoothstep(.6,.85,fbm3(n*34.+uSeed*3.))*landM*(1.-ice)*region;
        col+=vec3(1.,.62,.28)*(spark*1.1+glowR*.05)*(1.-day)*uLights*1.6;
        // thin warm band at the terminator
        col+=vec3(.6,.25,.08)*exp(-abs(ndl)*30.)*.025*day;
        o=vec4(col,1.);
      }`,
  }));
  group.add(surf);
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, detail, detail / 2), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `out vec3 vO; out vec3 vN; void main(){ vO=normalize(position); vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `precision highp float; in vec3 vO; in vec3 vN; out vec4 o; uniform vec3 uSun, uSunC; uniform float uCloud, uT, uSeed; ${LIB}
      void main(){ vec3 n=vO; float a=uT*.01; n.xz=mat2(cos(a),sin(a),-sin(a),cos(a))*n.xz;
        float d=fbm3(n*4.+uSeed+fbm3(n*9.)*.6); float cov=smoothstep(1.-uCloud,1.-uCloud+.3,d);
        float ndl=dot(normalize(vN),uSun);
        o=vec4(vec3(1.)*max(ndl,0.)*uSunC*.9+.004,cov*.85); }`,
  }));
  group.add(cloud);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.035, 96, 48), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: `out vec3 vN; out vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vW; out vec4 o; uniform vec3 uSun, uAtm;
      void main(){ vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vN);
        float f=1.-max(dot(N,V),0.);
        float rim=pow(f,4.)*1.6+pow(f,1.5)*.12;
        float lit=smoothstep(-.25,.55,dot(N,uSun));
        o=vec4(uAtm*rim*lit,1.); }`,
  }));
  group.add(atm);
  const G = {
    group, surface: surf, clouds: cloud, atmosphere: atm, uniforms: U, radius,
    set({ lights: l, clouds: c, sun: s, land: ld } = {}) {
      if (l != null) U.uLights.value = l;
      if (c != null) U.uCloud.value = c;
      if (s) U.uSun.value.set(...s).normalize();
      if (ld != null) U.uLand.value = ld;
      return G;
    },
    update(t) { U.uT.value = t; surf.rotation.y = t * spin; cloud.rotation.y = t * spin * 1.15; return G; },
  };
  return G;
}
