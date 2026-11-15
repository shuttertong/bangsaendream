// Smooth toon geometry for every person (the kid, NPCs, mini-game crowds, other players): the
// head comes from head.js; here a lathe torso with a collar and a chest print (or an outfit from
// outfit.js), domed sleeves with hem trim, tapered limbs, hands with fingers, socks and strapped
// shoes, pockets; pleated skirts, aprons, vests; a kid's backpack.
// Everything is vertex-coloured and merged by body.js into one skinned mesh.
// Geometry per bone, in bone-local rest space (limbs hang down −y, the face looks along +z).
import * as THREE from 'three';
import { fantasyParts } from './fantasy.js';
import { colored, at, sc, sph, cap, lathe, ring, seg, tint, ease, fine, darker, lighter } from './geo.js';
import { headParts, hatParts, patch, lock } from './head.js';
import { outfitParts, extraParts, bagParts } from './outfit.js';

export const TOON = {
  // natural, tapered limbs (radius at the top / widest point / bottom, and where the widest point sits)
  limb: {
    arm: [0.041, 0.039, 0.033, 0.35], fore: [0.033, 0.034, 0.026, 0.3],
    thigh: [0.066, 0.06, 0.045, 0.25], shin: [0.044, 0.049, 0.029, 0.3],
    hand: [0.036, 0.042, 0.027], shorts: [0.072, 0.078, 0.76], sleeve: [0.05, 0.048, 0.42],
  },
  sole: '#f4f1e8', kidEnds: 1.1,           // kids' hands and feet are a little big for their limbs
  skirt: { pleats: 14, depth: 0.012, len: 0.42 },
};

const hermite = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
/** A limb hanging from the joint (y = 0) down to −len: radius r0 at the top, widest r1 at `mid` (0–1), r2 at the
 *  bottom, with round ends that tuck into the neighbouring joints. */
function taper(len, r0, r1, r2, mid = 0.3) {
  const pts = [], C = seg(4, 2), M = seg(12, 3);                      // rows in each round end and along the limb
  for (let k = 0; k <= C; k++) { const a = (k / C) * Math.PI / 2; pts.push([r2 * Math.sin(a), -len - r2 * Math.cos(a)]); }   // bottom cap
  for (let k = 1; k < M; k++) {
    const t = 1 - k / M, y = -len * t;                                // t: 0 at the top joint, 1 at the bottom
    pts.push([t > mid ? hermite(r1, r2, (t - mid) / (1 - mid)) : hermite(r0, r1, t / mid), y]);
  }
  for (let k = 0; k <= C; k++) { const a = (1 - k / C) * Math.PI / 2; pts.push([r0 * Math.sin(a), r0 * Math.cos(a)]); }       // top cap
  return lathe(pts, 16);
}
/** An open tube (shorts leg) from y0 down to y1, radius ra at the top flaring to rb at the hem. */
const tube = (y0, y1, ra, rb) => lathe([[rb, y1], [rb * 1.01, y1 + 0.01], [(ra + rb) / 2, (y0 + y1) / 2], [ra, y0 - 0.01], [ra * 0.7, y0]], 18);
/** A sleeve: a rounded shoulder dome over the joint, flaring to the hem at −len. */
const sleeve = (len, ra, rb, dome = 0.05) => lathe([[rb, -len], [rb * 1.01, -len + 0.01], [ra, -len * 0.45], [ra * 1.02, 0], [ra * 0.9, dome * 0.6], [ra * 0.55, dome * 0.92], [0, dome]], 18);

/** A small generic chest print (no real logos): picked from the shirt colour so looks differ.
 *  The motif sits straight on the shirt in a contrasting shade (printBg adds a round badge behind it). */
