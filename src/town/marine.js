// สถาบันวิทยาศาสตร์ทางทะเล มหาวิทยาลัยบูรพา — the Institute of Marine Science and its aquarium (ศูนย์เรียนรู้โลกใต้ทะเล
// บางแสน), as it is in 2026, at its real place from OSM (way 667865803, the aquarium node 12136124470, the fountain way
// 1555857927): 1.3 km inland on ถนนลงหาดบางแสน, the road that is closed in the game. It is reached only by the travel
// menu (no road opens to it): the site is its own walk zone behind a fence and a shut gate. A drive runs from the gate
// round the fountain to the aquarium; inside are a ticket hall, a hall of wall tanks with a touch pool, a glass tunnel
// through the big tank, a dark jellyfish room and a museum with a whale and a whale shark hanging from the ceiling.
// This module builds the site and the building's shell; aquarium.js the tanks, the animals and the visit.
// Local frame (kit.frame): u across the front, w toward the front (the fountain), origin at the middle of the facade.
import * as THREE from 'three';
import { SPECIES } from '../shared/aquarium.js';
import { sealifeGeometry } from './assets/sealife.js';
import { bakePerson, personMaterial } from './people/body.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MARINE = {
  at: [1606.8, 1101.1], ry: -2.9416,          // the facade's middle; the site's axes follow the institute's OSM outline (11° off north)
  level: 2.3, blend: 12,                      // the site is graded flat at this height, easing back to the ground over `blend` m
  site: { u: [-44, 44], w: [-52, 88] },       // the fenced, walkable grounds (the gate is at the far w)
  building: { u: [-30, 30], w: [-44, 0], height: 9, ceiling: 6.5, floor: 0.15 },
  fountain: { w: 16, r: 4.5, ring: [6.5, 11.5] },
  rooms: {                                    // [u0, u1, w0, w1]
    lobby: [-12, 12, -10, 0], hall: [-12, 12, -24, -10], big: [-12, 12, -44, -24], jelly: [-30, -12, -44, -10], museum: [12, 30, -44, -10],
  },
  turnstile: [-3.2, 3.2, -10],                // the gap in the lobby's back wall (u0, u1, w)
  tunnel: { u: 1.8, end: -41.5, h: 2.7 },
  colors: {
    wall: '#f4f2ec', trim: '#2f78c8', glass: '#5f8fa8', floor: '#d8d4ca', hallFloor: '#8a96a0', jellyWall: '#1c2a40', jellyFloor: '#26344a',
    museumWall: '#e8e2d4', paving: '#cfc9bc', paving2: '#bdb6a8', drive: '#5a5a58', kerb: '#d8d2c4', lawn: '#7aa64e', fence: '#3f6a52', post: '#9aa3a8',
    basin: '#e8e4da', water: '#5fb8c8', stone: '#a89a86', canopy: '#ffffff', counter: '#1f4f9a', rail: '#c9ced2',
    // from visitors' photos of the real place (2025–26): a long low building with a deep red-brown fascia over white fins
    // and columns, terracotta paving and steps, a brick fountain bed; a blue ticket hall; a dark-blue hall of white models
    fascia: '#8a4a32', fin: '#f6f4ee', window: '#34424e', tile: '#b8735a', tile2: '#9a5c46', brick: '#a8553c', shrub: ['#6f9a3a', '#a8b83a', '#4f8a3a'],
    ticketWall: '#2f8fc8', ticketWave: '#8fd0ec', ocean: '#1c38a0', oceanFloor: '#22305a', pad: ['#2f6fd8', '#5a9af0'], model: '#eef2f8',
  },
  facade: { floor2: 3.9, finTop: 7.4, finStep: 1.5, column: 6, overhang: 0.8 },
  oceanHall: {                                // white models under the ceiling: [species, u, w, height, yaw, scale]
    models: [['brydesWhale', 21, -30, 4.5, 0.08, 0.75], ['whaleShark', 22, -16.5, 4.9, Math.PI * 0.5, 0.8], ['ray', 16, -36, 4.9, 0.6, 1.6], ['ray', 26.5, -23, 5.2, -0.9, 1.4], ['ray', 25, -34, 5.5, 2.2, 1.2],
      ['brydesWhale', 26, -38, 4.4, 2.4, 0.2], ['brydesWhale', 15.5, -29, 3.9, 0.5, 0.2], ['brydesWhale', 16.5, -31, 4.3, 0.3, 0.17]],
    pad: [21, -24, 7, 9],                     // the glowing blue floor (u, w, size u, size w)
  },
};

