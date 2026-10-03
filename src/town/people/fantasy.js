// Fantasy wardrobe geometry (shared/wardrobe.js items) for toon.js: hats and ears on the hat bone
// (so they bounce on the hat spring), wings / capes / packs on the spine, held things on the left
// forearm (shield on the right), tails on the hips. Vertex-coloured, merged into the one person mesh.
import * as THREE from 'three';
import { byId } from '../../shared/wardrobe.js';
import { colored, at, sc, sph, lathe } from './geo.js';
const col = h => new THREE.Color(h);
const cone = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);
const cyl = (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const torus = (r, t, seg = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 8, seg, arc);
/** A flat wing lobe lying in the x-y plane, tip along +x, thickness d. */
const lobe = (len, wid, d) => sc(sph(1, 14, 10), len, wid, d);

function hatParts(id, c, k) {                 // in hat-bone space, drawn for R = 0.125 and scaled by k
  const p = [];
  switch (id) {
    case 'wizard':
      p.push(colored(at(cyl(0.21, 0.23, 0.014), 0, 0, 0), c[0]), colored(at(cone(0.12, 0.34).rotateZ(0.12), 0.02, 0.17, 0), c[0]));
      p.push(colored(at(sph(0.02, 8, 6), 0.07, 0.3, 0), c[1]), colored(at(torus(0.12, 0.014), 0, 0.012, 0).rotateX(Math.PI / 2), c[1]));
      break;
    case 'crown':
      p.push(colored(at(cyl(0.125, 0.115, 0.07), 0, 0.035, 0), c[0]));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.push(colored(at(cone(0.028, 0.07, 6), Math.sin(a) * 0.118, 0.1, Math.cos(a) * 0.118), c[0])); p.push(colored(at(sph(0.014, 8, 6), Math.sin(a) * 0.126, 0.04, Math.cos(a) * 0.126), i % 2 ? c[1] : c[2])); }
      break;
    case 'tiara':
      p.push(colored(at(torus(0.12, 0.012, 24, Math.PI * 0.9).rotateZ(Math.PI * 0.05).rotateX(Math.PI / 2), 0, 0.02, 0.0), c[0]));
      for (const [x, h, cc] of [[0, 0.1, c[1]], [-0.05, 0.065, c[2]], [0.05, 0.065, c[2]]]) p.push(colored(at(cone(0.016, h, 6), x, 0.02 + h / 2, 0.115), c[0]), colored(at(sph(0.012, 8, 6), x, 0.03 + h, 0.115), cc));
      break;
    case 'flowers': {
      p.push(colored(at(torus(0.125, 0.018), 0, 0.01, 0).rotateX(Math.PI / 2), c[0]));
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = Math.sin(a) * 0.125, z = Math.cos(a) * 0.125, cc = c[1 + (i % 3)]; for (let j = 0; j < 5; j++) { const b = j / 5 * Math.PI * 2; p.push(colored(at(sph(0.013, 6, 5), x + Math.cos(b) * 0.018 * Math.cos(a), 0.02 + Math.sin(b) * 0.018, z - Math.cos(b) * 0.018 * Math.sin(a)), cc)); } p.push(colored(at(sph(0.011, 6, 5), x, 0.02, z), '#f4d03c')); }
      break;
    }
    case 'bunny':
      for (const s of [-1, 1]) { p.push(colored(at(sc(sph(1, 10, 8), 0.028, 0.14, 0.02).rotateZ(-s * 0.18), s * 0.06, 0.13, -0.01), c[0])); p.push(colored(at(sc(sph(1, 8, 6), 0.014, 0.1, 0.012).rotateZ(-s * 0.18), s * 0.06, 0.13, 0.012), c[1])); }
      break;
    case 'cat':
      for (const s of [-1, 1]) { p.push(colored(at(cone(0.045, 0.09, 4).rotateY(Math.PI / 4).rotateZ(-s * 0.35), s * 0.09, 0.03, 0), c[0])); p.push(colored(at(cone(0.024, 0.055, 4).rotateY(Math.PI / 4).rotateZ(-s * 0.35), s * 0.088, 0.025, 0.012), c[1])); }
      break;
    case 'halo':
      p.push(colored(at(torus(0.1, 0.014, 28).rotateX(Math.PI / 2), 0, 0.14, 0), c[0]));
      break;
    case 'pirate':
      p.push(colored(at(sc(sph(1, 20, 10), 0.21, 0.05, 0.19).scale(1, 1, 1), 0, 0.0, 0), c[0]), colored(at(sc(sph(1, 20, 10), 0.13, 0.09, 0.12), 0, 0.05, 0), c[0]));
      p.push(colored(at(box(0.18, 0.1, 0.02), 0, 0.03, 0.16).rotateX(-0.5), c[0]), colored(at(sph(0.022, 8, 6), 0, 0.06, 0.17), c[1]), colored(at(torus(0.19, 0.008, 28).rotateX(Math.PI / 2), 0, 0.0, 0), c[2]));
      break;
    case 'dino':
      p.push(colored(at(new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, -0.03, 0), c[0]));
      for (let i = 0; i < 5; i++) p.push(colored(at(cone(0.022, 0.06, 4), 0, 0.11 - i * 0.012, -0.11 + i * 0.05), c[1]));
      for (const s of [-1, 1]) p.push(colored(at(sph(0.03, 10, 8), s * 0.07, 0.05, 0.12), c[2]), colored(at(sph(0.013, 8, 6), s * 0.07, 0.05, 0.145), '#2a2522'));
      break;
  }
  for (const g of p) g.scale(k, k, k);
  return p;
}

