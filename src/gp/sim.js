// The kart race with nothing to draw (no three.js): karts on the track, arcade steering with a grip
// limit, the road's edges as walls, kart-to-kart bumps, bots that follow the road and brake for
// corners, laps and places. index.js shows it; tools/test_gp.mjs runs whole races for balance.
// Kinds of kart: 'human' (driven by step()'s inputs), 'bot' (driven here), 'ghost' (another player's
// or the leader's bot in multiplayer: moved by setGhost(), it only pushes ours aside).
import { GP } from './rules.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

/** entries: [{ id, kind, skill? }] in grid order. rand: () => 0..1. */
export function createRace(track, entries, rand = Math.random, R = GP) {
  const K = R.kart, B = R.bot, goal = R.laps * track.length;
  const karts = entries.map((e, slot) => {
    const row = Math.floor(slot / 2), s0 = -R.start.back - row * R.start.row, c = track.at(s0), d = (slot % 2 ? -1 : 1) * R.start.side;
    return {
      id: e.id, kind: e.kind, slot, skill: e.skill ?? 1,
      x: c.x + c.tz * d, z: c.z - c.tx * d, h: Math.atan2(c.tx, c.tz), v: 0, i: c.i, d, prog: s0, fin: null, hits: 0, bump: 0,
      lane: d, laneT: 0, steer: 0,
    };
  });
  const state = { time: 0, karts, goal };

  function drive(k, steer, gas, brake, dt, top) {
    k.steer += (steer - k.steer) * Math.min(1, dt * 10);
    k.v += (gas * K.accel * (1 - k.v / top) - brake * K.brake - K.drag * k.v) * dt;
    k.v = clamp(k.v, 0, top);
    const yaw = k.steer * Math.min(K.turn, K.grip / Math.max(k.v, 4));          // the grip caps how hard a fast kart can turn
    k.h += yaw * dt;
    k.v -= Math.abs(yaw) * k.v * K.scrub * dt;
    k.x += Math.sin(k.h) * k.v * dt; k.z += Math.cos(k.h) * k.v * dt;
  }
  /** After moving: where on the track, the walls, progress round the lap. */
  function settle(k) {
    const p = track.project(k.x, k.z, k.i);
    let di = p.i - k.i;
    if (di > track.n / 2) di -= track.n; else if (di < -track.n / 2) di += track.n;
    k.prog += di * track.step; k.i = p.i; k.d = p.d;
    const half = track.half[k.i] || R.track.half;
    if (Math.abs(k.d) > half) {                                                  // the road's edge: slide along it
      const over = Math.abs(k.d) - half, sgn = Math.sign(k.d), nx = track.tz[k.i], nz = -track.tx[k.i];
      k.x -= nx * over * sgn; k.z -= nz * over * sgn; k.d = half * sgn;
      const th = Math.atan2(track.tx[k.i], track.tz[k.i]), off = angle(k.h - th);
      k.h = th + clamp(off, -0.5, 0.5) * 0.5;
      if (k.bump <= 0 && k.v > 5) { k.hits++; k.bump = 0.6; k.v *= K.wall; }
    }
    if (k.fin == null && k.prog >= goal) k.fin = state.time;
  }
  function botInput(k, lead) {
    const ahead = B.look[0] + B.look[1] * k.v, t = track.at(k.prog + ahead), nx = t.tz, nz = -t.tx;
    k.laneT -= 1 / 60;
    if (k.laneT <= 0) { k.laneT = 2 + rand() * 4; k.want = (rand() * 2 - 1) * B.lane; }
    let passing = false;
    for (const o of karts) {                                                     // someone slower just ahead: pull out to pass
      if (o === k) continue;
      const gap = o.prog - k.prog;
      if (gap > 0 && gap < 12 && Math.abs(o.d - k.d) < 1.5 && o.v < k.v + 1.5) { const room = (track.half[k.i] || R.track.half) - 0.6; k.want = clamp(o.d + (o.d > 0 ? -2.1 : 2.1), -room, room); passing = true; }
    }
    k.lane += ((k.want ?? k.lane) - k.lane) * (passing ? 0.08 : 0.03);
    let kmax = 0;                                                                // the tightest bend in the road ahead
    for (let m = 0; m < B.corner; m += track.step * 2) kmax = Math.max(kmax, Math.abs(track.k[track.wrap(k.i + Math.round(m / track.step))]));
    const off = k.lane * (passing ? 1 : clamp(1 - kmax * 14, 0.15, 1));   // keep to the middle through bends (unless passing)
    const tx = t.x + nx * off, tz = t.z + nz * off, steer = clamp(angle(Math.atan2(tx - k.x, tz - k.z) - k.h) * B.steer, -1, 1);
    let band = 1;
    if (lead != null) { const gap = k.prog - lead; band = gap > B.band[0] ? 1 - B.band[1] : gap < -B.band[0] ? 1 + B.band[1] : 1; }
    const top = K.top * k.skill * band, want = Math.min(top, Math.sqrt(K.grip * 0.8 * k.skill / Math.max(kmax, 1e-4)));
    return { steer, gas: k.v < want ? 1 : 0, brake: k.v > want + 1.5 ? 1 : 0, top };
  }

  /** inputs: { [id]: { steer −1..1, gas 0..1, brake 0..1 } } for the human karts. */
  function step(dt, inputs = {}) {
    state.time += dt;
    const me = karts.find(k => k.kind === 'human');
    for (const k of karts) {
      k.bump = Math.max(0, k.bump - dt);
      if (k.kind === 'ghost') continue;
      if (k.fin != null) { drive(k, clamp(angle(Math.atan2(track.tx[k.i], track.tz[k.i]) - k.h) * 2, -1, 1), 0, 0.25, dt, K.top); settle(k); continue; }   // roll on past the flag
      if (k.kind === 'human') { const a = inputs[k.id] || {}; drive(k, clamp(a.steer || 0, -1, 1), a.gas ?? 1, a.brake || 0, dt, K.top); }
      else { const a = botInput(k, me ? me.prog : null); drive(k, a.steer, a.gas, a.brake, dt, a.top); }
      settle(k);
    }
    for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {   // bumping: push apart (a ghost does not move)
      const p = karts[a], q = karts[b], dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz), min = K.radius * 2;
      if (dist >= min || dist < 1e-3) continue;
      const push = (min - dist) * K.shove, ux = dx / dist, uz = dz / dist, wp = p.kind === 'ghost' ? 0 : q.kind === 'ghost' ? 1 : 0.5;
      p.x -= ux * push * 2 * wp; p.z -= uz * push * 2 * wp; q.x += ux * push * 2 * (1 - wp) * (q.kind === 'ghost' ? 0 : 1); q.z += uz * push * 2 * (1 - wp) * (q.kind === 'ghost' ? 0 : 1);
      const slow = p.prog < q.prog ? p : q;
      if (slow.kind !== 'ghost' && Math.abs(p.d - q.d) < 0.8) slow.v *= 0.99;   // running into the back of someone costs a little
    }
  }
  /** A remote kart's place from the network: distance round, lateral offset, speed (eased by `blend` per second). */
  function setGhost(k, prog, d, v, dt = 0, blend = 1) {
    const u = dt ? Math.min(1, blend * dt) : 1;
    k.prog += (prog - k.prog) * u; k.d += (d - k.d) * u; k.v = v;
    const c = track.at(k.prog);
    k.x = c.x + c.tz * k.d; k.z = c.z - c.tx * k.d; k.h = Math.atan2(c.tx, c.tz); k.i = c.i;
  }
  /** Places: finished karts by time, then the rest by how far round they are. */
  const order = () => [...karts].sort((a, b) => (a.fin ?? Infinity) - (b.fin ?? Infinity) || b.prog - a.prog);

  return { state, karts, step, setGhost, order, place: id => order().findIndex(k => k.id === id) + 1 };
}

/** Baht for a finishing place (1-based) and the wall hits on the way. */
export const payFor = (place, hits, R = GP) => (R.pay[place - 1] ?? R.pay[R.pay.length - 1]) + (hits <= R.maxHits ? R.clean : 0);
