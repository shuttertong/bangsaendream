// The game itself, with nothing to draw: four players, the ball's flight, who plays it next, digs,
// sets, spikes, blocks, the net, the lines and the score. Plain numbers only, so scripted kids can
// play whole games in one call (tools/test_volley.mjs) and index.js just shows what happens here.
//   The net stands on x = 0. Team 0 (the kid, id 0, and a friend) plays on x < 0, team 1 on x > 0.
//   z runs across the court, y is up. A team has three touches; the kid is their side's spiker.
import { COURT, MATCH, BALL, BODY, PASS, SPIKE, SERVE, TIMING, SIDE } from './rules.js';
import { think, aimSpike } from './ai.js';

const G = BALL.g;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = ([a, b], t) => a + (b - a) * t;
export const dirOf = team => (team === 0 ? 1 : -1);                  // toward the other side of the net
export const JUMP = { up: BODY.jump / BODY.g, apex: BODY.jump ** 2 / (2 * BODY.g) };   // seconds to the top of a jump; its height
export const ATTACK_H = JUMP.apex + BODY.hand - 0.1;                 // where a spiker meets a set

/** on: { serve(p), toss(p), touch(p, kind, q), spike(p, level), shank(p), block(p), net(), knock(p), point(team, why) } */
export function createGame({ rand = Math.random, on = {} } = {}) {
  const players = [0, 0, 1, 1].map((team, id) => ({
    id, team, n: id % 2, human: id === 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, mx: 0, mz: 0,
    air: false, down: 0, swing: 0, swingAt: 0, dive: 0, dvx: 0, dvz: 0, dived: false, wantHit: 0, lastD: 9, hit: 0, react: 0, err: 0, job: null, wasAct: false,
  }));
  const me = players[0];
  const ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, live: false, held: null, fire: false, last: null, lastTeam: -1, at: 0, forPlayer: null };
  const s = { phase: 'serve', t: 0, wait: 0, score: [0, 0], serving: 0, turn: [0, 0], server: null, touches: 0, next: [null, null], spiker: [me, null],
    plan: null, hitAt: 0, supers: 0, pointTo: -1, why: '', aim: { mx: 0, mz: 0 } };
  const mates = p => players.filter(q => q.team === p.team && q !== p);
  /** −1..1: how far ahead the kid is (the rivals play to the score; SIDE[1].band). */
  const lead = () => clamp((s.score[0] - s.score[1]) / SIDE[1].band.per, -1, 1);
  const base = p => (p.team === 0 ? [p.human ? -3.6 : -3.3, p.human ? -1.2 : me.z > 0 ? -1.3 : 1.3] : [3.3, p.n ? 1.4 : -1.4]);

  // ---------- the ball's flight ----------
  /** Seconds until the ball is at height h on its way down (−1: it never gets there). */
  const timeDown = h => { const d = ball.vy * ball.vy - 2 * G * (h - ball.y); return d < 0 ? -1 : (ball.vy + Math.sqrt(d)) / G; };
  const whereAt = h => { const t = timeDown(h); return t < 0 ? null : { t: s.t + t, x: ball.x + ball.vx * t, z: ball.z + ball.vz * t }; };
  /** Send the ball in an arc that tops out at `apex` and comes down to height `h` at (tx, tz). */
  function lob(tx, tz, apex, h) {
    ball.vy = Math.sqrt(2 * G * Math.max(0.4, apex - ball.y));
    const t = (ball.vy + Math.sqrt(Math.max(0, ball.vy * ball.vy - 2 * G * (h - ball.y)))) / G;
    ball.vx = (tx - ball.x) / t; ball.vz = (tz - ball.z) / t;
  }
  /** Send the ball to reach (tx, BALL.r, tz) in T seconds; it takes longer if it would not clear the net. */
  function drive(tx, tz, T, mustClear = true) {
    for (let i = 0; i < 12; i++) {
      ball.vx = (tx - ball.x) / T; ball.vz = (tz - ball.z) / T; ball.vy = (BALL.r - ball.y + 0.5 * G * T * T) / T;
      const tn = -ball.x / ball.vx;
      if (!mustClear || !(tn > 0 && tn < T) || ball.y + ball.vy * tn - 0.5 * G * tn * tn > COURT.net + SPIKE.clear) return;
      T *= 1.12;
    }
  }
  /** Work out where the ball is going: where it lands, and where it can be dug, set and spiked on the way. */
  function plan() {
    const land = whereAt(BALL.r) || { t: s.t, x: ball.x, z: ball.z }, side = land.x < 0 ? 0 : 1, tn = ball.vx ? -ball.x / ball.vx : -1;
    const net = tn > 0 && s.t + tn < land.t && ball.y + ball.vy * tn - 0.5 * G * tn * tn < COURT.net;      // it will hit the net
    s.plan = { land, side, net, out: Math.abs(land.x) > COURT.half + BALL.r || Math.abs(land.z) > COURT.wide + BALL.r,
      dig: whereAt(PASS.digH) || land, set: whereAt(PASS.setH) || land, attack: ball.forPlayer ? whereAt(ATTACK_H) : null };
    if (!net && side !== ball.lastTeam) receive(side);
  }
  /** The ball is coming over: who takes it? (The friend leaves the kid what is nearer the kid.) */
  function receive(team) {
    const c = s.plan.dig, up = players.filter(p => p.team === team && p.down < 0.3), d = p => Math.hypot(p.x - c.x, p.z - c.z);
    let taker = up.reduce((a, p) => (!a || d(p) < d(a) ? p : a), null);
    if (team === 0 && up.length === 2) taker = d(players[1]) < d(me) - SIDE[0].mine ? players[1] : me;
    s.next[team] = taker || players.find(p => p.team === team);
    s.spiker[team] = team === 0 ? me : s.next[team];
    ball.forPlayer = null;
    for (const p of players) if (p.team === team) { p.dived = false; if (!p.human) { p.react = SIDE[team].react * (0.7 + rand() * 0.6); p.job = null; } }
  }

  // ---------- touches ----------
  function touched(p) {
    s.touches = ball.lastTeam === p.team ? s.touches + 1 : 1;
    Object.assign(ball, { last: p, lastTeam: p.team, at: s.t, fire: false, forPlayer: null });
    p.hit = 0.3; p.swing = 0; p.wantHit = 0;
  }
  const scatter = (x, z, r) => { const a = rand() * Math.PI * 2, d = r * Math.sqrt(rand()); return [x + Math.cos(a) * d, z + Math.sin(a) * d]; };
  /** A ball played off the sand: a dig to the setter, a set for the spiker, or (third touch) just over the net. q: quality 0..1 */
  function ground(p, q) {
    const team = p.team, dir = dirOf(team), n = ball.lastTeam === team ? s.touches : 0, spiker = s.spiker[team] || p, other = mates(p)[0];
    touched(p);
    let kind;
    if (n >= 2 || (n === 1 && p === spiker)) {                          // nobody left to set it up: over it goes
      kind = 'free';
      lob(dir * (2.5 + rand() * 2.3), (rand() * 2 - 1) * (COURT.wide - 0.8), PASS.free, BALL.r);
      s.next[team] = null;
    } else if (p === spiker) {                                          // the spiker digs: up to the setter
      kind = 'dig';
      const [x, z] = scatter(-dir * PASS.setSpot, clamp(other.z * 0.4, -1.5, 1.5), (1 - q) * PASS.digError);
      lob(Math.min(-0.5, x * dir) * dir, z, PASS.dig, PASS.setH);
      s.next[team] = other;
    } else {                                                            // dug or set by the other one: it goes up for the spiker
      kind = n === 0 ? 'dig' : 'set';
      const [x, z] = scatter(-dir * PASS.attackSpot, clamp(spiker.z, -COURT.wide + 0.7, COURT.wide - 0.7), (1 - q) * PASS.setError);
      lob(Math.min(-0.45, x * dir) * dir, z, (n === 0 ? PASS.digSet : PASS.set) + (spiker.down > 0 || spiker.dived ? PASS.high : 0), ATTACK_H);
      ball.forPlayer = spiker; s.next[team] = spiker;
      if (!spiker.human) spiker.err = (rand() * 2 - 1) * (SIDE[team].jumpErr || 0);
    }
    plan();
    on.touch?.(p, kind, q);
  }
  /** A dig that goes wrong: the ball flies off the arms. */
  function shank(p) {
    touched(p);
    const a = rand() * Math.PI * 2;
    lob(p.x - dirOf(p.team) * (2 + rand() * 4) + Math.cos(a) * 2, p.z + Math.sin(a) * 5, 3 + rand() * 1.5, BALL.r);
    s.next[p.team] = null;
    plan();
    on.shank?.(p);
  }
  /** A spike. q: quality 0..1; aim: { tx, tz } or null (the open sand); speed: m/s, or null for what the quality gives. */
  function spike(p, q, aim, speed) {
    const dir = dirOf(p.team), level = q >= SPIKE.super ? 2 : q >= SPIKE.good ? 1 : 0;
    touched(p);
    const want = aim || aimSpike(api, p), [tx, tz] = scatter(want.tx, want.tz, level === 2 ? 0.2 : (1 - q) * SPIKE.error);
    const sp = speed || SPIKE.speed[level], intoNet = level === 0 && !speed && rand() < SPIKE.net * (1 - q / SPIKE.good);
    drive(Math.max(0.8, tx * dir) * dir, tz, Math.hypot(tx - ball.x, tz - ball.z) / sp, !intoNet);
    ball.fire = level === 2;
    if (p.human && level === 2) s.supers++;
    s.next[p.team] = null;
    plan();
    on.spike?.(p, level);
  }
  /** Jumped but did not swing: the ball comes off the hand and drops over the net. */
  function tap(p, aim) {
    const dir = dirOf(p.team);
    touched(p);
    lob(dir * (aim?.tx ?? 1.6 + rand() * 1.6), aim?.tz ?? clamp(ball.z + (rand() - 0.5) * 2, -COURT.wide + 0.6, COURT.wide - 0.6), Math.max(ball.y + 0.5, COURT.net + 0.9), BALL.r);
    s.next[p.team] = null;
    plan();
    on.touch?.(p, 'tap', 0.3);
  }

  // ---------- what a player can do (the kid through the button, the others through ai.js) ----------
  function jump(p) {
    if (p.air || p.down > 0) return;
    p.air = true; p.vy = BODY.jump; p.lastD = 9; p.swing = 0; p.wantHit = 0;
    on.jump?.(p);
  }
  /** Throw yourself at where the ball comes down. */
  function dive(p, at) {
    const dx = at.x - p.x, dz = at.z - p.z, d = Math.hypot(dx, dz) || 1, go = Math.min(d, BODY.dive.to) - 0.25;
    p.dive = BODY.dive.time; p.dvx = (dx / d) * go / BODY.dive.time; p.dvz = (dz / d) * go / BODY.dive.time;
    p.swing = BODY.dive.time + 0.12; p.swingAt = s.t; p.dived = true;
    on.dive?.(p);
  }
  function serveStart(team) {
    for (const p of players) { const [x, z] = base(p); Object.assign(p, { x, z, y: 0, vx: 0, vy: 0, vz: 0, air: false, down: 0, swing: 0, dive: 0, dived: false, wantHit: 0, job: null, mx: 0, mz: 0 }); }
    const server = players.find(p => p.team === team && p.n === s.turn[team]);
    s.turn[team] = 1 - s.turn[team];
    server.x = -dirOf(team) * (COURT.half + 0.7); server.z = server.n ? 1.2 : -1.2;
    Object.assign(ball, { held: server, live: false, fire: false, vx: 0, vy: 0, vz: 0, last: null, lastTeam: -1, forPlayer: null });
    Object.assign(s, { phase: 'serve', server, serving: team, wait: server.human ? MATCH.serveWait : MATCH.serveIn, touches: 0, next: [null, null], plan: null });
    on.serve?.(server);
  }
  function toss() {
    const p = s.server;
    Object.assign(ball, { held: null, x: p.x + dirOf(p.team) * 0.35, y: 1.45, z: p.z, vx: 0, vz: 0, vy: Math.sqrt(2 * G * (SERVE.tossTo - 1.45)) });
    s.phase = 'toss'; s.hitAt = s.t + timeDown(SERVE.hitH);
    on.toss?.(p);
  }
  /** q: how well the serve was timed; aimZ: across the court (or null: anywhere). */
  function serveHit(q, aimZ) {
    const p = s.server, dir = dirOf(p.team);
    touched(p);
    const [tx, tz] = scatter(dir * (2.4 + rand() * (COURT.half - 3.2)), aimZ ?? (rand() * 2 - 1) * (COURT.wide - 0.7), (1 - q) * SERVE.error);
    drive(Math.max(1, tx * dir) * dir, tz, lerp(SERVE.time, q));
    ball.live = true; s.phase = 'rally';
    plan();
    on.touch?.(p, 'serve', q);
  }
  function point(team, why) {
    s.score[team]++;
    ball.live = false;
    Object.assign(s, { phase: 'point', wait: MATCH.pause, pointTo: team, why, next: [null, null], plan: null });
    for (const p of players) { p.job = null; p.wantHit = 0; }
    on.point?.(team, why);
  }
  const won = () => { const [a, b] = s.score, top = Math.max(a, b); return (top >= MATCH.to && Math.abs(a - b) >= 2) || top >= MATCH.cap; };

  // ---------- the kid ----------
  function human(dt, input) {
    const p = me, act = !!input.act, press = act && !p.wasAct;
    p.wasAct = act;
    p.mx = input.mx || 0; p.mz = input.mz || 0;
    s.aim.mx = p.mx; s.aim.mz = p.mz;
    if (!press || p.down > 0 || p.dive > 0) return;
    if (s.phase === 'serve') { if (s.server === p) toss(); return; }
    if (s.phase === 'toss') { if (s.server === p) serveHit(clamp(1 - Math.abs(s.t - s.hitAt) / TIMING.serve, 0.1, 1), Math.abs(p.mz) > 0.35 ? p.mz * SPIKE.wide : null); return; }
    if (s.phase !== 'rally') return;
    if (p.air) { p.wantHit = 0.2; return; }                             // in the air: swing
    const P = s.plan, mine = ball.forPlayer === p && P?.attack && s.t < P.attack.t + 0.05;
    const block = ball.x > 0 && ball.forPlayer?.team === 1 && p.x > -2.6;
    if (mine || block) { jump(p); return; }
    // on the sand: arms out for a dig, or a dive when the ball comes down out of reach
    const at = P && P.side === 0 && !P.net ? P.dig : null, d = at ? Math.hypot(at.x - p.x, at.z - p.z) : 0;
    if (at && d > BODY.reach * 0.9 && d < BODY.dive.to && at.t - s.t < 0.5) dive(p, at);
    else { p.swing = BODY.swing; p.swingAt = s.t; }
  }

  // ---------- everybody moves ----------
  function move(dt) {
    for (const p of players) {
      for (const k of ['down', 'swing', 'wantHit', 'react', 'hit']) p[k] = Math.max(0, p[k] - dt);
      if (p.dive > 0 && (p.dive -= dt) <= 0) { p.dive = 0; p.down = BODY.dive.down; }
      let tx = 0, tz = 0;
      if (p.dive > 0) { tx = p.dvx; tz = p.dvz; }
      else if (p.down <= 0 && !(ball.held === p) && !(s.phase === 'toss' && s.server === p)) {
        const m = Math.hypot(p.mx, p.mz), sp = BODY.speed * (SIDE[p.team].speed && !p.human ? SIDE[p.team].speed : 1) * (p.swing > 0 ? BODY.slow : 1) / Math.max(1, m);
        tx = p.mx * sp; tz = p.mz * sp;
      }
      const k = p.dive > 0 ? 1 : 1 - Math.exp(-dt * BODY.ease * (p.air ? BODY.air : 1));
      p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
      const lo = p.team === 0 ? -COURT.half - COURT.run : COURT.keep, hi = p.team === 0 ? -COURT.keep : COURT.half + COURT.run;
      p.x = clamp(p.x + p.vx * dt, lo, hi); p.z = clamp(p.z + p.vz * dt, -COURT.wide - COURT.run, COURT.wide + COURT.run);
      if (p.air) { p.vy -= BODY.g * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.air = false; p.wantHit = 0; if (p.job === 'spike') p.job = null; } }
      const look = Math.atan2(ball.x - p.x, ball.z - p.z);              // everyone watches the ball
      p.yaw += Math.atan2(Math.sin(look - p.yaw), Math.cos(look - p.yaw)) * Math.min(1, dt * 10);
    }
    for (const t of [0, 2]) {                                           // team-mates don't stand in each other
      const a = players[t], b = players[t + 1], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = BODY.r * 2;
      if (d < min && d > 1e-4 && !a.air && !b.air) { const push = (min - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
    }
  }

  // ---------- the ball ----------
  function ballStep(dt) {
    const b = ball;
    if (b.held) { const p = b.held; b.x = p.x + dirOf(p.team) * 0.35; b.y = 1.2; b.z = p.z; return; }
    const px = b.x;
    b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (!b.live) {                                                      // a toss, or a dead ball rolling to a stop
      if (s.phase === 'toss') { if (b.y < SERVE.auto && b.vy < 0) { if (s.server.human) serveHit(0.15, null); } }
      else if (b.y <= BALL.r) { b.y = BALL.r; b.vy = b.vy < -1 ? -b.vy * 0.4 : 0; const k = Math.exp(-dt * 2.5); b.vx *= k; b.vz *= k; }
      return;
    }
    if (px * b.x <= 0 && px !== b.x) {                                  // at the net
      const f = px / (px - b.x), y = b.y - b.vy * dt * (1 - f), z = b.z - b.vz * dt * (1 - f), from = Math.sign(px) || -dirOf(b.lastTeam);
      const wall = players.find(p => p.team !== b.lastTeam && p.air && Math.abs(p.x) < 1.4 && Math.abs(p.z - z) < 0.8 && y > p.y + 1.0 && y < p.y + BODY.hand + 0.45);
      if (y < COURT.net) { b.x = from * 0.14; b.vx *= -0.15; b.vz *= 0.5; b.vy = Math.min(b.vy, 0); b.fire = false; plan(); on.net?.(); }
      else if (wall) {                                                  // blocked: straight back down
        b.x = from * 0.2; b.vx *= -0.5; b.vz *= 0.4; b.vy = -1.5;
        Object.assign(b, { last: wall, lastTeam: wall.team, at: s.t, fire: false, forPlayer: null });
        s.touches = 0; wall.hit = 0.3;
        plan(); on.block?.(wall);
      }
    }
    if (b.y <= BALL.r) {                                                // on the sand: whose point?
      b.y = BALL.r;
      const inside = Math.abs(b.x) <= COURT.half + BALL.r && Math.abs(b.z) <= COURT.wide + BALL.r;
      b.vy *= -0.4;
      return point(inside ? (b.x < 0 ? 1 : 0) : 1 - b.lastTeam, inside ? 'in' : 'out');
    }
    contacts();
  }
  /** The ball within someone's reach. */
  function contacts() {
    const b = ball, side = b.x < 0 ? 0 : 1;
    for (const p of players) {
      if (p.team !== side || p.down > 0 || (b.last === p && s.t - b.at < 0.3)) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (p.air) {
        const d3 = Math.hypot(d, b.y - (p.y + BODY.hand));
        if (p.human) {
          if (p.wantHit > 0 && d3 < BODY.spikeReach) {                 // the nearer the hand and the higher over the net, the better
            const q = clamp(0.55 * (1 - d3 / BODY.spikeReach) + 0.45 * clamp((b.y - COURT.net) / (ATTACK_H - COURT.net), 0, 1), 0, 1);
            const m = Math.hypot(s.aim.mx, s.aim.mz) > 0.35;
            return spike(p, q, m ? { tx: lerp(SPIKE.depth, 0.5 + 0.5 * clamp(s.aim.mx, -1, 1)), tz: clamp(s.aim.mz, -1, 1) * SPIKE.wide } : null);
          }
          if (d3 < SPIKE.tap && d3 > p.lastD) return tap(p);            // it is going past: a touch gets it over
          p.lastD = d3;
        } else if (p.job === 'spike' && d3 < BODY.spikeReach * 0.8) {
          const S = SIDE[p.team], q = lerp(S.spikeQ, rand()), aim = aimSpike(api, p);
          if (rand() < S.tip) return tap(p, { tx: 1.2 + rand(), tz: aim.tz });
          return spike(p, q, aim, Math.hypot(aim.tx - b.x, aim.tz - b.z) / (lerp(S.spikeT, q) * (1 - S.band.spikeT * lead())));
        }
        continue;
      }
      if (b.vy > 0.5) continue;                                         // only a ball on its way down
      if (p.human) {
        if (p.swing > 0 && d < BODY.reach && b.y < 2.1 && b.y > 0.2) {
          const early = Math.max(0, s.t - p.swingAt - TIMING.dig) / TIMING.late;      // arms out too long before it arrived
          return ground(p, clamp((p.dived ? 0.55 : 1) - 0.6 * (d / BODY.reach) - 0.5 * early, 0.12, 1));
        }
        if (d < TIMING.assist && b.y < 0.7) return ground(p, 0.25);     // standing right under it: it comes off the arms anyway
      } else if (s.next[p.team] === p && d < BODY.reach && b.y <= (b.lastTeam === p.team && p !== s.spiker[p.team] ? PASS.setH : PASS.digH)) {
        const S = SIDE[p.team], first = b.lastTeam !== p.team, sp = Math.hypot(b.vx, b.vy, b.vz), fire = b.fire;
        const chance = !first ? 1 : ((fire ? S.digSuper : S.dig - Math.max(0, sp - 11) * S.digFast) + (S.band ? S.band.dig * lead() : 0)) * (p.dived ? 0.75 : 1);
        if (rand() > chance) shank(p); else ground(p, first ? lerp(S.passQ, rand()) : S.setQ);
        if (fire) { p.down = SPIKE.knock; on.knock?.(p); }
        return;
      }
    }
  }

  const api = { players, ball, s, me, rand, jump, dive, base };
  serveStart(0);

  /** input: { mx, mz (which way the kid wants to go, world axes, length ≤ 1), act (the button is down) } */
  function step(dt, input = {}) {
    if (s.phase === 'end' || dt <= 0) return;
    s.t += dt;
    if (s.phase === 'point') {
      for (const p of players) p.mx = p.mz = 0;
      move(dt); ballStep(dt);
      if ((s.wait -= dt) <= 0) { if (won()) { s.phase = 'end'; on.end?.(s.score[0] > s.score[1] ? 0 : 1); } else serveStart(s.pointTo); }
      return;
    }
    think(api, dt);
    human(dt, input);
    if (s.phase === 'serve' && (s.wait -= dt) <= 0) toss();             // an AI serves by itself; so does a kid who waits too long
    else if (s.phase === 'toss' && !s.server.human && s.t >= s.hitAt) serveHit(lerp(SIDE[s.server.team].serveQ, rand()), null);
    move(dt);
    ballStep(dt);
  }
  return { ...api, step };
}
