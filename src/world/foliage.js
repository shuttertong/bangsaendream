// Foliage: a procedural leaf atlas and two materials —
//  • cards: camera-facing billboard leaf cards (trees' puffy crowns), with a matching
//    depth material so the cards also face the sun in the shadow pass;
//  • fronds: fixed double-sided alpha strips (palm leaves).
// Texture is greyscale-ish; vertex/instance colours give the species tint.
import * as THREE from 'three';
import { patch, replaceInclude, prelude } from '../core/shaderPatch.js';
import { applyHaze } from './haze.js';
import { rng } from '../core/rng.js';

export const CELLS = { broad: 0, needle: 1, comb: 2, flower: 3 };
const N = 4, S = 256;

function drawLeaf(g, x, y, len, wid, ang, shade) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = `rgb(${shade},${shade},${shade})`;
  g.beginPath(); g.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function atlas() {
  const cv = document.createElement('canvas');
  cv.width = S * N; cv.height = S;
  const g = cv.getContext('2d'), r = rng(7);
  g.clearRect(0, 0, cv.width, cv.height);
  // broadleaf clump: many small oval leaves inside a circle
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.42;
    drawLeaf(g, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 22 + r() * 16, 10 + r() * 6, r() * Math.PI * 2, 195 + r() * 60 | 0);
  }
  // needles (casuarina): drooping tufts inside a soft circle, so cards don't read as squares
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.36;
    const x = S * 1.5 + Math.cos(a) * d, y = S * 0.42 + Math.sin(a) * d * 0.8;
    const L = (24 + r() * 40) * (1 - d / (S * 0.5)), sh = 200 + r() * 55 | 0;
    g.strokeStyle = `rgb(${sh},${sh},${sh})`; g.lineWidth = 1.6 + r() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 12, y + L * 0.6, x + (r() - 0.5) * 18, y + L); g.stroke();
  }
  // palm comb: spine down the middle (v = along the frond), leaflets angled outward
  const cx = S * 2 + S / 2;
  g.fillStyle = 'rgb(200,200,200)'; g.fillRect(cx - 3, 0, 6, S);
  for (let y = 4; y < S; y += 7) {
    for (const s of [-1, 1]) {
      const sh = 170 + r() * 80 | 0;
      g.strokeStyle = `rgb(${sh},${sh},${sh})`; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + s * (S * 0.46) * (0.75 + r() * 0.25), y + 26); g.stroke();
    }
  }
  // frangipani: leaves + a few 5-petal flowers (flowers use near-white so tint stays light)
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.35;
    drawLeaf(g, S * 3.5 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 60 + r() * 30, 20, r() * Math.PI * 2, 120 + r() * 40 | 0);
  }
  for (let i = 0; i < 9; i++) {
    const x = S * 3.5 + (r() - 0.5) * S * 0.6, y = S / 2 + (r() - 0.5) * S * 0.6;
    for (let p = 0; p < 5; p++) drawLeaf(g, x, y, 16, 10, p * Math.PI * 0.4, 255);
    g.fillStyle = 'rgb(255,235,120)'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let TEX = null;
export const foliageTexture = () => TEX || (TEX = atlas());

/** UV rectangle of an atlas cell. */
export const cellUV = cell => [cell / N, 0, (cell + 1) / N, 1];

// Billboard: `position` is the card centre; attribute `corner` (xy in -1..1) and
// `cardSize` expand it in view space. Normals come from the clump centre (round shading).
const billboard = {
  key: 'billboard',
  apply(shader) {
    prelude(shader, 'vertex', 'attribute vec2 corner;\nattribute float cardSize;');
    replaceInclude(shader, 'vertex', 'project_vertex', /* glsl */`
      vec4 mvPosition = vec4(transformed, 1.0);
      float cardScale = 1.0;
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        cardScale = length(instanceMatrix[0].xyz);
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      mvPosition.xy += corner * cardSize * cardScale;
      gl_Position = projectionMatrix * mvPosition;`);
  },
};

export function cardMaterial() {
  const m = new THREE.MeshLambertMaterial({ map: foliageTexture(), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
  patch(m, billboard);
  applyHaze(m);
  const depth = new THREE.MeshDepthMaterial({ map: foliageTexture(), alphaTest: 0.45, depthPacking: THREE.RGBADepthPacking });
  patch(depth, billboard);
  return { material: m, depth };
}

export function frondMaterial() {
  const m = new THREE.MeshLambertMaterial({ map: foliageTexture(), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
  applyHaze(m);
  const depth = new THREE.MeshDepthMaterial({ map: foliageTexture(), alphaTest: 0.45, depthPacking: THREE.RGBADepthPacking });
  return { material: m, depth };
}
