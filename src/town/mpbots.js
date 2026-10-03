// Test bots for multiplayer (?bots=N): fake players on their own relay connections, so
// one device can see the shared hub come alive. They wander near you, walk to the road and
// wait for a red truck, hop on as one passes, ride a while, ask it to pull over, hop off,
// and chat / emote now and then.
// Everyone connected (other devices too) sees them like real players. Never the host.
import { connect } from '../core/net.js';
import { NAMES, LOOKS } from '../shared/avatar.js';
import { PHRASES, EMOTES } from '../shared/phrases.js';

const BOT = {
  max: 8, walk: 1.6, run: 3.6, sendHz: 10,
  wander: [6, 14], ride: [18, 40], giveUp: 150, pullOver: 8,  // seconds (a truck can take a couple of minutes to come round)
  catchChance: 0.6, catchRange: 220, reach: 4,                 // go for a truck's road within this range; hop on as one passes this close
  chat: [10, 24], spread: 12,                                  // seconds between chats; spawn radius around you
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function createBots(n, { map, lift, collision, trucks, player }) {
  const ground = (x, z) => Math.max(map.heightAt(x, z) + lift(x, z), map.sea - collision.wade);
  const bots = [];
  for (let k = 0; k < Math.min(n, BOT.max); k++) {
    const p = player.state;
    let x = p.x, z = p.z;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(3, BOT.spread);
      if (collision.free(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 0.3)) { x = p.x + Math.cos(a) * r; z = p.z + Math.sin(a) * r; break; }
    }
    const look = Object.fromEntries(Object.entries(LOOKS).map(([key, list]) => [key, Math.floor(Math.random() * list.length)]));
    const b = { uid: [Math.floor(Math.random() * 1e6), Math.floor(Math.random() * 1e6)], id: null, x, z, yaw: Math.random() * 6.28, mode: 'wander', timer: rand(...BOT.wander), tx: x, tz: z, truck: null, chatIn: rand(2, 8), sendIn: 0 };
    b.net = connect({
      onOpen: () => b.net.send({ t: 'hello', bot: true, n1: Math.floor(Math.random() * NAMES.length), n2: 1 + Math.floor(Math.random() * 99), look }),
      onMessage: m => {
        if (m.t === 'welcome') b.id = m.id;
        // 🤝 back when someone asks to be friends (bots have a throwaway id), so the friends flow can be tested alone
        else if (m.t === 'co' && m.d?.k === 'friend') setTimeout(() => b.net.send({ t: 'co', to: [m.from], d: { k: 'friend', n: b.uid[0], i: b.uid[1] } }), 1500);
      },
    });
    bots.push(b);
  }

  function newTarget(b) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(5, 20), x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
      if (collision.free(x, z, 0.3)) { b.tx = x; b.tz = z; return; }
    }
  }
  /** Step toward (tx, tz); false when blocked. */
  function walk(b, tx, tz, speed, dt) {
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    const st = Math.min(d, speed * dt), nx = b.x + (dx / d) * st, nz = b.z + (dz / d) * st;
    b.yaw = Math.atan2(dx, dz);
    if (!collision.free(nx, nz, 0.3)) return false;
    b.x = nx; b.z = nz;
    return true;
  }

  function update(dt) {
    for (const b of bots) {
      if (!b.id || !b.net.online) continue;
      b.timer -= dt;
      if (b.mode === 'wander') {
        if (!walk(b, b.tx, b.tz, BOT.walk, dt) || Math.hypot(b.tx - b.x, b.tz - b.z) < 0.5) newTarget(b);
        if (b.timer <= 0) {
          const t = trucks.trucks.map(t => ({ t, d: Math.hypot(t.x - b.x, t.z - b.z) })).sort((a, c) => a.d - c.d)[0];
          if (t && t.d < BOT.catchRange && Math.random() < BOT.catchChance) {
            // walk to the nearest point of that truck's road and wait there
            let best = null, bd = Infinity;
            for (const [x, z] of t.t.route.pts) { const d = Math.hypot(x - b.x, z - b.z); if (d < bd) { bd = d; best = [x, z]; } }
            b.mode = 'catch'; b.truck = null; b.tx = best[0]; b.tz = best[1]; b.timer = BOT.giveUp;
          }
          else b.timer = rand(...BOT.wander);
        }
      } else if (b.mode === 'catch') {
        // go to the roadside, then hop on the first truck that comes past
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz), st = Math.min(d, BOT.run * dt);
        if (d > 0.3) { b.x += (dx / d) * st; b.z += (dz / d) * st; b.yaw = Math.atan2(dx, dz); }   // bots squeeze past things
        const t = trucks.trucks.find(t => Math.hypot(t.x - b.x, t.z - b.z) < BOT.reach);
        if (t) { b.truck = t; b.mode = 'ride'; b.timer = rand(...BOT.ride); }
        else if (b.timer <= 0) { b.mode = 'wander'; b.timer = rand(...BOT.wander); newTarget(b); }
      } else if (b.mode === 'ride') {
        b.x = b.truck.x; b.z = b.truck.z; b.yaw = b.truck.yaw;
        if (b.timer <= 0) { b.mode = 'alight'; b.timer = BOT.pullOver; b.net.send({ t: 'hold', i: b.truck.i, on: true }); }
      } else if (b.mode === 'alight') {
        b.x = b.truck.x; b.z = b.truck.z;
        if (b.truck.v < 0.3 || b.timer <= 0) {
          const d = trucks.dropSpot(b.truck);
          b.x = d.x; b.z = d.z; b.yaw = b.truck.yaw + Math.PI / 2;
          b.net.send({ t: 'hold', i: b.truck.i, on: false });
          b.truck = null; b.mode = 'wander'; b.timer = rand(...BOT.wander); newTarget(b);
        }
      }
      // chat now and then
      b.chatIn -= dt;
      if (b.chatIn <= 0) {
        b.chatIn = rand(...BOT.chat);
        if (Math.random() < 0.6) b.net.send({ t: 'say', p: Math.floor(Math.random() * PHRASES.length) });
        else b.net.send({ t: 'emote', e: pick(EMOTES).id });
      }
      // state
      b.sendIn -= dt;
      if (b.sendIn <= 0) {
        b.sendIn = 1 / BOT.sendHz;
        const riding = b.mode === 'ride' || b.mode === 'alight';
        b.net.send({ t: 'state', x: +b.x.toFixed(2), y: +ground(b.x, b.z).toFixed(2), z: +b.z.toFixed(2), yaw: +b.yaw.toFixed(3),
          pose: riding ? 'bench' : null, busy: null, air: false, ride: riding ? b.truck.i : null });
      }
    }
  }

  return { bots, update, close: () => bots.forEach(b => b.net.close()) };
}
