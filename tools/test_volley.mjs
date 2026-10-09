// Balance check for วอลเลย์บอลชายหาด (src/volley/sim.js): scripted "kids" play whole games with no
// rendering, and the scores, rallies and payouts are summed up.
//   node tools/test_volley.mjs [games per bot]
import { createGame, JUMP } from '../src/volley/sim.js';
import { payout } from '../src/volley/pay.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const to = (p, x, z) => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), k = d < 0.05 ? 0 : Math.min(1, d / 0.3) / d; return { mx: dx * k, mz: dz * k }; };

/**
 * A kid who goes where the ball will come down and presses about when they should.
 *   sigma: how far off their timing is (seconds, one sigma)        react: seconds before they set off for a new ball
 *   pos: how far from the right spot they end up (metres)          press: false = never presses in a rally (only stands under the ball)
 */
const ringer = ({ sigma = 0, react = 0, pos = 0, press = true }) => (m, r, st) => {
  const { me, ball, s } = m, P = s.plan;
  st.n ||= {}; st.done ||= {};
  const noise = key => (st.n[key] ??= (r() + r() + r() - 1.5) * 2 * sigma);
  const off = key => (st.n[key] ??= [(r() * 2 - 1) * pos, (r() * 2 - 1) * pos]);
  let act = false, mv = to(me, -3.6, -1.2), key = 'home';
  const hit = k => { if (!st.done[k]) { st.done[k] = true; act = true; } };
  if (s.phase === 'serve' && s.server === me) hit(`toss${s.score}${s.t.toFixed(0)}`);
  else if (s.phase === 'toss' && s.server === me) { if (s.t >= s.hitAt + noise(`sv${s.hitAt}`)) hit(`sv${s.hitAt}`); }
  else if (s.phase === 'rally' && P && P.side === 0 && !P.net && s.next[0] === me) {
    if (P.out && ball.lastTeam === 1) { key = 'out'; mv = to(me, me.x - 2, me.z + (P.land.z > me.z ? -2 : 2)); }   // going out: get away from it
    else if (ball.forPlayer === me && P.attack) {
      key = `a${P.attack.t.toFixed(3)}`;
      const [ox, oz] = off(`o${key}`);
      mv = to(me, P.attack.x - 0.25 + ox, P.attack.z + oz);
      if (press && !me.air && s.t >= P.attack.t - JUMP.up + noise(`j${key}`)) hit(`j${key}`);
      else if (press && me.air && s.t >= P.attack.t - 0.03 + noise(`h${key}`)) hit(`h${key}`);
    } else {
      key = `d${P.dig.t.toFixed(3)}`;
      const [ox, oz] = off(`o${key}`);
      mv = to(me, P.dig.x + ox, P.dig.z + oz);
      if (press && s.t >= P.dig.t - 0.1 + noise(key)) hit(key);
    }
  }
  if (key !== st.key) { st.key = key; st.since = s.t; }                 // a new ball to go to: a moment to see it first
  if (s.t - st.since < react) mv = { mx: 0, mz: 0 };
  if (st.was) act = false;                                              // (a press needs the button up first)
  st.was = act;
  return { ...mv, act };
};
const BOTS = {
  idle: () => ({}),
  stander: ringer({ react: 0.4, pos: 0.3, press: false }),
  learner: ringer({ sigma: 0.16, react: 0.55, pos: 0.6 }),
  sloppy: ringer({ sigma: 0.12, react: 0.4, pos: 0.4 }),
  steady: ringer({ sigma: 0.07, react: 0.3, pos: 0.25 }),
  sharp: ringer({ sigma: 0.03, react: 0.2, pos: 0.1 }),
};

const N = +process.argv[2] || 200;
for (const [name, bot] of Object.entries(BOTS)) {
  const sum = { w: 0, pf: 0, pa: 0, baht: 0, lo: 1e9, hi: 0, time: 0, rallies: 0, touches: 0, supers: 0, spikes: [0, 0, 0], why: {}, knocks: 0, shanks: 0 };
  for (let i = 0; i < N; i++) {
    const r = rng(500 + i), st = {};
    const m = createGame({ rand: r, on: {
      point: (team, why) => { sum.rallies++; const k = `${team ? 'them' : 'us'}:${why}`; sum.why[k] = (sum.why[k] || 0) + 1; },
      touch: () => sum.touches++, spike: (p, level) => { if (p.human) sum.spikes[level]++; }, knock: () => sum.knocks++, shank: () => sum.shanks++,
    } });
    let k = 0;
    for (; k < 60 * 900 && m.s.phase !== 'end'; k++) m.step(1 / 60, bot(m, r, st));
    if (m.s.phase !== 'end') throw new Error(`game did not end (${name} #${i}: ${m.s.score}, phase ${m.s.phase})`);
    const [a, b] = m.s.score, pay = payout(m.s).baht;
    sum.w += a > b; sum.pf += a; sum.pa += b; sum.baht += pay; sum.lo = Math.min(sum.lo, pay); sum.hi = Math.max(sum.hi, pay); sum.time += k / 60; sum.supers += m.s.supers;
  }
  const f = v => (v / N).toFixed(1);
  console.log(`${name.padEnd(8)} W ${(sum.w / N * 100).toFixed(0).padStart(3)}%  points ${f(sum.pf)}–${f(sum.pa)}  ฿${f(sum.baht)} (${sum.lo}–${sum.hi})  ${f(sum.time)} s, ${f(sum.rallies)} rallies, ${(sum.touches / sum.rallies).toFixed(1)} touches each`
    + `  kid spikes weak/good/fire ${sum.spikes.map(f).join('/')}  knockdowns ${f(sum.knocks)} shanks ${f(sum.shanks)}\n         ${Object.entries(sum.why).sort().map(([k, v]) => `${k} ${f(v)}`).join('  ')}`);
}
