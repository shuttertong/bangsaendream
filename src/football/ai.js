// What everyone but the kid does: the keepers, the kid's friend and the rivals.
// Each side, every frame: whoever has the ball dribbles, passes or shoots; without it one player
// goes for the ball, the other finds space (their side has it) or covers the goal (it has not).
// Players only say where they want to run (mx, mz) and when to kick; sim.js does the rest.
import { PITCH, SIDE, AI } from './rules.js';

const { L, W } = PITCH, G = PITCH.goal;
const dirOf = team => (team === 0 ? -1 : 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Run toward (tx, tz), easing off over the last `slow` metres. */
function go(p, tx, tz, slow = 0.6) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const k = d < 0.08 ? 0 : Math.min(1, d / slow) / d;
  p.mx = dx * k; p.mz = dz * k;
}
/** How close a rival comes to the straight line from a to b (metres; the first `skip` metres don't count). */
function laneRoom(a, bx, bz, rivals, skip = 0.6) {
  const dx = bx - a.x, dz = bz - a.z, len = Math.hypot(dx, dz) || 1;
  let room = Infinity;
  for (const r of rivals) {
    const t = clamp(((r.x - a.x) * dx + (r.z - a.z) * dz) / (len * len), 0, 1);
    if (t * len < skip) continue;
    room = Math.min(room, Math.hypot(a.x + dx * t - r.x, a.z + dz * t - r.z));
  }
  return room;
}
/** Where a loose ball can be met by someone running at `speed`. */
function meet(p, ball) {
  for (let t = 0; t <= 2; t += 0.1) {
    const k = t * Math.max(0.3, 1 - 0.3 * t);                          // the sand slows it
    const x = clamp(ball.x + ball.vx * k, -W, W), z = clamp(ball.z + ball.vz * k, -L, L);
    if (Math.hypot(x - p.x, z - p.z) <= p.speed * t + 0.4) return [x, z, t];
  }
  return [ball.x, ball.z, 2];
}

export function think(m, dt) {
  const { players, ball, s } = m, owner = ball.owner;
  for (const team of [0, 1]) {
    const mine = players.filter(p => p.team === team), rivals = players.filter(p => p.team !== team);
    const outs = mine.filter(p => p.role === 'out'), has = owner?.team === team;
    const ownZ = -dirOf(team) * L;
    keeper(m, mine.find(p => p.role === 'gk'), mine, rivals, ownZ);
    if (has && owner.role === 'out' && !owner.human) carry(m, owner, mine, rivals, dt);
    // who goes for the ball: the one who can be there first (the kid's friend steps in when the kid stands still or the goal is in danger)
    let first = null, ft = Infinity;
    if (!has) for (const p of outs) { const t = owner ? dist(p, ball) / p.speed : meet(p, ball)[2] + dist(p, ball) * 0.01; if (t < ft) { ft = t; first = p; } }
    const danger = Math.hypot(ball.x, ball.z - ownZ) < 6.5;
    for (const p of outs) {
      if (p.human || p === owner) continue;
      p.face = null;
      const chase = !has && (p === first || (first?.human && (danger || s.idle > AI.idle || dist(p, ball) < dist(first, ball) * 1.15)));
      if (chase) {
        if (owner) {                                                   // get goal-side of the carrier and close in
          const gx = -ball.x, gz = ownZ - ball.z, gd = Math.hypot(gx, gz) || 1;
          go(p, ball.x + (gx / gd) * 0.35, ball.z + (gz / gd) * 0.35, 0.3);
        } else { const [x, z] = meet(p, ball); go(p, x, z, 0.2); }
      } else if (has) support(p, owner, rivals, team);
      else cover(p, ball, rivals, ownZ);
    }
  }
}

/** On the ball: shoot when the goal is open, pass out of trouble or to someone better placed, else dribble at the goal. */
function carry(m, p, mates, rivals, dt) {
  const { ball, rand, s } = m, S = SIDE[p.team], dir = dirOf(p.team), gz = dir * L, gd = Math.hypot(p.x, gz - p.z);
  const outs = rivals.filter(r => r.role === 'out');
  // dribble: toward the goal, swerving round the nearest rival ahead
  let tx = p.x * 0.35 - p.x, tz = gz - p.z;
  const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  let near = null, nd = Infinity;
  for (const r of outs) {
    const dx = r.x - p.x, dz = r.z - p.z, d = Math.hypot(dx, dz);
    if (d < nd && dx * tx + dz * tz > -0.3) { nd = d; near = r; }
  }
  if (near && nd < 3) {                                               // step to the side they are not on
    const px = -tz, pz = tx, side = (near.x - p.x) * px + (near.z - p.z) * pz > 0 ? 1 : -1, k = ((3 - nd) / 3) * 1.3;
    tx -= px * side * k; tz -= pz * side * k;
  }
  p.mx = tx; p.mz = tz; p.face = null;
  const pressed = near && nd < AI.press;
  if ((p.hold > 0 && !pressed) || p.decide > 0) return;               // a moment to settle the ball, unless someone is on them
  p.decide = AI.every;

  // shoot: from close in, or from further out when a rival is about to get there
  const open = laneRoom(p, 0, gz, outs) > 0.8 && Math.abs(p.x) < G.half + 3.5;
  if ((open && (gd < S.close || (gd < S.shootFrom && near && nd < 2.4))) || gd < 3 || (s.time < 2.5 && gd < 14)) {
    const gk = rivals.find(r => r.role === 'gk'), far = (gk && gk.x > 0 ? -1 : 1) * (G.half - 0.45);
    const aim = far + (rand() + rand() + rand() - 1.5) * S.shotError;
    m.kickTo(p, aim, gz, S.shot[0] + (S.shot[1] - S.shot[0]) * rand(), 1.2 + rand() * 2, 'shot');
    return;
  }
  // pass
  let best = null, bv = -Infinity;
  for (const q of mates) {
    if (q === p || q.role === 'gk') continue;
    const d = dist(p, q);
    if (d < 2.5 || laneRoom(p, q.x, q.z, rivals) < AI.lane || rivals.some(r => dist(r, q) < AI.marked)) continue;
    const gain = gd - Math.hypot(q.x, gz - q.z);                       // metres closer to the goal than the carrier
    const want = pressed || gain > AI.better || (q.human && gain > -2 && p.carried > S.feed && S.feed > 0 && s.idle < 1);   // the friend likes to give the kid the ball
    if (want && gain > bv) { bv = gain; best = q; }
  }
  if (best) {
    const d = dist(p, best), sp = clamp(5.5 + 0.8 * d, 7, 13.5), t = d / sp;
    m.kickTo(p, best.x + best.vx * t * 0.8, best.z + best.vz * t * 0.8, sp, 0.5, 'pass');
  }
}

