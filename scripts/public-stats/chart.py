"""Keep a last-good, same-origin copy of the configured GitHub contribution chart."""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from update import write_json


CHART_URL = "https://ghchart.rshah.org/659eb9/residream"
SVG_NS = "{http://www.w3.org/2000/svg}"


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


def refresh_chart(directory, *, seed=None, force=False, wait=False, now=None, open_url=urlopen):
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
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        now = time.time() if now is None else now
        checked = meta.get("checkedAt", 0)
        if not force and 0 <= now - checked < 600:
            return chart_version(directory)
        meta["checkedAt"] = now
        write_json(meta_path, meta)
        headers = {"Accept": "image/svg+xml", "Accept-Encoding": "identity",
                   "User-Agent": "residream-blog-public-stats/1.0"}
        if path.exists():
            for field, header in (("etag", "If-None-Match"), ("lastModified", "If-Modified-Since")):
                if meta.get(field):
                    headers[header] = meta[field]
        try:
            try:
                with open_url(Request(CHART_URL, headers=headers), timeout=8) as response:
                    if response.headers.get_content_type() != "image/svg+xml":
                        raise ValueError("Expected an SVG response")
                    body = response.read(250_001)
                    body = validate_svg(body)
                    if hashlib.sha256(body).hexdigest() != chart_version(directory):
                        write_svg(path, body)
                    meta["etag"] = response.headers.get("ETag")
                    meta["lastModified"] = response.headers.get("Last-Modified")
            except HTTPError as error:
                try:
                    if error.code != 304 or not path.exists():
                        raise
                finally:
                    error.close()
            write_json(meta_path, meta)
        except Exception as error:
            print(f"Kept previous contribution chart: {type(error).__name__}", flush=True)
        return chart_version(directory)
