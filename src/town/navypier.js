// สะพานราชนาวี — the Royal Navy pier on the small point north-east of Laem Thaen: a wide
// concrete pier out to sea with white railings, lamps, bollards and benches, an anchor
// monument and flag poles at its root, a Thai sala pavilion at the far end and grey boats
// moored alongside (they bob, see boats.js). The pier is a walkable deck. The root is the
// northernmost OSM coastline point inside NAVY.find (no OSM pier there).
import * as THREE from 'three';
import { rng } from './layout.js';
import { fishingBoatGeometry } from './fishingvillage.js';

export const NAVY = {
  find: { x0: -1180, x1: -1030, z0: -1020, z1: -950 },
  dir: [0.15, -0.99],                          // out to sea (north)
  len: 105, w: 8, top: 2.2, sala: { w: 10, d: 10 }, arrive: 14,   // arrive: metres before the pier's root where travel sets the kid down
  boats: 4, hulls: [['#6f7a82', '#f4f2ec', '#2f4a8a'], ['#8d9aa3', '#f4f2ec', '#d8443a']],
  colors: { deck: '#cfc9bc', edge: '#bdb6a8', rail: '#f4f2ec', post: '#a8a298', lamp: '#4a5058', bollard: '#2e3338',
    anchor: '#3a4048', plinth: '#e8e4d8', salaPost: '#f4efe4', roof: '#c9542e', roof2: '#2f6a8a', gold: '#d8ac48', flag: ['#2f4a8a', '#f4f2ec', '#d8443a'] },
};

