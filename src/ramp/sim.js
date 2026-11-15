// The half-pipe run with nothing to draw (no three.js). The skater swings from lip to lip; pressing
// jump on the flat pumps for height; over the lip they fly, and in the air the stick spins (sideways),
// flips (up) or grabs (down). A landing must be near a clean half-turn and a whole flip, or it is a
// fall. index.js shows it; tools/test_ramp.mjs plays runs for balance.
import { RAMP } from './rules.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createRun(R = RAMP) {
  const st = {
    time: R.time, phase: 'ride', t: 0, from: -1,            // from: the side (−1 / +1) the skater left or is flying above
    air: R.air.start, pumped: false, stun: 0,
    spin: 0, flip: 0, grab: 0, score: 0, streak: 0, best: 0, landed: 0, falls: 0, tricks: 0, top: 0,
    done: false, events: [],
  };
  const airTime = h => 2 * Math.sqrt(2 * h / R.g);
  /** u: −1 … 1 across the pipe (lip to lip) while riding. */
  const across = () => st.from * Math.cos(Math.PI * clamp(st.t / R.ride, 0, 1));
  /** Height above the lip while flying. */
  const height = () => { const vy = Math.sqrt(2 * R.g * st.air); return Math.max(0, vy * st.t - 0.5 * R.g * st.t * st.t); };

  /** input: { steer −1..1 (spin), up 0..1 (flip), down: bool (grab), jump: bool (pressed this frame is enough; held works) } */
  function step(dt, input = {}) {
    if (st.done) return;
    st.events.length = 0;
    st.time -= dt; st.stun = Math.max(0, st.stun - dt);
    st.t += dt;
    if (st.phase === 'ride') {
      const u = across();
      if (input.jump && !st.pumped && st.stun <= 0 && Math.abs(u) < R.pump.zone) {
        st.pumped = true;
        const q = Math.abs(u) < R.pump.perfect ? 'perfect' : 'ok';
        st.air = Math.min(R.air.max, st.air + (q === 'perfect' ? R.pump.good : R.pump.ok));
        st.events.push(q === 'perfect' ? 'pumpPerfect' : 'pump');
      }
      if (st.t >= R.ride) {                                        // up the wall and off the lip
        if (!st.pumped) st.air = Math.max(R.air.min, st.air - R.air.loss);
        if (st.time <= 0) { st.done = true; st.events.push('end'); return; }
        st.phase = 'air'; st.t = 0; st.from = -st.from; st.spin = st.flip = st.grab = 0; st.top = Math.max(st.top, st.air);
        st.events.push('launch');
      }
    } else {
      if (st.stun <= 0) {
        st.spin += clamp(input.steer || 0, -1, 1) * R.spin * dt;
        st.flip += clamp(input.up || 0, 0, 1) * R.flip * dt;
        if (input.down) st.grab += dt;
      }
      if (st.t >= airTime(st.air)) {                               // coming back down: is it a landing?
        const halves = Math.round(st.spin / 180), flips = Math.round(st.flip / 360);
        const clean = Math.abs(st.spin - halves * 180) <= R.land.spin && Math.abs(st.flip - flips * 360) <= R.land.flip;
        if (clean) {
          const P = R.points, n = Math.min(Math.abs(halves), P.spin.length - 1), base = P.spin[n] + flips * P.flip + Math.round(st.grab * P.grab);
          const did = n > 0 || flips > 0 || st.grab > 0.25;
          if (did) {
            st.streak++; st.best = Math.max(st.best, st.streak); st.tricks++;
            const pts = Math.round((base + st.air * P.height) * Math.min(R.combo.max, 1 + (st.streak - 1) * R.combo.step));
            st.score += pts;
            st.events.push({ e: 'trick', halves: Math.abs(halves), flips, grab: st.grab > 0.25, pts });
          } else st.events.push('land');
          st.landed++;
        } else { st.falls++; st.streak = 0; st.air = Math.max(R.air.min, st.air * R.crash.keep); st.stun = R.crash.stun; st.events.push('fall'); }
        st.phase = 'ride'; st.t = 0; st.pumped = false;
      }
    }
  }
  const baht = () => Math.min(R.pay.cap, Math.round(st.score * R.pay.per + st.tricks * R.pay.trick));
  return { state: st, step, across, height, airTime, baht };
}
