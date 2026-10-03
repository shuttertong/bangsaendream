// หมากล้อม 9×9 at the Go house. Against the teacher (a gentle AI) or, online, against the player
// who sat down at your table (the lobby in town/coop.js; the one who opened the table is Black).
// Tap a point to choose it, tap again (or ✔) to place the stone. Two passes end the game; the
// score is the area each side holds. start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createBoard, clone, play, pass, over, score, legal, BLACK, WHITE, other } from './board.js';
import { chooseMove } from './ai.js';
import { createGoNet } from './net.js';
import { GO, PAY } from './rules.js';
import { createGameUI } from '../shared/gameUI.js';
import { createPostFX } from '../world/postfx.js';
import { t } from '../shared/i18n.js';

let current = null;
const ICON = { [BLACK]: '⚫', [WHITE]: '⚪' };

export function start(ctx) {
  const { renderer } = ctx;
  const world = buildScene(), { scene } = world;
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 60);
  const fx = createPostFX(renderer, scene, camera);
  const focus = new THREE.Vector3(0, world.top, 0.02);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const narrow = Math.max(1, 1.05 / camera.aspect);                    // step back on a tall screen so the whole board fits
    camera.position.set(0, world.top + 2.0 * narrow, 1.12 * narrow);
    camera.lookAt(focus.x, focus.y, focus.z + (camera.aspect < 1 ? 0.2 * narrow : 0.26));   // look below the board's centre: the button panel covers the bottom of the screen
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();
  document.body.classList.add('stall');                                  // no joystick: this game is taps only

  const net = createGoNet(ctx.coop, {
    move(i, n) { if (s.phase === 'play' && n === b.moves && b.turn !== me) apply(i, false); },
    resign() { finish(me, 'goRivalResigned'); },
    gone() { if (s.phase === 'play') finish(me, 'goRivalLeft'); },
  });
  const me = net ? (net.leader ? BLACK : WHITE) : BLACK, pay = net ? PAY.net : PAY.ai;
  const names = { [me]: t('goYou'), [other(me)]: net ? net.rivalName() : t('goTeacher') };
  const b = createBoard(GO.size);
  const s = { phase: 'intro', sel: -1, time: GO.turnTime, aiIn: 0, clock: 0, winner: 0, baht: 0, result: null, silent: 0 };

  const ui = createGameUI(ctx.root, { title: t('goTitle'), how: t('goHow'), keys: t('goKeys'), audio: ctx.audio });
  const root = document.getElementById('game-ui');
  const panel = document.createElement('div');
  panel.className = 's-panel go-panel';
  panel.innerHTML = `<div class="go-status"></div><div class="go-btns"><button class="go-place"></button><button class="go-pass"></button><button class="go-resign"></button></div>`;
  root.appendChild(panel);
  const $ = q => panel.querySelector(q), stop = fn => e => { e.preventDefault(); e.stopPropagation(); fn(); };
  $('.go-place').textContent = `✔ ${t('goPlace')}`; $('.go-pass').textContent = t('goPass'); $('.go-resign').textContent = t('goResign');
  $('.go-place').addEventListener('pointerdown', stop(() => place()));
  $('.go-pass').addEventListener('pointerdown', stop(() => { if (myTurn()) apply(-1, true); }));
  $('.go-resign').addEventListener('pointerdown', stop(() => {
    if (s.phase !== 'play') return;
    if ($('.go-resign').dataset.sure) { net?.resign(); finish(other(me), 'goYouResigned'); }
    else { $('.go-resign').dataset.sure = 1; $('.go-resign').textContent = t('goResignSure'); }
  }));
  ctx.audio?.ambience?.({ breeze: 0.25, cicadas: 0.35 });

  const myTurn = () => s.phase === 'play' && b.turn === me;
  function select(i) {
    if (!myTurn()) return;
    if (i >= 0 && i === s.sel) { place(); return; }
    if (i >= 0 && !legal(b, i, me)) {
      const why = play(clone(b), i, me).reason;
      ui.pop(t(why === 'ko' ? 'goKo' : why === 'suicide' ? 'goSuicide' : 'goTaken'), 'bad');
      i = -1;
    } else if (i >= 0) ctx.audio?.play('click');
    s.sel = i;
    world.setGhost(i, me);
  }
  function place() { if (myTurn() && s.sel >= 0) apply(s.sel, true); }

  /** Play a move (i = −1 passes) for whoever's turn it is; mine = made on this device. */
  function apply(i, mine) {
    if (mine && b.turn !== me) return;
    const color = b.turn, n = b.moves;
    if (i < 0) { pass(b); ui.pop(t('goPassed', { name: names[color] })); }
    else {
      const res = play(b, i, color);
      if (!res.ok) return;
      ctx.audio?.play('thud');
      if (res.captured.length) ui.pop(t('goCaptured', { name: names[color], n: res.captured.length }), color === me ? 'good' : 'bad');
    }
    if (mine && color === me) net?.move(i, n);
    s.sel = -1; s.time = GO.turnTime; s.silent = 0;
    world.setGhost(-1); world.setBoard(b.cells, b.last);
    delete $('.go-resign').dataset.sure; $('.go-resign').textContent = t('goResign');
    if (over(b) || b.moves >= GO.maxMoves) finish(0);
    else if (!net && b.turn !== me) s.aiIn = THREE.MathUtils.lerp(...GO.aiThink, Math.random());
  }

  function finish(winner, reason = null) {
    if (s.phase === 'end') return;
    s.phase = 'end';
    const sc = score(b, GO.komi);
    s.winner = winner || sc.winner;
    world.setGhost(-1); world.setTerritory(sc.owner, b.cells);
    const won = s.winner === me, caps = Math.min(PAY.captureCap, b.caps[me] * PAY.perCapture);
    const scale = reason === 'goRivalLeft' || reason === 'goRivalResigned' ? 1 : Math.min(1, b.moves / PAY.fullAfter);
    const base = Math.round((won ? pay.win : pay.lose) * scale), bonus = Math.round(caps * scale);
    s.baht = base + bonus;
    panel.remove();
    const rows = [
      { icon: '⚫', name: { th: names[BLACK], en: names[BLACK] }, count: sc.black, detail: s.winner === BLACK ? '🏆' : '', baht: me === BLACK ? base : 0 },
      { icon: '⚪', name: { th: names[WHITE], en: names[WHITE] }, count: sc.white, detail: s.winner === WHITE ? '🏆' : t('goKomi', { n: GO.komi }), baht: me === WHITE ? base : 0 },
    ];
    if (bonus) rows.push({ icon: '🫳', name: { th: t('goCaptureBonus'), en: t('goCaptureBonus') }, count: b.caps[me], detail: '', baht: bonus });
    ui.pop(reason ? t(reason) : t(won ? 'goWin' : 'goLose'), won ? 'wow' : 'bad');
    const prev = ctx.progress.get().best.go;
    s.result = { game: 'go', baht: s.baht, catches: [], won, moves: b.moves };
    setTimeout(() => ui.results(rows, s.baht, won && (!prev || s.baht > prev.baht)), reason ? 900 : 2200);
  }

  const onTap = e => { if (e.target === renderer.domElement && s.phase === 'play') select(world.pick(e.clientX, e.clientY, camera)); };
  addEventListener('pointerdown', onTap);
  const begin = () => { s.phase = 'play'; s.time = GO.turnTime; ui.pop(t(me === BLACK ? 'goYouBlack' : 'goYouWhite')); };
  ui.onStart = begin;
  ui.onQuit = () => { if (s.phase === 'play') { net?.resign(); finish(other(me), 'goYouResigned'); } else ctx.onExit(s.result || { game: 'go', baht: 0, catches: [] }); };
  ui.onBack = () => ctx.onExit(s.result);
  if (net) { ui.begin(); begin(); }                                      // an online table starts as soon as both sit down

  function update(dt) {
    s.clock += dt;
    world.update(dt);
    if (s.phase === 'play') {
      s.time -= dt;
      if (myTurn()) { if (s.time <= 0) apply(-1, true); }                // out of time: pass
      else if (!net) { s.aiIn -= dt; if (s.aiIn <= 0) apply(chooseMove(b, b.turn), false); }
      else { s.silent += dt; if (s.silent > GO.turnTime + 20) finish(me, 'goRivalLeft'); }   // the other side never answered
      $('.go-status').textContent = myTurn() ? t('goYourTurn', { c: ICON[me] }) : t('goTheirTurn', { name: names[b.turn], c: ICON[b.turn] });
      $('.go-place').disabled = !(myTurn() && s.sel >= 0);
      $('.go-pass').disabled = !myTurn();
      panel.classList.toggle('mine', myTurn());
    }
    fx.setFocus?.(focus, 1.4);
    ui.bar(s.phase === 'play' ? Math.max(0, s.time) : `${ICON[BLACK]} ${names[BLACK]} · ${ICON[WHITE]} ${names[WHITE]}`, b.caps[me], s.baht, '🫳');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      removeEventListener('pointerdown', onTap);
      document.body.classList.remove('stall');
      if (s.phase === 'play') net?.bye();
      net?.close();
      ui.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, board: b, me, select, place, apply, finish, net } };
}

export function stop() { current?.dispose(); current = null; }
