// Real ground level for the lowland. The elevation data (a radar DEM) measures the tops of
// buildings and trees as well as the ground, which made mounds up to 12 m high along a beach that
// is flat in reality. Before anything is built, the land near the sea is replaced by a
// "bare earth" estimate of the same data, measured from the real sea level:
//   1. a low percentile of the heights in a ~100 m window: roofs and tree crowns are the high
//      values and drop out, the ground between them stays, and real rises are kept;
//   2. a light blur;
//   3. true vertical scale (the map's ×1.5 exaggeration is kept for Khao Sam Muk only);
//   4. the beach slopes up from the waterline at a real beach gradient (1:20) to the dry line:
//      ground behind the beach is at least 2 m above mean sea level, as it is in reality (above the
//      high tide of the upper Gulf of Thailand).
// Khao Sam Muk is left alone; the change eases in around the hill and fades out far inland.
import { seaDistance } from './terrain.js';

export const FLAT = {
  hill: { x0: -1100, x1: -100, z0: -2480, z1: -1250, blend: 160 },   // Khao Sam Muk: untouched, eased in over `blend` m
  full: 700, fade: 1600,                // metres from the sea: corrected fully / not at all
  window: 6, blur: 3, percentile: 0.25, // grid cells each way (8 m cells): sample window, blur radius; which value counts as the ground
  scale: 1,                             // vertical scale of the lowland (1 = true to life)
  beach: { foot: 0.3, slope: 1 / 20 },  // real metres above the sea at the waterline; beach gradient (1:20)
  dry: 2.0,                             // real metres above mean sea level: ground behind the beach is at least this high
};
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** Low percentile of the land cells in a ±r window (every 2nd cell), for the cells in `want`; NaN = sea. */
function lowPercentile(src, nx, nz, r, q, want) {
  const out = new Float32Array(src.length).fill(NaN), buf = new Float32Array((r + 1) * (r + 1));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!want[k]) continue;
    let n = 0;
    for (let b = -r; b <= r; b += 2) for (let a = -r; a <= r; a += 2) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const v = src[jj * nx + ii];
      if (v === v) buf[n++] = v;
    }
    const part = buf.subarray(0, n).sort();
    out[k] = n ? part[Math.min(n - 1, Math.floor(n * q))] : NaN;
  }
  return out;
}
function blur(src, nx, nz, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (const [a, b, horizontal] of [[src, tmp, true], [tmp, out, false]]) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let sum = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const ii = horizontal ? i + k : i, jj = horizontal ? j : j + k;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const s = a[jj * nx + ii];
        if (s === s) { sum += s; n++; }
      }
      b[j * nx + i] = n ? sum / n : NaN;
    }
  }
  return out;
}

/** Correct map.heights in place. Call right after loading the map, before the roads are graded. */
export function flattenLowland(map) {
  const F = FLAT, { x0, z0, step, nx, nz } = map.core, h = map.heights, sea = map.sea, hs = map.hscale || 1.5, dist = seaDistance(map), H = F.hill;
  // real elevation above the sea (m) of every land cell; sea cells are left out of the filters
  const real = new Float32Array(h.length);
  for (let k = 0; k < h.length; k++) real[k] = h[k] < sea ? NaN : (h[k] - sea) / hs;
  const weight = new Float32Array(h.length);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (h[k] < sea) continue;                                         // the sea bed stays
    const x = x0 + i * step, z = z0 + j * step;
    const out = Math.max(H.x0 - x, x - H.x1, H.z0 - z, z - H.z1);      // metres outside the hill box (≤ 0 inside)
    weight[k] = (1 - smooth((dist[k] - F.full) / (F.fade - F.full))) * smooth(out / H.blend);
  }
  const bare = blur(lowPercentile(real, nx, nz, F.window, F.percentile, weight), nx, nz, F.blur);
  let moved = 0, highest = 0, sum = 0, n = 0, top = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (h[k] < sea) continue;                                         // the sea bed stays
    const w = weight[k], d = dist[k];
    if (w <= 0 || bare[k] !== bare[k]) continue;
    // on the beach: the real beach gradient up from the waterline; behind it: the bare ground, never below the dry line
    const slope = F.beach.foot + d * F.beach.slope;
    const e = slope < F.dry ? slope : Math.max(F.dry, bare[k]);          // real metres above the sea
    const v = h[k] + (sea + e * F.scale - h[k]) * w;
    if (Math.abs(v - h[k]) > 0.25) moved++;
    highest = Math.max(highest, h[k] - v);
    if (w > 0.99) { sum += e; n++; top = Math.max(top, e); }
    h[k] = v;
  }
  return { moved, lowered: +highest.toFixed(1), meanM: +(sum / n).toFixed(2), maxM: +top.toFixed(1) };
}
