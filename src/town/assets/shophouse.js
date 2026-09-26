// Shophouse rows (ตึกแถว): 2–4 floors, roll-up shutters, awnings, generic signboards,
// balconies with railings, flat roofs with parapets or metal sheds, water tanks.
// Also condo/hotel blocks for the beachfront.
import * as THREE from 'three';
import { BUILDING as B } from '../../shared/palette.js';

const FLOOR = 3.2;
const col = hex => new THREE.Color(hex);
const jitter = (c, r, amt = 0.05) => col(c).offsetHSL(0, 0, (r() - 0.5) * amt);

function signboard(f, r, u, v, w, width) {
  const base = col(r.pick(B.signs));
  f.box('wall', u, v, w, width, 0.75, 0.1, base);
  // generic "lettering": a few light blocks, no real text or brands
  const light = base.getHSL({}).l > 0.6 ? col('#3b3b3b') : col('#f5f1e6');
  let x = u - width / 2 + 0.35;
  while (x < u + width / 2 - 0.5) {
    const wd = 0.18 + r() * 0.35;
    f.box('wall', x + wd / 2, v + (r() - 0.5) * 0.08, w + 0.06, wd, 0.32 + r() * 0.12, 0.02, light);
    x += wd + 0.12 + r() * 0.1;
  }
}

function groundFloor(f, r, u, W, D) {
  const w = D / 2;
  const open = r.chance(0.55);
  // recessed shop opening
  f.box('lit', u, 1.35, w - 0.25, W - 0.5, 2.7, 0.52, col(B.interior));             // lit interior
  if (open) {
    // goods / counter inside the open shop
    f.box('wall', u, 0.45, w - 0.9, W - 1.2, 0.9, 0.6, col(r.pick(B.awnings)).offsetHSL(0, -0.2, 0.1));
    f.box('metal', u, 2.55, w - 0.02, W - 0.5, 0.3, 0.3, col(B.shutter));        // rolled-up shutter
  } else {
    f.box('metal', u, 1.35, w - 0.05, W - 0.5, 2.7, 0.08, col(B.shutter));
    for (let y = 0.25; y < 2.7; y += 0.22) f.box('metal', u, y, w - 0.01, W - 0.55, 0.03, 0.03, col('#7d8386'));
  }
  // awning
  if (r.chance(0.7)) {
    const a = col(r.pick(B.awnings)), d = 1.1 + r() * 0.5;
    f.tris2('wall', [
      u - W / 2 + 0.05, 3.0, w, u - W / 2 + 0.05, 2.55, w + d, u + W / 2 - 0.05, 3.0, w,
      u - W / 2 + 0.05, 2.55, w + d, u + W / 2 - 0.05, 2.55, w + d, u + W / 2 - 0.05, 3.0, w,
    ], a);
  }
  signboard(f, r, u, 3.45, w + 0.06, W - 0.3);
}

function upperFloor(f, r, u, y, W, D, wall, balcony) {
  const w = D / 2;
  const ww = W * (0.5 + r() * 0.2), wh = 1.35;
  f.box('wall', u, y + 1.55, w + 0.02, ww + 0.2, wh + 0.2, 0.06, col(B.frame));   // frame
  f.box('glass', u, y + 1.55, w + 0.05, ww, wh, 0.04, col(B.glass));              // glass
  f.box('wall', u, y + 1.55, w + 0.08, 0.05, wh, 0.03, col(B.frame));             // mullion
  if (balcony) {
    f.box('wall', u, y + 0.08, w + 0.45, W - 0.1, 0.16, 0.9, wall);                // slab
    f.box('wall', u, y + 1.02, w + 0.88, W - 0.1, 0.06, 0.06, col(B.rail));        // rail top
    for (let x = -W / 2 + 0.2; x <= W / 2 - 0.15; x += 0.28) f.box('metal', u + x, y + 0.6, w + 0.88, 0.035, 0.85, 0.035, col(B.rail));
  }
  // AC unit on some floors
  if (r.chance(0.35)) f.box('wall', u + W * 0.3, y + 0.9, w + 0.3, 0.8, 0.55, 0.35, col('#e9e8e2'));
}

