---
title: "OOP复(yù)习(xí)笔记（五）：虚机制、多态与高级特性"
description: "OOP 复习笔记（五）：虚机制、多态与高级特性。"
publishDate: "2026-06-03T23:11:01"
tags:
  - "c-cpp"
heroImage: { src: './water-mirror.jpg', color: '#496C98' }
language: '简中'
draft: false
---

## 虚机制

### 静态编联与动态编联

程序调用一个成员函数时，究竟执行哪一个函数体，称为**编联**（binding，也常称绑定）。C++ 中最常见的两种情况是：

| 类型     | 决定时机 | 决定依据         | 别名             |
| -------- | -------- | ---------------- | ---------------- |
| 静态编联 | 编译期   | 表达式的静态类型 | 早绑定、静态绑定 |
| 动态编联 | 运行期   | 对象的实际类型   | 晚绑定、动态绑定 |

先看一个面积计算的例子：

```cpp
class Shape {
public:
    void show() const {
        std::cout << "面积是：" << area() << '\n';
    }

    double area() const {
        return 0.0;
    }
};

class Rectangle : public Shape {
public:
    Rectangle(double width, double height)
        : width_(width), height_(height) {}

    double area() const {
        return width_ * height_;
    }

private:
    double width_;
    double height_;
};

class Circle : public Shape {
public:
    explicit Circle(double radius) : radius_(radius) {}

    double area() const {
        return 3.14 * radius_ * radius_;
    }

private:
    double radius_;
};
```

直觉上，下面的代码应当输出矩形面积 `2` 与圆面积 `3.14`：

```cpp
Rectangle rectangle(1, 2);
Circle circle(1);

Shape& shape1 = rectangle;
Shape& shape2 = circle;

shape1.show();
shape2.show();
```

但上面的 `area()` 不是虚函数，两个调用都会输出 `0`。原因在于 `show()` 是 `Shape` 的成员函数，其中的 `area()` 可理解为：

```cpp
this->area();
```

在 `Shape::show()` 内，`this` 的静态类型是 `const Shape*`。普通成员函数按静态类型绑定，因此编译器选择的是 `Shape::area()`，而不是对象实际所属类中的同名函数。

**静态类型与动态类型。**

```cpp
Rectangle rectangle(1, 2);

Shape* pointer = &rectangle;
Shape& reference = rectangle;
Shape object = rectangle;
```

| 表达式      | 静态类型    | 动态类型                 |
| ----------- | ----------- | ------------------------ |
| `rectangle` | `Rectangle` | `Rectangle`              |
| `pointer`   | `Shape*`    | 指向的对象是 `Rectangle` |
| `reference` | `Shape&`    | 绑定的对象是 `Rectangle` |
| `object`    | `Shape`     | `Shape`                  |

最后一行发生了**对象切片**：`object` 是新创建的 `Shape` 对象，只复制了基类部分，已经不是原来的 `Rectangle`。指针和引用不会复制对象，所以仍能保留对象的实际类型。

动态编联要解决的正是这个问题：基类指针或引用所指向的实际对象可能不同，但可以通过同一套基类接口调用各自的实现。C++ 用**虚函数**提供这一能力。

### 虚函数

把 `Shape::area()` 声明为虚函数：

```cpp
class Shape {
public:
    virtual ~Shape() = default;

    void show() const {
        std::cout << "面积是：" << area() << '\n';
    }

    virtual double area() const {
        return 0.0;
    }
};

class Rectangle : public Shape {
public:
    Rectangle(double width, double height)
        : width_(width), height_(height) {}

    double area() const override {
        return width_ * height_;
    }

private:
    double width_;
    double height_;
};
```

现在 `Shape& shape = rectangle; shape.show();` 进入的仍然是非虚函数 `Shape::show()`，但 `show()` 内调用的 `area()` 是虚函数，会根据 `shape` 所绑定对象的实际类型调用 `Rectangle::area()`。

这说明一个很重要的事实：**外层函数不必是虚函数，只要其中需要变化的那一次调用是虚函数，仍可发生动态编联。**

#### 虚函数的声明规则

虚函数必须是**非静态成员函数**，基本格式为：

```cpp
virtual 返回类型 函数名(参数列表) const;
```

`const`、访问控制等都可以出现，但必须与重写关系匹配。下列成员不能声明为虚函数：

| 成员         | 原因                                     |
| ------------ | ---------------------------------------- |
| 静态成员函数 | 没有 `this` 指针，不属于某个具体对象     |
| 构造函数     | 对象尚未构造完整，不能按最终派生类型派发 |
| 拷贝构造函数 | 同样属于构造阶段                         |

析构函数可以是虚函数；赋值运算符通常不设计为虚函数。

#### 重写与 `override`

基类函数一旦是虚函数，派生类中同原型的函数即使不再写 `virtual`，也仍然是虚函数：

```cpp
class Base {
public:
    virtual void print() const;
};

class Derived : public Base {
public:
    void print() const; // 仍为虚函数
};
```

实际代码推荐写 `override`：

```cpp
class Derived : public Base {
public:
    void print() const override;
};
```

它让编译器检查这个函数是否真的重写了某个基类虚函数。比如漏写 `const`：

```cpp
class Derived : public Base {
public:
    // void print() override; // 错误：与 Base::print() const 不匹配
};
```

没有 `override` 时，这种笔误可能悄悄变成一个新的同名函数，导致多态失效。

构成重写通常要求函数名、参数列表以及 `const` 等限定一致；返回类型应相同，或满足**协变返回类型**规则。协变返回类型允许返回更具体的派生类指针或引用：

```cpp
class Document {
public:
    virtual Document* clone() const;
};

class Report : public Document {
public:
    Report* clone() const override;
};
```

`Report*` 可安全转换成 `Document*`，所以这样的返回类型是相容的。

#### 重写不是同名隐藏

派生类中只要声明同名成员，就会隐藏基类中同名的重载集合；参数不同并不构成重写：

```cpp
class Base {
public:
    virtual void set(int value);
    virtual void set(double value);
};

class Derived : public Base {
public:
    void set(); // 隐藏 Base::set(int) 和 Base::set(double)
};
```

此时 `Derived` 对象上直接写 `set(1)` 不能找到 `Base::set(int)`。若希望保留基类重载，可显式引入：

```cpp
class Derived : public Base {
public:
    using Base::set;
    void set();
};
```

`using` 解决的是名字查找问题；它不会把参数不同的 `Derived::set()` 变成对基类函数的重写。

#### 为什么多态基类需要虚析构函数

若类会通过基类指针指向派生类对象，并可能由该指针删除对象，基类析构函数必须是虚函数：

```cpp
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

Shape* shape = new Circle(3);
delete shape;
```

有了虚析构函数，`delete shape` 会先执行实际派生类的析构函数，再析构 `Shape` 基类部分。若析构函数不是虚函数，通过这种基类指针删除派生类对象是未定义行为，派生类持有的资源也可能得不到释放。

反过来，一个类若不打算作为多态基类使用，也不应仅为“保险”把析构函数声明为虚函数；虚函数会带来对象布局和调用上的额外成本。设计应以是否需要多态使用为依据。

### 虚函数表与虚调用机制

**虚函数表**（virtual table，常写作 vtable）和对象中的 **vptr** 是主流 C++ 实现虚函数的常见方式，但它们是实现细节，不是 C++ 标准规定的对象布局。学习它们的目的，是理解动态调用为什么可行，而不是依赖具体地址或内存排列写程序。

可以把一张虚函数表概念化地看作函数入口地址的表：

```text
Base 的虚函数表
├── Base 的析构函数入口
├── Base::f
└── Base::g

Derived 的虚函数表
├── Derived 的析构函数入口
├── Derived::f       ← 重写 Base::f
├── Base::g          ← 没有重写，继续使用基类实现
└── Derived::h       ← 派生类新增的虚函数
```

通常，同一类的多个对象共享一张虚函数表；每个多态对象通常保存一个隐藏指针 `vptr`，指向其实际类型对应的表。对象可抽象为：

```text
Circle 对象
├── vptr ───→ Circle 的虚函数表
└── radius_
```

**虚函数调用的两个阶段。** 以 `base_pointer->f()` 为例：

1. 编译期先根据 `base_pointer` 的静态类型，在基类中查找是否有参数匹配的 `f`；找不到就是编译错误。
2. 若找到的函数不是虚函数，调用静态绑定到基类版本。
3. 若找到的是虚函数，编译器会生成可在运行时派发的调用；运行时根据对象的实际类型选择对应重写版本。

可把第 3 步粗略理解为“通过对象的 `vptr` 找到虚表，再按已经确定的槽位取出函数入口”。槽位位置在编译时已知，运行时变化的是对象所关联的那张表。

```cpp
class Date {
public:
    virtual ~Date() = default;
    virtual void display() const {
        std::cout << "默认日期格式\n";
    }
};

class ChineseDate : public Date {
public:
    void display() const override {
        std::cout << "2008年12月31日\n";
    }
};

class AmericanDate : public Date {
public:
    void display() const override {
        std::cout << "12/31/2008\n";
    }
};

void printDate(const Date& date) {
    date.display();
}
```

`printDate` 不需要知道传入的是哪种日期；只需依赖稳定的 `Date` 接口。之后加入其他显示格式，通常也不必修改该函数。这正是面向抽象编程与运行时多态的价值。

要特别记住：动态绑定并不会绕过静态类型检查。

```cpp
class A {
public:
    virtual ~A() = default;
    virtual void f();
};

class B : public A {
public:
    void f() override;
    void onlyInB();
};

A* pointer = new B;
pointer->f();       // 合法，运行时调用 B::f()
// pointer->onlyInB(); // 错误：A 的接口中没有 onlyInB
delete pointer;
```

即使 `pointer` 实际指向 `B`，编译器也只允许通过 `A*` 使用 `A` 已声明的接口。需要依赖实际类型时，不应随意猜测或强制转换；后文的 RTTI 提供受检查的转换手段。

### 虚函数的访问

#### 普通成员函数中的虚调用

成员函数体中写 `f()`，可以理解成 `this->f()`。因此只要调用发生在对象正常存活期间、`f` 是虚函数，仍会按实际类型动态派发。

```cpp
class Base {
public:
    void run() {
        step();
    }

    virtual void step() {
        std::cout << "Base::step\n";
    }
};

class Derived : public Base {
public:
    void step() override {
        std::cout << "Derived::step\n";
    }
};

Base* base = new Derived;
base->run(); // Base::run 是非虚函数，但内部调用 Derived::step
delete base;
```

这里外层的 `run()` 静态绑定到 `Base::run()`；进入函数体后，`step()` 是另一场独立的虚调用，因此会分派到 `Derived::step()`。

虚函数的访问权限也不影响它是否能被重写。基类可以有私有虚函数，派生类仍可重写它；访问权限只决定某段代码能否通过某个静态类型的接口直接写出这次调用。

