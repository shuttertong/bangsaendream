// Where the active goal is. A bobbing arrow floats over the person the goal sends you to (it
// grows with distance, so it shows from far along the beach), a HUD chip gives the name and the
// metres — pinned to the screen edge with a pointer while the goal is out of view — and tapping
// the goal chip in the top bar turns the camera that way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { t, tr } from '../shared/i18n.js';
import { questPeople } from './quests.js';

export const GUIDE = {
  color: '#f08a2a',
  head: 1.3, above: 0.5,                        // a person's height (× look.scale) and the gap above the head, metres
  grow: [26, 9],                                // the arrow grows by distance / grow[0], up to × grow[1]
  bob: [0.16, 2.6], spin: 1.3,                  // bob height (m) and rate, spin rate
  near: 7,                                      // metres: this close the floating arrow is enough, the chip hides
  edge: { side: 64, top: 26, bottom: 108, corner: 190 },   // px kept clear at the screen edges (top: below the top bar and its toasts; corner: the joystick and jump button, along the bottom)
  turn: 4,                                      // how fast the camera turns to the goal when asked (1/s)
};

export function createGuide({ scene, root, tpc, player, people, input, quest, toast }) {
  const G = GUIDE;
  const geo = mergeGeometries([
    new THREE.ConeGeometry(0.27, 0.44, 4).rotateX(Math.PI).translate(0, 0.22, 0),      // tip down, at the origin
    new THREE.CylinderGeometry(0.1, 0.1, 0.34, 4).translate(0, 0.6, 0),
  ]);
  // drawn over everything (no depth test): a waypoint has to show through palms, umbrellas and houses
  const arrow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: G.color, fog: false, transparent: true, opacity: 0.94, depthTest: false, depthWrite: false }));
  arrow.visible = false;
  arrow.frustumCulled = false;
  arrow.renderOrder = 10;
  scene.add(arrow);

  const chip = document.createElement('div');
  chip.className = 'guide';
  chip.innerHTML = '<i>➤</i><b></b><span></span>';
  chip.hidden = true;
  root.appendChild(chip);
  const [tip, name, away] = chip.children;
  const far = d => (d < 1000 ? t('metres', { n: Math.round(d) }) : t('km', { n: (d / 1000).toFixed(1) }));

  const v = new THREE.Vector3(), toasts = root.querySelector('#ui .toasts');
  let time = 0, target = null, dist = 0, turnTo = null, shown = '', barBottom = 110, barIn = 0;

  /** The nearest person the active goal sends us to (or null). */
  function find() {
    const ids = questPeople(quest()), p = player.state;
    let best = null, bd = Infinity;
    for (const n of people.npcs) {
      if (!ids.includes(n.id)) continue;
      const d = Math.hypot(n.state.x - p.x, n.state.z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    dist = bd;
    return best;
  }

  function update(dt) {
    time += dt;
    target = find();
    arrow.visible = !!target;
    if (!target) { chip.hidden = true; turnTo = null; return; }
    const k = THREE.MathUtils.clamp(dist / G.grow[0], 1, G.grow[1]);
    const top = target.mesh.position.y + G.head * (target.def.look.scale || 1) + G.above;
    arrow.position.set(target.state.x, top + (k - 1) * 0.5 + Math.sin(time * G.bob[1]) * G.bob[0] * k, target.state.z);
    arrow.scale.setScalar(k);
    arrow.rotation.y = time * G.spin;

    // the camera turn asked for by point(); steering by hand cancels it
    if (turnTo !== null) {
      const s = tpc.state, d = Math.atan2(Math.sin(turnTo - s.yaw), Math.cos(turnTo - s.yaw));
      if (input?.drag.x || input?.drag.y || Math.abs(d) < 0.01) turnTo = null;
      else s.yaw += d * Math.min(1, dt * G.turn);
    }

    // HUD chip: over the goal while it is in view, else pinned to the screen edge, pointing the way
    chip.hidden = dist < G.near;
    if (chip.hidden) return;
    barIn -= dt;
    if (barIn <= 0) { barIn = 0.4; barBottom = toasts?.getBoundingClientRect().bottom || barBottom; }   // the top bar wraps on narrow screens
    const cam = tpc.cam, w = innerWidth, h = innerHeight, E = { ...G.edge, top: barBottom + G.edge.top };
    v.set(target.state.x, top + 1.1 * k, target.state.z).project(cam);
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    if (behind) { x = w - x; y = h * 2; }                              // behind the camera: push it off the bottom, mirrored
    const inView = !behind && x > E.side && x < w - E.side && y > E.top && y < h - E.bottom;
    if (!inView) {
      const cx = w / 2, cy = (E.top + h - E.bottom) / 2, dx = x - cx, dy = y - cy;
      const s = Math.min((w / 2 - E.side) / Math.abs(dx || 1e-6), ((dy < 0 ? cy - E.top : h - E.bottom - cy)) / Math.abs(dy || 1e-6));
      x = cx + dx * s; y = cy + dy * s;
      if (y > h - E.bottom - 1) x = THREE.MathUtils.clamp(x, Math.min(E.corner, w / 2), Math.max(w - E.corner, w / 2));
      tip.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    chip.classList.toggle('edge', !inView);
    chip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    const label = `${tr(target.def.name)}|${far(dist)}`;
    if (label !== shown) { shown = label; [name.textContent, away.textContent] = label.split('|'); }
  }

  return {
    update,
    get target() { return target; },
    get dist() { return dist; },
    /** Turn the camera to the goal and say how far it is. False when the goal has no particular place. */
    point() {
      target = find();
      if (!target) return false;
      const p = player.state;
      turnTo = Math.atan2(target.state.x - p.x, target.state.z - p.z) + Math.PI;
      toast?.(t(dist < G.near ? 'goalHere' : 'goalWay', { name: tr(target.def.name), far: far(dist) }), 'click');
      return true;
    },
  };
}
