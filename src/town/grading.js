// Road grading. The DEM is noisy (8 m grid, ±1 m near the shore), so roads laid straight on it
// tilt sideways, bump, and even dip under the sea — where the kid then sinks. Before anything is
// built, every road gets a smooth long profile (never below the sea); a road that joins a more
// important one is pinned to that road's height at the junction; then the terrain grid under and
// beside each road is pulled to the profile. The road comes out level across, its shoulders blend
// back into the land, and everything placed later (kid, buildings, trees, water depth) follows
// the same graded ground because it all reads map.heightAt.
import { roadWidth } from './roads.js';

export const GRADE = {
  // most important first: a lesser road meeting one of these takes its height at the junction
  rank: ['secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian', 'service', 'track', 'cycleway', 'footway', 'path', 'steps'],
  window: { secondary: 44, tertiary: 40, unclassified: 28, residential: 26, living_street: 20, pedestrian: 24, service: 18, track: 16, cycleway: 12, footway: 10, path: 8, steps: 0 },   // smoothing length (m)
  step: 2,               // profile sample spacing (m)
  minAbove: 0.35,        // a road surface is never lower than sea + this
  flat: 5,               // fully graded this far beyond the road edge (whole grid cells under the road)
  blend: 12,             // …then eases back to the natural ground over this distance
  pin: 0.6,              // a sample within (other road's half-width + this) takes that road's height
  wetReach: 9,           // under-sea grid nodes are raised only this close to a road edge: one grid cell, so a
                         // waterfront road has solid ground under both edges, and the shore moves no further
  maxGrade: { town: 0.08, hill: 0.25 },   // steepest climb (scene height per metre; heights are ×1.5): gentle in town,
  hill: 12,              // steep allowed where the raw ground is higher than this (Khao Sam Muk)
};

/** Keep |dh/ds| ≤ g(i) (per step i-1 → i) while staying close to h: the mean of the upper and lower envelopes. */
function limitGrade(S, g) {
  const n = S.length, up = S.map(s => s.h), lo = S.map(s => s.h);
  for (let i = 1; i < n; i++) { const d = g(i) * (S[i].s - S[i - 1].s); up[i] = Math.min(up[i], up[i - 1] + d); lo[i] = Math.max(lo[i], lo[i - 1] - d); }
  for (let i = n - 2; i >= 0; i--) { const d = g(i + 1) * (S[i + 1].s - S[i].s); up[i] = Math.min(up[i], up[i + 1] + d); lo[i] = Math.max(lo[i], lo[i + 1] - d); }
  for (let i = 0; i < n; i++) S[i].h = (up[i] + lo[i]) / 2;
}

const smoothstep = t => t * t * (3 - 2 * t);

