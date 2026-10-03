// The friends map: the coast and roads of the baked map drawn top-down on a canvas (the game's own
// metres, north up), with a dot for you, for every friend who is online and for other players.
// Drag pans, wheel / pinch zooms, a tap picks the nearest dot.
const STYLE = {
  sea: '#9fd3d6', land: '#efe6cc', hill: '#cfe0b4',
  roads: { secondary: ['#8a8378', 5], tertiary: ['#948d82', 4], residential: ['#a39c90', 2.5], unclassified: ['#a39c90', 2.5], pedestrian: ['#c9a46a', 2.5] },
  me: '#d8743a', friend: '#2f9a5f', other: '#8f98a0', ink: '#3a3228',
  fit: { x0: -1500, x1: 1750, z0: -2520, z1: 1500 },      // the playable coast
  zoom: [0.04, 3], pick: 22,                              // px per metre (css px); tap radius (css px)
};

export function createFriendMap(canvas, map, { onPick }) {
  const ctx = canvas.getContext('2d'), S = STYLE, view = { cx: 0, cz: 0, ppm: 0.1 };
  let dots = [], sel = null, dpr = 1;
  const pointers = new Map();
  let drag = null, pinch = null, moved = false;

  const toPx = (x, z) => [(x - view.cx) * view.ppm * dpr + canvas.width / 2, (z - view.cz) * view.ppm * dpr + canvas.height / 2];
  function fit() {
    const r = canvas.getBoundingClientRect(), f = S.fit;
    if (!r.width) return;
    view.cx = (f.x0 + f.x1) / 2; view.cz = (f.z0 + f.z1) / 2;
    view.ppm = Math.min(r.width / (f.x1 - f.x0), r.height / (f.z1 - f.z0));
  }
  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  const line = p => { ctx.beginPath(); p.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); };

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = S.sea; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = S.land;                                   // land: from each coastline out to the east
    for (const c of map.coast) {
      line(c.p);
      const last = c.p[c.p.length - 1], first = c.p[0];
      ctx.lineTo(...toPx(6000, last[1])); ctx.lineTo(...toPx(6000, first[1])); ctx.closePath(); ctx.fill();
    }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const r of map.roads) {
      const k = S.roads[r.k];
      if (!k) continue;
      ctx.strokeStyle = k[0]; ctx.lineWidth = Math.max(1, k[1] * view.ppm * 2) * dpr;
      line(r.p); ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const d of [...dots].sort((a, b) => (a.kind === 'other' ? 0 : 1) - (b.kind === 'other' ? 0 : 1))) {
      const [px, py] = toPx(d.x, d.z), r = (d.kind === 'other' ? 4 : 7) * dpr;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, r + 2 * dpr, 0, 7); ctx.fill();
      ctx.fillStyle = S[d.kind]; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
      if (d.key === sel) { ctx.strokeStyle = S.ink; ctx.lineWidth = 2.5 * dpr; ctx.beginPath(); ctx.arc(px, py, r + 6 * dpr, 0, 7); ctx.stroke(); }
      if (d.kind !== 'other') {
        ctx.font = `600 ${12 * dpr}px Kanit, sans-serif`;
        ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(d.name, px, py - r - 6 * dpr);
        ctx.fillStyle = S.ink; ctx.fillText(d.name, px, py - r - 6 * dpr);
      }
    }
  }

  // ---------- pointer: drag, pinch, tap ----------
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const zoomAt = (px, py, k) => {
    const r = canvas.getBoundingClientRect(), wx = (px - r.width / 2) / view.ppm + view.cx, wz = (py - r.height / 2) / view.ppm + view.cz;
    view.ppm = Math.min(S.zoom[1], Math.max(S.zoom[0], view.ppm * k));
    view.cx = wx - (px - r.width / 2) / view.ppm; view.cz = wz - (py - r.height / 2) / view.ppm;
  };
  canvas.addEventListener('pointerdown', e => {
    e.stopPropagation();
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, at(e));
    if (pointers.size === 1) { drag = { p: at(e), cx: view.cx, cz: view.cz }; moved = false; }
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; moved = true; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, at(e));
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d; draw();
    } else if (drag) {
      const [x, y] = at(e), dx = x - drag.p[0], dy = y - drag.p[1];
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { view.cx = drag.cx - dx / view.ppm; view.cz = drag.cz - dy / view.ppm; draw(); }
    }
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!moved && drag) {                                     // a tap: the nearest dot that can be picked
      let best = null, bd = S.pick;
      for (const d of dots) {
        if (d.kind !== 'friend') continue;
        const [px, py] = toPx(d.x, d.z), dist = Math.hypot(px / dpr - p[0], py / dpr - p[1]);
        if (dist < bd) { bd = dist; best = d; }
      }
      if (best) onPick(best.key);
    }
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(...at(e), e.deltaY < 0 ? 1.2 : 1 / 1.2); draw(); }, { passive: false });

  return {
    /** dots: [{ key, kind: 'me' | 'friend' | 'other', x, z, name }] */
    set(list, selected = null) { dots = list; sel = selected; draw(); },
    /** Call when the panel opens (the canvas has a size only then). */
    open() { size(); fit(); draw(); },
    center(x, z, ppm = 0.6) { view.cx = x; view.cz = z; view.ppm = Math.max(view.ppm, ppm); draw(); },
  };
}
