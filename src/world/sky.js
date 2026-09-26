// Sky dome: zenith→horizon gradient, soft sun glow, procedural clouds. Also renders
// itself + a ground disc into a PMREM environment map (blue-tinted shadows, soft
// reflections).
import * as THREE from 'three';
import { PALETTE } from '../shared/palette.js';
import { NOISE_GLSL, U } from '../core/shaderPatch.js';

const R = 20000;

export const skyUniforms = {
  zenith: { value: new THREE.Color(PALETTE.skyZenith) },
  horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
  haze: { value: new THREE.Color(PALETTE.haze) },
  sunColor: { value: new THREE.Color(PALETTE.sun) },
  sunDir: { value: new THREE.Vector3(...PALETTE.sunDir).normalize() },
  cloudCover: { value: 0.46 },
  time: U.time,
};

const vertexShader = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;   // always at the far plane
}`;

const fragmentShader = /* glsl */`
uniform vec3 zenith, horizon, haze, sunColor, sunDir;
uniform float cloudCover, time;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float e = max(d.y, 0.0);
  vec3 col = mix(horizon, zenith, pow(e, 0.55));
  col = mix(col, haze, exp(-max(d.y, 0.0) * 28.0) * 0.85);     // milky band at the horizon
  float s = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.28 + pow(s, 6.0) * 0.08);

  // clouds on a plane above the camera
  if (d.y > 0.01) {
    vec2 uv = d.xz / (d.y + 0.08) * 1.6 + vec2(time * 0.004, time * 0.0015);
    float n = bsFbm(vec3(uv, 0.0)) * 0.75 + bsFbm(vec3(uv * 3.1, 1.7)) * 0.25;
    float c = smoothstep(cloudCover, cloudCover + 0.22, n) * smoothstep(0.01, 0.18, d.y);
    vec3 cloud = mix(vec3(0.93, 0.95, 0.98), vec3(1.0, 0.98, 0.94), s) * (0.9 + 0.12 * n);
    col = mix(col, cloud, c * 0.85);
  }
  // below the horizon: haze colour (hidden by the sea / terrain anyway)
  col = mix(col, haze, smoothstep(0.0, -0.05, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: skyUniforms, vertexShader, fragmentShader,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

export function createSky() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24), skyMaterial());
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'sky';
  mesh.onBeforeRender = (_r, _s, cam) => mesh.position.copy(cam.position);
  return mesh;
}

/** PMREM environment: sky dome + a ground disc in the hemisphere ground colour. */
export function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), skyMaterial()));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.hemiGround }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  env.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0, 0.1, 400);
  pmrem.dispose();
  return rt.texture;
}
