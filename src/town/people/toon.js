// Smooth chibi-toon geometry for every person (the kid, NPCs, mini-game crowds, other players):
// a big round head with anime eyes (dark iris, lighter lower iris, two highlights, lash line),
// brows, blush and a small mouth; hair as a smooth shell with tapered bangs and side locks;
// a rounded lathe torso and shorts, smooth capsule limbs with filled joints, mitten hands and
// rounded shoes. Everything is vertex-coloured and merged by body.js into one skinned mesh.
// Geometry per bone, in bone-local rest space (limbs hang down −y, the face looks along +z).
import * as THREE from 'three';

export const TOON = {
  up: 0.85,             // head centre above the head bone (× head radius): the head sits on the neck
  eyeY: -0.08, mouthY: -0.42, hatY: 0.8,   // × head radius, from the head centre
  eye: { x: 0.4, w: 0.155, h: 0.225 },     // eye centre x and half-size (× head radius): big chibi eyes
  shape: [1, 0.97, 0.95], chin: 0.14,      // head ellipsoid radii (× R), chin taper
  seg: { head: [32, 24], limb: [6, 14], round: [18, 12] },
  limb: { arm: 0.043, fore: 0.04, hand: 0.052, thigh: 0.06, shin: 0.054, knee: 0.056 },   // chunky, soft limbs
  iris: '#5a3a26', irisLow: '#9a6a44', lash: '#1e1412', shine: '#ffffff', sole: '#f4f1e8',
};

function colored(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
const sc = (g, x, y, z) => { g.scale(x, y, z); return g; };
const sph = (r, w = TOON.seg.round[0], h = TOON.seg.round[1]) => new THREE.SphereGeometry(r, w, h);
const cap = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), TOON.seg.limb[0], TOON.seg.limb[1]);
const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** Point + outward normal on the head ellipsoid (centre at the origin) at face coords (x, y). */
function surface(R, x, y) {
  const [a, b, c] = TOON.shape.map(k => k * R);
  const z = c * Math.sqrt(Math.max(0.02, 1 - (x / a) ** 2 - (y / b) ** 2));
  const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (c * c)).normalize();
  return { p: new THREE.Vector3(x, y, z), n };
}
/** Lay g (built facing +z around the origin) onto the head surface at (x, y), lifted along the normal, then shift by (0, dy). */
function onFace(g, R, x, y, lift = 0, dy = 0, roll = 0) {
  const { p, n } = surface(R, x, y);
  if (roll) g.rotateZ(roll);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
  return at(g, p.x + n.x * lift, p.y + n.y * lift + dy, p.z + n.z * lift);
}
/** A flattened ellipsoid "decal" (rx, ry) lying on the face. */
const patch = (rx, ry, d = 0.012) => sc(sph(1, 16, 10), rx, ry, d);

/** A tapered hair lock: round at the root (top), pointed at the tip (−y); `wave` sways it side to side down its length. */
function lock(w, len, d, wave = 0) {
  const g = sph(1, 12, wave ? 16 : 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y < 0 ? 1 - 0.8 * (-y) ** 1.4 : 1;          // taper below the middle
    const sway = wave * Math.sin((1 - y) * Math.PI * 1.5) * (1 - y) * 0.5;   // grows toward the tip
    p.setXYZ(i, p.getX(i) * w * t + sway * w, y * len, p.getZ(i) * d * (0.6 + 0.4 * t));
  }
  g.computeVertexNormals();
  return g;
}