```cpp
class Base {
public:
    virtual ~Base() = default;

    void run() {
        work();
    }

private:
    virtual void work() {
        std::cout << "Base::work\n";
    }
};

class Derived : public Base {
private:
    void work() override {
        std::cout << "Derived::work\n";
    }
};

Base* base = new Derived;
base->run(); // 输出 Derived::work
delete base;
```

外部不能直接写 `base->work()`，因为它在 `Base` 中是私有的；但 `Base::run()` 有权调用自己的私有成员，且该调用仍按虚函数规则分派到 `Derived::work()`。

#### 构造与析构期间的虚调用

构造派生类对象时，先构造基类部分，后构造派生类部分；析构时顺序相反。C++ 规定：**在构造函数或析构函数中调用虚函数时，只调用当前构造或析构层次中的版本，不向更派生的类动态派发。**

```cpp
class Base {
public:
    Base() {
        show();
    }

    virtual ~Base() {
        show();
    }

    virtual void show() const {
        std::cout << "Base\n";
    }
};

class Derived : public Base {
public:
    Derived() {
        show();
    }

    ~Derived() override {
        show();
    }

    void show() const override {
        std::cout << "Derived\n";
    }
};
```

构造 `Derived` 时，`Base::Base()` 中的 `show()` 调用 `Base::show()`，因为 `Derived` 部分尚未构造完成；随后进入 `Derived::Derived()`，其中的 `show()` 才调用 `Derived::show()`。

析构时先执行 `Derived::~Derived()`，其中调用 `Derived::show()`；接着派生类部分已经销毁，进入 `Base::~Base()` 后只能调用 `Base::show()`。

这条规则是为了避免派生类虚函数访问尚未初始化或已经销毁的派生类数据。实务上，构造函数和析构函数通常不应依赖可重写的虚函数完成关键工作；应在对象完整构造后调用普通初始化流程，或由工厂、非成员函数协调。

### 具体类、抽象类与接口类

**具体类**可以创建具体对象：

```cpp
Rectangle rectangle(3, 4);
Circle circle(5);
```

**抽象类**则用于表达一类对象共有的高层接口，本身不能实例化。C++ 中，只要一个类含有至少一个**纯虚函数**，它就是抽象类：

```cpp
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

// Shape shape; // 错误：抽象类不能实例化
Shape* pointer = nullptr; // 可以声明指针或引用
```

纯虚函数的格式是在虚函数声明末尾写 `= 0`：

```cpp
virtual 返回类型 函数名(参数列表) const = 0;
```

派生类只有实现所有继承来的纯虚函数，才可能成为具体类：

```cpp
class Rectangle : public Shape {
public:
    Rectangle(double width, double height)
        : width_(width), height_(height) {}

    double area() const override {
        return width_ * height_;
    }

private:
    double width_;
    double height_;
};
```

若 `Rectangle` 不实现 `area()`，它也仍然是抽象类。

#### 纯虚函数也可以有定义

纯虚函数的作用是要求派生类提供接口，并不表示它绝对不能拥有默认实现。可以在类外给纯虚函数写定义：

```cpp
class Shape {
public:
    virtual double area() const = 0;
};

double Shape::area() const {
    return 0.0;
}
```

即使有这段定义，`Shape` 依然是抽象类；`= 0` 的身份不变。派生类需要时可显式复用默认实现：

```cpp
class Line : public Shape {
public:
    double area() const override {
        return Shape::area();
    }
};
```

纯虚析构函数尤其需要注意：它也必须提供定义，因为销毁派生类对象时最终仍会执行基类析构函数。

```cpp
class Interface {
public:
    virtual ~Interface() = 0;
};

Interface::~Interface() = default;
```

#### 接口类

C++ 没有 `interface` 关键字，通常用以公有纯虚函数为主、没有非静态数据成员的抽象类来表达接口：

```cpp
class AreaComputable {
public:
    virtual ~AreaComputable() = default;
    virtual double area() const = 0;
};

class Country : public AreaComputable {
public:
    virtual long population() const = 0;
};
```

这种设计把“能计算面积”与“如何计算面积”分开。接口可以多重继承，也可以被具体类实现；具体类只需兑现接口约定即可。

### 运行时类型识别（RTTI）

RTTI（Run-Time Type Information）用于在运行时查询多态对象的实际类型。它适合少量确实需要基于类型做判断的场景，但不应取代虚函数多态。

例如，若不同派生类只是“以不同方式完成同一件事”，应优先把差异设计成虚函数；若代码到处写“如果是 `Dog` 就……、如果是 `Cat` 就……”，往往说明行为没有放在合适的对象中。

#### `typeid`

`typeid` 是操作符，使用时包含 `<typeinfo>`。它返回 `const std::type_info` 对象的类型信息，可用于比较类型：

```cpp
#include <typeinfo>

class Animal {
public:
    virtual ~Animal() = default;
};

class Dog : public Animal {
};

Animal* animal = new Dog;
```

对**指针变量本身**使用 `typeid`，看到的是指针的静态类型：

```cpp
typeid(animal) == typeid(Animal*); // true
typeid(animal) == typeid(Dog*);    // false
```

若要查询指针所指对象的实际类型，应对对象解引用。对象的静态类型必须是多态类型（通常指含有虚函数的类型）：

```cpp
typeid(*animal) == typeid(Animal); // false
typeid(*animal) == typeid(Dog);    // true

delete animal;
```

简记为：`typeid(pointer)` 看指针变量，`typeid(*pointer)` 才可能看到所指多态对象的动态类型。对空的多态指针解引用使用 `typeid(*pointer)` 会抛出 `std::bad_typeid`，因此不能忽略空指针检查。

#### `dynamic_cast`

`dynamic_cast` 用于在多态类型层次中进行受运行时检查的转换，特别适合从基类指针或引用安全地向下转换：

```cpp
class Cat : public Animal {
public:
    void climb();
};

Animal* animal = getAnimal();

if (Dog* dog = dynamic_cast<Dog*>(animal)) {
    // animal 实际指向 Dog 或 Dog 的派生类
    // 可以安全使用 dog
} else {
    // 不是 Dog
}
```

指针形式转换失败时返回 `nullptr`：

```cpp
Animal* animal = new Cat;
Dog* dog = dynamic_cast<Dog*>(animal);

if (dog == nullptr) {
    std::cout << "不是 Dog\n";
}

delete animal;
```

引用不能取空值，所以引用形式失败时抛出 `std::bad_cast`：

```cpp
try {
    Dog& dog = dynamic_cast<Dog&>(*animal);
    // 使用 dog
} catch (const std::bad_cast&) {
    // 转换失败
}
```

`dynamic_cast` 的向下转换需要相关类型是多态类型；通常基类至少应有一个虚函数，最常见的就是虚析构函数。它也可处理某些横向转换和向上转换，但向上转换已有更简单的隐式转换，真正需要谨慎处理的是“基类究竟是不是某个特定派生类”的情况。

**RTTI 的使用边界。**

| 需求                               | 更合适的做法                             |
| ---------------------------------- | ---------------------------------------- |
| 同一操作因对象类型不同而有不同实现 | 设计虚函数                               |
| 必须调用某个派生类专有功能         | 使用 `dynamic_cast` 检查，再处理失败情况 |
| 仅为调试、日志或诊断确认实际类型   | 可以使用 `typeid`                        |
| 代码中频繁分支判断每一种派生类     | 重新检查类层次与虚函数设计               |

### 本章小结

| 主题                | 关键结论                                                 |
| ------------------- | -------------------------------------------------------- |
| 静态编联            | 编译期按表达式静态类型决定调用目标                       |
| 动态编联            | 运行期按对象实际类型选择虚函数重写版本                   |
| 虚函数              | 必须是非静态成员函数；派生类应使用 `override` 重写       |
| 虚析构函数          | 多态基类若可能通过基类指针删除对象，析构函数必须为虚函数 |
| 虚函数表            | 是常见实现模型，不是语言标准强制的对象布局               |
| 构造/析构中的虚调用 | 只调用当前构造或析构层次的本地版本                       |
| 抽象类              | 含有至少一个纯虚函数，不能直接实例化                     |
| RTTI                | `typeid` 查询类型；`dynamic_cast` 进行受检查的类型转换   |

多态的核心不是“让一个指针指向很多类型”，而是让调用方依赖稳定的基类接口，把具体行为留给对象自身决定。虚函数、抽象类与谨慎使用的 RTTI 共同构成了这套机制。

## 多态性及其应用

### 多态的含义

**多态性**（polymorphism）指相同的消息请求，在不同对象或不同参数条件下，执行不同的代码体，从而产生不同的行为结果。

在 C++ 中可以把一次成员调用抽象为：

```cpp
object.f(arguments);
```

调用者发出的消息名都是 `f`，但最终运行哪个 `f`，可能取决于：

- 目标对象的类型；
- 实参的类型；
- 调用发生在编译期还是运行期。

抽象、封装、继承让程序能够描述对象及其关系；多态进一步让调用者依赖稳定的接口，而不必把每种具体对象的差异都写进自己的分支里。它不是“代码更绕”的理由，而是应对变化的一种组织方式。

### 静态多态与动态多态

| 类别     | 调用目标的主要依据                           | 确定时机   | 典型机制       |
| -------- | -------------------------------------------- | ---------- | -------------- |
| 静态多态 | 目标对象和实参的静态类型                     | 编译期     | 函数重载、模板 |
| 动态多态 | 目标对象的动态类型；实参仍按静态类型参与匹配 | 运行期参与 | 虚函数         |

#### 静态多态：函数重载

同一个类可以有同名但参数列表不同的函数：

```cpp
class Printer {
public:
    void print(int value) {
        std::cout << "整数：" << value << '\n';
    }

    void print(char value) {
        std::cout << "字符：" << value << '\n';
    }
};

Printer printer;
printer.print(2);    // 编译期选择 print(int)
printer.print('c');  // 编译期选择 print(char)
```

两个调用的消息名都是 `print`，但实参的静态类型不同，编译器在编译期就已经决定要调用的函数体。这是静态多态。

#### 静态多态：模板

模板参数同样在编译期决定具体代码：

```cpp
template <typename T>
class ValuePrinter {
public:
    void print(const T& value) const {
        std::cout << value << '\n';
    }
};

ValuePrinter<int> integer_printer;
ValuePrinter<double> decimal_printer;

integer_printer.print(2);
decimal_printer.print(2.5);
```

`ValuePrinter<int>` 与 `ValuePrinter<double>` 是不同的实例化类型。模板让代码的写法可以复用，但实际使用哪份函数体由编译期类型决定，因此也是静态多态。

#### 动态多态：虚函数

第十八章介绍的虚函数体现了动态多态：

