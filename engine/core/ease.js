// Small math kit used everywhere. All easings take t in [0,1] (clamped) and return [0,1].

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = lerp;
/** Map x from [a,b] to [c,d], clamped. */
export const remap = (x, a, b, c = 0, d = 1) => c + (d - c) * clamp((x - a) / (b - a || 1e-9));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-9));
  return t * t * (3 - 2 * t);
};
/** Exponential approach: frame-rate independent smoothing toward a target. */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

const c = clamp;
export const ease = {
  linear: (t) => c(t),
  in2: (t) => (t = c(t), t * t),
  out2: (t) => (t = c(t), 1 - (1 - t) * (1 - t)),
  io2: (t) => (t = c(t), t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  in3: (t) => (t = c(t), t * t * t),
  out3: (t) => (t = c(t), 1 - (1 - t) ** 3),
  io3: (t) => (t = c(t), t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  in4: (t) => (t = c(t), t ** 4),
  out4: (t) => (t = c(t), 1 - (1 - t) ** 4),
  io4: (t) => (t = c(t), t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  out5: (t) => (t = c(t), 1 - (1 - t) ** 5),
  io5: (t) => (t = c(t), t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  inExpo: (t) => (t = c(t), t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t = c(t), t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  ioExpo: (t) => {
    t = c(t);
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
  },
  /** Overshoots then settles. Good for UI pops (selection boxes, labels). */
  outBack: (t, s = 1.70158) => {
    t = c(t);
    const k = s + 1;
    return 1 + k * (t - 1) ** 3 + s * (t - 1) ** 2;
  },
  inBack: (t, s = 1.70158) => (t = c(t), (s + 1) * t * t * t - s * t * t),
  /** Smootherstep (C2): calm, symmetric. The default for camera moves. */
  smoother: (t) => (t = c(t), t * t * t * (t * (t * 6 - 15) + 10)),
};

/** Deterministic PRNG (xorshift32). rng() -> [0,1). Same seed, same world. */
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Format numbers for on-screen counters. */
export function fmt(n, style = 'comma', digits = 0) {
  if (!isFinite(n)) return '∞';
  if (style === 'sci' || (style === 'auto' && Math.abs(n) >= 1e15)) {
    if (n === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(n)));
    const m = n / 10 ** e;
    const ms = m.toFixed(1).replace(/\.0$/, '');
    return (ms === '1' ? '' : ms + ' × ') + '10^' + e;
  }
  if (style === 'fixed') return n.toFixed(digits);
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Fibonacci number F(n) (F(1)=1, F(2)=1). Used by the growth counter. */
export function fib(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
