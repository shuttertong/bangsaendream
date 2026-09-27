// Collision grid (0.5 m cells, each storing the top height of what's there) for the
// player and camera: building footprints, tree trunks, poles. Plus the walkable-area
// rule: stay within the coastal strip and out of water deeper than wading depth.
import { inPoly } from './layout.js';

const CELL = 0.5;
const key = (i, j) => i * 100003 + j;

export class Collision {
  constructor(map, seaDist) {
    this.map = map;
    this.seaDist = seaDist;
    this.h = new Map();
    this.decks = new Map();                    // walkable platforms over water (piers): cell → surface height
    this.walkZones = [];                       // [{x, z, r}]: walkable even beyond the coastal strip (e.g. the whole roundabout)
    this.limit = (map.inland || 100) + 4;     // metres from the sea the player may walk
    this.strip = null;                         // layout.strip: metres outside the strip + corridors (≤ 0 inside)
    this.wade = 1.1;                           // max water depth (scene units)
  }

  _set(i, j, top) { const k = key(i, j); if ((this.h.get(k) ?? -Infinity) < top) this.h.set(k, top); }

  /** Oriented rectangle centred at (x, z), size w×d, yaw ry, solid up to `top`. */
  rect(x, z, w, d, ry, top) {
    const c = Math.cos(ry), s = Math.sin(ry), r = Math.hypot(w, d) / 2;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const px = (i + 0.5) * CELL - x, pz = (j + 0.5) * CELL - z;
        const u = px * c - pz * s, v = px * s + pz * c;      // into the rect's frame
        if (Math.abs(u) <= w / 2 && Math.abs(v) <= d / 2) this._set(i, j, top);
      }
    }
  }

  poly(p, top) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        if (inPoly((i + 0.5) * CELL, (j + 0.5) * CELL, p)) this._set(i, j, top);
      }
    }
  }

  circle(x, z, r, top) {
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        if (Math.hypot((i + 0.5) * CELL - x, (j + 0.5) * CELL - z) <= r + CELL * 0.5) this._set(i, j, top);
      }
    }
  }

  /** Walkable deck (pier, plaza) — an oriented rectangle w×d at height `top`; lets you over deep water. */
  deck(x, z, w, d, ry, top) {
    const c = Math.cos(ry), s = Math.sin(ry), r = Math.hypot(w, d) / 2;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const px = (i + 0.5) * CELL - x, pz = (j + 0.5) * CELL - z;
        const u = px * c - pz * s, v = px * s + pz * c;
        const k = key(i, j);
        if (Math.abs(u) <= w / 2 && Math.abs(v) <= d / 2 && (this.decks.get(k) ?? -Infinity) < top) this.decks.set(k, top);
      }
    }
  }

  /** Deck surface height at (x, z), or -Infinity. */
  deckAt(x, z) { return this.decks.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? -Infinity; }

  /** Top height of solid stuff at (x, z), or -Infinity. */
  topAt(x, z) { return this.h.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? -Infinity; }

  /** Inside the playable area (coastal strip, open corridors, walk zones)? Ignores water and solids. */
  inArea(x, z) {
    return (this.strip ? this.strip(x, z) <= 4 : this.seaDist(x, z) <= this.limit) || this.walkZones.some(w => (x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r);
  }

  /** Can a body of radius r stand at (x, z) with feet at height y? */
  free(x, z, r = 0.3, y = -Infinity) {
    const m = this.map;
    const onDeck = this.deckAt(x, z) > -Infinity;
    if (!onDeck && !this.inArea(x, z)) return false;
    if (!onDeck && m.sea - m.heightAt(x, z) > this.wade) return false;
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) {
      if (this.topAt(x + dx, z + dz) > y + 0.35) return false;          // allow stepping onto low things
    }
    return true;
  }
}

/** Fill the grid from everything the town placed. */
/** extra: { solids: [{x, z, r, top}], decks: [{x, z, w, d, ry, top}] } from landmarks and places. */
export function buildCollision(map, seaDist, { buildings, nature, poles, solids = [], decks = [], strip = null }) {
  const col = new Collision(map, seaDist);
  col.strip = strip;
  for (const d of decks) col.deck(d.x, d.z, d.w, d.d, d.ry, d.top);
  for (const s of solids) col.circle(s.x, s.z, s.r, s.top);
  const FLOOR = 3.2;
  for (const b of map.buildings) {
    let base = Infinity;
    for (const [x, z] of b.p) base = Math.min(base, map.heightAt(x, z));
    col.poly(b.p, base + (b.h || b.lv * FLOOR) + 2);
  }
  for (const r of buildings.rows) {
    const y = map.heightAt(r.x, r.z);
    col.rect(r.x, r.z, r.n * 4 - 0.1, r.D, r.ry, y + (r.top || 14));
  }
  const trunk = { rainTree: 0.55, casuarina: 0.3, palm: 0.3, frangipani: 0.2 };
  for (const [sp, list] of Object.entries(nature.placed)) {
    for (const t of list) col.circle(t.x, t.z, trunk[sp] * t.s, t.y + 6);
  }
  for (const p of poles) { const e = p.m.elements; col.circle(e[12], e[14], 0.2, e[13] + 9); }
  return col;
}
