// Beach furniture along the sand (umbrella blocks with deck chairs or plastic tables,
// inner-tube rental stalls) and street furniture (power poles + sagging cables).
import * as THREE from 'three';
import { rng, walkLine } from './layout.js';
import { roadWidth } from './roads.js';
import { getMaterial } from '../world/materials.js';
import * as P from './assets/props.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BEACH = {
  // zones back from the waterline: open sand (0–13 m), umbrella rows, then the palm band
  rows: [14, 17.5, 21],          // metres from the waterline: a deep carpet of umbrellas in front of the palms
  spacing: 3.3,                  // between umbrellas in a row
  block: [12, 26],               // umbrellas per vendor block
  gap: [3, 8],                   // metres of open sand between blocks
  maxSlope: 0.9,                 // scene units across a spot
  maxRise: 6,                    // highest sand above the sea that still gets umbrellas (the DEM rises inland)
  umbrellaColors: ['#ffffff', '#f4f6fa', '#ffffff', '#eef2f8'],   // tints over the baked blue/white stripes
  chairCanvas: '#3f7fb5',        // deck chair canvas (baked into the umbrella set)
  tableChance: 0.3,              // blocks that use plastic tables instead of deck chairs
  rentalChance: 0.5,             // blocks that start with an inner-tube stall
  bench: { row: 27, every: 26, color: '#cfc8b8' },     // free public benches in the palm band behind the umbrellas
  // the palm band: a dense wall of coconut palms leaning out over the sand toward the sea
  palms: { rows: [25, 29, 33], every: 4.6, skip: 0.1, scale: [1.05, 1.5], lean: [0.05, 0.22], wobble: 0.7 },
  floodlights: { row: 23, every: 80, height: 15, color: '#7d93a6' },   // tall beach floodlight poles
};
// where the kid's hips go when sitting (chair / bench local frame: +z = front, toward the sea)
const CHAIR_U = [-0.55, 0.55];   // deck chairs either side of the umbrella pole (along the shore)
export const SEAT_AT = { chair: { u: 0, v: 0.43, w: -0.2 }, bench: { u: 0.42, v: 0.5, w: 0.02 } };
const CHUNK = 384;
// shores with no beach furniture (layout.noBeach: boxes added by e.g. khaosammuk.js — seawall, not sand)
let noBeach = () => false;
const STREET = { roads: ['secondary', 'tertiary'], poleEvery: 34, sag: 0.7, cableColor: '#2e2e2e' };

