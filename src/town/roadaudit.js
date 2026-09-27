// Road audit (debug): how realistic the roads near the sea are. In the console with ?debug=1:
// __game.auditRoads(). Metres of road (sampled every 2 m) that dip below the sea, bump, climb
// steeply or tilt sideways; how the kid's feet compare with the drawn surface; dangling ends;
// and the connected pieces of the walkable network.
import { roadWidth } from './roads.js';

export const AUDIT = { sea: 160, bump: 0.35, steep: 0.12, tilt: 0.1, sink: 0.05, gap: 15, touch: 0.8 };

export function auditRoads({ map, collision, layout, lift }) {
  const A = AUDIT, near = (x, z) => collision.inArea(x, z) && layout.seaDist(x, z) < A.sea;
  const roads = map.roads.filter(r => roadWidth(r.k) && r.p.length >= 2);
  const stats = {}, worst = { below: [], bump: [], steep: [], tilt: [], sink: [] };
  for (const r of roads) {
    const w = roadWidth(r.k), s = stats[r.k] ||= { m: 0, below: 0, bump: 0, steep: 0, tilt: 0, sink: 0 };
    const pts = [];
    for (let k = 1; k < r.p.length; k++) {
      const [ax, az] = r.p[k - 1], [bx, bz] = r.p[k], L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L; d += 2) pts.push([ax + (bx - ax) * d / L, az + (bz - az) * d / L, (bx - ax) / L, (bz - az) / L]);
    }
    for (let i = 2; i < pts.length - 2; i++) {
      const [x, z, dx, dz] = pts[i];
      if (!near(x, z)) continue;
      s.m += 2;
      const h = map.heightAt(x, z), hA = map.heightAt(pts[i - 2][0], pts[i - 2][1]), hB = map.heightAt(pts[i + 2][0], pts[i + 2][1]);
      const hl = map.heightAt(x - dz * w / 2, z + dx * w / 2), hr = map.heightAt(x + dz * w / 2, z - dx * w / 2);
      const drawn = Math.max(h, map.sea), feet = Math.max(h + lift(x, z), map.sea - collision.wade) - lift(x, z);
      const flags = {
        below: Math.min(h, hl, hr) < map.sea + 0.05, bump: Math.abs(hA - 2 * h + hB) > A.bump,
        steep: Math.abs(hB - hA) / 8 > A.steep, tilt: Math.abs(hl - hr) / w > A.tilt, sink: drawn - feet > A.sink,
      };
      for (const [k, v] of Object.entries(flags)) if (v) { s[k] += 2; if (worst[k].length < 50) worst[k].push([Math.round(x), Math.round(z), r.k]); }
    }
  }
  // dangling ends + connected pieces (ends within `touch` of another road join it)
  const segd = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z); };
  const par = roads.map((_, i) => i), find = i => (par[i] === i ? i : (par[i] = find(par[i])));
  const bb = roads.map(r => { let a = [Infinity, -Infinity, Infinity, -Infinity]; for (const [x, z] of r.p) a = [Math.min(a[0], x), Math.max(a[1], x), Math.min(a[2], z), Math.max(a[3], z)]; return a; });
  const ends = { joined: 0, gaps: [], dead: 0 };
  roads.forEach((r, i) => {
    for (const e of [r.p[0], r.p[r.p.length - 1]]) {
      let best = Infinity;
      roads.forEach((o, j) => {
        if (j === i || e[0] < bb[j][0] - A.gap || e[0] > bb[j][1] + A.gap || e[1] < bb[j][2] - A.gap || e[1] > bb[j][3] + A.gap) return;
        for (let k = 1; k < o.p.length; k++) {
          const d = segd(e[0], e[1], o.p[k - 1], o.p[k]);
          if (d < best) best = d;
          if (d < A.touch) par[find(i)] = find(j);
        }
      });
      if (!near(e[0], e[1])) continue;
      if (best < A.touch) ends.joined++; else if (best < A.gap) ends.gaps.push([Math.round(e[0]), Math.round(e[1]), r.k, +best.toFixed(1)]); else ends.dead++;
    }
  });
  const pieces = {};
  roads.forEach((r, i) => {
    let m = 0;
    for (let k = 1; k < r.p.length; k++) if (near((r.p[k - 1][0] + r.p[k][0]) / 2, (r.p[k - 1][1] + r.p[k][1]) / 2)) m += Math.hypot(r.p[k][0] - r.p[k - 1][0], r.p[k][1] - r.p[k - 1][1]);
    const c = pieces[find(i)] ||= { m: 0, box: [Infinity, -Infinity, Infinity, -Infinity] };
    c.m += m;
    if (m) c.box = [Math.min(c.box[0], bb[i][0]), Math.max(c.box[1], bb[i][1]), Math.min(c.box[2], bb[i][2]), Math.max(c.box[3], bb[i][3])];
  });
  const list = Object.values(pieces).filter(c => c.m > 30).sort((a, b) => b.m - a.m).map(c => ({ m: Math.round(c.m), box: c.box.map(Math.round) }));
  const total = k => Object.values(stats).reduce((a, s) => a + s[k], 0);
  return {
    metres: total('m'), below: total('below'), bump: total('bump'), steep: total('steep'), tilt: total('tilt'), sink: total('sink'),
    ends: { joined: ends.joined, dead: ends.dead, gaps: ends.gaps.length }, pieces: list, stats, worst, gaps: ends.gaps,
  };
}
