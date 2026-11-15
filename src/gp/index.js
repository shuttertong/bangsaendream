// บางแสนโกคาร์ทกรังด์ปรีซ์ — a go-kart race on the real roads round Khao Sam Muk (loop.js), driven
// in the town itself (ctx.town: the hub's scene and camera; main.js keeps the world running round
// the kart). One lap against five bots, or with friends from a lobby (ctx.coop; bots fill the grid
// and the leader runs them). Steer with the stick or A/D; the kart accelerates by itself; pull back
// (S) to brake. start(ctx) → { update, render, town, focus }; stop() cleans up.
import * as THREE from 'three';
import { LOOP } from './loop.js';
import { buildTrack } from './track.js';
import { createRace, payFor } from './sim.js';
import { createGpNet } from './net.js';
import { buildKart } from './kart.js';
import { buildBarriers } from './barriers.js';
import { GP } from './rules.js';
import { createGameUI } from '../shared/gameUI.js';
import { createMinimap } from './minimap.js';
import { KID_LOOK } from '../town/kid/model.js';
import { lookOf } from '../shared/avatar.js';
import { t } from '../shared/i18n.js';

const ME = 0;
const BOT_LOOKS = [
  { skin: '#c68f66', shirt: '#f0b43a', hairStyle: 'spiky' }, { skin: '#e0b08a', shirt: '#e8958a', hairStyle: 'twin' }, { skin: '#b8835c', shirt: '#3a9a6a', hairStyle: 'short' },
  { skin: '#d9a57c', shirt: '#9a5a8a', hairStyle: 'ponytail' }, { skin: '#a8764f', shirt: '#f4f1e8', hairStyle: 'bob' },
];
let current = null;

