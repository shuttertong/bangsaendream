// ถนนคนเดินบางแสน — the Bang Saen walking street on the seafront north of Laem Thaen:
// the low flat lot between the road and the sea is paved, and along the road both sides
// fill with market stalls under pop-up gazebo tents (tables of goods, food carts, stools),
// with strings of bulbs across the road. No OSM data for it: laid out along the OSM roads
// inside WALK.box (the flat seafront strip seen on the satellite view).
import * as THREE from 'three';
import { rng, walkLine, inPoly } from './layout.js';
import { roadWidth } from './roads.js';

export const WALK = {
  box: { x0: -1300, x1: -1100, z0: -1000, z1: -880 },
  roads: ['residential', 'service', 'unclassified', 'tertiary', 'living_street'],
  stall: { spacing: 3.4, off: 1.9, skip: 0.12 },
  arrive: 2,                                                         // travel arrives this many stalls in from the end of the street
  people: { seller: 0.85, sit: 0.45, shopper: 0.24 },                // chance of a seller per stall (and that they sit), of a shopper per place at the table
  lights: { every: 13, height: 4.2, sag: 0.6, bulbs: 9 },
  lot: { step: 4, minSea: 4 },
  colors: {
    tents: ['#d8443a', '#2f6fc4', '#f4f2ec', '#3a9a6a', '#f0c23a', '#e8743a'],
    goods: ['#e8543a', '#f0c23a', '#4fb3a8', '#f4f1e8', '#e8958a', '#7fc4e8', '#9a5a8a', '#6a8a3a', '#b8652a'],
    table: '#e8e6e0', leg: '#9aa3a8', stool: ['#d8443a', '#2f6fc4', '#3a9a6a'],
    lot: '#bdb7aa', lot2: '#b8b2a5', line: '#e8e4d8', pole: '#4a5058', bulb: '#fff2c4', wire: '#2e2e2e',
  },
};

