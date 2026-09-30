---
title: "OOP Review Notes (4): Extensions and Inheritance"
description: "Reviewing conversions, namespaces, friendship, nested classes, streams, class relationships, and C++ inheritance."
publishDate: "2026-06-03T23:10:37"
tags:
  - "c-cpp"
heroImage:
  src: ../../blog/oop-notes-04-extensions-inheritance/take-me-home.jpg
  color: "#A78B77"
  alt: "OOP Review Notes (4): Extensions and Inheritance"
language: 'en'
draft: false
---

## Conversions, Namespaces, Friends, Nested Classes, and Streams

### Conversion Functions

Programs frequently pass data between types. Built-in conversions, such as `int` to `float`, follow language rules. User-defined types usually need an explicitly designed conversion path.

Three common directions:

| Direction | Example | Mechanism |
| ------------------- | --------------------- | ---------------------- |
| Built-in → built-in | `int` to `float` | Standard conversion rules |
| Another type → this class | `int` to `Fraction` | Converting constructor |
| This class → another type | `Fraction` to `float` | Conversion function/operator |

**Converting constructors: from another type to this class.**

A constructor callable with one argument may provide an implicit conversion path:

```cpp
class Fraction {
public:
    Fraction(int numerator, int denominator = 1)
        : num_(numerator), den_(denominator) {}
};
```

The second parameter has a default, so `Fraction(2)` is valid. Where a `Fraction` is needed, `2` can become `Fraction(2, 1)`:

```cpp
void useFraction(const Fraction& value);

useFraction(2); // 可能隐式构造 Fraction(2, 1)
```

A constructor accepting another type and creating this class is a **converting constructor**. For conversion from `A` to `Fraction`, it belongs to the **destination type**, `Fraction`:

```cpp
class A {
    // 略
};

class Fraction {
public:
    Fraction(const A& value);
};
```

Use `explicit` to prevent implicit conversion through it:

```cpp
class Fraction {
public:
    explicit Fraction(int numerator);
};

void useFraction(const Fraction& value);

useFraction(2);             // 错误：不能隐式转换
useFraction(Fraction(2));   // 正确：显式构造
```

**Conversion functions: from this class to another type.**

A conversion function belongs to the **source type**:

```cpp
class T {
public:
    operator DestType() const {
        return DestType(...);
    }
};
```

Properties:

- Its name combines `operator` with the **destination type**.
- No separate return type is written; `operator DestType` already names it.
- It has no explicit parameters.
- It is often const because conversion normally preserves the source.
- Its body returns a result appropriate for the destination type.

For example, a fraction can provide conversions to `int` and `float`:

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

Here:

```cpp
operator int() const;
```

Means “convert this `Fraction` to `int`.” Do not write:

```cpp
int operator int() const; // 错误：转换函数不能再写普通返回类型
```

**Implicit and explicit conversions.**

Without `explicit`, `operator int()` can participate in ordinary implicit conversion:

```cpp
Fraction f(3, 2);
int value = f; // 调用 operator int()，结果为 1
```

The `operator float()` is explicit:

```cpp
explicit operator float() const;
```

It cannot directly supply this ordinary implicit initialization:

```cpp
float x = f; // 不能直接使用 explicit operator float()
```

State the conversion explicitly:

```cpp
float x1 = static_cast<float>(f); // 结果为 1.5
float x2 = float(f);              // 也可以
```

This distinction matters. Given a function taking `float`:

```cpp
void useFloat(float value);
```

A call such as:

```cpp
useFloat(f);
```

Cannot directly use `explicit operator float()`. It can instead use the implicit `operator int()` to obtain `1`, then convert that to `1.0f`, rather than the `1.5f` produced by the explicit float conversion.

> More conversions mean more possible paths. Prefer explicit conversions when precision, ownership, or meaning changes, rather than letting the compiler choose an unexpected path.

**Where each conversion belongs:**

| Intended conversion | Defined in | Typical form |
| ------------------------ | ---------------- | -------------------- |
| Construct `B` from `A` | Destination `B` | `B(const A&)` |
| Convert an `A` into `B` | Source `A` | `operator B() const` |

Avoid casually providing competing implicit paths in the same direction:

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

Some contexts then cannot choose between `B(const A&)` and `A::operator B()`. Prefer a clear primary path, or make an alternative explicit.

Conversions should make natural operations convenient, not silently connect every vaguely related type.

### Why Namespaces Exist

Names easily collide in collaborative projects or when combining libraries. Suppose two modules both define `f` and `T`:

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

Putting both sets in the global namespace creates conflicting declarations or definitions. The short names alone cannot distinguish the intended modules: a **name collision**.

Manual renaming is fragile:

- Many call sites may need updating.
- Collaborators may not change everything consistently.
- Third-party or legacy code may be unmodifiable.
- The replacement name may collide elsewhere.

A **namespace** gives names an enclosing scope:

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

The qualified names become:

```cpp
Zhang::f();
Li::f();

Zhang::T zhang_object;
Li::T li_object;
```

`Zhang::f` and `Li::f` have the same short name but different qualified names, so they can coexist.

> Namespaces organize ownership of names and distinguish otherwise identical names. They do not turn the enclosed functions or variables into class members.

Namespaces and include guards often appear together, but solve different problems:

| Mechanism | Purpose |
| -------- | -------------------------------------- |
| Include guard | Prevent repeated inclusion within a translation unit |
| Namespace | Separate names from different modules |

### Working with Namespaces

**The standard namespace, std:** common standard-library names such as `cout`, `cin`, `endl`, `string`, and `vector` belong to `std`.

```cpp
#include <iostream>

int main() {
    std::cout << "hello" << std::endl;
}
```

`std` is short for standard. It separates library names from user names. Do not treat it as a namespace for arbitrary application declarations.

**Global and current namespaces:** namespace-scope declarations outside a named namespace belong to the global namespace.

```cpp
int value = 100;

void show() {
    std::cout << value << std::endl;
}
```

Here `value` and `show` are global. A leading `::` explicitly starts lookup at global scope:

```cpp
show();   // 从当前可见范围查找 show
::show(); // 明确从全局名字空间查找 show
```

`::show()` distinguishes the global function when a local or namespace declaration hides it.

**Defining a namespace:**

```cpp
namespace My {
    int value = 100;

    class T {
    };

    void show();
}
```

Use qualified names to access its members:

```cpp
My::show();
std::cout << My::value << std::endl;
```

Just as an out-of-class member definition uses `ClassName::member`, a namespace function defined outside its namespace uses qualification:

```cpp
void My::show() {
    std::cout << "in My" << std::endl;
}
```

**Nested namespaces:**

```cpp
namespace My {
    namespace Detail {
        int version = 1;
    }
}

int v = My::Detail::version;
```

Since C++17, the nesting can be written more compactly:

```cpp
namespace My::Detail {
    int version = 1;
}
```

Both forms express the same hierarchy.

**Namespaces can be reopened** in multiple code sections and files:

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

This adds to the same `My` namespace rather than defining a second one. A class definition cannot be split into repeated partial definitions this way.

**Namespace aliases:** a shorter name can stand for a long namespace name.

