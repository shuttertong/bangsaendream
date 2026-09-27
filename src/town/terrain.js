// Terrain from the baked height grid: a detailed core mesh, plus a coarse outer ring
// that extends the edge heights so the map never ends in a cliff.
import * as THREE from 'three';
import { paintedMaterial } from '../world/materials.js';
import { PALETTE } from '../shared/palette.js';

const OUTER_HALF = 8000, OUTER_STEP = 80;
const TILE = 75;        // core terrain tile size in grid cells (600 m) for frustum culling
const BEACH_W = 50;     // metres of sand behind the waterline (up to and around the beach promenade)
// rocky shores with only a thin strip of sand: Khao Sam Muk's seawall coast
export const ROCKY_SHORE = [{ x0: -1050, x1: -250, z0: -2480, z1: -1330, sand: 6 }];
// seaside parks: lawn with only a thin strip of sand at the water (Laem Thaen)
export const PARKS = [{ x: -1340, z: -762, r: 82, sand: 7, lawn: '#78a24c' }];

/** Chamfer distance (m) from every grid cell to the nearest sea cell. */
function seaDistance(map) {
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

/** Ground colour from height, slope (normal.y) and distance to the sea. */
function groundColor(out, y, ny, dist, sea, x, z) {
  if (y < sea) {                                   // seabed, darker with depth
    out.copy(C.wetSand).lerp(C.seabed, smooth(0, 3, sea - y));
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
  out.copy(C.lowland).lerp(C.lowlandDry, hash(Math.floor(x / 50), Math.floor(z / 50)) * 0.5);
  out.lerp(C.hill, smooth(12, 45, y));
  out.lerp(C.rock, Math.max(smooth(0.86, 0.7, ny) * 0.8, rockMask(x, y, z)));
  tmp.copy(C.sand).lerp(C.wetSand, 1 - smooth(0.2, 1.4, y - sea));
  return out.lerp(tmp, beach);
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
  const nrm = g.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    groundColor(c, pos.getY(k), nrm.getY(k), dist[k], map.sea, pos.getX(k), pos.getZ(k)).toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
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
  const pos = g.attributes.position, heightOut = outerHeights(map);
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const inside = x > x0 + 1 && x < x1 - 1 && z > z0 + 1 && z < z1 - 1;
    pos.setY(k, inside ? map.heightAt(x, z) - 6 : heightOut(x, z));   // inside: hide under the core mesh
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k);
    groundColor(c, y, nrm.getY(k), y < map.sea ? 0 : 200, map.sea, pos.getX(k), pos.getZ(k)).toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Cut the full core grid into TILE×TILE tiles (shared edge vertices, normals from the full grid). */
function tiles(g, nx, nz) {
  const out = [], P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array;
  for (let tj = 0; tj < nz - 1; tj += TILE) for (let ti = 0; ti < nx - 1; ti += TILE) {
    const w = Math.min(TILE, nx - 1 - ti) + 1, h = Math.min(TILE, nz - 1 - tj) + 1;
    const pos = new Float32Array(w * h * 3), nrm = new Float32Array(w * h * 3), col = new Float32Array(w * h * 3), idx = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const src = ((tj + j) * nx + ti + i) * 3, dst = (j * w + i) * 3;
      pos.set(P.subarray(src, src + 3), dst); nrm.set(N.subarray(src, src + 3), dst); col.set(C.subarray(src, src + 3), dst);
    }
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      const a = j * w + i, b = a + w;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const t = new THREE.BufferGeometry();
    t.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    t.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    t.setAttribute('color', new THREE.BufferAttribute(col, 3));
    t.setIndex(idx);
    t.computeBoundingSphere();
    out.push(t);
  }
  return out;
}

export function buildTerrain(map) {
  const dist = seaDistance(map);
  const mat = paintedMaterial({ amp: 0.3, scale: 18 });
  const group = new THREE.Group();
  for (const t of tiles(coreMesh(map, dist), map.core.nx, map.core.nz)) {
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
  return { group, seaDist: dist };
}
