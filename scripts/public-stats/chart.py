"""Keep a last-good, same-origin copy of the configured GitHub contribution chart."""

import fcntl
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from update import write_json


CHART_URL = "https://ghchart.rshah.org/659eb9/residream"
SVG_NS = "{http://www.w3.org/2000/svg}"
MAX_ATTEMPTS = 2
REQUEST_TIMEOUT = 8
RETRY_DELAY = 1


def read_chart_meta(directory):
    try:
        meta = json.loads((Path(directory) / "chart.json").read_text())
        return meta if isinstance(meta, dict) else {}
    except (FileNotFoundError, ValueError):
        return {}


def retryable(error):
    if isinstance(error, HTTPError):
        return error.code in {408, 500, 502, 503, 504}
    return isinstance(error, (URLError, TimeoutError, ConnectionError))


def error_name(error):
    return f"HTTP {error.code}" if isinstance(error, HTTPError) else type(error).__name__


def validate_svg(body):
    if not body or len(body) > 250_000:
        raise ValueError("Invalid chart size")
    document = re.sub(rb'^\s*<\?xml version="1\.0" standalone="no"\?>\s*', b'', body, count=1)
    doctype = b'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
    if document.startswith(doctype):
        document = document[len(doctype):]
    if b"<!" in document or b"<?" in document:
        raise ValueError("Invalid chart document")
    root = ET.fromstring(document)
    if root.tag != SVG_NS + "svg" or root.get("width") != "663" or root.get("height") != "104":
        raise ValueError("Unexpected chart dimensions")
    allowed = {"version", "width", "height", "x", "y", "style", "data-date", "data-score"}
    for node in root.iter():
        if node.tag not in {SVG_NS + tag for tag in ("svg", "rect", "text")}:
            raise ValueError("Unexpected chart element")
        if not set(node.attrib).issubset(allowed):
            raise ValueError("Unexpected chart attribute")
        style = node.get("style", "").lower()
        if any(token in style for token in ("url", "@", "\\", "&", "expression", "/*")):
            raise ValueError("Chart styles must not reference external resources")
    if len(root.findall(SVG_NS + "rect")) < 300:
        raise ValueError("Incomplete contribution chart")
    return document


def write_svg(path, body):
    body = validate_svg(body)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".chart-", delete=False) as file:
            temporary = file.name
            os.fchmod(file.fileno(), 0o644)
            file.write(body)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def chart_version(directory):
    path = directory / "github-contributions.svg"
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def refresh_chart(directory, *, seed=None, force=False, wait=False, now=None,
                  open_url=urlopen, sleep=time.sleep):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "github-contributions.svg"
    with (directory / "github-contributions.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | (0 if force or wait else fcntl.LOCK_NB))
        except BlockingIOError:
            return chart_version(directory)
        if not path.exists() and seed and seed.is_file():
            write_svg(path, seed.read_bytes())
        meta_path = directory / "chart.json"
        meta = read_chart_meta(directory)
        fixed_time = now
        now = time.time() if now is None else now
        checked = meta.get("checkedAt", 0)
        if not force and isinstance(checked, (int, float)) and 0 <= now - checked < 600:
            return chart_version(directory)
        meta.update(checkedAt=now, status="refreshing", attempts=0)
        write_json(meta_path, meta)
        headers = {"Accept": "image/svg+xml", "Accept-Encoding": "identity",
                   "User-Agent": "residream-blog-public-stats/1.0"}
        if path.exists():
            for field, header in (("etag", "If-None-Match"), ("lastModified", "If-Modified-Since")):
                if meta.get(field):
                    headers[header] = meta[field]
        for attempt in range(1, MAX_ATTEMPTS + 1):
            meta["attempts"] = attempt
            try:
                changed = False
                try:
                    with open_url(Request(CHART_URL, headers=headers), timeout=REQUEST_TIMEOUT) as response:
                        if response.headers.get_content_type() != "image/svg+xml":
                            raise ValueError("Expected an SVG response")
                        body = validate_svg(response.read(250_001))
                        changed = hashlib.sha256(body).hexdigest() != chart_version(directory)
                        if changed:
                            write_svg(path, body)
                        meta["etag"] = response.headers.get("ETag")
                        meta["lastModified"] = response.headers.get("Last-Modified")
                except HTTPError as error:
                    try:
                        if error.code != 304 or not path.exists():
                            raise
                    finally:
                        error.close()
                finished = time.time() if fixed_time is None else fixed_time
                success_at = datetime.fromtimestamp(finished, timezone.utc).isoformat()
                meta.update(status="ok", lastSuccessAt=success_at, lastError=None,
                            consecutiveFailures=0)
                if changed:
                    meta["lastChangedAt"] = success_at
                write_json(meta_path, meta)
                print(f"Contribution chart: {'updated' if changed else 'unchanged'}; "
                      f"success at {success_at}; attempt {attempt}/{MAX_ATTEMPTS}", flush=True)
                break
            except Exception as error:
                reason = error_name(error)
                if attempt < MAX_ATTEMPTS and retryable(error):
                    print(f"Retrying contribution chart after {reason}", flush=True)
                    sleep(RETRY_DELAY)
                    continue
                finished = time.time() if fixed_time is None else fixed_time
                previous_failures = meta.get("consecutiveFailures", 0)
                meta.update(status="error", lastError=reason,
                            lastErrorAt=datetime.fromtimestamp(finished, timezone.utc).isoformat(),
                            consecutiveFailures=(previous_failures if type(previous_failures) is int else 0) + 1)
                write_json(meta_path, meta)
                print(f"Kept previous contribution chart: {reason}; "
                      f"last success: {meta.get('lastSuccessAt', 'not yet recorded')}; "
                      f"attempts: {attempt}/{MAX_ATTEMPTS}", flush=True)
                break
        return chart_version(directory)
