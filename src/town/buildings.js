// Buildings: OSM footprints, plus procedural frontage (shophouse rows, condos, houses)
// along the roads inside the playable coastal strip — OSM has very few buildings here.
import { rng, walkLine } from './layout.js';
import { roadWidth, surfaceLift } from './roads.js';
import { shophouseRow, condoBlock } from './assets/shophouse.js';
import { house, footprintBuilding, grandmaHouse } from './assets/house.js';

// Tunables
const FRONTAGE = {
  roads: { secondary: 1, tertiary: 1, unclassified: 0.8, residential: 0.7 },  // build chance per road kind
  lot: 4,                 // shophouse unit width (m)
  setback: 2.2,           // pavement between road edge and facade (m)
  depths: [12, 9],        // try deep lots first
  minSeaDist: 26,         // keep off the sand
  backOverhang: 25,       // lots may reach this far past the strip edge (facades stay inside)
  maxSlope: 1.6,          // max height difference across a footprint (m)
  rowMax: 9,              // units per row before a soi gap
  condoChance: 0.12,      // per long row on a main road
  houseChance: 0.5,       // short runs become houses (else small shophouse rows)
  straight: 0.996,        // cos of the max bend within one row (~5°)
  rowRise: 0.8,           // max change in pavement height along one row (scene units)
};
// Grandma's house (fictional): the closest quiet-street lot to the start that fits a yard
const GRANDMA = { roads: ['residential', 'unclassified', 'service'], lot: 12, depth: 12, maxDist: 600 };

export function buildBuildings(kit, map, ctx, near) {
  const { occ, roadIdx, seaDist, strip } = ctx;
  const r = rng(20260926);
  const counts = { osm: 0, shop: 0, condo: 0, house: 0, rows: [] };

  for (const b of map.buildings) {
    occ.markPoly(b.p);
    footprintBuilding(kit, r, map, b);
    counts.osm++;
  }

  const fits = (cx, cz, fx, fz, hw, D) => {
    const ax = fz, az = -fx;                   // along-road axis
    const corners = [[-hw, 0], [hw, 0], [-hw, -D], [hw, -D]].map(([u, w]) => [cx + ax * u + fx * w, cz + az * u + fz * w]);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const [x, z] = corners[i], sd = seaDist(x, z);
      if (sd < FRONTAGE.minSeaDist || strip(x, z) > (i < 2 ? 0 : FRONTAGE.backOverhang)) return false;
      if (roadIdx.clearance(x, z, 12) < 0.4) return false;
      const h = map.heightAt(x, z);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (hi - lo > FRONTAGE.maxSlope) return false;
    // the whole footprint (every metre), not just its corners, must stay off every road
    if (!clearOfRoads(roadIdx, cx, cz, fx, fz, hw, D)) return false;
    return !occ.test(cx - fx * D / 2, cz - fz * D / 2, hw, D / 2 + 0.3, Math.atan2(fx, fz));
  };

  // reserve grandma's lot first so the generic frontage builds around it
  let best = null;
  for (const road of map.roads) {
    if (!GRANDMA.roads.includes(road.k) || road.p.length < 2) continue;
    const off = roadWidth(road.k) / 2 + FRONTAGE.setback;
    for (const side of [1, -1]) walkLine(road.p, 3, (x, z, dx, dz) => {
      const nx = -dz * side, nz = dx * side, cx = x + nx * off, cz = z + nz * off;
      const d = Math.hypot(cx - near.x, cz - near.z);
      if (d > GRANDMA.maxDist || (best && d >= best.d)) return;
      if (seaDist(cx + nx * 6, cz + nz * 6) < seaDist(x, z) - 1.5) return;
      if (fits(cx, cz, -nx, -nz, GRANDMA.lot / 2, GRANDMA.depth)) best = { d, cx, cz, fx: -nx, fz: -nz };
    });
  }
  if (best) {
    const { cx, cz, fx, fz } = best, D = GRANDMA.depth, ry = Math.atan2(fx, fz);
    const x = cx - fx * D / 2, z = cz - fz * D / 2;
    occ.mark(x, z, GRANDMA.lot / 2 + 1, D / 2 + 0.5, ry);
    const y = Math.max(map.sea, Math.min(map.heightAt(cx, cz), map.heightAt(x - fx * D / 2, z - fz * D / 2)));
    grandmaHouse(kit, r, { x, y, z, ry, W: GRANDMA.lot, D });
    // she waits in the front yard beside the stairs, facing the street
    const ax = fz, az = -fx;                                    // along the street
    counts.grandma = { x: cx - fx * 1.4 + ax * 2.4, z: cz - fz * 1.4 + az * 2.4, yaw: ry };
    counts.rows.push({ x: x - fx * 2.0, z: z - fz * 2.0, ry, n: 2, D: 8, road: 'grandma', kind: 'grandma', top: 9 });
  }

  for (const road of map.roads) {
    const chance = FRONTAGE.roads[road.k];
    if (!chance || road.p.length < 2) continue;
    const off = roadWidth(road.k) / 2 + FRONTAGE.setback;
    for (const side of [1, -1]) {
      if (!r.chance(chance)) continue;
      let run = [];
      // lots of the current run are marked when it's flushed, so a row never blocks itself
      const flush = () => {
        for (const q of run) occ.mark(q.x - q.fx * q.D / 2, q.z - q.fz * q.D / 2, FRONTAGE.lot / 2, q.D / 2, Math.atan2(q.fx, q.fz));
        if (run.length) placeRun(kit, map, r, run, road.k, occ, counts, roadIdx);
        run = [];
      };
      walkLine(road.p, FRONTAGE.lot, (x, z, dx, dz) => {
        const nx = -dz * side, nz = dx * side;                 // from road toward the lot
        const cx = x + nx * off, cz = z + nz * off;            // facade centre
        const fx = -nx, fz = -nz;                              // facade faces the road
        // the sea side of a coastal road stays open (beach, trees, stalls): no lots seaward of it.
        // Inland corridor roads (3137) get both sides.
        const seaward = seaDist(x, z) < (map.inland || 100) && seaDist(cx + nx * 6, cz + nz * 6) < seaDist(x, z) - 1.5;
        let D = 0;
        if (!seaward) for (const d of FRONTAGE.depths) if (fits(cx, cz, fx, fz, FRONTAGE.lot / 2, d)) { D = d; break; }
        // a row is one straight block: keep it within ~5° of its first lot and on its line
        const prev = run[run.length - 1], first = run[0];
        const lateral = first ? Math.abs((cx - first.x) * first.fx + (cz - first.z) * first.fz) : 0;
        const continues = prev && D === prev.D && first.fx * fx + first.fz * fz > FRONTAGE.straight
          && lateral < 0.6 && Math.hypot(prev.x - cx, prev.z - cz) < FRONTAGE.lot * 1.3
          && Math.abs(map.heightAt(cx, cz) - map.heightAt(first.x, first.z)) < FRONTAGE.rowRise;
        if (!D || (!continues && run.length) || run.length >= FRONTAGE.rowMax) flush();
        if (D) run.push({ x: cx, z: cz, fx, fz, D });
      }, FRONTAGE.lot / 2);
      flush();
    }
  }
  return counts;
}

