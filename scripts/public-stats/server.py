#!/usr/bin/env python3
"""Small loopback-only refresh endpoint behind Nginx; cached files stay static."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import parse_qs, urlsplit

from chart import refresh_chart
from update import read_seeds, refresh_saved


class RefreshServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, address, directory):
        self.directory = directory
        self.slots = threading.BoundedSemaphore(4)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        super().process_request(request, address)

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *args):
        pass

    def reply(self, status, payload):
        body = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            if len(self.path) > 4096:
                return self.reply(414, {"error": "Request too long"})
            url = urlsplit(self.path)
            if url.path != "/data/public-refresh.json":
                return self.reply(404, {"error": "Not found"})
            if self.headers.get("Sec-Fetch-Site") == "cross-site":
                return self.reply(403, {"error": "Same-origin requests only"})
            query = parse_qs(url.query, keep_blank_values=True, max_num_fields=65)
            output = self.server.directory / "public-stats.json"
            if query == {"chart": ["1"]}:
                version = refresh_chart(self.server.directory, wait=True)
                return self.reply(200, {"version": 1, "chart": version})
            if set(query) != {"key"} or not 1 <= len(query["key"]) <= 64:
                return self.reply(400, {"error": "Expected configured statistic keys"})
            keys = set(query["key"])
            if not keys.issubset(read_seeds(output)):
                return self.reply(400, {"error": "Unconfigured statistic"})
            values, _, _ = refresh_saved(output, keys=keys, wait=True)
            self.reply(200, {"version": 1, "values": {key: values[key] for key in keys if key in values}})
        except (ValueError, TypeError):
            self.reply(400, {"error": "Invalid request"})
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        except Exception as error:
            print(f"Refresh unavailable: {type(error).__name__}", flush=True)
            self.reply(503, {"error": "Refresh temporarily unavailable"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8791)
    args = parser.parse_args()
    RefreshServer(("127.0.0.1", args.port), args.directory).serve_forever()
