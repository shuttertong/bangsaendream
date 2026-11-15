// โรงเรียนสอนสเก็ต — a skating lesson on the town's own rink (ctx.town.skate, see town/skatepark.js;
// played in the hub's scene like the kart race). The kid rolls round the oval by themselves: steer
// across the lane to skate over the green pads — between two cones, round a cone, or up and over a
// low bar (jump) — and pick up stars. Three lessons, one after the other: balance, slalom, jumps;
// passing one (60 % of its pads) opens the next. start(ctx) → { update, render, town, focus }.
import * as THREE from 'three';
import { buildTrack } from '../gp/track.js';
import { createLesson } from './sim.js';
import { SK } from './rules.js';
import { SKATE, ovalPoints, skatePose, strideStep } from '../town/skatepark.js';
import { createKid } from '../town/kid/index.js';
import { KID_LOOK } from '../town/kid/model.js';
import { createGameUI } from '../shared/gameUI.js';
import { t } from '../shared/i18n.js';

let current = null;

export function start(ctx) {
  const T = ctx.town, rink = T.skate, { input } = ctx, { scene, camera } = T;
  const best = ctx.progress.get().best.skate, learnt = Math.min(3, best?.biggest || 0), li = learnt < 3 ? learnt : (best?.plays || 0) % 3;   // the next lesson; after graduating, they come round in turn
  const track = buildTrack(ovalPoints(SKATE.oval, 1).map(([u, w]) => { const p = rink.world(u, w); return [p.x, p.z]; }), { step: 0.5, smooth: 1 });
  const lesson = createLesson(li, track.length), st = lesson.state, top = rink.top;
  /** World place of (s along the oval, d to the right of travel). */
  const at = (s, d, out = new THREE.Vector3()) => { const c = track.at(s); return out.set(c.x - c.tz * d, top, c.z + c.tx * d); };

  const root = new THREE.Group();
  scene.add(root);
  const kid = createKid(root, { ...KID_LOOK, skates: SKATE.colors.boot, bag: null });
  // the lesson laid out on the rink: cones, green pads, bars, stars (one instanced mesh each)
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.castShadow = true; root.add(m); return m; };
  const tasks = lesson.items.filter(i => i.kind !== 'star'), stars = lesson.items.filter(i => i.kind === 'star');
  const cones = inst(new THREE.ConeGeometry(0.13, 0.36, 10).translate(0, 0.18, 0), new THREE.MeshLambertMaterial({ color: SKATE.colors.cone }), tasks.reduce((a, i) => a + i.cones.length, 0));
  const pads = inst(new THREE.CircleGeometry(SK.pad * 0.8, 20).rotateX(-Math.PI / 2).translate(0, 0.02, 0), new THREE.MeshBasicMaterial({ color: '#62d86a', transparent: true, opacity: 0.55, depthWrite: false }), tasks.filter(i => i.kind !== 'bar').length);
  const bars = inst(new THREE.BoxGeometry(SK.lane * 2, 0.07, 0.07).translate(0, SK.clear - 0.04, 0), new THREE.MeshLambertMaterial({ color: '#d8443a' }), tasks.filter(i => i.kind === 'bar').length);
  const starM = inst(new THREE.OctahedronGeometry(0.16), new THREE.MeshLambertMaterial({ color: '#f6d13a', emissive: '#7a5a00' }), stars.length);
  pads.castShadow = false;
  let ci = 0, pi = 0, bi = 0;
  for (const it of tasks) {
    const c = track.at(it.s), yaw = Math.atan2(c.tx, c.tz);
    for (const d of it.cones) { cones.setMatrixAt(ci++, M.compose(at(it.s, d, V), Q.identity(), S1)); }
    if (it.kind === 'bar') bars.setMatrixAt(bi++, M.compose(at(it.s, 0, V), Q.setFromAxisAngle(up, yaw), S1));
    else { it.pad = pi; pads.setMatrixAt(pi++, M.compose(at(it.s, it.c, V), Q.identity(), S1)); }
  }
  stars.forEach((it, i) => { it.idx = i; });
  T.setRace(true);                                                       // (hides the kid on foot and the trucks)

  const name = t(`skateL${li + 1}`);
  const ui = createGameUI(ctx.root, { game: 'skate', title: `${t('skateTitle')} · ${name}`, how: t(`skateHow${li + 1}`), keys: t('skateKeys'), audio: ctx.audio });
  ctx.audio?.ambience({ surf: 0.3, breeze: 0.6 });
  const s = { phase: 'intro', t: 0, camYaw: 0, stride: 0, wob: 0 };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end(false);
  ui.onBack = () => ctx.onExit(result());
  let final = null;
  const result = () => ({ game: 'skate', baht: final?.baht || 0, catches: [], biggest: final?.ok ? { size: Math.max(learnt, li + 1) } : null });
  function end(finished) {
    if (s.phase === 'end') return;
    s.phase = 'end';
    final = finished ? lesson.result(true) : { ok: false, baht: 0 };
    const prev = ctx.progress.get().best.skate, n = v => ({ th: v, en: v });
    if (finished) ui.pop(final.ok ? (li === 2 && learnt < 3 ? t('skateGrad') : t('skatePass')) : t('skateFail'), final.ok ? 'wow' : 'bad');
    ui.results(finished ? [
      { icon: '🟢', name: n(t('skatePads')), count: st.passed, detail: `${st.passed}/${st.tasks} · ×${st.best}`, baht: final.baht - (final.ok ? SK.pay.passed : 0) },
      { icon: final.ok ? '🎓' : '📘', name: n(final.ok ? t('skatePass') : t('skateFail')), count: final.ok ? 1 : 0, detail: `⭐ ${st.stars} · ${t('skateFalls', { n: st.falls })}`, baht: final.ok ? SK.pay.passed : 0 },
    ] : [], final.baht, !prev || final.baht > prev.baht);
  }

  const focus = new THREE.Vector3(), pos = new THREE.Vector3(), cam = new THREE.Vector3();
  function update(dt) {
    s.t += dt;
    if (s.phase === 'play') {
      const a = input.axis();
      lesson.step(dt, { steer: a.r, jump: input.down('Space') || input.jump, brake: a.f < -0.4 });
      for (const e of st.events) {
        if (e === 'pass') ui.pop(st.combo > 1 ? `${t('skateGood')} ×${st.combo}` : t('skateGood'), 'good');
        else if (e === 'hit') { ui.pop(t('skateHit'), 'bad'); s.wob = SK.stumble.time; }
        else if (e === 'star') ctx.audio?.play('catch');
        else if (e === 'jump') ctx.audio?.play('whoosh');
        else if (e === 'end') end(true);
      }
      for (const it of tasks) if (it.done && it.pad != null && !it.hid) { it.hid = true; pads.setMatrixAt(it.pad, M.makeScale(0, 0, 0)); pads.instanceMatrix.needsUpdate = true; }
    }
    // stars turn and bob; a collected one is gone
    for (const it of stars) starM.setMatrixAt(it.idx, M.compose(at(it.s, it.c, V).setY(top + 0.75 + it.high + Math.sin(s.t * 3 + it.idx) * 0.06), Q.setFromAxisAngle(up, s.t * 2 + it.idx), it.done ? V.set(0, 0, 0) : S1));
    starM.instanceMatrix.needsUpdate = true;
    // the kid: where the lesson says, skating
    const c = track.at(st.s), yaw = Math.atan2(c.tx, c.tz) - st.vd * 0.08;
    at(st.s, st.d, pos);
    const moved = st.v * dt;
    kid.update(dt, { x: pos.x, y: top + st.y, z: pos.z, yaw, speed: st.v, dist: moved, accel: 0, turn: 0, grounded: st.y <= 0, vy: st.vy, groundAt: () => top });
    s.stride += strideStep(moved, st.v); s.wob = Math.max(0, s.wob - dt);
    if (st.y <= 0) {
      // a steady stride round the oval; rolling into each change of line, coasting while braking
      skatePose(kid.bones, s.stride, s.phase === 'play' ? (input.axis().f < -0.4 ? 0.1 : 0.75) : 0, -st.vd * 0.07);
      kid.bones.spine.rotation.z += Math.sin(s.t * 22) * 0.25 * (s.wob / SK.stumble.time);
      if (s.wob > 0) { kid.bones.armL.rotation.set(-0.4, 0, 1.3); kid.bones.armR.rotation.set(-0.4, 0, -1.3); }
    }
    kid.mesh.position.y += SKATE.lift;
    // chase camera
    const yawTo = s.phase === 'intro' ? yaw + 2.6 + Math.sin(s.t * 0.4) * 0.5 : yaw, portrait = camera.aspect < 1;
    s.camYaw += Math.atan2(Math.sin(yawTo - s.camYaw), Math.cos(yawTo - s.camYaw)) * Math.min(1, dt * 4);
    cam.set(pos.x - Math.sin(s.camYaw) * 5.2, top + (portrait ? 3.6 : 2.7), pos.z - Math.cos(s.camYaw) * 5.2);
    camera.position.lerp(cam, s.t < 0.1 ? 1 : Math.min(1, dt * 8));
    camera.lookAt(pos.x + Math.sin(yaw) * 3, top + 0.8, pos.z + Math.cos(yaw) * 3);
    if (Math.abs(camera.fov - (portrait ? 70 : 58)) > 0.2) { camera.fov = portrait ? 70 : 58; camera.updateProjectionMatrix(); }
    focus.set(pos.x, top, pos.z);
    if (s.phase === 'play') ui.bar(`🛼 ${name}`, `${st.passed}/${st.tasks}`, lesson.result(false).baht, '🟢');
  }
  cones.instanceMatrix.needsUpdate = pads.instanceMatrix.needsUpdate = bars.instanceMatrix.needsUpdate = true;
  s.camYaw = Math.atan2(track.tx[0], track.tz[0]) + 2.6;
  update(0);

  current = {
    dispose() {
      ui.dispose();
      scene.remove(root);
      root.traverse(o => { o.geometry?.dispose?.(); });
      T.setRace(false);
    },
  };
  return { update, render: () => {}, town: true, focus, debug: { lesson, state: st, track, li } };
}

export function stop() { current?.dispose(); current = null; }
