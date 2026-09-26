// ห่วงยาง — float in an inner tube, collect shells and treasures from the waves.
// Paddling is slow and floaty; waves push you (ride a crest shoreward to surf); a big
// stroke costs stamina; jellyfish sting and stun. start(ctx) → { update, render }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildScene } from './scene.js';
import { createFinds } from './finds.js';
import { FINDS, ROUND, waveAt } from './species.js';
import { createGameUI, summarize } from '../shared/gameUI.js';
import { buildPerson } from '../town/people/body.js';
import { KID_LOOK } from '../town/kid/model.js';
import { createPostFX } from '../world/postfx.js';
import { paintedMaterial } from '../world/materials.js';
import { rng } from '../core/rng.js';
import { t, tr } from '../shared/i18n.js';

const TB = ROUND.tube;
let current = null;

function tubeGeometry() {
  // striped inner tube: alternate red / white segments
  const g = new THREE.TorusGeometry(0.62, 0.24, 12, 28).rotateX(Math.PI / 2).toNonIndexed();
  const p = g.attributes.position, a = new Float32Array(p.count * 3), c1 = new THREE.Color('#e8443a'), c2 = new THREE.Color('#f4f1e8');
  for (let i = 0; i < p.count; i += 3) {
    const ang = Math.atan2(p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2), p.getX(i) + p.getX(i + 1) + p.getX(i + 2));
    const c = Math.floor((ang + Math.PI) / (Math.PI / 4)) % 2 ? c1 : c2;
    for (let k = 0; k < 3; k++) c.toArray(a, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return mergeGeometries([g]);
}

export function start(ctx) {
  const { renderer, input } = ctx;
  const world = buildScene();
  const { scene } = world;
  const r = rng(Date.now() & 0xffff);
  const mat = paintedMaterial({ amp: 0.08, scale: 0.5 });

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 4000);
  const fx = createPostFX(renderer, scene, camera);
  let camUp = 7.5, camBack = 9;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 62 : 50; camUp = portrait ? 11 : 7.5; camBack = portrait ? 10 : 9;
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  // the kid sitting in the tube, legs over the front
  const rig = new THREE.Group();
  const tube = new THREE.Mesh(tubeGeometry(), mat);
  tube.castShadow = true;
  const kid = buildPerson(KID_LOOK);
  const B = kid.bones;
  kid.mesh.position.set(0, -0.55, -0.1);
  B.hips.position.y = 0.5;
  for (const s of ['L', 'R']) { B[`leg${s}`].rotation.x = -1.3; B[`shin${s}`].rotation.x = 0.9; }
  rig.add(tube, kid.mesh);
  scene.add(rig);

  const finds = createFinds(scene, mat, r);
  const ui = createGameUI(ctx.root, { title: t('tubeTitle'), how: t('tubeHow'), keys: t('tubeKeys') });
  const stam = document.createElement('div'); stam.className = 'g-stamina'; stam.innerHTML = '<i></i>';
  document.getElementById('game-ui').append(stam);
  document.body.classList.toggle('touch-on', !!document.querySelector('#touch.on'));
  ctx.touch?.setAction('dash');

  const s = {
    phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0,
    x: 0, z: -6, vx: 0, vz: 0, yaw: Math.PI, stamina: 1, wasAct: false, stun: 0, surfCool: 0, stroke: 0,
    catches: [], baht: 0,
  };
  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  function result() {
    const sum = summarize(s.catches, FINDS);
    return { game: 'tube', baht: sum.total, catches: s.catches, biggest: null };
  }
  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    const sum = summarize(s.catches, FINDS), prev = ctx.progress.get().best.tube;
    for (const row of sum.rows) row.detail = '';
    setTimeout(() => ui.results(sum.rows, sum.total, !prev || sum.total > prev.baht), 600);
  }

  function update(dt) {
    s.clock += dt;
    const playing = s.phase === 'play';
    if (playing) { s.elapsed += dt; s.time = Math.max(0, ROUND.time - s.elapsed); if (s.time <= 0) end(); }
    s.stun = Math.max(0, s.stun - dt);
    s.surfCool = Math.max(0, s.surfCool - dt);

    // paddling (screen-relative: up = out to sea, −z)
    const canPaddle = playing && s.stun <= 0;
    const { f, r: rr, mag } = canPaddle ? input.axis() : { f: 0, r: 0, mag: 0 };
    const len = Math.hypot(f, rr) || 1;
    let ax = mag ? (rr / len) * TB.paddle * Math.min(1, mag / 0.6) : 0, az = mag ? (-f / len) * TB.paddle * Math.min(1, mag / 0.6) : 0;
    const act = canPaddle && (input.down('Space') || input.jump);
    if (act && !s.wasAct && s.stamina >= TB.burstCost) {
      // a big stroke in the direction you're steering (or facing)
      const dx = mag ? rr / len : Math.sin(s.yaw), dz = mag ? -f / len : Math.cos(s.yaw);
      s.vx += dx * TB.burst; s.vz += dz * TB.burst;
      s.stamina -= TB.burstCost; s.stroke = 1;
    }
    s.wasAct = act;
    s.stamina = Math.min(1, s.stamina + TB.regen * dt);

    // waves push down their slope; a gentle current carries you toward the shore
    const w = waveAt(s.x, s.z, s.clock);
    ax += -w.gx * TB.slope; az += -w.gz * TB.slope + TB.current;
    s.vx += ax * dt; s.vz += az * dt;
    const drag = Math.exp(-TB.drag * dt);
    s.vx *= drag; s.vz *= drag;
    s.x += s.vx * dt; s.z += s.vz * dt;
    const A = ROUND.area;
    if (Math.abs(s.x) > A.x) { s.x = Math.sign(s.x) * A.x; s.vx *= -0.3; }
    if (s.z < A.z0) { s.z = A.z0; s.vz *= -0.3; }
    if (s.z > A.z1) { s.z = A.z1; s.vz = Math.min(0, s.vz) - 0.5; }       // the shallows push you back out
    if (Math.hypot(s.vx, s.vz) > 0.4) s.yaw = turn(s.yaw, Math.atan2(s.vx, s.vz), dt * 3);
    if (playing && s.vz > ROUND.surfSpeed && w.h > 0.18 && s.surfCool <= 0) { ui.pop(t('tubeSurf'), 'wow'); s.surfCool = 4; }

    // tube + kid ride the wave: bob with the height, tilt with the slope
    rig.position.set(s.x, w.h, s.z);
    rig.rotation.set(-w.gz * 0.5, s.yaw, w.gx * 0.5, 'YXZ');
    s.stroke = Math.max(0, s.stroke - dt * 2);
    const paddle = mag > 0.1 || s.stroke > 0;
    const ph = s.clock * (s.stroke > 0 ? 9 : 5);
    B.armL.rotation.set(paddle ? -1.2 + Math.sin(ph) * 0.8 : -0.3, 0, 0.9);
    B.armR.rotation.set(paddle ? -1.2 - Math.sin(ph) * 0.8 : -0.3, 0, -0.9);
    B.spine.rotation.x = s.stun > 0 ? 0.3 : 0.05;
    B.mouth.scale.set(s.stun > 0 ? 1 : 1.6, s.stun > 0 ? 1.8 : 0.5, 1);   // "ouch!" vs smile

    // floating finds + jellyfish
    const { got, sting } = finds.update(dt, s.clock, { x: s.x, z: s.z });
    if (playing) for (const it of got) {
      s.catches.push({ id: it.f.id, size: 0, price: it.f.price });
      s.baht += it.f.price;
      ui.pop(t('tubeGot', { name: tr(it.f.name) }), it.f.price >= 40 ? 'wow' : 'good');
    }
    if (sting && s.stun <= 0 && playing) {
      s.stun = ROUND.sting;
      const dx = s.x - sting.x, dz = s.z - sting.z, d = Math.hypot(dx, dz) || 1;
      s.vx = (dx / d) * 3; s.vz = (dz / d) * 3;
      ui.pop(t('tubeSting'), 'bad');
    }

    world.update(s.clock, rig.position);
    const tgt = new THREE.Vector3(s.x, 0, s.z - 2.5);
    camera.position.lerp(new THREE.Vector3(s.x, camUp, s.z + camBack), 1 - Math.exp(-dt * 3));
    camera.lookAt(tgt);
    fx.setFocus(tgt, camUp);

    stam.querySelector('i').style.width = `${s.stamina * 100}%`;
    stam.classList.toggle('low', s.stamina < TB.burstCost);
    ui.bar(s.time, s.catches.length, s.baht, '🐚');
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      ui.dispose();
      ctx.touch?.setAction('jump');
      finds.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, finds } };
}

export function stop() { current?.dispose(); current = null; }

function turn(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * Math.min(1, k);
}
