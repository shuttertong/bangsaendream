// Co-op link for the banana boat. The leader's game runs the ride (tow + balance) and
// sends a snapshot 15×/s plus events; members send their lean and replay the snapshots.
// ctx.coop = { role, room (leader id), seed, seats: [ids], myId, co: { send, on, off }, info }.

export const NET = { hz: 15, smooth: 12 };

/** Snapshot fields, in order (numbers only — see tools/serve.py). */
const FIELDS = ['clock', 'elapsed', 'tx', 'tz', 'tyaw', 'lateral', 'bx', 'bz', 'byaw', 'bturn', 'roll', 'spin', 'hearts', 'down', 'score', 'hooks', 'warn', 'hooking'];
const round = v => Math.round(v * 1000) / 1000;

export function createBananaNet(coop, handlers) {
  if (!coop) return null;
  const leader = coop.role === 'leader', present = new Set(coop.seats);
  let sendIn = 0;
  const others = () => coop.seats.filter(id => id !== coop.myId && present.has(id));

  const listener = (from, d) => {
    if (!d || !coop.seats.includes(from)) return;
    if (d.k === 'gone' || (d.k === 'ev' && d.e === 'bye')) { present.delete(from); handlers.gone?.(from, from === coop.room); return; }
    if (d.k === 'in' && leader && typeof d.lean === 'number') handlers.input?.(from, Math.max(-1, Math.min(1, d.lean)));
    else if (d.k === 'st' && !leader && from === coop.room && Array.isArray(d.s)) {
      const st = Object.fromEntries(FIELDS.map((k, i) => [k, d.s[i]]));
      handlers.state?.({ ...st, leans: Array.isArray(d.lean) ? d.lean : [], phase: d.phase });
    } else if (d.k === 'ev' && !leader && from === coop.room) handlers.event?.(d.e, d);
  };
  coop.co.on(listener);

  return {
    leader,
    seatOf: id => coop.seats.indexOf(id),
    isHere: id => present.has(id),
    /** Leader: throttled snapshot to the members. */
    sendState(dt, st, leans, phase) {
      sendIn -= dt;
      if (sendIn > 0 && phase !== 'end') return;
      sendIn = 1 / NET.hz;
      const to = others();
      if (to.length) coop.co.send(to, { k: 'st', s: FIELDS.map(k => round(+st[k] || 0)), lean: leans.map(round), phase });
    },
    /** Leader: something happened (spill, up, hook, saved, team, end). */
    event(e, extra = {}) { const to = others(); if (to.length) coop.co.send(to, { k: 'ev', e, ...extra }); },
    /** Member: our lean, throttled. */
    sendInput(dt, lean) {
      sendIn -= dt;
      if (sendIn > 0) return;
      sendIn = 1 / NET.hz;
      coop.co.send([coop.room], { k: 'in', lean: round(lean) });
    },
    bye() { if (!leader) coop.co.send([coop.room], { k: 'ev', e: 'bye' }); else this.event('end'); },
    close() { coop.co.off(listener); },
  };
}
