// Hub boot + per-frame update. M1: terrain, sea, sky, haze, post-FX, free camera.
import * as THREE from 'three';
import { createRenderer, createLights } from '../world/render.js';
import { createSky, buildEnvironment } from '../world/sky.js';
import { createFog } from '../world/haze.js';
import { createSea } from '../world/water.js';
import { createPostFX } from '../world/postfx.js';
import { createInput } from '../core/input.js';
import { addSystem, startLoop } from '../core/loop.js';
import { U } from '../core/shaderPatch.js';
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

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const $ = id => document.getElementById(id);

async function boot() {
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
  const counts = buildBuildings(kit, map, layout);
  const beach = buildBeach(map, layout, kit);          // before trees so trees avoid the umbrellas
  scene.add(beach.group);
  const town = kit.build();
  scene.add(town);
  const nature = buildNature(map, layout);
  scene.add(nature.group);
  if (DEBUG) console.log('town', counts, 'beach', beach.counts, 'trees', nature.counts, `${town.children.length} meshes, ${(kit.tris / 1e3).toFixed(0)}k tris, ${(performance.now() - t0).toFixed(0)} ms`);

  const input = createInput($('c'));
  const cam = createFreeCam(camera, input, map);
  cam.setView(params.get('view') || 'beach');

  const fx = createPostFX(renderer, scene, camera);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    fx.setSize(innerWidth, innerHeight);
  });

  addSystem((dt, time) => {
    U.time.value = time;
    cam.update(dt);
    // near plane grows with height: keeps depth precision for the sea/shore from the air
    const above = camera.position.y - Math.max(map.heightAt(camera.position.x, camera.position.z), map.sea);
    const near = Math.min(40, Math.max(0.3, above * 0.02));
    if (Math.abs(near - camera.near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
    lights.follow(cam.target, camera.position.y - cam.target.y);
    sea.update(camera);
    nature.update(camera.position);
    fx.setTiltShift(cam.state.tilt && cam.state.pitch > 0.7, 0.5);
    input.endFrame();
  });

  const dbg = DEBUG ? debugOverlay(renderer, camera) : null;
  startLoop(dt => {
    renderer.info.reset();
    fx.render(dt);
    dbg?.(dt);
  });
  $('loading').textContent = '';

  // bench(n): median GPU+CPU ms per full frame, measured synchronously (not limited by rAF throttling)
  const bench = (n = 20) => {
    const gl = renderer.getContext(), px = new Uint8Array(4), ms = [];
    for (let i = 0; i < n; i++) {
      const t = performance.now();
      renderer.info.reset();
      fx.render(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      ms.push(performance.now() - t);
    }
    ms.sort((a, b) => a - b);
    return { ms: +ms[n >> 1].toFixed(1), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  window.__game = { THREE, renderer, scene, camera, map, cam, fx, sea, lights, layout, town, nature, bench };
}

function debugOverlay(renderer, camera) {
  const el = $('debug');
  el.hidden = false;
  renderer.info.autoReset = false;
  let acc = 0, frames = 0;
  return dt => {
    acc += dt; frames++;
    if (acc < 0.5) return;
    const i = renderer.info.render, p = camera.position;
    el.textContent = `${(frames / acc).toFixed(0)} fps\ncalls ${i.calls}  tris ${(i.triangles / 1e6).toFixed(2)}M\n`
      + `cam ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}`;
    acc = frames = 0;
  };
}

boot().catch(e => {
  console.error(e);
  $('loading').textContent = `${t('loadError')}: ${e.message}`;
});
