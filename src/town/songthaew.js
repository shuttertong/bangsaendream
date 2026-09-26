// Red songthaews (รถแดง) running along the beach road. They drive on the left, pull in
// at stops, brake for anyone in front, and can be ridden: hop on at the back, sit on a
// bench, hop off wherever you like.
// Multiplayer: mode 'local' simulates them here; 'host' simulates and its snapshot() is
// broadcast; 'follow' plays the host's snapshots (sync) and predicts in between. Pull-over
// requests go through setHold(), which a follower forwards to the host (onHoldRequest).
import * as THREE from 'three';
import { songthaewTemplate, TRUCK } from './assets/songthaew.js';
import { walkLine } from './layout.js';
import { rng } from '../core/rng.js';

const RUN = {
  roads: ['tertiary', 'secondary'], minLength: 500,   // routes: long main roads in the strip
  perRoute: 2, speed: 8.5, accel: 3, brake: 6,        // m/s, m/s²
  lane: 2.2,                                           // metres left of the centre line (Thailand drives on the left)
  stopEvery: [180, 320], stopTime: [3, 6],             // metres between stops, seconds stopped
  yieldDist: 7, boardDist: 4.2, lift: 0.12,
  drawDist: 260,                                       // hide trucks further than this from the camera
  holdMax: 8,                                          // seconds a pull-over request lasts at most
  follow: 4,                                           // how fast a follower eases into the host's positions (1/s)
  stale: 3,                                            // no snapshots this long: simulate locally again
};
// passenger seats: [side (+1 right bench / −1 left), along the bench (local z)]
const SEATS = [[1, -1.1], [-1, -1.1], [1, -0.4], [-1, -0.4], [1, -1.8], [-1, -1.8]];

function buildRoutes(map) {
  const routes = [];
  for (const road of map.roads) {
    if (!RUN.roads.includes(road.k) || road.p.length < 2) continue;
    const pts = [];
    walkLine(road.p, 2, (x, z) => pts.push([x, z]));
    if (pts.length * 2 < RUN.minLength) continue;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    routes.push({ pts, cum, length: cum[cum.length - 1] });
  }
  return routes;
}

/** Point + tangent at distance s along a route. */
function sample(route, s) {
  const { pts, cum } = route;
  s = THREE.MathUtils.clamp(s, 0, route.length);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, k = (s - cum[i - 1]) / seg;
  const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, dx, dz };
}

