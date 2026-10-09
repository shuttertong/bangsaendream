// People strolling the walking street: up and down the market road, keeping to the left, stopping
// now and then to look at a stall, stepping round the kid and each other. Some walk in pairs (a
// grown-up with a child at their side). Nobody to talk to. They are all one skinned mesh
// (people/body.js buildPeopleMesh): one draw call and one shadow call for the lot, and nothing
// at all while the kid is far from the street.
import * as THREE from 'three';
import { buildPeopleMesh } from './people/body.js';
import { CROWD } from './crowd.js';
import { rng } from '../core/rng.js';

export const STROLL = {
  count: 14, pairs: 3,                // walkers, and how many of them have a child walking beside them (extra people)
  detail: 0.4,                        // mesh detail (≈ 4k triangles each; the cast is ~25k)
  visible: 230,                       // metres from the street: beyond that they are neither drawn nor moved
  speed: [0.7, 1.15],                 // strolling pace, m/s
  edge: 0.8, lane: 0.4,               // keep this far inside the road edge (shoppers stand there) / off the centre line
  ends: 5,                            // turn round this far before the last stall
  stop: { every: [9, 28], for: [3, 7], turnBack: 0.3, apart: 1.1 },   // seconds between stops at a stall, how long, chance of heading back after, room between two people stopping
  kid: { reach: 1.8, wide: 0.95, halt: 0.9, patience: 3, look: 5 },   // pass this wide of the kid when they are this close along the road; wait (up to `patience` s) if they block the way; glance at them
  apart: 0.5, gap: 0.6, overtake: 4,  // two walkers closer than `apart` step apart; they follow `gap` m behind a slower one, and overtake after this many seconds
  swing: 0.5, side: 0.9, turn: 6,     // leg swing (rad), sideways pace (m/s), turning rate
  habits: ['look', 'look', 'phone', 'point'],
  looks: [
    { scale: 1.3, hairStyle: 'short', hat: 'cap', bottom: 'shorts', belly: 0.4 },
    { scale: 1.24, hairStyle: 'long', hat: 'none', bottom: 'skirt' },
    { scale: 1.3, hairStyle: 'short', hat: 'none', bottom: 'pants', sleeves: 'long' },
    { scale: 1.22, hairStyle: 'bun', hat: 'none', bottom: 'pants', belly: 0.3 },
    { scale: 1.26, hairStyle: 'long', hat: 'straw', bottom: 'shorts' },
    { scale: 1.32, hairStyle: 'short', hat: 'bucket', bottom: 'shorts', sleeves: 'none', belly: 0.5 },
    { scale: 1.2, hairStyle: 'bun', hat: 'none', bottom: 'skirt', belly: 0.4, glasses: true },
  ],
  kids: [{ hairStyle: 'short', hat: 'cap', bottom: 'shorts' }, { hairStyle: 'long', hat: 'none', bottom: 'skirt' }, { hairStyle: 'short', hat: 'straw', bottom: 'shorts' }],
};

const lerp = (a, b, t) => a + (b - a) * t;
const turnTo = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);

/** The road as a path by distance: at(s) → point, direction and the unit vector to the right of it. */
function makePath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1], o = { x: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0 };
  return {
    L,
    at(s) {
      s = Math.max(0, Math.min(L, s));
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / len;
      o.x = lerp(ax, bx, t); o.z = lerp(az, bz, t); o.tx = (bx - ax) / len; o.tz = (bz - az) / len; o.rx = -o.tz; o.rz = o.tx;
      return o;
    },
    /** Where a point is along the road: { s, off (metres to the right of the centre line) }. */
    locate(x, z) {
      let best = Infinity, s = 0, off = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = cum[i] - cum[i - 1] || 1, tx = (bx - ax) / len, tz = (bz - az) / len;
        const u = Math.max(0, Math.min(len, (x - ax) * tx + (z - az) * tz)), dx = x - ax - tx * u, dz = z - az - tz * u, d = dx * dx + dz * dz;
        if (d < best) { best = d; s = cum[i - 1] + u; off = dx * -tz + dz * tx; }
      }
      return { s, off };
    },
  };
}

