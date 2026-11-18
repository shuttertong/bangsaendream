// Terrain from the baked height grid: a detailed core mesh, plus a coarse outer ring
// that extends the edge heights so the map never ends in a cliff.
import * as THREE from 'three';
import { paintedMaterial } from '../world/materials.js';
import { PALETTE } from '../shared/palette.js';
import { roadPatches } from './corridor.js';
import { gfx } from '../core/quality.js';

const OUTER_HALF = 8000, OUTER_STEP = 80, OUTER_UNDER = 2;   // OUTER_UNDER: metres the outer mesh stays below the core's lowest ground nearby
const TILE = 75;        // core terrain tile size in grid cells (600 m) for frustum culling
const BEACH_W = 50;     // metres of sand behind the waterline (up to and around the beach promenade)
// rocky shores with only a thin strip of sand: Khao Sam Muk's seawall coast
export const ROCKY_SHORE = [{ x0: -1050, x1: -250, z0: -2480, z1: -1330, sand: 6 }];
// seaside parks: lawn with only a thin strip of sand at the water (Laem Thaen)
export const PARKS = [{ x: -1340, z: -762, r: 82, sand: 7, lawn: '#78a24c' }];

/** Chamfer distance (m) from every grid cell to the nearest sea cell. */
export function seaDistance(map) {
  const { nx, nz, step } = map.core, h = map.heights, sea = map.sea;
  const d = new Float32Array(nx * nz).fill(1e9);
  for (let k = 0; k < d.length; k++) if (h[k] < sea) d[k] = 0;
  // seed shore cells with the sub-cell distance to the interpolated waterline
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (h[k] < sea) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const hn = h[jj * nx + ii];
      if (hn < sea) d[k] = Math.min(d[k], (h[k] - sea) / (h[k] - hn) * step);
    }
  }
  const s1 = step, s2 = step * Math.SQRT2;
  const relax = (k, k2, w) => { if (d[k2] + w < d[k]) d[k] = d[k2] + w; };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (i > 0) relax(k, k - 1, s1);
    if (j > 0) { relax(k, k - nx, s1); if (i > 0) relax(k, k - nx - 1, s2); if (i < nx - 1) relax(k, k - nx + 1, s2); }
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    if (i < nx - 1) relax(k, k + 1, s1);
    if (j < nz - 1) { relax(k, k + nx, s1); if (i < nx - 1) relax(k, k + nx + 1, s2); if (i > 0) relax(k, k + nx - 1, s2); }
  }
  return d;
}

const C = Object.fromEntries(['sand', 'wetSand', 'seabed', 'lowland', 'lowlandDry', 'hill', 'rock']
  .map(k => [k, new THREE.Color(PALETTE[k])]));
const tmp = new THREE.Color();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** Smooth value noise 0..1 (bilinear over hashed lattice). */
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Bare granite on the high hills (Khao Sam Muk's ridge and cliffs): 0..1. Shared with the tree placement. */
export const ROCK = { from: 20, full: 40, scale: 55, cut: [0.42, 0.62] };
export function rockMask(x, y, z) {
  const n = vnoise(x / ROCK.scale, z / ROCK.scale) * 0.7 + vnoise(x / 17, z / 17) * 0.3;
  return smooth(ROCK.from, ROCK.full, y) * smooth(ROCK.cut[0], ROCK.cut[1], n);
}

/** Ground colour from height, slope (normal.y) and distance to the sea. `kind` (optional, 4 numbers) gets what the
 *  ground is made of there — sand, grass, rock, and how wet the sand is — for the close-up detail textures (world/detail.js). */
function groundColor(out, y, ny, dist, sea, x, z, kind) {
  if (y < sea) {                                   // seabed, darker with depth
    out.copy(C.wetSand).lerp(C.seabed, smooth(0, 3, sea - y));
    if (kind) { kind[0] = 1; kind[1] = kind[2] = 0; kind[3] = 1 - smooth(0, WET.under, sea - y); }
    return out;
  }
  const jitter = (hash(Math.floor(x / 13), Math.floor(z / 13)) - 0.5) * 10;
  const rocky = ROCKY_SHORE.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  let bw = rocky ? rocky.sand : BEACH_W;
  for (const p of PARKS) {                                           // lawn fading in toward the park's middle
    const k = 1 - smooth(p.r - 18, p.r, Math.hypot(x - p.x, z - p.z));
    if (k > 0) { bw = bw + (p.sand - bw) * k; out.lerp(tmp.set(p.lawn), k * 0.9); }
  }
  const beach = 1 - smooth(bw - Math.min(8, bw), bw + 6, dist + jitter);
  const rock = Math.max(smooth(0.86, 0.7, ny) * 0.8, rockMask(x, y, z));
  out.copy(C.lowland).lerp(C.lowlandDry, hash(Math.floor(x / 50), Math.floor(z / 50)) * 0.5);
  out.lerp(C.hill, smooth(12, 45, y));
  out.lerp(C.rock, rock);
  tmp.copy(C.sand).lerp(C.wetSand, 1 - smooth(0.2, 1.4, y - sea));
  if (kind) { kind[0] = beach; kind[1] = (1 - beach) * (1 - rock); kind[2] = (1 - beach) * rock; kind[3] = beach * (1 - smooth(WET.above[0], WET.above[1], y - sea)); }
  return out.lerp(tmp, beach);
}
const WET = { above: [0.04, 0.42], under: 0.5 };   // the glistening strip: scene units above the sea where the sand is still wet; how far under the water the sheen carries on
const KIND = [0, 0, 0, 0];
/** Colour + `kind` attributes for a ground geometry (positions and normals set). */
function paint(g, dist, sea) {
  const pos = g.attributes.position, nrm = g.attributes.normal, col = new Float32Array(pos.count * 3), kind = new Uint8Array(pos.count * 4), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k);
    groundColor(c, y, nrm.getY(k), dist ? dist[k] : y < sea ? 0 : 200, sea, pos.getX(k), pos.getZ(k), KIND).toArray(col, k * 3);
    for (let i = 0; i < 4; i++) kind[k * 4 + i] = Math.round(Math.min(1, Math.max(0, KIND[i])) * 255);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('kind', new THREE.BufferAttribute(kind, 4, true));
  return g;
}

