// Sea animals for the aquarium (town/aquarium.js), built from primitives with vertex colours. Each model faces +z
// (head forward), stands on its own middle, and is `size` metres long — species data in shared/aquarium.js.
// sealifeGeometry(spec) → BufferGeometry (position, normal, color; non-indexed).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = new THREE.Color(), V = new THREE.Vector3();
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

/** Vertex colours from fn(x, y, z) → Color (THREE.Color reused). */
function paint(g, fn) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); fn(V.x, V.y, V.z).toArray(col, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
const solid = hex => () => C.set(hex);
/** A body of revolution along z: profile [[z, r], …] from tail to nose. */
function lathe(profile, seg = 14) {
  const g = new THREE.LatheGeometry(profile.map(([z, r]) => new THREE.Vector2(Math.max(0.0005, r), z)), seg);
  return g.rotateX(Math.PI / 2);                                       // lathe axis y → z (nose toward +z)
}
/** A flat fin: triangle (a, b, c) given a little thickness, in its own colour. */
function fin(a, b, c, hex, t = 0.01) {
  const g = new THREE.BufferGeometry(), n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize().multiplyScalar(t);
  const A = [a, b, c].map(p => p.clone().add(n)), B = [a, b, c].map(p => p.clone().sub(n));
  const v = [...A[0].toArray(), ...A[1].toArray(), ...A[2].toArray(), ...B[0].toArray(), ...B[2].toArray(), ...B[1].toArray()];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return paint(g, solid(hex));
}
const P3 = (x, y, z) => new THREE.Vector3(x, y, z);
const eyes = (z, y, x, r, hex = '#141414') => [-1, 1].map(s => paint(new THREE.SphereGeometry(r, 6, 4).translate(s * x, y, z), solid(hex)));

/** A fish: body, tail, dorsal and side fins; bands (white rings across the body), spots, a paler belly. */
function fish(s, { tall = 0.36, wide = 0.17 } = {}) {
  const L = 1, [body, belly, mark] = s.colors, bands = s.bands || 0;
  const g = new THREE.SphereGeometry(0.5, 16, 10).scale(wide * 2, tall * 2, 1);
  const parts = [paint(g, (x, y, z) => {
    C.set(body).lerp(C.clone().set(belly), Math.max(0, Math.min(1, -y / (tall * 0.9) + 0.35)));
    if (bands) for (let k = 0; k < bands; k++) { const bz = 0.28 - k * (0.56 / Math.max(1, bands - 1)); if (Math.abs(z - bz) < 0.035) C.set(mark); }
    if (s.spots && hash(Math.round(x * 30), Math.round(y * 30), Math.round(z * 30)) > 0.82) C.set(mark);
    return C;
  })];
  parts.push(fin(P3(0, 0, -0.46), P3(0, tall * 0.75, -0.72), P3(0, -tall * 0.75, -0.72), mark));   // tail
  parts.push(fin(P3(0, tall * 0.95, 0.18), P3(0, tall * 1.35, -0.05), P3(0, tall * 0.92, -0.3), mark));   // dorsal
  for (const sd of [-1, 1]) parts.push(fin(P3(sd * wide, -0.02, 0.12), P3(sd * (wide + 0.16), -0.08, -0.04), P3(sd * wide, -0.1, 0.0), mark));
  parts.push(...eyes(0.34, tall * 0.25, wide * 0.72, 0.035));
  return mergeGeometries(parts).scale(s.size / L, s.size / L, s.size / L);
}

function puffer(s) {
  const [body, belly, mark] = s.colors, parts = [];
  parts.push(paint(new THREE.SphereGeometry(0.42, 14, 10), (x, y, z) => (hash(Math.round(x * 25), Math.round(y * 25), Math.round(z * 25)) > 0.85 ? C.set(mark) : C.set(body).lerp(C.clone().set(belly), Math.max(0, -y * 2 + 0.3)))));
  parts.push(fin(P3(0, 0, -0.38), P3(0, 0.22, -0.62), P3(0, -0.22, -0.62), mark));
  parts.push(...eyes(0.3, 0.12, 0.2, 0.05));
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function lionfish(s) {
  const base = fish(s, { tall: 0.4, wide: 0.16 }).scale(1 / s.size, 1 / s.size, 1 / s.size), parts = [base], [, light, dark] = s.colors;
  for (let k = 0; k < 9; k++) {                                        // tall spiny dorsal rays
    const z = 0.22 - k * 0.07, h = 0.42 + 0.25 * Math.sin((k / 8) * Math.PI);
    parts.push(fin(P3(0, 0.3, z), P3(0, 0.3 + h, z - 0.06), P3(0, 0.3, z - 0.05), k % 2 ? light : dark, 0.006));
  }
  for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) {               // feathery side fans
    const a = -0.6 + k * 0.3;
    parts.push(fin(P3(sd * 0.15, 0, 0.05), P3(sd * (0.2 + Math.cos(a) * 0.5), Math.sin(a) * 0.45, -0.2), P3(sd * 0.15, -0.05, -0.05), k % 2 ? light : dark, 0.005));
  }
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function lobster(s) {
  const [shell, legs, mark] = s.colors, parts = [];
  for (let k = 0; k < 6; k++) parts.push(paint(new THREE.SphereGeometry(0.12 - k * 0.012, 10, 6).scale(1.2, 0.8, 1.1).translate(0, 0, 0.18 - k * 0.11), (x, y) => C.set(shell).lerp(C.clone().set(mark), y > 0.04 ? 0.25 : 0)));
  parts.push(fin(P3(0, 0, -0.42), P3(0.16, 0, -0.56), P3(-0.16, 0, -0.56), shell, 0.01));
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 4; k++) parts.push(paint(new THREE.CylinderGeometry(0.012, 0.01, 0.26, 4).rotateZ(sd * 1.1).translate(sd * 0.16, -0.08, 0.18 - k * 0.07), solid(legs)));
    parts.push(paint(new THREE.CylinderGeometry(0.014, 0.006, 0.9, 4).rotateX(-1.2).rotateY(sd * 0.35).translate(sd * 0.12, 0.12, 0.62), solid(mark)));   // the long antennae
  }
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function seahorse(s) {
  const [body, light, dark] = s.colors;
  const curve = new THREE.CatmullRomCurve3([P3(0, 0.45, 0.02), P3(0, 0.3, 0.08), P3(0, 0.05, 0.06), P3(0, -0.2, -0.02), P3(0, -0.36, 0.05), P3(0, -0.38, 0.14), P3(0, -0.3, 0.13)]);
  const radius = [0.07, 0.09, 0.1, 0.07, 0.04, 0.025, 0.015];
  const g = new THREE.TubeGeometry(curve, 24, 1, 8, false), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {                                 // taper by the point's place along the curve
    const t = Math.floor(i / 9) / 24, r = radius[Math.min(6, Math.floor(t * 6))] * (1 - (t * 6 % 1)) + radius[Math.min(6, Math.ceil(t * 6))] * (t * 6 % 1), c = curve.getPoint(t);
    p.setXYZ(i, c.x + n.getX(i) * r, c.y + n.getY(i) * r, c.z + n.getZ(i) * r);
  }
  const parts = [paint(g, (x, y) => C.set(body).lerp(C.clone().set(Math.sin(y * 60) > 0.6 ? dark : light), 0.35))];
  parts.push(paint(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6).rotateX(Math.PI / 2).translate(0, 0.42, 0.12), solid(body)));   // snout
  parts.push(fin(P3(0, 0.12, -0.06), P3(0, 0.2, -0.16), P3(0, 0.0, -0.13), light, 0.005));
  parts.push(...eyes(0.07, 0.44, 0.05, 0.02));
  return mergeGeometries(parts).scale(s.size * 1.6, s.size * 1.6, s.size * 1.6);
}

