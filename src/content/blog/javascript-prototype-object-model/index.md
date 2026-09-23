---
title: "JavaScript学习：基于原型的对象模型"
description: "梳理 JavaScript 的原型链，理解基于原型的对象模型。"
publishDate: "2026-09-05T05:10:03"
tags:
  - "javascript"
heroImage: { src: './cycling.jpg', color: '#82829C' }
language: '简中'
draft: false
---

> 系统学完 Python 后开始系统学习 JavaScript，主要参考[廖雪峰的JavaScript教程](https://liaoxuefeng.com/books/javascript/introduction/index.html)，原型链这部分在 CTF 中见过很多次了，但没系统了解过，因此这里重点记录一下

## 原型链

大多数面向对象的编程语言，例如 `Java` 、`C#` ，其大都基于**类**和**实例**，即以类作为模板，然后根据这个模板创建出相应的实例，所以其面向对象的核心是基于类的，然而 `JavaScript` 最初却并不区分这两个概念，而是将**原型**看作实现面向对象的核心，即使是现代 `JavaScript` 加入了 `class` 和实例相关语法，其对象继承关系本质也仍建立在原型链之上

首先 `JS` 里最关键的问题不再是 `xiaoming` 这个对象属于什么类，而是 `xiaoming` 这个对象的原型对象是谁，其原型对象的原型对象又是谁，从而牵扯出一条原型链

先从 `JS` 中最基本的对象开始入手：

```javascript
const xiaoming = {
    name: "小明",
    age: 18,

    study() {
        console.log("学习");
    }
};
```

`JS` 对象本质上是一个动态的属性集合，可以理解为：

```text
xiaoming
├── name: "小明"
├── age: 18
└── study: function
```

其在运行时可以增加属性：

```javascript
xiaoming.score = 100;
```

从而变成

```text
xiaoming
├── name: "小明"
├── age: 18
├── study: function
└── score: 100
```

而每个普通 `JS` 对象背后还有一个原型对象，除了通过 `Object.create(null)` 创建的无原型对象外，普通对象通常都会通过 `[[Prototype]]` 指向原型对象并形成原型链，例如前面的 `xiaoming` ，即使没有定义其 `toString` 方法，也可以直接调用

```javascript
xiaoming.toString();
```

原因就在于其查找过程不止局限于 `xiaoming` ，而是按照以下步骤：

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

所以普通对象的链条通常是：

```text
xiaoming
    ↓
Object.prototype
    ↓
  null
```

当我们访问 `xiaoming.xxx` 时，`JS` 会先在 `xiaoming` 自己身上找 `xxx` ，没找到则通过 `xiaoming` 的 `[[Prototype]]` 去其原型对象找，还没找到就进一步去原型对象的原型对象找，在链条中找到了则返回，没找到则最终会到 `null` 并返回 `undefined` ，这就是**原型链属性查找**

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

现在开始介绍最关键且容易混淆的三个 `prototype` 概念

```javascript
Student.prototype
xiaoming.__proto__
Object.getPrototypeOf(xiaoming)
```

首先 `[[Prototype]]` 才是对象内部真正的“原型链接”，概念上 `xiaoming` 的原型对象就是其 `[[Prototype]]` 所指向的对象，但 `JS` 中并不能直接这么写，其标准获取方式应该是：

```javascript
Object.getPrototypeOf(xiaoming);
```

不过历史上经常这么写：

```javascript
xiaoming.__proto__
```

`__proto__` 只是历史上提供的一个访问器，并不是“对象内部真的有个叫 `__proto__` 的字段”，其通常来自于 `Object.prototype.__proto__` ，通常得到对象内部的 `[[Prototype]]` ，从而导致 `Object.getPrototypeOf(xiaoming) === xiaoming.__proto__` 返回 `true`

然而其本身并不可靠，例如：

```javascript
const obj = Object.create(null);
```

它的原型链是：

```text
obj
 ↓
null
```

因此没有：

```javascript
Object.prototype
```

于是：

```javascript
obj.__proto__
```

不会表现成普通对象的原型访问器

此外其还有一系列兼容性、隐蔽性等等问题，所以现在提倡不要在正常代码里直接用它修改对象的原型，而是优先使用 `Object.getPrototypeOf(obj)` 和 `Object.setPrototypeOf(obj, proto)`

至于：

```javascript
Student.prototype
```

则完全不同

`prototype` 是 `Student` **函数本身的一个属性**

当使用 `new Student()` 时，`JS` 会把新对象的内部 `[[Prototype]]` 指向 `Student.prototype` 所引用的对象，从而导致 `Object.getPrototypeOf(xiaoming) === Student.prototype` 返回 `true`

此外用 `new Student()` 创建的对象还可以沿原型链访问到一个 `constructor` 属性，它指向函数 `Student` 本身

最终关系是：

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

可以直接理解为：`new` 会把新对象的 `[[Prototype]]` 指向构造函数的 `prototype` 属性所引用的对象，因此该对象就成为新对象的原型对象；而 `constructor` 通常预先存在于 `构造函数.prototype` 所引用的对象上，并指回该构造函数本身

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

结合这里的实例就是，函数 `Student` 恰好有个属性 `prototype` ，`Student.prototype` 指向的对象就是 `xiaoming` 的原型对象，这个原型对象自己还有个属性 `constructor` ，指向 `Student` 函数本身

不过值得注意的是，除了：

```javascript
xiaoming.constructor === Student.prototype.constructor; // true
Student.prototype.constructor === Student; // true

Object.getPrototypeOf(xiaoming) === Student.prototype; // true

xiaoming instanceof Student; // true
```

还有 `xiaoming.constructor === Student` 也是返回 `true` ，其并不是说 `xiaoming` 自己保存了 `constructor` ，而是也按照了原型链进行了一次查找

```text
xiaoming
   │
   │ 自身没有 constructor
   ▼
Student.prototype
   │
   └── constructor: Student
```

## 继承

### 原型继承

现代 `JavaScript` 虽然提供了 `class` 和实例的语法，但其继承机制本质上仍建立在原型链之上，不过这一部分 CTF 不怎么涉及，所以只简要叙述一下

在早期 `JavaScript` 中并不存在 `class` 语法，继承主要通过修改原型链实现，例如：

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

这里：

```javascript
Student.call(this, props);
```

只是借用了 `Student` 构造函数，在当前对象上初始化 `name` 属性

此时并没有真正建立原型继承关系，我们只是借用父对象构造函数完成属性初始化(可以理解成继承了父对象属性)，却还不能调用其方法，原因在于目前的原型关系还是：

```text
new PrimaryStudent() --> PrimaryStudent.prototype --> Object.prototype --> null
```

沿着原型链的查找过程无法命中 `Student.prototype` 所引用的对象

因此，若希望 `PrimaryStudent` 创建出来的对象也能够访问：

```javascript
Student.prototype.hello
```

还需要建立：

```text
new PrimaryStudent() --> PrimaryStudent.prototype --> Student.prototype --> Object.prototype --> null
```

这样的原型关系

为了实现这一点，参考道格拉斯的代码，中间对象可以用一个空函数 `F` 来实现：

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

也可以直接写：

```javascript
PrimaryStudent.prototype = Object.create(Student.prototype);
PrimaryStudent.prototype.constructor = PrimaryStudent;
```

于是原型链变成了：

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

因此：

```javascript
xiaoming.hello();
```

查找过程为：

```text
xiaoming
    ↓ 没有 hello

PrimaryStudent.prototype
    ↓ 没有 hello

Student.prototype
    ↓ 找到 hello
```

这就是基于原型链实现的继承。

值得注意的是：

```javascript
xiaoming instanceof PrimaryStudent; // true
xiaoming instanceof Student;        // true
xiaoming instanceof Object;         // true
```

其原因并不是 `xiaoming` 同时记录了自己属于三个类，而是：

```javascript
PrimaryStudent.prototype
Student.prototype
Object.prototype
```

所引用的对象都位于 `xiaoming` 的 `[[Prototype]]` 链上。

其中 `instanceof` 的核心判断可以理解为：

```text
右侧构造函数的 prototype 属性所引用的对象
是否存在于
左侧对象的 [[Prototype]] 链中
```

例如：

```javascript
xiaoming instanceof Student
```

本质上是在检查：

```text
Student.prototype 所引用的对象
```

是否存在于：

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

这条链中

### class 继承

#### class

到了 ES6，`JavaScript` 引入了 `class` 语法，可以用更加接近 `Java`、`C++` 等语言的形式描述对象：

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

其中：

```javascript
constructor(name) {
    this.name = name;
}
```

用于初始化实例自身的属性，而：

```javascript
hello() {
    ...
}
```

并不是每创建一个实例就复制一份，而是存在于：

```javascript
Student.prototype
```

所引用的对象上

因此仍然有：

```javascript
Object.getPrototypeOf(xiaoming) === Student.prototype; // true
Student.prototype.constructor === Student;             // true
xiaoming instanceof Student;                           // true
```

其关系仍然是：

```text
             prototype
Student ─────────────────► Student.prototype
   ▲                            ▲
   │                            │
   │ constructor                │ [[Prototype]]
   │                            │
   └───────────────────────  xiaoming
```

所以 `class` 并没有改变 JavaScript 基于原型的对象模型，只是提供了一套更加直观的语法

#### extends

使用 `extends` 可以进一步实现继承：

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

创建实例：

```javascript
const xiaoming = new PrimaryStudent("小明", 6);
```

其中：

```javascript
super(name);
```

调用父类 `Student` 的构造逻辑，从而初始化：

```javascript
this.name
```

而 `extends` 则帮助我们建立了对应的原型继承关系：

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

因此：

```javascript
xiaoming.getGrade();
```

可以从：

```javascript
PrimaryStudent.prototype
```

所引用的对象中找到，而：

```javascript
xiaoming.hello();
```

则继续沿原型链，从：

```javascript
Student.prototype
```

所引用的对象中找到。

所以可以把传统写法：

```javascript
PrimaryStudent.prototype = Object.create(Student.prototype);
```

和现代写法：

```javascript
class PrimaryStudent extends Student
```

看作在实现类似的核心目标——建立：

```text
PrimaryStudent.prototype
        ↓
Student.prototype
```

这两个属性所引用对象之间的原型关系。

因此 JavaScript 面向对象最核心的理解仍然是：

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

`class`、`extends`、`constructor` 等现代语法最终仍然建立在这套原型链机制之上