// Renderer, lights and the player-following sun shadow (CLAUDE.md §5.1–5.2).
import * as THREE from 'three';
import { PALETTE, ATMOS } from '../shared/palette.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = ATMOS.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

const SHADOW_MAP = 4096, SHADOW_RANGE = 55, SUN_DIST = 400;

export function createLights(scene) {
  const dir = new THREE.Vector3(...PALETTE.sunDir).normalize();
  const sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2;
  const cam = sun.shadow.camera;
  cam.near = 1; cam.far = SUN_DIST * 2;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemiIntensity);
  scene.add(hemi);

  // light-space basis, fixed because the sun doesn't move
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const snapped = new THREE.Vector3();

  /** Centre the shadow box on `focus`, snapped to whole texels to stop shimmer. */
  function follow(focus, cameraHeight = 0) {
    const range = SHADOW_RANGE * (1 + Math.min(3, Math.max(0, cameraHeight - 20) / 60));
    if (cam.right !== range) {
      cam.left = cam.bottom = -range; cam.right = cam.top = range;
      cam.updateProjectionMatrix();
    }
    const texel = (2 * range) / SHADOW_MAP;
    const r = Math.round(focus.dot(right) / texel) * texel;
    const u = Math.round(focus.dot(up) / texel) * texel;
    const d = focus.dot(dir);
    snapped.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(dir, d);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).addScaledVector(dir, SUN_DIST);
  }

  return { sun, hemi, sunDir: dir, follow };
}
