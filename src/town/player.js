// Player movement: camera-relative WASD, walk / Shift-run, jump, smooth turning,
// collision with sliding, and the walkable-area rule from collision.js.
import { createKid } from './kid/index.js';

const MOVE = {
  walk: 1.7, run: 4.3,          // m/s
  accel: 9, decel: 12,          // m/s²
  turn: 11,                     // rad/s toward the move direction
  jump: 4.4, gravity: 13,
  radius: 0.28,
  runStick: 0.8,                // joystick push (0..1) that switches to running
};

export function createPlayer(scene, map, collision, input) {
  const kid = createKid(scene);
  const p = { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0, vy: 0, grounded: true, speed: 0, prevSpeed: 0, prevYaw: 0 };
  const ground = (x, z) => Math.max(map.heightAt(x, z), map.sea - collision.wade);

  function place(x, z, yaw = 0) {
    Object.assign(p, { x, z, yaw, vx: 0, vz: 0, vy: 0, grounded: true });
    p.y = ground(x, z);
  }

  /** camYaw: the camera's yaw, so "forward" means away from the camera. */
  function update(dt, camYaw) {
    const { f, r, mag } = input.axis();                       // keys or on-screen joystick
    const len = Math.hypot(f, r);
    // Shift runs; on the joystick, pushing past `runStick` runs and less walks slower
    const shift = input.down('ShiftLeft') || input.down('ShiftRight');
    const top = shift || mag > MOVE.runStick ? MOVE.run : MOVE.walk * Math.max(0.45, mag / MOVE.runStick);
    // forward = away from camera
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = -fz, rz = fx;
    const wx = len ? (fx * f + rx * r) / len * top : 0, wz = len ? (fz * f + rz * r) / len * top : 0;
    const a = len ? MOVE.accel : MOVE.decel;
    const dvx = wx - p.vx, dvz = wz - p.vz, dv = Math.hypot(dvx, dvz), k = Math.min(1, (a * dt) / (dv || 1));
    p.vx += dvx * k; p.vz += dvz * k;

    // move with sliding
    const x0 = p.x, z0 = p.z;
    const tryMove = (nx, nz) => collision.free(nx, nz, MOVE.radius, p.y) && (p.x = nx, p.z = nz, true);
    const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
    if (!tryMove(nx, nz)) {
      if (!tryMove(nx, p.z)) p.vx = 0;
      if (!tryMove(p.x, nz)) p.vz = 0;
    }
    const moved = Math.hypot(p.x - x0, p.z - z0);

    // turn toward where we're actually going
    if (Math.hypot(p.vx, p.vz) > 0.2) {
      const want = Math.atan2(p.vx, p.vz);
      let d = want - p.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw += d * Math.min(1, MOVE.turn * dt);
    }

    // vertical: jump and gravity
    const g = ground(p.x, p.z);
    if (p.grounded && (input.down('Space') || input.jump)) { p.vy = MOVE.jump; p.grounded = false; }
    if (!p.grounded) {
      p.vy -= MOVE.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= g) { p.y = g; p.vy = 0; p.grounded = true; }
    } else {
      p.y += (g - p.y) * Math.min(1, dt * 20);           // follow the ground smoothly
    }

    // animation inputs come from the distance actually travelled
    const speed = dt > 0 ? moved / dt : 0;
    const accel = dt > 0 ? (speed - p.prevSpeed) / dt : 0;
    let turn = p.yaw - p.prevYaw; turn = Math.atan2(Math.sin(turn), Math.cos(turn)) / (dt || 1);
    p.prevSpeed = speed; p.prevYaw = p.yaw; p.speed = speed;
    kid.update(dt, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, speed, dist: moved, accel, turn, grounded: p.grounded, vy: p.vy, groundAt: ground });
  }

  return { state: p, kid, place, update };
}
