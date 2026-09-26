// Monkey behaviour. enter (from the trees toward the mat, sneaky ones circle behind the
// kid) → grab (snatch a snack) → escape (run off with it) | scared (after a dash hit:
// flee, dropping what it carried). Alphas take two hits: the first only knocks them back.
import * as THREE from 'three';
import { MONKEYS, ROUND, pickMonkey } from './species.js';
import { monkeyGeometry } from './models.js';

export function createMonkeys(scene, material, snacks, r) {
  const geos = Object.fromEntries(MONKEYS.map(m => [m.id, monkeyGeometry(m)]));
  const list = [];
  const R = ROUND.arena;

  function spawn(wave) {
    const sp = pickMonkey(r, wave);
    const g = new THREE.Group();
    const body = new THREE.Mesh(geos[sp.id].body, material);
    const front = new THREE.Mesh(geos[sp.id].front, material), back = new THREE.Mesh(geos[sp.id].back, material);
    front.position.set(0, 0.3, 0.14); back.position.set(0, 0.3, -0.14);
    for (const m of [body, front, back]) { m.castShadow = true; g.add(m); }
    g.scale.setScalar(sp.size * 1.6);                       // a bit larger than life for readability
    // enter from the tree side (never from the cliff)
    let a;
    do { a = r() * Math.PI * 2; } while (Math.sin(a) < -0.3);
    const m = { sp, g, front, back, body, x: Math.cos(a) * (R + 6), z: Math.sin(a) * (R + 6), state: 'enter', t: 0,
      hp: sp.hp, carry: null, phase: r() * 6, yaw: 0, side: r() < 0.5 ? -1 : 1, knock: 0 };
    scene.add(g);
    list.push(m);
    return m;
  }

  function hit(m, from) {
    if (m.state === 'scared' || m.state === 'gone') return false;
    m.hp--;
    const dx = m.x - from.x, dz = m.z - from.z, d = Math.hypot(dx, dz) || 1;
    if (m.hp > 0) { m.knock = 0.35; m.kx = dx / d; m.kz = dz / d; return 'stagger'; }
    m.state = 'scared'; m.t = 0;
    if (m.carry) { snacks.drop(m.carry, m.x, m.z); m.carry = null; }
    return 'shoo';
  }

  /** kid: { x, z } */
  function update(dt, time, kid) {
    for (const m of list) {
      if (m.state === 'gone') continue;
      m.t += dt;
      let tx = 0, tz = 0, speed = m.sp.speed;
      const dk = Math.hypot(m.x - kid.x, m.z - kid.z);
      switch (m.state) {
        case 'enter': {
          const target = snacks.nearestOnMat(m.x, m.z);
          if (!target) { m.state = 'escape'; break; }
          tx = target.x - m.x; tz = target.z - m.z;
          // sneaky: swing wide, away from the kid, until close to the mat
          if (m.sp.sneaky && Math.hypot(tx, tz) > 3) {
            const ax = m.x - kid.x, az = m.z - kid.z, al = Math.hypot(ax, az) || 1;
            tx += (ax / al) * 3 + -tz * 0.4 * m.side; tz += (az / al) * 3 + tx * 0.4 * m.side;
          }
          // everyone but the alpha shies away from the kid a little
          if (m.sp.id !== 'alpha' && dk < 2.2) { tx += (m.x - kid.x) * 1.5; tz += (m.z - kid.z) * 1.5; }
          if (Math.hypot(target.x - m.x, target.z - m.z) < 0.45) { m.state = 'grab'; m.t = 0; m.target = target; }
          break;
        }
        case 'grab':
          speed = 0;
          if (m.target.state !== 'mat') { m.state = 'enter'; break; }       // someone else took it
          if (m.t > m.sp.grab) { m.carry = snacks.take(m.target); m.state = 'escape'; m.t = 0; }
          break;
        case 'escape':
        case 'scared': {
          const a = Math.atan2(m.z, m.x);
          const ex = Math.cos(a) * (R + 8), ez = Math.sin(a) * (R + 8);
          tx = ex - m.x; tz = ez - m.z;
          if (m.state === 'scared') speed *= 1.6;
          else if (m.carry) speed *= ROUND.carrySlow;
          if (Math.hypot(m.x, m.z) > R + 7) {
            m.state = 'gone'; scene.remove(m.g);
            if (m.carry) snacks.lose(m.carry);
          }
          break;
        }
      }
      if (m.knock > 0) {                                     // stagger back after a hit
        m.knock -= dt;
        m.x += m.kx * 5 * dt; m.z += m.kz * 5 * dt;
      } else if (speed > 0) {
        const d = Math.hypot(tx, tz) || 1;
        m.x += (tx / d) * speed * dt; m.z += (tz / d) * speed * dt;
        m.yaw = Math.atan2(tx, tz);
      }
      // gallop: legs swing in opposite pairs, body bobs; grabbing monkeys sit up
      const moving = speed > 0 && m.state !== 'grab';
      m.phase += dt * (moving ? 14 : 3);
      const s = Math.sin(m.phase);
      m.front.rotation.x = moving ? s * 0.8 : -0.9;
      m.back.rotation.x = moving ? -s * 0.8 : 0.4;
      m.body.rotation.x = m.state === 'grab' ? -0.5 : 0;
      m.g.position.set(m.x, moving ? Math.abs(s) * 0.06 : 0, m.z);
      m.g.rotation.y = m.yaw;
      if (m.carry) snacks.carry(m.carry, m.x, m.z, time);
    }
  }

  /** A dash startles smaller monkeys nearby (not the alpha). Returns how many fled. */
  function fright(p) {
    let n = 0;
    for (const m of list) {
      if (m.state === 'gone' || m.state === 'scared' || m.sp.hp > 1) continue;
      if (Math.hypot(m.x - p.x, m.z - p.z) < ROUND.fright) { m.hp = 1; if (hit(m, p) === 'shoo') n++; }
    }
    return n;
  }

  const active = () => list.filter(m => m.state !== 'gone').length;
  return { list, spawn, update, hit, fright, active, dispose: () => list.forEach(m => scene.remove(m.g)) };
}
