// Living backgrounds for typographic scenes. Each is one fullscreen shader with film grain
// and a soft vignette built in, so a "plain" slide still feels like a photographed surface.
//
//   create(ctx) {
//     const bg = kit.backdrop(ctx, 'paper', { colors: ['#f3efe6', '#e7dfcf'] });
//     return { update(s){ bg.set({ amount: s.k(1, 0, 2) }); }, render: bg.render };
//   }
import * as THREE from 'three';

const KINDS = {
  // flat color, grain, vignette
  solid: `vec3 bg(vec2 q, vec2 uv){ return c0; }`,

  // warm paper with fibres and a soft window light from the top-left
  paper: `vec3 bg(vec2 q, vec2 uv){
    float f=fbm(q*vec2(9.,26.)+uSeed)*.5+fbm(q*vec2(40.,8.)+3.+uSeed)*.5;
    float fine=vnoise(q*420.)-.5;
    vec3 c=mix(c1,c0,.55+.45*f);
    c*=1.+fine*.025;
    float light=smoothstep(1.6,-.4,length(q-vec2(-.55*uAsp,.55)));
    c*=.9+.14*light;
    return c; }`,

  // slow mesh gradient: domain-warped noise mixing up to four colors
  gradient: `vec3 bg(vec2 q, vec2 uv){
    float t=uTime*.03*uSpeed;
    vec2 w=vec2(fbmLo(q*1.2+t+uSeed),fbmLo(q*1.2-t+4.1+uSeed));
    float a=fbm(q*.9+w*1.6+t*.6);
    float b=fbm(q*1.4-w*1.2+7.3-t*.4);
    vec3 c=mix(c0,c1,smoothstep(.2,.8,a));
    c=mix(c,c2,smoothstep(.45,.85,b)*.85);
    c=mix(c,c3,smoothstep(.6,.95,a*b*1.6)*.6);
    return c; }`,

  // dark sky with flowing light curtains
  aurora: `vec3 bg(vec2 q, vec2 uv){
    float t=uTime*.05*uSpeed;
    vec3 c=mix(c0,c0*.4,uv.y);
    for(int i=0;i<3;i++){
      float fi=float(i);
      float y=.15+.18*fi+.12*sin(q.x*1.3+t*(1.+fi*.3)+fi*2.)+.1*(fbm(vec2(q.x*1.6+fi*3.,t+fi))-.5);
      float band=exp(-pow((q.y-y)*(5.+fi*2.),2.))*(.6+.4*fbm(vec2(q.x*8.,t*2.+fi)));
      float rays=.6+.4*vnoise(vec2(q.x*40.+fi*10.,t*3.));
      c+=mix(c1,c2,fi*.5)*band*rays*.55*uAmount;
    }
    return c; }`,

  // ink blooming in water (c0 = paper/water, c1 = ink)
  ink: `vec3 bg(vec2 q, vec2 uv){
    float t=uTime*.04*uSpeed;
    vec2 w=vec2(fbm(q*1.5+t+uSeed),fbm(q*1.5-t+2.7+uSeed))-.5;
    float d=length(q-uCenter*vec2(uAsp,1.)+w*.6)-uAmount*1.2;
    float n=fbm(q*3.+w*2.+t);
    float ink=smoothstep(.15,-.25,d+n*.35);
    float edge=exp(-abs(d+n*.35)*18.)*.35;
    return mix(c0,c1,ink)+c1*edge*.2; }`,

  // engineering grid on deep blue
  grid: `vec3 bg(vec2 q, vec2 uv){
    vec2 g=q*12.; vec2 f=abs(fract(g)-.5); vec2 px=fwidth(g);
    float l=1.-min(smoothstep(.5-px.x*1.2,.5,f.x*1.0+.0),1.);
    float minor=max(1.-smoothstep(0.,px.x*1.5,.5-f.x),1.-smoothstep(0.,px.y*1.5,.5-f.y));
    vec2 G=q*2.4; vec2 F=abs(fract(G)-.5); vec2 PX=fwidth(G);
    float major=max(1.-smoothstep(0.,PX.x*1.5,.5-F.x),1.-smoothstep(0.,PX.y*1.5,.5-F.y));
    vec3 c=c0*(1.-.35*length(q)/uAsp);
    c+=c1*(minor*.08+major*.22);
    return c; }`,

  // deep field: stars + faint nebula, slow drift
  stars: `vec3 bg(vec2 q, vec2 uv){
    vec3 c=c0;
    float t=uTime*.004*uSpeed;
    c+=c1*pow(fbm(q*1.2+vec2(t,0.)+uSeed),3.)*.6*uAmount;
    c+=c2*pow(fbm(q*2.1-vec2(t*.6,0.)+5.+uSeed),4.)*.5*uAmount;
    for(int L=0;L<3;L++){
      float s=float(L)*1.7+1.;
      vec2 g=(q+vec2(t*(1.+float(L)),0.))*60.*s; vec2 id=floor(g), f=fract(g)-.5;
      vec2 h=hash22(id+float(L)*13.);
      float star=smoothstep(.07/s,0.,length(f-(h-.5)*.7))*step(.92,hash12(id*1.3+float(L)));
      c+=vec3(1.,.95,.88)*star*(.5+.5*sin(uTime*(1.+h.x*3.)+h.y*6.))*1.2;
    }
    return c; }`,

  // theatrical spotlight on a dark floor
  spotlight: `vec3 bg(vec2 q, vec2 uv){
    vec2 cpos=uCenter*vec2(uAsp,1.);
    float d=length((q-cpos)*vec2(1.,1.7));
    float pool=smoothstep(.62,.05,d)*uAmount;
    float beam=smoothstep(.35,0.,abs(q.x-cpos.x)*(1.3-q.y*.6))*smoothstep(-.3,.6,q.y)*.25*uAmount;
    float dust=fbm(q*6.+uTime*.05)*beam;
    vec3 c=c0+c1*(pool*.85+beam*.5+dust*.4);
    return c; }`,

  // print halftone ramp
  halftone: `vec3 bg(vec2 q, vec2 uv){
    float ramp=smoothstep(-.6,.9,(q.x/uAsp+q.y)*.8+.2*sin(uTime*.1*uSpeed));
    vec2 g=rot2(.785)*q*70.; vec2 f=fract(g)-.5;
    float r=sqrt(ramp)*.62;
    float dot_=1.-smoothstep(r-.06,r+.06,length(f));
    return mix(c0,c1,dot_*uAmount); }`,
};

