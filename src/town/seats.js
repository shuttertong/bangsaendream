// Sitting down on the beach. Deck chairs under the umbrellas belong to the vendors: renting
// one costs ฿5 and it stays yours (sit, stand, sit again for free) until you rent another.
// The concrete public benches are free. F / the prompt button sits and stands; pushing the
// joystick also stands you up.
import * as P from '../shared/progress.js';
import { t } from '../shared/i18n.js';

export const SEATS = {
  rent: 5,          // ฿ per deck chair
  reach: 1.2,       // metres from the seat to get the prompt
  standOff: 1.0,    // metres in front of the seat when you get up
  cell: 8,          // lookup grid
};

export function createSeats({ list, player, collision, toast }) {
  const grid = new Map(), key = (i, j) => `${i},${j}`;
  for (const s of list) {
    const k = key(Math.floor(s.x / SEATS.cell), Math.floor(s.z / SEATS.cell));
    (grid.get(k) || grid.set(k, []).get(k)).push(s);
  }
  let seated = null, rented = null, benchTold = false;

  function nearest(p) {
    const i0 = Math.floor(p.x / SEATS.cell), j0 = Math.floor(p.z / SEATS.cell);
    let best = null, bd = SEATS.reach;
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      for (const s of grid.get(key(i, j)) || []) {
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best;
  }

  /** Prompt for a seat: [i18n key, vars]. */
  const prompt = s => s.kind === 'bench' ? ['sitBench'] : s === rented ? ['sitRented'] : ['sitRent', { n: SEATS.rent }];

  function sit(s) {
    if (s.kind === 'chair' && s !== rented) {
      if (P.get().baht < SEATS.rent) { toast(t('chairNoMoney', { n: SEATS.rent }), 'click'); return false; }
      P.addBaht(-SEATS.rent);
      rented = s;
      toast(t('chairPaid', { n: SEATS.rent }), 'coin');
    } else if (s.kind === 'bench' && !benchTold) { benchTold = true; toast(t('benchFree'), 'click'); }
    seated = s;
    return true;
  }

  function stand() {
    const s = seated;
    if (!s) return;
    seated = null;
    // step out in front of the seat (toward the sea), or to either side if that's blocked
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    const spots = [[fx, fz], [rx, rz], [-rx, -rz], [-fx, -fz]].map(([dx, dz]) => [s.x + dx * SEATS.standOff, s.z + dz * SEATS.standOff]);
    const [x, z] = spots.find(([x, z]) => collision.free(x, z, 0.3)) || spots[0];
    player.place(x, z, s.yaw);
  }

  /** Keep the kid posed on the seat (call every frame while seated). */
  function update() {
    if (seated) player.sit(seated, seated.yaw, seated.kind === 'chair' ? 'lounge' : 'bench');
  }

  return {
    list, nearest, prompt, sit, stand, update,
    /** Travelling away: forget the seat without placing the kid. */
    leave() { seated = null; },
    get seated() { return seated; },
    get rented() { return rented; },
  };
}
