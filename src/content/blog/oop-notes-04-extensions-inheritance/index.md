---
title: "OOP复(yù)习(xí)笔记（四）：类的扩展机制与继承体系"
description: "OOP 复习笔记第四篇，整理转换函数、名字空间、友元、嵌套类与流，梳理类间关系、继承与类型转换、多重继承、菱形结构和虚基类。"
publishDate: "2026-06-03T23:10:37"
tags:
  - "c-cpp"
heroImage: { src: './take-me-home.jpg', color: '#A78B77' }
language: '简中'
draft: false
---

## 转换函数、名字空间、友元、嵌套类、流

### 转换函数

程序中经常要在不同类型之间传递数据。内置类型之间的转换，例如 `int` 转 `float`、`float` 转 `double`，编译器已有固定规则；而自定义类型参与转换时，通常需要程序员明确提供转换路径。

可以先把常见情况分成三类：

| 转换方向            | 例子                  | 主要处理者             |
| ------------------- | --------------------- | ---------------------- |
| 内置类型 → 内置类型 | `int` 转 `float`      | 编译器按内置规则处理   |
| 其他类型 → 本类     | `int` 转 `Fraction`   | 转换构造函数           |
| 本类 → 其他类型     | `Fraction` 转 `float` | 转换函数（转换运算符） |

**转换构造函数：把其他类型变成本类。**

若构造函数能只用一个实参调用，它不仅能创建对象，也可能成为一条隐式类型转换路径：

```cpp
class Fraction {
public:
    Fraction(int numerator, int denominator = 1)
        : num_(numerator), den_(denominator) {}
};
```

虽然声明中有两个参数，但第二个参数有默认值，所以 `Fraction(2)` 可以成立。于是需要 `Fraction` 的地方，编译器有机会把 `2` 视为 `Fraction(2, 1)`：

```cpp
void useFraction(const Fraction& value);

useFraction(2); // 可能隐式构造 Fraction(2, 1)
```

这种“接收其他类型并构造本类”的构造函数，称为**转换构造函数**。要把 `A` 转换成 `Fraction`，转换构造函数写在**目标类型** `Fraction` 中：

```cpp
class A {
    // 略
};

class Fraction {
public:
    Fraction(const A& value);
};
```

若不希望构造函数参与隐式转换，可以使用 `explicit`：

```cpp
class Fraction {
public:
    explicit Fraction(int numerator);
};

void useFraction(const Fraction& value);

useFraction(2);             // 错误：不能隐式转换
useFraction(Fraction(2));   // 正确：显式构造
```

**转换函数：把本类变成其他类型。**

若对象已经是本类，想把它转换成别的类型，就在**源类型**中定义转换函数。基本格式是：

```cpp
class T {
public:
    operator DestType() const {
        return DestType(...);
    }
};
```

转换函数有几个重要特征：

- 函数名由 `operator` 加**目标类型**组成。
- 不写普通返回值类型，目标类型已经写在 `operator DestType` 中。
- 没有显式参数。
- 通常不修改当前对象，因此常写成 `const` 成员函数。
- 函数体应当产生一个可转换为目标类型的结果。

例如分数类可以提供到 `int` 和 `float` 的转换：

```cpp
class Fraction {
public:
    Fraction(int numerator, int denominator = 1)
        : num_(numerator), den_(denominator) {}

    operator int() const {
        return num_ / den_;
    }

    explicit operator float() const {
        return static_cast<float>(num_) / den_;
    }

private:
    int num_;
    int den_;
};
```

这里：

```cpp
operator int() const;
```

表示“把当前 `Fraction` 对象转换成 `int`”。不能写成：

```cpp
int operator int() const; // 错误：转换函数不能再写普通返回类型
```

**隐式与显式转换。**

上例的 `operator int()` 没有 `explicit`，因此可参与普通隐式转换：

```cpp
Fraction f(3, 2);
int value = f; // 调用 operator int()，结果为 1
```

而 `operator float()` 被声明为 `explicit`：

```cpp
explicit operator float() const;
```

它不能直接用于普通隐式初始化：

```cpp
float x = f; // 不能直接使用 explicit operator float()
```

需要明确写出转换意图：

```cpp
float x1 = static_cast<float>(f); // 结果为 1.5
float x2 = float(f);              // 也可以
```

这一区别非常重要。若调用一个接收 `float` 的函数：

```cpp
void useFloat(float value);
```

写：

```cpp
useFloat(f);
```

编译器不能直接使用 `explicit operator float()`；但它可能先调用隐式的 `operator int()` 得到 `1`，再把 `1` 做内置转换变成 `1.0f`。这与显式转换到 `float` 的 `1.5f` 结果不同。

> 转换函数提供得越多，编译器可选择的路径越多。涉及精度损失、资源所有权或语义变化时，应优先使用 `explicit`，避免编译器“悄悄帮你选了一条路”。

**转换构造函数与转换函数的方向**：

| 想实现的转换             | 应放在什么类型中 | 典型形式             |
| ------------------------ | ---------------- | -------------------- |
| `A → B`，用 `A` 创建 `B` | 目标类型 `B`     | `B(const A&)`        |
| `A → B`，让 `A` 变成 `B` | 源类型 `A`       | `operator B() const` |

同一方向不要随意同时提供两条等价的隐式路径：

```cpp
class A;

class B {
public:
    B(const A& value);
};

class A {
public:
    operator B() const;
};
```

在某些需要从 `A` 生成 `B` 的语境中，编译器可能无法判断应使用 `B(const A&)` 还是 `A::operator B()`，从而产生二义性。更好的设计是选择一条主要转换路径，或把其中一条标记为 `explicit`。

转换函数的目的是让确实自然的转换变得方便，而不是把不同类型之间所有可能的关系都隐式打通。

### 名字空间的引入

多人协作或引入多个库时，函数名、类名和变量名很容易重复。假设两个模块都定义了 `f` 和 `T`：

```cpp
// zhang.h
void f();

class T {
public:
    void zhangFunc();
};
```

```cpp
// li.h
void f();

class T {
public:
    void liFunc();
};
```

若它们都处于全局名字空间，项目中就会出现两个全局 `f`、两个全局 `T`。编译器和链接器无法仅凭短名字判断某次使用到底指向哪一个模块，这就是**命名冲突**。

只靠人工改名并不可靠：

- 改动可能牵连大量调用位置。
- 多人协作时很难保证所有人同步修改。
- 第三方库或历史代码未必允许改名。
- 为避免一个冲突而改出的新名字，仍可能与其他模块冲突。

**名字空间**为名字增加了一层归属范围：

```cpp
namespace Zhang {
    void f();

    class T {
    public:
        void zhangFunc();
    };
}

namespace Li {
    void f();

    class T {
    public:
        void liFunc();
    };
}
```

此时完整名字分别是：

```cpp
Zhang::f();
Li::f();

Zhang::T zhang_object;
Li::T li_object;
```

`Zhang::f` 与 `Li::f` 虽然短名字都叫 `f`，但完整限定名不同，因此可以同时存在。

> 名字空间解决的是“名字属于谁、同名时如何区分”的问题；它不改变类、函数或变量本身的语义。

名字空间和包含警戒经常一起出现在头文件中，但二者解决的问题不同：

| 机制     | 解决的问题                             |
| -------- | -------------------------------------- |
| 包含警戒 | 防止同一头文件内容被重复展开、重复定义 |
| 名字空间 | 防止不同模块中的同名实体发生冲突       |

### 名字空间

**标准名字空间 `std`**：C++ 标准库中大量常用名字位于 `std` 名字空间，例如 `cout`、`cin`、`endl`、`string`、`vector` 等。

```cpp
#include <iostream>

int main() {
    std::cout << "hello" << std::endl;
}
```

`std` 是 standard 的缩写。标准库名字放进 `std`，正是为了避免与用户自己写的 `cout`、`vector`、`swap` 等名字混淆。不要把 `std` 当作自己的自定义名字空间名称。

**全局名字空间与当前名字空间**：不在任何 `namespace` 块中的名字通常属于全局名字空间。

```cpp
int value = 100;

void show() {
    std::cout << value << std::endl;
}
```

这里 `value` 和 `show` 都属于全局名字空间。`::` 左边为空时，表示明确从全局名字空间查找：

```cpp
show();   // 从当前可见范围查找 show
::show(); // 明确从全局名字空间查找 show
```

当局部或某个名字空间中也有同名 `show` 时，`::show()` 可以消除歧义。

**自定义名字空间**：

```cpp
namespace My {
    int value = 100;

    class T {
    };

    void show();
}
```

使用其中的名字时写限定名：

```cpp
My::show();
std::cout << My::value << std::endl;
```

成员函数在类外实现需要 `ClassName::member`；名字空间中的自由函数在名字空间外实现同样要写名字空间限定：

```cpp
void My::show() {
    std::cout << "in My" << std::endl;
}
```

**嵌套名字空间**：名字空间内部还可以继续定义名字空间：

```cpp
namespace My {
    namespace Detail {
        int version = 1;
    }
}

int v = My::Detail::version;
```

C++17 还允许把嵌套形式合并书写：

```cpp
namespace My::Detail {
    int version = 1;
}
```

两种写法表达的是同一层级关系。

**名字空间可以分段定义**：同一个名字空间可以在不同代码段、不同头文件和源文件中反复打开。

```cpp
namespace My {
    class T1 {
    };
}

namespace My {
    class T2 {
    };
}
```

这不是定义了两个 `My`，而是在向同一个 `My` 名字空间继续加入内容。类定义不能这样拆开重复写；名字空间则天然支持分段扩展。

**名字空间别名**：名字空间名字较长时，可以为它设置别名：

```cpp
namespace MyProject = Company::Product::Module;

MyProject::run();
```

别名只是更短的称呼，不会创建新的名字空间，也不会复制其中内容。名字空间别名应在名字空间作用域中声明，通常放在全局或某个名字空间的声明位置。

**匿名名字空间**：没有名字的名字空间写作：

```cpp
namespace {
    int local_count = 0;

    void helper() {
    }
}
```

其中的名字只在当前**翻译单元**中可见，效果类似于给文件作用域的函数或变量提供内部链接。现代 C++ 中，它常用于替代全局位置的 `static`：

```cpp
namespace {
    int local_count = 0;
}

// 与下面这种“仅当前 .cpp 文件可见”的意图相近
static int old_style_count = 0;
```

匿名名字空间通常应放在 `.cpp` 文件中。若把它放进头文件并被多个 `.cpp` 文件包含，每个翻译单元都会得到自己独立的一份名字和对象；这很少是头文件作者真正想要的效果。

### 名字汇入

每次使用名字空间成员都写完整限定名，最清晰，但有时显得冗长：

```cpp
std::cout << std::endl;
My::show();
My::Detail::version;
```

`using` 可以把名字空间中的名字引入当前作用域。要区分两种形式。

**`using namespace N;`：引入整个名字空间中的名字。**

```cpp
using namespace std;

cout << "hello" << endl;
```

这表示让 `std` 中可见的名字参与当前作用域的名字查找。它引入的是**名字**，并不区分这个名字背后是变量、函数、类还是子名字空间。

