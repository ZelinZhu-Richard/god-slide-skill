// Film pipeline: HDR scene render -> bloom -> halation -> tone map (AgX/ACES) -> grade ->
// vignette -> chromatic aberration -> grain -> display-encoded output.
// One instance is shared by the whole deck (scenes render one after another).
import * as THREE from 'three';

export const POST_PRESETS = {
  film:  { exposure: 1, bloom: 0.3, threshold: 1.0, knee: 0.6, tone: 'agx', contrast: 1.12, saturation: 1.14, vignette: 0.18, grain: 0.035, halation: 0.25, ca: 0.0012 },
  soft:  { exposure: 1, bloom: 0.42, threshold: 1.0, knee: 0.7, tone: 'agx', contrast: 0.96, saturation: 1.0, vignette: 0.2, grain: 0.03, halation: 0.5, ca: 0.001 },
  crisp: { exposure: 1, bloom: 0.15, threshold: 1.2, knee: 0.5, tone: 'agx', contrast: 1.08, saturation: 1.08, vignette: 0.1, grain: 0.015, halation: 0.05, ca: 0 },
  dream: { exposure: 1.05, bloom: 0.8, threshold: 0.7, knee: 0.8, tone: 'agx', contrast: 0.92, saturation: 0.95, vignette: 0.25, grain: 0.03, halation: 0.7, ca: 0.002 },
  noir:  { exposure: 1, bloom: 0.25, threshold: 1.0, knee: 0.5, tone: 'agx', contrast: 1.25, saturation: 0, vignette: 0.35, grain: 0.06, halation: 0, ca: 0 },
  // Exact colors (brand palettes, parody templates): no filmic curve, no grain.
  flat:  { exposure: 1, bloom: 0, threshold: 1, knee: 0.5, tone: 'none', contrast: 1, saturation: 1, vignette: 0, grain: 0, halation: 0, ca: 0 },
};

// grad: graduated ND filter, darkens the top of frame so headlines read over bright skies (0..1)
const BASE = { lift: [0, 0, 0], gain: [1, 1, 1], tint: [1, 1, 1], fade: 0, fadeColor: [0, 0, 0], grainSize: 1.4, grad: 0, gradStart: 0.45 };