/** Their side has the ball: find space up the pitch, across from the carrier. */
function support(p, owner, rivals, team) {
  const dir = dirOf(team), A = AI.support;
  let x = clamp(owner.x + (owner.x > 0 ? -A.wide : A.wide), -W + 1.2, W - 1.2);
  let z = clamp(owner.z + dir * A.ahead, -L + 2.6, L - 2.6);
  if (owner.role === 'gk') { x = (p.n % 2 ? 1 : -1) * A.wide * 0.8; z = clamp(owner.z + dir * (6 + 3 * (p.n % 2)), -L + 2.6, L - 2.6); }   // spread out for the keeper's throw
  if (rivals.some(r => Math.hypot(r.x - x, r.z - z) < 1.6)) { x = clamp(x + (x > 0 ? -2.2 : 2.2), -W + 1.2, W - 1.2); z -= dir * 1.5; }
  go(p, x, z, 1);
  if (Math.hypot(p.vx, p.vz) < 0.6) p.face = Math.atan2(owner.x - p.x, owner.z - p.z);
}

/** The other side has it (or the ball is loose and someone else is going): stand between the ball and the goal, toward the free rival. */
function cover(p, ball, rivals, ownZ) {
  const free = rivals.filter(r => r.role === 'out' && r !== ball.owner).sort((a, b) => Math.abs(a.z - ownZ) - Math.abs(b.z - ownZ))[0];
  let x = ball.x * 0.45, z = ownZ + (ball.z - ownZ) * 0.45;
  if (free) { x += (free.x - x) * 0.35; z += (free.z - z) * 0.2; }
  go(p, x, z, 1);
  if (Math.hypot(p.vx, p.vz) < 0.6) p.face = Math.atan2(ball.x - p.x, ball.z - p.z);
}

/** The keeper: across the goal with the ball, quickly to where a shot is going, out for a slow loose ball, and a throw to a free team-mate. */
function keeper(m, gk, mates, rivals, ownZ) {
  const { ball, players } = m, K = SIDE[gk.team].keeper, out = -Math.sign(ownZ);   // out: from the goal line toward the pitch
  gk.face = Math.atan2(ball.x - gk.x, ball.z - gk.z);
  if (ball.owner === gk) {
    gk.mx = gk.mz = 0;
    if (gk.hold > 0) return;
    const T = AI.throw;
    let best = null, bv = T.room;
    for (const q of mates) {
      if (q.role !== 'out' || dist(gk, q) < T.min) continue;
      const room = Math.min(6, ...rivals.map(r => dist(r, q)));
      if (room > bv) { bv = room; best = q; }
    }
    if (best) {
      const d = dist(gk, best), sp = clamp(6 + 0.7 * d, 8, 14.5), t = d / sp;
      m.kickTo(gk, best.x + best.vx * t * 0.7, best.z + best.vz * t * 0.7, sp, T.lift, 'throw');
    } else m.kickTo(gk, (m.rand() < 0.5 ? -1 : 1) * W * 0.55, out * 3, 15, T.lift + 2.5, 'throw');   // nobody free: long, into the other half
    return;
  }
  let tx, tz, slow = 0.5;
  const coming = ball.vz * -out;                                        // speed toward this goal line
  if (!ball.owner && coming > 3.5) {
    const t = (ownZ + out * 0.5 - ball.z) / ball.vz, cx = ball.x + ball.vx * t;
    if (t > 0 && t < 1.6 && Math.abs(cx) < G.half + 0.8) {
      if (gk.shot !== ball.kickId) { gk.shot = ball.kickId; gk.react = K.react; }   // a moment to read the shot
      if (gk.react <= 0) { tx = clamp(cx, -G.half + 0.1, G.half - 0.1); tz = ownZ + out * 0.55; slow = 0.15; }
    }
  }
  if (tx === undefined) {
    const dx = ball.x, dz = ball.z - ownZ, d = Math.hypot(dx, dz) || 1;
    const loose = !ball.owner && d < AI.box && Math.hypot(ball.vx, ball.vz) < 6 && players.every(q => q === gk || dist(q, ball) > dist(gk, ball));
    if (loose) { tx = ball.x; tz = ball.z; slow = 0.2; }
    else if (gk.react > 0) { tx = gk.x; tz = gk.z; }
    else { tx = clamp((dx / d) * AI.arc, -G.half + 0.15, G.half - 0.15); tz = ownZ + out * Math.max(0.5, Math.abs(dz / d) * AI.arc); }
  }
  go(gk, tx, tz, slow);
}
