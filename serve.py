#!/usr/bin/env python3
"""Static server for NicheScope. Avoids os.getcwd() (sandbox-blocked)."""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from functools import partial

ROOT = "/Users/fredjo/Documents/Claude/Projects/nichescope"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766

handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
print(f"NicheScope serving {ROOT} on http://localhost:{PORT}")
HTTPServer(("127.0.0.1", PORT), handler).serve_forever()
