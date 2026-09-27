// The roads up and round Khao Sam Muk (ถนนรอบเขาสามมุข and the lanes over the hill), dressed
// like the real ones: red-and-white painted kerbs, a white steel guardrail wherever the ground
// falls away beside the road, lamp posts, and macaques sitting on the kerbs. Only the hill part
// (above HILL_ROAD.minHeight): the seawall road at the foot keeps khaosammuk.js's dressing.
import * as THREE from 'three';
import { rng, walkLine } from './layout.js';
import { roadWidth, ROAD_LIFT } from './roads.js';
import { sittingMonkeys } from './khaosammuk.js';

export const HILL_ROAD = {
  box: { x0: -1100, x1: -100, z0: -2480, z1: -1250 },
  kinds: ['secondary', 'tertiary', 'residential', 'unclassified'],
  minHeight: 3,                                               // metres above the sea
  kerb: { len: 1, w: 0.3, h: 0.2, colors: ['#d23a30', '#f4f2ec'] },
  rail: { step: 2, probe: 4, drop: 1.4, off: 0.7, h: [0.45, 0.72], r: 0.06, post: 0.05, color: '#e8e8e4', postColor: '#9aa3a8' },
  lamps: { every: 38, h: 6.5, arm: 1.3, color: '#8d9aa3', head: '#f4f0e2' },
  monkeys: { every: 23, chance: 0.4 },
};

const inBox = (x, z, b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;

/** Returns { solids } for the collision grid (guardrails, lamp posts). */
export function buildHillRoads(kit, map, layout) {
  const H = HILL_ROAD, r = rng(5150), { roadIdx } = layout, solids = [], sit = sittingMonkeys(kit);
  const kerbCols = H.kerb.colors.map(c => new THREE.Color(c)), railCol = new THREE.Color(H.rail.color), postCol = new THREE.Color(H.rail.postColor);
  const lampCol = new THREE.Color(H.lamps.color), headCol = new THREE.Color(H.lamps.head);
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  let kerbs = 0, rails = 0, lamps = 0, monkeys = 0;

  for (const road of map.roads) {
    if (!H.kinds.includes(road.k) || !road.p.some(([x, z]) => inBox(x, z, H.box))) continue;
    const hw = roadWidth(road.k) / 2;
    const onHill = (x, z) => inBox(x, z, H.box) && map.heightAt(x, z) - map.sea > H.minHeight;
    // kerbs: 1 m blocks alternating red / white, stopping at junctions
    let n = 0;
    walkLine(road.p, H.kerb.len, (x, z, dx, dz) => {
      n++;
      if (!onHill(x, z)) return;
      for (const s of [-1, 1]) {
        const px = x - dz * s * (hw + H.kerb.w / 2), pz = z + dx * s * (hw + H.kerb.w / 2);
        if (roadIdx.onOtherRoad(px, pz, road, 0.3)) continue;
        kit.box('wall', px, ground(px, pz) + ROAD_LIFT + H.kerb.h / 2 - 0.05, pz, H.kerb.w, H.kerb.h, H.kerb.len * 0.98, Math.atan2(dx, dz), kerbCols[n % 2]);
        kerbs++;
      }
    }, H.kerb.len / 2);
    // guardrails on whichever side drops away; posts every step, two rails between them
    for (const s of [-1, 1]) {
      let prev = null;
      walkLine(road.p, H.rail.step, (x, z, dx, dz) => {
        const nx = -dz * s, nz = dx * s, px = x + nx * (hw + H.rail.off), pz = z + nz * (hw + H.rail.off);
        const edge = ground(x + nx * hw, z + nz * hw), below = ground(x + nx * (hw + H.rail.probe), z + nz * (hw + H.rail.probe));
        if (!onHill(x, z) || edge - below < H.rail.drop || roadIdx.clearance(px, pz, 8) < 0.3) { prev = null; return; }
        const y = Math.max(edge, ground(px, pz));
        const post = [new THREE.Vector3(px, y - 0.3, pz), new THREE.Vector3(px, y + H.rail.h[1] + 0.05, pz)];
        kit.rod('metal', post[0], post[1], H.rail.post, postCol);
        solids.push({ x: px, z: pz, r: 0.25, top: y + H.rail.h[1] });
        if (prev) {
          for (const h of H.rail.h) kit.rod('metal', new THREE.Vector3(prev.x, prev.y + h, prev.z), new THREE.Vector3(px, y + h, pz), H.rail.r, railCol);
          solids.push({ x: (prev.x + px) / 2, z: (prev.z + pz) / 2, r: 0.25, top: y + H.rail.h[1] });   // no slipping between posts
          rails++;
        }
        prev = { x: px, y, z: pz };
      });
    }
    // lamp posts, alternating sides, arm out over the road
    let k = 0;
    walkLine(road.p, H.lamps.every, (x, z, dx, dz) => {
      if (!onHill(x, z)) return;
      const s = k++ % 2 ? 1 : -1, nx = -dz * s, nz = dx * s, px = x + nx * (hw + 0.8), pz = z + nz * (hw + 0.8);
      if (roadIdx.clearance(px, pz, 8) < 0.3 || layout.occ.test(px, pz, 0.4, 0.4)) return;
      const y = ground(px, pz), top = new THREE.Vector3(px, y + H.lamps.h, pz), end = new THREE.Vector3(px - nx * H.lamps.arm, y + H.lamps.h + 0.3, pz - nz * H.lamps.arm);
      kit.rod('metal', new THREE.Vector3(px, y, pz), top, 0.07, lampCol);
      kit.rod('metal', top, end, 0.04, lampCol);
      kit.box('wall', end.x, end.y - 0.08, end.z, 0.3, 0.12, 0.6, Math.atan2(nx, nz), headCol);
      solids.push({ x: px, z: pz, r: 0.15, top: y + H.lamps.h });
      layout.occ.mark(px, pz, 0.5, 0.5);
      lamps++;
    }, H.lamps.every / 2);
    // macaques sitting on the kerb, looking across the road or down the hill
    walkLine(road.p, H.monkeys.every, (x, z, dx, dz) => {
      if (!onHill(x, z) || r() > H.monkeys.chance) return;
      const s = r() < 0.5 ? 1 : -1, px = x - dz * s * (hw + H.kerb.w / 2), pz = z + dx * s * (hw + H.kerb.w / 2);
      if (roadIdx.onOtherRoad(px, pz, road, 0.3)) return;
      sit(r.pick, px, ground(px, pz) + ROAD_LIFT + H.kerb.h - 0.05, pz, Math.atan2(dx, dz) + (r() < 0.5 ? 1 : -1) * Math.PI / 2 + (r() - 0.5));
      monkeys++;
    }, r() * H.monkeys.every);
  }
  return { solids, counts: { kerbs, rails, lamps, monkeys } };
}
