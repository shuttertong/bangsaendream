// Procedural squid / cuttlefish / octopus (≈1 m long at unit scale; head toward +x),
// plus the egi jig lure. Arms are a separate geometry so they can flutter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

/** Vertex colours: base with speckled chromatophore spots. */
function skin(g, base, spots, density = 0.25) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, a = new Float32Array(p.count * 3), c0 = new THREE.Color(base), c1 = new THREE.Color(spots), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const h = hash(Math.floor(p.getX(i) * 40), Math.floor(p.getY(i) * 40), Math.floor(p.getZ(i) * 40));
    c.copy(c0).lerp(c1, h < density ? 0.8 : h * 0.15).toArray(a, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const solid = (g, hex) => skin(g, hex, hex, 0);

function tube(points, r0, r1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, 8, 1, 5, false);
  // taper: scale each ring toward the curve by its position along the tube
  const p = g.attributes.position, rings = 9, per = p.count / rings;
  for (let i = 0; i < p.count; i++) {
    const k = Math.floor(i / per) / (rings - 1), c = curve.getPoint(k), r = r0 + (r1 - r0) * k;
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * r, c.y + (p.getY(i) - c.y) * r, c.z + (p.getZ(i) - c.z) * r);
  }
  g.computeVertexNormals();
  return g;
}

export function squidGeometry(sp) {
  const body = [], arms = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (sp.kind === 'octopus') {
    body.push(skin(new THREE.SphereGeometry(0.2, 16, 12).scale(1, 1.25, 1).translate(0, 0.22, 0), sp.color, sp.spots, 0.35));
    for (const z of [-0.09, 0.09]) body.push(solid(new THREE.SphereGeometry(0.035, 8, 6).translate(0.12, 0.08, z), '#f4e8c0'));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      arms.push(skin(tube([V(dx * 0.08, 0.02, dz * 0.08), V(dx * 0.25, -0.1, dz * 0.25), V(dx * 0.45, -0.05, dz * 0.45), V(dx * 0.55, 0.08, dz * 0.5)], 0.05, 0.012), sp.color, sp.spots, 0.2));
    }
  } else {
    const cuttle = sp.kind === 'cuttle';
    if (cuttle) {
      body.push(skin(new THREE.SphereGeometry(0.3, 18, 12).scale(1, 0.36, 0.55).translate(-0.12, 0, 0), sp.color, sp.spots, 0.35));
      body.push(skin(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 20).scale(1.6, 1, 1.05).translate(-0.12, 0, 0), sp.spots, sp.color, 0.1));   // skirt fin
    } else {
      // bullet-shaped mantle turned on a lathe, axis along x (tail at −x)
      const prof = [[0, -0.62], [0.04, -0.55], [0.09, -0.35], [0.12, -0.1], [0.125, 0.02], [0.11, 0.06]].map(([r, y]) => new THREE.Vector2(r, y));
      body.push(skin(new THREE.LatheGeometry(prof, 16).rotateZ(-Math.PI / 2), sp.color, sp.spots, 0.3));
      const fin = sp.fins === 'wide'
        ? new THREE.SphereGeometry(0.3, 14, 6).scale(1.15, 0.03, 0.62).translate(-0.28, 0, 0)
        : new THREE.ConeGeometry(0.2, 0.22, 4).rotateX(Math.PI / 2).scale(1, 1, 0.1).rotateX(Math.PI / 2).translate(-0.5, 0, 0);
      body.push(skin(fin, sp.color, sp.spots, 0.15));
    }
    const hx = cuttle ? 0.2 : 0.12;
    body.push(skin(new THREE.SphereGeometry(0.1, 12, 10).scale(1.1, 0.85, 1).translate(hx, 0, 0), sp.color, sp.spots, 0.2));
    for (const z of [-0.085, 0.085]) body.push(solid(new THREE.SphereGeometry(0.04, 10, 8).translate(hx + 0.02, 0.02, z), '#1a2a2a'));
    const n = 8, len = cuttle ? 0.22 : 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, oy = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05;
      arms.push(skin(tube([V(hx + 0.06, oy, oz), V(hx + 0.06 + len * 0.5, oy * 1.4, oz * 1.4), V(hx + 0.06 + len, oy * 1.8, oz * 1.8)], 0.025, 0.006), sp.color, sp.spots, 0.2));
    }
    for (const oz of [-0.03, 0.03]) arms.push(skin(tube([V(hx + 0.06, 0, oz), V(hx + 0.35, -0.02, oz), V(hx + 0.62, 0.01, oz * 2)], 0.012, 0.02), sp.color, sp.spots, 0.2));
  }
  return { body: mergeGeometries(body), arms: mergeGeometries(arms) };
}

/** Egi (shrimp-shaped squid jig): body, fins, a skirt of hooks at the tail. */
export function jigGeometry() {
  return mergeGeometries([
    solid(new THREE.CapsuleGeometry(0.05, 0.22, 4, 10).rotateZ(Math.PI / 2), '#f08a3a'),
    solid(new THREE.SphereGeometry(0.03, 8, 6).translate(0.13, 0.02, 0.03), '#1a1a1a'),
    solid(new THREE.ConeGeometry(0.035, 0.1, 6).rotateZ(-Math.PI / 2).translate(0.2, 0, 0), '#e8e0d0'),
    solid(new THREE.ConeGeometry(0.06, 0.08, 10, 1, true).rotateZ(Math.PI / 2).translate(-0.19, 0, 0), '#c9cdd0'),
    solid(new THREE.BoxGeometry(0.1, 0.07, 0.005).translate(-0.02, 0.05, 0), '#f0c040'),
  ]);
}
