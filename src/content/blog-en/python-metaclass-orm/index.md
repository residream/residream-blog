---
title: "Learning Python: From Metaclasses to an ORM Framework"
description: "Understanding how Python creates objects through metaclasses, then writing a simple ORM by hand."
publishDate: "2026-08-28T17:00:02"
tags:
  - "python"
heroImage:
  src: ../../blog/python-metaclass-orm/cytokine-nitro.jpg
  color: "#7E849F"
  alt: "Learning Python: From Metaclasses to an ORM Framework"
language: 'en'
draft: false
---

> I've been learning `Python` systematically lately, mainly following [Liao Xuefeng's Python tutorial](https://liaoxuefeng.com/books/python/introduction/index.html). Once you have some programming basics, I find that reading a web tutorial like this is more efficient than watching online course videos. The section on metaclasses was especially interesting, so I focused on writing down my understanding of it.

## About type()

`type()` has two uses. The one we usually know is

```python
type(obj)
```

which returns the type of an object.

For example:

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

`h` is an instance of `Hello`, and `Hello` is an instance of `type`.

`Hello` is a class object, and what creates it is `type`.

The second use is to **create classes dynamically**:

```python
type(name, bases, attrs)
```

The three arguments are:

```text
name
类名
bases
父类 tuple
attrs
类属性、方法 dict
```

For example:

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

This creates a class that is essentially equivalent to the previous one.

## About metaclasses

`type()` can create classes dynamically, while a `metaclass` lets you control how classes are created.

A `metaclass` is, as the name suggests, **the class of a class**.

Take an ordinary class:

```python
class Student:
    pass

s = Student()
```

Here, it's:

```text
Student → 创建 → s
```

With a metaclass, on the other hand,

```python
class MyMetaclass(type):
    ...
    
class Student(..., metaclass=MyMetaclass):
    ...
```

this becomes:

```text
MyMetaclass → 创建 → Student
Student     → 创建 → s
```

Here, the custom metaclass subclasses `type`, Python's default metaclass, so it can extend the usual class-creation behavior. This is the conventional approach; Python also allows other callables to act as metaclasses.

Now for a concrete example:

```python
# `metaclass`是类的模板，所以必须从`type`类型派生：
class ListMetaclass(type):
    def __new__(cls, name, bases, attrs):
        attrs['add'] = lambda self, value: self.append(value)
        return type.__new__(cls, name, bases, attrs)

class MyList(list, metaclass=ListMetaclass):
    pass
```

When `Python` creates the class object `MyList`, it sees the `list` argument, so the class inherits from `list`; it also sees the `metaclass=ListMetaclass` argument, so it calls `ListMetaclass.__new__` when creating `MyList`.

`__new__` takes four arguments here, which roughly correspond to:

```python
cls = ListMetaclass

name = 'MyList'

bases = (list,)

attrs = {
    '__module__': '__main__',	# `__module__`表示这个类或函数是在哪个`Python`模块里定义的
    '__qualname__': 'MyList'	# `__qualname__`翻译为限定名称/完整名称，表示对象定义在谁里面。
}
```

Put simply:

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

Notice that `attrs` is a dictionary that records the attributes defined in the class body, so that's where all our customization happens. The earlier `attrs['add'] = lambda self, value: self.append(value)` simply stuffs a `lambda` function under the key `add` into `MyList`, so the resulting class is similar to:

```python
class MyList(list):
  def add(self, value):
    self.append(value)
```

As for the final step, `return type.__new__(cls, name, bases, attrs)`: once `attrs` has been processed, the actual work of creating the class object is still handed off to `type.__new__`. You can think of it as:

```text
ListMetaclass.__new__
       │
       ├── 修改 attrs
       │
       └── 交给 type.__new__
                  ↓
              创建 MyList
```

You can also write it like this:

```python
return super().__new__(cls, name, bases, attrs)
```

## About super()

`super()` is Python's built-in function for **accessing methods/attributes of a parent class**, most commonly used with inheritance.

For example:

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, age):
        super().__init__(name)
        self.age = age
```

In this single-inheritance example, `super().__init__(...)` calls `Animal.__init__`, passing the current instance implicitly. It avoids hardcoding the base class's name and also supports cooperative multiple inheritance.

More precisely, though, `super()` isn't simply equivalent to "the parent class": it finds the next class according to the `MRO`.

## About the MRO

The `MRO`, or `Method Resolution Order`, is the **order in which Python resolves methods**: it determines which classes Python searches, and in what order, when looking up an attribute or method.

With single inheritance, you can think of it as the inheritance chain.

For example:

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

It looks equivalent to the inheritance chain:

```text
C
↓
B
↓
A
↓
object
```

With multiple inheritance, however, that way of thinking breaks down:

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

Here the inheritance structure looks like this:

```text
     D
   ↓ ↓
  B   C
   ↓ ↓
    A
    ↓
  object
