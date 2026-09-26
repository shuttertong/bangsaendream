// Stylized Bang Saen sea (CLAUDE.md §5.7): a fine wave grid that follows the camera,
// a flat ring for the distance, Fresnel sky reflection, 3-step depth colour, shore
// foam, and small waves that fade as the camera rises.
import * as THREE from 'three';
import { PALETTE, ATMOS } from '../shared/palette.js';
import { NOISE_GLSL, U } from '../core/shaderPatch.js';
import { HAZE_GLSL, hazeUniforms } from './haze.js';
import { skyUniforms } from './sky.js';

const GRID = 1600, GRID_SEG = 320, CELL = GRID / GRID_SEG, RING_OUT = 25000;

const vertexShader = /* glsl */`
uniform sampler2D heightTex;
uniform vec4 gridInfo;      // x0, z0, width, depth of the height grid
uniform vec2 gridRes;
uniform vec2 waveCentre;
uniform float time, sea, waveAmp;
varying vec3 vWorld;
varying vec2 vSlope;

float groundAt(vec2 xz) {
  vec2 uv = clamp((xz - gridInfo.xy) / gridInfo.zw, 0.0, 1.0);
  uv = (uv * (gridRes - 1.0) + 0.5) / gridRes;
  return texture2D(heightTex, uv).r;
}

// 4 directional swells, mostly rolling in from the south-west (Gulf of Thailand)
const vec4 W[4] = vec4[4](   // dir.x, dir.y, wavelength, amplitude
  vec4( 0.80, -0.60, 38.0, 0.16),
  vec4( 0.95, -0.30, 21.0, 0.09),
  vec4( 0.55, -0.83, 13.0, 0.05),
  vec4( 0.99,  0.12,  7.5, 0.025));

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float depth = sea - groundAt(wp.xz);
  float amp = waveAmp * smoothstep(0.0, 1.6, depth) * (1.0 - smoothstep(520.0, 720.0, length(wp.xz - waveCentre)));
  float h = 0.0; vec2 slope = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 d = normalize(W[i].xy);
    float k = 6.2831853 / W[i].z;
    float ph = dot(d, wp.xz) * k - time * sqrt(9.8 * k);
    h += W[i].w * sin(ph);
    slope += W[i].w * k * d * cos(ph);
  }
  wp.y = sea + h * amp;
  vSlope = slope * amp;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragmentShader = /* glsl */`
uniform sampler2D heightTex;
uniform vec4 gridInfo;
uniform vec2 gridRes;
uniform float time, sea, detail;
uniform vec3 shallow, mid, deep, foamColor, sunColor, sunDir;
uniform vec3 zenith, horizon;
uniform vec3 fogColor; uniform float fogDensity;
uniform float hazeHeight; uniform vec3 hazeSunDir, hazeSunColor;
varying vec3 vWorld;
varying vec2 vSlope;
${NOISE_GLSL}
${HAZE_GLSL}

float groundAt(vec2 xz) {
  vec2 uv = clamp((xz - gridInfo.xy) / gridInfo.zw, 0.0, 1.0);
  uv = (uv * (gridRes - 1.0) + 0.5) / gridRes;
  return texture2D(heightTex, uv).r;
}

vec2 ripple(vec2 p, float s) {       // gradient of scrolling value noise
  vec3 q = vec3(p * s, time * 0.35);
  float e = 0.15;
  float n = bsNoise(q);
  return vec2(bsNoise(q + vec3(e, 0, 0)) - n, bsNoise(q + vec3(0, e, 0)) - n) / e;
}

