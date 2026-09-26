// บานาน่าโบ๊ท — hold on to the banana boat! The driver weaves and throws hook turns
// (announced by an arrow); lean the other way to keep the banana upright.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene, swellAt } from '../boats/scene.js';
import { createTow } from '../boats/tow.js';
import { createRiders } from '../boats/riders.js';
import { bananaGeometry } from '../boats/models.js';
import { ROUND } from './rules.js';
import { createGameUI } from '../shared/gameUI.js';
import { createPostFX } from '../world/postfx.js';
import { paintedMaterial } from '../world/materials.js';
import { rng } from '../core/rng.js';
import { t } from '../shared/i18n.js';

let current = null;

export function start(ctx) {
  const { renderer, input } = ctx;
  const r = rng(Date.now() & 0xffff);
  const world = buildScene(r);
  const { scene } = world;
  const tow = createTow(r);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 8000);
  const fx = createPostFX(renderer, scene, camera);
  let camBack = 9, camUp = 4.2;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 68 : 55; camBack = portrait ? 11 : 9; camUp = portrait ? 5.5 : 4.2;
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const banana = new THREE.Group();          // yaw + position
  const tilt = new THREE.Group();            // roll
  banana.add(tilt);
  const mesh = new THREE.Mesh(bananaGeometry(), paintedMaterial({ amp: 0.05, scale: 1 }));
  mesh.castShadow = true;
  tilt.add(mesh);
  scene.add(banana);
  const seats = [1.1, 0.05, -1.0, -2.05].map(z => ({ pos: new THREE.Vector3(0, 0.62, z), yaw: 0 }));
  const crew = createRiders(scene, tilt, seats, { straddle: true });

  const ui = createGameUI(ctx.root, { title: t('bananaTitle'), how: t('bananaHow'), keys: t('bananaKeys'), audio: ctx.audio });
  const arrow = document.createElement('div'); arrow.className = 'b-arrow';
  const meter = document.createElement('div'); meter.className = 'b-tilt'; meter.innerHTML = '<i></i><b></b>';
  document.getElementById('game-ui').append(arrow, meter);
  ctx.touch?.setAction('dash');
  ctx.audio?.ambience({ surf: 0.6, breeze: 1, engine: 0.8 });

  const s = { phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0, roll: 0, spin: 0, hearts: ROUND.hearts, down: 0, score: 0, hooks: 0, wasHook: false, spills: 0, wild: 0 };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  const baht = () => Math.round(s.score / ROUND.bahtPer);
  function result() { return { game: 'banana', baht: baht(), catches: [], score: Math.round(s.score) }; }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    arrow.textContent = '';
    const prev = ctx.progress.get().best.banana;
    const rows = [
      { icon: '🍌', name: { th: t('bananaRide'), en: t('bananaRide') }, count: Math.round(s.elapsed), detail: t('seconds', { n: Math.round(s.elapsed) }), baht: Math.round(s.elapsed * ROUND.points.upright / ROUND.bahtPer) },
      { icon: '↪️', name: { th: t('bananaHooks'), en: t('bananaHooks') }, count: s.hooks, detail: '', baht: Math.round(s.hooks * ROUND.points.hook / ROUND.bahtPer) },
    ];
    ui.results(rows, baht(), !prev || baht() > prev.baht);
  }

  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';
    if (playing) { s.elapsed += dt; s.time = Math.max(0, ROUND.time - s.elapsed); if (s.time <= 0) end(); }
    if (s.phase !== 'intro') tow.update(dt);
    const T = tow.tow, w = swellAt(T.x, T.z, s.clock);

    // balance: sideways pull + swell tip you; leaning (left/right) pushes back
    if (s.down <= 0) {
      const { r: lean } = playing ? input.axis() : { r: 0 };
      const rx = Math.cos(T.yaw), rz = -Math.sin(T.yaw);
      const wave = (w.gx * rx + w.gz * rz) * ROUND.wave + Math.sin(s.clock * 2.3) * 0.15;
      // lean: stick right = screen-right = local −x, so it pushes the roll negative
      const tip = Math.sign(s.roll) * Math.max(0, Math.abs(s.roll) - ROUND.tipAt) * ROUND.tipping;
      const acc = -T.lateral * ROUND.sway - wave - lean * ROUND.lean - ROUND.spring * s.roll + tip - ROUND.damping * s.spin;
      s.spin += acc * dt;
      s.roll += s.spin * dt;
      if (playing) {
        s.score += ROUND.points.upright * dt;
        if (Math.abs(s.roll) > ROUND.capsize * 0.7) s.wild += dt; else if (s.wild > 0.4) { s.score += ROUND.points.wild; ui.pop(t('bananaSaved'), 'good'); s.wild = 0; } else s.wild = 0;
      }
      if (Math.abs(s.roll) > ROUND.capsize && playing) capsize();
    } else {
      s.down -= dt;
      s.roll *= 0.9; s.spin = 0;
      if (s.down <= 0) { for (const rd of crew.riders) crew.reseat(rd); if (s.hearts <= 0) end(); }
    }
    // hook turns: warn, then reward surviving them
    const warnDir = tow.warning;
    arrow.textContent = warnDir ? (warnDir > 0 ? '⬅' : '➡') : '';
    arrow.classList.toggle('on', !!warnDir);
    if (tow.hooking && !s.wasHook) s.hookSpill = s.spills;
    if (!tow.hooking && s.wasHook && playing && s.spills === s.hookSpill) { s.hooks++; s.score += ROUND.points.hook; ui.pop(t('bananaHookOk'), 'wow'); }
    s.wasHook = tow.hooking;

    banana.position.set(T.x, w.h + 0.05, T.z);
    banana.rotation.set(-w.gz * 0.25, T.yaw, 0, 'YXZ');
    tilt.rotation.z = -s.roll;                 // roll toward local +x
    crew.update(dt, s.clock);
    world.update(s.clock, dt, tow, new THREE.Vector3(T.x + Math.sin(T.yaw) * 3, w.h + 1.1, T.z + Math.cos(T.yaw) * 3), camera.position);

    // chase camera behind the banana, looking toward the boat
    const fwdx = Math.sin(T.yaw), fwdz = Math.cos(T.yaw);
    const want = new THREE.Vector3(T.x - fwdx * camBack, camUp, T.z - fwdz * camBack);
    camera.position.lerp(want, 1 - Math.exp(-dt * (s.phase === 'intro' ? 2 : 5)));
    camera.lookAt(T.x + fwdx * 6, 1, T.z + fwdz * 6);
    fx.setFocus(banana.position, camUp);

    // tilt meter (red near the edges)
    const k = THREE.MathUtils.clamp(-s.roll / ROUND.capsize, -1, 1);   // screen-right positive
    meter.querySelector('i').style.left = `${50 + k * 48}%`;
    meter.classList.toggle('hot', Math.abs(k) > 0.7);
    meter.querySelector('b').textContent = '❤'.repeat(s.hearts);
    ui.bar(s.time, s.hooks, baht(), '↪️');
  }

  function capsize() {
    s.hearts--; s.spills++;
    s.down = ROUND.recover;
    const side = Math.sign(s.roll) || 1;
    const rx = Math.cos(tow.tow.yaw) * side, rz = -Math.sin(tow.tow.yaw) * side;
    for (const rd of crew.riders) crew.fall(rd, new THREE.Vector3(rx, 0, rz), 3 + Math.random() * 2);
    ctx.audio?.play('splash');
    ui.pop(t('bananaSpill'), 'bad');
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
  return { update, render: dt => fx.render(dt), debug: { state: s, tow } };
}

export function stop() { current?.dispose(); current = null; }