```cpp
namespace MyProject = Company::Product::Module;

MyProject::run();
```

An alias creates neither a new namespace nor a copy of its contents. It can be declared at namespace scope or block scope; unlike a using-directive, it gives the namespace another name.

**Unnamed namespaces:**

```cpp
namespace {
    int local_count = 0;

    void helper() {
    }
}
```

Their names have translation-unit-local identity, providing internal linkage where applicable. They are commonly used instead of namespace-scope `static` for implementation details:

```cpp
namespace {
    int local_count = 0;
}

// 与下面这种“仅当前 .cpp 文件可见”的意图相近
static int old_style_count = 0;
```

Usually put an unnamed namespace in a `.cpp` file. In a shared header it creates separate entities in each translation unit, which can be surprising and can cause ODR problems if those entities are used inconsistently by externally linked definitions.

### Bringing Names into Scope

Fully qualified names are clear but can be verbose:

```cpp
std::cout << std::endl;
My::show();
My::Detail::version;
```

Two different `using` forms affect name lookup.

**using namespace N;: a using-directive.**

```cpp
using namespace std;

cout << "hello" << endl;
```

It makes eligible names from `std` available to unqualified lookup. Those names can denote variables, functions, types, or nested namespaces.

The broad scope is convenient but increases the chance of conflicts with names such as `count`, `begin`, or `swap`.

**using N::name;: a using-declaration for a particular name.**

```cpp
namespace First {
    int x = 5;
}

using First::x;

int value = x;
```

This introduces `x`. If it names an overload set, the relevant overloads visible to the declaration participate under that name.

Comparison:

| Syntax | Effect | Collision risk |
| -------------------- | ---------------------------- | ------------------------ |
| `using namespace N;` | Makes many names available to lookup | Higher |
| `using N::x;` | Introduces a particular name | Lower, but not zero |
| `N::x` | Qualifies the use directly | Most explicit |

**Using declarations and directives obey scope.**

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

The directives here are in separate blocks. Leaving the first block ends the effect of that local directive on subsequent lookup.

Useful conventions:

- Avoid broad `using namespace ...;` directives in headers, where they affect includers.
- Prefer explicit names such as `std::cout` and `std::string`, or narrowly scoped `using` declarations.
- When ambiguity is likely, write `N::name` rather than making the reader guess.

### Friends and Friend Classes

An ordinary outside function cannot directly access private members:

```cpp
class A {
private:
    int field_ = 0;
};

void useA(A& a) {
    a.field_ = 5; // 错误：field_ 是 A 的私有成员
}
```

Public accessors would expose that access to all callers. **Friendship** can instead grant access to selected collaborating functions or classes.

**Friend functions:** a `friend` declaration grants a function access to private and protected members.

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

It does not make `useA` an `A` member or supply an implicit `this`. The call remains an ordinary function call:

```cpp
A a;
useA(a);
```

**A member of another class can be a friend.** Its declaration must be known first:

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

Only `B::change` receives this grant; other `B` members do not automatically receive it.

**Friend classes:** grant access to all members of a collaborating class.

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

`friend class Parent;` grants broader access: `Parent` members can access `Wallet`'s private and protected members. Use that breadth deliberately.

Common forms:

| Form | Example | Recipient of access |
| ------------ | ---------------------------- | ------------------ |
| Free function | `friend A operator+(...);` | The named function |
| Member function | `friend void B::change(A&);` | The named member |
| Class | `friend class Parent;` | Members of the named class |
| Nested class | `friend class D;` where `D` denotes that nested class | The designated nested class |

Non-member binary operators are often friends when symmetric operands and direct private access are both useful.

**Properties of friendship:**

1. A friend function need not be a member of the granting class.
2. Placing the friend declaration under `public`, `private`, or `protected` does not change the grant.
3. Friendship is **one-way**.
4. It is **not transitive**.
5. It is **not inherited** by a friend's derived classes.

If `Parent` is a friend of `Wallet`, `Parent` can access `Wallet` internals. The reverse permission does not follow.

If `A` is a friend of `B` and `B` of `C`, that does not make `A` a friend of `C`.

Friendship is a controlled access grant, not necessarily an abandonment of encapsulation. A narrow grant can avoid exposing a broad public interface solely for one collaborator.

Treat it as a deliberate exception. Many unrelated friends may indicate that class responsibilities or interfaces need redesign.

### Nested Classes

A **nested class** is declared within another class. It puts a related helper type in the enclosing class's scope, often expressing an implementation detail of `Outer`.

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

The nested type's name is a member name and is subject to the enclosing class's access control.

A **public nested class** can be named outside:

```cpp
Outer::InnerPublic object;
```

A **private nested class** cannot ordinarily be named from outside:

```cpp
Outer::InnerPrivate object; // 错误：类型名是 Outer 的私有成员
```

Members of `Outer` can use it:

```cpp
void Outer::f() {
    InnerPrivate object;
}
```

It can be declared inside and defined outside:

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

An out-of-class definition of its member uses the full qualification:

```cpp
void Outer::InnerPrivate::f2() {
}
```

It is still a class in its own right, with access sections, data, constructors, static members, and member functions.

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

**Access and object context are separate.** A nested class can access the enclosing class's private members, but has no implicit enclosing `this`. Accessing a non-static member requires an actual enclosing object:

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

Two conclusions:

- The nested class has the relevant enclosing-class access rights.
- The enclosing class does **not** automatically gain access to the nested class's private members.

Typical uses:

- Helper structures used only by the enclosing class.
- Iterators, nodes, and state types.
- Internal types outsiders should not instantiate or depend on directly.
- Grouping related names without adding them to global scope.

> A C++ nested class is not a Java-style inner class automatically bound to an outer instance. Store or pass an outer pointer/reference explicitly when an operation needs one.

### Streams

A **stream** abstracts ordered input or output. Console, file, and string I/O can all use stream interfaces.

```text
数据源 → [ 输入流 ] → 程序
程序   → [ 输出流 ] → 数据目的地
```

Sequential processing is the basic model, although seekable file streams also support repositioning. A stream is not necessarily an irreversible pipe.

**Bytes and characters.**

Files and network data ultimately consist of bytes. Text processing interprets them through character-encoding rules.

| Approach | Focus | Examples |
| ---------- | ------------------------------ | ---------------------------------- |
| Binary | Raw bytes without textual interpretation | Images, audio, binary formats |
| Text | Characters and their encoded representation | Source code, logs, configuration, console text |

A character need not occupy one byte. ASCII characters use one UTF-8 byte, while other characters can use several. Garbled text often reflects mismatches among source-file encoding, compiler settings, terminal encoding, and file I/O assumptions.

**Standard input and output.**

Two common objects from `<iostream>`:

| Object | Type | Typical destination/source |
| ----------- | --------------------------------- | ---------------- |
| `std::cin` | Standard input object of type `std::istream` | Usually keyboard input, unless redirected |
| `std::cout` | Standard output object of type `std::ostream` | Usually console output, unless redirected |

They are existing **objects**, not classes or ordinary functions:

```cpp
#include <iostream>

int main() {
    int value;
    std::cin >> value;
    std::cout << value;
}
```

