// The head of every person (toon.js builds the rest): a soft "mochi" skull with painted blush and
// shading, layered anime eyes (white with a lid shadow, iris, pupil, highlights, a lash with an
// outer flick, a lid crease), closed happy eyes for the joy expression, brows, nose, mouth, hair
// (a shell with a sheen band, layered bangs, a ring of tips round the nape, and the styles), hats.
// Geometry in head-bone space (the face looks along +z), vertex-coloured.
import * as THREE from 'three';
import { colored, at, sc, sph, seg, tint, ease, fine, darker, lighter } from './geo.js';

export const HEAD = {
  up: 0.85,             // head centre above the head bone (× head radius): the head sits on the neck
  eyeY: -0.08, mouthY: -0.42, hatY: 0.8,   // × head radius, from the head centre
  eye: { x: 0.43, w: 0.215, h: 0.245 },    // eye centre x and half-size (× head radius): big, round toon eyes
  shape: [1, 0.97, 0.95], chin: 0.14, cheek: 0.05,   // head ellipsoid radii (× R), chin taper, how far the cheeks puff out
  seg: [40, 30],
  irisLow: '#9a6a44', lash: '#1e1412', shine: '#ffffff', white: '#fbf8f2', lid: '#dde1ec',
  sheen: { y: 0.6, wave: 0.035, width: 0.07, k: 0.3, warm: '#b98a62' },   // hair sheen band: height (× R), zigzag, width, strength
  tilt: 0.14,                                             // how far back a straw hat is pushed (rad)
  tips: { n: 9, span: 0.62 },                             // lock tips round the nape: how many, half-span (× π) from the back
};

/** Point + outward normal on the head ellipsoid (centre at the origin) at face coords (x, y). */
function surface(R, x, y) {
  const [a, b, c] = HEAD.shape.map(k => k * R);
  const z = c * Math.sqrt(Math.max(0.02, 1 - (x / a) ** 2 - (y / b) ** 2));
  const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (c * c)).normalize();
  return { p: new THREE.Vector3(x, y, z), n };
}
/** Lay g (built facing +z around the origin) onto the head surface at (x, y), lifted along the normal, then shift by (0, dy). */
export function onFace(g, R, x, y, lift = 0, dy = 0, roll = 0) {
  const { p, n } = surface(R, x, y);
  if (roll) g.rotateZ(roll);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
  return at(g, p.x + n.x * lift, p.y + n.y * lift + dy, p.z + n.z * lift);
}
/** A flattened ellipsoid "decal" (rx, ry) lying on the face. */
export const patch = (rx, ry, d = 0.012) => sc(sph(1, 16, 10), rx, ry, d);

/** A tapered hair lock: round at the root (top), pointed at the tip (−y); `wave` sways it side to side down its length. */
export function lock(w, len, d, wave = 0) {
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

/** The skull: an ellipsoid with a tapered chin and soft cheeks; close up, blush and shading are painted on. */
function skull(K, R) {
  const T = HEAD, g = sph(R, ...T.seg), p = g.attributes.position, [a, b, c] = T.shape;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / R, taper = y < 0 ? 1 - T.chin * y * y : 1, puff = 1 + T.cheek * Math.exp(-(((y + 0.38) / 0.3) ** 2));
    p.setXYZ(i, p.getX(i) * a * taper * puff, p.getY(i) * b, p.getZ(i) * c * (y < 0 ? 1 - T.chin * 0.5 * y * y : 1));
  }
  g.computeVertexNormals();
  const out = colored(g, K.skin);
  if (fine()) {
    const blush = new THREE.Color(K.cheek), shade = new THREE.Color(darker(K.skin, 0.4));
    tint(out, (col, v) => {
      if (v.z > 0) {
        for (const s of [-1, 1]) col.lerp(blush, 0.75 * Math.exp(-((Math.hypot(v.x - s * 0.6 * R, v.y + 0.42 * R) / (0.2 * R)) ** 2)));   // cheeks
        col.lerp(blush, 0.3 * Math.exp(-((Math.hypot(v.x, v.y + 0.2 * R) / (0.1 * R)) ** 2)));                                           // nose tip
      }
      col.lerp(shade, 0.12 * ease(0.4 * R, 0.85 * R, v.y) + 0.22 * ease(-0.75 * R, -1.0 * R, v.y));   // under the fringe, under the chin
    });
  }
  return out;
}

