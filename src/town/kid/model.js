// Procedural kid (≈1.3 m): straw hat, T-shirt, shorts, sandals. One SkinnedMesh with
// rigid bone weights → a single draw call. Bones are posed by kid/index.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyHaze } from '../../world/haze.js';

export const KID = {
  skin: '#d9a57c', hair: '#2a2320', shirt: '#7fc4e8', shirtTrim: '#f4f1e8', shorts: '#34507a',
  sandal: '#8a5a3a', hat: '#e8d49a', hatBand: '#c9463a', eye: '#1e1a18', mouth: '#9a4a3a', cheek: '#e8958a',
  // lengths (m)
  hip: 0.62, thigh: 0.3, shin: 0.28, ankle: 0.05, torso: 0.36, neck: 0.05, head: 0.125,
  hipW: 0.075, shoulderW: 0.16, upperArm: 0.19, foreArm: 0.17,
};

// bone name → [parent, rest offset from parent]
const BONES = {
  hips: [null, [0, KID.hip, 0]],
  spine: ['hips', [0, 0.1, 0]],
  head: ['spine', [0, KID.torso - 0.1 + KID.neck, 0]],
  hat: ['head', [0, KID.head * 0.85, 0]],
  armL: ['spine', [KID.shoulderW, KID.torso - 0.14, 0]],
  armR: ['spine', [-KID.shoulderW, KID.torso - 0.14, 0]],
  foreL: ['armL', [0, -KID.upperArm, 0]],
  foreR: ['armR', [0, -KID.upperArm, 0]],
  legL: ['hips', [KID.hipW, 0, 0]],
  legR: ['hips', [-KID.hipW, 0, 0]],
  shinL: ['legL', [0, -KID.thigh, 0]],
  shinR: ['legR', [0, -KID.thigh, 0]],
  footL: ['shinL', [0, -KID.shin, 0]],
  footR: ['shinR', [0, -KID.shin, 0]],
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
function parts() {
  const K = KID, L = K;
  const limb = (r, len, hex) => colored(at(cap(r, len - 2 * r), 0, -len / 2, 0), hex);
  const side = s => ({
    [`arm${s}`]: [limb(0.038, L.upperArm, K.skin), colored(at(cyl(0.052, 0.047, 0.09), 0, -0.035, 0), K.shirt)],
    [`fore${s}`]: [limb(0.033, L.foreArm, K.skin), colored(at(sph(0.043), 0, -L.foreArm - 0.02, 0.005), K.skin)],
    [`leg${s}`]: [colored(at(cyl(0.075, 0.068, 0.17), 0, -0.07, 0), K.shorts), limb(0.05, L.thigh, K.skin)],
    [`shin${s}`]: [limb(0.043, L.shin, K.skin)],
    [`foot${s}`]: [colored(at(new THREE.BoxGeometry(0.085, 0.022, 0.19), 0, -L.ankle + 0.011, 0.04), K.sandal),
      colored(at(sc(sph(0.045, 10, 6), 0.9, 0.55, 1.5), 0, -L.ankle + 0.035, 0.05), K.skin)],
  });
  return {
    hips: [colored(at(sc(cyl(0.125, 0.12, 0.2, 14), 1, 1, 0.8), 0, 0.02, 0), K.shorts)],
    spine: [
      colored(at(sc(cap(0.135, 0.12), 1, 1, 0.72), 0, 0.13, 0), K.shirt),
      colored(at(sc(cyl(0.06, 0.07, 0.03), 1, 1, 0.8), 0, K.torso - 0.1, 0), K.shirtTrim),         // collar
      colored(at(cyl(0.04, 0.045, 0.08, 8), 0, K.torso - 0.08, 0), K.skin),                       // neck
    ],
    head: [
      colored(sc(sph(K.head, 18, 14), 1, 1.02, 0.98), K.skin),
      colored(at(sc(new THREE.SphereGeometry(K.head * 1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 1, 1, 1), 0, 0.012, -0.012), K.hair),
      colored(at(sc(sph(0.02, 8, 6), 1, 1.35, 0.6), 0.045, 0.012, K.head * 0.93), K.eye),
      colored(at(sc(sph(0.02, 8, 6), 1, 1.35, 0.6), -0.045, 0.012, K.head * 0.93), K.eye),
      colored(at(sc(sph(0.02, 8, 6), 1.6, 0.8, 0.5), 0.07, -0.035, K.head * 0.85), K.cheek),
      colored(at(sc(sph(0.02, 8, 6), 1.6, 0.8, 0.5), -0.07, -0.035, K.head * 0.85), K.cheek),
      colored(at(sc(sph(0.014, 8, 6), 1.5, 0.6, 0.6), 0, -0.05, K.head * 0.95), K.mouth),
      colored(at(sc(sph(0.024, 8, 6), 0.6, 1, 0.7), K.head * 0.98, 0, 0), K.skin),               // ears
      colored(at(sc(sph(0.024, 8, 6), 0.6, 1, 0.7), -K.head * 0.98, 0, 0), K.skin),
    ],
    hat: [
      colored(at(cyl(0.22, 0.23, 0.012, 20), 0, 0, 0), K.hat),                                    // brim
      colored(at(cyl(0.115, 0.13, 0.1, 18), 0, 0.05, 0), K.hat),                                  // crown
      colored(at(cyl(0.132, 0.132, 0.026, 18), 0, 0.018, 0), K.hatBand),
    ],
    ...side('L'), ...side('R'),
  };
}

export function buildKid() {
  const bones = {}, list = [];
  for (const [name, [parent, off]] of Object.entries(BONES)) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...off);
    b.userData.rest = b.position.clone();
    if (parent) bones[parent].add(b);
    bones[name] = b;
    list.push(b);
  }
  bones.hips.updateMatrixWorld(true);

  const geos = [];
  const P = parts();
  list.forEach((b, idx) => {
    for (const g of P[b.name] || []) {
      g.applyMatrix4(b.matrixWorld);                           // rest pose in model space
      const n = g.attributes.position.count;
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? idx : 0)), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      geos.push(g);
    }
  });
  const geo = mergeGeometries(geos);
  const mat = applyHaze(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(bones.hips);
  mesh.bind(new THREE.Skeleton(list));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, bones };
}
