// Online multiplayer over Supabase Realtime (public channel, publishable key) — used on https
// hosts (the live GitHub Pages site), where there is no tools/serve.py. It speaks the Phoenix
// channel protocol directly (no library) and stands in for the relay inside each browser:
//   • who is here comes from Realtime presence (each player tracks {id, hello, bot, hidden, at});
//   • every message is broadcast to the channel and checked by each receiver with the same
//     whitelist the Wi-Fi relay uses (core/mpcheck.js) — no free text ever gets through;
//   • the truck host is picked the same way everywhere: the earliest-arrived visible real
//     player; a host that goes quiet for hostTimeout seconds is skipped.
// The game sees exactly the relay's messages (welcome / join / leave / host / state / trucks /
// hold / co / say / emote), so town/multiplayer.js, coop.js and the bots need no changes.
import { cleanHello, cleanState, cleanTrucks, cleanCo, cleanTo, okPhrase, okEmote, okTruck, LIMITS } from './mpcheck.js';

export function connectRealtime(cfg, { onOpen, onMessage, onClose }) {
  const topic = cfg.topic, peers = new Map();   // id → { hello, bot, hidden, at, state, lastTrucks, silent }
  const me = { id: 1 + Math.floor(Math.random() * 2 ** 30), hello: null, bot: false, hidden: document.visibilityState !== 'visible', at: Date.now() };
  let ws = null, ref = 0, joinRef = null, joined = false, ever = false, fails = 0, stopped = false;
  let wait = cfg.backoff[0], hostId = null, hostSince = 0, beat = null, watch = null;
  const now = () => Date.now();

  const raw = (event, payload, t = topic) => {
    if (ws?.readyState !== 1) return;
    ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++ref), join_ref: t === topic ? joinRef : null }));
  };
  const bcast = m => raw('broadcast', { type: 'broadcast', event: 'm', payload: { ...m, from: me.id } });
  const track = () => raw('presence', { type: 'presence', event: 'track', payload: { id: me.id, hello: me.hello, bot: me.bot, hidden: me.hidden, at: me.at } });

  // ---------- the truck host: same choice in every browser ----------
  function electHost() {
    const ok = [];
    if (me.hello && !me.bot && !me.hidden) ok.push(me);
    for (const [id, p] of peers) if (p.hello && !p.bot && !p.hidden && !p.silent) ok.push({ id, at: p.at });
    ok.sort((a, b) => a.at - b.at || a.id - b.id);
    const next = ok.some(p => p.id === hostId) ? hostId : ok[0]?.id ?? null;
    if (next !== hostId) { hostId = next; hostSince = now(); onMessage({ t: 'host', id: hostId }); }
  }
  function watchdog() {
    if (hostId === null || hostId === me.id) return;
    const p = peers.get(hostId);
    if (p && now() - Math.max(p.lastTrucks || 0, hostSince) > cfg.hostTimeout * 1000) { p.silent = true; electHost(); }
  }

  // ---------- presence: arrivals, changes, departures ----------
  function seen(meta) {
    const id = meta?.id;
    if (!Number.isInteger(id) || id === me.id) return;
    const hello = meta.hello ? cleanHello(meta.hello) : null;
    const old = peers.get(id), p = { ...old, hello: hello || old?.hello || null, bot: !!meta.bot, hidden: !!meta.hidden, at: Number.isFinite(meta.at) ? meta.at : now() };
    peers.set(id, p);
    if (hello && (!old?.hello || JSON.stringify(old.hello) !== JSON.stringify(hello))) onMessage({ t: 'join', id, ...hello, state: p.state || null });
  }
  function gone(id) {
    if (!peers.has(id)) return;
    const p = peers.get(id);
    peers.delete(id);
    if (p.hello) onMessage({ t: 'leave', id });
  }
  const metasOf = obj => Object.values(obj || {}).flatMap(v => v?.metas || []);
  function presence(event, payload) {
    if (event === 'presence_state') {
      const metas = metasOf(payload);
      if (!me.hello && metas.filter(m => m.id !== me.id).length >= LIMITS.players - 1) { stop(); return; }   // full: stay single-player
      for (const m of metas) seen(m);
    } else {
      const joins = metasOf(payload.joins), joinIds = new Set(joins.map(m => m.id));
      for (const m of metasOf(payload.leaves)) if (!joinIds.has(m.id)) gone(m.id);   // (an update is a leave + a join)
      for (const m of joins) seen(m);
    }
    electHost();
  }

  // ---------- messages from other players: checked, then handed to the game as the relay would ----------
  function receive(m) {
    const from = m?.from;
    if (!Number.isInteger(from) || from === me.id) return;
    const p = peers.get(from) || (peers.set(from, { hello: null, at: now() }), peers.get(from));
    switch (m.t) {
      case 'join': { const h = cleanHello(m); if (h) seen({ id: from, hello: h, bot: p.bot, hidden: p.hidden, at: p.at }); break; }
      case 'state': { const s = cleanState(m); if (s) { p.state = s; onMessage({ t: 'state', id: from, ...s }); } break; }
      case 'trucks': {
        if (from !== hostId) break;
        const s = cleanTrucks(m.s);
        if (s) { p.lastTrucks = now(); p.silent = false; onMessage({ t: 'trucks', s }); }
        break;
      }
      case 'hold': if (m.to === me.id && hostId === me.id && okTruck(m.i)) onMessage({ t: 'hold', id: from, i: m.i, on: !!m.on }); break;
      case 'co': {
        const to = cleanTo(m.to);
        if (to === undefined || (to && !to.includes(me.id))) break;
        try { onMessage({ t: 'co', from, d: cleanCo(m.d) }); } catch { /* not a valid co-op payload */ }
        break;
      }
      case 'say': if (okPhrase(m.p)) onMessage({ t: 'say', id: from, p: m.p }); break;
      case 'emote': if (okEmote(m.e)) onMessage({ t: 'emote', id: from, e: m.e }); break;
    }
  }

  // ---------- what the game sends (checked the same way before it leaves) ----------
  function send(m) {
    if (!joined || !m) return;
    switch (m.t) {
      case 'hello': {
        const h = cleanHello(m);
        if (!h) return;
        const first = !me.hello;
        me.hello = h; me.bot = !!m.bot;
        if (first) onMessage({ t: 'welcome', id: me.id, host: hostId, players: [...peers].filter(([, p]) => p.hello).map(([id, p]) => ({ id, ...p.hello, state: p.state || null })) });
        track(); bcast({ t: 'join', ...h }); electHost();
        break;
      }
      case 'state': { const s = cleanState(m); if (s) bcast({ t: 'state', ...s }); break; }
      case 'trucks': { if (hostId !== me.id) return; const s = cleanTrucks(m.s); if (s) bcast({ t: 'trucks', s }); break; }
      case 'vis': me.hidden = !m.on; if (me.hello) track(); electHost(); break;
      case 'hold': if (okTruck(m.i) && hostId !== null && hostId !== me.id) bcast({ t: 'hold', i: m.i, on: !!m.on, to: hostId }); break;
      case 'co': {
        const to = cleanTo(m.to);
        if (to === undefined) return;
        try { bcast({ t: 'co', to, d: cleanCo(m.d) }); } catch { /* invalid payload: not sent */ }
        break;
      }
      case 'say': if (okPhrase(m.p)) bcast({ t: 'say', p: m.p }); break;
      case 'emote': if (okEmote(m.e)) bcast({ t: 'emote', e: m.e }); break;
    }
  }

  // ---------- the socket ----------
  function open() {
    try { ws = new WebSocket(`${cfg.url}?apikey=${encodeURIComponent(cfg.key)}&vsn=1.0.0`); } catch { return; }
    ws.onopen = () => {
      joinRef = String(++ref);
      ws.send(JSON.stringify({ topic, event: 'phx_join', ref: joinRef, join_ref: joinRef,
        payload: { config: { broadcast: { self: false, ack: false }, presence: { key: String(me.id) }, private: false } } }));
      beat = setInterval(() => raw('heartbeat', {}, 'phoenix'), cfg.heartbeat * 1000);
      watch = setInterval(watchdog, 1000);
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.topic !== topic) return;
      if (m.event === 'phx_reply' && m.ref === joinRef) {
        if (m.payload?.status !== 'ok') { stop(); return; }
        joined = true; ever = true; fails = 0; wait = cfg.backoff[0];
        onOpen?.();
      } else if (m.event === 'broadcast') receive(m.payload?.payload);
      else if (m.event === 'presence_state' || m.event === 'presence_diff') presence(m.event, m.payload);
      else if (m.event === 'phx_error' || m.event === 'phx_close') ws.close();
    };
    ws.onclose = () => {
      clearInterval(beat); clearInterval(watch);
      const was = joined;
      joined = false; me.hello = null; hostId = null; peers.clear();
      if (was) onClose?.();
      if (stopped || (!ever && ++fails >= cfg.tries)) return;   // Realtime unreachable: single-player
      setTimeout(open, wait);
      wait = Math.min(wait * 2, cfg.backoff[1]);
    };
  }
  function stop() { stopped = true; ws?.close(); }
  open();

  return {
    send,
    get online() { return joined && ws?.readyState === 1; },
    close: stop,
    rates: cfg.rates,                          // online: slower updates (Supabase free-plan quota)
  };
}
