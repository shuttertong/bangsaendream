// เจ็ทสกี — ride Tom's jet ski through a buoy slalom off Bang Saen. Steer through the
// orange gate, fish floating bottles out of the sea, catch air off the swell, and don't
// hit the net floats or the moored longtails (you'll fly off).
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene, swellAt } from '../boats/scene.js';
import { createRiders } from '../boats/riders.js';
import { jetskiGeometry } from '../boats/models.js';
import { createCourse } from './course.js';
import { RIDE, SCORE } from './rules.js';
import { createGameUI } from '../shared/gameUI.js';
import { createPostFX } from '../world/postfx.js';
import { paintedMaterial } from '../world/materials.js';
import { rng } from '../core/rng.js';
import { t } from '../shared/i18n.js';

const GRAVITY = 9.8;
let current = null;

export function start(ctx) {
  const { renderer, input } = ctx;
  const r = rng(Date.now() & 0xffff);
  const world = buildScene(r, { tow: false });
  const { scene } = world;
  const course = createCourse(scene, r);

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 8000);
  const fx = createPostFX(renderer, scene, camera);
  let camBack = 7.5, camUp = 3.2;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 70 : 58; camBack = portrait ? 9 : 7.5; camUp = portrait ? 4 : 3.2;
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const ski = new THREE.Group(), body = new THREE.Group();
  ski.add(body);
  const mesh = new THREE.Mesh(jetskiGeometry(), paintedMaterial({ amp: 0.05, scale: 1 }));
  mesh.castShadow = true;
  body.add(mesh);
  scene.add(ski);
  const crew = createRiders(scene, body, [{ pos: new THREE.Vector3(0, 0.5, -0.3), yaw: 0 }], { straddle: true });
  const kid = crew.riders[0];

  const ui = createGameUI(ctx.root, { title: t('jetskiTitle'), how: t('jetskiHow'), keys: t('jetskiKeys'), audio: ctx.audio });
  const guide = document.createElement('div'); guide.className = 'j-guide'; guide.innerHTML = '<i>⬆</i><b></b>';
  const meter = document.createElement('div'); meter.className = 'g-stamina'; meter.innerHTML = '<i></i>';
  document.getElementById('game-ui').append(guide, meter);
  ctx.touch?.setAction('dash');
  ctx.audio?.ambience({ surf: 0.5, breeze: 1, engine: 1 });

  const s = {
    phase: 'intro', time: RIDE.time, elapsed: 0, clock: 0,
    x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, y: 0, vy: 0, air: false, airT: 0, lastH: 0,
    boost: 1, boosting: 0, down: 0, bump: 0, lean: 0, camYaw: 0,
    score: 0, combo: 0, best: 0, gates: 0, missed: 0, bottles: 0, jumps: 0, crashes: 0,
  };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  const baht = () => Math.round(s.score / SCORE.bahtPer);
  function result() { return { game: 'jetski', baht: baht(), catches: [], score: Math.round(s.score) }; }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    guide.classList.remove('on');
    const prev = ctx.progress.get().best.jetski, rows = [
      { icon: '🚩', name: { th: t('jetskiGates'), en: t('jetskiGates') }, count: s.gates, detail: t('jetskiBestCombo', { n: s.best }), baht: 0 },
      { icon: '🧴', name: { th: t('jetskiBottles'), en: t('jetskiBottles') }, count: s.bottles, detail: '', baht: Math.round(s.bottles * SCORE.trash / SCORE.bahtPer) },
      { icon: '🌊', name: { th: t('jetskiJumps'), en: t('jetskiJumps') }, count: s.jumps, detail: '', baht: Math.round(s.jumps * SCORE.air / SCORE.bahtPer) },
    ];
    rows[0].baht = Math.max(0, baht() - rows[1].baht - rows[2].baht);
    ui.results(rows, baht(), !prev || baht() > prev.baht);
  }

  function crash(dir) {
    s.down = RIDE.crash.recover; s.combo = 0; s.crashes++; s.boosting = 0;
    crew.fall(kid, new THREE.Vector3(dir.x, 0, dir.z), 4 + Math.min(4, s.speed * 0.25));
    s.speed *= 0.2;
    ctx.audio?.play('splash');
    ui.pop(t('jetskiCrash'), 'bad');
  }

  const p0 = { x: 0, z: 0 };
  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';
    if (playing) { s.elapsed += dt; s.time = Math.max(0, RIDE.time - s.elapsed); if (s.time <= 0) end(); }
    const riding = playing && s.down <= 0;
    const { f, r: steer } = riding ? input.axis() : { f: 0, r: 0 };
    const act = riding && (input.down('Space') || input.jump);

    // throttle, brake and turbo
    if (act && s.boost > 0 && !s.boosting) { s.boosting = RIDE.boost.time * s.boost; s.boost = 0; ctx.audio?.play('whoosh'); ui.pop(t('jetskiBoost'), 'good'); }
    if (s.boosting > 0) s.boosting = Math.max(0, s.boosting - dt);
    const target = !riding ? 0 : s.boosting > 0 ? RIDE.boostTop : f >= 0 ? RIDE.cruise + f * (RIDE.top - RIDE.cruise) : RIDE.cruise * (1 + f);
    const a = s.boosting > 0 ? RIDE.boostAccel : target > s.speed ? RIDE.accel : RIDE.brake;
    s.speed += THREE.MathUtils.clamp(target - s.speed, -a * dt, a * dt);
    if (s.down > 0) {
      s.down -= dt;
      if (s.down <= 0) {
        crew.reseat(kid); ctx.audio?.play('thud');
        for (let i = 0; i < 12; i++) {                         // climb back on with some clear water around
          const h = course.hit(s.x, s.z, RIDE.radius + 1.5);
          if (!h) break;
          s.x += h.nx * 0.5; s.z += h.nz * 0.5;
        }
      }
    }

    // steering (right = screen-right = lower yaw), then the velocity swings round with some drift
    const turnRate = RIDE.turn * (1 - 0.3 * s.speed / RIDE.boostTop) * Math.min(1, s.speed / 3 + 0.35);
    s.yaw -= steer * turnRate * dt;
    const hx = Math.sin(s.yaw), hz = Math.cos(s.yaw), k = 1 - Math.exp(-RIDE.grip * dt);
    s.vx += (hx * s.speed - s.vx) * k; s.vz += (hz * s.speed - s.vz) * k;
    p0.x = s.x; p0.z = s.z;
    s.x += s.vx * dt; s.z += s.vz * dt;

    // obstacles: hit one head-on and you fly off; otherwise scrape along it
    const h = course.hit(s.x, s.z, RIDE.radius);
    s.bump = Math.max(0, s.bump - dt);
    if (h) {
      s.x += h.nx * h.depth; s.z += h.nz * h.depth;
      const into = -(s.vx * h.nx + s.vz * h.nz);                  // speed toward the obstacle
      if (into > 0) {
        if (s.down <= 0 && into > RIDE.crash.speed) crash({ x: hx, z: hz });
        else {
          s.vx += h.nx * into; s.vz += h.nz * into;               // slide along it
          s.speed = Math.max(0, s.speed - into);                  // scrub off the head-on part only
          if (!s.bump && s.down <= 0) { s.bump = 0.5; ctx.audio?.play('thud'); }
        }
      }
    }

    // ride the swell; fast over a crest the ski leaves the water
    const w = swellAt(s.x, s.z, s.clock);
    if (!s.air) {
      const vyWater = (w.h - s.lastH) / (dt || 1 / 60);
      if (s.vy > vyWater + 0.8 && s.speed > RIDE.cruise) { s.air = true; s.airT = 0; }
      else { s.y = w.h; s.vy = vyWater; }
    }
    if (s.air) {
      s.vy -= GRAVITY * dt; s.y += s.vy * dt; s.airT += dt;
      if (s.y <= w.h) {
        s.air = false; s.y = w.h;
        if (s.airT > RIDE.air && playing && s.down <= 0) { s.jumps++; s.score += SCORE.air; ui.pop(t('jetskiAir'), 'wow'); }
        ctx.audio?.play('thud');
      }
    }
    s.lastH = w.h;

    // gates and bottles
    if (playing) {
      const res = course.check(p0, s);
      if (res === 'pass') {
        s.combo++; s.gates++; s.best = Math.max(s.best, s.combo);
        s.score += SCORE.gate * Math.min(SCORE.maxMult, 1 + (s.combo - 1) * SCORE.combo);
        s.boost = Math.min(1, s.boost + RIDE.boost.refill);
        ctx.audio?.play('coin');
        ui.pop(s.combo > 1 ? `${t('jetskiGate')} ×${s.combo}` : t('jetskiGate'), 'good');
      } else if (res === 'miss') { s.combo = 0; s.missed++; ui.pop(t('jetskiMiss'), 'bad'); }
      const got = s.down <= 0 ? course.collect(s.x, s.z, 1.7) : 0;
      if (got) { s.bottles += got; s.score += got * SCORE.trash; ctx.audio?.play('catch'); ui.pop(t('jetskiBottle'), 'good'); }
    }
    course.update(s.clock);

    // the ski: pitch with the swell and throttle, lean into turns
    s.lean = THREE.MathUtils.lerp(s.lean, steer * Math.min(1, s.speed / RIDE.top) * 0.4, 1 - Math.exp(-dt * 6));
    ski.position.set(s.x, s.y, s.z);
    ski.rotation.set(0, s.yaw, 0);
    const slope = w.gx * hx + w.gz * hz;
    body.rotation.set(s.air ? -s.vy * 0.05 : -slope * 0.6 - (s.boosting > 0 ? 0.08 : 0.03) * Math.min(1, s.speed / 8), 0, s.lean, 'YXZ');
    crew.update(dt, s.clock);
    world.update(s.clock, dt, null, null, camera.position, { x: s.x - hx * 1.4, z: s.z - hz * 1.4, yaw: s.yaw, strength: Math.min(1, s.speed / RIDE.cruise) });

    // chase camera; lags a little behind the turn so the ski swings on screen
    let dy = s.yaw - s.camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.camYaw += dy * (1 - Math.exp(-dt * 3.5));
    const cx = Math.sin(s.camYaw), cz = Math.cos(s.camYaw);
    const back = camBack + s.speed * 0.08;
    camera.position.lerp(new THREE.Vector3(s.x - cx * back, s.y * 0.5 + camUp, s.z - cz * back), 1 - Math.exp(-dt * (s.phase === 'intro' ? 2 : 6)));
    camera.lookAt(s.x + cx * 6, 0.9 + s.y * 0.4, s.z + cz * 6);
    fx.setFocus(ski.position, camUp);

    // guide arrow toward the next gate (relative to the camera), boost meter
    const g = course.next();
    guide.classList.toggle('on', playing && !!g);
    if (g) {
      let rel = Math.atan2(g.x - s.x, g.z - s.z) - s.camYaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      guide.querySelector('i').style.transform = `rotate(${-rel}rad)`;
      guide.querySelector('b').textContent = t('metres', { n: Math.round(Math.hypot(g.x - s.x, g.z - s.z)) });
    }
    meter.querySelector('i').style.width = `${(s.boosting > 0 ? s.boosting / RIDE.boost.time : s.boost) * 100}%`;
    meter.classList.toggle('low', s.boost < 0.34 && !s.boosting);
    ui.bar(s.time, s.gates, baht(), '🚩');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      ui.dispose();
      ctx.touch?.setAction('jump');
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, course, camera } };
}

export function stop() { current?.dispose(); current = null; }
