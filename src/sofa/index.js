// โซฟาโบ๊ท — the sofa boat launches off the speedboat's wake; press "hold on!" as it
// lands (the shrinking ring shows when). Perfect timing builds a combo; a miss sends a
// friend flying — and when only the kid is left, the next miss ends the ride.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene, swellAt } from '../boats/scene.js';
import { createTow } from '../boats/tow.js';
import { createRiders } from '../boats/riders.js';
import { sofaGeometry } from '../boats/models.js';
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
  const tow = createTow(r, { hook: { rate: 0.7, time: 1.0, warn: 1.0, every: [7, 12] } });

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 8000);
  const fx = createPostFX(renderer, scene, camera);
  let camBack = 8, camUp = 3.4;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 68 : 55; camBack = portrait ? 10 : 8; camUp = portrait ? 4.5 : 3.4;
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const sofa = new THREE.Group(), body = new THREE.Group();
  sofa.add(body);
  const mesh = new THREE.Mesh(sofaGeometry(), paintedMaterial({ amp: 0.05, scale: 1 }));
  mesh.castShadow = true;
  body.add(mesh);
  scene.add(sofa);
  // riders sit in a row against the backrest, facing back toward the camera
  const seats = [-0.36, 0.36, -0.95, 0.95].map(x => ({ pos: new THREE.Vector3(x, 0.32, 0.55 - Math.abs(x) * 0.25), yaw: Math.PI }));
  const crew = createRiders(scene, body, seats);

  const ui = createGameUI(ctx.root, { title: t('sofaTitle'), how: t('sofaHow'), keys: t('sofaKeys'), audio: ctx.audio });
  const ring = document.createElement('div'); ring.className = 's-ring'; ring.innerHTML = '<i></i><b></b>';
  document.getElementById('game-ui').append(ring);
  ctx.touch?.setAction('dash');
  ctx.audio?.ambience({ surf: 0.6, breeze: 1, engine: 0.8 });

  const s = { phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0, y: 0, vy: 0, air: false, next: 2, land: 0, judged: false, wasAct: false, combo: 0, best: 0, score: 0, perfect: 0, good: 0, spin: 0 };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  const baht = () => Math.round(s.score / ROUND.bahtPer);
  function result() { return { game: 'sofa', baht: baht(), catches: [], score: Math.round(s.score) }; }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    ring.classList.remove('on');
    const prev = ctx.progress.get().best.sofa;
    const rows = [
      { icon: '🎯', name: { th: t('sofaPerfect'), en: t('sofaPerfect') }, count: s.perfect, detail: '', baht: Math.round(s.perfect * ROUND.points.perfect / ROUND.bahtPer) },
      { icon: '👍', name: { th: t('sofaGood'), en: t('sofaGood') }, count: s.good, detail: '', baht: Math.round(s.good * ROUND.points.good / ROUND.bahtPer) },
      { icon: '🔥', name: { th: t('sofaCombo'), en: t('sofaCombo') }, count: s.best, detail: '', baht: Math.max(0, baht() - Math.round((s.perfect * ROUND.points.perfect + s.good * ROUND.points.good) / ROUND.bahtPer)) },
    ];
    ui.results(rows, baht(), !prev || baht() > prev.baht);
  }

  function judge(dtLand) {
    s.judged = true;
    const a = Math.abs(dtLand), mult = Math.min(ROUND.maxMult, 1 + s.combo * ROUND.combo);
    if (a <= ROUND.perfect) { s.combo++; s.perfect++; s.score += ROUND.points.perfect * mult; ui.pop(`${t('sofaPerfect')}${s.combo > 1 ? ` ×${s.combo}` : ''}`, 'wow'); }
    else if (a <= ROUND.good) { s.combo++; s.good++; s.score += ROUND.points.good * mult; ui.pop(t('sofaGood'), 'good'); }
    else miss();
    s.best = Math.max(s.best, s.combo);
  }
  function miss() {
    s.judged = true; s.combo = 0;
    const onboard = crew.onBoard();
    const T = tow.tow, rx = Math.cos(T.yaw), rz = -Math.sin(T.yaw);
    const flyer = onboard.find(rd => !rd.kid) || onboard[0];
    if (flyer) {
      const side = flyer.seat.pos.x > 0 ? -1 : 1;
      crew.fall(flyer, new THREE.Vector3(rx * side - Math.sin(T.yaw) * 0.5, 0, rz * side - Math.cos(T.yaw) * 0.5), 5);
      ctx.audio?.play('splash');
      ui.pop(flyer.kid ? t('sofaKidOff') : t('sofaFriendOff'), 'bad');
      if (flyer.kid) setTimeout(() => end(), 1200);
    }
  }

  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';
    if (playing) { s.elapsed += dt; s.time = Math.max(0, ROUND.time - s.elapsed); if (s.time <= 0) end(); }
    if (s.phase !== 'intro') tow.update(dt);
    const T = tow.tow, w = swellAt(T.x, T.z, s.clock);
    const act = playing && (input.down('Space') || input.jump);
    const press = act && !s.wasAct;
    s.wasAct = act;

    // wake jumps: launch, fly, land; judge the press nearest the landing
    if (playing && !s.air) {
      s.next -= dt;
      if (s.next <= 0) {
        const k = s.elapsed / ROUND.time, h = THREE.MathUtils.lerp(...ROUND.height, k) * (0.8 + r() * 0.4) * (tow.hooking ? 1.3 : 1);
        s.vy = Math.sqrt(2 * ROUND.gravity * h);
        s.air = true; s.judged = false;
        s.flight = (2 * s.vy) / ROUND.gravity; s.land = s.flight; s.landedAt = 0;
        ctx.audio?.play('whoosh');
      }
    }
    if (s.air) {
      s.land -= dt;
      s.vy -= ROUND.gravity * dt;
      s.y += s.vy * dt;
      // the first press after take-off is the one that counts (no mashing)
      if (press && !s.judged) judge(-s.land);
      if (s.y <= 0) {
        s.y = 0; s.air = false; s.next = THREE.MathUtils.lerp(...ROUND.gap, r());
        ctx.audio?.play('thud');
        s.landedAt = s.clock;
      }
    } else if (playing && s.landedAt && !s.judged) {
      // allow a slightly late press just after landing
      const late = s.clock - s.landedAt;
      if (press) judge(late);
      else if (late > ROUND.good) miss();
    }

    s.spin += (T.lateral * 0.02 + (s.air ? 1.2 : 0.2)) * dt;
    sofa.position.set(T.x, w.h + s.y, T.z);
    sofa.rotation.set(0, T.yaw, 0);
    body.rotation.set(-w.gz * 0.3 + (s.air ? -s.vy * 0.04 : 0), Math.sin(s.spin) * 0.35, w.gx * 0.3 - T.lateral * 0.015);
    crew.update(dt, s.clock);
    world.update(s.clock, dt, tow, new THREE.Vector3(T.x + Math.sin(T.yaw) * 1.6, sofa.position.y + 0.8, T.z + Math.cos(T.yaw) * 1.6), camera.position);

    const fwdx = Math.sin(T.yaw), fwdz = Math.cos(T.yaw);
    camera.position.lerp(new THREE.Vector3(T.x - fwdx * camBack, camUp + s.y * 0.4, T.z - fwdz * camBack), 1 - Math.exp(-dt * (s.phase === 'intro' ? 2 : 5)));
    camera.lookAt(T.x + fwdx * 4, 0.8 + s.y * 0.6, T.z + fwdz * 4);
    fx.setFocus(sofa.position, camUp);

    // timing ring over the sofa: shrinks onto the inner circle at the landing
    const show = s.air && !s.judged && playing;
    ring.classList.toggle('on', show);
    if (show) {
      const v = sofa.position.clone().setY(sofa.position.y + 2.5).project(camera);   // above the riders' heads
      ring.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      ring.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      const k = Math.max(0, s.land / s.flight);
      ring.querySelector('i').style.transform = `translate(-50%, -50%) scale(${1 + k * 2})`;
      ring.classList.toggle('now', Math.abs(s.land) < ROUND.perfect);
    }
    ui.bar(s.time, s.combo, baht(), '🔥');
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
  return { update, render: dt => fx.render(dt), debug: { state: s, tow, crew } };
}

export function stop() { current?.dispose(); current = null; }
