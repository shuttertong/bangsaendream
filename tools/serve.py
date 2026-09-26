#!/usr/bin/env python3
"""Dev server: like `python3 -m http.server`, but tells the browser not to cache,
so edited ES modules always reload. Usage: python3 tools/serve.py [port]"""
import http.server, sys
from functools import partial
from pathlib import Path


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # the browser fetches ~60 ES modules at once (more with a phone on the LAN too);
    # the default backlog of 5 drops connections (ERR_CONNECTION_RESET)
    request_queue_size = 128
    daemon_threads = True


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = Path(__file__).resolve().parent.parent
Server(('', port), partial(NoCache, directory=str(root))).serve_forever()
