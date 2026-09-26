#!/usr/bin/env python3
"""Dev server: like `python3 -m http.server`, but tells the browser not to cache, so
edited ES modules always reload. Also relays local Wi-Fi multiplayer on /mp (a small
WebSocket hub, standard library only): everyone on the same network who opens
http://<this machine>:<port> sees each other in the hub. The first real (non-bot)
player is the host: its game drives the red trucks and everyone else follows its
snapshots, so all players see — and ride — the same trucks.

Usage: python3 tools/serve.py [port]

Only whitelisted, type-checked fields are relayed (positions, poses, preset phrase and
name indices, look indices). No free text ever passes through, by design: it's a kids'
game and chat is preset phrases only.
"""
import base64, hashlib, http.server, json, math, struct, sys, threading, time
from functools import partial
from pathlib import Path

WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'   # RFC 6455
MAX_PLAYERS = 32
MAX_MSG = 4096
EMOTES = {'wave', 'dance', 'cheer', 'heart'}
POSES = {None, 'bench', 'lounge'}
GAMES = {None, 'crab', 'squid', 'monkey', 'tube', 'stall', 'banana', 'sofa', 'jetski', 'khaolam'}

clients = {}                    # id -> Client
clients_lock = threading.Lock()
next_id = [1]
host_id = [None]                # who simulates the shared red trucks
host_since = [0.0]
MAX_TRUCKS = 64
HOST_TIMEOUT = 3.0              # a host that sends no truck snapshots for this long is replaced


def num(v, lo, hi):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and lo <= v <= hi


def clean_hello(m):
    """Name = two indices into the preset name lists; look = small indices into palettes."""
    look = m.get('look') or {}
    ok = lambda k, n: isinstance(look.get(k), int) and 0 <= look[k] < n
    if not (isinstance(m.get('n1'), int) and 0 <= m['n1'] < 64 and isinstance(m.get('n2'), int) and 0 <= m['n2'] < 100):
        return None
    if not all(ok(k, 32) for k in ('shirt', 'skin', 'hat', 'hatColor', 'hair', 'bottom')):
        return None
    return {'n1': m['n1'], 'n2': m['n2'], 'look': {k: look[k] for k in ('shirt', 'skin', 'hat', 'hatColor', 'hair', 'bottom')}}


def clean_state(m):
    if not all(num(m.get(k), -1e5, 1e5) for k in ('x', 'y', 'z', 'yaw')):
        return None
    pose, busy = m.get('pose'), m.get('busy')
    if pose not in POSES or busy not in GAMES:
        return None
    ride = m.get('ride')
    if ride is not None and not (isinstance(ride, int) and 0 <= ride < MAX_TRUCKS):
        return None
    return {'x': round(m['x'], 2), 'y': round(m['y'], 2), 'z': round(m['z'], 2), 'yaw': round(m['yaw'], 3),
            'pose': pose, 'busy': busy, 'air': bool(m.get('air')), 'ride': ride}


def clean_trucks(m):
    lst = m.get('s')
    if not isinstance(lst, list) or len(lst) > MAX_TRUCKS:
        return None
    out = []
    for e in lst:
        if not (isinstance(e, list) and len(e) == 3 and num(e[0], 0, 1e5) and e[1] in (-1, 1) and num(e[2], 0, 50)):
            return None
        out.append(e)
    return out


def elect_host():
    """A visible, real (non-bot) player who actually sends truck snapshots hosts the
    trucks: keep the current host while it qualifies, else pick the lowest id. Hidden
    tabs (the browser throttles them) and silent clients (e.g. an old version) don't."""
    with clients_lock:
        ok = sorted(c.id for c in clients.values() if c.hello and not c.bot and not c.hidden and not c.silent)
    new = host_id[0] if host_id[0] in ok else (ok[0] if ok else None)
    if new != host_id[0]:
        host_id[0], host_since[0] = new, time.time()
        broadcast({'t': 'host', 'id': new})


def watchdog():
    while True:
        time.sleep(1)
        with clients_lock:
            host = clients.get(host_id[0])
        if host and time.time() - max(host.last_trucks, host_since[0]) > HOST_TIMEOUT:
            host.silent = True
            print(f'  mp: host {host.id} sends no trucks; choosing another', flush=True)
            elect_host()


class Client:
    def __init__(self, cid, sock):
        self.id, self.sock, self.lock = cid, sock, threading.Lock()
        self.hello, self.state, self.bot = None, None, False
        self.hidden, self.silent, self.last_trucks = False, False, 0.0

    def send(self, obj):
        data = json.dumps(obj, separators=(',', ':')).encode()
        n = len(data)
        head = bytes([0x81, n]) if n < 126 else bytes([0x81, 126]) + struct.pack('>H', n) if n < 65536 else bytes([0x81, 127]) + struct.pack('>Q', n)
        with self.lock:
            self.sock.sendall(head + data)


