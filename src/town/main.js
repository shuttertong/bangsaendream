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
import { t } from '../shared/i18n.js';
import { loadMap } from './data.js';
import { buildTerrain } from './terrain.js';
import { createFreeCam } from './freecam.js';
import { Kit } from './assets/kit.js';
import { RoadIndex, Occupancy, seaDistSampler } from './layout.js';
import { buildRoads, roadWidth } from './roads.js';
import { buildBuildings } from './buildings.js';
import { buildNature } from './nature.js';
import { buildBeach } from './beach.js';
import { buildCollision } from './collision.js';
import { createPlayer } from './player.js';
import { createThirdPersonCamera } from './camera.js';
import { createHub } from './hub.js';
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
  buildRoads(kit, map);
  const counts = buildBuildings(kit, map, layout, START);
  const beach = buildBeach(map, layout, kit);          // before trees so trees avoid the umbrellas
  scene.add(beach.group);
  const town = kit.build();
  scene.add(town);
  const nature = buildNature(map, layout);
  scene.add(nature.group);
  if (DEBUG) console.log('town', counts, 'beach', beach.counts, 'trees', nature.counts, `${town.children.length} meshes, ${(kit.tris / 1e3).toFixed(0)}k tris, ${(performance.now() - t0).toFixed(0)} ms`);

  const collision = buildCollision(map, layout.seaDist, { buildings: counts, nature, poles: beach.poles });
  const input = createInput($('c'));
  const touch = createTouchControls($('hud'), input);
  const player = createPlayer(scene, map, collision, input);
  player.place(START.x, START.z, START.yaw);
  const tpc = createThirdPersonCamera(camera, input, map, collision);
  tpc.setYaw(START.yaw + Math.PI);
  // ?view=beach|town|air → fixed free-camera shots for before/after screenshots
  const cam = createFreeCam(camera, input, map);
  let free = params.has('view');
  if (free) cam.setView(params.get('view'));
  if (DEBUG) addEventListener('keydown', e => { if (e.code === 'KeyC') free = !free; });
  // mini-games: while one runs, the hub pauses and the game renders its own scene
  let game = null, gameMod = null, gameId = null;
  const startGame = id => {
    const def = GAMES[id];
    if (!def) return false;
    document.body.classList.add('in-game', 'fading');
    def.load().then(mod => {
      gameMod = mod; gameId = id;
      game = mod.start({
        renderer, input, touch, progress: P, root: $('hud'),
        onExit: res => {
          document.body.classList.add('fading');
          setTimeout(() => {
            gameMod.stop(); game = null;
            hub.finishGame(gameId, res);
            document.body.classList.remove('in-game');
            setTimeout(() => document.body.classList.remove('fading'), 60);
          }, 350);
        },
      });
      setTimeout(() => document.body.classList.remove('fading'), 120);
    }).catch(e => { console.error(e); document.body.classList.remove('in-game', 'fading'); });
    return true;
  };
  const hub = createHub({ scene, map, collision, seaDist: layout.seaDist, start: START, buildings: counts, beach, player, camera: tpc, root: $('hud'), startGame });

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

  addSystem((dt, time) => {
    U.time.value = time;
    if (game) { game.update(dt, time); input.endFrame(); return; }
    let focus;
    if (free) { cam.update(dt); focus = cam.target; }
    else { player.update(dt, tpc.state.yaw, hub.frozen); tpc.update(dt, player.state); focus = tpc.target; }
    hub.update(dt);
    // near plane grows with height: keeps depth precision for the sea/shore from the air
    const above = camera.position.y - Math.max(map.heightAt(camera.position.x, camera.position.z), map.sea);
    const near = Math.min(40, Math.max(0.3, above * 0.02));
    if (Math.abs(near - camera.near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
    lights.follow(focus, camera.position.y - focus.y);
    fx.setFocus(focus, camera.position.y - focus.y);
    sea.update(camera);
    nature.update(camera.position);
    fx.setTiltShift(free && cam.state.tilt && cam.state.pitch > 0.7, 0.5);
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
  window.__game = { THREE, renderer, scene, camera, map, cam, tpc, player, collision, fx, sea, lights, layout, town, nature, hub, P, bench, startGame, get game() { return game; } };
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
