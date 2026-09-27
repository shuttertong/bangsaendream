// Drone view (โดรน): fly the camera up over Bang Saen and look down on an area. Pick a named
// area from the chips, drag a box around any area (select tool), or double-tap a spot to fly
// down to it. Drag pans, wheel / pinch zooms, Q/E turn, WASD glide; the angle button switches
// straight-down ↔ tilted. The kid waits where they stood; the town keeps living below.
import * as THREE from 'three';
import { t, tr, onLang } from '../shared/i18n.js';
import { VIEWPOINT } from './viewpoint.js';

// at: [x, z] centre in local metres (or 'player'); size: metres the view should take in
export const DRONE_AREAS = [
  { id: 'overview', icon: '🗺️', name: { th: 'ภาพรวมบางแสน', en: 'All of Bang Saen' }, at: [-300, -400], size: 3600 },
  { id: 'kid', icon: '🧒', name: { th: 'ตัวเรา', en: 'Me' }, at: 'player', size: 140 },
  { id: 'beach', icon: '🏖️', name: { th: 'หาดบางแสน', en: 'Bang Saen Beach' }, at: [60, 560], size: 1500 },
  { id: 'roundabout', icon: '🐬', name: { th: 'วงเวียนบางแสน', en: 'Bang Saen roundabout' }, at: [616, 1236], size: 220 },
  { id: 'road3137', icon: '🛣️', name: { th: 'ถนน 3137 ลงหาดบางแสน', en: 'Road 3137' }, at: [1450, 1030], size: 1300 },
  { id: 'laemThaen', icon: '🪨', name: { th: 'แหลมแท่น', en: 'Laem Thaen' }, at: [-1330, -760], size: 380 },
  { id: 'walking', icon: '🛍️', name: { th: 'ถนนคนเดิน', en: 'Walking street' }, at: [-1200, -940], size: 260 },
  { id: 'navyPier', icon: '⚓', name: { th: 'สะพานราชนาวี', en: 'Royal Navy pier' }, at: [-1100, -1010], size: 300 },
  { id: 'khaoSamMuk', icon: '🐒', name: { th: 'เขาสามมุข', en: 'Khao Sam Muk' }, at: [-560, -1760], size: 1100 },
  { id: 'viewpoint', icon: '🔭', name: { th: 'จุดชมวิวเขาสามมุข', en: 'Khao Sam Muk viewpoint' }, at: VIEWPOINT.at, size: 160 },
  { id: 'village', icon: '🛶', name: { th: 'หมู่บ้านชาวประมง', en: 'Fishing village' }, at: [-565, -2285], size: 420 },
];

export const DRONE = {
  fly: 1.6,                      // seconds for a flight
  top: 1.45, tilt: 0.8,          // pitch straight down / tilted
  dist: [25, 5000],              // closest / highest (m from the target); higher costs > 300 draw calls
  margin: 1.15,                  // frame an area a little wider than its size
  zoomStep: 1.15,                // per wheel step
  turn: 1.4,                     // Q/E rad/s
  doubleTap: 320, tapMove: 8,    // ms between taps, px a tap may move
  minBox: 24,                    // px: smaller boxes count as a tap
  tiltShift: 150,                // miniature blur when looking down from higher than this
  key: 'KeyV',
};

