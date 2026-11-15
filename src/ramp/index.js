// แรมป์สเก็ต — tricks on a half-pipe set up on the town's skating rink (ctx.town.skate; played in
// the hub's scene). The kid swings from lip to lip by themselves: press jump on the green band of
// the flat to pump for height; in the air hold the stick sideways to spin, up to flip, down to
// grab — and let go in time to land on the skates. 60 seconds. start(ctx) → { update, town, focus }.
import * as THREE from 'three';
import { createRun } from './sim.js';
import { buildPipe, surfaceAt } from './pipe.js';
import { RAMP } from './rules.js';
import { SKATE, skatePose } from '../town/skatepark.js';
import { createKid } from '../town/kid/index.js';
import { KID_LOOK } from '../town/kid/model.js';
import { createGameUI } from '../shared/gameUI.js';
import { t } from '../shared/i18n.js';

let current = null;

export function start(ctx) {
  const T = ctx.town, rink = T.skate, { input } = ctx, { scene, camera } = T, P = RAMP.pipe;
  const run = createRun(), st = run.state;
  // the pipe stands across the middle of the rink: its own x runs along the rink, z toward the sea
  const root = new THREE.Group();
  root.position.set(rink.x, rink.top + P.base, rink.z); root.rotation.y = rink.ry;   // (on a low base, over the rink's cones and fun box)
  scene.add(root);
  root.add(buildPipe());
  const kid = createKid(root, { ...KID_LOOK, skates: SKATE.colors.boot, bag: null });
  T.setRace(true);

  const ui = createGameUI(ctx.root, { game: 'ramp', title: t('rampTitle'), how: t('rampHow'), keys: t('rampKeys'), audio: ctx.audio });
  ctx.touch?.setAction('jump');
  ctx.audio?.ambience({ surf: 0.3, breeze: 0.6 });
  const s = { phase: 'intro', t: 0, crouch: 0, stride: 0, shake: 0, camY: 0 };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());
  const result = () => ({ game: 'ramp', baht: s.phase === 'end' ? run.baht() : 0, catches: [], score: st.score });
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    const prev = ctx.progress.get().best.ramp, n = v => ({ th: v, en: v });
    ui.results([
      { icon: '🛼', name: n(t('rampTricks')), count: st.tricks, detail: t('rampBest', { n: st.best }), baht: run.baht() },
      { icon: '⬆️', name: n(t('rampAir')), count: 1, detail: `${st.top.toFixed(1)} m · ${t('skateFalls', { n: st.falls })}`, baht: 0 },
    ], run.baht(), !prev || run.baht() > prev.baht);
  }
  const trickName = e => [e.flips ? t('rampFlip') + (e.flips > 1 ? ` ×${e.flips}` : '') : '', e.halves ? `${e.halves * 180}°` : '', e.grab ? t('rampGrab') : ''].filter(Boolean).join(' + ');

  const Qt = new THREE.Quaternion(), Qy = new THREE.Quaternion(), Qf = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const focus = new THREE.Vector3(), look = new THREE.Vector3(), cam = new THREE.Vector3(), w = new THREE.Vector3();
  let wasJump = false;
  function update(dt) {
    s.t += dt;
    if (s.phase === 'play') {
      const a = input.axis(), jump = input.down('Space') || input.jump;
      run.step(dt, { steer: a.r, up: Math.max(0, a.f), down: a.f < -0.5, jump: jump && !wasJump });
      wasJump = jump;
      for (const e of st.events) {
        if (e === 'pumpPerfect') { ui.pop(t('rampPumpPerfect'), 'wow'); s.crouch = 0.3; }
        else if (e === 'pump') { ui.pop(t('rampPump'), 'good'); s.crouch = 0.3; }
        else if (e === 'launch') ctx.audio?.play('whoosh');
        else if (e === 'fall') { ui.pop(t('rampFall'), 'bad'); s.shake = 0.5; ctx.audio?.play('thud'); }
        else if (e === 'land') ctx.audio?.play('thud');
        else if (e === 'end') end();
        else if (e.e === 'trick') ui.pop(`${trickName(e)}  +${e.pts}${st.streak > 1 ? `  ×${st.streak}` : ''}`, e.pts > 250 ? 'wow' : 'good');
      }
    }
    // where the skater is: on the pipe's surface, or over the lip
    const riding = st.phase === 'ride', lipX = P.flat / 2 + P.r;
    let x, y, tilt, dir;
    if (riding) { const c = surfaceAt(run.across()); x = c.x; y = c.y; tilt = c.a; dir = -st.from; }
    else {
      const h = run.height(), T2 = run.airTime(st.air), k = Math.sin(Math.PI * Math.min(1, st.t / T2));
      x = st.from * (lipX - 0.12 - 0.25 * k); y = P.r + h; dir = st.from;
      tilt = st.from * (Math.PI / 2) * (1 - 0.55 * k);             // from flat against the wall toward upright at the top of the jump
    }
    const moved = riding ? Math.abs(Math.PI / RAMP.ride * Math.sin(Math.PI * st.t / RAMP.ride)) * (P.flat / 2 + P.r * Math.PI / 2) * dt : 0;
    kid.update(dt, { x, y, z: 0, yaw: 0, speed: riding ? 4 : 0, dist: moved, accel: 0, turn: 0, grounded: true, vy: 0, groundAt: () => y });
    s.crouch = Math.max(0, s.crouch - dt); s.shake = Math.max(0, s.shake - dt); s.stride += moved * 0.6;
    const B = kid.bones;
    skatePose(B, s.stride, 0, 0);
    B.hips.position.y -= 0.12 * (s.crouch / 0.3);                     // the pump: a quick dip
    if (!riding) {                                                    // in the air: knees up, arms wide; a hand to the skate for a grab
      const grab = input.axis().f < -0.5 && st.stun <= 0;
      for (const sd of ['L', 'R']) { B[`leg${sd}`].rotation.x = -1.25; B[`shin${sd}`].rotation.x = 1.5; B[`foot${sd}`].rotation.set(-0.25, 0, 0); B[`arm${sd}`].rotation.set(-0.4, 0, (sd === 'L' ? 1 : -1) * 1.35); B[`fore${sd}`].rotation.x = -0.3; }
      if (grab) { B.armR.rotation.set(-1.0, 0, 0.35); B.foreR.rotation.x = -0.2; B.spine.rotation.x = 0.55; }
    }
    if (st.stun > 0 && riding) { B.armL.rotation.set(-0.4, 0, 1.4); B.armR.rotation.set(-0.4, 0, -1.4); B.spine.rotation.z += Math.sin(s.t * 24) * 0.3; }
    // facing along the pipe, tipped to the wall, spun and flipped by the tricks
    Qt.setFromAxisAngle(Z, tilt); Qy.setFromAxisAngle(Y, (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + THREE.MathUtils.degToRad(riding ? 0 : st.spin)); Qf.setFromAxisAngle(X, -THREE.MathUtils.degToRad(riding ? 0 : st.flip));
    kid.mesh.quaternion.copy(Qt).multiply(Qy).multiply(Qf);
    kid.mesh.position.set(x, y + SKATE.lift * Math.cos(tilt), 0).add(w.set(-Math.sin(tilt), 0, 0).multiplyScalar(SKATE.lift));
    // camera: side-on from the sea side, rising a little with the big jumps
    const portrait = camera.aspect < 1, dist = portrait ? 15 : 9.6;
    s.camY += ((riding ? 0 : Math.max(0, run.height() - 1) * 0.5) - s.camY) * Math.min(1, dt * 3);
    root.updateMatrixWorld();
    cam.set(s.phase === 'intro' ? Math.sin(s.t * 0.4) * 3 : 0, 2.6 + s.camY, dist).applyMatrix4(root.matrixWorld);
    camera.position.lerp(cam, s.t < 0.1 ? 1 : Math.min(1, dt * 6));
    look.set(x * 0.25, 2.2 + s.camY * 1.4, 0).applyMatrix4(root.matrixWorld);
    camera.lookAt(look);
    const fov = portrait ? 64 : 50;
    if (Math.abs(camera.fov - fov) > 0.2) { camera.fov = fov; camera.updateProjectionMatrix(); }
    focus.set(rink.x, rink.top, rink.z);
    if (s.phase === 'play') ui.bar(Math.max(0, st.time), st.tricks, run.baht(), '🛼');
  }
  update(0);

  current = {
    dispose() {
      ui.dispose();
      scene.remove(root);
      root.traverse(o => { o.geometry?.dispose?.(); });
      T.setRace(false);
    },
  };
  return { update, render: () => {}, town: true, focus, debug: { run, state: st } };
}

export function stop() { current?.dispose(); current = null; }
