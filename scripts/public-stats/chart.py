"""Keep a last-good, same-origin copy of the configured GitHub contribution chart."""

import fcntl
from datetime import datetime, timezone
from email.parser import BytesParser
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
import xml.etree.ElementTree as ET

from update import write_json


CHART_URL = "https://ghchart.rshah.org/659eb9/residream"
SVG_NS = "{http://www.w3.org/2000/svg}"
MAX_ATTEMPTS = 2
REQUEST_TIMEOUT = 8
RETRY_DELAY = 1
DELAYED_RETRIES = (60, 300, 900)


class ChartFetchError(OSError):
    def __init__(self, code):
        self.code = code
        super().__init__(f"curl exit {code}")


def fetch_chart(headers, *, fallback=False):
    # curl bounds the entire transfer, including DNS/TLS and streamed responses.
    with tempfile.TemporaryDirectory(prefix="chart-fetch-") as directory:
        body_path = Path(directory) / "body.svg"
        headers_path = Path(directory) / "headers"
        command = ["curl", "--disable", "--silent", "--show-error", "--proto", "=https",
                   "--connect-timeout", "5", "--max-time", str(REQUEST_TIMEOUT),
                   "--max-filesize", "250000", "--output", str(body_path),
                   "--dump-header", str(headers_path), "--write-out", "%{http_code}"]
        if fallback:
            command += ["--ipv4", "--http1.1"]
        for name, value in headers.items():
            if not isinstance(value, str) or any(c in value for c in "\r\n"):
                raise ValueError("Invalid chart request header")
            command += ["--header", f"{name}: {value}"]
        command.append(CHART_URL)
        try:
            result = subprocess.run(command, capture_output=True, timeout=REQUEST_TIMEOUT + 1)
        except subprocess.TimeoutExpired as error:
            raise TimeoutError("Chart transfer deadline exceeded") from error
        if result.returncode:
            raise ChartFetchError(result.returncode)
        status = int(result.stdout)
        with headers_path.open("rb") as file:
            raw_headers = file.read(65537)
        if len(raw_headers) > 65536:
            raise ValueError("Chart response headers too large")
        # A proxy CONNECT or informational response can precede the final headers.
        blocks = [block for block in re.split(rb"\r?\n\r?\n", raw_headers)
                  if block.startswith(b"HTTP/")]
        if not blocks or b"\n" not in blocks[-1]:
            raise ValueError("Invalid chart response headers")
        response_headers = BytesParser().parsebytes(blocks[-1].split(b"\n", 1)[1])
        if status != 200:
            raise HTTPError(CHART_URL, status, "Chart response", response_headers, None)
        if response_headers.get_content_type() != "image/svg+xml":
            raise ValueError("Expected an SVG response")
        with body_path.open("rb") as file:
            body = validate_svg(file.read(250001))
        return body, response_headers


def read_chart_meta(directory):
    try:
        meta = json.loads((Path(directory) / "chart.json").read_text())
        return meta if isinstance(meta, dict) else {}
    except (FileNotFoundError, ValueError):
        return {}


def retryable(error):
    if isinstance(error, HTTPError):
        return error.code in {408, 500, 502, 503, 504}
    if isinstance(error, ChartFetchError):
        return error.code in {5, 6, 7, 16, 18, 28, 35, 52, 55, 56, 92, 95}
    return isinstance(error, (URLError, TimeoutError, ConnectionError))


def error_name(error):
    if isinstance(error, ChartFetchError):
        return f"curl exit {error.code}"
    return f"HTTP {error.code}" if isinstance(error, HTTPError) else type(error).__name__


def pending_retry(meta):
    at = meta.get("nextRetryAt")
    return meta.get("status") == "error" and type(at) in (int, float) and math.isfinite(at) and at > 0


