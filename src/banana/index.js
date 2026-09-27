// บานาน่าโบ๊ท — hold on to the banana boat! The driver weaves and throws hook turns
// (announced by an arrow); lean the other way to keep the banana upright.
// Co-op (ctx.coop, up to 4 players): the leader's game runs the ride with everyone's lean
// averaged — lean together! — and the others replay its snapshots (banana/net.js).
// Each rider shows its player's lean; all share the hearts, the score and the payout.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene, swellAt } from '../boats/scene.js';
import { createTow } from '../boats/tow.js';
import { createRiders } from '../boats/riders.js';
import { bananaGeometry } from '../boats/models.js';
import { ROUND } from './rules.js';
import { createBananaNet, NET } from './net.js';
import { createGameUI } from '../shared/gameUI.js';
import { createPostFX } from '../world/postfx.js';
import { paintedMaterial } from '../world/materials.js';
import { lookOf } from '../shared/avatar.js';
import { rng } from '../core/rng.js';
import { t } from '../shared/i18n.js';

let current = null;

export function start(ctx) {
  const { renderer, input } = ctx, co = ctx.coop;
  const humans = co ? co.seats.slice(0, 4) : [];
  const mySeat = co ? Math.max(0, humans.indexOf(co.myId)) : 0;
  const r = rng(co ? co.seed : Date.now() & 0xffff);
  const world = buildScene(r);
  const { scene } = world;
  const tow = createTow(r);                  // members don't run it: it holds the leader's snapshot

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
  const looks = humans.map(id => { const inf = co.info(id); return inf ? lookOf(inf.look) : null; });
  const crew = createRiders(scene, tilt, seats, { straddle: true, looks });

  const ui = createGameUI(ctx.root, { title: t('bananaTitle'), how: t(co ? 'bananaHowCoop' : 'bananaHow'), keys: t('bananaKeys'), audio: ctx.audio });
  const arrow = document.createElement('div'); arrow.className = 'b-arrow';
  const meter = document.createElement('div'); meter.className = 'b-tilt'; meter.innerHTML = '<i></i><b></b>';
  const team = document.createElement('div'); team.className = 'b-team'; team.hidden = !co;
  document.getElementById('game-ui').append(arrow, meter, team);
  ctx.touch?.setAction('dash');
  ctx.audio?.ambience({ surf: 0.6, breeze: 1, engine: 0.8 });

  const s = {
    phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0, roll: 0, spin: 0, hearts: ROUND.hearts, down: 0, score: 0, hooks: 0,
    wasHook: false, spills: 0, wild: 0, warn: 0, hooking: false, leans: [0, 0, 0, 0], shown: [0, 0, 0, 0], together: 0, teamBonus: false, teams: 0,
  };
  let net = null, snap = null;
  net = createBananaNet(co, {
    input: (id, lean) => { const i = net.seatOf(id); if (i >= 0) s.leans[i] = lean; },
    state: st => { snap = st; },
    event: (e, d) => {
      if (e === 'spill') spill(d.side || 1);
      else if (e === 'up') reseat();
      else if (e === 'hook') ui.pop(t('bananaHookOk'), 'wow');
      else if (e === 'saved') ui.pop(t('bananaSaved'), 'good');
      else if (e === 'team') ui.pop(t('bananaTeam'), 'wow');
      else if (e === 'end') end();
    },
    gone: (id, wasLeader) => {
      const i = net.seatOf(id);
      if (i >= 0) s.leans[i] = 0;
      if (wasLeader && !net.leader && s.phase !== 'end') { ui.pop(t('bananaLeaderLeft'), 'bad'); end(); }
    },
  });
  const leader = !net || net.leader;
  if (!leader) ui.startLabel = t('coWaitLeader');
  ui.onStart = () => {
    if (!leader) return;                     // members start when the leader does
    s.phase = 'play';
    net?.event('start');
  };
  ui.onQuit = () => { net?.bye(); end(); };
  ui.onBack = () => ctx.onExit(result());

  const baht = () => Math.round(s.score / ROUND.bahtPer);
  function result() { return { game: 'banana', baht: baht(), catches: [], score: Math.round(s.score) }; }
  function end() {
    if (s.phase === 'end') return;
    if (leader) { net?.sendState(0, stateOut(), s.leans, 'end'); net?.event('end'); }
    s.phase = 'end';
    arrow.textContent = '';
    const prev = ctx.progress.get().best.banana;
    const rows = [
      { icon: '🍌', name: { th: t('bananaRide'), en: t('bananaRide') }, count: Math.round(s.elapsed), detail: t('seconds', { n: Math.round(s.elapsed) }), baht: Math.round(s.elapsed * ROUND.points.upright / ROUND.bahtPer) },
      { icon: '↪️', name: { th: t('bananaHooks'), en: t('bananaHooks') }, count: s.hooks, detail: '', baht: Math.round(s.hooks * ROUND.points.hook / ROUND.bahtPer) },
    ];
    if (co) rows.push({ icon: '👫', name: { th: t('bananaTeamRow'), en: t('bananaTeamRow') }, count: humans.length, detail: '', baht: 0 });
    ui.results(rows, baht(), !prev || baht() > prev.baht);
  }

  // everyone who's aboard falls in on the tipping side; they climb back after `recover`
  function spill(side) {
    const rx = Math.cos(tow.tow.yaw) * side, rz = -Math.sin(tow.tow.yaw) * side;
    for (const rd of crew.riders) crew.fall(rd, new THREE.Vector3(rx, 0, rz), 3 + Math.random() * 2);
    ctx.audio?.play('splash');
    ui.pop(t('bananaSpill'), 'bad');
  }
  function reseat() { for (const rd of crew.riders) crew.reseat(rd); }
  function capsize() {
    s.hearts--; s.spills++;
    s.down = ROUND.recover;
    const side = Math.sign(s.roll) || 1;
    spill(side);
    net?.event('spill', { side });
  }
  const stateOut = () => ({
    clock: s.clock, elapsed: s.elapsed, tx: tow.tow.x, tz: tow.tow.z, tyaw: tow.tow.yaw, lateral: tow.tow.lateral,
    bx: tow.boat.x, bz: tow.boat.z, byaw: tow.boat.yaw, bturn: tow.boat.turn, roll: s.roll, spin: s.spin, hearts: s.hearts,
    down: s.down, score: s.score, hooks: s.hooks, warn: tow.warning, hooking: tow.hooking ? 1 : 0,
  });

  /** Leader (and solo): run the ride. `lean` is the team's average. */
  function simulate(dt, playing, lean) {
    if (s.phase !== 'intro') tow.update(dt);
    const T = tow.tow, w = swellAt(T.x, T.z, s.clock);
    if (s.down <= 0) {
      const rx = Math.cos(T.yaw), rz = -Math.sin(T.yaw);
      const wave = (w.gx * rx + w.gz * rz) * ROUND.wave + Math.sin(s.clock * 2.3) * 0.15;
      // lean: stick right = screen-right = local −x, so it pushes the roll negative
      const tip = Math.sign(s.roll) * Math.max(0, Math.abs(s.roll) - ROUND.tipAt) * ROUND.tipping;
      const acc = -T.lateral * ROUND.sway - wave - lean * ROUND.lean - ROUND.spring * s.roll + tip - ROUND.damping * s.spin;
      s.spin += acc * dt;
      s.roll += s.spin * dt;
      if (playing) {
        s.score += ROUND.points.upright * dt;
        if (Math.abs(s.roll) > ROUND.capsize * 0.7) s.wild += dt;
        else if (s.wild > 0.4) { s.score += ROUND.points.wild; ui.pop(t('bananaSaved'), 'good'); net?.event('saved'); s.wild = 0; } else s.wild = 0;
      }
      if (Math.abs(s.roll) > ROUND.capsize && playing) capsize();
    } else {
      s.down -= dt;
      s.roll *= 0.9; s.spin = 0;
      if (s.down <= 0) { reseat(); net?.event('up'); if (s.hearts <= 0) end(); }
    }
    // hook turns: reward surviving them; a team bonus when everyone leaned together through one
    if (tow.hooking && !s.wasHook) { s.hookSpill = s.spills; s.teamBonus = false; s.together = 0; }
    if (tow.hooking && co && humans.length > 1) {
      const live = humans.map((id, i) => (net.isHere(id) ? s.leans[i] : null)).filter(v => v !== null);
      const same = live.length > 1 && live.every(v => Math.abs(v) > 0.5 && Math.sign(v) === Math.sign(live[0]));
      s.together = same ? s.together + dt : 0;
      if (s.together > 0.5 && !s.teamBonus && playing) { s.teamBonus = true; s.teams++; s.score += ROUND.points.team; ui.pop(t('bananaTeam'), 'wow'); net?.event('team'); }
    }
    if (!tow.hooking && s.wasHook && playing && s.spills === s.hookSpill) { s.hooks++; s.score += ROUND.points.hook; ui.pop(t('bananaHookOk'), 'wow'); net?.event('hook'); }
    s.wasHook = tow.hooking;
    s.warn = tow.warning; s.hooking = tow.hooking;
  }

  /** Member: ease into the leader's latest snapshot. */
  function follow(dt) {
    if (!snap) return;
    if (snap.phase === 'play' && s.phase === 'intro') { s.phase = 'play'; ui.begin(); }
    const k = 1 - Math.exp(-dt * NET.smooth), T = tow.tow, B = tow.boat;
    const ease = (o, key, v) => { o[key] += (v - o[key]) * k; };
    const easeYaw = (o, key, v) => { let d = v - o[key]; d = Math.atan2(Math.sin(d), Math.cos(d)); o[key] += d * k; };
    if (Math.hypot(snap.tx - T.x, snap.tz - T.z) > 20) { T.x = snap.tx; T.z = snap.tz; B.x = snap.bx; B.z = snap.bz; }   // first snapshot
    ease(T, 'x', snap.tx); ease(T, 'z', snap.tz); easeYaw(T, 'yaw', snap.tyaw); ease(T, 'lateral', snap.lateral);
    ease(B, 'x', snap.bx); ease(B, 'z', snap.bz); easeYaw(B, 'yaw', snap.byaw); ease(B, 'turn', snap.bturn);
    ease(s, 'roll', snap.roll);
    s.clock += (snap.clock - s.clock) * k;
    Object.assign(s, { spin: snap.spin, hearts: snap.hearts, down: snap.down, score: snap.score, hooks: snap.hooks, elapsed: snap.elapsed, warn: snap.warn, hooking: !!snap.hooking });
    s.time = Math.max(0, ROUND.time - s.elapsed);
    snap.leans.forEach((v, i) => { if (i !== mySeat) s.leans[i] = v; });
  }

  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';
    const { r: myLean } = playing && s.down <= 0 ? input.axis() : { r: 0 };
    s.leans[mySeat] = myLean;
    if (leader) {
      if (playing) { s.elapsed += dt; s.time = Math.max(0, ROUND.time - s.elapsed); if (s.time <= 0) end(); }
      const n = co ? humans.filter(id => net.isHere(id)).length || 1 : 1;
      const lean = co ? humans.reduce((a, id, i) => a + (net.isHere(id) ? s.leans[i] : 0), 0) / n : myLean;
      simulate(dt, playing, lean);
      net?.sendState(dt, stateOut(), s.leans, s.phase);
    } else {
      net.sendInput(dt, myLean);
      follow(dt);
    }

    arrow.textContent = s.warn ? (s.warn > 0 ? '⬅' : '➡') : '';
    arrow.classList.toggle('on', !!s.warn && s.phase !== 'end');
    const T = tow.tow, w = swellAt(T.x, T.z, s.clock);
    banana.position.set(T.x, w.h + 0.05, T.z);
    banana.rotation.set(-w.gz * 0.25, T.yaw, 0, 'YXZ');
    tilt.rotation.z = -s.roll;                 // roll toward local +x
    crew.riders.forEach((rd, i) => { s.shown[i] += (s.leans[i] - s.shown[i]) * Math.min(1, dt * 10); rd.lean = s.shown[i]; });
    crew.update(dt, s.clock);
    world.update(s.clock, dt, tow, new THREE.Vector3(T.x + Math.sin(T.yaw) * 3, w.h + 1.1, T.z + Math.cos(T.yaw) * 3), camera.position);

    // chase camera behind the banana, looking toward the boat
    const fwdx = Math.sin(T.yaw), fwdz = Math.cos(T.yaw);
    const want = new THREE.Vector3(T.x - fwdx * camBack, camUp, T.z - fwdz * camBack);
    camera.position.lerp(want, 1 - Math.exp(-dt * (s.phase === 'intro' ? 2 : 5)));
    camera.lookAt(T.x + fwdx * 6, 1, T.z + fwdz * 6);
    fx.setFocus(banana.position, camUp);

    // tilt meter (red near the edges), hearts, the team and how each one leans
    const k = THREE.MathUtils.clamp(-s.roll / ROUND.capsize, -1, 1);   // screen-right positive
    meter.querySelector('i').style.left = `${50 + k * 48}%`;
    meter.classList.toggle('hot', Math.abs(k) > 0.7);
    meter.querySelector('b').textContent = '❤'.repeat(Math.max(0, s.hearts));
    if (co) team.innerHTML = humans.map((id, i) => {
      const here = net.isHere(id), v = s.leans[i];
      return `<span class="${here ? '' : 'gone'}${id === co.myId ? ' me' : ''}">${v < -0.3 ? '◀' : v > 0.3 ? '▶' : '•'} ${co.info(id)?.name || '…'}</span>`;
    }).join('');
    ui.bar(s.time, s.hooks, baht(), '↪️');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      net?.close();
      ui.dispose();
      ctx.touch?.setAction('jump');
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, tow, crew, net } };
}

export function stop() { current?.dispose(); current = null; }