写法很方便，但引入范围也很大。若当前作用域或其他被引入的名字空间也存在 `count`、`begin`、`swap` 等同名名字，后续使用可能出现冲突或二义性。

**`using N::name;`：只引入一个指定名字。**

```cpp
namespace First {
    int x = 5;
}

using First::x;

int value = x;
```

这里引入的是名字 `x`。若 `x` 代表一组重载函数，相关重载也会作为同一个名字参与查找。

两种形式的区别如下：

| 写法                 | 效果                         | 冲突风险                 |
| -------------------- | ---------------------------- | ------------------------ |
| `using namespace N;` | 引入 `N` 中大量可见名字      | 较高                     |
| `using N::x;`        | 只引入名字 `x`               | 较低，但同名时仍可能冲突 |
| `N::x`               | 不引入，在使用处写完整限定名 | 最低，最清晰             |

**名字汇入也受作用域限制。**

```cpp
namespace First {
    int x = 5;
}

namespace Second {
    double x = 3.1416;
}

int main() {
    {
        using namespace First;
        std::cout << x << std::endl; // 5
    }

    {
        using namespace Second;
        std::cout << x << std::endl; // 3.1416
    }
}
```

两个 `using namespace` 分别位于不同代码块中，离开第一个块后，`First` 的名字不再因这条 using 指令而在后续块中可见，因此两次使用不会冲突。

实际工程中通常遵循以下习惯：

- 在头文件中避免写 `using namespace ...;`，否则会把名字污染传递给所有包含该头文件的源文件。
- 在实现文件中，优先用 `std::cout`、`std::string` 这类明确限定名，或在很小的局部范围内使用 `using`。
- 当名字容易冲突时，宁可多写 `N::name`，也不要让读者猜它来自哪个名字空间。

### 友元和友元类

类外普通函数默认不能直接访问类的私有成员：

```cpp
class A {
private:
    int field_ = 0;
};

void useA(A& a) {
    a.field_ = 5; // 错误：field_ 是 A 的私有成员
}
```

一种做法是提供 `public` 的 getter/setter；但这会向所有外部调用者公开同一份访问能力。若只希望极少数特定函数或类拥有特殊访问权，可以使用**友元**。

**友元函数**：在类中使用 `friend` 声明一个函数，可让该函数访问本类私有成员。

```cpp
class A {
    friend void useA(A& a);

private:
    int field_ = 0;
};

void useA(A& a) {
    a.field_ = 5; // 正确：useA 是 A 的友元函数
}
```

`friend` 声明授予的是访问权限，并不会把 `useA` 变成 `A` 的成员函数。它没有隐含的 `this` 指针，调用形式仍然是普通函数调用：

```cpp
A a;
useA(a);
```

**成员函数作为友元**：也可以只授权另一个类的某一个成员函数。此时必须先让编译器知道这个成员函数的声明：

```cpp
class A;

class B {
public:
    void change(A& a);
};

class A {
    friend void B::change(A& a);

private:
    int value_ = 0;
};

void B::change(A& a) {
    a.value_ = 5;
}
```

这里只有 `B::change` 被授予权限；`B` 的其他成员函数并不会因此自动成为 `A` 的友元。

**友元类**：若希望某个类的全部成员函数都能访问本类私有成员，可以声明友元类：

```cpp
class Parent;

class Wallet {
    friend class Parent;

private:
    int money_ = 0;
    int history_ = 0;
};

class Parent {
public:
    void addMoney(Wallet& wallet) {
        wallet.money_ += 100;
    }

    int checkHistory(const Wallet& wallet) const {
        return wallet.history_;
    }
};
```

`friend class Parent;` 的授权范围较大：`Parent` 的所有成员函数都能访问 `Wallet` 的私有和保护成员。因此它比单独授权一个成员函数更需要谨慎。

友元的常见形式可以整理为：

| 形式         | 例子                         | 获得权限的对象     |
| ------------ | ---------------------------- | ------------------ |
| 自由函数友元 | `friend A operator+(...);`   | 指定普通函数       |
| 成员函数友元 | `friend void B::change(A&);` | 指定成员函数       |
| 友元类       | `friend class Parent;`       | 该类的全部成员函数 |
| 嵌套类友元   | `friend class D;`            | 指定嵌套类         |

在运算符重载中，非成员二元运算符常被声明为友元：它既能保持左右操作数地位对称，又能在确实需要时读取私有成员。

**友元的性质**：

1. 友元不是本类成员。
2. `friend` 声明写在 `public`、`private` 或 `protected` 区域，授予的访问权限没有差别。
3. 友元关系是**单向的**。
4. 友元关系没有**传递性**。
5. 友元关系也不会因为继承自动传递给派生类。

单向性的意思是：若 `Parent` 是 `Wallet` 的友元，`Parent` 能访问 `Wallet`；但 `Wallet` 不会因此能访问 `Parent` 的私有成员。

无传递性的意思是：若 `A` 是 `B` 的友元，`B` 是 `C` 的友元，不能推出 `A` 是 `C` 的友元。

友元确实会在局部打破访问控制，但它不一定等于“完全放弃封装”。和把数据公开给所有人相比，友元只精确授权给少数明确的协作对象。从整体设计看，它可以避免为了一个特例而暴露过宽的公共接口。

不过友元应当是少数例外，而不是逃避类设计的捷径。若许多不相关的类都需要成为某个类的友元，往往说明职责划分或公共接口还需要重新设计。

### 嵌套类

**嵌套类**是在一个类内部定义或声明的类。它的主要目的不是让语法更复杂，而是把只服务于外部类的辅助类型收进外部类的作用域，表达“这是 `Outer` 的内部实现细节”。

```cpp
class Outer {
public:
    class InnerPublic {
    public:
        void f1();
    };

    void f();

private:
    class InnerPrivate;
};
```

嵌套类的类型名本身是外部类的成员名字，因此会受到外部类访问控制影响。

**`public` 嵌套类**可以在类外使用：

```cpp
Outer::InnerPublic object;
```

**`private` 嵌套类**不能在类外直接写出：

```cpp
Outer::InnerPrivate object; // 错误：类型名是 Outer 的私有成员
```

但 `Outer` 的成员函数可以使用它：

```cpp
void Outer::f() {
    InnerPrivate object;
}
```

嵌套类可以先在外部类中声明，再在类外定义：

```cpp
class Outer {
private:
    class InnerPrivate;
};

class Outer::InnerPrivate {
public:
    void f2();

private:
    int value_ = 0;
};
```

嵌套类成员函数在类外实现时，需要写完整作用域：

```cpp
void Outer::InnerPrivate::f2() {
}
```

嵌套类本质上仍然是一个普通类：它可以有自己的 `public`、`private`、`protected` 成员、静态成员、构造函数和成员函数。

```cpp
class Outer {
public:
    class Inner {
    public:
        static int count_;
        void f();
    };
};

int Outer::Inner::count_ = 0;

void Outer::Inner::f() {
}
```

**嵌套类与外部类的访问关系**需要特别区分。嵌套类的成员函数可以访问外部类对象的私有成员，但它没有隐含的外部类 `this` 指针，因此必须先拿到一个外部类对象、引用或指针：

```cpp
class Outer {
private:
    int x_ = 0;

    class Inner {
    public:
        void setOuterValue(Outer& outer, int value) {
            outer.x_ = value; // 可以访问 Outer 的私有成员
        }

    private:
        int y_ = 0;
    };

    int readInner(const Inner& inner) {
        // return inner.y_; // 错误：y_ 是 Inner 自己的私有成员
        return x_;
    }
};
```

这里有两个结论：

- 嵌套类可以在访问规则允许的前提下访问外部类私有成员。
- 外部类**不会**自动获得访问嵌套类私有成员的权限；两者仍是不同的类。

嵌套类的典型用途包括：

- 只为外部类服务的辅助数据结构。
- 迭代器、节点、状态对象等实现细节。
- 不希望外部代码依赖或实例化的内部类型。
- 将相关类型组织在一个清楚的语义范围中，减少全局名字污染。

> C++ 嵌套类不是 Java 那种自动绑定外部对象的“内部类”。它不会天然保存 `Outer` 对象地址；若要操作某个外部对象，必须显式传入或自行保存指针/引用。

### 流

**流**可以理解为按顺序传输数据的抽象通道。控制台输入输出、文件读写、字符串读写都可以通过流接口表达。

```text
数据源 → [ 输入流 ] → 程序
程序   → [ 输出流 ] → 数据目的地
```

流特别适合顺序处理：数据按一定顺序写入或读出。文件流通常还支持定位和跳转，因此“流”并不等于只能像水管一样永远不能回头；但它的基本使用模型仍然是顺序读写。

**字节与字符。**

从底层存储看，文件和网络传输最终都是字节序列；从文本处理角度，又会按字符和编码规则解释这些字节。

| 处理方式   | 关注点                         | 常见场景                           |
| ---------- | ------------------------------ | ---------------------------------- |
| 二进制方式 | 按原始字节读写，不解释文本含义 | 图片、音频、结构化二进制数据       |
| 文本方式   | 按字符和文本编码处理           | 源代码、日志、配置文件、控制台文本 |

一个字符不一定等于一个字节。英文 ASCII 字符在 UTF-8 中通常占一个字节，但汉字、Emoji 等字符在不同编码中可能占多个字节。文本乱码往往来自以下环节的编码不一致：源文件编码、编译器处理方式、运行终端编码、文件读写编码。

**标准输入输出流。**

`<iostream>` 中最常用的两个对象是：

| 对象        | 类型层次中的常见名称              | 典型含义         |
| ----------- | --------------------------------- | ---------------- |
| `std::cin`  | `std::istream` 类型的标准输入对象 | 通常从键盘读取   |
| `std::cout` | `std::ostream` 类型的标准输出对象 | 通常输出到控制台 |

注意 `cin` 和 `cout` 是已经存在的**对象**，不是类，也不是普通函数：

```cpp
#include <iostream>

int main() {
    int value;
    std::cin >> value;
    std::cout << value;
}
```

`>>` 表示从输入流提取数据，`<<` 表示向输出流插入数据。因为这两个运算符通常返回流对象自身的引用，所以可以连续使用：

```cpp
int a;
int b;

std::cin >> a >> b;
std::cout << "a=" << a << ", b=" << b << '\n';
```

**`endl` 的含义。**

`std::endl` 是输出流操纵符。它通常完成两件事：

1. 向输出流写入换行符。
2. 刷新输出缓冲区，也就是执行 `flush`。

```cpp
std::cout << "done" << std::endl;
```

只想换行时，通常可以写：

```cpp
std::cout << "done\n";
```

二者差别在于 `endl` 会额外刷新缓冲区。刷新可以让内容尽快显示或写出，但频繁刷新会降低性能：

```cpp
for (int i = 0; i < 10000; ++i) {
    std::cout << i << '\n';        // 通常更适合大量输出
    // std::cout << i << std::endl; // 每次都刷新，可能明显更慢
}
```

需要立刻把缓冲内容推出去时，可以使用 `std::endl` 或 `std::flush`；只需要普通换行时，`'\n'` 往往更合适。

本节的几个关键词可以这样记：