def broadcast(obj, skip=None):
    with clients_lock:
        targets = [c for c in clients.values() if c is not skip and c.hello]
    for c in targets:
        try:
            c.send(obj)
        except OSError:
            pass


def read_frame(rfile):
    """(opcode, payload) of one client frame, or (None, None) on close/error."""
    head = rfile.read(2)
    if len(head) < 2:
        return None, None
    op, n, masked = head[0] & 0x0F, head[1] & 0x7F, head[1] & 0x80
    if n == 126:
        n = struct.unpack('>H', rfile.read(2))[0]
    elif n == 127:
        n = struct.unpack('>Q', rfile.read(8))[0]
    if n > MAX_MSG or not masked:
        return None, None
    mask = rfile.read(4)
    data = bytearray(rfile.read(n))
    for i in range(len(data)):
        data[i] ^= mask[i % 4]
    return op, bytes(data)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        if not self.path.startswith('/mp'):
            super().log_message(fmt, *args)

    def do_GET(self):
        if self.path.split('?')[0] == '/mp' and self.headers.get('Upgrade', '').lower() == 'websocket':
            return self.websocket()
        return super().do_GET()

    def websocket(self):
        key = self.headers.get('Sec-WebSocket-Key', '')
        with clients_lock:
            full = len(clients) >= MAX_PLAYERS
        if not key or full:
            self.send_error(503 if full else 400)
            return
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.protocol_version = 'HTTP/1.1'                 # browsers reject an HTTP/1.0 101
        self.send_response_only(101)
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', accept)
        http.server.BaseHTTPRequestHandler.end_headers(self)
        self.wfile.flush()
        self.close_connection = True
        with clients_lock:
            cid = next_id[0]
            next_id[0] += 1
            me = clients[cid] = Client(cid, self.connection)
        print(f'  mp: player {cid} connected from {self.client_address[0]} ({len(clients)} online)', flush=True)
        try:
            while True:
                op, data = read_frame(self.rfile)
                if op is None or op == 0x8:
                    break
                if op == 0x9:                                   # ping → pong
                    with me.lock:
                        self.connection.sendall(bytes([0x8A, len(data)]) + data)
                    continue
                if op != 0x1:
                    continue
                try:
                    m = json.loads(data)
                except ValueError:
                    continue
                self.on_message(me, m)
        except (OSError, struct.error):
            pass
        finally:
            with clients_lock:
                clients.pop(cid, None)
                left = len(clients)
            if me.hello:
                broadcast({'t': 'leave', 'id': cid})
                elect_host()
            print(f'  mp: player {cid} left ({left} online)', flush=True)

    def on_message(self, me, m):
        t = m.get('t') if isinstance(m, dict) else None
        if t == 'hello':
            h = clean_hello(m)
            if not h:
                return
            first = me.hello is None
            me.hello, me.bot = h, bool(m.get('bot'))
            if first:
                with clients_lock:
                    others = [{'id': c.id, **c.hello, 'state': c.state} for c in clients.values() if c is not me and c.hello]
                me.send({'t': 'welcome', 'id': me.id, 'players': others, 'host': host_id[0]})
            broadcast({'t': 'join', 'id': me.id, **h, 'state': me.state}, skip=me)
            elect_host()
        elif t == 'state' and me.hello:
            s = clean_state(m)
            if s:
                me.state = s
                broadcast({'t': 'state', 'id': me.id, **s}, skip=me)
        elif t == 'trucks' and me.hello and me.id == host_id[0]:
            lst = clean_trucks(m)
            if lst is not None:
                me.last_trucks = time.time()
                broadcast({'t': 'trucks', 's': lst}, skip=me)
        elif t == 'vis' and me.hello:
            me.hidden = not m.get('on')
            if me.hidden and me.id == host_id[0] or not me.hidden and host_id[0] is None:
                elect_host()
        elif t == 'hold' and me.hello and isinstance(m.get('i'), int) and 0 <= m['i'] < MAX_TRUCKS:
            with clients_lock:
                host = clients.get(host_id[0])
            if host and host is not me:
                try:
                    host.send({'t': 'hold', 'id': me.id, 'i': m['i'], 'on': bool(m.get('on'))})
                except OSError:
                    pass
        elif t == 'say' and me.hello and isinstance(m.get('p'), int) and 0 <= m['p'] < 64:
            broadcast({'t': 'say', 'id': me.id, 'p': m['p']}, skip=me)
        elif t == 'emote' and me.hello and m.get('e') in EMOTES:
            broadcast({'t': 'emote', 'id': me.id, 'e': m['e']}, skip=me)


class Server(http.server.ThreadingHTTPServer):
    # the browser fetches ~60 ES modules at once (more with a phone on the LAN too);
    # the default backlog of 5 drops connections (ERR_CONNECTION_RESET)
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = Path(__file__).resolve().parent.parent
    threading.Thread(target=watchdog, daemon=True).start()
    print(f'serving {root} on http://localhost:{port} (multiplayer relay on /mp)', flush=True)
    Server(('', port), partial(Handler, directory=str(root))).serve_forever()
