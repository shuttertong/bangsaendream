// Laem Thaen (แหลมแท่น): the rocky point at the north end of the beach. A paved plaza
// on the tip with a lawn and flag poles behind a curved white seawall, big rounded granite
// boulders along the water, and the lattice lookout pier — square frames of walkway
// stepping out over the sea to two platforms with tiered seats. The pier and plaza are
// walkable decks. Positions from the OSM coastline (tip) — see LAEM.
import * as THREE from 'three';
import { rng, walkLine } from './layout.js';

export const LAEM = {
  tip: [-1356, -758], seaward: [-0.97, 0.23],     // coastline tip + direction out to sea
  clear: 70,                                       // no umbrellas / palm rows within this of the tip
  plaza: { back: 8, r: 18, top: 1.7 },             // centre `back` m inland of the tip; surface height
  pier: { module: 9, walk: 2.2, rows: [[0], [-0.5, 0.5], [-1, 0, 1], [-0.5, 0.5], [0]], bar: 5 },
  boulders: { along: 120, every: 2.5, per: 2, size: [0.9, 3.6], out: [-1, 4] },   // along the shore; metres into the water
  colors: { paving: '#d3cbbb', paving2: '#c7bfae', wall: '#ecebe4', lawn: '#6f9a4a', deck: '#b99a72', rail: '#f2f0ea', post: '#8a7a64', rock: ['#b9ab96', '#a8977f', '#c4b8a4', '#9c8c76'] },
};

