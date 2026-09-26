// Snacks on the picnic mat. Each is 'mat' → 'carried' (by a monkey) → 'ground' (dropped
// when the monkey is shooed; walk over it to put it back) or 'lost' (taken into the trees).
import * as THREE from 'three';
import { SNACKS, ROUND } from './species.js';
import { snackGeometry } from './models.js';

export function createSnacks(scene, material) {
  const items = [];
  const slots = [];
  const n = SNACKS.reduce((s, x) => s + x.count, 0), cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const cx = (i % cols) - (cols - 1) / 2, cz = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
    slots.push({ x: cx * ROUND.mat * 0.6, z: cz * ROUND.mat * 0.6 });
  }
  let k = 0;
  for (const sp of SNACKS) for (let i = 0; i < sp.count; i++) {
    const mesh = new THREE.Mesh(snackGeometry(sp), material);
    mesh.castShadow = true;
    const slot = slots[k++];
    mesh.position.set(slot.x, 0.03, slot.z);
    mesh.rotation.y = k * 1.7;
    scene.add(mesh);
    items.push({ sp, mesh, slot, state: 'mat', x: slot.x, z: slot.z });
  }

  const place = (it, x, y, z) => { it.x = x; it.z = z; it.mesh.position.set(x, y, z); };

  return {
    items,
    nearestOnMat(x, z) {
      let best = null, bd = Infinity;
      for (const it of items) if (it.state === 'mat') { const d = Math.hypot(it.x - x, it.z - z); if (d < bd) { bd = d; best = it; } }
      return best;
    },
    take(it) { it.state = 'carried'; return it; },
    carry(it, x, z, t) { place(it, x, 0.9 + Math.sin(t * 12) * 0.03, z); it.mesh.rotation.z = Math.sin(t * 9) * 0.3; },
    drop(it, x, z) { it.state = 'ground'; place(it, x, 0.03, z); it.mesh.rotation.z = 1.2; },
    lose(it) { it.state = 'lost'; scene.remove(it.mesh); },
    /** The kid walking over dropped snacks puts them back on the mat. Returns how many. */
    pickup(kx, kz) {
      let n2 = 0;
      for (const it of items) if (it.state === 'ground' && Math.hypot(it.x - kx, it.z - kz) < 0.9) {
        it.state = 'mat'; place(it, it.slot.x, 0.03, it.slot.z); it.mesh.rotation.z = 0; n2++;
      }
      return n2;
    },
    count: state => items.filter(it => it.state === state).length,
    dispose: () => items.forEach(it => scene.remove(it.mesh)),
  };
}
