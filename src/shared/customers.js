// Customers for the shop mini-games (som tam cart, grandma's khao lam stall): they walk
// along the street to a free spot at the counter, wait with an order and a patience
// timer, then walk off happy (served) or in a huff (patience ran out).
//   opts: { slots: [Vector3], lane: z of the street, order: () => order,
//           patience: elapsed => seconds, from: x where they appear (±) }
import { buildPerson } from '../town/people/body.js';

// look pools for random passers-by (fictional, no likenesses)
const LOOKS = {
  skin: ['#d9a57c', '#c68f66', '#b8835c', '#e0b08a', '#a8764f'],
  shirt: ['#f0b43a', '#4fb3a8', '#e8958a', '#7fc4e8', '#f4f1e8', '#6a8a5a', '#9a5a8a', '#3f6f9a'],
  bottom: ['#34507a', '#3a3a3a', '#6a5a4a', '#e8e4d8', '#3a6a4a'],
  hat: ['none', 'none', 'cap', 'bucket', 'straw'],
  hair: ['short', 'short', 'long', 'bun'],
};

export function createCustomers(scene, r, { slots: SLOTS, lane: LANE = 3.4, order, patience: patienceAt, from: FROM = 9 }) {
  const list = [];
  const pick = a => a[Math.floor(r() * a.length)];

  function spawn(elapsed) {
    const free = SLOTS.map((s, i) => i).filter(i => !list.some(c => c.slot === i && c.state !== 'gone'));
    if (!free.length) return null;
    const slot = free[Math.floor(r() * free.length)];
    const adult = r() < 0.75;
    const look = {
      scale: adult ? 1.2 + r() * 0.15 : 1, headScale: adult ? 0.86 : 1,
      skin: pick(LOOKS.skin), shirt: pick(LOOKS.shirt), bottom: r() < 0.25 ? 'skirt' : r() < 0.5 ? 'pants' : 'shorts',
      bottomColor: pick(LOOKS.bottom), hat: pick(LOOKS.hat), hatColor: pick(LOOKS.shirt), hairStyle: pick(LOOKS.hair), belly: r() * 0.4,
    };
    const p = buildPerson(look);
    const from = r() < 0.5 ? -FROM : FROM;
    p.mesh.position.set(from, 0, LANE);
    scene.add(p.mesh);
    const patience = patienceAt(elapsed) * (0.85 + r() * 0.3);
    const c = { p, slot, state: 'walkIn', order: order(), patience, left: patience, exit: -from, phase: r() * 6, mood: null };
    list.push(c);
    return c;
  }

  function walk(c, tx, tz, dt) {
    const m = c.p.mesh, dx = tx - m.position.x, dz = tz - m.position.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, 1.5 * dt);
    if (d > 0.01) { m.position.x += (dx / d) * step; m.position.z += (dz / d) * step; m.rotation.y = Math.atan2(dx, dz); }
    c.phase += dt * 9;
    const s = Math.sin(c.phase), B = c.p.bones;
    B.legL.rotation.x = s * 0.5; B.legR.rotation.x = -s * 0.5;
    B.shinL.rotation.x = Math.max(0, -s) * 0.6; B.shinR.rotation.x = Math.max(0, s) * 0.6;
    B.armL.rotation.x = -s * 0.35; B.armR.rotation.x = s * 0.35;
    B.hips.position.y = B.hips.userData.rest.y - Math.abs(s) * 0.015;
    return d < 0.05;
  }

  function stand(c) {
    const B = c.p.bones;
    for (const k of ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR']) B[k].rotation.set(0, 0, 0);
    B.armL.rotation.z = 0.1; B.armR.rotation.z = -0.1;
  }

  /** Advance everyone; returns customers who just ran out of patience. */
  function update(dt, t) {
    const angry = [];
    for (const c of list) {
      if (c.state === 'gone') continue;
      const m = c.p.mesh, slot = SLOTS[c.slot];
      if (c.state === 'walkIn') {
        // two legs: along the promenade lane, then in to the counter
        const onLane = Math.abs(m.position.x - slot.x) > 0.1;
        const arrived = onLane ? (walk(c, slot.x, LANE, dt), false) : walk(c, slot.x, slot.z, dt);
        if (arrived) { c.state = 'wait'; m.rotation.y = Math.PI; stand(c); }
      } else if (c.state === 'wait') {
        c.left -= dt;
        m.rotation.y = Math.PI;
        const B = c.p.bones, impatient = c.left < c.patience * 0.3;
        B.head.rotation.x = Math.sin(t * 1.3 + c.phase) * 0.05;
        B.armR.rotation.x = impatient ? -0.3 + Math.sin(t * 8) * 0.15 : 0;       // tapping / fidgeting
        B.mouth.scale.set(impatient ? 1.2 : 1.6, impatient ? 0.35 : 0.5, 1);
        if (c.left <= 0) { c.state = 'leave'; c.mood = 'angry'; angry.push(c); }
      } else if (c.state === 'leave') {
        // back out to the lane, then off along it
        const backing = Math.abs(m.position.z - LANE) > 0.05;
        const done = backing ? (walk(c, m.position.x, LANE, dt), false) : walk(c, c.exit, LANE, dt);
        if (done) { c.state = 'gone'; scene.remove(m); }
        const B = c.p.bones;
        B.mouth.scale.set(c.mood === 'happy' ? 1.8 : 1.1, c.mood === 'happy' ? 0.6 : 0.3, 1);
      }
    }
    return angry;
  }

  function serve(c, happy) { c.state = 'leave'; c.mood = happy ? 'happy' : 'meh'; }

  return { list, spawn, update, serve, waiting: () => list.filter(c => c.state === 'wait'), dispose: () => list.forEach(c => scene.remove(c.p.mesh)) };
}
