// Lane markings and earthworks on the Khao Sam Muk hill roads: edge lines, a dashed centre line
// on the straights that turns solid through the bends (no overtaking), a concrete drain gutter along
// the bank (cut) side, and a stone retaining wall where the bank is steep. All of it is built into
// the kit ('road' material for the paint, 'wall' for the concrete) following the ground every metre.
import * as THREE from 'three';
import { HILL, sideIndex } from './hillgeom.js';
import { ribbonLift } from './roads.js';

export const MARKS = {
  kinds: ['residential', 'unclassified', 'secondary', 'tertiary'],   // lanes (service roads stay unmarked)
  edge: { in: 0.3, w: 0.13 },
  centre: { w: 0.13, dash: 3, gap: 5, solidTurn: 0.12 },             // solid when the road turns more than this over the look-ahead span
  paint: '#ece8dc', yellow: '#e8c23a', lift: 0.012,   // over this road's own ribbon (roads.js ribbonLift; the samples match the ribbon's — it was 9 cm when they were half a metre out of step)
  gutter: { off: 0.35, w: 0.5, h: 0.12, color: '#a39d92', inner: '#6f6a62' },
  wall: { minBank: 1.5, maxH: 2.3, thick: 0.55, off: 1.1, color: '#9f998d', cap: '#c3bdb0', seam: '#7e786d', every: 1.4 },
};

const col = h => new THREE.Color(h);

