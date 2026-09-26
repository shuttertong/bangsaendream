// Beach furniture along the sand (umbrella blocks with deck chairs or plastic tables,
// inner-tube rental stalls) and street furniture (power poles + sagging cables).
import * as THREE from 'three';
import { rng, walkLine } from './layout.js';
import { roadWidth } from './roads.js';
import { getMaterial } from '../world/materials.js';
import * as P from './assets/props.js';

const BEACH = {
  rows: [9, 12.5],               // metres from the waterline
  spacing: 3.3,                  // between umbrellas in a row
  block: [9, 18],                // umbrellas per vendor block
  gap: [5, 14],                  // metres of open sand between blocks
  maxSlope: 0.9,                 // scene units across a spot
  umbrellaColors: ['#2f6fc4', '#d8443a', '#2f6fc4', '#d8443a', '#f0c23a', '#3a9a6a'],
  chairColors: ['#f4f2ec', '#3f7fb5', '#e8e4da'],
  tableChance: 0.3,              // blocks that use plastic tables instead of deck chairs
  rentalChance: 0.5,             // blocks that start with an inner-tube stall
};
const CHUNK = 384;
const STREET = { roads: ['secondary', 'tertiary'], poleEvery: 34, sag: 0.7, cableColor: '#2e2e2e' };

export function buildBeach(map, ctx, kit) {
  const { occ, seaDist, roadIdx } = ctx;
  const r = rng(4242);
  const lists = { canopy: [], pole: [], chair: [], table: [], rental: [] };
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
        const ok = Math.abs(sd - d) < 5 && Math.abs(h1 - h0) < BEACH.maxSlope && roadIdx.clearance(px, pz, 6) > 1
          && !occ.test(px, pz, 1.2, 1.2) && Math.abs(map.heightAt(px, pz) - map.sea) < 3;
        if (gapLeft > 0 || !ok) { gapLeft -= BEACH.spacing; if (!ok && inBlock) { inBlock = 0; gapLeft = r.range(...BEACH.gap); } return; }
        if (!inBlock) {                                          // start a vendor block
          blockLeft = Math.round(r.range(...BEACH.block));
          style = r.chance(BEACH.tableChance) ? 'table' : 'chair';
          color = r.pick(BEACH.umbrellaColors);
          if (d === BEACH.rows[1] && r.chance(BEACH.rentalChance)) {
            put(lists.rental, px + nx * 3, pz + nz * 3, Math.atan2(-nx, -nz), '#ffffff');
            occ.mark(px + nx * 3, pz + nz * 3, 1.6, 1);
          }
        }
        inBlock++;
        const face = Math.atan2(-nx, -nz);                       // chairs face the sea
        put(lists.canopy, px, pz, r() * Math.PI, color);
        put(lists.pole, px, pz, 0, '#ffffff');
        if (style === 'table') put(lists.table, px + dx * 0.2, pz + dz * 0.2, r() * Math.PI, '#ffffff');
        else for (const s of [-0.55, 0.55]) put(lists.chair, px + dx * s, pz + dz * s, face + (r() - 0.5) * 0.3, r.pick(BEACH.chairColors));
        occ.mark(px, pz, 1.4, 1.4);
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
  make(P.umbrellaCanopy(), lists.canopy);
  make(P.umbrellaPole(), lists.pole);
  make(P.deckChair(), lists.chair);
  make(P.tableSet(), lists.table);
  make(P.tubeStack(), lists.rental);

  const poles = buildPoles(map, ctx, kit, r);
  make(P.powerPole(), poles);

  const rentals = lists.rental.map(it => ({ x: it.x, z: it.z, yaw: it.ry }));
  return { group, poles, rentals, counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]).concat([['poles', poles.length]])) };
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
