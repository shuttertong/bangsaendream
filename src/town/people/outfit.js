// Outfits worn over the plain T-shirt torso (look.outfit) and the kid's little backpack (look.bag).
// Everything is laid on the torso's surface, in spine-bone space (front = +z), vertex-coloured.
// ctx: { torsoR(y) → the torso's radius at height y, depth → its front-to-back squash }.
import * as THREE from 'three';
import { colored, at, sc, sph, seg, pod, darker, lighter } from './geo.js';
import { patch, lock } from './head.js';

export const OUTFITS = ['tee', 'hawaii', 'sailor', 'overalls'];
export const OUTFIT = {
  flower: { n: 24, petal: 0.012, centre: '#f6d86a' },
  tie: '#d8443a', button: '#f0c040', strap: 0.011,
};

/** Helpers bound to one torso. */
function torso({ torsoR, depth }) {
  /** Lay g (built facing +z round the origin) on the torso at angle th from the front, height y. */
  const on = (g, th, y, lift = 0.002) => { const r = torsoR(y) + lift; return at(g.rotateY(th), Math.sin(th) * r, y, Math.cos(th) * r * depth); };
  /** A band of cloth hugging the torso from y0 up to y1, `span` radians wide, centred on angle `mid` (0 = front, π = back). */
  const band = (y0, y1, mid, span, lift = 0.005) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const y = y0 + (y1 - y0) * i / 6; pts.push(new THREE.Vector2(torsoR(y) + lift, y)); }
    return new THREE.LatheGeometry(pts, seg(span > 3 ? 28 : 14, 6), mid - span / 2, span).scale(1, 1, depth);
  };
  /** A strap over the shoulder at x: up the front from yFront, over the top, down the back to yBack. */
  const strap = (x, yFront, yBack, r = OUTFIT.strap) => {
    const z = y => Math.sqrt(Math.max(0, 1 - (x / torsoR(y)) ** 2)) * torsoR(y) * depth + r * 0.5, pts = [];
    let top = yFront;
    while (top < 0.325 && torsoR(top + 0.008) > Math.abs(x) + 0.004) top += 0.008;
    for (let y = yFront; y < top; y += 0.02) pts.push(new THREE.Vector3(x, y, z(y)));
    pts.push(new THREE.Vector3(x, top + r, 0));
    for (let y = top - 0.01; y > yBack; y -= 0.02) pts.push(new THREE.Vector3(x, y, -z(y)));
    pts.push(new THREE.Vector3(x, yBack, -z(yBack)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg(28, 8), r, seg(6, 4));
  };
  return { on, band, strap };
}

/**
 * Extra parts for look.outfit: { spine: [...], collar: colour for the neck ring (or undefined), plain: true when
 * the outfit takes the place of the chest print }.
 */
