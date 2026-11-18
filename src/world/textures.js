// Procedural detail textures (CLAUDE.md §5.5), drawn once on the GPU at start: nothing to download.
// Each is tileable (every noise wraps at the tile's edge) and has mipmaps.
//   noise  — R, G, B, A: value noise at 8, 16, 32 and 72 cells a tile (the large-scale colour variation of every
//            painted surface, and the sea's and the clouds' patterns: one lookup instead of dozens of hashes a pixel)
//   sand, grass, rock, asphalt, plaster, bark — R, G: surface normal (x, y) · B: tone · A: small marks (0.5 = no change)
//   water  — R, G: wavelet normal · B, A: foam patterns
// TEX holds one { value } per texture — the uniform objects materials share. They start as a neutral grey
// pixel, so a page that never calls initTextures() (a dev tool) still renders, just without detail.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const grey = () => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1); t.needsUpdate = true; return t; };
const NAMES = ['noise', 'sand', 'grass', 'rock', 'asphalt', 'plaster', 'bark', 'water'];
export const TEX = Object.fromEntries(NAMES.map(n => [n, { value: grey() }]));
/** Metres one tile of each detail texture covers on a surface. */
export const TILE = { sand: 1.6, grass: 2.2, rock: 3.2, asphalt: 1.5, plaster: 2, bark: 1 };

