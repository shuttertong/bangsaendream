// Kid-friendly dressing for the road-closed barriers (roadblock.js): the flag-waving road-work
// doll (ตุ๊กตาโบกธง, a Thai roadside classic, drawn chibi-style), teddy bears and rubber ducks
// sitting on the barriers, rainbow bunting, balloons, cones, and a painted sign board.
// Static parts go into the kit; the dolls' waving arms are one instanced mesh animated in the
// vertex shader, and the sign faces share one canvas texture (redrawn when the language changes).
import * as THREE from 'three';
import { patch, prelude, replaceInclude, U } from '../../core/shaderPatch.js';
import { paintedMaterial } from '../../world/materials.js';

export const PROPS = {
  doll: { skin: '#e8b98f', hat: '#f4f2ec', vest: '#f08a3a', stripe: '#f4e04a', shirt: '#3a6fb8', pants: '#2e3f6a', shoe: '#3a3a3a', cheek: '#f09a9a', eye: '#2a2320', flag: '#e2453a', stick: '#d9c9a8' },
  wave: { speed: 3.2, amp: 0.55, lift: 0.35 },           // swing speed, swing (rad), raised angle (outward, over the shoulder)
  teddy: ['#c9955f', '#e8c89a', '#f2b6c6', '#a8d0ec', '#f4f0e8'],
  duck: { body: '#f6d33c', beak: '#f08a2a' },
  bunting: ['#e2453a', '#f08a3a', '#f4d03c', '#5fb85a', '#4f9ad8', '#9a6ad0'],
  balloons: ['#f06a6a', '#f4c43c', '#6ac0f0', '#8ad06a', '#f09ad0', '#b88af0'],
  cone: { body: '#f07a2a', band: '#f4f2ec', base: '#3a3a3a' },
  sign: { board: '#fff6e2', edge: '#f08a3a', post: '#8d9aa3', w: 3.2, h: 1.4 },
};

const col = h => new THREE.Color(h);
const SPH = new THREE.SphereGeometry(1, 10, 8);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** Ellipsoid at world p, radii (rx, ry, rz), turned yaw about Y. */
function blob(kit, p, rx, ry, rz, yaw, c) { kit.add('wall', SPH, _m.compose(p, _q.setFromAxisAngle(_up, yaw), _s.set(rx, ry, rz)), c); }

/** Chibi road-work doll standing at frame point (u, g, w), facing −w (the walkable side). Returns its waving-arm placement. */
export function flagDoll(kit, f, u, g, w, ry) {
  const D = PROPS.doll, face = ry + Math.PI, fwd = -1;       // the face points along −w
  const at = (du, v, dw) => f.P(u + du, g + v, w + dw * fwd);
  for (const s of [-0.13, 0.13]) {
    f.box('wall', u + s, g + 0.3, w, 0.16, 0.6, 0.18, col(D.pants));
    f.box('wall', u + s, g + 0.05, w - 0.04 * fwd, 0.18, 0.1, 0.28, col(D.shoe));
  }
  f.box('wall', u, g + 0.82, w, 0.5, 0.5, 0.3, col(D.shirt));                // body
  f.box('wall', u, g + 0.84, w, 0.53, 0.42, 0.33, col(D.vest));              // reflective vest
  for (const v of [0.74, 0.92]) f.box('wall', u, g + v, w, 0.54, 0.05, 0.34, col(D.stripe));
  f.box('wall', u - 0.3, g + 0.78, w, 0.13, 0.42, 0.14, col(D.shirt));       // resting left arm
  blob(kit, at(-0.3, 0.54, 0), 0.07, 0.07, 0.07, face, col(D.skin));
  // big round head, face, hard hat
  blob(kit, at(0, 1.38, 0), 0.34, 0.32, 0.32, face, col(D.skin));
  for (const s of [-0.12, 0.12]) {
    blob(kit, at(s, 1.4, 0.29), 0.045, 0.06, 0.03, face, col(D.eye));
    blob(kit, at(s * 1.55, 1.3, 0.26), 0.06, 0.035, 0.03, face, col(D.cheek));
  }
  kit.add('wall', new THREE.TorusGeometry(0.07, 0.018, 6, 10, Math.PI).rotateZ(Math.PI), _m.compose(at(0, 1.29, 0.31), _q.setFromAxisAngle(_up, face), _s.set(1, 1, 1)), col(D.eye));   // smile
  blob(kit, at(0, 1.6, 0), 0.36, 0.2, 0.36, face, col(D.hat));
  f.box('wall', u, g + 1.6, w - 0.18 * fwd, 0.5, 0.04, 0.26, col(D.hat));    // brim
  // the waving right arm: shoulder pivot, in the doll's own frame (x right, y up, z toward the viewer)
  const sh = at(0.3, 1.02, 0);
  return new THREE.Matrix4().compose(sh, new THREE.Quaternion().setFromAxisAngle(_up, face), new THREE.Vector3(1, 1, 1));
}