`>>` extracts from an input stream; `<<` inserts into an output stream. Returning the stream by reference enables chaining:

```cpp
int a;
int b;

std::cin >> a >> b;
std::cout << "a=" << a << ", b=" << b << '\n';
```

**What endl does.**

`std::endl` is an output manipulator that:

1. Inserts a newline.
2. Flushes the output stream.

```cpp
std::cout << "done" << std::endl;
```

For just a newline, use:

```cpp
std::cout << "done\n";
```

The extra flush can make buffered output visible sooner, but repeatedly flushing can reduce performance:

```cpp
for (int i = 0; i < 10000; ++i) {
    std::cout << i << '\n';        // 通常更适合大量输出
    // std::cout << i << std::endl; // 每次都刷新，可能明显更慢
}
```

Use `std::endl` or `std::flush` when immediate flushing is needed. For an ordinary line break, `'
'` is often preferable.

Key terms:

- **Converting constructor:** another type to this class; defined in the destination.
- **Conversion function:** this class to another type; defined in the source.
- **Namespace:** organizes names to reduce collisions.
- **Friend:** grants selected access without making a function a member.
- **Nested class:** organizes a type within an enclosing class, without an automatic outer instance.
- **Stream:** ordered I/O; `endl` means newline plus flush.

## Relationships Between Classes

### Compile-Time Dependencies

Real programs involve many collaborating classes. Their relationships have both **physical** and **logical** aspects:

- **Physical:** includes, forward declarations, and recompilation dependencies between files.
- **Logical:** association, aggregation, composition, dependency, or inheritance in the design model.

First, consider physical **compile-time dependencies**.

**One-way and two-way relationships.**

If only `B` uses `A`, the relationship is one-way:

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

If both retain or use the other, it is two-way:

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

Two-way relationships complicate initialization, cleanup, lifetimes, includes, and change propagation. Require both directions only when the design actually needs them.

**By-value members create a strong compile-time dependency.**

```cpp
// B.h
#include "A.h"

class B {
private:
    A a_;
};
```

To lay out `B` with an embedded `A`, the compiler needs `A`'s complete definition, so `B.h` must make it available.

A forward declaration alone is insufficient:

```cpp
class A;

class B {
private:
    A a_; // 错误：A 还是不完整类型，不知道对象大小
};
```

> A forward declaration says that `A` exists. It does not reveal its size, members, or the information required to construct and destroy embedded objects.

The course calls this a **strong association** or strong compile-time dependency: `B.h` needs `A.h` to compile.

**Inline bodies can also strengthen dependencies.**

Even if `B` stores only an `A*`, a header-defined body that calls an `A` member needs the relevant complete declaration:

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

The compiler must know that `A` has `g()`; `class A;` alone does not say so.

Move the definition to a `.cpp` file:

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

Now the header needs only `A`'s declaration; `B.cpp` needs its definition. This is the usual **forward declaration plus out-of-line definition** technique for reducing header coupling.

**Why pointers and references reduce dependencies.**

```cpp
class A;

class B {
private:
    A* pa_ = nullptr;
};
```

The compiler can lay out an `A*` without knowing `sizeof(A)`. A reference member can also name an incomplete class:

```cpp
class A;

class B {
public:
    explicit B(A& a) : ref_a_(a) {}

private:
    A& ref_a_;
};
```

Their lifetime semantics differ: a reference must bind at initialization and cannot be reseated; a pointer can be null or change targets. Do not interchange them solely to remove an include.

Similar considerations apply to function parameters and returns:

```cpp
void f(const A& a);
void g(A* pa);
A* h();
```

Declarations can often use incomplete class types, even by value. Definitions and uses that construct or destroy such values require completeness. If an interface only observes or modifies an existing object, a pointer or reference may better express its intent.

The course informally orders physical coupling from stronger to weaker as:

1. **Inheritance:** a strong vertical dependency requiring a complete base definition.
2. **Hard association:** a two-way relationship with an embedded-object or similar strong dependency on at least one side.
3. **Strong association:** a header needs another class's complete definition.
4. **Weak association:** the complete definition is mainly needed in the implementation file.
5. **Soft association:** headers use forward declarations with pointers or references where possible.

These are course terminology for reasoning about coupling, not a mandate to use raw pointers everywhere. Reduce unnecessary includes without sacrificing ownership correctness or clear semantics.

### Logical Relationships

Physical dependency asks which files need which declarations. Logical relationships ask how the types relate in the model.

A first distinction is between two directions:

| Direction | Typical concepts | Focus |
| -------- | ---------------- | ---------------- |
| Vertical | Generalization, realization, inheritance | Later inheritance sections |
| Horizontal | Association, aggregation, dependency | This section |

Vertical relationships often express **is-a**: a specific type belongs to a more general category. Horizontal relationships describe how otherwise separate objects collaborate or form structures.

Four common code patterns:

| Code form | Example | Course interpretation |
| ---------------- | -------------------------------- | ---------------- |
| Data member | `A* pa_;`, `A a_;`, `A& ra_;` | Association |
| Parameter | `void f(A* pa);` | Dependency |
| Return type | `A* create();` | Dependency |
| Use inside a function | `A a;`, `new A`, calls to `A` | Dependency |

An **association** retains a structural relationship. A **dependency**, in this classification, uses another type temporarily during an operation.

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

Association is typically stronger because each `B` retains a place for a relationship with `A`, while the illustrated dependency exists only during an operation.

UML commonly uses a solid line for association and a dashed arrow for dependency. More useful than memorizing symbols is reasoning from code and lifetime responsibilities.

### Association

An **association** is a persistent “knows about” relationship, often represented by an object, pointer, or reference member:

```cpp
class A;

class B {
private:
    A* pa_ = nullptr;
};
```

Even if `pa_` is currently null, the class structurally allows a relationship with an `A`. That differs from an `A*` appearing only as a temporary argument.

Associations have several dimensions:

| Dimension | Possibilities |
| -------- | ------------------------------ |
| Navigation | One-way or two-way |
| Multiplicity | One-to-one, one-to-many, many-to-one, many-to-many |
| Meaning | General association, aggregation, composition |

A **general association** represents an ongoing connection without necessarily implying whole–part semantics.

```cpp
class University;
class Course;

class Student {
private:
    University* university_ = nullptr;
    Course* courses_[30]{};
};
```

A student may retain links to a university and courses without owning or destroying those objects. That is a general association.

**Multiplicity** depends on the model:

- One student assigned one dormitory gives a single-valued link from the student side.
- One student taking several courses gives a one-to-many view from that side.
- Several students sharing a dormitory gives a many-to-one relationship.
- Several students taking several courses gives many-to-many.

A **self-association** connects objects of the same class:

```cpp
class Student {
private:
    Student* roommates_[3]{};
    Student* supervisor_ = nullptr;
};
```

It need not connect an object to itself. One `Student` can reference other students, such as roommates, a representative, or a senior. Both ends have type `Student`.

An **association class** represents a relationship that has its own data or behavior.

Students and teachers can have many-to-many connections through courses. Lists of pointers alone do not naturally store class time, credits, room, grades, or assessment rules.

A `Course` or `Enrollment` can represent that information:

