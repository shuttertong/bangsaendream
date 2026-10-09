// สนามบอลชายหาด — two small goals and a ball on the open sand in front of Tonkla (roster.js), who
// offers ฟุตบอลชายหาด (src/football) and วอลเลย์บอลชายหาด (src/volley); a volleyball net stands just
// past one goal. The pitch lies along the shore, between the umbrellas and the water.
// Decoration only: one mesh and one set of net lines; the posts are solid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { goalFrame, placeNet, GOAL_COLORS } from '../football/goal.js';

export const KICKABOUT = {
  sea: 7, room: [4, 12],               // metres from the water to the middle of the pitch; not built if the sand there is narrower / wider than this
  apart: 13,                           // between the two goal lines
  goal: { half: 1.2, h: 1.3, depth: 0.9 },
  ball: { r: 0.16, at: [1.8, -1.1], color: '#f6f4ee' },   // along the pitch, toward the sea (metres from the middle)
  volley: { past: 6.5, half: 3.1, top: 2.0, band: 0.95, post: '#f4f1e8', pad: '#e2553f', tape: '#fbfaf5', ball: { r: 0.22, at: [2.2, 1.4], color: '#f0c23a' } },   // the net: this far past a goal, posts this far either side
};

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** at: { x, z, yaw } — where Tonkla stands, facing the sea. Returns { x, z, mesh } or null when there is no room. */
export function buildKickabout({ scene, map, lift, seaDist, collision, at }) {
  const K = KICKABOUT, dx = Math.sin(at.yaw), dz = Math.cos(at.yaw), out = seaDist(at.x, at.z) - K.sea;   // (dx, dz): toward the sea
  const cx = at.x + dx * out, cz = at.z + dz * out, d = seaDist(cx, cz);
  if (!(d > K.room[0] && d < K.room[1])) return null;
  const ax = dz, az = -dx;                                              // along the shore
  const ground = (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea);
  const solid = [], net = [];
  for (const end of [-1, 1]) {
    const gx = cx + ax * end * K.apart / 2, gz = cz + az * end * K.apart / 2, yaw = Math.atan2(ax * end, az * end);   // the mouth faces the middle
    const goal = goalFrame(K.goal, 0.045);
    solid.push(...goal.solid.map(g => paint(g.rotateY(yaw).translate(gx, 0, gz), GOAL_COLORS.post)));
    net.push(...placeNet(goal.net, yaw, gx, 0, gz));
    for (const sx of [-1, 1]) collision?.circle(gx + dx * sx * K.goal.half, gz + dz * sx * K.goal.half, 0.1, 2);
  }
  // the volleyball net, across the sand a little further along the shore (built with the net along z, then turned to run toward the sea)
  const V = K.volley, nx = cx + ax * (K.apart / 2 + V.past), nz = cz + az * (K.apart / 2 + V.past), parts = [], strings = [];
  for (const sz of [-1, 1]) {
    parts.push(paint(new THREE.CylinderGeometry(0.05, 0.05, V.top + 0.25, 8).translate(0, (V.top + 0.25) / 2, sz * V.half), V.post));
    parts.push(paint(new THREE.CylinderGeometry(0.11, 0.11, 1.4, 10).translate(0, 0.75, sz * V.half), V.pad));
    collision?.circle(nx + dx * sz * V.half, nz + dz * sz * V.half, 0.14, 2);
  }
  parts.push(paint(new THREE.BoxGeometry(0.025, 0.09, V.half * 2).translate(0, V.top - 0.045, 0), V.tape));
  parts.push(paint(new THREE.SphereGeometry(V.ball.r, 14, 10).translate(V.ball.at[0], V.ball.r, V.ball.at[1]), V.ball.color));
  solid.push(...parts.map(g => g.rotateY(at.yaw).translate(nx, 0, nz)));
  for (let z = -V.half; z <= V.half + 0.01; z += 0.16) strings.push(0, V.top - V.band, z, 0, V.top - 0.09, z);
  for (let y = V.top - V.band; y <= V.top - 0.08; y += 0.16) strings.push(0, y, -V.half, 0, y, V.half);
  net.push(...placeNet(strings, at.yaw, nx, 0, nz));
  const [along, sea] = K.ball.at;
  solid.push(paint(new THREE.SphereGeometry(K.ball.r, 14, 10).translate(cx + ax * along + dx * -sea, K.ball.r, cz + az * along + dz * -sea), K.ball.color));
  const geo = mergeGeometries(solid), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + ground(p.getX(i), p.getZ(i)));   // stand everything on the sloping sand
  for (let i = 0; i < net.length; i += 3) net[i + 1] += ground(net[i], net[i + 2]);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, paintedMaterial({ amp: 0.06, scale: 1 }));
  mesh.castShadow = mesh.receiveShadow = true;
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(net, 3)),
    new THREE.LineBasicMaterial({ color: GOAL_COLORS.net, transparent: true, opacity: 0.6 }));
  scene.add(mesh, lines);
  return { x: cx, z: cz, mesh, lines };
}