/** The head: skin, face, hair — in head-bone space (centre at y = up·R). Returns { head, eyes, mouth, joy }. */
export function headParts(K, R) {
  const T = HEAD, up = T.up * R, E = T.eye, close = fine();
  const head = [skull(K, R)];
  const face = (g, hex, x, y, lift, roll = 0) => head.push(colored(onFace(g, R, x * R, y * R, lift * R, 0, roll), hex));
  // eyes: big and round on a kid; a grown-up's are a little narrower (eyeScale overrides either)
  const ES = K.eyeScale ?? (K.headScale < 1 ? 0.86 : 1), EW = E.w * (0.92 + 0.08 * ES), EH = E.h * ES;
  for (const s of [-1, 1]) {
    if (!close) face(patch(0.14 * R, 0.07 * R), K.cheek, s * 0.6, -0.42, 0.004);                         // blush as a patch (far away; close up it is painted)
    face(patch(0.115 * R, (K.brow || 0.03) * R, 0.02 * R), darker(K.hair, 0.1), s * 0.43, 0.37 - (1 - ES) * 0.14, 0.012, -s * 0.24);   // brows, gently arched (brow: thickness)
    head.push(colored(at(sc(sph(0.14 * R, 10, 8), 0.55, 0.95, 0.75), s * R * 0.99, -0.04 * R, -0.03 * R), K.skin));   // ears
    if (close) head.push(colored(at(sc(sph(0.08 * R, 8, 6), 0.4, 0.8, 0.6), s * R * 1.03, -0.05 * R, 0.0), darker(K.skin, 0.2)));   // the hollow of the ear
    if (K.earring) head.push(colored(at(sph(0.045 * R, 8, 6), s * R * 1.02, -0.2 * R, 0.0), K.earring));               // a pearl at each ear
    if (K.freckles) for (let i = 0; i < 3; i++) face(patch(0.026 * R, 0.02 * R), darker(K.skin, 0.22), s * (0.2 + i * 0.15), -0.27 - (i % 2) * 0.04, 0.005);   // freckles across the cheeks
  }
  face(sc(sph(1, 10, 8), 0.045 * R, 0.04 * R, 0.035 * R), K.skin, 0, -0.19, 0.012);                       // soft nose (shading shows it)
  // eyes: on the eyes bone (so blinking squashes the whole eye), laid on the face: white → iris → pupil → shine
  const eyes = [], joy = [], eyeY = T.eyeY * R;
  const eyePiece = (g, hex, x, y, lift, roll = 0, to = eyes) => to.push(colored(onFace(g, R, x, y, lift, -eyeY, roll), hex));   // eyes bone sits at the eye line
  for (const s of [-1, 1]) {
    const ex = s * E.x * R;
    eyePiece(patch(EW * 1.14 * R, EH * 1.04 * R, 0.02 * R), T.white, ex, eyeY, 0.0);                     // eye white
    if (close) eyePiece(patch(EW * 1.08 * R, EH * 0.3 * R, 0.02 * R), T.lid, ex, eyeY + EH * 0.74 * R, 0.002 * R);   // the lid's shadow across the top of the white
    eyePiece(patch(EW * R, EH * R, 0.02 * R), K.eye, ex, eyeY, 0.005 * R);                               // dark iris rim
    eyePiece(patch(EW * 0.78 * R, EH * 0.52 * R, 0.02 * R), T.irisLow, ex, eyeY - EH * 0.38 * R, 0.011 * R);   // lighter lower iris
    eyePiece(patch(EW * 0.62 * R, EH * 0.62 * R, 0.02 * R), K.iris, ex, eyeY + EH * 0.05 * R, 0.009 * R);
    eyePiece(patch(EW * 0.3 * R, EH * 0.3 * R, 0.02 * R), T.lash, ex, eyeY + EH * 0.1 * R, 0.014 * R);   // pupil
    eyePiece(patch(EW * 1.18 * R, 0.042 * R, 0.022 * R), T.lash, ex, eyeY + EH * 0.94 * R, 0.016 * R);   // lash line
    eyePiece(sph(0.056 * R * Math.sqrt(ES), 10, 8), T.shine, ex + s * 0.03 * R, eyeY + EH * 0.38 * R, 0.02 * R);   // highlights
    eyePiece(sph(0.026 * R, 8, 6), T.shine, ex - s * 0.04 * R, eyeY - EH * 0.45 * R, 0.02 * R);
    if (close) {
      eyePiece(patch(0.07 * R, 0.026 * R, 0.02 * R), T.lash, ex + s * EW * 1.12 * R, eyeY + EH * 0.86 * R, 0.016 * R, s * 0.75);   // the lash's outer flick
      eyePiece(patch(EW * 0.8 * R, 0.01 * R, 0.014 * R), darker(K.skin, 0.2), ex, eyeY + EH * 1.2 * R, 0.008 * R);                // lid crease
      // joy: closed, smiling eyes (an arch each), on their own bone, which stays shrunk to nothing until the expression
      const arch = new THREE.TorusGeometry(EW * 0.9 * R, 0.03 * R, 6, 14, Math.PI * 0.8).rotateZ(Math.PI * 0.1).scale(1, 0.8, 0.5);
      eyePiece(arch, T.lash, ex, eyeY - EH * 0.15 * R, 0.014 * R, 0, joy);
    }
  }
  // mouth: a D-shaped smile (flat top, round bottom) on the mouth bone; talk shapes scale it open
  // smile: 'smile' (default) | 'grin' (wide, a row of teeth) | 'small' (a quiet one)
  const mouthY = T.mouthY * R, [mw, mh] = { grin: [0.13, 0.085], small: [0.07, 0.05] }[K.smile] || [0.1, 0.072], smile = patch(mw * R, mh * R, 0.02 * R);
  { const p = smile.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) * 0.12); smile.computeVertexNormals(); }
  const mouth = [colored(onFace(smile, R, 0, mouthY, 0.003 * R, -mouthY), K.mouth)];
  if (K.smile === 'grin') mouth.push(colored(onFace(patch(mw * 0.72 * R, 0.02 * R, 0.02 * R), R, 0, mouthY - 0.012 * R, 0.006 * R, -mouthY), T.white));   // teeth along the top
  else if (close) mouth.push(colored(onFace(patch(mw * 0.5 * R, mh * 0.34 * R, 0.02 * R), R, 0, mouthY - mh * 0.55 * R, 0.005 * R, -mouthY), lighter(K.mouth, 0.3)));   // tongue

  if (K.hairStyle !== 'bald') head.push(...hairParts(K, R));
  if (K.glasses) {
    const frame = K.glassColor || '#2a2a2a', fine_ = K.glasses === 'thin';                                       // 'thin': light wire frames
    if (K.glasses !== 'sun') for (const s of [-1, 1]) head.push(colored(onFace(new THREE.TorusGeometry((fine_ ? 0.215 : 0.2) * R, (fine_ ? 0.014 : 0.03) * R, seg(6, 3), seg(24, 6)), R, s * E.x * R, T.eyeY * R, 0.05 * R), frame));
    head.push(colored(onFace(sc(sph(1, 8, 6), 0.06 * R, (fine_ ? 0.012 : 0.02) * R, 0.02 * R), R, 0, T.eyeY * R, 0.055 * R), frame));   // bridge
    if (K.glasses === 'sun') for (const s of [-1, 1]) head.push(colored(onFace(patch(0.28 * R, 0.235 * R, 0.03 * R), R, s * E.x * R, (T.eyeY + 0.02) * R, 0.06 * R, 0, -s * 0.06), '#22262c'));   // dark lenses
  }
  for (const g of head) g.translate(0, up, 0);
  return { head, eyes, mouth, joy };
}

