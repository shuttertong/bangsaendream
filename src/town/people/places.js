// Named places in the hub (NPC spots and travel destinations). Anchors are resolved at
// load time into a free, walkable spot: near a map coordinate (optionally at a given
// distance from the sea), or next to something the town generator placed.

export const PLACES = {
  grandma:   { name: { th: 'บ้านยาย', en: "Grandma's house" }, icon: 'home', anchor: 'grandma' },
  beach:     { name: { th: 'หาดบางแสน', en: 'Bang Saen Beach' }, icon: 'beach', anchor: { near: 'start', sea: 16 } },
  rental:    { name: { th: 'ร้านเช่าห่วงยาง', en: 'Inner-tube rental' }, icon: 'tube', anchor: 'rental' },
  shop:      { name: { th: 'ร้านส้มตำป้านวล', en: "Aunt Nuan's som tam" }, icon: 'food', anchor: 'shop' },
  crabBeach: { name: { th: 'หาดปูลม', en: 'Ghost-crab beach' }, icon: 'crab', anchor: { near: [-560, 20], sea: 9 } },
  laemThaen: { name: { th: 'แหลมแท่น', en: 'Laem Thaen' }, icon: 'boat', anchor: { near: [-1330, -745], sea: 12 } },
  viewpoint: { name: { th: 'จุดชมวิวเขาสามมุข', en: 'Khao Sam Muk viewpoint' }, icon: 'hill', anchor: { near: [-655, -1942] } },
};

/** Nearest walkable spot to (x, z), optionally about `sea` metres from the water. */
function freeSpot(x, z, { collision, seaDist }, sea) {
  for (let r = 0; r <= 80; r += 1.5) {
    const n = Math.max(1, Math.round((2 * Math.PI * r) / 1.5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (sea !== undefined && Math.abs(seaDist(px, pz) - sea) > 2.5) continue;
      if (collision.free(px, pz, 0.6) && collision.free(px, pz, 1.8)) return [px, pz];
    }
  }
  return [x, z];
}

/** Yaw that faces downhill toward the sea (seaDist gradient). */
function faceSea(x, z, seaDist) {
  const gx = seaDist(x + 2, z) - seaDist(x - 2, z), gz = seaDist(x, z + 2) - seaDist(x, z - 2);
  return Math.atan2(-gx, -gz);
}

/**
 * ctx: { map, collision, seaDist, start: {x, z}, grandma: {x, z, yaw}, rentals: [{x, z, yaw}], shops: [rows] }
 * Returns { id: { id, name, icon, x, z, yaw } }.
 */
export function resolvePlaces(ctx) {
  const out = {};
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  const nearest = (list, p) => list.reduce((best, q) => (!best || dist2(q, p) < dist2(best, p) ? q : best), null);
  for (const [id, def] of Object.entries(PLACES)) {
    let x, z, yaw;
    const a = def.anchor;
    if (a === 'grandma' && ctx.grandma) {
      ({ x, z, yaw } = ctx.grandma);
    } else if (a === 'rental' && ctx.rentals.length) {
      const s = nearest(ctx.rentals, ctx.start);
      [x, z] = freeSpot(s.x + Math.sin(s.yaw) * 1.6, s.z + Math.cos(s.yaw) * 1.6, ctx);
      yaw = s.yaw;
    } else if (a === 'shop' && ctx.shops.length) {
      const row = nearest(ctx.shops, ctx.start);
      const fx = Math.sin(row.ry), fz = Math.cos(row.ry);
      [x, z] = freeSpot(row.x + fx * (row.D / 2 + 1.5), row.z + fz * (row.D / 2 + 1.5), ctx);
      yaw = row.ry;
    } else {
      const near = a.near === 'start' ? [ctx.start.x, ctx.start.z] : a.near;
      [x, z] = freeSpot(near[0], near[1], ctx, a.sea);
      yaw = faceSea(x, z, ctx.seaDist);
    }
    out[id] = { id, name: def.name, icon: def.icon, x, z, yaw };
  }
  return out;
}
