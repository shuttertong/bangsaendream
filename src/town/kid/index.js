// Kid animation: gait phase driven by distance actually travelled (no running in place),
// 2-joint IK legs that plant the feet on the terrain, arm swing, lean into acceleration
// and turns, a spring on the hat, jump pose and idle breathing.
import * as THREE from 'three';
import { buildKid, KID } from './model.js';

const TUNE = {
  stepWalk: 0.32, stepRun: 0.62,        // step length (m); a full cycle is two steps
  liftWalk: 0.07, liftRun: 0.16,
  runFrom: 2.0, runTo: 3.6,             // speed band blending walk → run (m/s)
  armWalk: 0.35, armRun: 0.95,
  leanRun: 0.2, leanAccel: 0.035, leanTurn: 0.05,
  hatK: 90, hatDamp: 9, hatPush: 0.012,
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createKid(scene, look) {
  const { mesh, bones: B } = buildKid(look);
  scene.add(mesh);
  const s = {
    phase: 0, speed: 0, lean: 0, side: 0, t: 0,
    hatOff: new THREE.Vector3(), hatVel: new THREE.Vector3(),
    headPrev: new THREE.Vector3(), headPrev2: new THREE.Vector3(), first: true, blinkIn: 2, blink: 0,
  };
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
    const move = smooth(0.05, 0.5, s.speed);
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
      let z, up;
      if (c < 0.5) { z = lerp(step / 2, -step / 2, c * 2); up = 0; }     // stance: foot planted
      else { const k = (c - 0.5) * 2; z = lerp(-step / 2, step / 2, k * k * (3 - 2 * k)); up = Math.sin(k * Math.PI) * lift; }
      z *= move; up *= move;
      const lx = sgn * KID.hipW;
      // ground under this foot, relative to the body's ground height
      const wx = m.x + lx * cy + z * sy, wz = m.z - lx * sy + z * cy;
      const g = m.grounded ? m.groundAt(wx, wz) - m.y : 0;
      targets.push({ z, y: g + up + KID.ankle });
    }
    // hips: bob with the gait, drop so the lower foot can still reach the ground
    const bob = Math.abs(Math.sin(s.phase * Math.PI * 2)) * lerp(0.012, 0.04, run) * move;
    let hipY = legLen * lerp(0.985, 0.94, run) - bob + Math.sin(s.t * 2.2) * 0.004 * (1 - move);
    hipY = Math.min(hipY, Math.min(...targets.map(t => t.y)) + legLen * 0.985);
    if (!m.grounded) hipY = legLen * 0.96;
    B.hips.position.y = hipY;
    B.hips.rotation.set(s.lean * 0.4, 0, s.side);
    B.spine.rotation.set(s.lean * 0.6, Math.sin(s.phase * Math.PI * 2) * 0.12 * move, 0);
    B.head.rotation.set(-s.lean * 0.7 + Math.sin(s.t * 1.3) * 0.02 * (1 - move), 0, -s.side * 0.5);
    B.spine.scale.setScalar(1 + Math.sin(s.t * 2.2) * 0.006 * (1 - move));   // breathing
    s.blinkIn -= dt;                                                     // blink every few seconds
    if (s.blinkIn <= 0) { s.blink = 0.12; s.blinkIn = 2 + Math.random() * 3; }
    s.blink = Math.max(0, s.blink - dt);
    B.eyes.scale.y = s.blink > 0 ? 0.12 : 1;

    if (m.grounded) {
      const [L, R] = targets;
      legIK(B.legL, B.shinL, B.footL, L.y - hipY, L.z, B.hips.rotation.x);
      legIK(B.legR, B.shinR, B.footR, R.y - hipY, R.z, B.hips.rotation.x);
    } else {                                                            // jump: knees tucked
      const tuck = THREE.MathUtils.clamp(0.5 + m.vy * 0.08, 0.2, 0.9);
      B.legL.rotation.x = -tuck; B.shinL.rotation.x = tuck * 1.6; B.footL.rotation.x = -tuck * 0.6;
      B.legR.rotation.x = -tuck * 0.6; B.shinR.rotation.x = tuck * 1.2; B.footR.rotation.x = -tuck * 0.4;
    }

    // arms swing opposite to the legs; elbows bend more when running
    const swing = lerp(TUNE.armWalk, TUNE.armRun, run) * move;
    const ph = Math.sin(s.phase * Math.PI * 2);
    const air = m.grounded ? 0 : 1;
    B.armL.rotation.set(-ph * swing - air * 1.2, 0, 0.12 + air * 0.4);
    B.armR.rotation.set(ph * swing - air * 1.2, 0, -0.12 - air * 0.4);
    B.foreL.rotation.x = -(0.2 + run * 1.1 + Math.max(0, -ph) * 0.3 * move);
    B.foreR.rotation.x = -(0.2 + run * 1.1 + Math.max(0, ph) * 0.3 * move);

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

  return { mesh, bones: B, update };
}