def retry_due(meta, now):
    return pending_retry(meta) and now >= meta["nextRetryAt"]


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
                  fetch=None, sleep=time.sleep, retry_only=False):
    fetch = fetch or fetch_chart
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
        retrying = retry_due(meta, now) and not force
        if retry_only and not retrying:
            return chart_version(directory)
        if not force and pending_retry(meta) and not retrying:
            return chart_version(directory)
        checked = meta.get("checkedAt", 0)
        if not force and not retrying and isinstance(checked, (int, float)) and 0 <= now - checked < 600:
            return chart_version(directory)
        previous_retries = meta.get("retryCount", 0)
        retries = (previous_retries if type(previous_retries) is int else 0) + 1 if retrying else 0
        meta.update(checkedAt=now, status="refreshing", attempts=0, retryCount=retries,
                    nextRetryAt=None)
        write_json(meta_path, meta)
        headers = {"Accept": "image/svg+xml", "Accept-Encoding": "identity",
                   "User-Agent": "residream-blog-public-stats/1.0"}
        if path.exists():
            for field, header in (("etag", "If-None-Match"), ("lastModified", "If-Modified-Since")):
                if meta.get(field):
                    headers[header] = meta[field]
        for attempt in range(1, MAX_ATTEMPTS + 1):
            meta["attempts"] = attempt
            meta["transport"] = "curl-ipv4-http1.1" if attempt > 1 else "curl"
            try:
                changed = False
                try:
                    body, response_headers = fetch(headers, fallback=attempt > 1)
                    body = validate_svg(body)
                    changed = hashlib.sha256(body).hexdigest() != chart_version(directory)
                    if changed:
                        write_svg(path, body)
                    meta["etag"] = response_headers.get("ETag")
                    meta["lastModified"] = response_headers.get("Last-Modified")
                except HTTPError as error:
                    try:
                        if error.code != 304 or not path.exists():
                            raise
                    finally:
                        error.close()
                finished = time.time() if fixed_time is None else fixed_time
                success_at = datetime.fromtimestamp(finished, timezone.utc).isoformat()
                meta.update(status="ok", lastSuccessAt=success_at, lastError=None,
                            consecutiveFailures=0, retryCount=0, nextRetryAt=None)
                if changed:
                    meta["lastChangedAt"] = success_at
                write_json(meta_path, meta)
                print(f"Contribution chart: {'updated' if changed else 'unchanged'}; "
                      f"success at {success_at}; attempt {attempt}/{MAX_ATTEMPTS}; "
                      f"transport: {meta['transport']}", flush=True)
                break
            except Exception as error:
                reason = error_name(error)
                if attempt < MAX_ATTEMPTS and retryable(error):
                    print(f"Retrying contribution chart via IPv4/HTTP1.1 after {reason}", flush=True)
                    sleep(RETRY_DELAY)
                    continue
                finished = time.time() if fixed_time is None else fixed_time
                previous_failures = meta.get("consecutiveFailures", 0)
                meta.update(status="error", lastError=reason,
                            lastErrorAt=datetime.fromtimestamp(finished, timezone.utc).isoformat(),
                            consecutiveFailures=(previous_failures if type(previous_failures) is int else 0) + 1)
                if retryable(error) and 0 <= retries < len(DELAYED_RETRIES):
                    meta["nextRetryAt"] = finished + DELAYED_RETRIES[retries]
                write_json(meta_path, meta)
                print(f"Kept previous contribution chart: {reason}; "
                      f"last success: {meta.get('lastSuccessAt', 'not yet recorded')}; "
                      f"attempts: {attempt}/{MAX_ATTEMPTS}", flush=True)
                if meta["nextRetryAt"]:
                    retry_at = datetime.fromtimestamp(meta["nextRetryAt"], timezone.utc).isoformat()
                    print(f"Contribution chart delayed retry {retries + 1}/{len(DELAYED_RETRIES)} "
                          f"scheduled for {retry_at}", flush=True)
                break
        return chart_version(directory)
