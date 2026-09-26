// ร้านส้มตำ — help Aunt Nuan through the evening rush. Build each order (base, crab,
// chillies, 3 pounds in rhythm, sides) and serve it before the customer runs out of
// patience. Button-driven, so it plays the same on touch, mouse or keys.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createCustomers } from './customers.js';
import { DISHES, SIDES, ROUND, matches } from './menu.js';
import { createGameUI } from '../shared/gameUI.js';
import { createPostFX } from '../world/postfx.js';
import { rng } from '../core/rng.js';
import { t, tr } from '../shared/i18n.js';

const BUTTONS = [
  { key: 'Digit1', id: 'papaya', icon: '🥗', label: 'papaya' },
  { key: 'Digit2', id: 'corn', icon: '🌽', label: 'corn' },
  { key: 'Digit3', id: 'crab', icon: '🦀', label: 'crab' },
  { key: 'Digit4', id: 'chilli', icon: '🌶️', label: 'chilli' },
  { key: 'Digit5', id: 'pound', icon: '🪵', label: 'pound' },
  { key: 'Digit6', id: 'chicken', icon: '🍗', label: null },
  { key: 'Digit7', id: 'rice', icon: '🍚', label: null },
  { key: 'Digit0', id: 'bin', icon: '🗑️', label: 'bin' },
];
const SERVE_KEYS = ['KeyQ', 'KeyW', 'KeyE'];
let current = null;