/** roads: hillSamples(); returns { solids, counts }. */
export function buildHillMarks(kit, map, layout, roads) {
  const M = MARKS, { roadIdx } = layout, solids = [], counts = { paint: 0, gutter: 0, wall: 0 };
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  const onOther = (road, x, z) => roadIdx.onOtherRoad(x, z, road, 0.2);

  // a ribbon of paint from offset t0 to t1 across the road (right-normal metres), over samples a…b
  function paint(road, S, a, b, t0, t1, colour) {
    const v = [];
    for (let i = a + 1; i <= b; i++) {
      const p = S[i - 1], q = S[i];
      if (onOther(road, (p.x + q.x) / 2, (p.z + q.z) / 2)) continue;                // the paint stops at a junction
      const up = ribbonLift(road.k) + M.lift, P = (s, t) => [s.x + s.nx * t, ground(s.x + s.nx * t, s.z + s.nz * t) + up, s.z + s.nz * t];
      const a1 = P(q, t1), a2 = P(q, t0), b1 = P(p, t1), b2 = P(p, t0);
      v.push(...b1, ...a1, ...b2, ...b2, ...a1, ...a2);                              // faces up
    }
    if (v.length) { kit.tris3('road', v, col(colour), { x: S[a].x, z: S[a].z }); counts.paint++; }
  }

  for (const { road, hw, s: S } of roads) {
    const marked = M.kinds.includes(road.k);
    // contiguous hill runs
    for (let i = 0; i < S.length;) {
      if (!S[i].hill) { i++; continue; }
      let j = i; while (j + 1 < S.length && S[j + 1].hill) j++;
      if (j - i >= 6) {
        if (marked) {
          paint(road, S, i, j, -(hw - M.edge.in), -(hw - M.edge.in) + M.edge.w, M.paint);          // edge lines, both sides
          paint(road, S, i, j, hw - M.edge.in - M.edge.w, hw - M.edge.in, M.paint);
          // centre: dashes on straights; through bends one solid yellow line
          let k = i, dist = 0;
          while (k < j) {
            const bendy = Math.abs(S[k].turn) > M.centre.solidTurn;
            let e = k; while (e < j && (Math.abs(S[e + 1].turn) > M.centre.solidTurn) === bendy) e++;
            if (bendy) paint(road, S, k, e, -M.centre.w, M.centre.w, M.yellow);
            else for (let m = k; m < e; m++) { dist++; if (dist % (M.centre.dash + M.centre.gap) < M.centre.dash && m + 1 <= e) paint(road, S, m, m + 1, -M.centre.w / 2, M.centre.w / 2, M.paint); }
            k = e + (e === k ? 1 : 0);
          }
        }
        earthworks(road, hw, S, i, j);
      }
      i = j + 1;
    }
  }

  // drain gutter + retaining wall on the bank side. Each metre is a strip from one sample's edge to the next
  // (kit.strip), so both follow the road up the hill without steps and without daylight under the low end.
  function earthworks(road, hw, S, a, b) {
    const G = M.gutter, W = M.wall;
    for (const side of [-1, 1]) {
      const k = sideIndex(side);
      // a row across the run at sample s: from offset o0 to o1 beyond the road's edge, top at `up` above the ground there
      const row = (s, o0, o1, up) => {
        const ex = s.nx * side, ez = s.nz * side, y = ground(s.x + ex * (hw + (o0 + o1) / 2), s.z + ez * (hw + (o0 + o1) / 2)) + up;
        return [s.x + ex * (hw + o0), y, s.z + ez * (hw + o0), s.x + ex * (hw + o1), y, s.z + ez * (hw + o1)];
      };
      const bankAt = i => { let t = 0; for (let m = -3; m <= 3; m++) t += S[Math.min(b, Math.max(a, i + m))].bankH[k] / 7; return t; };   // smoothed, so the wall top does not step
      let wallLen = 0;
      for (let i = a + 1; i <= b; i++) {
        const p = S[i - 1], q = S[i];
        if (!(p.cut[k] && q.cut[k]) || onOther(road, q.x, q.z)) { wallLen = 0; continue; }
        // gutter: a shallow concrete channel along the edge
        const ox = (p.x + q.x) / 2 + p.nx * side * (hw + G.off), oz = (p.z + q.z) / 2 + p.nz * side * (hw + G.off);
        if (roadIdx.clearance(ox, oz, 4) > -0.2) {                                    // not across another road
          kit.strip('wall', [row(p, G.off - G.w / 2, G.off + G.w / 2, G.h - 0.02), row(q, G.off - G.w / 2, G.off + G.w / 2, G.h - 0.02)], G.h + 0.25, col(G.color));
          kit.strip('wall', [row(p, G.off - G.w * 0.275, G.off + G.w * 0.275, G.h - 0.01), row(q, G.off - G.w * 0.275, G.off + G.w * 0.275, G.h - 0.01)], 0.03, col(G.inner));
          counts.gutter++;
        }
        // retaining wall where the bank is steep: height follows the bank, up to maxH
        const hp = Math.min(W.maxH, bankAt(i - 1) * 0.85), hq = Math.min(W.maxH, bankAt(i) * 0.85);
        if (Math.min(bankAt(i - 1), bankAt(i)) > W.minBank) {
          const wx = (p.x + q.x) / 2 + p.nx * side * (hw + W.off), wz = (p.z + q.z) / 2 + p.nz * side * (hw + W.off), wy = ground(wx, wz), h = (hp + hq) / 2, ry = Math.atan2(q.dx, q.dz);
          if (roadIdx.clearance(wx, wz, 4) > 0.4) {
            const t0 = W.off - W.thick / 2, t1 = W.off + W.thick / 2;
            kit.strip('wall', [row(p, t0, t1, hp), row(q, t0, t1, hq)], Math.max(hp, hq) + 0.5, col(W.color));
            kit.strip('wall', [row(p, t0 - 0.07, t1 + 0.07, hp + 0.09), row(q, t0 - 0.07, t1 + 0.07, hq + 0.09)], 0.12, col(W.cap));
            if (Math.floor(wallLen / W.every) !== Math.floor((wallLen + 1) / W.every)) kit.box('wall', wx - p.nx * side * (W.thick / 2 + 0.005), wy + h / 2, wz - p.nz * side * (W.thick / 2 + 0.005), 0.02, h, 1.07, ry, col(W.seam));   // expansion joint
            wallLen++; counts.wall++;
            if (wallLen % 2 === 0) solids.push({ x: wx, z: wz, r: 0.4, top: wy + h });
          }
        }
      }
    }
  }
  return { solids, counts };
}
