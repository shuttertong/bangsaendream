// A skating lesson with nothing to draw (no three.js): the skater rolls round the oval by
// themselves and steers across the lane; tasks come up along it — skate over the green pad between
// two cones (gate), round a cone on its pad's side (slalom), jump a low bar, pick up stars.
// index.js shows it; tools/test_skate.mjs plays lessons for balance.
import { SK } from './rules.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** length: one lap of the oval (m). rand: () => 0..1. Returns { state, items, step(dt, input), result() }. */
export function createLesson(lessonIdx, length, rand = Math.random, R = SK) {
  const L = R.lessons[lessonIdx], total = length * R.laps, items = [];
  const kinds = Object.entries(L.mix);
  const pick = () => { let r = rand() * kinds.reduce((a, [, w]) => a + w, 0); for (const [k, w] of kinds) { if ((r -= w) <= 0) return k; } return kinds[0][0]; };
  let side = 1;
  for (let s = 14; s < total - 6; s += L.gap) {
    const kind = pick();
    side = -side;
    const c = kind === 'bar' ? 0 : clamp(side * L.swing * (0.6 + rand() * 0.4), -R.lane + 1.2, R.lane - 1.2);
    // gate: cones either side of the pad; cone: one cone on the far side of the pad (so the pad is the way round); bar: right across
    items.push({ s, kind, c, cones: kind === 'gate' ? [c - 1.15, c + 1.15] : kind === 'cone' ? [c - side * 0.95] : [], done: 0 });
    if (rand() < L.stars) items.push({ s: s + L.gap / 2, kind: 'star', c: clamp((rand() * 2 - 1) * 1.6, -R.lane + 0.6, R.lane - 0.6), high: kind === 'bar' ? 0 : rand() < 0.25 ? 0.7 : 0, cones: [], done: 0 });
  }
  const tasks = items.filter(i => i.kind !== 'star').length;
  const st = { lesson: lessonIdx, s: 0, d: 0, vd: 0, v: 0, y: 0, vy: 0, time: 0, stun: 0, falls: 0, combo: 0, best: 0, score: 0, passed: 0, stars: 0, tasks, next: 0, done: false, events: [] };

  /** input: { steer −1..1, jump: bool (held is fine), brake: bool } */
  function step(dt, input = {}) {
    if (st.done) return;
    st.time += dt; st.events.length = 0;
    st.stun = Math.max(0, st.stun - dt);
    const want = L.speed * (input.brake ? R.brake : 1) * (st.stun > 0 ? 0.6 : 1);
    st.v += clamp(want - st.v, -6 * dt, R.accel * dt);
    st.vd += ((st.stun > 0 ? 0 : clamp(input.steer || 0, -1, 1)) * R.steer - st.vd) * Math.min(1, R.steerEase * dt);
    st.d = clamp(st.d + st.vd * dt, -R.lane, R.lane);
    if (input.jump && st.y <= 0 && st.stun <= 0) { st.vy = R.jump; st.events.push('jump'); }
    if (st.y > 0 || st.vy > 0) { st.vy -= R.gravity * dt; st.y = Math.max(0, st.y + st.vy * dt); if (st.y === 0) { st.vy = 0; st.events.push('land'); } }
    const s0 = st.s; st.s += st.v * dt;
    while (st.next < items.length && items[st.next].s <= st.s) {            // whatever we just rolled over
      const it = items[st.next++];
      if (it.s < s0 - 1) continue;
      if (it.kind === 'star') { if (Math.abs(st.d - it.c) < 0.7 && Math.abs(st.y - it.high) < 0.6) { it.done = 1; st.stars++; st.score += R.points.star; st.events.push('star'); } continue; }
      const hit = it.kind === 'bar' ? st.y < R.clear : it.cones.some(c => Math.abs(st.d - c) < R.cone) && st.y < 0.3;
      if (hit) { it.done = -1; st.combo = 0; st.falls++; st.stun = R.stumble.time; st.v *= R.stumble.keep; st.events.push('hit'); continue; }
      if (it.kind === 'bar' || Math.abs(st.d - it.c) < R.pad) {
        it.done = 1; st.passed++; st.combo++; st.best = Math.max(st.best, st.combo);
        st.score += R.points.pass * (1 + Math.min(st.combo, R.combo.max) * R.combo.step); st.events.push('pass');
      } else { it.done = -1; st.combo = 0; st.events.push('miss'); }
    }
    if (st.s >= total) { st.done = true; st.events.push('end'); }
  }
  /** { passedLesson, baht } for the run so far (finished: whether the lesson was completed). */
  const result = (finished = st.done) => {
    const ok = finished && st.passed / Math.max(1, st.tasks) >= R.pass;
    return { ok, baht: Math.min(R.pay.cap, Math.round(st.score * R.pay.per) + (ok ? R.pay.passed : 0)) };
  };
  return { state: st, items, total, lesson: L, step, result };
}