export function buildNavyPier(kit, map, layout, fleet) {
  const N = NAVY, r = rng(4411), col = h => new THREE.Color(h), c = N.colors, decks = [], solids = [];
  let root = null;
  for (const coast of map.coast) for (const [x, z] of coast.p) {
    if (x > N.find.x0 && x < N.find.x1 && z > N.find.z0 && z < N.find.z1 && (!root || z < root[1])) root = [x, z];
  }
  if (!root) return { decks, solids };
  const [dx, dz] = N.dir, ry = Math.atan2(dx, dz), f = kit.frame(root[0] - dx * 6, 0, root[1] - dz * 6, ry), top = map.sea + N.top;
  layout.occ.mark(root[0], root[1], 16, 16);

  // the deck, its edge beams and piles
  f.box('wall', 0, top - 0.25, N.len / 2, N.w, 0.5, N.len, col(c.deck));
  for (const u of [-N.w / 2, N.w / 2]) f.box('wall', u, top - 0.35, N.len / 2, 0.35, 0.7, N.len, col(c.edge));
  for (let w = 4; w <= N.len; w += 6) for (const u of [-N.w / 2 + 0.4, N.w / 2 - 0.4]) f.box('wall', u, top - 3, w, 0.55, 5.4, 0.55, col(c.post));
  for (let w = 0; w < N.len; w += 4) f.box('wall', 0, top + 0.005, w, N.w - 0.4, 0.01, 0.08, col(c.edge));   // expansion joints
  // a ramp from the beach up to the deck at the root
  {
    const ground = Math.max(map.heightAt(f.P(0, 0, -7).x, f.P(0, 0, -7).z), map.sea), rise = top - ground, run = 8, len = Math.hypot(run, rise);
    const g = new THREE.BoxGeometry(N.w - 1, 0.35, len).rotateX(-Math.atan2(rise, run));   // rises toward the deck (+w)
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(ry).setPosition(f.P(0, ground + rise / 2 - 0.15, -run / 2)), col(c.deck));
    for (const u of [-(N.w - 1) / 2, (N.w - 1) / 2]) kit.rod('wall', f.P(u, ground + 1, -run), f.P(u, top + 1, 0), 0.05, col(c.rail));
  }
  // railings, lamps, bollards, benches
  for (const u of [-N.w / 2 + 0.15, N.w / 2 - 0.15]) {
    f.box('wall', u, top + 1.0, N.len / 2, 0.1, 0.1, N.len, col(c.rail));
    f.box('wall', u, top + 0.5, N.len / 2, 0.06, 0.06, N.len, col(c.rail));
    for (let w = 1; w <= N.len; w += 2.5) f.box('wall', u, top + 0.5, w, 0.08, 1.0, 0.08, col(c.rail));
  }
  for (let w = 8; w <= N.len; w += 16) for (const u of [-N.w / 2 + 0.5, N.w / 2 - 0.5]) {
    const p = f.P(u, top, w);
    kit.rod('wall', p, p.clone().setY(top + 4.2), 0.07, col(c.lamp));
    kit.add('wall', new THREE.SphereGeometry(0.22, 8, 6), new THREE.Matrix4().setPosition(p.x, top + 4.35, p.z), col('#f4f0e2'));
    kit.add('wall', new THREE.CylinderGeometry(0.16, 0.2, 0.45, 8), new THREE.Matrix4().setPosition(f.P(u * 0.8, 0, w + 4).x, top + 0.22, f.P(u * 0.8, 0, w + 4).z), col(c.bollard));
    const bn = kit.frame(f.P(u * 0.62, 0, w + 8).x, top, f.P(u * 0.62, 0, w + 8).z, ry + (u > 0 ? -Math.PI / 2 : Math.PI / 2));
    bn.box('wall', 0, 0.45, 0, 1.8, 0.08, 0.45, col('#9a7a52')); for (const bu of [-0.7, 0.7]) bn.box('wall', bu, 0.22, 0, 0.1, 0.44, 0.4, col(c.lamp));
  }
  // the sala pavilion at the end: white posts, a two-tier Thai roof with gold ridge ends
  const S = N.sala, sw = N.len + S.d / 2 - 1;
  f.box('wall', 0, top - 0.25, sw, S.w + 1, 0.5, S.d + 1, col(c.deck));
  for (const u of [-S.w / 2 + 0.5, S.w / 2 - 0.5]) for (const w of [sw - S.d / 2 + 0.5, sw, sw + S.d / 2 - 0.5]) f.box('wall', u, top + 1.6, w, 0.35, 3.2, 0.35, col(c.salaPost));
  f.box('wall', 0, top + 3.3, sw, S.w + 0.6, 0.25, S.d + 0.6, col(c.gold));
  for (const [s, y, h, roofC] of [[1, top + 3.4, 1.6, c.roof], [0.62, top + 4.7, 1.5, c.roof2]]) {
    const g = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4).scale(S.w * 0.78 * s, h, S.d * 0.78 * s);
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(ry).setPosition(f.P(0, 0, sw).x, y + h / 2, f.P(0, 0, sw).z), col(roofC));
  }
  f.rod('wall', [0, top + 6.1, sw], [0, top + 7.3, sw], 0.08, col(c.gold));
  for (let k = 0; k < 3; k++) f.box('wall', 0, top + 0.3, sw - S.d / 2 + 2 + k * 3, S.w - 3, 0.1, 0.5, col('#9a7a52'));   // benches inside
  const salaMid = f.P(0, 0, sw);
  decks.push({ x: salaMid.x, z: salaMid.z, w: S.w + 1, d: S.d + 1, ry, top });
  const mid = f.P(0, 0, N.len / 2);
  decks.push({ x: mid.x, z: mid.z, w: N.w - 0.4, d: N.len, ry, top });

  // anchor monument + flag poles at the root (on land)
  const a = f.P(-N.w / 2 - 4, 0, 1), ay = Math.max(map.heightAt(a.x, a.z), map.sea + 0.3);
  kit.add('wall', new THREE.CylinderGeometry(1.8, 2.1, 1.0, 20), new THREE.Matrix4().setPosition(a.x, ay + 0.5, a.z), col(c.plinth));
  const af = kit.frame(a.x, ay + 1, a.z, ry + Math.PI / 2);
  af.box('wall', 0, 1.8, 0, 0.28, 3.4, 0.28, col(c.anchor));                                     // shank
  af.box('wall', 0, 3.1, 0, 1.6, 0.22, 0.25, col(c.anchor));                                     // stock
  kit.add('wall', new THREE.TorusGeometry(0.35, 0.08, 8, 16).rotateY(ry + Math.PI / 2), new THREE.Matrix4().setPosition(af.P(0, 3.75, 0)), col(c.anchor));
  const arc = new THREE.TorusGeometry(1.1, 0.13, 8, 20, Math.PI).rotateZ(Math.PI).rotateY(ry + Math.PI / 2);
  kit.add('wall', arc, new THREE.Matrix4().setPosition(af.P(0, 1.2, 0)), col(c.anchor));      // arms
  for (const s of [-1, 1]) kit.add('wall', new THREE.ConeGeometry(0.28, 0.6, 3).rotateZ(s * 0.6).rotateY(ry + Math.PI / 2), new THREE.Matrix4().setPosition(af.P(s * 1.05, 1.35, 0)), col(c.anchor));   // flukes
  solids.push({ x: a.x, z: a.z, r: 2.2, top: ay + 5 });
  for (let i = 0; i < 3; i++) {
    const p = f.P(N.w / 2 + 3 + i * 1.6, 0, 0), py = Math.max(map.heightAt(p.x, p.z), map.sea + 0.3);
    kit.rod('metal', p.clone().setY(py), p.clone().setY(py + 7.5), 0.05, col('#e8e8e4'));
    const fp = kit.frame(p.x, py, p.z, ry + Math.PI / 2);
    fp.box('wall', 0.6, 6.9, 0, 1.2, 0.75, 0.02, col(c.flag[i]));
    solids.push({ x: p.x, z: p.z, r: 0.12, top: py + 7.5 });
  }

  // grey boats moored along the pier (they bob)
  const geos = N.hulls.map(fishingBoatGeometry);
  for (let i = 0; i < N.boats; i++) {
    const side = i % 2 ? 1 : -1, w = 25 + (i >> 1) * 38, p = f.P(side * (N.w / 2 + 2.3), 0, w);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, map.sea - 0.35, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry + (r() < 0.5 ? 0 : Math.PI)), new THREE.Vector3(1.1, 1.1, 1.1));
    fleet.push({ geo: geos[i % geos.length], m });
  }
  return { decks, solids, root, place: { x: root[0] - dx * N.arrive, z: root[1] - dz * N.arrive, yaw: ry } };   // travel arrives on land, looking out along the pier
}