/** Arm + flag geometry: pivot at the shoulder (origin), pointing up; merged with vertex colours. */
function armGeometry() {
  const D = PROPS.doll, parts = [];
  const add = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = col(c); for (let i = 0; i < n; i++) cc.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g.toNonIndexed()); };
  add(new THREE.BoxGeometry(0.13, 0.44, 0.14).translate(0, 0.2, 0), D.shirt);
  add(new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0.46, 0), D.skin);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6).translate(0, 0.85, 0), D.stick);
  add(new THREE.BoxGeometry(0.02, 0.32, 0.5).translate(0, 1.12, 0.26), D.flag);
  const out = new THREE.BufferGeometry(), keys = ['position', 'normal', 'color'];
  for (const k of keys) {
    const arrays = parts.map(p => p.attributes[k].array), len = arrays.reduce((a, b) => a + b.length, 0), all = new Float32Array(len);
    let o = 0; for (const a of arrays) { all.set(a, o); o += a.length; }
    out.setAttribute(k, new THREE.BufferAttribute(all, 3));
  }
  return out;
}

const wavePatch = {
  key: 'dollwave',
  uniforms: { uTime: U.time },
  apply(shader) {
    const W = PROPS.wave;
    prelude(shader, 'vertex', 'uniform float uTime;');
    const rot = /* glsl */`
      #ifdef USE_INSTANCING
      {
        vec3 ip = vec3(instanceMatrix[3]);
        float a = ${W.lift.toFixed(3)} + ${W.amp.toFixed(3)} * (0.5 + 0.5 * sin(uTime * ${W.speed.toFixed(3)} + ip.x * 0.7 + ip.z * 0.3));
        float c = cos(a), s = sin(a);
        TARGET.xy = vec2(c * TARGET.x - s * TARGET.y, s * TARGET.x + c * TARGET.y);
      }
      #endif`;
    replaceInclude(shader, 'vertex', 'begin_vertex', `#include <begin_vertex>\n${rot.replaceAll('TARGET', 'transformed')}`);
    if (shader.vertexShader.includes('#include <beginnormal_vertex>')) replaceInclude(shader, 'vertex', 'beginnormal_vertex', `#include <beginnormal_vertex>\n${rot.replaceAll('TARGET', 'objectNormal')}`);
  },
};

/** One instanced mesh of waving arms for every doll (placements from flagDoll). */
export function createWavingArms(scene, placements) {
  if (!placements.length) return null;
  const mesh = new THREE.InstancedMesh(armGeometry(), patch(paintedMaterial({ amp: 0.04, scale: 1 }), wavePatch), placements.length);
  placements.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.customDepthMaterial = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), wavePatch);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius += 2;
  scene.add(mesh);
  return mesh;
}

/** A plush teddy bear sitting at p (world), facing yaw. */
export function teddy(kit, p, yaw, c, s = 1) {
  const C = col(c), light = col(c).lerp(col('#fff4e4'), 0.5), dark = col('#2a2320');
  const P = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(s).applyAxisAngle(_up, yaw).add(p);
  blob(kit, P(0, 0.16, 0), 0.15 * s, 0.17 * s, 0.13 * s, yaw, C);                     // body
  blob(kit, P(0, 0.15, 0.08), 0.09 * s, 0.1 * s, 0.05 * s, yaw, light);               // tummy
  blob(kit, P(0, 0.4, 0), 0.13 * s, 0.12 * s, 0.12 * s, yaw, C);                      // head
  for (const x of [-0.1, 0.1]) {
    blob(kit, P(x, 0.51, 0), 0.05 * s, 0.05 * s, 0.03 * s, yaw, C);                   // ears
    blob(kit, P(x * 1.6, 0.2, 0.03), 0.05 * s, 0.09 * s, 0.05 * s, yaw, C);           // arms
    blob(kit, P(x, 0.04, 0.1), 0.06 * s, 0.05 * s, 0.08 * s, yaw, C);                 // legs
    blob(kit, P(x * 0.45, 0.43, 0.105), 0.016 * s, 0.02 * s, 0.01 * s, yaw, dark);    // eyes
  }
  blob(kit, P(0, 0.37, 0.1), 0.05 * s, 0.04 * s, 0.03 * s, yaw, light);               // muzzle
  blob(kit, P(0, 0.385, 0.128), 0.018 * s, 0.013 * s, 0.01 * s, yaw, dark);           // nose
}