export function createStrollers(scene, map, lift, street) {
  const S = STROLL, r = rng(4747), pick = k => r.pick(CROWD.colors[k]);
  if (!street || street.pts.length < 4) return { update() {}, counts: { people: 0 } };
  const path = makePath(street.pts), reach = Math.max(S.lane + 0.2, street.hw - S.edge);       // how far from the centre line they walk
  const limit = street.hw - 0.3;                                                              // …and the furthest a sidestep may take them
  const dress = (base, adult) => ({ ...base, headScale: adult ? 0.86 : 1.2, print: adult ? 'none' : null,
    skin: pick('skin'), hair: pick('hair'), shirt: pick('shirt'), bottomColor: pick('bottom'), hatColor: pick('hat') });
  const looks = [], pairOf = [];
  for (let i = 0; i < S.count; i++) looks.push(dress(r.pick(S.looks), true));
  for (let i = 0; i < Math.min(S.pairs, S.count); i++) { looks.push(dress({ scale: r.range(0.92, 1.05), ...r.pick(S.kids) }, false)); pairOf.push(i); }
  const { mesh, people } = buildPeopleMesh(looks, S.detail);
  scene.add(mesh);

  const walkers = people.map((p, i) => {
    const dir = r() < 0.5 ? 1 : -1, off = -dir * r.range(S.lane, reach), lead = i >= S.count ? pairOf[i - S.count] : -1;
    return { p, i, lead, dir, off, want: off, s: r.range(S.ends, path.L - S.ends), pace: r.range(...S.speed), v: 0, phase: r() * 6, amp: 0, yaw: 0,
      wait: r.range(...S.stop.every), pause: 0, held: 0, trail: 0, face: 1, habit: r.pick(S.habits), stride: 0, x: 0, z: 0, headYaw: 0, blink: r.range(1, 4), first: true };
  });
  for (const w of walkers) {
    const B = w.p.body, sc = w.p.look.scale;
    w.stride = (2 * Math.PI) / (4 * (B.thigh + B.shin) * sc * Math.sin(S.swing));           // phase per metre: the feet don't slide
    w.lead = w.lead >= 0 ? walkers[w.lead] : null;
    w.beside = 0.6;
    if (w.lead) { w.dir = w.lead.dir; w.s = w.lead.s - 0.25 * w.dir; w.off = w.lead.off + (w.lead.off < 0 ? 0.6 : -0.6); }   // a child starts beside their grown-up
  }

  function step(w, dt, kid) {
    let pace = w.pace, shift = 0, moving = true;
    if (w.lead) {                                                    // a child keeps beside their grown-up
      const a = w.lead;
      w.dir = a.dir; w.face = a.face; w.pause = a.pause;
      if (Math.abs(a.off) > 0.6) w.beside = a.off < 0 ? 0.6 : -0.6;  // on the road side of their grown-up, away from the stalls
      w.want = a.off + w.beside;
      const gap = (a.s - 0.25 * a.dir - w.s) * w.dir;                // how far behind their spot they are
      pace = a.pause > 0 && Math.abs(gap) < 0.15 ? 0 : THREE.MathUtils.clamp(a.v + gap * 2, 0, 1.9);
      if (gap < -0.3) pace = 0;
    } else if (w.pause > 0) {                                        // looking at a stall
      w.pause -= dt; pace = 0;
      if (w.pause <= 0) { w.wait = r.range(...S.stop.every); if (r() < S.stop.turnBack) { w.dir = -w.dir; w.want = -w.dir * r.range(S.lane, reach); } }
    } else {
      w.wait -= dt;
      if (w.wait <= 0) {
        const taken = walkers.some(o => o !== w && o.pause > 0 && Math.abs(o.s - w.s) < S.stop.apart && o.off * w.off > 0);   // someone is already looking at this stall
        if (taken) w.wait = 1.5;
        else { w.pause = r.range(...S.stop.for); w.face = w.off > 0 ? 1 : -1; w.habit = r.pick(S.habits); }
      }
      if ((w.dir > 0 && w.s > path.L - S.ends) || (w.dir < 0 && w.s < S.ends)) { w.dir = -w.dir; w.want = -w.dir * r.range(S.lane, reach); }   // the end of the market: head back, on the other side
    }
    // step round the kid, wait if they stand in the way
    if (kid) {
      const ahead = (kid.s - w.s) * w.dir, beside = kid.off - w.off;
      if (Math.abs(ahead) < S.kid.reach && Math.abs(beside) < S.kid.wide) {
        let side = beside > 0 ? -1 : 1;                                // pass on the side they are already on…
        if (Math.abs(kid.off + side * S.kid.wide) > limit) side = -side;   // …unless the road ends there
        shift += kid.off + side * (S.kid.wide + 0.1) - w.want;
        const blocked = ahead > 0 && ahead < S.kid.halt && Math.abs(beside) < 0.5;
        w.held = blocked ? w.held + dt : 0;
        if (blocked && w.held < S.kid.patience) pace = 0;              // wait a moment for the way to clear, then squeeze past
      } else w.held = 0;
    }
    // …and round each other: fall in a step behind someone slower (and overtake after a while), pass someone who has stopped
    let behind = false;
    for (const o of walkers) {
      if (o === w || o === w.lead || o.lead === w) continue;
      const ahead = (o.s - w.s) * w.dir, beside = o.off - w.off;
      if (Math.abs(ahead) < S.apart && Math.abs(beside) < S.apart) { shift += (beside > 0 || (beside === 0 && w.i < o.i) ? -1 : 1) * S.apart; continue; }   // too close: step apart
      if (ahead <= 0 || ahead > 1.4 || Math.abs(beside) > 0.55) continue;
      if (o.dir === w.dir && o.v > 0.25 && w.trail < S.overtake) { behind = true; pace = Math.min(pace, o.v * THREE.MathUtils.clamp((ahead - S.gap) / 0.6, 0, 1)); }
      else shift += (beside > 0 ? -1 : 1) * 0.7;
    }
    w.trail = behind || w.trail >= S.overtake ? w.trail + dt : 0;
    if (w.trail > S.overtake + 3) w.trail = 0;                       // overtaking takes a few seconds; then back into lane
    w.v += (pace - w.v) * Math.min(1, dt * 3);
    w.s = THREE.MathUtils.clamp(w.s + w.dir * w.v * dt, 0.5, path.L - 0.5);
    const want = THREE.MathUtils.clamp(w.want + shift, -limit, limit);
    w.off += THREE.MathUtils.clamp(want - w.off, -S.side * dt, S.side * dt);
    const q = path.at(w.s), x = q.x + q.rx * w.off, z = q.z + q.rz * w.off;
    const dx = x - w.x, dz = z - w.z, moved = w.first ? 0 : Math.hypot(dx, dz);
    moving = moved > dt * 0.12;
    const heading = w.pause > 0 && !moving ? Math.atan2(q.rx * w.face, q.rz * w.face) : moving ? Math.atan2(dx, dz) : w.yaw;   // stopped: face the stalls on their side
    w.yaw = w.first ? Math.atan2(q.tx * w.dir, q.tz * w.dir) : turnTo(w.yaw, heading, dt * S.turn);
    w.x = x; w.z = z; w.first = false;
    w.p.root.position.set(x, Math.max(map.heightAt(x, z) + lift(x, z), map.sea), z);
    w.p.root.rotation.y = w.yaw;

    // walk cycle, driven by the distance covered; it eases into a standing pose at a stall
    w.phase += moved * w.stride;
    w.amp = lerp(w.amp, moving ? 1 : 0, Math.min(1, dt * 7));
    const B = w.p.bones, a = w.amp, still = 1 - a, sn = Math.sin(w.phase), look = w.pause > 0 ? still : 0;
    B.legL.rotation.x = sn * S.swing * a; B.legR.rotation.x = -sn * S.swing * a;
    B.shinL.rotation.x = Math.max(0, -sn) * 0.7 * a + 0.06; B.shinR.rotation.x = Math.max(0, sn) * 0.7 * a + 0.06;
    B.hips.position.y = B.hips.userData.rest.y - Math.abs(sn) * 0.016 * a;
    B.spine.rotation.set(0.04 * a + (w.habit === 'look' ? 0.1 : 0.03) * look, -sn * 0.06 * a, 0);
    const phone = w.habit === 'phone' ? look : 0, point = w.habit === 'point' ? look : 0;
    B.armL.rotation.set(-sn * 0.4 * a - 1.1 * point, 0, 0.1); B.foreL.rotation.x = -0.15 - 0.25 * a - 0.1 * point;
    B.armR.rotation.set(sn * 0.4 * a - 0.55 * phone, 0, -0.1); B.foreR.rotation.x = -0.15 - 0.25 * a - 1.6 * phone;
    // head: down at the goods (or the phone) at a stall; a glance at the kid when they come close
    let glance = 0;
    if (kid && kid.d < S.kid.look) { const rel = Math.atan2(kid.x - x, kid.z - z) - w.yaw; glance = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1, 1); if (Math.abs(glance) > 0.98) glance = 0; }
    w.headYaw = lerp(w.headYaw, look > 0.5 ? 0 : glance, Math.min(1, dt * 4));
    B.head.rotation.set((w.habit === 'phone' ? 0.42 : 0.24) * look, w.headYaw, 0);
    w.blink -= dt;
    if (w.blink < -0.12) w.blink = r.range(2, 5);
    B.eyes.scale.y = w.blink < 0 ? 0.12 : 1;
  }

  const mid = path.at(path.L / 2), cx = mid.x, cz = mid.z, far = S.visible + path.L / 2;
  for (const w of walkers) step(w, 0, null);                         // stand everyone on the road before the first frame
  for (const w of walkers) w.first = false;
  return {
    mesh, walkers, path,
    counts: { people: walkers.length, tris: (mesh.geometry.attributes.position.count / 3) | 0 },
    /** player: { x, z } (they step round the kid); view: what the camera looks at (the kid, or the drone's spot). */
    update(dt, player, view = player) {
      mesh.visible = Math.hypot(view.x - cx, view.z - cz) < far;
      if (!mesh.visible) return;
      const k = path.locate(player.x, player.z);
      const kid = Math.abs(k.off) < street.hw + 1.5 ? { ...k, x: player.x, z: player.z, d: 0 } : null;
      for (const w of walkers) {
        if (kid) kid.d = Math.hypot(player.x - w.x, player.z - w.z);
        step(w, dt, kid);
      }
    },
  };
}