function crab(s) {
  const [shell, under, dark] = s.colors, parts = [paint(new THREE.SphereGeometry(0.3, 12, 6).scale(1.4, 0.4, 0.8), (x, y) => C.set(y < -0.02 ? under : shell))];
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 3; k++) parts.push(paint(new THREE.CylinderGeometry(0.025, 0.015, 0.42, 4).rotateZ(sd * 1.15).translate(sd * 0.46, -0.08, 0.1 - k * 0.12), solid(shell)));
    parts.push(paint(new THREE.SphereGeometry(0.1, 6, 4).scale(1.4, 0.2, 1).translate(sd * 0.55, -0.05, -0.28), solid(shell)));   // the paddles
    parts.push(paint(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 5).rotateX(Math.PI / 2).rotateY(sd * 0.6).translate(sd * 0.32, 0.02, 0.38), solid(dark)));   // claws
  }
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function ray(s) {
  const [top, under, spot] = s.colors, sh = new THREE.Shape();
  sh.moveTo(0, 0.45); sh.quadraticCurveTo(0.2, 0.2, 0.5, -0.05); sh.quadraticCurveTo(0.2, -0.12, 0, -0.32); sh.quadraticCurveTo(-0.2, -0.12, -0.5, -0.05); sh.quadraticCurveTo(-0.2, 0.2, 0, 0.45);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 }).rotateX(-Math.PI / 2).translate(0, -0.025, 0);
  const parts = [paint(g, (x, y, z) => (y < -0.02 ? C.set(under) : hash(Math.round(x * 20), 0, Math.round(z * 20)) > 0.8 ? C.set(spot) : C.set(top)))];
  parts.push(paint(new THREE.CylinderGeometry(0.004, 0.018, 1.1, 4).rotateX(Math.PI / 2).translate(0, 0, -0.85), solid(top)));   // the whip tail
  parts.push(...eyes(0.36, 0.05, 0.08, 0.025));
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function shark(s, { banded = true } = {}) {
  const [body, belly, mark] = s.colors, bands = s.bands || 0;
  const g = lathe([[-0.5, 0], [-0.42, 0.03], [-0.2, 0.07], [0.1, 0.085], [0.32, 0.07], [0.46, 0.035], [0.5, 0]], 12);
  const parts = [paint(g, (x, y, z) => {
    C.set(body).lerp(C.clone().set(belly), Math.max(0, Math.min(1, -y * 12 + 0.3)));
    if (banded && bands && Math.sin((z + 0.5) * bands * Math.PI) > 0.75 && y > -0.02) C.set(mark);
    return C;
  })];
  parts.push(fin(P3(0, 0.07, 0.02), P3(0, 0.17, -0.06), P3(0, 0.07, -0.12), body));
  parts.push(fin(P3(0, 0.05, -0.2), P3(0, 0.12, -0.26), P3(0, 0.04, -0.3), body));
  parts.push(fin(P3(0, 0.02, -0.46), P3(0, 0.14, -0.6), P3(0, -0.06, -0.54), body));
  for (const sd of [-1, 1]) parts.push(fin(P3(sd * 0.06, -0.04, 0.16), P3(sd * 0.2, -0.09, 0.04), P3(sd * 0.06, -0.05, 0.06), body));
  parts.push(...eyes(0.4, 0.03, 0.045, 0.012));
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function turtle(s) {
  const [shell, skin, dark] = s.colors, parts = [];
  parts.push(paint(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1.25), (x, y, z) => C.set(shell).lerp(C.clone().set(dark), Math.abs(Math.sin(x * 22) * Math.sin(z * 18)) > 0.7 ? 0.5 : 0)));
  parts.push(paint(new THREE.SphereGeometry(0.29, 12, 4).scale(1, 0.14, 1.2), solid(skin)));
  parts.push(paint(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 0.9, 1.2).translate(0, 0.03, 0.42), solid(skin)));
  for (const sd of [-1, 1]) {
    parts.push(paint(new THREE.SphereGeometry(0.2, 8, 4).scale(1.4, 0.15, 0.5).rotateY(sd * -0.5).translate(sd * 0.36, 0, 0.18), solid(skin)));
    parts.push(paint(new THREE.SphereGeometry(0.1, 6, 4).scale(1.2, 0.2, 0.7).translate(sd * 0.22, 0, -0.34), solid(skin)));
  }
  parts.push(...eyes(0.5, 0.06, 0.05, 0.018));
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

