// Mini-game registry. Each game module exports start(ctx) → { update, render } and stop().
// Games load on demand; their catch tables are registered as bag items up front.
import { ITEMS } from './shared/items.js';
import { SPECIES as CRABS } from './crab/species.js';
import { SPECIES as SQUID } from './squid/species.js';
import { SNACKS } from './monkey/species.js';
import { FINDS } from './tube/species.js';
import { DISHES } from './stall/menu.js';

export const GAMES = {
  crab: { load: () => import('./crab/index.js') },
  squid: { load: () => import('./squid/index.js') },
  monkey: { load: () => import('./monkey/index.js') },
  tube: { load: () => import('./tube/index.js') },
  stall: { load: () => import('./stall/index.js') },
  banana: { load: () => import('./banana/index.js') },
  sofa: { load: () => import('./sofa/index.js') },
  jetski: { load: () => import('./jetski/index.js') },
};

for (const s of CRABS) ITEMS[`crab_${s.id}`] = { icon: s.icon, name: s.name, price: s.price };
for (const s of SQUID) ITEMS[`squid_${s.id}`] = { icon: s.icon, name: s.name, price: s.price };
for (const s of SNACKS) ITEMS[`monkey_${s.id}`] = { icon: s.icon, name: s.name, price: s.price };
for (const s of FINDS) ITEMS[`tube_${s.id}`] = { icon: s.icon, name: s.name, price: s.price };
// the stall pays in baht; dishes aren't kept in the bag
