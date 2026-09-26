// Procedural Bang Saen trees. Each species returns template geometries (trunk, and
// leaf `cards` or palm `fronds`) in tree-local space, base at the origin; nature.js
// instances them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELLS, cellUV } from '../../world/foliage.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = hex => new THREE.Color(hex);

// ---------- builders ----------
/** Tapered tube through `pts` with radius per point; vertex colour from colorAt(y). */
function tube(pts, radii, colorAt, radial = 7) {
  const pos = [], nrm = [], col = [], idx = [];
  const up = V(0, 1, 0), t = V(), n = V(), b = V(), c = new THREE.Color();
  for (let i = 0; i < pts.length; i++) {
    t.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    n.crossVectors(t, Math.abs(t.y) > 0.95 ? V(1, 0, 0) : up).normalize();
    b.crossVectors(t, n);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
      const d = V().addScaledVector(n, dx).addScaledVector(b, dy);
      pos.push(pts[i].x + d.x * radii[i], pts[i].y + d.y * radii[i], pts[i].z + d.z * radii[i]);
      nrm.push(d.x, d.y, d.z);
      colorAt(c, pts[i].y, k);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k, bb = a + radial + 1;
    idx.push(a, bb, a + 1, a + 1, bb, bb + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}

const plain = hex => { const base = C(hex); return (c, y, k) => c.copy(base).offsetHSL(0, 0, (k % 3) * 0.015); };

/** Leaf-card collector: billboard quads around clump centres. */
class Cards {
  constructor() { this.pos = []; this.corner = []; this.size = []; this.nrm = []; this.uv = []; this.col = []; this.max = 0; this.clumps = []; }
  add(centre, size, normal, cell, color, rot) {
    const [u0, v0, u1, v1] = cellUV(cell), cs = Math.cos(rot), sn = Math.sin(rot);
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.pos.push(centre.x, centre.y, centre.z);
      this.corner.push(cx * cs - cy * sn, cx * sn + cy * cs);
      this.size.push(size);
      this.nrm.push(normal.x, normal.y, normal.z);
      this.uv.push(cx < 0 ? u0 : u1, cy < 0 ? v0 : v1);
      this.col.push(color.r, color.g, color.b);
    }
    this.max = Math.max(this.max, size * 1.42);
  }
  /** A round clump of cards; normals point out from `shadeCentre` for puffy shading. */
  clump(r, centre, radius, n, size, cell, base, shadeCentre, flat = 1) {
    this.clumps.push({ centre: centre.clone(), radius, size, cell, base, shade: (shadeCentre || centre).clone() });
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.cbrt(r()) * radius, e = (r() - 0.4) * Math.PI * 0.8;
      const p = V(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d * flat, Math.sin(a) * Math.cos(e) * d).add(centre);
      const nrm = p.clone().sub(shadeCentre || centre).normalize().add(V(0, 0.35, 0)).normalize();
      const c = base.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.08, (r() - 0.5) * 0.1 + (p.y - centre.y) / radius * 0.05);
      this.add(p, size * (0.8 + r() * 0.4), nrm, cell, c, r() * Math.PI * 2);
    }
  }
  /** Far LOD: two big cards per clump instead of many small ones. */
  lod() {
    const lo = new Cards();
    for (const k of this.clumps) {
      const nrm = k.centre.clone().sub(k.shade).normalize().add(V(0, 0.35, 0)).normalize();
      if (!isFinite(nrm.x)) nrm.set(0, 1, 0);
      lo.add(k.centre, k.radius * 0.8 + k.size * 0.6, nrm, k.cell, k.base, 0.3);
      lo.add(k.centre.clone().add(V(0, k.radius * 0.2, 0)), k.radius * 0.65 + k.size * 0.5, nrm, k.cell, k.base.clone().offsetHSL(0, 0, 0.04), 1.9);
    }
    return lo.geometry();
  }
  geometry() {
    const g = new THREE.BufferGeometry(), n = this.pos.length / 3, idx = [];
    for (let i = 0; i < n; i += 4) idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('corner', new THREE.Float32BufferAttribute(this.corner, 2));
    g.setAttribute('cardSize', new THREE.Float32BufferAttribute(this.size, 1));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.boundingSphere.radius += this.max;       // cards extend past their centres
    return g;
  }
}

