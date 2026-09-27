// Tree placement + instancing. Rules are data: each species has a band of distance
// from the sea, a density (trees per 100 m²), preferred land-use areas and spacing.
import * as THREE from 'three';
import { rng, inPoly } from './layout.js';
import { SPECIES } from './assets/trees.js';
import { cardMaterial, frondMaterial } from '../world/foliage.js';
import { getMaterial } from '../world/materials.js';

// sea: [min, max] metres from the waterline; dens: per 100 m²; areas: land-use bonus
const RULES = [
  { sp: 'rainTree', sea: [60, 999], dens: 0.06, areas: { park: 1.2, grassland: 0.5, wood: 1.5, residential: 0.4 }, clear: 3.5, space: 6 },
  { sp: 'casuarina', sea: [38, 70], dens: 0.08, areas: {}, clear: 1.4, space: 4.5 },    // the beach front is coconut palms (beach.js plants the band)
  { sp: 'casuarina', sea: [30, 999], dens: 0.05, areas: { wood: 1.2 }, clear: 1.4, space: 2.4 },
  { sp: 'palm', sea: [36, 60], dens: 0.3, areas: { beach: 0.2 }, clear: 1.2, space: 3 },   // behind the band; open sand stays open
  { sp: 'palm', sea: [48, 999], dens: 0.05, areas: { residential: 0.2, park: 0.3 }, clear: 1.2, space: 2.2 },
  { sp: 'frangipani', sea: [32, 999], dens: 0.06, areas: { park: 0.4, residential: 0.3 }, clear: 1.0, space: 1.6 },
];
const HILL = { height: 14, bonus: { rainTree: 0.5, casuarina: 0.25 } };   // forest on Khao Sam Muk
const VARIANTS = 2;
const LOD = { near: 150, rebuild: 15 };   // metres
const TINT = { palm: 0.06, casuarina: 0.05, rainTree: 0.07, frangipani: 0.05 };

/** extra: { species: [{ x, y, z, rot, s }] } planted by other modules (promenade, beach rows). */
export function buildNature(map, ctx, extra = {}) {
  const { occ, roadIdx, seaDist, strip } = ctx;
  const r = rng(1234);
  const { x0, z0, step, nx, nz } = map.core;
  const cellArea = step * step;
  const areaAt = (x, z) => { for (const a of map.areas) if (inPoly(x, z, a.p)) return a.k; return null; };
  const placed = Object.fromEntries(Object.keys(SPECIES).map(k => [k, []]));

  for (const [sp, list] of Object.entries(extra)) for (const t of list) {
    placed[sp].push({ ...t, v: Math.floor(r() * VARIANTS) });
    occ.mark(t.x, t.z, 1.2, 1.2);
  }
  for (const rule of RULES) {
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const cx = x0 + (i + 0.5) * step, cz = z0 + (j + 0.5) * step;
      const sd = seaDist(cx, cz);
      if (sd < rule.sea[0] - step || sd > rule.sea[1] + step || strip(cx, cz) > step) continue;
      const area = map.areas.length ? areaAt(cx, cz) : null;
      let dens = rule.dens + (rule.areas[area] || 0);
      if (map.heightAt(cx, cz) > HILL.height) dens += HILL.bonus[rule.sp] || 0;
      let expect = dens * cellArea / 100;
      while (expect > 0) {
        if (r() >= Math.min(1, expect)) break;
        expect -= 1;
        const x = cx + (r() - 0.5) * step, z = cz + (r() - 0.5) * step, d = seaDist(x, z);
        if (d < rule.sea[0] || d > rule.sea[1] || strip(x, z) > 0) continue;
        if (roadIdx.clearance(x, z, 8) < rule.clear) continue;
        if (occ.test(x, z, rule.space / 2, rule.space / 2)) continue;
        occ.mark(x, z, rule.space / 2, rule.space / 2);
        placed[rule.sp].push({ x, z, y: map.heightAt(x, z) - 0.15, rot: r() * Math.PI * 2, s: 0.85 + r() * 0.3, v: Math.floor(r() * VARIANTS) });
      }
    }
  }

  const group = new THREE.Group(), cards = cardMaterial(), fronds = frondMaterial(), bark = getMaterial('wood');
  const m = new THREE.Matrix4(), shear = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const counts = {}, sets = [];
  for (const [sp, list] of Object.entries(placed)) {
    counts[sp] = list.length;
    for (let v = 0; v < VARIANTS; v++) {
      const inst = list.filter(t => t.v === v);
      if (!inst.length) continue;
      // per-instance matrices and tints, computed once
      const mats = new Float32Array(inst.length * 16), cols = new Float32Array(inst.length * 3);
      const tr = rng(v + 99), tt = TINT[sp] * 2;
      inst.forEach((t, k) => {
        m.compose(new THREE.Vector3(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), new THREE.Vector3(t.s, t.s, t.s));
        if (t.shear) m.multiply(shear.makeShear(0, 0, t.shear, 0, 0, 0));     // extra lean toward local +x (x += k·y)
        m.toArray(mats, k * 16);
        c.setRGB(1 - tr() * tt, 1 - tr() * tt * 0.5, 1 - tr() * tt).toArray(cols, k * 3);   // tint multipliers ≤ 1
      });
      const tpl = SPECIES[sp](rng(sp.length * 100 + v));
      const make = (geo, mat, depth, near) => {
        if (!geo) return null;
        const mesh = new THREE.InstancedMesh(geo, mat, inst.length);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(inst.length * 3), 3);
        mesh.castShadow = near;                       // far trees are outside the shadow box anyway
        mesh.receiveShadow = true;
        if (depth) mesh.customDepthMaterial = depth;
        mesh.count = 0;
        mesh.name = `${sp}-${v}-${near ? 'near' : 'far'}`;
        group.add(mesh);
        return mesh;
      };
      sets.push({
        inst, mats, cols,
        near: [make(tpl.trunk, bark, null, true), make(tpl.cards, cards.material, cards.depth, true), make(tpl.fronds, fronds.material, fronds.depth, true)].filter(Boolean),
        far: [make(tpl.trunkLo, bark, null, false), make(tpl.cardsLo, cards.material, cards.depth, false), make(tpl.frondsLo, fronds.material, fronds.depth, false)].filter(Boolean),
      });
    }
  }

  // LOD: re-sort instances into near/far meshes when the camera has moved enough
  const last = new THREE.Vector3(Infinity, 0, 0);
  function update(camPos) {
    if (last.distanceToSquared(camPos) < LOD.rebuild ** 2) return;
    last.copy(camPos);
    const r2 = LOD.near ** 2;
    for (const set of sets) {
      let n = 0, f = 0;
      set.inst.forEach((t, k) => {
        const isNear = (t.x - camPos.x) ** 2 + (t.z - camPos.z) ** 2 < r2;
        const meshes = isNear ? set.near : set.far, slot = isNear ? n++ : f++;
        for (const mesh of meshes) {
          mesh.instanceMatrix.array.set(set.mats.subarray(k * 16, k * 16 + 16), slot * 16);
          mesh.instanceColor.array.set(set.cols.subarray(k * 3, k * 3 + 3), slot * 3);
        }
      });
      for (const [meshes, count] of [[set.near, n], [set.far, f]]) for (const mesh of meshes) {
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.visible = count > 0;
      }
    }
  }

  return { group, counts, placed, update };
}
