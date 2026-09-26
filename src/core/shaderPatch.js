// Chainable onBeforeCompile patches for built-in materials.
// Each patch is { key, uniforms, apply(shader) }; uniforms are shared objects, so
// updating a value (e.g. U.time.value) reaches every patched material at once.

export const U = {
  time: { value: 0 },
};

/** Add a patch to a material. Patches run in the order they were added. */
export function patch(material, p) {
  const list = material.userData.patches || (material.userData.patches = []);
  if (list.some(q => q.key === p.key)) return material;
  list.push(p);
  material.onBeforeCompile = shader => {
    for (const q of list) {
      Object.assign(shader.uniforms, q.uniforms || {});
      q.apply(shader);
    }
  };
  material.customProgramCacheKey = () => list.map(q => q.key).join('|');
  material.needsUpdate = true;
  return material;
}

/** Replace `#include <chunk>` in the vertex or fragment shader. */
export function replaceInclude(shader, stage, chunk, code) {
  const k = stage === 'vertex' ? 'vertexShader' : 'fragmentShader';
  const tag = `#include <${chunk}>`;
  if (!shader[k].includes(tag)) console.warn(`shaderPatch: ${tag} not found in ${stage} shader`);
  shader[k] = shader[k].replace(tag, code);
}

/** Insert code before main() — for uniforms, varyings and helper functions. */
export function prelude(shader, stage, code) {
  const k = stage === 'vertex' ? 'vertexShader' : 'fragmentShader';
  shader[k] = shader[k].replace('void main() {', `${code}\nvoid main() {`);
}

// Value noise that tiles nowhere — used for large-scale colour variation.
export const NOISE_GLSL = /* glsl */`
float bsHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bsNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bsHash(i), bsHash(i + vec3(1,0,0)), f.x), mix(bsHash(i + vec3(0,1,0)), bsHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bsHash(i + vec3(0,0,1)), bsHash(i + vec3(1,0,1)), f.x), mix(bsHash(i + vec3(0,1,1)), bsHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float bsFbm(vec3 p) { return 0.5 * bsNoise(p) + 0.3 * bsNoise(p * 2.03) + 0.2 * bsNoise(p * 4.11); }
`;