/** Hair, round the head centre. hairStyle: short | bob | bun | long | ponytail | twin | spiky. */
function hairParts(K, R) {
  const T = HEAD, H = K.hair, Rh = R * 1.07, style = K.hairStyle, long = style === 'long', bob = style === 'bob', out = [];
  const hi = new THREE.Color(lighter(H, 0.4)).lerp(new THREE.Color(fine() ? T.sheen.warm : '#ffffff'), fine() ? 0.5 : 0), lo = new THREE.Color(darker(H, 0.35)), S = T.sheen;
  // every piece: a sheen band round the crown (zigzag, like drawn hair) and darker toward the tips
  const hair = g => out.push(tint(colored(g, H), (col, v) => {
    const band = (S.y + S.wave * Math.sin(Math.atan2(v.x, v.z) * 10)) * R, d = (v.y - band) / (S.width * R);
    col.lerp(hi, S.k * Math.exp(-d * d)).lerp(lo, 0.45 * ease(0.1 * R, -1.2 * R, v.y));
  }));
  // shell: crown all round + back/sides, leaving the face open (sphere phi = π/2 is +z)
  hair(at(new THREE.SphereGeometry(Rh, seg(48, 8), seg(16), 0, Math.PI * 2, 0, Math.PI * 0.34), 0, 0.02 * R, -0.01 * R));
  hair(at(new THREE.SphereGeometry(Rh, seg(36, 8), seg(16), Math.PI * 0.5 + Math.PI * 0.3, Math.PI * 2 - Math.PI * 0.6, 0, Math.PI * 0.64), 0, 0.02 * R, -0.01 * R));
  // bangs: a fan of tapered locks across the forehead, swept a little to one side
  const n = K.bangs === 'none' ? 0 : 7, bangLen = (long || bob ? 0.3 : 0.25) * R;
  if (!n) {                                                          // swept back: a lower hairline and a soft roll of hair over the brow
    hair(at(new THREE.SphereGeometry(Rh, seg(40, 8), seg(8), 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.085), 0, 0.02 * R, -0.01 * R));
    hair(at(sc(sph(1, 20, 10), 0.66 * R, 0.13 * R, 0.26 * R), 0, 0.8 * R, 0.56 * R));
  }
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1, x = u * 0.62 * R, y = 0.5 * R - Math.abs(u) * 0.08 * R;
    const g = lock(0.16 * R, bangLen * (1 - Math.abs(u) * 0.2) * (i % 2 ? 0.9 : 1), 0.07 * R);
    hair(onFace(g, R * 1.02, x, y, 0.02 * R, -bangLen * 0.35, -u * 0.25 + 0.07));
  }
  // side locks framing the face
  for (const s of [-1, 1]) {
    const g = lock(0.12 * R, (long ? 0.62 : bob ? 0.52 : 0.4) * R, 0.07 * R);
    hair(at(g.rotateZ(s * 0.08), s * 0.9 * R, (long ? -0.2 : bob ? -0.16 : -0.08) * R, 0.22 * R));
  }
  // the nape: a ring of lock tips round the shell's lower edge, curling in (a bob's hang lower)
  if (!long) {
    const P = T.tips, len = (bob ? 0.44 : 0.3) * R, y = (bob ? -0.46 : -0.3) * R;
    for (let i = 0; i < P.n; i++) {
      const a = (i / (P.n - 1) - 0.5) * 2 * Math.PI * P.span;
      hair(at(lock(0.27 * R, len * (i % 2 ? 0.92 : 1), 0.1 * R).rotateX(-0.22).rotateY(-a), Math.sin(a) * 0.9 * R, y, -Math.cos(a) * 0.9 * R));
    }
  }
  const band = (r, x, y, z, rx = 0, rz = 0) => out.push(colored(at(new THREE.TorusGeometry(r, 0.035 * R, seg(6, 3), seg(18, 6)).rotateX(rx).rotateZ(rz), x, y, z), K.hairBand || darker(H, 0.25)));
  if (long) {                                                        // full, wavy long hair: down the back and over the shoulders
    hair(at(lock(0.95 * R, 1.35 * R, 0.4 * R, 0.12), 0, -0.6 * R, -0.52 * R));
    for (const s of [-1, 1]) {
      hair(at(lock(0.36 * R, 1.15 * R, 0.26 * R, 0.25 * s).rotateZ(s * 0.12), s * 0.66 * R, -0.66 * R, -0.28 * R));   // sides
      hair(at(lock(0.24 * R, 1.0 * R, 0.14 * R, -0.3 * s).rotateZ(s * 0.18).rotateX(0.12), s * 0.8 * R, -0.95 * R, 0.08 * R));   // in front of the shoulders
    }
  } else if (style === 'bun') {                                      // a bun with a wrapped band
    if (K.bun === 'low') {                                           // a neat chignon at the back, a pin through it and a flower
      hair(at(sc(sph(0.42 * R, 18, 12), 1.15, 0.9, 0.8), 0, 0.12 * R, -1.0 * R));
      out.push(colored(at(new THREE.CylinderGeometry(0.018 * R, 0.018 * R, 1.1 * R, 6).rotateZ(1.2), 0, 0.16 * R, -1.22 * R), K.pin || '#d9b24a'));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; out.push(colored(at(sc(sph(0.07 * R, 8, 6), 1, 1, 0.5), 0.4 * R + Math.cos(a) * 0.08 * R, 0.3 * R + Math.sin(a) * 0.08 * R, -1.2 * R), K.flower || '#f4f1e8')); }
      out.push(colored(at(sph(0.045 * R, 8, 6), 0.4 * R, 0.3 * R, -1.24 * R), '#f6d86a'));
    } else {
      hair(at(sph(0.4 * R), 0, 0.7 * R, -0.7 * R));
      band(0.3 * R, 0, 0.66 * R, -0.52 * R, 0.4);
    }
  } else if (style === 'ponytail') {                                 // tied at the back, a wavy tail hanging from the band
    hair(at(sph(0.2 * R), 0, 0.4 * R, -0.92 * R));
    band(0.17 * R, 0, 0.4 * R, -0.98 * R, 1.2);
    hair(at(lock(0.3 * R, 1.15 * R, 0.22 * R, 0.2).rotateX(-0.3), 0, 0.3 * R, -1.0 * R));
  } else if (style === 'twin') {                                     // two bunches low at the sides, each tied with a band
    for (const s of [-1, 1]) {
      band(0.13 * R, s * 0.98 * R, -0.2 * R, -0.3 * R, Math.PI / 2, s * 0.35);
      hair(at(lock(0.27 * R, 0.62 * R, 0.2 * R, 0.22 * s).rotateZ(s * 0.3), s * 1.2 * R, -0.7 * R, -0.32 * R));
    }
  } else if (style === 'spiky') {                                    // spikes standing up and back from the crown
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.2, g = lock(0.17 * R, 0.42 * R, 0.1 * R).rotateZ(Math.PI).rotateX(-0.3 - Math.abs(a) * 0.25).rotateY(a);
      hair(at(g, Math.sin(a) * 0.55 * R, 0.9 * R, -0.02 * R - Math.cos(a) * 0.3 * R));
    }
  }
  if (K.kerchief) {                                                  // a scarf tied over the hair, knotted at the nape
    out.push(colored(at(new THREE.SphereGeometry(Rh * 1.035, seg(32, 8), seg(12), 0, Math.PI * 2, 0, Math.PI * 0.43), 0, 0.02 * R, -0.01 * R), K.kerchief));
    out.push(colored(at(sph(0.1 * R, 10, 8), 0, -0.2 * R, -1.06 * R), K.kerchief));
    for (const s of [-1, 1]) out.push(colored(at(lock(0.09 * R, 0.2 * R, 0.04 * R).rotateZ(s * 0.5), s * 0.12 * R, -0.36 * R, -1.06 * R), darker(K.kerchief, 0.12)));
  }
  if (K.hat === 'none' && !K.kerchief && !K.fxHat && (style === 'short' || style === 'bob' || !style) && K.headScale > 1)   // a kid's cowlick
    hair(at(lock(0.07 * R, 0.2 * R, 0.05 * R, 0.5).rotateZ(Math.PI - 0.5), 0.06 * R, 1.16 * R, 0.05 * R));
  return out;
}