function coreMesh(map, dist) {
  const { x0, z0, nx, nz } = map.core;
  const g = new THREE.PlaneGeometry(map.size.w, map.size.d, nx - 1, nz - 1);
  g.rotateX(-Math.PI / 2);
  g.translate(x0 + map.size.w / 2, 0, z0 + map.size.d / 2);
  const pos = g.attributes.position;
  // PlaneGeometry rotated -90° about X runs rows from -z to +z, matching the bin (north first)
  for (let k = 0; k < pos.count; k++) pos.setY(k, map.heights[k]);
  g.computeVertexNormals();
  return paint(g, dist, map.sea);
}

/** Height beyond the core square. Repeating the edge row outward would stretch any land that
 *  touches the edge (the tip of Khao Sam Muk) into a long fake spit, so take the LOWEST edge
 *  height within a window that widens with the distance out: narrow land tapers into the sea
 *  within a few hundred metres, the wide mainland carries on. */
function outerHeights(map) {
  const { x0, z0, step } = map.core, x1 = x0 + map.size.w, z1 = z0 + map.size.d;
  const edge = (fixed, horizontal) => {                        // edge profile, one sample per core step
    const out = [];
    for (let t = horizontal ? x0 : z0; t <= (horizontal ? x1 : z1) + 0.01; t += step) out.push(horizontal ? map.heightAt(t, fixed) : map.heightAt(fixed, t));
    return out;
  };
  const N = edge(z0, true), S = edge(z1, true), W = edge(x0, false), E = edge(x1, false);
  const lowest = (prof, from, t, d) => {                       // min of prof over [t − d, t + d] (metres along the edge)
    const i0 = Math.max(0, Math.floor((t - d - from) / step)), i1 = Math.min(prof.length - 1, Math.ceil((t + d - from) / step));
    const by = Math.max(1, Math.floor((i1 - i0) / 60));      // coarse stride far out; the window is wide there anyway
    let m = Infinity;
    for (let i = i0; i <= i1; i += by) m = Math.min(m, prof[i]);
    return m === Infinity ? prof[Math.min(prof.length - 1, Math.max(0, Math.round((t - from) / step)))] : m;
  };
  return (x, z) => {
    const cx = Math.min(x1, Math.max(x0, x)), cz = Math.min(z1, Math.max(z0, z)), dx = Math.abs(x - cx), dz = Math.abs(z - cz);
    if (!dx && !dz) return map.heightAt(x, z);
    let h = Infinity;
    if (dz) h = Math.min(h, lowest(z < z0 ? N : S, x0, cx, dz + dx));
    if (dx) h = Math.min(h, lowest(x < x0 ? W : E, z0, cz, dx + dz));
    return h;
  };
}

function outerMesh(map) {
  const n = OUTER_HALF * 2 / OUTER_STEP;
  const g = new THREE.PlaneGeometry(OUTER_HALF * 2, OUTER_HALF * 2, n, n);
  g.rotateX(-Math.PI / 2);
  const { x0, z0 } = map.core, x1 = x0 + map.size.w, z1 = z0 + map.size.d;
  const pos = g.attributes.position, heightOut = outerHeights(map), fine = map.core.step;
  const lowest = (x, z) => {
    let m = Infinity;
    for (let a = -OUTER_STEP; a <= OUTER_STEP; a += fine) for (let b = -OUTER_STEP; b <= OUTER_STEP; b += fine) m = Math.min(m, map.heightAt(Math.min(x1, Math.max(x0, x + a)), Math.min(z1, Math.max(z0, z + b))));
    return m;
  };
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const inside = x > x0 + 1 && x < x1 - 1 && z > z0 + 1 && z < z1 - 1, onEdge = !inside && x >= x0 && x <= x1 && z >= z0 && z <= z1;
    // inside: hide under the core mesh. A coarse triangle between "height − 6" corners still rose above the fine
    // ground on a steep hill and covered the Khao Sam Muk roads, so each corner takes the LOWEST fine height within
    // one coarse cell around it: every point of the triangle is then below the core mesh
    pos.setY(k, inside ? lowest(x, z) - OUTER_UNDER : onEdge ? lowest(x, z) : heightOut(x, z));
  }
  g.computeVertexNormals();
  return paint(g, null, map.sea);
}