- **转换构造函数**：其他类型变成本类，写在目标类型中。
- **转换函数**：本类变成其他类型，写在源类型中。
- **名字空间**：给名字划分归属，避免冲突。
- **友元**：对特定函数或类的精确访问授权，不是成员关系。
- **嵌套类**：把辅助类型收进外部类作用域，不自动绑定外部对象。
- **流**：用于有序输入输出；`endl` 是换行并刷新。

## 类间关系

### 编译期依赖性

前面章节主要讨论一个类自身如何定义、构造、析构、拷贝和赋值。真实程序通常由许多类协作完成，因此类之间既有**物理关系**，也有**逻辑关系**：

- **物理关系**：头文件和源文件之间的包含、前置声明与重新编译依赖。
- **逻辑关系**：从问题域和设计语义看，一个类到底是关联、聚合、组合、依赖还是继承另一个类。

本节先讨论物理层面的**编译期依赖性**。

**单向联系与双向联系。**

若只有 `B` 使用 `A`，而 `A` 不知道 `B`，可看成单向联系：

```cpp
class A {
};

class B {
public:
    void f(A& a);

private:
    A* pa_ = nullptr;
};
```

若两边都保存或使用对方，则是双向联系：

```cpp
class B;

class A {
private:
    B* pb_ = nullptr;
};

class B {
private:
    A* pa_ = nullptr;
};
```

双向联系会让构造、析构、生命周期、头文件包含和修改传播都更复杂。设计时应先问：是否真的需要双方都长期知道对方？若只需要一个方向，就不要为了“看起来完整”强行做成双向。

**对象成员会形成强编译期依赖。**

```cpp
// B.h
#include "A.h"

class B {
private:
    A a_;
};
```

`B` 中直接有一个 `A` 对象成员。编译器要计算 `sizeof(B)`，必须知道 `A` 的完整大小、布局和析构方式，因此 `B.h` 必须看到 `A` 的完整定义。

只写前置声明不够：

```cpp
class A;

class B {
private:
    A a_; // 错误：A 还是不完整类型，不知道对象大小
};
```

> 前置声明只告诉编译器“存在一个叫 A 的类”；它不能告诉编译器 A 有多大、有哪些成员，也不能让编译器在此处生成 A 对象的构造和析构代码。

这种“`B.h` 必须包含 `A.h` 才能编译”的关系，课件中称为**强关联**或强编译期依赖。

**内联实现也可能增强依赖。**

即使 `B` 只通过指针使用 `A`，若把成员函数直接写在头文件中，并且函数体调用 `A` 的成员，也必须包含 `A.h`：

```cpp
// B.h
#include "A.h"

class B {
public:
    int f(A* pa) {
        return pa->g();
    }
};
```

这里编译器需要知道 `A` 中确实有 `g()`，所以不能只知道 `class A;`。

可以把函数声明放在头文件、实现放在 `.cpp` 中：

```cpp
// B.h
class A;

class B {
public:
    int f(A* pa);
};
```

```cpp
// B.cpp
#include "B.h"
#include "A.h"

int B::f(A* pa) {
    return pa->g();
}
```

这样 `B.h` 只依赖 `A` 的存在，只有 `B.cpp` 的实现依赖 `A` 的完整定义。这就是**前置声明 + 外联实现**降低头文件耦合的典型方式。

**指针和引用为什么能降低依赖。**

```cpp
class A;

class B {
private:
    A* pa_ = nullptr;
};
```

指针的大小在当前平台上固定，编译器无需知道 `A` 的对象大小，就能确定 `B` 的大小。引用成员也能在声明阶段使用前置声明：

```cpp
class A;

class B {
public:
    explicit B(A& a) : ref_a_(a) {}

private:
    A& ref_a_;
};
```

但引用成员必须在构造时绑定，之后不能改绑；指针成员可以为空、也可以改指向。两者都能降低对完整类型的即时需求，但生命周期语义不同，不能只为了“少 include 一个头文件”就随便替换。

函数参数和返回值也有类似考虑：

```cpp
void f(const A& a);
void g(A* pa);
A* h();
```

这些声明通常可以只配合 `class A;` 使用。按值传参或按值返回在声明处有时也能使用不完整类型，但定义函数、调用者实际构造/销毁对象时仍需要完整类型；同时按值还会引入拷贝、移动和对象大小的耦合。因此接口上若只需要观察或操作已有对象，指针和引用往往更合适。

课件把类间物理联系从强到弱概括为：

1. **继承**：派生类必须知道基类完整定义，属于很强的垂直依赖。
2. **硬关联**：双向关系中至少一侧还存在对象成员等强依赖，维护最复杂。
3. **强关联**：头文件必须包含另一类的完整定义。
4. **弱关联**：完整定义主要只在 `.cpp` 实现文件中需要。
5. **软关联**：头文件尽量只保存指针或引用，并使用前置声明。

这套层次是理解耦合的工具，不是要求所有关系都退化成裸指针。设计目标是：在不牺牲正确所有权和清晰语义的前提下，尽量减少不必要的头文件依赖。

### 类间的逻辑关系

物理依赖回答的是“哪些文件必须一起知道、一起编译”；逻辑关系回答的是“这两个类在程序模型中到底是什么关系”。

类间逻辑关系可先分为两个方向：

| 方向     | 典型概念         | 本章重点         |
| -------- | ---------------- | ---------------- |
| 垂直方向 | 泛化、实现、继承 | 后续继承章节展开 |
| 水平方向 | 关联、聚集、依赖 | 本章重点         |

垂直方向通常是“is-a”关系，例如某种具体对象属于某个更抽象类别。水平方向则讨论平等类之间如何在对象结构或某次行为中发生联系。

水平方向关系在代码中常出现为四种形式：

| 代码形式         | 例子                             | 课程中的主要判断 |
| ---------------- | -------------------------------- | ---------------- |
| 数据成员         | `A* pa_;`、`A a_;`、`A& ra_;`    | 关联             |
| 函数参数         | `void f(A* pa);`                 | 依赖             |
| 函数返回值       | `A* create();`                   | 依赖             |
| 函数实现内部使用 | `A a;`、`new A`、调用 `A` 的功能 | 依赖             |

**关联**表示一个对象在自己的结构中长期保存了与另一个对象的联系；**依赖**表示一个类只在某次行为中临时使用了另一个类。

```cpp
class B {
private:
    A* pa_; // B 对象长期保留一个与 A 的联系：关联
};
```

```cpp
class B {
public:
    void process(const A& a); // 仅在本次调用中使用 A：依赖
};
```

关联通常比依赖更强，因为 `B` 的每个对象结构中都保留了一个“知道 A”的位置；依赖只在某个函数执行时出现。

UML 图中常用实线表示关联、虚线箭头表示依赖。但考试和实际编码中，更重要的是能从代码和生命周期判断关系，而不是只背图形符号。

### 关联

**关联**强调非偶然性的“知道”。一个类把另一个类的对象、指针或引用作为数据成员保存，通常表示关联：

```cpp
class A;

class B {
private:
    A* pa_ = nullptr;
};
```

即使 `pa_` 当前是 `nullptr`，`B` 的类定义仍然说明：每个 `B` 对象都预留了“可能关联一个 A”的位置。这与只在某个成员函数参数中临时出现一次 `A*` 不同。

关联可以从几个维度继续描述：

| 维度     | 可能情况                       |
| -------- | ------------------------------ |
| 导航方向 | 单向关联、双向关联             |
| 数量关系 | 一对一、一对多、多对一、多对多 |
| 语义强度 | 一般关联、聚合、组合           |

**一般关联**只强调对象间存在长期、非偶然的联系，并不强调整体与部分。

```cpp
class University;
class Course;

class Student {
private:
    University* university_ = nullptr;
    Course* courses_[30]{};
};
```

学生记录自己所在大学和选修课程，表示学生长期“知道”这些对象；但这并不意味着学生负责创建或销毁大学、课程对象，因此是一般关联。

**数量关系**要结合模型理解：

- 一个学生对应一个宿舍，可能是一对一。
- 一个学生选多门课，可能是一对多。
- 多个学生住同一宿舍，可能是多对一。
- 多个学生选多门课程，通常是多对多。

**自关联**是同一个类的不同对象之间发生关联：

```cpp
class Student {
private:
    Student* roommates_[3]{};
    Student* supervisor_ = nullptr;
};
```

这里不是“学生对象和自己关联”，而是一个学生对象可能记录其他 `Student` 对象，例如室友、负责人或学长。类的两端都是 `Student`，所以叫自关联。

**关联类**：当“关系本身”也需要保存数据或行为时，可以把关系抽象成独立的类。

学生和教师之间可能是多对多：学生选多门课，教师教多门课。若直接让 `Student` 保存教师列表、`Teacher` 保存学生列表，关系的上课时间、学分、教室、成绩、考核方式等信息无处安放。

可以抽象出 `Course` 或 `Enrollment` 这样的关联类：

```text
Student ── Enrollment/Course ── Teacher
```

关联类既连接两端对象，也承载“关系自己的属性”。婚姻关系中的登记日期、登记地点、证书编号等，也属于“婚姻关系”本身，而不天然只属于丈夫或妻子一方。

关联只说明对象之间有稳定联系；若进一步强调整体-部分以及谁控制生命周期，就进入聚集关系。

### 聚集（组合和聚合）

**聚集关联**是关联的一种特殊情况。它不仅表示“知道”，还强调两个对象之间有整体与部分的语义。

聚集关系通常分为两类：

| 类型 | 英文        | 核心判断                                 |
| ---- | ----------- | ---------------------------------------- |
| 聚合 | Aggregation | 整体包含或使用部分，但不控制部分生命周期 |
| 组合 | Composition | 整体拥有部分，并控制部分生命周期         |

**聚合**：整体与部分有关，但部分可以独立存在，整体不负责创建和销毁部分。

```cpp
class NetworkCard;

class Computer {
public:
    explicit Computer(NetworkCard* card) : card_(card) {}

private:
    NetworkCard* card_; // 非拥有关系：Computer 不 delete card_
};
```

这里 `Computer` 知道或容纳一张外部传入的网卡，但网卡可以脱离某台计算机独立存在，也不由 `Computer` 负责释放，因此更接近聚合。

**组合**：整体负责部分对象的创建、销毁或独占所有权。最直接、最安全的组合写法往往是对象成员：

```cpp
class Engine {
    // 略
};

class Car {
private:
    Engine engine_;
};
```

创建 `Car` 时，`engine_` 自动构造；销毁 `Car` 时，`engine_` 自动析构。`Engine` 的生命周期由 `Car` 对象的生命周期直接控制，这就是组合。

组合也可以使用动态资源，但应让拥有关系明确：

```cpp
#include <memory>

class Engine {
    // 略
};

class Car {
public:
    Car() : engine_(std::make_unique<Engine>()) {}

private:
    std::unique_ptr<Engine> engine_;
};
```

`unique_ptr` 表达“`Car` 独占拥有这台 `Engine`”：`Car` 销毁时智能指针自动销毁它管理的 `Engine`。相比手写 `new/delete`，它更不容易遗漏析构、拷贝和异常路径。

课件中使用下面的形式解释组合：

