// ข้าวหลามยาย — help Grandma at her khao lam stall. Take a tube off the fire (pick the kind
// customers want), then pound the charred bamboo off strip by strip with a hammer
// (กะเทาะ, ทุบ): hit when the power marker is in the band. Too light and the char stays (chop again); too hard and the
// tube cracks (it sells for less). Finished tubes go on the tray and Grandma hands them
// to customers whose order is ready.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene, BOARD, SLOTS, LANE } from './scene.js';
import { createTube } from './tube.js';
import { KINDS, ROUND, makeOrder } from './rules.js';
import { createCustomers } from '../shared/customers.js';
import { createGameUI } from '../shared/gameUI.js';
import { createPostFX } from '../world/postfx.js';
import { rng } from '../core/rng.js';
import { t, tr } from '../shared/i18n.js';

const KEYS = ['Digit1', 'Digit2', 'Digit3'];
let current = null;

export function start(ctx) {
  const { renderer, input } = ctx;
  const r = rng(Date.now() & 0xffff);
  const world = buildScene();
  const { scene } = world;
  const tube = createTube(scene, BOARD, ROUND.strips);
  tube.hide();
  document.body.classList.add('stall');                  // hides the joystick; this game is buttons only

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 400);
  const fx = createPostFX(renderer, scene, camera);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    // the board just above the button panel, customers and their bubbles above it
    camera.fov = portrait ? 78 : 60;
    camera.position.set(0.05, portrait ? 1.75 : 1.6, portrait ? -0.7 : -0.45);
    camera.lookAt(0.05, portrait ? 0.75 : 0.9, 2.2);
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const customers = createCustomers(scene, r, {
    slots: SLOTS, lane: LANE, from: 8, order: () => makeOrder(r),
    patience: el => THREE.MathUtils.lerp(ROUND.patience[0], ROUND.patience[1], Math.min(1, el / ROUND.time)),
  });
  const ui = createGameUI(ctx.root, { title: t('khaolamTitle'), how: t('khaolamHow'), keys: t('khaolamKeys'), audio: ctx.audio });
  const root = document.getElementById('game-ui');
  ctx.audio?.ambience({ breeze: 0.4, cicadas: 0.6, engine: 0.15 });

  // panel: pick a tube kind, chop; power meter beside the board
  const panel = document.createElement('div');
  panel.className = 's-panel k-panel';
  panel.innerHTML = `<div class="s-btns k-btns"></div>`;
  root.appendChild(panel);
  const meter = document.createElement('div');
  meter.className = 'k-meter';
  meter.innerHTML = '<div class="zone"></div><div class="mark"></div><b></b>';
  root.appendChild(meter);
  const kindBtns = KINDS.map((k, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${k.icon}</b>${tr(k.short)} <small>฿${k.price}</small><i class="k-count"></i>`;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pick(i); });
    panel.querySelector('.k-btns').appendChild(b);
    return b;
  });
  const chopBtn = document.createElement('button');
  chopBtn.className = 'pound k-chop';
  chopBtn.innerHTML = `<b>🔨</b>${t('khaolamChop')}`;
  chopBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); chop(); });
  panel.querySelector('.k-btns').appendChild(chopBtn);
  const zoneEl = meter.querySelector('.zone'), markEl = meter.querySelector('.mark'), stripEl = meter.querySelector('b');
  const bubbles = new Map();

  const s = {
    phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0, spawnIn: 1.5, meter: 0, mPhase: 0,
    board: null, anim: null, stock: [], sold: [], tips: 0, baht: 0, angry: 0, cracked: 0, made: 0, wasAct: false,
  };
  const lerpRound = ([a, b]) => THREE.MathUtils.lerp(a, b, Math.min(1, s.elapsed / ROUND.time));

  function pick(i) {
    if (s.phase !== 'play' || s.board) return;
    const kind = KINDS[i];
    const thick = Array.from({ length: ROUND.strips }, () => (r() < ROUND.thickChance ? 'thick' : 'thin'));
    const zones = thick.map(st => THREE.MathUtils.lerp(...ROUND[st], r()));
    s.board = { kind, zones, top: 0, cracks: 0, shallow: 0 };
    tube.reset(kind, thick);
    ctx.audio?.play('click');
  }

  function chop() {
    const b = s.board;
    if (s.phase !== 'play' || !b || s.anim) return;
    const m = s.meter, c = b.zones[b.top], w = lerpRound(ROUND.zone) / 2;
    const from = tube.state[b.top];
    let st;
    if (m >= c - w && m <= c + w) { st = 'done'; ui.pop(t('khaolamGood'), 'good'); }
    else if (m < c - w) { st = 'thin'; b.shallow++; b.zones[b.top] = Math.max(0.2, c - ROUND.shallowDrop); ui.pop(t('khaolamShallow'), 'bad'); }
    else { st = 'crack'; b.cracks++; ui.pop(t('khaolamCrack'), 'bad'); }
    s.anim = { k: 0, strip: b.top, st, from };
  }

  function finishStrip() {
    const b = s.board, a = s.anim;
    s.anim = null;
    tube.state[a.strip] = a.st;
    if (a.st === 'thin') return;                                  // same strip again
    const next = tube.state.findIndex(st => st === 'thick' || st === 'thin');
    if (next >= 0) { b.top = next; return; }
    // tube finished
    const price = Math.round(b.kind.price * ROUND.crackPrice[Math.min(b.cracks, ROUND.crackPrice.length - 1)]);
    const perfect = !b.cracks && !b.shallow;
    s.stock.push({ kind: b.kind, price, perfect });
    s.made++; if (b.cracks) s.cracked++;
    ui.pop(perfect ? t('khaolamPerfect') : t('khaolamDone'), perfect ? 'wow' : 'good');
    ctx.audio?.play('coin');
    s.board = null;
    tube.hide();
    world.setTray(s.stock.map(x => x.kind));
  }

  // Grandma hands over an order as soon as the tray has all of it
  let serveCool = 0;
  function autoServe(dt) {
    serveCool -= dt;
    if (serveCool > 0 || s.phase !== 'play') return;
    const waiting = customers.waiting().sort((a, b) => a.left - b.left);
    for (const c of waiting) {
      const o = c.order, have = s.stock.filter(x => x.kind === o.kind);
      if (have.length < o.qty) continue;
      const give = have.slice(0, o.qty);
      s.stock = s.stock.filter(x => !give.includes(x));
      const pay = give.reduce((a, x) => a + Math.round(x.price * ROUND.share), 0);
      const tip = give.filter(x => x.perfect).length * ROUND.tipPerfect;
      s.baht += pay + tip; s.tips += tip;
      for (const x of give) s.sold.push({ id: x.kind.id, pay: Math.round(x.price * ROUND.share) });
      customers.serve(c, true);
      world.serve();
      world.setTray(s.stock.map(x => x.kind));
      ui.pop(t('khaolamSold'), 'good');
      ctx.audio?.play('catch');
      serveCool = 0.8;
      return;
    }
  }

  const onKey = e => {
    const i = KEYS.indexOf(e.code);
    if (i >= 0) { e.preventDefault(); pick(i); }
  };
  addEventListener('keydown', onKey);
  const onTap = e => { if (e.target === renderer.domElement) chop(); };
  addEventListener('pointerdown', onTap);

  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  const gift = () => s.sold.length >= ROUND.giftAfter;
  function result() { return { game: 'khaolam', baht: s.baht, catches: gift() ? [{ id: 'tube' }] : [], sold: s.sold.length }; }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    panel.remove(); meter.remove();
    for (const el of bubbles.values()) el.remove();
    const rows = KINDS.map(k => {
      const list = s.sold.filter(x => x.id === k.id);
      return list.length ? { icon: k.icon, name: k.name, count: list.length, detail: '', baht: list.reduce((a, x) => a + x.pay, 0) } : null;
    }).filter(Boolean);
    if (s.tips) rows.push({ icon: '🪙', name: { th: t('tips'), en: t('tips') }, count: 1, detail: '', baht: s.tips });
    if (gift()) rows.push({ icon: '🎋', name: { th: t('khaolamGift'), en: t('khaolamGift') }, count: 1, detail: '', baht: 0 });
    const prev = ctx.progress.get().best.khaolam;
    setTimeout(() => ui.results(rows, s.baht, !prev || s.baht > prev.baht), 500);
  }

  const v = new THREE.Vector3();
  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';
    if (playing) {
      s.elapsed += dt; s.time = Math.max(0, ROUND.time - s.elapsed);
      if (s.time <= 0) end();
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) { customers.spawn(s.elapsed); s.spawnIn = THREE.MathUtils.lerp(...ROUND.arriveEvery, r()); }
    }
    for (const c of customers.update(dt, s.clock)) { s.angry++; ui.pop(t('khaolamAngry'), 'bad'); }
    autoServe(dt);

    // chop: Space / the touch action button too (edge-triggered)
    const act = playing && (input.down('Space') || input.jump);
    if (act && !s.wasAct) chop();
    s.wasAct = act;

    // power meter sweeps up and down; the band belongs to the strip on top
    s.mPhase += dt * lerpRound(ROUND.meterSpeed);
    s.meter = 0.5 - 0.5 * Math.cos(s.mPhase * Math.PI * 2);
    const b = s.board;
    meter.classList.toggle('on', playing && !!b);
    if (b) {
      const w = lerpRound(ROUND.zone), c = b.zones[b.top];
      zoneEl.style.bottom = `${(c - w / 2) * 100}%`; zoneEl.style.height = `${w * 100}%`;
      markEl.style.bottom = `${s.meter * 100}%`;
      stripEl.textContent = `${tube.state.filter(x => x === 'done' || x === 'crack').length}/${ROUND.strips}`;
    }
    // kind buttons: tray count badge; the kind on the board lights up, the others wait
    kindBtns.forEach((btn, i) => {
      btn.disabled = !!b && b.kind !== KINDS[i];
      btn.classList.toggle('on', !!b && b.kind === KINDS[i]);
      const n = s.stock.filter(x => x.kind === KINDS[i]).length;
      btn.querySelector('.k-count').textContent = n ? `${t('khaolamTray')} ${n}` : '';
    });
    chopBtn.disabled = !b;
    chopBtn.classList.toggle('pick', !b);
    const mode = b ? 'pound' : 'pick';                     // no tube yet: the button says to take one
    if (chopBtn.dataset.mode !== mode) {
      chopBtn.dataset.mode = mode;
      chopBtn.innerHTML = b ? `<b>🔨</b>${t('khaolamChop')}` : `<b>🔥</b>${t('khaolamPick')}`;
    }

    // pounding: three hammer blows along the strip; each cracks a third of it off
    if (s.anim) {
      const a = s.anim, k0 = a.k;
      a.k = Math.min(1, a.k + dt / ROUND.chop);
      const hit = tube.impact(k0, a.k);
      if (hit !== null) {
        tube.paintStrip(a.strip, a.st, tube.painted(a.k));
        tube.spray(hit, a.from === 'thick' ? '#2a1e16' : '#6a4526', a.st === 'crack' ? 8 : 6);
        ctx.audio?.play('thud');
      }
      if (a.k >= 1) finishStrip();
    }
    tube.update(dt, s.clock, s.anim, s.board ? s.board.top : 0);
    world.update(s.clock, dt);

    // order bubbles over waiting customers
    const seen = new Set();
    if (s.phase !== 'end') for (const c of customers.list) {
      if (c.state !== 'wait') continue;
      seen.add(c);
      let el = bubbles.get(c);
      if (!el) {
        el = document.createElement('div');
        el.className = 's-bubble';
        el.innerHTML = `${c.order.kind.icon} ${tr(c.order.kind.short)} ×${c.order.qty}<div class="pat"><i></i></div>`;
        root.appendChild(el);
        bubbles.set(c, el);
      }
      c.p.mesh.updateMatrixWorld();
      c.p.bones.head.getWorldPosition(v);
      v.y += 0.4;
      v.project(camera);
      el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      const frac = Math.max(0, c.left / c.patience);
      el.querySelector('.pat i').style.width = `${frac * 100}%`;
      el.classList.toggle('low', frac < 0.3);
    }
    for (const [c, el] of bubbles) if (!seen.has(c)) { el.remove(); bubbles.delete(c); }

    fx.setFocus(BOARD, 1.2);
    ui.bar(s.time, s.sold.length, s.baht, '🎋');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', onTap);
      document.body.classList.remove('stall');
      ui.dispose();
      customers.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, tube, customers, pick, chop } };
}

export function stop() { current?.dispose(); current = null; }