export function backdrop(ctx, kind = 'solid', opts = {}) {
  const body = KINDS[kind];
  if (!body) throw new Error('backdrop: unknown kind ' + kind + ' (try ' + Object.keys(KINDS).join(', ') + ')');
  const cols = (opts.colors || ['#101114', '#2a2f3a', '#6b7a99', '#f0d9b5']).map((h) => new THREE.Color(h));
  while (cols.length < 4) cols.push(cols[cols.length - 1].clone());
  const pass = ctx.pass(`
    uniform vec3 c0,c1,c2,c3; uniform float uGrain,uVig,uSeed,uAmount,uSpeed; uniform vec2 uCenter;
    ${body}
    void main(){
      vec2 q=(vUv-.5)*vec2(uAsp,1.);
      vec3 c=bg(q,vUv);
      float v=smoothstep(1.3,.2,length(q*vec2(1.,1.15)));
      c*=mix(1.,v,uVig);
      vec3 s=toSRGB(c);
      float n=hash13(vec3(floor(gl_FragCoord.xy/1.4),fract(uTime*7.31)*97.))+hash13(vec3(floor(gl_FragCoord.xy/1.4)+17.,fract(uTime*3.7)*53.))-1.;
      s+=n*uGrain;
      o=vec4(s,1.);
    }`, {
    c0: new THREE.Vector3(cols[0].r, cols[0].g, cols[0].b),
    c1: new THREE.Vector3(cols[1].r, cols[1].g, cols[1].b),
    c2: new THREE.Vector3(cols[2].r, cols[2].g, cols[2].b),
    c3: new THREE.Vector3(cols[3].r, cols[3].g, cols[3].b),
    uGrain: opts.grain ?? 0.03,
    uVig: opts.vignette ?? 0.25,
    uSeed: opts.seed ?? 0,
    uAmount: opts.amount ?? 1,
    uSpeed: opts.speed ?? 1,
    uCenter: new THREE.Vector2(...(opts.center || [0, 0])),
  });
  const bg = {
    pass,
    /** set({ amount, speed, grain, vignette, center:[x,y], colors:[...] }) */
    set(o = {}) {
      if (o.amount != null) pass.u.uAmount = o.amount;
      if (o.speed != null) pass.u.uSpeed = o.speed;
      if (o.grain != null) pass.u.uGrain = o.grain;
      if (o.vignette != null) pass.u.uVig = o.vignette;
      if (o.center) pass.u.uCenter.set(o.center[0], o.center[1]);
      if (o.colors) o.colors.forEach((h, i) => { const c = new THREE.Color(h); pass.u['c' + i].set(c.r, c.g, c.b); });
      return bg;
    },
    render(out) { pass.render(out); },
  };
  return bg;
}
backdrop.kinds = Object.keys(KINDS);
