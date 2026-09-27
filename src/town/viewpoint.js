// จุดชมวิวเขาสามมุข — the Khao Sam Muk viewpoint, as in Street View (13.30950, 100.90484): a level
// terrace built out from the hill road over the south-west slope, grey paving with lighter zigzag
// borders, a weathered concrete balustrade (lathe-turned balusters between square posts), a
// metal-roofed shelter at the north-west end, coin binocular viewers, and macaques sitting on the
// rail. The terrace is a walkable deck; the view side is kept clear of trees.
import * as THREE from 'three';
import { rng } from './layout.js';
import { roadWidth, ROAD_LIFT } from './roads.js';
import { sittingMonkeys } from './khaosammuk.js';

export const VIEWPOINT = {
  at: [-559, -1603],                  // Street View spot (local metres)
  size: { along: 24, deep: 15 },      // terrace: along the road × out over the slope (m)
  gap: 0.6,                           // from the road edge to the terrace
  entrance: 6,                        // opening in the road-side balustrade
  clearView: 14,                      // metres beyond the rail kept free of trees
  rail: { h: 1.0, baluster: 0.25, post: 2.4, inset: 0.2 },
  shelter: { along: 6.5, deep: 7.5, h: 2.7, pitch: 1.1 },
  binoculars: 2, monkeys: 5,
  colors: {
    wall: '#8f8a82', pave: '#9b968e', pave2: '#a39e95', zig: '#c7c2b7', rail: '#dad6cc', rail2: '#cfcabe',
    post: '#d2cdc2', roof: '#8d9aa3', rib: '#a7b1b8', beam: '#7d7870', bench: '#b9b3a8',
    scope: '#2f6fb8', scopeHead: '#f0c23a', scopeGlass: '#2a2a2a',
  },
};

const col = h => new THREE.Color(h);

