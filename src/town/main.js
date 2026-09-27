// Hub boot + per-frame update: builds the world, then hands gameplay to hub.js.
import * as THREE from 'three';
import { createRenderer, createLights } from '../world/render.js';
import { createSky, buildEnvironment } from '../world/sky.js';
import { createFog } from '../world/haze.js';
import { createSea } from '../world/water.js';
import { createPostFX } from '../world/postfx.js';
import { createInput } from '../core/input.js';
import { createTouchControls } from '../core/touch.js';
import { addSystem, startLoop, tick } from '../core/loop.js';
import { U } from '../core/shaderPatch.js';
import { createQuality } from '../core/quality.js';
import { createAudio } from '../core/audio.js';
import { t } from '../shared/i18n.js';
import { loadMap } from './data.js';
import { buildTerrain } from './terrain.js';
import { createFreeCam } from './freecam.js';
import { createDrone } from './drone.js';
import { buildRoadblocks, createRoadblockNotice, ROADBLOCK } from './roadblock.js';
import { joinRoadEnds } from './roadjoin.js';
import { gradeRoads } from './grading.js';
import { auditRoads } from './roadaudit.js';
import { Kit } from './assets/kit.js';
import { RoadIndex, Occupancy, seaDistSampler, stripSampler, inMap } from './layout.js';
import { buildRoads, roadWidth, surfaceLift } from './roads.js';
import { buildBuildings } from './buildings.js';
import { buildNature } from './nature.js';
import { dressPromenades } from './promenade.js';
import { buildLandmarks, completeRoundabout } from './landmarks.js';
import { buildLaemThaen } from './laemthaen.js';
import { buildKhaoSamMuk } from './khaosammuk.js';
import { buildHillRoads } from './hillroad.js';
import { buildViewpoint } from './viewpoint.js';
import { createBinoculars } from './binoculars.js';
import { buildFishingVillage } from './fishingvillage.js';
import { createChunkCuller } from './chunkcull.js';
import { buildWalkingStreet } from './walkingstreet.js';
import { buildNavyPier } from './navypier.js';
import { createBobbingBoats } from './boats.js';
import { buildBeach } from './beach.js';
import { buildCollision } from './collision.js';
import { createPlayer } from './player.js';
import { createThirdPersonCamera } from './camera.js';
import { createHub } from './hub.js';
import { createMultiplayer } from './multiplayer.js';
import { createCoop } from './coop.js';
import { loadProfile, wearLook } from '../shared/avatar.js';
import { showTitle } from './title.js';
import * as P from '../shared/progress.js';
import { GAMES } from '../games.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const $ = id => document.getElementById(id);
// where the kid starts: on the sand mid-beach, looking up the coast to Khao Sam Muk
const START = { x: 318, z: 985, yaw: Math.atan2(-0.318, -0.948) };

