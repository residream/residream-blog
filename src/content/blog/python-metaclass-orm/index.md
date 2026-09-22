---
title: "Python学习：从元类到ORM框架"
description: "记录 Python 中 type()、metaclass、super() 与 MRO 的关系，并通过简易 ORM 示例梳理类创建、字段映射和属性访问流程。"
publishDate: "2026-08-28T17:00:02"
tags:
  - "python"
heroImage: { src: './cytokine-nitro.jpg', color: '#7E849F' }
language: '简中'
draft: false
---

> 最近在系统性的学习 `Python` ，主要参考[廖雪峰的Python教程](https://liaoxuefeng.com/books/python/introduction/index.html)，感觉在掌握一些编程基础后直接看这种网页教程而非网课视频效率更高，而其中关于元类部分的概念比较有趣，所以着重记录理解了一下

## 关于type()

`type()` 有两种用法，平时熟悉的是

```python
type(obj)
```

用于查看一个对象的类型

例如

```text
>>> class Hello:
...     def hello(self, name='world'):
...         print('Hello, %s.' % name)
...         
>>> h = Hello()
>>> h.hello()
Hello, world.
>>> print(type(h))
<class '__main__.Hello'>
>>> print(type(Hello))
<class 'type'>
```

`h` 是 `Hello` 的实例，`Hello` 是 `type` 的实例

`Hello` 是一个类对象，负责创建它的是 `type`

第二种用法则是**动态创建类**

```python
type(name, bases, attrs)
```

三个参数分别是

```text
name
类名
bases
父类 tuple
attrs
类属性、方法 dict
```

例如

```text
>>> def fn(self, name='world'):	# 先定义函数
...     print('Hello, %s.' % name)
...
>>> Hello = type('Hello', (object,), dict(hello=fn))	# 创建`Hello class`
>>> h = Hello()
>>> h.hello()
Hello, world.
>>> print(type(h))
<class '__main__.Hello'>
>>> print(type(Hello))
<class 'type'>
```

这样就创建了与前者基本等价的类

## 关于metaclass

`type()` 可用于动态创建类，而 `metaclass` 则可以控制类的创建行为

`metaclass` 即为**元类**，即类的类

例如普通类

```python
class Student:
    pass

s = Student()
```

这里是

```text
Student → 创建 → s
```

而元类则是

```python
class MyMetaclass(type):
    ...
    
class Student(..., metaclass=MyMetaclass):
    ...
```

变成了

```text
MyMetaclass → 创建 → Student
Student     → 创建 → s
```

值得注意的是，这里元类必须继承 `type` ，因为 `type` 本身就是默认的元类，当要自定义元类时，当然要从 `type` 继承并加上自己的东西

再看具体例子

```python
# `metaclass`是类的模板，所以必须从`type`类型派生：
class ListMetaclass(type):
    def __new__(cls, name, bases, attrs):
        attrs['add'] = lambda self, value: self.append(value)
        return type.__new__(cls, name, bases, attrs)

class MyList(list, metaclass=ListMetaclass):
    pass
```

这里当 `Python` 创建 `MyList` 这个类对象时，会发现其有 `list` 参数，因此继承于 `list` ，同时有 `metaclass=ListMetaclass` 这个参数，因而会在创建 `MyList` 时调用 `ListMetaclass.__new__`

而 `__new__` 这里有四个参数，大致对应如下

```python
cls = ListMetaclass

name = 'MyList'

bases = (list,)

attrs = {
    '__module__': '__main__',	# `__module__`表示这个类或函数是在哪个`Python`模块里定义的
    '__qualname__': 'MyList'	# `__qualname__`翻译为限定名称/完整名称，表示对象定义在谁里面。
}
```

可以简单理解为

```text
cls
谁负责造类
→ ListMetaclass

name
要造的类叫什么
→ MyList

bases
它继承谁
→ (list,)

attrs
类体里面写了什么
→ 一个 dict
```

注意到这里 `attrs` 是个负责记录类体属性的字典，所以我们的自定义就集中在这一部分，前面的 `attrs['add'] = lambda self, value: self.append(value)` 就是往 `MyList` 里塞一个键名为 `add` 的 `lambda` 函数，因而创建出来的类类似于

```python
class MyList(list):
  def add(self, value):
    self.append(value)
```

至于后面 `return type.__new__(cls, name, bases, attrs)` 这一步则是因为加工完 `attrs` 后，真正创建类对象的工作还是交给 `type.__new__` ，即可以理解为

```text
ListMetaclass.__new__
       │
       ├── 修改 attrs
       │
       └── 交给 type.__new__
                  ↓
              创建 MyList
```

不过也可以用如下写法

```python
return super().__new__(cls, name, bases, attrs)
```

## 关于super()

`super()` 是 Python 里用来**访问父类方法/属性**的内置函数，最常见于继承

例如

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, age):
        super().__init__(name)
        self.age = age
