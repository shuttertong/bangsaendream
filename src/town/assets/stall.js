// Som tam food cart: wooden cart with a glass case (papaya, tomatoes, chillies), a
// mortar and pestle, wheels and a sun umbrella. Built into a Kit at (x, y, z) facing ry.
import * as THREE from 'three';

const col = hex => new THREE.Color(hex);

export function somTamCart(kit, { x, y, z, ry, umbrella = true }) {
  const f = kit.frame(x, y, z, ry);
  const wood = col('#b0784a'), steel = col('#c9cdd0');
  f.box('wall', 0, 0.85, 0, 1.6, 0.08, 0.8, col('#e9e2d0'));              // counter top
  f.box('wall', 0, 0.5, 0, 1.55, 0.62, 0.75, wood);                       // cart body
  f.box('wall', 0, 0.5, 0.38, 1.4, 0.4, 0.02, col('#d8443a'));            // red front panel
  for (const u of [-0.55, 0.55]) f.box('wall', u, 0.22, 0, 0.08, 0.44, 0.44, col('#3a3a3a'));   // wheels
  // glass case with ingredients
  f.box('glass', -0.3, 1.12, -0.1, 0.8, 0.45, 0.5, col('#9fc2c8'));
  for (const [u, c] of [[-0.55, '#e0b85a'], [-0.35, '#d8443a'], [-0.15, '#4f8a3a']]) f.box('wall', u, 0.98, -0.1, 0.16, 0.12, 0.35, col(c));
  // clay mortar (ครก) + pestle
  const mortar = new THREE.CylinderGeometry(0.16, 0.11, 0.2, 12);
  kit.add('wall', mortar, new THREE.Matrix4().setPosition(f.P(0.45, 0.99, 0.05)), col('#a8583a'));
  f.rod('wall', [0.45, 1.0, 0.05], [0.55, 1.28, 0.1], 0.025, col('#c9a86a'));
  if (!umbrella) return;
  // umbrella on a pole
  f.rod('metal', [0.75, 0.9, -0.35], [0.75, 2.5, -0.35], 0.025, steel);
  const canopy = new THREE.ConeGeometry(1.1, 0.35, 10, 1, true);
  kit.add('wall', canopy, new THREE.Matrix4().setPosition(f.P(0.75, 2.45, -0.35)), col('#e8e4d8'));
  const under = canopy.clone().scale(1, -1, 1);                           // visible from below
  kit.add('wall', under, new THREE.Matrix4().setPosition(f.P(0.75, 2.45, -0.35)), col('#d8d2c4'));
}

/** Grandma's khao lam stand: a table with finished tubes and a short roasting line of
 *  bamboo over coconut husks beside it. Built into a Kit at (x, y, z) facing ry. */
export function khaoLamStand(kit, { x, y, z, ry }) {
  const f = kit.frame(x, y, z, ry);
  f.box('wall', 0, 0.74, 0, 1.5, 0.05, 0.65, col('#d8cfb8'));                           // table
  for (const u of [-0.68, 0.68]) for (const w of [-0.26, 0.26]) f.box('wall', u, 0.37, w, 0.05, 0.74, 0.05, col('#8a8a86'));
  for (let i = 0; i < 9; i++) {                                                        // shelled tubes lying on the table
    const u = -0.55 + (i % 5) * 0.1 + Math.floor(i / 5) * 0.05, h = 0.81 + Math.floor(i / 5) * 0.07;
    f.rod('wall', [u, h, -0.18], [u, h, 0.18], 0.04, col('#e0cf8e'));
  }
  f.box('wall', 0.35, 1.2, 0.3, 0.7, 0.24, 0.03, col('#f4e9c8'));                    // sign board
  f.box('wall', 0.35, 1.2, 0.315, 0.6, 0.06, 0.01, col('#7a2e1c'));
  // roasting line: blackened bamboo leaning on a rail, husks smouldering underneath
  f.rod('wall', [1.1, 0.55, -0.1], [2.4, 0.55, -0.1], 0.02, col('#5a5a58'));
  for (let i = 0; i < 10; i++) {
    const u = 1.15 + i * 0.13;
    f.rod('wall', [u, 0.02, 0.15], [u, 0.62, -0.12], 0.042, col(i % 3 ? '#3a2a1c' : '#5a4a2a'));
  }
  for (let i = 0; i < 8; i++) f.box('wall', 1.2 + i * 0.16, 0.06, 0.28, 0.18, 0.12, 0.13, col(i % 2 ? '#6a4a2a' : '#c8742a'));
}
