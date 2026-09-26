// Houses: detached Thai houses with hip roofs (clay tile or metal sheet), spirit houses
// (ศาลพระภูมิ), and extruded OSM footprints with windows.
import * as THREE from 'three';
import { BUILDING as B } from '../../shared/palette.js';

const FLOOR = 3.2;
const col = hex => new THREE.Color(hex);

/** Hip roof over a W×D rectangle in frame f, eaves at height y, overhang o. */
export function hipRoof(f, mat, W, D, y, rise, o, color) {
  const hw = W / 2 + o, hd = D / 2 + o, T = y + rise;
  const r = Math.abs(hw - hd);                       // half ridge length
  const FL = [-hw, y, hd], FR = [hw, y, hd], BR = [hw, y, -hd], BL = [-hw, y, -hd];
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  if (W >= D) {                                      // ridge along u
    const Rp = [r, T, 0], Rm = [-r, T, 0];
    quad(FL, FR, Rp, Rm); quad(BR, BL, Rm, Rp); tri(FR, BR, Rp); tri(BL, FL, Rm);
  } else {                                           // ridge along w
    const Rp = [0, T, r], Rm = [0, T, -r];
    tri(FL, FR, Rp); tri(BR, BL, Rm); quad(FR, BR, Rm, Rp); quad(BL, FL, Rp, Rm);
  }
  f.tris(mat, v, color);
  // soffit so the overhang isn't see-through from below
  f.box('wall', 0, y - 0.04, 0, 2 * hw, 0.08, 2 * hd, col('#e8e2d4'));
}

function windowsOnFace(f, r, W, floors, w, sideU = 0, rot = 0) {
  for (let k = 0; k < floors; k++) {
    const y = k * FLOOR + 1.55;
    for (let u = -W / 2 + 1.4; u <= W / 2 - 1.2; u += 2.6 + r() * 0.6) {
      f.box('wall', sideU + u, y, w + 0.02, 1.3, 1.45, 0.06, col(B.frame), rot);
      f.box('glass', sideU + u, y, w + 0.05, 1.1, 1.25, 0.04, col(B.glass), rot);
    }
  }
}

/** Detached house, front centre at (x, z) facing ry. */
export function house(kit, r, { x, y, z, ry, W = 8, D = 9, floors = 1 }) {
  const f = kit.frame(x, y, z, ry);
  const wall = col(r.pick(B.houseWalls)), H = floors * FLOOR;
  f.box('wall', 0, H / 2 - 0.5, 0, W, H + 1, D, wall);
  f.box('wall', 0, 0.1, D / 2 + 1.1, W * 0.6, 0.35, 2.2, col(B.concrete));             // porch slab
  f.box('wall', -W * 0.15, 1.1, D / 2 + 0.03, 1.0, 2.2, 0.08, col('#8a5a3a'));          // door
  windowsOnFace(f, r, W, floors, D / 2);
  const tile = r.chance(0.55);
  hipRoof(f, tile ? 'wall' : 'metal', W, D, H, tile ? 2.4 : 1.6, 0.7,
    col(r.pick(tile ? B.tileRoofs : B.metalRoofs)));
  // porch roof on posts
  for (const s of [-1, 1]) f.box('wall', s * W * 0.28, 1.4, D / 2 + 2.0, 0.18, 2.8, 0.18, col(B.trim[0]));
  f.box('metal', 0, 2.85, D / 2 + 1.2, W * 0.66, 0.08, 2.4, col(r.pick(B.metalRoofs)));
  if (r.chance(0.6)) spiritHouse(kit, f.P(W / 2 - 0.6, 0, D / 2 + 2.6), ry, r);
}

/** Spirit house on a pedestal. */
export function spiritHouse(kit, p, ry, r) {
  const f = kit.frame(p.x, p.y, p.z, ry + Math.PI);
  const [gold, white, red] = B.spirit.map(col);
  f.box('wall', 0, 0.6, 0, 0.22, 1.2, 0.22, white);
  f.box('wall', 0, 1.25, 0, 0.9, 0.1, 0.9, white);
  f.box('wall', 0, 1.6, 0, 0.62, 0.6, 0.55, gold);
  f.box('wall', 0, 1.55, 0.3, 0.3, 0.35, 0.04, red);
  hipRoof(f, 'wall', 0.62, 0.55, 1.9, 0.55, 0.12, red);
  // garlands / offerings
  f.box('wall', 0.25, 1.35, 0.35, 0.12, 0.12, 0.12, col('#f0c040'));
  f.box('wall', -0.25, 1.35, 0.35, 0.12, 0.12, 0.12, col('#e05a8a'));
}

