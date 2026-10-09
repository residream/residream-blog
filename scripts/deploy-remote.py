#!/usr/bin/env python3
"""Remote deployment transaction. Invoked over SSH by deploy.sh."""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import uuid


def atomic_json(file, value):
    temp = file.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False) + "\n")
    os.replace(temp, file)


def inventory(root):
    result = {}
    if not root.exists():
        return result
    for file in sorted(root.rglob("*")):
        if file.is_symlink():
            raise RuntimeError(f"发布目录不能包含符号链接：{file}")
        if not file.is_file() or file.relative_to(root).as_posix() == ".release":
            continue
        name = file.relative_to(root).as_posix()
        if any(ord(char) < 32 for char in name):
            raise RuntimeError("发布文件名不能包含控制字符")
        digest = hashlib.sha256()
        with file.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        result[name] = digest.hexdigest()
    return result


def changed_paths(before, after):
    return [name for name in sorted(before.keys() | after.keys()) if before.get(name) != after.get(name)]


def copy_tree(source, target):
    target.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["rsync", "-ac", "--delete", "--delay-updates", str(source) + "/", str(target) + "/"],
        check=True,
    )


def normalize(root):
    for file in [root, *root.rglob("*")]:
        if file.is_symlink():
            raise RuntimeError(f"发布目录不能包含符号链接：{file}")
        file.chmod(0o755 if file.is_dir() else 0o644)
        if os.geteuid() == 0:
            os.chown(file, 0, 0)


def canonical(name):
    if name == "index.html":
        return "/"
    if name.endswith("/index.html"):
        return "/" + name[:-11]
    return "/" + name


def verify(root, host, changed=()):
    from urllib.parse import quote

    checks = {"/": 200, "/this-page-does-not-exist": 404, "/index.php/archive/": 301}
    if (root / "en/index.html").is_file():
        checks["/en"] = 200
    sample = next((p for p in sorted(root.glob("blog/*/index.html")) if not p.parent.name[0].isdigit()), None)
    checks[canonical(sample.relative_to(root).as_posix()) if sample else "/blog"] = 200
    for name in [p for p in changed if p.endswith(".html") and Path(p).name != "404.html" and (root / p).is_file()][:10]:
        checks[canonical(name)] = 200
    failed = []
    for url, expected in checks.items():
        response = subprocess.run(
            ["curl", "-sS", "--connect-timeout", "10", "--max-time", "30", "-o", "/dev/null",
             "-w", "%{http_code}", "--resolve", f"{host}:443:127.0.0.1", f"https://{host}{quote(url, safe='/')}"],
            capture_output=True, text=True,
        )
        code = response.stdout.strip() if response.returncode == 0 else "000"
        print(f"  {url:40} {code}", flush=True)
        if code != str(expected):
            failed.append(url)
    if failed:
        raise RuntimeError("源站自检失败：" + ", ".join(failed))


