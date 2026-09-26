// Riders on a towed inflatable: the kid + friends in life vests. Seated riders are
// children of the inflatable; a rider who falls off is flung (ballistic, tumbling),
// splashes, then bobs in the water as the boat pulls away.
import * as THREE from 'three';
import { buildPerson } from '../town/people/body.js';
import { KID_LOOK } from '../town/kid/model.js';
import { swellAt } from './scene.js';

const FRIENDS = [
  { skin: '#c68f66', shirt: '#f0b43a', hat: 'none', hairStyle: 'short', bottomColor: '#3a6a4a' },
  { skin: '#e0b08a', shirt: '#e8958a', hat: 'none', hairStyle: 'long', bottomColor: '#34507a' },
  { skin: '#b8835c', shirt: '#4fb3a8', hat: 'none', hairStyle: 'short', bottomColor: '#6a5a4a' },
];
const VESTS = ['#e8541e', '#2a2a2a', '#f0c23a', '#2a2a2a'];

export function createRiders(scene, parent, seats, { straddle = false } = {}) {
  const splashMat = new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  const puffs = [];
  const riders = seats.map((seat, i) => {
    const look = i === 0 ? { ...KID_LOOK, vest: VESTS[0] } : { ...FRIENDS[(i - 1) % FRIENDS.length], vest: VESTS[i % VESTS.length], scale: 1.05 };
    const p = buildPerson(look);
    p.mesh.position.copy(seat.pos);
    p.mesh.rotation.y = seat.yaw || 0;
    parent.add(p.mesh);
    const r = { ...p, seat, on: true, kid: i === 0, v: new THREE.Vector3(), spin: new THREE.Vector3(), t: 0, wave: Math.random() * 6 };
    pose(r, 0);
    return r;
  });

  function pose(r, t) {
    const B = r.bones;
    B.hips.position.y = 0.3;
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      B[`leg${s}`].rotation.set(straddle ? -1.2 : -1.45, 0, straddle ? sg * 0.55 : 0);
      B[`shin${s}`].rotation.x = straddle ? 1.3 : 1.2;
    }
    // hands on the handles, a cheer now and then
    const cheer = Math.sin(t * 0.7 + r.wave) > 0.93;
    B.armL.rotation.set(cheer ? -2.8 : -0.7, 0, 0.3);
    B.armR.rotation.set(-0.7, 0, -0.3);
    B.foreL.rotation.x = cheer ? 0 : -0.9;
    B.foreR.rotation.x = -0.9;
    B.mouth.scale.set(1.7, cheer ? 1.4 : 0.6, 1);
  }

  /** Throw rider off toward `dir` (world). */
  function fall(r, dir, up = 5) {
    if (!r.on) return;
    r.on = false;
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
    r.mesh.getWorldPosition(wp); r.mesh.getWorldQuaternion(wq);
    parent.remove(r.mesh);
    scene.add(r.mesh);
    r.mesh.position.copy(wp); r.mesh.quaternion.copy(wq);
    r.v.set(dir.x * 5, up, dir.z * 5);
    r.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8);
    r.t = 0; r.splashed = false;
    const B = r.bones;
    B.armL.rotation.set(-2.6, 0, 0.8); B.armR.rotation.set(-2.6, 0, -0.8);
    B.mouth.scale.set(1.1, 2, 1);
  }

  /** Put a fallen rider back on their seat (after climbing back on). */
  function reseat(r) {
    if (r.on) return;
    scene.remove(r.mesh);
    parent.add(r.mesh);
    r.mesh.position.copy(r.seat.pos);
    r.mesh.rotation.set(0, r.seat.yaw || 0, 0);
    r.on = true;
  }

  function splash(pos) {
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(splashMat.clone());
      s.position.copy(pos);
      s.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), t: 0 };
      scene.add(s);
      puffs.push(s);
    }
  }

  function update(dt, t) {
    for (const r of riders) {
      if (r.on) { pose(r, t); continue; }
      r.t += dt;
      const m = r.mesh, sea = swellAt(m.position.x, m.position.z, t).h;
      if (!r.splashed) {
        r.v.y -= 9.8 * dt;
        m.position.addScaledVector(r.v, dt);
        m.rotation.x += r.spin.x * dt; m.rotation.y += r.spin.y * dt; m.rotation.z += r.spin.z * dt;
        if (m.position.y < sea - 0.6 && r.v.y < 0) { r.splashed = true; splash(m.position.clone().setY(sea)); }
      } else {
        // bob in the water, upright, head above the surface
        m.position.y = THREE.MathUtils.lerp(m.position.y, sea - 0.9, 1 - Math.exp(-dt * 4));
        m.rotation.x *= 0.9; m.rotation.z *= 0.9;
        r.bones.armL.rotation.z = 0.8 + Math.sin(t * 5) * 0.5;       // waving for help
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const s = puffs[i], u = s.userData;
      u.t += dt; u.v.y -= 9.8 * dt;
      s.position.addScaledVector(u.v, dt);
      s.scale.setScalar(0.3 + u.t * 1.2);
      s.material.opacity = Math.max(0, 0.9 - u.t * 1.2);
      if (u.t > 0.8) { scene.remove(s); puffs.splice(i, 1); }
    }
  }

  return { riders, fall, reseat, update, splash, onBoard: () => riders.filter(r => r.on) };
}
