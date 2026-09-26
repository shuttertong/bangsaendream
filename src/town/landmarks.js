// Landmarks placed from the map: the welcome sign on the roundabout at the south end of
// the beach (วงเวียนบางแสน, OSM junction=roundabout on the secondary road, way 154464422;
// centre checked against satellite imagery). Positions are local metres (§3).
import * as THREE from 'three';
import { welcomeRoundabout, SIGN } from './assets/landmark.js';

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
  const { face, solids } = welcomeRoundabout(kit, map, { x, y, z, ry });
  scene.add(face);
  layout.occ.mark(x, z, SIGN.island, SIGN.island);           // nothing else grows or stands on the island
  return { solids, welcome: { x, z, ry } };
}