```text
Student ── Enrollment/Course ── Teacher
```

It connects the participants and stores attributes of the relationship. Likewise, registration date, location, and certificate number belong to a marriage relationship rather than exclusively to either spouse.

Adding whole–part semantics and lifetime responsibility leads to aggregation and composition.

### Whole–Part Relationships: Aggregation and Composition

A whole–part association expresses more than simply knowing another object.

The course distinguishes:

| Type | English term | Main criterion |
| ---- | ----------- | ---------------------------------------- |
| Shared whole–part relationship | Aggregation | The whole uses parts without owning their lifetimes |
| Owning whole–part relationship | Composition | The whole owns parts and controls their lifetimes |

**Aggregation:** the parts exist independently of the whole, which does not create and destroy them as owned subobjects.

```cpp
class NetworkCard;

class Computer {
public:
    explicit Computer(NetworkCard* card) : card_(card) {}

private:
    NetworkCard* card_; // 非拥有关系：Computer 不 delete card_
};
```

`Computer` receives an external network card without owning its destruction. Under this model, that is aggregation.

**Composition:** the whole owns the part. An embedded object is often the simplest representation:

```cpp
class Engine {
    // 略
};

class Car {
private:
    Engine engine_;
};
```

Constructing and destroying `Car` automatically constructs and destroys `engine_`. That directly couples the part's lifetime to the whole.

Dynamic composition can also express ownership clearly:

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

`unique_ptr` expresses exclusive ownership of the `Engine`. It handles cleanup automatically and makes accidental copying of exclusive ownership harder.

The course also illustrates composition with raw pointers:

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

`B` creates and deletes `A`, so it owns `A`'s lifetime. The raw-pointer version additionally needs correct copying, assignment, and exception handling; a value member or `unique_ptr` is preferable in modern code.

> Judge aggregation versus composition by ownership in the program model, not merely by what belongs to what in the physical world.

A wheel or network card may be an independent inventory item in one system and an owned component in another. Manufacturing, repairs, and rental software can model the same real-world objects differently.

UML uses a **hollow diamond** for shared aggregation and a **filled diamond** for composition, at the whole end. A raw `A*` alone does not express ownership; inspect constructors, destructors, contracts, and the model.

### Dependency

In this classification, a **dependency** uses another type during an operation without retaining it as a structural member.

Common forms:

```cpp
class B {
public:
    void process(const A& a); // A 出现在函数参数中
    A* create();              // A 出现在函数返回值中
};
```

Use may also occur only inside a body:

```cpp
int B::calculate(int n) {
    A a;
    return a.g() + n;
}
```

Or:

```cpp
int B::calculate(int n) {
    A* pa = new A;
    int result = pa->g() + n;
    delete pa;
    return result;
}
```

In these examples, `B` stores no ongoing `A` relationship. It uses `A` only for an operation.

> If a relationship is needed only for one operation, avoid automatically promoting it to a data member. A narrower dependency usually reduces coupling.

**A mouse eating an apple:** the mouse needs the particular apple's energy value during eating, but neither object needs permanent pointers to every possible counterpart.

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

`Mouse::eat` takes `const Apple&`, expressing a dependency for this operation. No `Apple*` member retains an ongoing association.

When behavior involves several objects, decide which is the active participant. The mouse initiates eating, so `Mouse::eat` is natural.

The apple can also provide a cooperating “be eaten” interface, but avoid duplicating the core rule:

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

Keep the energy calculation in one place instead of maintaining potentially inconsistent formulas in both `Mouse::eat` and `Apple::eatenBy`.

### Example: Student to Dormitory

Students and dormitories illustrate why modeling requires a purpose. Before drawing both directions from real-world relationships, ask what this system primarily manages.

| System | Main concern | Natural navigation |
| -------------- | -------------------- | ----------------- |
| Address book | Student address details | Student → dormitory |
| Student records | Student profiles and accommodation | Student → dormitory is important |
| Dormitory management | Rooms, beds, and residents | Dormitory → student is important |

**General association:** store a non-owning pointer to an external dormitory object.

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

The student retains knowledge of its dormitory but neither creates nor destroys it.

**Aggregation:** if dormitory information is treated as part of a student record while its lifetime remains independent, the representation might still be `Dorm* dorm_`. The declaration alone cannot distinguish aggregation from a general association; the model's meaning matters.

**Composition:** if each student owns a separate accommodation-information record, embed it:

```cpp
class DormInfo {
    // 楼号、楼层、房间号等学生档案内部信息
};

class Student {
private:
    DormInfo dorm_info_;
};
```

`dorm_info_` is created and destroyed with `Student`, so this is composition. `DormInfo` is the student's address record, not necessarily the independent physical dormitory shared by many residents.

The same word can represent different concepts in different domains. Follow the actual program model and lifetime responsibility.

### Example: Dormitory to Student

The reverse direction can have a different meaning:

| Dormitory's relationship to students | Possible classification |
| -------------------------------------------- | -------- |
| Records current residents | General association |
| Treats residents as parts but an external system owns their lifetimes | Aggregation |
| Creates and destroys the student objects | Composition |

**Composition:** if the model deliberately assigns ownership of student objects to the dormitory:

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

`Dorm` creates and deletes each `Student`, so it controls their lifetimes.

This demonstrates software ownership, not a claim that real dormitories create people. If a central student-record system owns the students independently, this ownership model would be inappropriate.

**Aggregation:** externally owned students must not be deleted by a dormitory that only records their pointers.

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

The allocation creates an **array of Student pointers**, not `count` student objects. Destruction:

```cpp
delete[] students_;
```

Releases only the pointer array. The external owner manages the students. Setting an entry to null in `removeStudent` removes a link; it does not destroy a student.

The useful distinction is:

> Ask which objects retain relationships, which merely use others during an operation, and which own and control the others' lifetimes.

## Inheritance

### Black-Box and White-Box Reuse

**Software reuse** lets tested, stable components serve new programs. Its benefit is not just shorter code: it avoids duplicated implementations that drift apart and need separate fixes.

The most basic approach is often:

```text
复制已有代码 → 粘贴到新位置 → 按新需求修改
```

Copy-and-modify creates an independent version. Fixing the original no longer fixes its copies, and each variation needs its own testing and maintenance.

The course distinguishes two forms of class-level reuse without editing the existing class:

| Form | Analogy | What the user relies on | Common C++ mechanisms |
| -------- | -------------- | -------------------------- | ---------------------- |
| Black-box reuse | Opaque box | Public interface | Dependency, association, aggregation, composition |
| White-box reuse | Transparent box | Inherited structure and accessible implementation | Inheritance |

**Black-box reuse:** use the existing class through its interface.

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

`B` calls `A::func1()` without knowing its algorithm or accessing private `data_` and `func3()`. If the interface and contract remain stable, `A` can change internally without requiring source changes to `B`.

The benefit is **reusing behavior without depending on implementation details**.

It can also use a retained member relationship:

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

`C` holds an `A*` and uses public operations. Depending on ownership, this may represent association, aggregation, or composition; the black-box aspect is reliance on the public interface.

**White-box reuse:** inheritance makes a base subobject part of a derived object.

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