/** Returns { decks, solids, place: {x, z, yaw}, clear: {x, z, r} } — builds into the kit. */
export function buildViewpoint(kit, map, layout) {
  const V = VIEWPOINT, c = V.colors, r = rng(1603), { roadIdx, occ } = layout, sit = sittingMonkeys(kit);
  // the road beside the Street View spot, and which side falls away (the view)
  let best = null;
  for (const road of map.roads) for (let k = 1; k < road.p.length; k++) {
    const [ax, az] = road.p[k - 1], [bx, bz] = road.p[k], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    const t = Math.max(0, Math.min(1, ((V.at[0] - ax) * dx + (V.at[1] - az) * dz) / (L * L)));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - V.at[0], pz - V.at[1]);
    if (roadWidth(road.k) && (!best || d < best.d)) best = { d, px, pz, dx: dx / L, dz: dz / L, hw: roadWidth(road.k) / 2 };
  }
  if (!best || best.d > 20) return { decks: [], solids: [] };
  const side = [1, -1].map(s => ({ s, h: map.heightAt(best.px - best.dz * s * 15, best.pz + best.dx * s * 15) })).sort((a, b) => a.h - b.h)[0].s;
  const ox = -best.dz * side, oz = best.dx * side;                   // out over the slope
  const ry = Math.atan2(ox, oz), off = best.hw + V.gap;
  const f = kit.frame(best.px + ox * off, 0, best.pz + oz * off, ry);   // u along the road, w out toward the view
  const A = V.size.along / 2, Dp = V.size.deep;
  const roadTop = map.heightAt(best.px, best.pz) + ROAD_LIFT;
  let lowest = Infinity, highest = -Infinity;
  for (let u = -A; u <= A; u += 2) for (let w = 0; w <= Dp; w += 2) { const q = f.P(u, 0, w), h = map.heightAt(q.x, q.z); lowest = Math.min(lowest, h); highest = Math.max(highest, h); }
  const Y = Math.max(roadTop + 0.12, highest + 0.08);                 // level, never under the ground
  const decks = [], solids = [];

  // ---- the terrace: a slab whose sides are the retaining walls, paved on top ----
  const base = Math.max(map.sea, lowest) - 0.5;
  f.box('wall', 0, (Y + base) / 2, Dp / 2, V.size.along, Y - base, Dp, col(c.wall));
  for (let u = -A + 1; u < A; u += 2) for (let w = 1; w < Dp; w += 2) f.box('wall', u, Y + 0.005, w, 1.96, 0.012, 1.96, col(r() < 0.5 ? c.pave : c.pave2));
  // lighter stepped zigzag borders inside the rail (the pattern in the photo)
  const zig = (u0, w0, du, dw, n, horiz) => {
    let u = u0, w = w0;
    for (let i = 0; i < n; i++) {
      const [su, sw] = horiz ? [du, 0] : [0, dw], [tu, tw] = horiz ? [0, dw * (i % 2 ? -1 : 1)] : [du * (i % 2 ? -1 : 1), 0];
      f.box('wall', u + su / 2, Y + 0.02, w + sw / 2, Math.abs(su) + 0.22, 0.02, Math.abs(sw) + 0.22, col(c.zig));
      u += su; w += sw;
      f.box('wall', u + tu / 2, Y + 0.02, w + tw / 2, Math.abs(tu) + 0.22, 0.02, Math.abs(tw) + 0.22, col(c.zig));
      u += tu; w += tw;
    }
  };
  zig(-A + 1.4, Dp - 1.6, 1.0, 0.6, Math.floor((V.size.along - 2.8) / 1.0), true);                  // along the far rail
  zig(-A + 1.4, 1.4, 0.6, 1.0, Math.floor((Dp - 3) / 1.0), false);                                 // down one side
  zig(A - 1.4, 1.4, -0.6, 1.0, Math.floor((Dp - 3) / 1.0), false);                                 // …and the other
  decks.push({ ...xz(f.P(0, 0, Dp / 2)), w: V.size.along, d: Dp, ry, top: Y });

  // ---- balustrade: plinth, lathe balusters, square posts with caps, top rail ----
  const baluster = new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.07, 0.05], [0.05, 0.1], [0.09, 0.26], [0.1, 0.34], [0.06, 0.46], [0.045, 0.52], [0.075, 0.57], [0.075, 0.62], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)), 8);
  const R = V.rail, runs = [
    { a: [-A + R.inset, Dp - R.inset], b: [A - R.inset, Dp - R.inset] },               // far side, over the view
    { a: [-A + R.inset, R.inset], b: [-A + R.inset, Dp - R.inset] },                   // ends
    { a: [A - R.inset, R.inset], b: [A - R.inset, Dp - R.inset] },
    { a: [-A + R.inset, R.inset], b: [-V.entrance / 2, R.inset] },                     // road side, with the entrance
    { a: [V.entrance / 2, R.inset], b: [A - R.inset, R.inset] },
  ];
  for (const { a, b } of runs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), du = (b[0] - a[0]) / L, dw = (b[1] - a[1]) / L, rot = Math.atan2(du, dw);
    const at = t => [a[0] + du * t, a[1] + dw * t];
    const mid = at(L / 2);
    f.box('wall', mid[0], Y + 0.09, mid[1], 0.3, 0.18, L, col(c.rail2), rot);                    // plinth
    f.box('wall', mid[0], Y + R.h - 0.07, mid[1], 0.3, 0.14, L + 0.2, col(c.rail), rot);         // top rail
    const posts = Math.max(1, Math.round(L / R.post));
    for (let i = 0; i <= posts; i++) {
      const [pu, pw] = at(L * i / posts);
      f.box('wall', pu, Y + (R.h + 0.1) / 2, pw, 0.36, R.h + 0.1, 0.36, col(c.post));
      f.box('wall', pu, Y + R.h + 0.1, pw, 0.44, 0.08, 0.44, col(c.rail));
    }
    for (let t = 0.3; t < L - 0.2; t += R.baluster) {
      if (Array.from({ length: posts + 1 }, (_, i) => L * i / posts).some(pt => Math.abs(pt - t) < 0.3)) continue;
      const [pu, pw] = at(t), p = f.P(pu, Y + 0.18, pw);
      kit.add('wall', baluster, new THREE.Matrix4().setPosition(p), col(r() < 0.3 ? c.rail2 : c.rail));
    }
    for (let t = 0; t <= L; t += 0.4) { const [pu, pw] = at(t), q = f.P(pu, 0, pw); solids.push({ x: q.x, z: q.z, r: 0.22, top: Y + R.h }); }
  }

  // ---- shelter at the north-west end: concrete posts, gable metal roof, benches ----
  const S = V.shelter, west = [1, -1].map(s => ({ s, v: f.P(s * A, 0, Dp / 2) })).sort((p, q) => (p.v.x + p.v.z) - (q.v.x + q.v.z))[0].s;
  const su = west * (A - S.along / 2 - 0.5), sw = Dp / 2, roofY = Y + S.h;
  for (const du of [-1, 1]) for (const dw of [-1, 0, 1]) {
    const pu = su + du * (S.along / 2 - 0.2), pw = sw + dw * (S.deep / 2 - 0.2);
    f.box('wall', pu, Y + S.h / 2, pw, 0.28, S.h, 0.28, col(c.post));
    const q = f.P(pu, 0, pw); solids.push({ x: q.x, z: q.z, r: 0.2, top: roofY });
  }
  for (const du of [-1, 1]) f.box('wall', su + du * (S.along / 2 - 0.2), roofY - 0.1, sw, 0.22, 0.22, S.deep + 0.3, col(c.beam));
  const half = S.along / 2 + 0.5, slope = Math.hypot(half, S.pitch), tilt = Math.atan2(S.pitch, half);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(slope, 0.06, S.deep + 1.0).rotateZ(-s * tilt);   // the metal sheet leaning down to each side
    kit.add('metal', g, new THREE.Matrix4().makeRotationY(ry).setPosition(f.P(su + s * half / 2, roofY + S.pitch / 2, sw)), col(c.roof));
    for (let w = -S.deep / 2; w <= S.deep / 2 + 0.01; w += 0.45) {                     // standing seams
      const a = f.P(su, roofY + S.pitch + 0.04, sw + w), b = f.P(su + s * half, roofY + 0.04, sw + w);
      kit.rod('metal', a, b, 0.018, col(c.rib));
    }
  }
  for (const dw of [-1, 1]) f.tris2('wall', [su - half, roofY, sw + dw * (S.deep / 2), su + half, roofY, sw + dw * (S.deep / 2), su, roofY + S.pitch, sw + dw * (S.deep / 2)], col(c.post));   // gable ends
  for (const du of [-1, 1]) f.box('wall', su + du * (S.along / 2 - 0.9), Y + 0.23, sw, 0.5, 0.46, S.deep - 1.2, col(c.bench));

  // ---- coin binocular viewers at the far rail ----
  for (let i = 0; i < V.binoculars; i++) {
    const pu = (i - (V.binoculars - 1) / 2) * 5 - west * 2, pw = Dp - 1.0, p = f.P(pu, Y, pw);
    kit.rod('wall', p, p.clone().setY(Y + 1.05), 0.06, col(c.scope));
    f.box('wall', pu, Y + 1.15, pw, 0.34, 0.26, 0.4, col(c.scope));
    for (const e of [-0.09, 0.09]) f.rod('wall', [pu + e, Y + 1.2, pw - 0.05], [pu + e, Y + 1.2, pw + 0.3], 0.055, col(c.scopeHead));
    for (const e of [-0.09, 0.09]) f.box('wall', pu + e, Y + 1.2, pw - 0.07, 0.07, 0.07, 0.02, col(c.scopeGlass));
    solids.push({ x: p.x, z: p.z, r: 0.25, top: Y + 1.3 });
  }

  // ---- macaques on the top rail ----
  for (let i = 0; i < V.monkeys; i++) {
    const run = runs[i % 3], t = 0.15 + r() * 0.7, pu = run.a[0] + (run.b[0] - run.a[0]) * t, pw = run.a[1] + (run.b[1] - run.a[1]) * t;
    const p = f.P(pu, Y + R.h, pw);
    sit(r.pick, p.x, p.y, p.z, ry + (r() < 0.6 ? Math.PI : 0) + (r() - 0.5));
  }

  // keep the terrace and the view in front of it free of trees and crags
  const clear = f.P(0, 0, Dp / 2 + V.clearView / 2);
  occ.mark(clear.x, clear.z, A + 1, (Dp + V.clearView) / 2, ry);
  const stand = f.P(0, 0, Dp - 2.5);
  return { decks, solids, place: { x: stand.x, z: stand.z, yaw: ry }, clear: { x: clear.x, z: clear.z, r: Math.hypot(A, (Dp + V.clearView) / 2) } };
}

const xz = p => ({ x: p.x, z: p.z });
