// Laem Thaen (แหลมแท่น): the rocky point at the north end of the beach, a landscaped
// seaside park. Lawns (terrain.js PARKS) with coconut palms along the footpaths and big
// shade trees, benches, lamps and bougainvillea; a paved plaza on the tip (steps up from
// the park, a tiled compass, lawn, flags, planters, lamps) behind a curved white seawall;
// the lattice lookout pier out over the sea; lumpy granite boulders at the waterline; a
// name stone at the entrance. Plaza and pier are walkable decks. Tip from OSM (LAEM).
import * as THREE from 'three';
import { rng, walkLine, inPoly } from './layout.js';
import { PARKS } from './terrain.js';
import { t } from '../shared/i18n.js';

export const LAEM = {
  tip: [-1356, -758], seaward: [-0.97, 0.23],     // coastline tip + direction out to sea
  park: PARKS[0],                                  // lawn instead of sand (terrain.js)
  plaza: { back: 8, r: 18, top: 1.7, steps: 4 },   // centre `back` m inland of the tip; surface height
  pier: { module: 9, walk: 2.2, rows: [[0], [-0.5, 0.5], [-1, 0, 1], [-0.5, 0.5], [0]], bar: 5 },
  boulders: { along: 120, every: 2.2, per: 2, size: [0.5, 2.1], out: [0.5, 6] },   // along the shore; metres into the water
  paths: ['footway', 'pedestrian', 'path', 'steps', 'service'],
  palmsEvery: 8, benchEvery: 26, lampEvery: 17,
  shade: { step: 11, chance: 0.4, mix: [['rainTree', 0.6], ['frangipani', 0.4]], clearRoad: 3.5, clearSea: 12 },
  colors: {
    paving: '#d3cbbb', paving2: '#c2b8a6', inlay: '#a89a82', wall: '#ecebe4', step: '#bdb4a3', lawn: '#6f9a4a', deck: '#b99a72', rail: '#f2f0ea', post: '#8a7a64',
    rock: ['#b9ab96', '#a8977f', '#c4b8a4', '#9c8c76'], bloom: ['#d8488a', '#e86aa0', '#c43a78', '#f08ab8'], leaf: '#4f7a3a', lamp: '#4a5058', bench: '#cfc8b8',
  },
};

// lumpy rounded boulder: an icosphere pushed in and out by a noise of the vertex position
// (same position → same push, so the shared corners of the faces stay closed)
function boulderGeometry(r, seed) {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
  const n = (x, y, z) => Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.7) * Math.sin(z * 3.3 + seed * 0.7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + n(x, y, z) * 0.18 + Math.sin(x * 7 + z * 5 + seed) * 0.04;
    p.setXYZ(i, x * k, y * k * (y < 0 ? 0.6 : 1), z * k);
  }
  g.computeVertexNormals();
  return g;
}

function nameStoneTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#b8aa92'; g.fillRect(0, 0, 512, 192);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 80},${80 + Math.random() * 70},${60 + Math.random() * 60},0.25)`; g.fillRect(Math.random() * 512, Math.random() * 192, 2 + Math.random() * 4, 2 + Math.random() * 3); }
  g.textAlign = 'center'; g.fillStyle = '#5a2e1c';
  g.font = '700 92px Kanit, sans-serif'; g.fillText(t('laemThaenStone'), 256, 118);
  g.font = '600 30px Kanit, sans-serif'; g.fillText(t('laemThaenStoneSub'), 256, 166);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLaemThaen(kit, map, layout, scene) {
  const L = LAEM, r = rng(606), col = h => new THREE.Color(h), c = L.colors;
  const [tx, tz] = L.tip, [sx, sz] = L.seaward;
  const ry = Math.atan2(sx, sz);                                      // frame: +w = seaward
  const decks = [], solids = [], trees = { palm: [], rainTree: [], frangipani: [] };
  const park = L.park;
  layout.occ.mark(park.x, park.z, park.r, park.r);                    // the park replaces umbrellas and palm rows

  // ---- plaza on the tip ----
  const P = L.plaza, cx = tx - sx * P.back, cz = tz - sz * P.back, top = map.sea + P.top;
  const f = kit.frame(cx, 0, cz, ry);
  kit.add('wall', new THREE.CylinderGeometry(P.r, P.r + 0.6, top + 1, 48), new THREE.Matrix4().setPosition(cx, (top - 1) / 2, cz), (x, y) => col(y > top - 0.05 ? c.paving : c.wall));
  // tiles: rings, radial lines and a compass star in the middle
  for (let k = 0; k < 5; k++) kit.add('wall', new THREE.RingGeometry(4 + k * 3, 4.3 + k * 3, 48).rotateX(-Math.PI / 2), new THREE.Matrix4().setPosition(cx, top + 0.012, cz), col(c.paving2));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; f.box('wall', Math.sin(a) * 10.5, top + 0.012, Math.cos(a) * 10.5, 0.25, 0.02, 13, col(c.paving2), a); }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, len = k % 2 ? 2.2 : 3.6, v = [];
    const tipP = f.P(Math.sin(a) * len, top + 0.02, Math.cos(a) * len), l = f.P(Math.sin(a + 0.35) * 0.9, top + 0.02, Math.cos(a + 0.35) * 0.9), rr = f.P(Math.sin(a - 0.35) * 0.9, top + 0.02, Math.cos(a - 0.35) * 0.9);
    v.push(tipP.x, tipP.y, tipP.z, rr.x, rr.y, rr.z, l.x, l.y, l.z);
    kit.tris3('wall', v, col(k % 2 ? c.paving2 : c.inlay), { x: cx, z: cz });
  }
  // steps up from the park around the land side
  const ground = map.heightAt(cx - sx * (P.r + 3), cz - sz * (P.r + 3));
  for (let k = 0; k < P.steps; k++) {                                 // k = 0 is the outermost, lowest step
    const rad = P.r + 0.6 + (P.steps - k) * 0.75, h = ground + ((k + 1) * (top - ground)) / (P.steps + 1);
    const g = new THREE.CylinderGeometry(rad, rad, Math.max(0.2, h + 1), 48, 1, false, Math.PI / 2, Math.PI);
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(ry).setPosition(cx, (h - 1) / 2, cz), col(k % 2 ? c.step : c.paving));
  }
  f.box('wall', 0, top + 0.05, -3, 11, 0.1, 6, col(c.lawn));        // the lawn
  f.box('wall', 0, top + 0.1, -3, 11.4, 0.14, 0.3, col(c.wall));
  for (let i = 0; i < 7; i++) {                                      // flag poles along the lawn's back
    const u = -4.5 + i * 1.5;
    f.rod('metal', [u, top, -6.6], [u, top + 7, -6.6], 0.05, col('#e8e8e4'));
    f.box('wall', u + 0.55, top + 6.4, -6.6, 1.1, 0.7, 0.02, col(i % 2 ? '#2f4a8a' : '#d8443a'));
  }
  // curved white seawall around the seaward half; bougainvillea planters and lamps on the rim
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI, u = Math.sin(a) * P.r, w = Math.cos(a) * P.r;
    if (Math.abs(u) > 1.8) f.box('wall', u, top + 0.45, w, (Math.PI * P.r) / N + 0.1, 0.9, 0.45, col(c.wall), -a);   // gap onto the pier
  }
  const bloom = (x, y, z, s = 1) => {                                // a round white planter with a pink bougainvillea
    kit.add('wall', new THREE.CylinderGeometry(0.75 * s, 0.6 * s, 0.6 * s, 12), new THREE.Matrix4().setPosition(x, y + 0.3 * s, z), col(c.wall));
    for (let k = 0; k < 5; k++) kit.add('wall', new THREE.IcosahedronGeometry(0.42 * s, 0), new THREE.Matrix4().setPosition(x + (r() - 0.5) * 0.7 * s, y + (0.75 + r() * 0.35) * s, z + (r() - 0.5) * 0.7 * s), col(k < 2 ? c.leaf : r.pick(c.bloom)));
  };
  const lamp = (x, y, z) => {
    kit.rod('wall', new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 3.4, z), 0.06, col(c.lamp));
    kit.add('wall', new THREE.SphereGeometry(0.22, 10, 8), new THREE.Matrix4().setPosition(x, y + 3.55, z), col('#f4f0e2'));
    solids.push({ x, z, r: 0.15, top: y + 3.6 });
  };
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26, p = f.P(Math.sin(a) * (P.r - 1.6), top, Math.cos(a) * (P.r - 1.6));
    if (Math.abs(Math.sin(a) * P.r) < 3 && Math.cos(a) > 0) continue;   // keep the way onto the pier clear
    i % 2 ? lamp(p.x, top, p.z) : bloom(p.x, top, p.z);
  }
  for (const u of [-5, 5]) { const p = f.P(u, top, 6); trees.frangipani.push({ x: p.x, z: p.z, y: top - 0.1, rot: r() * 6, s: 1.1 }); bloom(p.x, top, p.z, 1.3); }
  // walkable: a plus shape that stays inside the round plaza
  decks.push({ x: cx, z: cz, w: P.r * 1.95, d: P.r, ry, top: top + 0.01 }, { x: cx, z: cz, w: P.r, d: P.r * 1.95, ry, top: top + 0.01 }, { x: cx, z: cz, w: P.r * 1.4, d: P.r * 1.4, ry, top: top + 0.01 });

  // ---- lattice pier (square frames of walkway on posts) ----
  const M = L.pier.module, W = L.pier.walk, deckTop = top;
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
    const p = f.P(mu, 0, mw);
    decks.push({ x: p.x, z: p.z, w: W, d: len, ry: rot + ry, top: deckTop });
  };
  const w0 = P.r - 1;                                                // pier starts at the seawall
  L.pier.rows.forEach((row, ri) => {
    const wc = w0 + M * (ri + 0.5), h = M / 2;
    for (const k of row) {                                           // a square frame: four walkways around open water
      const u = k * M;
      bar(u - h, wc - h, u + h, wc - h); bar(u - h, wc + h, u + h, wc + h);
      bar(u - h, wc - h, u - h, wc + h); bar(u + h, wc - h, u + h, wc + h);
    }
  });
  const wEnd = w0 + M * L.pier.rows.length + 2, half = (L.pier.bar * M) / 2;
  bar(0, wEnd - 2, 0, wEnd);                                         // from the last frame to the far bar
  bar(-half, wEnd, half, wEnd);
  for (const s of [-1, 1]) {                                         // two platforms with tiered seats
    const u = s * half;
    f.box('wall', u, deckTop - 0.15, wEnd + 2.5, 8, 0.3, 6, col(c.deck));
    for (let k = 0; k < 3; k++) f.box('wall', u, deckTop + 0.2 + k * 0.4, wEnd + 4.6 - k * 0.7, 7.6, 0.4, 0.7, col(k % 2 ? '#a88a64' : c.deck));
    for (const du of [-3.8, 3.8]) for (const dw of [0, 5]) f.box('wall', u + du, deckTop - 2.2, wEnd + dw, 0.3, 4.2, 0.3, col(c.post));
    const p = f.P(u, 0, wEnd + 2.5);
    decks.push({ x: p.x, z: p.z, w: 8, d: 6, ry, top: deckTop });
  }

  // ---- lumpy granite boulders at the waterline around the tip ----
  const B = L.boulders, geos = [0, 1, 2, 3, 4].map(k => boulderGeometry(1, k * 1.9 + 0.4));
  for (const coast of map.coast) walkLine(coast.p, B.every, (x, z, dx, dz) => {
    if (Math.hypot(x - tx, z - tz) > B.along) return;
    const ox = -dz, oz = dx;                                         // OSM coastlines keep land on the left: this is seaward
    const n = Math.floor(r() * B.per) + 1;
    for (let i = 0; i < n; i++) {
      const s = THREE.MathUtils.lerp(...B.size, r() ** 1.7), out = THREE.MathUtils.lerp(...B.out, r());
      const bx = x + ox * out + dx * (r() - 0.5) * 2, bz = z + oz * out + dz * (r() - 0.5) * 2;
      if (Math.hypot(bx - cx, bz - cz) < P.r + 1.5) continue;           // not under the plaza
      const y = Math.max(map.heightAt(bx, bz), map.sea - 1.2);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(bx, y + s * 0.2, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s * (1 + r() * 0.5), s * (0.7 + r() * 0.4), s * (1 + r() * 0.4)));
      kit.add('wall', r.pick(geos), m, col(r.pick(c.rock)));
      solids.push({ x: bx, z: bz, r: s * 0.9, top: y + s });
    }
  });

  // ---- the park: palms along the paths, benches, lamps, shade trees on the lawns ----
  const inPark = (x, z) => Math.hypot(x - park.x, z - park.z) < park.r - 4;
  const inBuilding = (x, z) => map.buildings.some(b => inPoly(x, z, b.p));
  const clearOf = (x, z, d) => [...trees.palm, ...trees.rainTree, ...trees.frangipani].every(q => Math.hypot(q.x - x, q.z - z) > d);
  const onPlaza = (x, z, pad) => Math.hypot(x - cx, z - cz) < P.r + P.steps * 0.75 + pad;
  const ok = (x, z, pad = 1.5) => inPark(x, z) && !onPlaza(x, z, pad) && !inBuilding(x, z) && layout.seaDist(x, z) > 6;
  for (const road of map.roads) {
    if (!L.paths.includes(road.k) || !road.p.some(([x, z]) => inPark(x, z))) continue;
    let side = 1, benchIn = L.benchEvery * 0.5, lampIn = L.lampEvery * 0.5;
    walkLine(road.p, L.palmsEvery / 2, (x, z, dx, dz) => {
      const nx = -dz, nz = dx;
      side = -side;
      const px = x + nx * side * 2.4, pz = z + nz * side * 2.4;
      if (side > 0 && ok(px, pz) && layout.roadIdx.clearance(px, pz, 6) > 0.8 && clearOf(px, pz, 4)) trees.palm.push({ x: px, z: pz, y: map.heightAt(px, pz) - 0.15, rot: r() * 6, s: 0.9 + r() * 0.35 });
      benchIn -= L.palmsEvery / 2; lampIn -= L.palmsEvery / 2;
      const bx = x - nx * side * 2.2, bz = z - nz * side * 2.2;
      if (benchIn <= 0 && ok(bx, bz) && layout.roadIdx.clearance(bx, bz, 6) > 0.6) {
        benchIn = L.benchEvery;
        const by = map.heightAt(bx, bz), fb = kit.frame(bx, by, bz, Math.atan2(nx * side, nz * side));
        for (const u of [-0.7, 0.7]) fb.box('wall', u, 0.22, 0, 0.14, 0.44, 0.42, col(c.bench));
        fb.box('wall', 0, 0.46, 0, 1.8, 0.08, 0.46, col(c.bench));
        fb.box('wall', 0, 0.8, -0.24, 1.8, 0.3, 0.06, col(c.bench));
      } else if (lampIn <= 0 && ok(bx, bz) && layout.roadIdx.clearance(bx, bz, 6) > 0.4) {
        lampIn = L.lampEvery;
        lamp(bx, map.heightAt(bx, bz), bz);
        if (r() < 0.5) bloom(bx + nx * 1.1, map.heightAt(bx, bz), bz + nz * 1.1, 0.8);
      }
    });
  }
  const S = L.shade, total = S.mix.reduce((a, [, w]) => a + w, 0);
  for (let x = park.x - park.r; x < park.x + park.r; x += S.step) for (let z = park.z - park.r; z < park.z + park.r; z += S.step) {
    const px = x + (r() - 0.5) * S.step, pz = z + (r() - 0.5) * S.step;
    if (r() > S.chance || !ok(px, pz, 4) || layout.seaDist(px, pz) < S.clearSea || layout.roadIdx.clearance(px, pz, 8) < S.clearRoad || !clearOf(px, pz, 6)) continue;
    let k = r() * total, sp = S.mix[0][0];
    for (const [name, w] of S.mix) { k -= w; if (k <= 0) { sp = name; break; } }
    trees[sp].push({ x: px, z: pz, y: map.heightAt(px, pz) - 0.2, rot: r() * 6, s: 0.8 + r() * 0.4 });
  }

  // ---- the name stone at the park entrance (land side of the plaza) ----
  {
    const w = -(P.r + P.steps * 0.75 + 4.5), p = f.P(-6, 0, w), y = map.heightAt(p.x, p.z);
    const g = new THREE.DodecahedronGeometry(1, 1).scale(2.6, 1.3, 1.1);
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(ry).setPosition(p.x, y + 0.9, p.z), col('#b8aa92'));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.28), new THREE.MeshLambertMaterial({ map: nameStoneTexture() }));
    const fp = f.P(-6, 0, w - 0.98);
    face.position.set(fp.x, y + 1.05, fp.z);
    face.rotation.y = ry + Math.PI;                                  // readable from the park (landward)
    scene?.add(face);
    solids.push({ x: p.x, z: p.z, r: 2.2, top: y + 2.2 });
    bloom(f.P(-9.3, 0, w).x, y, f.P(-9.3, 0, w).z, 1.1);
    bloom(f.P(-2.7, 0, w).x, y, f.P(-2.7, 0, w).z, 1.1);
  }
  return { decks, solids, trees, plaza: { x: cx, z: cz, top } };
}
