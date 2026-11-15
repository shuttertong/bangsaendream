// Kid animation: gait phase driven by distance actually travelled (no running in place),
// 2-joint IK legs that plant the feet on the terrain, hip sway and a toe-off in the step, arm
// swing, lean into acceleration and turns, a spring on the hat; a jump that stretches on the way
// up, spreads the arms on the way down and squashes on landing; idle breathing, a weight shift
// and a look around now and then; blinking, and a joy face (express()) when something good happens.
import * as THREE from 'three';
import { buildKid } from './model.js';

const TUNE = {
  stepWalk: 0.32, stepRun: 0.62,        // step length (m); a full cycle is two steps
  liftWalk: 0.07, liftRun: 0.16,
  runFrom: 2.0, runTo: 3.6,             // speed band blending walk → run (m/s)
  armWalk: 0.35, armRun: 0.95,
  leanRun: 0.2, leanAccel: 0.035, leanTurn: 0.05,
  hatK: 90, hatDamp: 9, hatPush: 0.012,
  sway: 0.07, pelvis: 0.07, toe: 0.5,            // hip roll per step (rad), pelvis yaw, toe-down of the swinging foot
  bobWalk: 0.02, bobRun: 0.05,                   // hip bob per step (m)
  stretch: 0.07, squash: 0.09, landTime: 0.24, landDip: 0.1,   // squash & stretch of the whole body (jump up / land), landing crouch (s, m)
  look: { every: [3, 7], hold: [1.2, 2.2], yaw: 0.5 },       // idle: a glance to one side every few seconds
  joy: { secs: 1.6, mouth: [1.35, 1.9] },                    // the joy face: how long, and the mouth's stretch
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createKid(scene, look) {
  const { mesh, bones: B, body: KID } = buildKid(look);            // KID: this kid's proportions (chibi legs)
  scene.add(mesh);
  const s = {
    phase: 0, speed: 0, lean: 0, side: 0, t: 0,
    hatOff: new THREE.Vector3(), hatVel: new THREE.Vector3(),
    headPrev: new THREE.Vector3(), headPrev2: new THREE.Vector3(), first: true, blinkIn: 2, blink: 0,
    wasGrounded: true, airT: 0, land: 0, stretch: 1, joy: 0, joyOn: false, look: { yaw: 0, want: 0, hold: 0, next: 4 },
  };
  const baseScale = mesh.scale.x;
  const tmp = new THREE.Vector3(), acc = new THREE.Vector3();

  /** Two-bone IK in the leg's sagittal plane: foot target (y down, z forward) in hip space. */
  function legIK(leg, shin, foot, ty, tz, hipPitch) {
    const a = KID.thigh, b = KID.shin;
    const d = Math.min(a + b - 0.002, Math.max(0.05, Math.hypot(ty, tz)));
    const phi = Math.atan2(tz, -ty);                                    // + = foot ahead
    const alpha = Math.acos(Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const beta = Math.acos(Math.min(1, (a * a + b * b - d * d) / (2 * a * b)));
    leg.rotation.x = -(phi + alpha) - hipPitch;                         // knee forward; cancel hip lean
    shin.rotation.x = Math.PI - beta;
    foot.rotation.x = -(leg.rotation.x + shin.rotation.x + hipPitch);  // keep the sole flat
  }

  /**
   * m: { x, y, z, yaw, speed (actual m/s), dist (m moved this frame), accel, turn (rad/s),
   *      grounded, vy, groundAt(x, z) }
   */
  function update(dt, m) {
    s.t += dt;
    mesh.position.set(m.x, m.y, m.z);
    mesh.rotation.y = m.yaw;
    s.speed = lerp(s.speed, m.speed, 1 - Math.exp(-dt * 10));
    const run = smooth(TUNE.runFrom, TUNE.runTo, s.speed);
    const move = smooth(0.05, 0.5, s.speed), idle = 1 - move;
    // touching down after a jump: a short crouch; in the air: how long, and rising or falling
    if (m.grounded && !s.wasGrounded) s.land = TUNE.landTime;
    s.wasGrounded = m.grounded;
    s.airT = m.grounded ? 0 : s.airT + dt;
    s.land = Math.max(0, s.land - dt);
    const landK = s.land > 0 ? (s.land / TUNE.landTime) ** 2 : 0, air = m.grounded ? 0 : 1, rise = air * smooth(-1, 1, (m.vy || 0) / 2);
    // squash & stretch of the whole body: taller as it leaves the ground, flatter as it lands
    const want = air ? 1 + TUNE.stretch * smooth(0, 0.12, s.airT) * rise : 1 - TUNE.squash * landK;
    s.stretch = lerp(s.stretch, want, 1 - Math.exp(-dt * 25));
    mesh.scale.set(baseScale / Math.sqrt(s.stretch), baseScale * s.stretch, baseScale / Math.sqrt(s.stretch));
    // idle: a glance to one side now and then
    const L = s.look, LK = TUNE.look;
    L.next -= dt;
    if (L.next <= 0) { L.want = (Math.random() < 0.5 ? -1 : 1) * LK.yaw * (0.6 + Math.random() * 0.4); L.hold = lerp(...LK.hold, Math.random()); L.next = L.hold + lerp(...LK.every, Math.random()); }
    if (L.hold > 0) L.hold -= dt; else L.want = 0;
    L.yaw = lerp(L.yaw, L.want * idle, 1 - Math.exp(-dt * 4));
    const step = lerp(TUNE.stepWalk, TUNE.stepRun, run);
    s.phase = (s.phase + m.dist / (2 * step)) % 1;

    // lean: forward with speed + acceleration, sideways into turns
    s.lean = lerp(s.lean, run * TUNE.leanRun + move * 0.05 + THREE.MathUtils.clamp(m.accel, -3, 3) * TUNE.leanAccel, 1 - Math.exp(-dt * 6));
    s.side = lerp(s.side, THREE.MathUtils.clamp(-m.turn * s.speed * TUNE.leanTurn, -0.3, 0.3), 1 - Math.exp(-dt * 6));

    const cy = Math.cos(m.yaw), sy = Math.sin(m.yaw);
    const legLen = KID.thigh + KID.shin + KID.ankle;
    const lift = lerp(TUNE.liftWalk, TUNE.liftRun, run);
    const targets = [];
    for (const [sgn, off] of [[1, 0], [-1, 0.5]]) {                    // L, R
      const c = (s.phase + off) % 1;
      let z, up, swing = 0;
      if (c < 0.5) { z = lerp(step / 2, -step / 2, c * 2); up = 0; }     // stance: foot planted
      else { const k = (c - 0.5) * 2; z = lerp(-step / 2, step / 2, k * k * (3 - 2 * k)); swing = Math.sin(k * Math.PI); up = swing * lift; }
      z *= move; up *= move;
      const lx = sgn * KID.hipW;
      // ground under this foot, relative to the body's ground height
      const wx = m.x + lx * cy + z * sy, wz = m.z - lx * sy + z * cy;
      const g = m.grounded ? m.groundAt(wx, wz) - m.y : 0;
      targets.push({ z, y: g + up + KID.ankle, toe: swing * move * TUNE.toe });
    }
    // hips: bob with the gait, drop so the lower foot can still reach the ground, dip on landing
    const cyc = Math.sin(s.phase * Math.PI * 2);
    const bob = Math.abs(cyc) * lerp(TUNE.bobWalk, TUNE.bobRun, run) * move;
    let hipY = legLen * lerp(0.985, 0.94, run) - bob + Math.sin(s.t * 2.2) * 0.004 * idle - TUNE.landDip * landK;
    hipY = Math.min(hipY, Math.min(...targets.map(t => t.y)) + legLen * 0.985);
    if (!m.grounded) hipY = legLen * 0.96;
    B.hips.position.y = hipY;
    // the walk sways the hips and the shoulders answer; idle shifts the weight slowly
    const sway = cyc * TUNE.sway * move + Math.sin(s.t * 0.8) * 0.02 * idle;
    B.hips.rotation.set(s.lean * 0.4, -cyc * TUNE.pelvis * move, s.side + sway);
    B.spine.rotation.set(s.lean * 0.6 + landK * 0.35, cyc * 0.12 * move, -sway * 0.7);
    B.head.rotation.set(-s.lean * 0.7 + Math.sin(s.t * 1.3) * 0.02 * idle - landK * 0.3 - 0.15 * rise + 0.1 * (air - rise), L.yaw, -s.side * 0.5 + sway * 0.3 - L.yaw * 0.2);
    B.spine.scale.setScalar(1 + Math.sin(s.t * 2.2) * 0.006 * idle);   // breathing
    s.blinkIn -= dt;                                                     // blink every few seconds
    if (s.blinkIn <= 0) { s.blink = 0.12; s.blinkIn = 2 + Math.random() * 3; }
    s.blink = Math.max(0, s.blink - dt);
    B.eyes.scale.set(1, s.blink > 0 ? 0.12 : 1, 1);
    // joy: for a moment the eyes close into smiling arches and the mouth opens wide
    if (s.joy > 0 || s.joyOn) {
      s.joy -= dt;
      const on = s.joy > 0;
      if (on !== s.joyOn) { s.joyOn = on; B.joy.scale.setScalar(on ? 1 : 1e-4); B.mouth.scale.set(on ? TUNE.joy.mouth[0] : 1, on ? TUNE.joy.mouth[1] : 1, 1); }
      if (on) B.eyes.scale.setScalar(1e-4);
    }

    if (m.grounded) {
      const [tl, tr] = targets;
      legIK(B.legL, B.shinL, B.footL, tl.y - hipY, tl.z, B.hips.rotation.x);
      legIK(B.legR, B.shinR, B.footR, tr.y - hipY, tr.z, B.hips.rotation.x);
      B.footL.rotation.x += tl.toe; B.footR.rotation.x += tr.toe;      // the swinging foot points its toes down
    } else {                                                            // jump: knees tucked
      const tuck = THREE.MathUtils.clamp(0.5 + m.vy * 0.08, 0.2, 0.9);
      B.legL.rotation.x = -tuck; B.shinL.rotation.x = tuck * 1.6; B.footL.rotation.x = -tuck * 0.6;
      B.legR.rotation.x = -tuck * 0.6; B.shinR.rotation.x = tuck * 1.2; B.footR.rotation.x = -tuck * 0.4;
    }

    // arms swing opposite to the legs, a little out from the body, elbows bent more when running;
    // in the air they go up on the way up and out to the sides on the way down; on landing they spread
    const swing = lerp(TUNE.armWalk, TUNE.armRun, run) * move;
    const ph = cyc, out = 0.14 + run * 0.12 + air * (1.0 - 0.5 * rise) + landK * 0.7, lift2 = air * (0.6 + 1.8 * rise);
    B.armL.rotation.set(-ph * swing - lift2, 0, out);
    B.armR.rotation.set(ph * swing - lift2, 0, -out);
    B.foreL.rotation.x = -(0.35 - 0.15 * move + run * 1.1 + Math.max(0, -ph) * 0.3 * move + air * 0.2);
    B.foreR.rotation.x = -(0.35 - 0.15 * move + run * 1.1 + Math.max(0, ph) * 0.3 * move + air * 0.2);

    // hat on a spring, pushed by the head's acceleration
    mesh.updateMatrixWorld(true);
    B.head.getWorldPosition(tmp);
    if (s.first) { s.headPrev.copy(tmp); s.headPrev2.copy(tmp); s.first = false; }
    if (dt > 0) {
      acc.copy(tmp).sub(s.headPrev).sub(s.headPrev).add(s.headPrev2).divideScalar(dt * dt);
      acc.clampLength(0, 60);
      // into head-local axes (approximately: yaw only)
      const ax = acc.x * cy - acc.z * sy, az = acc.x * sy + acc.z * cy;
      s.hatVel.x += (-TUNE.hatK * s.hatOff.x - TUNE.hatDamp * s.hatVel.x - ax * TUNE.hatPush) * dt;
      s.hatVel.y += (-TUNE.hatK * s.hatOff.y - TUNE.hatDamp * s.hatVel.y - acc.y * TUNE.hatPush) * dt;
      s.hatVel.z += (-TUNE.hatK * s.hatOff.z - TUNE.hatDamp * s.hatVel.z - az * TUNE.hatPush) * dt;
      s.hatOff.addScaledVector(s.hatVel, dt).clampLength(0, 0.04);
    }
    s.headPrev2.copy(s.headPrev); s.headPrev.copy(tmp);
    B.hat.position.copy(B.hat.userData.rest).add(s.hatOff);
    B.hat.rotation.set(s.hatOff.z * 6, 0, -s.hatOff.x * 6);
  }

  /** Show joy (closed smiling eyes, an open mouth) for `secs`. */
  const express = (secs = TUNE.joy.secs) => { s.joy = Math.max(s.joy, secs); };

  return { mesh, bones: B, update, express };
}
