// Procedural people (the kid and every NPC) from a `look` description, in a smooth chibi-toon
// style (geometry in toon.js). One SkinnedMesh with rigid bone weights → a single draw call. Face has its own bones: `eyes` (scale y
// to blink) and `mouth` (scale x/y for mouth shapes while talking).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyHaze } from '../../world/haze.js';
import { toonParts, TOON } from './toon.js';
import { patch, replaceInclude } from '../../core/shaderPatch.js';

// Proportions in kid units (≈1.3 m tall); adults use look.scale and a smaller head.
export const BODY = {
  hip: 0.62, thigh: 0.3, shin: 0.28, ankle: 0.05, torso: 0.36, neck: 0.05, head: 0.125,
  hipW: 0.075, shoulderW: 0.16, upperArm: 0.19, foreArm: 0.17,
};

export const DEFAULT_LOOK = {
  scale: 1, headScale: 1.45, belly: 0,           // kids: big chibi head; adults pass headScale ≈ 0.86
  skin: '#d9a57c', hair: '#2a2320', hairStyle: 'short',     // short | bun | long | bald
  shirt: '#7fc4e8', shirtTrim: '#f4f1e8', sleeves: 'short',  // short | long | none
  bottom: 'shorts', bottomColor: '#34507a',                   // shorts | pants | skirt
  shoe: '#8a5a3a', apron: null, vest: null, glasses: false,
  hat: 'straw', hatColor: '#e8d49a', hatBand: '#c9463a',      // straw | cap | bucket | none
  eye: '#2a1a14', iris: '#5a3a26', mouth: '#b8564a', cheek: '#f0a098',
};

export const CHIBI_LEGS = 0.66;            // kids' leg length (× BODY) unless look.legScale says otherwise

/** Proportions for one person: BODY with the legs scaled. */
export const bodyFor = look => {
  const ls = look.legScale ?? (look.headScale > 1 ? CHIBI_LEGS : 1);
  return { ...BODY, hip: BODY.hip * ls, thigh: BODY.thigh * ls, shin: BODY.shin * ls };
};

// bone name → [parent, rest offset from parent]
const bonesFor = B => ({
  hips: [null, [0, B.hip, 0]],
  spine: ['hips', [0, 0.1, 0]],
  head: ['spine', [0, B.torso - 0.1 + B.neck, 0]],
  // face bones sit on the head centre (TOON.up above the neck): eyes at the eye line, mouth at the mouth
  eyes: ['head', [0, B.head * (TOON.up + TOON.eyeY), 0]],
  mouth: ['head', [0, B.head * (TOON.up + TOON.mouthY), 0]],
  hat: ['head', [0, B.head * (TOON.up + TOON.hatY), 0]],
  armL: ['spine', [B.shoulderW, B.torso - 0.14, 0]],
  armR: ['spine', [-B.shoulderW, B.torso - 0.14, 0]],
  foreL: ['armL', [0, -B.upperArm, 0]],
  foreR: ['armR', [0, -B.upperArm, 0]],
  legL: ['hips', [B.hipW, 0, 0]],
  legR: ['hips', [-B.hipW, 0, 0]],
  shinL: ['legL', [0, -B.thigh, 0]],
  shinR: ['legR', [0, -B.thigh, 0]],
  footL: ['shinL', [0, -B.shin, 0]],
  footR: ['shinR', [0, -B.shin, 0]],
});

// soft toon shading: "wrapped" diffuse light (half-Lambert), so faces and limbs turn gently
// from light to shade instead of going dark on the side away from the sun
const softLight = {
  key: 'toon-wrap',
  apply(shader) {
    replaceInclude(shader, 'fragment', 'lights_lambert_pars_fragment', THREE.ShaderChunk.lights_lambert_pars_fragment
      .replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = dot( geometryNormal, directLight.direction ) * 0.5 + 0.5; dotNL *= dotNL;'));
  },
};
const material = () => applyHaze(patch(new THREE.MeshLambertMaterial({ vertexColors: true }), softLight));
let sharedMat = null;

export function buildPerson(lookIn = {}) {
  const look = { ...DEFAULT_LOOK, ...lookIn }, body = bodyFor(look);
  const bones = {}, list = [];
  for (const [name, [parent, off]] of Object.entries(bonesFor(body))) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...off);
    if (name === 'eyes' || name === 'mouth' || name === 'hat') b.position.multiplyScalar(look.headScale);
    b.userData.rest = b.position.clone();
    if (parent) bones[parent].add(b);
    bones[name] = b;
    list.push(b);
  }
  bones.hips.updateMatrixWorld(true);

  const geos = [], P = toonParts(look, body);
  list.forEach((b, idx) => {
    for (const g of P[b.name] || []) {
      g.applyMatrix4(b.matrixWorld);                           // rest pose in model space
      const n = g.attributes.position.count;
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? idx : 0)), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      geos.push(g);
    }
  });
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geos), sharedMat || (sharedMat = material()));
  mesh.add(bones.hips);
  mesh.bind(new THREE.Skeleton(list));
  mesh.scale.setScalar(look.scale);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, bones, look, body };                         // body: this person's proportions (leg IK)
}