/** The jelly's bell and tentacles (its own translucent material in aquarium.js). */
function jelly(s) {
  const [bell, inner, frill] = s.colors;
  const g = new THREE.LatheGeometry([[0.001, 0.32], [0.18, 0.3], [0.33, 0.2], [0.42, 0.04], [0.4, 0.0], [0.3, 0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
  const parts = [paint(g, (x, y) => C.set(bell).lerp(C.clone().set(inner), y > 0.18 ? 0.3 : 0))];
  for (let k = 0; k < 4; k++) parts.push(paint(new THREE.TorusGeometry(0.07, 0.018, 4, 10).rotateX(Math.PI / 2).translate(Math.cos(k * 1.57) * 0.11, 0.2, Math.sin(k * 1.57) * 0.11), solid(frill)));   // the four rings
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; parts.push(paint(new THREE.CylinderGeometry(0.006, 0.003, 0.55, 3).translate(Math.cos(a) * 0.36, -0.27, Math.sin(a) * 0.36), solid(frill))); }
  return mergeGeometries(parts).scale(s.size * 2, s.size * 2, s.size * 2);
}

function eel(s) {
  const [body, belly, dark] = s.colors, pts = [];
  for (let k = 0; k <= 10; k++) pts.push(P3(Math.sin(k * 0.9) * 0.05, 0, 0.5 - k * 0.1));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.045, 7, false);
  const parts = [paint(g, (x, y, z) => C.set(y < -0.015 ? belly : body).lerp(C.clone().set(dark), z < -0.3 ? 0.4 : 0))];
  parts.push(paint(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.85, 1.4).translate(0, 0, 0.5), solid(body)));
  parts.push(...eyes(0.56, 0.02, 0.035, 0.008));
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function starfish(s) {
  const [main, light, dark] = s.colors, sh = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.17 : 0.5; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }).rotateX(-Math.PI / 2);
  return paint(g, (x, y, z) => (hash(Math.round(x * 40), 0, Math.round(z * 40)) > 0.8 ? C.set(dark) : C.set(main).lerp(C.clone().set(light), y > 0.05 ? 0.4 : 0))).scale(s.size, s.size, s.size);
}

