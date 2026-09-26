// Height haze (aerial perspective). Replaces the three.js fog chunks so haze is
// thicker near the ground, integrated along the view ray. From the ground far things
// fade to white; from above the view stays clear. Works on any material with fog:true
// once applyHaze() has been called on it.
import * as THREE from 'three';
import { patch, replaceInclude, prelude } from '../core/shaderPatch.js';
import { PALETTE, ATMOS } from '../shared/palette.js';

export const hazeUniforms = {
  hazeHeight: { value: ATMOS.hazeHeight },
  hazeSunDir: { value: new THREE.Vector3(...PALETTE.sunDir).normalize() },
  hazeSunColor: { value: new THREE.Color(PALETTE.hazeSun) },
};

// Shared with sky.js / water.js so every surface fades to exactly the same colour.
export const HAZE_GLSL = /* glsl */`
float hazeAmount(vec3 camPos, vec3 wp, float density, float height) {
  float dist = length(wp - camPos);
  float k = 1.0 / height;
  float h0 = max(camPos.y, 0.0), h1 = max(wp.y, 0.0);
  float dy = h1 - h0;
  // optical depth of an exponential layer: ∫ d·e^(-y/H) along the ray
  float od = abs(dy) < 0.01 ? exp(-h0 * k) * dist
           : dist * (exp(-h0 * k) - exp(-h1 * k)) / (dy * k);
  od *= density;
  return 1.0 - exp(-od * od);   // squared: clear nearby, white quickly in the distance
}
vec3 hazeColor(vec3 base, vec3 sunCol, vec3 sunDir, vec3 viewDir) {
  float s = pow(max(dot(viewDir, sunDir), 0.0), 6.0);
  return mix(base, sunCol, s * 0.6);
}
`;

const VERT_PARS = /* glsl */`
#ifdef USE_FOG
varying vec3 vHazeWorld;
#endif`;

const VERT = /* glsl */`
#ifdef USE_FOG
  vec4 hazeWp = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    hazeWp = batchingMatrix * hazeWp;
  #endif
  #ifdef USE_INSTANCING
    hazeWp = instanceMatrix * hazeWp;
  #endif
  vHazeWorld = (modelMatrix * hazeWp).xyz;
#endif`;

const FRAG_PARS = /* glsl */`
#ifdef USE_FOG
uniform vec3 fogColor;
uniform float fogDensity;
uniform float hazeHeight;
uniform vec3 hazeSunDir;
uniform vec3 hazeSunColor;
varying vec3 vHazeWorld;
${HAZE_GLSL}
#endif`;

const FRAG = /* glsl */`
#ifdef USE_FOG
  {
    vec3 hv = normalize(vHazeWorld - cameraPosition);
    float hf = hazeAmount(cameraPosition, vHazeWorld, fogDensity, hazeHeight);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor(fogColor, hazeSunColor, hazeSunDir, hv), hf);
  }
#endif`;

export function applyHaze(material) {
  return patch(material, {
    key: 'haze',
    uniforms: hazeUniforms,
    apply(shader) {
      prelude(shader, 'vertex', VERT_PARS);
      replaceInclude(shader, 'vertex', 'fog_vertex', VERT);
      replaceInclude(shader, 'fragment', 'fog_pars_fragment', FRAG_PARS);
      replaceInclude(shader, 'fragment', 'fog_fragment', FRAG);
    },
  });
}

export function createFog() {
  return new THREE.FogExp2(PALETTE.haze, ATMOS.fogDensity);
}