const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** ctx: { camera, input, map, root (#hud), canvas, player, tpc, audio } */
export function createDrone({ camera, input, map, root, canvas, player, tpc, audio }) {
  const D = DRONE, target = new THREE.Vector3(), s = { yaw: 0, pitch: D.top, dist: 300 };
  let active = false, flight = null, selecting = false, box = null, lastTap = null, skipDrag = false, label = null, angleTop = true;

  // ---------- UI: HUD button + the drone panel ----------
  const btn = document.createElement('button');
  btn.className = 'b-drone';
  btn.innerHTML = '🚁<span></span>';
  const btns = root.querySelector('#ui .btns');
  btns?.insertBefore(btn, btns.querySelector('.b-info'));
  const ui = document.createElement('div');
  ui.id = 'drone';
  ui.innerHTML = `
    <div class="d-top"><div class="d-title">🚁 <b></b></div><button class="d-exit"></button></div>
    <div class="d-hint"></div>
    <div class="d-bar">
      <div class="d-tools"><button class="d-select"></button><button class="d-angle"></button></div>
      <div class="d-areas">${DRONE_AREAS.map(a => `<button data-id="${a.id}">${a.icon} <span></span></button>`).join('')}</div>
    </div>
    <div class="d-box"></div>`;
  root.appendChild(ui);
  const $ = q => ui.querySelector(q), boxEl = $('.d-box');
  const stop = fn => e => { e.stopPropagation(); e.preventDefault(); fn(e); };
  btn.addEventListener('pointerdown', stop(() => toggle()));
  $('.d-exit').addEventListener('pointerdown', stop(() => exit()));
  $('.d-select').addEventListener('pointerdown', stop(() => { audio?.play('click'); setSelecting(!selecting); }));
  $('.d-angle').addEventListener('pointerdown', stop(() => { audio?.play('click'); angleTop = !angleTop; flyTo({ pitch: angleTop ? D.top : D.tilt }); refresh(); }));
  for (const b of ui.querySelectorAll('.d-areas button')) b.addEventListener('pointerdown', stop(() => { audio?.play('click'); goArea(b.dataset.id); }));

  function refresh() {
    btn.querySelector('span').textContent = t('drone');
    btn.setAttribute('aria-label', t('drone'));
    $('.d-title b').textContent = typeof label === 'string' ? t(label) : label ? tr(label) : t('drone');
    $('.d-exit').textContent = t('droneExit');
    $('.d-hint').textContent = selecting ? t('droneSelectHint') : t('droneHint');
    $('.d-select').textContent = `⬚ ${t('droneSelect')}`;
    $('.d-select').classList.toggle('on', selecting);
    $('.d-angle').textContent = angleTop ? `⤓ ${t('droneTop')}` : `◢ ${t('droneTilt')}`;
    for (const b of ui.querySelectorAll('.d-areas button')) {
      const a = DRONE_AREAS.find(x => x.id === b.dataset.id);
      b.querySelector('span').textContent = tr(a.name);
      b.classList.toggle('on', label === a.name);
    }
  }
  onLang(refresh);
  refresh();

  // ---------- flights ----------
  /** Distance that fits `size` metres on screen (both ways) when looking down. */
  const fit = size => THREE.MathUtils.clamp(size * D.margin / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.min(1, camera.aspect)), ...D.dist);
  const groundY = (x, z) => Math.max(map.heightAt(x, z), map.sea);
  function flyTo({ x = target.x, z = target.z, dist = s.dist, pitch = s.pitch, yaw = s.yaw }) {
    flight = { t: 0, from: { x: target.x, z: target.z, dist: s.dist, pitch: s.pitch, yaw: s.yaw }, to: { x, z, dist, pitch, yaw: s.yaw + wrap(yaw - s.yaw) } };
  }
  function goArea(id) {
    const a = DRONE_AREAS.find(x => x.id === id);
    const [x, z] = a.at === 'player' ? [player.state.x, player.state.z] : a.at;
    label = a.name;
    flyTo({ x, z, dist: fit(a.size) });
    refresh();
  }

  // ---------- screen → ground ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(px, py) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -groundY(target.x, target.z);
    for (let i = 0; i < 2; i++) {                                // settle onto the terrain height there
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      plane.constant = -groundY(hit.x, hit.z);
    }
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }

  // ---------- select a box / double-tap a spot ----------
  function setSelecting(on) { selecting = on; ui.classList.toggle('selecting', on); refresh(); }
  canvas.addEventListener('pointerdown', e => {
    if (!active) return;
    flight = null;
    if (selecting) box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, id: e.pointerId };
    else lastTap = { ...(lastTap || {}), down: [e.clientX, e.clientY] };
  });
  addEventListener('pointermove', e => {
    if (!active || !box || e.pointerId !== box.id) return;
    box.x1 = e.clientX; box.y1 = e.clientY;
    Object.assign(boxEl.style, { display: 'block', left: `${Math.min(box.x0, box.x1)}px`, top: `${Math.min(box.y0, box.y1)}px`, width: `${Math.abs(box.x1 - box.x0)}px`, height: `${Math.abs(box.y1 - box.y0)}px` });
  });
  addEventListener('pointerup', e => {
    if (!active) return;
    if (box && e.pointerId === box.id) {
      const b = box; box = null; boxEl.style.display = 'none'; skipDrag = true;
      if (Math.abs(b.x1 - b.x0) < D.minBox || Math.abs(b.y1 - b.y0) < D.minBox) return;
      const a = groundAt(b.x0, b.y0), c = groundAt(b.x1, b.y1);
      if (!a || !c) return;
      // the box's size on the ground, measured along the screen axes of the current view
      const d = c.clone().sub(a), w = Math.abs(d.x * Math.cos(s.yaw) - d.z * Math.sin(s.yaw)), h = Math.abs(d.x * Math.sin(s.yaw) + d.z * Math.cos(s.yaw));
      label = 'droneSelected';
      flyTo({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, dist: fit(Math.max(w / Math.max(1, camera.aspect), h, 20)), pitch: angleTop ? D.top : s.pitch });
      audio?.play('click');
      setSelecting(false);
      return;
    }
    if (selecting || e.target !== canvas || !lastTap?.down) return;
    if (Math.hypot(e.clientX - lastTap.down[0], e.clientY - lastTap.down[1]) > D.tapMove) { lastTap = null; return; }
    const now = performance.now();
    if (lastTap.at && now - lastTap.at < D.doubleTap && Math.hypot(e.clientX - lastTap.pos[0], e.clientY - lastTap.pos[1]) < 30) {
      const p = groundAt(e.clientX, e.clientY);
      if (p) { label = null; flyTo({ x: p.x, z: p.z, dist: Math.max(D.dist[0], s.dist * 0.45) }); refresh(); }
      lastTap = null;
    } else lastTap = { at: now, pos: [e.clientX, e.clientY] };
  });

  // ---------- enter / leave ----------
  function enter() {
    if (active) return;
    active = true;
    audio?.play('click');
    const c = tpc.state;
    target.set(player.state.x, groundY(player.state.x, player.state.z), player.state.z);
    Object.assign(s, { yaw: c.yaw, pitch: c.pitch ?? 0.3, dist: c.cur || c.dist || 8 });
    angleTop = true;
    label = DRONE_AREAS[1].name;
    flyTo({ dist: fit(260), pitch: D.top });                     // lift off straight up over the kid
    document.body.classList.add('drone');
    refresh();
  }
  function exit() {
    if (!active) return;
    active = false; flight = null; box = null; boxEl.style.display = 'none';
    setSelecting(false);
    audio?.play('click');
    document.body.classList.remove('drone');
    tpc.snap?.();
  }
  function toggle() { if (active) exit(); else if (!document.body.classList.contains('in-game') && !document.body.classList.contains('talking')) enter(); }
  addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT') return;
    if (e.code === D.key) toggle();
    else if (active && e.code === 'Escape') { if (selecting) setSelecting(false); else exit(); }
  });

  // ---------- per frame ----------
  const right = new THREE.Vector3(), fwd = new THREE.Vector3();
  function update(dt) {
    const userMoved = input.drag.x || input.drag.y || input.pan.x || input.pan.y || input.wheel
      || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(k => input.down(k));
    if (flight && userMoved && !selecting && !skipDrag) flight = null;
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / D.fly);
      const k = ease(flight.t), f = flight.from, to = flight.to;
      // climb while travelling far: the midpoint of a long flight rises above both ends
      const hop = Math.hypot(to.x - f.x, to.z - f.z) * 0.35 * Math.sin(Math.PI * k);
      target.x = THREE.MathUtils.lerp(f.x, to.x, k); target.z = THREE.MathUtils.lerp(f.z, to.z, k);
      s.dist = Math.min(D.dist[1], Math.exp(THREE.MathUtils.lerp(Math.log(f.dist), Math.log(to.dist), k)) + hop);
      s.pitch = THREE.MathUtils.lerp(f.pitch, to.pitch, k);
      s.yaw = THREE.MathUtils.lerp(f.yaw, to.yaw, k);
      if (flight.t >= 1) flight = null;
    } else {
      // metres per screen pixel at the target: drag moves the ground with the finger
      const mpp = (2 * s.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, innerHeight);
      right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
      fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
      if (!selecting && !box && !skipDrag) {
        const dx = input.drag.x + input.pan.x, dy = input.drag.y + input.pan.y, pitchK = 1 / Math.max(0.35, Math.sin(s.pitch));
        target.addScaledVector(right, -dx * mpp).addScaledVector(fwd, dy * mpp * pitchK);
      }
      const kx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      const kz = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      const speed = s.dist * 0.8 * (input.down('ShiftLeft') ? 2.5 : 1);
      target.addScaledVector(right, kx * speed * dt).addScaledVector(fwd, kz * speed * dt);
      if (input.down('KeyQ')) s.yaw += dt * D.turn;
      if (input.down('KeyE')) s.yaw -= dt * D.turn;
      if (input.wheel) { s.dist = THREE.MathUtils.clamp(s.dist * D.zoomStep ** input.wheel, ...D.dist); label = null; refresh(); }
      if ((kx || kz) && label) { label = null; refresh(); }
    }
    skipDrag = false;
    // stay over the map
    const half = (map.core.nx - 1) * map.core.step / 2;
    target.x = THREE.MathUtils.clamp(target.x, -half, half); target.z = THREE.MathUtils.clamp(target.z, -half, half);
    target.y = groundY(target.x, target.z);
    const cp = Math.cos(s.pitch);
    camera.position.set(target.x + Math.sin(s.yaw) * cp * s.dist, target.y + Math.sin(s.pitch) * s.dist, target.z + Math.cos(s.yaw) * cp * s.dist);
    const floor = groundY(camera.position.x, camera.position.z) + 3;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(target);
  }

  return {
    get active() { return active; },
    /** Miniature (tilt-shift) look when high up and looking down. */
    get tiltShift() { return active && s.pitch > 1.0 && s.dist > D.tiltShift; },
    target, state: s, update, enter, exit, goArea, flyTo,
  };
}
