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