/** Row of `n` shophouse units of width W, depth D, front centre at (x, z) facing `ry`. */
export function shophouseRow(kit, r, { x, y, z, ry, n, W = 4, D = 12, floors }) {
  const f = kit.frame(x, y, z, ry);
  const rowWall = r.pick(B.walls);
  const total = n * W;
  for (let i = 0; i < n; i++) {
    const u = -total / 2 + W * (i + 0.5);
    const fl = Math.max(2, Math.min(4, floors + (r.chance(0.25) ? (r.chance(0.5) ? 1 : -1) : 0)));
    const H = fl * FLOOR;
    const wall = r.chance(0.3) ? col(r.pick(B.walls)) : jitter(rowWall, r);
    f.box('wall', u, H / 2 - 0.5, 0, W, H + 1, D, wall);                         // body (sunk 0.5 into slopes)
    f.box('wall', u - W / 2 + 0.06, H / 2, D / 2 + 0.1, 0.12, H, 0.25, col(r.pick(B.trim)));  // party wall pier
    groundFloor(f, r, u, W, D);
    const bal = r.chance(0.6);
    for (let k = 1; k < fl; k++) upperFloor(f, r, u, k * FLOOR, W, D, wall, bal);
    // roof: parapet or a low metal shed
    if (r.chance(0.6)) {
      f.box('wall', u, H + 0.4, D / 2 - 0.08, W, 0.8, 0.16, wall);
      f.box('wall', u, H + 0.4, -D / 2 + 0.08, W, 0.8, 0.16, wall);
      if (r.chance(0.4)) {                                                      // water tank
        const p = f.P(u + (r() - 0.5) * 1.5, H, -D / 4);
        kit.rod('metal', p, p.clone().setY(H + y + 1.4), 0.55, col('#b7bcc0'));
      }
    } else {
      const m = col(r.pick(B.metalRoofs)), rise = 1.2;
      f.tris('metal', [
        u - W / 2, H, D / 2, u + W / 2, H, D / 2, u - W / 2, H + rise, -D / 2,
        u - W / 2, H + rise, -D / 2, u + W / 2, H, D / 2, u + W / 2, H + rise, -D / 2,
      ], m);
      f.box('wall', u, H + rise / 2, -D / 2, W, rise, 0.1, wall);
    }
  }
}

/** Beach condo / hotel block: 6–12 floors with balconies on the front. */
export function condoBlock(kit, r, { x, y, z, ry, width, D = 16, floors }) {
  const f = kit.frame(x, y, z, ry);
  const wall = col(r.pick(['#eeeae2', '#e6e2d8', '#dfe6ea', '#f0e6d6']));
  const accent = col(r.pick(['#6f9fb5', '#b58a6a', '#8fa88a', '#c9b48a']));
  const H = floors * FLOOR;
  f.box('wall', 0, H / 2 - 0.5, 0, width, H + 1, D, wall);
  f.box('glass', 0, 1.5, D / 2 + 0.02, width * 0.7, 2.6, 0.05, col(B.glass));          // lobby
  f.box('wall', 0, 3.2, D / 2 + 1.2, width * 0.5, 0.25, 2.4, accent);                   // canopy
  const bays = Math.max(2, Math.round(width / 3.6)), bw = width / bays;
  for (let k = 1; k < floors; k++) {
    const yy = k * FLOOR;
    f.box('wall', 0, yy + 0.08, D / 2 + 0.7, width, 0.16, 1.4, wall);                   // balcony slab
    f.box('glass', 0, yy + 1.0, D / 2 + 1.38, width, 0.9, 0.04, col('#8fb3bf'));        // glass balustrade
    for (let b = 0; b < bays; b++) {
      const u = -width / 2 + bw * (b + 0.5);
      f.box('glass', u, yy + 1.5, D / 2 + 0.03, bw * 0.78, 2.2, 0.04, col(B.glass));
      f.box('wall', u + bw / 2, yy + 1.6, D / 2 + 0.7, 0.14, 3.2, 1.4, accent);         // balcony divider
    }
    for (let b = 0; b < bays; b++) {                                                       // back windows
      f.box('glass', -width / 2 + bw * (b + 0.5), yy + 1.6, -D / 2 - 0.03, bw * 0.4, 1.2, 0.04, col(B.glass));
    }
  }
  f.box('wall', 0, H + 0.5, 0, width + 0.3, 1.0, D + 0.3, accent);                      // crown
  f.box('wall', width * 0.2, H + 1.6, -D * 0.2, 3, 2.2, 3, wall);                        // lift overrun
}
