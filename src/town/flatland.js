// Bang Saen is flat: the real beach and town sit a metre or two above the sea, and only Khao Sam
// Muk is a hill. The elevation data (a radar DEM) also "sees" buildings and tree crowns, which
// turned into mounds up to 12 m high along the beach. Before anything is built, land near the
// sea is pressed down to a gentle shore profile, keeping a little of its unevenness; the hill is
// left alone and the change fades out inland and toward the hill.
import { seaDistance } from './terrain.js';

export const FLAT = {
  hill: { x0: -1100, x1: -100, z0: -2480, z1: -1250, blend: 160 },   // Khao Sam Muk: untouched, eased in over `blend` m
  full: 700, fade: 1600,                // metres from the sea: flattened fully / not at all
  base: 0.5, rise: 2.0, over: 30,       // profile above the sea (scene units): base + rise·(1 − e^(−d/over))
  keep: 0.15, bump: [-0.3, 0.5],        // share of the original relief kept, and its limits
};
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** Flatten map.heights in place. Call right after loading the map, before the roads are graded. */
export function flattenLowland(map) {
  const F = FLAT, { x0, z0, step, nx, nz } = map.core, h = map.heights, sea = map.sea, dist = seaDistance(map), H = F.hill;
  let moved = 0, highest = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (h[k] < sea) continue;                                         // the sea bed stays
    const x = x0 + i * step, z = z0 + j * step, d = dist[k];
    const out = Math.max(H.x0 - x, x - H.x1, H.z0 - z, z - H.z1);      // metres outside the hill box (≤ 0 inside)
    const w = (1 - smooth((d - F.full) / (F.fade - F.full))) * smooth(out / H.blend);
    if (w <= 0) continue;
    const target = sea + F.base + F.rise * (1 - Math.exp(-d / F.over));
    const flat = target + Math.max(F.bump[0], Math.min(F.bump[1], (h[k] - target) * F.keep));
    const v = h[k] + (flat - h[k]) * w;
    if (Math.abs(v - h[k]) > 0.25) moved++;
    highest = Math.max(highest, h[k] - v);
    h[k] = v;
  }
  return { moved, highest: +highest.toFixed(1) };
}