export function start(ctx) {
  const { renderer } = ctx;
  const world = buildScene();
  const { scene } = world;
  const r = rng(Date.now() & 0xffff);
  document.body.classList.add('stall');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
  const fx = createPostFX(renderer, scene, camera);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    // customers and their bubbles in the upper half; the prep panel covers the bottom
    camera.fov = portrait ? 68 : 50;
    camera.position.set(0.1, portrait ? 1.9 : 1.75, portrait ? -3.0 : -2.2);
    camera.lookAt(0, portrait ? 0.5 : 0.9, 4);
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  const customers = createCustomers(scene, r);
  const ui = createGameUI(ctx.root, { title: t('stallTitle'), how: t('stallHow'), keys: t('stallKeys'), audio: ctx.audio });
  const root = document.getElementById('game-ui');
  ctx.audio?.ambience({ surf: 0.4, breeze: 0.3, cicadas: 0.4 });

  // prep panel
  const panel = document.createElement('div');
  panel.className = 's-panel';
  panel.innerHTML = `<div class="s-plate"></div><div class="s-btns"></div>
    <div class="s-meter"><div class="zone" style="left:${ROUND.zone[0] * 100}%;width:${(ROUND.zone[1] - ROUND.zone[0]) * 100}%"></div><div class="mark"></div></div>`;
  root.appendChild(panel);
  const plateEl = panel.querySelector('.s-plate'), mark = panel.querySelector('.mark');
  for (const b of BUTTONS) {
    const btn = document.createElement('button');
    btn.className = b.id === 'pound' ? 'pound' : '';
    const label = b.label ? t(b.label) : tr(SIDES.find(s => s.id === b.id).name);
    btn.innerHTML = `<b>${b.icon}</b>${label}`;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(b.id); });
    panel.querySelector('.s-btns').appendChild(btn);
  }
  const bubbles = new Map();

  const s = {
    phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0, spawnIn: 1,
    plate: null, meter: 0, pound: 0, served: [], tips: 0, baht: 0, angry: 0, wrong: 0,
  };
  const fresh = () => ({ base: null, crab: false, chilli: 0, pounded: 0, good: 0, sides: [] });
  s.plate = fresh();

  function press(id) {
    if (s.phase !== 'play') return;
    const p = s.plate;
    if (id === 'papaya' || id === 'corn') { if (!p.base) p.base = id; }
    else if (id === 'chicken' || id === 'rice') { if (!p.sides.includes(id)) p.sides.push(id); }
    else if (id === 'bin') s.plate = fresh();
    else if (!p.base) ui.pop(t('stallNeedBase'), 'bad');
    else if (id === 'crab') p.crab = true;
    else if (id === 'chilli') p.chilli = Math.min(5, p.chilli + 1);
    else if (id === 'pound' && p.pounded < ROUND.pounds) {
      p.pounded++;
      s.pound = 1;
      ctx.audio?.play('thud');
      const m = s.meter;
      if (m >= ROUND.zone[0] && m <= ROUND.zone[1]) { p.good++; if (p.good === ROUND.pounds) ui.pop(t('stallPerfect'), 'good'); }
    }
    drawPlate();
  }

  function serve(c) {
    if (s.phase !== 'play' || c.state !== 'wait') return;
    const p = s.plate, o = c.order;
    if (p.base && p.pounded < ROUND.pounds) { ui.pop(t('stallNotReady'), 'bad'); return; }
    if (!p.base) return;
    if (matches(o, p)) {
      const tip = p.good * ROUND.tipGood + (c.left > c.patience / 2 ? ROUND.tipFast : 0);
      const pay = Math.round(o.price * ROUND.share);
      s.served.push({ id: o.dish.id, price: pay });
      s.baht += pay + tip; s.tips += tip;
      ui.pop(t('stallGood'), 'good');
      customers.serve(c, true);
    } else {
      const pay = Math.round(o.price * ROUND.share * ROUND.wrongPay);
      s.baht += pay; s.wrong++;
      ui.pop(t('stallWrong'), 'bad');
      customers.serve(c, false);
    }
    s.plate = fresh();
    drawPlate();
  }

  function drawPlate() {
    const p = s.plate;
    if (!p.base && !p.sides.length) { plateEl.innerHTML = `<span class="empty">🍽️</span>`; return; }
    const parts = [];
    if (p.base) parts.push(p.base === 'papaya' ? '🥗' : '🌽');
    if (p.crab) parts.push('🦀');
    if (p.base) parts.push(p.chilli ? `🌶️×${p.chilli}` : `<small>${t('noSpice')}</small>`);
    parts.push(...p.sides.map(id => SIDES.find(x => x.id === id).icon));
    const dots = p.base ? '●'.repeat(p.pounded) + '○'.repeat(ROUND.pounds - p.pounded) : '';
    plateEl.innerHTML = `${parts.join(' ')}<span class="dots">${dots}</span>`;
  }
  drawPlate();

  const onKey = e => {
    const b = BUTTONS.find(x => x.key === e.code);
    if (b) { e.preventDefault(); press(b.id); }
    const k = SERVE_KEYS.indexOf(e.code);
    if (k >= 0) { const c = customers.waiting().find(x => x.slot === k); if (c) serve(c); }
  };
  addEventListener('keydown', onKey);

  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  function result() {
    return { game: 'stall', baht: s.baht, catches: [], served: s.served.length };
  }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    panel.remove();
    for (const el of bubbles.values()) el.remove();
    const rows = DISHES.map(d => {
      const list = s.served.filter(x => x.id === d.id);
      return list.length ? { icon: d.icon, name: d.name, count: list.length, detail: '', baht: list.reduce((a, x) => a + x.price, 0) } : null;
    }).filter(Boolean);
    if (s.tips) rows.push({ icon: '🪙', name: { th: t('tips'), en: t('tips') }, count: 1, detail: '', baht: s.tips });
    const prev = ctx.progress.get().best.stall;
    setTimeout(() => ui.results(rows, s.baht, !prev || s.baht > prev.baht), 600);
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
    for (const c of customers.update(dt, s.clock)) { s.angry++; ui.pop(t('stallAngry'), 'bad'); }

    // pound meter sweeps back and forth; pestle animation decays after each hit
    s.meter = 0.5 + 0.5 * Math.sin(s.clock * ROUND.meterSpeed * Math.PI * 2);
    mark.style.left = `${s.meter * 100}%`;
    s.pound = Math.max(0, s.pound - dt * 5);
    world.update(s.clock, s.pound);

    // order bubbles over waiting customers
    const seen = new Set();
    if (s.phase !== 'end') for (const c of customers.list) {
      if (c.state !== 'wait') continue;
      seen.add(c);
      let el = bubbles.get(c);
      if (!el) {
        el = document.createElement('div');
        el.className = 's-bubble';
        const o = c.order;
        el.innerHTML = `${o.dish.icon} ${tr(o.dish.name)}<kbd>${'QWE'[c.slot]}</kbd><br>${o.chilli ? '🌶️'.repeat(o.chilli) : `<small>${t('noSpice')}</small>`} ${o.sides.map(id => SIDES.find(x => x.id === id).icon).join(' ')}<div class="pat"><i></i></div>`;
        el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); serve(c); });
        root.appendChild(el);
        bubbles.set(c, el);
      }
      c.p.mesh.updateMatrixWorld();
      c.p.bones.head.getWorldPosition(v);
      v.y += 0.45;
      v.project(camera);
      el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      const frac = Math.max(0, c.left / c.patience);
      el.querySelector('.pat i').style.width = `${frac * 100}%`;
      el.classList.toggle('low', frac < 0.3);
    }
    for (const [c, el] of bubbles) if (!seen.has(c)) { el.remove(); bubbles.delete(c); }

    fx.setFocus(new THREE.Vector3(0, 0, 1.5), 2);
    ui.bar(s.time, s.served.length, s.baht, '🥗');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKey);
      document.body.classList.remove('stall');
      ui.dispose();
      customers.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, customers, press, serve } };
}

export function stop() { current?.dispose(); current = null; }