```cpp
class A {
public:
    A(int value);
};

class B {
public:
    B(int value) : pa_(new A(value)) {}

    ~B() {
        delete pa_;
    }

private:
    A* pa_;
};
```

`B` 创建 `A` 并在析构时释放 `A`，因此 `B` 控制 `A` 的生命周期，是组合。只是这种裸指针写法还必须同时正确处理拷贝构造、赋值和异常安全；现代代码更推荐对象成员或 `unique_ptr`。

> 聚合与组合的分界不在“现实中谁属于谁”，而在“当前程序模型中谁负责谁的生命周期”。

例如现实中汽车和轮子、计算机和网卡都可能被描述为整体与部分；但在制造模拟、维修库存、租赁管理等不同问题域中，轮子或网卡的独立性不同，程序关系也可能不同。

UML 中聚合常用**空心菱形**表示，组合常用**实心菱形**表示，菱形都位于整体一端。代码判断时，不要只看是否有 `A*`：原始指针本身不表达所有权，必须结合构造、析构、接口约定和实际模型来判断。

### 依赖

**依赖**是比关联更弱的类间关系。它表示一个类在某次行为中使用另一个类，但不把对方长期保存为自己的数据成员。

常见依赖形式包括：

```cpp
class B {
public:
    void process(const A& a); // A 出现在函数参数中
    A* create();              // A 出现在函数返回值中
};
```

也可能只在函数实现内部使用：

```cpp
int B::calculate(int n) {
    A a;
    return a.g() + n;
}
```

或：

```cpp
int B::calculate(int n) {
    A* pa = new A;
    int result = pa->g() + n;
    delete pa;
    return result;
}
```

这三种情况中，`B` 对象自身都没有保存 `A` 的成员位置；`A` 只在某个行为调用期间出现，因此归为依赖。

> 若一种关系只在某次操作中需要，就不要轻易升级成数据成员关联。依赖更弱，通常意味着更低的耦合和更小的维护影响范围。

**老鼠吃苹果的例子**：老鼠吃苹果时需要知道这一个苹果的能量，但老鼠没有必要永久保存“所有苹果”的指针，苹果也没有必要永久保存“所有老鼠”的指针。因此适合依赖：

```cpp
class Apple {
public:
    explicit Apple(int energy) : energy_(energy) {}

    int energy() const {
        return energy_;
    }

private:
    int energy_;
};

class Mouse {
public:
    explicit Mouse(int weight) : weight_(weight) {}

    void eat(const Apple& apple) {
        weight_ += apple.energy() / 2;
    }

    int weight() const {
        return weight_;
    }

private:
    int weight_;
};
```

`Mouse::eat` 的参数是 `const Apple&`，说明老鼠在“吃”这个行为中依赖苹果；`Mouse` 类中没有 `Apple*` 数据成员，所以并不是长期关联。

一个行为可能涉及多个对象，设计时应判断谁是主动方、谁是被动方。在“老鼠吃苹果”中，老鼠主动发起“吃”，因此把 `eat` 放在 `Mouse` 中很自然。

也可以让苹果提供“被吃”的协作接口，但应避免在两边重复实现同一份核心规则：

```cpp
class Mouse;

class Apple {
public:
    int eatenBy(const Mouse& mouse) const;
};

class Mouse {
public:
    void eat(const Apple& apple) {
        weight_ += apple.eatenBy(*this);
    }

private:
    int weight_ = 0;
};
```

这里应把能量计算规则集中在一个位置，避免 `Mouse::eat` 和 `Apple::eatenBy` 分别维护两套可能不一致的公式。

### 学生到宿舍的关系例

“学生和宿舍”是区分一般关联、聚合和组合的典型例子。现实中学生住在宿舍、宿舍也住着学生；但程序设计不是把现实关系逐字翻译成类图，而是要先问：当前系统的关注中心是什么？

| 程序类型       | 主要关注点           | 更自然的导航方向  |
| -------------- | -------------------- | ----------------- |
| 通讯录或地址簿 | 学生的地址信息       | 学生 → 宿舍       |
| 学生管理系统   | 学生档案与入住信息   | 学生 → 宿舍较重要 |
| 宿舍管理系统   | 床位、房间与入住名单 | 宿舍 → 学生较重要 |

**学生到宿舍的一般关联**：若只强调学生知道自己的地址信息，可以让学生保存外部宿舍对象的非拥有指针：

```cpp
class Dorm {
public:
    const char* address() const {
        return "Building 1, Room 101";
    }
};

class Student {
public:
    explicit Student(Dorm* dorm) : dorm_(dorm) {}

    const char* address() const {
        return dorm_ != nullptr ? dorm_->address() : "";
    }

private:
    Dorm* dorm_;
};
```

学生对象保留 `Dorm*`，表示长期知道宿舍；但 `Student` 并不创建或释放宿舍对象，因此这是一般关联。

**学生到宿舍的聚合**：若设计者认为“宿舍信息是学生档案中的一部分”，但宿舍对象仍然独立创建、独立销毁，代码形式可能仍是同样的 `Dorm* dorm_`。这说明：仅凭一行指针成员，不能断定关系一定是一般关联还是聚合；还要看模型是否强调整体-部分，以及生命周期归谁管理。

**学生到宿舍的组合**：若模型规定每个学生都拥有一份独立、随学生档案一起存在的宿舍信息，可以写成对象成员：

```cpp
class DormInfo {
    // 楼号、楼层、房间号等学生档案内部信息
};

class Student {
private:
    DormInfo dorm_info_;
};
```

创建 `Student` 时构造 `dorm_info_`，销毁 `Student` 时销毁 `dorm_info_`，因此是组合。这里的 `DormInfo` 表示学生档案中的地址记录，不一定等同于现实世界中独立存在、可住多人的实体宿舍。

这正是建模的关键：同样叫“宿舍”，在不同问题域中可能代表独立的资源实体，也可能代表学生内部的一条地址信息。关系判断应优先服从程序模型与生命周期责任。

### 宿舍到学生的关系例

从宿舍到学生的方向再看一次，关系类型可能完全不同：

| 宿舍对学生的语义                             | 可能关系 |
| -------------------------------------------- | -------- |
| 宿舍只记录当前住了谁                         | 一般关联 |
| 宿舍视学生为部分，但学生由外部系统创建与销毁 | 聚合     |
| 宿舍创建并销毁学生对象                       | 组合     |

**宿舍到学生的组合**：若模型故意规定宿舍负责创建和销毁学生对象，可以这样写：

```cpp
class Student {
    // 略
};

class Dorm {
public:
    Dorm() {
        for (int i = 0; i < 4; ++i) {
            students_[i] = new Student;
        }
    }

    ~Dorm() {
        for (int i = 0; i < 4; ++i) {
            delete students_[i];
        }
    }

private:
    Student* students_[4];
};
```

这里 `Dorm` 创建每个 `Student`，又在析构中释放每个 `Student`，因此宿舍控制学生对象生命周期，是组合。

这个例子的目的只是展示“谁创建、谁销毁”如何决定组合关系，并不表示现实世界的宿舍会创建学生。若系统中的学生来自统一学籍系统，学生显然应独立于宿舍存在，这种建模就不合理。

**宿舍到学生的聚合**：若学生由外部创建，宿舍只维护床位上的学生指针，就不应删除学生对象：

```cpp
class Student;

class Dorm {
public:
    Dorm(Student* students[], int count)
        : count_(count),
          students_(new Student*[count]) {
        for (int i = 0; i < count_; ++i) {
            students_[i] = students[i];
        }
    }

    ~Dorm() {
        delete[] students_; // 只删除指针数组，不删除 Student 对象
    }

    void addStudent(Student* student, int index) {
        if (index >= 0 && index < count_ && students_[index] == nullptr) {
            students_[index] = student;
        }
    }

    void removeStudent(int index) {
        if (index >= 0 && index < count_) {
            students_[index] = nullptr;
        }
    }

private:
    int count_;
    Student** students_;
};
```

```cpp
new Student*[count]
```

创建的是一块用于保存 `Student*` 的**指针数组**，不是 `count` 个 `Student` 对象。析构时：

```cpp
delete[] students_;
```

只释放这块指针数组本身；数组元素指向的学生对象由外部所有者管理。`removeStudent` 把指针设为 `nullptr`，只是解除宿舍与学生的联系，不等于销毁学生。

这一节可以用一句话收束：

> 类间关系不是看“现实中谁和谁有关”，而是看程序中谁长期保存谁、谁在行为中临时使用谁、谁拥有谁，以及谁控制谁的生命周期。

## 继承

### 黑盒复用和白盒复用

类设计的重要目的之一是**软件复用**：已经写好、测试过、语义稳定的类，应当能在新程序中继续使用。复用不只是少写几行代码，更重要的是避免复制后修改旧代码所带来的新 bug 和重复维护。

最低层次的复用往往是：

```text
复制已有代码 → 粘贴到新位置 → 按新需求修改
```

这种方式看似快速，但复制后的代码已经成为另一份独立副本。原代码以后修复 bug，新副本不会自动跟着修复；新副本改错了，也必须重新测试。副本越多，维护成本越高。

课程把“不改动已有类代码”的类级复用分为两种：

| 复用方式 | 比喻           | 复用者知道什么             | C++ 中常见手段         |
| -------- | -------------- | -------------------------- | ---------------------- |
| 黑盒复用 | 使用不透明盒子 | 只依赖公开接口             | 依赖、关联、聚合、组合 |
| 白盒复用 | 使用透明盒子   | 看见并吸收基类的可继承成员 | 继承                   |

**黑盒复用**：把已有类当作只暴露接口的功能提供者。

```cpp
class A {
public:
    void func1();
    void func2();

private:
    void func3();
    int data_ = 0;
};

class B {
public:
    void bfunc(A& a) {
        a.func1(); // 只使用 A 的公开功能
    }
};
```

`B` 复用了 `A::func1()`，但不需要知道 `func1()` 内部怎样实现，也不能访问 `A::data_` 或调用 `A::func3()`。若 `A` 更换内部算法、缓存结构或私有数据表示，只要 `func1()` 的接口和语义不变，`B` 通常无需修改。

这就是黑盒复用的价值：**复用功能，而不依赖实现细节。**

黑盒复用不只存在于参数依赖中，也可通过成员关系出现：

```cpp
class C {
public:
    void cfunc() {
        pa_->func1();
    }

private:
    A* pa_ = nullptr;
};
```

`C` 保存 `A*`，通过公开接口使用 `A`，仍然是黑盒复用。根据所有权和生命周期语义，它可能属于一般关联、聚合或组合；这些关系的共同点是：复用者只依赖被复用类的接口。

**白盒复用**：通过继承让基类的成员成为派生类结构的一部分。

```cpp
class A {
public:
    void func1();

protected:
    void func2();
};

class B : public A {
public:
    void bfunc() {
        func1();
        func2();
    }
};
```

`B` 从 `A` 派生后，`A` 的可访问成员会成为 `B` 的基类部分。`B` 的成员函数可直接调用 `func1()`、`func2()`，而不需要先保存一个独立的 `A` 对象。