```cpp
class Shape {
public:
    virtual ~Shape() = default;
    virtual void draw() const = 0;
};

class Circle : public Shape {
public:
    void draw() const override {
        std::cout << "画圆\n";
    }
};

class Rectangle : public Shape {
public:
    void draw() const override {
        std::cout << "画矩形\n";
    }
};

void render(const Shape& shape) {
    shape.draw();
}
```

`render` 的形参静态类型是 `const Shape&`，但运行到 `shape.draw()` 时，会根据实际对象是 `Circle` 还是 `Rectangle`，分别调用不同的重写版本。

#### C++ 虚函数只对目标对象动态分派

一个容易混淆的边界是：C++ 的虚函数机制只根据**目标对象**的动态类型进行派发；对哪个重载进行匹配，实参仍主要按**静态类型**决定。它不是“对象和所有参数都按动态类型同时分派”的多方法机制。

```cpp
class B;

class A {
public:
    virtual ~A() = default;

    virtual void f(A*) {
        std::cout << "A::f(A*)\n";
    }

    virtual void f(B*) {
        std::cout << "A::f(B*)\n";
    }
};

class B : public A {
public:
    void f(A*) override {
        std::cout << "B::f(A*)\n";
    }

    void f(B*) override {
        std::cout << "B::f(B*)\n";
    }
};

B b;
A* pointer = &b;

pointer->f(&b);     // 实参静态类型是 B*，调用 B::f(B*)
pointer->f(pointer); // 实参静态类型是 A*，调用 B::f(A*)
b.f(pointer);        // 同样调用 B::f(A*)
```

第一步始终是编译期重载匹配：`&b` 的静态类型为 `B*`，`pointer` 的静态类型为 `A*`。选定对应的虚函数槽位之后，才根据接收者 `pointer` 实际指向 `B` 这一事实，选择 `B` 中的重写版本。

因此，下面两句话要同时成立：

1. 虚函数调用看目标对象的动态类型；
2. 重载匹配看实参表达式的静态类型。

如果需要根据两个对象的动态类型共同选择行为，不能只依赖普通虚函数重载；应重新设计接口，例如把行为放进某一方的虚函数、使用访问者模式，或在确有必要时做受控的 RTTI 判断。

### 虚机制的设计价值

虚函数表如何实现调用是语言机制层面的知识；更重要的设计问题是：它让哪些代码可以在变化中保持不动？

```cpp
class Payment {
public:
    virtual ~Payment() = default;
    virtual void pay(double amount) = 0;
};

class CardPayment : public Payment {
public:
    void pay(double amount) override;
};

class WalletPayment : public Payment {
public:
    void pay(double amount) override;
};

void checkout(Payment& payment, double amount) {
    payment.pay(amount);
}
```

`checkout` 只依赖 `Payment` 的稳定接口。以后加入 `BankTransferPayment`，只要它公有继承 `Payment` 并实现 `pay`，`checkout` 通常无须修改。这是虚机制最核心的价值：**在客户端访问接口不变的前提下，让具体实现可以变化。**

可以把这种结构理解为“通过子类型化适应变化”：

```text
Payment::pay()                 稳定接口
├── CardPayment::pay()         变化实现 1
├── WalletPayment::pay()       变化实现 2
└── BankTransferPayment::pay() 未来新增的变化实现
```

调用处写下的是 `payment.pay(amount)`，仅凭这一行通常无法知道最终执行哪个函数体；具体行为由运行时对象决定。这不是信息缺失，而是调用者与实现者之间有意建立的边界：调用者依赖“能支付”，而非依赖“以哪种方式支付”。

#### 在依赖和关联中使用基类接口

客户代码通常以两种方式使用多态基类。

**依赖：通过函数参数临时使用对象。**

```cpp
void drawOne(const Shape& shape) {
    shape.draw();
}
```

函数没有拥有对象，只在调用期间借用它。任意 `Shape` 的公有派生类都可作为参数传入。

**关联：对象长期保存协作对象。**

```cpp
#include <memory>
#include <utility>

class DrawingPanel {
public:
    explicit DrawingPanel(std::unique_ptr<Shape> shape)
        : shape_(std::move(shape)) {}

    void repaint() const {
        shape_->draw();
    }

private:
    std::unique_ptr<Shape> shape_;
};
```

这里 `DrawingPanel` 拥有一个 `Shape`，具体可以是任何派生类。使用 `std::unique_ptr` 同时清楚表达所有权：面板销毁时会自动销毁它所拥有的图形，无须手写 `delete`。

如果类只是借用、不拥有另一个对象，通常保存引用、原始观察指针，或由更上层对象协调生命周期；不要因为“能用多态”就模糊谁负责销毁对象。

### 虚机制的典型应用

#### 例一：把变化留给对象——老鼠吃水果

老鼠增加的体重取决于水果能量。变化的是不同水果计算能量的方式，稳定的是“水果能够提供能量”这件事：

```cpp
class Fruit {
public:
    virtual ~Fruit() = default;
    virtual double energy() const = 0;
};

class Apple : public Fruit {
public:
    double energy() const override {
        return 52.0;
    }
};

class Strawberry : public Fruit {
public:
    double energy() const override {
        return 33.0;
    }
};

class Mouse {
public:
    void eat(const Fruit& fruit) {
        weight_ += fruit.energy() * 0.1;
    }

    double weight() const {
        return weight_;
    }

private:
    double weight_ = 0.0;
};
```

`Mouse::eat` 不需要判断传入的是苹果还是草莓。未来增加 `Banana` 时，只需实现一个新的 `Fruit` 子类；`Mouse` 不需要增加 `if`、`switch` 或强制类型转换。

这种做法把“变化点”定位在 `Fruit::energy()`，让使用方只依赖抽象能力。若水果能量只是普通数据而没有随对象变化的计算，也可以用数据成员或值对象，不必为了使用继承而使用继承。

#### 例二：父类提供算法框架——模板方法

有些系统的整体流程稳定，但每一步的细节因产品类型不同而变化。此时可把流程固定在基类的非虚函数中，把可变步骤设计成受保护的虚函数：

```cpp
class Software {
public:
    virtual ~Software() = default;

    void develop() {
        design();
        code();
        test();
        maintain();
    }

protected:
    virtual void design() = 0;
    virtual void code() = 0;
    virtual void test() = 0;
    virtual void maintain() = 0;
};

class MobileApp : public Software {
protected:
    void design() override;
    void code() override;
    void test() override;
    void maintain() override;
};

class WebApp : public Software {
protected:
    void design() override;
    void code() override;
    void test() override;
    void maintain() override;
};
```

`develop()` 规定了设计、编码、测试、维护的顺序；`MobileApp` 与 `WebApp` 只实现各步骤的细节。这种“父类定义算法骨架，派生类填充可变步骤”的结构称为**模板方法**。

将流程函数保持为非虚函数很有价值：派生类可以改变步骤，但不能悄悄破坏整个流程的顺序。若业务确实允许流程也变化，才应把流程本身作为另一种可替换策略。

#### 例三：按实际类型复制对象——`clone()`

构造函数与拷贝构造函数不能是虚函数。假设手中只有 `const Shape&`，其实际对象可能是圆、矩形或未来的其他图形；直接按基类复制会发生对象切片，无法保留实际派生类类型。

不推荐通过 `typeid` 写长长的类型分支：

```cpp
// 不推荐：每加一种派生类都要修改这里
// if (typeid(shape) == typeid(Circle)) { ... }
// else if (typeid(shape) == typeid(Rectangle)) { ... }
```

更合适的做法是定义一个虚函数，由每个类调用自己的拷贝构造函数：

```cpp
#include <memory>

class Shape {
public:
    virtual ~Shape() = default;
    virtual std::unique_ptr<Shape> clone() const = 0;
};

class Circle : public Shape {
public:
    explicit Circle(double radius) : radius_(radius) {}

    std::unique_ptr<Shape> clone() const override {
        return std::make_unique<Circle>(*this);
    }

private:
    double radius_;
};

class Rectangle : public Shape {
public:
    Rectangle(double width, double height)
        : width_(width), height_(height) {}

    std::unique_ptr<Shape> clone() const override {
        return std::make_unique<Rectangle>(*this);
    }

private:
    double width_;
    double height_;
};

std::unique_ptr<Shape> duplicate(const Shape& shape) {
    return shape.clone();
}
```

若 `shape` 实际是 `Circle`，`duplicate` 会动态调用 `Circle::clone()`，复制出新的 `Circle`；`Rectangle` 同理。这个惯用法常被称为**虚拟拷贝构造函数**，但它本质上是一个普通虚函数，并不是真的把拷贝构造函数变成虚函数。

传统教材中常令 `clone()` 返回 `Shape*`。使用 `std::unique_ptr<Shape>` 更安全：返回对象的所有权已经写在类型中，调用者不必记住何时 `delete`。注意智能指针的模板类型不支持协变返回，所以所有重写版本都返回同一个 `std::unique_ptr<Shape>`；对象的实际类型仍由 `make_unique<Circle>` 等创建语句保留。

### 虚机制的边界：多个独立变化方向

继承和虚函数特别适合处理**一个主要变化方向**。如果一个类有多个彼此独立的可变行为，并试图把所有组合都塞进同一棵继承树，子类数量会迅速膨胀。

假设某类的三个行为分别有：

- `f()` 有 2 种实现；
- `g()` 有 3 种实现；
- `h()` 有 4 种实现。

若每个派生类都要同时决定三种行为，理论上需要的组合数是：

```text
2 × 3 × 4 = 24
```

这称为**子类爆炸**：每多一个独立变化维度，类数按乘法增长。更糟的是，许多组合类之间只差一两个函数，重复代码和维护成本都会增加。

#### 用组合拆分变化方向

更合适的设计是：让每个变化方向拥有自己的小接口和实现类，再由主对象通过关联把它们组合起来。

```cpp
#include <memory>
#include <utility>

class FStrategy {
public:
    virtual ~FStrategy() = default;
    virtual void run() = 0;
};

class GStrategy {
public:
    virtual ~GStrategy() = default;
    virtual void run() = 0;
};

class HStrategy {
public:
    virtual ~HStrategy() = default;
    virtual void run() = 0;
};

class X {
public:
    X(std::unique_ptr<FStrategy> f,
      std::unique_ptr<GStrategy> g,
      std::unique_ptr<HStrategy> h)
        : f_(std::move(f)), g_(std::move(g)), h_(std::move(h)) {}

    void f() {
        f_->run();
    }

    void g() {
        g_->run();
    }

    void h() {
        h_->run();
    }

private:
    std::unique_ptr<FStrategy> f_;
    std::unique_ptr<GStrategy> g_;
    std::unique_ptr<HStrategy> h_;
};
```

现在 `f` 的两种策略、`g` 的三种策略、`h` 的四种策略分别独立实现和测试；创建 `X` 时再自由组合。基本实现类数量从 `2 × 3 × 4 = 24` 降为 `2 + 3 + 4 = 9`。

