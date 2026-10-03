// Smooth toon geometry for every person (the kid, NPCs, mini-game crowds, other players): a
// round head with anime eyes (white, iris, pupil, highlights, lash line), brows, a soft nose,
// blush and a D-shaped smile; hair as a smooth shell with a crown shine, tapered bangs and
// side locks; a lathe torso with a collar and a chest print, domed sleeves with hem trim,
// tapered limbs, hands with thumbs, socks and rounded shoes; pleated skirts, aprons, vests.
// Everything is vertex-coloured and merged by body.js into one skinned mesh.
// Geometry per bone, in bone-local rest space (limbs hang down −y, the face looks along +z).
import * as THREE from 'three';
import { fantasyParts } from './fantasy.js';
import { colored, at, sc, sph, cap, lathe, ring } from './geo.js';

export const TOON = {
  up: 0.85,             // head centre above the head bone (× head radius): the head sits on the neck
  eyeY: -0.08, mouthY: -0.42, hatY: 0.8,   // × head radius, from the head centre
  eye: { x: 0.43, w: 0.215, h: 0.245 },    // eye centre x and half-size (× head radius): big, round toon eyes
  shape: [1, 0.97, 0.95], chin: 0.14,      // head ellipsoid radii (× R), chin taper
  seg: { head: [32, 24] },
  // natural, tapered limbs (radius at the top / widest point / bottom, and where the widest point sits)
  limb: {
    arm: [0.041, 0.039, 0.033, 0.35], fore: [0.033, 0.034, 0.026, 0.3],
    thigh: [0.066, 0.06, 0.045, 0.25], shin: [0.044, 0.049, 0.029, 0.3],
    hand: [0.036, 0.048, 0.027], shorts: [0.072, 0.078, 0.76], sleeve: [0.05, 0.048, 0.42],
  },
  iris: '#5a3a26', irisLow: '#9a6a44', lash: '#1e1412', shine: '#ffffff', white: '#fbf8f2', sole: '#f4f1e8',
  skirt: { pleats: 14, depth: 0.012, len: 0.42 },
};

const hermite = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
const darker = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#000000'), k).getHexString();
const lighter = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();
/** A limb hanging from the joint (y = 0) down to −len: radius r0 at the top, widest r1 at `mid` (0–1), r2 at the
 *  bottom, with round ends that tuck into the neighbouring joints. */