/** Grade map.heights in place. Call right after loading the map, before the terrain is built. */
export function gradeRoads(map) {
  const G = GRADE, { x0, z0, step, nx, nz } = map.core, h = map.heights, orig = h.slice();
  const sea = map.sea, floor = sea + G.minAbove;
  const hAt = (x, z) => {                                            // triangle-exact, on the ungraded grid
    const fx = (x - x0) / step, fz = (z - z0) / step, i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j;
    const at = (ii, jj) => orig[Math.min(nz - 1, Math.max(0, jj)) * nx + Math.min(nx - 1, Math.max(0, ii))];
    if (a + b <= 1) return at(i, j) + a * (at(i + 1, j) - at(i, j)) + b * (at(i, j + 1) - at(i, j));
    const h11 = at(i + 1, j + 1);
    return h11 + (1 - a) * (at(i, j + 1) - h11) + (1 - b) * (at(i + 1, j) - h11);
  };
  // graded samples so far, hashed for the junction pins
  const CELL = 16, hash = new Map(), key = (x, z) => Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  const surfaceAt = (x, z) => {
    let best = null, bd = Infinity;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const s of hash.get((cx + a) * 100003 + cz + b) || []) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < s.hw + G.pin && d < bd) { bd = d; best = s; }
    }
    return best;
  };

  const roads = map.roads.filter(r => roadWidth(r.k) && r.p.length >= 2)
    .map(r => ({ r, rank: G.rank.indexOf(r.k) < 0 ? G.rank.length : G.rank.indexOf(r.k), len: r.p.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - r.p[i - 1][0], p[1] - r.p[i - 1][1]) : 0), 0) }))
    .sort((a, b) => a.rank - b.rank || b.len - a.len);
  const all = [];
  let pinned = 0;
  for (const { r } of roads) {
    const hw = roadWidth(r.k) / 2, win = G.window[r.k] ?? 16;
    // samples every G.step along the polyline (plus its last point)
    const S = [];
    for (let k = 1; k < r.p.length; k++) {
      const [ax, az] = r.p[k - 1], [bx, bz] = r.p[k], L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L; d += G.step) S.push({ x: ax + (bx - ax) * d / L, z: az + (bz - az) * d / L });
    }
    S.push({ x: r.p[r.p.length - 1][0], z: r.p[r.p.length - 1][1] });
    S.forEach((s, i) => { s.s = i ? S[i - 1].s + Math.hypot(s.x - S[i - 1].x, s.z - S[i - 1].z) : 0; s.raw = Math.max(hAt(s.x, s.z), floor); });
    // smooth: gaussian along the road
    const sig = win / 4, reach = Math.ceil(2.5 * sig / G.step) + 1;
    S.forEach((s, i) => {
      if (!sig) { s.h = s.raw; return; }
      let sw = 0, sh = 0;
      for (let k = Math.max(0, i - reach); k <= Math.min(S.length - 1, i + reach); k++) {
        const d = S[k].s - s.s, w = Math.exp(-(d * d) / (2 * sig * sig));
        sw += w; sh += w * S[k].raw;
      }
      s.h = sh / sw;
    });
    // pins: where this road runs onto a graded (more important) road, take its height; spread the
    // correction along this road, fading out over the smoothing length beyond the last pin
    const pins = [];
    S.forEach((s, i) => { const o = surfaceAt(s.x, s.z); if (o) pins.push({ i, d: o.h - s.h }); });
    if (pins.length) {
      pinned++;
      const fade = Math.max(win, 12);
      for (let i = 0, p = 0; i < S.length; i++) {
        while (p < pins.length - 1 && pins[p + 1].i <= i) p++;
        const A = pins[p], B = pins[p + 1];
        let d;
        if (i <= pins[0].i) d = pins[0].d * Math.max(0, 1 - (S[pins[0].i].s - S[i].s) / fade);
        else if (!B) d = A.d * Math.max(0, 1 - (S[i].s - S[A.i].s) / fade);
        else { const t = (S[i].s - S[A.i].s) / Math.max(1e-6, S[B.i].s - S[A.i].s); d = A.d + (B.d - A.d) * t; }
        S[i].h += d;
      }
    }
    // hill or town, stretch by stretch (a coastal road may climb onto the hill at one end only)
    if (r.k !== 'steps') limitGrade(S, i => (S[i].raw > G.hill && S[i - 1].raw > G.hill ? G.maxGrade.hill : G.maxGrade.town));
    for (const s of S) {
      s.h = Math.max(s.h, floor);
      s.hw = hw; s.rank = G.rank.indexOf(r.k);
      const k = key(s.x, s.z);
      (hash.get(k) || hash.set(k, []).get(k)).push(s);
      all.push(s);
    }
  }

  // pull the grid toward the profiles: full weight under the road and its shoulders, then ease out
  const W = new Float32Array(nx * nz), T = new Float32Array(nx * nz), D = new Float32Array(nx * nz).fill(Infinity);
  for (const s of all) {
    const flat = G.flat, R = s.hw + flat + G.blend;
    const i0 = Math.max(0, Math.floor((s.x - R - x0) / step)), i1 = Math.min(nx - 1, Math.ceil((s.x + R - x0) / step));
    const j0 = Math.max(0, Math.floor((s.z - R - z0) / step)), j1 = Math.min(nz - 1, Math.ceil((s.z + R - z0) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const n = j * nx + i, d = Math.hypot(x0 + i * step - s.x, z0 + j * step - s.z) - s.hw;   // metres past the road edge
      if (d > flat + G.blend) continue;
      if (orig[n] < sea && d > G.wetReach) continue;                                      // don't push the shoreline out
      const w = d <= flat ? 1 : 1 - smoothstep((d - flat) / G.blend);
      if (w > W[n] + 1e-4 || (w >= W[n] - 1e-4 && d < D[n])) { W[n] = w; T[n] = s.h; D[n] = d; }
    }
  }
  let moved = 0, raised = 0;
  for (let n = 0; n < h.length; n++) {
    if (!W[n]) continue;
    const v = orig[n] + (T[n] - orig[n]) * W[n];
    if (Math.abs(v - orig[n]) > 0.05) moved++;
    if (orig[n] < sea && v >= sea) raised++;
    h[n] = v;
  }
  return { roads: roads.length, samples: all.length, pinned, moved, raised };
}
