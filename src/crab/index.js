// จับปูลม — catch ghost crabs on the beach at dusk.
// start(ctx) builds its own scene and returns { update, render }; stop() cleans up.
// ctx: { renderer, input, touch, progress, root, onExit(result) }
import * as THREE from 'three';
import { buildScene, heightAt, BEACH } from './scene.js';
import { createCrabs } from './crabs.js';
import { SPECIES, ROUND, priceOf } from './species.js';
import { flashlightGeometry, holesGeometry } from './models.js';
import { createGameUI } from '../shared/gameUI.js';
import { createKid } from '../town/kid/index.js';
import { createPostFX } from '../world/postfx.js';
import { paintedMaterial } from '../world/materials.js';
import { rng } from '../core/rng.js';
import { t, tr } from '../shared/i18n.js';

const KID = { walk: 2.8, accel: 12, dash: 8.5, dashTime: 0.22, dashCool: 0.45, reach: 0.95, radius: 0.3 };
const BEAM = { half: 0.4, range: 11, angle: 0.44, intensity: 70 };
const CAM = { up: 8.5, back: 9.5, ahead: 3, fov: 50 };

let current = null;

export function start(ctx) {
  const { renderer, input } = ctx;
  const world = buildScene();
  const { scene } = world;
  const r = rng(Date.now() & 0xffff);

  const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, 0.3, 900);
  const fx = createPostFX(renderer, scene, camera);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 62 : CAM.fov;
    camera.updateProjectionMatrix();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  // the kid with a flashlight in the right hand
  const kid = createKid(scene);
  const torch = new THREE.Mesh(flashlightGeometry(), paintedMaterial({ amp: 0.05, scale: 1 }));
  torch.position.set(0, -0.2, 0.03);
  kid.bones.foreR.add(torch);
  const spot = new THREE.SpotLight('#fff1cc', BEAM.intensity, 16, BEAM.angle, 0.45, 1.4);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  scene.add(spot, spot.target);
  // faint visible beam so the aim reads at dusk
  const beamMesh = new THREE.Mesh(
    new THREE.ConeGeometry(Math.tan(BEAM.angle) * 9, 9, 24, 1, true).translate(0, -4.5, 0).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(beamMesh);

  const crabs = createCrabs(scene, paintedMaterial({ amp: 0.1, scale: 0.3 }), heightAt, r);
  const holes = new THREE.Mesh(holesGeometry(crabs.holes, heightAt), paintedMaterial({ amp: 0.1, scale: 0.5 }));
  holes.receiveShadow = true;
  scene.add(holes);

  const ui = createGameUI(ctx.root, { title: t('crabTitle'), how: t('crabHow'), keys: t('crabKeys') });
  ctx.touch?.setAction('dash');

  const s = {
    phase: 'intro', time: ROUND.time, elapsed: 0, clock: 0,
    x: 0, z: 4, yaw: Math.PI, vx: 0, vz: 0, prevSpeed: 0, prevYaw: Math.PI,
    beamYaw: Math.PI, dash: 0, cool: 0, wasDash: false,
    catches: [], baht: 0, darkSaid: false, aimUntil: 0,
  };
  const aim = new THREE.Vector3();

  // desktop: the mouse aims the flashlight (touch aims where you walk)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), ndc = new THREE.Vector2();
  const onMove = e => {
    if (e.pointerType !== 'mouse') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, aim)) s.aimUntil = s.clock + 2;
  };
  renderer.domElement.addEventListener('pointermove', onMove);

  ui.onStart = () => { s.phase = 'play'; };
  ui.onQuit = () => end();
  ui.onBack = () => ctx.onExit(result());

  function result() {
    const bySp = {};
    for (const c of s.catches) {
      const b = bySp[c.id] || (bySp[c.id] = { id: c.id, count: 0, best: 0, baht: 0 });
      b.count++; b.best = Math.max(b.best, c.size); b.baht += c.price;
    }
    const biggest = s.catches.reduce((m, c) => (c.size > (m?.size || 0) ? c : m), null);
    return { game: 'crab', baht: s.baht, catches: s.catches, groups: Object.values(bySp), biggest };
  }

  function end() {
    if (s.phase === 'end') return;
    s.phase = 'end';
    ui.pop(t('crabEnd'));
    const res = result(), prev = ctx.progress.get().best.crab;
    const rows = res.groups.map(g => { const sp = SPECIES.find(x => x.id === g.id); return { icon: sp.icon, name: sp.name, count: g.count, best: g.best, baht: g.baht }; });
    setTimeout(() => ui.results(rows, res.baht, !prev || res.baht > prev.baht), 700);
  }

  function update(dt) {
    s.clock += dt;
    world.update(s.clock);
    const playing = s.phase === 'play';
    if (playing) {
      s.elapsed += dt;
      s.time = Math.max(0, ROUND.time - s.elapsed);
      if (s.time <= 0) end();
    }
    const dusk = Math.min(1, s.elapsed / ROUND.time);
    world.setDusk(dusk);
    if (dusk > 0.5 && !s.darkSaid) { s.darkSaid = true; ui.pop(t('crabDark')); }

    // movement: screen-relative (camera looks toward the sea, −z)
    const { f, r: rr, mag } = playing ? input.axis() : { f: 0, r: 0, mag: 0 };
    const len = Math.hypot(f, rr) || 1;
    const wx = mag ? (rr / len) * KID.walk * Math.min(1, mag / 0.6) : 0, wz = mag ? (-f / len) * KID.walk * Math.min(1, mag / 0.6) : 0;
    const k = Math.min(1, KID.accel * dt);
    s.vx += (wx - s.vx) * k; s.vz += (wz - s.vz) * k;

    // dash: edge-triggered on Space / action button
    const want = playing && (input.down('Space') || input.jump);
    s.cool = Math.max(0, s.cool - dt);
    if (want && !s.wasDash && s.dash <= 0 && s.cool <= 0) { s.dash = KID.dashTime; s.cool = KID.dashCool + KID.dashTime; }
    s.wasDash = want;
    let mvx = s.vx, mvz = s.vz;
    if (s.dash > 0) {
      s.dash -= dt;
      mvx = Math.sin(s.beamYaw) * KID.dash; mvz = Math.cos(s.beamYaw) * KID.dash;
      const hands = { x: s.x + Math.sin(s.beamYaw) * 0.6, z: s.z + Math.cos(s.beamYaw) * 0.6 };
      const got = crabs.grab(hands, KID.reach, r);
      if (got === 'slip') { ui.pop(t('crabSlip'), 'bad'); s.dash = 0; }
      else if (got) catchIt(got);
    }
    const x0 = s.x, z0 = s.z;
    s.x = THREE.MathUtils.clamp(s.x + mvx * dt, BEACH.x0, BEACH.x1);
    s.z = THREE.MathUtils.clamp(s.z + mvz * dt, BEACH.water + 0.5, BEACH.back + 1);
    const moved = Math.hypot(s.x - x0, s.z - z0);

    // facing + flashlight aim
    if (Math.hypot(s.vx, s.vz) > 0.3 && s.dash <= 0) s.yaw = turn(s.yaw, Math.atan2(s.vx, s.vz), dt * 10);
    const mouseAim = s.clock < s.aimUntil;
    const aimYaw = mouseAim ? Math.atan2(aim.x - s.x, aim.z - s.z) : s.yaw;
    s.beamYaw = turn(s.beamYaw, aimYaw, dt * 14);
    if (mouseAim && Math.hypot(s.vx, s.vz) < 0.3) s.yaw = turn(s.yaw, s.beamYaw, dt * 8);

    const speed = dt > 0 ? moved / dt : 0;
    let tr8 = s.yaw - s.prevYaw; tr8 = Math.atan2(Math.sin(tr8), Math.cos(tr8)) / (dt || 1);
    kid.update(dt, { x: s.x, y: heightAt(s.x, s.z), z: s.z, yaw: s.yaw, speed, dist: moved, accel: (speed - s.prevSpeed) / (dt || 1), turn: tr8, grounded: true, vy: 0, groundAt: heightAt });
    s.prevSpeed = speed; s.prevYaw = s.yaw;
    // hold the flashlight out toward the beam
    const rel = Math.atan2(Math.sin(s.beamYaw - s.yaw), Math.cos(s.beamYaw - s.yaw));
    kid.bones.armR.rotation.set(-1.25, rel * 0.6, -0.1);
    kid.bones.foreR.rotation.set(-0.25, 0, 0);

    // light follows the torch
    kid.mesh.updateMatrixWorld(true);
    torch.getWorldPosition(spot.position);
    const tx = s.x + Math.sin(s.beamYaw) * 7, tz = s.z + Math.cos(s.beamYaw) * 7;
    spot.target.position.set(tx, heightAt(tx, tz), tz);
    spot.intensity = BEAM.intensity * (0.6 + dusk * 0.6);
    beamMesh.position.copy(spot.position);
    beamMesh.lookAt(spot.target.position);
    beamMesh.material.opacity = 0.012 + dusk * 0.035;

    crabs.update(dt, s.clock, { x: s.x, z: s.z }, { x: s.x, z: s.z, yaw: s.beamYaw, half: BEAM.half, range: BEAM.range },
      Math.round(THREE.MathUtils.lerp(ROUND.maxCrabs[0], ROUND.maxCrabs[1], dusk)));

    // camera: behind and above, looking out to sea; slow drift during the intro
    const cx = s.x + (s.phase === 'intro' ? Math.sin(s.clock * 0.3) * 3 : 0);
    camera.position.lerp(new THREE.Vector3(cx, heightAt(s.x, s.z) + CAM.up, s.z + CAM.back), 1 - Math.exp(-dt * 4));
    camera.lookAt(s.x, heightAt(s.x, s.z), s.z - CAM.ahead);
    fx.setFocus(new THREE.Vector3(s.x, 0, s.z), CAM.up);

    ui.bar(s.time, s.catches.length, s.baht);
  }

  function catchIt(c) {
    const price = priceOf(c.sp, c.size);
    s.catches.push({ id: c.sp.id, size: c.size, price });
    s.baht += price;
    ui.pop(t('crabGot', { name: tr(c.sp.name), size: c.size }), 'good');
    const big = c.sp.size[0] + (c.sp.size[1] - c.sp.size[0]) * ROUND.bigComment;
    if (c.size >= big) setTimeout(() => ui.pop(t('crabBig'), 'wow'), 350);
  }

  current = {
    dispose() {
      removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointermove', onMove);
      ui.dispose();
      ctx.touch?.setAction('jump');
      crabs.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); });
      fx.composer.renderTarget1.dispose(); fx.composer.renderTarget2.dispose();
    },
  };
  return { update, render: dt => fx.render(dt), debug: { state: s, crabs, camera } };
}

export function stop() {
  current?.dispose();
  current = null;
}

function turn(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * Math.min(1, k);
}
