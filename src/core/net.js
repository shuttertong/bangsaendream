// WebSocket link to the local multiplayer relay (tools/serve.py, path /mp). If the page
// isn't served by it (e.g. a static host), the first attempts fail and we quietly stay
// single-player. Reconnects with backoff once it has worked.
import { REALTIME } from '../shared/config.js';
import { connectRealtime } from './realtime.js';

const NET = { path: '/mp', tries: 3, backoff: [1000, 15000] };

export function connect(handlers) {
  // static host (GitHub Pages): online via Supabase. ?online=<name> forces it anywhere, in a separate
  // test channel (e.g. ?online=test), so testing never drops fake players into the real hub.
  const test = new URLSearchParams(location.search).get('online');
  if (location.protocol === 'https:' || test !== null) {
    if (!REALTIME.key) return null;
    const tag = (test || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    return connectRealtime(tag ? { ...REALTIME, topic: `${REALTIME.topic}-${tag}` } : REALTIME, handlers);
  }
  if (location.protocol !== 'http:') return null;
  const { onOpen, onMessage, onClose } = handlers;                // plain http: the Wi-Fi relay in tools/serve.py
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${NET.path}`;
  let ws = null, ever = false, fails = 0, wait = NET.backoff[0], stopped = false;

  function open() {
    try { ws = new WebSocket(url); } catch { return; }
    ws.onopen = () => { ever = true; fails = 0; wait = NET.backoff[0]; onOpen?.(); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMessage(m); };
    ws.onclose = () => {
      if (ever) onClose?.();
      if (stopped || (!ever && ++fails >= NET.tries)) return;       // no relay here: single-player
      setTimeout(open, wait);
      wait = Math.min(wait * 2, NET.backoff[1]);
    };
  }
  open();
  return {
    send(obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); },
    get online() { return ws?.readyState === 1; },
    close() { stopped = true; ws?.close(); },
  };
}
