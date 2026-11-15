// The race's mini-map: the whole circuit drawn north-up in a corner of the screen, the start line, and a dot
// for every kart in its own colour (the player's is an arrowhead pointing the way it goes).
// createMinimap(parent, track, colors) → { update(karts, myId), dispose() }.
import { GP } from './rules.js';

export function createMinimap(parent, track, colors) {
  const M = GP.map, px = M.size * Math.min(2, window.devicePixelRatio || 1);
  const el = document.createElement('canvas');
  el.width = el.height = px;
  el.className = 'gp-map';
  el.style.cssText = `position:absolute;right:max(10px,env(safe-area-inset-right));top:${M.top}px;width:min(${M.size}px,30vw);height:min(${M.size}px,30vw);pointer-events:none;border-radius:16px;background:${M.back};box-shadow:0 2px 10px rgba(0,0,0,.25)`;
  parent.appendChild(el);
  const g = el.getContext('2d');
  // fit the circuit into the square (north = up: −z)
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < track.n; i++) { x0 = Math.min(x0, track.x[i]); x1 = Math.max(x1, track.x[i]); z0 = Math.min(z0, track.z[i]); z1 = Math.max(z1, track.z[i]); }
  const k = (px * (1 - 2 * M.pad)) / Math.max(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const X = x => px / 2 + (x - cx) * k, Y = z => px / 2 + (z - cz) * k, u = px / M.size;
  // the road, drawn once
  const base = document.createElement('canvas');
  base.width = base.height = px;
  const b = base.getContext('2d');
  b.lineJoin = b.lineCap = 'round';
  const path = () => { b.beginPath(); for (let i = 0; i < track.n; i += 2) b[i ? 'lineTo' : 'moveTo'](X(track.x[i]), Y(track.z[i])); b.closePath(); };
  path(); b.strokeStyle = M.edge; b.lineWidth = 7 * u; b.stroke();
  path(); b.strokeStyle = M.road; b.lineWidth = 4 * u; b.stroke();
  { // the start line: a short chequered bar across the road
    const nx = track.tz[0], nz = -track.tx[0], sx = X(track.x[0]), sy = Y(track.z[0]);
    for (let i = -2; i < 2; i++) { b.fillStyle = i % 2 ? '#1a1a1a' : '#ffffff'; b.beginPath(); b.arc(sx + nx * (i + 0.5) * 2.4 * u, sy + nz * (i + 0.5) * 2.4 * u, 1.5 * u, 0, 7); b.fill(); }
  }
  let skip = 0;
  return {
    update(karts, myId) {
      if (skip++ % 2) return;
      g.clearRect(0, 0, px, px);
      g.drawImage(base, 0, 0);
      const dot = (kt, i, mine) => {
        const x = X(kt.x), y = Y(kt.z), r = (mine ? 6.5 : 3.4) * u;
        g.beginPath();
        if (mine) {                                                 // mine: an arrowhead pointing the way the kart goes
          const fx = Math.sin(kt.h), fy = Math.cos(kt.h);
          g.moveTo(x + fx * r * 1.5, y + fy * r * 1.5); g.lineTo(x - fx * r - fy * r, y - fy * r + fx * r); g.lineTo(x - fx * r * 0.45, y - fy * r * 0.45); g.lineTo(x - fx * r + fy * r, y - fy * r - fx * r); g.closePath();
        } else g.arc(x, y, r, 0, 7);
        g.lineJoin = 'round';
        if (mine) { g.lineWidth = 4.5 * u; g.strokeStyle = '#ffffff'; g.stroke(); }
        g.lineWidth = (mine ? 1.8 : 1) * u; g.strokeStyle = 'rgba(10,16,24,.85)'; g.stroke();
        g.fillStyle = colors[i % colors.length]; g.fill();
      };
      karts.forEach((kt, i) => { if (kt.id !== myId) dot(kt, i, false); });
      karts.forEach((kt, i) => { if (kt.id === myId) dot(kt, i, true); });
    },
    dispose() { el.remove(); },
  };
}