function branch(parts, from, dir, len, r0, r1, color, segs = 4, droop = 0) {
  const pts = [], rad = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    pts.push(from.clone().addScaledVector(dir, len * s).add(V(0, -droop * s * s, 0)));
    rad.push(r0 + (r1 - r0) * s);
  }
  parts.push(tube(pts, rad, plain(color), 4));
  return pts[pts.length - 1];
}

// ---------- species ----------
export function coconutPalm(r) {
  const H = 8 + r() * 3.5, lean = 0.6 + r() * 1.8, parts = [];
  const pts = [], rad = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    pts.push(V(lean * s * s + Math.sin(s * 5 + r()) * 0.06, H * s, 0));
    rad.push(0.25 - 0.1 * s + (i === 0 ? 0.08 : 0));
  }
  const bark = C('#bab09c');                      // pale grey-brown, like Bang Saen's old palms
  const barkAt = (c, y) => c.copy(bark).offsetHSL(0, 0, (Math.sin(y * 18) > 0.6 ? -0.06 : 0.02) - y * 0.004);
  parts.push(tube(pts, rad, barkAt, 6));
  const trunkLo = tube(pts.filter((_, i) => i % 4 === 0), rad.filter((_, i) => i % 4 === 0), barkAt, 4);
  const top = pts[pts.length - 1];
  // coconuts
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, g = new THREE.IcosahedronGeometry(0.15, 0);
    g.deleteAttribute('uv');
    g.translate(top.x + Math.cos(a) * 0.28, top.y - 0.3 - r() * 0.2, top.z + Math.sin(a) * 0.28);
    const cc = C(r() < 0.6 ? '#6f7d34' : '#7a5a34'), col = [];
    for (let k = 0; k < g.attributes.position.count; k++) col.push(cc.r, cc.g, cc.b);
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    parts.push(g);
  }
  // fronds: arching ribbons with the comb texture (same fronds for both LODs)
  const n = 13 + Math.floor(r() * 5), specs = [];
  for (let f = 0; f < n; f++) specs.push({ az: (f / n) * Math.PI * 2 + r() * 0.3, rise: 0.35 + r() * 0.75, L: 3.6 + r() * 1.2, shade: (r() - 0.5) * 0.08 });
  return { trunk: mergeGeometries(parts), trunkLo, fronds: palmFronds(top, specs, 7), frondsLo: palmFronds(top, specs.filter((_, i) => i % 2 === 0), 3) };
}

function palmFronds(top, specs, segs) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const [u0, , u1] = cellUV(CELLS.comb);
  for (const { az, rise, L, shade } of specs) {
    const d = V(Math.cos(az), 0, Math.sin(az)), side = V(-d.z, 0, d.x);
    const old = rise < 0.5, base = C(old ? '#8a8a3e' : '#4f8a3a').offsetHSL(0, 0, shade);
    const start = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const s = i / segs, x = s * L;
      const p = top.clone().addScaledVector(d, x).add(V(0, rise * x - 0.32 * x * x * (old ? 1.6 : 1), 0));
      const w = 0.75 * Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.08));
      const tilt = V(0, -0.35 * w, 0);                     // leaflets droop to a V
      for (const sgn of [-1, 1]) {
        const q = p.clone().addScaledVector(side, sgn * w).add(tilt);
        pos.push(q.x, q.y, q.z);
        nrm.push(0, 1, 0);
        uv.push(sgn < 0 ? u0 : u1, s);
        const c = base.clone().offsetHSL(0, 0, s * 0.06);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < segs; i++) { const a = start + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const fronds = new THREE.BufferGeometry();
  fronds.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fronds.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  fronds.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fronds.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  fronds.setIndex(idx);
  fronds.computeVertexNormals();
  return fronds;
}

