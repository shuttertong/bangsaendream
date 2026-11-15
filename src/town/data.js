// Loads the baked map (tools/bake_map.py) and exposes height queries in scene units.
import * as THREE from 'three';

const BASE = new URL('./data/', import.meta.url);

// The bake stops at z = −2400, but the ring road round Khao Sam Muk runs ~86 m further north round the hill's
// tip. The grid is extended north by PAD.rows rows of made-up ground (not DEM data): sea beyond the baked
// coastline, land rising from the shore up to the height of the baked edge, eased in over a few rows.
export const PAD = { rows: 16, rise: 0.55, shore: 0.5, deep: [0.4, 0.12, 4], ease: 4 };

/** Extend heights `h` (nx × nz, row 0 = north) by PAD.rows rows to the north. Returns { h, nz, z0 }. */
function padNorth(json, h, sea) {
  const { x0, z0, step, nx, nz } = json.core, R = PAD.rows, H = new Float32Array(nx * (nz + R));
  H.set(h, nx * R);
  // coastline segments near the north edge; "land on the left" as a sign, calibrated on the baked rows
  const segs = [];
  for (const c of json.coast || []) for (let k = 1; k < c.p.length; k++) { const a = c.p[k - 1], b = c.p[k]; if (Math.min(a[1], b[1]) < z0 + 400 && Math.max(a[0], b[0]) > x0 - 200 && Math.min(a[0], b[0]) < x0 + (nx - 1) * step + 200) segs.push([a, b]); }
  const near = (x, z) => {
    let bd = Infinity, side = 0;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))), d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
      if (d < bd) { bd = d; side = Math.sign(dx * (z - a[1]) - dz * (x - a[0])); }
    }
    return { d: bd, side };
  };
  if (!segs.length) { for (let j = 0; j < R; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = h[i]; return { h: H, nz: nz + R, z0: z0 - R * step }; }
  let agree = 0, seen = 0;
  for (let j = 1; j <= 6; j++) for (let i = 0; i < nx; i += 3) { const q = near(x0 + i * step, z0 + j * step); if (q.d > 300 || !q.side) continue; seen++; if ((q.side > 0) === (h[j * nx + i] >= sea)) agree++; }
  const landSign = agree * 2 >= seen ? 1 : -1;
  for (let j = 0; j < R; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 - (R - j) * step, edge = h[i], q = near(x, z), land = q.d > 300 ? edge >= sea : q.side === landSign;
    const want = land ? Math.max(sea + 0.4, Math.min(Math.max(edge, sea + 0.4), sea + PAD.shore + q.d * PAD.rise)) : sea - Math.min(PAD.deep[2], PAD.deep[0] + q.d * PAD.deep[1]);
    const t = Math.min(1, (R - j) / PAD.ease), e = t * t * (3 - 2 * t);
    H[j * nx + i] = edge + (want - edge) * e;
  }
  return { h: H, nz: nz + R, z0: z0 - R * step };
}

export async function loadMap(name = 'bangsaen') {
  const [json, bin] = await Promise.all([
    fetch(new URL(`${name}.json`, BASE)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(new URL(`${name}-core.bin`, BASE)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
  ]);
  const raw = new Int16Array(bin);
  if (raw.length !== json.core.nx * json.core.nz) throw new Error(`height grid size ${raw.length} != ${json.core.nx}x${json.core.nz}`);

  // heights in scene units (decimetres × hscale)
  const baked = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) baked[i] = raw[i] * 0.1 * json.hscale;
  const pad = padNorth(json, baked, json.sea ?? 0.4), h = pad.h;
  json.core = { ...json.core, nz: pad.nz, z0: pad.z0 };              // the grid now reaches further north (see PAD)
  const { x0, z0, step, nx, nz } = json.core;

  const size = { w: (nx - 1) * step, d: (nz - 1) * step };
  const at = (i, j) => h[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];

  /**
   * Terrain height at scene (x, z), matching the rendered mesh exactly: each grid cell
   * is two flat triangles split along the (i, j+1)–(i+1, j) diagonal, the same way
   * PlaneGeometry / the terrain tiles triangulate. Edge-clamped outside the grid.
   * (Bilinear sampling would float or sink things by up to ~0.5 m on slopes.)
   */
  function heightAt(x, z) {
    const fx = (x - x0) / step, fz = (z - z0) / step;
    const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j;
    if (a + b <= 1) return at(i, j) + a * (at(i + 1, j) - at(i, j)) + b * (at(i, j + 1) - at(i, j));
    const h11 = at(i + 1, j + 1);
    return h11 + (1 - a) * (at(i, j + 1) - h11) + (1 - b) * (at(i + 1, j) - h11);
  }

  /** Float texture of the heights, for shaders that need water depth. */
  function heightTexture() {
    // half float: linear filtering is core in WebGL2 (float32 would need an extension)
    const half = new Uint16Array(h.length);
    for (let i = 0; i < h.length; i++) half[i] = THREE.DataUtils.toHalfFloat(h[i]);
    const tex = new THREE.DataTexture(half, nx, nz, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  return { ...json, heights: h, size, heightAt, heightTexture, sea: json.sea ?? 0.4 };
}