```

这里的 `super().__init__(...)` 就等价于 `Animal.__init__(...)` ，这样不用写父类名，在多继承时更准确

但更准确地说，`super()` 不是简单等价于“父类”，而是按照 `MRO` 寻找下一个类

## 关于MRO

`MRO` ，即 `Method Resolution Order` ，翻译为**方法解析顺序**，它表示 Python 在查找属性或方法时，按照什么顺序去哪些类里找

在单继承中其可理解为继承链

例如

```text
>>> class A:
...     pass
... 
... class B(A):
...     pass
... 
... class C(B):
...     pass
...     
>>> print(C.__mro__)
(<class '__main__.C'>, <class '__main__.B'>, <class '__main__.A'>, <class 'object'>)
```

看起来和继承链等价

```text
C
↓
B
↓
A
↓
object
```

但多继承时这种理解会出现偏差

```text
>>> class A:
...     pass
... 
... class B(A):
...     pass
... 
... class C(A):
...     pass
... 
... class D(B, C):
...     pass
...     
>>> print(D.__mro__)
(<class '__main__.D'>, <class '__main__.B'>, <class '__main__.C'>, <class '__main__.A'>, <class 'object'>)
```

此时继承顺序类似

```text
     D
   ↓ ↓
  B   C
   ↓ ↓
    A
    ↓
  object
```

查找顺序为

```text
D
↓
B
↓
C
↓
A
↓
object
```

## 从元类到ORM框架

介绍完上面的概念后我们对元类已经有了初步理解，然而通过元类来动态修改看起来毫无意义，显然不如直接在 `MyList` 类定义时写上 `add` 函数简单，但当遇到 `ORM` 时通过 `metaclass` 修改类定义就显得十分有趣了

`ORM` 全称 `Object Relational Mapping` ，即对象-关系映射，就是把关系数据库的一行映射为一个对象，也就是一个类对应一个表，这样，写代码更简单，不用直接操作SQL语句

例如在关系型数据库中需要

```sql
CREATE TABLE Users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(50),
    email VARCHAR(100),
    password VARCHAR(100)
);

INSERT INTO Users (id, username, email, password)
VALUES (12345, 'Michael', 'test@orm.org', 'my-pwd');
```

而用了 `ORM` 后，只需要

```python
class Users(Model):
    id = IntegerField('id')
    name = StringField('username')
    email = StringField('email')
    password = StringField('password')

u = Users(
    id=12345,
    name='Michael',
    email='test@orm.org',
    password='my-pwd'
)

u.save()
```

而 `ORM` 最核心的映射关系有以下三层

```text
类 ↔ 表
类属性 ↔ 列
对象 ↔ 一行记录
```

在刚刚代码中就能体现出来

```python
class Users(Model)
```

体现了`类 ↔ 表`

```text
Python              数据库

Users类             Users表
```

```python
id = IntegerField('id')
name = StringField('username')
email = StringField('email')
password = StringField('password')
```

体现了`类属性 ↔ 列`

```text
Python              数据库

id属性               id列
name属性             username列
email属性            email列
password属性         password列
```

```python
u = User(id=12345, name='Michael', email='test@orm.org', password='my-pwd')
```

体现了`对象 ↔ 一行记录`

```text
id        username     email            password
12345     Michael      test@orm.org     my-pwd
```

所以要编写一个ORM框架，所有的类都只能动态定义，因为类对应着表，表的结构由使用者动态确定，类也需要动态改变

例如现在开始编写一个简易的 `ORM` 框架

首先定义 `Field` 类，其负责保存数据库表的字段名和字段类型，负责`类 ↔ 表`和`类属性 ↔ 列`的映射

```python
class Field(object):
    def __init__(self, name, column_type):
        self.name = name
        self.column_type = column_type
    def __str__(self):
        return '<%s:%s>' % (self.__class__.__name__, self.name)

class StringField(Field):
    def __init__(self, name):
        super(StringField, self).__init__(name, 'varchar(100)')

class IntegerField(Field):
    def __init__(self, name):
        super(IntegerField, self).__init__(name, 'bigint')
