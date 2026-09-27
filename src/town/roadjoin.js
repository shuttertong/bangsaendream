// Close small gaps in the road network. OSM (and the 100 m clip) leaves some roads stopping a
// few metres short of the road they obviously join — a footpath ending just before the park
// promenade, a service lane ending at the kerb. A dangling end is extended to the nearest point
// of another road when that is close, roughly straight ahead, and the link crosses no building.
import { roadWidth } from './roads.js';
import { inPoly } from './layout.js';

export const JOIN = {
  max: 12,          // metres: longest link added
  touch: 0.8,       // an end this close to another road already joins it
  ahead: 0.35,      // cos of the widest angle between the road's end direction and the link…
  anyAngle: 4,      // …unless the gap is shorter than this (an end stopping just beside another path)
  paths: ['footway', 'path', 'steps', 'cycleway', 'pedestrian'],   // paths may join anything; roads only join roads
};

const segDist = (x, z, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  const px = a[0] + dx * t, pz = a[1] + dz * t;
  return { d: Math.hypot(px - x, pz - z), p: [px, pz] };
};

/** Extends dangling road ends in map.roads in place. Returns { joined, links: [[x, z, len]] }. */
export function joinRoadEnds(map) {
  const J = JOIN, roads = map.roads.filter(r => roadWidth(r.k) && r.p.length >= 2), links = [];
  const blocked = (a, b) => {
    for (let k = 1; k < 4; k++) {
      const x = a[0] + (b[0] - a[0]) * k / 4, z = a[1] + (b[1] - a[1]) * k / 4;
      if (map.buildings.some(bd => inPoly(x, z, bd.p))) return true;
    }
    return false;
  };
  for (const r of roads) {
    for (const atStart of [true, false]) {
      const e = atStart ? r.p[0] : r.p[r.p.length - 1], prev = atStart ? r.p[1] : r.p[r.p.length - 2];
      const L = Math.hypot(e[0] - prev[0], e[1] - prev[1]) || 1, dir = [(e[0] - prev[0]) / L, (e[1] - prev[1]) / L];
      let best = null, touching = false;
      for (const o of roads) {
        if (o === r) continue;
        if (!J.paths.includes(r.k) && J.paths.includes(o.k)) continue;          // a road never dead-ends into a footpath
        for (let k = 1; k < o.p.length; k++) {
          const q = segDist(e[0], e[1], o.p[k - 1], o.p[k]);
          if (q.d < J.touch) { touching = true; break; }
          if (q.d > J.max || (best && q.d >= best.d)) continue;
          const cos = ((q.p[0] - e[0]) * dir[0] + (q.p[1] - e[1]) * dir[1]) / q.d;
          if (cos >= J.ahead || q.d < J.anyAngle) best = { ...q, o };
        }
        if (touching) break;
      }
      if (touching || !best || blocked(e, best.p)) continue;
      const pt = [+best.p[0].toFixed(1), +best.p[1].toFixed(1)];
      if (atStart) r.p.unshift(pt); else r.p.push(pt);
      links.push([pt[0], pt[1], +best.d.toFixed(1)]);
    }
  }
  return { joined: links.length, links };
}
