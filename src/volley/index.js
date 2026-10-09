// วอลเลย์บอลชายหาด — two a side on the sand with Tonkla, arcade style: run to the ring where the
// ball comes down and press as the second ring closes to dig it; the friend sets; press to jump and
// press again in the air to spike. A spike timed just right is a fireball that bowls the receiver
// over. First to seven. The game itself is sim.js; this file shows it.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createGame, JUMP } from './sim.js';
import { payout } from './pay.js';
import { COURT, MATCH, BALL, KIT } from './rules.js';
import { createGameUI } from '../shared/gameUI.js';
import { createKid } from '../town/kid/index.js';
import { KID_LOOK } from '../town/kid/model.js';
import { createPostFX } from '../world/postfx.js';
import { t } from '../shared/i18n.js';

// camera: from the side, the whole court in view; a tall phone screen looks from higher and follows the play
const CAM = { wide: { fov: 40, pitch: 0.16, look: 2.5, width: 15.6, pan: 0.12 }, tall: { fov: 50, pitch: 0.6, look: 1.3, width: 11.5, pan: 1 }, ease: 4, shake: 0.22 };
const CUE = { dig: 0.12, hit: 0.04, lead: 0.9, grow: 1.8, now: 0.11 };    // press this long before the ball arrives; the closing ring starts this early, this much wider; "now!" window
const STEP = 1 / 90;
const ROWS = { win: ['🏆', 'vbRowWin'], lose: ['💪', 'vbRowLose'], point: ['🏐', 'vbRowPoint'], super: ['🔥', 'vbRowSuper'], shutout: ['⭐', 'vbRowShutout'] };
let current = null;

/** Who wears what: the friend in the kid's shirt colour, the rivals in the colour furthest from it; everyone barefoot. */
function looksFor(players) {
  const mine = new THREE.Color(KID_LOOK.shirt || '#7fc4e8'), far = hex => { const c = new THREE.Color(hex); return Math.hypot(c.r - mine.r, c.g - mine.g, c.b - mine.b); };
  const rival = KIT.shirts.reduce((a, b) => (far(b) > far(a) ? b : a));
  return players.map(p => {
    if (p.human) return KID_LOOK;
    const base = p.team === 0 ? KIT.mate : KIT.rivals[p.n];
    return { ...base, shirt: p.team === 0 ? `#${mine.getHexString()}` : rival, shoe: base.skin, sock: base.skin };
  });
}

