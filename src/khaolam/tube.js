// The khao lam tube on the chopping board (lying along x, open end at +x) with strips of
// charred bamboo around it, the hammer that pounds the char off (กะเทาะ = ทุบ: three blows
// along a strip per go), and the chips that fly off. Strip states:
//   'thick' / 'thin' — charred skin still on (black / brown)
//   'done'           — chipped back to the thin pale inner skin (what you want)
//   'crack'          — chopped too hard: the rice shows through
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedMaterial } from '../world/materials.js';
import { rng } from '../core/rng.js';

const R = 0.042, L = 0.44, SEG = 48, ROWS = 14;
const COL = { thick: '#2a1e16', thin: '#6a4526', done: '#e0cf8e', crack: '#f3eee2' };
const INSET = { thick: 0, thin: -0.002, done: -0.004, crack: -0.006 };

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export function createTube(scene, at, strips) {
  const group = new THREE.Group();            // positioned on the board
  group.position.copy(at);
  scene.add(group);
  const spin = new THREE.Group();             // turns the tube to bring a strip to the top
  group.add(spin);

  // bamboo wall: open cylinder along x; each vertex remembers its strip and base radius
  const wall = new THREE.CylinderGeometry(R, R, L, SEG, ROWS, true).rotateZ(-Math.PI / 2);
  const pos = wall.attributes.position, n = pos.count;
  const strip = new Int8Array(n), noise = new Float32Array(n), dirY = new Float32Array(n), dirZ = new Float32Array(n);
  const r = rng(7);
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, y);
    strip[i] = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / strips)) % strips;
    noise[i] = r();
    dirY[i] = y / R; dirZ[i] = z / R;
  }
  wall.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mat = paintedMaterial({ amp: 0.25, scale: 0.05 });
  const wallMesh = new THREE.Mesh(wall, mat);
  wallMesh.castShadow = wallMesh.receiveShadow = true;
  spin.add(wallMesh);

  // closed node end (-x), rice + banana-leaf plug at the open end (+x)
  const node = paint(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.02, SEG).rotateZ(-Math.PI / 2).translate(-L / 2, 0, 0), '#3a2a1c');
  const ring = paint(new THREE.TorusGeometry(R * 0.98, 0.005, 6, SEG).rotateY(Math.PI / 2).translate(L / 2, 0, 0), '#c9b98a');
  const riceMat = paintedMaterial({ amp: 0.2, scale: 0.02 });
  const rice = new THREE.Mesh(paint(new THREE.CircleGeometry(R * 0.95, 24).rotateY(Math.PI / 2).translate(L / 2 - 0.006, 0, 0), '#ffffff'), riceMat);
  const leaf = new THREE.Mesh(paint(new THREE.SphereGeometry(R * 0.7, 10, 6).scale(0.5, 1, 1).translate(L / 2 + 0.004, R * 0.2, 0), '#6a8a3a'), mat);
  spin.add(new THREE.Mesh(mergeGeometries([node, ring]), mat), rice, leaf);

  const state = [];
  const tmp = new THREE.Color();
  /** Repaint strip i as `st` for the part of the tube with x ≤ upTo (the hammer works along it). */
  function paintStrip(i, st, upTo = L) {
    const col = wall.attributes.color;
    for (let v = 0; v < n; v++) {
      if (strip[v] !== i || pos.getX(v) > upTo - L / 2) continue;
      tmp.set(COL[st]).offsetHSL(0, 0, (noise[v] - 0.5) * (st === 'done' ? 0.06 : 0.12));
      if (st === 'crack' && noise[v] > 0.7) tmp.set(riceColor);
      col.setXYZ(v, tmp.r, tmp.g, tmp.b);
      const rr = R + INSET[st] + (st === 'thick' ? noise[v] * 0.002 : 0);
      pos.setY(v, dirY[v] * rr); pos.setZ(v, dirZ[v] * rr);
    }
    col.needsUpdate = pos.needsUpdate = true;
  }
  let riceColor = '#ffffff';

  /** A fresh tube from the fire: thick or thin char per strip. */
  function reset(kind, thickness) {
    riceColor = kind.rice;
    rice.geometry.attributes.color.array.fill(0);
    const c = new THREE.Color(kind.rice), a = rice.geometry.attributes.color;
    for (let v = 0; v < a.count; v++) a.setXYZ(v, c.r, c.g, c.b);
    a.needsUpdate = true;
    state.length = 0;
    for (let i = 0; i < strips; i++) { state.push(thickness[i]); paintStrip(i, thickness[i]); }
    wall.computeVertexNormals();
    spin.rotation.x = 0;
    group.visible = true;
  }

  // hammer: origin at the grip, handle toward the tube (+z), steel head with its face down.
  // rotation.x < 0 lifts the head.
  const TAPS = 3, HEAD = 0.21, FACE = 0.03;
  const hammer = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#8a9298', metalness: 0.8, roughness: 0.4 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, FACE * 2, 14).translate(0, 0, HEAD), steel);
  const handle = new THREE.Mesh(paint(new THREE.CylinderGeometry(0.011, 0.013, HEAD, 8).rotateX(Math.PI / 2).translate(0, 0, HEAD / 2), '#8a5a32'), mat);
  head.castShadow = handle.castShadow = true;
  hammer.add(head, handle);
  scene.add(hammer);
  const GRIP_Y = at.y + R + FACE, GRIP_Z = at.z - HEAD;
  const x0 = at.x - L / 2 + 0.06, span = L - 0.1;
  const tapX = i => x0 + ((i + 0.5) / TAPS) * span;

  // chips: small dark flakes, one instanced draw
  const CHIPS = 40;
  const chipMesh = new THREE.InstancedMesh(paint(new THREE.BoxGeometry(0.02, 0.003, 0.012), '#ffffff'), mat, CHIPS);
  chipMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHIPS * 3), 3);
  chipMesh.frustumCulled = false;
  scene.add(chipMesh);
  const chips = Array.from({ length: CHIPS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), s: new THREE.Vector3(), t: 9, rot: 0 }));
  let nextChip = 0;
  function spray(x, color, count = 5) {
    for (let k = 0; k < count; k++) {
      const c = chips[nextChip++ % CHIPS];
      c.p.set(x, at.y + R + 0.01, at.z);
      c.v.set((Math.random() - 0.3) * 0.8, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
      c.t = 0; c.rot = Math.random() * 6;
      chipMesh.setColorAt(chips.indexOf(c), tmp.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1));
    }
    chipMesh.instanceColor.needsUpdate = true;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3();
  /**
   * chop: null or { k: 0..1 progress, strip, st (result), from (previous state) }.
   * top: which strip should face up (the tube turns smoothly to it).
   */
  function update(dt, t, chop, top) {
    // turn so that strip `top` is on top
    const want = -(top * Math.PI * 2) / strips;
    let d = want - spin.rotation.x; d = Math.atan2(Math.sin(d), Math.cos(d));
    spin.rotation.x += d * (1 - Math.exp(-dt * 14));

    // hammer: three blows along the strip (impact halfway through each), then back to rest
    if (chop) {
      const seg = Math.min(chop.k * TAPS, TAPS - 1e-6), i = Math.floor(seg), u = seg - i;
      const lift = chop.st === 'crack' ? 1.5 : chop.st === 'thin' ? 0.7 : 1.1;         // how hard the swing looks
      hammer.position.set(tapX(i), GRIP_Y + 0.02 * Math.abs(2 * u - 1), GRIP_Z);
      hammer.rotation.set(-lift * Math.pow(Math.abs(2 * u - 1), 0.8), 0, 0);
    } else {
      hammer.position.lerp(new THREE.Vector3(at.x, GRIP_Y + 0.05, GRIP_Z), 1 - Math.exp(-dt * 10));
      hammer.rotation.set(-0.7 + Math.sin(t * 2) * 0.03, 0, 0);
    }
    // chips
    for (let i = 0; i < CHIPS; i++) {
      const c = chips[i];
      if (c.t < 1.2) {
        c.t += dt; c.v.y -= 6 * dt; c.p.addScaledVector(c.v, dt);
        if (c.p.y < at.y - R + 0.004) { c.p.y = at.y - R + 0.004; c.v.set(0, 0, 0); }
        c.rot += dt * 12 * (c.v.lengthSq() > 0 ? 1 : 0);
        m4.compose(c.p, q.setFromEuler(e.set(c.rot, c.rot * 0.7, 0)), c.t > 1 ? zero : one);
      } else m4.compose(c.p, q, zero);
      chipMesh.setMatrixAt(i, m4);
    }
    chipMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    group, state, reset, paintStrip, update, spray, length: L, radius: R,
    hide() { group.visible = false; },
    /** How much of the strip (0..L) is cracked off at chop progress k: a third per tap. */
    painted: k => (Math.min(TAPS, Math.floor(k * TAPS + 0.5)) / TAPS) * L,
    /** x of a tap that lands between progress k0 and k (or null). */
    impact(k0, k) {
      const a = Math.floor(k0 * TAPS + 0.5), b = Math.floor(k * TAPS + 0.5);
      return b > a && b <= TAPS ? tapX(b - 1) : null;
    },
  };
}
