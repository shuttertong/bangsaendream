// The fishing village at the foot of Khao Sam Muk (หมู่บ้านชาวประมงเขาสามมุข) on the
// Ang Sila bay side: wooden houses on stilts over the water with bright metal roofs,
// wooden jetties between the clusters with Thai fishing boats and longtails moored
// alongside, and the long pier off the hill's north tip. OSM has no buildings or piers
// here, so it is laid out along the OSM coastline (land is on its left). Jetties and the
// pier are walkable decks; the houses are solid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, walkLine } from './layout.js';
import { roadWidth } from './roads.js';
import { longtailGeometry } from '../jetski/props.js';

export const VILLAGE = {
  shore: { x0: -660, x1: -470, z0: -2450, z1: -2120 },         // the east shore of the hill's north end
  roads: ['residential', 'unclassified', 'service', 'tertiary', 'secondary'], roadSea: 35,   // the shore road the houses face
  house: { w: [5.5, 8], d: [7, 11], front: 1.2, floor: 1.9, floors: [1, 2], gap: [0.6, 2.2], cluster: [3, 6], jettyGap: 5 },
  jetty: { len: [18, 32], w: 2.4, boats: [2, 4] },            // metres beyond the waterline
  pier: { from: [-640, -2455], dir: [0.55, -0.84], len: 115, w: 4.2, boats: 8, hut: true },   // the long pier off the north tip
  colors: {
    walls: ['#d9d0bc', '#c8b89a', '#9fb8b0', '#e0d6c0', '#b89a78', '#d6c4a8', '#a8c0c8'],
    roofs: ['#3f9a8c', '#3a8a5a', '#2f8a9a', '#c9542e', '#2f6fc4', '#8d9aa3', '#4aa88a'],
    wood: '#8a6a4a', deck: '#a8845c', post: '#6a5440', window: '#2e3a40', rail: '#e8e4d8',
    hulls: [['#2f6fc4', '#f4f2ec', '#d8443a'], ['#d8443a', '#f4f2ec', '#2f6fc4'], ['#3a8a5a', '#f0c23a', '#f4f2ec'], ['#f4f2ec', '#2f6fc4', '#d8443a']],
  },
};

const lerp = THREE.MathUtils.lerp;
function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** Thai fishing boat (bow toward +z, ~12 m): raised pointed bow, painted bands, wheelhouse aft, mast. */
export function fishingBoatGeometry([bottom, band, top]) {
  const side = new THREE.Shape();                                    // profile along x (bow at +x)
  side.moveTo(-5.6, 1.5); side.lineTo(4.4, 1.5); side.quadraticCurveTo(5.8, 1.9, 6.3, 3.0);
  side.quadraticCurveTo(5.2, 0.4, 3.2, -0.5); side.lineTo(-5.0, -0.4); side.lineTo(-5.6, 1.5);
  const hull = new THREE.ExtrudeGeometry(side, { depth: 3.2, bevelEnabled: false }).translate(0, 0, -1.6).rotateY(-Math.PI / 2);
  hull.deleteAttribute('uv');
  const p = hull.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) c.set(p.getY(i) > 1.2 ? top : p.getY(i) > 0.5 ? band : bottom).toArray(col, i * 3);
  hull.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (p.getZ(i) > 3 ? 1 - (p.getZ(i) - 3) / 4 : 1));   // taper the bow
  hull.computeVertexNormals();
  return mergeGeometries([
    hull,
    paint(new THREE.BoxGeometry(2.9, 0.1, 9).translate(0, 1.35, -0.6), '#9a7a52'),                 // deck
    paint(new THREE.BoxGeometry(2.4, 1.8, 2.6).translate(0, 2.3, -3.6), '#f4f2ec'),                // wheelhouse
    paint(new THREE.BoxGeometry(2.8, 0.15, 3.2).translate(0, 3.25, -3.6), band),
    paint(new THREE.BoxGeometry(2.42, 0.5, 1.2).translate(0, 2.6, -2.3), '#6a8a9a'),               // windows
    paint(new THREE.CylinderGeometry(0.07, 0.09, 5, 5).translate(0, 3.9, 0.8), '#6a5440'),        // mast
    paint(new THREE.CylinderGeometry(0.05, 0.05, 4, 4).rotateZ(Math.PI / 2).translate(0, 5.6, 0.8), '#6a5440'),
    paint(new THREE.BoxGeometry(0.02, 0.5, 0.8).translate(0, 6.2, 1.2), '#d8443a'),               // flag
  ]);
}