```text
单棵继承树：  X_1_1_1、X_1_1_2、……、X_2_3_4
               └── 需要枚举全部组合，共 24 类

组合策略：      F 的 2 个实现 + G 的 3 个实现 + H 的 4 个实现
               └── 创建 X 时组装，共 9 个基础实现类
```

这并不意味着所有问题都能机械地改成组合：如果三个行为之间确实有紧密约束，仍需要专门的协调逻辑。但只要变化方向相互独立，优先考虑“组合多个小对象”，通常比“继承出所有组合”更容易扩展。

| 情况                               | 更合适的思路             |
| ---------------------------------- | ------------------------ |
| 一种对象类型有多种稳定的子类型实现 | 公有继承 + 虚函数        |
| 固定流程、少数步骤可变             | 模板方法                 |
| 多个彼此独立的行为维度             | 组合多个策略对象         |
| 需要复制但只持有基类接口           | `clone()`                |
| 客户端频繁按派生类型分支           | 先检查能否改为虚函数多态 |

### 本章小结

| 主题         | 关键结论                                       |
| ------------ | ---------------------------------------------- |
| 多态         | 相同消息在不同条件下可执行不同代码体           |
| 静态多态     | 函数重载、模板等在编译期决定                   |
| 动态多态     | 虚函数根据目标对象的实际类型在运行期派发       |
| C++ 的虚调用 | 接收者看动态类型，重载实参仍看静态类型         |
| 虚机制的价值 | 客户代码依赖稳定接口，实现可通过新增子类型扩展 |
| 模板方法     | 基类固定算法框架，派生类实现可变步骤           |
| `clone()`    | 以虚函数实现按动态类型复制对象                 |
| 多方向变化   | 避免穷举子类组合，优先用关联、依赖和组合拆分   |

多态真正带来的不是“调用目标不可见”，而是让变化被封装在该变化应当归属的对象中。调用方只表达自己需要的能力，系统便能在不反复修改旧代码的前提下接纳新的实现。

## 面向对象程序设计

### 从问题域到类设计

面向对象程序设计不是“先写几个类，再让它们互相调用”。更合理的顺序是：先理解问题域，再建立模型、确定职责和关系，最后才用 C++ 的类、函数与数据成员表达出来。

一个常见的设计过程可以概括为：

```text
建立模型
  ↓
细化模型
  ↓
类型的抽象与表示
  ↓
识别并封装重要变化
  ↓
用子类型化或组合适应变化
  ↓
根据反馈回到前面调整
```

这不是只能从上到下执行一次的流水线。设计者常常在后面发现“变化点判断错了”“职责放错了类”，再回到模型或表示阶段修改。因此，面向对象设计本质上是一个**迭代过程**。

| 阶段       | 主要问题                           | 典型产出               |
| ---------- | ---------------------------------- | ---------------------- |
| 建立模型   | 问题域中有哪些核心事物及其高层关系 | 粗粒度类型与关系       |
| 细化模型   | 各事物有哪些职责、如何协作         | 更具体的类型和行为     |
| 抽象与表示 | 如何用 C++ 类、函数、数据表达模型  | 类接口与内部表示       |
| 封装变化   | 哪些内容将来可能改变，值得隔离     | 可替换的协作对象或接口 |
| 适应变化   | 新实现如何加入而少改旧代码         | 子类型、策略、组合结构 |

#### 建立模型：先描述水平关系

建模初期应从问题域和领域知识出发，抽象核心概念及其关系。例如一个图书管理系统，最开始可能识别出：

- 读者；
- 图书；
- 借阅记录；
- 书库；
- 管理员。

此时的目标不是决定类里有几个 `int`，更不是急着画一棵继承树，而是先问：谁会使用谁？谁包含谁？谁负责哪项业务行为？

这类关系通常是**水平关系**：依赖、关联、聚合和组合。它们描述对象如何协作。建模早期先使用水平关系，有助于避免把“有联系”误认为“是一种”的继承关系。

#### 细化模型：让职责更具体

高层模型通常无法直接实现，需要逐步细化。图书管理系统可以继续明确：

- `Book` 负责书目信息与可借状态；
- `Loan` 负责一次借阅的起止信息；
- `Catalog` 负责查找和管理图书；
- `Member` 负责读者相关行为；
- `LibraryService` 协调借书、还书等流程。

细化时优先讨论**行为和职责**，再考虑数据。若没有足够的领域知识，类看起来可能很“整齐”，但职责分配会偏离真实业务，之后不得不反复打补丁。

#### 抽象与表示：先决定“是什么”，再决定“怎么存”

抽象是从问题中提取有意义的类型、行为和状态；表示是用 C++ 的类、成员函数、参数和成员变量实现它们。两者不能颠倒。

例如“坐标”这个抽象，在不同问题中可能有不同表示：

| 需求场景     | 可能的数据表示       |
| ------------ | -------------------- |
| 像素屏幕坐标 | 两个整数 `x, y`      |
| 平面几何计算 | 两个 `double`        |
| 三维空间     | `x, y, z` 三个分量   |
| 高精度测绘   | 专门的高精度数值类型 |

如果一开始把坐标的表示写死为 `int x, y` 并让外部直接访问，日后切换到浮点或三维坐标会波及大量代码。相反，先稳定对外语义，再把具体表示放进实现中，变化的影响范围就小得多。

```cpp
class Point {
public:
    Point(double x, double y);

    double x() const;
    double y() const;
    void translate(double dx, double dy);

private:
    double x_;
    double y_;
};
```

使用者依赖“读取坐标、平移坐标”这些语义；至于内部保存为直角坐标、极坐标还是其他形式，是 `Point` 自己的实现选择。

### 封装变化

软件会变化：需求、算法、数据格式、平台、外部服务，甚至团队对问题的理解都会变化。面向对象设计的目标不是预言所有未来，而是让**重要且真实的变化**尽量局限在少数位置。

考虑一个初步设计：

```cpp
class A {
public:
    void process(int count, int mode);

private:
    int values_[50];
};
```

其中至少可能包含四种变化：

| 可能变化                   | 原设计中耦合的位置     |
| -------------------------- | ---------------------- |
| 调用所需参数增减或含义变化 | `process(int, int)`    |
| 处理算法变化               | `process` 的函数体     |
| 元素类型变化               | `int`                  |
| 数据组织变化               | 固定数组 `values_[50]` |

不应为了“看起来面向对象”而立即把每一项都拆成抽象类；应先判断这些变化是否确实可能发生、发生代价是否值得提前承担。对需求稳定、实现很小的部分，直接实现往往更清楚。

若存储方式确实会变，可以把它从业务类中拆出：

```cpp
class DataStore {
public:
    virtual ~DataStore() = default;
    virtual void add(int value) = 0;
    virtual std::size_t size() const = 0;
};

class Processor {
public:
    explicit Processor(std::unique_ptr<DataStore> store)
        : store_(std::move(store)) {}

    void process(int value) {
        store_->add(value);
    }

private:
    std::unique_ptr<DataStore> store_;
};
```

`Processor` 依赖的是 `DataStore` 的能力，不依赖“数组、链表还是数据库”的具体表示。以后可以新增不同的 `DataStore` 实现，而无需重写 `Processor` 的业务流程。

封装变化时要避免两个极端：

| 极端           | 问题                                       |
| -------------- | ------------------------------------------ |
| 什么都写死     | 一处变化会迫使许多客户代码一起修改         |
| 什么都预先抽象 | 层级、接口和配置过多，系统反而难理解和维护 |

更好的原则是：根据真实需求、变化频率、改动成本和风险，优先封装那些明确而重要的变化点。

### 子类型化与多个变化方向

当一个变化点只有一个主要变化方向时，公有继承和虚函数可以提供很好的扩展能力：基类定义稳定接口，派生类提供不同实现。

```cpp
class Formatter {
public:
    virtual ~Formatter() = default;
    virtual std::string format(int value) const = 0;
};

class DecimalFormatter : public Formatter {
public:
    std::string format(int value) const override;
};

class HexFormatter : public Formatter {
public:
    std::string format(int value) const override;
};
```

以后增加新的格式，只需增加新的 `Formatter` 子类；依赖 `Formatter` 接口的客户代码通常不用改变。这种做法称为通过**子类型化**适应变化。

但继承树不适合承载多个彼此独立的变化维度。假设一个对象同时有：

- 两种输出格式；
- 三种存储方式；
- 四种传输方式。

若把全部组合都写成派生类，理论上需要：

```text
2 × 3 × 4 = 24 种组合类
```

正确的方向通常是先用水平关系把变化拆开，再让每个维度各自变化：

```text
主对象
├── Formatter   ：负责格式变化
├── DataStore   ：负责存储变化
└── Transport   ：负责传输变化
```

这样每条小继承树只处理一种变化；主对象通过组合协作对象来形成所需组合。继承用来表达类型变化，组合用来组合行为变化。

### 水平关系与继承的协作

类之间的关系可以粗略分为两类：

| 类型     | 常见关系               | 核心含义         | 复用特征 |
| -------- | ---------------------- | ---------------- | -------- |
| 水平关系 | 依赖、关联、聚合、组合 | 对象之间协作     | 黑盒复用 |
| 垂直关系 | 公有继承               | 派生类是一种基类 | 子类型化 |

在实际设计中，更常见也更健康的结构不是一棵很深的大继承树，而是许多短小的继承树通过水平关系协作——像一片低矮的灌木，而不是一根不断分叉的巨树。

公有继承应当表达真正的 is-a 关系：派生类对象能在需要基类对象的地方使用，并保持基类接口的语义。私有继承和保护继承很少是首选；若目标只是复用实现，通常应优先使用组合。

#### 依赖 + 继承：短期协作，具体类型可变

依赖通常表现为函数参数、局部变量或临时调用。调用方不拥有被依赖对象，只在某个操作期间使用其接口。

```cpp
class Fruit {
public:
    virtual ~Fruit() = default;
    virtual double weight() const = 0;
    virtual double edibleRatio() const = 0;
};

class Apple : public Fruit {
public:
    double weight() const override;
    double edibleRatio() const override;
};

class Orange : public Fruit {
public:
    double weight() const override;
    double edibleRatio() const override;
};

class Mouse {
public:
    explicit Mouse(double initial_weight)
        : weight_(initial_weight) {}

    void eat(const Fruit& fruit) {
        weight_ += fruit.weight() * fruit.edibleRatio();
    }

    double weight() const {
        return weight_;
    }

private:
    double weight_;
};
```

`Mouse::eat` 依赖 `Fruit`，而不是依赖 `Apple` 或 `Orange`。因此增加 `Banana`、`Strawberry` 等水果时，老鼠的代码不需要增加类型判断。

若老鼠种类也有变化，例如不同种类的吸收系数不同，可以把稳定的“吃水果”流程保留在基类，把变化抽成虚函数：

