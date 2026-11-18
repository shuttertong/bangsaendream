// The picture-quality watcher (src/core/quality.js) on simulated devices: does it settle on a level and a
// pixel ratio that keep the frame rate, without bouncing between two settings?
//   node tools/test_quality.mjs
// A device is a GPU cost model: ms per frame = fixed[level] + fill[level] × ratio² (× a jitter), shown on a 60 Hz
// screen (a frame that misses a refresh waits for the next one).
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
globalThis.dispatchEvent = () => true;
globalThis.Event = class { constructor(t) { this.type = t; } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true });

const { QUALITY: Q } = await import('../src/shared/config.js');
const { createQuality } = await import('../src/core/quality.js');

const COST = { low: [1, 1.2], mid: [1.6, 1.9], high: [2.2, 2.4] };   // relative [fixed, fill] of each level (measured on the start beach)
function run(name, { speed, dpr, mode = 'auto', start = null, secs = 600 }) {
  for (const k of Object.keys(store)) delete store[k];
  if (start) store[Q.key] = JSON.stringify({ mode: 'auto', level: start });
  globalThis.devicePixelRatio = dpr;
  let ratio = 1;
  const q = createQuality({ setPixelRatio: r => { ratio = r; }, getContext: () => ({ getExtension: () => null, getParameter: () => '' , RENDERER: 0 }) }, { mode });
  const changes = [];
  let last = `${q.level}@${q.ratio.toFixed(2)}`, t = 0, slowFrames = 0, frames = 0, seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (t < secs) {
    const [fixed, fill] = COST[q.level];
    const gpu = (fixed + fill * q.ratio * q.ratio) * speed * (0.92 + rnd() * 0.16);
    const dt = Math.max(1, Math.ceil(gpu / 16.667)) * 16.667 / 1000;          // vsync at 60 Hz
    t += dt; frames++;
    if (t > secs / 2 && dt > 0.02) slowFrames++;
    q.update(dt);
    const now = `${q.level}@${q.ratio.toFixed(2)}`;
    if (now !== last) { changes.push(`${t.toFixed(0)}s ${now}`); last = now; }
  }
  const late = changes.filter(c => +c.split('s')[0] > secs / 2).length;
  console.log(`${name.padEnd(34)} → ${last.padEnd(10)} changes ${String(changes.length).padStart(2)} (${late} in the 2nd half)  slow frames in the 2nd half ${(slowFrames / frames * 200).toFixed(1)} %`);
  if (process.argv.includes('-v')) console.log('   ', changes.join(' · '));
  return { last, changes, late, slow: slowFrames / frames * 2 };
}

// speed: ms the "low level at ratio 0" costs — 1 ≈ a fast laptop, 6 ≈ an old phone
const results = [
  run('fast desktop, 2× screen', { speed: 1, dpr: 2 }),
  run('fast desktop, 1× screen', { speed: 1.5, dpr: 1 }),
  run('laptop with built-in graphics', { speed: 2.6, dpr: 1.25, start: 'high' }),
  run('mid phone, 3× screen', { speed: 3.2, dpr: 3, start: 'mid' }),
  run('old phone, 2× screen', { speed: 6, dpr: 2, start: 'mid' }),
  run('very slow device', { speed: 14, dpr: 2, start: 'mid' }),
  run('player chose "high" on a slow phone', { speed: 6, dpr: 2, mode: 'high' }),
  run('player chose "low" on a fast desktop', { speed: 1, dpr: 2, mode: 'low' }),
];
const ok = results.every(r => r.late <= 3);
console.log(ok ? 'ok: every device settles' : 'FAIL: a device keeps changing');
process.exit(ok ? 0 : 1);
