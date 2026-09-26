// Procedural audio (Web Audio API): everything is synthesised in code, so there are no
// sound files to download or license. Ambient beds (surf, breeze, cicadas, night
// crickets) fade in and out by level; one-shot effects are short synth recipes.
// Browsers only start audio after a user gesture: call unlock() from a tap / key.

const MUTE_KEY = 'bangsaen.mute';

export function createAudio() {
  let ctx = null, master = null, noise = null, muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked */ }
  const beds = {};
  const wanted = {};            // bed → target level (kept even before unlock)

  function noiseBuffer() {
    // 4 s of pink-ish noise, looped by beds
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
    }
    return buf;
  }
  function noiseSource() {
    const s = ctx.createBufferSource();
    s.buffer = noise; s.loop = true;
    s.start(0, Math.random() * 4);
    return s;
  }
  const lfo = (freq, depth, target, offset = 0) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = depth;
    o.connect(g).connect(target);
    o.start(ctx.currentTime + offset);
    return o;
  };

  // ---- ambient beds: each returns a gain node whose level we fade ----
  const BEDS = {
    surf() {       // low rumble + a wash that swells every ~7 s
      const out = ctx.createGain(); out.gain.value = 0;
      const src = noiseSource(), lp = ctx.createBiquadFilter(), swell = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 700; swell.gain.value = 0.5;
      lfo(1 / 7, 0.45, swell.gain);
      lfo(1 / 7, 450, lp.frequency, 0.3);
      src.connect(lp).connect(swell).connect(out);
      return out;
    },
    breeze() {
      const out = ctx.createGain(); out.gain.value = 0;
      const src = noiseSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6; g.gain.value = 0.25;
      lfo(0.11, 350, bp.frequency); lfo(0.07, 0.15, g.gain);
      src.connect(bp).connect(g).connect(out);
      return out;
    },
    cicadas() {    // bright band of noise, trilled, in long waves
      const out = ctx.createGain(); out.gain.value = 0;
      const src = noiseSource(), bp = ctx.createBiquadFilter(), trill = ctx.createGain(), wave = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
      trill.gain.value = 0.5; wave.gain.value = 0.5;
      lfo(46, 0.5, trill.gain);
      lfo(1 / 9, 0.45, wave.gain);
      src.connect(bp).connect(trill).connect(wave).connect(out);
      return out;
    },
    crickets() {   // night: short chirps of a sine pair
      const out = ctx.createGain(); out.gain.value = 0;
      for (const [f, rate] of [[4300, 2.6], [3900, 3.1]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; g.gain.value = 0.04;       // gate swings the gain 0 … 0.08 → chirps
        const gate = ctx.createOscillator(), gg = ctx.createGain();
        gate.type = 'square'; gate.frequency.value = rate; gg.gain.value = 0.04;
        gate.connect(gg).connect(g.gain);
        o.connect(g).connect(out);
        o.start(); gate.start();
      }
      return out;
    },
    engine() {     // diesel pickup idle: low buzz + rumble
      const out = ctx.createGain(); out.gain.value = 0;
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 38; lp.type = 'lowpass'; lp.frequency.value = 220; g.gain.value = 0.35;
      lfo(9, 0.12, g.gain);
      o.connect(lp).connect(g).connect(out); o.start();
      const n = noiseSource(), nl = ctx.createBiquadFilter(); nl.type = 'lowpass'; nl.frequency.value = 160;
      n.connect(nl).connect(out);
      return out;
    },
  };
  const BED_LEVEL = { surf: 0.5, breeze: 0.25, cicadas: 0.07, crickets: 0.5, engine: 0.35 };

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noise = noiseBuffer();
    for (const [k, v] of Object.entries(wanted)) setBed(k, v);
  }

  /** Fade an ambient bed to a level 0..1 (created on first use). */
  function setBed(name, level) {
    wanted[name] = level;
    if (!ctx) return;
    if (!beds[name]) { beds[name] = BEDS[name](); beds[name].connect(master); }
    beds[name].gain.setTargetAtTime(level * BED_LEVEL[name], ctx.currentTime, 0.6);
  }
  /** Set several beds at once; beds not listed fade out. */
  function ambience(levels) {
    for (const k of Object.keys(BEDS)) setBed(k, levels[k] || 0);
  }

  // ---- one-shot effects ----
  function tone(freq, t0, dur, { type = 'sine', gain = 0.2, slide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function burst(t0, dur, { freq = 800, q = 1, type = 'lowpass', gain = 0.4, slide = 0 } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0, Math.random() * 3); s.stop(t0 + dur + 0.05);
  }
  const FX = {
    click: t => tone(880, t, 0.06, { type: 'triangle', gain: 0.08 }),
    blip: t => tone(520 + Math.random() * 160, t, 0.05, { type: 'triangle', gain: 0.035 }),     // dialogue typing
    coin: t => { tone(1318, t, 0.12, { type: 'triangle', gain: 0.12 }); tone(1760, t + 0.07, 0.25, { type: 'triangle', gain: 0.12 }); },
    catch: t => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.06, 0.22, { type: 'triangle', gain: 0.11 })),
    fail: t => { tone(300, t, 0.18, { type: 'sawtooth', gain: 0.05, slide: 0.6 }); tone(220, t + 0.12, 0.25, { type: 'sawtooth', gain: 0.05, slide: 0.6 }); },
    whoosh: t => burst(t, 0.25, { type: 'bandpass', freq: 600, q: 0.8, gain: 0.35, slide: 3 }),
    splash: t => { burst(t, 0.5, { freq: 2400, gain: 0.35, slide: 0.3 }); burst(t + 0.05, 0.3, { type: 'highpass', freq: 3000, gain: 0.15 }); },
    thud: t => { tone(110, t, 0.18, { gain: 0.35, slide: 0.5 }); burst(t, 0.08, { freq: 600, gain: 0.25 }); },
    sting: t => { tone(1400, t, 0.15, { type: 'square', gain: 0.05, slide: 0.4 }); tone(900, t + 0.05, 0.2, { type: 'square', gain: 0.04, slide: 0.5 }); },
    monkey: t => { for (let i = 0; i < 3; i++) tone(900 + i * 120, t + i * 0.08, 0.07, { type: 'square', gain: 0.03, slide: 1.4 }); },
    fanfare: t => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, t + i * 0.11, 0.3, { type: 'triangle', gain: 0.1 })),
    reel: t => tone(2200, t, 0.03, { type: 'square', gain: 0.02 }),
  };
  function play(name) {
    if (!ctx || muted || !FX[name]) return;
    FX[name](ctx.currentTime + 0.01);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* storage blocked */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.1);
  }

  return { unlock, play, setBed, ambience, get muted() { return muted; }, setMuted, get ready() { return !!ctx; } };
}