export function buildBeach(map, ctx, kit) {
  const { occ, seaDist, roadIdx } = ctx;
  noBeach = (x, z) => (ctx.noBeach || []).some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const r = rng(4242);
  // sets: umbrella + two deck chairs / umbrella + table and stools, one instance each.
  // `chair` only records where the chairs are (for sitting).
  const lists = { chairSet: [], tableSet: [], chair: [], rental: [] };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const put = (list, x, z, ry, color, s = 1) => {
    m.compose(new THREE.Vector3(x, map.heightAt(x, z) - 0.05, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(s, s, s));
    list.push({ m: m.clone(), c: new THREE.Color(color), x, z, ry });
  };

  // coastline offset inland by d: land is on the left of each coast way
  for (const coast of map.coast) {
    for (const d of BEACH.rows) {
      let inBlock = 0, blockLeft = 0, gapLeft = r.range(...BEACH.gap), style = null, color = null;
      walkLine(coast.p, BEACH.spacing, (x, z, dx, dz) => {
        const nx = dz, nz = -dx;                                // inland
        const px = x + nx * d, pz = z + nz * d;
        const sd = seaDist(px, pz);
        const h0 = map.heightAt(px - nx, pz - nz), h1 = map.heightAt(px + nx, pz + nz);
        const ok = !noBeach(px, pz) && Math.abs(sd - d) < 5 && Math.abs(h1 - h0) < BEACH.maxSlope && roadIdx.clearance(px, pz, 6) > 1
          && !occ.test(px, pz, 1.0, 0.9, Math.atan2(dx, dz)) && map.heightAt(px, pz) - map.sea < BEACH.maxRise;   // boxes turned along the shore
        if (gapLeft > 0 || !ok) { gapLeft -= BEACH.spacing; if (!ok && inBlock) { inBlock = 0; gapLeft = r.range(...BEACH.gap); } return; }
        if (!inBlock) {                                          // start a vendor block
          blockLeft = Math.round(r.range(...BEACH.block));
          style = r.chance(BEACH.tableChance) ? 'table' : 'chair';
          color = r.pick(BEACH.umbrellaColors);
          if (d === BEACH.rows[BEACH.rows.length - 1] && r.chance(BEACH.rentalChance)) {   // behind the last row
            put(lists.rental, px + nx * 3, pz + nz * 3, Math.atan2(-nx, -nz), '#ffffff');
            occ.mark(px + nx * 3, pz + nz * 3, 1.6, 1);
          }
        }
        inBlock++;
        const face = Math.atan2(-nx, -nz);                       // chairs face the sea
        // the set faces the sea: its local x runs along the shore (dx, dz)
        if (style === 'table') put(lists.tableSet, px, pz, face + (r() < 0.5 ? 0 : Math.PI / 2), color);
        else {
          put(lists.chairSet, px, pz, face, color);
          for (const s of CHAIR_U) put(lists.chair, px + dx * s, pz + dz * s, face, '#ffffff');
        }
        occ.mark(px, pz, 1.0, 1.0, Math.atan2(dx, dz));   // small: the 1 m grid cells round it up
        if (--blockLeft <= 0) { inBlock = 0; gapLeft = r.range(...BEACH.gap); }
      });
    }
  }

  const group = new THREE.Group(), mat = getMaterial('wall');
  // one InstancedMesh per map chunk, so off-screen chunks are culled (main and shadow pass)
  const make = (geo, list, shadow = true) => {
    const chunks = new Map();
    for (const it of list) {
      const e = it.m.elements, k = `${Math.floor(e[12] / CHUNK)},${Math.floor(e[14] / CHUNK)}`;
      (chunks.get(k) || chunks.set(k, []).get(k)).push(it);
    }
    for (const items of chunks.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  };
  // umbrella + pole + furniture in one geometry → one instanced draw per chunk and kind
  const canvas = new THREE.Color(BEACH.chairCanvas);
  const chair = u => {
    const g = P.deckChair().translate(u, 0, 0), c = g.attributes.color;
    for (let i = 0; i < c.count; i++) if (c.getX(i) > 0.99) c.setXYZ(i, canvas.r, canvas.g, canvas.b);   // white parts are the canvas
    return g;
  };
  make(mergeGeometries([P.umbrellaCanopy(), P.umbrellaPole(), ...CHAIR_U.map(chair)]), lists.chairSet);
  make(mergeGeometries([P.umbrellaCanopy(), P.umbrellaPole(), P.tableSet().translate(0.2, 0, 0)]), lists.tableSet);
  make(P.tubeStack(), lists.rental);

  const benches = buildBenches(map, ctx, kit);
  const palms = palmRows(map, ctx, r);
  const solids = floodlights(map, ctx, kit);
  const poles = buildPoles(map, ctx, kit, r);
  make(P.powerPole(), poles);

  const rentals = lists.rental.map(it => ({ x: it.x, z: it.z, yaw: it.ry }));
  // seats: owners' deck chairs (rented) + public benches (free, two places each)
  const seatAt = (x, y, z, ry, o, kind) => ({ kind, yaw: ry, x: x + Math.cos(ry) * o.u + Math.sin(ry) * o.w, y: y + o.v, z: z - Math.sin(ry) * o.u + Math.cos(ry) * o.w });
  const seats = lists.chair.map(it => seatAt(it.x, it.m.elements[13], it.z, it.ry, SEAT_AT.chair, 'chair'));
  for (const b of benches) for (const s of [-1, 1]) seats.push(seatAt(b.x, b.y, b.z, b.ry, { ...SEAT_AT.bench, u: SEAT_AT.bench.u * s }, 'bench'));
  return { group, poles, rentals, seats, palms, solids, counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]).concat([['poles', poles.length]])) };
}

/** Rows of coconut palms on the sand, parallel to the shore (the umbrellas sit among them). */
function palmRows(map, ctx, r) {
  const { occ, seaDist, roadIdx } = ctx, P = BEACH.palms, out = [];
  for (const coast of map.coast) for (const d of P.rows) {
    walkLine(coast.p, P.every, (x, z, dx, dz) => {
      if (r() < P.skip) return;
      const j = (r() - 0.5) * 1.8, px = x + dz * d + dx * j, pz = z - dx * d + dz * j, y = map.heightAt(px, pz);
      if (noBeach(px, pz) || Math.abs(seaDist(px, pz) - d) > 4 || y < map.sea + 0.25 || roadIdx.clearance(px, pz, 6) < 1.5 || occ.test(px, pz, 0.8, 0.8)) return;
      // the palm template leans toward its local +x: turn that seaward (−dz, dx), then shear it further
      const rot = Math.atan2(-dx, -dz) + (r() - 0.5) * P.wobble;
      out.push({ x: px, z: pz, y: y - 0.15, rot, s: P.scale[0] + r() * (P.scale[1] - P.scale[0]), shear: P.lean[0] + r() * (P.lean[1] - P.lean[0]) });
    }, r() * P.every);
  }
  return out;
}