class Deployment:
    def __init__(self, root, host):
        self.root = Path(root)
        if (not self.root.is_absolute() or len(self.root.parts) < 3 or str(self.root) != root
                or ".." in self.root.parts or self.root.resolve() != self.root
                or root in ("/var/www", "/srv/www", "/usr/share", "/usr/local")
                or not re.fullmatch(r"[A-Za-z0-9_./-]+", root)):
            raise RuntimeError("WEB_ROOT 必须是无符号链接的独立绝对目录")
        if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
            raise RuntimeError("SITE_HOST 必须是域名，不包含协议或路径")
        self.host = host
        self.previous = Path(root + ".prev")
        self.state = Path(root + ".deploy")
        self.queue = self.state / "purge"
        self.journal = self.state / "transaction.json"
        for file in [self.previous, self.state]:
            if file.is_symlink():
                raise RuntimeError(f"部署状态目录不能是符号链接：{file}")

    def lock(self):
        self.queue.mkdir(parents=True, exist_ok=True)
        self.handle = (self.state / "lock").open("a")
        try:
            fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("另一项发布或回滚正在进行，请稍后重试") from None
        host_file = self.state / "host"
        if host_file.exists() and host_file.read_text().strip() != self.host:
            raise RuntimeError("部署状态中的域名与 SITE_HOST 不同，请先核对配置")
        host_file.write_text(self.host + "\n")

    def pending(self):
        if self.journal.exists():
            raise RuntimeError("上次发布被中断；请先运行 bun run deploy --rollback 恢复，再清缓存")
        host_file = self.state / "host"
        if host_file.exists() and host_file.read_text().strip() != self.host:
            raise RuntimeError("部署状态中的域名与 SITE_HOST 不同")
        batches = [json.loads(p.read_text()) for p in sorted(self.queue.glob("*.json"))]
        return {"host": self.host, "batches": batches}

    def enqueue(self, paths, added=()):
        batch = {"id": uuid.uuid4().hex, "paths": paths, "added": list(added)}
        atomic_json(self.queue / (batch["id"] + ".json"), batch)

    def acknowledge(self, ids):
        for batch_id in ids:
            if not re.fullmatch(r"[0-9a-f]{32}", batch_id):
                raise RuntimeError("无效的缓存任务编号")
        for batch_id in ids:
            (self.queue / (batch_id + ".json")).unlink(missing_ok=True)

    def restore(self):
        journal = json.loads(self.journal.read_text())
        source = self.previous if journal["backup"] == "previous" else self.state / "rollback-backup"
        if not source.is_dir():
            raise RuntimeError("中断恢复所需的备份不存在，请保留部署目录并人工检查")
        copy_tree(source, self.root)
        normalize(self.root)
        if inventory(source) != inventory(self.root):
            raise RuntimeError("恢复后的文件校验失败，备份和中断标记均已保留")
        self.journal.unlink()
        shutil.rmtree(self.state / "rollback-backup", ignore_errors=True)
        print("  已恢复发布前的文件；待清缓存任务保留", flush=True)

    def publish(self, source, rollback=False):
        if self.journal.exists():
            print("  检测到中断的发布，先恢复完整备份", flush=True)
            self.restore()
        source = Path(source)
        if (source.resolve() != source or source == self.root
                or (not rollback and (source == self.previous or self.state in [source, *source.parents]))
                or self.root in source.parents or source in self.root.parents):
            raise RuntimeError("上传目录与网站目录必须独立，且不能包含符号链接")
        if not (source / "index.html").is_file() or not (source / "404.html").is_file():
            raise RuntimeError("待发布版本缺少 index.html 或 404.html")
        before, after = inventory(self.root), inventory(source)
        paths = changed_paths(before, after)
        if not paths:
            print("  文件内容没有变化，保留现有版本和备份", flush=True)
            return
        snapshot = Path(tempfile.mkdtemp(prefix="backup-", dir=self.state))
        try:
            if self.root.exists():
                copy_tree(self.root, snapshot)
            if inventory(snapshot) != before:
                raise RuntimeError("发布前备份校验失败，线上文件未改动")
            backup = self.state / "rollback-backup" if rollback else self.previous
            if backup.exists():
                shutil.rmtree(backup)
            snapshot.rename(backup)
        finally:
            if snapshot.exists():
                shutil.rmtree(snapshot)
        self.enqueue(paths, after.keys() - before.keys())
        atomic_json(self.journal, {"backup": "rollback" if rollback else "previous"})
        try:
            copy_tree(source, self.root)
            normalize(self.root)
            if inventory(self.root) != after:
                raise RuntimeError("发布后的文件内容校验失败")
            verify(self.root, self.host, paths)
        except BaseException:
            print("  发布未通过，正在恢复发布前的文件", file=sys.stderr, flush=True)
            self.restore()
            raise
        self.journal.unlink()
        shutil.rmtree(self.state / "rollback-backup", ignore_errors=True)
        print("  发布文件和源站自检均通过", flush=True)


def main():
    mode, root, host, *args = sys.argv[1:]
    deploy = Deployment(root, host)
    if mode == "pending":
        if deploy.state.exists():
            deploy.lock()
        print(json.dumps(deploy.pending(), ensure_ascii=False))
        return
    deploy.lock()
    if mode == "ack":
        deploy.acknowledge(args)
    elif mode in ("publish", "rollback"):
        deploy.publish(deploy.previous if mode == "rollback" else args[0], mode == "rollback")
    else:
        raise RuntimeError("未知部署操作")


if __name__ == "__main__":
    def interrupted(signum, _frame):
        raise RuntimeError(f"部署被信号 {signum} 中断")

    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, interrupted)
    try:
        main()
    except Exception as error:
        print(f"错误：{error}", file=sys.stderr)
        sys.exit(1)