export function start(ctx) {
  const T = ctx.town, co = ctx.coop, { input } = ctx, { scene, camera } = T;
  const track = buildTrack(LOOP, GP.track);
  { // the road's real width at every sample (the narrowest within a few metres, less a margin for the kart)
    const raw = Array.from({ length: track.n }, (_, i) => T.roadEdge(track.x[i], track.z[i]));
    for (let i = 0; i < track.n; i++) { let m = Infinity; for (let q = -3; q <= 3; q++) m = Math.min(m, raw[track.wrap(i + q)]); track.half[i] = Math.max(GP.track.minHalf, Math.min(GP.track.maxHalf, m - GP.track.margin)); }
  }
  const myId = co ? co.myId : ME, humans = co ? co.seats : [ME], leader = !co || co.role === 'leader';
  // the grid: bots in front, the players behind them (everyone has someone to chase)
  const nBots = Math.max(0, GP.grid - humans.length), entries = [];
  for (let i = 0; i < nBots; i++) entries.push({ id: -1 - i, kind: leader ? 'bot' : 'ghost', skill: GP.bot.skill[0] + (GP.bot.skill[1] - GP.bot.skill[0]) * (nBots > 1 ? i / (nBots - 1) : 1) });
  for (const id of humans) entries.push({ id, kind: id === myId ? 'human' : 'ghost' });
  const race = createRace(track, entries), me = race.karts.find(k => k.id === myId), bots = race.karts.filter(k => k.id < 0);
  const tgt = new Map(race.karts.filter(k => k.kind === 'ghost').map(k => [k.id, { prog: k.prog, d: k.d, v: 0 }]));   // where the network last put each ghost
  const net = createGpNet(co, {
    kart(id, prog, d, v, fin) { const g = tgt.get(id); if (g) Object.assign(g, { prog, d, v }); const k = race.karts.find(q => q.id === id); if (k && fin != null) k.fin = fin; },
    bot(i, prog, d, v, fin) { const g = tgt.get(-1 - i); if (g) Object.assign(g, { prog, d, v }); if (!leader && fin != null && bots[i]) bots[i].fin = fin; },
    gone(id) { const k = race.karts.find(q => q.id === id); if (k) tgt.get(id).v = 0; },
  });

  // ---------- karts and the start line, in the town's scene ----------
  const root = new THREE.Group();
  scene.add(root);
  const meshes = race.karts.map((k, i) => {
    const look = k.id === myId ? KID_LOOK : k.id < 0 ? BOT_LOOKS[(-1 - k.id) % BOT_LOOKS.length] : (co.info(k.id) ? lookOf(co.info(k.id).look) : BOT_LOOKS[i % BOT_LOOKS.length]);
    const m = buildKart(GP.colors[i % GP.colors.length], look);
    root.add(m);
    return m;
  });
  const s0 = track.at(0), lineYaw = Math.atan2(s0.tx, s0.tz), w = track.half[0] * 2 + 1;
  { // a chequered line across the road and a banner arch over it
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
    const g = cv.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#1a1a1a' : '#f4f1e8'; g.fillRect(x * 16, y * 16, 16, 16); }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv), polygonOffset: true, polygonOffsetFactor: -4 }));
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 128;
    const b = bc.getContext('2d');
    b.fillStyle = '#d8392f'; b.fillRect(0, 0, 1024, 128); b.fillStyle = '#f4f1e8'; b.textAlign = 'center'; b.font = '700 78px Kanit, Sarabun, sans-serif'; b.fillText('🏁 ' + t('gpBanner') + ' 🏁', 512, 90);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.8, 0.12), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(bc) }));
    banner.position.y = 4.3;
    const posts = [-1, 1].map(sd => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.7, 10), new THREE.MeshLambertMaterial({ color: '#d4d8dc' })); p.position.set(sd * (w / 2 + 0.6), 2.35, 0); p.castShadow = true; return p; });
    for (const tex of [line.material.map, banner.material.map]) tex.colorSpace = THREE.SRGBColorSpace;
    const gate = new THREE.Group();
    gate.add(line, banner, ...posts);
    gate.position.set(s0.x, T.ground(s0.x, s0.z) + 0.04, s0.z); gate.rotation.y = lineYaw;
    root.add(gate);
  }
  root.add(buildBarriers(track, T.ground));                              // concrete blocks and catch fences along the whole circuit, for the race only
  T.setRace(true);                                                       // hide the trucks and the kid on foot

  const ui = createGameUI(ctx.root, { game: 'gp', title: t('gpTitle'), how: t(co ? 'gpHowCoop' : 'gpHow'), keys: t('gpKeys'), audio: ctx.audio });
  const pill = document.createElement('div'); pill.className = 'g-pill gp-speed';
  document.querySelector('#game-ui .g-top')?.appendChild(pill);
  ctx.audio?.ambience({ breeze: 0.6, engine: 1 });
  const s = { phase: 'intro', count: 0, shown: 9, done: 0, place: GP.grid, camYaw: lineYaw, t: 0 };
  const minimap = createMinimap(ctx.root, track, GP.colors);             // the circuit and everyone on it, in the corner
  ui.onStart = () => { s.phase = 'count'; s.count = GP.start.count + 0.99; };
  ui.onQuit = () => finish(true);
  ui.onBack = () => ctx.onExit(result());
  if (co) { ui.begin(); ui.onStart = null; s.phase = 'count'; s.count = GP.start.count + 0.99; }      // a lobby race starts for everyone at once

  const baht = () => (s.quit || me.fin == null ? 0 : payFor(s.place, me.hits));
  const result = () => ({ game: 'gp', baht: baht(), catches: [], place: s.place });
  function finish(quit = false) {
    if (s.phase === 'end') return;
    s.phase = 'end'; s.quit = quit;
    net?.send(0, me, leader ? bots : [], true);
    const prev = ctx.progress.get().best.gp, m = Math.floor((me.fin || 0) / 60), sec = ((me.fin || 0) % 60).toFixed(1).padStart(4, '0');
    ui.results(quit || me.fin == null ? [] : [
      { icon: '🏁', name: { th: t('gpPlace', { n: s.place, of: race.karts.length }), en: t('gpPlace', { n: s.place, of: race.karts.length }) }, count: 1, detail: `${m}:${sec}`, baht: payFor(s.place, 99) },
      { icon: '🛞', name: { th: t('gpClean'), en: t('gpClean') }, count: me.hits <= GP.maxHits ? 1 : 0, detail: t('gpHits', { n: me.hits }), baht: me.hits <= GP.maxHits ? GP.clean : 0 },
    ], baht(), !prev || baht() > prev.baht);
  }

  const v = new THREE.Vector3(), look = new THREE.Vector3();
  function placeKart(k, m, dt) {
    const y = T.ground(k.x, k.z), fx = Math.sin(k.h), fz = Math.cos(k.h), ya = T.ground(k.x + fx * 0.7, k.z + fz * 0.7), yb = T.ground(k.x - fx * 0.7, k.z - fz * 0.7);
    m.position.set(k.x, y + 0.02, k.z);
    m.rotation.set(0, k.h, 0);
    m.userData.body.rotation.x = -Math.atan2(ya - yb, 1.4);
    m.userData.body.rotation.z += ((k.steer || 0) * Math.min(1, k.v / 14) * -0.07 - m.userData.body.rotation.z) * Math.min(1, dt * 8);
  }

  function update(dt) {
    s.t += dt;
    if (s.phase === 'count') {
      s.count -= dt;
      const n = Math.floor(s.count);
      if (n !== s.shown) { s.shown = n; if (n > 0) ui.pop(String(n)); else { ui.pop(t('gpGo'), 'wow'); s.phase = 'race'; } }
    }
    if (s.phase === 'race' || s.phase === 'flag') {
      const a = input.axis(), braking = a.f < -0.3 || input.down('Space');
      race.step(dt, { [myId]: { steer: -a.r, gas: braking ? 0 : 1, brake: braking ? 1 : 0 } });
      for (const k of race.karts) if (k.kind === 'ghost') { const g = tgt.get(k.id); if (k.fin == null) g.prog += g.v * dt; race.setGhost(k, g.prog, g.d, g.v, dt, GP.net.blend); }
      net?.send(dt, me, leader ? bots : []);
      if (me.bump > 0.58) { ctx.audio?.play('thud'); }
      if (s.phase === 'race') {
        s.place = race.place(myId);
        if (me.fin != null) { s.phase = 'flag'; s.done = 2.5; ui.pop(t('gpFlag', { n: s.place }), s.place <= 3 ? 'wow' : 'good'); net?.send(0, me, leader ? bots : [], true); }
      } else if ((s.done -= dt) <= 0) finish();
    }
    race.karts.forEach((k, i) => placeKart(k, meshes[i], dt));
    // chase camera: behind the kart, easing round with it; a slow circle of the grid before the start
    const yawTo = s.phase === 'intro' ? lineYaw + Math.PI + Math.sin(s.t * 0.3) * 0.9 : me.h, C = GP.cam;
    s.camYaw += Math.atan2(Math.sin(yawTo - s.camYaw), Math.cos(yawTo - s.camYaw)) * Math.min(1, dt * C.ease);
    const y = T.ground(me.x, me.z), back = s.phase === 'intro' ? C.back * 1.8 : C.back, portrait = camera.aspect < 1;
    v.set(me.x - Math.sin(s.camYaw) * back, y + C.up * (portrait ? 1.35 : 1), me.z - Math.cos(s.camYaw) * back);
    v.y = Math.max(v.y, T.ground(v.x, v.z) + 0.8);
    camera.position.lerp(v, s.t < 0.1 ? 1 : Math.min(1, dt * 10));
    look.set(me.x + Math.sin(me.h) * C.ahead, y + 0.7, me.z + Math.cos(me.h) * C.ahead);
    camera.lookAt(look);
    const fov = (portrait ? 8 : 0) + C.fov[0] + (C.fov[1] - C.fov[0]) * Math.min(1, me.v / GP.kart.top);
    if (Math.abs(fov - camera.fov) > 0.2) { camera.fov = fov; camera.updateProjectionMatrix(); }
    focus.set(me.x, y, me.z);
    minimap.update(race.karts, myId);
    if (s.phase !== 'intro' && s.phase !== 'end') {
      ui.bar(Math.max(0, race.state.time), `${s.place}/${race.karts.length}`, baht(), '🏁');
      pill.textContent = `${Math.round(me.v * 3.6)} km/h · ${Math.max(0, Math.min(100, Math.round(100 * me.prog / race.state.goal)))}%`;
    }
  }
  const focus = new THREE.Vector3(me.x, T.ground(me.x, me.z), me.z);

  current = {
    dispose() {
      net?.bye(); net?.close();
      ui.dispose(); minimap.dispose();
      scene.remove(root);
      root.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); });
      T.setRace(false);
    },
  };
  return { update, render: () => {}, town: true, focus, debug: { race, track, me, state: s } };
}

export function stop() { current?.dispose(); current = null; }