/** True if a lot (facade centre cx,cz facing fx,fz; half width hw; depth D) stays off every road. */
function clearOfRoads(roadIdx, cx, cz, fx, fz, hw, D) {
  const ax = fz, az = -fx;
  for (let u = -hw; u <= hw + 0.01; u += 1) for (let w = 0; w <= D + 0.01; w += 1) {
    if (roadIdx.clearance(cx + ax * u - fx * w, cz + az * u - fz * w, 8) < 0.3) return false;
  }
  return true;
}

function placeRun(kit, map, r, run, kind, occ, counts, roadIdx) {
  const n = run.length, a = run[0], z = run[n - 1], fx = a.fx, fz = a.fz, D = a.D;
  const fcx = (a.x + z.x) / 2, fcz = (a.z + z.z) / 2;        // facade centre
  // the straight block from the first to the last lot must still be clear of roads;
  // if a bend or a side road gets in the way, split the run and try each half
  const W = FRONTAGE.lot * n;
  if (!clearOfRoads(roadIdx, fcx, fcz, fx, fz, W / 2 - 0.2, D)) {
    if (n < 2) return;
    const h = n >> 1;
    placeRun(kit, map, r, run.slice(0, h), kind, occ, counts, roadIdx);
    placeRun(kit, map, r, run.slice(h), kind, occ, counts, roadIdx);
    return;
  }
  const x = fcx - fx * D / 2, zz = fcz - fz * D / 2;          // footprint centre
  const ry = Math.atan2(fx, fz);
  // floor level with the pavement in front; a plinth fills down to the lowest ground behind
  let front = 0, lowest = Infinity;
  for (const q of run) {
    front += map.heightAt(q.x + fx * 1.2, q.z + fz * 1.2) + surfaceLift(roadIdx, q.x + fx * 1.2, q.z + fz * 1.2);
    lowest = Math.min(lowest, map.heightAt(q.x, q.z), map.heightAt(q.x - fx * D, q.z - fz * D));
  }
  const y = Math.max(front / n, map.sea);
  const drop = Math.max(0, y - lowest);
  const main = kind === 'secondary' || kind === 'tertiary';
  const row = { x, z: zz, ry, n, D, road: kind, kind: 'empty', top: y + 14 - map.heightAt(x, zz) };
  counts.rows.push(row);
  if (main && n >= 5 && D >= 12 && r.chance(FRONTAGE.condoChance)) {
    const floors = 6 + Math.floor(r() * 7);
    condoBlock(kit, r, { x, y, z: zz, ry, width: W - 1, D, floors, drop });
    row.top = floors * 3.2 + 3;
    row.kind = 'condo';
    counts.condo++;
  } else if (n === 2 && r.chance(FRONTAGE.houseChance)) {
    // detached house set back a little, with a yard
    const hd = Math.min(D - 3, 8);
    house(kit, r, { x: fcx - fx * (hd / 2 + 2.6), y, z: fcz - fz * (hd / 2 + 2.6), ry, W: Math.min(W - 0.6, 8), D: hd, floors: r.chance(0.3) ? 2 : 1, drop });
    row.kind = 'house';
    counts.house++;
  } else if (n >= 2) {
    shophouseRow(kit, r, { x, y, z: zz, ry, n, W: FRONTAGE.lot, D, floors: main ? 3 : 2, drop });
    row.kind = 'shop';
    counts.shop += n;
  }
}
