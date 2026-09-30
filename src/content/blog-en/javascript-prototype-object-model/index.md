---
title: "Learning JavaScript: The Prototype-Based Object Model"
description: "Working through JavaScript's prototype chain to understand its prototype-based object model."
publishDate: "2026-09-05T05:10:03"
tags:
  - "javascript"
heroImage:
  src: ../../blog/javascript-prototype-object-model/cycling.jpg
  color: "#82829C"
  alt: "Learning JavaScript: The Prototype-Based Object Model"
language: 'en'
draft: false
---

> After working through Python systematically, I've started learning JavaScript the same way, mainly following [Liao Xuefeng's JavaScript tutorial](https://liaoxuefeng.com/books/javascript/introduction/index.html). I've run into the prototype chain many times in CTFs but never studied it properly, so that's what these notes focus on.

## The prototype chain

Many object-oriented languages, such as `Java` and `C#`, organize inheritance around **classes** and **instances**: a class describes a type of object, and instances are created from it. `JavaScript` instead builds object inheritance around **prototypes**. Modern `JavaScript` provides `class` syntax, but its object model still relies on the prototype chain.

First of all, in `JS` the key question is no longer which class the `xiaoming` object belongs to, but what `xiaoming`'s prototype object is, and what that prototype object's own prototype is, and so on — which gives us a prototype chain.

Let's start with the most basic kind of object in `JS`:

```javascript
const xiaoming = {
    name: "小明",
    age: 18,

    study() {
        console.log("学习");
    }
};
```

A `JS` object is essentially a dynamic collection of properties, which you can picture as:

```text
xiaoming
├── name: "小明"
├── age: 18
└── study: function
```

Properties can be added to it at runtime:

```javascript
xiaoming.score = 100;
```

which turns it into

```text
xiaoming
├── name: "小明"
├── age: 18
├── study: function
└── score: 100
```

Every ordinary `JS` object has an internal `[[Prototype]]` link whose value is either another object or `null`. Objects created with `Object.create(null)`, for example, have no prototype. For the ordinary `xiaoming` object above, even though we never defined a `toString` method, we can still call it directly:

```javascript
xiaoming.toString();
```

That's because the lookup isn't limited to `xiaoming` itself; it goes through the following steps:

```text
xiaoming
   │
   │ 没有 toString
   ↓
Object.prototype
   │
   │ 找到 toString
   ↓
  调用
```

So the chain for an ordinary object usually looks like this:

```text
xiaoming
    ↓
Object.prototype
    ↓
  null
```

When we access `xiaoming.xxx`, `JS` first looks for `xxx` on `xiaoming` itself. If it isn't there, it follows `xiaoming`'s `[[Prototype]]` to its prototype object and looks there; if it still isn't found, it moves on to the prototype object's own prototype, and so on. If the property is found anywhere along the chain, it's returned; otherwise the lookup eventually reaches `null` and returns `undefined`. This is **property lookup along the prototype chain**.

```javascript
function Student(name) {
    this.name = name;
    this.hello = function () {
        alert('Hello, ' + this.name + '!');
    }
}

let xiaoming = new Student('小明');
xiaoming.name; // '小明'
xiaoming.hello(); // Hello, 小明!
```

Now for the three most important — and most easily confused — `prototype` concepts:

```javascript
Student.prototype
xiaoming.__proto__
Object.getPrototypeOf(xiaoming)
```

First, `[[Prototype]]` is the object's actual internal "prototype link". Conceptually, `xiaoming`'s prototype object is whatever its `[[Prototype]]` points to, but you can't write that directly in `JS`. The standard way to get it is:

```javascript
Object.getPrototypeOf(xiaoming);
```

Historically, though, people often wrote:

```javascript
xiaoming.__proto__
```

`__proto__` is just an accessor that exists for historical reasons; it doesn't mean "the object really has an internal field called `__proto__`". It usually comes from `Object.prototype.__proto__` and usually returns the object's internal `[[Prototype]]`, which is why `Object.getPrototypeOf(xiaoming) === xiaoming.__proto__` returns `true`.

It isn't reliable on its own, though. For example:

```javascript
const obj = Object.create(null);
```

Its prototype chain is:

```text
obj
 ↓
null
```

so it doesn't have:

```javascript
Object.prototype
```

As a result,

```javascript
obj.__proto__
```

doesn't behave like the prototype accessor of an ordinary object.

It also comes with a range of other issues, such as compatibility and subtle, hard-to-spot behavior, so the current recommendation is not to use it to modify an object's prototype in ordinary code, and to prefer `Object.getPrototypeOf(obj)` and `Object.setPrototypeOf(obj, proto)` instead.

As for

```javascript
Student.prototype
```

it's something else entirely.

`prototype` is a property that `Student` owns — **a property of the function itself**.

When you use `new Student()`, `JS` points the new object's internal `[[Prototype]]` at the object referenced by `Student.prototype`, which is why `Object.getPrototypeOf(xiaoming) === Student.prototype` returns `true`.

In addition, an object created with `new Student()` can also reach a `constructor` property through the prototype chain, and it points to the function `Student` itself.

The resulting relationships are:

```text
            prototype
Student ───────────────► Student.prototype
   ▲                         ▲
   │                         │
   │ constructor             │ [[Prototype]]
   │                         │
   └────────────────────  xiaoming


xiaoming
   │
   │ [[Prototype]]
   ▼
Student.prototype
   │
   │ [[Prototype]]
   ▼
Object.prototype
   │
   ▼
  null
```

Put simply: `new` points the new object's `[[Prototype]]` at the object referenced by the constructor's `prototype` property, so that object becomes the new object's prototype object. `constructor`, meanwhile, usually already exists on the object referenced by `Constructor.prototype` and points back to the constructor itself.

```text
prototype
    构造函数的一个普通属性
    构造函数 ─────────► 原型对象

[[Prototype]]
    对象内部指向“原型对象”的内部链接
    实例对象 ─────────► 原型对象

constructor
    原型对象上的一个属性，通常指回构造函数
    原型对象 ─────────► 构造函数
```

Applied to our example: the function `Student` happens to have a property called `prototype`; the object that `Student.prototype` points to is `xiaoming`'s prototype object; and that prototype object in turn has a property `constructor`, which points back to the `Student` function itself.

It's worth noting, though, that besides:

```javascript
xiaoming.constructor === Student.prototype.constructor; // true
Student.prototype.constructor === Student; // true

Object.getPrototypeOf(xiaoming) === Student.prototype; // true

xiaoming instanceof Student; // true
```

`xiaoming.constructor === Student` also returns `true`. That doesn't mean `xiaoming` stores a `constructor` of its own — it's just another lookup along the prototype chain:

```text
xiaoming
   │
   │ 自身没有 constructor
   ▼
Student.prototype
   │
   └── constructor: Student
```

## Inheritance

### Prototypal inheritance

Although modern `JavaScript` provides `class` and instance syntax, its inheritance mechanism is still fundamentally built on the prototype chain. CTFs don't touch on this part much, though, so I'll only go over it briefly.

Early `JavaScript` had no `class` syntax, so inheritance was mainly implemented by modifying the prototype chain. For example:

```javascript
function Student(props) {
    this.name = props.name || 'Unnamed';
}

Student.prototype.hello = function () {
    alert('Hello, ' + this.name + '!');
}

function PrimaryStudent(props) {
    // 调用Student构造函数，绑定this变量:
    Student.call(this, props);
    this.grade = props.grade || 1;
}
```

Here,

```javascript
Student.call(this, props);
```

just borrows the `Student` constructor to initialize the `name` property on the current object.

At this point, no real prototypal inheritance has been set up yet. We've only borrowed the parent constructor to initialize properties (you can think of it as inheriting the parent's properties), but we still can't call its methods, because the prototype relationships are still:

```text
new PrimaryStudent() --> PrimaryStudent.prototype --> Object.prototype --> null
```

A lookup along this prototype chain never reaches the object referenced by `Student.prototype`.

So if we want objects created by `PrimaryStudent` to also be able to access

```javascript
Student.prototype.hello
```

we also need to set up

```text
new PrimaryStudent() --> PrimaryStudent.prototype --> Student.prototype --> Object.prototype --> null
```

as the prototype relationship.

To do this, following Douglas Crockford's code, the intermediate object can be implemented with an empty function `F`:

```javascript
// PrimaryStudent构造函数:
function PrimaryStudent(props) {
    Student.call(this, props);
    this.grade = props.grade || 1;
}

// 空函数F:
function F() {
}

// 让 F.prototype 引用 Student.prototype 所引用的那个对象。
// 因此，只要 F.prototype 不再被修改，之后通过 new F() 创建出的对象，
// 它们的 [[Prototype]] 都会指向 Student.prototype 所引用的对象：
F.prototype = Student.prototype;

// new F() 创建出一个对象，这个对象的 [[Prototype]]
// 指向 Student.prototype 所引用的对象。
// 再让 PrimaryStudent.prototype 引用这个新对象：
PrimaryStudent.prototype = new F();

// 把 PrimaryStudent 实例的原型对象上的 constructor 修复为 PrimaryStudent:
PrimaryStudent.prototype.constructor = PrimaryStudent;

// 继续在 PrimaryStudent.prototype 所引用的对象（就是 new F() 对象）上定义方法：
PrimaryStudent.prototype.getGrade = function () {
    return this.grade;
};

// 创建xiaoming:
let xiaoming = new PrimaryStudent({
    name: '小明',
    grade: 2
});
xiaoming.name; // '小明'
xiaoming.grade; // 2

// 验证原型:
xiaoming.__proto__ === PrimaryStudent.prototype; // true
xiaoming.__proto__.__proto__ === Student.prototype; // true

// 验证继承关系:
xiaoming instanceof PrimaryStudent; // true
xiaoming instanceof Student; // true
```

