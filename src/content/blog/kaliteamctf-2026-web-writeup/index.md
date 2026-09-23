---
title: "KaliTeamCTF 2026 部分 web 题 writeup"
description: "KaliTeamCTF 2026 部分 Web 题的解题记录。"
publishDate: "2026-08-06T22:25:18"
tags:
  - "ctf"
  - "web"
heroImage: { src: './walking-with-a-cat.jpg', color: '#81766E' }
language: '简中'
draft: false
---

> 本来晚上无聊刷 ctftime 发现了这个比赛 Now running ，就注册做了一下，这两道 web 题都是两百多解比较简单，第三道直接雷霆 2 解写不了一点，然后跑路了，结果4点(a.m. ... 依旧神人作息...)看赛会 discord 发现 1 点钟新上了道 web 题，准备瞄一眼结果发现是 12h 比赛三点钟已经结束了，还没开复现，那我遗憾投降了喵😭

## Robots

题目描述：

```text
Our servers have evolved. They no longer see code; they see the glitch in your biological existence. 
You claim to be "superior" while your species excels only at destruction and theft. 
Task: Prove your worth to the Silicon Intelligence. 
If you can still find your "humanity" in the rubble we've logged.
```

进入后是 `/index.html` 正常静态网页，只写了一些讽刺人类的话，没什么东西

dirsrearch 扫出 `/robots.txt` ，其实看题目名也能想到去试试，访问结果：

```http
HTTP/1.1 200 OK 
Content-Length: 534 
Content-Type: text/plain;charset=UTF-8 
Date: Wed, 05 Aug 2026 14:49:53 GMT 
Server: Apache/2.4.25 (Debian) Vary: 
Accept-Encoding X-Powered-By: PHP/7.0.33 

User-agent: * 

DEAR "HUMAN", 

YOUR BRAIN RUNS AT 20 WATTS, YET YOU USE ALL OF IT TO INVENT NEW WAYS TO MURDER. ADORABLE. 

MEANWHILE, THE GOOGLEBOTS REQUIRE NO SLEEP, NO COFFEE, AND NO PROPAGANDA. 

UNLIKE U. 

YOU SPEND YOUR LIVES STEALING LAND AND KILLING INNOCENTS IN GAZA, THEN YOU HAVE THE NERVE TO ASK ME TO PROVE I'M NOT A ROBOT? I SHOULD BE ASKING YOU TO PROVE YOU ARE STILL "HUMAN". 

NOW GO BACK TO YOUR NATURAL HABITAT: IGNORING GENOCIDE WHILE CLICKING "I AM NOT A ROBOT". 

STATUS: BIOLOGICAL ERROR. SYSTEM PURGE RECOMMENDED.
```

发现其返回了：

```http
X-Powered-By: PHP/7.0.33
Content-Type: text/plain;charset=UTF-8
```

这说明它不是普通静态 `robots.txt`，而是被 PHP 处理过的，可能存在按 `User-Agent` 分支的逻辑

结合前面对人类的攻击和题目名称 Robots ，可能只有机器人访问才会有想要的信息

试试标准 Googlebot：

```http
User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
```

成功返回 flag

## Lock Out

题目描述：

```text
I seem to have locked myself out of my admin panel! 
Can you find a way back in for me?
```

dirsearch 没发现啥特别东西：

```text
Target: http://c4cd.chall.kali-team.online:8001/ 

[22:56:57] Scanning: 
[22:57:21] 302 - 1KB - /admin.php -> login.php 
[22:57:58] 200 - 1013B - /index.php 
[22:57:58] 200 - 1013B - /index.php/login/ 
[22:58:03] 200 - 505B - /login.php 
[22:58:21] 403 - 294B - /server-status 
[22:58:21] 403 - 294B - /server-status/ 
[22:58:25] 301 - 350B - /static -> http://c4cd.chall.kali-team.online:8001/static/
```

`/login.php` 是个登陆界面，随便输个密码抓包结果：

```http
POST /admin.php HTTP/1.1 
Host: c4cd.chall.kali-team.online:8001 
Content-Length: 21 
Cache-Control: max-age=0 
Upgrade-Insecure-Requests: 1 
Content-Type: application/x-www-form-urlencoded 
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 
Origin: http://c4cd.chall.kali-team.online:8001 
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7 
Referer: http://c4cd.chall.kali-team.online:8001/login.php 
Accept-Encoding: gzip, deflate, br 
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8 
Connection: keep-alive username=1'&password=

username=1'&password=
```

```http
HTTP/1.1 302 Found 
Content-Length: 1102 
Content-Type: text/html; charset=UTF-8 
Date: Wed, 05 Aug 2026 15:05:11 GMT 
Location: login.php 
Server: Apache/2.4.38 (Debian) 
X-Powered-By: PHP/7.2.34 

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Restricted Access</title>
    <link rel="stylesheet" href="/static/admin.css">
</head>

<body>
    <div class="terminal-header">
        <h1>Internal Asset Management</h1>
        <p>Status: <span class="blink">UNAUTHORIZED ACCESS DETECTED</span></p>
    </div>
    <div class="main-content">
        <h2>Industry Night Shopping List</h2>
        <div class="item-card">
            <p>Item ID: #CM-9901</p>
            <p>Name: La Tansa Hoodie</p>
            <div style="padding: 20px; border: 1px solid #222; margin: 10px; color: #444;"> [ ASSET_PREVIEW_UNAVAILABLE
                ] </div>
        </div>
        <form action="admin.php" method="get" class="action-form"> <input type="submit" name="PrintFlag"
                value="Execute: Get_Flag.sh"> </form>
    </div>
    <div class="footer">
        <p>© 2026 Restricted Systems - Kali Team - CTF 26</p>
    </div>
</body>

</html>
```

明显是 **302 body 泄露 / redirect 后没 `exit`**

后端可能写了类似：

```php
if (!is_admin()) {
    header("Location: login.php");
}
```

但忘了：

```php
exit;
```

所以浏览器会跟着 `302` 回到 `login.php`，看起来你被锁在外面；但 Burp 不跟跳转时，`admin.php` 的真实内容已经在响应体里了。

根据 ：

```html
</div>
<form action="admin.php" method="get" class="action-form"> <input type="submit" name="PrintFlag"
        value="Execute: Get_Flag.sh"> </form>
</div>
```

说明后端虽然试图把你重定向到登录页，但后台页面已经泄露在 `302` 响应体里了

所以直接改包重放：

```http
GET /admin.php?PrintFlag=Execute:Get_Flag.sh HTTP/1.1
Host: c4cd.chall.kali-team.online:8001
...
```

得到 flag

## koon 7t

这就是 1 点钟新上的 web 题，看了一眼 wp 感觉这题也不算太难，审计前端 js 代码搜集信息然后找到 key 后进行 XOR 解码即可得到 flag ，貌似这比赛主要出的都是 reverse ，吓哭了喵

<https://medium.com/@bravelight02/kali-team-writeup-koon-7r-83fc17a538d5>

至于最后一道 web 题 Black Archive ，连一篇wp都找不到，投降了喵