白盒复用复用的是基类的实现和成员结构，因此耦合更强。派生类需要看到基类的完整类定义，且会受基类 `protected` 成员、构造方式、成员变化等影响。

> 黑盒复用优先依赖稳定接口；白盒复用通过继承吸收实现。两者没有绝对高低，关键是当前关系究竟是“使用功能”，还是“确实是一种基类”。

### 继承和派生

C++ 中继承的基本语法是：

```cpp
class 派生类名 : 继承方式 基类名1, 继承方式 基类名2 {
    // 派生类自己的成员
};
```

例如：

```cpp
class Child : public Parent1, private Parent2 {
public:
    Child(int value);
    void childFunc();

private:
    int data_ = 0;
};
```

`Child` 是**派生类**，`Parent1`、`Parent2` 是**基类**；冒号后面的部分称为**继承列表**。

**继承方式**有三种：

| 继承方式 | 关键字      | 对外语义概览                                         |
| -------- | ----------- | ---------------------------------------------------- |
| 公有继承 | `public`    | 基类公开接口继续作为派生类公开接口，通常表达 is-a    |
| 保护继承 | `protected` | 基类公开接口不向外公开，但可在后续继承层次中继续使用 |
| 私有继承 | `private`   | 基类接口成为派生类实现细节，不对外暴露               |

若使用 `class` 且省略继承方式，默认是**私有继承**：

```cpp
class Child : Parent {
};

// 等价于
class Child : private Parent {
};
```

这与 `struct` 不同：`struct Child : Parent { };` 默认是公有继承。考试中常见的是 `class` 默认 private 这一点。

**单继承与多重继承。**

一个直接基类：

```cpp
class Child : public Parent {
};
```

称为单继承。多个直接基类：

```cpp
class Child : public Parent1, public Parent2 {
};
```

称为多重继承。多重继承在语法上合法，但会增加成员二义性、构造顺序和后续菱形继承等复杂度；初学阶段应先掌握单继承和公有继承。

派生类还可以继续成为新的基类，形成继承树：

```text
Base
├── Derived1
│   └── MoreDerived1
└── Derived2
    └── MoreDerived2
```

语法上继承层数没有硬性限制，但设计上不宜过深。层次过深会让成员来自哪一层、构造顺序、访问权限和行为覆盖都难以理解。普通业务设计中，三到五层通常已经足够。

“基类/派生类”是语法术语，任何继承方式都可以这样称呼；“父类/子类”更强调类型语义，通常用于公有继承表达的 is-a 关系。

### 派生类中的成员及访问控制

派生类中的内容可粗略分为三类：

| 来源                     | 内容                                     |
| ------------------------ | ---------------------------------------- |
| 派生类自己的特殊成员函数 | 构造、析构、拷贝构造、赋值等             |
| 派生类自己定义的成员     | 新增成员函数、非静态数据成员、静态成员等 |
| 基类部分                 | 基类子对象及其可继承成员                 |

基类的构造函数、析构函数、拷贝构造函数和拷贝赋值运算符，不会作为普通成员函数被派生类直接继承。派生类有自己的这些特殊成员函数；派生类对象构造、复制、赋值时会按规则调用基类对应的函数处理基类部分。

例如：

```cpp
class A {
public:
    void publicFunc();

private:
    int data_ = 0;
};

class B : public A {
public:
    void bfunc() {
        publicFunc();
    }

private:
    int value_ = 0;
};
```

完整的 `B` 对象包含一个 `A` 的**基类子对象**和自己的 `value_`：

```text
B 对象
├── A 的基类子对象
│   └── A::data_
└── B 自己新增的数据
    └── B::value_
```

所以派生类对象大小主要可理解为“基类子对象所占空间 + 派生类新增非静态数据成员 + 必要的对齐或实现开销”。普通成员函数不会为每个对象各存一份；静态成员也不计入单个对象大小。

**基类成员在派生类中的访问权限**由“基类原权限”和“继承方式”共同决定：

| 基类成员原权限 | `public` 继承后    | `protected` 继承后 | `private` 继承后   |
| -------------- | ------------------ | ------------------ | ------------------ |
| `public`       | `public`           | `protected`        | `private`          |
| `protected`    | `protected`        | `protected`        | `private`          |
| `private`      | 派生类不可直接访问 | 派生类不可直接访问 | 派生类不可直接访问 |

这张表中最容易误解的是基类 `private` 成员。派生类不可直接访问，并不表示它们从派生类对象中消失：

```cpp
class Base {
public:
    void setNumber(int value) {
        number_ = value;
    }

private:
    int number_ = 0;
};

class Derived : public Base {
public:
    void f() {
        setNumber(10); // 正确：调用继承来的 public 成员函数
        // number_ = 10; // 错误：不能直接访问 Base 的 private 成员
    }
};
```

`number_` 仍然存在于 `Derived` 对象的 `Base` 子对象中；只是 `Derived` 的代码不能直接通过名字触碰它。基类自己的 `setNumber()` 仍可访问它。

**`protected` 的作用**：

| 权限        | 类外普通代码 | 派生类成员函数 | 本类成员函数 |
| ----------- | ------------ | -------------- | ------------ |
| `public`    | 可以         | 可以           | 可以         |
| `protected` | 不可以       | 可以           | 可以         |
| `private`   | 不可以       | 不可直接访问   | 可以         |

`protected` 适合给派生类扩展使用、但不希望普通类外调用的接口。它不是“比 private 更安全”，而是扩大了可依赖实现的范围；使用过多的 `protected` 同样会让派生类和基类内部实现耦合。

### 派生类的构造和析构函数

派生类对象包含基类子对象，因此构造时必须先让基类部分成为有效对象，派生类才能继续初始化自己的成员。

构造单继承派生类时，顺序是：

1. 构造基类子对象。
2. 按声明顺序构造派生类自己的非静态数据成员。
3. 执行派生类构造函数体。

```cpp
class Base {
public:
    explicit Base(int number) : number_(number) {
    }

private:
    int number_;
};

class Derived : public Base {
public:
    Derived(int base_number, int value)
        : Base(base_number),
          value_(value) {
    }

private:
    int value_;
};
```

初始化列表中的 `Base(base_number)` 指定怎样构造基类部分；`value_(value)` 指定怎样构造派生类自己的成员。进入构造函数体时，两部分都已经初始化完成。

> 基类构造函数不是被派生类“普通继承”来的；正确说法是：派生类对象构造过程中会调用基类构造函数来构造基类子对象。

若基类没有无参构造函数，派生类必须在初始化列表中显式说明如何构造它：

```cpp
class Base {
public:
    explicit Base(int value);
};

class Derived : public Base {
public:
    Derived(int value)
        : Base(value) {
    }
};
```

以下写法会出错：

```cpp
class Derived : public Base {
public:
    Derived(int value) {
        // 编译器会尝试 Base()，但 Base 没有无参构造函数
    }
};
```

**多重继承的构造顺序**由继承列表中的声明顺序决定，而不是初始化列表书写顺序：

```cpp
class D : public B1, public B2 {
public:
    D() : B2(), B1() {
    }
};
```

实际仍先构造 `B1`，再构造 `B2`，因为继承列表写的是 `B1, B2`。同样，派生类自己的成员构造顺序由它们在类中的声明顺序决定，编译器通常会对列表顺序不一致给出警告。

**析构顺序与构造相反**：

1. 执行派生类析构函数体。
2. 逆声明顺序析构派生类自己的成员。
3. 析构基类子对象。

```text
构造：基类 → 派生类成员 → 派生类构造函数体
析构：派生类析构函数体 → 派生类成员 → 基类
```

这样派生类析构函数运行时，基类部分仍然有效；派生类完成自己的清理后，才销毁基类状态。

```cpp
class Base {
public:
    explicit Base(int n) : number_(n) {
        ++number_;
        print();
    }

    ~Base() {
        --number_;
        print();
    }

private:
    void print() const;
    int number_;
};

class Derived : public Base {
public:
    Derived(int n1, int n2) : Base(n1), value_(n2) {
    }

    ~Derived() {
        // 输出 value_
    }

private:
    int value_;
};
```

若创建 `Derived d(1, 99);`，基类构造时可输出 `2`，离开作用域时派生类析构可输出 `99`，最后基类析构可输出 `1`，顺序体现为：

```text
2 99 1
```

后续若会通过基类指针删除派生类对象，基类析构函数通常应为虚函数；这是虚函数和多态章节的重点。

### 派生类的拷贝构造和赋值函数

派生类对象由“基类部分 + 派生类新增部分”构成，因此拷贝构造和赋值时不能只处理新增数据。

若用户不自定义，编译器通常会：

- 构造派生类副本时，调用基类的拷贝构造函数构造基类子对象，再复制派生类成员。
- 给派生类对象赋值时，调用基类的赋值函数处理基类部分，再赋值派生类成员。

对于只含 `int` 等简单值成员的类，默认版本通常够用；若基类或派生类管理动态资源、共享所有权或其他特殊状态，就要认真设计拷贝和赋值语义。

**自定义派生类拷贝构造函数**：

```cpp
class A {
public:
    explicit A(int value = 0) : data_(value) {
    }

    A(const A& other) : data_(other.data_) {
    }

private:
    int data_;
};

class B : public A {
public:
    B(int data, int number)
        : A(data), number_(number) {
    }

    B(const B& other)
        : A(other),
          number_(other.number_) {
    }

private:
    int number_;
};
```

初始化列表中的：

```cpp
A(other)
```

表示调用 `A` 的拷贝构造函数来构造 `B` 对象内部的 `A` 基类子对象。`other` 虽然是 `B`，但它包含一个 `A` 子对象，可作为 `const A&` 传给 `A` 的拷贝构造函数。

不应让派生类直接复制基类私有数据：

```cpp
// data_ = other.data_; // 若 data_ 是 A 的 private 成员，非法
```

更稳妥的设计是让基类自己负责自己的拷贝规则。这样即使基类以后改变内部表示，派生类也不必直接依赖它的私有数据布局。

**自定义派生类赋值函数**：

```cpp
class B : public A {
public:
    B& operator=(const B& other) {
        if (this != &other) {
            A::operator=(other);
            number_ = other.number_;
        }
        return *this;
    }

private:
    int number_ = 0;
};
```

步骤是：

1. 判断自我赋值。
2. 调用 `A::operator=(other)`，处理基类子对象。
3. 赋值派生类自己的成员。
4. 返回 `*this`，支持链式赋值。

`A::operator=(other)` 中的 `other` 会以其 `A` 基类部分参与基类赋值。

派生类拷贝构造与赋值的差别可以这样记：

| 项目     | 拷贝构造                | 赋值                           |
| -------- | ----------------------- | ------------------------------ |
| 左侧对象 | 正在创建                | 已经存在                       |
| 基类部分 | 初始化列表中 `A(other)` | 函数体中 `A::operator=(other)` |
| 新增成员 | 初始化或构造            | 赋值                           |
| 返回值   | 没有                    | 通常返回 `*this`               |

### newdefine、redefine、overload、overwrite

派生类中常出现“同名成员函数”，课程使用 `newdefine`、`redefine`、`overload`、`overwrite` 等词区分它们。要注意：其中部分是课程中的分类术语；标准 C++ 中尤其应把**同名隐藏**与**虚函数 override**分开理解。

