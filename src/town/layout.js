// Shared layout helpers for placing things on the map: distance to the sea, a road
// segment index and an occupancy grid so objects don't overlap. (rng re-exported.)

export { rng } from '../core/rng.js';

/** Bilinear sampler for the terrain's distance-to-sea grid (metres). */
export function seaDistSampler(map, dist) {
  const { x0, z0, step, nx, nz } = map.core;
  const at = (i, j) => dist[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  return (x, z) => {
    const fx = (x - x0) / step, fz = (z - z0) / step;
    const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j;
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * b;
  };
}

/** Spatial hash of road segments: query clearance from a point to the nearest road edge. */
export class RoadIndex {
  constructor(roads, widthOf, cell = 32) {
    this.cell = cell;
    this.grid = new Map();
    for (const r of roads) {
      const hw = widthOf(r) / 2;
      if (!hw) continue;
      for (let i = 1; i < r.p.length; i++) {
        const s = { ax: r.p[i - 1][0], az: r.p[i - 1][1], bx: r.p[i][0], bz: r.p[i][1], hw, k: r.k, road: r };
        const x0 = Math.floor((Math.min(s.ax, s.bx) - hw) / cell), x1 = Math.floor((Math.max(s.ax, s.bx) + hw) / cell);
        const z0 = Math.floor((Math.min(s.az, s.bz) - hw) / cell), z1 = Math.floor((Math.max(s.az, s.bz) + hw) / cell);
        for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
          const key = gx * 100003 + gz;
          (this.grid.get(key) || this.grid.set(key, []).get(key)).push(s);
        }
      }
    }
  }

  /** Is (x, z) on the surface of a road other than `road`? (junctions: where one road's markings should stop) */
  onOtherRoad(x, z, road, margin = 0.1) {
    const list = this.grid.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!list) return false;
    for (const s of list) {
      if (s.road === road) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L));
      if (Math.hypot(s.ax + t * dx - x, s.az + t * dz - z) < s.hw - margin) return true;
    }
    return false;
  }

  /** Nearest road edge: { d (negative = on the road), k (highway kind) } or null. */
  nearest(x, z, radius = 40) {
    let best = null, bd = radius;
    const c = this.cell, r = Math.ceil(radius / c);
    const gx = Math.floor(x / c), gz = Math.floor(z / c);
    for (let i = gx - r; i <= gx + r; i++) for (let j = gz - r; j <= gz + r; j++) {
      const list = this.grid.get(i * 100003 + j);
      if (!list) continue;
      for (const s of list) {
        const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L));
        const d = Math.hypot(s.ax + t * dx - x, s.az + t * dz - z) - s.hw;
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best ? { d: bd, k: best.k, hw: best.hw } : null;
  }

  /** Distance from (x, z) to the nearest road edge (negative = on the road). */
  clearance(x, z, radius = 40) {
    let best = radius;
    const c = this.cell, r = Math.ceil(radius / c);
    const gx = Math.floor(x / c), gz = Math.floor(z / c);
    for (let i = gx - r; i <= gx + r; i++) for (let j = gz - r; j <= gz + r; j++) {
      const list = this.grid.get(i * 100003 + j);
      if (!list) continue;
      for (const s of list) {
        const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L));
        const d = Math.hypot(s.ax + t * dx - x, s.az + t * dz - z) - s.hw;
        if (d < best) best = d;
      }
    }
    return best;
  }
}

/** Coarse occupancy grid (1 m cells). Mark footprints, test before placing. */
export class Occupancy {
  constructor(cell = 1) { this.cell = cell; this.set = new Set(); }
  _each(x, z, hx, hz, ry, fn) {
    const c = Math.cos(ry), s = Math.sin(ry), e = this.cell;
    for (let u = -hx; u <= hx; u += e * 0.7) for (let v = -hz; v <= hz; v += e * 0.7) {
      const px = x + u * c + v * s, pz = z - u * s + v * c;
      if (fn(Math.floor(px / e) * 100003 + Math.floor(pz / e))) return true;
    }
    return false;
  }
  /** True if an oriented rectangle (half sizes hx, hz, yaw ry) overlaps anything. */
  test(x, z, hx, hz, ry = 0) { return this._each(x, z, hx, hz, ry, k => this.set.has(k)); }
  mark(x, z, hx, hz, ry = 0) { this._each(x, z, hx, hz, ry, k => { this.set.add(k); return false; }); }
  /** Mark every cell a polygon's bounding rows cover (for OSM footprints). */
  markPoly(p) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let x = x0; x <= x1; x += this.cell) for (let z = z0; z <= z1; z += this.cell) {
      if (inPoly(x, z, p)) this.set.add(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    }
  }
}

export function inPoly(x, z, p) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/** Walk a polyline, calling fn(x, z, dirX, dirZ, s) every `step` metres. */
export function walkLine(p, step, fn, offset = 0) {
  let carry = offset, s = 0;
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-6) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    let t = carry;
    for (; t < L; t += step) fn(ax + dx * t, az + dz * t, dx, dz, s + t);
    carry = t - L;
    s += L;
  }
}

/** Is (x, z) on the map, at least `margin` m inside the edge of the core square? */
export function inMap(map, x, z, margin = 6) {
  const { x0, z0, step, nx, nz } = map.core;
  return x > x0 + margin && x < x0 + (nx - 1) * step - margin && z > z0 + margin && z < z0 + (nz - 1) * step - margin;
}

/** How far (m) a point lies outside the playable area: the coastal strip (`map.inland` m from
 *  the sea) plus the baked corridors (inland roads, `w` m either side), minus those `skip(corridor)` rejects. ≤ 0 means inside.
 *  The corridor part is rasterised once at CORRIDOR_CELL metres and sampled bilinearly. */
const CORRIDOR_CELL = 4, CORRIDOR_FAR = 60;
export function stripSampler(map, seaDist, skip = () => false) {
  const inland = map.inland || 100, lines = (map.corridors || []).filter(c => !skip(c));
  const { x0, z0 } = map.core, size = (map.core.nx - 1) * map.core.step, n = Math.ceil(size / CORRIDOR_CELL) + 1;
  const grid = new Float32Array(n * n).fill(CORRIDOR_FAR);
  for (const c of lines) for (let k = 1; k < c.p.length; k++) {
    const [ax, az] = c.p[k - 1], [bx, bz] = c.p[k], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, pad = c.w + CORRIDOR_FAR;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - x0) / CORRIDOR_CELL)), i1 = Math.min(n - 1, Math.ceil((Math.max(ax, bx) + pad - x0) / CORRIDOR_CELL));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - pad - z0) / CORRIDOR_CELL)), j1 = Math.min(n - 1, Math.ceil((Math.max(az, bz) + pad - z0) / CORRIDOR_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * CORRIDOR_CELL, z = z0 + j * CORRIDOR_CELL;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
      const d = Math.hypot(ax + t * dx - x, az + t * dz - z) - c.w;
      if (d < grid[j * n + i]) grid[j * n + i] = d;
    }
  }
  const at = (i, j) => grid[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  const corridor = (x, z) => {
    const fx = (x - x0) / CORRIDOR_CELL, fz = (z - z0) / CORRIDOR_CELL, i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j;
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * b;
  };
  const strip = (x, z) => Math.min(seaDist(x, z) - inland, corridor(x, z));
  strip.corridor = corridor;
  return strip;
}
