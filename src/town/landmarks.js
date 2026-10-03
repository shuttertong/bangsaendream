// Landmarks placed from the map: the welcome sign on the roundabout at the south end of
// the beach (วงเวียนบางแสน, OSM junction=roundabout on the secondary road, way 154464422;
// centre checked against satellite imagery). Positions are local metres (§3).
import * as THREE from 'three';
import { welcomeRoundabout, SIGN } from './assets/landmark.js';
import { walkLine } from './layout.js';
import { roadWidth, ROAD_LIFT } from './roads.js';

// dressing around the roundabout (metres from the centre, radians)
const ROUND = { outer: 33, palmEvery: 9, lampEvery: 0.75, tower: 18, towerAt: 2.2, zebra: 9, pole: '#6a747c' };

export const LANDMARKS = {
  // circle fitted to the OSM ring ways 154464422 + 1320610147: centre + centreline radius
  welcome: { x: 615.9, z: 1236.5, ring: 22.4, road: 'secondary' },
};

/**
 * The bake keeps only roads inside the playable strip, which cuts the far side of the
 * ring off. Add the missing arc (as a map road) so the roundabout is whole again. Call
 * before the road index is built.
 */
export function completeRoundabout(map) {
  const L = LANDMARKS.welcome, near = [];
  for (const r of map.roads) for (const [x, z] of r.p) {
    if (Math.abs(Math.hypot(x - L.x, z - L.z) - L.ring) < 3) near.push(Math.atan2(z - L.z, x - L.x));
  }
  if (near.length < 2) return;
  near.sort((a, b) => a - b);
  let gap = 0, from = 0;                                   // largest angular gap between ring points
  near.forEach((a, i) => {
    const b = i + 1 < near.length ? near[i + 1] : near[0] + Math.PI * 2;
    if (b - a > gap) { gap = b - a; from = a; }
  });
  if (gap < 0.4) return;
  const p = [], n = Math.ceil(gap / 0.15);
  for (let i = 0; i <= n; i++) {
    const a = from + (gap * i) / n;
    p.push([L.x + Math.cos(a) * L.ring, L.z + Math.sin(a) * L.ring]);
  }
  map.roads.push({ k: L.road, p });
}

export function buildLandmarks(kit, scene, map, layout) {
  const { x, z } = LANDMARKS.welcome, sd = layout.seaDist;
  // the sign faces inland, toward people arriving from town
  const gx = sd(x + 5, z) - sd(x - 5, z), gz = sd(x, z + 5) - sd(x, z - 5);
  const ry = Math.atan2(gx, gz);
  const y = map.heightAt(x, z);
  const { face, solids, palms } = welcomeRoundabout(kit, map, { x, y, z, ry });
  scene.add(face);
  layout.occ.mark(x, z, SIGN.island, SIGN.island);           // nothing else grows or stands on the island
  dressRoundabout(kit, map, layout, palms, solids);
  return { solids, welcome: { x, z, ry }, trees: { palm: palms }, walkZones: [{ x, z, r: LANDMARKS.welcome.ring + 13 }] };
}

/** Around the ring: palms and street lamps on the outer pavement, a floodlight tower, zebra crossings. */
function dressRoundabout(kit, map, layout, palms, solids) {
  const L = LANDMARKS.welcome, D = ROUND, col = h => new THREE.Color(h), { roadIdx, seaDist, occ } = layout;
  const ok = (px, pz, clear) => roadIdx.clearance(px, pz, 8) > clear && seaDist(px, pz) > 3 && map.heightAt(px, pz) > map.sea + 0.3 && !occ.test(px, pz, 1, 1);
  for (let a = 0; a < Math.PI * 2; a += D.palmEvery / D.outer) {
    const px = L.x + Math.cos(a) * D.outer, pz = L.z + Math.sin(a) * D.outer;
    if (!ok(px, pz, 1.5)) continue;
    palms.push({ x: px, z: pz, y: map.heightAt(px, pz) - 0.1, rot: a * 3, s: 1.1 + ((a * 7) % 1) * 0.3 });
    occ.mark(px, pz, 1, 1);
  }
  for (let a = 0.2; a < Math.PI * 2; a += D.lampEvery) {                         // street lamps facing the ring
    const r = L.ring + 5 + 1.2, px = L.x + Math.cos(a) * r, pz = L.z + Math.sin(a) * r, y = map.heightAt(px, pz);
    if (!ok(px, pz, 0.4)) continue;
    const head = new THREE.Vector3(L.x + Math.cos(a) * (r - 1.2), y + 6, L.z + Math.sin(a) * (r - 1.2));
    kit.rod('wall', new THREE.Vector3(px, y, pz), new THREE.Vector3(px, y + 6.2, pz), 0.08, col(D.pole));
    kit.rod('wall', new THREE.Vector3(px, y + 6.1, pz), head, 0.05, col(D.pole));
    kit.box('wall', head.x, head.y - 0.1, head.z, 0.5, 0.15, 0.25, a, col('#f4f0e2'));
    solids.push({ x: px, z: pz, r: 0.15, top: y + 6.2 });
  }
  { // one tall floodlight tower, on the first clear spot beside the ring
    for (let a = D.towerAt; a < D.towerAt + Math.PI * 2; a += 0.2) {
      const r = L.ring + 5 + 3, px = L.x + Math.cos(a) * r, pz = L.z + Math.sin(a) * r;
      if (!ok(px, pz, 1)) continue;
      const y = map.heightAt(px, pz);
      kit.add('wall', new THREE.CylinderGeometry(0.22, 0.38, D.tower, 8), new THREE.Matrix4().setPosition(px, y + D.tower / 2, pz), col(D.pole));
      kit.add('wall', new THREE.TorusGeometry(1.1, 0.12, 6, 16).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(px, y + D.tower, pz), col(D.pole));
      for (let k = 0; k < 8; k++) { const b = (k / 8) * Math.PI * 2; kit.box('wall', px + Math.cos(b) * 1.1, y + D.tower + 0.35, pz + Math.sin(b) * 1.1, 0.45, 0.5, 0.25, b, col('#f4f0e2')); }
      solids.push({ x: px, z: pz, r: 0.4, top: y + D.tower });
      break;
    }
  }
  // zebra crossings where roads leave the ring
  for (const road of map.roads) {
    if (road.k === L.road && road.p.every(([px, pz]) => Math.abs(Math.hypot(px - L.x, pz - L.z) - L.ring) < 4)) continue;   // the ring itself
    const w = roadWidth(road);
    if (!w) continue;
    walkLine(road.p, 1, (px, pz, dx, dz) => {
      const d = Math.hypot(px - L.x, pz - L.z);
      if (Math.abs(d - (L.ring + D.zebra)) > 0.5) return;
      const ryR = Math.atan2(dx, dz), y = Math.max(map.heightAt(px, pz), map.sea) + ROAD_LIFT + 0.05;
      for (let t = -w / 2 + 0.5; t <= w / 2 - 0.4; t += 1.0) kit.box('road', px - dz * t, y, pz + dx * t, 0.5, 0.02, 3, ryR, col('#f2f0ea'));
    });
  }
}
