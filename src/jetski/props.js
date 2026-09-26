// Course props for the jet ski slalom (origin at the waterline, vertex-coloured; white
// parts take the instance tint): gate buoys, floating bottles, fishing-float lines and
// moored longtail boats.
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
/** Flat triangle seen from both sides. */
function flag(a, b, c, hex) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3));
  g.computeVertexNormals();
  return paint(g, hex);
}

/** Race buoy: tinted ball, pole and pennant (1.9 m tall). */
export function buoyGeometry() {
  return mergeGeometries([
    paint(new THREE.SphereGeometry(0.55, 14, 10).scale(1, 1.15, 1).translate(0, 0.2, 0), '#ffffff'),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12).translate(0, 0.62, 0), '#f4f2ec'),
    paint(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5).translate(0, 1.2, 0), '#d8d6d0'),
    flag([0, 1.85, 0], [0, 1.45, 0], [0.55, 1.65, 0], '#ffffff'),
  ]);
}

/** Plastic bottle lying on the water (tinted). */
export function bottleGeometry() {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(0.11, 0.11, 0.36, 8).rotateZ(Math.PI / 2).translate(0, 0.04, 0), '#ffffff'),
    paint(new THREE.CylinderGeometry(0.05, 0.08, 0.1, 8).rotateZ(Math.PI / 2).translate(0.22, 0.04, 0), '#ffffff'),
    paint(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8).rotateZ(Math.PI / 2).translate(0.29, 0.04, 0), '#2f6fc4'),
  ]);
}

/** A line of net floats (ทุ่นอวน) along x, 7 m long. */
export function floatLineGeometry() {
  const parts = [paint(new THREE.CylinderGeometry(0.02, 0.02, 7, 4).rotateZ(Math.PI / 2).translate(0, 0.05, 0), '#e8e4d0')];
  for (let i = 0; i < 7; i++) {
    parts.push(paint(new THREE.SphereGeometry(0.3, 10, 8).translate(-3 + i, 0.08, 0), i % 2 ? '#f4f2ec' : '#e8541e'));
  }
  parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4).translate(-3.5, 0.7, 0), '#6a5a4a'));   // marker sticks with rags
  parts.push(flag([-3.5, 1.4, 0], [-3.5, 1.0, 0], [-3.0, 1.2, 0], '#2a2a2a'));
  parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4).translate(3.5, 0.7, 0), '#6a5a4a'));
  parts.push(flag([3.5, 1.4, 0], [3.5, 1.0, 0], [4.0, 1.2, 0], '#2a2a2a'));
  return mergeGeometries(parts);
}

/** Moored longtail fishing boat, bow toward +z, 7.5 m. */
export function longtailGeometry() {
  const side = new THREE.Shape();                  // length along x
  side.moveTo(-3.6, 0.9); side.lineTo(2.6, 0.9); side.quadraticCurveTo(3.6, 1.2, 3.9, 1.9);
  side.quadraticCurveTo(3.2, 0.2, 1.8, -0.2); side.lineTo(-3.4, -0.1); side.lineTo(-3.6, 0.9);
  const g = new THREE.ExtrudeGeometry(side, { depth: 1.5, bevelEnabled: false });
  g.translate(0, 0, -0.75).rotateY(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) c.set(p.getY(i) > 0.75 ? '#d8443a' : p.getY(i) > 0.3 ? '#2f6fc4' : '#3a4a52').toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return mergeGeometries([
    g.toNonIndexed(),
    paint(new THREE.BoxGeometry(1.3, 0.08, 5.4).translate(0, 0.72, -0.4), '#9a7a52'),                       // floor boards
    paint(new THREE.BoxGeometry(1.5, 0.06, 1.6).translate(0, 2.0, -1.6), '#3f7fb5'),                         // sun roof
    ...[-2.3, -0.9].map(z => paint(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5).translate(0, 1.4, z), '#6a5a4a')),
    paint(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5).rotateX(1.3).translate(0, 0.9, -4.6), '#5a5a5a'),  // the long-tail shaft
    paint(new THREE.BoxGeometry(0.5, 0.45, 0.6).translate(0, 1.2, -3.3), '#4a4a4a'),                         // engine
    flag([0, 1.9, 3.85], [0, 1.4, 3.7], [0.35, 1.5, 4.2], '#f0c23a'),                                        // bow ribbons
    flag([0, 1.9, 3.85], [0, 1.4, 3.7], [-0.35, 1.5, 4.2], '#e8589a'),
  ]);
}
