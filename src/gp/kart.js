// A go-kart (front = +z, wheels on y = 0): a low chassis with a nose cone, side pods, a seat, a
// steering wheel, an engine behind and four fat little wheels; and its driver, frozen in the seat
// with both hands on the wheel. One vertex-coloured mesh for the kart, one for the driver.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { paint } from '../shared/beachset.js';
import { paintedMaterial } from '../world/materials.js';
import { bakePerson, personMaterial } from '../town/people/body.js';

export const KART = { wheel: 0.14, seat: [0, 0.2, -0.22], detail: 0.5 };
let kartMat = null, driverMat = null;

function kartGeometry(hex) {
  const rb = (w, h, d, r, x, y, z, c) => paint(new RoundedBoxGeometry(w, h, d, 2, r).translate(x, y, z), c), out = [];
  const dark = '#2a2a2a', steel = '#c9cdd0';
  out.push(rb(0.74, 0.07, 1.5, 0.03, 0, 0.12, 0, dark));                                             // floor pan
  out.push(rb(0.42, 0.16, 0.5, 0.07, 0, 0.2, 0.72, hex));                                            // nose
  out.push(paint(new THREE.SphereGeometry(1, 12, 8).scale(0.2, 0.09, 0.2).translate(0, 0.19, 0.98), hex));
  out.push(rb(0.9, 0.05, 0.16, 0.02, 0, 0.13, 1.02, '#f4f1e8'));                                     // front bumper
  for (const s of [-1, 1]) out.push(rb(0.2, 0.17, 0.62, 0.07, s * 0.44, 0.2, -0.02, hex));            // side pods
  out.push(rb(0.42, 0.34, 0.1, 0.04, 0, 0.36, -0.42, dark), rb(0.42, 0.08, 0.4, 0.03, 0, 0.19, -0.24, dark));   // seat back and base
  out.push(rb(0.4, 0.26, 0.34, 0.05, 0, 0.3, -0.68, steel), rb(0.12, 0.12, 0.2, 0.03, 0.2, 0.42, -0.7, dark));  // engine, air box
  out.push(paint(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8).rotateX(Math.PI / 2).translate(-0.2, 0.2, -0.9), steel));   // exhaust
  out.push(rb(0.86, 0.05, 0.1, 0.02, 0, 0.16, -0.9, '#f4f1e8'));                                     // rear bumper
  out.push(paint(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6).rotateX(-0.9).translate(0, 0.33, 0.3), steel));          // steering column
  out.push(paint(new THREE.TorusGeometry(0.11, 0.02, 6, 14).rotateX(-0.9 + Math.PI / 2).translate(0, 0.45, 0.2), dark));     // steering wheel
  out.push(paint(new THREE.CircleGeometry(0.1, 14).translate(0, 0.25, 0.975), '#f4f1e8'));           // number roundel
  for (const z of [0.62, -0.6]) for (const s of [-1, 1]) {
    const w = z > 0 ? 0.13 : 0.17;
    out.push(paint(new THREE.CylinderGeometry(KART.wheel, KART.wheel, w, 14).rotateZ(Math.PI / 2).translate(s * (0.5 - (z > 0 ? 0.02 : 0)), KART.wheel, z), dark));
    out.push(paint(new THREE.CylinderGeometry(0.07, 0.07, w + 0.01, 10).rotateZ(Math.PI / 2).translate(s * (0.5 - (z > 0 ? 0.02 : 0)), KART.wheel, z), steel));
  }
  return mergeGeometries(out);
}

/** A kart with its driver: a Group to place and turn (userData.body rolls a little in the bends). */
export function buildKart(hex, look) {
  const g = new THREE.Group(), body = new THREE.Group();
  const mesh = new THREE.Mesh(kartGeometry(hex), kartMat || (kartMat = paintedMaterial({ amp: 0.05, scale: 1 })));
  const L = { ...look, hat: 'cap', hatColor: hex, hatBand: '#f4f1e8', bag: null, fxHat: null, fxWings: null, fxBack: null, fxHand: null, fxTail: null }, sc = (L.scale || 1) * 0.72;
  const driver = new THREE.Mesh(bakePerson({ ...L, scale: sc }, B => {                                  // (a helmet-ish cap in the kart's colour)
    for (const s of ['L', 'R']) { B[`arm${s}`].rotation.set(-1.0, 0, s === 'L' ? 0.2 : -0.2); B[`fore${s}`].rotation.x = -0.45; B[`leg${s}`].rotation.set(-1.45, 0, s === 'L' ? 0.16 : -0.16); B[`shin${s}`].rotation.x = 0.5; }
    B.spine.rotation.x = -0.12; B.head.rotation.x = 0.1;
  }, KART.detail), driverMat || (driverMat = personMaterial()));
  driver.position.set(KART.seat[0], KART.seat[1] - 0.62 * sc + 0.04, KART.seat[2]);
  mesh.castShadow = driver.castShadow = true;
  body.add(mesh, driver); g.add(body);
  g.userData.body = body;
  return g;
}
