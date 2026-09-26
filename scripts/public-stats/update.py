#!/usr/bin/env python3
"""Refresh the public numbers found in the deployed HTML, preserving successful values."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import fcntl
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.request import Request, urlopen


REPOSITORY = re.compile(r"repo:([\w.-]+/[\w.-]+):(stars|forks)", re.ASCII)
ACCOUNT = re.compile(r"account:(github/[\w-]+|(?:bilibili|steamgames|steamfriends)/\d+)", re.ASCII)
MAX_NUMBER = 2**53 - 1


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def date_value(value):
    if value is None:
        return 0
    if not isinstance(value, str):
        raise ValueError("Invalid update time")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Update time must include a timezone")
    return parsed.timestamp()


def valid_number(value):
    return type(value) is int and 0 <= value <= MAX_NUMBER


def valid_entry(entry):
    try:
        return (
            isinstance(entry, dict)
            and valid_number(entry.get("value"))
            and "updatedAt" in entry
            and date_value(entry["updatedAt"]) >= 0
        )
    except (ValueError, TypeError, OverflowError):
        return False


def source_for(key):
    repo = REPOSITORY.fullmatch(key)
    if repo:
        return "repo:" + repo[1]
    account = ACCOUNT.fullmatch(key)
    return "account:" + account[1] if account else None


class StatsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}

    def handle_starttag(self, tag, attrs):
        if tag not in {"span", "samp"}:
            return
        attrs = dict(attrs)
        key = attrs.get("data-stat-key")
        if not key or not source_for(key):
            return
        self.values.setdefault(key, None)
        raw = attrs.get("data-stat-value", "") or ""
        if not re.fullmatch(r"\d{1,16}", raw):
            return
        entry = {"value": int(raw), "updatedAt": attrs.get("data-stat-updated-at") or None}
        current = self.values[key]
        if valid_entry(entry) and (
            current is None or date_value(entry["updatedAt"]) > date_value(current["updatedAt"])
        ):
            self.values[key] = entry


def discover(web_root):
    if not (web_root / "index.html").is_file():
        raise ValueError("Web root has no index.html")
    values = {}
    for path in sorted(web_root.rglob("*.html")):
        parser = StatsParser()
        with path.open(encoding="utf-8") as file:
            for chunk in iter(lambda: file.read(65536), ""):
                parser.feed(chunk)
        parser.close()
        for key, entry in parser.values.items():
            current = values.get(key)
            if key not in values or (entry and (
                current is None or date_value(entry["updatedAt"]) > date_value(current["updatedAt"])
            )):
                values[key] = entry
    if not values:
        raise ValueError("No public statistics found in the deployed pages")
    return values


def read_snapshot(path):
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("values"), dict):
        raise ValueError("Invalid saved snapshot; refusing to overwrite it")
    return {
        key: entry for key, entry in data["values"].items()
        if source_for(key) and valid_entry(entry)
    }


def get_json(url):
    request = Request(url, headers={
        "Accept": "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "residream-blog-public-stats/1.0",
    })
    with urlopen(request, timeout=8) as response:
        body = response.read(1_000_001)
    if len(body) > 1_000_000:
        raise ValueError("API response too large")
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("Invalid API response")
    return data


def fetch_source(source, request=get_json):
    kind, identifier = source.split(":", 1)
    if kind == "repo":
        data = request("https://api.github.com/repos/" + identifier)
        if data.get("private") is not False or str(data.get("full_name", "")).lower() != identifier.lower():
            raise ValueError("Expected the configured public repository")
        values = {source + ":stars": data.get("stargazers_count"), source + ":forks": data.get("forks_count")}
    else:
        platform, account = identifier.split("/", 1)
        if platform == "github":
            data = request("https://api.github.com/users/" + account)
            if str(data.get("login", "")).lower() != account.lower():
                raise ValueError("GitHub account does not match")
            count = data.get("followers")
        else:
            count = None
            if platform == "bilibili":
                try:
                    data = request("https://api.bilibili.com/x/relation/stat?vmid=" + account)
                    if data.get("code") == 0:
                        count = data.get("data", {}).get("follower")
                except Exception:
                    pass
            if not valid_number(count):
                data = request("https://api.swo.moe/stats/" + identifier)
                if data.get("failed"):
                    raise ValueError("Statistics provider reported failure")
                count = data.get("count")
        values = {source: count}
    if not all(valid_number(value) for value in values.values()):
        raise ValueError("Expected nonnegative integer counts")
    updated_at = timestamp()
    return {key: {"value": value, "updatedAt": updated_at} for key, value in values.items()}


def refresh(seeds, previous, fetch=fetch_source):
    values = {}
    for key, seed in seeds.items():
        saved = previous.get(key)
        candidates = [entry for entry in (saved, seed) if valid_entry(entry)]
        if candidates:
            values[key] = max(candidates, key=lambda entry: date_value(entry["updatedAt"]))

    sources = sorted({source_for(key) for key in seeds})
    failures = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        tasks = {pool.submit(fetch, source): source for source in sources}
        for future in as_completed(tasks):
            source = tasks[future]
            try:
                received = future.result()
                expected = {key for key in seeds if source_for(key) == source}
                if not expected.issubset(received) or not all(valid_entry(received[key]) for key in expected):
                    raise ValueError("Incomplete or invalid statistics")
                for key in expected:
                    values[key] = received[key]
            except Exception as error:
                failures.append(source)
                print(f"Kept previous values for {source}: {type(error).__name__}", flush=True)
    return values, failures


def write_snapshot(path, values):
    payload = {"version": 1, "updatedAt": timestamp(), "values": values}
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=".stats-", delete=False) as file:
            temporary = file.name
            os.fchmod(file.fileno(), 0o644)
            json.dump(payload, file, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.with_suffix(".lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("An update is already running")
            return 0
        previous = read_snapshot(args.output)
        seeds = discover(args.web_root)
        values, failures = refresh(seeds, previous)
        if values != previous or not args.output.exists():
            write_snapshot(args.output, values)
        total = len({source_for(key) for key in seeds})
        print(f"Public statistics: {total - len(failures)}/{total} sources refreshed; {len(values)} values available", flush=True)
        return 1 if len(failures) == total else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"Update stopped; existing snapshot retained: {type(error).__name__}", flush=True)
        raise SystemExit(1)
