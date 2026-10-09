// Small geometry helpers shared by the person builders (toon.js, fantasy.js): vertex-coloured
// primitives in the shapes the kit merges (non-indexed, no UVs).
import * as THREE from 'three';

export const SEG = { limb: [6, 14], round: [18, 12] };
// How finely people are meshed: 1 for the kid and the cast (seen close up, ~25k triangles each);
// the background crowd is built coarser (body.js bakePerson sets it while it builds).
export const DETAIL = { k: 1 };
/** A segment count at the current detail. */
export const seg = (n, min = 4) => Math.max(min, Math.round(n * DETAIL.k));
const seg_ = seg;                                   // (lathe's own parameter is called `seg`)

export function colored(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
export const sc = (g, x, y, z) => { g.scale(x, y, z); return g; };
export const sph = (r, w = SEG.round[0], h = SEG.round[1]) => new THREE.SphereGeometry(r, seg(w), seg(h, 3));
export const cap = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), seg(SEG.limb[0], 2), seg(SEG.limb[1]));
/** Lathe of an [r, y] profile; the profile may run either way (it is turned to face outward). */
export const lathe = (pts, seg = 22) => {
  if (pts[0][1] > pts[pts.length - 1][1]) pts = [...pts].reverse();
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg_(seg));
};
/** Thin ring (collar, hem trim, waistband) lying flat at y, radius r, thickness t. */
export const ring = (r, t, y, depth = 1) => at(sc(new THREE.TorusGeometry(r, t, seg(6, 3), seg(24, 6)).rotateX(Math.PI / 2), 1, 1, depth), 0, y, 0);
