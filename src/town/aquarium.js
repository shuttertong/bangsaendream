// The aquarium's exhibits inside the Institute of Marine Science (marine.js builds the building): wall tanks in the
// hall, the touch pool, the big tank with its glass tunnel, the eel tank (the glowing jellyfish room is jellyroom.js),
// and the animals in them (shared/aquarium.js: species and who lives where). Tank insides are lit (unaffected by the
// building's shade); animals are instanced per species and swim on loops, updated only while the kid is near.
// buildAquarium(kit, scene) → { labels, update(dt, time, p) }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES, TANKS, VISIT } from '../shared/aquarium.js';
import { sealifeGeometry } from './assets/sealife.js';
import { paintedMaterial } from '../world/materials.js';
import { MARINE, toWorld } from './marine.js';
import { rng } from './layout.js';
import { buildJellyRoom } from './jellyroom.js';

const M = MARINE, R = M.rooms;
export const EXHIBIT = {
  // wall tanks in the hall: [tank, side (+1 = +u wall), w centre]; each is a cabinet 4.2 m wide, glass from 0.7 to 2.7 m
  wall: [['reef', 1, -12.5], ['lion', 1, -21.5], ['seahorse', -1, -12.5], ['economic', -1, -21.5]],
  cabinet: { w: 4.2, depth: 1.45, base: 0.7, top: 2.7, at: 10.4 },
  eel: { u: -29.85, w: -17 },                 // the eel's cabinet on the jelly room's far wall (it faces +u)
  touch: [-3, 3, -20.5, -13.5],               // the touch pool (u0, u1, w0, w1)
  cylinder: { u: 16.5, w: -23.5, r: 1.5, h: 4, base: 0.6, water: '#1f6aa8' },                     // the tall round tank with a rock tower in it
  belt: { w: 1.4, color: '#22262c', edge: '#e8c23a' },                                             // the moving walkway down the tunnel
  water: { back: '#0a3a62', top: '#2a90c0', sand: '#b8ac86', big: '#062c4a', bigTop: '#2488b8' },   // deep enough that the animals stand out
  coral: ['#f07a6a', '#f4b23a', '#c86ad8', '#5fd0b0', '#f4f0e6', '#e85a9a'],
  shown: 0.24,                                // the smallest an animal is drawn (m): a 11 cm clownfish is lost behind 2 m of glass
};

/** A box of vertex-coloured lit panels for a tank's inside: gradient from `lo` at the bottom to `hi` at the top.
 *  open: the side the glass is on ('u0' | 'u1' | 'w0' | 'w1') — left out, or it hides everything inside. */
function litBox(kit, f, u0, u1, y0, y1, w0, w1, lo, hi, sand, open) {
  const cl = new THREE.Color(lo), ch = new THREE.Color(hi), cs = new THREE.Color(sand), tmp = new THREE.Color();
  const grad = (x, y) => tmp.copy(cl).lerp(ch, Math.min(1, Math.max(0, (y - M.level - y0) / (y1 - y0))));
  const t = 0.04;
  if (open !== 'w0') f.box('lit', (u0 + u1) / 2, (y0 + y1) / 2, w0 - t / 2, u1 - u0, y1 - y0, t, grad);   // the sides (but the glass one) and the top glow
  if (open !== 'w1') f.box('lit', (u0 + u1) / 2, (y0 + y1) / 2, w1 + t / 2, u1 - u0, y1 - y0, t, grad);
  if (open !== 'u0') f.box('lit', u0 - t / 2, (y0 + y1) / 2, (w0 + w1) / 2, t, y1 - y0, w1 - w0, grad);
  if (open !== 'u1') f.box('lit', u1 + t / 2, (y0 + y1) / 2, (w0 + w1) / 2, t, y1 - y0, w1 - w0, grad);
  f.box('lit', (u0 + u1) / 2, y1 + t / 2, (w0 + w1) / 2, u1 - u0, t, w1 - w0, ch);
  f.box('lit', (u0 + u1) / 2, y0 + 0.05, (w0 + w1) / 2, u1 - u0, 0.1, w1 - w0, cs);           // sand
}

