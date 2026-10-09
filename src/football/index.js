// ฟุตบอลชายหาด — three a side on the sand with Tonkla: the kid, a friend and a keeper against
// the kids from the next beach. Run with the stick; the button passes (tap) or shoots (hold and let
// go), and lunges for the ball when you don't have it. Most goals when the time is up wins.
// The match itself is sim.js; this file shows it. start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createMatch } from './sim.js';
import { payout } from './pay.js';
import { PITCH, KIT } from './rules.js';
import { createGameUI } from '../shared/gameUI.js';
import { createKid } from '../town/kid/index.js';
import { KID_LOOK } from '../town/kid/model.js';
import { createPostFX } from '../world/postfx.js';
import { t } from '../shared/i18n.js';

const { L, W } = PITCH;
// camera: behind the kid's own goal, looking up the pitch (a tall phone screen looks from higher)
const CAM = { wide: { fov: 44, up: 9.2, back: 12.5, ahead: 2.2, pan: 0.7 }, tall: { fov: 58, up: 13.5, back: 15, ahead: 1.2, pan: 0.92 }, ease: 3.5 };
const STEP = 1 / 90;                                                    // longest step of the match clock (a fast ball must not skip past a player)
const ROWS = { win: ['🏆', 'fbRowWin'], draw: ['🤝', 'fbRowDraw'], lose: ['💪', 'fbRowLose'], goal: ['⚽', 'fbRowGoal'], mine: ['⭐', 'fbRowMine'], cleanSheet: ['🧤', 'fbRowClean'] };
let current = null;

/** Who wears what: the friend in the kid's shirt colour, the rivals in the colour furthest from it. */
function looksFor(players) {
  const mine = new THREE.Color(KID_LOOK.shirt || '#7fc4e8'), far = hex => { const c = new THREE.Color(hex); return Math.hypot(c.r - mine.r, c.g - mine.g, c.b - mine.b); };
  const rival = KIT.shirts.reduce((a, b) => (far(b) > far(a) ? b : a));
  const bare = look => ({ ...look, shoe: look.skin, sock: look.skin });
  return players.map(p => {
    if (p.human) return KID_LOOK;
    const list = p.team === 0 ? KIT.mates : KIT.rivals, base = list[(p.role === 'gk' ? list.length - 1 : p.n) % list.length];
    return bare({ ...base, shirt: p.role === 'gk' ? KIT.keeper[p.team] : p.team === 0 ? `#${mine.getHexString()}` : rival, ...(p.role === 'gk' ? { sleeves: 'long' } : {}) });
  });
}