function wingParts(id, c) {                  // spine space: back is −z, shoulders at y ≈ 0.22
  const p = [], y0 = 0.2, z0 = -0.1;
  const put = (g, s, x, y, tilt, lift) => p.push(colored(at(g.rotateZ(s * tilt).rotateY(-s * lift), s * x, y0 + y, z0), id === 'bat' || id === 'dragon' ? c[0] : c[0]));
  for (const s of [-1, 1]) {
    switch (id) {
      case 'fairy':
        put(lobe(0.17, 0.1, 0.012).translate(0.12, 0.05, 0), s, 0.04, 0.03, 0.45, 0.35); put(lobe(0.12, 0.07, 0.012).translate(0.09, -0.03, 0), s, 0.04, -0.05, -0.35, 0.35);
        p.push(colored(at(lobe(0.1, 0.05, 0.014).rotateZ(s * 0.45).rotateY(-s * 0.35), s * 0.17, y0 + 0.1, z0 + 0.004), c[1]));
        break;
      case 'butterfly':
        put(lobe(0.19, 0.13, 0.012).translate(0.14, 0.06, 0), s, 0.04, 0.02, 0.5, 0.3); put(lobe(0.13, 0.09, 0.012).translate(0.1, -0.06, 0), s, 0.04, -0.06, -0.3, 0.3);
        for (const [x, y, r] of [[0.2, 0.14, 0.03], [0.26, 0.06, 0.022], [0.16, -0.1, 0.025]]) p.push(colored(at(sph(r, 8, 6).scale(1, 1, 0.4), s * x, y0 + y, z0 - 0.006), c[1]), colored(at(sph(r * 0.5, 8, 6).scale(1, 1, 0.4), s * x, y0 + y, z0 - 0.012), c[2]));
        break;
      case 'bat': case 'dragon': {
        const L = id === 'dragon' ? 0.3 : 0.22, W = id === 'dragon' ? 0.2 : 0.14;
        p.push(colored(at(sc(cone(1, 1, 3), W, L, 0.012).rotateZ(Math.PI / 2 + s * 0.9).rotateY(-s * 0.4), s * (0.03 + L * 0.5), y0 + 0.02, z0), c[0]));
        for (let i = 0; i < 3; i++) p.push(colored(at(cyl(0.006, 0.006, L * 0.9).rotateZ(Math.PI / 2 + s * (0.6 + i * 0.3)).rotateY(-s * 0.4), s * (0.03 + L * 0.42), y0 + 0.02 + i * 0.02, z0 - 0.004), c[1]));
        if (id === 'dragon') for (let i = 0; i < 3; i++) p.push(colored(at(cone(0.012, 0.035, 4), s * (0.08 + i * 0.09), y0 + 0.12 - i * 0.01, z0), c[2]));
        break;
      }
      case 'angel':
        for (let i = 0; i < 5; i++) { const g = lobe(0.14 - i * 0.012, 0.035, 0.012).translate(0.1, 0, 0); put(g, s, 0.05, 0.08 - i * 0.045, 0.6 - i * 0.28, 0.3); }
        p.push(colored(at(sph(0.035, 10, 8), s * 0.05, y0 + 0.06, z0), c[1]));
        break;
    }
  }
  return p;
}

