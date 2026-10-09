// Checks the online truck host (src/core/realtime.js) without touching the real server:
// several browsers on one Supabase Realtime channel (a fake Phoenix server in memory), plus the
// part of town/multiplayer.js that reacts to welcome / host / trucks. Every browser must agree
// on who hosts the red trucks, and every follower must get the host's snapshots — through
// arrivals, a wrong clock, the host leaving, hiding its tab, stalling, and two arriving at once.
//   node tools/test_realtime.mjs        (exit code 1 if a check fails)
const REPO = new URL('..', import.meta.url).pathname;
let clock = 1_000_000;                       // fake wall clock (ms); each client may have a skew
const realNow = Date.now;
const timers = [];                           // setInterval / setTimeout, run by step()
globalThis.setInterval = (fn, ms) => { const t = { fn, ms, next: clock + ms, every: true }; timers.push(t); return t; };
globalThis.clearInterval = t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
globalThis.setTimeout = (fn, ms) => { const t = { fn, ms, next: clock + ms }; timers.push(t); return t; };

// ---------- fake server ----------
const server = { socks: new Set(), metas: new Map(), queue: [] };   // metas: key → meta
const deliver = (sock, msg) => server.queue.push([sock, msg]);
class FakeWS {
  constructor() { this.readyState = 0; server.socks.add(this); this._open = () => { this.readyState = 1; this.onopen?.(); }; FakeWS.last = this; }
  send(text) {
    const m = JSON.parse(text), topic = m.topic;
    if (m.event === 'phx_join') {
      this.topic = topic; this.key = m.payload.config.presence.key;
      deliver(this, { topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok' } });
      const state = {}; for (const [k, meta] of server.metas) state[k] = { metas: [meta] };
      deliver(this, { topic, event: 'presence_state', payload: state });
    } else if (m.event === 'presence') {
      const old = server.metas.get(this.key), meta = { ...m.payload.payload, phx_ref: String(Math.random()) };
      server.metas.set(this.key, meta);
      const diff = { joins: { [this.key]: { metas: [meta] } }, leaves: old ? { [this.key]: { metas: [old] } } : {} };
      for (const s of server.socks) if (s.topic === topic) deliver(s, { topic, event: 'presence_diff', payload: diff });
    } else if (m.event === 'broadcast') {
      server.sent = (server.sent || 0) + 1;
      for (const s of server.socks) if (s !== this && s.topic === topic) deliver(s, { topic, event: 'broadcast', payload: m.payload });
    }
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3; server.socks.delete(this);
    const old = server.metas.get(this.key);
    if (old) { server.metas.delete(this.key); for (const s of server.socks) deliver(s, { topic: this.topic, event: 'presence_diff', payload: { joins: {}, leaves: { [this.key]: { metas: [old] } } } }); }
    this.onclose?.();
  }
}
globalThis.WebSocket = FakeWS;

const { connectRealtime } = await import(`${REPO}src/core/realtime.js`);
const cfg = { url: 'wss://fake', key: 'k', topic: 'realtime:test', heartbeat: 25, tries: 3, backoff: [1000, 15000], hostTimeout: 3, rates: { truckHz: 3 } };

// ---------- one browser: realtime + the game's reaction (multiplayer.js) ----------
function browser(name, { skew = 0, visible = true } = {}) {
  const b = { name, myId: null, hostId: null, mode: 'local', got: 0, visible, skew, alive: true, stalled: false };
  const setHost = id => { b.hostId = id; b.mode = id == null || !b.myId ? 'local' : id === b.myId ? 'host' : 'follow'; };
  globalThis.document = { visibilityState: visible ? 'visible' : 'hidden' };
  Date.now = () => clock + skew;
  b.net = connectRealtime(cfg, {
    onOpen: () => b.net.send({ t: 'hello', n1: 1, n2: 2, look: { shirt: 0, skin: 0, hat: 0, hatColor: 0, hair: 0, bottom: 0 } }),
    onMessage: m => {
      if (m.t === 'welcome') { b.myId = m.id; b.net.send({ t: 'vis', on: b.visible }); setHost(m.host); }
      else if (m.t === 'host') setHost(m.id);
      else if (m.t === 'trucks' && b.mode === 'follow') b.got++;
    },
    onClose: () => { b.myId = null; setHost(null); },
  });
  b.ws = FakeWS.last;
  b.setVisible = on => { b.visible = on; withClock(b, () => b.net.send({ t: 'vis', on })); };
  b.leave = () => { b.alive = false; b.ws.close(); };
  return b;
}
const all = [];
const withClock = (b, fn) => { Date.now = () => clock + b.skew; fn(); };
/** Advance the world: sockets open, messages flow, hosts send truck snapshots 3×/s. */
function step(seconds) {
  for (let t = 0; t < seconds * 30; t++) {
    clock += 1000 / 30;
    for (const b of all) if (b.alive && b.ws.readyState === 0) withClock(b, () => b.ws._open());
    // deliver queued messages with each receiver's clock
    while (server.queue.length) { const [s, m] = server.queue.shift(); if (!m || s.readyState !== 1) continue; const b = all.find(x => x.ws === s); withClock(b || { skew: 0 }, () => s.onmessage?.({ data: JSON.stringify(m) })); }
    for (const tm of [...timers]) if (clock >= tm.next) { Date.now = () => clock + (tm.owner?.skew || 0); tm.fn(); if (tm.every) tm.next += tm.ms; else timers.splice(timers.indexOf(tm), 1); }
    if (t % 10 === 0) for (const b of all) if (b.alive && !b.stalled && b.visible && b.mode === 'host') withClock(b, () => b.net.send({ t: 'trucks', s: [[1, 1, 1]] }));
  }
}
const add = (name, opts) => { const before = timers.length; const b = browser(name, opts); for (const tm of timers.slice(before)) tm.owner = b; all.push(b); return b; };
const view = () => all.filter(b => b.alive).map(b => `${b.name}:${b.mode}${b.mode === 'follow' ? '→' + (all.find(x => x.myId === b.hostId)?.name || '?') : ''}`).join('  ');
let fails = 0;
function check(label, cond) { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}   [${view()}]`); if (!cond) fails++; }
const hosts = () => all.filter(b => b.alive && b.visible && b.mode === 'host');
const followersOf = h => all.filter(b => b.alive && b !== h && b.visible).every(b => b.mode === 'follow' && b.hostId === h.myId);
const flowing = (secs = 2) => { for (const b of all) b.got = 0; step(secs); const seen = all.filter(b => b.alive && b.visible), f = seen.filter(b => b.mode === 'follow'); return f.length === seen.length - 1 && f.every(b => b.got >= secs * 2); };

// 1. A alone, then B and C arrive
const A = add('A'); step(1);
check('A alone is the host', A.mode === 'host');
const sentAlone = server.sent || 0; step(3);
check('a lone host broadcasts no truck snapshots', (server.sent || 0) - sentAlone === 0);
const B = add('B'); step(1.5);
check('B joins: one host, B follows A', hosts().length === 1 && hosts()[0] === A && followersOf(A));
check('snapshots reach B', flowing());
const C = add('C', { skew: -600_000 }); step(1.5);       // C's clock is 10 minutes behind
check('C joins with a slow clock: A still hosts, everyone follows A', hosts().length === 1 && hosts()[0] === A && followersOf(A));
check('snapshots reach B and C', flowing());
// 2. the host leaves
A.leave(); step(1.5);
check('A leaves: the next in line (B) hosts, C follows', hosts().length === 1 && hosts()[0] === B && followersOf(B));
check('snapshots reach C', flowing());
// 3. the host hides its tab, then comes back
B.setVisible(false); step(1.5);
check('B hides: C hosts', hosts().length === 1 && hosts()[0] === C);
B.setVisible(true); step(1.5);
check('B comes back: C keeps hosting, B follows', hosts().length === 1 && hosts()[0] === C && followersOf(C));
check('snapshots reach B', flowing());
// 4. the host stalls (no snapshots) and later wakes up
const D = add('D'); step(1.5);
check('D joins: C hosts, B and D follow', hosts().length === 1 && hosts()[0] === C && followersOf(C));
C.stalled = true; step(5);
check('C goes quiet for 5 s: B takes over for the others', B.mode === 'host' && D.mode === 'follow' && D.hostId === B.myId);
C.stalled = false; step(3);
check('C wakes up: still exactly one host, everyone else follows it', hosts().length === 1 && followersOf(hosts()[0]));
check('snapshots reach every follower', flowing());
// 5. two arrive at the same moment
const E = add('E'), F = add('F'); step(2);
check('E and F arrive together: one host, all follow it', hosts().length === 1 && followersOf(hosts()[0]));
check('snapshots reach every follower', flowing());
Date.now = realNow;
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
