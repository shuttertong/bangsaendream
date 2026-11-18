// Base materials: MeshLambertMaterial + vertex colours, patched with world-space colour
// variation (hand-painted unevenness), an optional close-up detail texture (detail.js) and the height haze.
import * as THREE from 'three';
import { patch } from '../core/shaderPatch.js';
import { applyHaze } from './haze.js';
import { surfacePatch, track } from './detail.js';

/** Lambert + vertex colours + world noise + haze. detail: a close-up texture ('sand', 'asphalt', 'plaster', 'bark', 'rock', 'grass', or 'ground' with the terrain's `kind` attribute). */
export function paintedMaterial({ amp = 0.28, scale = 24, detail = null, ...opts } = {}) {
  const m = track(new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }), detail);
  patch(m, surfacePatch({ amp, scale, detail }));
  return applyHaze(m);
}

/** Standard (shiny) + vertex colours + haze, for metal roofs, glass, lamps. */
export function shinyMaterial(opts = {}) {
  const m = track(new THREE.MeshStandardMaterial({ vertexColors: true, ...opts }));
  patch(m, surfacePatch({ amp: 0.12, scale: 6 }));
  return applyHaze(m);
}

// Shared materials for the geometry kit, keyed by name. Colour comes from vertices.
const RECIPES = {
  ground: () => paintedMaterial({ amp: 0.3, scale: 18, detail: 'sand' }),
  road: () => paintedMaterial({ amp: 0.22, scale: 6, detail: 'asphalt', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  wall: () => paintedMaterial({ amp: 0.16, scale: 3, detail: 'plaster' }),      // walls, roofs, signs, awnings: one draw call
  wood: () => paintedMaterial({ amp: 0.3, scale: 1.2, detail: 'bark' }),     // tree bark (instanced)
  lit: () => applyHaze(new THREE.MeshBasicMaterial({ vertexColors: true })),   // shop interiors, signs at night
  metal: () => shinyMaterial({ metalness: 0.45, roughness: 0.45 }),
  glass: () => shinyMaterial({ metalness: 0.1, roughness: 0.12, envMapIntensity: 1.3 }),
};
const cache = new Map();

export function getMaterial(key) {
  if (!cache.has(key)) {
    if (!RECIPES[key]) throw new Error(`unknown material ${key}`);
    const m = RECIPES[key]();
    m.name = key;
    cache.set(key, m);
  }
  return cache.get(key);
}