/** A rubber duck at p. */
export function duck(kit, p, yaw, s = 1) {
  const D = PROPS.duck, P = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(s).applyAxisAngle(_up, yaw).add(p);
  blob(kit, P(0, 0.09, 0), 0.13 * s, 0.09 * s, 0.1 * s, yaw, col(D.body));
  blob(kit, P(0.02, 0.23, 0.02), 0.07 * s, 0.07 * s, 0.07 * s, yaw, col(D.body));
  blob(kit, P(0.02, 0.22, 0.09), 0.035 * s, 0.015 * s, 0.035 * s, yaw, col(D.beak));
  for (const x of [-0.03, 0.07]) blob(kit, P(x, 0.26, 0.07), 0.012 * s, 0.015 * s, 0.01 * s, yaw, col('#2a2320'));
}

/** Pennants hung on a sagging string from world a to b (along the fence plane). */
export function bunting(kit, a, b, sag = 0.35, every = 0.45) {
  const L = a.distanceTo(b), n = Math.max(2, Math.round(L / every)), dir = b.clone().sub(a).setY(0).normalize();
  const at = k => a.clone().lerp(b, k).setY(THREE.MathUtils.lerp(a.y, b.y, k) - Math.sin(Math.PI * k) * sag);
  let prev = at(0);
  for (let i = 1; i <= n; i++) {
    const q = at(i / n);
    kit.rod('wall', prev, q, 0.008, col('#f4f2ec'));
    if (i < n) {
      const c = col(PROPS.bunting[i % PROPS.bunting.length]), h = 0.3, w = 0.14;
      const l = q.clone().addScaledVector(dir, -w), r = q.clone().addScaledVector(dir, w), tip = q.clone().setY(q.y - h);
      const v = [l, r, tip, r, l, tip].flatMap(p => [p.x, p.y, p.z]);
      kit.tris3('wall', v, c, { x: q.x, z: q.z });
    }
    prev = q;
  }
}

/** Three balloons tied to world point p. */
export function balloons(kit, p, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const a = seed * 2.1 + i * 2.2, top = p.clone().add(new THREE.Vector3(Math.cos(a) * 0.35, 0.9 + i * 0.22, Math.sin(a) * 0.35));
    kit.rod('wall', p, top, 0.006, col('#f4f2ec'));
    blob(kit, top.clone().setY(top.y + 0.22), 0.19, 0.24, 0.19, 0, col(PROPS.balloons[(seed * 3 + i) % PROPS.balloons.length]));
  }
}

/** A traffic cone on the ground at p. */
export function cone(kit, p) {
  const C = PROPS.cone;
  kit.box('wall', p.x, p.y + 0.02, p.z, 0.42, 0.04, 0.42, 0, col(C.base));
  kit.add('wall', new THREE.CylinderGeometry(0.035, 0.17, 0.62, 12), _m.makeTranslation(p.x, p.y + 0.33, p.z), col(C.body));
  kit.add('wall', new THREE.CylinderGeometry(0.1, 0.125, 0.1, 12), _m.makeTranslation(p.x, p.y + 0.36, p.z), col(C.band));
}

/** Canvas-texture sign faces: one mesh for all boards. draw(ctx, w, h) paints the face. */
export function createSignFaces(scene, boards, draw) {
  if (!boards.length) return null;
  const S = PROPS.sign, canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = Math.round(1024 * S.h / S.w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geos = boards.map(m => new THREE.PlaneGeometry(S.w - 0.12, S.h - 0.12).applyMatrix4(m));
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const arrs = geos.map(q => q.toNonIndexed().attributes[k].array), all = new Float32Array(arrs.reduce((a, b) => a + b.length, 0));
    let o = 0; for (const a of arrs) { all.set(a, o); o += a.length; }
    g.setAttribute(k, new THREE.BufferAttribute(all, k === 'uv' ? 2 : 3));
  }
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  const redraw = () => { const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); draw(c, canvas.width, canvas.height); tex.needsUpdate = true; };
  redraw();
  document.fonts?.ready.then(redraw);                       // Kanit may still be loading
  return { mesh, redraw };
}
