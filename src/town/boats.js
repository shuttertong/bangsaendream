// Moored boats that bob on the water. Each boat design is one InstancedMesh; the bobbing
// (heave, roll, pitch — every boat on its own rhythm, keyed off its position) happens in
// the vertex shader, so it costs nothing per frame on the CPU. The shadow pass bobs too.
import * as THREE from 'three';
import { patch, prelude, replaceInclude, U } from '../core/shaderPatch.js';
import { paintedMaterial } from '../world/materials.js';

export const BOB = { heave: 0.09, speed: 1.3, roll: 0.055, rollSpeed: 1.1, pitch: 0.03, pitchSpeed: 0.8 };

const bobPatch = {
  key: 'bob',
  uniforms: { uTime: U.time },
  apply(shader) {
    prelude(shader, 'vertex', 'uniform float uTime;');
    replaceInclude(shader, 'vertex', 'begin_vertex', /* glsl */`
      #include <begin_vertex>
      #ifdef USE_INSTANCING
      {
        vec3 ip = vec3(instanceMatrix[3]);
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float rl = sin(uTime * ${BOB.rollSpeed.toFixed(3)} + ph) * ${BOB.roll.toFixed(3)};
        float pt = sin(uTime * ${BOB.pitchSpeed.toFixed(3)} + ph * 1.7) * ${BOB.pitch.toFixed(3)};
        float c = cos(rl), s = sin(rl);
        transformed.xy = vec2(c * transformed.x - s * transformed.y, s * transformed.x + c * transformed.y);
        c = cos(pt); s = sin(pt);
        transformed.zy = vec2(c * transformed.z - s * transformed.y, s * transformed.z + c * transformed.y);
        transformed.y += sin(uTime * ${BOB.speed.toFixed(3)} + ph * 2.1) * ${BOB.heave.toFixed(3)};
      }
      #endif`);
  },
};

/** fleet: [{ geo, m: Matrix4 }] (boat origin at the waterline). Returns the meshes added. */
export function createBobbingBoats(scene, fleet) {
  const byGeo = new Map();
  for (const b of fleet) (byGeo.get(b.geo) || byGeo.set(b.geo, []).get(b.geo)).push(b.m);
  const material = patch(paintedMaterial({ amp: 0.05, scale: 1 }), bobPatch);
  const depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), bobPatch);
  const meshes = [];
  for (const [geo, mats] of byGeo) {
    const mesh = new THREE.InstancedMesh(geo, material, mats.length);
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.customDepthMaterial = depth;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