uniform vec2 waveCentre;
void main() {
#ifdef FAR
  { vec2 o = abs(vWorld.xz - waveCentre); if (max(o.x, o.y) < ${(GRID / 2 - CELL).toFixed(1)}) discard; }
#endif
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float wet = sea - groundAt(vWorld.xz);
  if (wet < -0.03) discard;          // over land: never z-fight with the ground
  float depth = max(wet, 0.0);

  // normal: swell slope + two ripple layers that fade with distance
  float df = detail * (1.0 - smoothstep(60.0, 420.0, dist));
  vec2 g = vSlope + (ripple(vWorld.xz + vec2(time * 0.6, 0.0), 0.35) * 0.05
                   + ripple(vWorld.xz - vec2(0.0, time * 0.4), 1.1) * 0.025) * df;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

  // 3-step depth colour, close steps so it doesn't blotch from above
  vec3 body = mix(shallow, mid, smoothstep(0.4, 3.5, depth));
  body = mix(body, deep, smoothstep(3.0, 11.0, depth));
  float ndl = max(dot(N, sunDir), 0.0);
  body *= 0.55 + 0.45 * ndl;

  // Fresnel sky reflection
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  vec3 sky = mix(horizon, zenith, pow(R.y, 0.55));
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(body, sky, clamp(F, 0.0, 1.0) * 0.9);
  float spec = pow(max(dot(R, sunDir), 0.0), 220.0);
  col += sunColor * spec * 2.4;

  // shore foam: a wobbling band at the waterline + streaks in the shallows
  float n = bsFbm(vec3(vWorld.xz * 0.18, time * 0.25));
  float band = 1.0 - smoothstep(0.0, 0.22 + 0.18 * sin(time * 0.9 + vWorld.x * 0.05 + vWorld.z * 0.03), depth);
  float streak = smoothstep(0.62, 0.8, n) * (1.0 - smoothstep(0.2, 1.1, depth));
  float foam = clamp(band * smoothstep(0.35, 0.6, n + 0.25) + streak * 0.7, 0.0, 1.0);
  col = mix(col, foamColor, foam);

  // shallow water is see-through (sand shows below)
  float alpha = mix(0.35, 1.0, smoothstep(0.05, 2.6, depth));
  alpha = max(alpha, foam);

  float hf = hazeAmount(cameraPosition, vWorld, fogDensity, hazeHeight);
  col = mix(col, hazeColor(fogColor, hazeSunColor, hazeSunDir, -V), hf);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSea(map) {
  const c = hex => new THREE.Color(hex);
  const uniforms = {
    heightTex: { value: map.heightTexture() },
    gridInfo: { value: new THREE.Vector4(map.core.x0, map.core.z0, map.size.w, map.size.d) },
    gridRes: { value: new THREE.Vector2(map.core.nx, map.core.nz) },
    waveCentre: { value: new THREE.Vector2() },
    time: U.time,
    sea: { value: map.sea },
    waveAmp: { value: 1 },
    detail: { value: 1 },
    shallow: { value: c(PALETTE.seaShallow) }, mid: { value: c(PALETTE.seaMid) }, deep: { value: c(PALETTE.seaDeep) },
    foamColor: { value: c(PALETTE.foam) },
    sunColor: { value: c(PALETTE.sun) },
    sunDir: skyUniforms.sunDir,
    zenith: skyUniforms.zenith, horizon: skyUniforms.horizon,
    fogColor: { value: c(PALETTE.haze) }, fogDensity: { value: ATMOS.fogDensity },
    ...hazeUniforms,
  };
  // both materials share one uniforms object; the ring skips pixels the grid covers
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
  const farMat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, defines: { FAR: 1 } });

  const near = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID, GRID_SEG, GRID_SEG).rotateX(-Math.PI / 2), mat);
  const far = new THREE.Mesh(new THREE.RingGeometry(GRID * 0.45, RING_OUT, 96, 1).rotateX(-Math.PI / 2), farMat);
  near.frustumCulled = far.frustumCulled = false;
  near.name = 'sea-near'; far.name = 'sea-far';
  near.renderOrder = far.renderOrder = 1;
  const group = new THREE.Group();
  group.add(near, far);

  /** Follow the camera (snapped to grid cells so the waves don't swim). */
  function update(camera) {
    const x = Math.round(camera.position.x / CELL) * CELL, z = Math.round(camera.position.z / CELL) * CELL;
    near.position.set(x, 0, z);
    far.position.set(x, 0, z);
    uniforms.waveCentre.value.set(x, z);
    const h = Math.max(0, camera.position.y - map.sea);
    uniforms.waveAmp.value = 1 / (1 + h / 90);
    uniforms.detail.value = 1 / (1 + h / 60);
  }

  return { group, update, uniforms };
}
