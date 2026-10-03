// Khao Sam Muk (เขาสามมุข): the granite hill at the north end. Forest over the whole hill
// (it's the backdrop from everywhere, so beyond the walkable strip too), pale rock
// outcrops where terrain.js paints bare granite, a seawall with white railings and the
// steel "tree" shade canopies along the coast road around the hill, macaques by the
// viewpoint, and the mussel-farm poles in Ang Sila bay.
import * as THREE from 'three';
import { rng, walkLine } from './layout.js';
import { rockMask, ROCKY_SHORE } from './terrain.js';
import { roadWidth } from './roads.js';
import { monkeyGeometry } from '../monkey/models.js';
import { MONKEYS } from '../monkey/species.js';
import { getMaterial } from '../world/materials.js';
import { VILLAGE } from './fishingvillage.js';

export const KSM = {
  box: ROCKY_SHORE[0],                                        // the hill and its shore (terrain.js keeps it rocky)
  forest: { step: 7, from: 6, roadGap: 7, dens: 0.55, mix: [['rainTree', 0.55], ['casuarina', 0.3], ['frangipani', 0.15]] },
  outcrop: { step: 13, mask: 0.6, size: [3.5, 9], tall: [0.9, 1.8], per: [1, 3], sink: 0.35, colors: ['#c7b99c', '#b8a88c', '#d2c5aa', '#a89a80'] },   // angular granite crags
  seawall: { roads: ['secondary', 'tertiary', 'residential', 'unclassified'], sea: 14, every: 3, walk: 3, drop: 3.2, canopyEvery: 21, canopyFrom: 0.35 },
  monkeys: { near: [-652, -1942], count: 16, spread: 16 },
  lookout: { at: [-652, -1942], r: 20, paving: '#cfc6b4', shrine: { red: '#b8322a', gold: '#d8ac48', roof: '#c9542e' } },
  poles: { area: { x0: -430, x1: -120, z0: -2470, z1: -2180 }, depth: [0.3, 12], above: 1.2, patches: 14, rows: [4, 7], cols: [10, 22], gap: 1.6 },
  colors: { wall: '#d9d4c8', walk: '#c9c2b2', rail: '#f4f2ec', canopy: '#4a5058', pole: '#9a8a6a' },
};

