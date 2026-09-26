// Road ribbons draped over the terrain (sampled on the exact terrain surface, dense
// enough along and across to follow the terrain's triangle creases), width and surface
// by OSM highway type. Main roads get paved pavements with a real kerb, white edge lines
// and centre dashes; asphalt gets worn wheel tracks and patchy colour.
import * as THREE from 'three';
import { walkLine } from './layout.js';

// width (m), surface colour, centre dashes / edge lines
export const ROAD_STYLE = {
  secondary:     { w: 10, col: '#5b5d60', dash: true },
  tertiary:      { w: 8, col: '#606265', dash: true },
  unclassified:  { w: 6, col: '#67686a' },
  residential:   { w: 5.5, col: '#69696b' },
  living_street: { w: 4.5, col: '#747578' },
  service:       { w: 3.8, col: '#82817b' },
  pedestrian:    { w: 5, col: '#bcae96', paved: true },      // beach promenade paving
  footway:       { w: 1.8, col: '#b3a893', paved: true },
  path:          { w: 1.4, col: '#a89a78' },
  track:         { w: 3, col: '#9d8a66' },
  steps:         { w: 1.6, col: '#a39e94', paved: true },
  cycleway:      { w: 2, col: '#8a6e62' },
};
export const ROAD_LIFT = 0.06;
export const SIDEWALK = { kinds: ['secondary', 'tertiary'], w: 2.4, lift: 0.2, col: '#c2baa9', col2: '#b4ab98', curb: '#dcd7cb' };
const STEP = 2, DASH = 3, GAP = 5;
export const roadWidth = k => ROAD_STYLE[k]?.w || 0;

/** How high the walkable surface is above the terrain at (x, z): road, pavement or 0. */
export function surfaceLift(roadIdx, x, z) {
  const n = roadIdx.nearest(x, z, 12);
  if (!n) return 0;
  if (n.d < 0) return ROAD_LIFT;
  return SIDEWALK.kinds.includes(n.k) && n.d < SIDEWALK.w ? SIDEWALK.lift : 0;
}

/** Densified polyline with per-point unit normals (mitred at corners). */
function frame(p) {
  const pts = [];
  walkLine(p, STEP, (x, z) => pts.push([x, z]));
  const last = p[p.length - 1];
  if (!pts.length || Math.hypot(pts[pts.length - 1][0] - last[0], pts[pts.length - 1][1] - last[1]) > 0.3) pts.push([...last]);
  const nrm = pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [-dz / L, dx / L];
  });
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, nrm, along };
}

/**
 * A strip from offset t0 to t1 across the road (metres, + = left normal), split into
 * `cols` columns so it follows the terrain. colour(sAlong, tAcross) → Color, sampled
 * once per quad (flat: paving slabs) or at every vertex (smooth: asphalt).
 */
function strip(kit, map, F, t0, t1, cols, lift, colour, at, smooth = false) {
  const { pts, nrm, along } = F;
  const pos = [], col = [];
  const P = (i, t) => {
    const x = pts[i][0] + nrm[i][0] * t, z = pts[i][1] + nrm[i][1] * t;
    return [x, Math.max(map.heightAt(x, z), map.sea) + lift, z];
  };
  for (let i = 1; i < pts.length; i++) for (let k = 0; k < cols; k++) {
    const ta = t0 + (t1 - t0) * (k / cols), tb = t0 + (t1 - t0) * ((k + 1) / cols);
    const a1 = P(i - 1, tb), a2 = P(i - 1, ta), b1 = P(i, tb), b2 = P(i, ta);
    pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2);       // wound to face up
    if (smooth) {
      const sa = along[i - 1], sb = along[i];
      for (const [sv, tv] of [[sa, tb], [sb, tb], [sa, ta], [sa, ta], [sb, tb], [sb, ta]]) { const c = colour(sv, tv); col.push(c.r, c.g, c.b); }
    } else {
      const c = colour((along[i - 1] + along[i]) / 2, (ta + tb) / 2);
      for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
    }
  }
  if (!pos.length) return;
  // kit.add visits vertices in order, so hand it the per-quad colours one by one
  let n = 0;
  const tmp = new THREE.Color();
  kit.tris3('road', pos, () => { const k = n++ * 3; return tmp.setRGB(col[k], col[k + 1], col[k + 2]); }, at);
}