export function createSongthaews(scene, map) {
  const r = rng(4242);
  const routes = buildRoutes(map);
  const templates = [songthaewTemplate({ route: 42, rack: true }), songthaewTemplate({ route: 6088 })];
  const trucks = [];
  routes.forEach((route, ri) => {
    for (let k = 0; k < RUN.perRoute; k++) {
      const g = templates[(ri + k) % templates.length].clone();
      scene.add(g);
      trucks.push({
        g, route, s: route.length * (k + 0.3) / RUN.perRoute, dir: k % 2 ? -1 : 1, v: RUN.speed,
        stopIn: THREE.MathUtils.lerp(...RUN.stopEvery, r()), stopped: 0, holds: new Map(), x: 0, z: 0, yaw: 0, i: trucks.length,
      });
    }
  });

  const place = t => {
    const p = sample(t.route, t.s);
    const fx = p.dx * t.dir, fz = p.dz * t.dir;                  // travel direction
    t.x = p.x + fz * RUN.lane; t.z = p.z - fx * RUN.lane;        // left of travel (x east, z south): (fz, −fx)
    t.yaw = Math.atan2(fx, fz);
    t.g.position.set(t.x, Math.max(map.heightAt(t.x, t.z), map.sea) + RUN.lift, t.z);
    t.g.rotation.y = t.yaw;
    return { fx, fz };
  };

  let mode = 'local', lastSync = 0;
  const api = { trucks, onHoldRequest: null, extra: [] };

  /**
   * people: [{ x, z, ride }] — everyone who might stand in the road (ride = the truck
   * they're sitting on, which never brakes for its own passengers).
   */
  function update(dt, people, cam) {
    const tt = performance.now() / 1000;
    for (const t of trucks) {
      if (cam) t.g.visible = Math.hypot(t.x - cam.x, t.z - cam.z) < RUN.drawDist;
      if (mode === 'follow' && tt - lastSync < RUN.stale) { follow(t, dt); continue; }
      const { fx, fz } = place(t);
      // brake for anyone standing in front, or while someone asked to pull over
      let blocked = false;
      for (const p of people) {
        if (p.ride === t) continue;
        const px = p.x - t.x, pz = p.z - t.z, ahead = px * fx + pz * fz, side = Math.abs(-px * fz + pz * fx);
        if (ahead > 0 && ahead < RUN.yieldDist && side < 1.6) { blocked = true; break; }
      }
      for (const [who, until] of t.holds) if (until < tt) t.holds.delete(who);
      let target = RUN.speed;
      if (t.stopped > 0) { t.stopped -= dt; target = 0; }
      if (blocked || t.holds.size) target = 0;
      t.v += Math.sign(target - t.v) * Math.min(Math.abs(target - t.v), (target < t.v ? RUN.brake : RUN.accel) * dt);
      t.s += t.v * t.dir * dt;
      t.stopIn -= t.v * dt;
      if (t.stopIn <= 0) { t.stopped = THREE.MathUtils.lerp(...RUN.stopTime, r()); t.stopIn = THREE.MathUtils.lerp(...RUN.stopEvery, r()); }
      // U-turn at the ends of the route
      if (t.s >= t.route.length) { t.s = t.route.length; t.dir = -1; t.stopped = 3; }
      if (t.s <= 0) { t.s = 0; t.dir = 1; t.stopped = 3; }
    }
  }

  // follower: glide along the route at the host's speed, easing into its latest snapshot
  function follow(t, dt) {
    if (t.net) {
      t.dir = t.net.dir; t.v = t.net.v;
      t.net.s += t.net.v * t.net.dir * dt;                          // the host's truck keeps moving too
      t.s += t.v * t.dir * dt;
      t.s += (t.net.s - t.s) * Math.min(1, RUN.follow * dt);
      if (Math.abs(t.net.s - t.s) > 30) t.s = t.net.s;              // far off (first sync, U-turn): jump
      t.s = THREE.MathUtils.clamp(t.s, 0, t.route.length);
    }
    place(t);
  }

  /** Ask truck t to pull over (who: 'me' or a player id), or let it go. */
  function setHold(t, on, who = 'me') {
    if (mode === 'follow' && who === 'me') { api.onHoldRequest?.(t.i, on); return; }
    if (on) t.holds.set(who, performance.now() / 1000 + RUN.holdMax); else t.holds.delete(who);
  }

  /** Host → network: [s, dir, v] per truck. */
  const snapshot = () => trucks.map(t => [+t.s.toFixed(2), t.dir, +t.v.toFixed(2)]);
  /** Network → follower. */
  function sync(list) {
    lastSync = performance.now() / 1000;
    list.forEach((e, i) => {
      const t = trucks[i];
      if (!t || !Array.isArray(e)) return;
      const first = !t.net;
      t.net = { s: e[0], dir: e[1], v: e[2] };
      if (first) { t.s = e[0]; t.dir = e[1]; t.v = e[2]; }
    });
  }
  function setMode(m) {
    if (m === mode) return;
    if (m !== 'follow') for (const t of trucks) delete t.net;
    mode = m;
  }

  /** Nearest truck the kid could hop on (close to its back), or null. */
  function nearest(p) {
    let best = null, bd = RUN.boardDist;
    for (const t of trucks) {
      const bx = t.x - Math.sin(t.yaw) * 2.8, bz = t.z - Math.cos(t.yaw) * 2.8;   // rear step
      const d = Math.min(Math.hypot(p.x - bx, p.z - bz), Math.hypot(p.x - t.x, p.z - t.z) - 1.5);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /** World position of passenger seat `slot` (0–5, both benches) and the yaw to face across the bed. */
  const seat = (t, out = new THREE.Vector3(), slot = 0) => {
    const [side, along] = SEATS[slot % SEATS.length];
    return out.set(TRUCK.seat.x * side, TRUCK.seat.y, along).applyEuler(new THREE.Euler(0, t.yaw, 0)).add(t.g.position);
  };
  const seatYaw = (t, slot = 0) => t.yaw - (Math.PI / 2) * SEATS[slot % SEATS.length][0];
  /** Where to put the kid when hopping off: beside the rear, on the kerb side. */
  const dropSpot = t => ({ x: t.x - Math.sin(t.yaw) * 3.3 + Math.cos(t.yaw) * 1.4, z: t.z - Math.cos(t.yaw) * 3.3 - Math.sin(t.yaw) * 1.4 });

  Object.assign(api, { update, nearest, seat, seatYaw, dropSpot, setHold, snapshot, sync, setMode, seats: SEATS.length });
  Object.defineProperty(api, 'mode', { get: () => mode });          // (Object.assign would copy a getter's value once)
  return api;
}