/** Min-area oriented box of a polygon: { cx, cz, W, D, ry, fill }. */
function obb(p) {
  let best = null, area = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  area = Math.abs(area) / 2;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of p) {
      const u = x * c + z * s, v = -x * s + z * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      // frame: u axis = (c, s); kit frame u maps to (cos ry, -sin ry) → ry = atan2(-s, c)
      best = { A, cx: cu * c - cv * s, cz: cu * s + cv * c, W: u1 - u0, D: v1 - v0, ry: Math.atan2(-s, c) };
    }
  }
  best.fill = area / best.A;
  return best;
}

/** OSM footprint building: extruded walls, windows per floor, hip or flat roof. */
export function footprintBuilding(kit, r, map, b) {
  const p = b.p;
  let base = Infinity;
  for (const [x, z] of p) base = Math.min(base, map.heightAt(x, z));
  base = Math.max(base, map.sea) - 0.3;
  const H = b.h || b.lv * FLOOR;
  const shape = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: H + 0.3, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, base, 0);
  const wall = col(r.pick(b.lv >= 3 ? B.walls : B.houseWalls));
  const box = obb(p);
  kit.add('wall', g, new THREE.Matrix4(), wall, { x: box.cx, z: box.cz });

  // windows on each long-enough edge
  let area = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; area += a[0] * c[1] - c[0] * a[1]; }
  const out = area > 0 ? 1 : -1;       // outward side of each edge
  const floors = Math.max(1, Math.round(H / FLOOR));
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 3) continue;
    const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L;
    const nx = -dz * out, nz = dx * out;                  // outward normal
    const f = kit.frame((a[0] + c[0]) / 2, base + 0.3, (a[1] + c[1]) / 2, Math.atan2(nx, nz));
    windowsOnFace(f, r, L, floors, 0);
  }

  const top = base + 0.3 + H;
  if (b.lv <= 2 && box.fill > 0.82) {
    const f = kit.frame(box.cx, 0, box.cz, box.ry);
    const tile = r.chance(0.5);
    hipRoof(f, tile ? 'wall' : 'metal', box.W, box.D, top, Math.min(3, Math.min(box.W, box.D) * 0.3), 0.6,
      col(r.pick(tile ? B.tileRoofs : B.metalRoofs)));
  } else {
    const rim = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
    rim.rotateX(-Math.PI / 2);
    rim.translate(0, top - 0.05, 0);
    kit.add('wall', rim, new THREE.Matrix4(), col(B.trim[1]), { x: box.cx, z: box.cz });
  }
}

/** Gable roof over a W×D rectangle (ridge along u), eaves at y, with triangular ends. */
function gableRoof(f, mat, W, D, y, rise, o, color, endColor) {
  const hw = W / 2 + o, hd = D / 2 + o, T = y + rise;
  f.tris(mat, [
    -hw, y, hd, hw, y, hd, hw, T, 0,   -hw, y, hd, hw, T, 0, -hw, T, 0,        // front slope
    hw, y, -hd, -hw, y, -hd, -hw, T, 0,   hw, y, -hd, -hw, T, 0, hw, T, 0,     // back slope
  ], color);
  f.tris(mat, [W / 2, y, D / 2, W / 2, y, -D / 2, W / 2, T - 0.05, 0,
    -W / 2, y, -D / 2, -W / 2, y, D / 2, -W / 2, T - 0.05, 0], endColor);  // gable ends
  f.box('wall', 0, y - 0.04, 0, 2 * hw, 0.08, 2 * hd, col('#6a4a34'));                   // soffit
}