const COMMON = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float size;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// value noise that repeats every per.x × per.y cells
float pn(vec2 x, vec2 per) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  vec2 a = mod(i, per), b = mod(i + 1.0, per);
  return mix(mix(h21(a), h21(vec2(b.x, a.y)), f.x), mix(h21(vec2(a.x, b.y)), h21(b), f.x), f.y);
}
float pn(vec2 x, float per) { return pn(x, vec2(per)); }
float fbm(vec2 u, float n) { return 0.5 * pn(u * n, n) + 0.25 * pn(u * n * 2.0, n * 2.0) + 0.15 * pn(u * n * 4.0, n * 4.0) + 0.1 * pn(u * n * 8.0, n * 8.0); }
// cells: x = distance to the nearest point, y = distance to the cell's edge, z = a random number for the cell
vec3 cells(vec2 x, float per) {
  vec2 i = floor(x), f = fract(x); float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int b = -1; b <= 1; b++) for (int a = -1; a <= 1; a++) {
    vec2 g = vec2(float(a), float(b)), c = mod(i + g, per);
    float d = length(g + vec2(h21(c), h21(c + 17.3)) - f);
    if (d < d1) { d2 = d1; d1 = d; id = h21(c + 5.1); } else if (d < d2) d2 = d;
  }
  return vec3(d1, d2 - d1, id);
}`;

// Each recipe: H(u) = height in metres over the tile (u in 0..1) and T(u) = (tone, marks): tone is the broad light and
// dark, marks are small things that only make sense at their real size (shell specks, cracks, rain streaks) — the
// second, larger layer of a surface leaves them out. 0.5 = no change.
const RECIPES = {
  sand: /* glsl */`
    float H(vec2 u) {
      vec3 c = cells(u * 7.0, 7.0);                                       // dimples: trodden sand
      return (fbm(u, 5.0) - 0.5) * 0.05 - smoothstep(0.5, 0.05, c.x) * 0.02 * step(0.3, c.z)
        + (pn(u * 90.0, 90.0) - 0.5) * 0.004 + (pn(u * 190.0, 190.0) - 0.5) * 0.002;
    }
    vec2 T(vec2 u) {
      vec3 c = cells(u * 46.0, 46.0);                                     // specks: bits of shell (light) and grit (dark)
      float speck = smoothstep(0.16, 0.06, c.x) * step(0.82, fract(c.z * 7.0)) * (c.z > 0.5 ? 0.3 : -0.26);
      return vec2(0.5 + (fbm(u, 4.0) - 0.5) * 0.16 + (pn(u * 170.0, 170.0) - 0.5) * 0.13, 0.5 + speck);
    }`,
  grass: /* glsl */`
    float dashes(vec2 u) {                                               // short blades lying every way: clippings of noise stretched four ways
      vec2 d = vec2(u.x + u.y, u.x - u.y);
      float a = pn(u * vec2(170.0, 52.0), vec2(170.0, 52.0)), b = pn(u.yx * vec2(180.0, 56.0) + 3.3, vec2(180.0, 56.0));
      float c = pn(d * vec2(120.0, 38.0) + 7.1, vec2(120.0, 38.0)), e = pn(d.yx * vec2(126.0, 40.0) + 1.7, vec2(126.0, 40.0));
      return max(max(a, b), max(c, e));
    }
    float clumps(vec2 u) { vec3 c = cells(u * 18.0, 18.0); return (c.z - 0.5) * smoothstep(0.7, 0.2, c.x); }   // tufts a little lighter or darker
    float H(vec2 u) { return dashes(u) * 0.022 + clumps(u) * 0.03 + (fbm(u, 5.0) - 0.5) * 0.05; }
    vec2 T(vec2 u) {
      float earth = smoothstep(0.7, 0.84, fbm(u + 0.37, 3.0));           // worn patches of bare earth
      return vec2(0.5 + clumps(u) * 0.3 + (fbm(u, 3.0) - 0.5) * 0.26 - earth * 0.05, 0.5 + (dashes(u) - 0.74) * 0.75);
    }`,
  rock: /* glsl */`
    float seam(vec2 u) { return smoothstep(0.035, 0.0, abs(pn(u * 5.0 + 0.7, 5.0) - 0.5)) * smoothstep(0.45, 0.6, pn(u * 3.0, 3.0)); }   // a fracture line here and there
    float H(vec2 u) {
      return fbm(u, 4.0) * 0.12 - seam(u) * 0.04 - abs(pn(u * 13.0, 13.0) - 0.5) * 0.05 + (pn(u * 70.0, 70.0) - 0.5) * 0.008;
    }
    vec2 T(vec2 u) {
      vec3 c = cells(u * 30.0, 30.0);                                     // the crystals in granite
      return vec2(0.5 + (fbm(u, 4.0) - 0.5) * 0.4, 0.5 - seam(u) * 0.22 + (c.z - 0.5) * 0.2 * smoothstep(0.5, 0.2, c.x) + (pn(u * 150.0, 150.0) - 0.5) * 0.12);
    }`,
  asphalt: /* glsl */`
    float H(vec2 u) {
      vec3 c = cells(u * 64.0, 64.0);                                     // the stones in the tar
      return smoothstep(0.55, 0.1, c.x) * 0.0045 * (0.4 + c.z) + (pn(u * 9.0, 9.0) - 0.5) * 0.004;
    }
    vec2 T(vec2 u) {
      vec3 c = cells(u * 64.0, 64.0);
      float patch_ = smoothstep(0.55, 0.75, pn(u * 2.0 + 0.5, 2.0)) * 0.07;   // a darker patch of newer tar here and there
      return vec2(0.5 + (pn(u * 200.0, 200.0) - 0.5) * 0.1 + (fbm(u, 3.0) - 0.5) * 0.16 - patch_, 0.5 + (c.z - 0.5) * 0.36 * smoothstep(0.5, 0.2, c.x));
    }`,
  plaster: /* glsl */`
    float H(vec2 u) { return (fbm(u, 22.0) - 0.5) * 0.006 + (pn(u * 130.0, 130.0) - 0.5) * 0.0016; }
    vec2 T(vec2 u) {
      float run = smoothstep(0.6, 0.86, pn(u * vec2(42.0, 2.0), vec2(42.0, 2.0)));   // rain streaks down the wall (v is up)
      return vec2(0.5 + (fbm(u, 3.0) - 0.5) * 0.14, 0.5 + (pn(u * 150.0, 150.0) - 0.5) * 0.07 - run * 0.09);
    }`,
  bark: /* glsl */`
    float ring(vec2 u) { return abs(fract(u.y * 9.0 + (pn(u * vec2(5.0, 3.0), vec2(5.0, 3.0)) - 0.5) * 0.5) - 0.5) * 2.0; }   // leaf scars round a palm trunk
    float fibre(vec2 u) { return pn(u * vec2(64.0, 5.0), vec2(64.0, 5.0)); }
    float H(vec2 u) { return sqrt(ring(u)) * 0.012 + fibre(u) * 0.006 + (fbm(u, 6.0) - 0.5) * 0.01; }
    vec2 T(vec2 u) { return vec2(0.5 + (ring(u) - 0.6) * 0.2 + (fbm(u, 4.0) - 0.5) * 0.22, 0.5 + (fibre(u) - 0.5) * 0.2); }`,
  water: /* glsl */`
    float H(vec2 u) {                                                    // small crossing wavelets
      float h = 0.0, a = 0.5, n = 6.0;
      for (int i = 0; i < 4; i++) { float r = pn(u * n + float(i) * 3.7, n) * 2.0 - 1.0; h += a * (1.0 - r * r); a *= 0.5; n *= 2.0; }   // (rounded crests: no creases)
      return h * 0.07;
    }
    vec2 T(vec2 u) { return vec2(fbm(u, 6.0), fbm(u + 0.43, 14.0)); }`,
};

const MAIN = /* glsl */`
void main() {
  float e = 1.0 / size;
  float h = H(vUv);
  vec2 g = vec2(H(vUv + vec2(e, 0.0)) - h, H(vUv + vec2(0.0, e)) - h) / (e * TILE_M);   // slope: metres up per metre along
  gl_FragColor = vec4(clamp(-g * 0.5 + 0.5, 0.0, 1.0), clamp(T(vUv), 0.0, 1.0));
}`;
const NOISE_MAIN = /* glsl */`
void main() { gl_FragColor = vec4(pn(vUv * 8.0, 8.0), pn(vUv * 16.0 + 3.1, 16.0), pn(vUv * 32.0 + 7.7, 32.0), pn(vUv * 72.0 + 1.9, 72.0)); }`;
const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

let done = false;
/** Draw every texture at `size` pixels a side (256 on the low level, 512 otherwise). Call once, after the renderer exists. */
export function initTextures(renderer, size = 512) {
  if (done) return TEX;
  done = true;
  const quad = new FullScreenQuad(), prev = renderer.getRenderTarget(), aniso = Math.min(size >= 512 ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  for (const name of NAMES) {
    const px = name === 'noise' ? 512 : size;
    const rt = new THREE.WebGLRenderTarget(px, px, {
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
      generateMipmaps: true, depthBuffer: false, colorSpace: THREE.NoColorSpace, anisotropy: aniso,
    });
    quad.material = new THREE.ShaderMaterial({
      uniforms: { size: { value: px } }, vertexShader: VERT, depthTest: false, depthWrite: false, toneMapped: false,
      fragmentShader: name === 'noise' ? COMMON + NOISE_MAIN : `#define TILE_M ${(TILE[name] || 1).toFixed(2)}\n${COMMON}${RECIPES[name]}${MAIN}`,
    });
    renderer.setRenderTarget(rt);
    quad.render(renderer);
    quad.material.dispose();
    rt.texture.name = `detail-${name}`;
    TEX[name].value = rt.texture;
  }
  renderer.setRenderTarget(prev);
  quad.dispose();
  return TEX;
}
