// Sky dome with sun, haze and drifting clouds. Rendered at infinity (always behind
// everything, centred on the camera). Its uniforms are shared with the ocean so reflections
// match, and it can bake an environment map so PBR materials are lit by the same sky.
//
//   const sky = kit.sky({ preset: 'dusk', clouds: 0.45 });
//   scene.add(sky.mesh);
//   kit.env(ctx, scene, sky);         // optional: image-based lighting from this sky
//   sky.set({ sunElevation: 3 + 10 * s.k(1) })   // animate in update()
import * as THREE from 'three';
import { LIB } from '../core/glsl.js';

export const SKY_PRESETS = {
  // Azimuth 0 = straight ahead of a default camera (looking down -z), so low suns sit in frame.
  noon:     { zenith: [0.08, 0.22, 0.70], horizon: [0.62, 0.76, 0.95], ground: [0.30, 0.33, 0.36], sun: [1.9, 1.8, 1.6], sunElevation: 58, sunAzimuth: 160, haze: 0.45, clouds: 0.35, cloudLight: [1.15, 1.15, 1.2], cloudDark: [0.58, 0.64, 0.76] },
  morning:  { zenith: [0.14, 0.30, 0.70], horizon: [0.92, 0.84, 0.74], ground: [0.28, 0.28, 0.30], sun: [2.4, 1.9, 1.4], sunElevation: 16, sunAzimuth: 35, haze: 0.7, clouds: 0.4, cloudLight: [1.35, 1.15, 1.0], cloudDark: [0.52, 0.55, 0.66] },
  golden:   { zenith: [0.13, 0.21, 0.50], horizon: [1.20, 0.70, 0.36], ground: [0.24, 0.18, 0.13], sun: [3.4, 1.9, 0.8], sunElevation: 6, sunAzimuth: 12, haze: 1.0, clouds: 0.45, cloudLight: [1.8, 1.0, 0.55], cloudDark: [0.34, 0.29, 0.36] },
  dusk:     { zenith: [0.05, 0.07, 0.22], horizon: [1.05, 0.44, 0.24], ground: [0.10, 0.08, 0.08], sun: [3.6, 1.3, 0.45], sunElevation: 1.5, sunAzimuth: 8, haze: 1.25, clouds: 0.5, cloudLight: [1.5, 0.62, 0.36], cloudDark: [0.17, 0.13, 0.23] },
  dawn:     { zenith: [0.08, 0.12, 0.32], horizon: [0.98, 0.62, 0.58], ground: [0.14, 0.12, 0.14], sun: [2.6, 1.4, 1.0], sunElevation: 2.5, sunAzimuth: -15, haze: 1.2, clouds: 0.38, cloudLight: [1.5, 0.95, 0.85], cloudDark: [0.28, 0.26, 0.36] },
  overcast: { zenith: [0.50, 0.54, 0.60], horizon: [0.78, 0.80, 0.82], ground: [0.30, 0.31, 0.32], sun: [0.9, 0.9, 0.9], sunElevation: 40, sunAzimuth: 200, haze: 0.2, clouds: 0.92, cloudLight: [0.95, 0.96, 0.98], cloudDark: [0.52, 0.55, 0.6] },
  night:    { zenith: [0.004, 0.007, 0.02], horizon: [0.02, 0.03, 0.06], ground: [0.01, 0.01, 0.012], sun: [0.35, 0.4, 0.55], sunElevation: 30, sunAzimuth: 160, haze: 0.15, clouds: 0.15, cloudLight: [0.06, 0.07, 0.1], cloudDark: [0.01, 0.012, 0.02], stars: 1 },
  space:    { zenith: [0.0, 0.0, 0.0], horizon: [0.0, 0.0, 0.0], ground: [0.0, 0.0, 0.0], sun: [6, 5.6, 5.0], sunElevation: 10, sunAzimuth: 200, haze: 0.0, clouds: 0.0, cloudLight: [0, 0, 0], cloudDark: [0, 0, 0], stars: 1.4 },
};

