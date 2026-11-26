// Shared GLSL (ES 3.0) chunks. Every fullscreen pass gets LIB prepended automatically.

export const HASH = /* glsl */ `
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3=fract(p3*.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash33(vec3 p3){ p3=fract(p3*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
`;

export const NOISE = /* glsl */ `
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  float a=hash12(i), b=hash12(i+vec2(1.,0.)), c=hash12(i+vec2(0.,1.)), d=hash12(i+vec2(1.,1.));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  float a=hash13(i), b=hash13(i+vec3(1,0,0)), c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
  float e=hash13(i+vec3(0,0,1)), g=hash13(i+vec3(1,0,1)), h=hash13(i+vec3(0,1,1)), k=hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),mix(mix(e,g,u.x),mix(h,k,u.x),u.y),u.z); }
float fbm(vec2 p){ float s=0., a=.5; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<5;i++){ s+=a*vnoise(p); p=r*p*2.02+17.1; a*=.5; } return s/.96875; }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(11.3,7.1,3.7); a*=.5; } return s/.96875; }
float fbmLo(vec2 p){ float s=0., a=.5; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<3;i++){ s+=a*vnoise(p); p=r*p*2.02+17.1; a*=.5; } return s/.875; }
mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
`;

export const COLOR = /* glsl */ `
vec3 toLin(vec3 c){ c=max(c,0.); return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c)); }
vec3 toSRGB(vec3 c){ c=max(c,0.); return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c)); }
float luma(vec3 c){ return dot(c,vec3(.2126,.7152,.0722)); }
vec3 acesFilm(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
vec3 agxContrast(vec3 x){ vec3 x2=x*x, x4=x2*x2;
  return 15.5*x4*x2-40.14*x4*x+31.96*x4-6.868*x2*x+.4298*x2+.1191*x-.00232; }
// AgX: linear Rec.709 in -> linear display out (filmic, graceful highlight roll-off).
vec3 agxTone(vec3 v){
  const mat3 m=mat3(.842479062253094,.0423282422610123,.0423756549057051,
                    .0784335999999992,.878468636469772,.0784336,
                    .0792237451477643,.0791661274605434,.879142973793104);
  const mat3 mi=mat3(1.19687900512017,-.0528968517574562,-.0529716355144438,
                     -.0980208811401368,1.15190312990417,-.0980434501171241,
                     -.0990297440797205,-.0989611768448433,1.15107367264116);
  const float lo=-12.47393, hi=4.026069;
  v=m*max(v,vec3(1e-10));
  v=clamp(log2(v),lo,hi); v=(v-lo)/(hi-lo);
  v=agxContrast(v);
  v=mi*v;
  return pow(max(v,0.),vec3(2.2));
}
`;

export const LIB = HASH + NOISE + COLOR;

/** Header for fullscreen passes. Shader bodies write to `o` and read `vUv`. */
export const PASS_HEAD = /* glsl */ `
precision highp float; precision highp int; precision highp sampler2D;
in vec2 vUv; out vec4 o; uniform vec2 uRes; uniform float uTime; uniform float uAsp;
`;

export const PASS_VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }
`;