const M = MARINE, B = M.building, cs = Math.cos(M.ry), sn = Math.sin(M.ry);
/** World (x, z) of a local (u, w). */
export const toWorld = (u, w) => [M.at[0] + u * cs + w * sn, M.at[1] - u * sn + w * cs];
/** Local (u, w) of a world (x, z). */
export const toLocal = (x, z) => { const dx = x - M.at[0], dz = z - M.at[1]; return [dx * cs - dz * sn, dx * sn + dz * cs]; };
const inRect = (u, w, [u0, u1, w0, w1]) => u >= u0 && u <= u1 && w >= w0 && w <= w1;
const smooth = t => t * t * (3 - 2 * t);

/** Grade the site flat (before the terrain is built): the campus is level, the DEM only roughly so. */
export function levelMarineSite(map) {
  const { x0, z0, step, nx, nz } = map.core, h = map.heights, [u0, u1] = M.site.u, [w0, w1] = M.site.w;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const [u, w] = toLocal(x0 + i * step, z0 + j * step), du = Math.max(u0 - u, u - u1, 0), dw = Math.max(w0 - w, w - w1, 0), d = Math.hypot(du, dw);
    if (d > M.blend) continue;
    const k = 1 - smooth(d / M.blend), n = j * nx + i;
    h[n] += (M.level - h[n]) * k;
  }
}