```

and the lookup order is:

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

## From metaclasses to an ORM framework

With the concepts above, we now have a basic understanding of metaclasses. Using a metaclass to modify a class dynamically may seem pointless, though — it's clearly not as simple as just writing the `add` function into the `MyList` class definition. But once an `ORM` comes into the picture, modifying class definitions through a `metaclass` becomes really interesting.

`ORM` stands for `Object Relational Mapping`: it maps a row in a relational database to an object, which means one class corresponds to one table. That makes code simpler to write, since you don't have to work with SQL statements directly.

For example, in a relational database you'd need:

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

With an `ORM`, all you need is:

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

The core mappings of an `ORM` come in three layers:

```text
类 ↔ 表
类属性 ↔ 列
对象 ↔ 一行记录
```

You can see all three in the code above:

```python
class Users(Model)
```

reflects `class ↔ table`.

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

reflects `class attribute ↔ column`.

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

reflects `object ↔ row`.

```text
id        username     email            password
12345     Michael      test@orm.org     my-pwd
```

In this small ORM, a metaclass processes model declarations when the classes are created. The framework's users choose the fields, and the metaclass collects those declarations into table and column metadata. This is one way to implement an ORM, rather than a requirement for every ORM framework.

Let's start writing a simple `ORM` framework, then.

First, define the `Field` class. Each field stores a database column's name and type, providing the metadata for the class-attribute-to-column mapping:

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

Next comes `ModelMetaclass`, which collects those fields and records the class-to-table and attribute-to-column mappings. The `Model` class then uses that metadata to save an instance as a row:

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

It's easier to understand if we follow the order in which the code runs:

```python
class User(Model):
    # 定义类的属性到列的映射：
    id = IntegerField('id')
    name = StringField('username')
    email = StringField('email')
    password = StringField('password')
```

In the first snippet, when the user defines a `User` class, the `Python` interpreter first looks for a `metaclass` in the definition of `User` itself. If it doesn't find one, it keeps looking for a `metaclass` in the parent class `Model`, finds one there, and uses the `metaclass` defined in `Model`, `ModelMetaclass`, to create the `User` class. "Creating" here can be understood as reworking the `User` class: the original attributes such as `id` are turned into the `__mappings__` and `__table__` attributes, where `__mappings__` records the mapping from `python` attributes to column names and `__table__` records the table name.

```python
# 创建一个实例：
u = User(id=12345, name='Michael', email='test@orm.org', password='my-pwd')
```

The second snippet creates an instance. Since the `User` class has no initializer of its own, the `Python` interpreter calls `Model`'s initializer, which in turn calls `dict`'s initializer and records the key–value pairs passed in as a dictionary. So `u` is now essentially a dictionary, and magic methods like `__getattr__` and `__setattr__` add object-style access and modification on top of it, so that `u.name` reads the value stored at `u['name']`, and assigning to it updates that dictionary entry. That isn't demonstrated here, but it's worth noting that `__getattr__` is what makes `getattr(u, 'name')` able to find the attribute.

```python
# 保存到数据库：
u.save()
```

The third step is saving, which calls `Model`'s `save` function: the `fields` column names are taken from `u`'s `__mappings__` attribute, following the `python` attribute mappings set up earlier; `params` uses the `SQL` placeholder `?`; and the actual values for the columns in `args` are looked up by the keys of the `u` dictionary.

This flow also explains why the metaclass removed the `Field` class attributes `id/name/email/password` earlier: Python's lookup always tries normal attribute lookup first.

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

So if those attributes were still there, the lookup would find `User.name` in the `User` class — that is, `StringField('username')` — and return that `Field` object directly, **never calling** `Model.__getattr__('name')` at all.

Also, be careful not to mix these up:

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

The final output is:

```text
Found model: User
Found mapping: email ==> <StringField:email>
Found mapping: password ==> <StringField:password>
Found mapping: id ==> <IntegerField:uid>
Found mapping: name ==> <StringField:username>
SQL: insert into User (password,email,username,id) values (?,?,?,?)
ARGS: ['my-pwd', 'test@orm.org', 'Michael', 12345]
```

The `save()` method has already printed an executable `SQL` statement along with its argument list; all that's left to make it actually work is to connect to a real database and execute that `SQL` statement.