function taper(len, r0, r1, r2, mid = 0.3) {
  const pts = [];
  for (let k = 0; k <= 4; k++) { const a = (k / 4) * Math.PI / 2; pts.push([r2 * Math.sin(a), -len - r2 * Math.cos(a)]); }   // bottom cap
  for (let k = 1; k < 12; k++) {
    const t = 1 - k / 12, y = -len * t;                               // t: 0 at the top joint, 1 at the bottom
    pts.push([t > mid ? hermite(r1, r2, (t - mid) / (1 - mid)) : hermite(r0, r1, t / mid), y]);
  }
  for (let k = 0; k <= 4; k++) { const a = (1 - k / 4) * Math.PI / 2; pts.push([r0 * Math.sin(a), r0 * Math.cos(a)]); }       // top cap
  return lathe(pts, 16);
}
/** An open tube (shorts leg) from y0 down to y1, radius ra at the top flaring to rb at the hem. */
const tube = (y0, y1, ra, rb) => lathe([[rb, y1], [rb * 1.01, y1 + 0.01], [(ra + rb) / 2, (y0 + y1) / 2], [ra, y0 - 0.01], [ra * 0.7, y0]], 18);
/** A sleeve: a rounded shoulder dome over the joint, flaring to the hem at −len. */
const sleeve = (len, ra, rb, dome = 0.05) => lathe([[rb, -len], [rb * 1.01, -len + 0.01], [ra, -len * 0.45], [ra * 1.02, 0], [ra * 0.9, dome * 0.6], [ra * 0.55, dome * 0.92], [0, dome]], 18);

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
  const face = (g, hex, x, y, lift, roll = 0) => head.push(colored(onFace(g, R, x * R, y * R, lift * R, 0, roll), hex));
  for (const s of [-1, 1]) {
    face(patch(0.14 * R, 0.07 * R), K.cheek, s * 0.6, -0.42, 0.004);                                    // blush (below the big eyes)
    face(patch(0.125 * R, 0.03 * R, 0.02 * R), darker(K.hair, 0.1), s * 0.42, 0.33, 0.012, -s * 0.18);   // brows, gently arched
    head.push(colored(at(sc(sph(0.14 * R, 10, 8), 0.55, 0.95, 0.75), s * R * 0.99, -0.04 * R, -0.03 * R), K.skin));   // ears
  }
  face(sc(sph(1, 10, 8), 0.045 * R, 0.04 * R, 0.035 * R), K.skin, 0, -0.19, 0.012);                       // soft nose (shading shows it)
  // eyes: on the eyes bone (so blinking squashes the whole eye), laid on the face: white → iris → pupil → shine
  const eyes = [], eyeY = T.eyeY * R;
  const eyePiece = (g, hex, x, y, lift) => eyes.push(colored(onFace(g, R, x, y, lift, -eyeY), hex));   // eyes bone sits at the eye line
  for (const s of [-1, 1]) {
    const ex = s * E.x * R;
    eyePiece(patch(E.w * 1.14 * R, E.h * 1.04 * R, 0.02 * R), T.white, ex, eyeY, 0.0);                   // eye white
    eyePiece(patch(E.w * R, E.h * R, 0.02 * R), K.eye, ex, eyeY, 0.005 * R);                             // dark iris rim
    eyePiece(patch(E.w * 0.78 * R, E.h * 0.52 * R, 0.02 * R), T.irisLow, ex, eyeY - E.h * 0.38 * R, 0.011 * R);   // lighter lower iris
    eyePiece(patch(E.w * 0.62 * R, E.h * 0.62 * R, 0.02 * R), K.iris || T.iris, ex, eyeY + E.h * 0.05 * R, 0.009 * R);
    eyePiece(patch(E.w * 0.3 * R, E.h * 0.3 * R, 0.02 * R), T.lash, ex, eyeY + E.h * 0.1 * R, 0.014 * R);   // pupil
    eyePiece(patch(E.w * 1.16 * R, 0.03 * R, 0.022 * R), T.lash, ex, eyeY + E.h * 0.94 * R, 0.016 * R);  // lash line
    eyePiece(sph(0.05 * R, 10, 8), T.shine, ex + s * 0.03 * R, eyeY + E.h * 0.38 * R, 0.02 * R);         // highlights
    eyePiece(sph(0.024 * R, 8, 6), T.shine, ex - s * 0.04 * R, eyeY - E.h * 0.45 * R, 0.02 * R);
  }
  // mouth: a D-shaped smile (flat top, round bottom) on the mouth bone; talk shapes scale it open
  const mouthY = T.mouthY * R, smile = patch(0.095 * R, 0.07 * R, 0.02 * R);
  { const p = smile.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) * 0.12); smile.computeVertexNormals(); }
  const mouth = [colored(onFace(smile, R, 0, mouthY, 0.003 * R, -mouthY), K.mouth)];

  // hair
  if (K.hairStyle !== 'bald') {
    const H = K.hair, Rh = R * 1.07;
    // shell: crown all round + back/sides, leaving the face open (sphere phi = π/2 is +z)
    head.push(colored(at(new THREE.SphereGeometry(Rh, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.34), 0, 0.02 * R, -0.01 * R), H));
    head.push(colored(at(new THREE.SphereGeometry(Rh, 28, 14, Math.PI * 0.5 + Math.PI * 0.3, Math.PI * 2 - Math.PI * 0.6, 0, Math.PI * 0.64), 0, 0.02 * R, -0.01 * R), H));
    // anime crown shine: a lighter band across the front of the crown
    head.push(colored(at(new THREE.TorusGeometry(Rh * 0.86, 0.022 * R, 6, 28, Math.PI * 0.8).rotateX(Math.PI / 2).rotateY(0.1 * Math.PI), 0, 0.56 * R, -0.01 * R), lighter(H, 0.22)));
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
    } else if (K.hairStyle === 'bun') {                                // a bun with a wrapped band
      head.push(colored(at(sph(0.4 * R), 0, 0.7 * R, -0.7 * R), H));
      head.push(colored(at(new THREE.TorusGeometry(0.3 * R, 0.035 * R, 6, 20).rotateX(0.4), 0, 0.66 * R, -0.52 * R), darker(H, 0.25)));
    } else {                                                           // short: a few soft spikes at the back
      for (let i = 0; i < 5; i++) {
        const a = (i / 4 - 0.5) * 1.8, g = lock(0.2 * R, 0.3 * R, 0.1 * R).rotateX(-0.6);
        head.push(colored(at(g.rotateY(a), Math.sin(a) * 0.8 * R, -0.25 * R, -Math.cos(a) * 0.82 * R), H));
      }
    }
  }
  if (K.glasses) {
    for (const s of [-1, 1]) head.push(colored(onFace(new THREE.TorusGeometry(0.2 * R, 0.03 * R, 6, 18), R, s * E.x * R, T.eyeY * R, 0.05 * R), '#2a2a2a'));
    head.push(colored(onFace(sc(sph(1, 8, 6), 0.06 * R, 0.02 * R, 0.02 * R), R, 0, T.eyeY * R, 0.055 * R), '#2a2a2a'));   // bridge
  }
  for (const g of head) g.translate(0, up, 0);
  return { head, eyes, mouth };
}