```cpp
class Mouse {
public:
    virtual ~Mouse() = default;

    void eat(const Fruit& fruit) {
        weight_ += fruit.weight() * fruit.edibleRatio() * absorption();
    }

    double weight() const {
        return weight_;
    }

protected:
    explicit Mouse(double initial_weight)
        : weight_(initial_weight) {}

    virtual double absorption() const = 0;

private:
    double weight_;
};

class BigMouse : public Mouse {
public:
    BigMouse(double initial_weight, double factor)
        : Mouse(initial_weight), factor_(factor) {}

protected:
    double absorption() const override {
        return factor_;
    }

private:
    double factor_;
};

class SmallMouse : public Mouse {
public:
    explicit SmallMouse(double initial_weight)
        : Mouse(initial_weight) {}

protected:
    double absorption() const override {
        return 0.2;
    }
};
```

这里有两条独立的继承树：水果决定重量和可食比例，老鼠决定吸收系数。`Mouse::eat` 让两边通过基类接口合作，而不需要列举“苹果被大老鼠吃”“橘子被小老鼠吃”等所有组合。

#### 双向依赖、自依赖与子类依赖

有时水果的可食比例也要取决于吃它的老鼠状态。可以把老鼠作为参数传回去：

```cpp
class Mouse;

class Fruit {
public:
    virtual ~Fruit() = default;
    virtual double weight() const = 0;
    virtual double edibleRatio(const Mouse& mouse) const = 0;
};

class Mouse {
public:
    void eat(const Fruit& fruit) {
        weight_ += fruit.weight() * fruit.edibleRatio(*this) * absorption();
    }

    double weight() const {
        return weight_;
    }

protected:
    virtual double absorption() const = 0;

private:
    double weight_ = 0.0;
};
```

`Mouse` 依赖 `Fruit`，`Fruit` 的实现也依赖 `Mouse`，这称为**双向依赖**。传入的 `*this` 静态类型为 `Mouse&`，实际可以绑定到 `BigMouse`、`SmallMouse` 等对象；水果若需要老鼠的可多态查询行为，应通过 `Mouse` 的虚函数接口获取。

类也可以依赖自身体系中的对象。怪物之间战斗就是典型的**自依赖**：

```cpp
class Monster {
public:
    virtual ~Monster() = default;

    bool fight(Monster& other) {
        while (true) {
            if (attack(other)) {
                return true;
            }
            if (other.attack(*this)) {
                return false;
            }
        }
    }

protected:
    virtual bool attack(Monster& other) = 0;
};
```

`fight` 是稳定流程，放在基类；`attack` 的具体效果由 `Dog`、`Cat` 等派生类实现。某个派生类也可以新增依赖于基类接口的行为：

```cpp
class Crocodile : public Monster {
public:
    void kill(Monster& target);

protected:
    bool attack(Monster& target) override;
};
```

`Crocodile` 一方面是一种 `Monster`，另一方面 `kill` 又依赖任何 `Monster`。继承关系和依赖关系可以同时存在，它们表达的是不同事实。

#### 关联 + 继承：长期协作，具体类型可变

关联表示一个对象在较长时间内保存另一个对象或其引用。成员类型写成基类接口时，被关联对象的具体类型可以在不修改当前类的前提下变化。

```cpp
class Vehicle {
public:
    virtual ~Vehicle() = default;
    virtual int maxSpeed() const = 0;
};

class Bandit {
public:
    int speed() const;
};

class Police {
public:
    explicit Police(const Vehicle& vehicle)
        : vehicle_(vehicle) {}

    bool canTrace(const Bandit& bandit) const {
        return vehicle_.maxSpeed() > bandit.speed();
    }

private:
    const Vehicle& vehicle_; // 借用：Vehicle 的生命周期必须长于 Police
};
```

`Police` 长期使用一辆 `Vehicle`，但不拥有它。它可以关联摩托车、轿车或未来的新交通工具，而无需知道其具体类型。引用表达了这里的非空借用关系；同时也提醒设计者必须安排好生命周期。

若一个类把自身某个操作的全部或部分实现交给关联对象，称为**委托**：

```cpp
class Computer {
public:
    virtual ~Computer() = default;
    virtual double calculateCircleArea(double radius) const = 0;
};

class Scientist {
public:
    explicit Scientist(const Computer& computer)
        : computer_(computer) {}

    double circleArea(double radius) const {
        return computer_.calculateCircleArea(radius);
    }

private:
    const Computer& computer_;
};
```

`Scientist` 表达“需要计算圆面积”，具体计算由 `Computer` 完成。替换计算器、桌面电脑、远程服务等实现时，`Scientist` 不必重写。这种复用不依赖对方内部实现，属于黑盒复用。

#### 组合 + 继承：整体拥有多态部分

如果整体负责创建和销毁部分对象，整体—部分关系就是**组合**。多态部分可以用 `std::unique_ptr<Base>` 保存，既能容纳不同子类，也能清楚表达所有权：

```cpp
class Fruit {
public:
    virtual ~Fruit() = default;
    virtual double weight() const = 0;
};

class Basket {
public:
    void add(std::unique_ptr<Fruit> fruit) {
        fruits_.push_back(std::move(fruit));
    }

    double totalWeight() const {
        double total = 0.0;
        for (const auto& fruit : fruits_) {
            total += fruit->weight();
        }
        return total;
    }

private:
    std::vector<std::unique_ptr<Fruit>> fruits_;
};
```

`Basket` 不需要分别维护“苹果数组”“橘子数组”。它只管理 `Fruit` 接口，因而可以装入各种水果。由于 `unique_ptr` 的存在，篮子销毁时会自动销毁其拥有的水果，也不需要手写析构函数逐个 `delete`。

整体—部分还可以形成递归结构。公司既是一种部门，又包含多个部门；叶子部门与子公司可以用相同的抽象处理：

```cpp
class Department {
public:
    virtual ~Department() = default;
    virtual void work() = 0;
};

class FinanceDepartment : public Department {
public:
    void work() override;
};

class Company : public Department {
public:
    void add(std::unique_ptr<Department> department) {
        departments_.push_back(std::move(department));
    }

    void work() override {
        for (const auto& department : departments_) {
            department->work();
        }
    }

private:
    std::vector<std::unique_ptr<Department>> departments_;
};
```

`FinanceDepartment` 是叶子节点；`Company` 既是 `Department`，又组合了多个 `Department`。因此公司可以包含部门，也可以包含分公司，形成递归的组合结构。调用方只处理 `Department` 接口，无须区分当前拿到的是叶子还是容器。

### 关系选择清单

| 需要表达的事实               | 优先选择         | 常见代码形态                      |
| ---------------------------- | ---------------- | --------------------------------- |
| 只在一次操作中使用对象       | 依赖             | 函数参数 `const T&`、`T&`、`T*`   |
| 长期使用但不拥有对象         | 关联             | 成员 `T&` 或观察指针              |
| 整体拥有部分并控制其生命周期 | 组合             | `std::unique_ptr<T>` 成员或值成员 |
| 多个对象共享部分的生命周期   | 聚合或共享所有权 | 需明确生命周期与共享规则          |
| 派生类能够当作基类使用       | 公有继承         | `class Derived : public Base`     |
| 只想复用另一对象的能力       | 优先组合/委托    | 成员对象或接口成员                |

判断关系时，最有帮助的问题往往很朴素：

1. 当前类是在“使用”另一个对象，还是“是一种”另一个对象？
2. 使用是临时的还是长期的？
3. 谁创建、谁销毁、谁拥有该对象？
4. 将来最可能变化的是对象类型、实现算法，还是对象之间的组合？

这些问题回答清楚后，依赖、关联、组合与继承的选择通常就不再模糊。

### 本章小结

| 主题       | 关键结论                                             |
| ---------- | ---------------------------------------------------- |
| 设计过程   | 建模、细化、表示、封装变化、适应变化，且持续迭代     |
| 建模起点   | 先从问题域职责与水平关系出发，不急于设计继承树       |
| 抽象与表示 | 先定义对象语义和职责，再选择 C++ 数据与实现表示      |
| 封装变化   | 针对真实且重要的变化点隔离实现，避免过度抽象         |
| 子类型化   | 适合一个主要变化方向；基类接口稳定，派生类实现可扩展 |
| 多方向变化 | 先用水平关系拆分，再组合多个小继承树                 |
| 依赖       | 短期使用对象，通常体现在函数参数                     |
| 关联/组合  | 长期协作；是否拥有对象决定生命周期设计               |
| 继承       | 只在表达真正的 is-a 子类型关系时使用公有继承         |

好的面向对象设计不是堆叠术语和类层次，而是让职责、关系、所有权与变化点彼此一致：稳定的部分尽量稳定，变化的部分有清晰的边界，协作对象通过小而明确的接口连接起来。

## 异常处理

### 错误、异常与处理模型

广义地说，程序运行中遇到无法按正常路径继续完成当前操作的情况，都可以称为异常情况。但在设计和排错时，应区分两类问题：

| 类别       | 典型原因                                       | 更合适的处理方向                                 |
| ---------- | ---------------------------------------------- | ------------------------------------------------ |
| 程序错误   | 越界、空指针解引用、逻辑遗漏、违反前置条件     | 修正代码；调试期可用断言暴露问题                 |
| 运行期异常 | 内存不足、文件无法打开、网络失败、数据格式错误 | 向能够决定恢复、重试、提示或终止策略的调用者报告 |

异常机制不是用来掩盖程序错误的。比如下标越界通常应先修正边界检查；而打开用户指定文件失败，即使调用者检查过路径，仍可能因权限、设备或外部状态变化而失败，适合通过异常或错误码报告。

课件中的处理模型可概括为两种：

| 模型     | 发生异常后                         | 典型特点                         |
| -------- | ---------------------------------- | -------------------------------- |
| 恢复模型 | 在故障点附近恢复，再继续执行       | 有些语言或系统支持较强的恢复能力 |
| 终止模型 | 终止当前正常路径，转去异常处理路径 | C++ 异常机制的基本模型           |

C++ 中抛出异常后，不会自动“跳过当前这条语句、接着执行下一条”。控制流会离开当前路径，寻找匹配的处理器；在此过程中，已构造的自动对象会被销毁。这一过程称为**栈展开**（stack unwinding）。

### 异常的类型

C++ 技术上允许抛出任意可复制构造的类型：

```cpp
throw 42;
throw "file error";

class MyError {
};

throw MyError{};
```

但现代 C++ 不推荐用整数、字符串字面量等表示异常。它们难以携带结构化信息，也难以让调用方按类别处理。通常应使用有明确语义的自定义类型，并继承自标准异常体系：

```cpp
#include <stdexcept>
#include <string>

class ConfigError : public std::runtime_error {
public:
    explicit ConfigError(const std::string& message)
        : std::runtime_error(message) {}
};
```

