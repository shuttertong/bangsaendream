// Spawns the roster at their places, keeps them updated, and finds who the player can
// talk to (close by and roughly in front of the kid).
import { ROSTER } from './roster.js';
import { createNPC } from './npc.js';

const TALK = { range: 2.8, facing: 0.2 };

export function createPeople(scene, map, places, collision) {
  const npcs = [];
  for (const def of ROSTER) {
    const place = places[def.place];
    if (!place) continue;
    const npc = createNPC(scene, def, place, map);
    collision.circle(place.x, place.z, npc.radius, map.heightAt(place.x, place.z) + 2);
    npcs.push(npc);
  }

  /** NPC the player could talk to right now, or null. */
  function nearest(p) {
    let best = null, bestD = TALK.range;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (const n of npcs) {
      const dx = n.state.x - p.x, dz = n.state.z - p.z, d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      if (d > 1.2 && (dx * fx + dz * fz) / d < TALK.facing) continue;   // must roughly face them
      best = n; bestD = d;
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
