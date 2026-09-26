// Dressing for the beach promenade (the brick walk roads.js lays on the sea side of the
// beach road): coconut palms planted in rows along both edges, and food / toy stalls under
// blue-and-white umbrellas along the sand side, like the real Bang Saen beachfront.
// Stalls go into the static kit (no extra draw calls); palms are handed to nature.js so
// they're instanced with the other trees.
import * as THREE from 'three';
import { rng, walkLine } from './layout.js';
import { PROMENADE } from './roads.js';
import * as PROPS from './assets/props.js';

export const DRESS = {
  palms: { sea: { every: 7, off: 0.9 }, road: { every: 9, off: 0.8 }, scale: [1.15, 1.5], skip: 0.1 },
  stalls: { spacing: 3.3, run: [4, 11], gap: [8, 22], off: 1.5 },
  cart: ['#2f6fc4', '#d8443a', '#f4f1e8', '#3a9a6a', '#f0c23a'],
  goods: ['#e8543a', '#f0c23a', '#4fb3a8', '#f4f1e8', '#e8958a', '#7fc4e8', '#9a5a8a'],
  stool: ['#d8443a', '#2f6fc4', '#3a9a6a'],
};

export function dressPromenades(kit, map, layout, promenades) {
  const { occ, roadIdx } = layout;
  const r = rng(3131), palms = [], stalls = [];
  const canopy = PROPS.umbrellaCanopy();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), tmp = new THREE.Color();
  const addBaked = (geo, x, y, z, ry) => {
    const c = geo.attributes.color;
    let i = 0;
    kit.add('wall', geo, m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, ry), one), () => tmp.fromBufferAttribute(c, i++));
  };

  for (const { side, F, hw, flush } of promenades) {
    const lift = flush ? 0.06 : PROMENADE.lift;
    const line = F.pts;
    // keep everything else off the promenade
    for (let i = 0; i < line.length; i++) {
      const t = side * (hw + PROMENADE.w / 2);
      occ.mark(line[i][0] + F.nrm[i][0] * t, line[i][1] + F.nrm[i][1] * t, PROMENADE.w / 2 - 0.8, PROMENADE.w / 2 - 0.8);
    }
    // palm rows on both edges of the walk
    for (const [row, off] of [['sea', PROMENADE.w - DRESS.palms.sea.off], ['road', DRESS.palms.road.off]]) {
      walkLine(line, DRESS.palms[row].every, (x, z, dx, dz) => {
        if (r() < DRESS.palms.skip) return;
        const nx = -dz * side, nz = dx * side, t = hw + off, j = (r() - 0.5) * 1.2;
        const px = x + nx * t + dx * j, pz = z + nz * t + dz * j;
        if (!flush && roadIdx.clearance(px, pz, 6) < 0.5) return;  // not on a side street
        palms.push({ x: px, z: pz, y: map.heightAt(px, pz) + lift - 0.1, rot: r() * Math.PI * 2, s: THREE.MathUtils.lerp(...DRESS.palms.scale, r()) });
      }, r() * 4);
    }
    // stalls along the sand side, in runs with gaps (facing the walk)
    const S = DRESS.stalls;
    let left = 0, gap = r.range(...S.gap) / 2, color = null, withTables = false;
    walkLine(line, S.spacing, (x, z, dx, dz) => {
      if (gap > 0) { gap -= S.spacing; return; }
      if (!left) { left = Math.round(r.range(...S.run)); color = r.pick(DRESS.cart); withTables = r() < 0.5; }
      const nx = -dz * side, nz = dx * side, t = hw + PROMENADE.w + S.off;
      const px = x + nx * t, pz = z + nz * t, y = map.heightAt(px, pz);
      if (y < map.sea + 0.3 || roadIdx.clearance(px, pz, 6) < 1 || occ.test(px, pz, 0.9, 0.9)) { left = 0; gap = r.range(...S.gap); return; }
      const ry = Math.atan2(-nx, -nz);                            // front of the cart faces the walk
      stall(kit, r, { x: px, y, z: pz, ry, color, tables: withTables && r() < 0.7 });
      addBaked(canopy, px - nx * 0.2, y + 0.15, pz - nz * 0.2, r() * Math.PI);
      occ.mark(px, pz, 1.6, 1.6);
      stalls.push({ x: px, z: pz, ry });
      if (--left <= 0) { left = 0; gap = r.range(...S.gap); }
    });
  }
  return { palms, stalls };
}

/** A beach stall: cart with goods on top, a stool for the seller, maybe a plastic table set behind. */
function stall(kit, r, { x, y, z, ry, color, tables }) {
  const f = kit.frame(x, y, z, ry), col = h => new THREE.Color(h);
  f.box('wall', 0, 0.45, 0, 1.5, 0.7, 0.75, col(color));                          // cart body
  f.box('wall', 0, 0.83, 0, 1.6, 0.06, 0.85, col('#eceae4'));                      // counter
  f.box('wall', 0, 0.45, 0.39, 1.4, 0.5, 0.02, col('#c9cdd0'));                    // steel front
  for (const u of [-0.6, 0.6]) f.box('wall', u, 0.12, 0.2, 0.1, 0.24, 0.24, col('#2a2a2a'));   // wheels
  for (let i = 0; i < 5; i++) {                                                     // goods: snacks, drinks, toys
    const u = -0.6 + i * 0.3, h = 0.08 + r() * 0.2;
    f.box('wall', u, 0.86 + h / 2, (r() - 0.5) * 0.4, 0.22, h, 0.22, col(r.pick(DRESS.goods)));
  }
  f.box('wall', 0.9, 0.2, -0.7, 0.32, 0.4, 0.32, col(r.pick(DRESS.stool)));         // seller's stool
  f.rod('wall', [0, 0, -0.2], [0, 2.3, -0.2], 0.025, col('#d9d4c8'));             // umbrella pole
  if (!tables) return;
  const tc = r.pick(DRESS.stool);
  f.box('wall', 0.2, 0.7, -1.9, 0.75, 0.04, 0.75, col('#f4f2ec'));                 // plastic table behind, on the sand
  for (const [u, w] of [[-0.2, -1.55], [0.6, -1.55], [-0.2, -2.25], [0.6, -2.25]]) f.box('wall', u, 0.35, w, 0.04, 0.7, 0.04, col('#f4f2ec'));
  for (const [u, w] of [[0.2, -1.2], [0.2, -2.6], [-0.45, -1.9], [0.85, -1.9]]) f.box('wall', u, 0.22, w, 0.3, 0.44, 0.3, col(tc));
}