这样异常对象可以通过 `what()` 提供可读信息，同时调用方也可捕获更一般的 `std::runtime_error` 或 `std::exception`。

#### 常见标准异常

标准异常类大多以 `std::exception` 为公共基类。常见类别如下：

| 异常类型                | 常见含义                          |
| ----------------------- | --------------------------------- |
| `std::bad_alloc`        | 动态内存分配失败                  |
| `std::bad_cast`         | `dynamic_cast` 的引用形式转换失败 |
| `std::invalid_argument` | 实参不符合函数要求                |
| `std::out_of_range`     | 下标或范围越界                    |
| `std::length_error`     | 容器或字符串长度不合法            |
| `std::domain_error`     | 数学定义域不合法                  |
| `std::overflow_error`   | 运算结果上溢                      |
| `std::underflow_error`  | 运算结果下溢                      |
| `std::runtime_error`    | 运行时环境导致的一般错误          |

从继承关系看，`std::logic_error` 下面常见 `invalid_argument`、`domain_error`、`length_error`、`out_of_range`；`std::runtime_error` 下面常见 `range_error`、`overflow_error`、`underflow_error`。这种层次使调用方既能精确捕获，也能按更一般的类别处理。

### `throw`、`try` 与 `catch`

异常处理由三部分组成：

```cpp
try {
    // 可能抛出异常的代码
} catch (const SomeError& error) {
    // 处理 SomeError
}
```

#### 抛出异常

`throw` 后跟一个异常对象。抛出时应把“发生了什么”以及必要上下文封装进异常类型：

```cpp
#include <stdexcept>
#include <string_view>

void connect(std::string_view host) {
    if (host.empty()) {
        throw std::invalid_argument("host must not be empty");
    }

    // 连接失败时，也可以抛出更有语义的自定义异常
}
```

抛出异常之后，当前函数中 `throw` 后面的正常语句不会执行；控制权交给最近的匹配 `catch`，或继续向调用栈上传播。

#### 捕获异常

一个 `try` 后可跟多个 `catch`：

```cpp
void start(std::string_view host) {
    try {
        connect(host);
    } catch (const ConfigError& error) {
        std::cerr << "配置错误：" << error.what() << '\n';
    } catch (const std::invalid_argument& error) {
        std::cerr << "输入错误：" << error.what() << '\n';
    } catch (const std::exception& error) {
        std::cerr << "标准异常：" << error.what() << '\n';
    } catch (...) {
        std::cerr << "未知异常\n";
    }
}
```

匹配规则是**从上到下，第一个匹配的 `catch` 执行**。因此更具体的派生异常必须写在更一般的基类异常之前：

```cpp
class FileError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

class FileNotFound : public FileError {
public:
    using FileError::FileError;
};

try {
    // ...
} catch (const FileNotFound& error) {
    // 先捕获更具体的 FileNotFound
} catch (const FileError& error) {
    // 再捕获其他 FileError
}
```

若先写 `catch (const FileError&)`，后面的 `catch (const FileNotFound&)` 永远没有机会执行。`catch (...)` 可以捕获所有类型，应始终放在最后；它没有异常对象的静态类型信息，只有在确实能处理任意失败、或必须在边界处记录后终止时才适合使用。

#### 为什么通常按 `const` 引用捕获

推荐写法是：

```cpp
catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
}
```

按引用捕获避免不必要复制；按 `const` 引用避免处理器意外修改异常对象。更重要的是，若按值捕获基类异常，派生类额外信息可能被切片：

```cpp
// 不推荐：若实际异常是 FileNotFound，按值接收 FileError 会切片
catch (FileError error) {
    // ...
}
```

例外是某些小型、无继承关系的值类型异常；但统一使用 `const T&` 是最安全、最清晰的习惯。

### 异常传播、再抛出与嵌套处理

#### 异常如何沿调用栈传播

假设调用关系为：

```text
main → run → loadConfig → parse
```

若 `parse` 抛出异常，自己没有处理，`loadConfig` 也没有匹配处理器，异常会继续经过 `run`，直到找到能匹配的 `catch`。若始终找不到匹配处理器，程序将调用 `std::terminate()`。

传播过程中，离开作用域的自动对象会按构造的逆序析构：

```cpp
void writeReport() {
    File file("report.txt");
    Transaction transaction(file);

    writeContent(file);  // 这里若抛出异常
    transaction.commit();
} // 栈展开时先析构 transaction，再析构 file
```

这也是 RAII 的价值：文件、锁、动态内存、事务等资源由对象管理时，即使控制流因异常离开函数，析构函数仍会执行相应清理。C++ 没有语言级的 `finally` 关键字，但自动对象析构通常就是更可靠的清理机制。

#### 再抛出：`throw;` 与 `throw error;`

有时当前层只能记录日志、补充局部信息或执行必要清理，却不应决定最终如何处理异常。这时应再抛出：

```cpp
void loadConfig() {
    try {
        readAndParseConfig();
    } catch (const std::exception& error) {
        logError(error.what());
        throw; // 保留当前异常的实际类型和原始对象，继续向上传播
    }
}
```

在 `catch` 内，空的 `throw;` 会重新抛出当前异常，保留其动态类型和全部信息。不要把它随意写成 `throw error;`：后者会重新抛出一个以当前静态类型构造的新对象；若 `error` 是基类引用，可能发生切片，也会丢失原异常对象的身份。

若当前层要把低层错误转换为当前模块的公共错误，可以捕获后抛出新的异常；此时应明确这是**翻译**，而不是原样传播：

```cpp
class DatabaseError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

void saveUser() {
    try {
        lowLevelWrite();
    } catch (const std::exception& error) {
        throw DatabaseError(std::string("保存用户失败：") + error.what());
    }
}
```

转换异常会改变调用方看到的类型，应只在模块边界确实需要隐藏底层实现、并提供更合适抽象时使用。

#### 嵌套的 `try` 块

嵌套 `try` 适合处理不同层次的职责：内层只处理自己能恢复或需要补充的信息，外层处理更高层策略。

```cpp
void importFile(const std::string& path) {
    try {
        try {
            parseFile(path);
        } catch (const ParseError& error) {
            reportLineError(error);
            throw; // 当前层无法决定是否放弃整个导入
        }
    } catch (const std::bad_alloc&) {
        showOutOfMemoryMessage();
    } catch (const std::exception& error) {
        showImportFailed(error.what());
    }
}
```

嵌套并不意味着“每层都必须 `catch`”。若内层只是为了手动 `delete` 缓冲区，应该优先把缓冲区交给 `std::vector`、`std::string`、智能指针等 RAII 对象管理，让异常直接传播；这样代码更短，清理路径也不容易遗漏。

### `noexcept` 与异常说明

`noexcept` 用于声明函数是否承诺不把异常传播到调用者：

```cpp
void mayThrow();             // 默认可能抛出
void neverThrow() noexcept;  // 承诺不抛出
```

还可以使用条件形式：

```cpp
template <typename T>
void swapValue(T& left, T& right)
    noexcept(noexcept(T(std::move(left))) && noexcept(left = std::move(right)));
```

`noexcept(条件)` 中的条件在编译期求值。条件为真时，该函数是非抛出函数；为假时，函数可抛出。

**重要规则**：如果异常试图离开一个 `noexcept` 函数，程序不会继续寻找外层 `catch`，而是调用 `std::terminate()`。因此不要为了“看起来更安全”而随意加 `noexcept`；只有确实能保证不抛出、或明确希望违反承诺就终止程序时才使用它。

```cpp
void wrong() noexcept {
    throw std::runtime_error("failure"); // 运行时将导致 std::terminate
}
```

旧式的 `throw()`、`throw(Type1, Type2)` 异常说明属于过时语法，新代码应使用 `noexcept`。特别是带类型列表的动态异常说明在现代 C++ 中已经被移除；不要用它限制“可能抛出的异常类型”。

### 构造函数、析构函数与异常

#### 构造函数可以抛出

构造函数负责建立对象不变性。若无法建立一个合法对象，抛出异常是合理的：调用方不会得到一个“半初始化但勉强可用”的对象。

```cpp
class Port {
public:
    explicit Port(int value) {
        if (value < 1 || value > 65535) {
            throw std::out_of_range("port out of range");
        }
        value_ = value;
    }

private:
    int value_ = 0;
};
```

当构造函数抛出时，整个对象尚未构造完成，因此该对象自己的析构函数不会执行；但已经成功构造的基类子对象和成员对象会按逆序析构。这正是成员使用 RAII 类型的重要原因：

```cpp
class Config {
public:
    explicit Config(const std::string& path)
        : file_(path), entries_(readEntries(file_)) {}

private:
    File file_;
    std::vector<Entry> entries_;
};
```

若 `readEntries` 抛出，`entries_` 没有成功构造，但已经完成构造的 `file_` 会自动析构并关闭文件。无需在构造函数里手动写一串 `delete` 或关闭逻辑。

#### 析构函数应当不抛出

析构函数通常应视为 `noexcept`：

```cpp
class FileWriter {
public:
    ~FileWriter() noexcept {
        closeNoThrow();
    }
};
```

特别是在栈展开期间，如果一个析构函数又抛出新的异常，C++ 无法同时传播两个异常，程序会调用 `std::terminate()`。因此析构函数只做可靠、不可失败的清理；可能失败的操作（例如提交数据、关闭时报告网络错误）应提供显式成员函数，让调用者在对象仍完整存在时处理失败。

### 异常安全保证

异常安全讨论的是：操作因为异常中断后，对象和资源处于什么状态。常见保证从弱到强如下：

| 保证       | 含义                                               |
| ---------- | -------------------------------------------------- |
| 基本保证   | 不泄漏资源，对象仍满足不变性，可继续使用或安全析构 |
| 强保证     | 操作要么完整成功，要么对象保持调用前的状态不变     |
| 不抛出保证 | 操作承诺不会抛出异常                               |

一个函数无法凭空提供比其所依赖操作更强的保证。若 `f()` 调用的 `g()` 在失败时会破坏自身不变性，`f()` 也很难保证自己的对象绝对安全。因此异常安全是设计中逐层组合出来的性质。

#### 基本保证：对象仍合法

下面的手写赋值运算符有问题：

```cpp
class A {
public:
    A& operator=(const A& right) {
        if (this != &right) {
            number_ = right.number_;
            delete data_;
            data_ = new Data(*right.data_); // 若这里抛出异常，data_ 成为悬空指针
        }
        return *this;
    }

private:
    int number_ = 0;
    Data* data_ = nullptr;
};
```

若 `new Data(...)` 抛出，旧资源已经被释放，`data_` 仍保存旧地址；此时对象既不安全也不容易正确析构，连基本保证都不满足。

先创建新资源、成功后再替换旧资源，至少能恢复基本保证；更现代的做法是让 `std::unique_ptr` 自动管理资源：