/** The head: skin, face, hair — in head-bone space (centre at y = up·R). Returns { head, eyes, mouth }. */
function headParts(K, R) {
  const T = TOON, up = T.up * R, E = T.eye;
  const skull = sph(R, ...T.seg.head);
  { // ellipsoid + a gently tapered chin
    const p = skull.attributes.position, [a, b, c] = T.shape;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / R, taper = y < 0 ? 1 - T.chin * y * y : 1;
      p.setXYZ(i, p.getX(i) * a * taper, p.getY(i) * b, p.getZ(i) * c * (y < 0 ? 1 - T.chin * 0.5 * y * y : 1));
    }
    skull.computeVertexNormals();
  }
  const head = [colored(skull, K.skin)];
  const face = (g, hex, x, y, lift) => head.push(colored(onFace(g, R, x * R, y * R, lift * R), hex));
  for (const s of [-1, 1]) {
    face(patch(0.13 * R, 0.07 * R), K.cheek, s * 0.55, -0.3, 0.004);                          // blush
    face(sc(lock(0.09 * R, 0.022 * R, 0.02 * R), 1, 1, 1).rotateZ(Math.PI / 2 + s * 0.12), darker(K.hair, 0.15), s * 0.4, 0.3, 0.012);   // brows
    head.push(colored(at(sc(sph(0.16 * R, 10, 8), 0.6, 1, 0.8), s * R * 0.99, -0.02 * R, 0), K.skin));   // ears
  }
  face(sph(0.03 * R, 8, 6), darker(K.skin, 0.1), 0, -0.2, 0.0);                                 // nose
  // eyes: on the eyes bone (so blinking squashes the whole eye), laid on the face
  const eyes = [], eyeY = T.eyeY * R;
  const eyePiece = (g, hex, x, y, lift) => eyes.push(colored(onFace(g, R, x, y, lift, -eyeY), hex));   // eyes bone sits at the eye line
  for (const s of [-1, 1]) {
    const ex = s * E.x * R;
    eyePiece(patch(E.w * R, E.h * R, 0.02 * R), K.eye, ex, eyeY, 0.0);                           // dark iris
    eyePiece(patch(E.w * 0.78 * R, E.h * 0.52 * R, 0.02 * R), T.irisLow, ex, eyeY - E.h * 0.38 * R, 0.006 * R);   // lighter lower iris
    eyePiece(patch(E.w * 0.62 * R, E.h * 0.62 * R, 0.02 * R), K.iris || T.iris, ex, eyeY + E.h * 0.05 * R, 0.004 * R);
    eyePiece(patch(E.w * 1.12 * R, 0.028 * R, 0.022 * R), T.lash, ex, eyeY + E.h * 0.92 * R, 0.008 * R);   // lash line
    eyePiece(sph(0.05 * R, 10, 8), T.shine, ex + s * 0.03 * R, eyeY + E.h * 0.38 * R, 0.014 * R);   // highlights
    eyePiece(sph(0.024 * R, 8, 6), T.shine, ex - s * 0.04 * R, eyeY - E.h * 0.45 * R, 0.014 * R);
  }
  // mouth: on the mouth bone (talk shapes scale it)
  const mouthY = T.mouthY * R;
  const mouth = [colored(onFace(patch(0.075 * R, 0.035 * R, 0.02 * R), R, 0, mouthY, 0.002 * R, -mouthY), K.mouth)];

  // hair
  if (K.hairStyle !== 'bald') {
    const H = K.hair, Rh = R * 1.07;
    // shell: crown all round + back/sides, leaving the face open (sphere phi = π/2 is +z)
    head.push(colored(at(new THREE.SphereGeometry(Rh, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.34), 0, 0.02 * R, -0.01 * R), H));
    head.push(colored(at(new THREE.SphereGeometry(Rh, 28, 14, Math.PI * 0.5 + Math.PI * 0.3, Math.PI * 2 - Math.PI * 0.6, 0, Math.PI * 0.64), 0, 0.02 * R, -0.01 * R), H));
    // bangs: a fan of tapered locks across the forehead
    const long = K.hairStyle === 'long', n = 7, bangLen = (long ? 0.3 : 0.24) * R;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1, x = u * 0.62 * R, y = 0.5 * R - Math.abs(u) * 0.08 * R;
      const g = lock(0.15 * R, bangLen * (1 - Math.abs(u) * 0.2), 0.07 * R);
      head.push(colored(onFace(g, R * 1.02, x, y, 0.02 * R, -bangLen * 0.35, -u * 0.25), H));
    }
    // side locks framing the face
    for (const s of [-1, 1]) {
      const g = lock(0.12 * R, (long ? 0.62 : 0.4) * R, 0.07 * R);
      head.push(colored(at(g.rotateZ(s * 0.08), s * 0.9 * R, (long ? -0.2 : -0.08) * R, 0.22 * R), H));
    }
    if (long) {                                                        // full, wavy long hair: down the back and over the shoulders
      head.push(colored(at(lock(0.95 * R, 1.35 * R, 0.4 * R, 0.12), 0, -0.6 * R, -0.52 * R), H));
      for (const s of [-1, 1]) {
        head.push(colored(at(lock(0.36 * R, 1.15 * R, 0.26 * R, 0.25 * s).rotateZ(s * 0.12), s * 0.66 * R, -0.66 * R, -0.28 * R), H));   // sides
        head.push(colored(at(lock(0.24 * R, 1.0 * R, 0.14 * R, -0.3 * s).rotateZ(s * 0.18).rotateX(0.12), s * 0.8 * R, -0.95 * R, 0.08 * R), H));   // in front of the shoulders
      }
    } else if (K.hairStyle === 'bun') {
      head.push(colored(at(sph(0.42 * R), 0, 0.72 * R, -0.72 * R), H));
    } else {                                                           // short: a few soft spikes at the back
      for (let i = 0; i < 5; i++) {
        const a = (i / 4 - 0.5) * 1.8, g = lock(0.2 * R, 0.3 * R, 0.1 * R).rotateX(-0.6);
        head.push(colored(at(g.rotateY(a), Math.sin(a) * 0.8 * R, -0.25 * R, -Math.cos(a) * 0.82 * R), H));
      }
    }
  }
  if (K.glasses) for (const s of [-1, 1]) head.push(colored(onFace(new THREE.TorusGeometry(0.2 * R, 0.035 * R, 6, 16), R, s * E.x * R, T.eyeY * R, 0.05 * R), '#2a2a2a'));
  for (const g of head) g.translate(0, up, 0);
  return { head, eyes, mouth };
}

