// Multiplayer link for the kart race (co-op channel; ctx.coop = { role, room, seats, myId, co }).
// Everyone drives their own kart on their own device and says where it is NET.hz times a second:
// { k: 'kp', s: [distance round, lateral offset, speed], t: finish time in ms (0 = still racing) };
// the leader also runs the bots and adds them as r: [distance, offset, speed, finish ms, …].
// Payloads are numbers and lists only (tools/serve.py checks them).
import { GP } from './rules.js';

const r2 = v => Math.round(v * 100) / 100;

export function createGpNet(coop, handlers) {
  if (!coop) return null;
  const leader = coop.role === 'leader', present = new Set(coop.seats);
  let sendIn = 0;
  const listener = (from, d) => {
    if (!d || !coop.seats.includes(from)) return;
    if (d.k === 'gone' || (d.k === 'ev' && d.e === 'bye')) { present.delete(from); handlers.gone?.(from); return; }
    if (d.k !== 'kp' || !Array.isArray(d.s) || d.s.length < 3 || !d.s.every(Number.isFinite)) return;
    handlers.kart?.(from, d.s[0], d.s[1], d.s[2], d.t > 0 ? d.t / 1000 : null);
    if (from === coop.room && Array.isArray(d.r)) for (let i = 0; i + 3 < d.r.length; i += 4) handlers.bot?.(i / 4, d.r[i], d.r[i + 1], d.r[i + 2], d.r[i + 3] > 0 ? d.r[i + 3] / 1000 : null);
  };
  coop.co.on(listener);
  return {
    leader, isHere: id => present.has(id),
    /** me: our kart; bots: the leader's bots (else []). Throttled; `force` sends now (the finish). */
    send(dt, me, bots, force = false) {
      sendIn -= dt;
      if (sendIn > 0 && !force) return;
      sendIn = 1 / GP.net.hz;
      const to = coop.seats.filter(id => id !== coop.myId && present.has(id));
      if (!to.length) return;
      const d = { k: 'kp', s: [r2(me.prog), r2(me.d), r2(me.v)], t: me.fin != null ? Math.round(me.fin * 1000) : 0 };
      if (leader && bots.length) d.r = bots.flatMap(b => [r2(b.prog), r2(b.d), r2(b.v), b.fin != null ? Math.round(b.fin * 1000) : 0]);
      coop.co.send(to, d);
    },
    bye() { coop.co.send(coop.seats.filter(id => id !== coop.myId), { k: 'ev', e: 'bye' }); },
    close() { coop.co.off(listener); },
  };
}