function backParts(id, c) {                  // spine space
  const p = [], z = -0.12;
  switch (id) {
    case 'cape': case 'rainbow': {
      const n = id === 'rainbow' ? 6 : 1, w = 0.3 / n;
      for (let i = 0; i < n; i++) p.push(colored(at(box(w, 0.42, 0.014).rotateX(-0.12), -0.15 + w / 2 + i * w, 0.0, z - 0.02), c[i % c.length]));
      p.push(colored(at(torus(0.062, 0.012, 20).rotateX(Math.PI / 2), 0, 0.27, 0), id === 'rainbow' ? '#f4d03c' : '#f4d03c'));
      break;
    }
    case 'shell':
      p.push(colored(at(sc(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0.17, 0.11, 0.21).rotateX(-Math.PI / 2), 0, 0.12, z + 0.02), c[0]));
      for (const [x, y] of [[0, 0.12], [-0.08, 0.06], [0.08, 0.06], [-0.08, 0.18], [0.08, 0.18], [0, 0.0], [0, 0.24]]) p.push(colored(at(sph(0.03, 6, 4).scale(1, 1, 0.4), x, y, z - 0.085), c[1]));
      for (const s of [-1, 1]) p.push(colored(at(box(0.03, 0.26, 0.02), s * 0.08, 0.13, 0.11), '#e8d8a8'));
      break;
    case 'backpack':
      p.push(colored(at(box(0.22, 0.26, 0.11), 0, 0.12, z + 0.02), c[0]), colored(at(box(0.16, 0.09, 0.04), 0, 0.05, z - 0.05), c[1]), colored(at(cyl(0.012, 0.012, 0.1).rotateZ(Math.PI / 2), 0, 0.27, z + 0.01), c[1]));
      for (const s of [-1, 1]) p.push(colored(at(box(0.03, 0.24, 0.02), s * 0.08, 0.14, 0.11), c[1]));
      break;
    case 'rocket':
      for (const s of [-1, 1]) { const x = s * 0.07; p.push(colored(at(cyl(0.045, 0.045, 0.26), x, 0.13, z), c[0]), colored(at(cone(0.045, 0.07), x, 0.295, z), c[1]), colored(at(cone(0.035, 0.08).rotateX(Math.PI), x, -0.04, z), c[2]), colored(at(cone(0.02, 0.05).rotateX(Math.PI), x, -0.08, z), '#f4d03c')); }
      p.push(colored(at(box(0.2, 0.05, 0.04), 0, 0.14, z + 0.04), '#2a2522'));
      break;
  }
  return p;
}

