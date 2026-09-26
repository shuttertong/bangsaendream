// Underwater look for built-in materials (CLAUDE.md §5.7): light is absorbed with depth
// (red first, then green, then blue), a Voronoi caustic web plays on surfaces below the
// water line, and separate fogs apply under water and in the air. Optional sway for
// seaweed / fish (vertex animation, weighted by height above the object's base).
import * as THREE from 'three';
import { patch, replaceInclude, prelude } from '../core/shaderPatch.js';

export function underwaterUniforms(o = {}) {
  return {
    uwY: { value: o.waterY ?? 0 },
    uwTime: { value: 0 },
    uwAbsorb: { value: new THREE.Vector3(...(o.absorb ?? [0.42, 0.11, 0.06])) },
    uwShallow: { value: new THREE.Color(o.shallow ?? '#2aa6b0') },
    uwDeep: { value: new THREE.Color(o.deep ?? '#06324a') },
    uwDensity: { value: o.density ?? 0.034 },
    uwAir: { value: new THREE.Color(o.air ?? '#0c1430') },
    uwAirDensity: { value: o.airDensity ?? 0.0014 },
    uwCaustic: { value: new THREE.Color(o.caustic ?? '#d8fff0') },
    uwCausticStrength: { value: o.causticStrength ?? 0.5 },
    uwLight: { value: new THREE.Vector3(...(o.light ?? [0, 6, 0])) },   // caustics are brightest under this point
  };
}

const VERT_PARS = /* glsl */`
uniform float uwTime;
varying vec3 vUwWorld;
#ifdef UW_SWAY
attribute float sway;
#endif`;

const VERT_SWAY = /* glsl */`
#include <begin_vertex>
#ifdef UW_SWAY
  transformed.x += sin(uwTime * 1.6 + position.y * 1.3 + position.z * 0.7) * sway * 0.25;
  transformed.z += cos(uwTime * 1.2 + position.y * 1.1) * sway * 0.12;
#endif`;

const VERT_WORLD = /* glsl */`
#include <project_vertex>
{
  vec4 uwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    uwp = instanceMatrix * uwp;
  #endif
  vUwWorld = (modelMatrix * uwp).xyz;
}`;

const FRAG_PARS = /* glsl */`
uniform float uwY, uwTime, uwDensity, uwAirDensity, uwCausticStrength;
uniform vec3 uwAbsorb, uwShallow, uwDeep, uwAir, uwCaustic, uwLight;
varying vec3 vUwWorld;
vec2 uwHash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float uwCausticWeb(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = 0.5 + 0.5 * sin(uwTime * 0.9 + 6.2831 * uwHash(i + g));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return 1.0 - smoothstep(0.0, 0.14, d2 - d1);     // bright where two cells meet
}`;

const FRAG = /* glsl */`
#include <fog_fragment>
{
  vec3 wp = vUwWorld;
  float depth = uwY - wp.y;
  float dist = length(wp - cameraPosition);
  if (depth > 0.0) {
    float camAbove = max(cameraPosition.y - uwY, 0.0);
    float under = dist * clamp(depth / max(depth + camAbove, 1e-3), 0.0, 1.0);
    gl_FragColor.rgb *= exp(-uwAbsorb * (depth * 0.55 + under * 0.25));
    vec2 cp = vec2(wp.x, wp.z + wp.y * 0.7) * 0.55;
    float web = uwCausticWeb(cp) * 0.7 + uwCausticWeb(cp * 1.9 + 3.1) * 0.3;
    float near = exp(-length(wp.xz - uwLight.xz) * 0.09) * exp(-depth * 0.12);
    gl_FragColor.rgb += uwCaustic * web * near * uwCausticStrength;
    float f = 1.0 - exp(-uwDensity * under * 2.2);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(uwShallow, uwDeep, clamp(depth / 18.0, 0.0, 1.0)), f);
  } else {
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uwAir, 1.0 - exp(-uwAirDensity * dist));
  }
}`;

/** Patch a built-in material. sway: true for materials whose geometry has a `sway` attribute. */
export function applyUnderwater(material, uniforms, { sway = false } = {}) {
  if (sway) material.defines = { ...(material.defines || {}), UW_SWAY: 1 };
  return patch(material, {
    key: `underwater${sway ? '_sway' : ''}`,
    uniforms,
    apply(shader) {
      prelude(shader, 'vertex', VERT_PARS);
      replaceInclude(shader, 'vertex', 'begin_vertex', VERT_SWAY);
      replaceInclude(shader, 'vertex', 'project_vertex', VERT_WORLD);
      prelude(shader, 'fragment', FRAG_PARS);
      replaceInclude(shader, 'fragment', 'fog_fragment', FRAG);
    },
  });
}

/** Lambert + vertex colours + underwater. */
export const uwMaterial = (uniforms, opts = {}, sway = false) =>
  applyUnderwater(new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }), uniforms, { sway });