| 术语             | 本章中的理解   | 判断标准                                 |
| ---------------- | -------------- | ---------------------------------------- |
| newdefine        | 新定义         | 派生类定义的函数在基类中没有同名函数     |
| redefine         | 普通同名重定义 | 基类有同名、同参数列表的普通函数         |
| overload         | 函数重载       | 同一作用域中同名、参数列表不同           |
| overwrite / hide | 同名隐藏       | 派生类出现同名函数，隐藏基类所有同名函数 |
| override         | 虚函数重写     | 派生类以匹配签名重写基类虚函数           |

**newdefine：派生类新增函数。**

```cpp
class A {
public:
    void f();
};

class B : public A {
public:
    void bf(); // A 中没有 bf：newdefine
};
```

**redefine：普通同名同原型函数。**

```cpp
class A {
public:
    void g();
};

class B : public A {
public:
    void g(); // 课程中称为 redefine
};
```

`B::g()` 与 `A::g()` 名字和参数列表相同，但基类函数不是虚函数时，这不构成多态意义的重写。通过 `B` 对象直接调用 `g()` 会找到 `B::g()`；若要调用基类版本，可以显式写 `A::g()`。

**overload：同一作用域中的函数重载。**

```cpp
void f();
void f(int);
void f(double);
```

它们同名但参数列表不同，因此在同一作用域构成重载。继承体系中最容易踩的坑是：派生类声明同名函数后，并不会自动和基类同名函数合并成一个完整重载集。

**overwrite/hide：同名隐藏。**

```cpp
class A {
public:
    void f();
    void f(int);
};

class B : public A {
public:
    void f(double);

    void test() {
        // f();   // 错误：A::f() 被 B::f 隐藏
        // f(10); // 错误：A::f(int) 也被隐藏
        f(3.14);  // 调用 B::f(double)
    }
};
```

只要派生类中出现名字为 `f` 的函数，基类所有叫 `f` 的函数都会在派生类作用域中被隐藏，**不看参数列表是否相同**。

若希望同时保留基类重载版本，可使用 `using` 声明：

```cpp
class B : public A {
public:
    using A::f;
    void f(double);
};
```

此时 `A::f()`、`A::f(int)` 和 `B::f(double)` 可以共同参与 `B` 作用域中的重载决议。

**override：重写虚函数。**

```cpp
class A {
public:
    virtual void h();
};

class B : public A {
public:
    void h() override;
};
```

`override` 要求基类函数是虚函数，并且派生类函数在参数、`const`、引用限定等方面匹配可重写规则。`override` 关键字还能让编译器在签名写错时及时报错。

同名隐藏和 `override` 可以同时存在于一个类里，但概念不同：隐藏是名字查找规则；重写是虚函数动态绑定规则。后续虚函数章节会详细讨论。

### 继承的含义

继承不是“只要能少写代码就该用”的语法技巧。不同继承方式表达不同逻辑含义，应先确认语义，再决定是否继承。

**公有继承表达 is-a。**

```text
派生类是一种基类
派生类可以被当作基类使用
```

例如手动挡车和自动挡车都是一种汽车：

```cpp
class Car {
public:
    void run();
    void brake();
};

class ManualCar : public Car {
public:
    void shiftGear();
};

class AutoCar : public Car {
public:
    void autoShift();
};
```

公有继承最重要的价值是**类型替代**：需要 `Car` 的地方，可传入 `ManualCar` 或 `AutoCar`。

```cpp
void drive(Car& car) {
    car.run();
}

ManualCar manual_car;
AutoCar auto_car;

drive(manual_car);
drive(auto_car);
```

这种派生类到基类的替代能力，是后续多态和动态绑定的基础。若不能自然说出“派生类是一种基类”，就不应为了复用代码而使用公有继承。

**私有继承表达实现复用，而不是类型替代。**

```cpp
class Bike {
public:
    void move();
    void stop();
};

class Player : private Bike {
public:
    void startRace() {
        move();
    }

    void endRace() {
        stop();
    }
};
```

`Player` 不是一种 `Bike`，不能合理地把 `Player` 当作自行车交给需要 `Bike` 的函数。这里私有继承只是让 `Player` 的实现借用了 `Bike` 的功能，更接近“用 `Bike` 实现自己”（implemented-in-terms-of）。

**保护继承**和私有继承的对外效果相近：基类公开接口不再作为派生类公开接口。差别是保护继承会把基类的 `public`、`protected` 成员保留为派生类的 `protected` 成员，方便继续向更下层派生类传递。

它同样通常不表示 is-a，只有在确实要让实现能力沿多层继承树传播时才考虑使用。

还要区分“继承需要什么”：C++ 派生类需要看到基类的完整类定义，通常意味着需要基类头文件；但这不等于必须拿到基类的 `.cpp` 源实现。若某个库只提供稳定公开接口且并未为继承设计，通常更适合作为黑盒组件通过组合或依赖使用。

### 继承和组合的选择

继承是垂直关系，组合是水平关系。选择的核心通常是：两个类之间到底是 **is-a**，还是 **has-a / uses-a**。

| 关系     | 自然语言判断                 | 常见实现                  |
| -------- | ---------------------------- | ------------------------- |
| 公有继承 | “派生类是一种基类”           | `class D : public B`      |
| 组合     | “对象拥有或包含另一个对象”   | 对象成员、`unique_ptr` 等 |
| 依赖     | “某次行为临时使用另一个对象” | 参数、局部变量、返回值    |
| 一般关联 | “对象长期知道另一个对象”     | 非拥有指针、引用或标识    |

私有继承常可由组合替代。前面的 `Player : private Bike` 可以改为：

```cpp
class Player {
public:
    void startRace() {
        bike_.move();
    }

    void endRace() {
        bike_.stop();
    }

private:
    Bike bike_;
};
```

这个版本更直接地表达：运动员有一辆自行车，并在比赛行为中使用它。`Bike` 不会意外成为 `Player` 的基类接口；以后若要替换为其他交通工具、通过指针延迟创建或让多名运动员共享同一辆车，也更容易调整。

私有继承中，基类子对象会随派生类一起构造和析构，生命周期上更接近组合而不是聚合。因此若目的只是实现复用，优先组合通常更清楚、更灵活。

可以按以下问题顺序判断：

1. 能否自然说出“`Derived` 是一种 `Base`”？若能，考虑公有继承。
2. 若不能，是否表达整体拥有部分、并控制其生命周期？若是，优先组合。
3. 若只在一次行为中使用另一个对象，使用依赖。
4. 若需要长期保存对另一个独立对象的联系，使用关联或聚合。
5. 若只是想复用一段实现，先尝试组合；除非保护继承层次确实有必要，否则谨慎使用私有/保护继承。

推荐的整体策略是：构建若干低矮、语义明确的公有继承树，再用组合、关联和依赖等水平关系把它们连接起来。避免把所有差异都塞进一棵又深又大的继承树中。

> 优先组合而不是继承，不是说继承不好；而是说只有当 is-a 与可替代性确实成立时，公有继承才是最清楚、最有价值的选择。

## 继承和类型转换

### 继承下的类型转换

继承把基类和派生类放进同一条类型层次中，因此会出现不同于普通内置类型的转换：派生类可以转换成基类，基类也可能尝试转换成派生类。

假设有：

```cpp
class Base {
};

class Derived : public Base {
};
```

继承下的转换方向有两个：

| 方向         | 含义          | 常用英文 |
| ------------ | ------------- | -------- |
| 向上类型转换 | 派生类 → 基类 | upcast   |
| 向下类型转换 | 基类 → 派生类 | downcast |

无论是对象、指针还是引用，都可能出现这两个方向；但转换是否合理、是否允许、是否安全，要先看**继承方式和真实对象类型**。

**继承方式影响类型转换的设计意义。**

| 继承方式         | 对外接口关系                   | 类型转换的通常意义            |
| ---------------- | ------------------------------ | ----------------------------- |
| `public` 继承    | 派生类保留基类公开接口         | 派生类可自然当作基类使用      |
| `protected` 继承 | 基类公开接口在派生类中变为保护 | 对外不再表达 is-a             |
| `private` 继承   | 基类公开接口在派生类中变为私有 | 主要用于实现复用，不表达 is-a |

公有继承表达“派生类是一种基类”，因此派生类向基类的转换有明确语义。私有、保护继承则主要是实现复用，对外不承诺“派生类可以当作基类”，所以不应把它们当作普通父子类型关系使用。

**私有和保护继承下的转换。**

```cpp
class Bike {
public:
    void move();
    void stop();
};

class Player : private Bike {
public:
    void startRace() {
        move();
    }
};
```

`Player` 内部可以复用 `Bike` 的功能，但不能自然地说“运动员是一辆自行车”。因此类外代码不能把 `Player*` 隐式转换成 `Bike*`：

```cpp
Player player;

// Bike* bike = &player; // 错误：private 继承使这条基类转换对外不可访问
```

不要为了让代码通过而使用 C 风格强制转换绕开访问控制。这样做即使勉强取得了某个地址，也违背了私有继承“不把 Bike 作为 Player 公共接口”的设计意图。

如果 `Player` 确实需要向外提供某种自行车能力，应显式设计一个合适的接口：

```cpp
class Player : private Bike {
public:
    void startRace() {
        move();
    }

    void stopRace() {
        stop();
    }
};
```

或根据真正业务语义改为组合：

```cpp
class Player {
public:
    void startRace() {
        bike_.move();
    }

private:
    Bike bike_;
};
```

保护继承也类似：派生类和其后续子类可以在继承体系内使用基类成员，但普通外部代码不应把派生类对象当作基类对象。

**向下转换为什么要谨慎。**

假设：

```text
Animal
├── Dog
└── Cat
```

一个 `Animal*` 可能指向 `Dog`、`Cat`，也可能指向一个单独的 `Animal` 对象。静态类型写成 `Animal*` 并不能保证它的真实对象就是 `Dog`。

```cpp
Animal* animal = /* 某个 Animal、Dog 或 Cat 对象 */;

// Dog* dog = ...; // 只有确认真实对象确实是 Dog 才合理
```

因此基类到派生类的向下转换不能只凭静态类型猜测。需要运行时检查时，应使用后面介绍的 `dynamic_cast`；需要避免这种检查时，往往说明程序应通过虚函数多态来表达行为，而不是频繁询问“你到底是哪种子类”。

### public继承下的向上类型转换

公有继承表达 is-a：派生类对象是一种更具体的基类对象。

```cpp
class Car {
public:
    virtual ~Car() = default;
    void run();
    void brake();
};

class ManualCar : public Car {
public:
    void shiftGear();
};
```

`ManualCar` 是一种 `Car`，因此从 `ManualCar` 到 `Car` 的向上转换是自然且安全的。常见形式有三种。

**形式一：派生类指针转基类指针。**

```cpp
ManualCar manual;

Car* car1 = &manual;
Car* car2 = new ManualCar;
```

`car1`、`car2` 的静态类型都是 `Car*`，但它们指向的实际对象仍然是 `ManualCar`。准确地说，基类指针指向 `ManualCar` 对象内部的 `Car` 基类子对象。

