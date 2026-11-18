// Picture quality (QUALITY in shared/config.js): three levels — low / mid / high — and a watcher that
// keeps the game smooth on slow devices and sharp on fast ones.
//  • `gfx` is what every module reads: gfx.level (name) and gfx.L (that level's settings).
//  • The first level is the player's choice, else the one this device settled on last time, else a guess
//    from what the browser says about the device.
//  • While playing, the watcher averages frame times. Too slow: fewer pixels, down to the level's lowest
//    pixel ratio, then the next level down. Smooth for a while: it tries more pixels, then the next level
//    up — the screen's refresh rate hides how much room is left, so a try is the only way to know; a try
//    that turns slow is undone and the next one waits twice as long.
//  • A change of pixel ratio or level is announced as a window 'resize' (the hub and every mini-game
//    already resize their own render targets on that) and to quality.onChange() listeners.
import { QUALITY as Q } from '../shared/config.js';
import { frameInfo } from './loop.js';

/** The level in use. Modules read it when they build things (texture sizes) and when the level changes. */
export const gfx = { level: Q.fallback, L: Q.levels[Q.fallback] };

const load = () => { try { return JSON.parse(localStorage.getItem(Q.key)) || {}; } catch { return {}; } };
const save = v => { try { localStorage.setItem(Q.key, JSON.stringify(v)); } catch { /* private mode */ } };

/** A first guess at the level from the GPU's name, memory, CPU threads and whether it is a phone or tablet. */
export function guessLevel(renderer) {
  let gpu = '';
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch { /* some browsers hide it */ }
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.userAgent));
  for (const g of Q.guess) {
    if (g.gpu && g.gpu.test(gpu)) return g.level;
    if (g.memory && navigator.deviceMemory && navigator.deviceMemory <= g.memory) return g.level;
    if (g.cores && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= g.cores) return g.level;
    if (g.mobile && mobile) return g.level;
  }
  return Q.fallback;
}

/** opts: { mode: 'auto' | level (from ?gfx=), ratio: fixed pixel ratio (from ?res=, no watching) }. */
export function createQuality(renderer, opts = {}) {
  const saved = load(), dpr = devicePixelRatio || 1, listeners = [];
  let mode = Q.levels[opts.mode] || opts.mode === 'auto' ? opts.mode : Q.levels[saved.mode] ? saved.mode : 'auto';
  let autoLevel = Q.levels[saved.level] ? saved.level : guessLevel(renderer);   // where 'auto' last settled on this device (else the guess)
  let level = mode !== 'auto' ? mode : autoLevel;
  const top = l => Math.min(dpr, Q.levels[l].ratio[1]), floor = l => Math.min(top(l), Q.levels[l].ratio[0]);
  const lowest = () => Math.min(floor(Q.order[0]), top(level));          // a chosen level may still shed pixels down to here
  let ratio = opts.ratio || top(level);
  let acc = 0, n = 0, settle = Q.settle, bad = 0, good = 0, wait = 1, tried = 1e9;   // wait: back-off multiplier; tried: seconds since the last try upward

  const announce = () => dispatchEvent(new Event('resize'));
  function setRatio(r) { ratio = r; renderer.setPixelRatio(r); settle = Math.max(settle, 1); announce(); }
  function setLevel(l, keep = true) {
    level = l; gfx.level = l; gfx.L = Q.levels[l];
    ratio = opts.ratio || Math.min(top(l), Math.max(mode === 'auto' ? floor(l) : lowest(), ratio));
    renderer.setPixelRatio(ratio);
    settle = Q.settle; acc = n = bad = good = 0;
    for (const fn of listeners) fn(gfx.L, l);
    announce();
    if (mode === 'auto') { autoLevel = l; if (keep) save({ mode, level: l }); }
  }
  gfx.level = level; gfx.L = Q.levels[level];
  renderer.setPixelRatio(ratio);

  function lower() {
    if (tried < Q.raise.probe) wait = Math.min(Q.raise.max / Q.raise.ratio, wait * 2);   // the last try was too much: wait longer before the next
    const i = Q.order.indexOf(level);
    if (ratio > floor(level) + 0.01) setRatio(Math.max(floor(level), ratio - Q.step));
    else if (mode === 'auto' && i > 0) setLevel(Q.order[i - 1]);
    else if (ratio > lowest() + 0.01) setRatio(Math.max(lowest(), ratio - Q.step));
  }
  function raise() {
    const i = Q.order.indexOf(level);
    if (ratio < top(level) - 0.01) { setRatio(Math.min(top(level), ratio + Q.step)); tried = 0; }
    else if (mode === 'auto' && i < Q.order.length - 1) { setLevel(Q.order[i + 1]); tried = 0; }
  }
  const nextIsLevel = () => ratio >= top(level) - 0.01;

  return {
    get ratio() { return ratio; }, get level() { return level; }, get mode() { return mode; },
    /** fn(L, name): called now and whenever the level changes. */
    onChange(fn) { listeners.push(fn); fn(gfx.L, level); },
    /** 'auto', or a level to stay on (the pixel ratio still adapts within it). Remembered. */
    setMode(m) {
      if (m !== 'auto' && !Q.levels[m]) return;
      mode = m; wait = 1;
      save({ mode, level: autoLevel });
      const l = m === 'auto' ? autoLevel : m;                           // back to auto: carry on from where it had settled
      ratio = top(l);                                                   // show the level at its best; the watcher takes it from there
      setLevel(l, false);
    },
    /** Feed every rendered frame's dt. Long gaps (a hidden tab, a loading hitch) are ignored. */
    update(dt) {
      if (opts.ratio) return;
      tried += dt;
      if (dt > 0.25) { acc = n = 0; return; }
      if (settle > 0) { settle -= dt; return; }
      acc += dt; n++;
      if (acc < Q.window) return;
      const avg = acc / n, budget = Math.max(1 / Q.rate, frameInfo.refresh ? frameInfo.every / frameInfo.refresh : 0);
      acc = n = 0;
      if (avg > budget * Q.slow) {
        good = 0;
        if (++bad >= (avg > budget * Q.awful ? 1 : Q.bad)) { bad = 0; lower(); }
      } else {
        bad = 0;
        good = avg < budget * Q.fine ? good + Q.window : 0;
        if (good >= (nextIsLevel() ? Q.raise.level : Q.raise.ratio) * wait) { good = 0; raise(); }
      }
    },
  };
}
