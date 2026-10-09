// The background crowd: sellers at the stalls, people looking at the goods, families at the
// plastic tables. Nobody to talk to — just Bang Saen being busy. A few figures are built once
// (a body type in a pose, meshed coarsely and frozen with bakePerson), then copied to every
// spot with their own clothes colours and merged into one mesh per map chunk: one draw call
// per chunk, however many people stand there. A sway and breathing in the vertex shader keep
// them from looking like statues.
//   spots: [{ x, y, z, yaw, role: 'seller' | 'shopper' | 'guest', sit }]  (y = the ground they stand on)
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakePerson, personMaterial } from './people/body.js';
import { patch, prelude, replaceInclude, U } from '../core/shaderPatch.js';
import { rng } from '../core/rng.js';

// Clothes are built in marker colours (one colour channel pattern per slot), so every copy can be
// given its own colours: a vertex colour of the form a·marker + b·white becomes a·colour + b·white,
// which keeps the builder's darker hems and lighter highlights.
const SLOTS = ['shirt', 'bottom', 'hat', 'skin', 'hair', 'apron'];
const MARK = { shirt: '#ff0000', bottom: '#00ff00', hat: '#0000ff', skin: '#ffff00', hair: '#00ffff', apron: '#ff00ff' };
const PATTERN = { 1: 1, 2: 2, 4: 3, 3: 4, 6: 5, 5: 6 };              // which channels are high (r=1, g=2, b=4) → slot number
const ADULT = { headScale: 0.86, print: 'none' };

export const CROWD = {
  detail: 0.33,               // mesh detail (1 = the cast's ~25k triangles; this is ~3k)
  chunk: 384, seat: 0.42, tall: 2.4, size: [0.95, 1.05],
  sway: { amp: 0.011, slow: 0.007, breathe: 0.004 },
  colors: {
    skin: ['#d9a57c', '#c68f66', '#b8835c', '#e0b08a', '#a8764f', '#c99a74'],
    hair: ['#2a2320', '#2a2320', '#3a2a22', '#1e1a18', '#6a6660', '#4a3a30'],
    shirt: ['#f0b43a', '#4fb3a8', '#e8958a', '#7fc4e8', '#f4f1e8', '#6a8a5a', '#9a5a8a', '#3f6f9a', '#d8443a', '#e8743a', '#b98fb8', '#f0d8a0'],
    bottom: ['#34507a', '#3a3a3a', '#6a5a4a', '#e8e4d8', '#3a6a4a', '#5a4a3a', '#6a4a7a'],
    hat: ['#e8d49a', '#f4f1e8', '#d8443a', '#7a8a5a', '#2f6fc4', '#f0c23a'],
    apron: ['#f4f1e8', '#f4f1e8', '#f0d8c0', '#cfe6f2', '#f0e0a0'],
  },
  // body types (fictional, no likenesses) and the roles they suit; aprons and skirts stand, they don't sit
  builds: [
    { who: ['seller'], look: { ...ADULT, scale: 1.24, hairStyle: 'bun', bottom: 'skirt', apron: MARK.apron, hat: 'none', belly: 0.45 } },
    { who: ['seller'], look: { ...ADULT, scale: 1.3, hairStyle: 'short', bottom: 'pants', apron: MARK.apron, hat: 'cap', belly: 0.4 } },
    { who: ['seller', 'shopper', 'guest'], look: { ...ADULT, scale: 1.32, hairStyle: 'short', hat: 'cap', bottom: 'shorts', belly: 0.5 } },
    { who: ['seller', 'shopper'], look: { ...ADULT, scale: 1.3, hairStyle: 'short', hat: 'bucket', sleeves: 'none', bottom: 'pants', belly: 0.3 } },
    { who: ['seller', 'shopper', 'guest'], look: { ...ADULT, scale: 1.22, hairStyle: 'long', hat: 'straw', bottom: 'shorts' } },
    { who: ['shopper', 'guest'], look: { ...ADULT, scale: 1.25, hairStyle: 'long', hat: 'none', bottom: 'pants' } },
    { who: ['shopper'], look: { ...ADULT, scale: 1.22, hairStyle: 'bun', hat: 'none', bottom: 'skirt' } },
    { who: ['shopper', 'guest'], look: { ...ADULT, scale: 1.3, hairStyle: 'short', hat: 'none', bottom: 'pants', sleeves: 'long' } },
    { who: ['shopper', 'guest'], look: { scale: 1, headScale: 1.2, print: 'none', hairStyle: 'short', hat: 'cap', bottom: 'shorts' } },
    { who: ['shopper'], look: { scale: 1.02, headScale: 1.2, print: 'none', hairStyle: 'long', hat: 'none', bottom: 'skirt' } },
  ],
  poses: { seller: ['stand', 'offer', 'offer', 'wave'], shopper: ['browse', 'browse', 'point', 'phone', 'stand'], guest: ['stand'], sit: ['sit', 'sitEat', 'sitChat'] },
};

