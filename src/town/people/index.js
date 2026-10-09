// Spawns the roster at their places, keeps them updated, and finds who the player can
// talk to (close by and roughly in front of the kid).
import { ROSTER } from './roster.js';
import { createNPC } from './npc.js';

export const TALK = { range: 2.8, facing: 0.2, close: 1.2 };

/**
 * How well placed the player (x, z, yaw) is to talk to someone at (x, z): the metres between
 * them, or Infinity when they are out of range or the player is not roughly facing them.
 */
export function reach(p, x, z, range = TALK.range) {
  const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d > range) return Infinity;
  if (d > TALK.close && (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d < TALK.facing) return Infinity;
  return d;
}

export function createPeople(scene, map, places, collision, lift = () => 0) {
  const npcs = [];
  for (const def of ROSTER) {
    const place = places[def.place];
    if (!place) continue;
    const npc = createNPC(scene, def, place, map, lift);
    collision.circle(place.x, place.z, npc.radius, Math.max(map.heightAt(place.x, place.z), collision.deckAt(place.x, place.z)) + 2);   // on a deck (the viewpoint) too
    npcs.push(npc);
  }

  /** NPC the player could talk to right now, or null. */
  function nearest(p) {
    let best = null, bestD = Infinity;
    for (const n of npcs) {
      const d = reach(p, n.state.x, n.state.z);                        // in range, and roughly facing them
      if (d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  return {
    npcs,
    nearest,
    at: placeId => npcs.find(n => n.def.place === placeId) || null,
    update(dt, player) { for (const n of npcs) n.update(dt, player); },
  };
}
