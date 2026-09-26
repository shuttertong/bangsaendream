// NPC behaviour: standing idle (breathing, weight shift), head/neck look-at toward the
// player when close, a wave the first time the player arrives, blinking, turning to face
// the player while talking, and mouth shapes driven by the dialogue text.
import * as THREE from 'three';
import { buildPerson } from './body.js';

const NPC = {
  lookRange: 7, waveRange: 9, waveTime: 2.2, active: 90, visible: 220,
  headYaw: 1.1, headPitch: 0.45, turnSpeed: 4,
  blink: [2, 5], blinkTime: 0.12, radius: 0.45,
};
// mouth shapes: bone scale (x, y)
export const MOUTH = { closed: [1.2, 0.35], half: [1.2, 0.9], open: [1.1, 1.9], wide: [1.8, 0.8], round: [0.75, 1.5], smile: [1.8, 0.55] };

const lerp = (a, b, t) => a + (b - a) * t;
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export function createNPC(scene, def, place, map, lift = () => 0) {
  const { mesh, bones: B } = buildPerson(def.look);
  scene.add(mesh);
  const s = {
    x: place.x, z: place.z, yaw: place.yaw, baseYaw: place.yaw, t: Math.random() * 10,
    headYaw: 0, headPitch: 0, waved: false, wave: 0, blinkIn: 1 + Math.random() * 3, blink: 0,
    mouth: 'closed', mouthX: MOUTH.closed[0], mouthY: MOUTH.closed[1], talking: false,
  };
  const y = Math.max(map.heightAt(s.x, s.z) + lift(s.x, s.z), map.sea);
  mesh.position.set(s.x, y, s.z);
  const head = new THREE.Vector3();

  // relaxed standing pose (knees soft, arms down)
  const pose = () => {
    B.legL.rotation.set(-0.04, 0, 0.02); B.legR.rotation.set(-0.04, 0, -0.02);
    B.shinL.rotation.x = B.shinR.rotation.x = 0.08;
    B.footL.rotation.x = B.footR.rotation.x = -0.04;
    B.hips.position.y = B.hips.userData.rest.y - 0.006;
  };
  pose();

  /** player: { x, y, z } feet position. */
  function update(dt, player) {
    const dx = player.x - s.x, dz = player.z - s.z, dist = Math.hypot(dx, dz);
    mesh.visible = dist < NPC.visible;
    if (dist > NPC.active) return;
    s.t += dt;

    // turn toward the player while talking, back to the resting direction afterwards
    const toPlayer = Math.atan2(dx, dz);
    s.yaw = angleLerp(s.yaw, s.talking ? toPlayer : s.baseYaw, Math.min(1, dt * NPC.turnSpeed * (s.talking ? 1 : 0.3)));
    mesh.rotation.y = s.yaw;

    // head / neck look-at (clamped); spine takes a share of the turn
    let wantYaw = 0, wantPitch = 0;
    if (dist < NPC.lookRange) {
      let rel = toPlayer - s.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) < NPC.headYaw + 0.6) {
        wantYaw = THREE.MathUtils.clamp(rel, -NPC.headYaw, NPC.headYaw);
        B.head.getWorldPosition(head);
        wantPitch = THREE.MathUtils.clamp(-Math.atan2(player.y + 1.0 - head.y, dist), -NPC.headPitch, NPC.headPitch);
      }
    }
    s.headYaw = lerp(s.headYaw, wantYaw, Math.min(1, dt * 5));
    s.headPitch = lerp(s.headPitch, wantPitch, Math.min(1, dt * 5));
    B.head.rotation.set(s.headPitch, s.headYaw * 0.7, 0);
    B.spine.rotation.set(0.02, s.headYaw * 0.3, 0);

    // idle: breathing + slow weight shift
    B.spine.scale.setScalar(1 + Math.sin(s.t * 2) * 0.006);
    B.hips.rotation.z = Math.sin(s.t * 0.5) * 0.02;

    // wave the first time the player comes close
    if (!s.waved && dist < NPC.waveRange) { s.waved = true; s.wave = NPC.waveTime; }
    s.wave = Math.max(0, s.wave - dt);
    const w = Math.min(1, s.wave * 3, (NPC.waveTime - s.wave) * 4);
    B.armR.rotation.set(0, 0, lerp(-0.1, -2.6, w));
    B.foreR.rotation.set(-0.15 - w * 0.3, 0, w * Math.sin(s.t * 11) * 0.45);
    // talking gestures on the other arm
    const g = s.talking ? Math.sin(s.t * 2.3) * 0.25 + 0.3 : 0;
    B.armL.rotation.set(-g * 0.8, 0, 0.1 + g * 0.2);
    B.foreL.rotation.x = -0.2 - g * 1.2;

    // blink
    s.blinkIn -= dt;
    if (s.blinkIn <= 0) { s.blink = NPC.blinkTime; s.blinkIn = lerp(NPC.blink[0], NPC.blink[1], Math.random()); }
    s.blink = Math.max(0, s.blink - dt);
    B.eyes.scale.y = s.blink > 0 ? 0.12 : 1;

    // mouth shape, eased
    const [mx, my] = MOUTH[s.mouth] || MOUTH.closed;
    s.mouthX = lerp(s.mouthX, mx, Math.min(1, dt * 18));
    s.mouthY = lerp(s.mouthY, my, Math.min(1, dt * 18));
    B.mouth.scale.set(s.mouthX, s.mouthY, 1);
  }

  return {
    id: def.id, def, mesh, state: s, radius: NPC.radius,
    get pos() { return { x: s.x, z: s.z }; },
    setTalking(on) { s.talking = on; if (!on) s.mouth = 'closed'; },
    setMouth(shape) { s.mouth = shape; },
    update,
  };
}
