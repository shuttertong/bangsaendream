// A beach-football goal: yellow frame with stays down to the back, and a net of lines.
// Built with the mouth on the z = 0 line, opening toward −z, the net behind it (+z), standing on y = 0.
// Shared by the mini-game's pitch (scene.js) and the goals on the sand in town (town/kickabout.js).
import * as THREE from 'three';

export const GOAL_COLORS = { post: '#eef03a', net: '#f4f6f8' };

/** size: { half, h, depth } (metres). Returns { solid: [BufferGeometry, no colours], net: [x, y, z, …] line-segment points }. */
export function goalFrame({ half, h, depth }, r = 0.055) {
  const solid = [], net = [];
  const rod = (ax, ay, az, bx, by, bz) => {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz), len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 8).translate(0, len / 2, 0);
    solid.push(g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize())).translate(ax, ay, az));
  };
  for (const sx of [-1, 1]) {
    rod(sx * half, 0, 0, sx * half, h, 0);                              // post
    rod(sx * half, h, 0, sx * half, 0, depth);                          // stay down to the back
  }
  rod(-half - r, h, 0, half + r, h, 0);                                 // crossbar
  rod(-half, 0.03, depth, half, 0.03, depth);                           // back bar on the sand
  // net: lines down and across the sloping back, and the two triangular sides
  const seg = (a, b) => net.push(...a, ...b), back = k => [h * (1 - k), depth * k];
  for (let i = 0; i <= 12; i++) { const x = -half + (half * 2 * i) / 12; seg([x, h, 0], [x, 0, depth]); }
  for (let j = 1; j < 8; j++) { const [y, z] = back(j / 8); seg([-half, y, z], [half, y, z]); }
  for (const sx of [-1, 1]) for (let j = 1; j < 6; j++) { const [y, z] = back(j / 6); seg([sx * half, y, z], [sx * half, 0, z]); seg([sx * half, y, z], [sx * half, y, 0]); }
  return { solid, net };
}

/** The same line-segment points, turned by `yaw` about y and moved to (x, y, z). */
export function placeNet(net, yaw, x, y, z) {
  const c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  for (let i = 0; i < net.length; i += 3) out.push(x + net[i] * c + net[i + 2] * s, y + net[i + 1], z - net[i] * s + net[i + 2] * c);
  return out;
}