```

接下来就是关于元类 `ModelMetaclass` 的编写，负责`对象 ↔ 一行记录`的映射

```python
class ModelMetaclass(type):
    def __new__(cls, name, bases, attrs):
        if name=='Model':	# 排除掉对`Model`类的修改
            return type.__new__(cls, name, bases, attrs)
        print('Found model: %s' % name)
        mappings = dict()
        for k, v in attrs.items():
            if isinstance(v, Field):
                print('Found mapping: %s ==> %s' % (k, v))
                mappings[k] = v
        for k in mappings.keys():
            attrs.pop(k)
        attrs['__mappings__'] = mappings # 保存属性和列的映射关系
        attrs['__table__'] = name # 假设表名和类名一致
        return type.__new__(cls, name, bases, attrs)

class Model(dict, metaclass=ModelMetaclass):
    def __init__(self, **kw):
        super(Model, self).__init__(**kw)

    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            raise AttributeError(r"'Model' object has no attribute '%s'" % key)

    def __setattr__(self, key, value):
        self[key] = value

    def save(self):
        fields = []
        params = []
        args = []
        for k, v in self.__mappings__.items():
            fields.append(v.name)
            params.append('?')
            args.append(getattr(self, k, None))
        sql = 'insert into %s (%s) values (%s)' % (self.__table__, ','.join(fields), ','.join(params))
        print('SQL: %s' % sql)
        print('ARGS: %s' % str(args))
```

这里结合代码执行顺序会更好理解

```python
class User(Model):
    # 定义类的属性到列的映射：
    id = IntegerField('id')
    name = StringField('username')
    email = StringField('email')
    password = StringField('password')
```

第一段代码是当用户定义一个 `User` 类时，`Python` 解释器首先在当前类 `User` 的定义中查找 `metaclass` ，如果没有找到，就继续在父类 `Model` 中查找 `metaclass` ，找到了，就使用 `Model` 中定义的 `metaclass` 的 `ModelMetaclass` 来创建 `User` 类，这里的创建可以理解为把 `User` 类改造，改造结果是把原有的 `id` 这些属性变成 `__mappings__` 、`__table__` 属性，`__mappings__` 记录 `python` 属性到列名之间的映射，`__table__` 记录表名

```python
# 创建一个实例：
u = User(id=12345, name='Michael', email='test@orm.org', password='my-pwd')
```

第二段代码是创建实例，因为 `User` 类没有初始化函数，所以 `Python` 解释器会调用 `Model` 的初始化函数，从而进一步调用 `dict` 的初始化函数，把传入的键值对记录成字典，所以 `u` 现在本质是个字典，同时通过 `__getattr__` 和 `__setattr__` 这些魔术方法增加类似对象的访问修改方式，方便后续使用 `u.name` 可以拿到 `u['name']='Michael` 或者进行修改，不过这里并未做演示，但值得注意的是 `__getattr__` 保证了 `getattr(u, 'name')` 能查找到属性

```python
# 保存到数据库：
u.save()
```

第三步是保存，调用 `Model` 的 `save` 函数，`fileds` 列名根据之前写好的 `python` 属性映射关系通过 `u` 这个 `__mappings__` 属性来取，`params` 用 `SQL` 占位符 `?` ，`args` 列的具体参数根据 `u` 这个字典的键来找

这个流程也解释了前面元类删除 `id/name/email/password` 这些 `Field` 类属性的原因，Python 的查找顺序会先正常找属性

```text
getattr(u, 'name', None)
        ↓
本质上请求读取 u.name
        ↓
object.__getattribute__(u, 'name')
        ↓
  执行正常属性查找
        ↓
User / Model / dict / object 这条 MRO 中有没有 name
        ↓
      找不到
        ↓
才调用 Model.__getattr__(u, 'name')
        ↓
return self['name']
        ↓
如果字典里也没有
        ↓
抛 AttributeError
        ↓
getattr(..., None) 返回 None
```

于是它会在 `User` 类里找到 `User.name` 也就是 `StringField('username')` ，因此直接返回这个 `Field` 对象，**根本不会调用** `Model.__getattr__('name')`

同时注意不要混淆：

```text
getattr(obj, name, default)
Python 内置函数
主动发起一次属性读取

__getattribute__(self, name)
所有属性读取都会经过它
负责“正常属性查找”

__getattr__(self, name)
只有正常属性查找失败后才调用
属于兜底机制
```

最终输出如下

```text
Found model: User
Found mapping: email ==> <StringField:email>
Found mapping: password ==> <StringField:password>
Found mapping: id ==> <IntegerField:uid>
Found mapping: name ==> <StringField:username>
SQL: insert into User (password,email,username,id) values (?,?,?,?)
ARGS: ['my-pwd', 'test@orm.org', 'Michael', 12345]
```

`save()` 方法已经打印出了可执行的 `SQL` 语句以及参数列表，只需要真正连接到数据库，执行该 `SQL` 语句，就可以完成真正的功能
