// Beach and street prop templates (unit geometries with a white/tinted `color`
// attribute, so instances can be coloured with instanceColor).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Copy with reversed winding and flipped normals, so thin shells show from both sides. */
function backFace(g) {
  const b = g.clone();
  for (const name of ['position', 'normal', 'color']) {
    const a = b.attributes[name], s = a.itemSize;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) {
      const t = a.array[(i + 1) * s + k]; a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k]; a.array[(i + 2) * s + k] = t;
    }
  }
  const n = b.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return b;
}

const box = (sx, sy, sz, x, y, z, hex = '#ffffff', rx = 0) => {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return paint(g, hex);
};

/** Beach umbrella canopy (tinted per instance), 2.6 m wide, open at 2.2 m. */
export function umbrellaCanopy() {
  const g = new THREE.ConeGeometry(1.35, 0.5, 10, 1, true);
  g.translate(0, 2.25, 0);
  const rim = new THREE.CylinderGeometry(1.35, 1.35, 0.14, 10, 1, true);
  rim.translate(0, 1.93, 0);
  // a light and a dark panel alternate, like real beach umbrellas
  const cone = paint(g, '#ffffff'), c = cone.attributes.color;
  for (let i = 0; i < c.count; i++) if (Math.floor(i / 6) % 2) c.setXYZ(i, 0.82, 0.82, 0.82);
  const r = paint(rim, '#ffffff');
  return mergeGeometries([cone, backFace(cone), r, backFace(r)]);
}

export function umbrellaPole() {
  const g = new THREE.CylinderGeometry(0.03, 0.035, 2.6, 5);
  g.translate(0, 1.2, 0);
  return paint(g, '#d9d4c8');
}

/** Deck chair facing +z: frame, seat and a raised back. Tinted per instance. */
export function deckChair() {
  return mergeGeometries([
    box(0.62, 0.05, 1.2, 0, 0.32, 0.15),                    // seat
    box(0.62, 0.05, 0.75, 0, 0.58, -0.72, '#ffffff', 0.8),   // back rest, reclined ~45°
    box(0.04, 0.32, 0.04, -0.28, 0.16, 0.65, '#bdbdb8'), box(0.04, 0.32, 0.04, 0.28, 0.16, 0.65, '#bdbdb8'),
    box(0.04, 0.32, 0.04, -0.28, 0.16, -0.4, '#bdbdb8'), box(0.04, 0.32, 0.04, 0.28, 0.16, -0.4, '#bdbdb8'),
  ]);
}

/** Plastic table + 4 stools (one instance = one set). */
export function tableSet() {
  const parts = [box(0.8, 0.04, 0.8, 0, 0.72, 0)];
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) parts.push(box(0.04, 0.7, 0.04, x, 0.35, z));
  for (const [x, z] of [[0, 0.75], [0, -0.75], [0.75, 0], [-0.75, 0]]) {
    const s = new THREE.CylinderGeometry(0.17, 0.14, 0.45, 8);
    s.translate(x, 0.225, z);
    parts.push(paint(s, '#ffffff'));
  }
  return mergeGeometries(parts);
}

/** Stack of inner tubes (ห่วงยาง) — colours baked, instance tint stays light. */
export function tubeStack(n = 5) {
  const cols = ['#f2c230', '#e0483a', '#3f8fd0', '#f07fa8', '#46b36a', '#ffffff'];
  const parts = [];
  for (let i = 0; i < n; i++) {
    const t = new THREE.TorusGeometry(0.42, 0.17, 8, 14);
    t.rotateX(Math.PI / 2);
    t.translate((i % 2) * 0.06, 0.17 + i * 0.3, 0);
    parts.push(paint(t, cols[i % cols.length]));
  }
  parts.push(box(1.2, 0.8, 0.6, 1.1, 0.4, 0, '#e9e2d0'));    // rental counter
  parts.push(box(1.4, 0.05, 0.9, 1.1, 1.9, 0, '#3f7fb5'));   // counter roof
  for (const x of [0.45, 1.75]) parts.push(box(0.05, 1.9, 0.05, x, 0.95, 0.4, '#d8d6d0'));
  return mergeGeometries(parts);
}

/** Power pole with cross-arm and a transformer on some (baked), 9 m. */
export function powerPole() {
  const pole = new THREE.CylinderGeometry(0.12, 0.17, 9, 6);
  pole.translate(0, 4.5, 0);
  return mergeGeometries([
    paint(pole, '#b9b5ab'),
    box(1.8, 0.1, 0.1, 0, 8.4, 0, '#8a867e'),
    box(1.4, 0.1, 0.1, 0, 7.6, 0, '#8a867e'),
    box(0.35, 0.5, 0.3, 0.3, 6.6, 0.15, '#9aa3a6'),
  ]);
}
