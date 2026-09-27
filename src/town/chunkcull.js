// Distance culling for the static map chunks (kit meshes, beach instancing): chunks far
// behind the haze are hidden, in both the main and the shadow pass (and small-detail materials
// when the camera is very high, e.g. the drone overview). The range grows with
// the camera's height so aerial views still show the whole coast.
import * as THREE from 'three';

// detail: materials too small to see from high up (drone overview) — hidden above `detailUp` m
export const CULL = { far: 1300, perMetreUp: 12, every: 0.25, detail: ['metal', 'glass', 'lit'], detailUp: 1200 };

export function createChunkCuller(groups) {
  const items = [];
  for (const g of groups) for (const m of g.children) {
    if (!m.geometry) continue;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    m.updateMatrixWorld();
    const s = m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld);
    items.push({ m, c: s.center, r: s.radius, detail: CULL.detail.includes(m.material?.name) });
  }
  let t = 0;
  const v = new THREE.Vector3();
  return {
    items,
    update(dt, cam, ground = 0) {
      t -= dt;
      if (t > 0) return;
      t = CULL.every;
      const up = cam.y - ground, far = CULL.far + Math.max(0, up - 20) * CULL.perMetreUp, high = up > CULL.detailUp;
      for (const it of items) it.m.visible = !(high && it.detail) && v.copy(it.c).setY(cam.y).distanceTo(cam) - it.r < far;
    },
  };
}