/** Grandma's house: a raised Thai wooden house with a veranda, stairs, water jars. */
export function grandmaHouse(kit, r, { x, y, z, ry, W = 12, D = 12 }) {
  const f = kit.frame(x, y, z, ry);
  const wood = col('#8f623e'), dark = col('#5e3f28'), post = col('#6e4c33');
  const hw = 4.2, hd = 3.4, floor = 1.9, wallH = 2.5;       // house body half sizes, floor height
  const cz = -2.4;                                           // body sits toward the back of the lot
  // stilts + floor platform (body + front veranda)
  for (const u of [-hw, 0, hw]) for (const w of [-hd, 0, hd, hd + 1.8]) f.box('wall', u, floor / 2 - 0.3, cz + w, 0.22, floor + 0.6, 0.22, post);
  f.box('wall', 0, floor, cz + 0.9, hw * 2 + 0.4, 0.22, hd * 2 + 2.2, dark);
  // walls with horizontal planks
  f.box('wall', 0, floor + wallH / 2, cz, hw * 2, wallH, hd * 2, wood);
  for (let y2 = floor + 0.3; y2 < floor + wallH; y2 += 0.32) {
    f.box('wall', 0, y2, cz + hd + 0.01, hw * 2, 0.03, 0.02, dark);
    f.box('wall', hw + 0.01, y2, cz, 0.02, 0.03, hd * 2, dark);
    f.box('wall', -hw - 0.01, y2, cz, 0.02, 0.03, hd * 2, dark);
  }
  // door + open shutters
  f.box('lit', 0, floor + 1.05, cz + hd + 0.02, 1.1, 2.0, 0.05, col('#4a3526'));
  for (const u of [-2.6, 2.6]) {
    f.box('lit', u, floor + 1.4, cz + hd + 0.02, 1.0, 1.1, 0.05, col('#3a2c22'));
    for (const s of [-1, 1]) f.box('wall', u + s * 0.8, floor + 1.4, cz + hd + 0.12, 0.55, 1.1, 0.05, wood);
  }
  // veranda railing
  const vz = cz + hd + 1.8;
  f.box('wall', 0, floor + 0.85, vz, hw * 2 + 0.3, 0.08, 0.1, dark);
  for (let u = -hw; u <= hw; u += 0.45) if (Math.abs(u) > 0.7) f.box('wall', u, floor + 0.45, vz, 0.06, 0.8, 0.06, wood);
  for (const u of [-hw, hw]) f.box('wall', u, floor + 1.4, vz, 0.18, 2.8, 0.18, post);     // veranda posts
  // stairs down to the yard
  for (let i = 0; i < 6; i++) f.box('wall', 0, floor - 0.3 * (i + 1) + 0.15, vz + 0.35 + i * 0.3, 1.2, 0.08, 0.3, wood);
  // steep clay-tile gable roof over body + veranda
  gableRoof(f, 'wall', hw * 2, hd * 2 + 1.8, floor + wallH + 0.05, 2.6, 0.7, col('#b0553a'), wood);
  // under the house: bamboo bench (แคร่) and glazed water jars (โอ่ง)
  f.box('wall', -1.8, 0.45, cz + 0.5, 1.9, 0.08, 1.0, col('#c9a86a'));
  for (const [u, w] of [[-2.6, 0.05], [-1.0, 0.05], [-2.6, 0.95], [-1.0, 0.95]]) f.box('wall', u, 0.22, cz + w, 0.08, 0.44, 0.08, col('#a88a58'));
  const jar = new THREE.SphereGeometry(0.42, 14, 10);
  for (const u of [hw + 0.8, hw + 1.7]) {
    const p = f.P(u, 0.45, cz + hd + 0.6);
    kit.add('metal', jar, new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(1, 1.25, 1)), col('#6a3f24'));
  }
  // potted plants on the veranda + spirit house by the gate
  for (const u of [-3.4, 3.4]) {
    f.box('wall', u, floor + 0.3, vz - 0.4, 0.35, 0.35, 0.35, col('#a8583a'));
    f.box('wall', u, floor + 0.7, vz - 0.4, 0.5, 0.5, 0.5, col('#4f7a3a'));
  }
  spiritHouse(kit, f.P(-W / 2 + 1.2, 0, D / 2 - 1.2), ry, r);
}