这种转换不复制对象，也不丢失对象中 `ManualCar` 的数据；只是通过 `Car*` 访问时，编译器只允许使用 `Car` 的公开接口。

若基类指针拥有一个派生类对象并负责删除它，基类析构函数应为虚函数：

```cpp
class Car {
public:
    virtual ~Car() = default;
    virtual void run();
};

Car* car = new ManualCar;
delete car; // 能正确调用 ManualCar 析构，再析构 Car 部分
```

**形式二：派生类引用转基类引用。**

```cpp
ManualCar manual;

Car& car_ref = manual;
const Car& const_car_ref = manual;
```

引用可以理解为同一个对象中 `Car` 基类部分的别名。它不创建新对象，也不会丢失派生类部分。

这让函数可以面向一般类型编程：

```cpp
void drive(Car& car) {
    car.run();
}

ManualCar manual;
drive(manual);
```

以后即使增加 `AutoCar`、`ElectricCar` 等新的公有派生类，`drive(Car&)` 的接口通常不需要修改。

**形式三：派生类对象转基类对象。**

```cpp
ManualCar manual;
Car car = manual;
```

这同样是合法的向上转换，但与指针、引用不同：它会创建一个**新的 `Car` 对象**，只复制 `manual` 中的 `Car` 基类部分。`ManualCar` 自己新增的数据和行为不属于新对象，这种现象称为**对象切片**。

```text
ManualCar 对象 = Car 基类部分 + ManualCar 新增部分

Car car = manual;
          ↓
只复制 Car 基类部分，新增部分被切掉
```

三种形式可对比为：

| 转换形式            | 是否复制对象 | 是否保留原派生对象               | 是否发生对象切片 |
| ------------------- | ------------ | -------------------------------- | ---------------- |
| `Car* p = &manual;` | 否           | 是                               | 否               |
| `Car& r = manual;`  | 否           | 是                               | 否               |
| `Car c = manual;`   | 是           | 原对象仍在，但新对象只剩基类部分 | 是               |

因此，公有继承体系中通常优先使用基类**指针或引用**传递对象；按值接收基类对象时要特别警惕对象切片：

```cpp
void badDrive(Car car);  // 传入派生对象时会切片
void drive(Car& car);    // 保留对象身份
void view(const Car& car); // 只读且不切片
```

**向上转换的典型用途。**

第一，类可以保存基类指针或智能指针，从而接受任意派生类对象：

```cpp
#include <memory>
#include <utility>

class Garage {
public:
    explicit Garage(std::unique_ptr<Car> car)
        : car_(std::move(car)) {}

private:
    std::unique_ptr<Car> car_;
};

Garage garage(std::make_unique<ManualCar>());
```

第二，函数参数可声明为基类引用或指针：

```cpp
void service(Car& car) {
    car.brake();
}
```

任何公有派生自 `Car` 的对象都可以作为参数传入。基类接口越稳定，函数就越容易面向抽象而不是某个具体子类编程。

**public 继承下的向下转换。**

向下转换在逻辑上可能有意义，但不保证成功：

```cpp
class AutoCar : public Car {
};

Car* car = new AutoCar;

// ManualCar* manual = ...; // 不能假设 car 指向 ManualCar
```

若基类是多态类型（通常至少有一个虚函数），可以在运行时检查：

```cpp
ManualCar* manual = dynamic_cast<ManualCar*>(car);

if (manual != nullptr) {
    manual->shiftGear();
}
```

若 `car` 实际指向 `AutoCar`，转换失败并得到 `nullptr`，不会把 `AutoCar` 错当成 `ManualCar`。`dynamic_cast` 的详细规则在下一节展开。

### 类型转换操作符

C++ 中常见的类型转换方式包括：

| 转换方式           | 例子                                                            |
| ------------------ | --------------------------------------------------------------- |
| 内置自动转换       | `int` 转 `float`                                                |
| 转换构造函数       | `int` 转 `Fraction`                                             |
| 转换函数           | `Fraction::operator float()`                                    |
| 公有继承下向上转换 | `Derived*` 转 `Base*`                                           |
| 显式转换操作符     | `static_cast`、`const_cast`、`reinterpret_cast`、`dynamic_cast` |

旧式 C 风格转换写法很短：

```cpp
int n = (int)3.14;
```

但它把多种不同风险的转换混在一个写法中，读代码的人难以看出意图。C++ 把显式转换拆成四个操作符，让每种转换的目的更清楚。

#### static_cast

格式：

```cpp
static_cast<T>(expression)
```

`static_cast` 用于有明确编译期规则的转换，例如数值转换：

```cpp
double d = 3.14;
int n = static_cast<int>(d); // 截断小数部分，n 为 3
```

也常用于枚举、类类型转换，以及公有继承的向上转换：

```cpp
ManualCar manual;
Car& car = static_cast<Car&>(manual);
```

向下转换也可以写成 `static_cast<Derived*>`，但它**不做运行时检查**：

```cpp
Car* car = /* ... */;

// 只有程序已经能保证 car 实际指向 ManualCar 时才可考虑
ManualCar* manual = static_cast<ManualCar*>(car);
```

若真实对象不是 `ManualCar`，随后通过 `manual` 使用对象会产生未定义行为。一般业务代码中，不应把 `static_cast` 当成“赌一把的向下转换”；需要检查时用 `dynamic_cast`，需要不同子类行为时优先考虑虚函数。

`static_cast` 不能随意把无关对象指针直接转成另一种对象指针。若确实要处理原始字节地址，应先转为 `void*` 或使用更低层的 `reinterpret_cast`，并明确了解对齐、生命周期和别名规则。

#### const_cast

格式：

```cpp
const_cast<T>(expression)
```

`const_cast` 只用于添加或去除 `const`、`volatile` 等类型限定。除限定符外，目标类型与原类型必须对应。

```cpp
class A {
public:
    void setValue(int value) {
        value_ = value;
    }

    int value() const {
        return value_;
    }

private:
    int value_ = 0;
};

A a;
const A& ca = a;

A& writable = const_cast<A&>(ca);
writable.setValue(6); // 合法：a 原本不是 const 对象
```

这里 `ca` 只是以常引用方式观察一个本来可修改的 `a`。去掉观察视角上的 `const` 后修改 `a`，通常可以工作。

但若原对象本身就是常对象：

```cpp
const A a;
A& writable = const_cast<A&>(a);

// writable.setValue(6); // 未定义行为：试图修改真正的 const 对象
```

`const_cast` 不会让一个真正不可修改的对象 magically 变得可修改，它只改变表达式的类型限定。除非在与旧接口兼容等非常明确的场景中，应尽量避免去掉 `const`。

`volatile` 表示对象的值可能在程序正常控制之外改变，例如某些硬件寄存器。它阻止编译器把每次读取随意优化掉；但 `volatile` 不等于线程同步机制，不能代替原子操作或互斥锁。

#### reinterpret_cast

格式：

```cpp
reinterpret_cast<T>(expression)
```

`reinterpret_cast` 表示“按另一种类型重新解释这一地址或位模式”。它常出现在底层系统接口、硬件、序列化、函数指针或特殊 ABI 交互中：

```cpp
#include <cstdint>

std::uintptr_t address = /* 某个地址数值 */;
void* p = reinterpret_cast<void*>(address);
```

这类转换风险很高。它通常不构造新对象，也不验证目标类型是否真的适合访问当前内存。错误使用可能违反对齐要求、对象生命周期或严格别名规则。

函数指针之间的重新解释尤其应谨慎：即使某些平台允许转换，使用不匹配签名去调用函数仍可能是未定义行为。普通应用层面向对象代码应尽量少用 `reinterpret_cast`；若频繁需要它，通常应把低层细节封装到很小、经过充分测试的边界模块中。

#### dynamic_cast

格式：

```cpp
dynamic_cast<T>(expression)
```

`dynamic_cast` 在运行时检查对象真实类型，最常用于公有继承体系中的安全向下转换。基类必须是**多态类型**，也就是至少有一个虚函数：

```cpp
class Animal {
public:
    virtual ~Animal() = default;
};

class Dog : public Animal {
public:
    void bark();
};

class Cat : public Animal {
};
```

**指针形式**：失败时返回空指针。

```cpp
Animal* animal = new Cat;
Dog* dog = dynamic_cast<Dog*>(animal);

if (dog != nullptr) {
    dog->bark();
} else {
    // animal 实际不是 Dog
}

delete animal;
```

**引用形式**：引用不能是空，因此失败时抛出 `std::bad_cast`：

```cpp
void makeDogBark(Animal& animal) {
    try {
        Dog& dog = dynamic_cast<Dog&>(animal);
        dog.bark();
    } catch (const std::bad_cast&) {
        // animal 实际不是 Dog
    }
}
```

| 形式                    | 成功结果    | 失败结果             |
| ----------------------- | ----------- | -------------------- |
| `dynamic_cast<Dog*>(p)` | 得到 `Dog*` | `nullptr`            |
| `dynamic_cast<Dog&>(r)` | 得到 `Dog&` | 抛出 `std::bad_cast` |

`dynamic_cast` 是 RTTI（运行时类型识别）的一部分。它解决“运行时对象究竟是不是这个派生类”的问题，但频繁向下转换往往也是一个设计信号：若代码总在根据具体派生类分支，可能应该把差异放进虚函数接口，让对象自己表现出对应行为。

四个转换操作符可以这样对比：

| 操作符             | 核心用途                     | 是否运行时检查 | 常见风险                               |
| ------------------ | ---------------------------- | -------------- | -------------------------------------- |
| `static_cast`      | 明确的编译期转换             | 否             | 数值损失、错误的无检查向下转换         |
| `const_cast`       | 改变 `const`/`volatile` 限定 | 否             | 修改真正 const 对象会未定义行为        |
| `reinterpret_cast` | 低层地址/位模式重新解释      | 否             | 对齐、生命周期、别名与调用约定错误     |
| `dynamic_cast`     | 多态体系中的运行时类型检查   | 是             | 有运行时开销，过度使用可能暴露设计问题 |

一句话记忆：`static_cast` 做静态规则转换，`const_cast` 改限定符，`reinterpret_cast` 重新解释底层表示，`dynamic_cast` 在运行时确认多态对象类型。

## 多重继承

### 多重继承

一个派生类只有一个直接基类，称为单继承；一个派生类同时有两个或更多直接基类，称为**多重继承**。

```cpp
class Derived : public Base1, protected Base2, private Base3 {
    // Derived 自己的成员
};
```

与单继承相比，多重继承只是在继承列表中出现多个基类，但它带来的对象布局、构造顺序和成员二义性会明显更复杂。

例如，一个在职博士可能同时具有教师和学生两种角色：

```cpp
class Teacher {
public:
    void teach();
};

class Student {
public:
    void study();
};

class InServiceDoctor : public Teacher, public Student {
public:
    void doResearch();
};
```

`InServiceDoctor` 可以使用 `teach()`、`study()`，并新增 `doResearch()`。这说明多重继承能够组合多个已有类型的能力；但它也马上带来两个典型风险：

