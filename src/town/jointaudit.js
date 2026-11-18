// Do the parts of each thing touch each other? (debug: open the game with ?audit=1, then __game.auditJoints())
// With ?audit=1 the geometry kit reports the box (world AABB) of every part it merges — each box(), rod(), strip() …
// — together with the line of code that added it. Parts whose boxes touch are joined into groups; a group that
// touches neither the ground (or the sea) nor anything else is a part that hangs in the air: a lamp head above its
// arm, a sign face off its post. Instanced things (umbrella sets, power poles, trees) and other meshes in the scene
// are supports others may rest on. Boxes are generous (a slanted rod's box is bigger than the rod), so a gap found
// here is real; a gap hidden inside a generous box is missed.
import * as THREE from 'three';

export const JOINT = {
  touch: 0.012,        // boxes this close count as touching (metres)
  ground: 0.06,        // a group touches the ground when its lowest point is within this of it
  cell: 2,             // spatial hash cell (m)
  big: 60,             // parts with a footprint bigger than this (m²: whole walls, roads, strips) are supports, not group members
  near: 1.0,           // a hanging group is reported with the distance to the nearest other box, up to this
  top: 30,
};

/** Collects boxes while the town is built: pass `record` to Kit.record. */
export function createJointRecorder() {
  const B = [];                                         // minx, miny, minz, maxx, maxy, maxz, tag
  const tags = [], tagIx = new Map();
  const tagOf = () => {
    const lines = (new Error().stack || '').split('\n');
    for (const l of lines) {
      if (!l.includes('/src/') || l.includes('/assets/kit.js') || l.includes('jointaudit.js')) continue;
      const m = l.match(/\/src\/([^?:)]+)(?:\?[^:]*)?:(\d+)/);
      if (m) return `${m[1]}:${m[2]}`;
    }
    return '?';
  };
  return {
    boxes: B, tags,
    record(minx, miny, minz, maxx, maxy, maxz) {
      const t = tagOf();
      let i = tagIx.get(t);
      if (i === undefined) { i = tags.length; tags.push(t); tagIx.set(t, i); }
      B.push(minx, miny, minz, maxx, maxy, maxz, i);
    },
  };
}

