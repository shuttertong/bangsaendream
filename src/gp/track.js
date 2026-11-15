// The race track as numbers (no three.js, so tools/test_gp.mjs can run races in Node): the loop of
// real roads, its corners rounded and resampled every few metres, with tangents and curvature, and
// a projection from a point in the world to "how far round, how far off the centreline".

/** loop: [[x, z], …] closed. Returns { n, step, length, x, z, tx, tz, k, at(s), project(x, z, hint) }. */
export function buildTrack(loop, { step = 2, smooth = 3 } = {}) {
  let pts = loop.map(p => [...p]);
  for (let it = 0; it < smooth; it++) {                                  // Chaikin corner cutting on the closed polygon
    const out = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    pts = out;
  }
  // resample at a constant step
  const seg = pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); });
  const total = seg.reduce((a, b) => a + b, 0), n = Math.round(total / step), ds = total / n;
  const x = new Float32Array(n), z = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n), k = new Float32Array(n);
  for (let i = 0, j = 0, acc = 0; i < n; i++) {
    const s = i * ds;
    while (acc + seg[j] < s) { acc += seg[j]; j++; }
    const a = pts[j], b = pts[(j + 1) % pts.length], u = (s - acc) / seg[j];
    x[i] = a[0] + (b[0] - a[0]) * u; z[i] = a[1] + (b[1] - a[1]) * u;
  }
  for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n, L = Math.hypot(x[b] - x[a], z[b] - z[a]) || 1; tx[i] = (x[b] - x[a]) / L; tz[i] = (z[b] - z[a]) / L; }
  for (let i = 0; i < n; i++) {                                           // signed curvature (1/m), + = turning left, over ±3 samples
    const a = (i + n - 3) % n, b = (i + 3) % n, h = Math.atan2(tx[b] * tz[a] - tz[b] * tx[a], tx[b] * tx[a] + tz[b] * tz[a]);
    k[i] = -h / (6 * ds);
  }
  const wrap = i => ((i % n) + n) % n;
  const half = new Float32Array(n);                                       // usable half-width per sample; 0 = the rules' default (index.js fills it from the real roads)
  return {
    n, step: ds, length: total, x, z, tx, tz, k, half, wrap,
    /** The centreline at distance s (any real number): { x, z, tx, tz, i }. */
    at(s) {
      const f = ((s % total) + total) % total / ds, i = Math.floor(f) % n, j = (i + 1) % n, u = f - Math.floor(f);
      return { x: x[i] + (x[j] - x[i]) * u, z: z[i] + (z[j] - z[i]) * u, tx: tx[i], tz: tz[i], i };
    },
    /** Nearest sample to (px, pz) near index `hint` (or anywhere when hint < 0): { i, d } with d = metres left (+) or right (−) of the centreline. */
    project(px, pz, hint = -1) {
      let best = 0, bd = Infinity;
      const from = hint < 0 ? 0 : hint - 12, to = hint < 0 ? n : hint + 30;
      for (let q = from; q < to; q++) { const i = wrap(q), d = (px - x[i]) ** 2 + (pz - z[i]) ** 2; if (d < bd) { bd = d; best = i; } }
      return { i: best, d: (px - x[best]) * tz[best] - (pz - z[best]) * tx[best] };
    },
  };
}
