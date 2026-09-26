// Base materials: MeshLambertMaterial + vertex colours, patched with world-space colour
// noise (hand-painted unevenness) and the height haze.
import * as THREE from 'three';
import { patch, replaceInclude, prelude, NOISE_GLSL } from '../core/shaderPatch.js';
import { applyHaze } from './haze.js';

const worldNoise = (amp, scale) => ({
  key: `wnoise${amp}_${scale}`,
  apply(shader) {
    prelude(shader, 'vertex', 'varying vec3 vNoiseWorld;');
    replaceInclude(shader, 'vertex', 'worldpos_vertex', /* glsl */`
      #include <worldpos_vertex>
      {
        vec4 nwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
        #endif
        vNoiseWorld = (modelMatrix * nwp).xyz;
      }`);
    prelude(shader, 'fragment', `varying vec3 vNoiseWorld;\n${NOISE_GLSL}`);
    replaceInclude(shader, 'fragment', 'color_fragment', /* glsl */`
      #include <color_fragment>
      {
        vec3 np = vNoiseWorld * ${(1 / scale).toFixed(5)};
        float n = bsFbm(np) * 0.7 + bsNoise(np * 9.0) * 0.3;
        diffuseColor.rgb *= 1.0 + (n - 0.5) * ${amp.toFixed(3)};
      }`);
  },
});

/** Lambert + vertex colours + world noise + haze. */
export function paintedMaterial({ amp = 0.28, scale = 24, ...opts } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  patch(m, worldNoise(amp, scale));
  return applyHaze(m);
}

/** Standard (shiny) + vertex colours + haze, for metal roofs, glass, lamps. */
export function shinyMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...opts });
  patch(m, worldNoise(0.12, 6));
  return applyHaze(m);
}

// Shared materials for the geometry kit, keyed by name. Colour comes from vertices.
const RECIPES = {
  ground: () => paintedMaterial({ amp: 0.3, scale: 18 }),
  road: () => paintedMaterial({ amp: 0.22, scale: 6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  wall: () => paintedMaterial({ amp: 0.16, scale: 3 }),      // walls, roofs, signs, awnings: one draw call
  wood: () => paintedMaterial({ amp: 0.3, scale: 1.2 }),     // tree bark (instanced)
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