export function casuarina(r) {
  const H = 10 + r() * 5, parts = [], cards = new Cards();
  const pts = [], rad = [];
  for (let i = 0; i <= 10; i++) { const s = i / 10; pts.push(V((r() - 0.5) * 0.25 * s, H * s, (r() - 0.5) * 0.25 * s)); rad.push(0.26 * (1 - s) + 0.04); }
  parts.push(tube(pts, rad, plain('#5f4d3f'), 6));
  const trunkLo = tube([pts[0], pts[5], pts[10]], [rad[0], rad[5], rad[10]], plain('#5f4d3f'), 4);
  const green = C('#5f7f4a');
  // horizontal layers of needles, like a black pine
  const layers = 7 + Math.floor(r() * 3);
  for (let l = 0; l < layers; l++) {
    const s = 0.32 + (l / layers) * 0.68, y = H * s, reach = (1.2 - s) * 3.4 + 0.6;
    const nb = 2 + Math.floor(r() * 3);
    for (let b = 0; b < nb; b++) {
      const a = r() * Math.PI * 2, dir = V(Math.cos(a), 0.15 + r() * 0.2, Math.sin(a)).normalize();
      const end = branch(parts, V(pts[Math.round(s * 10)].x, y, pts[Math.round(s * 10)].z), dir, reach, 0.08, 0.03, '#5f4d3f', 2, 0.3);
      cards.clump(r, end, 0.9 + reach * 0.25, 7, 0.95, CELLS.needle, green, end.clone().add(V(0, -0.5, 0)), 0.45);
    }
  }
  cards.clump(r, V(pts[10].x, H + 0.3, pts[10].z), 0.9, 6, 0.8, CELLS.needle, green);
  return { trunk: mergeGeometries(parts), trunkLo, cards: cards.geometry(), cardsLo: cards.lod() };
}

export function rainTree(r) {
  const parts = [], cards = new Cards();
  const h0 = 2.5 + r() * 1.2, R = 6 + r() * 2.5, top = 7 + r() * 2.5;
  parts.push(tube([V(0, 0, 0), V(0.1, h0 * 0.5, 0), V(0, h0, 0.1)], [0.55, 0.42, 0.38], plain('#6a5a4a'), 7));
  const trunkLo = tube([V(0, 0, 0), V(0, h0 + 1.5, 0)], [0.5, 0.3], plain('#6a5a4a'), 4);
  const green = C('#62843f'), centre = V(0, top - 1.5, 0);
  const limbs = 4 + Math.floor(r() * 3);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + r() * 0.5, out = R * (0.45 + r() * 0.3);
    const end = V(Math.cos(a) * out, top - 1.2 - r() * 1.5, Math.sin(a) * out);
    parts.push(tube([V(0, h0, 0), V(end.x * 0.4, h0 + (end.y - h0) * 0.7, end.z * 0.4), end], [0.3, 0.2, 0.08], plain('#6a5a4a'), 5));
  }
  // wide umbrella canopy: clumps on a flattened dome
  const nc = 16 + Math.floor(r() * 6);
  for (let i = 0; i < nc; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
    const p = V(Math.cos(a) * d, top - (d / R) ** 2 * 2.2 + (r() - 0.5) * 0.6, Math.sin(a) * d);
    cards.clump(r, p, 1.9, 10, 1.55, CELLS.broad, green, centre, 0.6);
  }
  return { trunk: mergeGeometries(parts), trunkLo, cards: cards.geometry(), cardsLo: cards.lod() };
}

export function frangipani(r) {
  const parts = [], cards = new Cards(), green = C('#7a9a52');
  const grow = (from, dir, len, rad, depth) => {
    const end = branch(parts, from, dir, len, rad, rad * 0.7, '#9a8f84', 3);
    if (depth === 0) { cards.clump(r, end.clone().add(V(0, 0.25, 0)), 0.45, 5, 0.5, CELLS.flower, green, end, 0.5); return; }
    const n = 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      grow(end, V(Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6).normalize(), len * 0.75, rad * 0.7, depth - 1);
    }
  };
  grow(V(0, 0, 0), V(0, 1, 0), 1.1 + r() * 0.4, 0.17, 3);
  return { trunk: mergeGeometries(parts), trunkLo: parts[0], cards: cards.geometry(), cardsLo: cards.lod() };
}

export const SPECIES = { palm: coconutPalm, casuarina, rainTree, frangipani };
