// Road ribbons draped over the terrain, width and surface by OSM highway type.
import * as THREE from 'three';
import { walkLine } from './layout.js';

// width (m), surface colour, centre dashes
export const ROAD_STYLE = {
  secondary:     { w: 10, col: '#5f6163', dash: true },
  tertiary:      { w: 8, col: '#646668', dash: true },
  unclassified:  { w: 6, col: '#6a6b6c' },
  residential:   { w: 5.5, col: '#6c6d6e' },
  living_street: { w: 4.5, col: '#77787a' },
  service:       { w: 3.8, col: '#86857f' },
  pedestrian:    { w: 5, col: '#b9ad98' },      // beach promenade paving
  footway:       { w: 1.8, col: '#b3a893' },
  path:          { w: 1.4, col: '#a89a78' },
  track:         { w: 3, col: '#9d8a66' },
  steps:         { w: 1.6, col: '#a39e94' },
  cycleway:      { w: 2, col: '#8a6e62' },
};
const LIFT = 0.1, STEP = 3, DASH = 3, GAP = 5;
const SIDEWALK = { kinds: ['secondary', 'tertiary'], w: 2.4, lift: 0.22, col: '#bdb6a8', curb: '#d9d4c8' };
export const roadWidth = k => ROAD_STYLE[k]?.w || 0;

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
  return { pts, nrm };
}

function ribbon(kit, map, pts, nrm, hw, lift, color, at, shift = 0) {
  const v = [];
  const y = (x, z) => Math.max(map.heightAt(x, z), map.sea) + lift;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [anx, anz] = nrm[i - 1], [bnx, bnz] = nrm[i];
    const a1 = [ax + anx * (shift + hw), az + anz * (shift + hw)], a2 = [ax + anx * (shift - hw), az + anz * (shift - hw)];
    const b1 = [bx + bnx * (shift + hw), bz + bnz * (shift + hw)], b2 = [bx + bnx * (shift - hw), bz + bnz * (shift - hw)];
    const P = q => [q[0], y(q[0], q[1]), q[1]];
    // wind so the face points up
    v.push(...P(a1), ...P(b1), ...P(a2), ...P(a2), ...P(b1), ...P(b2));
  }
  if (v.length) kit.tris3('road', v, color, at);
}

export function buildRoads(kit, map) {
  // bigger roads drawn slightly higher so they win at junctions
  const order = Object.keys(ROAD_STYLE).reverse();
  for (const r of map.roads) {
    const st = ROAD_STYLE[r.k];
    if (!st || r.p.length < 2) continue;
    const { pts, nrm } = frame(r.p);
    const lift = LIFT + (order.indexOf(r.k) + 1) * 0.004;
    const mid = pts[pts.length >> 1];
    const at = { x: mid[0], z: mid[1] };
    ribbon(kit, map, pts, nrm, st.w / 2, lift, new THREE.Color(st.col), at);
    if (SIDEWALK.kinds.includes(r.k)) for (const s of [-1, 1]) {
      const mid = s * (st.w / 2 + SIDEWALK.w / 2);
      ribbon(kit, map, pts, nrm, SIDEWALK.w / 2, SIDEWALK.lift, new THREE.Color(SIDEWALK.col), at, mid);
      ribbon(kit, map, pts, nrm, 0.09, SIDEWALK.lift + 0.02, new THREE.Color(SIDEWALK.curb), at, s * (st.w / 2 + 0.09));
    }
    if (st.dash) {
      // centre dashes: short ribbons along the middle
      let s = 0;
      for (let i = 1; i < pts.length; i++) {
        const segL = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if ((s % (DASH + GAP)) < DASH) ribbon(kit, map, [pts[i - 1], pts[i]], [nrm[i - 1], nrm[i]], 0.08, lift + 0.01, new THREE.Color('#e8e4d8'), at);
        s += segL;
      }
    }
  }
}
