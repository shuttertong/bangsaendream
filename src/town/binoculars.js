// Coin binocular viewers (กล้องส่องทางไกล) at the viewpoint: walk up, press F (฿5 — free if you
// are short), and the camera looks through the lenses. Drag / arrows / WASD to look around,
// wheel / pinch / + − to zoom, F or Esc to step back. Places you can see get a name tag with
// their distance (the drone's area list, so both stay in step).
import * as THREE from 'three';
import { t, tr, onLang } from '../shared/i18n.js';
import * as P from '../shared/progress.js';
import { DRONE_AREAS } from './drone.js';

const TAG_H = 50;                      // px: a name tag's height, for stacking

export const SCOPE = {
  fare: 5,
  reach: 1.6,                          // how close the kid must stand
  fov: { start: 14, min: 4, max: 24, step: 1.2 },
  turn: { drag: 0.0022, keys: 0.9, maxYaw: 1.25, pitch: [-0.55, 0.3] },   // rad per px (× zoom), rad/s, limits
  lens: 0.34,                          // lens radius as a share of the screen's short side
  pitch: -0.05,                        // start just below the horizon: the coast and the sea
  near: 10,                            // m: like real binoculars, nothing closer is in view (rail, shelter, monkeys)
  labels: ['beach', 'roundabout', 'laemThaen', 'walking', 'navyPier', 'khaoSamMuk', 'village'],   // DRONE_AREAS ids
};