```cpp
class A {
public:
    A(const A& right)
        : number_(right.number_),
          data_(std::make_unique<Data>(*right.data_)) {}

    friend void swap(A& left, A& right) noexcept {
        using std::swap;
        swap(left.number_, right.number_);
        swap(left.data_, right.data_);
    }

    A& operator=(A right) noexcept {
        swap(*this, right);
        return *this;
    }

private:
    int number_ = 0;
    std::unique_ptr<Data> data_;
};
```

复制 `right` 的过程若失败，赋值函数体尚未开始，左侧对象保持原状；复制成功后，`swap` 不抛出，旧资源随局部副本 `right` 的析构自动释放。这是 **copy-and-swap** 惯用法，同时给出了强保证。

#### 强保证：提交或回滚

强保证的思路是：把可能抛出的准备工作放在不改变原对象的阶段，全部成功后再以不抛出的方式提交修改。

```text
准备新状态（可能抛出）
        ↓ 成功后
一次不抛出的提交/交换
        ↓
对象进入新状态
```

例如更新容器前先构造完整的新副本，成功后 `swap`；或先完成所有校验和外部读取，最后才修改成员状态。若中途出错，原对象从未改变。

另一个常见技巧是分离“读取返回值”和“修改对象”：

```cpp
template <typename T>
class Stack {
public:
    T top() const {
        return values_.back(); // 返回值复制可能抛出，但不修改栈
    }

    void pop() {
        values_.pop_back(); // 单独修改状态
    }

private:
    std::vector<T> values_;
};
```

如果把“取出值”和“删除栈顶”合在一个 `pop()` 中，返回值构造或复制的失败可能发生在状态已修改之后。拆成 `top()` 与 `pop()` 后，读取失败不会改变原栈；调用者确认取得值后再执行删除，更容易维持强保证。

### 异常中立

**异常中立**指一个中间层函数没有足够信息处理异常时，不应悄悄吞掉它，而应保持异常的语义并交给调用者决定。

```cpp
void process() {
    try {
        stepOne();
        stepTwo();
    } catch (const MyError& error) {
        logError(error.what());
        throw; // 记录后原样传播：异常中立
    }
}
```

下面的写法往往有问题：

```cpp
try {
    stepOne();
    stepTwo();
} catch (...) {
    std::cerr << "发生错误\n";
    // 异常被吞掉，调用方误以为操作成功
}
```

吞掉异常会让上层失去恢复、重试、回滚、显示错误或终止任务的机会。只有在当前层确实能**完整处理**异常并建立清晰的返回语义时，才应结束传播；例如把“文件不存在”转换为一个明确的 `false` 返回值，且调用方能可靠区分这种失败。

异常中立不等于“不做任何事”。中间层可以：

- 依靠 RAII 完成局部清理；
- 记录日志或附加诊断信息；
- 将底层异常翻译为模块公开的异常类型；
- 然后用 `throw;` 或有明确语义的新异常继续传播。

### 本章小结

| 主题         | 关键结论                                                 |
| ------------ | -------------------------------------------------------- |
| 异常机制     | C++ 采用终止模型：抛出后离开当前正常路径，寻找匹配处理器 |
| 异常类型     | 优先使用继承 `std::exception` 的语义化自定义类型         |
| `catch` 顺序 | 从具体派生类到一般基类，`catch (...)` 必须放最后         |
| 捕获方式     | 通常使用 `const T&`，避免复制和对象切片                  |
| 再抛出       | `throw;` 保留当前异常；`throw error;` 可能复制或切片     |
| `noexcept`   | 异常若离开 `noexcept` 函数，将调用 `std::terminate()`    |
| 构造/析构    | 构造函数可抛出；析构函数应不抛出；RAII 支持栈展开清理    |
| 基本保证     | 失败后对象仍合法、资源不泄漏                             |
| 强保证       | 操作成功或对象状态完全不变，常用“准备后交换”实现         |
| 异常中立     | 无法完整处理时，不吞掉异常，应保留语义交给上层           |

异常处理的重点不在于写多少个 `try-catch`，而在于明确失败由谁决定、资源由谁管理、对象在失败后保持什么状态。把资源交给 RAII 对象，把异常交给真正有决策权的一层，程序才能既可靠又易于维护。

## 模板

### 参数化与泛型程序设计

模板（template）让程序把“类型”或编译期常量当作参数传入，从一份代码生成多份针对不同参数的实现。它解决的是：算法或数据结构的逻辑相同，但参与运算的类型、容量或策略不同。

例如，若分别为 `int`、`double` 和自定义 `Student` 写一套“取较大值”的函数，主体逻辑高度重复；模板可以把变化的类型抽成参数：

```cpp
template <typename T>
T larger(const T& left, const T& right) {
    return left < right ? right : left;
}
```

调用时：

```cpp
int bigger_int = larger(3, 8);             // 实例化 larger<int>
double bigger_double = larger(2.5, 1.7);  // 实例化 larger<double>
```

这里 `T` 是**类型参数**。编译器根据实参推导出 `T`，再为所需类型生成对应函数。模板属于第十九章所说的**静态多态**：具体代码在编译期确定，而不是像虚函数一样在运行期按对象动态类型派发。

除了类型，模板还可以接收编译期常量，例如固定容量：

```cpp
template <typename T, std::size_t Capacity>
class FixedBuffer {
    // ...
};
```

`T` 与 `Capacity` 都是模板参数，但前者是类型，后者是非类型模板参数。

#### 模板、实例与实例化

这几个术语要分清：

| 名称     | 含义                                       | 例子                                |
| -------- | ------------------------------------------ | ----------------------------------- |
| 模板     | 生成代码的蓝图，本身不是某个具体类型或函数 | `template <typename T> class Stack` |
| 模板实参 | 填入模板的参数                             | `int`、`std::string`、`8`           |
| 模板实例 | 参数确定后的具体实体                       | `Stack<int>`                        |
| 实例化   | 编译器按参数生成具体实体的过程             | 生成 `Stack<int>` 的成员函数        |
| 特化     | 为某组特定参数提供专门实现                 | `template <> class Formatter<bool>` |

`Stack<int>` 与 `Stack<std::string>` 是两个不同的类型。它们共享同一份模板定义的结构，但各自拥有针对元素类型生成的成员函数和静态成员。

### 函数模板

#### 基本定义与类型推导

函数模板的一般形式是：

```cpp
template <typename T>
返回类型 函数名(含有 T 的参数列表) {
    // 通用实现
}
```

`typename` 与 `class` 在模板类型参数位置含义相同：

```cpp
template <typename T>
void print(const T& value);

template <class T>
void printAgain(const T& value);
```

编译器通常从**函数实参**推导模板参数：

```cpp
template <typename T>
void swapValues(T& left, T& right) {
    T temp = left;
    left = right;
    right = temp;
}

int a = 1;
int b = 2;
swapValues(a, b); // T 推导为 int
```

若参数之间无法推导出唯一的 `T`，就需要调用者显式指定，或先把实参转换到同一类型：

```cpp
// larger(2, 3.5); // 不能从 int 与 double 推导出唯一的 T

double result = larger<double>(2, 3.5);
```

函数返回类型通常不参与模板实参推导。也就是说，下面的 `T` 不能仅从接收结果的变量类型推断：

```cpp
template <typename T>
T makeValue();

// int value = makeValue(); // 通常无法据返回类型推导 T
int value = makeValue<int>();
```

#### 模板与普通重载函数

模板函数可以与普通函数同名。若两者都匹配且普通函数不需要更差的转换，编译器通常优先选择普通函数：

```cpp
int larger(int left, int right) {
    std::cout << "ordinary overload\n";
    return left < right ? right : left;
}

template <typename T>
T larger(const T& left, const T& right) {
    std::cout << "function template\n";
    return left < right ? right : left;
}

larger(2, 5);           // 选择普通的 larger(int, int)
larger(2.0, 5.0);       // 选择 larger<double>
larger<>(2, 5);         // 空的 <> 明确要求使用函数模板
larger<double>(2, 5);   // 显式实例化为 larger<double>
```

这种规则能让程序为某些常用类型提供更合适的专门实现，同时保留模板的通用能力。

#### 模板对类型提出的隐含要求

模板不是“接受任意类型而永远成功”。模板中写了哪些操作，实参类型就必须支持哪些操作。

前面的 `larger` 使用了 `<` 和按值返回，因此 `T` 至少应当能比较、复制或移动：

```cpp
template <typename T>
T larger(const T& left, const T& right) {
    return left < right ? right : left;
}
```

若把没有 `<` 运算符的类传入，错误往往在模板实例化时才出现：

```cpp
class Book {
};

Book first;
Book second;
// larger(first, second); // 错误：Book 不支持 <
```

这类“只要满足所需操作即可使用”的方式常称为编译期的结构化约束。现代 C++ 还可以用概念（concepts）把要求明确写到接口上：

```cpp
#include <concepts>

template <std::totally_ordered T>
T larger(const T& left, const T& right) {
    return left < right ? right : left;
}
```

概念不是课件模板基础的必要前提，但它能把原本很晚、很长的实例化错误变成更清晰的接口约束。

### 类模板

类模板把整个类参数化，常用于容器、智能指针、矩阵、数值工具等可复用数据结构。

#### `Stack<T>` 示例

下面是一个以 `std::vector` 为内部表示的栈模板：

```cpp
#include <stdexcept>
#include <utility>
#include <vector>

template <typename T>
class Stack {
public:
    void push(const T& value) {
        elements_.push_back(value);
    }

    void push(T&& value) {
        elements_.push_back(std::move(value));
    }

    void pop() {
        if (elements_.empty()) {
            throw std::out_of_range("empty stack");
        }
        elements_.pop_back();
    }

    const T& top() const {
        if (elements_.empty()) {
            throw std::out_of_range("empty stack");
        }
        return elements_.back();
    }

    bool empty() const noexcept {
        return elements_.empty();
    }

    std::size_t size() const noexcept {
        return elements_.size();
    }

private:
    std::vector<T> elements_;
};
```

使用时必须给出元素类型：

```cpp
Stack<int> integer_stack;
integer_stack.push(10);

Stack<std::string> string_stack;
string_stack.push("template");
```

`Stack<T>` 的成员函数只有在实际使用到对应实例时才会按需实例化。若写：

```cpp
Stack<int> values;
```

编译器只要求这一刻真正用到的成员对 `int` 合法。比如 `Stack<T>` 中若另有一个调用 `T::someFunc()` 的成员函数，只要没有调用该成员，`Stack<int>` 未必立刻报错；当调用它时才会因 `int` 没有该成员而失败。

`top()` 返回 `const T&`，避免读取栈顶时复制大型对象；但该引用只在栈未修改、元素未失效时有效。若调用 `pop()`、析构栈或发生导致底层容器重新分配的修改，先前取得的引用可能失效。若调用方需要脱离栈独立保存值，应自己复制：