You can also simply write:

```javascript
PrimaryStudent.prototype = Object.create(Student.prototype);
PrimaryStudent.prototype.constructor = PrimaryStudent;
```

Now the prototype chain becomes:

```text
xiaoming
    │
    │ [[Prototype]]
    ↓
PrimaryStudent.prototype
    │
    │ [[Prototype]]
    ↓
Student.prototype
    │
    │ [[Prototype]]
    ↓
Object.prototype
    │
    ↓
   null
```

So for

```javascript
xiaoming.hello();
```

the lookup goes like this:

```text
xiaoming
    ↓ 没有 hello

PrimaryStudent.prototype
    ↓ 没有 hello

Student.prototype
    ↓ 找到 hello
```

That's inheritance implemented on top of the prototype chain.

Note that:

```javascript
xiaoming instanceof PrimaryStudent; // true
xiaoming instanceof Student;        // true
xiaoming instanceof Object;         // true
```

This isn't because `xiaoming` records that it belongs to three classes at once, but because the objects referenced by

```javascript
PrimaryStudent.prototype
Student.prototype
Object.prototype
```

all sit on `xiaoming`'s `[[Prototype]]` chain.

The core check performed by `instanceof` can be understood as:

```text
右侧构造函数的 prototype 属性所引用的对象
是否存在于
左侧对象的 [[Prototype]] 链中
```

For example,

```javascript
xiaoming instanceof Student
```

is essentially checking whether

```text
Student.prototype 所引用的对象
```

can be found in

```text
xiaoming
    ↓
PrimaryStudent.prototype
    ↓
Student.prototype
    ↓
Object.prototype
    ↓
null
```

that is, anywhere along this chain.

### Inheritance with class

#### class

With ES6, `JavaScript` introduced `class` syntax, which lets you describe objects in a form closer to languages like `Java` and `C++`:

```javascript
class Student {
    constructor(name) {
        this.name = name;
    }

    hello() {
        console.log("Hello, " + this.name);
    }
}

const xiaoming = new Student("小明");
```

Here,

```javascript
constructor(name) {
    this.name = name;
}
```

initializes the instance's own properties, while

```javascript
hello() {
    ...
}
```

isn't copied each time an instance is created. Instead, it lives on

```javascript
Student.prototype
```

— or, more precisely, on the object it references.

So we still have:

```javascript
Object.getPrototypeOf(xiaoming) === Student.prototype; // true
Student.prototype.constructor === Student;             // true
xiaoming instanceof Student;                           // true
```

and the relationships are still:

```text
             prototype
Student ─────────────────► Student.prototype
   ▲                            ▲
   │                            │
   │ constructor                │ [[Prototype]]
   │                            │
   └───────────────────────  xiaoming
```

So `class` doesn't change JavaScript's prototype-based object model; it just provides a more intuitive syntax for it.

#### extends

With `extends`, we can go a step further and implement inheritance:

```javascript
class Student {
    constructor(name) {
        this.name = name;
    }

    hello() {
        console.log("Hello, " + this.name);
    }
}

class PrimaryStudent extends Student {
    constructor(name, grade) {
        super(name);
        this.grade = grade;
    }

    getGrade() {
        return this.grade;
    }
}
```

Create an instance:

```javascript
const xiaoming = new PrimaryStudent("小明", 6);
```

Here,

```javascript
super(name);
```

calls the constructor logic of the parent class `Student`, which initializes

```javascript
this.name
```

while `extends` sets up the corresponding prototypal inheritance for us:

```text
xiaoming
    ↓
PrimaryStudent.prototype
    ↓
Student.prototype
    ↓
Object.prototype
    ↓
null
```

Therefore,

```javascript
xiaoming.getGrade();
```

is found on

```javascript
PrimaryStudent.prototype
```

— specifically, on the object it references — while

```javascript
xiaoming.hello();
```

continues along the prototype chain and is found on

```javascript
Student.prototype
```

— again, on the object it references.

So you can think of the traditional approach:

```javascript
PrimaryStudent.prototype = Object.create(Student.prototype);
```

and the modern approach:

```javascript
class PrimaryStudent extends Student
```

as achieving the same core goal — establishing

```text
PrimaryStudent.prototype
        ↓
Student.prototype
```

as the prototype relationship between the objects these two properties reference.

So the core idea behind object orientation in JavaScript is still:

```text
对象
 ↓
[[Prototype]]
 ↓
原型对象
 ↓
[[Prototype]]
 ↓
更上层的原型对象
 ↓
...
 ↓
null
```

Modern syntax such as `class`, `extends`, and `constructor` is ultimately still built on this prototype chain mechanism.