- 不同基类中出现同名成员，导致访问二义性。
- 多条继承路径指向同一个共同基类，形成菱形结构。

**构造和析构顺序。**

```cpp
class D : public B1, public B2 {
public:
    D() : B2(), B1() {
    }
};
```

实际构造顺序仍然是：

```text
B1 → B2 → D 自己的数据成员 → D 构造函数体
```

顺序由继承列表 `public B1, public B2` 决定，不由初始化列表 `B2(), B1()` 的书写顺序决定。析构顺序则完全相反：

```text
D 析构函数体 → D 成员 → B2 → B1
```

多重继承对象中会包含多个基类子对象：

```text
D 对象
├── B1 基类子对象
├── B2 基类子对象
└── D 自己新增的数据成员
```

对象中实际存放的是各类的非静态数据成员和必要的实现信息；普通成员函数代码不为每个对象保存一份。若基类或派生类涉及虚函数、虚继承，实际布局还可能包含编译器用于定位相关子对象的辅助信息。

> 多重继承的难点不在语法，而在于：同名成员来自哪里、共同基类出现几份、构造顺序由谁决定。

### 多重继承中的名字冲突

若多个基类拥有同名成员，派生类直接使用该名字时可能产生二义性：

```cpp
class A {
public:
    int f() {
        return 55;
    }

protected:
    int number_ = 1;
};

class B {
public:
    int f() {
        return 88;
    }

protected:
    int number_ = 2;
};

class C : public A, public B {
public:
    void test() {
        // f();           // 错误：不知道是 A::f 还是 B::f
        // number_ = 10;  // 错误：不知道是 A::number_ 还是 B::number_
    }
};
```

`C` 同时包含一个 `A` 子对象和一个 `B` 子对象，因此也同时拥有两份名为 `f` 和 `number_` 的成员。未限定的名字没有唯一来源，编译器只能报二义性错误。

**方法一：作用域限定。**

```cpp
class C : public A, public B {
public:
    void test() {
        int x = A::f();
        B::number_ = 10;
    }
};
```

`A::f()` 明确调用从 `A` 继承的函数；`B::number_` 明确访问 `B` 子对象中的数据成员。

这种写法最直接，但每次使用都要知道成员来自哪个基类。若大量代码都要写限定名，说明继承结构的使用成本已经很高。

**方法二：`using` 声明。**

可以在派生类作用域中指定某个基类成员作为未限定名字的默认来源：

```cpp
class C : public A, public B {
public:
    using A::f;
    using B::number_;

    void test() {
        int x = f();
        number_ = 10;
    }
};
```

`using A::f;` 把 `A` 中的 `f` 引入 `C` 的作用域；`using B::number_;` 则选择 `B` 中的 `number_`。`using` 所在的访问区域还会影响该成员在 `C` 中对外呈现的可访问性。

**`using` 的局限。**

它解决的是名字查找问题，不会改变对象内部实际存在的成员：

```text
C 对象
├── A::number_ 仍然存在
├── B::number_ 仍然存在
└── C 自己的数据
```

即使 `C` 通过 `using B::number_` 默认使用了 `B` 的版本，`A::number_` 也没有消失。函数名冲突相对容易通过限定名或 `using` 处理；数据成员冲突更麻烦，因为它们真实占用对象空间，也可能各自保存不同状态。

理想情况是多个基类本来就不会提供含义不同却同名的数据和函数。若必须用多重继承，也应尽量让基类职责独立、命名清楚，减少使用者记忆继承细节的负担。

### 菱形结构

**菱形结构**（钻石结构）指一个共同基类通过两条继承路径进入同一个最终派生类：

```text
      A
     / \
    B   C
     \ /
      D
```

代码形式：

```cpp
class A {
public:
    void fA();

private:
    int a_ = 0;
};

class B : public A {
private:
    int b_ = 0;
};

class C : public A {
private:
    int c_ = 0;
};

class D : public B, public C {
private:
    int d_ = 0;
};
```

这里的关键不是 `A`、`B`、`C` 是否各自有同名函数。即使所有名字都不同，`D` 仍然会通过 `B` 获得一份 `A`，又通过 `C` 获得另一份 `A`：

```text
D 对象
├── B 子对象
│   └── A 子对象（第一份）
├── C 子对象
│   └── A 子对象（第二份）
└── D 自己的数据
```

因此：

```cpp
D d;

// d.fA(); // 错误：应从 B 路径还是 C 路径找到 A::fA？
```

可以临时明确路径：

```cpp
d.B::fA();
d.C::fA();
```

但这不是根本解决。两个调用操作的是两份不同的 `A` 基类子对象；`A` 中的 `a_` 也存在两份。若业务语义本来只应该有一个共同的 `A` 状态，重复子对象会造成空间浪费、状态不一致和类型转换二义性。

普通名字冲突与菱形结构的来源不同：

| 问题                 | 根源                               |
| -------------------- | ---------------------------------- |
| 普通多重继承名字冲突 | 两个不同基类各自定义了同名成员     |
| 菱形结构             | 同一个共同基类经两条路径被重复继承 |

因此，只靠“给不同类的成员起不同名字”不能消除菱形结构；要么使用虚基类，让最终对象只保留一份共同基类；要么重新设计关系，避免形成这个继承图。

### 虚基类的解决方案

C++ 提供**虚基类**来解决菱形结构中共同基类重复出现的问题。关键是在中间层继承共同基类时写 `virtual`：

```cpp
class A {
public:
    explicit A(int value = 0) : value_(value) {}
    void fA();

private:
    int value_;
};

class B : virtual public A {
};

class C : virtual public A {
};

class D : public B, public C {
};
```

`B` 和 `C` 都虚继承 `A` 后，最派生类 `D` 中只保留一份共享的 `A` 虚基类子对象：

```text
D 对象
├── B 子对象
├── C 子对象
├── D 自己的数据
└── 共享的 A 虚基类子对象（只有一份）
```

于是：

```cpp
D d;
d.fA(); // 不再因两份 A 子对象而二义
```

**最派生类负责构造虚基类。**

这是虚继承最重要、也最容易遗漏的规则。若 `A` 没有无参构造函数，最终派生类必须负责在初始化列表中构造 `A`：

```cpp
class A {
public:
    explicit A(int value);
};

class B : virtual public A {
public:
    B() : A(1) {}
};

class C : virtual public A {
public:
    C() : A(2) {}
};

class D : public B, public C {
public:
    D() : A(3), B(), C() {}
};
```

当单独构造 `B` 时，`B()` 中的 `A(1)` 用来构造它自己的虚基类部分；单独构造 `C` 时，`C()` 中的 `A(2)` 生效。

但构造最派生类 `D` 时，`A` 只有一份，最终由 `D()` 中的 `A(3)` 构造。此时 `B()`、`C()` 初始化列表中的 `A(1)`、`A(2)` 不负责构造这一份共享 `A`。

虚继承下的构造顺序可以粗略记为：

1. 先构造所有虚基类（由最派生类负责）。
2. 再按继承列表顺序构造非虚直接基类。
3. 再按声明顺序构造最派生类自己的成员。
4. 最后执行最派生类构造函数体。

**虚基类的代价。**

虚继承并非免费：

- 对象布局需要额外的编译器辅助信息来定位共享虚基类。
- 访问虚基类成员、向上转换到虚基类时，可能需要运行时或对象相关的偏移调整。
- 中间层作者必须预先决定采用虚继承，才能让未来的菱形结构共享共同基类。

具体实现不一定真的是“每个中间类保存一个 `A*`”；不同编译器布局不同。应记住抽象事实：虚继承需要额外定位机制，因此布局和转换通常比普通继承更复杂。

虚基类适合确实存在“最终对象只能有一份共同基类状态”的场景。若仅仅是为了压制一个设计不清晰的继承图，通常更好的方案是重新拆分职责或使用组合。

### 其它解决方案

虚基类是 C++ 的语言级方案，但不是多重继承问题唯一的解决方式。

**方案一：只允许单继承。**

一些语言只允许一个实现基类，从语法上杜绝多重继承名字冲突和菱形结构。优点是对象模型简单；缺点是一个类难以同时表达多个独立的接口身份。

**方案二：一个有状态基类，加多个无状态接口类。**

这是现代设计中常见的折中准则：若需要多重继承，多个基类中尽量至多只有一个拥有非静态数据成员；其他基类只定义行为契约，不保存实例状态。

```cpp
class Person {
public:
    void work();

private:
    int salary_ = 0;
};

class IPrintable {
public:
    virtual ~IPrintable() = default;
    virtual void print() const = 0;
};

class ISerializable {
public:
    virtual ~ISerializable() = default;
    virtual void save() const = 0;
};

class SpecialPerson : public Person, public IPrintable, public ISerializable {
public:
    void print() const override;
    void save() const override;
};
```

`Person` 提供主要身份和实例状态；`IPrintable`、`ISerializable` 只规定“必须能做什么”。`SpecialPerson` 因此能同时被当作 `Person`、`IPrintable`、`ISerializable` 使用，而不会在对象中复制多份有状态基类数据。

这种只定义公共行为、通常不保存实例数据、并含纯虚函数的基类，常称为**接口类**：

```cpp
class IComputer {
public:
    virtual ~IComputer() = default;
    virtual void runApp() = 0;
    virtual void showVideo() = 0;
};

class IPaper {
public:
    virtual ~IPaper() = default;
    virtual void writeText() = 0;
};

class Telephone {
public:
    void callTo();
    void callBy();
};

class Mobile : public Telephone, public IComputer, public IPaper {
public:
    void runApp() override;
    void showVideo() override;
    void writeText() override;
};
```

这称为**接口继承**：一个类可以拥有一个主要的有状态基类，同时实现多个无状态行为接口。接口类本身因含纯虚函数通常不能实例化，但具体派生类实现所有纯虚函数后可以实例化。

**无实例变量类的其他用途。**

有些类不保存对象状态，但仍然有价值：

- **类型标记类**：用不同异常类型表达不同错误，而不是抛出难以理解的 `1`、`2`。
- **工具类**：把相关静态函数组织在类作用域中。
- **接口类**：只描述行为契约。

```cpp
class NormalError {
};

class SpecialError {
};

void f(bool condition) {
    if (condition) {
        throw NormalError{};
    }

    throw SpecialError{};
}
```

工具类示例：

```cpp
class PackUtility {
public:
    static void packBinary();
    static void packText();
    static void packPicture();
    static int version();
};
```

若工具函数完全不需要对象状态，名字空间中的自由函数也常是更轻量的选择；是否用工具类取决于项目的组织方式。

可以把多重继承的设计选择概括为：

| 需求                       | 更合适的方式                   |
| -------------------------- | ------------------------------ |
| 只有一个主要父类身份       | 单继承                         |
| 多个有状态基类且有共同祖先 | 重新设计、组合或谨慎使用虚基类 |
| 多个独立行为能力           | 一个有状态基类 + 多个接口类    |
| 只是复用功能               | 优先组合或依赖                 |

多重继承不是绝对禁止的工具。它在“一个主要对象身份 + 多个无状态接口”时很有表现力；但若多个基类都携带复杂状态，名字冲突、生命周期和菱形问题会迅速放大，应优先重新设计对象关系。