`B` can use accessible members such as `func1()` and `func2()` through its inherited `A` part, without storing a separate member object.

This couples the types more strongly. The complete base definition is needed, and protected interfaces, construction rules, and base changes can affect derived code.

> Black-box reuse depends on an interface; inheritance also reuses implementation. Choose according to the actual relationship: using a capability differs from being a kind of the base type.

### Inheritance and Derivation

Basic syntax:

```cpp
class 派生类名 : 继承方式 基类名1, 继承方式 基类名2 {
    // 派生类自己的成员
};
```

For example:

```cpp
class Child : public Parent1, private Parent2 {
public:
    Child(int value);
    void childFunc();

private:
    int data_ = 0;
};
```

`Child` is the **derived class**; `Parent1` and `Parent2` are **base classes**. The part after the colon is the base-specifier list.

Three inheritance access forms:

| Form | Keyword | General effect |
| -------- | ----------- | ---------------------------------------------------- |
| Public inheritance | `public` | Preserves the base's public interface; normally models is-a |
| Protected inheritance | `protected` | Hides the public base interface from outsiders but leaves it available to further derived contexts |
| Private inheritance | `private` | Treats the base interface as an implementation detail |

For `class`, omitted inheritance access defaults to **private**:

```cpp
class Child : Parent {
};

// 等价于
class Child : private Parent {
};
```

For `struct Child : Parent { };`, it defaults to public. Remember this default when reading a class declaration.

**Single and multiple inheritance.**

One direct base:

```cpp
class Child : public Parent {
};
```

Is single inheritance. Several direct bases:

```cpp
class Child : public Parent1, public Parent2 {
};
```

Are multiple inheritance. It is valid C++, but introduces more opportunities for ambiguity, ordering issues, and diamond-shaped hierarchies.

A derived class may itself become a base:

```text
Base
├── Derived1
│   └── MoreDerived1
└── Derived2
    └── MoreDerived2
```

The language does not set a small conceptual hierarchy limit, though implementations have practical limits. Keep designs shallow enough that member origins, access, construction, and overriding remain understandable; do not pursue depth for its own sake.

“Base” and “derived” are precise C++ terms for every inheritance form. “Parent” and “child” are also used informally, often when discussing an is-a hierarchy.

### Members and Access in a Derived Class

A derived class involves:

| Source | Contents |
| ------------------------ | ---------------------------------------- |
| Its own special members | Constructors, destructor, copy operations, and so on |
| Newly declared members | Functions, non-static data, and static members |
| Base portion | Base subobjects and inherited member lookup |

A derived class has its own special member functions, which initialize, copy, assign, and destroy its base portions as required. Do not treat the base's special members as interchangeable with these operations. C++ also supports explicitly inheriting constructors with a using-declaration; base assignment names can be brought into scope, but derived assignment rules still apply.

For example:

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

A complete `B` contains an `A` **base subobject** and its own `value_`:

```text
B 对象
├── A 的基类子对象
│   └── A::data_
└── B 自己新增的数据
    └── B::value_
```

Its size reflects base storage, added non-static members, padding, and implementation details. Member-function code and static data are not separately embedded in each object.

**Access to inherited members** depends on original access and inheritance form:

| Original access | Public inheritance | Protected inheritance | Private inheritance |
| -------------- | ------------------ | ------------------ | ------------------ |
| `public`       | `public`           | `protected`        | `private`          |
| `protected`    | `protected`        | `protected`        | `private`          |
| `private` | Not directly accessible to derived code | Not directly accessible to derived code | Not directly accessible to derived code |

Private base members do not disappear from the object merely because derived code cannot directly access them:

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

`number_` still belongs to the `Base` subobject within `Derived`. `Derived` code cannot directly name it for access, but `Base::setNumber()` can.

**The role of protected:**

| Access | Ordinary outside code | Derived-class member context | Declaring-class member context |
| ----------- | ------------ | -------------- | ------------ |
| `public` | Yes | Yes | Yes |
| `protected` | No | Yes, subject to protected-access rules | Yes |
| `private` | No | Not directly | Yes |

Protected interfaces support derivation without exposing operations publicly. They are not intrinsically safer than private ones: they expand the set of code depending on the base's implementation, so overuse increases coupling.

### Constructing and Destroying Derived Objects

The base subobject must be initialized before the derived class's own members and constructor body.

For the simple non-virtual single-inheritance case:

1. Construct the base subobject.
2. Initialize the derived class's non-static members in declaration order.
3. Execute the derived constructor body.

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

`Base(base_number)` initializes the base portion, and `value_(value)` initializes the member. Both have completed before the body executes.

> The derived constructor invokes a base constructor to initialize the base subobject; this is different from simply calling an inherited ordinary method.

If the base lacks a usable default constructor, explicitly select its constructor in the initializer list:

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

This version fails:

```cpp
class Derived : public Base {
public:
    Derived(int value) {
        // 编译器会尝试 Base()，但 Base 没有无参构造函数
    }
};
```

**Direct non-virtual bases construct in base-list order**, not initializer-list order:

```cpp
class D : public B1, public B2 {
public:
    D() : B2(), B1() {
    }
};
```

`B1` still constructs before `B2`. The derived members likewise follow declaration order. Compilers often warn about mismatched initializer-list ordering.

**Destruction reverses construction:**

1. Run the derived destructor body.
2. Destroy the derived members in reverse declaration order.
3. Destroy the base subobject.

```text
构造：基类 → 派生类成员 → 派生类构造函数体
析构：派生类析构函数体 → 派生类成员 → 基类
```

The base portion remains available while the derived destructor body performs its cleanup.

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

With `Derived d(1, 99);`, this example prints `2` during base construction, `99` in derived destruction, and finally `1` in base destruction:

```text
2 99 1
```

If deletion will occur through a base pointer, the base normally needs a virtual destructor. The polymorphism chapter returns to this.

### Copying and Assigning Derived Objects

A derived object includes both base and newly added state. Copy operations must handle both.

Usable compiler-generated operations normally:

- Copy-construct the base subobject, then copy the derived members.
- Copy-assign the base subobject, then assign the derived members.

Defaults usually suffice for value-like members. Direct resource ownership or special invariants require deliberate copy semantics.

**A custom derived copy constructor:**

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

The initializer:

```cpp
A(other)
```

Uses `A`'s copy constructor for the base portion of the new `B`. `other` is a `B`, but its `A` subobject can bind to the `const A&` parameter.

Do not try to copy private base data directly:

```cpp
// data_ = other.data_; // 若 data_ 是 A 的 private 成员，非法
```

Let the base manage its own copying rules. This avoids coupling derived code to private representation details.

**A custom derived assignment operator:**

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

Steps:

1. Handle self-assignment as required by the implementation.
2. Use `A::operator=(other)` for the base portion.
3. Assign the derived members.
4. Return `*this` for chaining.

The base assignment uses the `A` portion of `other`.

Comparison:

| Aspect | Copy construction | Assignment |
| -------- | ----------------------- | ------------------------------ |
| Target | Being created | Already exists |
| Base portion | `A(other)` in initializer list | `A::operator=(other)` in body |
| Added members | Initialize | Assign |
| Return | None | Usually `*this` |

