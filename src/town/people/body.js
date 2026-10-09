// Procedural people (the kid and every NPC) from a `look` description, in a smooth chibi-toon
// style (geometry in toon.js). One SkinnedMesh with rigid bone weights → a single draw call. Face has its own bones: `eyes` (scale y
// to blink) and `mouth` (scale x/y for mouth shapes while talking).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyHaze } from '../../world/haze.js';
import { toonParts, TOON } from './toon.js';
import { DETAIL } from './geo.js';
import { patch, replaceInclude } from '../../core/shaderPatch.js';

// Proportions in kid units (≈1.3 m tall); adults use look.scale and a smaller head.
export const BODY = {
  hip: 0.62, thigh: 0.3, shin: 0.28, ankle: 0.05, torso: 0.36, neck: 0.05, head: 0.125,
  hipW: 0.075, shoulderW: 0.155, upperArm: 0.205, foreArm: 0.19,     // hands reach mid-thigh
};

export const DEFAULT_LOOK = {
  scale: 1, headScale: 1.2, belly: 0,            // kids: a big-ish toon head (≈ 1/5 of their height); adults pass ≈ 0.86
  skin: '#d9a57c', hair: '#2a2320', hairStyle: 'short',     // short | bun | long | bald
  shirt: '#7fc4e8', shirtTrim: '#f4f1e8', sleeves: 'short',  // short | long | none
  bottom: 'shorts', bottomColor: '#34507a',                   // shorts | pants | skirt
  shoe: '#8a5a3a', sock: '#f4f1e8', apron: null, vest: null, glasses: false,
  print: null, printBg: null,                                // chest print colours (null = auto from the shirt; 'none' = plain)
  hat: 'straw', hatColor: '#e8d49a', hatBand: '#c9463a',      // straw | cap | bucket | none
  eye: '#2a1a14', iris: '#5a3a26', mouth: '#b8564a', cheek: '#f0a098',
};

export const KID_LEGS = 1;                 // kids' leg length (× BODY) unless look.legScale says otherwise (0.66 = chibi)

/** Proportions for one person: BODY with the legs scaled. */
export const bodyFor = look => {
  const ls = look.legScale ?? (look.headScale > 1 ? KID_LEGS : 1);
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
/** The people material, for static (baked) figures: its own instance, so it can take extra shader patches. */
export const personMaterial = material;

/** detail < 1 meshes the person more coarsely (background people; see geo.js DETAIL). */
export function buildPerson(lookIn = {}, detail = 1) {
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

  const geos = [];
  let P;
  DETAIL.k = detail;
  try { P = toonParts(look, body); } finally { DETAIL.k = 1; }
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

/**
 * A person frozen in a pose, as plain geometry (position, normal, colour; the look's scale applied,
 * standing at the origin): for the background crowd (crowd.js), which merges many of these into one
 * mesh. `pose(bones)` turns the bones first; `detail` < 1 meshes the figure more coarsely.
 */
export function bakePerson(look, pose, detail = 1) {
  const { mesh, bones } = buildPerson(look, detail);
  pose?.(bones);
  mesh.updateMatrixWorld(true);
  const sk = mesh.skeleton, g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, idx = g.attributes.skinIndex;
  const mats = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i]));
  const nms = mats.map(m => new THREE.Matrix3().getNormalMatrix(m));
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const b = idx.getX(i);
    v.fromBufferAttribute(pos, i).applyMatrix4(mats[b]); pos.setXYZ(i, v.x, v.y, v.z);
    v.fromBufferAttribute(nrm, i).applyMatrix3(nms[b]).normalize(); nrm.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight');
  return g;
}

/**
 * Several people in ONE skinned mesh (one draw call + one shadow call for all of them): for the
 * people walking about in the background (strollers.js). Returns { mesh, people: [{ root, bones, look, body }] }:
 * place a person with root.position / root.rotation.y, pose them through their bones.
 */
export function buildPeopleMesh(looks, detail = 1) {
  const geos = [], all = [], inverses = [], people = [];
  for (const lookIn of looks) {
    const { mesh, bones, look, body } = buildPerson(lookIn, detail), g = mesh.geometry, idx = g.attributes.skinIndex;
    for (let i = 0; i < idx.count; i++) idx.setX(i, idx.getX(i) + all.length);         // this person's bones follow the others'
    const root = new THREE.Group();
    root.scale.setScalar(look.scale);
    root.add(bones.hips);
    all.push(...mesh.skeleton.bones); inverses.push(...mesh.skeleton.boneInverses);
    geos.push(g); people.push({ root, bones, look, body });
  }
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geos), sharedMat || (sharedMat = material()));
  for (const p of people) mesh.add(p.root);
  mesh.bind(new THREE.Skeleton(all, inverses), new THREE.Matrix4());   // (an explicit bind matrix keeps the rest-pose inverses)
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, people };
}