const inBox = (x, z, b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;

/** Returns { trees: { species: [...] }, solids } for nature.js and the collision grid; the rest goes into the kit. */
export function buildKhaoSamMuk(kit, scene, map, layout) {
  const K = KSM, r = rng(3113), col = h => new THREE.Color(h), { occ, roadIdx, seaDist } = layout;
  const solids = [], trees = { rainTree: [], casuarina: [], frangipani: [] };
  (layout.noBeach ||= []).push(K.box);                               // seawall shore: no umbrellas or palm rows

  // ---- the shrine clearing: paving, a railing and a small red shrine (the viewpoint terrace is viewpoint.js) ----
  const LK = K.lookout, [lx, lz] = LK.at;
  occ.mark(lx, lz, LK.r, LK.r);
  const disk = new THREE.RingGeometry(0.01, LK.r, 40, 10).rotateX(-Math.PI / 2).translate(lx, 0, lz), dp = disk.attributes.position;
  for (let i = 0; i < dp.count; i++) dp.setY(i, map.heightAt(dp.getX(i), dp.getZ(i)) + 0.22);   // draped over the slope (fine rings so it follows the terrain)
  disk.computeVertexNormals();
  kit.add('wall', disk, new THREE.Matrix4(), col(LK.paving), { x: lx, z: lz });
  let dsx = 0, dsz = 0;                                              // downhill (toward the view)
  for (let a = 0; a < 6.28; a += 0.5) { const h = map.heightAt(lx + Math.cos(a) * 15, lz + Math.sin(a) * 15); dsx -= Math.cos(a) * h; dsz -= Math.sin(a) * h; }
  const view = Math.atan2(dsz, dsx);
  let prevPost = null;
  for (let a = view - 1.1; a <= view + 1.1; a += 0.14) {             // railing along the downhill edge
    const x = lx + Math.cos(a) * (LK.r - 0.6), z = lz + Math.sin(a) * (LK.r - 0.6), y = map.heightAt(x, z) + 0.12;
    const post = new THREE.Vector3(x, y + 1.05, z);
    kit.rod('wall', post.clone().setY(y), post, 0.04, col(K.colors.rail));
    if (prevPost) kit.rod('wall', prevPost, post, 0.035, col(K.colors.rail));
    prevPost = post;
  }
  { // shrine on the uphill side
    const a = view + Math.PI, x = lx + Math.cos(a) * (LK.r - 5), z = lz + Math.sin(a) * (LK.r - 5), y = map.heightAt(x, z) + 0.1, sh = LK.shrine;
    const f = kit.frame(x, y, z, Math.atan2(-Math.cos(a), -Math.sin(a)));
    f.box('wall', 0, 0.3, 0, 4.2, 0.6, 3.4, col('#d8d0c0'));
    for (const u of [-1.7, 1.7]) for (const w of [-1.3, 1.3]) f.box('wall', u, 1.7, w, 0.28, 2.2, 0.28, col(sh.red));
    f.box('wall', 0, 1.3, -1.3, 3.2, 1.8, 0.15, col(sh.red));
    f.box('wall', 0, 2.9, 0, 4.8, 0.22, 4.0, col(sh.gold));
    kit.add('wall', new THREE.ConeGeometry(3.4, 1.4, 4).rotateY(Math.PI / 4).scale(1, 1, 0.8), new THREE.Matrix4().makeRotationY(Math.atan2(-Math.cos(a), -Math.sin(a))).setPosition(f.P(0, 3.7, 0)), col(sh.roof));
    f.box('wall', 0, 0.9, 0.2, 1.2, 0.6, 0.6, col(sh.gold));        // altar
    solids.push({ x, z, r: 2.4, top: y + 4 });
  }

  // ---- seawall, railings and shade canopies along the coast road round the hill ----
  const S = K.seawall;
  for (const road of map.roads) {
    if (!S.roads.includes(road.k) || road.p.length < 2 || !road.p.some(([x, z]) => inBox(x, z, K.box))) continue;
    const hw = roadWidth(road.k) / 2;
    let run = 0, prevRail = null;
    walkLine(road.p, S.every, (x, z, dx, dz) => {
      if (!inBox(x, z, K.box) || inBox(x, z, VILLAGE.shore)) { prevRail = null; return; }   // the village has houses, not a seawall
      let nx = -dz, nz = dx;                                         // toward the sea side
      if (seaDist(x + nx * 6, z + nz * 6) > seaDist(x - nx * 6, z - nz * 6)) { nx = -nx; nz = -nz; }
      if (seaDist(x + nx * (hw + S.walk), z + nz * (hw + S.walk)) > S.sea) { prevRail = null; run = 0; return; }
      const y = Math.max(map.heightAt(x, z), map.sea) + 0.1, ry = Math.atan2(dx, dz);        // level with the road
      const wx = x + nx * (hw + S.walk / 2 - 0.2), wz = z + nz * (hw + S.walk / 2 - 0.2);      // overlaps the road edge: no gap
      const f = kit.frame(wx, y, wz, ry);                             // local u = across (toward −sea?), w = along the road
      f.box('wall', 0, 0.05, 0, S.walk + 0.4, 0.25, S.every + 0.05, col(K.colors.walk));
      const ox = nx * (S.walk / 2 + 0.15), oz = nz * (S.walk / 2 + 0.15);
      kit.box('wall', wx + ox, y - S.drop / 2 + 0.2, wz + oz, 0.35, S.drop, S.every + 0.05, ry, col(K.colors.wall));   // wall face down to the water
      const rail = new THREE.Vector3(wx + ox, y + 1.05, wz + oz);
      kit.rod('wall', rail, rail.clone().setY(y + 0.2), 0.04, col(K.colors.rail));
      if (prevRail) { kit.rod('wall', prevRail, rail, 0.035, col(K.colors.rail)); kit.rod('wall', prevRail.clone().setY(prevRail.y - 0.45), rail.clone().setY(rail.y - 0.45), 0.025, col(K.colors.rail)); }
      prevRail = rail;
      layout.occ.mark(wx, wz, 1.6, 1.6);
      // steel "tree" canopies on the wider stretches (the new seaside walk)
      run += S.every;
      if (run >= S.canopyEvery && r() < 0.8 && seaDist(x, z) > 4) {
        run = 0;
        const c = new THREE.Vector3(wx - nx * 0.3, y + 0.2, wz - nz * 0.3);
        kit.rod('wall', c, c.clone().setY(y + 3.2), 0.09, col(K.colors.canopy));
        const disk = new THREE.CylinderGeometry(1.7, 0.4, 0.35, 8, 1);
        kit.add('wall', disk, new THREE.Matrix4().setPosition(c.x, y + 3.3, c.z), col(K.colors.canopy));
        for (let k = 0; k < 8; k++) {                                // radiating ribs
          const a = (k / 8) * Math.PI * 2;
          kit.rod('wall', c.clone().setY(y + 2.6), new THREE.Vector3(c.x + Math.cos(a) * 1.6, y + 3.35, c.z + Math.sin(a) * 1.6), 0.03, col(K.colors.canopy));
        }
        solids.push({ x: c.x, z: c.z, r: 0.2, top: y + 3.5 });
      }
    });
  }

  // ---- rock outcrops where the terrain shows bare granite ----
  const O = K.outcrop, b = K.box;
  for (let x = b.x0; x < b.x1; x += O.step) for (let z = b.z0; z < b.z1; z += O.step) {
    const px = x + (r() - 0.5) * O.step, pz = z + (r() - 0.5) * O.step, y = map.heightAt(px, pz);
    if (y < map.sea + 1 || rockMask(px, y, pz) < O.mask || roadIdx.clearance(px, pz, 8) < 5 || occ.test(px, pz, 3, 3)) continue;
    const n = Math.round(THREE.MathUtils.lerp(...O.per, r()));
    for (let i = 0; i < n; i++) {
      const s = THREE.MathUtils.lerp(...O.size, r() ** 1.6), bx = px + (r() - 0.5) * 6, bz = pz + (r() - 0.5) * 6, by = map.heightAt(bx, bz);
      const h = s * THREE.MathUtils.lerp(...O.tall, r());
      if (roadIdx.clearance(bx, bz, 12) < s * 0.8 + 1) continue;          // big boulders stay off the road edge
      const g = new THREE.DodecahedronGeometry(1, 0).scale(s * (0.6 + r() * 0.5), h, s * (0.5 + r() * 0.4));
      const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5));
      kit.add('wall', g, rot.setPosition(bx, by + h * (1 - O.sink) - h * 0.4, bz), col(r.pick(O.colors)));
      occ.mark(bx, bz, s * 0.8, s * 0.8);
      if (layout.strip(bx, bz) < 8) solids.push({ x: bx, z: bz, r: s * 0.8, top: by + s });
    }
  }

  // ---- forest over the whole hill (not on rock, roads or anything placed) ----
  const F = K.forest, total = F.mix.reduce((a, [, w]) => a + w, 0);
  for (let x = b.x0; x < b.x1; x += F.step) for (let z = b.z0; z < b.z1; z += F.step) {
    const px = x + (r() - 0.5) * F.step, pz = z + (r() - 0.5) * F.step, y = map.heightAt(px, pz);
    if (y < F.from || r() > F.dens * (1 - rockMask(px, y, pz))) continue;
    if (roadIdx.clearance(px, pz, 12) < F.roadGap || occ.test(px, pz, 2, 2)) continue;   // crowns stay clear of the road (seen from above)
    let k = r() * total, sp = F.mix[0][0];
    for (const [name, w] of F.mix) { k -= w; if (k <= 0) { sp = name; break; } }
    trees[sp].push({ x: px, z: pz, y: y - 0.2, rot: r() * 6.28, s: 0.8 + r() * 0.5 });
  }

  // ---- macaques by the viewpoint: sitting on the wall, the road, the rocks ----
  const Mk = K.monkeys, sit = sittingMonkeys(kit);
  for (let i = 0; i < Mk.count; i++) {
    const a = r() * Math.PI * 2, d = r() * Mk.spread, x = Mk.near[0] + Math.cos(a) * d, z = Mk.near[1] + Math.sin(a) * d;
    if (map.heightAt(x, z) < map.sea + 0.3) continue;
    sit(r.pick, x, map.heightAt(x, z) + 0.05, z, r() * 6.28);
  }

  // ---- mussel-farm poles in Ang Sila bay (one instanced draw) ----
  const PL = K.poles, spots = [];
  for (let p = 0; p < PL.patches * 4 && spots.length < PL.patches * 200; p++) {
    const cx = THREE.MathUtils.lerp(PL.area.x0, PL.area.x1, r()), cz = THREE.MathUtils.lerp(PL.area.z0, PL.area.z1, r());
    const depth = map.sea - map.heightAt(cx, cz);
    if (depth < PL.depth[0] || depth > PL.depth[1]) continue;
    const rows = Math.round(THREE.MathUtils.lerp(...PL.rows, r())), cols = Math.round(THREE.MathUtils.lerp(...PL.cols, r())), yaw = r() * 0.6 - 0.3;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const u = (j - cols / 2) * PL.gap, v = (i - rows / 2) * PL.gap * 1.6;
      spots.push([cx + u * Math.cos(yaw) + v * Math.sin(yaw), cz - u * Math.sin(yaw) + v * Math.cos(yaw)]);
    }
    if (spots.length > PL.patches * 120) break;
  }
  if (spots.length) {
    const pole = new THREE.CylinderGeometry(0.05, 0.07, 1, 5).translate(0, 0.5, 0).toNonIndexed();   // unit height: scaled from the seabed to above the water
    const pc = new THREE.Color(K.colors.pole), ca = new Float32Array(pole.attributes.position.count * 3);
    for (let i = 0; i < ca.length; i += 3) pc.toArray(ca, i);
    pole.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    const mesh = new THREE.InstancedMesh(pole, getMaterial('wood'), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z], i) => { const b = map.heightAt(x, z); mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, b, z), q.setFromAxisAngle(up, i), new THREE.Vector3(1, map.sea - b + PL.above * (0.8 + (i % 5) * 0.1), 1))); });
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  return { trees, solids, counts: { trees: Object.values(trees).reduce((a, l) => a + l.length, 0), poles: spots.length } };
}

/** A sitting macaque merged into the kit: sit(pick, x, y, z, ry). Idle pose as in the monkey game,
 *  merged with its own vertex colours, legs tucked under the body. */
export function sittingMonkeys(kit) {
  const geos = MONKEYS.slice(0, 3).map(m => { const g = monkeyGeometry(m); return { m, parts: [g.body, g.front.clone().rotateX(-0.9).translate(0, 0.3, 0.14), g.back.clone().rotateX(0.4).translate(0, 0.3, -0.14)] }; });
  const up = new THREE.Vector3(0, 1, 0);
  return (pick, x, y, z, ry) => {
    const { m, parts } = pick(geos), s = m.size * 1.3;
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(s, s, s));
    for (const g of parts) { const c = g.attributes.color; let v = 0; kit.add('wall', g, mat, () => new THREE.Color().fromBufferAttribute(c, v++)); }
  };
}
