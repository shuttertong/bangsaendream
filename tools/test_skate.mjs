// Balance check for the skating lessons (node tools/test_skate.mjs [runs]): scripted skaters with a
// reaction distance and an aim error steer for the pads and jump the bars; no rendering.
import { createLesson } from '../src/skate/sim.js';
import { SK } from '../src/skate/rules.js';

const N = +process.argv[2] || 40, LAP = 64.7;
let seed = 11; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const [name, look, err, miss] of [['never steers', 0, 0, 1], ['beginner', 6, 0.75, 0.25], ['steady', 9, 0.4, 0.08], ['sharp', 12, 0.15, 0]]) {
  for (let li = 0; li < SK.lessons.length; li++) {
    let pass = 0, baht = 0, done = 0, falls = 0, time = 0;
    for (let r = 0; r < N; r++) {
      const g = createLesson(li, LAP, rand), st = g.state; let aim = 0, seen = -1, skip = false;
      for (let t = 0; t < 400 && !st.done; t += 1 / 60) {
        const it = g.items.slice(st.next).find(i => i.kind !== 'star');
        if (it && it !== seen && it.s - st.s < look) { seen = it; aim = it.c + (rand() * 2 - 1) * err; skip = rand() < miss; }
        const jump = !!it && it.kind === 'bar' && !skip && it.s - st.s < st.v * 0.3 && look > 0;
        g.step(1 / 60, { steer: look ? Math.max(-1, Math.min(1, (aim - st.d) * 2.5)) : 0, jump });
      }
      const res = g.result(); pass += res.ok; baht += res.baht; done += st.passed / st.tasks; falls += st.falls; time += st.time;
    }
    console.log(`${name.padEnd(13)} lesson ${li + 1} (${SK.lessons[li].id.padEnd(7)}): passes ${Math.round(100 * pass / N)} %, pads ${Math.round(100 * done / N)} %, falls ${(falls / N).toFixed(1)}, ฿${Math.round(baht / N)}, ${(time / N).toFixed(0)} s`);
  }
}
