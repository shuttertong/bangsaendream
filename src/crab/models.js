// Procedural crab models (unit size ≈ 1 m across, scaled per catch), burrow holes and
// the flashlight. Crabs walk sideways: body width is along x.
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
const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
const S = (g, x, y, z) => { g.scale(x, y, z); return g; };
const R = (g, rx, ry, rz) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); return g; };

/** Cylinder from a to b. */
function seg(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), g = new THREE.CylinderGeometry(r, r, d.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** { body, legs } geometries for a species (vertex-coloured). */
export function crabGeometry(sp) {
  const parts = [];
  if (sp.shell) {                                   // hermit crab: spiral shell on its back
    parts.push(paint(T(S(new THREE.SphereGeometry(0.42, 14, 10), 1, 0.9, 1.1), 0, 0.42, -0.12), sp.shell));
    parts.push(paint(T(R(new THREE.ConeGeometry(0.26, 0.5, 12), -1.1, 0, 0), 0, 0.55, -0.52), sp.shell));
    parts.push(paint(T(S(new THREE.SphereGeometry(0.22, 10, 8), 1.2, 0.8, 1), 0, 0.22, 0.28), sp.body));
  } else {
    parts.push(paint(T(S(new THREE.SphereGeometry(0.5, 16, 10), 1, 0.42, 0.78), 0, 0.3, 0), sp.body));
  }
  // eye stalks with dark eyes (ghost crabs' tall stalks)
  const st = sp.stalks || 0.6;
  for (const x of [-0.16, 0.16]) {
    parts.push(paint(T(new THREE.CylinderGeometry(0.035, 0.04, 0.32 * st, 6), x, 0.52 + 0.16 * st, 0.28), sp.body));
    parts.push(paint(T(S(new THREE.SphereGeometry(0.075, 8, 6), 1, 1.5, 1), x, 0.52 + 0.34 * st, 0.28), sp.eyes));
  }
  // claws: one bigger (like real ghost crabs)
  for (const [x, s] of [[-0.32, 1.25], [0.3, 0.85]]) {
    parts.push(paint(T(S(new THREE.SphereGeometry(0.13 * s, 10, 8), 1, 0.8, 1.4), x, 0.26, 0.5), sp.body));
    parts.push(paint(T(R(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), 1.2, 0, 0), x * 0.9, 0.26, 0.36), sp.legs));
  }
  // legs: 4 per side, body edge → knee (up and out) → foot on the sand
  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = 0.2 - i * 0.15, spread = (1.5 - i) * 0.12;
    const hip = new THREE.Vector3(side * 0.4, 0.28, z);
    const knee = new THREE.Vector3(side * 0.66, 0.44, z + spread);
    const foot = new THREE.Vector3(side * 0.86, 0.0, z + spread * 1.5);
    legs.push(paint(seg(hip, knee, 0.035), sp.legs), paint(seg(knee, foot, 0.03), sp.legs));
  }
  const legGeo = mergeGeometries(legs);
  return { body: mergeGeometries(parts), legs: legGeo };
}

/** All burrow holes merged into one mesh: dark opening + a ring of dug-out sand. */
export function holesGeometry(holes, heightAt) {
  const parts = [];
  for (const h of holes) {
    const y = heightAt(h.x, h.z);
    parts.push(paint(T(R(new THREE.CircleGeometry(0.2, 14), -Math.PI / 2, 0, 0), h.x, y + 0.02, h.z), '#2a2218'));
    parts.push(paint(T(S(new THREE.TorusGeometry(0.28, 0.08, 6, 16), 1, 1, 0.45), 0, 0, 0).rotateX(-Math.PI / 2).translate(h.x, y + 0.02, h.z), '#d8c89c'));
    for (let k = 0; k < 5; k++) {                     // little sand pellets around the hole
      const a = (k / 5) * Math.PI * 2 + h.x, d = 0.45 + (k % 2) * 0.15;
      parts.push(paint(T(new THREE.SphereGeometry(0.05, 6, 4), h.x + Math.cos(a) * d, y + 0.03, h.z + Math.sin(a) * d), '#cdbb8e'));
    }
  }
  return mergeGeometries(parts);
}

export function flashlightGeometry() {
  return mergeGeometries([
    paint(T(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10).rotateX(Math.PI / 2), 0, 0, 0.02), '#d8443a'),
    paint(T(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 12).rotateX(Math.PI / 2), 0, 0, 0.13), '#c9cdd0'),
  ]);
}