function chestPrint(K, y, z) {
  const c = new THREE.Color(K.shirt), lum = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  const fg = K.print || (lum > 0.45 ? darker(K.shirt, 0.4) : lighter(K.shirt, 0.65));
  const n = parseInt(K.shirt.replace('#', '').slice(0, 2), 16) % 3, out = K.printBg ? [colored(at(patch(0.046, 0.046, 0.008), 0, y, z), K.printBg)] : [];
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
  const hs = K.headScale, R = B.head, close = fine(), ends = hs > 1 ? TOON.kidEnds : 1;
  const { head, eyes, mouth, joy } = headParts(K, R);
  const hat = K.fxHat ? [] : hatParts(K, R);                           // a fantasy head item replaces the hat
  for (const g of [...head, ...eyes, ...mouth, ...joy, ...hat]) g.scale(hs, hs, hs);

  const long = K.sleeves === 'long', bare = K.sleeves === 'none';
  const pants = K.bottom === 'pants';
  const L = TOON.limb, sock = K.sock || TOON.sole;
  // shirtStyle: 'plain' | 'stripes' (white bands) | 'stripesDark' (bands in a darker shade) | 'raglan' (sleeves and collar in the trim colour)
  const style = K.shirtStyle || 'plain', striped = style.startsWith('stripes'), stripe = style === 'stripes' ? K.shirtTrim : darker(K.shirt, 0.35);
  const sleeveCol = style === 'raglan' ? K.shirtTrim : K.shirt;
  // bare legs: close up, a little blush on the knees (at y = knee in the bone's space)
  const blush = new THREE.Color(K.cheek);
  const leg = (g, knee) => pants ? colored(g, K.bottomColor)
    : close ? tint(colored(g, K.skin), (c, v) => c.lerp(blush, 0.34 * Math.exp(-(((v.y - knee) / 0.035) ** 2)) * ease(-0.01, 0.03, v.z))) : colored(g, K.skin);
  const side = s => {
    const sx = s === 'L' ? -1 : 1, hy = -B.foreArm - L.hand[1] * 0.75 * ends, foot = [
      colored(at(sc(sph(1), 0.056, 0.027, 0.107), 0, -B.ankle + 0.012, 0.031), TOON.sole),                       // sole
      colored(at(sc(sph(1), 0.049, 0.046, 0.095), 0, -B.ankle + 0.035, 0.03), K.shoe),                           // rounded shoe
      colored(at(sc(sph(1, 12, 8), 0.041, 0.03, 0.05), 0, -B.ankle + 0.03, 0.066), lighter(K.shoe, 0.25)),      // toe cap
      ...(close ? [colored(at(sc(sph(1, 12, 6), 0.051, 0.011, 0.02), 0, -B.ankle + 0.071, 0.046), lighter(K.shoe, 0.5)),   // strap across the instep
        colored(at(sc(sph(1, 8, 6), 0.012, 0.02, 0.008), 0, -B.ankle + 0.065, -0.062), darker(K.shoe, 0.25))] : [])];      // heel tab
    for (const g of foot) at(g.scale(ends, ends, ends), 0, B.ankle * (ends - 1), 0);                              // bigger, still standing on the ground
    return {
      [`arm${s}`]: [colored(taper(B.upperArm, ...L.arm), long ? sleeveCol : K.skin),
        // shoulder: a bare skin dome, or the sleeve's dome (short: to mid-arm with a trim ring; long: the whole arm)
        bare ? colored(sleeve(0.03, L.arm[0] * 1.08, L.arm[0] * 1.02, 0.045), K.skin)
          : colored(sleeve(long ? B.upperArm * 0.45 : B.upperArm * L.sleeve[2], L.sleeve[0], L.sleeve[1]), sleeveCol),
        ...(bare || long ? [] : [colored(ring(L.sleeve[1], 0.006, -B.upperArm * L.sleeve[2] + 0.004), K.shirtTrim)]),
        ...(striped && !bare ? [colored(ring(L.sleeve[1] * 0.985, 0.009, -B.upperArm * L.sleeve[2] * 0.5), stripe)] : [])],   // a band round the sleeve
      [`fore${s}`]: [colored(taper(B.foreArm, ...L.fore.slice(0, 3), L.fore[3]), long ? sleeveCol : K.skin),
        ...(long ? [colored(ring(L.fore[2] * 1.15, 0.006, -B.foreArm + 0.01), K.shirtTrim)] : []),               // cuff
        colored(at(sc(sph(1), L.hand[0] * ends, L.hand[1] * ends, L.hand[2] * ends), 0, hy, 0.004), K.skin),     // palm
        colored(at(sc(sph(1, 10, 8), 0.013, 0.02, 0.012).scale(ends, ends, ends), -sx * 0.021 * ends, hy + 0.012, 0.026), K.skin),   // thumb
        ...(close ? [0, 1, 2, 3].map(i => colored(at(cap(0.0088 * ends, 0.013 * ends), (i - 1.5) * 0.0152 * ends, hy - L.hand[1] * ends * 0.8 + Math.abs(i - 1.4) * 0.004, 0.006), K.skin)) : [])],   // fingers
      [`leg${s}`]: [leg(taper(B.thigh, ...L.thigh), -B.thigh),
        ...(K.bottom === 'skirt' ? [] : [colored(tube(L.thigh[0] * 1.3, -B.thigh * (pants ? 1.02 : L.shorts[2]), L.shorts[0], L.shorts[1]), K.bottomColor)]),   // shorts / trouser leg
        ...(K.bottom === 'shorts' ? [colored(ring(L.shorts[1], 0.005, -B.thigh * L.shorts[2] + 0.005), darker(K.bottomColor, 0.25))] : [])],                  // shorts hem
      [`shin${s}`]: [leg(taper(B.shin, ...L.shin), 0),
        ...(pants ? [colored(ring(L.shin[2] * 1.12, 0.006, -B.shin + 0.035), darker(K.bottomColor, 0.25))]                                                     // trouser cuff
          : [colored(at(new THREE.CylinderGeometry(L.shin[2] * 1.12, L.shin[2] * 1.05, 0.035, seg(14, 6)), 0, -B.shin + 0.02, 0), sock)])],   // sock
      [`foot${s}`]: foot,
    };
  };

  // the torso: a T-shirt hanging a little loose over the shorts, darker toward the hem
  const belly = K.belly, depth = 0.78 + belly * 0.3;
  const profile = [[-0.095, 0], [-0.09, 0.129], [-0.04, 0.133], [0.08, 0.13 + belly * 0.04], [0.19, 0.138], [0.25, 0.142], [0.3, 0.125], [0.325, 0.07], [0.33, 0]];
  const torsoR = y => { const i = Math.max(1, profile.findIndex(([py]) => py >= y)), [y0, r0] = profile[i - 1], [y1, r1] = profile[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); };
  const ctx = { torsoR, depth }, O = outfitParts(K, B, ctx);
  const spine = [
    tint(colored(sc(lathe(profile.map(([y, r]) => [r, y])), 1, 1, depth), K.shirt), (c, v) => c.multiplyScalar(1 - 0.16 * ease(0.06, -0.09, v.y))),
    colored(ring(0.06, 0.013, B.torso - 0.075, 0.85), O.collar || (style === 'raglan' ? darker(K.shirtTrim, 0.08) : K.shirtTrim)),   // collar
    ...(O.noHem ? [] : [colored(ring(0.131, 0.006, -0.086, depth * 1.03), darker(K.shirt, 0.16))]),                    // shirt hem
    colored(at(cap(0.042, 0.06), 0, B.torso - 0.05, 0), K.skin),                                                 // neck
  ];
  const covered = K.vest || K.apron;
  if (striped) for (const y of [-0.04, 0.02, 0.08, 0.14, 0.2]) spine.push(colored(ring(torsoR(y) + 0.001, 0.011, y, depth), stripe));   // bands round the chest
  if (!covered && !bare && !striped && !O.plain && K.print !== 'none') spine.push(...chestPrint(K, 0.165, 0.138 * depth + 0.002 + belly * 0.02));
  if (!covered) spine.push(...O.spine, ...extraParts(K, B, ctx));
  if (K.vest) {                                                        // life vest over the shirt
    spine.push(colored(sc(lathe([[0, -0.04], [0.16, -0.03], [0.168 + belly * 0.03, 0.08], [0.158, 0.2], [0.12, 0.27], [0, 0.28]]), 1, 1, 0.84 + belly * 0.3), K.vest));
    for (const y of [0.04, 0.15]) spine.push(colored(ring(0.166 + belly * 0.03, 0.012, y, 0.84 + belly * 0.3), '#1a1a1a'));
  }
  if (K.apron) {                                                       // bib + skirt panel wrapped round the front, neck band and waist tie
    const front = (r0, y0, r1, y1, span) => new THREE.LatheGeometry([new THREE.Vector2(r1, y1), new THREE.Vector2(r0, y0)], seg(16, 6), -span / 2, span).scale(1, 1, depth);   // (lathe angle 0 = +z, the front)
    spine.push(colored(front(0.134 + belly * 0.04, 0.26, 0.138 + belly * 0.04, 0.1, 0.9), K.apron));           // bib
    spine.push(colored(front(0.137 + belly * 0.04, 0.1, 0.165, -0.3, 1.7), K.apron));                           // skirt panel, flaring out
    spine.push(colored(ring(0.05, 0.007, B.torso - 0.06), darker(K.apron, 0.1)));                              // neck band
    spine.push(colored(ring(0.135 + belly * 0.04, 0.009, 0.1, depth), darker(K.apron, 0.1)));                  // waist tie
  }
  if (K.bag && close && !K.vest && !K.fxBack && !K.fxWings) spine.push(...bagParts(K, B, ctx));                // (a wardrobe item on the back takes its place)
  const hips = [colored(sc(lathe([[0, -0.1], [0.1, -0.1], [0.12, -0.05], [0.124, 0.04], [0.118, 0.1], [0, 0.1]]), 1, 1, 0.8), K.bottomColor),
    colored(ring(0.116, 0.008, 0.075, 0.8), darker(K.bottomColor, 0.25))];                                      // waistband
  if (close && K.bottom !== 'skirt') for (const s of [-1, 1]) hips.push(colored(at(patch(0.03, 0.026, 0.0025), s * 0.052, -0.05, -0.096), darker(K.bottomColor, 0.1)));   // back pockets
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
    if (K.sarong) for (const y of [-0.24, -0.29, -0.36]) hips.push(colored(ring(0.138 + 0.08 * -y, y === -0.29 ? 0.012 : 0.006, y, 0.82), K.sarong));   // a sarong's woven bands
  }

  const out = { hips, spine, head, hat, eyes, mouth, joy, ...side('L'), ...side('R') };
  for (const [bone, geos] of Object.entries(fantasyParts(K, R, B, hs))) (out[bone] ||= []).push(...geos);   // wardrobe items
  return out;
}