### newdefine, redefine, overload, and overwrite

The course uses several labels for derived declarations. Some are informal course terminology. In standard C++ terminology, especially distinguish **name hiding** from **overriding a virtual function**.

| Term | Meaning here | Criterion |
| ---------------- | -------------- | ---------------------------------------- |
| newdefine | New member | No base member has that name |
| redefine | Same-signature non-virtual member | A non-virtual base function has the same name and parameter list |
| overload | Overloading | Same name, different parameter lists in an overload set |
| overwrite / hide | Name hiding | A derived declaration hides same-named base declarations from ordinary lookup |
| override | Virtual overriding | A derived function matches a virtual base function's overriding requirements |

**newdefine: add a new function.**

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

**redefine: a same-signature non-virtual function.**

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

`B::g()` does not override `A::g()` dynamically when the base function is non-virtual. A direct `B` call finds the derived member; explicit `A::g()` qualification selects the base version.

**overload: several same-named functions in an overload set.**

```cpp
void f();
void f(int);
void f(double);
```

Different parameter lists distinguish these overloads. Inheritance does not automatically merge same-named base and derived declarations into one visible set.

**overwrite/hide: name hiding.**

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

A derived declaration named `f` hides same-named base declarations from ordinary derived-scope lookup, **regardless of whether their parameter lists match**.

Bring base overloads into scope with `using`:

```cpp
class B : public A {
public:
    using A::f;
    void f(double);
};
```

`A::f()`, `A::f(int)`, and `B::f(double)` can now participate in overload resolution together.

**override: override a virtual function.**

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

The base function must be virtual and the derived declaration must satisfy matching parameter, const, reference-qualification, and return rules. Writing `override` lets the compiler diagnose an accidental mismatch.

Hiding concerns name lookup; overriding concerns virtual dispatch. Both can occur in the same class but are distinct mechanisms.

### What Inheritance Means

Do not choose inheritance merely to save lines of code. Establish the intended relationship first.

**Public inheritance normally expresses is-a.**

```text
派生类是一种基类
派生类可以被当作基类使用
```

For example, manual and automatic cars are both kinds of car:

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

The important benefit of public inheritance is **substitutability**: a `ManualCar` or `AutoCar` can be used through an accessible, unambiguous `Car` base.

```cpp
void drive(Car& car) {
    car.run();
}

ManualCar manual_car;
AutoCar auto_car;

drive(manual_car);
drive(auto_car);
```

This conversion underpins polymorphism and dynamic dispatch. If “the derived type is a kind of the base type” does not fit, code reuse alone is a poor reason for public inheritance.

**Private inheritance reuses implementation rather than offering public substitutability.**

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

A `Player` is not a `Bike`. Here private inheritance means implemented-in-terms-of: the player implementation borrows bicycle functionality without offering a public bicycle interface.

**Protected inheritance** also removes the public base interface from ordinary outside use, but preserves accessible base members as protected for further derivation.

It generally does not express public is-a semantics. Use it deliberately when implementation access needs to continue through a hierarchy.

Derivation requires the complete base class definition, usually its header, not necessarily its `.cpp` source. A library designed only around a stable public interface may be better reused through composition or dependency.

### Choosing Inheritance or Composition

The central distinction is usually **is-a** versus **has-a / uses-a**.

| Relationship | Meaning | Common representation |
| -------- | ---------------------------- | ------------------------- |
| Public inheritance | The derived type is a kind of the base | `class D : public B` |
| Composition | An object owns another object | Value member, `unique_ptr`, etc. |
| Dependency | An operation temporarily uses another object | Parameter, local, return type |
| General association | An object retains knowledge of another | Non-owning pointer, reference, identifier |

Composition often replaces private inheritance. Instead of `Player : private Bike`:

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

This directly expresses that a player has a bike and uses it during a race. Changing the transport implementation, delaying creation, or changing ownership becomes easier to express.

A privately inherited base has a lifetime bound to the derived object, more like composition than non-owning aggregation. When implementation reuse is the only goal, composition is often clearer.

Questions to ask:

1. Is `Derived` naturally a kind of `Base`, preserving its contract? Consider public inheritance.
2. Does a whole own a part and control its lifetime? Prefer composition.
3. Is the other object needed only during an operation? Use a dependency.
4. Must an ongoing link to an independent object be retained? Use association or aggregation.
5. Is the goal merely implementation reuse? Try composition before private or protected inheritance.

A useful design consists of shallow, meaningful inheritance hierarchies connected by composition and other horizontal relationships. Avoid forcing every difference into one deep tree.

> “Prefer composition” does not prohibit inheritance. Public inheritance is valuable when is-a semantics and substitutability actually hold.

## Inheritance and Type Conversion

### Conversions in a Hierarchy

A hierarchy introduces conversions between derived and base views, as well as possible attempts to recover a derived view from a base.

Suppose:

```cpp
class Base {
};

class Derived : public Base {
};
```

Two directions:

| Direction | Meaning | Term |
| ------------ | ------------- | -------- |
| Up the hierarchy | Derived → base | Upcast |
| Down the hierarchy | Base → derived | Downcast |

Value conversion, pointer conversion, and reference binding differ. Legality and safety depend on **access, ambiguity, and the actual object's type**.

**Inheritance access affects the public meaning of a conversion.**

| Inheritance | External interface | Typical meaning |
| ---------------- | ------------------------------ | ----------------------------- |
| Public | Keeps the public base interface | Supports public substitutability |
| Protected | Base interface becomes protected | Does not expose is-a to ordinary outsiders |
| Private | Base interface becomes private | Implementation reuse |

Public inheritance normally makes a derived-to-base view meaningful. Private and protected inheritance do not promise that substitution to ordinary outside code.

**Private and protected base conversions.**

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

`Player` can use `Bike` internally, but ordinary outside code cannot implicitly convert `Player*` to its inaccessible `Bike*` base:

```cpp
Player player;

// Bike* bike = &player; // 错误：private 继承使这条基类转换对外不可访问
```

Do not use a C-style cast merely to bypass this access design. Obtaining an address does not make the relationship part of the public contract.

If bicycle functionality should be exposed, design an explicit interface:

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

Or use composition when that matches the domain:

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

Protected inheritance similarly permits appropriate internal derived-class access without making the base publicly substitutable.

**Why downcasts need care.**

Suppose:

```text
Animal
├── Dog
└── Cat
```

An `Animal*` could refer to a `Dog`, a `Cat`, or an `Animal` itself. Its static type does not establish that it points to a dog.

```cpp
Animal* animal = /* 某个 Animal、Dog 或 Cat 对象 */;

// Dog* dog = ...; // 只有确认真实对象确实是 Dog 才合理
```

Do not guess a derived type from the base pointer alone. Use `dynamic_cast` when runtime checking is needed, or express varying behavior through virtual functions instead of repeatedly branching on concrete types.

### Upcasting with Public Inheritance

Public inheritance models a more specific kind of the base type.

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

For an accessible, unambiguous base, `ManualCar` can be viewed as `Car`. Three common forms follow.

**1. Derived pointer to base pointer.**

```cpp
ManualCar manual;

Car* car1 = &manual;
Car* car2 = new ManualCar;
```

