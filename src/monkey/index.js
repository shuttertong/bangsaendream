// ลิงเขาสามมุข — guard the picnic snacks from the Khao Sam Muk macaques.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createMonkeys } from './monkeys.js';
import { createSnacks } from './snacks.js';
import { SNACKS, ROUND } from './species.js';
import { createGameUI } from '../shared/gameUI.js';
import { createKid } from '../town/kid/index.js';
import { createPostFX } from '../world/postfx.js';
import { paintedMaterial } from '../world/materials.js';
import { rng } from '../core/rng.js';
import { t } from '../shared/i18n.js';

const K = ROUND.kid;
let current = null;

export function start(ctx) {
  const { renderer, input } = ctx;
  const { scene } = buildScene();
  const r = rng(Date.now() & 0xffff);
  const mat = paintedMaterial({ amp: 0.12, scale: 0.4 });

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 4000);
  const fx = createPostFX(renderer, scene, camera);
  let camUp = 13, camBack = 11;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 62 : 50;
    camUp = portrait ? 19 : 13; camBack = portrait ? 12 : 11;   // phones: higher so the whole plaza fits
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const kid = createKid(scene);
  const snacks = createSnacks(scene, mat);
  const monkeys = createMonkeys(scene, mat, snacks, r);

  const ui = createGameUI(ctx.root, { title: t('monkeyTitle'), how: t('monkeyHow'), keys: t('monkeyKeys') });
  ctx.touch?.setAction('dash');

  const s = {
    phase: 'intro', clock: 0, wave: 0, spawned: 0, spawnIn: 1, breakIn: 1.5,
    x: 0, z: 2.5, yaw: Math.PI, vx: 0, vz: 0, prevSpeed: 0, prevYaw: Math.PI,
    dash: 0, cool: 0, wasAct: false, swing: 0, shooed: 0,
  };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  function result() {
    const catches = snacks.items.filter(it => it.state === 'mat').map(it => ({ id: it.sp.id, size: 0, price: it.sp.price }));
    const baht = catches.reduce((a, c) => a + c.price, 0) + s.shooed * ROUND.shooBonus;
    return { game: 'monkey', baht, catches, shooed: s.shooed };
  }
  function end(win = false) {
    if (s.phase === 'end') return;
    s.phase = 'end';
    ui.pop(win ? t('monkeyWin') : t('monkeyAllGone'), win ? 'wow' : 'bad');
    const res = result(), prev = ctx.progress.get().best.monkey;
    const rows = SNACKS.map(sp => {
      const n = res.catches.filter(c => c.id === sp.id).length;
      return n ? { icon: sp.icon, name: sp.name, count: n, detail: '', baht: n * sp.price } : null;
    }).filter(Boolean);
    if (s.shooed) rows.push({ icon: '🐒', name: { th: t('shooed'), en: t('shooed') }, count: s.shooed, detail: '', baht: s.shooed * ROUND.shooBonus });
    setTimeout(() => ui.results(rows, res.baht, !prev || res.baht > prev.baht), 800);
  }

  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';

    // waves
    if (playing) {
      const W = ROUND.waves[s.wave];
      if (s.breakIn > 0) {
        s.breakIn -= dt;
        if (s.breakIn <= 0) ui.pop(t('waveStart', { n: s.wave + 1 }), 'wow');
      } else if (s.spawned < W.count) {
        s.spawnIn -= dt;
        if (s.spawnIn <= 0) { monkeys.spawn(s.wave); s.spawned++; s.spawnIn = W.every * (0.7 + r() * 0.6); }
      } else if (monkeys.active() === 0) {
        if (s.wave + 1 >= ROUND.waves.length) end(true);
        else { s.wave++; s.spawned = 0; s.breakIn = ROUND.breakTime; }
      }
      if (snacks.count('mat') + snacks.count('ground') + snacks.count('carried') === 0) end(false);
    }

    // movement (screen-relative; camera looks toward the sea, −z)
    const { f, r: rr, mag } = playing ? input.axis() : { f: 0, r: 0, mag: 0 };
    const len = Math.hypot(f, rr) || 1;
    const wx = mag ? (rr / len) * K.walk * Math.min(1, mag / 0.6) : 0, wz = mag ? (-f / len) * K.walk * Math.min(1, mag / 0.6) : 0;
    const k = Math.min(1, 14 * dt);
    s.vx += (wx - s.vx) * k; s.vz += (wz - s.vz) * k;
    const act = playing && (input.down('Space') || input.jump);
    s.cool = Math.max(0, s.cool - dt);
    if (act && !s.wasAct && s.dash <= 0 && s.cool <= 0) {
      s.dash = K.dashTime; s.cool = K.cool + K.dashTime; s.swing = 1;
      // aim the dash at the nearest monkey in front-ish (forgiving on touch screens)
      let best = null, bd = 4;
      for (const m of monkeys.list) {
        if (m.state === 'gone' || m.state === 'scared') continue;
        const d = Math.hypot(m.x - s.x, m.z - s.z);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) s.yaw = Math.atan2(best.x - s.x, best.z - s.z);
      const n = monkeys.fright({ x: s.x, z: s.z });
      if (n) { s.shooed += n; ui.pop(t('monkeyShoo'), 'good'); }
    }
    s.wasAct = act;
    let mvx = s.vx, mvz = s.vz;
    if (s.dash > 0) {
      s.dash -= dt;
      mvx = Math.sin(s.yaw) * K.dash; mvz = Math.cos(s.yaw) * K.dash;
      const hx = s.x + Math.sin(s.yaw) * 0.6, hz = s.z + Math.cos(s.yaw) * 0.6;
      for (const m of monkeys.list) {
        if (m.state === 'gone' || m.state === 'scared' || Math.hypot(m.x - hx, m.z - hz) > K.reach * m.sp.size) continue;
        const res = monkeys.hit(m, { x: s.x, z: s.z });
        if (res === 'shoo') { s.shooed++; ui.pop(t('monkeyShoo'), 'good'); }
        else if (res === 'stagger') ui.pop(t('monkeyStagger'));
      }
    }
    const x0 = s.x, z0 = s.z;
    s.x += mvx * dt; s.z += mvz * dt;
    const d = Math.hypot(s.x, s.z), lim = ROUND.arena - 0.6;
    if (d > lim) { s.x *= lim / d; s.z *= lim / d; }
    if (snacks.pickup(s.x, s.z)) ui.pop(t('monkeyBack'), 'good');
    const moved = Math.hypot(s.x - x0, s.z - z0);
    if (Math.hypot(s.vx, s.vz) > 0.3 && s.dash <= 0) s.yaw = turn(s.yaw, Math.atan2(s.vx, s.vz), dt * 12);

    const speed = dt > 0 ? moved / dt : 0;
    let tr8 = s.yaw - s.prevYaw; tr8 = Math.atan2(Math.sin(tr8), Math.cos(tr8)) / (dt || 1);
    kid.update(dt, { x: s.x, y: 0, z: s.z, yaw: s.yaw, speed, dist: moved, accel: (speed - s.prevSpeed) / (dt || 1), turn: tr8, grounded: true, vy: 0, groundAt: () => 0 });
    s.prevSpeed = speed; s.prevYaw = s.yaw;
    // swat: the right arm swings across during a dash
    s.swing = Math.max(0, s.swing - dt * 4);
    if (s.swing > 0) kid.bones.armR.rotation.set(-1.6 * s.swing, 0, -0.6 * s.swing);

    const stolenBefore = snacks.count('lost');
    monkeys.update(dt, s.clock, { x: s.x, z: s.z });
    if (snacks.count('lost') > stolenBefore) ui.pop(t('monkeyStole'), 'bad');

    // camera: overhead-ish, drifting a little toward the kid
    const tgt = new THREE.Vector3(s.x * 0.35, 0, s.z * 0.35 - 1);
    camera.position.lerp(new THREE.Vector3(tgt.x, camUp, tgt.z + camBack), 1 - Math.exp(-dt * 4));
    camera.lookAt(tgt);
    fx.setFocus(tgt, 10);

    const W = ROUND.waves.length;
    ui.bar(t('wave', { n: Math.min(s.wave + 1, W), of: W }), s.shooed, result().baht, '🐒');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      ui.dispose();
      ctx.touch?.setAction('jump');
      monkeys.dispose(); snacks.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, monkeys, snacks } };
}

export function stop() { current?.dispose(); current = null; }

function turn(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * Math.min(1, k);
}