/** Hats, in hat-bone space (the bone sits near the top of the head). */
function hatParts(K, R) {
  const cyl = (a, b, h, s = 32) => new THREE.CylinderGeometry(a, b, h, s);
  const k = R / 0.125;                                                  // sizes were drawn for R = 0.125
  const parts = {
    straw: [colored(sc(cyl(0.22, 0.23, 0.012), 1, 1, 1), K.hatColor), colored(at(cyl(0.118, 0.132, 0.1), 0, 0.05, 0), K.hatColor),
      colored(at(cyl(0.134, 0.134, 0.026), 0, 0.018, 0), K.hatBand)],
    bucket: [colored(at(cyl(0.125, 0.19, 0.06), 0, -0.005, 0), K.hatColor), colored(at(cyl(0.112, 0.127, 0.09), 0, 0.05, 0), K.hatColor),
      colored(at(cyl(0.129, 0.129, 0.014), 0, 0.028, 0), darker(K.hatColor, 0.2))],   // stitched band
    cap: [colored(at(sc(new THREE.SphereGeometry(0.14, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.8, 1.02), 0, -0.02, 0), K.hatColor),
      colored(at(sc(sph(0.1, 20, 6), 1, 0.08, 1), 0, -0.02, 0.15), K.hatBand),
      colored(at(sph(0.016, 8, 6), 0, 0.09, 0), K.hatColor)],
    none: [],
  }[K.hat] || [];
  for (const g of parts) g.scale(k, k, k);
  return parts;
}

/** A small generic chest print (no real logos): picked from the shirt colour so looks differ. */
function chestPrint(K, y, z) {
  const bg = K.printBg || K.shirtTrim, fg = K.print || darker(K.shirt, 0.35);
  const n = parseInt(K.shirt.replace('#', '').slice(0, 2), 16) % 3, out = [colored(at(patch(0.046, 0.046, 0.008), 0, y, z), bg)];
  if (n === 0) {                                                         // fish
    out.push(colored(at(sc(sph(1, 12, 8), 0.028, 0.016, 0.005), -0.004, y, z + 0.008), fg));
    out.push(colored(at(new THREE.ConeGeometry(0.012, 0.018, 3).rotateZ(Math.PI / 2), 0.03, y, z + 0.008), fg));
  } else if (n === 1) {                                                  // crab: body + two claws
    out.push(colored(at(sc(sph(1, 12, 8), 0.024, 0.016, 0.005), 0, y - 0.004, z + 0.008), fg));
    for (const s of [-1, 1]) out.push(colored(at(sph(0.009, 8, 6), s * 0.026, y + 0.012, z + 0.008), fg));
  } else {                                                               // sun
    out.push(colored(at(sph(0.018, 12, 8).scale(1, 1, 0.3), 0, y, z + 0.008), fg));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push(colored(at(sph(0.005, 6, 4), Math.cos(a) * 0.03, y + Math.sin(a) * 0.03, z + 0.008), fg)); }
  }
  return out;
}

