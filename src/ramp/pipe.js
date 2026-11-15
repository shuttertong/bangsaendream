// The half-pipe, set up on the skating rink for the trick game: a flat bottom, two curved walls up
// to the lips with steel coping, a deck and a rail on each side, plywood sides, and a green band
// across the flat where a pump counts. Built in its own (x across, y up, z along the width) frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint } from '../shared/beachset.js';
import { paintedMaterial } from '../world/materials.js';
import { RAMP } from './rules.js';

/** Where the surface is at u (−1 … 1, lip to lip): { x, y, a } with a = the wall's angle from the floor (rad, signed by side). */
export function surfaceAt(u, P = RAMP.pipe) {
  const Q = P.flat / 2 + P.r * Math.PI / 2, q = u * Q, s = Math.sign(q) || 1, m = Math.abs(q);
  if (m <= P.flat / 2) return { x: q, y: 0, a: 0 };
  const a = (m - P.flat / 2) / P.r;
  return { x: s * (P.flat / 2 + P.r * Math.sin(a)), y: P.r * (1 - Math.cos(a)), a: s * a };
}

export function buildPipe(P = RAMP.pipe, pumpZone = RAMP.pump.zone) {
  const parts = [], hw = P.width / 2, N = 40, wood = '#c9a878', dark = '#8a6a4a', steel = '#d4d8dc';
  const strip = (pts, hex, flip = false) => {                       // a ribbon across the width through the (x, y) points
    const pos = [];
    for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const q = [[ax, ay, -hw], [bx, by, -hw], [bx, by, hw], [ax, ay, hw]]; const o = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]; for (const k of o) pos.push(...q[k]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return paint(g, hex);
  };
  const ride = [];
  for (let i = 0; i <= N; i++) { const s = surfaceAt(i / N * 2 - 1, P); ride.push([s.x, s.y + 0.02]); }
  parts.push(strip(ride, wood, true));
  const zone = []; for (let i = 0; i <= 6; i++) { const s = surfaceAt((i / 6 * 2 - 1) * pumpZone * 0.55, P); zone.push([s.x, 0.03]); }
  parts.push(strip(zone, '#62d86a', true));
  const lip = P.flat / 2 + P.r;
  for (const s of [-1, 1]) {
    parts.push(strip([[s * lip, P.r + 0.02], [s * (lip + P.deck), P.r + 0.02]].sort((a, b) => a[0] - b[0]), wood, true));           // deck
    parts.push(paint(new THREE.CylinderGeometry(0.04, 0.04, P.width, 8).rotateX(Math.PI / 2).translate(s * lip, P.r + 0.03, 0), steel));   // coping
    parts.push(paint(new THREE.BoxGeometry(0.08, P.r + 0.02, P.width).translate(s * (lip + P.deck), (P.r + 0.02) / 2, 0), dark));         // back wall
    for (const z of [-hw, 0, hw]) parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(s * (lip + P.deck - 0.05), P.r + 0.5, z), steel));
    parts.push(paint(new THREE.CylinderGeometry(0.025, 0.025, P.width, 6).rotateX(Math.PI / 2).translate(s * (lip + P.deck - 0.05), P.r + 1.0, 0), steel));
  }
  for (const z of [-hw, hw]) {                                       // plywood sides: the wall's outline filled down to the ground
    const outline = new THREE.Shape([new THREE.Vector2(-lip - P.deck, 0), new THREE.Vector2(-lip - P.deck, P.r), ...ride.map(([x, y]) => new THREE.Vector2(x, y)), new THREE.Vector2(lip + P.deck, P.r), new THREE.Vector2(lip + P.deck, 0)]);
    const g = new THREE.ShapeGeometry(outline); if (z < 0) g.rotateY(Math.PI).scale(-1, 1, 1);
    parts.push(paint(g.translate(0, 0, z), dark));
  }
  parts.push(paint(new THREE.BoxGeometry((lip + P.deck) * 2 + 0.08, P.base, P.width + 0.04).translate(0, -P.base / 2, 0), dark));   // the base it stands on
  const m = new THREE.Mesh(mergeGeometries(parts.map(g => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.normal) g.computeVertexNormals(); return g; })), paintedMaterial({ amp: 0.08, scale: 2 }));
  m.material.side = THREE.DoubleSide;
  m.castShadow = m.receiveShadow = true;
  return m;
}