async function boot() {
  if (params.has('reset')) P.reset();                  // ?reset=1 → new game
  P.load();
  $('loading').textContent = t('loading');
  $('credit').textContent = t('credit');

  const map = await loadMap();
  completeRoundabout(map);                                            // the bake clips the ring's far side
  const joins = joinRoadEnds(map);                                    // close small gaps between roads
  const graded = gradeRoads(map);                                     // smooth, level roads that never dip under the sea
  const renderer = createRenderer($('c'));
  const scene = new THREE.Scene();
  scene.fog = createFog();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 1.0;
  scene.add(createSky());

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 32000);
  const lights = createLights(scene);
  const terrain = buildTerrain(map);
  scene.add(terrain.group);
  const sea = createSea(map);
  scene.add(sea.group);

  // static town geometry, merged per (chunk, material)
  const t0 = performance.now();
  const kit = new Kit();
  const layout = { occ: new Occupancy(), roadIdx: new RoadIndex(map.roads, roadWidth), seaDist: seaDistSampler(map, terrain.seaDist) };
  layout.strip = stripSampler(map, layout.seaDist);                  // coastal strip + inland corridors (road 3137, Khao Sam Muk): dressed
  layout.walkStrip = stripSampler(map, layout.seaDist, c => ROADBLOCK.closed.includes(c.n));   // …minus the closed ones: walkable
  layout.buildStrip = stripSampler(map, layout.seaDist, c => c.bare);   // …minus road-only links: where buildings may go
  const promenades = buildRoads(kit, map, layout.seaDist, layout.roadIdx);
  const landmarks = buildLandmarks(kit, scene, map, layout);         // first, so the island stays clear
  const laem = buildLaemThaen(kit, map, layout, scene);                // park, plaza, lattice pier, boulders
  const viewpoint = buildViewpoint(kit, map, layout);                   // จุดชมวิว terrace (before the hill forest, so trees keep off the view)
  const ksm = buildKhaoSamMuk(kit, scene, map, layout);                // seawall, rocks, hill forest, monkeys, mussel poles
  const hillRoads = buildHillRoads(kit, map, layout);                  // red-white kerbs, guardrails, lamps, monkeys on the hill roads
  const village = buildFishingVillage(kit, map, layout, scene);               // stilt houses, jetties, boats, the long pier
  const walking = buildWalkingStreet(kit, map, layout);                // market stalls, bulbs, the paved seafront lot
  const navyFleet = [], navy = buildNavyPier(kit, map, layout, navyFleet);   // สะพานราชนาวี
  createBobbingBoats(scene, navyFleet);
  const promenade = dressPromenades(kit, map, layout, promenades);   // before buildings/beach so they keep off it
  const counts = buildBuildings(kit, map, layout, START);
  const beach = buildBeach(map, layout, kit);          // before trees so trees avoid the umbrellas
  scene.add(beach.group);
  const inZone = (x, z) => landmarks.walkZones.some(w => (x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r);
  const roadblocks = buildRoadblocks(kit, scene, map, layout, (x, z) => inMap(map, x, z) && (layout.walkStrip(x, z) <= 4 || inZone(x, z)));   // fence off road 3137 (and every road out)
  const town = kit.build();
  scene.add(town);
  const planted = { palm: [...promenade.palms, ...beach.palms] };      // trees other modules planted, by species
  for (const set of [ksm.trees, laem.trees, landmarks.trees]) for (const [sp, list] of Object.entries(set)) (planted[sp] ||= []).push(...list);
  const nature = buildNature(map, layout, planted);
  scene.add(nature.group);
  if (DEBUG) console.log('town', counts, 'beach', beach.counts, 'promenade', { runs: promenades.length, palms: promenade.palms.length, stalls: promenade.stalls.length }, 'trees', nature.counts, `${town.children.length} meshes, ${(kit.tris / 1e3).toFixed(0)}k tris, ${(performance.now() - t0).toFixed(0)} ms`);

  const collision = buildCollision(map, layout.seaDist, { buildings: counts, nature, poles: beach.poles, solids: [...laem.solids, ...ksm.solids, ...hillRoads.solids, ...viewpoint.solids, ...village.solids, ...walking.solids, ...navy.solids, ...roadblocks.solids], decks: [...laem.decks, ...village.decks, ...navy.decks, ...viewpoint.decks], strip: layout.walkStrip });
  for (const s of [...landmarks.solids, ...beach.solids]) collision.circle(s.x, s.z, s.r, s.top);
  collision.walkZones.push(...landmarks.walkZones);                  // the whole roundabout is walkable, even its inland side
  const input = createInput($('c'));
  const touch = createTouchControls($('hud'), input);
  // audio can only start after a user gesture (iOS / Chrome autoplay rules)
  const audio = createAudio();
  const unlock = () => audio.unlock();
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  // how high the walkable surface is above the terrain: piers/plazas (decks), roads, pavements
  const lift = (x, z) => { const d = collision.deckAt(x, z); return d > -Infinity ? Math.max(0, d - map.heightAt(x, z)) : surfaceLift(layout.roadIdx, x, z); };
  const profile = loadProfile();
  wearLook(profile.look);                                            // the kid (and mini-game kids) wear the chosen look
  const player = createPlayer(scene, map, collision, input, lift);
  player.place(START.x, START.z, START.yaw);
  const tpc = createThirdPersonCamera(camera, input, map, collision);
  tpc.setYaw(START.yaw + Math.PI);
  // ?view=beach|town|air → fixed free-camera shots for before/after screenshots
  const cam = createFreeCam(camera, input, map);
  let free = params.has('view');
  if (free) cam.setView(params.get('view'));
  if (DEBUG) addEventListener('keydown', e => { if (e.code === 'KeyC') free = !free; });
  // mini-games: while one runs, the hub pauses and the game renders its own scene
  let game = null, gameMod = null, gameId = null, loading = false;
  /** opts.coop: co-op session (see coop.js) for games that support it. */
  const startGame = (id, opts = {}) => {
    const def = GAMES[id];
    if (!def || game || loading) return false;     // one game at a time (double taps)
    loading = true;
    document.body.classList.add('in-game', 'fading');
    def.load().then(mod => {
      loading = false;
      gameMod = mod; gameId = id;
      game = mod.start({
        renderer, input, touch, audio, progress: P, root: $('hud'), coop: opts.coop || null,
        onExit: res => {
          document.body.classList.add('fading');
          setTimeout(() => {
            gameMod.stop(); game = null;
            audio.play('coin');
            hub.finishGame(gameId, res);
            document.body.classList.remove('in-game');
            setTimeout(() => document.body.classList.remove('fading'), 60);
          }, 350);
        },
      });
      setTimeout(() => document.body.classList.remove('fading'), 120);
    }).catch(e => { loading = false; console.error(e); document.body.classList.remove('in-game', 'fading'); });
    return true;
  };
  const binos = createBinoculars({ spots: viewpoint.scopes, camera, input, map, root: $('hud'), audio, player, toast: m => { hub.hud.toast(m); audio.play('coin'); } });   // look through the viewpoint's coin binoculars
  const hub = createHub({ scene, map, collision, seaDist: layout.seaDist, start: START, buildings: counts, beach, player, camera: tpc, root: $('hud'), startGame, audio, lift, input, welcome: landmarks.welcome, viewpoint: viewpoint.place, scopes: binos });

  const culler = createChunkCuller([town, beach.group]);             // hide map chunks far behind the haze
  const fx = createPostFX(renderer, scene, camera);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 64 : 50;          // portrait phones: see more around the kid
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();
  const quality = createQuality(renderer, resize);

  // local Wi-Fi multiplayer (only when served by tools/serve.py)
  const mp = createMultiplayer({ scene, root: $('hud'), camera, player, hub, map, lift, collision, audio, profile, busy: () => (game ? gameId : null) });
  const roadNotice = createRoadblockNotice(roadblocks.spots, player, msg => hub.hud.toast(msg));
  const drone = createDrone({ camera, input, map, root: $('hud'), canvas: $('c'), player, tpc, audio });   // 🚁 overlook any area from above
  const coop = createCoop({ root: $('hud'), mp, hub, startGame, audio });   // co-op lobbies (banana boat with friends)

  // ?bots=N: fake players (own relay connections) that roam and ride the red trucks — for testing
  let bots = null;
  if (params.has('bots')) import('./mpbots.js').then(m => { bots = m.createBots(+params.get('bots') || 3, { map, lift, collision, trucks: hub.trucks, player }); });

  addSystem((dt, time) => {
    U.time.value = time;
    mp.update(dt, !game && !free);
    coop.update(dt, !!game || loading);
    bots?.update(dt);
    if (game) { game.update(dt, time); input.endFrame(); return; }
    let focus;
    if (free) { cam.update(dt); focus = cam.target; }
    else if (drone.active) { drone.update(dt); focus = drone.target; hub.update(dt); }
    else if (binos.active) { binos.update(dt); focus = binos.focus; hub.update(dt); }
    else {
      if (!hub.seated) player.update(dt, tpc.state.yaw, hub.frozen);
      roadNotice(dt);
      hub.update(dt);                                    // trucks, NPCs; seats the kid when riding
      tpc.update(dt, player.state); focus = tpc.target;
    }
    if (free) hub.update(dt);
    // near plane grows with height: keeps depth precision for the sea/shore from the air
    const above = camera.position.y - Math.max(map.heightAt(camera.position.x, camera.position.z), map.sea);
    const near = binos.active ? binos.near : Math.min(40, Math.max(0.3, above * 0.02));
    if (Math.abs(near - camera.near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
    lights.follow(focus, camera.position.y - focus.y);
    fx.setFocus(focus, camera.position.y - focus.y);
    sea.update(camera);
    nature.update(camera.position);
    culler.update(dt, camera.position, map.heightAt(camera.position.x, camera.position.z));
    fx.setTiltShift((free && cam.state.tilt && cam.state.pitch > 0.7) || drone.tiltShift, 0.5);
    input.endFrame();
  });

  const dbg = DEBUG ? debugOverlay(renderer, camera) : null;
  startLoop(dt => {
    renderer.info.reset();
    if (game) game.render(dt); else fx.render(dt);
    quality.update(dt);
    dbg?.(dt, quality.ratio);
  });
  $('loading').textContent = '';
  if (!params.has('view') && !params.has('notitle')) showTitle($('hud'), { onStart: () => audio.unlock() });

  // bench(n): median GPU+CPU ms per full frame, measured synchronously (not limited by rAF throttling)
  const bench = (n = 20, warm = 30) => {
    const gl = renderer.getContext(), px = new Uint8Array(4), ms = [];
    for (let i = 0; i < warm; i++) tick(1 / 60);          // let camera/LOD settle at the new spot
    for (let i = 0; i < n; i++) {
      tick(1 / 60);
      const t = performance.now();
      renderer.info.reset();
      fx.render(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      ms.push(performance.now() - t);
    }
    ms.sort((a, b) => a - b);
    return { ms: +ms[n >> 1].toFixed(1), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  window.__game = { THREE, renderer, scene, camera, map, cam, tpc, player, collision, fx, sea, lights, layout, town, nature, hillRoads, viewpoint, binos, roadblocks, drone, joins, graded, auditRoads: () => auditRoads({ map, collision, layout, lift }), hub, P, bench, tick, startGame, audio, counts, mp, coop, input, get bots() { return bots; }, get game() { return game; } };
}

function debugOverlay(renderer, camera) {
  const el = $('debug');
  el.hidden = false;
  renderer.info.autoReset = false;
  let acc = 0, frames = 0;
  return (dt, ratio) => {
    acc += dt; frames++;
    if (acc < 0.5) return;
    const i = renderer.info.render, p = camera.position;
    el.textContent = `${(frames / acc).toFixed(0)} fps\ncalls ${i.calls}  tris ${(i.triangles / 1e6).toFixed(2)}M\n`
      + `cam ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  res ×${ratio.toFixed(2)}`;
    acc = frames = 0;
  };
}

boot().catch(e => {
  console.error(e);
  $('loading').textContent = `${t('loadError')}: ${e.message}`;
});