export function buildLaemThaen(kit, map, layout) {
  const L = LAEM, r = rng(606), col = h => new THREE.Color(h);
  const [tx, tz] = L.tip, [sx, sz] = L.seaward, ax = -sz, az = sx;   // along the shore
  const ry = Math.atan2(sx, sz);                                      // frame: +w = seaward
  const decks = [], solids = [];
  layout.occ.mark(tx, tz, L.clear, L.clear);

  // ---- plaza on the tip ----
  const P = L.plaza, cx = tx - sx * P.back, cz = tz - sz * P.back, top = map.sea + P.top;
  const f = kit.frame(cx, 0, cz, ry);
  kit.add('wall', new THREE.CylinderGeometry(P.r, P.r + 0.6, top + 1, 40), new THREE.Matrix4().setPosition(cx, (top - 1) / 2, cz), (x, y) => col(y > top - 0.05 ? L.colors.paving : L.colors.wall));
  for (let k = 0; k < 6; k++) {                                      // paving rings
    const g = new THREE.RingGeometry(3 + k * 3.4, 3.3 + k * 3.4, 40).rotateX(-Math.PI / 2);
    kit.add('wall', g, new THREE.Matrix4().setPosition(cx, top + 0.012, cz), col(L.colors.paving2));
  }
  f.box('wall', 0, top + 0.05, -2, 11, 0.1, 6, col(L.colors.lawn));  // the lawn
  f.box('wall', 0, top + 0.1, -2, 11.4, 0.14, 0.3, col(L.colors.wall));
  for (let i = 0; i < 7; i++) {                                      // flag poles along the lawn's back
    const u = -4.5 + i * 1.5;
    f.rod('metal', [u, top, -5.6], [u, top + 7, -5.6], 0.05, col('#e8e8e4'));
    f.box('wall', u + 0.55, top + 6.4, -5.6, 1.1, 0.7, 0.02, col(i % 2 ? '#2f4a8a' : '#d8443a'));
  }
  // curved white seawall with planters around the seaward half
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI, u = Math.sin(a) * P.r, w = Math.cos(a) * P.r;
    if (Math.abs(u) > 1.8) f.box('wall', u, top + 0.45, w, (Math.PI * P.r) / N + 0.1, 0.9, 0.45, col(L.colors.wall), -a);   // gap onto the pier
    if (i % 6 === 3) f.box('wall', u * 0.9, top + 0.35, w * 0.9, 1.6, 0.7, 1.0, col('#5f8a44'), -a);
  }
  // walkable: a plus shape that stays inside the round plaza
  decks.push({ x: cx, z: cz, w: P.r * 1.95, d: P.r, ry, top: top + 0.01 }, { x: cx, z: cz, w: P.r, d: P.r * 1.95, ry, top: top + 0.01 }, { x: cx, z: cz, w: P.r * 1.4, d: P.r * 1.4, ry, top: top + 0.01 });

  // ---- lattice pier (square frames of walkway on posts) ----
  const M = L.pier.module, W = L.pier.walk, deckTop = top, c = L.colors;
  const bar = (u0, w0, u1, w1) => {                                   // one walkway between two points (plaza frame coords)
    const mu = (u0 + u1) / 2, mw = (w0 + w1) / 2, len = Math.hypot(u1 - u0, w1 - w0) + W, rot = Math.atan2(u1 - u0, w1 - w0);
    f.box('wall', mu, deckTop - 0.15, mw, W, 0.3, len, col(c.deck), rot);
    for (const s of [-1, 1]) {                                       // railings on both sides
      const ou = Math.cos(rot) * s * (W / 2 - 0.05), ow = -Math.sin(rot) * s * (W / 2 - 0.05);
      f.box('wall', mu + ou, deckTop + 0.95, mw + ow, 0.08, 0.08, len, col(c.rail), rot);
      f.box('wall', mu + ou, deckTop + 0.5, mw + ow, 0.05, 0.05, len, col(c.rail), rot);
    }
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {                                   // posts into the sea
      const k = i / n, pu = u0 + (u1 - u0) * k, pw = w0 + (w1 - w0) * k;
      f.box('wall', pu, deckTop - 2.2, pw, 0.3, 4.2, 0.3, col(c.post));
    }
    const p = f.P(mu, 0, mw), dir = rot + ry;
    decks.push({ x: p.x, z: p.z, w: W, d: len, ry: dir, top: deckTop });
  };
  const w0 = P.r - 1;                                                // pier starts at the seawall
  L.pier.rows.forEach((row, ri) => {
    const wc = w0 + M * (ri + 0.5);
    for (const k of row) {
      const u = k * M, h = M / 2;
      // a square frame: four walkways around open water
      bar(u - h, wc - h, u + h, wc - h); bar(u - h, wc + h, u + h, wc + h);
      bar(u - h, wc - h, u - h, wc + h); bar(u + h, wc - h, u + h, wc + h);
    }
  });
  // the far bar with two platforms and tiered seats
  const wEnd = w0 + M * L.pier.rows.length + 2, half = (L.pier.bar * M) / 2;
  bar(0, wEnd - 2, 0, wEnd);                                         // from the last frame to the far bar
  bar(-half, wEnd, half, wEnd);
  for (const s of [-1, 1]) {
    const u = s * half;
    f.box('wall', u, deckTop - 0.15, wEnd + 2.5, 8, 0.3, 6, col(c.deck));
    for (let k = 0; k < 3; k++) f.box('wall', u, deckTop + 0.2 + k * 0.4, wEnd + 4.6 - k * 0.7, 7.6, 0.4, 0.7, col(k % 2 ? '#a88a64' : c.deck));
    for (const du of [-3.8, 3.8]) for (const dw of [0, 5]) f.box('wall', u + du, deckTop - 2.2, wEnd + dw, 0.3, 4.2, 0.3, col(c.post));
    const p = f.P(u, 0, wEnd + 2.5);
    decks.push({ x: p.x, z: p.z, w: 8, d: 6, ry, top: deckTop });
  }

  // ---- rounded granite boulders along the water around the tip ----
  const B = L.boulders;
  for (const coast of map.coast) walkLine(coast.p, B.every, (x, z, dx, dz) => {
    if (Math.hypot(x - tx, z - tz) > B.along) return;
    const n = Math.floor(r() * B.per) + 1, ox = -dz, oz = dx;          // land is left of the coast: sea is (−dz, dx)… flipped below if needed
    const sgn = layout.seaDist(x + ox * 3, z + oz * 3) < layout.seaDist(x - ox * 3, z - oz * 3) ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const s = THREE.MathUtils.lerp(...B.size, r() ** 1.5), out = THREE.MathUtils.lerp(...B.out, r());
      const bx = x + ox * sgn * out + dx * (r() - 0.5) * 2, bz = z + oz * sgn * out + dz * (r() - 0.5) * 2;
      if (Math.hypot(bx - cx, bz - cz) < P.r + 1.5) continue;           // not on the plaza
      const g = new THREE.SphereGeometry(1, 12, 8).scale(s * (1 + r() * 0.4), s * (0.6 + r() * 0.3), s * (1 + r() * 0.3));
      const y = Math.max(map.heightAt(bx, bz), map.sea - 1) + s * 0.25;
      kit.add('wall', g, new THREE.Matrix4().makeRotationY(r() * 6).setPosition(bx, y, bz), col(r.pick(c.rock)));
      solids.push({ x: bx, z: bz, r: s * 0.9, top: y + s * 0.6 });
    }
  });
  return { decks, solids, plaza: { x: cx, z: cz, top } };
}
