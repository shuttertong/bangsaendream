// Third-person camera: (yaw, pitch, distance) around the player's head. Drag / Q,E
// rotate, wheel zooms. It pulls in so it never goes inside buildings or below ground,
// and eases back out; when the player runs and the user isn't steering, it drifts
// behind them.
import * as THREE from 'three';

const CAM = {
  head: 1.15, dist: 5.5, minDist: 1.6, maxDist: 14, pitch: 0.28,
  minPitch: -0.25, maxPitch: 1.25, follow: 1.2, idleBeforeFollow: 1.5, clearance: 0.35,
};

export function createThirdPersonCamera(camera, input, map, collision) {
  const s = { yaw: 0, pitch: CAM.pitch, dist: CAM.dist, cur: CAM.dist, idle: 0 };
  const target = new THREE.Vector3(), want = new THREE.Vector3(), p = new THREE.Vector3();
  let first = true;

  function blockedAt(x, y, z) {
    return map.heightAt(x, z) + CAM.clearance > y || collision.topAt(x, z) > y - CAM.clearance;
  }

  function update(dt, player) {
    const dragging = input.drag.x || input.drag.y || input.down('KeyQ') || input.down('KeyE');
    s.yaw -= input.drag.x * 0.006;
    s.pitch = THREE.MathUtils.clamp(s.pitch + input.drag.y * 0.004, CAM.minPitch, CAM.maxPitch);
    if (input.down('KeyQ')) s.yaw += dt * 1.8;
    if (input.down('KeyE')) s.yaw -= dt * 1.8;
    s.dist = THREE.MathUtils.clamp(s.dist * Math.pow(1.1, input.wheel), CAM.minDist, CAM.maxDist);

    // drift behind the player while they move and the user isn't steering
    s.idle = dragging ? 0 : s.idle + dt;
    if (player.speed > 1 && s.idle > CAM.idleBeforeFollow) {
      let d = (player.yaw + Math.PI) - s.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * Math.min(1, CAM.follow * dt * Math.min(1, player.speed / 3));
    }

    const goal = new THREE.Vector3(player.x, player.y + CAM.head, player.z);
    if (first) { target.copy(goal); first = false; }
    target.lerp(goal, 1 - Math.exp(-dt * 12));

    // march from the head outward; stop before anything solid
    const cp = Math.cos(s.pitch);
    want.set(Math.sin(s.yaw) * cp, Math.sin(s.pitch), Math.cos(s.yaw) * cp);
    let free = s.dist;
    for (let d = 0.3; d <= s.dist; d += 0.25) {
      p.copy(target).addScaledVector(want, d);
      if (blockedAt(p.x, p.y, p.z)) { free = Math.max(CAM.minDist * 0.5, d - 0.3); break; }
    }
    // pull in fast, ease back out slowly
    s.cur += (free - s.cur) * Math.min(1, dt * (free < s.cur ? 20 : 3));
    camera.position.copy(target).addScaledVector(want, s.cur);
    const floor = map.heightAt(camera.position.x, camera.position.z) + CAM.clearance;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(target);
  }

  return { state: s, target, update, setYaw: y => { s.yaw = y; } };
}