function darker(hex, k) { return '#' + new THREE.Color(hex).lerp(new THREE.Color('#000000'), k).getHexString(); }

/** Hats, in hat-bone space (the bone sits near the top of the head). */
function hatParts(K, R) {
  const cyl = (a, b, h, s = 32) => new THREE.CylinderGeometry(a, b, h, s);
  const k = R / 0.125;                                                  // sizes were drawn for R = 0.125
  const parts = {
    straw: [colored(sc(cyl(0.22, 0.23, 0.012), 1, 1, 1), K.hatColor), colored(at(cyl(0.118, 0.132, 0.1), 0, 0.05, 0), K.hatColor),
      colored(at(cyl(0.134, 0.134, 0.026), 0, 0.018, 0), K.hatBand)],
    bucket: [colored(at(cyl(0.125, 0.19, 0.06), 0, -0.005, 0), K.hatColor), colored(at(cyl(0.112, 0.127, 0.09), 0, 0.05, 0), K.hatColor)],
    cap: [colored(at(sc(new THREE.SphereGeometry(0.14, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.8, 1.02), 0, -0.02, 0), K.hatColor),
      colored(at(sc(sph(0.1, 20, 6), 1, 0.08, 1), 0, -0.02, 0.15), K.hatBand),
      colored(at(sph(0.016, 8, 6), 0, 0.09, 0), K.hatColor)],
    none: [],
  }[K.hat] || [];
  for (const g of parts) g.scale(k, k, k);
  return parts;
}

/** All parts for buildPerson: { boneName: [geometry, ...] }. B = BODY proportions. */
export function toonParts(K, B) {
  const hs = K.headScale, R = B.head;
  const { head, eyes, mouth } = headParts(K, R);
  const hat = hatParts(K, R);
  for (const g of [...head, ...eyes, ...mouth, ...hat]) g.scale(hs, hs, hs);

  const long = K.sleeves === 'long', bare = K.sleeves === 'none';
  const legCover = K.bottom === 'pants' ? K.bottomColor : K.skin;
  const L = TOON.limb;
  const side = s => ({
    [`arm${s}`]: [colored(at(sph(1).scale(L.arm * 1.25, L.arm * 1.35, L.arm * 1.2), 0, -0.012, 0), bare ? K.skin : K.shirt),   // round shoulder / sleeve
      colored(at(cap(L.arm, B.upperArm), 0, -B.upperArm / 2, 0), long ? K.shirt : K.skin),
      ...(bare || long ? [] : [colored(at(sph(1).scale(L.arm * 1.18, L.arm * 1.3, L.arm * 1.15), 0, -0.045, 0), K.shirt)])],
    [`fore${s}`]: [colored(sph(L.fore * 1.02), long ? K.shirt : K.skin),                                             // elbow, flush with the arm
      colored(at(cap(L.fore, B.foreArm - L.fore), 0, -B.foreArm / 2 + L.fore / 2, 0), long ? K.shirt : K.skin),
      colored(at(sc(sph(1), L.hand, L.hand * 1.08, L.hand * 0.85), 0, -B.foreArm - 0.012, 0.004), K.skin)],           // mitten hand
    [`leg${s}`]: K.bottom === 'skirt' ? [colored(at(cap(L.thigh, B.thigh), 0, -B.thigh / 2, 0), K.skin)]
      : [colored(at(sc(sph(1), L.thigh * 1.45, 0.12, L.thigh * 1.35), 0, -0.06, 0), K.bottomColor),                  // shorts leg
        colored(at(cap(L.thigh, B.thigh), 0, -B.thigh / 2, 0), legCover)],
    [`shin${s}`]: [colored(sph(L.knee), legCover),                                                                   // knee, flush
      colored(at(cap(L.shin, B.shin - L.shin), 0, -B.shin / 2 + L.shin / 2, 0), legCover)],
    [`foot${s}`]: [colored(at(sc(sph(1), 0.062, 0.032, 0.11), 0, -B.ankle + 0.014, 0.035), TOON.sole),                // sole
      colored(at(sc(sph(1), 0.058, 0.05, 0.104), 0, -B.ankle + 0.037, 0.035), K.shoe)],                              // rounded shoe
  });

  const belly = K.belly;
  const torso = lathe([[0, -0.08], [0.115, -0.075], [0.14, -0.02], [0.148 + belly * 0.03, 0.08], [0.146, 0.18], [0.132, 0.26], [0.1, 0.31], [0.06, 0.33], [0, 0.335]]);
  const spine = [
    colored(sc(torso, 1, 1, 0.78 + belly * 0.3), K.shirt),
    colored(at(sc(new THREE.TorusGeometry(0.058, 0.014, 8, 20).rotateX(Math.PI / 2), 1, 1, 0.85), 0, B.torso - 0.075, 0), K.shirtTrim),   // collar
    colored(at(cap(0.038, 0.05), 0, B.torso - 0.05, 0), K.skin),                                                     // neck
  ];
  if (K.vest) {                                                        // life vest over the shirt
    spine.push(colored(sc(lathe([[0, -0.04], [0.16, -0.03], [0.168 + belly * 0.03, 0.08], [0.158, 0.2], [0.12, 0.27], [0, 0.28]]), 1, 1, 0.84 + belly * 0.3), K.vest));
    for (const y of [0.04, 0.15]) spine.push(colored(at(sc(new THREE.TorusGeometry(0.166 + belly * 0.03, 0.012, 6, 28).rotateX(Math.PI / 2), 1, 1, 0.84 + belly * 0.3), 0, y, 0), '#1a1a1a'));
  }
  if (K.apron) spine.push(colored(at(sc(sph(1, 16, 12), 0.13, 0.19, 0.02), 0, 0.03, 0.105 + belly * 0.05), K.apron));
  const hips = [colored(sc(lathe([[0, -0.1], [0.1, -0.1], [0.128, -0.05], [0.13, 0.04], [0.12, 0.1], [0, 0.1]]), 1, 1, 0.8), K.bottomColor)];
  if (K.bottom === 'skirt') hips.push(colored(sc(lathe([[0, 0.06], [0.13, 0.06], [0.155, -0.2], [0.175, -0.46], [0, -0.46]]), 1, 1, 0.8), K.bottomColor));

  return { hips, spine, head, hat, eyes, mouth, ...side('L'), ...side('R') };
}
