// Procedural people (the kid and every NPC) from a `look` description. One SkinnedMesh
// with rigid bone weights → a single draw call. Face has its own bones: `eyes` (scale y
// to blink) and `mouth` (scale x/y for mouth shapes while talking).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyHaze } from '../../world/haze.js';

// Proportions in kid units (≈1.3 m tall); adults use look.scale and a smaller head.
export const BODY = {
  hip: 0.62, thigh: 0.3, shin: 0.28, ankle: 0.05, torso: 0.36, neck: 0.05, head: 0.125,
  hipW: 0.075, shoulderW: 0.16, upperArm: 0.19, foreArm: 0.17,
};

export const DEFAULT_LOOK = {
  scale: 1, headScale: 1, belly: 0,
  skin: '#d9a57c', hair: '#2a2320', hairStyle: 'short',     // short | bun | long | bald
  shirt: '#7fc4e8', shirtTrim: '#f4f1e8', sleeves: 'short',  // short | long | none
  bottom: 'shorts', bottomColor: '#34507a',                   // shorts | pants | skirt
  shoe: '#8a5a3a', apron: null, vest: null, glasses: false,
  hat: 'straw', hatColor: '#e8d49a', hatBand: '#c9463a',      // straw | cap | bucket | none
  eye: '#1e1a18', mouth: '#9a4a3a', cheek: '#e8958a',
};

// bone name → [parent, rest offset from parent]
const B = BODY;
const BONES = {
  hips: [null, [0, B.hip, 0]],
  spine: ['hips', [0, 0.1, 0]],
  head: ['spine', [0, B.torso - 0.1 + B.neck, 0]],
  eyes: ['head', [0, 0.012, B.head * 0.9]],
  mouth: ['head', [0, -0.05, B.head * 0.93]],
  hat: ['head', [0, B.head * 0.85, 0]],
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
};