function seat(B, look) {
  B.hips.position.y = CROWD.seat / (look.scale || 1) + 0.035;        // a little into the stool, so the feet reach the ground
  for (const [k, s] of [['L', 1], ['R', -1]]) { B[`leg${k}`].rotation.set(-1.4, 0, s * 0.12); B[`shin${k}`].rotation.x = 1.42; }
  B.spine.rotation.x = 0.06;
}
// bone rotations: arms hang down −y; a negative x swings a limb forward, ∓z lifts the right / left arm sideways
const POSES = {
  stand(B) { B.armL.rotation.z = 0.12; B.armR.rotation.z = -0.12; B.foreL.rotation.x = B.foreR.rotation.x = -0.15; B.hips.rotation.z = 0.025; B.head.rotation.y = 0.25; },
  offer(B) { B.armR.rotation.set(-1.05, 0, -0.1); B.foreR.rotation.x = -0.55; B.armL.rotation.z = 0.12; B.head.rotation.x = 0.12; B.spine.rotation.x = 0.06; },
  wave(B) { B.armR.rotation.set(0, 0, -2.5); B.foreR.rotation.z = 0.35; B.armL.rotation.z = 0.12; B.head.rotation.y = -0.2; },
  browse(B) { B.spine.rotation.x = 0.24; B.head.rotation.set(0.32, -0.15, 0); B.armR.rotation.set(-0.85, 0, -0.1); B.foreR.rotation.x = -0.45; B.armL.rotation.set(-0.15, 0, 0.14); B.foreL.rotation.x = -0.5; },
  point(B) { B.armL.rotation.set(-1.2, 0, 0.1); B.foreL.rotation.x = -0.15; B.head.rotation.set(0.15, 0.2, 0); B.armR.rotation.z = -0.12; },
  phone(B) { B.armR.rotation.set(-0.55, 0, -0.15); B.foreR.rotation.x = -1.75; B.head.rotation.x = 0.42; B.armL.rotation.z = 0.12; B.spine.rotation.x = 0.05; },
  sit(B, look) { seat(B, look); for (const k of ['L', 'R']) { B[`arm${k}`].rotation.set(-0.55, 0, k === 'L' ? 0.1 : -0.1); B[`fore${k}`].rotation.x = -0.8; } B.head.rotation.y = 0.2; },
  sitEat(B, look) { seat(B, look); B.armR.rotation.set(-0.7, 0, -0.1); B.foreR.rotation.x = -1.9; B.armL.rotation.set(-0.5, 0, 0.1); B.foreL.rotation.x = -0.9; B.head.rotation.x = 0.15; B.spine.rotation.x = 0.12; },
  sitChat(B, look) { seat(B, look); B.armL.rotation.set(-0.9, 0, 0.3); B.foreL.rotation.x = -1.0; B.armR.rotation.set(-0.5, 0, -0.1); B.foreR.rotation.x = -0.85; B.head.rotation.y = -0.35; },
};

/** One body type in one pose: indexed vertices plus, per vertex, its colour slot and the (a, b) mix. */
function bake(build, pose) {
  const look = { ...build.look, shirt: MARK.shirt, bottomColor: MARK.bottom, hatColor: MARK.hat, skin: MARK.skin, hair: MARK.hair };
  const g = mergeVertices(bakePerson(look, B => { B.mouth.scale.set(1.5, 0.5, 1); POSES[pose](B, look); }, CROWD.detail));
  const col = g.attributes.color, n = col.count, slot = new Uint8Array(n), mix = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const c = [col.getX(i), col.getY(i), col.getZ(i)], hi = Math.max(...c), lo = Math.min(...c);
    if (hi - lo < 1e-3 || c.some(v => hi - v > 1e-3 && v - lo > 1e-3)) continue;      // a grey, or three different channels: a fixed colour
    slot[i] = PATTERN[c.reduce((bits, v, k) => bits | (hi - v < 1e-3 ? 1 << k : 0), 0)];
    mix[i * 2] = hi - lo; mix[i * 2 + 1] = lo;
  }
  return { pos: g.attributes.position.array, nrm: g.attributes.normal.array, col: col.array, slot, mix, index: g.index.array, n };
}

