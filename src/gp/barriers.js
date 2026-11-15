// The circuit's safety barriers, put up for the race only (a street circuit's look): a wall of
// concrete blocks along both edges of the road with a tall catch fence on posts above it, banner
// boards on the straights, red-and-white blocks and kerbs through the bends and tyre stacks on the
// outside of the tight ones. Built along the track's samples in chunks (so chunks out of view are
// not drawn): one vertex-coloured mesh and one fence mesh (a wire-mesh texture) per chunk.
import * as THREE from 'three';
import { paintedMaterial } from '../world/materials.js';

export const BARRIER = {
  out: 0.45,                                   // the wall's inner face stands this far beyond the usable edge (the kart's half-width)
  block: { h: 0.85, foot: 0.5, top: 0.26, len: 4 },   // concrete block: height, width at the foot and the top, length
  fence: { h: 2.5, post: 4, tex: 0.7 },         // top of the catch fence above the road, post spacing, metres per texture repeat
  bend: 0.022, tight: 0.05,                    // curvature (1/m) from which blocks and kerbs go red-and-white; and tyres stand outside
  kerb: { w: 0.55, len: 1.5, lift: 0.13 },
  tyre: { r: 0.3, h: 0.72, every: 0.62 },
  banner: { every: 44, len: 7, y: [0.95, 1.75] },
  chunk: 110,                                  // samples (2 m each) per chunk
  colors: { concrete: ['#c9c6bd', '#b9b6ad'], red: '#d8392f', white: '#f1eee6', post: '#8f959b', tyre: '#2c2c2c', banners: ['#2f6fc4', '#f2c230', '#d8392f', '#f1eee6', '#3a9a6a'] },
};