function cucumber(s) {
  const [body, light, dark] = s.colors;
  return paint(new THREE.SphereGeometry(0.5, 12, 8).scale(0.32, 0.26, 1), (x, y, z) => (hash(Math.round(x * 30), Math.round(y * 30), Math.round(z * 30)) > 0.75 ? C.set(dark) : C.set(body).lerp(C.clone().set(light), y > 0.05 ? 0.3 : 0))).scale(s.size, s.size, s.size);
}

/** Bryde's whale: long and slim, three ridges on the head (here: a darker back), pale throat grooves. */
function whale(s) {
  const [body, belly, dark] = s.colors;
  const g = lathe([[-0.5, 0.0], [-0.44, 0.025], [-0.3, 0.055], [-0.05, 0.09], [0.2, 0.095], [0.38, 0.075], [0.47, 0.045], [0.5, 0.0]], 18);
  const parts = [paint(g, (x, y, z) => {
    C.set(body).lerp(C.clone().set(dark), y > 0.06 ? 0.5 : 0);
    if (y < -0.02) C.set(belly).lerp(C.clone().set(body), z > 0.15 && Math.sin(x * 260) > 0.3 ? 0.35 : 0);   // throat grooves
    return C;
  })];
  for (const sd of [-1, 1]) parts.push(fin(P3(sd * 0.0, 0, -0.47), P3(sd * 0.13, 0.0, -0.56), P3(sd * 0.0, 0, -0.52), dark, 0.006));
  for (const sd of [-1, 1]) parts.push(fin(P3(sd * 0.08, -0.04, 0.22), P3(sd * 0.2, -0.08, 0.12), P3(sd * 0.08, -0.05, 0.14), dark, 0.006));
  parts.push(fin(P3(0, 0.07, -0.22), P3(0, 0.12, -0.28), P3(0, 0.06, -0.3), dark, 0.006));
  parts.push(...eyes(0.36, 0.0, 0.07, 0.008));
  return mergeGeometries(parts).scale(s.size, s.size, s.size);
}

function whaleShark(s) {
  const g = shark({ ...s, bands: 0 }, { banded: false }).scale(1 / s.size, 1 / s.size, 1 / s.size);
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {                                 // white spots on the back, a wide flat head
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0.3) p.setX(i, x * 1.5);
    if (y > 0 && hash(Math.round(x * 60), Math.round(y * 60), Math.round(z * 60)) > 0.86) c.setXYZ(i, 0.94, 0.94, 0.92);
  }
  g.computeVertexNormals();
  return g.scale(s.size, s.size * 1.2, s.size);
}

const MODELS = { fish: s => fish(s, { tall: s.tall ?? 0.36 }), puffer, lionfish, lobster, seahorse, crab, ray, shark: s => shark(s), turtle, jelly, eel, starfish, cucumber, whale, whaleShark };
const cache = new Map();
/** The geometry for a species (built once). */
export function sealifeGeometry(id, spec) {
  if (!cache.has(id)) cache.set(id, MODELS[spec.model](spec));
  return cache.get(id);
}
