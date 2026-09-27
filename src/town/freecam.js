// Orbit camera for M1 (before the player exists): (yaw, pitch, distance) around a
// target that stays on the ground. Drag = rotate, right/shift-drag or WASD = move,
// wheel = zoom, Q/E = rotate. The player camera replaces this in M2.
import * as THREE from 'three';

// Fixed views for before/after screenshots (?view=beach|town|air, plus ksm|r3137)
export const VIEWS = {
  beach: { target: [318, 985], yaw: 0.32, pitch: 0.08, dist: 14 },
  town: { target: [-1240, -700], yaw: 0.8, pitch: 0.38, dist: 150 },
  air: { target: [-250, -300], yaw: 0.3, pitch: 1.0, dist: 4600, tilt: true },
  ksm: { target: [-560, -1750], yaw: 0.2, pitch: 0.95, dist: 1300 },        // Khao Sam Muk from above
  r3137: { target: [1300, 1000], yaw: -1.2, pitch: 0.7, dist: 900 },        // road 3137 heading inland
};

const MIN_DIST = 4, MAX_DIST = 9000;

export function createFreeCam(camera, input, map) {
  const target = new THREE.Vector3();
  const s = { yaw: 0, pitch: 0.5, dist: 200, tilt: false };

  function setView(name) {
    const v = VIEWS[name] || VIEWS.beach;
    target.set(v.target[0], 0, v.target[1]);
    Object.assign(s, { yaw: v.yaw, pitch: v.pitch, dist: v.dist, tilt: !!v.tilt });
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  function update(dt) {
    s.yaw -= input.drag.x * 0.005;
    s.pitch = Math.min(1.45, Math.max(0.02, s.pitch + input.drag.y * 0.004));
    if (input.down('KeyQ')) s.yaw += dt * 1.5;
    if (input.down('KeyE')) s.yaw -= dt * 1.5;
    s.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, s.dist * Math.pow(1.12, input.wheel)));

    fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    right.set(-fwd.z, 0, fwd.x);
    const speed = s.dist * (input.down('ShiftLeft') ? 2.5 : 1);
    let mx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    let mz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    target.addScaledVector(right, mx * speed * dt).addScaledVector(fwd, mz * speed * dt);
    const pan = s.dist * 0.0015;
    target.addScaledVector(right, -input.pan.x * pan).addScaledVector(fwd, input.pan.y * pan);
    target.y = Math.max(map.heightAt(target.x, target.z), map.sea) + 1.4;

    const cp = Math.cos(s.pitch);
    camera.position.set(
      target.x + Math.sin(s.yaw) * cp * s.dist,
      target.y + Math.sin(s.pitch) * s.dist,
      target.z + Math.cos(s.yaw) * cp * s.dist);
    // never below the ground or the sea
    const floor = Math.max(map.heightAt(camera.position.x, camera.position.z), map.sea) + 1.2;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(target);
  }

  return { target, state: s, setView, update };
}
