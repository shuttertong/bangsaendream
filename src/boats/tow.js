// Speedboat driver + a towed inflatable on a rope. The driver weaves gently and throws
// in telegraphed "hook" turns; the tow follows the stern at rope length, so it swings
// wide on the turns (the lateral acceleration drives the banana's tilt).
// Convention: yaw 0 = +z; positive yaw/turn swings toward +x, which is screen-LEFT for a
// camera chasing from behind. 'Local +x' below means that side.
import * as THREE from 'three';

export const TOW = {
  speed: 11, rope: 13,                 // m/s, metres
  weave: { amp: 0.22, period: 7 },     // gentle S-curves (rad/s turn rate, seconds)
  hook: { rate: 0.95, time: 1.2, warn: 1.1, every: [6, 10] },   // sharp turns: rad/s, seconds, warning, gap
};

export function createTow(r, opts = {}) {
  const T = { ...TOW, ...opts };
  const boat = { x: 0, z: 0, yaw: 0, turn: 0 };
  const tow = { x: 0, z: -T.rope, vx: 0, vz: T.speed, ax: 0, az: 0, yaw: 0, lateral: 0 };
  let t = 0, hookIn = T.hook.every[0], hook = 0, hookDir = 1, warn = 0;

  function update(dt) {
    t += dt;
    // steering: weave + hooks (announced `warn` seconds before they start)
    hookIn -= dt;
    if (hookIn <= T.hook.warn && hookIn > 0 && !warn) { warn = 1; hookDir = r() < 0.5 ? -1 : 1; }
    if (hookIn <= 0 && hook <= 0) { hook = T.hook.time; warn = 0; }
    if (hook > 0) { hook -= dt; if (hook <= 0) hookIn = THREE.MathUtils.lerp(...T.hook.every, r()); }
    boat.turn = Math.sin((t / T.weave.period) * Math.PI * 2) * T.weave.amp + (hook > 0 ? hookDir * T.hook.rate : 0);
    boat.yaw += boat.turn * dt;
    boat.x += Math.sin(boat.yaw) * T.speed * dt;
    boat.z += Math.cos(boat.yaw) * T.speed * dt;

    // tow: follow the stern at rope length
    const sx = boat.x - Math.sin(boat.yaw) * 2.6, sz = boat.z - Math.cos(boat.yaw) * 2.6;
    const px = tow.x, pz = tow.z;
    let dx = tow.x - sx, dz = tow.z - sz;
    const d = Math.hypot(dx, dz) || 1;
    tow.x = sx + (dx / d) * T.rope; tow.z = sz + (dz / d) * T.rope;
    const vx = (tow.x - px) / dt, vz = (tow.z - pz) / dt;
    tow.ax = (vx - tow.vx) / dt; tow.az = (vz - tow.vz) / dt;
    tow.vx = vx; tow.vz = vz;
    tow.yaw = Math.atan2(sx - tow.x, sz - tow.z);
    // sideways acceleration along the tow's local +x (= screen-left from the chase camera)
    const rx = Math.cos(tow.yaw), rz = -Math.sin(tow.yaw);
    tow.lateral = THREE.MathUtils.lerp(tow.lateral, tow.ax * rx + tow.az * rz, 1 - Math.exp(-dt * 8));
  }

  return {
    boat, tow, update, stern: () => new THREE.Vector3(boat.x - Math.sin(boat.yaw) * 2.6, 0, boat.z - Math.cos(boat.yaw) * 2.6),
    /** A hook turn is coming: +1 toward local +x (screen-left), −1 screen-right, 0 none. */
    get warning() { return warn ? hookDir : 0; },
    get hooking() { return hook > 0; },
  };
}