export function buildAquarium(kit, scene) {
  const f = kit.frame(M.at[0], M.level, M.at[1], M.ry), E = EXHIBIT, X = E.water, r = rng(4711), col = h => new THREE.Color(h);
  const glass = [], labels = [], swimmers = [], rects = [], floor = M.building.floor;
  const solid = (u0, u1, w0, w1, h) => { const [x, z] = toWorld((u0 + u1) / 2, (w0 + w1) / 2); rects.push({ x, z, w: u1 - u0, d: w1 - w0, ry: M.ry, top: M.level + h }); };
  const pane = (u, y, w, sx, sy, sz) => { const [x, z] = toWorld(u, w); glass.push(new THREE.BoxGeometry(sx, sy, sz).applyMatrix4(new THREE.Matrix4().makeRotationY(M.ry).setPosition(x, M.level + y, z))); };
  const rock = (u, y, w, s, hex = '#8a7a66') => { const [x, z] = toWorld(u, w); kit.add('wall', new THREE.DodecahedronGeometry(s, 0).scale(1.2, 0.7, 1), new THREE.Matrix4().makeRotationY(r() * 6).setPosition(x, M.level + y, z), col(hex)); };
  const coral = (u, y, w, s) => { const [x, z] = toWorld(u, w), c = col(r.pick(E.coral)); for (let k = 0; k < 4; k++) { const a = r() * 6.28, h = s * (0.6 + r() * 0.8); kit.rod('lit', new THREE.Vector3(x, M.level + y, z), new THREE.Vector3(x + Math.cos(a) * s * 0.4, M.level + y + h, z + Math.sin(a) * s * 0.4), s * 0.08, c); } };
  /** Put the animals of a tank on loops inside a box (local u0..u1, y0..y1, w0..w1). tunnel: { u, y } — below y, keep |u| beyond u (loop to one side). */
  const stock = (tank, box, tunnel = null) => {
    for (const [id, n] of TANKS[tank]) for (let k = 0; k < n; k++) {
      const s = SPECIES[id], [u0, u1, y0, y1, w0, w1] = box, bottom = ['crab', 'lobster', 'starfish', 'cucumber'].includes(s.model) || id === 'bambooShark';
      const half = Math.max(0.12, s.size * 0.55), cu = (u0 + u1) / 2, cw = (w0 + w1) / 2;
      let ru = Math.max(0.05, (u1 - u0) / 2 - half), rw = Math.max(0.05, (w1 - w0) / 2 - half), y = bottom ? y0 + s.size * 0.18 + 0.05 : y0 + half + r() * Math.max(0.01, y1 - y0 - 2 * half), ou = 0;
      ru *= 0.35 + r() * 0.65; rw *= 0.5 + r() * 0.5;
      if (tunnel && y < tunnel.y + half) { ou = (r() < 0.5 ? -1 : 1) * (tunnel.u + u1) / 2; ru = Math.min(ru, (u1 - tunnel.u) / 2 - half); }   // low in the big tank: loop to one side of the tunnel
      swimmers.push({ id, model: s.model, cu: cu + ou, cw, ru, rw, y, bob: bottom ? 0 : 0.05 + r() * 0.12, sp: (bottom ? 0.04 : s.model === 'seahorse' ? 0.08 : 0.25 + r() * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * 6.28 });
    }
  };

  // ---- the hall's wall tanks: a cabinet, the lit inside, rocks and coral, the glass ----
  const Cb = E.cabinet;
  for (const [tank, sd, wc] of E.wall) {
    const uIn = sd * Cb.at, uOut = sd * (Cb.at + Cb.depth), u0 = Math.min(uIn, uOut), u1 = Math.max(uIn, uOut), w0 = wc - Cb.w / 2, w1 = wc + Cb.w / 2;
    f.box('wall', (u0 + u1) / 2, (floor + Cb.base) / 2, wc, Cb.depth, Cb.base - floor, Cb.w + 0.2, col('#2a3440'));   // base
    f.box('wall', (u0 + u1) / 2, Cb.top + 0.3, wc, Cb.depth, 0.6, Cb.w + 0.2, col('#2a3440'));                         // the hood
    litBox(kit, f, u0 + 0.02, u1 - 0.02, Cb.base, Cb.top, w0 + 0.02, w1 - 0.02, X.back, X.top, X.sand, sd > 0 ? 'u0' : 'u1');
    for (let k = 0; k < 3; k++) rock(sd > 0 ? u1 - 0.4 : u0 + 0.4, Cb.base + 0.15, w0 + 0.6 + k * 1.4, 0.25 + r() * 0.15);   // against the back
    solid(u0, u1, w0 - 0.1, w1 + 0.1, Cb.top + 0.6);
    for (let k = 0; k < 7; k++) coral(sd > 0 ? u1 - 0.25 - r() * 0.5 : u0 + 0.25 + r() * 0.5, Cb.base + 0.1, w0 + 0.3 + k * 0.6, 0.3 + r() * 0.25);
    pane(uIn, (Cb.base + Cb.top) / 2, wc, 0.03, Cb.top - Cb.base, Cb.w);
    stock(tank, [u0 + 0.12, u1 - 0.12, Cb.base + 0.12, Cb.top - 0.1, w0 + 0.15, w1 - 0.15]);
    labels.push({ tank, u: uIn - sd * 0.7, w: wc, plate: { u: uIn - sd * 0.01, y: 0.38, w: wc + Cb.w / 2 - 0.8, face: [-sd, 0] } });
  }
  // the eel's cabinet in the jelly room (fresh water: a darker, greener tank)
  { const u0 = E.eel.u, u1 = u0 + Cb.depth, wc = E.eel.w, w0 = wc - Cb.w / 2, w1 = wc + Cb.w / 2;
    f.box('wall', (u0 + u1) / 2, (floor + Cb.base) / 2, wc, Cb.depth, Cb.base - floor, Cb.w + 0.2, col('#1a2028'));
    f.box('wall', (u0 + u1) / 2, Cb.top + 0.3, wc, Cb.depth, 0.6, Cb.w + 0.2, col('#1a2028'));
    litBox(kit, f, u0 + 0.02, u1 - 0.02, Cb.base, Cb.top, w0 + 0.02, w1 - 0.02, '#1f4a3a', '#5f9a6a', '#8a7a5a', 'u1');
    for (let k = 0; k < 4; k++) rock(u0 + 0.5, Cb.base + 0.15, w0 + 0.5 + k * 1.1, 0.3, '#5a5040');
    pane(u1, (Cb.base + Cb.top) / 2, wc, 0.03, Cb.top - Cb.base, Cb.w);
    solid(u0, u1, w0 - 0.1, w1 + 0.1, Cb.top + 0.6);
    stock('eel', [u0 + 0.15, u1 - 0.15, Cb.base + 0.1, Cb.base + 0.6, w0 + 0.3, w1 - 0.3]);
    labels.push({ tank: 'eel', u: u1 + 0.7, w: wc, plate: { u: u1 + 0.01, y: 0.38, w: wc + Cb.w / 2 - 0.8, face: [1, 0] } });
  }

  // ---- the touch pool in the middle of the hall: a stone rim, shallow water, starfish and sea cucumbers ----
  { const [u0, u1, w0, w1] = E.touch, h = 0.75, t = 0.35, stone = col('#b8ad9a');
    f.box('wall', (u0 + u1) / 2, h / 2, w0 + t / 2, u1 - u0, h, t, stone); f.box('wall', (u0 + u1) / 2, h / 2, w1 - t / 2, u1 - u0, h, t, stone);
    f.box('wall', u0 + t / 2, h / 2, (w0 + w1) / 2, t, h, w1 - w0 - 2 * t, stone); f.box('wall', u1 - t / 2, h / 2, (w0 + w1) / 2, t, h, w1 - w0 - 2 * t, stone);
    f.box('wall', (u0 + u1) / 2, floor + 0.12, (w0 + w1) / 2, u1 - u0 - 2 * t, 0.06, w1 - w0 - 2 * t, col('#a89870'));
    for (let k = 0; k < 5; k++) rock(u0 + 0.8 + r() * (u1 - u0 - 1.6), floor + 0.2, w0 + 0.8 + r() * (w1 - w0 - 1.6), 0.25, '#7a6a58');
    pane((u0 + u1) / 2, h - 0.16, (w0 + w1) / 2, u1 - u0 - 2 * t, 0.02, w1 - w0 - 2 * t);       // the water's surface
    solid(u0, u1, w0, w1, h);
    stock('touch', [u0 + t + 0.25, u1 - t - 0.25, floor + 0.15, floor + 0.3, w0 + t + 0.25, w1 - t - 0.25]);
    labels.push({ tank: 'touch', u: 0, w: w1 + 0.7, plate: { u: 1.6, y: h + 0.28, w: w1 - 0.18, face: [0, 1], flat: true } });   // standing on the rim
  }

  // ---- the big tank and the tunnel through it ----
  { const [u0, u1, w0, w1] = R.big, t = M.tunnel, top = 5.6, low = floor + 0.05;
    litBox(kit, f, u0 + 0.2, u1 - 0.2, low - 0.15, top, w0 + 0.25, w1 - 0.05, X.big, X.bigTop, X.sand, 'w1');   // (its sand lies just under the tunnel's walkway)
    for (let k = 0; k < 14; k++) { const side = k % 2 ? 1 : -1; rock(side * (t.u + 1.6 + r() * 7), low + 0.3, w0 + 2 + r() * 16, 0.5 + r() * 0.9, r.pick(['#8a7a66', '#9a8a72', '#6f6454'])); }
    for (let k = 0; k < 10; k++) { const side = k % 2 ? 1 : -1; coral(side * (t.u + 1.2 + r() * 8), low + 0.15, w0 + 1.5 + r() * 17, 0.6); }
    // the front: a sill, two big windows either side of the tunnel's mouth, the wall above
    for (const sd of [-1, 1]) {
      const a = sd * (t.u + 0.4), b = sd * (u1 - 0.3), mid = (a + b) / 2, wd = Math.abs(b - a);
      f.box('wall', mid, 0.25, w1, wd, 0.5, 0.4, col('#2a3440'));
      pane(mid, 2.85, w1 - 0.02, wd, 4.7, 0.04);
      f.box('wall', sd * (t.u + 0.2), 3.2, w1, 0.4, 6.4, 0.5, col('#2a3440'));                  // the mouth's pillars
    }
    f.box('wall', 0, 5.85, w1, u1 - u0, 1.3, 0.4, col('#2a3440'));
    // the tunnel: a glass half-tube on low walls, a walkway, a glass end
    const tube = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);   // the upper half of a tube along z
    { const len = w1 - t.end, [x, z] = toWorld(0, (w1 + t.end) / 2); glass.push(tube.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, M.level + floor + 0.4, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), M.ry), new THREE.Vector3(t.u + 0.15, t.h - 0.4, len)))); }
    for (let w = w1 - 2; w > t.end; w -= 2.5) { const arc = new THREE.TorusGeometry(1, 0.05, 4, 16, Math.PI).scale(t.u + 0.16, t.h - 0.4, 1), [x, z] = toWorld(0, w); kit.add('metal', arc, new THREE.Matrix4().makeRotationY(M.ry).setPosition(x, M.level + floor + 0.4, z), col('#c9ced2')); }   // its ribs
    for (const sd of [-1, 1]) f.box('wall', sd * (t.u + 0.1), floor + 0.2, (w1 + t.end) / 2, 0.25, 0.4, w1 - t.end, col('#2a3440'));
    f.box('wall', 0, floor + 0.01, (w1 + t.end) / 2, 2 * t.u, 0.02, w1 - t.end, col('#3a4a5a'));            // the walkway
    { const Bt = E.belt, mid = (w1 + t.end) / 2, len = w1 - t.end - 2;                                   // the moving walkway down its middle (as in the real tunnel; here it does not move)
      f.box('wall', 0, floor + 0.03, mid, Bt.w, 0.03, len, col(Bt.color));
      for (const sd of [-1, 1]) f.box('wall', sd * (Bt.w / 2 + 0.04), floor + 0.035, mid, 0.07, 0.04, len, col(Bt.edge));
      for (let w = mid - len / 2 + 0.3; w < mid + len / 2; w += 0.6) f.box('wall', 0, floor + 0.047, w, Bt.w - 0.1, 0.006, 0.05, col('#3a4048'));
      for (const e of [-1, 1]) f.box('metal', 0, floor + 0.04, mid + e * (len / 2 + 0.2), Bt.w + 0.3, 0.05, 0.4, col('#aab2b8')); }
    pane(0, floor + t.h / 2, t.end - 0.02, 2 * t.u + 0.3, t.h, 0.04);
    stock('big', [u0 + 0.6, u1 - 0.6, low + 0.15, top - 0.3, w0 + 0.8, w1 - 0.6], { u: t.u + 0.55, y: floor + t.h + 0.3 });
    labels.push({ tank: 'big', u: 0, w: w1 + 1.2, plate: { u: t.u + 1.6, y: 0.51, w: w1 + 0.21, face: [0, 1], flat: true } });
    labels.push({ tank: 'big', u: 0, w: (w1 + t.end) / 2 });
  }

  // ---- the glowing jellyfish room (jellyroom.js): columns, the moon window, the green wall, the photo spot ----
  const colSolids = [], room = buildJellyRoom(kit, { glass, solid, rnd: r });
  colSolids.push(...room.solids); labels.push(...room.labels); scene.add(room.group);

  // ---- the tall round tank in the ocean hall: a tower of rock and coral, fish circling it ----
  const Cy = E.cylinder, [cyx, cyz] = toWorld(Cy.u, Cy.w), cyY = M.level + floor + Cy.base;
  kit.add('wall', new THREE.CylinderGeometry(Cy.r + 0.15, Cy.r + 0.25, Cy.base, 28), new THREE.Matrix4().setPosition(cyx, M.level + floor + Cy.base / 2, cyz), col('#141a26'));
  kit.add('wall', new THREE.CylinderGeometry(Cy.r + 0.15, Cy.r + 0.15, 0.5, 28), new THREE.Matrix4().setPosition(cyx, cyY + Cy.h + 0.25, cyz), col('#141a26'));
  for (let k = 0; k < 7; k++) { const s = 0.75 - k * 0.07, a = k * 2.1; kit.add('lit', new THREE.DodecahedronGeometry(s, 0).scale(1, 0.75, 1), new THREE.Matrix4().makeRotationY(a).setPosition(cyx + Math.cos(a) * 0.15, cyY + 0.3 + k * 0.5, cyz + Math.sin(a) * 0.15), col(k % 2 ? '#5a6a5e' : '#4a5a58')); }
  for (let k = 0; k < 16; k++) { const a = r() * 6.28, y = 0.3 + r() * 3.2, rr = 0.55 - y * 0.06, [lu, lw] = [Cy.u + Math.cos(a) * rr, Cy.w + Math.sin(a) * rr]; coral(lu, floor + Cy.base + y, lw, 0.3 + r() * 0.2); }
  const cylWater = new THREE.Mesh(new THREE.CylinderGeometry(Cy.r - 0.03, Cy.r - 0.03, Cy.h, 28, 1, true).translate(cyx, cyY + Cy.h / 2, cyz), new THREE.MeshBasicMaterial({ color: Cy.water, side: THREE.BackSide }));
  cylWater.name = 'cylinder-water'; scene.add(cylWater);
  glass.push(new THREE.CylinderGeometry(Cy.r, Cy.r, Cy.h, 28, 1, true).applyMatrix4(new THREE.Matrix4().setPosition(cyx, cyY + Cy.h / 2, cyz)));
  colSolids.push({ x: cyx, z: cyz, r: Cy.r + 0.25, top: cyY + Cy.h });
  for (const [id, n] of TANKS.cylinder) for (let k = 0; k < n; k++) { const rr = 0.95 + r() * 0.3; swimmers.push({ id, model: SPECIES[id].model, cu: Cy.u, cw: Cy.w, ru: rr, rw: rr, y: floor + Cy.base + 0.4 + r() * (Cy.h - 0.8), bob: 0.08, sp: (0.3 + r() * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * 6.28 }); }
  labels.push({ tank: 'cylinder', u: Cy.u, w: Cy.w + Cy.r + 1, plate: { u: Cy.u, y: 1.1, w: Cy.w + Cy.r + 0.9, face: [0, 1], stand: true } });

  // ---- the glass: one see-through mesh ----
  const glassMat = new THREE.MeshBasicMaterial({ color: '#c8eef6', transparent: true, opacity: 0.08, depthWrite: false });   // one side only: both sides of a pane doubled the veil and washed the tanks out
  const glassMesh = new THREE.Mesh(mergeGeometries(glass.map(g => (g.index ? g.toNonIndexed() : g)).map(g => { for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); return g; })), glassMat);
  glassMesh.renderOrder = 2; glassMesh.name = 'aquarium-glass';
  scene.add(glassMesh);

  // ---- the animals: one instanced mesh per species ----
  const mat = paintedMaterial({ amp: 0.04, scale: 1 });
  const meshes = {};
  for (const s of swimmers) (meshes[s.id] ||= { n: 0 }).n++;
  for (const [id, e] of Object.entries(meshes)) {
    const sz = SPECIES[id].size, k = sz < E.shown ? E.shown / sz : 1, geo = k > 1 ? sealifeGeometry(id, SPECIES[id]).clone().scale(k, k, k) : sealifeGeometry(id, SPECIES[id]);
    const m = new THREE.InstancedMesh(geo, mat, e.n);
    m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; m.name = `sea-${id}`;
    scene.add(m); e.mesh = m; e.k = 0;
  }
  for (const s of swimmers) { const e = meshes[s.id]; s.mesh = e.mesh; s.k = e.k++; }

  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1);
  const [cx, cz] = toWorld(0, -22);
  let shown = null;
  function place(t) {
    for (const s of swimmers) {
      const a = s.ph + t * s.sp, ca = Math.cos(a), sa = Math.sin(a);
      let u = s.cu + s.ru * ca, w = s.cw + s.rw * sa, y = s.y + s.bob * Math.sin(2 * a + s.ph);
      let du = -s.ru * sa * Math.sign(s.sp), dw = s.rw * ca * Math.sign(s.sp), roll = 0, sy = 1, sxz = 1;
      if (s.model === 'seahorse') { u = s.cu + 0.1 * ca; w = s.cw + s.rw * 0.6 * sa; du = Math.cos(s.ph); dw = Math.sin(s.ph); }
      else if (s.model === 'ray') roll = 0.22 * Math.sin(t * 1.8 + s.ph);
      else if (s.model === 'fish' || s.model === 'shark' || s.model === 'lionfish') roll = 0.05 * Math.sin(t * 6 + s.ph);
      const [x, z] = toWorld(u, w);
      q.setFromAxisAngle(up, M.ry + Math.atan2(du, dw));
      if (roll) q.multiply(qr.setFromAxisAngle(fwd, roll));
      s.mesh.setMatrixAt(s.k, mx.compose(pos.set(x, M.level + y, z), q, sc.set(sxz, sy, sxz)));
    }
    for (const e of Object.values(meshes)) e.mesh.instanceMatrix.needsUpdate = true;
  }
  place(0);

  return {
    labels, solids: colSolids, rects, photo: room.photo, room,
    update(dt, time, p) {
      const d = Math.hypot(p.x - cx, p.z - cz), on = d < 220;
      if (on !== shown) { shown = on; for (const e of Object.values(meshes)) e.mesh.visible = on; glassMesh.visible = room.group.visible = cylWater.visible = on; }
      if (d > VISIT.near) return;
      place(time);
      room.update(time);
    },
  };
}
