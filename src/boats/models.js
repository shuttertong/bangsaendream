// Towed-inflatable models shared by the boat games and the hub's speedboat landing.
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

/** Speedboat (bow toward +z), vertex-coloured. */
export function speedboatGeometry() {
  const hull = new THREE.Shape();                    // side profile, length along x
  hull.moveTo(-2.6, 0.9); hull.lineTo(1.8, 0.9); hull.quadraticCurveTo(2.9, 0.85, 3.0, 0.55);
  hull.quadraticCurveTo(2.2, -0.1, 0.8, -0.2); hull.lineTo(-2.6, -0.1); hull.lineTo(-2.6, 0.9);
  const g = new THREE.ExtrudeGeometry(hull, { depth: 2.0, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 });
  g.translate(0, 0, -1.0).rotateY(-Math.PI / 2);     // bow toward +z
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) c.set(p.getY(i) > 0.55 ? '#f4f2ec' : p.getY(i) > 0.35 ? '#2f6fc4' : '#e8e6e0').toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return mergeGeometries([
    g.index ? g.toNonIndexed() : g,
    paint(new THREE.BoxGeometry(1.6, 0.5, 0.06).rotateX(-0.5).translate(0, 1.2, 0.9), '#6a8a9a'),          // windshield
    paint(new THREE.BoxGeometry(0.7, 0.5, 0.6).translate(0, 1.15, 0.2), '#e8e6e0'),                        // console
    paint(new THREE.BoxGeometry(1.4, 0.35, 0.7).translate(0, 1.1, -1.4), '#3a6aa8'),                       // bench
    paint(new THREE.BoxGeometry(0.45, 1.0, 0.45).translate(0, 0.7, -2.75), '#2a2a2a'),                     // outboard motor
    paint(new THREE.BoxGeometry(0.5, 0.4, 0.55).translate(0, 1.35, -2.75), '#3a3a3a'),
  ]);
}

/** Long yellow banana (nose up at +z), green side pontoons, handles. */
export function bananaGeometry() {
  const body = new THREE.CapsuleGeometry(0.42, 4.2, 8, 16).rotateX(Math.PI / 2).translate(0, 0.42, 0);
  const nose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.45, 2.3), new THREE.Vector3(0, 0.75, 2.8), new THREE.Vector3(0, 1.25, 3.0)]), 10, 0.3, 12, false);
  const parts = [paint(body, '#f2cf3a'), paint(nose, '#f2cf3a'), paint(new THREE.SphereGeometry(0.3, 12, 8).translate(0, 1.25, 3.0), '#6a4a2a')];
  for (const s of [-1, 1]) parts.push(paint(new THREE.CapsuleGeometry(0.2, 3.6, 6, 12).rotateX(Math.PI / 2).translate(s * 0.62, 0.2, -0.2), '#3a8adf'));
  for (let i = 0; i < 4; i++) parts.push(paint(new THREE.TorusGeometry(0.1, 0.025, 6, 12).rotateY(Math.PI / 2).translate(0, 0.92, 1.25 - i * 1.05), '#2a5aa8'));
  return mergeGeometries(parts);
}

/** Round inflatable sofa: striped ring, floor, backrest toward the boat (+z), stars. */
export function sofaGeometry() {
  const ring = new THREE.TorusGeometry(1.35, 0.42, 12, 32).rotateX(Math.PI / 2).translate(0, 0.42, 0).toNonIndexed();
  ring.deleteAttribute('uv');
  const p = ring.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    c.set(y > 0.62 ? '#f2cf3a' : y > 0.5 ? '#3aa86a' : '#e8589a');
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3);
  }
  ring.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const parts = [ring, paint(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 28).translate(0, 0.18, 0), '#e8589a')];
  const back = new THREE.TorusGeometry(1.25, 0.3, 10, 20, Math.PI).rotateX(Math.PI / 2).rotateY(0).translate(0, 0.95, 0);
  parts.push(paint(back, '#e8443a'));
  for (const x of [-1.25, 1.25]) parts.push(paint(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 14).translate(x, 0.9, 0), '#3aa86a'));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = i % 2 ? 0.06 : 0.15; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i + 0.5) / 6 * Math.PI, x = Math.cos(a) * 1.78, z = Math.sin(a) * 1.78;
    parts.push(paint(new THREE.ShapeGeometry(star).rotateY(-a + Math.PI / 2).translate(x, 0.45, z), '#e8589a'));
  }
  return mergeGeometries(parts);
}

/** Sit-down jet ski (bow toward +z): white hull, teal stripe, black seat, handlebar. */
export function jetskiGeometry() {
  const hull = new THREE.Shape();                    // side profile, length along x
  hull.moveTo(-1.4, 0.55); hull.lineTo(1.0, 0.55); hull.quadraticCurveTo(1.6, 0.52, 1.65, 0.3);
  hull.quadraticCurveTo(1.2, -0.05, 0.4, -0.1); hull.lineTo(-1.4, -0.05); hull.lineTo(-1.4, 0.55);
  const g = new THREE.ExtrudeGeometry(hull, { depth: 0.8, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.12, bevelSegments: 2 });
  g.translate(0, 0, -0.4).rotateY(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i);
    p.setX(i, p.getX(i) * (z > 0 ? 1 - (z / 1.75) * 0.65 : 1) * (y < 0.1 ? 0.8 : 1));   // pointed bow, narrower keel
    c.set(y > 0.42 ? (z > 0.35 ? '#1fa3a0' : '#f4f2ec') : y > 0.22 ? '#e8541e' : '#3a3f44').toArray(col, i * 3);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  const bar = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6).rotateZ(Math.PI / 2).translate(0, 1.02, 0.5);
  return mergeGeometries([
    g.index ? g.toNonIndexed() : g,
    paint(new THREE.CapsuleGeometry(0.24, 0.9, 4, 10).rotateX(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.72, -0.4), '#26282b'),   // seat
    paint(new THREE.BoxGeometry(0.42, 0.3, 0.42).rotateX(-0.4).translate(0, 0.8, 0.6), '#1fa3a0'),                                       // steering column
    paint(bar, '#2a2a2a'),
    paint(new THREE.BoxGeometry(0.5, 0.06, 0.3).rotateX(-0.5).translate(0, 0.98, 0.78), '#6a8a9a'),                                     // little windscreen
  ]);
}
