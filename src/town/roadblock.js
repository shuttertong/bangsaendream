// Closed roads: a corridor listed in ROADBLOCK.closed (road 3137) is baked and dressed like any
// other (shophouses, trees, visible from the drone) but the kid may not walk in. Where the road
// leaves the walkable area a road-closed barrier stands across it: red-and-white water-filled
// plastic barriers, a steel grille fence behind them and a no-entry sign (no text).
import * as THREE from 'three';
import { roadWidth, SIDEWALK } from './roads.js';

export const ROADBLOCK = {
  closed: ['road3137'],
  kind: 'secondary',                 // road width used for the span
  inset: 2,                          // metres inside the walkable side
  dedupe: 8,                         // crossings closer than this share one barrier
  barrier: { len: 1.2, h: 0.9, base: 0.55, top: 0.3, colors: ['#d8443a', '#f4f2ec'] },
  fence: { back: 1.1, h: 2.0, post: 2.5, bar: 0.18, color: '#a9b1b6', postColor: '#7d868c' },
  sign: { h: 2.3, r: 0.45, red: '#c8322a', white: '#f4f2ec', pole: '#8d9aa3' },
};

/** walkable(x, z): the collision's area rule (strip + open corridors + walk zones). Returns { solids, count }. */
export function buildRoadblocks(kit, map, walkable) {
  const R = ROADBLOCK, solids = [], spots = [];
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  // crossings: where a closed corridor's centre line passes from walkable to not
  for (const c of map.corridors || []) {
    if (!R.closed.includes(c.n)) continue;
    let prev = null;
    for (let k = 1; k < c.p.length; k++) {
      const [ax, az] = c.p[k - 1], [bx, bz] = c.p[k], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let d = 0; d <= L; d += 1) {
        const x = ax + dx * d, z = az + dz * d, w = walkable(x, z);
        if (prev && prev.w !== w) {
          const inside = w ? [x, z] : [prev.x, prev.z], s = w ? -1 : 1;     // s: direction along the road from inside to outside
          const px = inside[0] - dx * s * R.inset, pz = inside[1] - dz * s * R.inset;
          if (!spots.some(q => Math.hypot(q.x - px, q.z - pz) < R.dedupe)) spots.push({ x: px, z: pz, ox: dx * s, oz: dz * s });
        }
        prev = { x, z, w };
      }
    }
  }
  const col = h => new THREE.Color(h), B = R.barrier, F = R.fence, S = R.sign;
  const half = roadWidth(R.kind) / 2 + SIDEWALK.w + 0.6;
  for (const p of spots) {
    const ry = Math.atan2(p.ox, p.oz), f = kit.frame(p.x, 0, p.z, ry);   // +w points out along the closed road; u across it
    const y = (u, w) => { const q = f.P(u, 0, w); return ground(q.x, q.z); };
    // a row of plastic barriers, alternating colours
    let i = 0;
    for (let u = -half + B.len / 2; u <= half - B.len / 2 + 0.01; u += B.len + 0.05, i++) {
      const g = y(u, 0), c = col(B.colors[i % 2]);
      f.box('wall', u, g + B.h * 0.3, 0, B.len, B.h * 0.6, B.base, c);
      f.box('wall', u, g + B.h * 0.8, 0, B.len * 0.96, B.h * 0.4, B.top, c);
      f.box('wall', u, g + B.h * 0.55, 0, B.len * 0.2, 0.08, B.base + 0.02, col('#3a3a3a'));   // interlocking joint
    }
    // steel grille fence behind: posts, top and bottom rails, vertical bars
    const post = col(F.postColor), bar = col(F.color);
    for (let u = -half; u <= half + 0.01; u += F.post) {
      const g = y(u, F.back);
      f.rod('metal', [u, g - 0.2, F.back], [u, g + F.h, F.back], 0.05, post);
    }
    for (const t of [0.15, F.h - 0.05]) {
      const a = f.P(-half, y(-half, F.back) + t, F.back), b = f.P(half, y(half, F.back) + t, F.back);
      kit.rod('metal', a, b, 0.03, post);
    }
    for (let u = -half; u <= half; u += F.bar) f.rod('metal', [u, y(u, F.back) + 0.15, F.back], [u, y(u, F.back) + F.h - 0.05, F.back], 0.012, bar);
    // no-entry sign in the middle, facing the walkable side
    const sg = y(0, 0.5);
    f.rod('metal', [0, sg, 0.5], [0, sg + S.h, 0.5], 0.04, col(S.pole));
    const disc = new THREE.CylinderGeometry(S.r, S.r, 0.04, 24).rotateX(Math.PI / 2);
    kit.add('wall', disc, new THREE.Matrix4().makeRotationY(ry).setPosition(f.P(0, sg + S.h, 0.45)), col(S.red));
    f.box('wall', 0, sg + S.h, 0.42, S.r * 1.3, S.r * 0.3, 0.02, col(S.white));
    // collision along the line
    for (let u = -half; u <= half; u += 0.4) { const q = f.P(u, 0, 0.5); solids.push({ x: q.x, z: q.z, r: 0.45, top: ground(q.x, q.z) + F.h }); }
  }
  return { solids, count: spots.length, spots };
}
