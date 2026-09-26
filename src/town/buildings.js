// Buildings: OSM footprints, plus procedural frontage (shophouse rows, condos, houses)
// along the roads inside the playable coastal strip — OSM has very few buildings here.
import { rng, walkLine } from './layout.js';
import { roadWidth } from './roads.js';
import { shophouseRow, condoBlock } from './assets/shophouse.js';
import { house, footprintBuilding } from './assets/house.js';

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
};

export function buildBuildings(kit, map, ctx) {
  const { occ, roadIdx, seaDist } = ctx;
  const r = rng(20260926);
  const counts = { osm: 0, shop: 0, condo: 0, house: 0, rows: [] };

  for (const b of map.buildings) {
    occ.markPoly(b.p);
    footprintBuilding(kit, r, map, b);
    counts.osm++;
  }

  const inland = map.inland || 100;
  const fits = (cx, cz, fx, fz, hw, D) => {
    const ax = fz, az = -fx;                   // along-road axis
    const corners = [[-hw, 0], [hw, 0], [-hw, -D], [hw, -D]].map(([u, w]) => [cx + ax * u + fx * w, cz + az * u + fz * w]);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const [x, z] = corners[i], sd = seaDist(x, z);
      if (sd < FRONTAGE.minSeaDist || sd > inland + (i < 2 ? 0 : FRONTAGE.backOverhang)) return false;
      if (roadIdx.clearance(x, z, 12) < 0.4) return false;
      const h = map.heightAt(x, z);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (roadIdx.clearance(cx - fx * D / 2, cz - fz * D / 2, 12) < 0.4) return false;
    if (hi - lo > FRONTAGE.maxSlope) return false;
    return !occ.test(cx - fx * D / 2, cz - fz * D / 2, hw, D / 2 + 0.3, Math.atan2(fx, fz));
  };

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
        if (run.length) placeRun(kit, map, r, run, road.k, occ, counts);
        run = [];
      };
      walkLine(road.p, FRONTAGE.lot, (x, z, dx, dz) => {
        const nx = -dz * side, nz = dx * side;                 // from road toward the lot
        const cx = x + nx * off, cz = z + nz * off;            // facade centre
        const fx = -nx, fz = -nz;                              // facade faces the road
        // the sea side of a road stays open (beach, trees, stalls): no lots seaward of it
        const seaward = seaDist(cx + nx * 6, cz + nz * 6) < seaDist(x, z) - 1.5;
        let D = 0;
        if (!seaward) for (const d of FRONTAGE.depths) if (fits(cx, cz, fx, fz, FRONTAGE.lot / 2, d)) { D = d; break; }
        const prev = run[run.length - 1];
        const continues = prev && D === prev.D && Math.abs(prev.fx * fx + prev.fz * fz) > 0.97
          && Math.hypot(prev.x - cx, prev.z - cz) < FRONTAGE.lot * 1.3;
        if (!D || (!continues && run.length) || run.length >= FRONTAGE.rowMax) flush();
        if (D) run.push({ x: cx, z: cz, fx, fz, D });
      }, FRONTAGE.lot / 2);
      flush();
    }
  }
  return counts;
}

function placeRun(kit, map, r, run, kind, occ, counts) {
  const n = run.length, a = run[0], z = run[n - 1], fx = a.fx, fz = a.fz, D = a.D;
  const fcx = (a.x + z.x) / 2, fcz = (a.z + z.z) / 2;        // facade centre
  const x = fcx - fx * D / 2, zz = fcz - fz * D / 2;          // footprint centre
  const ry = Math.atan2(fx, fz);
  let y = Infinity;
  for (const q of run) y = Math.min(y, map.heightAt(q.x, q.z), map.heightAt(q.x - fx * D, q.z - fz * D));
  y = Math.max(y, map.sea);
  const main = kind === 'secondary' || kind === 'tertiary';
  const W = FRONTAGE.lot * n;
  counts.rows.push({ x, z: zz, ry, n, D, road: kind });
  if (main && n >= 5 && D >= 12 && r.chance(FRONTAGE.condoChance)) {
    condoBlock(kit, r, { x, y, z: zz, ry, width: W - 1, D, floors: 6 + Math.floor(r() * 7) });
    counts.condo++;
  } else if (n === 2 && r.chance(FRONTAGE.houseChance)) {
    // detached house set back a little, with a yard
    const hd = Math.min(D - 3, 8);
    house(kit, r, { x: fcx - fx * (hd / 2 + 2.6), y, z: fcz - fz * (hd / 2 + 2.6), ry, W: Math.min(W - 0.6, 8), D: hd, floors: r.chance(0.3) ? 2 : 1 });
    counts.house++;
  } else if (n >= 2) {
    shophouseRow(kit, r, { x, y, z: zz, ry, n, W: FRONTAGE.lot, D, floors: main ? 3 : 2 });
    counts.shop += n;
  }
}
