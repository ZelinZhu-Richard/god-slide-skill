// Procedural sound design (Web Audio). Off by default: the presenter presses M to turn it on.
// Scenes call ctx.sfx('whoosh', {dur:1.4}) or put { sfx: 'swell' } on a beat.
export function createAudio() {
  let ac = null, master = null, wet = null, noise = null, on = false;

  function impulse(seconds = 2.6, decay = 2.4) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }
  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    master = ac.createGain(); master.gain.value = 0.7;
    const verb = ac.createConvolver(); verb.buffer = impulse();
    wet = ac.createGain(); wet.gain.value = 0.32;
    master.connect(comp); master.connect(verb); verb.connect(wet); wet.connect(comp);
    comp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const now = () => ac.currentTime + 0.01;
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.1); return o; }
  function src(t, dur) { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t); s.stop(t + dur + 0.1); return s; }
  function out(node, pan = 0) {
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(master); return p; }
    node.connect(master); return node;
  }

  const V = {
    tick({ gain = 0.12, f = 2400 } = {}) { const t = now(), g = ac.createGain(); env(g, t, 0.002, gain, 0, 0.05); osc('sine', f, t, 0.08).connect(g); out(g); },
    type({ gain = 0.1 } = {}) {
      const t = now(), g = ac.createGain(), bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 1400; bp.Q.value = 1.2;
      env(g, t, 0.001, gain, 0, 0.03); src(t, 0.05).connect(bp); bp.connect(g); out(g, Math.random() * 0.2 - 0.1);
    },
    whoosh({ gain = 0.22, dur = 1.2, from = 280, to = 3200 } = {}) {
      const t = now(), g = ac.createGain(), bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7);
      env(g, t, dur * 0.55, gain, 0, dur * 0.45);
      src(t, dur).connect(bp); bp.connect(g);
      const p = out(g, -0.4); if (p.pan) p.pan.linearRampToValueAtTime(0.4, t + dur);
    },
    swell({ gain = 0.12, dur = 3.2, f = 110 } = {}) {
      const t = now(), g = ac.createGain(), lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.8);
      env(g, t, dur * 0.75, gain, 0, dur * 0.6);
      for (const k of [1, 1.006, 1.5, 2.003]) osc('sawtooth', f * k, t, dur * 1.4).connect(lp);
      lp.connect(g); out(g);
    },
    thud({ gain = 0.5, f = 85 } = {}) {
      const t = now(), g = ac.createGain(), o = osc('sine', f, t, 0.6);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
      env(g, t, 0.004, gain, 0.02, 0.5); o.connect(g); out(g);
      const n = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      env(n, t, 0.002, gain * 0.35, 0, 0.12); src(t, 0.2).connect(lp); lp.connect(n); out(n);
    },
    chime({ gain = 0.1, f = 880 } = {}) {
      const t = now();
      [[1, 1], [2.76, 0.45], [5.4, 0.2]].forEach(([k, a]) => { const g = ac.createGain(); env(g, t, 0.003, gain * a, 0, 2.2 / k ** 0.3); osc('sine', f * k, t, 2.6).connect(g); out(g); });
    },
    rise({ gain = 0.1, dur = 2, from = 180, to = 1400 } = {}) {
      const t = now(), g = ac.createGain(), o = osc('sine', from, t, dur);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      env(g, t, dur * 0.8, gain, 0, dur * 0.25); o.connect(g); out(g);
    },
    hit({ gain = 0.35 } = {}) { V.thud({ gain }); V.whoosh({ gain: gain * 0.5, dur: 0.35, from: 1200, to: 400 }); },
  };

  return {
    get on() { return on; },
    toggle() { on = !on; if (on) ensure(); return on; },
    set(v) { on = !!v; if (on) ensure(); },
    play(name, opts) { if (!on || !V[name]) return; try { ensure(); V[name](opts); } catch (e) { /* audio is optional */ } },
    unlock() { if (ac && ac.state === 'suspended') ac.resume(); },
    voices: Object.keys(V),
  };
}