/** kit: the town's kit; roofKit: its own kit (the roof is hidden while the kid is inside). Returns what the town needs. */
export function buildMarine(kit, roofKit, scene, map, layout) {
  const col = hex => new THREE.Color(hex), C = M.colors, y0 = M.level, top = y0 + B.floor;
  const f = kit.frame(M.at[0], y0, M.at[1], M.ry), fr = roofKit.frame(M.at[0], y0, M.at[1], M.ry);
  const rects = [], solids = [], decks = [], trees = { palm: [], rainTree: [] };
  const wall = (u0, u1, w0, w1, h, color, v0 = 0, k = f) => {                        // a box from v0 to h, also solid
    k.box('wall', (u0 + u1) / 2, (v0 + h) / 2, (w0 + w1) / 2, u1 - u0, h - v0, w1 - w0, col(color));
    if (v0 < 1) { const [x, z] = toWorld((u0 + u1) / 2, (w0 + w1) / 2); rects.push({ x, z, w: u1 - u0, d: w1 - w0, ry: M.ry, top: y0 + h }); }
  };
  // reserve the grounds: the town's frontage rows and trees keep off
  { const [x, z] = toWorld(0, (M.site.w[0] + M.site.w[1]) / 2); layout.occ.mark(x, z, (M.site.u[1] - M.site.u[0]) / 2 + 2, (M.site.w[1] - M.site.w[0]) / 2 + 2, M.ry); }

  // ---- the grounds: forecourt, the drive, the fountain, lawns and palms, the shut gate, the fence ----
  f.box('wall', 0, 0.03, 4, 60, 0.12, 8, col(C.tile));                                          // the terrace in front: terracotta tiles
  for (let u = -29; u <= 29; u += 2) f.box('wall', u, 0.095, 4, 0.06, 0.01, 7.9, col(C.tile2));     // its joints
  for (let k = 0; k < 3; k++) f.box('wall', 0, 0.07 - k * 0.025, 8.3 + k * 0.6, 16 + k * 1.2, 0.05, 0.6, col(k % 2 ? C.tile : C.tile2));   // the wide steps down to the drive
  for (const sd of [-1, 1]) {                                                                    // a white railing along the terrace either side of the steps
    const a = sd * 8.6, b = sd * 30, mid = (a + b) / 2, len = Math.abs(b - a);
    for (const v of [0.55, 0.95]) f.box('metal', mid, v, 8, len, 0.06, 0.06, col(C.fin));
    for (let u = Math.min(a, b); u <= Math.max(a, b) + 0.01; u += 1.78) f.box('metal', u, 0.5, 8, 0.07, 0.95, 0.07, col(C.fin));
    const [x, z] = toWorld(mid, 8); rects.push({ x, z, w: len, d: 0.8, ry: M.ry, top: y0 + 1.2 });   // (wide enough to catch the 0.5 m collision cells)
  }
  f.box('road', 0, 0.02, (M.fountain.w + M.fountain.ring[1] + M.site.w[1]) / 2, 8, 0.08, M.site.w[1] - M.fountain.w - M.fountain.ring[1] + 0.5, col(C.drive));   // the drive
  for (const sd of [-1, 1]) {
    f.box('wall', sd * 5.6, 0.04, (M.fountain.w + M.site.w[1]) / 2 + 4, 2.4, 0.1, M.site.w[1] - M.fountain.w - 8, col(C.paving));   // footpaths
    f.box('wall', sd * 4.15, 0.08, (M.fountain.w + M.site.w[1]) / 2 + 4, 0.25, 0.16, M.site.w[1] - M.fountain.w - 8, col(C.kerb));
    for (let w = 30; w < M.site.w[1] - 4; w += 9) { const [x, z] = toWorld(sd * 7.6, w); trees.palm.push({ x, z, y: y0 - 0.15, rot: (w * 1.7) % 6.28, s: 0.95 }); }
  }
  { // the ring drive and the fountain in the middle
    const F = M.fountain, [r0, r1] = F.ring, ring = new THREE.RingGeometry(r0, r1, 48, 1).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
    f.add('road', ring, new THREE.Matrix4().makeRotationY(M.ry).setPosition(...(([x, z]) => [x, y0, z])(toWorld(0, F.w))), col(C.drive));
    const basin = new THREE.CylinderGeometry(F.r + 0.25, F.r + 0.35, 0.55, 40, 1, true), [fx, fz] = toWorld(0, F.w);
    kit.add('wall', basin, new THREE.Matrix4().setPosition(fx, y0 + 0.27, fz), col(C.brick));
    { // a brick bed of shrubs round the basin, and a golden shell on the spout
      const bed = new THREE.CylinderGeometry(F.r + 1.45, F.r + 1.5, 0.36, 40, 1, true);
      kit.add('wall', bed, new THREE.Matrix4().setPosition(fx, y0 + 0.18, fz), col(C.brick));
      kit.add('wall', new THREE.RingGeometry(F.r + 0.3, F.r + 1.45, 40).rotateX(-Math.PI / 2), new THREE.Matrix4().setPosition(fx, y0 + 0.34, fz), col('#5a4a3a'));
      for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, rr = F.r + 0.88, s = 0.36 + (k * 7 % 5) * 0.05; kit.add('wall', new THREE.DodecahedronGeometry(s, 1).scale(1.25, 0.8, 1.25), new THREE.Matrix4().setPosition(fx + Math.cos(a) * rr, y0 + 0.34 + s * 0.6, fz + Math.sin(a) * rr), col(C.shrub[k % 3])); }
      kit.add('metal', new THREE.SphereGeometry(0.42, 14, 10).scale(1, 0.8, 1), new THREE.Matrix4().setPosition(fx, y0 + 1.86, fz), col('#c8a84a'));
    }
    kit.add('wall', new THREE.TorusGeometry(F.r + 0.3, 0.12, 6, 40).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(fx, y0 + 0.56, fz), col(C.basin));
    kit.add('glass', new THREE.CircleGeometry(F.r + 0.25, 40).rotateX(-Math.PI / 2), new THREE.Matrix4().setPosition(fx, y0 + 0.42, fz), col(C.water));
    kit.add('wall', new THREE.CylinderGeometry(0.5, 0.7, 1.4, 16), new THREE.Matrix4().setPosition(fx, y0 + 0.7, fz), col(C.stone));
    kit.add('wall', new THREE.CylinderGeometry(1.4, 1.2, 0.2, 24), new THREE.Matrix4().setPosition(fx, y0 + 1.45, fz), col(C.basin));
    // a pair of dolphins leaping round the spout (the fountain's figures are simple shapes, not a copy of the real ones)
    const dol = sealifeGeometry('brydesWhale', SPECIES.brydesWhale).clone().scale(0.15, 0.15, 0.15);
    for (const a of [0, Math.PI]) kit.add('wall', dol, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(-0.7)).setPosition(fx + Math.cos(a) * 0.9, y0 + 2.3, fz + Math.sin(a) * 0.9), col('#9ab8c8'));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; kit.rod('lit', new THREE.Vector3(fx + Math.cos(a) * 1.1, y0 + 1.5, fz + Math.sin(a) * 1.1), new THREE.Vector3(fx + Math.cos(a) * 2.4, y0 + 0.5, fz + Math.sin(a) * 2.4), 0.03, col('#e8f6fa')); }   // jets of water
    solids.push({ x: fx, z: fz, r: F.r + 1.55, top: y0 + 0.6 });
  }
  // the shut gate on the road, the institute's sign beside it, a guard's booth
  { const w = M.site.w[1];
    for (let u = -6; u <= 6; u += 0.3) f.box('metal', u, 0.9, w, 0.05, 1.7, 0.05, col(C.post));
    for (const v of [0.12, 1.72]) f.box('metal', 0, v, w, 12.2, 0.08, 0.08, col(C.post));
    for (const sd of [-1, 1]) wall(sd * 6.4 - 0.4, sd * 6.4 + 0.4, w - 0.4, w + 0.4, 2.4, C.stone);
    wall(-17, -8.5, w - 0.5, w + 0.5, 3.6, C.stone); f.box('wall', -12.75, 3.7, w, 8.7, 0.2, 1.1, col(C.basin));   // the sign wall (marinevisit.js puts the name on both faces)
    wall(8.5, 11.5, w - 4, w - 1, 2.6, C.wall); f.box('wall', 10, 2.68, w - 2.5, 3.6, 0.2, 3.6, col(C.trim));   // the guard's booth (its roof on the walls)
  }
  // the fence round the grounds: a low wall, posts and two rails (the drive's gate is the only gap, and it is shut)
  { const [u0, u1] = M.site.u, [w0, w1] = M.site.w, run = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2.5));
      wall(Math.min(a[0], b[0]) - 0.12, Math.max(a[0], b[0]) + 0.12, Math.min(a[1], b[1]) - 0.12, Math.max(a[1], b[1]) + 0.12, 0.5, C.stone);
      for (let k = 0; k <= n; k++) { const u = a[0] + (b[0] - a[0]) * k / n, w = a[1] + (b[1] - a[1]) * k / n; f.box('metal', u, 1.05, w, 0.07, 1.1, 0.07, col(C.fence)); }
      for (const v of [1.0, 1.55]) f.box('metal', (a[0] + b[0]) / 2, v, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) + 0.05, 0.05, Math.abs(b[1] - a[1]) + 0.05, col(C.fence));
    };
    run([u0, w0], [u1, w0]); run([u0, w0], [u0, w1]); run([u1, w0], [u1, w1]); run([u0, w1], [-6.8, w1]); run([6.8, w1], [u1, w1]);
  }
  for (const [u, w] of [[-24, 40], [24, 44], [-30, 66], [28, 70], [-20, 78], [18, 60], [-34, 20], [34, 24], [-36, -48], [36, -48]]) { const [x, z] = toWorld(u, w); trees.rainTree.push({ x, z, y: y0 - 0.2, rot: u * 0.37, s: 0.8 }); }
  for (const u of [-14, -12, -10]) { const [x, z] = toWorld(u, 7.6); kit.rod('metal', new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y0 + 9, z), 0.05, col(C.post)); solids.push({ x, z, r: 0.12, top: y0 + 9 }); }   // flagpoles

  // ---- the building: floor (a walkable deck), outer walls, glass front, the wave canopy, rooms, ceiling, roof ----
  const [bu0, bu1] = B.u, [bw0, bw1] = B.w, H = B.height, IN = B.ceiling;
  f.box('wall', 0, (B.floor - 0.4) / 2, (bw0 + bw1) / 2, bu1 - bu0 + 0.2, B.floor + 0.4, bw1 - bw0 + 0.2, col(C.floor));
  { const [x, z] = toWorld(0, (bw0 + bw1) / 2); decks.push({ x, z, w: bu1 - bu0, d: bw1 - bw0, ry: M.ry, top }); }
  const R = M.rooms;
  f.box('wall', 0, B.floor + 0.005, (R.hall[2] + R.hall[3]) / 2, 24, 0.01, R.hall[3] - R.hall[2], col(C.hallFloor));          // the dim hall's floor
  f.box('wall', (R.jelly[0] + R.jelly[1]) / 2, B.floor + 0.005, (R.jelly[2] + R.jelly[3]) / 2, R.jelly[1] - R.jelly[0], 0.01, R.jelly[3] - R.jelly[2], col(C.jellyFloor));
  wall(bu0, bu1, bw0 - 0.2, bw0 + 0.2, H, C.wall); wall(bu0 - 0.2, bu0 + 0.2, bw0, bw1, H, C.wall); wall(bu1 - 0.2, bu1 + 0.2, bw0, bw1, H, C.wall);
  for (const sd of [-1, 1]) wall(Math.min(sd * 12, sd * 30), Math.max(sd * 12, sd * 30), -0.2, 0.2, H, C.wall);        // the solid sides of the front
  for (const sd of [-1, 1]) {                                                                   // the glass front of the hall, doors in the middle
    const u0 = sd > 0 ? 3 : -12, u1 = sd > 0 ? 12 : -3;
    f.box('glass', (u0 + u1) / 2, IN / 2, 0, u1 - u0, IN, 0.1, col(C.glass));
    for (let u = u0; u <= u1 + 0.01; u += 1.5) f.box('metal', u, IN / 2, 0.06, 0.08, IN, 0.12, col(C.rail));
    const [x, z] = toWorld((u0 + u1) / 2, 0); rects.push({ x, z, w: u1 - u0, d: 0.3, ry: M.ry, top: y0 + IN });
  }
  f.box('wall', 0, IN + (H - IN) / 2, 0, 24, H - IN, 0.4, col(C.wall));                       // above the glass
  { // the front as it really is: a colonnade below, a band of dark windows behind white fins above, a deep red-brown fascia
    const A = M.facade, o = A.overhang;
    f.box('wall', 0, A.floor2, 0.2 + o / 2, 60.6, 0.22, o + 0.4, col(C.fin));                    // the upper floor's slab
    for (const sd of [-1, 1]) f.box('wall', sd * 21, (A.floor2 + A.finTop) / 2, 0.24, 18, A.finTop - A.floor2, 0.1, col(C.window));
    f.box('wall', 0, (IN + A.finTop) / 2, 0.24, 24, A.finTop - IN, 0.1, col(C.window));
    for (let u = -30; u <= 30.01; u += A.finStep) f.box('wall', u, (A.floor2 + A.finTop) / 2, 0.2 + o / 2, 0.18, A.finTop - A.floor2, o, col(C.fin));
    f.box('wall', 0, (A.finTop + H) / 2 + 0.1, 0.2 + o / 2, 60.8, H - A.finTop + 0.2, o + 0.5, col(C.fascia));
    for (let u = -27; u <= 27.01; u += A.column) { f.box('wall', u, A.floor2 / 2, o + 0.1, 0.42, A.floor2, 0.42, col(C.fin)); const [x, z] = toWorld(u, o + 0.1); solids.push({ x, z, r: 0.3, top: y0 + A.floor2 }); }
  }
  // rooms: the lobby's back wall (the turnstile gap), the hall's sides (doors to the wings), the wings' walls
  const [tu0, tu1, tw] = M.turnstile, door = [-19, -15], T = 0.15;
  wall(R.lobby[0], tu0, tw - T, tw + T, IN, C.wall); wall(tu1, R.lobby[1], tw - T, tw + T, IN, C.wall);
  for (const sd of [-1, 1]) {
    const u = sd * 12;
    wall(Math.min(u, sd * 30), Math.max(u, sd * 30), tw - T, tw + T, IN, C.wall);               // wing / front blocks
    wall(u - T, u + T, R.hall[2], door[0], IN, C.wall); wall(u - T, u + T, door[1], tw, IN, C.wall);
    wall(u - T, u + T, R.big[2], R.big[3], IN, C.wall);
    wall(Math.min(u, sd * 30), Math.max(u, sd * 30), -10 + T, -0.2, IN, sd > 0 ? '#e8d8c0' : '#d8e8e0');   // the shop and café at the front: closed blocks
  }
  { // the big tank fills the back of the hall: solid but for the tunnel
    const t = M.tunnel;
    for (const sd of [-1, 1]) { const u0 = sd > 0 ? t.u : R.big[0], u1 = sd > 0 ? R.big[1] : -t.u, [x, z] = toWorld((u0 + u1) / 2, (R.big[2] + R.big[3]) / 2); rects.push({ x, z, w: u1 - u0, d: R.big[3] - R.big[2], ry: M.ry, top: y0 + IN }); }
    const [x, z] = toWorld(0, (R.big[2] + t.end) / 2); rects.push({ x, z, w: 2 * t.u, d: t.end - R.big[2], ry: M.ry, top: y0 + IN });
  }
  { const ceil = new THREE.PlaneGeometry(bu1 - bu0, bw1 - bw0).rotateX(Math.PI / 2);          // faces down: seen from inside only
    f.add('lit', ceil, new THREE.Matrix4().makeRotationY(M.ry).setPosition(...(([x, z]) => [x, y0 + IN, z])(toWorld(0, (bw0 + bw1) / 2))), col('#5a666e')); }   // (lit: a down-facing panel gets no sun)
  fr.box('wall', 0, H + 0.1, (bw0 + bw1) / 2, bu1 - bu0 + 0.5, 0.25, bw1 - bw0 + 0.5, col('#d8d8d2'));   // the roof (hidden from inside)
  for (const [u, w] of [[-18, -22], [0, -34], [18, -22]]) fr.box('metal', u, H + 0.7, w, 4, 1.2, 3, col('#a8b0b4'));   // plant on the roof
  fr.box('wall', 0, H + 0.4, bw1 + 0.05, bu1 - bu0 + 0.5, 0.6, 0.3, col(C.wall));

  // ---- the ticket counter, its clerk and the turnstiles ----
  f.box('wall', 8, 0.55, -5, 1.2, 1.1, 4.4, col(C.counter)); f.box('wall', 8, 1.12, -5, 1.4, 0.06, 4.6, col('#f4f4f0'));   // along the lobby's side, facing the way in
  { const [x, z] = toWorld(8, -5); rects.push({ x, z, w: 1.2, d: 4.4, ry: M.ry, top: y0 + 1.2 }); }
  { // the ticket hall as it is: a blue wall with a wave across it, round ticket windows over the counter
    f.box('wall', 11.8, IN / 2, -5, 0.06, IN - 0.1, 9.4, col(C.ticketWall));
    for (let k = 0; k < 30; k++) { const w = -9.6 + k * 0.31; f.box('wall', 11.75, 3.55 + Math.sin(k * 0.42) * 0.32, w, 0.04, 0.5, 0.32, col(C.ticketWave)); }
    f.box('glass', 8, 1.85, -5, 0.05, 1.45, 4.4, col(C.glass));
    const hole = new THREE.TorusGeometry(0.42, 0.07, 8, 24).rotateY(Math.PI / 2);
    for (const w of [-6.3, -5, -3.7]) { const [x, z] = toWorld(7.94, w); kit.add('wall', hole, new THREE.Matrix4().makeRotationY(M.ry).setPosition(x, y0 + 1.75, z), col(C.fin)); }
  }
  const clerk = new THREE.Mesh(bakePerson({ scale: 1.3, headScale: 0.9, skin: '#c8956a', hair: '#2a2420', hairStyle: 'bun', shirt: '#2f78c8', outfit: 'work', hat: 'none', smile: 'smile', print: 'none' }, null, 0.5), personMaterial);
  { const [x, z] = toWorld(9.4, -5); clerk.position.set(x, top, z); clerk.rotation.y = M.ry - Math.PI / 2; clerk.castShadow = true; scene.add(clerk); }   // behind it, facing the visitors
  for (let u = tu0; u <= tu1 + 0.01; u += (tu1 - tu0) / 3) f.box('metal', u, 0.5, tw, 0.25, 1.0, 0.5, col(C.rail));   // turnstile posts
  const arms = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: '#d8443a' }));   // the barrier arms (gone once the kid has a ticket)
  { const g = [], span = (tu1 - tu0) / 3; for (let k = 0; k < 3; k++) { const [x, z] = toWorld(tu0 + span * (k + 0.5), tw); g.push(new THREE.BoxGeometry(span - 0.25, 0.06, 0.06).applyMatrix4(new THREE.Matrix4().makeRotationY(M.ry).setPosition(x, top + 0.85, z))); }
    arms.geometry.dispose(); arms.geometry = mergeGeometries(g); arms.name = 'turnstile-arms'; scene.add(arms); }
  const gate = (() => { const [x, z] = toWorld(0, tw); return { x, z, w: tu1 - tu0, d: 0.5, ry: M.ry, top: y0 + 1.0 }; })();

  // ---- the ocean hall (the museum wing): dark-blue walls, a glowing blue floor, white models of whales, rays and
  // dolphins under the ceiling, a rocky shore display ----
  const C2 = new THREE.Color(), O = M.oceanHall;
  { const [u0, u1, w0, w1] = R.museum, ocean = col(C.ocean), t = 0.05, g = 0.22, hh = IN - 0.05;
    const clad = (a, b, c, d) => f.box('lit', (a + b) / 2, hh / 2, (c + d) / 2, b - a, hh, d - c, ocean);   // (lit: the hall glows blue whatever the sun does)
    clad(u0 + g, u1 - g, w0 + g, w0 + g + t); clad(u0 + g, u1 - g, w1 - g - t, w1 - g); clad(u1 - g - t, u1 - g, w0 + g, w1 - g);
    clad(u0 + g, u0 + g + t, w0 + g, door[0]); clad(u0 + g, u0 + g + t, door[1], w1 - g);          // (the doorway stays open)
    const pl = new THREE.PlaneGeometry(u1 - u0 - 0.4, w1 - w0 - 0.4).rotateX(Math.PI / 2), [x, z] = toWorld((u0 + u1) / 2, (w0 + w1) / 2);
    f.add('lit', pl, new THREE.Matrix4().makeRotationY(M.ry).setPosition(x, y0 + IN - 0.03, z), col('#14246a'));
    f.box('wall', (u0 + u1) / 2, B.floor + 0.005, (w0 + w1) / 2, u1 - u0, 0.01, w1 - w0, col(C.oceanFloor));
    const [pu, pw, su, sw] = O.pad;
    f.box('lit', pu, B.floor + 0.012, pw, su, 0.01, sw, col(C.pad[0])); f.box('lit', pu, B.floor + 0.018, pw, su - 1.6, 0.01, sw - 1.6, col(C.pad[1]));
  }
  const hang = (id, u, w, y, yaw, k = 1) => {
    const s = SPECIES[id], g = k === 1 ? sealifeGeometry(id, s) : sealifeGeometry(id, s).clone().scale(k, k, k), L = s.size * k, [x, z] = toWorld(u, w);
    kit.add('wall', g, new THREE.Matrix4().makeRotationY(M.ry + yaw).setPosition(x, y0 + y, z), col(C.model), { x, z });
    for (const d of [-L * 0.25, L * 0.25]) { const [cx, cz] = toWorld(u + Math.sin(yaw) * d, w + Math.cos(yaw) * d); kit.rod('metal', new THREE.Vector3(cx, y0 + y + L * 0.03, cz), new THREE.Vector3(cx, y0 + IN, cz), 0.012, col('#8a8a8a')); }
  };
  for (const m of O.models) hang(...m);
  { const [x, z] = toWorld(21, -40.5); kit.add('wall', new THREE.DodecahedronGeometry(1, 0).scale(5, 0.9, 2.2), new THREE.Matrix4().setPosition(x, y0 + 0.4, z), col(C.stone)); rects.push({ x, z, w: 10, d: 4.4, ry: M.ry, top: y0 + 1.2 }); }
  for (const [u, w] of [[18.5, -40], [20, -41.2], [22.4, -39.8], [24, -40.8]]) { const g = sealifeGeometry('crab', SPECIES.crab), c = g.attributes.color, [x, z] = toWorld(u, w); let v = 0; kit.add('wall', g, new THREE.Matrix4().makeRotationY(u).setPosition(x, y0 + 1.25, z), () => C2.fromBufferAttribute(c, v++), { x, z }); }

  const [px, pz] = toWorld(-7, M.fountain.w + 9);
  return {
    place: { x: px, z: pz, yaw: Math.atan2(-sn, -cs) },                 // north of the fountain, facing the aquarium
    rects, solids, decks, trees, gate, top, arms, clerk,
    walkPoly: [toWorld(M.site.u[0] + 0.4, M.site.w[0] + 0.4), toWorld(M.site.u[1] - 0.4, M.site.w[0] + 0.4), toWorld(M.site.u[1] - 0.4, M.site.w[1] - 0.6), toWorld(M.site.u[0] + 0.4, M.site.w[1] - 0.6)],
    inside: (x, z) => inRect(...toLocal(x, z), [bu0, bu1, bw0, bw1]),
  };
}