`car1` and `car2` have static type `Car*`, but refer to the `Car` base subobject within an actual `ManualCar`.

No object is copied or sliced. The accessible interface through the pointer is determined by `Car`, while virtual calls can still dispatch dynamically.

If deletion will occur through that base pointer, give the base the appropriate virtual destructor:

```cpp
class Car {
public:
    virtual ~Car() = default;
    virtual void run();
};

Car* car = new ManualCar;
delete car; // 能正确调用 ManualCar 析构，再析构 Car 部分
```

**2. Derived object bound to a base reference.**

```cpp
ManualCar manual;

Car& car_ref = manual;
const Car& const_car_ref = manual;
```

The reference aliases the base portion without creating another object or removing the derived state.

This supports an interface against the general type:

```cpp
void drive(Car& car) {
    car.run();
}

ManualCar manual;
drive(manual);
```

Adding public derived types such as `AutoCar` or `ElectricCar` need not change `drive(Car&)`.

**3. Derived value copied into a base object.**

```cpp
ManualCar manual;
Car car = manual;
```

This creates a **new Car object**, copying only the base portion. Added `ManualCar` state is not part of that new object: **object slicing**.

```text
ManualCar 对象 = Car 基类部分 + ManualCar 新增部分

Car car = manual;
          ↓
只复制 Car 基类部分，新增部分被切掉
```

Comparison:

| Form | Copies an object? | Derived object retained? | Slicing? |
| ------------------- | ------------ | -------------------------------- | ---------------- |
| `Car* p = &manual;` | No | Yes | No |
| `Car& r = manual;` | No | Yes | No |
| `Car c = manual;` | Yes | The original remains; the new object is only a `Car` | Yes |

Use base **references or pointers** when polymorphic behavior should be preserved. Be deliberate about by-value base parameters:

```cpp
void badDrive(Car car);  // 传入派生对象时会切片
void drive(Car& car);    // 保留对象身份
void view(const Car& car); // 只读且不切片
```

**Common uses of upcasting.**

A class can retain a base pointer or smart pointer that refers to different derived types:

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

A function can accept a base reference or pointer:

```cpp
void service(Car& car) {
    car.brake();
}
```

Objects with an accessible, unambiguous public `Car` base can use that interface. A stable base contract lets the function work against an abstraction.

**Downcasting in a public hierarchy.**

It may be meaningful, but success is not guaranteed:

```cpp
class AutoCar : public Car {
};

Car* car = new AutoCar;

// ManualCar* manual = ...; // 不能假设 car 指向 ManualCar
```

For a polymorphic base, runtime checking is available:

```cpp
ManualCar* manual = dynamic_cast<ManualCar*>(car);

if (manual != nullptr) {
    manual->shiftGear();
}
```

If `car` actually points to an `AutoCar` in this hierarchy, the pointer cast fails with `nullptr` rather than pretending it is a `ManualCar`.

### Explicit Cast Operators

Common conversion mechanisms include:

| Mechanism | Example |
| ------------------ | --------------------------------------------------------------- |
| Standard conversion | `int` to `float` |
| Converting constructor | `int` to `Fraction` |
| Conversion function | `Fraction::operator float()` |
| Public-base conversion | `Derived*` to `Base*` |
| Explicit cast | `static_cast`, `const_cast`, `reinterpret_cast`, `dynamic_cast` |

A C-style cast is compact:

```cpp
int n = (int)3.14;
```

But it combines several kinds of conversion under one syntax. Named C++ casts make the intended category more visible.

#### static_cast

Syntax:

```cpp
static_cast<T>(expression)
```

`static_cast` applies conversions with defined compile-time rules, such as numeric conversions:

```cpp
double d = 3.14;
int n = static_cast<int>(d); // 截断小数部分，n 为 3
```

It also covers suitable enum and class conversions and derived-to-base conversion:

```cpp
ManualCar manual;
Car& car = static_cast<Car&>(manual);
```

Some downcasts are permitted, but **no runtime type check is performed**:

```cpp
Car* car = /* ... */;

// 只有程序已经能保证 car 实际指向 ManualCar 时才可考虑
ManualCar* manual = static_cast<ManualCar*>(car);
```

The required actual-object relationship must hold; an invalid downcast can have undefined behavior. Do not use it as a guess. Use checked conversion when needed or virtual dispatch for type-dependent behavior.

It does not generally convert directly between unrelated object pointer types. Going through `void*` or using `reinterpret_cast` does not remove alignment, lifetime, or type-access requirements.

#### const_cast

Syntax:

```cpp
const_cast<T>(expression)
```

`const_cast` changes cv-qualification in the permitted pointer/reference forms. It is not a general conversion between unrelated types.

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

Here `ca` is a const view of an originally mutable `a`; recovering mutable access to that original object is valid.

But if the object itself is const:

```cpp
const A a;
A& writable = const_cast<A&>(a);

// writable.setValue(6); // 未定义行为：试图修改真正的 const 对象
```

Casting away the qualification does not make modification legal. Such a write has undefined behavior. Remove constness only for a carefully justified interface requirement.

`volatile` has separate rules for observable accesses, useful in implementation-defined hardware interfaces. It is not thread synchronization and does not replace atomics or locks.

#### reinterpret_cast

Syntax:

```cpp
reinterpret_cast<T>(expression)
```

`reinterpret_cast` permits certain low-level pointer and representation-related conversions, often at system or ABI boundaries:

```cpp
#include <cstdint>

std::uintptr_t address = /* 某个地址数值 */;
void* p = reinterpret_cast<void*>(address);
```

It does not normally construct a new object or verify that the target type can access the storage. Incorrect use can violate alignment, lifetime, or type-access rules.

Function-pointer conversions need particular care: calling through an incompatible type can have undefined behavior. Keep such low-level details in small, well-tested interfaces rather than spreading them through application code.

#### dynamic_cast

Syntax:

```cpp
dynamic_cast<T>(expression)
```

For a checked downcast, `dynamic_cast` inspects the runtime type. The source base must be **polymorphic**, with at least one virtual function. Simple upcasts are a separate case and do not require polymorphism:

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

**Pointer form:** failure returns null.

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

**Reference form:** failure throws `std::bad_cast`, since a valid reference cannot represent null.

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

| Form | Success | Failure |
| ----------------------- | ----------- | -------------------- |
| `dynamic_cast<Dog*>(p)` | Pointer to the appropriate `Dog` | `nullptr` |
| `dynamic_cast<Dog&>(r)` | Reference to the appropriate `Dog` | Throws `std::bad_cast` |

This is part of **RTTI**, runtime type information. Repeated branches on concrete derived types can signal that the varying operation belongs in the virtual interface instead.

Comparison:

| Operator | Purpose | Runtime type check? | Main risks |
| ------------------ | ---------------------------- | -------------- | -------------------------------------- |
| `static_cast` | Conversions governed by static rules | No | Numeric loss or an invalid unchecked downcast |
| `const_cast` | Change cv-qualification | No | Modifying an actually const object |
| `reinterpret_cast` | Certain low-level pointer/representation conversions | No | Alignment, lifetime, aliasing, calling incompatibility |
| `dynamic_cast` | Checked polymorphic downcasts/cross-casts | Yes, where needed | Runtime cost; overuse may indicate a design issue |