/** Cut the full core grid into TILE×TILE tiles (shared edge vertices, normals from the full grid).
 *  patches (corridor.js): cells beside roads that are drawn as a fine patch at the walk surface's height instead of
 *  their two coarse triangles — same tile, same draw call. */
function tiles(g, map, dist, patches) {
  const { nx, nz, x0, z0, step } = map.core, cx = nx - 1;
  const out = [], P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array, K = g.attributes.kind.array;
  const distAt = (x, z) => {                                         // sea distance between grid nodes (bilinear)
    const fx = Math.min(nx - 1.001, Math.max(0, (x - x0) / step)), fz = Math.min(nz - 1.001, Math.max(0, (z - z0) / step)), i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j, k = j * nx + i;
    return (dist[k] * (1 - a) + dist[k + 1] * a) * (1 - b) + (dist[k + nx] * (1 - a) + dist[k + nx + 1] * a) * b;
  };
  const c = new THREE.Color();
  for (let tj = 0; tj < nz - 1; tj += TILE) for (let ti = 0; ti < nx - 1; ti += TILE) {
    const w = Math.min(TILE, nx - 1 - ti) + 1, h = Math.min(TILE, nz - 1 - tj) + 1;
    let pos = new Float32Array(w * h * 3), nrm = new Float32Array(w * h * 3), col = new Float32Array(w * h * 3), kind = new Uint8Array(w * h * 4);
    const idx = [], xp = [], xn = [], xc = [], xk = [];             // x…: the patches' own vertices, added after the grid's
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const src = ((tj + j) * nx + ti + i) * 3, dst = (j * w + i) * 3;
      pos.set(P.subarray(src, src + 3), dst); nrm.set(N.subarray(src, src + 3), dst); col.set(C.subarray(src, src + 3), dst);
      kind.set(K.subarray(src / 3 * 4, src / 3 * 4 + 4), dst / 3 * 4);
    }
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      const hs = patches.get((tj + j) * cx + ti + i);
      if (!hs) { const a = j * w + i, b = a + w; idx.push(a, b, a + 1, b, b + 1, a + 1); continue; }
      const m = Math.round(Math.sqrt(hs.length)), n = m - 1, f = step / n;   // the patch's own fineness (corridor.js: 2 m or 1 m squares)
      const base = w * h + xp.length / 3, px = x0 + (ti + i) * step, pz = z0 + (tj + j) * step, at = (a, b) => hs[Math.min(n, Math.max(0, b)) * m + Math.min(n, Math.max(0, a))];
      for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) {
        const x = px + a * f, z = pz + b * f, y = hs[b * m + a];
        const sx = (at(a + 1, b) - at(a - 1, b)) / ((a === 0 || a === n ? 1 : 2) * f), sz = (at(a, b + 1) - at(a, b - 1)) / ((b === 0 || b === n ? 1 : 2) * f), l = Math.hypot(sx, 1, sz);
        xp.push(x, y, z); xn.push(-sx / l, 1 / l, -sz / l);
        groundColor(c, y, 1 / l, distAt(x, z), map.sea, x, z, KIND);
        xc.push(c.r, c.g, c.b);
        for (let q = 0; q < 4; q++) xk.push(Math.round(Math.min(1, Math.max(0, KIND[q])) * 255));
      }
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const p = base + b * m + a, q = p + m; idx.push(p, q, p + 1, q, q + 1, p + 1); }
    }
    if (xp.length) {
      const join = (A, X, T) => { const o = new T(A.length + X.length); o.set(A); o.set(X, A.length); return o; };
      pos = join(pos, xp, Float32Array); nrm = join(nrm, xn, Float32Array); col = join(col, xc, Float32Array); kind = join(kind, xk, Uint8Array);
    }
    const t = new THREE.BufferGeometry();
    t.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    t.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    t.setAttribute('color', new THREE.BufferAttribute(col, 3));
    t.setAttribute('kind', new THREE.BufferAttribute(kind, 4, true));
    t.setIndex(idx);
    t.computeBoundingSphere();
    out.push(t);
  }
  return out;
}

export function buildTerrain(map) {
  const dist = seaDistance(map);
  const mat = paintedMaterial({ amp: 0.3, scale: 18, detail: 'ground' });   // sand / grass / rock close-up textures by the `kind` attribute
  const group = new THREE.Group();
  const patched = roadPatches(map, gfx.level !== 'low');             // the ground beside roads, at the height the kid walks at
  for (const t of tiles(coreMesh(map, dist), map, dist, patched.cells)) {
    const m = new THREE.Mesh(t, mat);
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.name = 'terrain-core';
    group.add(m);
  }
  const outer = new THREE.Mesh(outerMesh(map), mat);
  outer.receiveShadow = true;
  outer.name = 'terrain-outer';
  group.add(outer);
  return { group, seaDist: dist, patched: { cells: patched.count, fine: patched.fine } };
}
