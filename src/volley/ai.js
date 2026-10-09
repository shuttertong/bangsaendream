// What everyone but the kid does: the friend (digs and sets, never spikes) and the two rivals
// (whoever digs also spikes; the other sets). They only say where they want to run and when to
// jump or dive; sim.js decides what a touch does.
import { COURT, BODY, PASS, SPIKE, SIDE } from './rules.js';

const dirOf = team => (team === 0 ? 1 : -1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const UP = BODY.jump / BODY.g;                                          // seconds from the sand to the top of a jump

function go(p, x, z, slow = 0.4) {
  const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), k = d < 0.06 ? 0 : Math.min(1, d / slow) / d;
  p.mx = dx * k; p.mz = dz * k;
}

/**
 * Where a spike should land (world x, z). The kid's, when the stick is left alone: the sand furthest
 * from both rivals. A rival's: near the kid, near the friend, or open sand; they miss by `error`.
 */
export function aimSpike(m, p) {
  const { players, rand } = m, dir = dirOf(p.team), foes = players.filter(q => q.team !== p.team && q.down <= 0);
  const open = () => {
    let best = null, bd = -1;
    for (let i = 0; i < 12; i++) {
      const tx = dir * (SPIKE.depth[0] + rand() * (SPIKE.depth[1] - SPIKE.depth[0])), tz = (rand() * 2 - 1) * SPIKE.wide;
      const d = Math.min(9, ...foes.map(q => Math.hypot(q.x - tx, q.z - tz)));
      if (d > bd) { bd = d; best = { tx, tz }; }
    }
    return best;
  };
  if (p.team === 0) return open();
  const S = SIDE[1], r = rand(), who = r < S.aim.kid ? players[0] : r < S.aim.kid + S.aim.mate ? players[1] : null;
  let at = open();
  if (who) {
    const a = rand() * Math.PI * 2, d = S.aim.spread[0] + rand() * (S.aim.spread[1] - S.aim.spread[0]);
    at = { tx: dir * clamp((who.x + Math.cos(a) * d) * dir, 1.2, COURT.half - 0.5), tz: clamp(who.z + Math.sin(a) * d, -COURT.wide + 0.4, COURT.wide - 0.4) };
  }
  return { tx: at.tx + (rand() * 2 - 1) * S.error, tz: at.tz + (rand() * 2 - 1) * S.error };
}

export function think(m) {
  const { players, ball, s } = m, P = s.plan;
  for (const p of players) {
    if (p.human) continue;
    p.mx = p.mz = 0;
    if (p.down > 0 || p.dive > 0 || p.air) continue;
    const team = p.team, dir = dirOf(team), here = s.phase === 'rally' && P && P.side === team && !P.net;
    const leave = here && P.out && ball.lastTeam !== team && Math.max(Math.abs(P.land.x) - COURT.half, Math.abs(P.land.z) - COURT.wide) > 0.35;   // it is going out
    if (!here || leave || s.next[team] !== p || p.react > 0) {
      // not their ball: wait where a dig will be sent, or go back to their own patch of sand
      if (here && !leave && s.next[team] && s.next[team] !== p && ball.lastTeam !== team) go(p, -dir * PASS.setSpot, clamp(p.z * 0.4, -1.5, 1.5), 0.6);
      else { const [x, z] = m.base(p); go(p, x, z, 0.8); }
      continue;
    }
    if (ball.forPlayer === p && P.attack) {                             // a set for them: under it, then up
      go(p, P.attack.x - dir * 0.25, P.attack.z, 0.3);
      if (P.attack.t - s.t - UP + p.err <= 0 && Math.hypot(P.attack.x - p.x, P.attack.z - p.z) < 1.3) { m.jump(p); p.job = 'spike'; }
      continue;
    }
    const at = ball.lastTeam === team && p !== s.spiker[team] ? P.set : P.dig, left = at.t - s.t, d = Math.hypot(at.x - p.x, at.z - p.z);
    go(p, at.x, at.z, 0.3);
    if (left < 0.3 && left > 0.08 && d - BODY.speed * left > BODY.reach * 0.8 && d < BODY.dive.to * SIDE[team].dive) m.dive(p, at);   // not on foot: dive
  }
}
