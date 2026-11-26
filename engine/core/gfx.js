// Renderer wrapper: one WebGL2 context for the whole deck, render targets that follow
// the window size, and fullscreen shader passes.
import * as THREE from 'three';
import { LIB, PASS_HEAD, PASS_VERT } from './glsl.js';

const TYPES = {
  half: THREE.HalfFloatType,
  float: THREE.FloatType,
  byte: THREE.UnsignedByteType,
};

export function createGfx(canvas, { headless = false, maxDpr = 1.5, quality = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: headless,
  });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 is required');
  renderer.setClearColor(0x000000, 1);
  // Scene renders go to linear HDR targets; our own passes do tone mapping + encoding.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const tracked = new Set();
  const gfx = {
    THREE,
    renderer,
    w: 1, h: 1, // drawing-buffer pixels
    cssW: 1, cssH: 1,
    dpr: 1,
    aspect: 16 / 9,
    quality,
    time: 0,
    owner: null,

    /** Size from the window (or a fixed size in headless mode). */
    resize(cssW = window.innerWidth, cssH = window.innerHeight) {
      const dpr = headless ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr);
      gfx.cssW = cssW; gfx.cssH = cssH; gfx.dpr = dpr;
      const s = dpr * gfx.quality;
      gfx.w = Math.max(2, Math.round(cssW * s));
      gfx.h = Math.max(2, Math.round(cssH * s));
      gfx.aspect = cssW / cssH;
      renderer.setPixelRatio(1);
      renderer.setSize(gfx.w, gfx.h, false);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      for (const t of tracked) gfx._size(t);
    },

    /**
     * A render target. Sized relative to the screen unless w/h are given.
     * opts: { scale=1, w, h, type:'half'|'byte'|'float', samples=0, depth=false,
     *         depthTexture=false, filter:'linear'|'nearest', wrap:'clamp'|'repeat'|'mirror',
     *         mips=false, count=1 }
     */
    target(opts = {}) {
      const o = { scale: 1, type: 'half', samples: 0, depth: false, filter: 'linear', wrap: 'clamp', ...opts };
      const filter = o.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
      const wrap = o.wrap === 'repeat' ? THREE.RepeatWrapping : o.wrap === 'mirror' ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping;
      const rt = new THREE.WebGLRenderTarget(o.w || 2, o.h || 2, {
        type: TYPES[o.type] || o.type,
        format: THREE.RGBAFormat,
        samples: o.samples,
        depthBuffer: o.depth || o.depthTexture,
        stencilBuffer: false,
        minFilter: o.mips ? THREE.LinearMipmapLinearFilter : filter,
        magFilter: filter,
        wrapS: wrap,
        wrapT: wrap,
        generateMipmaps: !!o.mips,
        count: o.count || 1,
      });
      if (o.depthTexture) {
        rt.depthTexture = new THREE.DepthTexture(2, 2);
        rt.depthTexture.type = THREE.FloatType;
      }
      rt._gs = o;
      if (!o.w) { tracked.add(rt); gfx._size(rt); }
      return rt;
    },
    _size(rt) {
      const s = rt._gs.scale;
      rt.setSize(Math.max(2, Math.round(gfx.w * s)), Math.max(2, Math.round(gfx.h * s)));
    },
    release(rt) { tracked.delete(rt); rt.dispose(); },

    /**
     * Fullscreen pass. `frag` is a GLSL body with access to vUv, o (out), uRes, uTime, uAsp
     * and the LIB functions (hash/noise/fbm/toLin/toSRGB/agxTone...).
     * uniforms: plain values ({tA:null, p:0, uC:new THREE.Vector3()}).
     */
    pass(frag, uniforms = {}, opts = {}) {
      const u = { uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uAsp: { value: 1 } };
      for (const k in uniforms) u[k] = { value: uniforms[k] };
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: PASS_VERT,
        fragmentShader: PASS_HEAD + LIB + frag,
        uniforms: u,
        depthTest: false,
        depthWrite: false,
        transparent: !!opts.blend,
        blending: opts.blend === 'add' ? THREE.AdditiveBlending : opts.blend ? THREE.NormalBlending : THREE.NoBlending,
      });
      const vals = new Proxy({}, {
        get: (_, k) => u[k] && u[k].value,
        set: (_, k, v) => { if (!u[k]) u[k] = { value: v }; else u[k].value = v; return true; },
      });
      return {
        material: mat,
        uniforms: u,
        u: vals,
        render(target = null) {
          const tw = target ? target.width : gfx.w;
          const th = target ? target.height : gfx.h;
          u.uRes.value.set(tw, th);
          u.uTime.value = gfx.time;
          u.uAsp.value = tw / th;
          quad.material = mat;
          renderer.setRenderTarget(target);
          renderer.render(quadScene, quadCam);
        },
        dispose() { mat.dispose(); },
      };
    },

    /** Render a three.js scene into a target (linear). */
    draw(scene, camera, target, clear = true) {
      renderer.setRenderTarget(target);
      if (clear) renderer.clear(true, true, false);
      renderer.render(scene, camera);
    },

    clear(target, color = 0x000000, alpha = 1) {
      renderer.setRenderTarget(target);
      renderer.setClearColor(color, alpha);
      renderer.clear(true, true, false);
      renderer.setClearColor(0x000000, 1);
    },
  };

  const copyPass = gfx.pass('uniform sampler2D tA; void main(){ o=texture(tA,vUv); }', { tA: null });
  gfx.copy = (src, dst) => { copyPass.u.tA = src.texture || src; copyPass.render(dst); };

  // Final present: dither to 8 bits (kills banding in skies and gradients) + black-out.
  const present = gfx.pass(`
    uniform sampler2D tA; uniform float uBlack;
    void main(){
      vec3 c=texture(tA,vUv).rgb*(1.-uBlack);
      float n=hash13(vec3(gl_FragCoord.xy,fract(uTime)*61.))+hash13(vec3(gl_FragCoord.xy,fract(uTime)*61.+7.))-1.;
      o=vec4(c+n/255.,1.);
    }`, { tA: null, uBlack: 0 });
  gfx.present = (src, black = 0) => {
    present.u.tA = src.texture;
    present.u.uBlack = black;
    present.render(null);
  };

  gfx.resize();
  return gfx;
}
