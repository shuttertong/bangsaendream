// Squid behaviour. States: swim (in its depth band, drawn to the lamp glow) → curious
// (a jig nearby) → strike (in the pause after a jig) → hooked → caught | escape (jets
// away and leaves a puff of ink).
import * as THREE from 'three';
import { SPECIES, ROUND, pickSpecies, rollSize } from './species.js';
import { squidGeometry } from './models.js';

const VISUAL = 7;            // drawn larger than life so they read on a phone
const LIGHT_X = [-5, 5];     // the lamp glow they gather in

export function createSquids(scene, material, r) {
  const geos = Object.fromEntries(SPECIES.map(s => [s.id, squidGeometry(s)]));
  const list = [], inks = [];
  const inkMat = new THREE.MeshBasicMaterial({ color: '#0a0a14', transparent: true, opacity: 0.6, depthWrite: false });

  function spawn() {
    const sp = pickSpecies(r), size = rollSize(sp, r);
    const g = new THREE.Group();
    const body = new THREE.Mesh(geos[sp.id].body, material), arms = new THREE.Mesh(geos[sp.id].arms, material);
    g.add(body, arms);
    g.scale.setScalar((size / 100) * VISUAL);
    const side = r() < 0.5 ? -1 : 1;
    const q = {
      sp, size, g, body, arms, state: 'swim', t: 0, pulse: r() * 6,
      x: side * 14, y: -THREE.MathUtils.lerp(sp.depth[0], sp.depth[1], r()), z: -1.5 + r() * 2,
      vx: -side * sp.speed, vy: 0, face: -side, curious: 0, wander: r() * 6,
    };
    if (sp.kind === 'octopus') q.y = -sp.depth[1] + 0.2;   // octopuses creep along the bottom
    scene.add(g);
    list.push(q);
    return q;
  }

  function ink(x, y) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), inkMat.clone());
    m.position.set(x, y, 0.2);
    scene.add(m);
    inks.push({ m, t: 0 });
  }

  /** lure: { x, y, jigAge (s since last jig), hooked (squid or null) } */
  function update(dt, time, lure, maxSquid) {
    const alive = list.filter(q => q.state !== 'gone' && q.state !== 'caught');
    if (alive.length < maxSquid && r() < dt / THREE.MathUtils.lerp(...ROUND.spawnEvery, r())) spawn();
    let hookedNow = null;

    for (const q of list) {
      if (q.state === 'gone' || q.state === 'caught') continue;
      q.t += dt;
      const sp = q.sp, dx = lure.x - q.x, dy = lure.y - q.y, dl = Math.hypot(dx, dy);
      const inBand = -lure.y > sp.depth[0] - 2 && -lure.y < sp.depth[1] + 2;
      let tx = 0, ty = 0, speed = sp.speed;

      switch (q.state) {
        case 'swim': {
          // drift toward the lamp glow, wander a little within the depth band
          q.wander += dt * 0.7;
          const gx = THREE.MathUtils.clamp(q.x, LIGHT_X[0], LIGHT_X[1]);
          tx = (gx - q.x) * 0.4 + Math.sin(q.wander) * 1.2;
          const mid = -(sp.depth[0] + sp.depth[1]) / 2;
          ty = (mid - q.y) * 0.3 + Math.cos(q.wander * 1.3) * 0.3;
          speed *= 0.5;
          if (!lure.hooked && inBand && dl < ROUND.attract && lure.jigAge < 1.2) { q.state = 'curious'; q.t = 0; }
          break;
        }
        case 'curious': {
          // hover close to the jig; strike during the pause after a jig
          const hx = lure.x - Math.sign(dx || 1) * 0.7;
          tx = hx - q.x; ty = lure.y - q.y;
          speed *= 0.8;
          const window = lure.jigAge > ROUND.biteAfter[0] && lure.jigAge < ROUND.biteAfter[1];
          if (!lure.hooked && dl < 1.6 && window && r() < sp.bite * dt * ROUND.keen) { q.state = 'strike'; q.t = 0; }
          if (lure.hooked || !inBand || lure.jigAge > 5) { q.state = 'swim'; q.t = 0; }
          break;
        }
        case 'strike':
          tx = dx; ty = dy; speed = sp.speed * 3;
          if (dl < 0.25 && !lure.hooked && !hookedNow) { q.state = 'hooked'; q.t = 0; hookedNow = q; }   // caller starts the fight
          if (q.t > 1.2 || lure.hooked) { q.state = 'swim'; }
          break;
        case 'hooked':
          // hangs on the jig, arms toward it
          q.x = lure.x - q.face * 0.35; q.y = lure.y - 0.05;
          break;
        case 'escape':
          tx = q.face * 10; ty = -2; speed = sp.speed * 4;
          if (q.t > 2.5) { q.state = 'gone'; scene.remove(q.g); }
          break;
      }

      if (q.state !== 'hooked') {
        const d = Math.hypot(tx, ty) || 1;
        q.vx += ((tx / d) * speed - q.vx) * Math.min(1, dt * 2);
        q.vy += ((ty / d) * speed - q.vy) * Math.min(1, dt * 2);
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.y = THREE.MathUtils.clamp(q.y, -ROUND.bottom + 0.4, -0.6);
        if (Math.abs(q.vx) > 0.1) q.face = Math.sign(q.vx);
        if (Math.abs(q.x) > 16 && q.state === 'swim' && q.t > 8) { q.state = 'gone'; scene.remove(q.g); }
      }

      // pose: head toward travel direction; mantle pulses (jet), arms flutter
      q.g.position.set(q.x, q.y, q.z);
      q.g.rotation.y = q.face > 0 ? 0 : Math.PI;
      q.pulse += dt * (4 + Math.hypot(q.vx, q.vy) * 3);
      const pl = Math.sin(q.pulse);
      if (sp.kind === 'octopus') { q.arms.scale.set(1 + pl * 0.08, 1 - pl * 0.1, 1 + pl * 0.08); q.g.rotation.y += Math.sin(time) * 0.2; }
      else { q.body.scale.set(1, 1 + pl * 0.05, 1 + pl * 0.05); q.arms.rotation.z = pl * 0.12; q.arms.scale.x = 1 + pl * 0.08; }
      q.g.rotation.z = THREE.MathUtils.clamp(q.vy * 0.25 * q.face, -0.5, 0.5);
    }

    for (const k of inks) {
      k.t += dt;
      k.m.scale.setScalar(1 + k.t * 3);
      k.m.material.opacity = Math.max(0, 0.6 - k.t * 0.35);
      if (k.t > 2) scene.remove(k.m);
    }
    return hookedNow;
  }

  function escape(q) { q.state = 'escape'; q.t = 0; ink(q.x, q.y); }
  function caught(q) { q.state = 'caught'; scene.remove(q.g); }

  // a few squid already in the glow when the round starts
  for (let i = 0; i < 3; i++) { const q = spawn(); q.x = -4 + r() * 8; }

  return { list, update, escape, caught, dispose: () => { list.forEach(q => scene.remove(q.g)); inks.forEach(k => scene.remove(k.m)); } };
}
