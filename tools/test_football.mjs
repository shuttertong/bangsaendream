// Balance check for ฟุตบอลชายหาด (src/football/sim.js): scripted "kids" play whole matches with no
// rendering, and the scores and payouts are summed up.
//   node tools/test_football.mjs [matches per bot]
import { createMatch } from '../src/football/sim.js';
import { payout } from '../src/football/pay.js';
import { PITCH, HUMAN } from '../src/football/rules.js';

const { L } = PITCH;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const to = (p, x, z) => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1; return { mx: dx / d, mz: dz / d }; };

// how different players might play (m: the match, r: random, st: the bot's own notes)
const BOTS = {
  /** Stands still. */
  idle: () => ({}),
  /** Runs at the ball and at the goal, and kicks when the goal is near. */
  eager(m, r, st) {
    const { me, ball } = m;
    if (ball.owner !== me) return { ...to(me, ball.x, ball.z), act: false };
    const gd = Math.hypot(me.x, -L - me.z);
    st.hold = gd < 8 ? (st.hold || 0) + 1 : 0;
    return { ...to(me, 0, -L), act: st.hold > 0 && st.hold < 14 };
  },
  /** A first-timer: chases the ball, runs at the goal and taps the button now and then (a tap is a pass or a weak shot). */
  tapper(m, r, st) {
    const { me, ball } = m;
    st.tap = Math.max(0, (st.tap || 0) - 1);
    const press = st.tap === 0 && r() < 0.03;                           // about twice a second
    if (press) st.tap = 3;
    if (ball.owner !== me) return { ...to(me, ball.x, ball.z), act: st.tap > 0 };
    return { ...to(me, me.x * 0.5, -L), act: st.tap > 0 };
  },
  /** Finds space, goes round defenders, passes under pressure, picks a corner, lunges to win the ball back. */
  sharp(m, r, st) {
    const { me, ball, players } = m, rivals = players.filter(p => p.team === 1 && p.role === 'out'), mate = players.find(p => p.team === 0 && p.role === 'out' && !p.human);
    st.tap = Math.max(0, (st.tap || 0) - 1);
    if (ball.owner === me) {
      const gd = Math.hypot(me.x, -L - me.z), near = rivals.map(q => ({ q, d: Math.hypot(q.x - me.x, q.z - me.z) })).sort((a, b) => a.d - b.d)[0];
      if (st.shoot > 0) { st.shoot--; return { ...to(me, st.corner, -L), act: st.shoot > 0 }; }
      if (gd < 8.5) { st.shoot = Math.round(HUMAN.charge * 60 * 0.6); st.corner = (players.find(p => p.team === 1 && p.role === 'gk').x > 0 ? -1 : 1) * 1.2; return { ...to(me, st.corner, -L), act: true }; }
      if (near.d < 1.8 && near.q.z < me.z + 0.5 && mate.z < me.z + 2 && st.tap === 0) { st.tap = 20; st.pass = 3; }
      if (st.pass > 0) { st.pass--; return { ...to(me, mate.x, mate.z), act: st.pass > 0 }; }
      const dodge = near.d < 3 && near.q.z < me.z ? (near.q.x > me.x ? -1 : 1) * 3 : 0;
      return { ...to(me, me.x * 0.4 + dodge, me.z - 4), act: false };
    }
    if (ball.owner?.team === 0) return { ...to(me, ball.owner.x > 0 ? ball.owner.x - 5 : ball.owner.x + 5, Math.max(-L + 3, ball.owner.z - 5)), act: false };
    const d = Math.hypot(ball.x - me.x, ball.z - me.z), lunge = !!ball.owner && d < 1.6 && st.tap === 0;
    if (lunge) st.tap = 30;
    return { ...to(me, ball.x, ball.z + (ball.owner ? 0.4 : 0)), act: lunge };
  },
};

const N = +process.argv[2] || 200;
for (const [name, bot] of Object.entries(BOTS)) {
  const sum = { w: 0, d: 0, l: 0, gf: 0, ga: 0, mine: 0, baht: 0, lo: 1e9, hi: 0, steals: 0, lost: 0, saves: 0, shots: 0, myShots: 0, theirShots: 0, passes: 0 };
  for (let i = 0; i < N; i++) {
    const r = rng(1000 + i), st = {};
    const m = createMatch({ rand: r, on: {
      steal: (by, from) => { if (by.human) sum.steals++; if (from.human) sum.lost++; },
      save: () => sum.saves++, kick: (p, sp, kind) => { if (kind === 'shot') { sum.shots++; if (p.human) sum.myShots++; if (p.team === 1) sum.theirShots++; } else if (kind === 'pass') sum.passes++; },
    } });
    for (let k = 0; k < 60 * 400 && m.s.phase !== 'end'; k++) m.step(1 / 60, bot(m, r, st));
    if (m.s.phase !== 'end') throw new Error('match did not end');
    const [a, b] = m.s.score, pay = payout(m.s).baht;
    sum[a > b ? 'w' : a < b ? 'l' : 'd']++; sum.gf += a; sum.ga += b; sum.mine += m.s.mine; sum.baht += pay;
    sum.lo = Math.min(sum.lo, pay); sum.hi = Math.max(sum.hi, pay);
  }
  const f = v => (v / N).toFixed(2);
  console.log(`${name.padEnd(6)} W ${(sum.w / N * 100).toFixed(0)}%  D ${(sum.d / N * 100).toFixed(0)}%  L ${(sum.l / N * 100).toFixed(0)}%   goals ${f(sum.gf)}–${f(sum.ga)} (the kid ${f(sum.mine)})   ฿${f(sum.baht)} (${sum.lo}–${sum.hi})   shots ${f(sum.shots)} (kid ${f(sum.myShots)}, rivals ${f(sum.theirShots)}) saves ${f(sum.saves)} passes ${f(sum.passes)}  won ball ${f(sum.steals)} lost ${f(sum.lost)}`);
}
