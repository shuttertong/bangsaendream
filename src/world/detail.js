// Surface patch for the painted materials (CLAUDE.md §5.5): large-scale colour variation in world space
// (the "hand-painted" unevenness) and, on surfaces that ask for it, a close-up detail texture — grains of
// sand, the stones in the tar, blades of grass — that also bends the light (a normal) and fades out with
// distance. Everything comes from the textures in textures.js; the picture-quality level decides how much:
//   0  tone only, close by · 1  + relief (normals) and the wet-sand sheen · 2  + a second, larger layer.
// surfacePatch({ amp, scale, detail }): detail is a texture name ('sand', 'asphalt', 'plaster', 'bark' …),
// or 'ground' = sand / grass / rock mixed by the mesh's `kind` attribute (terrain.js).
import * as THREE from 'three';
import { replaceInclude, prelude } from '../core/shaderPatch.js';
import { TEX, TILE } from './textures.js';
import { gfx } from '../core/quality.js';
import { skyUniforms } from './sky.js';

// tone: how strongly the texture lightens / darkens the colour; bump: how strongly it tilts the surface; flat: always seen from above (ground, roads)
export const SURFACE = {
  sand: { tone: 0.5, bump: 0.75, flat: true },
  asphalt: { tone: 0.65, bump: 0.5, flat: true },
  plaster: { tone: 0.55, bump: 0.5 },
  bark: { tone: 0.75, bump: 1.0, big: false },                                // (no second layer: its rings would be a metre apart)
  rock: { tone: 0.7, bump: 0.9 },
  grass: { tone: 0.75, bump: 0.5, flat: true },
  ground: { tone: [0.5, 0.75, 0.7], bump: [0.75, 0.5, 0.9], flat: true },   // sand, grass, rock
};
export const DETAIL = {
  fade: [[14, 55], [30, 120], [60, 200]],                                   // metres from the camera over which the detail fades out, by level
  wide: 4, big: 0.137,                                                      // the second layer: fades `wide` × further, at `big` × the scale
  wet: { sheen: 0.5, base: 0.07, calm: 0.75 },                              // wet sand mirrors the sky: at a grazing angle, straight down; calm: how much smoother it is
};

const fade = { value: new THREE.Vector2(...DETAIL.fade[gfx.L.detail]) };
const live = [];                                      // WeakRefs to patched materials: their level is a shader #define
/** Apply the level's detail setting to every painted material (quality.onChange). */
export function setDetailLevel(n) {
  fade.value.set(...DETAIL.fade[n]);
  for (let i = live.length - 1; i >= 0; i--) {
    const m = live[i].deref();
    if (!m) { live.splice(i, 1); continue; }
    if (m.defines.BS_DETAIL !== n) { m.defines.BS_DETAIL = n; m.needsUpdate = true; }
  }
}

const f = v => v.toFixed(4);
const VERT_PARS = /* glsl */`
varying vec3 vNoiseWorld;
varying vec3 vBsN;
#ifdef BS_GROUND
  attribute vec4 kind;
  varying vec4 vBsKind;
#endif`;
const VERT = /* glsl */`
#include <worldpos_vertex>
{
  vec4 nwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    nwp = instanceMatrix * nwp;
  #endif
  vNoiseWorld = (modelMatrix * nwp).xyz;
  vBsN = inverseTransformDirection(transformedNormal, viewMatrix);
  #ifdef BS_GROUND
    vBsKind = kind;
  #endif
}`;

function fragPars(d, ground) {
  return /* glsl */`
varying vec3 vNoiseWorld;
varying vec3 vBsN;
uniform sampler2D bsNoiseTex;
${d ? 'uniform vec2 bsFade;' : ''}
${ground ? 'uniform sampler2D bsSand, bsGrass, bsRock; uniform vec3 bsZenith, bsHorizon; varying vec4 vBsKind;' : d ? 'uniform sampler2D bsTex;' : ''}`;
}