```cpp
std::string value = string_stack.top();
string_stack.pop();
```

#### 定义通常放在头文件

普通函数或普通类成员可以只在 `.cpp` 文件中定义，再由链接器连接；模板不同。编译器要在每个使用点看到模板定义，才能根据具体参数生成代码。

```cpp
// Stack.hpp
template <typename T>
class Stack {
public:
    void clear();
};

template <typename T>
void Stack<T>::clear() {
    // 模板成员函数的定义通常也放在头文件
}
```

因此模板声明和定义通常一起放在 `.hpp`、`.tpp`，或被头文件包含的实现文件中。也可以对少数固定类型做显式实例化并将实现放进 `.cpp`，但那是为了控制编译时间和代码体积的进阶手段；课程中的通用模板应先按“定义可见”理解。

### 非类型模板参数

除了类型参数，模板还能接收编译期常量。固定容量栈是典型例子：

```cpp
#include <array>
#include <cstddef>
#include <stdexcept>

template <typename T, std::size_t Capacity>
class FixedStack {
public:
    void push(const T& value) {
        if (size_ == Capacity) {
            throw std::out_of_range("full stack");
        }
        elements_[size_] = value;
        ++size_;
    }

    void pop() {
        if (size_ == 0) {
            throw std::out_of_range("empty stack");
        }
        --size_;
    }

    const T& top() const {
        if (size_ == 0) {
            throw std::out_of_range("empty stack");
        }
        return elements_[size_ - 1];
    }

    std::size_t size() const noexcept {
        return size_;
    }

private:
    std::array<T, Capacity> elements_{};
    std::size_t size_ = 0;
};
```

```cpp
FixedStack<int, 8> small_stack;
FixedStack<int, 1024> large_stack;
```

`FixedStack<int, 8>` 和 `FixedStack<int, 1024>` 是不同类型，容量在编译期已经确定。它适合容量确实固定、希望避免动态分配的场景。

该简单实现也体现了固定数组容器的一个约束：`std::array<T, Capacity>` 会构造全部元素，所以 `T` 需要可默认构造。生产级固定容量容器若要支持非默认构造类型，通常需要更复杂的未初始化存储与对象生命周期管理；不要低估容器实现的细节。

### 模板特化

通用模板可以覆盖大部分类型；当某个具体类型确实需要不同表示或行为时，可以提供**全特化**。

```cpp
template <typename T>
class Formatter {
public:
    std::string format(const T& value) const {
        return std::to_string(value);
    }
};

template <>
class Formatter<bool> {
public:
    std::string format(bool value) const {
        return value ? "true" : "false";
    }
};
```

这里的通用版本只适用于能传给 `std::to_string` 的数值类型；若要支持自定义类型，应改用该类型提供的格式化接口、输出运算符，或用概念明确约束。模板的“通用”始终以满足代码中的操作要求为前提。

`Formatter<int>` 使用通用版本，而 `Formatter<bool>` 使用专门版本。全特化的形式是：

```cpp
template <>
class 模板名<具体参数> {
    // 专门实现
};
```

课件中用 `Stack<std::string>` 改用 `std::deque<std::string>` 说明同一思想：大多数元素类型用通用的 `std::vector<T>` 实现，某个特定类型若有充分理由，可以提供专门表示。

但特化不是“任何类型都单独写一份”的借口。若变化的是存储策略而不是元素类型本身，往往更适合把存储容器作为另一个模板参数，或使用组合；特化应服务于清晰、必要的语义差异。

### 模板继承与 CRTP 单例

课件中的 `Singleton<T>` 是一种模板继承用法：派生类把自身作为模板实参传给基类。

```cpp
#include <utility>

template <typename Derived>
class Singleton {
public:
    static Derived& instance() {
        static Derived object;
        return object;
    }

    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;

protected:
    Singleton() = default;
    ~Singleton() = default;
};

class Logger : public Singleton<Logger> {
    friend class Singleton<Logger>;

public:
    ~Logger() = default;

    void write(const std::string& message);

private:
    Logger() = default;
};
```

```cpp
Logger::instance().write("started");
```

这种“派生类把自己作为基类模板参数”的模式称为 **CRTP**（Curiously Recurring Template Pattern）。`Singleton<Logger>` 与 `Singleton<OtherType>` 是不同的模板实例，因此每个派生类型都有自己的函数内静态对象。

从 C++11 起，函数内静态对象的初始化是线程安全的，因此上面的 `instance()` 能安全完成首次初始化。`friend class Singleton<Logger>;` 让基类模板可以调用 `Logger` 的私有构造函数。

单例只适合确实必须“全程序唯一”的资源，例如某些进程级注册器。它会引入全局状态、隐藏依赖和测试隔离困难；若一个对象可以通过依赖注入显式传入，通常更容易测试和替换。

### STL 与泛型程序设计

泛型程序设计（Generic Programming）强调：算法不绑定某个具体容器或数据类型，而是通过模板、迭代器和可调用对象在编译期组合。标准模板库 STL 是 C++ 泛型程序设计最重要的实践。

STL 的主要组成部分如下：

| 组成                 | 作用                           | 例子                               |
| -------------------- | ------------------------------ | ---------------------------------- |
| 容器（containers）   | 保存一组对象                   | `vector`、`list`、`map`            |
| 算法（algorithms）   | 操作一个范围                   | `sort`、`find`、`remove`           |
| 迭代器（iterators）  | 把容器元素表示为统一的范围接口 | `begin()`、`end()`                 |
| 函数对象（functors） | 可像函数一样调用的对象         | 比较器、谓词                       |
| 适配器（adapters）   | 改变容器或可调用对象接口       | `stack`、`queue`、`priority_queue` |
| 分配器（allocators） | 管理容器底层内存分配           | 默认分配器及自定义分配器           |

常见容器可先按用途分类：

| 类别         | 常见容器                                           | 特点                   |
| ------------ | -------------------------------------------------- | ---------------------- |
| 顺序容器     | `vector`、`deque`、`list`、`forward_list`、`array` | 按位置组织元素         |
| 有序关联容器 | `set`、`multiset`、`map`、`multimap`               | 按比较规则维护有序键   |
| 无序关联容器 | `unordered_set`、`unordered_map` 等                | 基于哈希组织元素       |
| 容器适配器   | `stack`、`queue`、`priority_queue`                 | 对底层容器提供受限接口 |

课件中的 `hash_set`、`hash_map` 是历史上常见的非标准名称；现代标准 C++ 应使用 `std::unordered_set`、`std::unordered_map`。

#### 容器、迭代器与算法

`std::vector` 是最常用的顺序容器之一：

```cpp
#include <iostream>
#include <vector>

std::vector<int> numbers;
numbers.push_back(1);
numbers.push_back(2);

for (int number : numbers) {
    std::cout << number << '\n';
}
```

标准算法通常不直接依赖某个容器类型，而是接收一对迭代器表示范围：

```cpp
#include <algorithm>
#include <vector>

std::vector<int> numbers{1, 2, 3, 2};

auto new_end = std::remove(numbers.begin(), numbers.end(), 2);
numbers.erase(new_end, numbers.end());
```

这就是著名的**擦除—移除惯用法**。`std::remove` 并不真正缩小 `vector`；它只是把不等于 `2` 的元素向前移动，并返回新的逻辑终点。随后 `erase` 才删除尾部多余元素。

迭代器是算法与容器之间的桥梁：同一个 `find`、`remove` 等算法可以作用于许多支持相应迭代器能力的容器。也要注意算法的能力要求，例如 `std::sort` 需要随机访问迭代器，不能直接对 `std::list` 使用；`std::list` 有自己的 `sort()` 成员函数。

#### 函数对象（仿函数）

重载了 `operator()` 的对象可以像函数一样调用，称为函数对象或仿函数。模板让同一种比较规则可用于多种类型：

```cpp
template <typename T>
class CompareByValue {
public:
    bool operator()(const T& left, const T& right) const {
        return left.value() > right.value();
    }
};

class Score {
public:
    explicit Score(int number) : number_(number) {}

    int value() const {
        return number_;
    }

private:
    int number_;
};

Score first(1);
Score second(3);

bool result = CompareByValue<Score>{}(first, second); // false
```

`CompareByValue<T>` 要求 `T` 提供 `value()`。它可以作为算法的比较器传入：

```cpp
std::sort(scores.begin(), scores.end(), CompareByValue<Score>{});
```

仿函数既可以保存状态，又可以通过模板复用逻辑。简单的一次性比较也常用 lambda 表达式；而可命名、可配置、可复用的行为对象仍适合使用仿函数。

### 模板的边界与使用建议

模板的优势是类型安全的编译期复用，但也有成本：

| 方面       | 说明                                                               |
| ---------- | ------------------------------------------------------------------ |
| 编译期     | 多个实例可能增加编译时间和代码体积                                 |
| 错误信息   | 约束不清时，实例化错误可能很长                                     |
| 接口要求   | 模板代码使用什么操作，实参类型就必须支持什么操作                   |
| 运行时替换 | 模板参数通常编译期固定；需要运行时替换行为时应考虑虚函数或策略对象 |

实用建议：

1. 模板参数只承担真正会变化的类型或编译期常量，不要为了抽象而抽象。
2. 优先复用标准库容器和算法，不要轻易手写 `vector`、智能指针或字符串。
3. 让模板要求尽量清晰；在可使用 C++20 的场景中，可用概念表达约束。
4. 模板定义通常放在头文件，避免“声明可见、定义不可实例化”的链接问题。
5. 区分静态泛型与运行时多态：类型在编译期已知时用模板，运行期才决定具体实现时用虚函数或组合。

### 本章小结

| 主题         | 关键结论                                            |
| ------------ | --------------------------------------------------- |
| 模板         | 把类型或编译期常量参数化，生成可复用的静态代码      |
| 函数模板     | 可从实参推导类型，也可用 `<T>` 显式指定             |
| 类模板       | `Stack<int>`、`Stack<std::string>` 是不同的具体类型 |
| 模板定义位置 | 通常必须放在头文件，供使用点实例化                  |
| 非类型参数   | 如 `FixedStack<int, 8>` 中的 `8`，在编译期决定      |
| 特化         | 为特定模板实参提供必要的专门实现                    |
| CRTP 单例    | 派生类把自身作为基类模板参数，每种类型拥有独立实例  |
| STL          | 通过容器、算法、迭代器、仿函数等组成泛型生态        |
| 泛型与多态   | 模板是编译期静态多态；虚函数是运行期动态多态        |

模板的价值不只是“少写几遍同样的代码”，而是把算法或数据结构真正依赖的能力抽出来，让同一份逻辑在多种类型上以编译期检查的方式复用。把模板与标准库、清晰约束和合适的运行时多态结合，才能得到既通用又易维护的 C++ 代码。