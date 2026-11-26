// Scene transitions. Each one is a fullscreen shader that mixes the outgoing frame (tA)
// into the incoming frame (tB) as p goes 0 -> 1, plus a `dom` function that moves the two
// HTML type layers in step with the picture. Going back plays the same transition in reverse.
//
// Use them by name on a scene: { enter: 'portal' }.

const EASE = /* glsl */ `
float io3(float t){ t=clamp(t,0.,1.); return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)*.5; }
float io4(float t){ t=clamp(t,0.,1.); return t<.5?8.*t*t*t*t:1.-pow(-2.*t+2.,4.)*.5; }
float io5(float t){ t=clamp(t,0.,1.); return t<.5?16.*t*t*t*t*t:1.-pow(-2.*t+2.,5.)*.5; }
float smoother(float t){ t=clamp(t,0.,1.); return t*t*t*(t*(t*6.-15.)+10.); }
uniform sampler2D tA, tB; uniform float p;
`;

const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const io3 = (t) => (t = c01(t), t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const io4 = (t) => (t = c01(t), t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
const io5 = (t) => (t = c01(t), t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const smoother = (t) => (t = c01(t), t * t * t * (t * (t * 6 - 15) + 10));
const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Helpers for the type layers. `v` is the view: window rect in stage units.
const center = (v) => `${v.x0 + v.w / 2}px ${v.y0 + v.h / 2}px`;
// Keep only what is left of stage-x `x` (polygon, so the other sides never clip).
const leftOf = (x) => `polygon(-4000px -4000px, ${x}px -4000px, ${x}px 5000px, -4000px 5000px)`;
function set(el, { t = '', o = 1, clip = '', origin = '', filter = '' } = {}) {
  if (!el) return;
  el.style.transform = t;
  el.style.opacity = o;
  el.style.clipPath = clip;
  el.style.transformOrigin = origin;
  el.style.filter = filter;
}

export const TRANSITIONS = {
  cut: {
    dur: 0.001,
    frag: EASE + 'void main(){ o=texture(tB,vUv); }',
    dom: (p, a, b) => { set(a, { o: 0 }); set(b, {}); },
  },

  fade: {
    dur: 0.9,
    frag: EASE + 'void main(){ o=mix(texture(tA,vUv),texture(tB,vUv),smoothstep(0.,1.,p)); }',
    dom: (p, a, b) => { set(a, { o: 1 - ss(0, 0.55, p) }); set(b, { o: ss(0.45, 1, p) }); },
  },

  // Dip through black: the polite cut.
  dip: {
    dur: 1.2,
    frag: EASE + `void main(){ float a=1.-smoothstep(0.,.5,p), b=smoothstep(.5,1.,p);
      o=vec4(texture(tA,vUv).rgb*a+texture(tB,vUv).rgb*b,1.); }`,
    dom: (p, a, b) => { set(a, { o: 1 - ss(0, 0.45, p) }); set(b, { o: ss(0.55, 1, p) }); },
  },

  // Horizontal push with motion blur.
  push: {
    dur: 1.1,
    frag: EASE + `
      vec3 at(float x,float y){ return x<1. ? texture(tA,vec2(x,y)).rgb : texture(tB,vec2(x-1.,y)).rgb; }
      void main(){
        float e=io4(p); float v=abs(io4(p+.01)-io4(p-.01))/.02;
        vec3 c=vec3(0.);
        for(int i=0;i<14;i++){ float f=(float(i)/13.-.5)*v*.05; c+=at(clamp(vUv.x+e+f,0.,1.999),vUv.y); }
        o=vec4(c/14.,1.);
      }`,
    dom: (p, a, b, v) => {
      const e = io4(p);
      set(a, { t: `translateX(${-e * v.w}px)` });
      set(b, { t: `translateX(${(1 - e) * v.w}px)` });
    },
  },

  // The next scene arrives as a picture that grows until we are inside it.
  portal: {
    dur: 2.0,
    frag: EASE + `
      void main(){
        float e=smoother(p);
        vec2 full=vec2(uAsp*.5,.5);
        vec2 q=(vUv-.5)*vec2(uAsp,1.);
        vec2 hs=full*mix(.0,1.004,e);
        float r=mix(.035,0.,e);
        float d=sdRoundBox(q,hs,r);
        vec2 buv=q/(max(hs,vec2(1e-4))*2.)+.5;
        vec3 b=texture(tB,clamp(buv,0.,1.)).rgb;
        vec2 auv=.5+(vUv-.5)/(1.+e*1.4);
        vec3 a=texture(tA,auv).rgb*(1.-e*.55);
        float sh=exp(-max(d,0.)*14.)*.55*(1.-e);
        a*=1.-sh;
        float px=1.5/uRes.y;
        float inside=1.-smoothstep(-px,px,d);
        vec3 c=mix(a,b,inside);
        c+=smoothstep(px*2.5,0.,abs(d))*.35*(1.-e)*step(.001,e);
        o=vec4(c,1.);
      }`,
    dom: (p, a, b, v) => {
      const e = smoother(p);
      set(a, { t: `scale(${1 + e * 1.4})`, origin: center(v), o: 1 - ss(0.0, 0.5, p) });
      set(b, { t: `scale(${Math.max(1e-3, e)})`, origin: center(v), o: ss(0.25, 0.8, p) });
    },
  },

  // The current scene shrinks into a picture floating over the next one.
  'portal-out': {
    dur: 1.9,
    frag: EASE + `
      void main(){
        float e=smoother(p);
        vec2 full=vec2(uAsp*.5,.5);
        vec2 q=(vUv-.5)*vec2(uAsp,1.);
        vec2 hs=full*mix(1.004,.0,e);
        float r=mix(0.,.035,e);
        float d=sdRoundBox(q,hs,r);
        vec2 auv=q/(max(hs,vec2(1e-4))*2.)+.5;
        vec3 a=texture(tA,clamp(auv,0.,1.)).rgb;
        vec2 buv=.5+(vUv-.5)/(1.+(1.-e)*1.4);
        vec3 b=texture(tB,buv).rgb*(1.-(1.-e)*.55);
        float sh=exp(-max(d,0.)*14.)*.55*e;
        b*=1.-sh;
        float px=1.5/uRes.y;
        float inside=1.-smoothstep(-px,px,d);
        vec3 c=mix(b,a,inside);
        c+=smoothstep(px*2.5,0.,abs(d))*.35*e*step(.001,1.-e);
        o=vec4(c,1.);
      }`,
    dom: (p, a, b, v) => {
      const e = smoother(p);
      set(a, { t: `scale(${Math.max(1e-3, 1 - e)})`, origin: center(v), o: 1 - ss(0.3, 0.75, p) });
      set(b, { t: `scale(${1 + (1 - e) * 1.4})`, origin: center(v), o: ss(0.5, 1, p) });
    },
  },

  // A sheet of water washes over the glass, then drains away.
  wash: {
    dur: 2.4,
    frag: EASE + `
      void main(){
        vec2 q=(vUv-.5)*vec2(uAsp,1.);
        vec2 dir=normalize(vec2(.34,1.));
        float s=dot(q,dir);
        float k=clamp(p/.5,0.,1.); k=k*k*(3.-2.*k);
        float F=mix(-.95,1.05+.3*(uAsp-1.78),k);
        float n=fbm(q*2.3+vec2(p*2.,0.))-.5;
        float lip=F-s+n*.2+.03*sin(q.x*9.+p*20.);
        float wet=smoothstep(-.003,.003,lip);
        float kd=clamp((p-.42)/.52,0.,1.); kd=kd*kd*(3.-2.*kd);
        float L=mix(.72,-.85,kd)+.14*(fbm(vec2(q.x*2.1,3.))-.5)+.05*(vnoise(vec2(q.x*12.,9.))-.5);
        float water=wet*smoothstep(-.03,.05,L-q.y);
        vec2 g=vec2(fbm(q*3.1+p*1.5),fbm(q*3.1+vec2(5.2,1.3)-p*1.2))-.5;
        vec2 buv=vUv+g*.045*water;
        vec3 b=texture(tB,buv).rgb;
        float ca=pow(fbm(q*6.+g*3.+p*.7),3.)*water;
        b=b*mix(1.,.92,water)+vec3(.05,.08,.1)*water+ca*.45;
        // a few rivulets left on drained glass
        float riv=smoothstep(.97,1.,vnoise(vec2(q.x*60.,q.y*2.+kd*3.)))*wet*(1.-water)*(1.-smoothstep(.85,1.,p));
        b+=riv*.12;
        vec3 a=texture(tA,vUv).rgb;
        a*=1.-.38*exp(-max(-lip,0.)*22.);
        vec3 c=mix(a,b,wet);
        float foam=exp(-abs(lip)*80.)*(.55+.45*fbm(q*22.+p*6.))*(1.-kd);
        c+=foam*.7;
        o=vec4(c,1.);
      }`,
    dom: (p, a, b) => { set(a, { o: 1 - ss(0.05, 0.4, p), filter: `blur(${ss(0.05, 0.4, p) * 6}px)` }); set(b, { o: ss(0.65, 1, p) }); },
  },

  // Split-flap board: tiles flip from the old picture to the new one in a wave.
  flaps: {
    dur: 2.2,
    frag: EASE + `
      vec3 A(vec2 u){ return texture(tA,u).rgb; } vec3 B(vec2 u){ return texture(tB,u).rgb; }
      void main(){
        float rows=10.; vec2 grid=vec2(floor(rows*uAsp+.5),rows);
        vec2 g=vUv*grid, id=floor(g), f=fract(g);
        float delay=(id.x/grid.x)*.55+(1.-id.y/grid.y)*.25+hash12(id)*.12;
        float ph=clamp((p*1.35-delay)/.42,0.,1.);
        float th=ph*3.14159; float cs=cos(th);
        vec3 c;
        if(f.y>=.5){
          float top=.5*max(cs,0.);
          if(f.y-.5<top && ph<.5){ float fy=.5+(f.y-.5)/max(cs,1e-3); c=A((id+vec2(f.x,fy))/grid)*(.55+.45*cs); }
          else c=B((id+f)/grid);
        } else {
          float bot=.5*max(-cs,0.);
          if(.5-f.y<bot && ph>=.5){ float fy=.5-(.5-f.y)/max(-cs,1e-3); c=B((id+vec2(f.x,fy))/grid)*(.6+.4*(-cs)); }
          else if(ph>=1.) c=B((id+f)/grid);
          else c=A((id+f)/grid);
        }
        float board=smoothstep(0.,.15,p)*(1.-smoothstep(.85,1.,p));
        vec2 e2=min(f,1.-f)*uRes/grid;
        float seam=1.-smoothstep(.6,1.6,min(e2.x,e2.y));
        float hinge=1.-smoothstep(.4,1.4,abs(f.y-.5)*uRes.y/grid.y);
        c*=1.-board*(seam*.55+hinge*.35);
        o=vec4(c,1.);
      }`,
    dom: (p, a, b) => { set(a, { o: 1 - ss(0.05, 0.45, p) }); set(b, { o: ss(0.6, 1, p) }); },
  },

  // The picture collapses into a vibrating string, which opens into the next picture.
  line: {
    dur: 1.8,
    frag: EASE + `
      void main(){
        float hA=mix(1.,.0025,io5(p/.42));
        float hB=mix(.0025,1.,io5((p-.58)/.42));
        float amp=smoothstep(.28,.48,p)*(1.-smoothstep(.55,.75,p));
        float x=vUv.x;
        float yl=.5+amp*(.045*sin(3.14159*x)*cos(p*70.)+.018*sin(6.28318*x+.3)*cos(p*113.));
        float px=1./uRes.y;
        vec3 c=vec3(0.);
        float dy=vUv.y-yl;
        if(p<.5){ float m=1.-smoothstep(hA*.5-px,hA*.5+px,abs(dy)); c=texture(tA,vec2(x,.5+dy/hA)).rgb*mix(1.,2.4,1.-hA)*m; }
        else    { float m=1.-smoothstep(hB*.5-px,hB*.5+px,abs(dy)); c=texture(tB,vec2(x,.5+dy/hB)).rgb*mix(1.,2.4,1.-hB)*m; }
        float glow=exp(-abs(dy)/(px*(2.5+18.*amp)))*smoothstep(.22,.45,p)*(1.-smoothstep(.58,.82,p));
        vec3 lc=mix(texture(tA,vec2(x,.5)).rgb,texture(tB,vec2(x,.5)).rgb,smoothstep(.45,.55,p));
        c+=glow*(lc*1.6+.35);
        o=vec4(min(c,vec3(1.2)),1.);
      }`,
    dom: (p, a, b, v) => {
      const hA = Math.max(0.0025, 1 - io5(p / 0.42) * 0.9975);
      const hB = Math.max(0.0025, io5((p - 0.58) / 0.42));
      set(a, { t: `scaleY(${hA})`, origin: center(v), o: p < 0.5 ? 1 : 0 });
      set(b, { t: `scaleY(${hB})`, origin: center(v), o: p >= 0.5 ? 1 : 0 });
    },
  },

  // The old picture is torn away right-to-left like paper.
  tear: {
    dur: 1.9,
    frag: EASE + `
      void main(){
        float e=io3(p);
        float y=vUv.y;
        float xb=mix(1.14,-.14,e);
        float j=.04*(fbm(vec2(y*5.,3.7))-.5)+.009*(vnoise(vec2(y*70.,1.))-.5)+.003*(vnoise(vec2(y*300.,5.))-.5);
        float xt=xb+j+(y-.5)*.1;
        float px=1./uRes.y;
        float d=(vUv.x-xt)*uAsp;
        vec3 a=texture(tA,vUv).rgb, b=texture(tB,vUv).rgb;
        float edgeW=(4.+6.*vnoise(vec2(y*90.,2.)))*px;
        float edge=smoothstep(-edgeW-px,-edgeW+px,d)*(1.-smoothstep(-px*.5,px*.5,d));
        float fib=smoothstep(.62,.9,vnoise(vec2(y*420.,d*1200.)))*exp(-max(d,0.)/(4.*px))*step(0.,d);
        float sh=.5*exp(-max(d,0.)/.035)*step(0.,d);
        a*=1.-.28*exp(min(d,0.)/.025);
        vec3 paper=vec3(.95,.94,.91)*(.92+.08*vnoise(vec2(y*200.,d*400.)));
        vec3 c=d<0.?a:b*(1.-sh);
        c=mix(c,paper,clamp(edge+fib*.85,0.,1.));
        o=vec4(c,1.);
      }`,
    dom: (p, a, b, v) => {
      const xb = 1.14 - 1.28 * io3(p);
      const xs = v.x0 + xb * v.w; // stage x of the tear
      set(a, { clip: leftOf(xs) });
      set(b, { o: ss(0.55, 0.95, p) });
    },
  },

  // Over-exposure to white, then the next picture develops out of the light.
  daybreak: {
    dur: 2.4,
    frag: EASE + `
      void main(){
        float k1=smoothstep(0.,.5,p), k2=1.-smoothstep(.42,1.,p);
        bool showB=p>.46;
        float ex=showB?k2:k1;
        float r=ex*.05;
        vec3 s=vec3(0.);
        for(int i=0;i<28;i++){ float f=(float(i)+.5)/28.; float an=float(i)*2.39996+hash12(gl_FragCoord.xy)*6.28;
          vec2 d=vec2(cos(an),sin(an))*sqrt(f)*r*vec2(1./uAsp,1.);
          s+=showB?texture(tB,vUv+d).rgb:texture(tA,vUv+d).rgb; }
        s/=28.;
        s=s*(1.+ex*3.2)+ex*ex*1.1;
        s=mix(min(s,vec3(1.)),vec3(1.,.975,.93),ex*ex*.85);
        o=vec4(s,1.);
      }`,
    dom: (p, a, b) => {
      set(a, { o: 1 - ss(0, 0.4, p), filter: `blur(${ss(0, 0.45, p) * 10}px)` });
      set(b, { o: ss(0.55, 1, p), filter: `blur(${(1 - ss(0.5, 1, p)) * 10}px)` });
    },
  },

  // The next picture slams down onto the old one.
  slam: {
    dur: 1.1,
    frag: EASE + `
      void main(){
        float k=clamp(p/.5,0.,1.); float e=k*k*k;
        float sc=mix(2.4,1.,e);
        float hit=step(.5,p); float t2=max(p-.5,0.)/.5;
        vec2 sh=hit*vec2(sin(t2*83.),cos(t2*67.))*.011*exp(-t2*7.);
        vec2 c0=vec2(.5);
        float bl=(1.-hit)*.16*k;
        vec3 b=vec3(0.);
        for(int i=0;i<10;i++){ float f=float(i)/9.; b+=texture(tB,(vUv-c0+sh)/(sc*(1.+bl*f))+c0).rgb; }
        b/=10.;
        float al=smoothstep(0.,.3,k);
        vec3 a=texture(tA,(vUv-.5)/(1.-.05*e)+.5+sh).rgb*(1.-.65*e);
        vec3 c=mix(a,b,al);
        c+=hit*exp(-t2*12.)*.22;
        o=vec4(c,1.);
      }`,
    dom: (p, a, b, v) => {
      const k = c01(p / 0.5), e = k * k * k;
      const sc = 2.4 + (1 - 2.4) * e;
      const t2 = Math.max(p - 0.5, 0) / 0.5, hit = p >= 0.5 ? 1 : 0;
      const dx = hit * Math.sin(t2 * 83) * 0.011 * Math.exp(-t2 * 7) * v.h;
      const dy = hit * Math.cos(t2 * 67) * 0.011 * Math.exp(-t2 * 7) * v.h;
      set(a, { t: `scale(${1 - 0.05 * e})`, origin: center(v), o: 1 - e });
      set(b, { t: `translate(${-dx}px,${dy}px) scale(${sc})`, origin: center(v), o: ss(0, 0.3, k) });
    },
  },

  // The right half folds over the left like a page; the folded sheet slides away.
  fold: {
    dur: 2.0,
    frag: EASE + `
      void main(){
        float k=io3(p/.62); float th=k*3.14159; float cs=cos(th), sn=sin(th);
        float k2=io3((p-.55)/.45);
        vec2 uv=vUv;
        vec3 b=texture(tB,uv).rgb;
        vec3 c=b;
        // left half (static until the slide-away)
        vec2 slide=vec2(-k2*1.1, -k2*.08);
        vec2 lv=uv-slide;
        float pxx=1./uRes.x;
        bool inLeft=lv.x>=0.&&lv.x<.5&&lv.y>=0.&&lv.y<=1.;
        // flap occupying [.5, .5+.5cs] (front) or [.5+.5cs, .5] (back)
        float w=.5*cs;
        float fx=(lv.x-.5)/(abs(w)>1e-4?w:1e-4);
        bool onFlap=fx>=0.&&fx<=1.&&lv.y>=0.&&lv.y<=1.;
        float z=sn*fx*.5;
        float fy=.5+(lv.y-.5)/(1.+z*.55);
        bool flapY=fy>=0.&&fy<=1.;
        float shadow=0.;
        if(inLeft) c=texture(tA,lv).rgb*(1.-.35*k*smoothstep(.0,.5,lv.x)*(1.-k2));
        if(onFlap&&flapY){
          if(cs>=0.) c=texture(tA,vec2(.5+fx*.5,fy)).rgb*(.6+.4*cs);
          else { vec3 back=vec3(.93,.92,.89); vec3 ghost=texture(tA,vec2(.5+fx*.5,fy)).rgb; c=mix(back,ghost,.06)*(.72+.28*(-cs)); }
        } else if(!inLeft) {
          float edge=.5+w; float dd=abs(uv.x-edge-slide.x);
          shadow=.45*exp(-dd*18.)*sn*(1.-k2);
          c=b*(1.-shadow);
        }
        o=vec4(c,1.);
      }`,
    dom: (p, a, b, v) => {
      const k = io3(p / 0.62), k2 = io3((p - 0.55) / 0.45);
      const xs = v.x0 + v.w * 0.5;
      set(a, { t: `translate(${-k2 * 1.1 * v.w}px, ${k2 * 0.08 * v.h}px)`, clip: leftOf(xs), o: 1 - ss(0.3, 0.6, p) });
      set(b, { o: ss(0.55, 1, p) });
    },
  },
};

export function resetLayer(el) { set(el, {}); }