function fragColor({ amp, scale, detail }) {
  const d = SURFACE[detail], ground = detail === 'ground';
  let s = /* glsl */`
#include <color_fragment>
vec2 bsNu = (vNoiseWorld.xz + vNoiseWorld.y * vec2(0.37, 0.61)) * ${f(1 / scale)};
vec4 bsNa = texture2D(bsNoiseTex, bsNu * 0.125);
#ifdef BS_GROUND
  float bsN0 = dot(bsNa, vec4(0.17, 0.21, 0.14, 0.30)) + 0.18 * texture2D(bsNoiseTex, mat2(0.8, -0.6, 0.6, 0.8) * bsNu * 0.0431 + 0.4).g;   // (a second, larger pattern: the tile never shows from the air)
#else
  float bsN0 = dot(bsNa, vec4(0.35, 0.21, 0.14, 0.30));
#endif
diffuseColor.rgb *= 1.0 + (bsN0 - 0.5) * ${f(amp)};`;
  if (!d) return s;
  s += /* glsl */`
float bsDist = length(vNoiseWorld - cameraPosition);
float bsK = 1.0 - smoothstep(bsFade.x, bsFade.y, bsDist);
vec3 bsT = vec3(1.0, 0.0, 0.0), bsB = vec3(0.0, 0.0, 1.0);
vec2 bsUv = vNoiseWorld.xz;`;
  if (!d.flat) s += /* glsl */`
{ vec3 an = abs(vBsN);                                   // project along the axis the surface faces most
  if (an.y < max(an.x, an.z)) { bsB = vec3(0.0, 1.0, 0.0); if (an.x > an.z) { bsUv = vNoiseWorld.zy; bsT = vec3(0.0, 0.0, 1.0); } else bsUv = vNoiseWorld.xy; } }`;
  if (ground) s += /* glsl */`
vec3 bsW = vBsKind.xyz / max(vBsKind.x + vBsKind.y + vBsKind.z, 0.001);
vec4 bsD = texture2D(bsSand, bsUv * ${f(1 / TILE.sand)}) * bsW.x + texture2D(bsGrass, bsUv * ${f(1 / TILE.grass)}) * bsW.y + texture2D(bsRock, bsUv * ${f(1 / TILE.rock)}) * bsW.z;
float bsTone = dot(bsW, vec3(${d.tone.map(f).join(', ')})), bsBump = dot(bsW, vec3(${d.bump.map(f).join(', ')})) * (1.0 - vBsKind.w * ${f(DETAIL.wet.calm)});
#if BS_DETAIL >= 2
  float bsK2 = 1.0 - smoothstep(bsFade.x * ${f(DETAIL.wide)}, bsFade.y * ${f(DETAIL.wide)}, bsDist);
  vec4 bsD2 = texture2D(bsSand, bsUv * ${f(DETAIL.big / TILE.sand)} + 0.37) * bsW.x + texture2D(bsGrass, bsUv * ${f(DETAIL.big / TILE.grass)} + 0.37) * bsW.y + texture2D(bsRock, bsUv * ${f(DETAIL.big / TILE.rock)} + 0.37) * bsW.z;
#endif`;
  else s += /* glsl */`
vec4 bsD = texture2D(bsTex, bsUv * ${f(1 / TILE[detail])});
float bsTone = ${f(d.tone)}, bsBump = ${f(d.bump)};
#if BS_DETAIL >= 2 && ${d.big === false ? 0 : 1}
  float bsK2 = 1.0 - smoothstep(bsFade.x * ${f(DETAIL.wide)}, bsFade.y * ${f(DETAIL.wide)}, bsDist);
  vec4 bsD2 = texture2D(bsTex, bsUv * ${f(DETAIL.big / TILE[detail])} + 0.37);
#endif`;
  s += /* glsl */`
float bsLum = (bsD.z + bsD.w - 1.0) * bsK;              // tone + the small marks
vec2 bsG = (bsD.xy - 0.5) * bsK;
#if BS_DETAIL >= 2 && ${d.big === false ? 0 : 1}
  bsLum += (bsD2.z - 0.5) * bsK2 * 0.7;
  bsG += (bsD2.xy - 0.5) * bsK2 * 0.6;
#endif
diffuseColor.rgb *= 1.0 + bsLum * 2.0 * bsTone;`;
  return s;
}

const FRAG_NORMAL = /* glsl */`
#include <normal_fragment_maps>
#if BS_DETAIL >= 1
  normal = normalize(normal + mat3(viewMatrix) * ((bsT * bsG.x + bsB * bsG.y) * 2.0 * bsBump));
#endif`;
// wet sand at the waterline mirrors the sky, most of all at a grazing angle
const FRAG_WET = /* glsl */`
#if BS_DETAIL >= 1
  if (vBsKind.w > 0.004) {
    vec3 wn = inverseTransformDirection(normal, viewMatrix), wv = normalize(cameraPosition - vNoiseWorld);
    float fr = pow(1.0 - max(dot(wn, wv), 0.0), 3.0);
    vec3 sky = mix(bsHorizon, bsZenith, pow(max(reflect(-wv, wn).y, 0.0), 0.55));
    outgoingLight = mix(outgoingLight, sky, vBsKind.w * (${f(DETAIL.wet.base)} + ${f(DETAIL.wet.sheen)} * fr));
  }
#endif
#include <opaque_fragment>`;

/** The patch for shaderPatch.patch(). Call track(material) too, so the level reaches the material. */
export function surfacePatch({ amp = 0.28, scale = 24, detail = null } = {}) {
  const d = SURFACE[detail] || null, ground = detail === 'ground';
  const o = { amp, scale, detail: d ? detail : null };
  const uniforms = { bsNoiseTex: TEX.noise };
  if (d) uniforms.bsFade = fade;
  if (ground) Object.assign(uniforms, { bsSand: TEX.sand, bsGrass: TEX.grass, bsRock: TEX.rock, bsZenith: skyUniforms.zenith, bsHorizon: skyUniforms.horizon });
  else if (d) uniforms.bsTex = TEX[detail];
  return {
    key: `surf${amp}_${scale}_${o.detail || ''}`,
    uniforms,
    apply(shader) {
      prelude(shader, 'vertex', VERT_PARS);
      replaceInclude(shader, 'vertex', 'worldpos_vertex', VERT);
      prelude(shader, 'fragment', fragPars(d, ground));
      replaceInclude(shader, 'fragment', 'color_fragment', fragColor(o));
      if (d) replaceInclude(shader, 'fragment', 'normal_fragment_maps', FRAG_NORMAL);
      if (ground) replaceInclude(shader, 'fragment', 'opaque_fragment', FRAG_WET);
    },
  };
}

/** Give a patched material its #defines and keep it in step with the quality level. */
export function track(material, detail) {
  material.defines = { ...(material.defines || {}), BS_DETAIL: gfx.L.detail };
  if (detail === 'ground') material.defines.BS_GROUND = 1;
  live.push(new WeakRef(material));
  return material;
}
