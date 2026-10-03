// Samples of the Khao Sam Muk hill roads, shared by hillroad.js (kerbs, guardrails, lamps),
// hillmarks.js (markings, gutters, retaining walls) and hillsigns.js (signs, mirrors). Each road
// is walked once every metre; every sample knows its heading, how sharply the road turns around
// it, which side the ground rises on (the cut bank) and which side falls away, and whether it is
// on the hill at all. Left-hand traffic (Thailand). Coordinates are x east, z south, so the normal
// (nx, nz) = (−dz, dx) points to the RIGHT of travel; side −1 is the driver's left.
import { walkLine } from './layout.js';
import { roadWidth } from './roads.js';

export const HILL = {
  box: { x0: -1100, x1: -100, z0: -2480, z1: -1250 },
  kinds: ['secondary', 'tertiary', 'residential', 'unclassified'],
  minHeight: 3,                          // scene units above the sea: the hill part of the road
  turn: { look: 6, bend: 0.2, sharp: 0.55 },   // metres each way; radians over that span: a bend / a hairpin
  bank: { probe: 3.5, cut: 1.0, fall: 1.2 },   // metres beside the road edge; height difference that makes a cut bank / a drop
  step: 1,
};
const inBox = (x, z, b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;

/** [{ road, hw, s: [sample …] }] — sample: { x, z, y, dx, dz, nx, nz (right normal), turn (rad, + = turning left),
 *  hill, cut: [left, right], fall: [left, right], bankH: [left, right] } — index 0 = driver's left (side −1), 1 = right (side +1). */
export function hillSamples(map, roadIdx = null) {
  const H = HILL, out = [], ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  for (const road of map.roads) {
    if (!H.kinds.includes(road.k) || !road.p.some(([x, z]) => inBox(x, z, H.box))) continue;
    const hw = roadWidth(road) / 2, s = [];
    walkLine(road.p, H.step, (x, z, dx, dz) => s.push({ x, z, y: ground(x, z), dx, dz, nx: -dz, nz: dx, turn: 0, hill: false, cut: [false, false], fall: [false, false], bankH: [0, 0] }), H.step / 2);
    const K = Math.round(H.turn.look / H.step);
    s.forEach((p, i) => {
      p.hill = inBox(p.x, p.z, H.box) && map.heightAt(p.x, p.z) - map.sea > H.minHeight;
      if (!p.hill) return;
      const a = s[Math.max(0, i - K)], b = s[Math.min(s.length - 1, i + K)];
      const h1 = Math.atan2(p.dx, p.dz) - Math.atan2(a.dx, a.dz), h2 = Math.atan2(b.dx, b.dz) - Math.atan2(p.dx, p.dz);
      p.turn = Math.atan2(Math.sin(h2 + h1), Math.cos(h2 + h1));                       // total heading change across the span
      [-1, 1].forEach((side, k) => {                                                  // k 0: left of travel (side −1), 1: right
        const ex = p.x + p.nx * side * (hw + 0.4), ez = p.z + p.nz * side * (hw + 0.4), fx = ex + p.nx * side * H.bank.probe, fz = ez + p.nz * side * H.bank.probe;
        const rise = map.heightAt(fx, fz) - map.heightAt(ex, ez);
        p.bankH[k] = rise; p.cut[k] = rise > H.bank.cut; p.fall[k] = rise < -H.bank.fall;
      });
    });
    out.push({ road, hw, s });
  }
  return out;
}

/** The side (multiplier of the right normal) on the outside of a bend: a left turn (turn > 0) has its outside on the right. */
export const outside = p => (p.turn > 0 ? 1 : -1);
export const sideIndex = side => (side < 0 ? 0 : 1);
export { inBox };