export function start(ctx) {
  const { renderer, input, audio } = ctx;
  const world = buildScene(), { scene } = world;
  const camera = new THREE.PerspectiveCamera(CAM.wide.fov, innerWidth / innerHeight, 0.3, 3000);
  const fx = createPostFX(renderer, scene, camera);
  let cam = CAM.wide;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    cam = camera.aspect < 1 ? CAM.tall : CAM.wide;
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const ui = createGameUI(ctx.root, { title: t('fbTitle'), how: t('fbHow'), keys: t('fbKeys'), audio });
  ctx.touch?.setAction('kick');
  audio?.ambience({ surf: 0.9, breeze: 0.6 });

  const st = { phase: 'intro', clock: 0, quit: false };
  const match = createMatch({ on: {
    kick: (p, sp, kind) => audio?.play(kind === 'throw' ? 'whoosh' : 'kick'),
    bounce: sp => { if (sp > 5) audio?.play('thud'); },
    whistle: () => audio?.play('whistle'),
    goal(team, scorer, own) {
      audio?.play(team === 0 ? 'cheer' : 'thud');
      ui.pop(team === 1 ? t('fbConceded') : own ? t('fbOwnGoal') : scorer?.human ? t('fbGoalMine') : t('fbGoal'), team === 0 ? 'wow' : 'bad');
    },
    save: gk => ui.pop(gk.team === 0 ? t('fbSaved') : t('fbKeeperSaved'), gk.team === 0 ? 'good' : ''),
    steal: by => { if (by.human) ui.pop(t('fbWon'), 'good'); },
  } });
  const { players, ball, s } = match, looks = looksFor(players);
  const views = players.map((p, i) => ({ p, kid: createKid(scene, looks[i]), x: p.x, z: p.z, yaw: p.yaw, speed: 0 }));

  ui.onStart = () => { st.phase = 'play'; };
  ui.onQuit = () => finish(true);
  ui.onBack = () => ctx.onExit(result());
  const result = () => ({ game: 'football', baht: payout(s, !st.quit).baht, catches: [], score: [...s.score] });
  function finish(quit = false) {
    if (st.phase === 'end') return;
    st.phase = 'end'; st.quit = quit;
    const pay = payout(s, !quit), [a, b] = s.score, prev = ctx.progress.get().best.football;
    if (!quit) ui.pop(t(pay.kind === 'win' ? 'fbWin' : pay.kind === 'draw' ? 'fbDraw' : 'fbLose'), pay.kind === 'win' ? 'wow' : pay.kind === 'lose' ? 'bad' : '');
    const rows = pay.rows.map(r => ({ icon: ROWS[r.key][0], name: { th: t(ROWS[r.key][1]), en: t(ROWS[r.key][1]) }, count: r.count, detail: r.key === pay.kind ? `${a}–${b}` : '', baht: r.baht }));
    setTimeout(() => ui.results(rows, pay.baht, !prev || pay.baht > prev.baht), quit ? 300 : 1500);
  }

  /** After the walk cycle: kicks, lunges, stumbles, the keeper's hands, joy and gloom. */
  function pose(v, dt) {
    const p = v.p, B = v.kid.bones, cheer = (s.phase === 'goal' && s.scored === p.team) || (s.phase === 'end' && s.score[p.team] > s.score[1 - p.team]);
    const sad = (s.phase === 'goal' && s.scored !== p.team) || (s.phase === 'end' && s.score[p.team] < s.score[1 - p.team]);
    if (p.kick > 0) {                                                   // the right leg swings through
      const k = 1 - p.kick / 0.32;
      B.legR.rotation.x = -1.5 * Math.sin(Math.PI * Math.min(1, k * 1.25)); B.shinR.rotation.x = 0.25; B.spine.rotation.x = -0.12;
    } else if (p.charging) { B.legR.rotation.x = 0.35 + 0.5 * p.charge; B.shinR.rotation.x = 0.5 + 0.7 * p.charge; B.spine.rotation.x = 0.1; }   // winding up
    if (p.lunge > 0) { B.hips.rotation.x = 0.75; B.legR.rotation.x = -1.5; B.shinR.rotation.x = 0.1; B.armL.rotation.set(0, 0, 1.1); B.armR.rotation.set(0, 0, -1.1); }
    else if (p.stun > 0) { B.hips.rotation.x = 0.4; B.armL.rotation.set(-0.6, 0, 0.9); B.armR.rotation.set(-0.6, 0, -0.9); }
    if (p.role === 'gk' && !cheer && !sad) {
      const has = ball.owner === p;
      B.armL.rotation.set(has ? -1.25 : -0.5, 0, has ? -0.25 : 0.75); B.armR.rotation.set(has ? -1.25 : -0.5, 0, has ? 0.25 : -0.75);
      B.foreL.rotation.x = B.foreR.rotation.x = has ? -0.5 : -0.3;
    }
    if (cheer) {
      const hop = Math.abs(Math.sin(st.clock * 9 + p.id));
      v.kid.mesh.position.y = hop * 0.2;
      B.armL.rotation.set(0, 0, 2.5 + hop * 0.3); B.armR.rotation.set(0, 0, -2.5 - hop * 0.3); B.foreL.rotation.x = B.foreR.rotation.x = -0.2;
    } else if (sad) { B.head.rotation.x = 0.45; B.spine.rotation.x = 0.15; }
  }

  const focus = new THREE.Vector3(0, 0, 0), look = new THREE.Vector3(), eye = new THREE.Vector3(), axis = new THREE.Vector3(), warm = new THREE.Color('#ffa63a'), white = new THREE.Color('#ffffff');
  let first = true;
  function update(dt) {
    st.clock += dt;
    if (st.phase === 'play') {
      const { f, r, mag } = input.axis(), len = Math.hypot(f, r) || 1, m = Math.min(1, mag / 0.7);
      const inp = { mx: (r / len) * m, mz: (-f / len) * m, act: input.down('Space') || !!input.jump };   // up the screen is up the pitch (−z)
      for (let n = Math.max(1, Math.ceil(dt / STEP)), i = 0; i < n; i++) match.step(dt / n, inp);
      if (s.phase === 'end') finish();
    }

    for (const v of views) {
      const p = v.p, moved = Math.hypot(p.x - v.x, p.z - v.z), speed = dt > 0 ? moved / dt : 0;
      const turn = dt > 0 ? Math.atan2(Math.sin(p.yaw - v.yaw), Math.cos(p.yaw - v.yaw)) / dt : 0;
      v.kid.update(dt, { x: p.x, y: 0, z: p.z, yaw: p.yaw, speed, dist: moved, accel: dt > 0 ? (speed - v.speed) / dt : 0, turn, grounded: true, vy: 0, groundAt: () => 0 });
      v.x = p.x; v.z = p.z; v.yaw = p.yaw; v.speed = speed;
      pose(v, dt);
    }
    // the ball rolls the way it goes
    const bs = Math.hypot(ball.vx, ball.vz);
    world.ball.position.set(ball.x, ball.y + 0.16, ball.z);
    if (bs > 0.05) world.ball.rotateOnWorldAxis(axis.set(ball.vz / bs, 0, -ball.vx / bs), (bs * dt) / 0.16);
    const me = match.me;
    world.ring.position.set(me.x, 0.03, me.z);
    world.ring.scale.setScalar(1 + 0.75 * me.charge);
    world.ring.material.color.copy(white).lerp(warm, me.charge);

    // camera: follows the ball up and down the pitch, keeping the kid in the picture
    focus.set(ball.x * 0.65 + me.x * 0.35, 0, ball.z * 0.65 + me.z * 0.35);
    const lx = THREE.MathUtils.clamp(focus.x * cam.pan, -W, W), lz = THREE.MathUtils.clamp(focus.z - cam.ahead, -L + 3.5, L - 5), k = first ? 1 : 1 - Math.exp(-dt * CAM.ease);
    look.lerp(axis.set(lx, 0.6, lz), k);
    eye.set(look.x * 0.9, cam.up, look.z + cam.back);
    camera.position.copy(eye);
    camera.lookAt(look);
    first = false;
    world.update(st.clock, look);
    fx.setFocus(look, cam.up);

    ui.bar(s.time, `${s.score[0]}–${s.score[1]}`, payout(s, st.phase === 'end' && !st.quit).baht, '⚽');   // (the result's money comes at the whistle)
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
  return { update, render: dt => fx.render(dt), debug: { match, state: st, world, camera } };
}

export function stop() { current?.dispose(); current = null; }