/** Hats, in hat-bone space (the bone sits near the top of the head). */
export function hatParts(K, R) {
  const cyl = (a, b, h, s = 32) => new THREE.CylinderGeometry(a, b, h, seg(s, 8));
  const turn = pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg(36, 10));
  const k = R / 0.125;                                                  // sizes were drawn for R = 0.125
  const straw = () => {
    // a woven straw hat: a brim that droops and lifts at the rim (a thin solid, so it shows from below),
    // a crown with a rounded edge, rings of weave painted darker, a ribbon with a bow at the back
    const N = 9, top = [], under = [];
    for (let i = 0; i <= N; i++) { const t = i / N, r = 0.112 + 0.106 * t, y = -0.016 * t * t + 0.01 * ease(0.8, 1, t); top.push([r, y + 0.006]); under.push([r, y - 0.004]); }
    const weave = g => tint(colored(g, K.hatColor), (col, v) => { const r = Math.hypot(v.x, v.z); col.multiplyScalar(1 - 0.1 * (Math.sin(r * 300) > 0.2 ? 1 : 0) - 0.1 * ease(0.185, 0.218, r)); });
    const tail = s => colored(at(lock(0.016, 0.05, 0.006).rotateZ(s * 0.35), s * 0.022, -0.012, -0.136), darker(K.hatBand, 0.12));
    return [weave(turn([...under, ...top.reverse()])),
      weave(turn([[0.122, 0.0], [0.119, 0.07], [0.112, 0.095], [0.09, 0.104], [0, 0.106]])),
      colored(at(new THREE.CylinderGeometry(0.1235, 0.1245, 0.03, seg(32, 8), 1, true), 0, 0.022, 0), K.hatBand),
      colored(at(new THREE.CircleGeometry(0.124, seg(24, 8)).rotateX(Math.PI / 2), 0, 0.0, 0), darker(K.hatColor, 0.45)),   // the lining, seen from below
      colored(at(sc(sph(0.02, 10, 8), 1.5, 0.8, 0.6), -0.024, 0.024, -0.128), K.hatBand), colored(at(sc(sph(0.02, 10, 8), 1.5, 0.8, 0.6), 0.024, 0.024, -0.128), K.hatBand),   // bow
      colored(at(sph(0.011, 8, 6), 0, 0.024, -0.132), darker(K.hatBand, 0.2)), tail(-1), tail(1)];
  };
  const parts = {
    straw,
    bucket: () => [colored(at(cyl(0.125, 0.19, 0.06), 0, -0.005, 0), K.hatColor), colored(at(cyl(0.112, 0.127, 0.09), 0, 0.05, 0), K.hatColor),
      colored(at(cyl(0.129, 0.129, 0.014), 0, 0.028, 0), darker(K.hatColor, 0.2))],   // stitched band
    cap: () => [colored(at(sc(new THREE.SphereGeometry(0.14, seg(28, 8), seg(12), 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.8, 1.02), 0, -0.02, 0), K.hatColor),
      colored(at(sc(sph(0.1, 20, 6), 1, 0.08, 1), 0, -0.02, 0.15), K.hatBand),
      colored(at(sph(0.016, 8, 6), 0, 0.09, 0), K.hatColor)],
  }[K.hat]?.() || [];
  for (const g of parts) { g.scale(k, k, k); if (K.hat === 'straw') at(g.rotateX(-HEAD.tilt), 0, 0.004 * k, -0.014 * k); }   // worn pushed back, off the face
  return parts;
}