/** rec: the recorder; scene: for supports (instanced and other meshes); kitMeshes: Set of the kit-built meshes (left out as supports). */
export function auditJoints({ rec, scene, map, kitMeshes, skip = () => false, terrain = null, surface = null }) {
  const J = JOINT, B = rec.boxes, n = B.length / 7, t0 = performance.now();
  // supports: big kit parts + every instance / mesh that is not kit geometry
  const sup = [];
  for (let i = 0; i < n; i++) {
    const o = i * 7;
    if ((B[o + 3] - B[o]) * (B[o + 5] - B[o + 2]) > J.big) sup.push(B[o], B[o + 1], B[o + 2], B[o + 3], B[o + 4], B[o + 5]);
  }
  const bb = new THREE.Box3(), m = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || kitMeshes.has(o) || skip(o) || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (o.isInstancedMesh) {
      for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, m); bb.copy(o.geometry.boundingBox).applyMatrix4(m.premultiply(o.matrixWorld)); sup.push(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z); }
    } else { bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if ((bb.max.x - bb.min.x) * (bb.max.z - bb.min.z) < 4e5) sup.push(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z); }
  });
  // spatial hash of the small parts
  const C = J.cell, key = (i, j) => i * 73856093 ^ j * 19349663, grid = new Map();
  const small = [];
  for (let i = 0; i < n; i++) {
    const o = i * 7;
    if ((B[o + 3] - B[o]) * (B[o + 5] - B[o + 2]) > J.big) continue;
    small.push(i);
    for (let a = Math.floor(B[o] / C); a <= Math.floor(B[o + 3] / C); a++) for (let b = Math.floor(B[o + 2] / C); b <= Math.floor(B[o + 5] / C); b++) {
      const k = key(a, b); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);
    }
  }
  const T = J.touch, touch = (o, p, arr = B, s = 7) => !(arr[p * s] > B[o + 3] + T || arr[p * s + 3] < B[o] - T || arr[p * s + 1] > B[o + 4] + T || arr[p * s + 4] < B[o + 1] - T || arr[p * s + 2] > B[o + 5] + T || arr[p * s + 5] < B[o + 2] - T);
  // union-find over touching small parts
  const parent = new Int32Array(n).fill(-1), find = x => { while (parent[x] >= 0 && parent[parent[x]] >= 0) x = parent[x] = parent[parent[x]]; return parent[x] >= 0 ? parent[x] : x; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (const i of small) {
    const o = i * 7;
    for (let a = Math.floor(B[o] / C); a <= Math.floor(B[o + 3] / C); a++) for (let b = Math.floor(B[o + 2] / C); b <= Math.floor(B[o + 5] / C); b++) {
      for (const j of grid.get(key(a, b))) if (j > i && touch(o, j)) unite(i, j);
    }
  }
  // support hash
  const sgrid = new Map(), S = sup.length / 6;
  for (let p = 0; p < S; p++) {
    const q = p * 6;
    if ((sup[q + 3] - sup[q]) / C * (sup[q + 5] - sup[q + 2]) / C > 4e4) continue;   // (the whole-map things: never a reason)
    for (let a = Math.floor(sup[q] / C); a <= Math.floor(sup[q + 3] / C); a++) for (let b = Math.floor(sup[q + 2] / C); b <= Math.floor(sup[q + 5] / C); b++) {
      const k = key(a, b); let l = sgrid.get(k); if (!l) sgrid.set(k, l = []); l.push(p);
    }
  }
  // per group: grounded? supported? its lowest gap and its nearest neighbour
  const groups = new Map();
  for (const i of small) { const r = find(i); let g = groups.get(r); if (!g) groups.set(r, g = { parts: [], ok: false }); g.parts.push(i); }
  const groundUnder = o => { let g = Infinity; for (const [x, z] of [[B[o], B[o + 2]], [B[o + 3], B[o + 2]], [B[o], B[o + 5]], [B[o + 3], B[o + 5]], [(B[o] + B[o + 3]) / 2, (B[o + 2] + B[o + 5]) / 2]]) g = Math.min(g, map.heightAt(x, z), map.groundAt ? map.groundAt(x, z) : Infinity); return Math.max(g, map.sea); };   // (over the water: its surface — a pier post going into it is fine)
  const found = [], ray = new THREE.Raycaster(), down = new THREE.Vector3(), dirDown = new THREE.Vector3(0, -1, 0);
  for (const g of groups.values()) {
    let low = Infinity, lx = 0, lz = 0;
    for (const i of g.parts) {
      const o = i * 7, gap = B[o + 1] - groundUnder(o);
      if (gap < low) { low = gap; lx = (B[o] + B[o + 3]) / 2; lz = (B[o + 2] + B[o + 5]) / 2; }
      if (gap <= J.ground) { g.ok = true; break; }
      for (let a = Math.floor(B[o] / C); a <= Math.floor(B[o + 3] / C) && !g.ok; a++) for (let b = Math.floor(B[o + 2] / C); b <= Math.floor(B[o + 5] / C) && !g.ok; b++) {
        for (const p of sgrid.get(key(a, b)) || []) if (touch(o, p, sup, 6)) { g.ok = true; break; }
      }
      if (g.ok) break;
    }
    if (!g.ok && terrain) {                                          // the ground as drawn (corridor patches beside roads), not the grid: cast straight down
      ray.set(down.set(lx, 1e4, lz), dirDown);
      const hit = ray.intersectObjects(terrain.children, false)[0];
      let lowY = Infinity; for (const i of g.parts) lowY = Math.min(lowY, B[i * 7 + 1]);
      if (hit) { low = lowY - Math.max(hit.point.y, map.sea); if (low <= J.ground) g.ok = true; }
      if (!g.ok && surface) { const s = lowY - surface(lx, lz); if (s <= J.ground && s > -1) g.ok = true; else low = Math.min(low, Math.max(0, s)); }   // resting on a road, a pavement or a deck
    }
    if (g.ok) continue;
    // how far to the nearest other box (small part of another group, or a support): the size of the gap
    let near = Infinity;
    for (const i of g.parts) {
      const o = i * 7, d3 = (arr, p, s) => Math.hypot(Math.max(0, arr[p * s] - B[o + 3], B[o] - arr[p * s + 3]), Math.max(0, arr[p * s + 1] - B[o + 4], B[o + 1] - arr[p * s + 4]), Math.max(0, arr[p * s + 2] - B[o + 5], B[o + 2] - arr[p * s + 5]));
      for (let a = Math.floor((B[o] - J.near) / C); a <= Math.floor((B[o + 3] + J.near) / C); a++) for (let b = Math.floor((B[o + 2] - J.near) / C); b <= Math.floor((B[o + 5] + J.near) / C); b++) {
        for (const j of grid.get(key(a, b)) || []) if (find(j) !== find(i)) near = Math.min(near, d3(B, j, 7));
        for (const p of sgrid.get(key(a, b)) || []) near = Math.min(near, d3(sup, p, 6));
      }
    }
    const tagCount = new Map();
    for (const i of g.parts) { const t = rec.tags[B[i * 7 + 6]]; tagCount.set(t, (tagCount.get(t) || 0) + 1); }
    found.push({ x: +lx.toFixed(1), z: +lz.toFixed(1), parts: g.parts.length, gap: +low.toFixed(3), near: near === Infinity ? null : +near.toFixed(3), tags: [...tagCount.keys()].slice(0, 3).join(' ') });
  }
  // by the code that made them
  const byTag = new Map();
  for (const f of found) { const t = f.tags.split(' ')[0]; let e = byTag.get(t); if (!e) byTag.set(t, e = { tag: t, n: 0, small: 0, ex: [] }); e.n++; if (f.near !== null && f.near < 0.25) e.small++; if (e.ex.length < 3) e.ex.push([f.x, f.z, f.gap, f.near]); }
  return {
    parts: n, supports: S, groups: groups.size, hanging: found.length, smallGaps: found.filter(f => f.near !== null && f.near < 0.25).length,
    secs: +((performance.now() - t0) / 1000).toFixed(1),
    byTag: [...byTag.values()].sort((a, b) => b.n - a.n).slice(0, J.top),
    all: found,
  };
}
