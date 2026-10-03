// Map picker for the admin page: the baked roads and coastline drawn on a canvas, top-down, in the
// game's own metres. Drag to pan, wheel/pinch to zoom, click to set a shop's position. Other
// placements show as dots; the one being edited as a ring.
const ZONES = {   // rough zone boxes (local metres) for the dropdown hint
  beach: [-700, 1300, -800, 1400], walking: [-1300, -1100, -1000, -880], laemthaen: [-1420, -1200, -900, -600],
  ksm: [-1100, -100, -2480, -1250], village: [-700, -400, -2480, -2100],
};
export const zoneAt = (x, z) => Object.keys(ZONES).find(k => { const b = ZONES[k]; return x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]; }) || 'beach';

export function createMapPicker(canvas, { onPick }) {
  const ctx = canvas.getContext('2d');
  let map = null, view = { cx: -300, cz: 0, ppm: 0.25 }, dots = [], current = null, drag = null, moved = false;
  fetch(new URL('../town/data/bangsaen.json', import.meta.url)).then(r => r.json()).then(j => { map = j; draw(); });

  const toPx = (x, z) => [(x - view.cx) * view.ppm + canvas.width / 2, (z - view.cz) * view.ppm + canvas.height / 2];
  const toXZ = (px, py) => [(px - canvas.width / 2) / view.ppm + view.cx, (py - canvas.height / 2) / view.ppm + view.cz];
  function size() { const r = canvas.getBoundingClientRect(); canvas.width = Math.round(r.width * devicePixelRatio); canvas.height = Math.round(r.height * devicePixelRatio); draw(); }
  function draw() {
    if (!map) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#9fd3d6'; ctx.fillRect(0, 0, W, H);                             // sea
    // land: the coast polygon is open; fill a big polygon from the coast line toward the east
    ctx.fillStyle = '#e9e0c6';
    for (const c of map.coast) { ctx.beginPath(); c.p.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); const [lx, lz] = c.p[c.p.length - 1], [fx, fz] = c.p[0]; ctx.lineTo(toPx(4000, lz)[0], toPx(4000, lz)[1]); ctx.lineTo(toPx(4000, fz)[0], toPx(4000, fz)[1]); ctx.closePath(); ctx.fill(); }
    const kinds = { secondary: ['#8a8378', 5], tertiary: ['#948d82', 4], residential: ['#a39c90', 2.5], unclassified: ['#a39c90', 2.5], service: ['#b3ac9f', 1.5], pedestrian: ['#c9a46a', 2.5], footway: ['#c9a46a', 1] };
    for (const r of map.roads) { const k = kinds[r.k]; if (!k) continue; ctx.strokeStyle = k[0]; ctx.lineWidth = Math.max(1, k[1] * view.ppm * 2); ctx.lineCap = 'round'; ctx.beginPath(); r.p.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); }
    for (const d of dots) { const [px, py] = toPx(d.x, d.z); ctx.fillStyle = d.color || '#d8743a'; ctx.beginPath(); ctx.arc(px, py, 5 * devicePixelRatio, 0, 7); ctx.fill(); if (view.ppm > 0.6) { ctx.fillStyle = '#3a3228'; ctx.font = `${12 * devicePixelRatio}px Kanit, sans-serif`; ctx.fillText(d.name, px + 8 * devicePixelRatio, py + 4 * devicePixelRatio); } }
    if (current) { const [px, py] = toPx(current.x, current.z); ctx.strokeStyle = '#d8743a'; ctx.lineWidth = 3 * devicePixelRatio; ctx.beginPath(); ctx.arc(px, py, 9 * devicePixelRatio, 0, 7); ctx.stroke(); const a = current.yaw || 0; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(a) * 18 * devicePixelRatio, py + Math.cos(a) * 18 * devicePixelRatio); ctx.stroke(); }
    ctx.fillStyle = 'rgba(58,50,40,.7)'; ctx.font = `${11 * devicePixelRatio}px monospace`; ctx.fillText(`${Math.round(1 / view.ppm * 100) / 100} m/px · scroll = zoom · drag = pan · click = place`, 8 * devicePixelRatio, H - 8 * devicePixelRatio);
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio]; };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz }; moved = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) moved = true; view.cx = drag.cx - dx * devicePixelRatio / view.ppm; view.cz = drag.cz - dy * devicePixelRatio / view.ppm; draw(); });
  canvas.addEventListener('pointerup', e => { if (drag && !moved) { const [x, z] = toXZ(...pos(e)); onPick(+x.toFixed(1), +z.toFixed(1)); } drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = pos(e), [x, z] = toXZ(px, py); view.ppm = Math.min(8, Math.max(0.05, view.ppm * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); const [nx, nz] = toXZ(px, py); view.cx += x - nx; view.cz += z - nz; draw(); }, { passive: false });
  addEventListener('resize', size); size();
  return {
    setDots(list) { dots = list; draw(); },
    setCurrent(c) { current = c; if (c && c.x != null) { view.cx = c.x; view.cz = c.z; view.ppm = Math.max(view.ppm, 1.5); } draw(); },
    center(x, z, ppm = 1.5) { view.cx = x; view.cz = z; view.ppm = ppm; draw(); },
  };
}