function handParts(id, c, fa) {               // forearm space: hand at y = −fa, forward is +z
  const p = [], y = -fa - 0.02;
  switch (id) {
    case 'wand':
      p.push(colored(at(cyl(0.008, 0.01, 0.3).rotateX(Math.PI / 2 - 0.5), 0, y + 0.06, 0.1), c[0]));
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; p.push(colored(at(cone(0.012, 0.03, 4).rotateZ(a), Math.sin(a) * 0.022, y + 0.13 + Math.cos(a) * 0.022, 0.24), c[1])); }
      p.push(colored(at(sph(0.02, 8, 6), 0, y + 0.13, 0.24), c[1]));
      break;
    case 'sword':
      p.push(colored(at(box(0.03, 0.34, 0.012).rotateX(-0.35), 0, y + 0.2, 0.08), c[0]), colored(at(box(0.11, 0.02, 0.03), 0, y + 0.03, 0.02), c[2]), colored(at(cyl(0.014, 0.014, 0.09), 0, y - 0.02, 0.0), c[1]), colored(at(sph(0.018, 8, 6), 0, y - 0.07, 0), c[2]));
      break;
    case 'staff':
      p.push(colored(at(cyl(0.012, 0.014, 0.9), 0, y + 0.3, 0.03), c[0]), colored(at(sph(0.045, 12, 10), 0, y + 0.78, 0.03), c[1]));
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; p.push(colored(at(cone(0.012, 0.07, 4).rotateX(Math.PI).rotateZ(a * 0), Math.sin(a) * 0.035, y + 0.74, 0.03 + Math.cos(a) * 0.035), c[0])); }
      break;
    case 'balloon':
      p.push(colored(at(cyl(0.004, 0.004, 0.55), 0, y + 0.27, 0.02), '#f4f1e8'), colored(at(sc(sph(1, 14, 10), 0.09, 0.11, 0.09), 0, y + 0.62, 0.02), c[0]), colored(at(cone(0.012, 0.02, 4).rotateX(Math.PI), 0, y + 0.5, 0.02), c[0]));
      break;
    case 'icecream':
      p.push(colored(at(cone(0.035, 0.12).rotateX(Math.PI), 0, y + 0.02, 0.04), c[0]), colored(at(sph(0.04, 12, 8), 0, y + 0.1, 0.04), c[1]), colored(at(sph(0.034, 12, 8), 0, y + 0.16, 0.04), c[2]), colored(at(sph(0.012, 8, 6), 0, y + 0.19, 0.04), '#e2453a'));
      break;
    case 'umbrella':
      p.push(colored(at(cyl(0.007, 0.007, 0.5), 0, y + 0.22, 0.02), '#5a3a26'), colored(at(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, y + 0.44, 0.02), c[0]));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.push(colored(at(sph(0.03, 6, 4).scale(1, 0.4, 1), Math.sin(a) * 0.14, y + 0.6, 0.02 + Math.cos(a) * 0.14), c[1])); }
      break;
    case 'shield':  // drawn in the RIGHT forearm's space (see fantasyParts)
      p.push(colored(at(sc(sph(1, 20, 12), 0.13, 0.15, 0.03), -0.045, y + 0.08, 0.0), c[0]), colored(at(sc(sph(1, 16, 10), 0.08, 0.1, 0.03), -0.045, y + 0.08, -0.012), c[1]), colored(at(sph(0.025, 8, 6), -0.045, y + 0.08, -0.03), c[0]));
      break;
  }
  return p;
}

function tailParts(id, c) {                  // hips space: back is −z
  const p = [], n = 7;
  const curve = t => [0, -0.02 + Math.sin(t * 2.2) * 0.12 + t * 0.1, -0.1 - t * 0.32];
  switch (id) {
    case 'cattail': case 'foxtail':
      for (let i = 0; i <= n; i++) { const t = i / n, [x, y, z] = curve(t), r = id === 'foxtail' ? 0.045 * (0.6 + Math.sin(t * Math.PI) * 0.9) : 0.022; p.push(colored(at(sph(r, 10, 8), x, y, z), id === 'foxtail' && t > 0.75 ? c[1] : c[0])); }
      break;
    case 'dinotail': case 'dragontail':
      for (let i = 0; i <= n; i++) { const t = i / n, r = 0.07 * (1 - t * 0.85); p.push(colored(at(sph(r, 10, 8), 0, -0.02 - t * 0.04 + (id === 'dragontail' ? Math.sin(t * 2) * 0.05 : 0), -0.1 - t * 0.4), c[0])); if (i % 2 === 0 && i < n) p.push(colored(at(cone(0.016 * (1 - t * 0.6), 0.05 * (1 - t * 0.5), 4), 0, 0.03 - t * 0.04 + r * 0.6, -0.1 - t * 0.4), c[1])); }
      if (id === 'dragontail') p.push(colored(at(cone(0.03, 0.08, 4).rotateX(-Math.PI / 2), 0, -0.06, -0.52), c[1]));
      break;
  }
  return p;
}

/** Parts per bone for buildPerson, from K.fxHat / fxWings / fxBack / fxHand / fxTail. */
export function fantasyParts(K, R, B, hs) {
  const out = {}, add = (bone, geos) => { if (geos.length) (out[bone] ||= []).push(...geos); };
  const c = id => (byId[id]?.c || []);
  if (K.fxHat) { const g = hatParts(K.fxHat, c(K.fxHat), R / 0.125); for (const x of g) x.scale(hs, hs, hs); add('hat', g); }
  if (K.fxWings) add('spine', wingParts(K.fxWings, c(K.fxWings)));
  if (K.fxBack) add('spine', backParts(K.fxBack, c(K.fxBack)));
  if (K.fxHand) add(K.fxHand === 'shield' ? 'foreR' : 'foreL', handParts(K.fxHand, c(K.fxHand), B.foreArm));
  if (K.fxTail) add('hips', tailParts(K.fxTail, c(K.fxTail)));
  return out;
}
