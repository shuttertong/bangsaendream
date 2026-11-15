// The Bang Saen three-seat bicycle (จักรยานสามที่นั่ง): a long tandem with three saddles in a row,
// three handlebars and cranks, mudguards, a basket in front and a bell. One merged, vertex-coloured
// geometry (front = +z, wheels on y = 0). SEATS gives where each rider's hips go.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint } from '../../shared/beachset.js';

export const BIKE = {
  wheel: 0.33, base: 2.5,                                  // wheel radius, distance between the axles (m)
  seats: [0.62, -0.12, -0.86], saddle: 0.8,                // saddles along the frame (local z), their height
  colors: { frame: '#4fb3a8', tyre: '#f4f1e8', rim: '#c9cdd0', saddle: '#6a4a3a', steel: '#d4d8dc', basket: '#b98a5a', grip: '#3a3a3a', bell: '#f0c040' },
};
/** A rider's hip position on seat i, in the bike's frame. */
export const seatAt = (i, out = new THREE.Vector3()) => out.set(0, BIKE.saddle, BIKE.seats[i]);

const rodBetween = (a, b, r, hex, n = 8) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), n);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  return paint(g.translate(...A.add(B).multiplyScalar(0.5).toArray()), hex);
};

/** frame: the frame's colour (rental bikes come in a few). */
export function bikeGeometry(frame = BIKE.colors.frame) {
  const C = BIKE.colors, R = BIKE.wheel, zf = BIKE.base / 2, zr = -BIKE.base / 2, out = [];
  const disc = (r, w, n) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);
  for (const z of [zf, zr]) {
    out.push(paint(new THREE.TorusGeometry(R - 0.03, 0.03, 8, 28).rotateY(Math.PI / 2).translate(0, R, z), C.tyre));          // tyre
    out.push(paint(new THREE.TorusGeometry(R - 0.065, 0.012, 6, 28).rotateY(Math.PI / 2).translate(0, R, z), C.rim));        // rim
    out.push(paint(disc(0.03, 0.1, 8).translate(0, R, z), C.steel));                                                          // hub
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI; out.push(rodBetween([0, R + Math.sin(a) * (R - 0.07), z + Math.cos(a) * (R - 0.07)], [0, R - Math.sin(a) * (R - 0.07), z - Math.cos(a) * (R - 0.07)], 0.004, C.steel, 4)); }   // spokes
    out.push(paint(new THREE.TorusGeometry(R + 0.03, 0.022, 4, 16, Math.PI * 0.62).rotateZ(Math.PI * 0.19).rotateY(Math.PI / 2).scale(2.2, 1, 1).translate(0, R, z), frame));   // mudguard
  }
  // the long frame: a low main tube, a top tube, a seat post and saddle for each rider, a crank under each
  const y0 = R + 0.02, yt = 0.66;
  out.push(rodBetween([0, y0, zr], [0, y0, zf - 0.38], 0.028, frame), rodBetween([0, yt, zr + 0.3], [0, yt, zf - 0.3], 0.022, frame));
  out.push(rodBetween([0, R, zr], [0, yt, zr + 0.3], 0.02, frame), rodBetween([0, y0, zf - 0.38], [0, yt + 0.22, zf - 0.3], 0.024, frame));
  out.push(rodBetween([0, R, zf], [0, yt + 0.3, zf - 0.33], 0.02, C.steel));                                                 // fork
  BIKE.seats.forEach((z, i) => {
    out.push(rodBetween([0, y0, z - 0.06], [0, BIKE.saddle - 0.04, z - 0.1], 0.018, frame));                                 // seat tube
    out.push(paint(new THREE.SphereGeometry(1, 12, 8).scale(0.1, 0.035, 0.15).translate(0, BIKE.saddle - 0.02, z - 0.08), C.saddle));
    out.push(paint(disc(0.085, 0.012, 14).translate(0.03, y0, z + 0.2), C.steel));                                            // chain ring
    out.push(rodBetween([-0.11, y0 - 0.13, z + 0.2], [0.11, y0 + 0.13, z + 0.2], 0.012, C.steel, 6));                        // cranks
    for (const s of [-1, 1]) out.push(paint(new THREE.BoxGeometry(0.1, 0.02, 0.06).translate(s * 0.15, y0 + s * 0.13, z + 0.2), C.grip));   // pedals
    // handlebars: the front rider's steer; the others hold a bar fixed behind the saddle in front
    const hz = i === 0 ? zf - 0.32 : BIKE.seats[i - 1] - 0.2, hy = i === 0 ? yt + 0.34 : BIKE.saddle + 0.12;
    if (i > 0) out.push(rodBetween([0, yt, hz], [0, hy, hz], 0.014, C.steel));
    out.push(rodBetween([-0.26, hy, hz], [0.26, hy, hz], 0.014, C.steel));
    for (const s of [-1, 1]) out.push(rodBetween([s * 0.2, hy, hz], [s * 0.29, hy, hz], 0.02, C.grip));
  });
  out.push(rodBetween([0, y0, zr + 0.02], [0.02, y0, zf - 0.2], 0.006, C.grip, 4));                                          // chain
  // basket and bell
  const bz = zf - 0.02, by = yt + 0.2;
  out.push(paint(new THREE.CylinderGeometry(0.19, 0.15, 0.2, 10, 1, true).scale(1, 1, 0.75).translate(0, by, bz + 0.14), C.basket));
  out.push(paint(new THREE.CircleGeometry(0.15, 10).rotateX(-Math.PI / 2).scale(1, 1, 0.75).translate(0, by - 0.1, bz + 0.14), C.basket));
  out.push(paint(new THREE.TorusGeometry(0.19, 0.012, 5, 14).rotateX(Math.PI / 2).scale(1, 1, 0.75).translate(0, by + 0.1, bz + 0.14), C.basket));
  out.push(rodBetween([0, yt + 0.3, zf - 0.33], [0, by - 0.08, bz + 0.06], 0.012, C.steel, 6));                             // the basket's stay
  out.push(paint(new THREE.SphereGeometry(0.03, 8, 6).translate(0.16, yt + 0.37, zf - 0.32), C.bell));
  out.push(rodBetween([0.12, 0.02, -0.2], [0.02, y0, -0.3], 0.01, C.steel, 5));                                               // kickstand
  const g = mergeGeometries(out);
  g.computeBoundingSphere();
  return g;
}