/** Tall floodlight poles along the front of the palm band (static kit). Returns their collision circles. */
function floodlights(map, ctx, kit) {
  const { occ, seaDist, roadIdx } = ctx, L = BEACH.floodlights, out = [], c = new THREE.Color(L.color), lamp = new THREE.Color('#e8eef2');
  for (const coast of map.coast) walkLine(coast.p, L.every, (x, z, dx, dz) => {
    const px = x + dz * L.row, pz = z - dx * L.row, y = map.heightAt(px, pz);
    if (noBeach(px, pz) || Math.abs(seaDist(px, pz) - L.row) > 5 || y < map.sea + 0.3 || roadIdx.clearance(px, pz, 6) < 2 || occ.test(px, pz, 0.6, 0.6)) return;
    const f = kit.frame(px, y, pz, Math.atan2(-dz, dx));
    f.box('wall', 0, 0.3, 0, 0.7, 0.6, 0.7, new THREE.Color('#bdb8ac'));                // footing
    f.rod('wall', [0, 0.5, 0], [0, L.height, 0], 0.14, c);
    f.box('wall', 0, L.height + 0.1, 0, 2.2, 0.12, 0.12, c);                           // lamp bar
    for (const u of [-0.9, -0.3, 0.3, 0.9]) f.box('wall', u, L.height + 0.35, 0.05, 0.4, 0.45, 0.2, lamp);
    occ.mark(px, pz, 0.8, 0.8);
    out.push({ x: px, z: pz, r: 0.25, top: y + L.height });
  }, L.every / 3);
  return out;
}

/** Concrete public benches facing the sea, in a row behind the umbrellas. Static kit geometry. */
function buildBenches(map, ctx, kit) {
  const { occ, seaDist, roadIdx } = ctx, B = BEACH.bench, out = [];
  for (const coast of map.coast) {
    walkLine(coast.p, B.every, (x, z, dx, dz) => {
      const nx = dz, nz = -dx, px = x + nx * B.row, pz = z + nz * B.row;
      const y = map.heightAt(px, pz);
      if (noBeach(px, pz) || Math.abs(seaDist(px, pz) - B.row) > 5 || roadIdx.clearance(px, pz, 6) < 1.5 || occ.test(px, pz, 2.2, 1.2)
        || Math.abs(map.heightAt(px + dx, pz + dz) - map.heightAt(px - dx, pz - dz)) > 0.5 || Math.abs(y - map.sea) > 3) return;
      const ry = Math.atan2(-nx, -nz), f = kit.frame(px, y, pz, ry);
      for (const u of [-0.75, 0.75]) f.box('wall', u, 0.22, 0, 0.14, 0.44, 0.42, B.color);   // legs
      f.box('wall', 0, 0.46, 0, 1.9, 0.08, 0.46, B.color);                                     // seat slab
      f.box('wall', 0, 0.8, -0.24, 1.9, 0.3, 0.06, B.color, 0);                               // backrest
      for (const u of [-0.75, 0.75]) f.box('wall', u, 0.62, -0.24, 0.1, 0.34, 0.08, B.color);
      occ.mark(px, pz, 2.2, 1.2);
      out.push({ x: px, y, z: pz, ry });
    }, B.every / 2);
  }
  return out;
}

/** Power poles on the land side of main roads, with three sagging cables between them. */
function buildPoles(map, ctx, kit, r) {
  const { seaDist, roadIdx } = ctx;
  const out = [], m = new THREE.Matrix4(), cable = new THREE.Color(STREET.cableColor);
  for (const road of map.roads) {
    if (!STREET.roads.includes(road.k) || road.p.length < 2) continue;
    const off = roadWidth(road.k) / 2 + 0.9;
    let prev = null;
    walkLine(road.p, STREET.poleEvery, (x, z, dx, dz) => {
      // pick the land side (further from the sea)
      let nx = -dz, nz = dx;
      if (seaDist(x + nx * 5, z + nz * 5) < seaDist(x - nx * 5, z - nz * 5)) { nx = -nx; nz = -nz; }
      const px = x + nx * off, pz = z + nz * off;
      if (roadIdx.clearance(px, pz, 8) < 0.3) { prev = null; return; }
      const y = map.heightAt(px, pz);
      const ry = Math.atan2(dx, dz);                           // cross-arm (local x) spans across the road
      m.compose(new THREE.Vector3(px, y, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
      out.push({ m: m.clone(), c: new THREE.Color('#ffffff') });
      const tops = [-0.8, 0, 0.8].map(u => new THREE.Vector3(px + Math.cos(ry) * u, y + 8.4, pz - Math.sin(ry) * u));
      if (prev) {
        for (let k = 0; k < 3; k++) {
          const a = prev[k], b = tops[k], mid = a.clone().lerp(b, 0.5);
          mid.y -= STREET.sag * (0.8 + r() * 0.5);
          const a1 = a.clone().lerp(mid, 0.5); a1.y = (a.y + mid.y) / 2 - STREET.sag * 0.18;
          const b1 = mid.clone().lerp(b, 0.5); b1.y = (mid.y + b.y) / 2 - STREET.sag * 0.18;
          for (const [u, v] of [[a, a1], [a1, mid], [mid, b1], [b1, b]]) kit.rod('wall', u, v, 0.018, cable);
        }
      }
      prev = tops;
    }, STREET.poleEvery / 2);
  }
  return out;
}