Remember the roles: static conversion rules, qualification changes, low-level reinterpretation, and runtime-checked polymorphic conversion.

## Multiple Inheritance

### The Basic Model

A class with one direct base uses single inheritance; a class with two or more uses **multiple inheritance**.

```cpp
class Derived : public Base1, protected Base2, private Base3 {
    // Derived 自己的成员
};
```

The syntax is simple, but layout, construction order, and member lookup become more involved.

For example, a working doctoral student may have both teacher and student roles:

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

`InServiceDoctor` can use `teach()` and `study()` and add `doResearch()`. Two immediate concerns follow:

- Same-named members from different bases can be ambiguous.
- Multiple paths to a common base can form a diamond.

**Construction and destruction order.**

```cpp
class D : public B1, public B2 {
public:
    D() : B2(), B1() {
    }
};
```

The actual construction order is:

```text
B1 → B2 → D 自己的数据成员 → D 构造函数体
```

The base list `public B1, public B2` controls the order, not `B2(), B1()` in the initializer list. Destruction reverses it:

```text
D 析构函数体 → D 成员 → B2 → B1
```

A multiple-inheritance object contains several base subobjects:

```text
D 对象
├── B1 基类子对象
├── B2 基类子对象
└── D 自己新增的数据成员
```

These contain non-static state and any required implementation information, not per-object copies of function code. Virtual functions and virtual bases can introduce additional layout machinery.

> The hard questions are where a name comes from, how many common-base subobjects exist, and who controls their construction order.

### Name Conflicts

Unqualified use can be ambiguous when different bases declare the same name:

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

`C` has both an `A` and a `B` subobject, each with members named `f` and `number_`. Lookup cannot choose a unique source.

**1. Qualify the name.**

```cpp
class C : public A, public B {
public:
    void test() {
        int x = A::f();
        B::number_ = 10;
    }
};
```

`A::f()` selects the `A` function, while `B::number_` selects the `B` data member.

This is explicit, but many qualified uses can burden callers with knowledge of the hierarchy.

**2. Use a using-declaration.**

Select a base declaration for unqualified lookup in the derived scope:

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

`using A::f;` brings that function name into `C`; `using B::number_;` selects the data member from `B`. The declaration's access section affects exposure through `C`.

**Limitations of using.**

It changes lookup, not the underlying subobjects:

```text
C 对象
├── A::number_ 仍然存在
├── B::number_ 仍然存在
└── C 自己的数据
```

Selecting `B::number_` does not remove `A::number_`. Both still occupy their respective storage and may hold different state.

Prefer independent base responsibilities and clear names. Avoid making every caller memorize implementation details to resolve routine operations.

### The Diamond Problem

A **diamond** occurs when two inheritance paths bring a common base into one final derived class:

```text
      A
     / \
    B   C
     \ /
      D
```

In code:

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

Even without unrelated name collisions, `D` receives one `A` through `B` and another through `C`:

```text
D 对象
├── B 子对象
│   └── A 子对象（第一份）
├── C 子对象
│   └── A 子对象（第二份）
└── D 自己的数据
```

Consequently:

```cpp
D d;

// d.fA(); // 错误：应从 B 路径还是 C 路径找到 A::fA？
```

A path can be qualified:

```cpp
d.B::fA();
d.C::fA();
```

But that still operates on two separate `A` subobjects and two copies of `a_`. If the model needs one shared base state, the duplication introduces inconsistent state and ambiguous conversion as well as extra storage.

The causes differ:

| Problem | Cause |
| -------------------- | ---------------------------------- |
| Ordinary name collision | Different bases declare the same name |
| Diamond | The same base type occurs through multiple paths |

Renaming unrelated members cannot remove a diamond. Either use virtual inheritance to share a base or redesign the relationship.

### Virtual Bases

The intermediate classes mark inheritance from the common base `virtual`:

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

When both `B` and `C` virtually inherit `A`, a most-derived `D` contains one shared virtual `A` subobject:

```text
D 对象
├── B 子对象
├── C 子对象
├── D 自己的数据
└── 共享的 A 虚基类子对象（只有一份）
```

Then:

```cpp
D d;
d.fA(); // 不再因两份 A 子对象而二义
```

**The most-derived class initializes virtual bases.**

If `A` has no usable default constructor, the most-derived constructor must explicitly select one:

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

When constructing a standalone `B`, its `A(1)` initializes the virtual base; standalone `C` uses `A(2)`.

When constructing `D`, the single shared `A` is initialized by `D`'s `A(3)`. The intermediate `A(1)` and `A(2)` initializers are ignored for that construction.

The broad construction sequence is:

1. Virtual bases, initialized by the most-derived class in the prescribed depth-first, left-to-right traversal order.
2. Direct non-virtual bases in base-list order.
3. Non-static members in declaration order.
4. The most-derived constructor body.

**Costs of virtual inheritance.**

It adds implementation complexity:

- Layout needs a way to locate the shared virtual base.
- Access and conversions may need object-dependent offset adjustments.
- Intermediate classes must choose virtual inheritance for future derived objects to share that base.

Do not assume the representation is literally an `A*` field in every intermediate class. ABIs differ; the general point is the additional location machinery.

Use virtual bases when the model truly requires one shared common-base state. They should not merely conceal an unclear hierarchy.

### Other Design Options

Virtual inheritance is a language solution, not the only design solution.

**1. Restrict implementation inheritance to one base.**

Some languages enforce a single implementation base to simplify the object model, often while separately permitting multiple interface types. C++ projects can adopt a similar design discipline.

**2. One stateful base plus multiple stateless interfaces.**

A common compromise keeps instance state in at most one primary base; other bases specify behavior without owning per-instance domain data.

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

`Person` provides the main state, while `IPrintable` and `ISerializable` describe capabilities. `SpecialPerson` can serve all three roles without duplicating several stateful base implementations.

A base that mainly provides public behavior contracts through pure virtual functions is often called an **interface class**:

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

This is **interface inheritance**. The interface is abstract; a concrete derived class implements the required pure virtual operations.

**Other uses for classes without instance data.**

Examples include:

- **Tag types:** distinct exception or dispatch types instead of opaque numeric codes.
- **Utility classes:** related static functions grouped in a class scope.
- **Interface classes:** behavior contracts.

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

A utility example:

```cpp
class PackUtility {
public:
    static void packBinary();
    static void packText();
    static void packPicture();
    static int version();
};
```

For stateless utilities, free functions in a namespace may be a lighter alternative. Follow the project's organization needs.

Design choices:

| Need | Likely fit |
| -------------------------- | ------------------------------ |
| One main base identity | Single inheritance |
| Several stateful bases with a common ancestor | Redesign, composition, or carefully chosen virtual inheritance |
| Several independent capabilities | One stateful base plus interface bases |
| Reuse of functionality only | Prefer composition or dependency |

Multiple inheritance can express independent interfaces well. Several complex stateful bases amplify lookup, ownership, and diamond problems, so reconsider the object relationships before committing to that structure.
