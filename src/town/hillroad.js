// The roads up and round Khao Sam Muk (ถนนรอบเขาสามมุข and the lanes over the hill), furnished the
// way Thai hill roads are: a plain concrete kerb on the drop side, red-and-white painted kerbs only
// through the bends where a driver must slow down, a white steel guardrail wherever the ground falls
// away, lamp posts, and macaques sitting on the kerb. Markings, gutters and retaining walls are in
// hillmarks.js, signs and mirrors in hillsigns.js; all three read the same samples (hillgeom.js).
import * as THREE from 'three';
import { rng } from './layout.js';
import { ROAD_LIFT } from './roads.js';
import { sittingMonkeys } from './khaosammuk.js';
import { HILL, outside, sideIndex } from './hillgeom.js';

export const HILL_ROAD = {
  kerb: { len: 1, w: 0.26, h: 0.18, plain: '#b9b3a6', colors: ['#d23a30', '#f4f2ec'], bend: 0.16 },   // bend: radians over the look-ahead span that earn the red-white paint
  rail: { every: 2, off: 0.7, h: [0.45, 0.72], r: 0.06, post: 0.05, color: '#e8e8e4', postColor: '#9aa3a8' },
  lamps: { every: 38, h: 6.5, arm: 1.3, color: '#8d9aa3', head: '#f4f0e2' },
  monkeys: { every: 55, chance: 0.5 },
};

/** roads: hillSamples(); returns { solids, counts }. */
export function buildHillRoads(kit, map, layout, roads) {
  const K = HILL_ROAD.kerb, R = HILL_ROAD.rail, L = HILL_ROAD.lamps, MK = HILL_ROAD.monkeys, r = rng(5150), { roadIdx, occ } = layout, solids = [], sit = sittingMonkeys(kit);
  const kerbCols = K.colors.map(c => new THREE.Color(c)), plain = new THREE.Color(K.plain), railCol = new THREE.Color(R.color), postCol = new THREE.Color(R.postColor);
  const lampCol = new THREE.Color(L.color), headCol = new THREE.Color(L.head);
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  const counts = { kerbs: 0, redWhite: 0, rails: 0, lamps: 0, monkeys: 0 };

  for (const { road, hw, s: S } of roads) {
    let rail = [null, null], sinceLamp = L.every * 0.5, sinceMonkey = MK.every * r();
    for (let i = 0; i < S.length; i++) {
      const p = S[i];
      if (!p.hill) { rail = [null, null]; continue; }
      const bend = Math.abs(p.turn) > K.bend, out = outside(p);
      for (const side of [-1, 1]) {
        const k = sideIndex(side), kx = p.x + p.nx * side * (hw + K.w / 2), kz = p.z + p.nz * side * (hw + K.w / 2);
        const junction = roadIdx.onOtherRoad(kx, kz, road, 0.3);
        // ---- kerb: drop side always, bend outside red-white, nothing on the bank side (a gutter is there) ----
        if (!junction && !p.cut[k] && (p.fall[k] || (bend && side === out))) {
          const red = bend && (side === out || p.fall[k]);
          kit.box('wall', kx, ground(kx, kz) + ROAD_LIFT + K.h / 2 - 0.05, kz, K.w, K.h, K.len * 0.98, Math.atan2(p.dx, p.dz), red ? kerbCols[i % 2] : plain);
          counts.kerbs++; if (red) counts.redWhite++;
        }
        // ---- guardrail on the drop side: posts every 2 m, two rails between ----
        const px = p.x + p.nx * side * (hw + R.off), pz = p.z + p.nz * side * (hw + R.off);
        if (i % R.every === 0) {
          if (!p.fall[k] || roadIdx.clearance(px, pz, 8) < 0.3 || occ.test(px, pz, 0.3, 0.3)) { rail[k] = null; }
          else {
            const y = Math.max(p.y, ground(px, pz));
            kit.rod('metal', new THREE.Vector3(px, y - 0.3, pz), new THREE.Vector3(px, y + R.h[1] + 0.05, pz), R.post, postCol);
            solids.push({ x: px, z: pz, r: 0.25, top: y + R.h[1] });
            const prev = rail[k];
            if (prev) {
              for (const h of R.h) kit.rod('metal', new THREE.Vector3(prev.x, prev.y + h, prev.z), new THREE.Vector3(px, y + h, pz), R.r, railCol);
              solids.push({ x: (prev.x + px) / 2, z: (prev.z + pz) / 2, r: 0.25, top: y + R.h[1] });   // no slipping between posts
              counts.rails++;
            }
            rail[k] = { x: px, y, z: pz };
          }
        }
      }
      // ---- lamp posts, alternating sides, arm out over the road ----
      sinceLamp++;
      if (sinceLamp >= L.every) {
        const side = counts.lamps % 2 ? 1 : -1, k = sideIndex(side), px = p.x + p.nx * side * (hw + 0.8), pz = p.z + p.nz * side * (hw + 0.8);
        if (!p.cut[k] && roadIdx.clearance(px, pz, 8) > 0.3 && !occ.test(px, pz, 0.4, 0.4)) {
          const y = ground(px, pz), top = new THREE.Vector3(px, y + L.h, pz), end = new THREE.Vector3(px - p.nx * side * L.arm, y + L.h + 0.3, pz - p.nz * side * L.arm);
          kit.rod('metal', new THREE.Vector3(px, y, pz), top, 0.07, lampCol);
          kit.rod('metal', top, end, 0.04, lampCol);
          kit.box('wall', end.x, end.y - 0.08, end.z, 0.3, 0.12, 0.6, Math.atan2(p.nx * side, p.nz * side), headCol);
          solids.push({ x: px, z: pz, r: 0.15, top: y + L.h });
          occ.mark(px, pz, 0.5, 0.5);
          counts.lamps++; sinceLamp = 0;
        }
      }
      // ---- macaques sitting on the drop-side kerb, looking across the road or down the hill ----
      sinceMonkey += 1;
      if (sinceMonkey >= MK.every && r() < MK.chance) {
        sinceMonkey = 0;
        const side = p.fall[0] ? -1 : p.fall[1] ? 1 : (r() < 0.5 ? 1 : -1), k = sideIndex(side), px = p.x + p.nx * side * (hw + K.w / 2), pz = p.z + p.nz * side * (hw + K.w / 2);
        if (!p.cut[k] && !roadIdx.onOtherRoad(px, pz, road, 0.3)) {
          sit(r.pick, px, ground(px, pz) + ROAD_LIFT + K.h - 0.05, pz, Math.atan2(p.dx, p.dz) + (r() < 0.5 ? 1 : -1) * Math.PI / 2 + (r() - 0.5));
          counts.monkeys++;
        }
      }
    }
  }
  return { solids, counts };
}
