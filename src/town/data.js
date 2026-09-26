// Loads the baked map (tools/bake_map.py) and exposes height queries in scene units.
import * as THREE from 'three';

const BASE = new URL('./data/', import.meta.url);

export async function loadMap(name = 'bangsaen') {
  const [json, bin] = await Promise.all([
    fetch(new URL(`${name}.json`, BASE)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(new URL(`${name}-core.bin`, BASE)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
  ]);
  const { x0, z0, step, nx, nz } = json.core;
  const raw = new Int16Array(bin);
  if (raw.length !== nx * nz) throw new Error(`height grid size ${raw.length} != ${nx}x${nz}`);

  // heights in scene units (decimetres × hscale)
  const h = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) h[i] = raw[i] * 0.1 * json.hscale;

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
