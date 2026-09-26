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


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = Path(__file__).resolve().parent.parent
http.server.ThreadingHTTPServer(('', port), partial(NoCache, directory=str(root))).serve_forever()