export function createPost(gfx) {
  const hdr = gfx.target({ type: 'half', samples: 4, depth: true });
  const LEVELS = 6;
  const down = [], up = [];
  for (let i = 0; i < LEVELS; i++) {
    down.push(gfx.target({ type: 'half', scale: 1 / 2 ** (i + 1) }));
    up.push(gfx.target({ type: 'half', scale: 1 / 2 ** (i + 1) }));
  }

  const prefilter = gfx.pass(`
    uniform sampler2D tA; uniform vec2 uPx; uniform float uThr, uKnee;
    vec3 thr(vec3 c){ float b=max(c.r,max(c.g,c.b)); float s=clamp(b-uThr+uKnee,0.,2.*uKnee); s=s*s/(4.*uKnee+1e-5);
      return c*max(s,b-uThr)/max(b,1e-5); }
    void main(){
      vec3 c=thr(min(texture(tA,vUv+uPx*vec2(-1,-1)).rgb,vec3(64.)))+thr(min(texture(tA,vUv+uPx*vec2(1,-1)).rgb,vec3(64.)))
            +thr(min(texture(tA,vUv+uPx*vec2(-1,1)).rgb,vec3(64.)))+thr(min(texture(tA,vUv+uPx*vec2(1,1)).rgb,vec3(64.)));
      o=vec4(c*.25,1.);
    }`, { tA: null, uPx: new THREE.Vector2(), uThr: 1, uKnee: 0.5 });

  const downPass = gfx.pass(`
    uniform sampler2D tA; uniform vec2 uPx;
    void main(){
      vec3 c=texture(tA,vUv).rgb*4.;
      c+=texture(tA,vUv+uPx*vec2(-1,-1)).rgb+texture(tA,vUv+uPx*vec2(1,-1)).rgb
        +texture(tA,vUv+uPx*vec2(-1,1)).rgb+texture(tA,vUv+uPx*vec2(1,1)).rgb;
      o=vec4(c/8.,1.);
    }`, { tA: null, uPx: new THREE.Vector2() });

  const upPass = gfx.pass(`
    uniform sampler2D tA, tB; uniform vec2 uPx; uniform float uR;
    void main(){
      vec3 s=texture(tA,vUv+uPx*vec2(-2,0)).rgb+texture(tA,vUv+uPx*vec2(2,0)).rgb
            +texture(tA,vUv+uPx*vec2(0,-2)).rgb+texture(tA,vUv+uPx*vec2(0,2)).rgb
            +2.*(texture(tA,vUv+uPx*vec2(-1,-1)).rgb+texture(tA,vUv+uPx*vec2(1,-1)).rgb
            +texture(tA,vUv+uPx*vec2(-1,1)).rgb+texture(tA,vUv+uPx*vec2(1,1)).rgb);
      o=vec4(texture(tB,vUv).rgb+s/12.*uR,1.);
    }`, { tA: null, tB: null, uPx: new THREE.Vector2(), uR: 1 });

  const comp = gfx.pass(`
    uniform sampler2D tA, tBloom, tWide;
    uniform float uExp, uBloom, uHal, uTone, uCon, uSat, uVig, uGrain, uGrainSize, uCA, uFade, uGrad, uGradY;
    uniform vec3 uLift, uGain, uTint, uFadeC;
    void main(){
      vec2 d=(vUv-.5);
      vec3 c;
      if(uCA>0.){
        vec2 off=d*uCA*length(d)*4.;
        c=vec3(texture(tA,vUv+off).r,texture(tA,vUv).g,texture(tA,vUv-off).b);
      } else c=texture(tA,vUv).rgb;
      c*=uTint*uExp;
      vec3 b=texture(tBloom,vUv).rgb, w=texture(tWide,vUv).rgb;
      c+=b*uBloom;
      c+=w*vec3(1.,.32,.12)*uHal*.6+b*vec3(1.,.45,.25)*uHal*.25;
      c*=1.-uGrad*smoothstep(uGradY,1.,vUv.y)*(.75+.25*smoothstep(.9,0.,vUv.x));
      if(uTone>1.5) c=acesFilm(c*.8);
      else if(uTone>.5) c=agxTone(c);
      else c=clamp(c,0.,1.);
      // grade in a perceptual-ish space
      vec3 g=pow(max(c,0.),vec3(1./2.2));
      g=(g-.5)*uCon+.5;
      float l=luma(g);
      g=mix(vec3(l),g,uSat);
      g=g*uGain+uLift*(1.-g);
      g=clamp(g,0.,1.);
      c=pow(g,vec3(2.2));
      // vignette (in linear, multiplicative, aspect-aware)
      float v=smoothstep(1.25,.25,length(d*vec2(uAsp,1.)*1.15));
      c*=mix(1.,v,uVig);
      c=mix(c,uFadeC,uFade);
      vec3 s=toSRGB(c);
      // grain: luminance-weighted, animated, slightly larger than a pixel
      vec2 gp=floor(gl_FragCoord.xy/uGrainSize);
      float n=hash13(vec3(gp,fract(uTime*7.31)*97.))+hash13(vec3(gp+17.,fract(uTime*3.7)*53.))-1.;
      float ls=luma(s);
      s+=n*uGrain*(.35+.65*(1.-abs(ls*2.-1.)));
      o=vec4(s,1.);
    }`, {
    tA: null, tBloom: null, tWide: null, uExp: 1, uBloom: 0, uHal: 0, uTone: 1, uCon: 1, uSat: 1, uVig: 0,
    uGrain: 0, uGrainSize: 1.4, uCA: 0, uFade: 0, uGrad: 0, uGradY: 0.45,
    uLift: new THREE.Vector3(), uGain: new THREE.Vector3(1, 1, 1), uTint: new THREE.Vector3(1, 1, 1), uFadeC: new THREE.Vector3(),
  });

  const zero = gfx.target({ type: 'byte', w: 4, h: 4 });
  gfx.clear(zero, 0x000000, 1);

  function bloom(src, cfg) {
    prefilter.u.tA = src.texture;
    prefilter.u.uPx.set(0.5 / src.width, 0.5 / src.height);
    prefilter.u.uThr = cfg.threshold;
    prefilter.u.uKnee = cfg.knee;
    prefilter.render(down[0]);
    for (let i = 1; i < LEVELS; i++) {
      downPass.u.tA = down[i - 1].texture;
      downPass.u.uPx.set(0.5 / down[i - 1].width, 0.5 / down[i - 1].height);
      downPass.render(down[i]);
    }
    // up[i] = down[i] + blur(up[i+1])
    gfx.copy(down[LEVELS - 1], up[LEVELS - 1]);
    for (let i = LEVELS - 2; i >= 0; i--) {
      upPass.u.tA = up[i + 1].texture;
      upPass.u.tB = down[i].texture;
      upPass.u.uPx.set(0.5 / up[i + 1].width, 0.5 / up[i + 1].height);
      upPass.u.uR = 1;
      upPass.render(up[i]);
    }
  }

  const post = {
    hdr,
    presets: POST_PRESETS,
    /** Resolve settings: preset name or object, plus overrides. */
    settings(cfg) {
      if (typeof cfg === 'string') cfg = { preset: cfg };
      cfg = cfg || {};
      return { ...BASE, ...POST_PRESETS[cfg.preset || 'film'], ...cfg };
    },
    /** Render scene+camera through the film pipeline into `out` (display-encoded). */
    render(scene, camera, out, cfg) {
      gfx.draw(scene, camera, hdr, true);
      post.finish(hdr, out, cfg);
    },
    /** Run bloom/tone/grade on an HDR target you filled yourself. */
    finish(src, out, cfg) {
      const c = post.settings(cfg);
      const needBloom = c.bloom > 0 || c.halation > 0;
      if (needBloom) bloom(src, c);
      const u = comp.u;
      u.tA = src.texture;
      u.tBloom = needBloom ? up[0].texture : zero.texture;
      u.tWide = needBloom ? up[2].texture : zero.texture;
      u.uExp = c.exposure; u.uBloom = c.bloom; u.uHal = c.halation;
      u.uTone = c.tone === 'aces' ? 2 : c.tone === 'none' ? 0 : 1;
      u.uCon = c.contrast; u.uSat = c.saturation; u.uVig = c.vignette;
      u.uGrain = c.grain; u.uGrainSize = c.grainSize * gfx.dpr; u.uCA = c.ca; u.uFade = c.fade;
      u.uGrad = c.grad; u.uGradY = c.gradStart;
      u.uLift.set(...c.lift); u.uGain.set(...c.gain); u.uTint.set(...c.tint);
      const fc = Array.isArray(c.fadeColor) ? c.fadeColor : new THREE.Color(c.fadeColor).toArray();
      u.uFadeC.set(...fc);
      comp.render(out);
    },
  };
  return post;
}