export function start(ctx) {
  const { renderer, input, audio } = ctx;
  const world = buildScene(), { scene } = world;
  const camera = new THREE.PerspectiveCamera(CAM.wide.fov, innerWidth / innerHeight, 0.3, 3000);
  const fx = createPostFX(renderer, scene, camera);
  let cam = CAM.wide, dist = 16;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    cam = camera.aspect < 1 ? CAM.tall : CAM.wide;
    camera.fov = cam.fov;
    dist = cam.width / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * camera.aspect);   // far enough back to see `width` metres of court
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const ui = createGameUI(ctx.root, { title: t('vbTitle'), how: t('vbHow'), keys: t('vbKeys'), audio });
  ctx.touch?.setAction('dash');
  audio?.ambience({ surf: 0.9, breeze: 0.6 });

  const st = { phase: 'intro', clock: 0, quit: false, shake: 0 };
  const views = [];
  const game = createGame({ on: {
    serve: p => { if (p.human && st.phase === 'play') ui.pop(t('vbServe')); },
    touch(p, kind, q) {
      views[p.id].kind = kind;
      audio?.play(kind === 'serve' ? 'kick' : 'thud');
      if (p.human && kind === 'dig' && q > 0.7) ui.pop(t('vbNice'), 'good');
    },
    spike(p, level) {
      views[p.id].kind = 'spike';
      audio?.play('kick'); audio?.play('whoosh');
      if (level === 2) { st.shake = CAM.shake; audio?.play('sting'); if (p.human) ui.pop(t('vbFire'), 'wow'); }
    },
    shank: p => { views[p.id].kind = 'dig'; audio?.play('thud'); },
    block: p => { audio?.play('thud'); if (p.human) ui.pop(t('vbBlock'), 'good'); },
    net: () => audio?.play('thud'),
    knock: p => { views[p.id].knocked = true; st.shake = CAM.shake; if (p.team === 1) ui.pop(t('vbKnock'), 'good'); },
    dive: () => audio?.play('whoosh'),
    point(team, why) {
      audio?.play('whistle');
      if (team === 0) audio?.play('cheer');
      ui.pop(t(team === 0 ? (why === 'out' ? 'vbOut' : 'vbPoint') : why === 'out' ? 'vbOutUs' : 'vbLost'), team === 0 ? 'wow' : 'bad');
    },
  } });
  const { players, ball, s, me } = game, looks = looksFor(players);
  for (const p of players) {
    const kid = createKid(scene, looks[p.id]);
    kid.mesh.rotation.order = 'YXZ';                                    // so a dive can pitch the body the way it faces
    views.push({ p, kid, x: p.x, z: p.z, yaw: p.yaw, speed: 0, kind: '', knocked: false });
  }

  ui.onStart = () => { st.phase = 'play'; if (s.server.human) ui.pop(t('vbServe')); };
  ui.onQuit = () => finish(true);
  ui.onBack = () => ctx.onExit({ game: 'volley', baht: payout(s, !st.quit).baht, catches: [], score: [...s.score] });
  function finish(quit = false) {
    if (st.phase === 'end') return;
    st.phase = 'end'; st.quit = quit;
    const pay = payout(s, !quit), [a, b] = s.score, prev = ctx.progress.get().best.volley;
    if (!quit) ui.pop(t(pay.kind === 'win' ? 'vbWin' : 'vbLose'), pay.kind === 'win' ? 'wow' : 'bad');
    const rows = pay.rows.map(r => ({ icon: ROWS[r.key][0], name: { th: t(ROWS[r.key][1]), en: t(ROWS[r.key][1]) }, count: r.count, detail: r.key === pay.kind ? `${a}–${b}` : '', baht: r.baht }));
    setTimeout(() => ui.results(rows, pay.baht, !prev || pay.baht > prev.baht), quit ? 300 : 1500);
  }

  /** After the walk cycle: arms for a dig, a set, a spike or a block; dives, falls, joy and gloom. */
  function pose(v) {
    const p = v.p, B = v.kid.bones, mesh = v.kid.mesh, arms = (lx, lz, rx = lx, rz = -lz, fore = -0.1) => { B.armL.rotation.set(lx, 0, lz); B.armR.rotation.set(rx, 0, rz); B.foreL.rotation.x = B.foreR.rotation.x = fore; };
    const over = s.phase === 'point' || s.phase === 'end', won = over && s.pointTo === p.team, near = Math.hypot(ball.x - p.x, ball.z - p.z) < 2.6;
    mesh.rotation.x = 0;
    if (p.down <= 0) v.knocked = false;
    if (p.dive > 0 || (p.down > 0 && !v.knocked)) {                     // flat out on the sand, arms stretched
      mesh.rotation.x = p.dive > 0 ? 1.15 : 1.4; mesh.position.y = p.dive > 0 ? 0.32 : 0.14;
      arms(-2.95, -0.1);
    } else if (p.down > 0) {                                            // bowled over by a fireball: on their back, seeing stars
      mesh.rotation.x = -1.4; mesh.position.y = 0.16;
      arms(-0.2, 1.3); B.eyes.scale.y = 0.12;
    } else if (p.air) {
      const mine = ball.lastTeam === p.team || ball.forPlayer === p;
      if (!mine) arms(-3.0, 0.16);                                      // a block: both hands high
      else if (p.hit > 0) { arms(-2.2, 0.3, -0.6, -0.1); B.spine.rotation.x = 0.4; }   // through the ball
      else { arms(-2.3, 0.3, -2.9, -0.5); B.foreR.rotation.x = -1.3; B.spine.rotation.x = -0.2; }   // arm cocked
    } else if (over) {
      if (won) { const hop = Math.abs(Math.sin(st.clock * 9 + p.id)); mesh.position.y = hop * 0.2; arms(0, 2.5 + hop * 0.3, 0, -2.5 - hop * 0.3, -0.2); }
      else { B.head.rotation.x = 0.45; B.spine.rotation.x = 0.15; }
    } else if (ball.held === p) arms(-1.3, -0.15, -0.3, -0.1, -0.5);     // about to serve
    else if (s.phase === 'toss' && s.server === p) arms(-2.4, 0.2, -2.9, -0.4, -0.8);
    else if (p.hit > 0 && v.kind === 'set') arms(-2.7, 0.25, -2.7, -0.25, -0.5);
    else if (p.hit > 0 && v.kind === 'serve') { arms(-1.0, 0.3, -0.8, -0.1); B.spine.rotation.x = 0.3; }
    else if (p.swing > 0 || p.hit > 0) { arms(-0.95, -0.38); B.spine.rotation.x = 0.35; }                  // forearms together
    else if (s.phase === 'rally' && s.next[p.team] === p && near && !p.human) {
      if (ball.lastTeam === p.team && p !== s.spiker[p.team]) arms(-2.6, 0.25, -2.6, -0.25, -0.7);         // hands up for the set
      else { arms(-0.95, -0.38); B.spine.rotation.x = 0.3; }
    } else if (s.phase === 'rally' && v.speed < 1.2) arms(-0.55, 0.12, -0.55, -0.12, -0.7);                 // ready
  }

  const look = new THREE.Vector3(0, CAM.wide.look, 0), axis = new THREE.Vector3();
  const WHITE = new THREE.Color('#ffffff'), GO = new THREE.Color('#7dff6a'), OUT = new THREE.Color('#ff5a4a'), MATE = new THREE.Color('#9ad8ff');
  const hist = [];
  let first = true;
  /** The rings on the sand: where the kid's ball comes down, and when to press. */
  function cue() {
    const P = s.plan, R = world.ring, T = world.timer, A = world.here;
    R.visible = T.visible = A.visible = false;
    world.you.position.set(me.x, me.y + 2.3 + Math.sin(st.clock * 5) * 0.06, me.z);
    world.you.visible = me.down <= 0 && me.dive <= 0;
    if (st.phase !== 'play') return;
    let at = null, when = 0, who = WHITE;
    if (s.phase === 'toss' && s.server === me) { at = me; when = s.hitAt; }
    else if (s.phase === 'rally' && P && P.side === 0 && !P.net && ball.lastTeam !== -1 && s.next[0]) {
      if (s.next[0] !== me) { at = ball.lastTeam === 0 ? P.set : P.dig; who = MATE; }                       // the friend's ball: just where it goes
      else if (ball.forPlayer === me && P.attack) { at = P.attack; when = me.air ? P.attack.t - CUE.hit : P.attack.t - JUMP.up; }
      else { at = P.dig; when = P.dig.t - CUE.dig; if (P.out && ball.lastTeam === 1) who = OUT; }
    }
    if (!at) return;
    R.visible = true;
    R.position.set(at.x, 0.03, at.z);
    R.material.color.copy(who);
    R.material.opacity = who === MATE ? 0.45 : 0.9;
    A.visible = who !== MATE;
    A.position.set(at.x, 0.75 + Math.abs(Math.sin(st.clock * 7)) * 0.25, at.z);
    A.material.color.copy(who);
    if (!when || who !== WHITE) return;
    const left = when - s.t;
    T.visible = left > -0.25;
    T.position.set(at.x, 0.035, at.z);
    T.scale.setScalar(1 + THREE.MathUtils.clamp(left / CUE.lead, 0, 1) * CUE.grow);
    T.material.color.copy(Math.abs(left) < CUE.now ? GO : WHITE);
    if (Math.abs(left) < CUE.now) { R.material.color.copy(GO); A.material.color.copy(GO); }
  }

  function update(dt) {
    st.clock += dt;
    if (st.phase === 'play') {
      const { f, r, mag } = input.axis(), len = Math.hypot(f, r) || 1, m = Math.min(1, mag / 0.7);
      const inp = { mx: (r / len) * m, mz: (-f / len) * m, act: input.down('Space') || !!input.jump };     // right = toward the net, up the screen = the far side
      for (let n = Math.max(1, Math.ceil(dt / STEP)), i = 0; i < n; i++) game.step(dt / n, inp);
      if (s.phase === 'end') finish();
    }
    for (const v of views) {
      const p = v.p, moved = Math.hypot(p.x - v.x, p.z - v.z), speed = dt > 0 ? moved / dt : 0;
      const turn = dt > 0 ? Math.atan2(Math.sin(p.yaw - v.yaw), Math.cos(p.yaw - v.yaw)) / dt : 0;
      v.kid.update(dt, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, speed, dist: moved, accel: dt > 0 ? (speed - v.speed) / dt : 0, turn, grounded: !p.air, vy: p.vy, groundAt: () => 0 });
      v.x = p.x; v.z = p.z; v.yaw = p.yaw; v.speed = speed;
      pose(v);
    }
    // the ball, its blob on the sand, and the tail of a fireball
    const bs = Math.hypot(ball.vx, ball.vy, ball.vz), hx = Math.hypot(ball.vx, ball.vz);
    world.ball.position.set(ball.x, ball.y, ball.z);
    if (hx > 0.05) world.ball.rotateOnWorldAxis(axis.set(ball.vz / hx, 0, -ball.vx / hx), (bs * dt) / BALL.r * 0.6);
    world.blob.position.set(ball.x, 0.03, ball.z);
    world.blob.scale.setScalar(1 / (1 + ball.y * 0.14));
    hist.unshift([ball.x, ball.y, ball.z]); hist.length = Math.min(hist.length, world.trail.length * 2);
    world.trail.forEach((m, i) => { const h = hist[(i + 1) * 2 - 1]; m.visible = !!(ball.fire && ball.live && h); if (m.visible) m.position.set(...h); });
    cue();

    // camera
    const P = s.plan, fxm = 0.55 * me.x + 0.45 * (P ? P.land.x : ball.x), lim = Math.max(0, COURT.half + 1.5 - cam.width / 2);
    const cx = THREE.MathUtils.clamp(fxm * cam.pan, -lim - 2, lim + 2), k = first ? 1 : 1 - Math.exp(-dt * CAM.ease);
    look.lerp(axis.set(cx, cam.look, 0), k);
    st.shake = Math.max(0, st.shake - dt * 0.9);
    const sh = st.shake * st.shake * 6;
    camera.position.set(look.x + Math.sin(st.clock * 71) * sh, look.y + Math.sin(cam.pitch) * dist + Math.cos(st.clock * 53) * sh, Math.cos(cam.pitch) * dist);
    camera.lookAt(look);
    first = false;
    world.update(st.clock, axis.set(look.x, 0, 0));
    fx.setFocus(look, 6);

    ui.bar(t('vbTo', { n: MATCH.to }), `${s.score[0]}–${s.score[1]}`, payout(s, st.phase === 'end' && !st.quit).baht, '🏐');
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
  return { update, render: dt => fx.render(dt), debug: { game, state: st, world, camera } };
}

export function stop() { current?.dispose(); current = null; }