/** GLSL: vec3 skyColor(vec3 dir) using the shared sky uniforms. */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith, uHorizon, uGround, uSunC, uSunDir, uCloudL, uCloudD;
uniform float uHaze, uCloud, uCloudScale, uCloudSpeed, uSunSize, uStars, uSkyTime, uSkyExp;
vec3 skyColor(vec3 d, bool withSun){
  float h=d.y;
  vec3 c=mix(uHorizon,uZenith,pow(clamp(h,0.,1.),.42));
  float sd=max(dot(d,uSunDir),0.);
  c+=uSunC*(pow(sd,6.)*.16+pow(sd,40.)*.28)*uHaze;
  c+=uHorizon*exp(-max(h,0.)*14.)*.35*uHaze;
  if(uStars>0.&&h>0.){
    vec3 g=d*320.; vec3 id=floor(g); vec3 f=fract(g)-.5;
    float st=smoothstep(.16,0.,length(f-(hash33(id)-.5)*.6))*step(.985,hash13(id*1.7));
    c+=vec3(1.,.96,.9)*st*uStars*smoothstep(0.,.25,h)*(.6+.4*sin(uSkyTime*2.+hash13(id)*40.));
  }
  if(withSun) c+=uSunC*smoothstep(1.-uSunSize,1.-uSunSize*.55,sd)*24.;
  if(h>0.&&uCloud>0.){
    vec2 p=d.xz/(h+.1)*uCloudScale+vec2(uSkyTime*uCloudSpeed,0.);
    float n=fbm(p+.6*fbmLo(p*1.9+uSkyTime*uCloudSpeed*.5));
    float cov=smoothstep(1.-uCloud,1.-uCloud+.32,n)*smoothstep(0.,.2,h);
    float thick=smoothstep(1.-uCloud,1.,n);
    vec3 cc=mix(uCloudL,uCloudD,thick*.8)*(1.+pow(sd,4.)*.9*(1.-thick));
    cc+=uSunC*pow(sd,12.)*.25*(1.-thick);
    c=mix(c,cc,cov*.94);
  }
  c=mix(c,uGround,smoothstep(.0,-.06,h));
  return c*uSkyExp;
}
`;

export function sky(opts = {}) {
  const P = { ...SKY_PRESETS[opts.preset || 'noon'], ...opts };
  const v3 = (a) => new THREE.Vector3(...a);
  const uniforms = {
    uZenith: { value: v3(P.zenith) }, uHorizon: { value: v3(P.horizon) }, uGround: { value: v3(P.ground) },
    uSunC: { value: v3(P.sun) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uCloudL: { value: v3(P.cloudLight) }, uCloudD: { value: v3(P.cloudDark) },
    uHaze: { value: P.haze }, uCloud: { value: P.clouds }, uCloudScale: { value: P.cloudScale ?? 0.55 },
    uCloudSpeed: { value: P.cloudSpeed ?? 0.006 }, uSunSize: { value: P.sunSize ?? 0.00045 },
    uStars: { value: P.stars ?? 0 }, uSkyTime: { value: 0 }, uSkyExp: { value: P.exposure ?? 1 },
  };
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `out vec3 vDir; void main(){ vDir=normalize((modelMatrix*vec4(position,0.)).xyz);
      vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*mat3(modelMatrix)*position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `precision highp float; in vec3 vDir; out vec4 o; ${LIB} ${SKY_GLSL}
      void main(){ o=vec4(skyColor(normalize(vDir),true),1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  const S = {
    mesh, uniforms, material: mat,
    sunDir: uniforms.uSunDir.value,
    /** Move the sun: elevation/azimuth in degrees. */
    setSun(elev = P.sunElevation, azim = P.sunAzimuth) {
      const e = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(azim);
      uniforms.uSunDir.value.set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)).normalize();
      P.sunElevation = elev; P.sunAzimuth = azim;
      return S;
    },
    set(o = {}) {
      if (o.preset) Object.assign(o, { ...SKY_PRESETS[o.preset], ...o, preset: undefined });
      const map = { zenith: 'uZenith', horizon: 'uHorizon', ground: 'uGround', sun: 'uSunC', cloudLight: 'uCloudL', cloudDark: 'uCloudD' };
      for (const k in map) if (o[k]) uniforms[map[k]].value.set(...o[k]);
      if (o.haze != null) uniforms.uHaze.value = o.haze;
      if (o.clouds != null) uniforms.uCloud.value = o.clouds;
      if (o.cloudScale != null) uniforms.uCloudScale.value = o.cloudScale;
      if (o.cloudSpeed != null) uniforms.uCloudSpeed.value = o.cloudSpeed;
      if (o.stars != null) uniforms.uStars.value = o.stars;
      if (o.exposure != null) uniforms.uSkyExp.value = o.exposure;
      if (o.sunElevation != null || o.sunAzimuth != null) S.setSun(o.sunElevation ?? P.sunElevation, o.sunAzimuth ?? P.sunAzimuth);
      return S;
    },
    /** Blend two presets (t in 0..1) — e.g. day to dusk across a beat. */
    blend(a, b, t) {
      const A = SKY_PRESETS[a], B = SKY_PRESETS[b];
      const L = (x, y) => x.map((v, i) => v + (y[i] - v) * t);
      const l = (x, y) => (x ?? 0) + ((y ?? 0) - (x ?? 0)) * t;
      return S.set({ zenith: L(A.zenith, B.zenith), horizon: L(A.horizon, B.horizon), ground: L(A.ground, B.ground), sun: L(A.sun, B.sun),
        cloudLight: L(A.cloudLight, B.cloudLight), cloudDark: L(A.cloudDark, B.cloudDark), haze: l(A.haze, B.haze), clouds: l(A.clouds, B.clouds),
        stars: l(A.stars, B.stars), sunElevation: l(A.sunElevation, B.sunElevation), sunAzimuth: l(A.sunAzimuth, B.sunAzimuth) });
    },
    update(t) { uniforms.uSkyTime.value = t; S.syncFog(); return S; },
    /** Attach exponential fog that always matches the horizon (call once). */
    fog(scene, density = 0.0006, tint = 0.85) {
      scene.fog = new THREE.FogExp2(0x000000, density);
      S._fog = scene.fog; S._fogTint = tint; S.syncFog();
      return scene.fog;
    },
    syncFog() {
      if (!S._fog) return;
      const h = uniforms.uHorizon.value, k = S._fogTint;
      S._fog.color.setRGB(h.x * k, h.y * k, h.z * k);
    },
    /** Horizon colour as THREE.Color (for scene.fog). */
    fogColor() { const h = uniforms.uHorizon.value; return new THREE.Color(h.x, h.y, h.z); },
    /** Sun light colour/intensity for a DirectionalLight. */
    sunColor() { const c = uniforms.uSunC.value; const m = Math.max(c.x, c.y, c.z) || 1; return { color: new THREE.Color(c.x / m, c.y / m, c.z / m), intensity: m }; },
  };
  S.setSun(P.sunElevation, P.sunAzimuth);
  return S;
}

/** Bake the sky into scene.environment (PBR lighting) and optionally scene.background. */
export function env(ctx, scene, skyObj, { background = false } = {}) {
  const pm = new THREE.PMREMGenerator(ctx.renderer);
  const s = new THREE.Scene();
  const m = skyObj.mesh.clone();
  m.material = skyObj.material.clone();
  m.material.uniforms = skyObj.uniforms; // share
  m.scale.setScalar(100);
  s.add(m);
  const rt = pm.fromScene(s, 0.02, 0.1, 1000);
  scene.environment = rt.texture;
  if (background) scene.background = rt.texture;
  pm.dispose();
  return rt;
}
