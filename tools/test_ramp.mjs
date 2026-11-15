// Balance check for the half-pipe (node tools/test_ramp.mjs [runs]): scripted skaters that pump with
// some timing error and try tricks sized to the air they have; no rendering.
import { createRun } from '../src/ramp/sim.js';
import { RAMP } from '../src/ramp/rules.js';

const N = +process.argv[2] || 40;
let seed = 5; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// [name, pumps?, pump timing error (share of the crossing), tricks?, error in the spin they stop at (deg), flips and grabs too]
for (const [name, pumps, perr, tricks, serr, fancy] of [['just rides', 0, 0, 0, 0, 0], ['pumps only', 1, 0.12, 0, 0, 0], ['beginner', 1, 0.24, 1, 60, 0], ['steady', 1, 0.1, 1, 22, 1], ['sharp', 1, 0.04, 1, 8, 1]]) {
  let baht = 0, tricks2 = 0, falls = 0, top = 0, sc = 0;
  for (let r = 0; r < N; r++) {
    const g = createRun(), st = g.state; let at = 0, plan = null;
    for (let t = 0; t < 80 && !st.done; t += 1 / 60) {
      const inp = {};
      if (st.phase === 'ride') { if (st.t < 0.02) at = (rand() * 2 - 1) * perr; plan = null; if (pumps && Math.abs(g.across() - at) < 0.05) inp.jump = true; }
      else if (tricks) {
        if (!plan) { const T = g.airTime(st.air), can = Math.floor((T - 0.12) * RAMP.spin / 180); plan = { halves: Math.max(0, Math.min(can, 4)) , err: (rand() * 2 - 1) * serr, flip: fancy && T > 1.0 && rand() < 0.4, grab: fancy && rand() < 0.5 }; if (plan.flip) plan.halves = 0; }
        if (!plan.flip && Math.abs(st.spin) < plan.halves * 180 + plan.err) inp.steer = 1;
        if (plan.flip && st.flip < 360 + plan.err) inp.up = 1;
        if (plan.grab && st.t < g.airTime(st.air) * 0.6) inp.down = true;
      }
      g.step(1 / 60, inp);
    }
    sc += st.score; baht += g.baht(); tricks2 += st.tricks; falls += st.falls; top += st.top;
  }
  console.log(`${name.padEnd(11)}: score ${Math.round(sc / N)}, ฿${Math.round(baht / N)}, tricks ${(tricks2 / N).toFixed(1)}, falls ${(falls / N).toFixed(1)}, top air ${(top / N).toFixed(1)} m`);
}