export function buildFishingVillage(kit, map, layout) {
  const V = VILLAGE, r = rng(909), col = h => new THREE.Color(h), c = V.colors;
  const decks = [], solids = [], in_ = (x, z, b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  const sea = map.sea, floorY = sea + V.house.floor;
  const addBaked = (geo, m) => { const a = geo.attributes.color; let i = 0; const tmp = new THREE.Color(); kit.add('wall', geo, m, () => tmp.fromBufferAttribute(a, i++)); };
  const boats = c.hulls.map(fishingBoatGeometry), longtail = longtailGeometry();
  const moor = (x, z, yaw, big = true) => {                          // a boat floating at (x, z), bow toward yaw
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, sea - 0.35, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    addBaked(big ? r.pick(boats) : longtail, m);
  };
  const postsDown = (f, u, w, top) => f.box('wall', u, top - 2.6, w, 0.26, 5.2, 0.26, col(c.post));

  // a wooden jetty from (x, z) straight out along (sx, sz), boats either side
  function jetty(x, z, sx, sz, len) {
    const ry = Math.atan2(sx, sz), f = kit.frame(x, 0, z, ry), top = Math.max(floorY - 0.3, map.heightAt(x, z) + 0.15), W = V.jetty.w;
    f.box('wall', 0, top - 0.12, len / 2, W, 0.24, len, col(c.deck));
    for (let w = 0; w <= len; w += 3) for (const u of [-W / 2 + 0.1, W / 2 - 0.1]) postsDown(f, u, w, top);
    f.box('wall', 0, top - 0.12, len - 1.5, 7, 0.24, 3, col(c.deck));           // a T at the end
    const mid = f.P(0, 0, len / 2), end = f.P(0, 0, len - 1.5);
    decks.push({ x: mid.x, z: mid.z, w: W, d: len, ry, top }, { x: end.x, z: end.z, w: 7, d: 3, ry, top });
    const n = Math.round(lerp(...V.jetty.boats, r()));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, w = len * (0.35 + 0.55 * (i / Math.max(1, n - 1))), p = f.P(side * (W / 2 + 2.1), 0, w);
      moor(p.x, p.z, ry + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.15, r() < 0.75);
    }
  }

  // one stilt house at (x, z), back over the water toward (sx, sz)
  function house(x, z, sx, sz, W, D) {
    const floorY = Math.max(sea + V.house.floor, map.heightAt(x, z) + 0.45);   // level with the road at the front
    const ry = Math.atan2(sx, sz), f = kit.frame(x, 0, z, ry), fl = Math.round(lerp(...V.house.floors, r() ** 1.5));
    const wall = col(r.pick(c.walls)), roof = col(r.pick(c.roofs)), H = fl * 2.8;
    for (let u = -W / 2 + 0.3; u <= W / 2 - 0.2; u += (W - 0.6) / 2) for (let w = 0.3; w <= D + 2.2; w += (D + 1.9) / 3) postsDown(f, u, w, floorY);
    f.box('wall', 0, floorY - 0.1, D / 2 + 1, W, 0.2, D + 2, col(c.deck));                        // floor + back deck
    f.box('wall', 0, floorY + H / 2, D / 2, W, H, D, wall);
    for (let k = 0; k < fl; k++) for (const u of [-W / 4, W / 4]) {                                 // windows front and back
      f.box('wall', u, floorY + 1.4 + k * 2.8, -0.02, 1.1, 0.9, 0.06, col(c.window));
      f.box('wall', u, floorY + 1.4 + k * 2.8, D + 0.02, 1.1, 0.9, 0.06, col(c.window));
    }
    f.box('wall', 0, floorY + 1.0, -0.03, 1.0, 2.0, 0.06, col(c.wood));                          // door to the road
    f.box('wall', 0, floorY + 0.55, D + 2, W, 0.08, 0.06, col(c.rail));                           // back-deck rail
    // gable roof, ridge along the shore (u); overhangs front and back
    const y0 = floorY + H, rise = 1.4, o = 0.6, w0 = -o, w1 = D + o, wm = D / 2, uL = -W / 2 - o, uR = W / 2 + o;
    f.tris2('wall', [uL, y0, w0, uR, y0, w0, uL, y0 + rise, wm, uL, y0 + rise, wm, uR, y0, w0, uR, y0 + rise, wm,
      uL, y0 + rise, wm, uR, y0 + rise, wm, uL, y0, w1, uL, y0, w1, uR, y0 + rise, wm, uR, y0, w1], roof);
    f.tris('wall', [-W / 2, y0, 0, W / 2, y0, 0, 0, y0 + rise, wm, W / 2, y0, D, -W / 2, y0, D, 0, y0 + rise, wm], wall);
    const ctr = f.P(0, 0, D / 2);
    solids.push({ x: ctr.x, z: ctr.z, r: Math.max(W, D) / 2 - 0.4, top: y0 + rise });
    if (r() < 0.35) { const p = f.P((r() - 0.5) * W, 0, D + 4); moor(p.x, p.z, ry + Math.PI / 2 + (r() - 0.5) * 0.4, false); }   // a longtail tied up behind
  }

  // ---- the village along the shore road: houses front onto the road and stand out over
  //      the water on stilts, in clusters with jetties between them ----
  const H = V.house, { seaDist, roadIdx, occ } = layout;
  for (const road of map.roads) {
    if (!V.roads.includes(road.k) || !road.p.some(([x, z]) => in_(x, z, V.shore))) continue;
    const hw = roadWidth(road.k) / 2;
    let left = 0, gap = 0, next = 0;
    walkLine(road.p, 1, (x, z, dx, dz) => {
      if (!in_(x, z, V.shore) || seaDist(x, z) > V.roadSea) { left = 0; return; }
      next -= 1;
      if (next > 0) return;
      let sx = -dz, sz = dx;                                          // toward the sea
      if (seaDist(x + sx * 8, z + sz * 8) > seaDist(x - sx * 8, z - sz * 8)) { sx = -sx; sz = -sz; }
      const fx = x + sx * (hw + H.front), fz = z + sz * (hw + H.front); // house front / jetty root
      if (!left && gap <= 0) left = Math.round(lerp(...H.cluster, r()));
      if (left > 0) {
        const W = lerp(...H.w, r()), D = lerp(...H.d, r()), ry = Math.atan2(sx, sz);
        if (roadIdx.clearance(fx + sx * D / 2, fz + sz * D / 2, 10) < D / 2 - 0.5 || occ.test(fx + sx * D / 2, fz + sz * D / 2, W / 2, D / 2, ry)) { next = 2; return; }
        house(fx, fz, sx, sz, W, D);
        occ.mark(fx + sx * D / 2, fz + sz * D / 2, W / 2, D / 2 + 1, ry);
        next = W + lerp(...H.gap, r());
        if (--left === 0) gap = 1;
      } else {                                                        // a jetty between clusters, out past the waterline
        let toWater = 0;
        while (toWater < 40 && map.heightAt(fx + sx * toWater, fz + sz * toWater) > map.sea - 0.5) toWater += 1;
        jetty(fx, fz, sx, sz, toWater + lerp(...V.jetty.len, r()));
        next = H.jettyGap + V.jetty.w; gap = 0;
      }
    });
  }

  // ---- the long pier off the north tip, boats moored along it ----
  {
    const Pp = V.pier, [px, pz] = Pp.from, [dx, dz] = Pp.dir, ry = Math.atan2(dx, dz), f = kit.frame(px, 0, pz, ry), top = floorY - 0.2;
    f.box('wall', 0, top - 0.2, Pp.len / 2, Pp.w, 0.4, Pp.len, col('#c9c3b6'));                 // concrete deck
    for (let w = 0; w <= Pp.len; w += 5) for (const u of [-Pp.w / 2 + 0.2, Pp.w / 2 - 0.2]) f.box('wall', u, top - 2.8, w, 0.45, 5.4, 0.45, col('#a8a298'));
    for (let w = 6; w <= Pp.len; w += 18) {                                                     // lamp posts
      const p = f.P(Pp.w / 2 - 0.3, top, w);
      kit.rod('wall', p, p.clone().setY(top + 4), 0.06, col('#4a5058'));
      kit.add('wall', new THREE.SphereGeometry(0.2, 8, 6), new THREE.Matrix4().setPosition(p.x, top + 4.1, p.z), col('#f4f0e2'));
    }
    if (Pp.hut) {                                                                              // shelter at the end
      f.box('wall', 0, top - 0.2, Pp.len + 3, 9, 0.4, 7, col('#c9c3b6'));
      for (const u of [-3.5, 3.5]) for (const w of [Pp.len + 0.5, Pp.len + 5.5]) f.box('wall', u, top + 1.4, w, 0.25, 2.8, 0.25, col('#e8e4d8'));
      f.box('wall', 0, top + 2.9, Pp.len + 3, 8.6, 0.12, 6.6, col('#3f9a8c'));
      const e = f.P(0, 0, Pp.len + 3);
      decks.push({ x: e.x, z: e.z, w: 9, d: 7, ry, top });
    }
    const mid = f.P(0, 0, Pp.len / 2);
    decks.push({ x: mid.x, z: mid.z, w: Pp.w, d: Pp.len, ry, top });
    for (let i = 0; i < Pp.boats; i++) {
      const side = i % 2 ? 1 : -1, w = 20 + (i >> 1) * ((Pp.len - 25) / (Pp.boats / 2)), p = f.P(side * (Pp.w / 2 + 2.2), 0, w + (i % 2) * 6);
      moor(p.x, p.z, ry + (i % 3 === 0 ? Math.PI : 0) + (r() - 0.5) * 0.1, i % 4 !== 3);
    }
  }
  return { decks, solids };
}
