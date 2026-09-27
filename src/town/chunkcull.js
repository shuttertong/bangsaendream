// Distance culling for the static map chunks (kit meshes, beach instancing): chunks far
// behind the haze are hidden, in both the main and the shadow pass. The range grows with
// the camera's height so aerial views still show the whole coast.
import * as THREE from 'three';

export const CULL = { far: 1300, perMetreUp: 12, every: 0.25 };

export function createChunkCuller(groups) {
  const items = [];
  for (const g of groups) for (const m of g.children) {
    if (!m.geometry) continue;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    m.updateMatrixWorld();
    const s = m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld);
    items.push({ m, c: s.center, r: s.radius });
  }
  let t = 0;
  const v = new THREE.Vector3();
  return {
    items,
    update(dt, cam, ground = 0) {
      t -= dt;
      if (t > 0) return;
      t = CULL.every;
      const far = CULL.far + Math.max(0, cam.y - ground - 20) * CULL.perMetreUp;
      for (const it of items) it.m.visible = v.copy(it.c).setY(cam.y).distanceTo(cam) - it.r < far;
    },
  };
}
