// Procedural macaque (body + head + curled tail, front and back leg pairs so they can
// gallop), snack items and the picnic mat. Monkey faces +z, ≈0.55 m tall at scale 1.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 8);

export function monkeyGeometry(m) {
  const fur = m.fur, face = m.face;
  const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.36, -0.22), new THREE.Vector3(0, 0.5, -0.4), new THREE.Vector3(0, 0.62, -0.38), new THREE.Vector3(0, 0.6, -0.26),
  ]), 10, 0.025, 5, false);
  const body = mergeGeometries([
    paint(cap(0.13, 0.22).rotateX(Math.PI / 2 - 0.35).translate(0, 0.36, 0), fur),        // torso, a little hunched
    paint(new THREE.SphereGeometry(0.12, 14, 10).translate(0, 0.52, 0.2), fur),            // head
    paint(new THREE.SphereGeometry(0.075, 12, 8).scale(1.1, 0.95, 0.6).translate(0, 0.5, 0.29), face),   // face
    paint(new THREE.SphereGeometry(0.018, 6, 4).translate(0.035, 0.53, 0.33), '#2a1a14'),
    paint(new THREE.SphereGeometry(0.018, 6, 4).translate(-0.035, 0.53, 0.33), '#2a1a14'),
    paint(new THREE.SphereGeometry(0.03, 8, 6).scale(1.4, 0.8, 0.7).translate(0, 0.475, 0.335), '#b87868'),  // muzzle
    paint(new THREE.SphereGeometry(0.035, 8, 6).scale(0.5, 1, 1).translate(0.12, 0.55, 0.18), face),        // ears
    paint(new THREE.SphereGeometry(0.035, 8, 6).scale(0.5, 1, 1).translate(-0.12, 0.55, 0.18), face),
    paint(tail, fur),
  ]);
  // legs hang from a pivot at hip / shoulder height so they can swing
  const leg = (x, z, len) => paint(cap(0.035, len).translate(x, -len / 2, z), fur);
  const front = mergeGeometries([leg(0.08, 0, 0.22), leg(-0.08, 0, 0.22)]);
  const back = mergeGeometries([leg(0.09, 0, 0.24), leg(-0.09, 0, 0.24)]);
  return { body, front, back };
}

export function snackGeometry(s) {
  switch (s.id) {
    case 'banana': return mergeGeometries([0, 1, 2].map(i => paint(new THREE.TorusGeometry(0.1, 0.022, 6, 10, Math.PI * 0.8).rotateZ(-0.6).translate(i * 0.035 - 0.035, 0.08, i * 0.02), s.color)));
    case 'chips': return paint(new THREE.BoxGeometry(0.16, 0.2, 0.07).translate(0, 0.1, 0), s.color);
    case 'mango': return paint(new THREE.SphereGeometry(0.07, 12, 8).scale(1, 0.8, 1.4).translate(0, 0.06, 0), s.color);
    default: return mergeGeometries([paint(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 12).translate(0, 0.07, 0), s.color), paint(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 4).translate(0.015, 0.18, 0), '#ffffff')]);
  }
}

/** Woven picnic mat (เสื่อ) with a checked pattern. */
export function matGeometry(half) {
  const g = new THREE.PlaneGeometry(half * 2, half * 2, 12, 12).rotateX(-Math.PI / 2).toNonIndexed();
  const p = g.attributes.position, a = new Float32Array(p.count * 3), c1 = new THREE.Color('#d8443a'), c2 = new THREE.Color('#f0e6c8');
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const cell = half / 3;                                   // 6×6 squares, each two grid segments wide
    const c = (Math.floor((cx + half) / cell) + Math.floor((cz + half) / cell)) % 2 ? c1 : c2;
    for (let k = 0; k < 3; k++) c.toArray(a, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}
