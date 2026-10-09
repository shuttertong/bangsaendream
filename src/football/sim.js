// The match itself, with nothing to draw: players, the ball, who has it, kicks, tackles, saves,
// the boards and the goals. Plain numbers only, so a scripted bot can play whole matches in one
// call (balance tests) and index.js just shows what happens here.
//   team 0 (the kid's) attacks −z, team 1 attacks +z; x runs across the pitch; yaw faces (sin, cos).
import { PITCH, MATCH, BALL, PLAYER, HUMAN, TACKLE, SIDE, AI } from './rules.js';
import { think } from './ai.js';

const { L, W } = PITCH, G = PITCH.goal;
export const dirOf = team => (team === 0 ? -1 : 1);                  // which way a team attacks along z
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = ([a, b], t) => a + (b - a) * t;

/** on: { kick(p, speed, kind), goal(team, scorer, own), save(gk), steal(by, from), miss(by), bounce(speed), whistle(kind) } */
export function createMatch({ rand = Math.random, on = {} } = {}) {
  const players = [];
  for (const team of [0, 1]) {
    for (let i = -1; i < MATCH.outfield; i++) {
      players.push({
        id: players.length, team, role: i < 0 ? 'gk' : 'out', n: Math.max(0, i), human: false,
        x: 0, z: 0, vx: 0, vz: 0, yaw: 0, face: null, mx: 0, mz: 0,
        speed: i < 0 ? SIDE[team].keeper.speed : SIDE[team].speed,
        noBall: 0, stun: 0, tackle: 0, kick: 0, hold: 0, carried: 0, react: 0, shot: -1, decide: 0,
        charge: 0, charging: false, wasAct: false, needRelease: false, lunge: 0, lungeCd: 0, lx: 0, lz: 0,
      });
    }
  }
  const me = players.find(p => p.team === 0 && p.role === 'out');
  me.human = true; me.speed = HUMAN.speed;
  const ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, kickId: 0, tried: new Set() };
  const s = { phase: 'kickoff', wait: MATCH.kickoff, time: MATCH.time, score: [0, 0], mine: 0, conceded: 0, idle: 0, t: 0 };

  // ---------- kickoff ----------
  // where everyone stands, in their own half: [across, metres out from their own goal line]
  const SPOTS = { gk: [0, 0.8], kick: [[0, L - 0.35], [3.2, L - 2.4], [-3.2, L - 4.5]], wait: [[0.6, L - 5], [-2.8, L * 0.5], [2.8, L * 0.45]] };
  function kickoff(team) {
    for (const p of players) {
      const [u, d] = p.role === 'gk' ? SPOTS.gk : (p.team === team ? SPOTS.kick : SPOTS.wait)[p.n % 3], dir = dirOf(p.team);
      p.x = -u * dir; p.z = -dir * (L - d);
      p.vx = p.vz = p.mx = p.mz = 0; p.yaw = dir < 0 ? Math.PI : 0; p.face = null;
      p.noBall = p.stun = p.tackle = p.kick = p.lunge = p.charge = 0; p.charging = false;
    }
    Object.assign(ball, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null });
    own(players.find(p => p.team === team && p.role === 'out' && p.n === 0));
    s.phase = 'kickoff'; s.wait = MATCH.kickoff;
    on.whistle?.('kickoff');
  }

  // ---------- the ball changes feet ----------
  function own(p) {
    ball.owner = p; ball.last = p; ball.vy = 0; ball.tried.clear();
    p.carried = 0; p.hold = lerp(SIDE[p.team].think, rand());
    if (p.human) p.needRelease = p.wasAct;                             // a button still held from a lunge does not start a kick
  }
  /** Kick the ball from p toward (tx, tz). */
  function kickTo(p, tx, tz, speed, lift, kind = 'pass') {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    Object.assign(ball, { owner: null, last: p, x: p.x + (dx / d) * 0.5, z: p.z + (dz / d) * 0.5, y: kind === 'throw' ? AI.throw.hand : 0.05,
      vx: (dx / d) * speed, vz: (dz / d) * speed, vy: lift, kickId: ball.kickId + 1 });
    ball.tried.clear();
    p.noBall = PLAYER.kickRest; p.kick = 0.32; p.charge = 0; p.charging = false;
    p.yaw = Math.atan2(dx, dz);
    on.kick?.(p, speed, kind);
  }

  // ---------- the kid: move, wind up and kick, lunge ----------
  function human(dt, input) {
    const p = me, act = !!input.act, has = ball.owner === p;
    p.mx = input.mx || 0; p.mz = input.mz || 0;
    s.idle = Math.hypot(p.mx, p.mz) > 0.2 || act ? 0 : s.idle + dt;
    if (!act) p.needRelease = false;
    if (has) {
      if (act && !p.needRelease) { p.charging = true; p.charge = Math.min(1, p.charge + dt / HUMAN.charge); }
      else if (p.charging) release(p);
    } else {
      p.charge = 0; p.charging = false;
      const d = Math.hypot(ball.x - p.x, ball.z - p.z), Lg = HUMAN.lunge;
      if (act && !p.wasAct && p.lungeCd <= 0 && p.stun <= 0 && d < Lg.range && d > 0.01) {
        p.lunge = Lg.time; p.lungeCd = Lg.cool; p.lx = (ball.x - p.x) / d; p.lz = (ball.z - p.z) / d;
        on.lunge?.(p);
      }
    }
    p.wasAct = act;
  }
  /** Let go of the button: a pass to a team-mate the kid faces, a shot when the goal is ahead, else straight on. */
  function release(p) {
    const c = p.charge, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), dir = dirOf(p.team);
    let mate = null, md = 0, best = HUMAN.cone.pass;
    for (const q of players) {
      if (q.team !== p.team || q === p) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1.5 || d > 17) continue;
      const a = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
      if (a < best) { best = a; mate = q; md = d; }
    }
    const gz = dir * L, gd = Math.hypot(p.x, gz - p.z);
    const off = Math.acos(clamp((-p.x * fx + (gz - p.z) * fz) / (gd || 1), -1, 1));   // how far the kid faces away from the middle of the goal
    let shotX = null;
    if (fz * dir > 0.2 && gd < HUMAN.shotFrom) {
      const hit = p.x + fx * ((gz - p.z) / fz);                         // where the line the kid faces meets the goal line
      if (Math.abs(hit) < G.half + 1.6 || off < HUMAN.cone.goal) shotX = clamp(hit, -(G.half - 0.4), G.half - 0.4);   // which corner is the kid's choice
    }
    if (shotX !== null && (!mate || c > 0.4 || gd < 5 || (gd < HUMAN.shotNear && off <= best))) {
      const gk = players.find(q => q.team !== p.team && q.role === 'gk'), lim = G.half - 0.4;
      if (Math.abs(shotX - gk.x) < HUMAN.past.near) {                  // not straight at the keeper: to the side, where there is room
        let side = shotX === gk.x ? (gk.x > 0 ? -1 : 1) : Math.sign(shotX - gk.x);
        if (Math.abs(gk.x + side * HUMAN.past.shift) > lim + 0.3) side = -side;
        shotX = clamp(gk.x + side * HUMAN.past.shift, -lim, lim);
      }
      const stray = (rand() + rand() + rand() - 1.5) * 2 * lerp(HUMAN.spread, c) * Math.hypot(shotX - p.x, gz - p.z);   // metres off, at the goal line
      kickTo(p, shotX + stray, gz, lerp(HUMAN.shot, c), lerp(HUMAN.lift, c) * (gd < 6 ? 0.5 : 1), 'shot');
    }
    else if (mate) {
      const sp = clamp(5.5 + 0.8 * md, ...HUMAN.pass) * (1 + 0.25 * c), t = md / sp;
      kickTo(p, mate.x + mate.vx * t * 0.8, mate.z + mate.vz * t * 0.8, sp, 0.6, 'pass');
    } else kickTo(p, p.x + fx * 10, p.z + fz * 10, lerp(HUMAN.shot, c) * 0.9, lerp(HUMAN.lift, c), 'kick');
  }

  // ---------- everybody moves ----------
  function move(dt) {
    const k = 1 - Math.exp(-dt * PLAYER.ease), lim = PITCH.keep;
    for (const p of players) {
      let max = p.speed * (p.stun > 0 ? PLAYER.stunned : 1);
      if (ball.owner === p) max *= p.charging ? PLAYER.charging : PLAYER.dribble;
      const m = Math.hypot(p.mx, p.mz), sc = m > 1 ? 1 / m : 1;
      let tx = p.mx * sc * max, tz = p.mz * sc * max;
      if (p.lunge > 0) { tx = p.lx * HUMAN.lunge.speed; tz = p.lz * HUMAN.lunge.speed; }
      p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
      p.x = clamp(p.x + p.vx * dt, -W + lim, W - lim); p.z = clamp(p.z + p.vz * dt, -L + lim, L - lim);
      // heading: the kid turns to where the stick points, the others to where they run (or where the AI looks)
      const want = p.face ?? (p.human && m > 0.2 ? Math.atan2(p.mx, p.mz) : Math.hypot(p.vx, p.vz) > 0.5 ? Math.atan2(p.vx, p.vz) : p.yaw);
      p.yaw += Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) * Math.min(1, dt * PLAYER.turn);
    }
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {     // nobody stands inside anybody
      const a = players[i], b = players[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = PLAYER.r * 2;
      if (d >= min || d < 1e-4) continue;
      const push = (min - d) / 2;
      a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push;
    }
  }

  // ---------- the ball ----------
  function ballStep(dt) {
    const b = ball;
    if (b.owner) {                                                      // at someone's feet (or in the keeper's hands)
      const o = b.owner, k = 1 - Math.exp(-dt * BALL.follow), px = b.x, pz = b.z;
      b.x += (clamp(o.x + Math.sin(o.yaw) * BALL.lead, -W + BALL.r, W - BALL.r) - b.x) * k;
      b.z += (clamp(o.z + Math.cos(o.yaw) * BALL.lead, -L + BALL.r, L - BALL.r) - b.z) * k;
      b.y += ((o.role === 'gk' ? 0.75 : 0) - b.y) * k;
      b.vx = (b.x - px) / dt; b.vz = (b.z - pz) / dt; b.vy = 0;
      o.carried += dt;
      tackles();
      return;
    }
    b.vy -= BALL.gravity * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y <= 0) {
      b.y = 0;
      if (b.vy < -1.5) { b.vy *= -BALL.bounce; b.vx *= BALL.skid; b.vz *= BALL.skid; on.bounce?.(-b.vy); }
      else b.vy = 0;
    }
    const sp = Math.hypot(b.vx, b.vz), slow = b.y === 0 ? Math.max(0, sp - BALL.sand * dt) * Math.exp(-BALL.drag * dt) : sp * Math.exp(-BALL.drag * 0.3 * dt);
    if (sp > 0) { b.vx *= slow / sp; b.vz *= slow / sp; }
    // the boards along the sides
    if (Math.abs(b.x) > W - BALL.r && b.vx * b.x > 0) { b.x = Math.sign(b.x) * (W - BALL.r); b.vx *= -BALL.board; on.bounce?.(Math.abs(b.vx)); }
    // the ends: the goal mouth, or the boards and the frame around it
    if (Math.abs(b.z) > L - BALL.r) {
      const end = Math.sign(b.z), mouth = Math.abs(b.x) < G.half - BALL.r && b.y < G.h - BALL.r;
      if (mouth) { if (Math.abs(b.z) > L) return goal(end); }
      else if (b.vz * end > 0) { b.z = end * (L - BALL.r); b.vz *= -BALL.board; b.vx *= 0.85; on.bounce?.(Math.abs(b.vz)); }
    }
    touches();
  }
  function goal(end) {
    const team = end < 0 ? 0 : 1, scorer = ball.last, ownGoal = !!scorer && scorer.team !== team;
    s.score[team]++;
    if (scorer?.human && !ownGoal) s.mine++;
    s.phase = 'goal'; s.wait = MATCH.afterGoal; s.conceded = 1 - team; s.scored = team;
    for (const p of players) { p.charge = 0; p.charging = false; p.lunge = 0; }
    on.goal?.(team, scorer, ownGoal);
  }
  /** After a goal the ball settles in the net. */
  function inNet(dt) {
    const b = ball, end = Math.sign(b.z) || 1, k = Math.exp(-dt * 5);
    b.vy -= BALL.gravity * dt;
    b.x = clamp(b.x + b.vx * dt, -G.half + BALL.r, G.half - BALL.r); b.z += b.vz * dt; b.y = Math.max(0, b.y + b.vy * dt);
    if (b.y === 0) b.vy = 0;
    if (Math.abs(b.z) > L + G.depth - BALL.r) { b.z = end * (L + G.depth - BALL.r); b.vz *= -0.2; }
    b.vx *= k; b.vz *= k;
  }

  /** A loose ball meets a player: the keeper saves it, feet bring it under control, a body blocks it. */
  function touches() {
    const b = ball, sp = Math.hypot(b.vx, b.vz);
    let taker = null, td = Infinity;
    for (const p of players) {
      if (p.noBall > 0 || p.stun > 0) continue;
      const d = Math.hypot(b.x - p.x - Math.sin(p.yaw) * 0.22, b.z - p.z - Math.cos(p.yaw) * 0.22);     // from the feet, a little ahead
      if (p.role === 'gk') {
        const K = SIDE[p.team].keeper;
        if (d > K.reach || b.y > G.h || b.tried.has(p)) continue;
        b.tried.add(p);                                                 // one go at each kick
        const chance = sp < 6 ? 1 : K.save - Math.max(0, sp - 15) * 0.03;
        if (rand() < chance) { own(p); p.hold = lerp(K.hold, rand()); on.save?.(p, sp); return; }
        b.vx *= 0.9; b.vz *= 0.9;                                       // fingertips
        continue;
      }
      if (b.y < PLAYER.low && d < (p.human ? HUMAN.reach : PLAYER.reach) && d < td
        && Math.hypot(b.vx - p.vx, b.vz - p.vz) < (p.human ? HUMAN.trap : PLAYER.trap)) { taker = p; td = d; }
    }
    if (taker) { own(taker); return; }
    for (const p of players) {                                          // too fast to trap: it comes off the body
      if (p.noBall > 0 || p.role === 'gk' || b.y > PLAYER.high) continue;
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz), min = PLAYER.r + BALL.r;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx = (b.vx - 2 * vn * nx) * BALL.body + p.vx * 0.5; b.vz = (b.vz - 2 * vn * nz) * BALL.body + p.vz * 0.5; }
      b.x = p.x + nx * min; b.z = p.z + nz * min; b.last = p;
      on.bounce?.(sp);
    }
  }
  /** Someone has the ball and a rival is on it: who comes away with it? */
  function tackles() {
    const o = ball.owner;
    if (o.role === 'gk') return;                                        // nobody takes it out of the keeper's hands
    for (const c of players) {
      if (c.team === o.team || c.noBall > 0 || c.stun > 0 || c.tackle > 0) continue;
      const reach = c.lunge > 0 ? HUMAN.lunge.reach : c.role === 'gk' ? SIDE[c.team].keeper.reach * 0.8 : TACKLE.reach;
      if (Math.hypot(ball.x - c.x - Math.sin(c.yaw) * 0.2, ball.z - c.z - Math.cos(c.yaw) * 0.2) > reach) continue;
      c.tackle = TACKLE.every;
      const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz) || 1;
      const front = (Math.sin(o.yaw) * dx + Math.cos(o.yaw) * dz) / d;   // 1: straight in front of the carrier, −1: behind
      let chance = TACKLE.behind + (TACKLE.front - TACKLE.behind) * (front + 1) / 2 + (c.lunge > 0 ? TACKLE.lunge : 0);
      if (c.role === 'gk') chance = 0.85;
      if (o.human) chance *= TACKLE.vsHuman;
      if (c.human) chance *= TACKLE.byHuman;
      if (rand() < chance) {
        o.stun = TACKLE.lost; o.noBall = TACKLE.keep; o.charge = 0; o.charging = false;
        own(c);
        if (c.role === 'gk') c.hold = lerp(SIDE[c.team].keeper.hold, rand());
        on.steal?.(c, o);
        return;
      }
      c.stun = c.lunge > 0 ? TACKLE.lungeMiss : TACKLE.missed; c.noBall = Math.max(c.noBall, 0.45);
      on.miss?.(c, o);
    }
  }

  const api = { players, ball, s, me, rand, kickTo, own };
  kickoff(0);

  /** input: { mx, mz (which way the kid wants to go, world axes, length ≤ 1), act (the button is down) } */
  function step(dt, input = {}) {
    if (s.phase === 'end' || dt <= 0) return;
    s.t += dt;
    for (const p of players) for (const k of ['noBall', 'stun', 'tackle', 'kick', 'hold', 'react', 'lunge', 'lungeCd', 'decide']) p[k] = Math.max(0, p[k] - dt);
    if (s.phase === 'kickoff') {
      if ((s.wait -= dt) <= 0) { s.phase = 'play'; on.whistle?.('start'); }
      ballStep(dt);                                                     // (the ball stays at the taker's feet)
      return;
    }
    if (s.phase === 'goal') {
      for (const p of players) { p.mx = p.mz = 0; p.face = null; }
      move(dt); inNet(dt);
      if ((s.wait -= dt) <= 0) kickoff(s.conceded);
      return;
    }
    think(api, dt);
    human(dt, input);
    move(dt);
    ballStep(dt);
    if (s.phase === 'play' && (s.time -= dt) <= 0) { s.time = 0; s.phase = 'end'; on.whistle?.('end'); }
  }
  return { ...api, step };
}