const swayPatch = {
  key: 'crowd-sway',
  uniforms: { uTime: U.time },
  apply(shader) {
    const S = CROWD.sway;
    prelude(shader, 'vertex', 'uniform float uTime;\nattribute vec2 life;');   // life: height above the feet (0–1 of CROWD.tall), a phase per person
    replaceInclude(shader, 'vertex', 'begin_vertex', /* glsl */`#include <begin_vertex>
      {
        float ph = life.y * 6.2831853, up = life.x * ${CROWD.tall.toFixed(2)};
        float sw = sin(uTime * 1.15 + ph * 3.0) * ${S.amp.toFixed(4)} + sin(uTime * 0.47 + ph) * ${S.slow.toFixed(4)};
        transformed.xz += vec2(cos(ph), sin(ph)) * sw * up * up * 0.55;
        transformed.y += sin(uTime * 1.9 + ph * 5.0) * ${S.breathe.toFixed(4)} * smoothstep(0.5, 1.2, up);
      }`);
  },
};

export function buildCrowd(spots) {
  const C = CROWD, r = rng(9191), group = new THREE.Group(), baked = new Map();
  const colors = Object.fromEntries(Object.entries(C.colors).map(([k, list]) => [k, list.map(h => new THREE.Color(h))]));
  const canSit = b => b.look.bottom !== 'skirt' && !b.look.apron;

  // who stands where: a body type that suits the role, a pose, their colours
  const chunks = new Map();
  for (const s of spots) {
    const fits = C.builds.filter(b => b.who.includes(s.role) && (!s.sit || canSit(b))), build = r.pick(fits.length ? fits : C.builds.filter(canSit));
    const pose = r.pick(s.sit ? C.poses.sit : C.poses[s.role] || C.poses.guest), key = `${C.builds.indexOf(build)}|${pose}`;
    if (!baked.has(key)) baked.set(key, bake(build, pose));
    const tint = [null, ...SLOTS.map(k => r.pick(colors[k]))];
    const ck = `${Math.floor(s.x / C.chunk)},${Math.floor(s.z / C.chunk)}`;
    if (!chunks.has(ck)) chunks.set(ck, []);
    chunks.get(ck).push({ s, v: baked.get(key), tint, size: r.range(...C.size), phase: r() });
  }

  const mat = patch(personMaterial(), swayPatch);
  let tris = 0;
  for (const list of chunks.values()) {
    const nv = list.reduce((a, p) => a + p.v.n, 0), ni = list.reduce((a, p) => a + p.v.index.length, 0);
    const pos = new Float32Array(nv * 3), nrm = new Int16Array(nv * 3), col = new Uint16Array(nv * 3), life = new Uint8Array(nv * 2), index = new Uint32Array(ni);
    let o = 0, io = 0;
    for (const { s, v, tint, size, phase } of list) {
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      for (let i = 0; i < v.n; i++) {
        const k = (o + i) * 3, x = v.pos[i * 3] * size, y = v.pos[i * 3 + 1] * size, z = v.pos[i * 3 + 2] * size, nx = v.nrm[i * 3], nz = v.nrm[i * 3 + 2];
        pos[k] = s.x + x * c + z * sn; pos[k + 1] = s.y + y; pos[k + 2] = s.z - x * sn + z * c;
        nrm[k] = (nx * c + nz * sn) * 32767; nrm[k + 1] = v.nrm[i * 3 + 1] * 32767; nrm[k + 2] = (-nx * sn + nz * c) * 32767;
        const t = tint[v.slot[i]], a = v.mix[i * 2], b = v.mix[i * 2 + 1];
        col[k] = Math.min(1, t ? a * t.r + b : v.col[i * 3]) * 65535; col[k + 1] = Math.min(1, t ? a * t.g + b : v.col[i * 3 + 1]) * 65535; col[k + 2] = Math.min(1, t ? a * t.b + b : v.col[i * 3 + 2]) * 65535;
        life[(o + i) * 2] = Math.min(255, Math.max(0, y / C.tall) * 255); life[(o + i) * 2 + 1] = phase * 255;
      }
      for (let i = 0; i < v.index.length; i++) index[io + i] = v.index[i] + o;
      o += v.n; io += v.index.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setAttribute('life', new THREE.BufferAttribute(life, 2, true));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    tris += ni / 3;
  }
  return { group, counts: { people: spots.length, kinds: baked.size, chunks: chunks.size, tris } };
}
