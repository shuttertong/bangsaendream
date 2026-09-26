// Mini-game registry. Each game module exports start(ctx) → { update, render } and stop().
// Games load on demand; their catch tables are registered as bag items up front.
import { ITEMS } from './shared/items.js';
import { SPECIES as CRABS } from './crab/species.js';
import { SPECIES as SQUID } from './squid/species.js';

export const GAMES = {
  crab: { load: () => import('./crab/index.js') },
  squid: { load: () => import('./squid/index.js') },
  // monkey, tube, stall: M5
};

for (const s of CRABS) ITEMS[`crab_${s.id}`] = { icon: s.icon, name: s.name, price: s.price };
for (const s of SQUID) ITEMS[`squid_${s.id}`] = { icon: s.icon, name: s.name, price: s.price };
