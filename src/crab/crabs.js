// Crab behaviour. States: hidden (in a hole) → emerge → wander ⇄ dazzled (lit by the
// flashlight) → flee (to the nearest safe hole) → dive (gone) | caught.
// Crabs walk sideways, so the body turns perpendicular to where it's going.
import * as THREE from 'three';
import { SPECIES, ROUND, pickSpecies, rollSize } from './species.js';
import { crabGeometry } from './models.js';
import { BEACH } from './scene.js';

const VISUAL = 7;            // crabs are drawn larger than life so they read on a phone
const LIT_TIME = 0.25;       // seconds in the beam before a crab freezes
const DIVE_TIME = 0.5, EMERGE_TIME = 0.45;

export function createCrabs(scene, material, heightAt, r) {
  const geos = Object.fromEntries(SPECIES.map(s => [s.id, crabGeometry(s)]));
  const holes = [];
  for (let i = 0; i < ROUND.holes; i++) {
    let x, z, tries = 0;
    do {
      x = THREE.MathUtils.lerp(BEACH.x0 + 3, BEACH.x1 - 3, r());
      z = THREE.MathUtils.lerp(BEACH.water + 3, BEACH.back - 2, r());
    } while (tries++ < 40 && holes.some(h => Math.hypot(h.x - x, h.z - z) < 5));
    holes.push({ x, z, timer: THREE.MathUtils.lerp(...ROUND.emergeEvery, r()) * (1 + i * 0.3) });
  }

  const crabs = [];
  function spawn(hole) {
    const sp = pickSpecies(r), size = rollSize(sp, r);
    const g = new THREE.Group();
    const body = new THREE.Mesh(geos[sp.id].body, material), legs = new THREE.Mesh(geos[sp.id].legs, material);
    body.castShadow = legs.castShadow = true;
    g.add(body, legs);
    g.scale.setScalar((size / 100) * VISUAL);
    scene.add(g);
    // hermit crabs walk in from the edge of the sand instead of a hole
    const edge = sp.holes === false;
    const x = edge ? (r() < 0.5 ? BEACH.x0 : BEACH.x1) : hole.x, z = edge ? THREE.MathUtils.lerp(BEACH.water + 3, BEACH.back - 3, r()) : hole.z;
    const c = {
      sp, size, g, body, legs, x, z, state: edge ? 'wander' : 'emerge', t: 0, lit: 0,
      dir: r() * Math.PI * 2, turnIn: 1 + r() * 2, speed: 0, target: null, hole, heading: 0, calm: 0,
    };
    crabs.push(c);
    return c;
  }

  function nearestHole(c, from) {
    // prefer holes that aren't toward the kid
    let best = null, bestScore = Infinity;
    for (const h of holes) {
      const d = Math.hypot(h.x - c.x, h.z - c.z), toward = Math.hypot(h.x - from.x, h.z - from.z) < Math.hypot(c.x - from.x, c.z - from.z) ? 6 : 0;
      if (d + toward < bestScore) { bestScore = d + toward; best = h; }
    }
    return best;
  }

  /** kid: { x, z }, beam: { x, z, yaw, half, range } */
  function update(dt, time, kid, beam, maxCrabs) {
    // spawning
    const alive = crabs.filter(c => c.state !== 'gone').length;
    for (const h of holes) {
      h.timer -= dt;
      if (h.timer <= 0 && alive < maxCrabs && Math.hypot(h.x - kid.x, h.z - kid.z) > 5) {
        spawn(h);
        h.timer = THREE.MathUtils.lerp(...ROUND.emergeEvery, r()) * (3 + r() * 3);
      }
    }

    for (const c of crabs) {
      if (c.state === 'gone' || c.state === 'caught') continue;
      c.t += dt;
      const dk = Math.hypot(c.x - kid.x, c.z - kid.z);
      // in the flashlight beam?
      const bx = c.x - beam.x, bz = c.z - beam.z, bd = Math.hypot(bx, bz);
      let rel = Math.atan2(bx, bz) - beam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const inBeam = bd < beam.range && Math.abs(rel) < beam.half;
      c.lit = inBeam ? c.lit + dt : Math.max(0, c.lit - dt * 2);
      c.calm = Math.max(0, c.calm - dt);

      let vx = 0, vz = 0;
      switch (c.state) {
        case 'emerge':
          if (c.t > EMERGE_TIME) { c.state = 'wander'; c.t = 0; }
          break;
        case 'wander': {
          c.turnIn -= dt;
          if (c.turnIn <= 0) { c.dir += (r() - 0.5) * 2.4; c.turnIn = 0.8 + r() * 2; }
          vx = Math.sin(c.dir) * c.sp.wander; vz = Math.cos(c.dir) * c.sp.wander;
          if (c.lit > LIT_TIME && c.calm <= 0) { c.state = 'dazzled'; c.t = 0; }
          else if (dk < c.sp.scare) { c.state = 'flee'; c.t = 0; c.target = c.sp.holes === false ? null : nearestHole(c, kid); }
          break;
        }
        case 'dazzled':
          if (c.t > c.sp.dazzle) { c.state = 'flee'; c.t = 0; c.calm = 3; c.target = c.sp.holes === false ? null : nearestHole(c, kid); }
          break;
        case 'flee': {
          let tx, tz;
          if (c.target) { tx = c.target.x - c.x; tz = c.target.z - c.z; }
          else { tx = c.x - kid.x; tz = c.z - kid.z; }                   // hermit: just away
          const d = Math.hypot(tx, tz) || 1;
          vx = (tx / d) * c.sp.speed; vz = (tz / d) * c.sp.speed;
          if (c.target && d < 0.35) { c.state = 'dive'; c.t = 0; }
          if (!c.target && c.t > 3 && dk > c.sp.scare * 2) { c.state = 'wander'; c.t = 0; }
          break;
        }
        case 'dive':
          if (c.t > DIVE_TIME) { c.state = 'gone'; scene.remove(c.g); }
          break;
      }

      // move, stay on the sand
      c.x = THREE.MathUtils.clamp(c.x + vx * dt, BEACH.x0, BEACH.x1);
      c.z = THREE.MathUtils.clamp(c.z + vz * dt, BEACH.water + 1, BEACH.back);
      if (c.x <= BEACH.x0 || c.x >= BEACH.x1 || c.z <= BEACH.water + 1 || c.z >= BEACH.back) c.dir += Math.PI;
      const sp = Math.hypot(vx, vz);
      if (sp > 0.05) c.heading = Math.atan2(vx, vz);
      // sideways walk: body faces 90° from the direction of travel
      c.g.rotation.y = c.heading + Math.PI / 2;
      let y = heightAt(c.x, c.z);
      if (c.state === 'emerge') y -= (1 - c.t / EMERGE_TIME) * 0.4;
      if (c.state === 'dive') y -= (c.t / DIVE_TIME) * 0.5;
      c.g.position.set(c.x, y, c.z);
      // scuttle: legs flicker with speed, body bobs; frozen crabs tremble slightly
      const f = sp > 0.05 ? time * (10 + sp * 6) : 0;
      c.legs.rotation.z = Math.sin(f) * 0.18;
      c.legs.position.y = Math.abs(Math.sin(f)) * 0.04;
      c.body.position.y = c.state === 'dazzled' ? Math.sin(time * 40) * 0.01 : Math.abs(Math.sin(f * 0.5)) * 0.05;
    }
  }

  /** Try to grab a crab near point p (the kid's hands). Returns the crab or null. */
  function grab(p, reach, r2) {
    let best = null, bestD = reach;
    for (const c of crabs) {
      if (c.state === 'gone' || c.state === 'caught' || c.state === 'dive' || c.state === 'emerge') continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z) - (c.size / 100) * VISUAL * 0.4;
      if (d < bestD) { best = c; bestD = d; }
    }
    if (!best) return null;
    const chance = best.state === 'dazzled' ? 1 : best.state === 'wander' ? 0.9 : best.sp.grip;
    if (r2() > chance) { best.state = 'flee'; best.target = best.sp.holes === false ? null : nearestHole(best, p); return 'slip'; }
    best.state = 'caught';
    scene.remove(best.g);
    return best;
  }

  return { crabs, holes, update, grab, dispose: () => crabs.forEach(c => scene.remove(c.g)) };
}