/** spots: [{x, z, eye: Vector3, yaw}] from viewpoint.js. */
export function createBinoculars({ spots, camera, input, map, root, audio, player, toast }) {
  const S = SCOPE, s = { yaw: 0, pitch: S.pitch, fov: S.fov.start };
  let active = null, savedFov = camera.fov;
  const labels = DRONE_AREAS.filter(a => S.labels.includes(a.id) && Array.isArray(a.at));

  // ---------- overlay: two lens circles cut from a dark frame, name tags, buttons ----------
  const ui = document.createElement('div');
  ui.id = 'scope';
  ui.innerHTML = `<svg class="sc-mask"><path fill-rule="evenodd"/></svg><div class="sc-tags"></div>
    <div class="sc-bar"><button class="sc-out">−</button><button class="sc-in">+</button><button class="sc-exit"></button></div><div class="sc-hint"></div>`;
  root.appendChild(ui);
  const $ = q => ui.querySelector(q), tags = $('.sc-tags');
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(); };
  $('.sc-exit').addEventListener('pointerdown', stop(() => exit()));
  $('.sc-in').addEventListener('pointerdown', stop(() => zoom(-2)));
  $('.sc-out').addEventListener('pointerdown', stop(() => zoom(2)));
  const lensCircles = () => {
    const w = innerWidth, h = innerHeight, r = Math.min(w, h) * S.lens, dx = r * 0.78;
    return [[w / 2 - dx, h / 2, r], [w / 2 + dx, h / 2, r]];
  };
  function drawMask() {
    const w = innerWidth, h = innerHeight, svg = $('.sc-mask');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const circ = ([x, y, r]) => `M${x - r},${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
    // the two lenses overlap: draw their union as one hole (outline of both circles, even-odd on the frame only)
    const [a, b] = lensCircles(), ox = (a[0] + b[0]) / 2, oy = Math.sqrt(Math.max(0, a[2] ** 2 - ((b[0] - a[0]) / 2) ** 2));
    const union = `M${ox},${a[1] - oy} A${a[2]},${a[2]} 0 1,0 ${ox},${a[1] + oy} A${b[2]},${b[2]} 0 1,0 ${ox},${a[1] - oy} Z`;
    $('.sc-mask path').setAttribute('d', `M0,0 H${w} V${h} H0 Z ${oy ? union : circ(a) + circ(b)}`);
  }
  addEventListener('resize', () => active && drawMask());
  const refresh = () => {
    $('.sc-exit').textContent = t('scopeExit');
    $('.sc-hint').textContent = t('scopeHint');
  };
  onLang(refresh);
  refresh();

  function zoom(steps) { s.fov = THREE.MathUtils.clamp(s.fov * S.fov.step ** steps, S.fov.min, S.fov.max); }

  // ---------- use / leave ----------
  function nearest(p) {
    let best = null, bd = S.reach;
    for (const sp of spots) { const d = Math.hypot(sp.x - p.x, sp.z - p.z); if (d < bd) { bd = d; best = sp; } }
    return best;
  }
  const prompt = () => ['scopeUse', { n: S.fare }];
  function use(spot) {
    if (active || !spot) return;
    if (P.get().baht >= S.fare) { P.addBaht(-S.fare); toast?.(t('scopePaid', { n: S.fare }), 'coin'); }
    else toast?.(t('scopeFree'), 'coin');
    active = spot;
    Object.assign(s, { yaw: spot.yaw, pitch: S.pitch, fov: S.fov.start });
    savedFov = camera.fov;
    player.place(spot.x, spot.z, spot.yaw);                          // stand at the viewer, facing the view
    document.body.classList.add('scope');
    drawMask();
    audio?.play('click');
  }
  function exit() {
    if (!active) return;
    active = null;
    document.body.classList.remove('scope');
    tags.innerHTML = '';
    camera.fov = savedFov;
    camera.updateProjectionMatrix();
    audio?.play('click');
  }
  addEventListener('keydown', e => {
    if (!active) return;
    if (e.code === 'Escape' || e.code === 'KeyF') { e.stopImmediatePropagation(); exit(); }
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom(-1);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom(1);
  }, { capture: true });

  // ---------- per frame: aim the camera through the lenses, place the name tags ----------
  const v = new THREE.Vector3(), look = new THREE.Vector3();
  function update(dt) {
    if (!active) return;
    const k = s.fov / S.fov.start;                                   // finer aim when zoomed in
    // drag = grab the view (like the walking camera): drag left → look right, drag down → look up
    s.yaw += (input.drag.x + input.pan.x) * S.turn.drag * k;
    s.pitch += (input.drag.y + input.pan.y) * S.turn.drag * k;
    const kx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const ky = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    s.yaw -= kx * S.turn.keys * k * dt; s.pitch += ky * S.turn.keys * k * dt;
    if (input.wheel) zoom(input.wheel);
    const off = Math.atan2(Math.sin(s.yaw - active.yaw), Math.cos(s.yaw - active.yaw));
    s.yaw = active.yaw + THREE.MathUtils.clamp(off, -S.turn.maxYaw, S.turn.maxYaw);
    s.pitch = THREE.MathUtils.clamp(s.pitch, ...S.turn.pitch);
    camera.position.copy(active.eye);
    look.set(Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)).add(active.eye);
    camera.lookAt(look);
    if (Math.abs(camera.fov - s.fov) > 0.01) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    // name tags for places inside a lens
    const lens = lensCircles(), seen = [];
    for (const a of labels) {
      v.set(a.at[0], Math.max(map.heightAt(a.at[0], a.at[1]), map.sea) + 4, a.at[1]);
      const dist = v.distanceTo(active.eye);
      v.project(camera);
      if (v.z > 1) continue;
      const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
      if (!lens.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r * 0.88)) continue;
      seen.push({ a, x, y, dist, w: Math.max(90, tr(a.name).length * 13 + 24) });
    }
    // nearest first, lower on screen; a tag that would cover one already placed stacks above it
    seen.sort((p, q) => p.dist - q.dist);
    const placed = [];
    for (const g of seen) {
      let y = g.y;
      for (let guard = 0; guard < 8 && placed.some(o => Math.abs(o.x - g.x) < (o.w + g.w) / 2 && Math.abs(o.y - y) < TAG_H); guard++) y -= TAG_H;
      placed.push({ ...g, y });
    }
    tags.innerHTML = placed.map(g => {
      const km = g.dist >= 1000 ? t('km', { n: (g.dist / 1000).toFixed(1) }) : t('metres', { n: Math.round(g.dist / 10) * 10 });
      return `<div class="sc-tag" style="left:${g.x.toFixed(0)}px;top:${g.y.toFixed(0)}px"><b>${tr(g.a.name)}</b><span>${km}</span></div>`;
    }).join('');
  }

  return {
    get active() { return !!active; },
    get focus() { return active ? active.eye : null; },
    /** Camera near plane while looking through (main.js applies it). */
    near: SCOPE.near,
    nearest, prompt, use, exit, update,
  };
}