function colored(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
const sc = (g, x, y, z) => { g.scale(x, y, z); return g; };
const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (r0, r1, h, s = 12) => new THREE.CylinderGeometry(r0, r1, h, s);

/** Geometry per bone, in bone-local rest space (limbs hang down −y, face is +z). */
function parts(K) {
  const limb = (r, len, hex) => colored(at(cap(r, len - 2 * r), 0, -len / 2, 0), hex);
  const long = K.sleeves === 'long', bare = K.sleeves === 'none';
  const legCover = K.bottom === 'pants' ? K.bottomColor : K.skin;
  const side = s => ({
    [`arm${s}`]: [limb(0.038, B.upperArm, long ? K.shirt : K.skin),
      ...(bare ? [] : [colored(at(cyl(0.052, 0.047, 0.09), 0, -0.035, 0), K.shirt)])],
    [`fore${s}`]: [limb(0.033, B.foreArm, long ? K.shirt : K.skin), colored(at(sph(0.043), 0, -B.foreArm - 0.02, 0.005), K.skin)],
    [`leg${s}`]: K.bottom === 'skirt' ? [limb(0.05, B.thigh, K.skin)]
      : [colored(at(cyl(0.075, 0.068, 0.17), 0, -0.07, 0), K.bottomColor), limb(0.05, B.thigh, legCover)],
    [`shin${s}`]: [limb(0.043, B.shin, legCover)],
    [`foot${s}`]: [colored(at(new THREE.BoxGeometry(0.085, 0.022, 0.19), 0, -B.ankle + 0.011, 0.04), K.shoe),
      colored(at(sc(sph(0.045, 10, 6), 0.9, 0.55, 1.5), 0, -B.ankle + 0.035, 0.05), K.skin)],
  });

  const hs = K.headScale, H = B.head;
  const head = [
    colored(sc(sph(H, 18, 14), 1, 1.02, 0.98), K.skin),
    colored(at(sc(sph(0.02, 8, 6), 1.6, 0.8, 0.5), 0.07, -0.035, H * 0.85), K.cheek),
    colored(at(sc(sph(0.02, 8, 6), 1.6, 0.8, 0.5), -0.07, -0.035, H * 0.85), K.cheek),
    colored(at(sc(sph(0.024, 8, 6), 0.6, 1, 0.7), H * 0.98, 0, 0), K.skin),                  // ears
    colored(at(sc(sph(0.024, 8, 6), 0.6, 1, 0.7), -H * 0.98, 0, 0), K.skin),
  ];
  if (K.hairStyle !== 'bald') {
    // crown cap down to the hairline, plus a back/sides piece that leaves the face open
    // (sphere phi = π/2 is +z, the face)
    head.push(colored(at(new THREE.SphereGeometry(H * 1.06, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), 0, 0.01, -0.01), K.hair));
    head.push(colored(at(new THREE.SphereGeometry(H * 1.06, 14, 8, Math.PI * 0.5 + Math.PI * 0.36, Math.PI * 2 - Math.PI * 0.72, 0, Math.PI * 0.6), 0, 0.01, -0.01), K.hair));
  }
  if (K.hairStyle === 'bun') head.push(colored(at(sph(0.06, 12, 8), 0, 0.07, -0.11), K.hair));
  if (K.hairStyle === 'long') head.push(colored(at(sc(cap(0.1, 0.12), 1, 1, 0.5), 0, -0.08, -0.07), K.hair));
  if (K.glasses) for (const x of [0.045, -0.045]) head.push(colored(at(new THREE.TorusGeometry(0.025, 0.005, 5, 12), x, 0.012, H * 0.99), '#2a2a2a'));
  for (const g of head) g.scale(hs, hs, hs);

  const hat = {
    straw: [colored(cyl(0.22, 0.23, 0.012, 20), K.hatColor), colored(at(cyl(0.115, 0.13, 0.1, 18), 0, 0.05, 0), K.hatColor),
      colored(at(cyl(0.132, 0.132, 0.026, 18), 0, 0.018, 0), K.hatBand)],
    bucket: [colored(at(cyl(0.12, 0.19, 0.06, 18), 0, -0.005, 0), K.hatColor), colored(at(cyl(0.11, 0.125, 0.09, 18), 0, 0.05, 0), K.hatColor)],
    cap: [colored(at(sc(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.8, 1), 0, -0.015, 0), K.hatColor),
      colored(at(sc(cyl(0.1, 0.1, 0.012, 14), 1, 1, 0.9), 0, -0.01, 0.15), K.hatBand)],
    none: [],
  }[K.hat] || [];
  for (const g of hat) g.scale(hs, hs, hs);

  const spine = [
    colored(at(sc(cap(0.135 + K.belly * 0.03, 0.12), 1, 1, 0.72 + K.belly * 0.35), 0, 0.13, K.belly * 0.03), K.shirt),
    colored(at(sc(cyl(0.06, 0.07, 0.03), 1, 1, 0.8), 0, B.torso - 0.1, 0), K.shirtTrim),        // collar
    colored(at(cyl(0.04, 0.045, 0.08, 8), 0, B.torso - 0.08, 0), K.skin),                      // neck
  ];
  if (K.vest) {                                              // life vest over the shirt
    spine.push(colored(at(sc(cap(0.155 + K.belly * 0.03, 0.1), 1, 1, 0.8 + K.belly * 0.3), 0, 0.14, K.belly * 0.03), K.vest));
    for (const y of [0.06, 0.16]) spine.push(colored(at(sc(cyl(0.162 + K.belly * 0.03, 0.162 + K.belly * 0.03, 0.025, 16), 1, 1, 0.82 + K.belly * 0.3), 0, y, K.belly * 0.03), '#1a1a1a'));
  }
  if (K.apron) spine.push(colored(at(new THREE.BoxGeometry(0.22, 0.34, 0.02), 0, 0.02, 0.1 + K.belly * 0.05), K.apron));
  const hips = [colored(at(sc(cyl(0.125, 0.12, 0.2, 14), 1, 1, 0.8), 0, 0.02, 0), K.bottomColor)];
  if (K.bottom === 'skirt') hips.push(colored(at(sc(cyl(0.13, 0.17, 0.52, 16), 1, 1, 0.8), 0, -0.26, 0), K.bottomColor));

  return {
    hips, spine, head, hat,
    eyes: [0.045, -0.045].map(x => colored(at(sc(sph(0.02, 8, 6), 1, 1.35, 0.6), x * hs, 0, 0.004), K.eye)),
    mouth: [colored(sc(sph(0.014, 8, 6), 1.5, 0.6, 0.6), K.mouth)],
    ...side('L'), ...side('R'),
  };
}

const material = () => applyHaze(new THREE.MeshLambertMaterial({ vertexColors: true }));
let sharedMat = null;

export function buildPerson(lookIn = {}) {
  const look = { ...DEFAULT_LOOK, ...lookIn };
  const bones = {}, list = [];
  for (const [name, [parent, off]] of Object.entries(BONES)) {
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

  const geos = [], P = parts(look);
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
  return { mesh, bones, look };
}