export function outfitParts(K, B, ctx) {
  const { on, band, strap } = torso(ctx), spine = [], kind = K.outfit;
  if (kind === 'hawaii') {                                             // a holiday shirt: flowers all over, an open collar, buttons
    const F = OUTFIT.flower;
    for (let i = 0; i < F.n; i++) {
      const th = i * 2.39996 + 0.5, y = -0.06 + ((i * 0.618034) % 1) * 0.29;
      if (Math.abs(Math.sin(th / 2)) < 0.12 && Math.cos(th / 2) > 0) continue;       // keep the button line clear
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + i; spine.push(colored(on(at(sc(sph(1, 6, 4), F.petal, F.petal, 0.004), Math.cos(a) * F.petal * 1.15, Math.sin(a) * F.petal * 1.15, 0), th, y), K.shirtTrim)); }
      spine.push(colored(on(sc(sph(1, 6, 4), F.petal * 0.6, F.petal * 0.6, 0.005), th, y, 0.003), F.centre));
    }
    for (const y of [0.2, 0.12, 0.04]) spine.push(colored(on(sc(sph(1, 8, 6), 0.008, 0.008, 0.004), 0, y, 0.003), K.shirtTrim));   // buttons
    for (const s of [-1, 1]) spine.push(colored(on(lock(0.022, 0.03, 0.006).rotateZ(s * 0.8), s * 0.3, B.torso - 0.088, 0.004), lighter(K.shirt, 0.22)));   // collar flaps
    return { spine, collar: lighter(K.shirt, 0.22), plain: true };
  }
  if (kind === 'sailor') {                                             // a sailor collar: a square flap down the back, a V in front, a knotted tie
    const line = K.bottomColor, tie = K.tie || OUTFIT.tie;
    spine.push(colored(band(0.13, 0.3, Math.PI, 1.9, 0.006), K.shirtTrim), colored(band(0.142, 0.156, Math.PI, 1.9, 0.008), line));
    for (const s of [-1, 1]) {
      spine.push(colored(on(lock(0.034, 0.09, 0.008).rotateZ(-s * 0.5), s * 0.42, 0.232, 0.004), K.shirtTrim));
      spine.push(colored(on(lock(0.012, 0.085, 0.006).rotateZ(-s * 0.5), s * 0.5, 0.222, 0.008), line));
      spine.push(colored(on(lock(0.016, 0.04, 0.006).rotateZ(s * 0.35), s * 0.07, 0.125, 0.006), tie));          // the tie's tails
    }
    spine.push(colored(on(sc(sph(1, 10, 8), 0.02, 0.016, 0.012), 0, 0.158, 0.006), tie));                          // knot
    return { spine, collar: K.shirtTrim, plain: true };
  }
  if (kind === 'overalls') {                                           // dungarees over the shirt: waist, bib, straps with buttons, a bib pocket
    const C = K.bottomColor;
    spine.push(colored(band(-0.094, 0.075, 0, Math.PI * 2, 0.006), C), colored(band(0.07, 0.235, 0, 1.05, 0.007), C), colored(band(0.07, 0.17, Math.PI, 0.9, 0.007), C));
    for (const s of [-1, 1]) {
      spine.push(colored(strap(s * 0.06, 0.225, 0.16), C));
      spine.push(colored(on(sc(sph(1, 8, 6), 0.011, 0.011, 0.006), s * 0.42, 0.218, 0.009), OUTFIT.button));
    }
    spine.push(colored(on(patch(0.034, 0.024, 0.004), 0, 0.15, 0.008), darker(C, 0.18)));
    return { spine, plain: true, noHem: true };
  }
  return { spine };
}

/** A small backpack on the kid's back: body, flap, pocket, a grab loop, shoulder straps and a charm. */
export function bagParts(K, B, ctx) {
  const { strap } = torso(ctx), C = K.bag, z = -(ctx.torsoR(0.13) * ctx.depth + 0.036), out = [];
  out.push(colored(at(pod(0.09, 0.105, 0.05), 0, 0.125, z), C));                                                    // body
  out.push(colored(at(pod(0.093, 0.05, 0.053, 3), 0, 0.184, z - 0.001), lighter(C, 0.25)));                         // flap
  out.push(colored(at(pod(0.058, 0.036, 0.016, 3), 0, 0.075, z - 0.044), darker(C, 0.14)));                         // pocket
  out.push(colored(at(sc(sph(1, 8, 6), 0.012, 0.012, 0.008), 0, 0.142, z - 0.052), K.bagTrim || '#f4f1e8'));         // clasp
  out.push(colored(at(new THREE.TorusGeometry(0.022, 0.006, seg(6, 3), seg(14, 6)), 0, 0.236, z + 0.03), darker(C, 0.25)));   // grab loop
  for (const s of [-1, 1]) out.push(colored(strap(s * 0.074, 0.19, 0.2, 0.009), darker(C, 0.2)));
  out.push(colored(at(sph(0.014, 8, 6), 0.088, 0.05, z - 0.01), OUTFIT.flower.centre));                              // a charm swinging at the side
  return out;
}
