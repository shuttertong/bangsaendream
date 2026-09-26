// ตกหมึก — night squid jigging from Uncle Piak's boat.
// Up/down sets the jig depth; tap to jig (squid strike in the pause after); once hooked,
// hold to reel and keep the tension in the green band until the squid reaches the boat.
// start(ctx) → { update, render }; stop() cleans up.
import * as THREE from 'three';
import { buildScene, BOAT } from './scene.js';
import { createSquids } from './squids.js';
import { SPECIES, ROUND, priceOf } from './species.js';
import { jigGeometry } from './models.js';
import { createGameUI, summarize } from '../shared/gameUI.js';
import { buildPerson } from '../town/people/body.js';
import { KID_LOOK } from '../town/kid/model.js';
import { createPostFX } from '../world/postfx.js';
import { rng } from '../core/rng.js';
import { t, tr } from '../shared/i18n.js';

const CAM = { pos: [1, -4, 22], look: [1, -5.5, 0], fov: 50 };
let current = null;

export function start(ctx) {
  const { renderer, input } = ctx;
  const world = buildScene();
  const { scene } = world;
  const r = rng(Date.now() & 0xffff);
  const mat = world.material();

  const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, 0.3, 900);
  camera.position.set(...CAM.pos);
  const fx = createPostFX(renderer, scene, camera);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    // portrait phones: pull back so the boat and the sea floor both fit
    camera.fov = camera.aspect < 1 ? 50 : CAM.fov;
    camera.position.z = camera.aspect < 1 ? CAM.pos[2] / Math.max(0.55, camera.aspect) * 0.62 : CAM.pos[2];
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  // the kid sits on the stern with a rod over the side
  const kid = buildPerson(KID_LOOK);
  kid.mesh.position.set(BOAT.x + 3.2, BOAT.deck + 0.05, 0.4);
  kid.mesh.rotation.y = Math.PI / 2;
  const B = kid.bones;
  B.hips.position.y = 0.34;
  for (const s of ['L', 'R']) { B[`leg${s}`].rotation.x = -1.45; B[`shin${s}`].rotation.x = 1.5; B[`foot${s}`].rotation.x = -0.1; }
  scene.add(kid.mesh);
  const rodMat = new THREE.MeshLambertMaterial({ color: '#3a2a20' });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 1, 6), rodMat);
  scene.add(rod);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#e8f0f0', transparent: true, opacity: 0.8 }));
  scene.add(line);
  const jig = new THREE.Mesh(jigGeometry(), mat);
  scene.add(jig);

  const squids = createSquids(scene, mat, r);

  // UI: shared round card + depth gauge + tension meter
  const ui = createGameUI(ctx.root, { title: t('squidTitle'), how: t('squidHow'), keys: t('squidKeys') });
  const gauge = document.createElement('div'); gauge.className = 'g-depth'; gauge.innerHTML = '<i></i><b></b>';
  const tens = document.createElement('div'); tens.className = 'g-tension'; tens.hidden = true;
  tens.innerHTML = `<div class="zone" style="left:${ROUND.zone[0] * 100}%;width:${(ROUND.zone[1] - ROUND.zone[0]) * 100}%"></div><div class="fill"></div><span></span>`;
  document.getElementById('game-ui').append(gauge, tens);
  ctx.touch?.setAction('reel');

  const s = {
    phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0,
    depth: 4, jigOff: 0, jigAge: 99, wasAct: false,
    hooked: null, tension: 0, slack: 0, surgeIn: 1, warn: false,
    catches: [], baht: 0,
  };

  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  function result() {
    const sum = summarize(s.catches, SPECIES);
    return { game: 'squid', baht: sum.total, catches: s.catches, biggest: sum.biggest };
  }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    if (s.hooked) { squids.escape(s.hooked); s.hooked = null; }
    tens.hidden = true;
    const sum = summarize(s.catches, SPECIES), prev = ctx.progress.get().best.squid;
    setTimeout(() => ui.results(sum.rows, sum.total, !prev || sum.total > prev.baht), 600);
  }

  function update(dt) {
    s.clock += dt;
    world.update(s.clock);
    const playing = s.phase === 'play';
    if (playing) { s.elapsed += dt; s.time = Math.max(0, ROUND.time - s.elapsed); if (s.time <= 0) end(); }

    const act = playing && (input.down('Space') || input.jump);
    const tap = act && !s.wasAct;
    s.wasAct = act;
    s.jigAge += dt;

    if (!s.hooked) {
      // depth control + jigging
      const { f } = playing ? input.axis() : { f: 0 };
      s.depth = THREE.MathUtils.clamp(s.depth - f * ROUND.lureSpeed * dt, 0.6, ROUND.bottom - 0.5);
      if (tap) { s.jigOff = ROUND.jigLift; s.jigAge = 0; }
      s.jigOff = Math.max(0, s.jigOff - dt * 1.4);            // the jig sinks back after each jerk
    } else {
      // the fight: hold to reel (tension rises), let go to ease off; the squid surges
      const sp = s.hooked.sp;
      if (act) { s.depth -= ROUND.reelSpeed * dt; s.tension += ROUND.tensionUp * dt * (0.7 + sp.strength * 0.5); }
      else { s.tension -= ROUND.tensionDown * dt; s.depth += ROUND.drift * sp.strength * dt; }
      // surges are telegraphed; ease off (let go) when the bar shakes
      s.surgeIn -= dt;
      s.warn = s.surgeIn <= ROUND.surgeWarn;
      if (s.surgeIn <= 0) {
        s.surgeIn = 0.9 + r() * 1.5;
        s.tension += ROUND.surge * sp.strength * (0.6 + r() * 0.5) * (act ? 1 : ROUND.eased);
        s.depth += ROUND.surgeDrag * sp.strength;
      }
      s.tension = Math.max(0, s.tension);
      s.depth = Math.min(s.depth, ROUND.bottom - 0.5);
      s.slack = s.tension < 0.08 ? s.slack + dt : 0;
      if (s.tension >= 1) { ui.pop(t('squidSnap'), 'bad'); squids.escape(s.hooked); s.hooked = null; s.tension = 0; s.depth = Math.max(2, s.depth); }
      else if (s.slack > ROUND.looseTime) { ui.pop(t('squidLoose'), 'bad'); squids.escape(s.hooked); s.hooked = null; s.tension = 0; }
      else if (s.depth <= 0.35) land();
      s.jigOff = 0;
    }

    const lure = { x: BOAT.lureX, y: -s.depth + s.jigOff, jigAge: s.jigAge, hooked: s.hooked };
    const bite = squids.update(dt, s.clock, lure, Math.round(THREE.MathUtils.lerp(ROUND.maxSquid[0], ROUND.maxSquid[1], s.elapsed / ROUND.time)));
    if (bite && playing) { s.hooked = bite; s.tension = 0.45; s.slack = 0; s.surgeIn = 0.5; ui.pop(t('squidBite'), 'wow'); }

    // jig, rod (bends with tension) and line
    jig.position.set(lure.x, lure.y, 0);
    jig.rotation.z = s.hooked ? -0.6 : Math.sin(s.clock * 2) * 0.1 + s.jigOff * 0.5;
    const tip = BOAT.rodTip.clone();
    tip.y += world.boat.position.y - s.tension * 0.5 + s.jigOff * 0.3 + (s.hooked && s.warn ? Math.sin(s.clock * 70) * 0.06 : 0);
    const hand = new THREE.Vector3(BOAT.x + 3.6, BOAT.deck + 0.75 + world.boat.position.y, 0.4);
    rod.position.copy(hand).lerp(tip, 0.5);
    rod.scale.y = hand.distanceTo(tip);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(hand).normalize());
    lineGeo.attributes.position.setXYZ(0, tip.x, tip.y, tip.z);
    lineGeo.attributes.position.setXYZ(1, lure.x, lure.y + 0.1, 0);
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.computeBoundingSphere();
    // arms: hold the rod; reel hand circles while reeling
    B.armR.rotation.set(-1.0, 0, -0.2);
    B.armL.rotation.set(-0.9 + (act && s.hooked ? Math.sin(s.clock * 14) * 0.2 : 0), 0, 0.3);
    B.foreL.rotation.x = -0.9;

    // camera follows the jig a little vertically
    camera.lookAt(CAM.look[0], THREE.MathUtils.lerp(CAM.look[1], lure.y, 0.25), CAM.look[2]);
    fx.setFocus(new THREE.Vector3(lure.x, lure.y, 0), 0);

    // gauges
    gauge.querySelector('i').style.top = gauge.querySelector('b').style.top = `${(s.depth / ROUND.bottom) * 100}%`;
    gauge.querySelector('b').textContent = t('depth', { n: s.depth.toFixed(1) });
    tens.hidden = !s.hooked;
    if (s.hooked) {
      tens.querySelector('.fill').style.width = `${Math.min(1, s.tension) * 100}%`;
      tens.classList.toggle('hot', s.tension > ROUND.zone[1]);
      tens.classList.toggle('warn', !!s.warn);
      tens.querySelector('span').textContent = t('tension');
    }
    ui.bar(s.time, s.catches.length, s.baht);
  }

  function land() {
    const q = s.hooked;
    const price = priceOf(q.sp, q.size);
    s.catches.push({ id: q.sp.id, size: q.size, price });
    s.baht += price;
    ui.pop(t('squidGot', { name: tr(q.sp.name), size: q.size }), 'good');
    squids.caught(q);
    s.hooked = null; s.tension = 0; s.depth = 3;
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      ui.dispose();
      ctx.touch?.setAction('jump');
      squids.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, squids, camera } };
}

export function stop() { current?.dispose(); current = null; }