/** All parts for buildPerson: { boneName: [geometry, ...] }. B = BODY proportions. */
export function toonParts(K, B) {
  const hs = K.headScale, R = B.head;
  const { head, eyes, mouth } = headParts(K, R);
  const hat = K.fxHat ? [] : hatParts(K, R);                           // a fantasy head item replaces the hat
  for (const g of [...head, ...eyes, ...mouth, ...hat]) g.scale(hs, hs, hs);

  const long = K.sleeves === 'long', bare = K.sleeves === 'none';
  const pants = K.bottom === 'pants', legCover = pants ? K.bottomColor : K.skin;
  const L = TOON.limb, sock = K.sock || TOON.sole;
  const side = s => ({
    [`arm${s}`]: [colored(taper(B.upperArm, ...L.arm), long ? K.shirt : K.skin),
      // shoulder: a bare skin dome, or the sleeve's dome (short: to mid-arm with a trim ring; long: the whole arm)
      bare ? colored(sleeve(0.03, L.arm[0] * 1.08, L.arm[0] * 1.02, 0.045), K.skin)
        : colored(sleeve(long ? B.upperArm * 0.45 : B.upperArm * L.sleeve[2], L.sleeve[0], L.sleeve[1]), K.shirt),
      ...(bare || long ? [] : [colored(ring(L.sleeve[1], 0.006, -B.upperArm * L.sleeve[2] + 0.004), K.shirtTrim)])],
    [`fore${s}`]: [colored(taper(B.foreArm, ...L.fore.slice(0, 3), L.fore[3]), long ? K.shirt : K.skin),
      ...(long ? [colored(ring(L.fore[2] * 1.15, 0.006, -B.foreArm + 0.01), K.shirtTrim)] : []),               // cuff
      colored(at(sc(sph(1), L.hand[0], L.hand[1], L.hand[2]), 0, -B.foreArm - L.hand[1] * 0.75, 0.004), K.skin),   // hand
      colored(at(sc(sph(1, 10, 8), 0.013, 0.02, 0.012), (s === 'L' ? -1 : 1) * 0.02, -B.foreArm - 0.028, 0.026), K.skin)],   // thumb
    [`leg${s}`]: [colored(taper(B.thigh, ...L.thigh), legCover),
      ...(K.bottom === 'skirt' ? [] : [colored(tube(L.thigh[0] * 1.3, -B.thigh * (pants ? 1.02 : L.shorts[2]), L.shorts[0], L.shorts[1]), K.bottomColor)])],   // shorts / trouser leg
    [`shin${s}`]: [colored(taper(B.shin, ...L.shin), legCover),
      ...(pants ? [] : [colored(at(new THREE.CylinderGeometry(L.shin[2] * 1.12, L.shin[2] * 1.05, 0.035, 14), 0, -B.shin + 0.02, 0), sock)])],   // sock
    [`foot${s}`]: [colored(at(sc(sph(1), 0.054, 0.028, 0.104), 0, -B.ankle + 0.013, 0.03), TOON.sole),             // sole
      colored(at(sc(sph(1), 0.048, 0.046, 0.094), 0, -B.ankle + 0.034, 0.03), K.shoe),                            // rounded shoe
      colored(at(sc(sph(1, 12, 8), 0.04, 0.03, 0.05), 0, -B.ankle + 0.03, 0.065), lighter(K.shoe, 0.25))],      // toe cap
  });

  const belly = K.belly, depth = 0.78 + belly * 0.3;
  const torso = lathe([[0, -0.085], [0.115, -0.08], [0.128, -0.03], [0.13 + belly * 0.04, 0.08], [0.138, 0.19], [0.142, 0.25], [0.125, 0.3], [0.07, 0.325], [0, 0.33]]);
  const spine = [
    colored(sc(torso, 1, 1, depth), K.shirt),
    colored(ring(0.06, 0.013, B.torso - 0.075, 0.85), K.shirtTrim),                                              // collar
    colored(ring(0.117, 0.006, -0.078, depth), darker(K.shirt, 0.12)),                                          // shirt hem
    colored(at(cap(0.042, 0.06), 0, B.torso - 0.05, 0), K.skin),                                                 // neck
  ];
  const covered = K.vest || K.apron;
  if (!covered && !bare && K.print !== 'none') spine.push(...chestPrint(K, 0.165, 0.138 * depth + 0.002 + belly * 0.02));
  if (K.vest) {                                                        // life vest over the shirt
    spine.push(colored(sc(lathe([[0, -0.04], [0.16, -0.03], [0.168 + belly * 0.03, 0.08], [0.158, 0.2], [0.12, 0.27], [0, 0.28]]), 1, 1, 0.84 + belly * 0.3), K.vest));
    for (const y of [0.04, 0.15]) spine.push(colored(ring(0.166 + belly * 0.03, 0.012, y, 0.84 + belly * 0.3), '#1a1a1a'));
  }
  if (K.apron) {                                                       // bib + skirt panel wrapped round the front, neck band and waist tie
    const front = (r0, y0, r1, y1, span) => new THREE.LatheGeometry([new THREE.Vector2(r1, y1), new THREE.Vector2(r0, y0)], 16, -span / 2, span).scale(1, 1, depth);   // (lathe angle 0 = +z, the front)
    spine.push(colored(front(0.134 + belly * 0.04, 0.26, 0.138 + belly * 0.04, 0.1, 0.9), K.apron));           // bib
    spine.push(colored(front(0.137 + belly * 0.04, 0.1, 0.165, -0.3, 1.7), K.apron));                           // skirt panel, flaring out
    spine.push(colored(ring(0.05, 0.007, B.torso - 0.06), darker(K.apron, 0.1)));                              // neck band
    spine.push(colored(ring(0.135 + belly * 0.04, 0.009, 0.1, depth), darker(K.apron, 0.1)));                  // waist tie
  }
  const hips = [colored(sc(lathe([[0, -0.1], [0.1, -0.1], [0.12, -0.05], [0.124, 0.04], [0.118, 0.1], [0, 0.1]]), 1, 1, 0.8), K.bottomColor),
    colored(ring(0.122, 0.008, 0.075, 0.8), darker(K.bottomColor, 0.25))];                                      // waistband
  if (K.bottom === 'skirt') {                                          // pleated skirt
    const S = TOON.skirt, g = lathe([[0.125, 0.06], [0.135, 0.0], [0.15, -0.2], [0.168, -S.len + 0.01], [0.166, -S.len]], 48);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      const t = Math.min(1, Math.max(0, -y / S.len)), k = 1 + Math.sin(a * S.pleats) * S.depth * t / Math.max(r, 0.05);
      p.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    hips.push(colored(sc(g, 1, 1, 0.82), K.bottomColor), colored(ring(0.168, 0.005, -S.len + 0.004, 0.82), darker(K.bottomColor, 0.2)));
  }

  const out = { hips, spine, head, hat, eyes, mouth, ...side('L'), ...side('R') };
  for (const [bone, geos] of Object.entries(fantasyParts(K, R, B, hs))) (out[bone] ||= []).push(...geos);   // wardrobe items
  return out;
}