/** Vertical kerb face along offset t, from `lo` to `hi` above the terrain, facing the road. */
function kerb(kit, map, F, t, lo, hi, color, at) {
  const { pts, nrm } = F, v = [];
  const side = Math.sign(t);
  for (let i = 1; i < pts.length; i++) {
    const q = j => { const x = pts[j][0] + nrm[j][0] * t, z = pts[j][1] + nrm[j][1] * t; return [x, Math.max(map.heightAt(x, z), map.sea), z]; };
    const a = q(i - 1), b = q(i);
    const A0 = [a[0], a[1] + lo, a[2]], A1 = [a[0], a[1] + hi, a[2]], B0 = [b[0], b[1] + lo, b[2]], B1 = [b[0], b[1] + hi, b[2]];
    // face toward the road (−side × left normal)
    if (side < 0) v.push(...A0, ...B0, ...A1, ...A1, ...B0, ...B1);
    else v.push(...A0, ...A1, ...B0, ...A1, ...B1, ...B0);
  }
  if (v.length) kit.tris3('road', v, color, at);
}

export function buildRoads(kit, map) {
  // bigger roads drawn slightly higher so they win at junctions
  const order = Object.keys(ROAD_STYLE).reverse();
  const white = new THREE.Color('#ebe7dc');
  for (const r of map.roads) {
    const st = ROAD_STYLE[r.k];
    if (!st || r.p.length < 2) continue;
    const F = frame(r.p);
    const lift = ROAD_LIFT + (order.indexOf(r.k) + 1) * 0.004;
    const mid = F.pts[F.pts.length >> 1];
    const at = { x: mid[0], z: mid[1] };
    const hw = st.w / 2, base = new THREE.Color(st.col), c = new THREE.Color();

    if (st.paved) {
      // paving slabs: alternate two shades in a running-bond pattern
      strip(kit, map, F, -hw, hw, Math.max(1, Math.round(st.w / 1.2)), lift, (s, t) => {
        const k = (Math.floor(s / 1.2) + Math.floor((t + hw) / 1.2 + (Math.floor(s / 1.2) % 2) * 0.5)) % 2;
        return c.copy(base).offsetHSL(0, 0, k ? 0.03 : -0.02);
      }, at);
    } else {
      // asphalt: darker worn wheel tracks down each lane, lighter near the edges
      // (smooth per-vertex shading; the material's world noise adds the fine grain)
      const cols = st.w >= 5 ? 8 : 4;
      strip(kit, map, F, -hw, hw, cols, lift, (s, t) => {
        const lane = Math.abs(t) / hw;                               // 0 centre … 1 edge
        const track = Math.exp(-(((lane - 0.5) / 0.14) ** 2)) * -0.03;
        const edge = Math.max(0, lane - 0.85) * 0.12;
        return c.copy(base).offsetHSL(0, 0, track + edge + Math.sin(s * 0.11 + t) * 0.006);
      }, at, true);
    }

    if (st.dash) {
      // centre dashes + solid white edge lines
      let s = 0;
      for (let i = 1; i < F.pts.length; i++) {
        const segL = F.along[i] - F.along[i - 1];
        if ((s % (DASH + GAP)) < DASH) strip(kit, map, { pts: [F.pts[i - 1], F.pts[i]], nrm: [F.nrm[i - 1], F.nrm[i]], along: [0, segL] }, -0.08, 0.08, 1, lift + 0.01, () => white, at);
        s += segL;
      }
      for (const e of [-1, 1]) { const a = e * (hw - 0.45), b = e * (hw - 0.3); strip(kit, map, F, Math.min(a, b), Math.max(a, b), 1, lift + 0.01, () => white, at); }
    }

    if (SIDEWALK.kinds.includes(r.k)) for (const e of [-1, 1]) {
      // raised pavement with slabs, a kerb stone and its vertical face toward the road
      const a = e * (hw + 0.2), b = e * (hw + SIDEWALK.w);
      const s1 = new THREE.Color(SIDEWALK.col), s2 = new THREE.Color(SIDEWALK.col2);
      strip(kit, map, F, Math.min(a, b), Math.max(a, b), 2, SIDEWALK.lift, (s, t) => ((Math.floor(s / 1.0) + Math.floor(Math.abs(t) / 1.2)) % 2 ? s1 : s2), at);
      strip(kit, map, F, e > 0 ? hw : -hw - 0.2, e > 0 ? hw + 0.2 : -hw, 1, SIDEWALK.lift + 0.02, () => new THREE.Color(SIDEWALK.curb), at);
      kerb(kit, map, F, e * hw, lift - 0.02, SIDEWALK.lift + 0.02, new THREE.Color('#c9c3b6'), at);
    }
  }
}