const inBox = (x, z, b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;

export function buildWalkingStreet(kit, map, layout) {
  const W = WALK, r = rng(1717), col = h => new THREE.Color(h), c = W.colors, { occ, seaDist, roadIdx } = layout;
  const solids = [], people = [], rp = rng(2323);                    // people: spots for the background crowd (crowd.js); own rng, so the stalls stay as they were
  (layout.noBeach ||= []).push(W.box);                                // a market, not beach umbrellas
  const inBuilding = (x, z) => map.buildings.some(b => inPoly(x, z, b.p));

  // ---- the paved seafront lot (draped over the terrain), with parking lines ----
  const L = W.lot, cell = [], b = W.box;
  // only between the road and the sea: a cell is paved if it's closer to the sea than the nearest road point
  const roadPts = [];
  for (const road of map.roads) if (W.roads.includes(road.k)) walkLine(road.p, 4, (x, z) => { if (inBox(x, z, { x0: b.x0 - 30, x1: b.x1 + 30, z0: b.z0 - 30, z1: b.z1 + 30 })) roadPts.push([x, z, seaDist(x, z)]); });
  const seaward = (x, z) => { let best = null, bd = Infinity; for (const p of roadPts) { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = p; } } return best && seaDist(x, z) < best[2]; };
  for (let x = b.x0; x < b.x1; x += L.step) for (let z = b.z0; z < b.z1; z += L.step) {
    const cx = x + L.step / 2, cz = z + L.step / 2;
    if (!seaward(cx, cz) || seaDist(cx, cz) < L.minSea || map.heightAt(cx, cz) < map.sea + 0.2 || roadIdx.clearance(cx, cz, 6) < 0.3 || inBuilding(cx, cz)) continue;
    const y = (px, pz) => Math.max(map.heightAt(px, pz), map.sea) + 0.05;
    const v = [x, y(x, z), z, x, y(x, z + L.step), z + L.step, x + L.step, y(x + L.step, z), z,
      x + L.step, y(x + L.step, z), z, x, y(x, z + L.step), z + L.step, x + L.step, y(x + L.step, z + L.step), z + L.step];
    kit.tris3('road', v, col(r() < 0.5 ? c.lot : c.lot2), { x: cx, z: cz });
    if (Math.floor(x / L.step) % 3 === 0) kit.box('road', cx - L.step / 2 + 0.1, y(cx, cz) + 0.01, cz, 0.12, 0.02, L.step * 0.8, 0, col(c.line));   // parking bay lines
    cell.push([cx, cz]);
    occ.mark(cx, cz, L.step / 2, L.step / 2);
  }

  // ---- stalls along both sides of the road ----
  function stall(x, y, z, ry) {
    const f = kit.frame(x, y, z, ry), tent = col(r.pick(c.tents)), S = 2.8;
    for (const u of [-S / 2, S / 2]) for (const w of [-S / 2, S / 2]) f.rod('wall', [u, 0, w], [u, 2.2, w], 0.03, col(c.leg));
    // pyramid canopy + valance
    const top = 2.9, e = 2.2, h = S / 2 + 0.1;
    f.tris2('wall', [-h, e, -h, h, e, -h, 0, top, 0, h, e, -h, h, e, h, 0, top, 0, h, e, h, -h, e, h, 0, top, 0, -h, e, h, -h, e, -h, 0, top, 0], tent);
    for (const [u, w, sx, sz] of [[0, -h, 2 * h, 0.03], [0, h, 2 * h, 0.03], [-h, 0, 0.03, 2 * h], [h, 0, 0.03, 2 * h]]) f.box('wall', u, e - 0.12, w, sx, 0.25, sz, tent);
    // table of goods at the front (toward the road = −w), maybe a cart, a stool behind
    f.box('wall', 0, 0.74, -0.7, 2.2, 0.05, 0.8, col(c.table));
    for (const u of [-1, 1]) f.box('wall', u, 0.37, -0.7, 0.05, 0.74, 0.7, col(c.leg));
    for (let i = 0; i < 6; i++) {
      const hgt = 0.06 + r() * 0.18;
      f.box('wall', -0.9 + i * 0.36, 0.77 + hgt / 2, -0.7 + (r() - 0.5) * 0.4, 0.3, hgt, 0.3, col(r.pick(c.goods)));
    }
    if (r() < 0.3) { f.box('wall', 0.6, 0.55, 0.6, 1.2, 0.8, 0.7, col('#c9cdd0')); f.box('wall', 0.6, 0.97, 0.6, 1.25, 0.05, 0.75, col('#e8e6e0')); }   // steel food cart
    f.box('wall', -0.6, 0.22, 0.7, 0.32, 0.44, 0.32, col(r.pick(c.stool)));
    solids.push({ x, z, r: 1.3, top: y + 3 });
    // who is here: the seller behind the table (on the stool, or standing) and maybe someone looking at the goods
    if (rp() < W.people.seller) {
      const sit = rp() < W.people.sit, p = sit ? f.P(-0.6, 0, 0.7) : f.P(0.2 + (rp() - 0.5) * 0.9, 0, 0.02);
      people.push({ x: p.x, y, z: p.z, yaw: ry + Math.PI + (rp() - 0.5) * 0.5, role: 'seller', sit });
    }
    for (const u of [-0.6, 0.55]) {
      if (rp() > W.people.shopper) continue;
      const p = f.P(u + (rp() - 0.5) * 0.3, 0, -1.62 - rp() * 0.15);
      people.push({ x: p.x, y, z: p.z, yaw: ry + (rp() - 0.5) * 0.6, role: 'shopper' });
      solids.push({ x: p.x, z: p.z, r: 0.3, top: y + 1.7 });
    }
  }
  const sideRuns = [];                                               // where each side's stalls go (for the lights)
  let street = [];                                                   // the longest run of market road (where travel arrives)
  for (const road of map.roads) {
    if (!W.roads.includes(road.k) || !road.p.some(([x, z]) => inBox(x, z, b))) continue;
    const hw = roadWidth(road) / 2, from = sideRuns.length;
    walkLine(road.p, W.stall.spacing, (x, z, dx, dz) => {
      if (!inBox(x, z, b)) return;
      for (const s of [-1, 1]) {
        if (r() < W.stall.skip) continue;
        const nx = -dz * s, nz = dx * s, px = x + nx * (hw + W.stall.off), pz = z + nz * (hw + W.stall.off);
        if (map.heightAt(px, pz) < map.sea + 0.25 || inBuilding(px, pz) || roadIdx.clearance(px, pz, 6) < 1.2) continue;
        stall(px, Math.max(map.heightAt(px, pz), map.sea) + 0.05, pz, Math.atan2(nx, nz));   // +w points away from the road: the table (−w) faces it
        occ.mark(px, pz, 1.6, 1.6);
      }
      sideRuns.push({ x, z, dx, dz, hw });
    });
    if (sideRuns.length - from > street.length) street = sideRuns.slice(from);
  }
  // travel arrives on the road at one end of the market, looking down the street of stalls
  const a = street[Math.min(W.arrive, street.length - 1)];
  const place = a ? { x: a.x, z: a.z, yaw: Math.atan2(a.dx, a.dz) } : null;

  // ---- strings of bulbs across the road between poles ----
  const Li = W.lights;
  let since = Li.every;
  for (const p of sideRuns) {
    since += W.stall.spacing;
    if (since < Li.every) continue;
    since = 0;
    const ends = [-1, 1].map(s => {
      const px = p.x - p.dz * s * (p.hw + 0.5), pz = p.z + p.dx * s * (p.hw + 0.5), y = Math.max(map.heightAt(px, pz), map.sea);
      kit.rod('wall', new THREE.Vector3(px, y, pz), new THREE.Vector3(px, y + Li.height, pz), 0.06, col(c.pole));
      solids.push({ x: px, z: pz, r: 0.12, top: y + Li.height });
      return new THREE.Vector3(px, y + Li.height - 0.1, pz);
    });
    let prev = ends[0];
    for (let i = 1; i <= Li.bulbs + 1; i++) {
      const k = i / (Li.bulbs + 1), q = ends[0].clone().lerp(ends[1], k);
      q.y -= Math.sin(k * Math.PI) * Li.sag;
      kit.rod('wall', prev, q, 0.012, col(c.wire));
      if (i <= Li.bulbs) kit.add('lit', new THREE.SphereGeometry(0.09, 6, 4), new THREE.Matrix4().setPosition(q.x, q.y - 0.1, q.z), col(c.bulb));
      prev = q;
    }
  }
  return { solids, people, stalls: solids.length, lot: cell.length, place };
}