/** A wire-mesh texture: diamonds of grey wire on nothing. */
function meshTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(205,210,214,0.95)'; g.lineWidth = 2.2;
  for (let i = -128; i <= 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  g.lineWidth = 5; g.strokeRect(0, 0, 128, 128);                                     // the panel's frame wire (top and bottom of each repeat)
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** track: gp/track.js (with half[] filled); ground(x, z): the road surface. Returns a Group. */
export function buildBarriers(track, ground, B = BARRIER) {
  const root = new THREE.Group(), C = B.colors, col = new THREE.Color();
  const solidMat = paintedMaterial({ amp: 0.08, scale: 2 });
  const fenceMat = new THREE.MeshLambertMaterial({ map: meshTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const n = track.n, wrap = track.wrap;
  // which side the road bends toward at i (+1 = the +d side), from the change of heading
  const toward = i => { const a = wrap(i - 3), b = wrap(i + 3); return Math.sign((track.tx[b] - track.tx[a]) * track.tz[i] - (track.tz[b] - track.tz[a]) * track.tx[i]) || 1; };
  /** The point `d` metres off the centreline at sample i, `up` above the road. */
  const P = (i, d, up) => { const k = wrap(i), x = track.x[k] + track.tz[k] * d, z = track.z[k] - track.tx[k] * d; return [x, ground(x, z) + up, z]; };

  for (let c0 = 0; c0 < n; c0 += B.chunk) {
    const pos = [], colr = [], fpos = [], fuv = [];
    const quad = (a, b, c, d, hex) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); col.set(hex); for (let v = 0; v < 6; v++) colr.push(col.r, col.g, col.b); };
    const c1 = Math.min(n, c0 + B.chunk);
    for (let i = c0; i < c1; i++) for (const side of [1, -1]) {
      const e0 = (track.half[i] + B.out) * side, e1 = (track.half[wrap(i + 1)] + B.out) * side, s = i * track.step;
      const bend = Math.abs(track.k[i]) > B.bend, blk = Math.floor(s / B.block.len), outer = toward(i) !== side;
      const hex = bend ? (blk % 2 ? C.red : C.white) : C.concrete[blk % 2], K = B.block;
      // the block: inner face, top, outer face (a little narrower at the top)
      const in0 = [P(i, e0, 0), P(i + 1, e1, 0)], it = [P(i, e0 + side * (K.foot - K.top) / 2, K.h), P(i + 1, e1 + side * (K.foot - K.top) / 2, K.h)];
      const ot = [P(i, e0 + side * (K.foot + K.top) / 2, K.h), P(i + 1, e1 + side * (K.foot + K.top) / 2, K.h)], o0 = [P(i, e0 + side * K.foot, -0.3), P(i + 1, e1 + side * K.foot, -0.3)];
      const face = (a, b, c, d, h2) => (side > 0 ? quad(a, b, c, d, h2) : quad(b, a, d, c, h2));
      face(in0[1], in0[0], it[0], it[1], hex); face(it[1], it[0], ot[0], ot[1], hex); face(ot[1], ot[0], o0[0], o0[1], hex);
      // the catch fence above the block, and a post every few metres
      const fm = side * K.foot / 2, f0 = P(i, e0 + fm, K.h), f1 = P(i + 1, e1 + fm, K.h), g0 = [f0[0], f0[1] + B.fence.h - K.h, f0[2]], g1 = [f1[0], f1[1] + B.fence.h - K.h, f1[2]];
      fpos.push(...f0, ...f1, ...g1, ...f0, ...g1, ...g0);
      const u0 = s / B.fence.tex, u1 = (s + track.step) / B.fence.tex, v1 = (B.fence.h - K.h) / B.fence.tex;
      fuv.push(u0, 0, u1, 0, u1, v1, u0, 0, u1, v1, u0, v1);
      if (i % Math.round(B.fence.post / track.step) === 0) {
        const w = 0.04, tx = track.tx[i] * w, tz = track.tz[i] * w, top = [f0[0], g0[1] + 0.06, f0[2]];
        const a = [f0[0] - tx, f0[1], f0[2] - tz], b = [f0[0] + tx, f0[1], f0[2] + tz], a2 = [top[0] - tx, top[1], top[2] - tz], b2 = [top[0] + tx, top[1], top[2] + tz];
        quad(a, b, b2, a2, C.post); quad(b, a, a2, b2, C.post);
      }
      // banner boards on the fence along the straights (plain colours: nobody's name)
      if (!bend && Math.floor(s / B.banner.every) % 2 === (side > 0 ? 0 : 1) && s % B.banner.every < B.banner.len) {
        const [y0, y1] = B.banner.y, bi = e0 + fm - side * 0.03, bj = e1 + fm - side * 0.03, hexB = C.banners[Math.floor(s / B.banner.every) % C.banners.length];
        const a = P(i, bi, y0), b = P(i + 1, bj, y0), c = P(i + 1, bj, y1), d = P(i, bi, y1);
        face(b, a, d, c, hexB);
        if (s % B.banner.every > 1 && s % B.banner.every < B.banner.len - 2) { const m0 = P(i, bi - side * 0.01, (y0 + y1) / 2 - 0.08), m1 = P(i + 1, bj - side * 0.01, (y0 + y1) / 2 - 0.08), m2 = P(i + 1, bj - side * 0.01, (y0 + y1) / 2 + 0.08), m3 = P(i, bi - side * 0.01, (y0 + y1) / 2 + 0.08); face(m1, m0, m3, m2, hexB === C.white ? C.red : C.white); }
      }
      // painted kerb along the inside of a bend
      if (bend && !outer) {
        const kc = Math.floor(s / B.kerb.len) % 2 ? C.red : C.white, a = P(i, e0 - side * B.kerb.w, B.kerb.lift), b = P(i + 1, e1 - side * B.kerb.w, B.kerb.lift), c = P(i + 1, e1, B.kerb.lift * 0.4), d = P(i, e0, B.kerb.lift * 0.4);
        face(a, b, c, d, kc);
      }
      // tyre stacks along the outside of a tight bend
      if (outer && Math.abs(track.k[i]) > B.tight) for (let q = 0; q < track.step; q += B.tyre.every) {
        const u = q / track.step, d = e0 + (e1 - e0) * u - side * (B.tyre.r + 0.04), a = P(i, d, 0), b = P(i + 1, d, 0), cx = a[0] + (b[0] - a[0]) * u, cy = a[1] + (b[1] - a[1]) * u, cz = a[2] + (b[2] - a[2]) * u;
        const N = 8, ring = y => Array.from({ length: N }, (_, m) => [cx + Math.cos(m / N * Math.PI * 2) * B.tyre.r, cy + y, cz + Math.sin(m / N * Math.PI * 2) * B.tyre.r]);
        const lo = ring(0), hi = ring(B.tyre.h), stripe = Math.floor(s / 2 + q) % 3 === 0 ? C.white : C.tyre;
        for (let m = 0; m < N; m++) { const m2 = (m + 1) % N; quad(lo[m2], lo[m], hi[m], hi[m2], m % 2 ? C.tyre : stripe); quad(hi[m], [cx, cy + B.tyre.h, cz], [cx, cy + B.tyre.h, cz], hi[m2], C.tyre); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.computeVertexNormals();
    const solid = new THREE.Mesh(g, solidMat);
    solid.receiveShadow = true;
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    fg.computeVertexNormals();
    root.add(solid, new THREE.Mesh(fg, fenceMat));
  }
  return root;
}
