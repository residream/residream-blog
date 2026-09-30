---
title: "OOP Review Notes (5): Polymorphism and Advanced Topics"
description: "Reviewing virtual dispatch, polymorphism, object-oriented design, templates, and exception handling in C++."
publishDate: "2026-06-03T23:11:01"
tags:
  - "c-cpp"
heroImage:
  src: ../../blog/oop-notes-05-polymorphism-advanced/water-mirror.jpg
  color: "#496C98"
  alt: "OOP Review Notes (5): Polymorphism and Advanced Topics"
language: 'en'
draft: false
---

## Virtual Dispatch

### Static and Dynamic Binding

**Binding** determines which function implementation a call executes. Two common cases are:

| Form | When selected | Basis | Other name |
| -------- | -------- | ---------------- | ---------------- |
| Static binding | Compile time | Static types | Early binding |
| Dynamic binding | Runtime semantics | Actual object type | Late binding |

Consider an area calculation:

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

We might expect the following to print rectangle area `2` and circle area `3.14`:

```cpp
Rectangle rectangle(1, 2);
Circle circle(1);

Shape& shape1 = rectangle;
Shape& shape2 = circle;

shape1.show();
shape2.show();
```

But `area()` is non-virtual, so both calls print `0`. Inside `Shape::show()`, its call to `area()` means:

```cpp
this->area();
```

`this` has static type `const Shape*`, so the non-virtual call selects `Shape::area()` rather than a same-named derived function.

**Static type and actual object type.**

```cpp
Rectangle rectangle(1, 2);

Shape* pointer = &rectangle;
Shape& reference = rectangle;
Shape object = rectangle;
```

| Expression or declaration | Static type/view | Actual object |
| ----------- | ----------- | ------------------------ |
| `rectangle` | `Rectangle` | `Rectangle` |
| `pointer` | `Shape*` | Points into a `Rectangle` |
| `reference` | Reference declared as `Shape&` | Refers into a `Rectangle` |
| `object` | `Shape` | `Shape` |

The last line **slices** the object: the new `Shape` contains only copied base state. Pointers and references do not copy the object, so they preserve access to the original complete object's dynamic identity.

**Virtual functions** let a shared base interface dispatch to implementations appropriate to the actual object.

### Virtual Functions

Declare `Shape::area()` virtual:

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

`shape.show()` still enters the non-virtual `Shape::show()`, but its virtual call to `area()` dispatches to `Rectangle::area()` for a rectangle.

**The enclosing function need not be virtual. The inner call can still dispatch dynamically when it calls a virtual function.**

#### Declaration Rules

A virtual function must be a **non-static member function**:

```cpp
virtual 返回类型 函数名(参数列表) const;
```

It can have const qualification and access restrictions, subject to the overriding rules. These members cannot be virtual:

| Member | Reason |
| ------------ | ---------------------------------------- |
| Static member function | Has no implicit object for virtual dispatch |
| Constructor | Constructs an object of a selected type; the language prohibits virtual constructors |
| Copy constructor | Also a constructor |

Destructors can be virtual. Assignment operators usually should not be designed as virtual functions.

#### Overriding and override

An overriding derived function remains virtual even if it omits the `virtual` keyword:

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

Prefer writing `override`:

```cpp
class Derived : public Base {
public:
    void print() const override;
};
```

It asks the compiler to verify that an override actually exists. For example, accidentally omitting `const`:

```cpp
class Derived : public Base {
public:
    // void print() override; // 错误：与 Base::print() const 不匹配
};
```

Without `override`, this can become an unrelated same-named function instead of the intended override.

Overriding requires matching names, parameter lists, and relevant qualifiers. The return type must match or satisfy the **covariant return** rules, permitting certain more-derived pointer or reference returns:

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

Here `Report*` can convert to `Document*` under the required inheritance rules.

#### Overriding Is Different from Hiding

A same-named derived declaration hides base overloads from ordinary lookup; a different parameter list does not override them:

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

A direct `set(1)` on `Derived` does not find `Base::set(int)`. Bring the base overloads into scope if needed:

```cpp
class Derived : public Base {
public:
    using Base::set;
    void set();
};
```

`using` changes lookup; it does not turn `Derived::set()` into an override of a differently parameterized function.

#### Why Polymorphic Deletion Needs a Virtual Destructor

For ordinary deletion of a derived object through a base pointer, the base needs a virtual destructor:

```cpp
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

Shape* shape = new Circle(3);
delete shape;
```

`delete shape` then starts with the actual derived destructor before destroying the base portion. Without the required virtual destructor, this deletion has undefined behavior; cleanup of derived resources is not guaranteed.

A type not intended for polymorphic deletion need not add a virtual destructor automatically. Choose its destruction interface deliberately, since polymorphism can affect layout and calls.

### Vtables and the Call Mechanism

A **virtual table**, or **vtable**, and hidden **vptr** fields are common implementation techniques, not a layout mandated by the C++ standard. They explain how dispatch can work without being portable memory-layout guarantees.

Conceptually, a vtable holds function entries:

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

In a simple hierarchy, objects of the same dynamic type share a table and each object stores a pointer to it. More complex inheritance can need additional pointers or tables:

```text
Circle 对象
├── vptr ───→ Circle 的虚函数表
└── radius_
```

**Static checking followed by dynamic dispatch:** for `base_pointer->f()`:

1. Lookup and overload resolution use the pointer's static type and argument expressions. Failure to find a suitable accessible declaration is a compile-time error.
2. A selected non-virtual function is bound statically.
3. A selected virtual function dispatches to the appropriate final overrider for the object, unless qualification suppresses virtual dispatch.

A typical implementation follows the object's vptr to a preselected table slot. The slot is statically determined; the table associated with the object selects the implementation.

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

`printDate` needs only the `Date` interface. Additional display implementations can be introduced without changing that client function.

Dynamic dispatch does not bypass static type checking:

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

Even when `pointer` refers to a `B`, access through `A*` is limited by the `A` interface. Use deliberate checked conversion when a derived-specific operation is necessary.

### Calling Virtual Functions

#### Calls Inside Ordinary Member Functions

An unqualified member call `f()` normally means `this->f()`. For a virtual function on a normally live object, it still dispatches dynamically.

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

The outer call selects `Base::run()`, but the separate inner virtual call selects `Derived::step()`.

Access control does not determine whether a virtual function can be overridden. A derived class may override a private base virtual function; access controls whether calling code can name the interface through its static type.

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

Outside code cannot call private `Base::work()` directly, but `Base::run()` can, and that call can dispatch to `Derived::work()`.

#### Calls During Construction and Destruction

During construction or destruction, virtual calls on the object use the final overrider in the currently constructing or destroying class, **not an override in a more-derived class**.

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

`Base::Base()` calls `Base::show()`, since the derived portion is not yet constructed. Inside `Derived::Derived()`, the call selects `Derived::show()`.

Destruction reverses this: `Derived::~Derived()` can call `Derived::show()`, then `Base::~Base()` calls `Base::show()` after derived teardown.

This prevents dispatch into unavailable derived state. Avoid making essential construction or destruction depend on overridable behavior; a factory or explicit post-construction operation can coordinate it instead.

### Concrete, Abstract, and Interface Classes

A **concrete class** can be instantiated when its construction and destruction operations are accessible and usable:

```cpp
Rectangle rectangle(3, 4);
Circle circle(5);
```

An **abstract class** cannot be instantiated directly. It has at least one virtual function whose final overrider is **pure virtual**:

```cpp
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

// Shape shape; // 错误：抽象类不能实例化
Shape* pointer = nullptr; // 可以声明指针或引用
```

A pure virtual declaration uses `= 0`:

```cpp
virtual 返回类型 函数名(参数列表) const = 0;
```

A derived class becomes concrete only when it has non-pure final overriders for all inherited pure virtual operations:

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

Without an implementation of `area()`, this `Rectangle` remains abstract.

#### Pure Virtual Functions Can Have Definitions

A pure virtual function may have an out-of-class definition that derived code explicitly reuses:

```cpp
class Shape {
public:
    virtual double area() const = 0;
};

double Shape::area() const {
    return 0.0;
}
```

The definition does not remove its pure status or make `Shape` concrete. A derived implementation can call it with explicit qualification:

```cpp
class Line : public Shape {
public:
    double area() const override {
        return Shape::area();
    }
};
```

A **pure virtual destructor** still needs a definition when derived objects are destroyed, because base destruction must run:

```cpp
class Interface {
public:
    virtual ~Interface() = 0;
};

Interface::~Interface() = default;
```

#### Interface Classes

C++ has no `interface` keyword. A common interface is an abstract class with public pure virtual operations and no domain-state data members:

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

This separates the ability to calculate area from the calculation itself. Interfaces can be combined through inheritance and implemented by concrete classes.

### Runtime Type Information (RTTI)

**RTTI** supports runtime type queries and checked polymorphic conversions. It is useful when genuinely needed, but should not replace ordinary virtual behavior.

If types perform the same operation differently, prefer a virtual operation over repeated “if dog, else if cat” branches in clients.

#### `typeid`

`typeid`, used with `<typeinfo>`, yields type information as a const `std::type_info` lvalue, allowing comparisons:

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

Applied to a **pointer value**, it reports the pointer's static type:

```cpp
typeid(animal) == typeid(Animal*); // true
typeid(animal) == typeid(Dog*);    // false
```

For dynamic type information, apply it to the referred-to polymorphic object:

```cpp
typeid(*animal) == typeid(Animal); // false
typeid(*animal) == typeid(Dog);    // true

delete animal;
```

`typeid(pointer)` examines the pointer type; `typeid(*pointer)` can inspect the polymorphic object's dynamic type. Applying the latter to a null polymorphic pointer throws `std::bad_typeid`.

#### `dynamic_cast`

`dynamic_cast` performs checked downcasts and cross-casts in a polymorphic hierarchy:

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

A failed pointer cast yields `nullptr`:

```cpp
Animal* animal = new Cat;
Dog* dog = dynamic_cast<Dog*>(animal);

if (dog == nullptr) {
    std::cout << "不是 Dog\n";
}

delete animal;
```

A failed reference cast throws `std::bad_cast`:

```cpp
try {
    Dog& dog = dynamic_cast<Dog&>(*animal);
    // 使用 dog
} catch (const std::bad_cast&) {
    // 转换失败
}
```

Checked downcasts require a polymorphic source type, commonly supplied by a virtual destructor. Some upcasts also use `dynamic_cast`, but ordinary implicit conversion already handles accessible, unambiguous derived-to-base views without a runtime check.

**When to use RTTI:**

| Need | Suitable approach |
| ---------------------------------- | ---------------------------------------- |
| Different implementations of one operation | Virtual function |
| A genuinely derived-specific operation | Checked `dynamic_cast`, handling failure |
| Type diagnostics or logging | `typeid` where appropriate |
| Repeated branches on every derived type | Reconsider the hierarchy and interface |

### Chapter Recap

| Topic | Key point |
| ------------------- | -------------------------------------------------------- |
| Static binding | Uses static type information |
| Dynamic binding | Selects a virtual final overrider for the object |
| Virtual functions | Non-static members; use `override` in derived declarations |
| Virtual destruction | Required for ordinary polymorphic deletion through a base |
| Vtables | Common implementation model, not a mandated layout |
| Construction/destruction calls | Dispatch stays within the current construction/destruction level |
| Abstract classes | Have a pure virtual final overrider and cannot be directly instantiated |
| RTTI | `typeid` queries type information; `dynamic_cast` checks conversions |

Polymorphism lets clients depend on a stable interface while the object supplies the implementation. Virtual functions and abstract classes provide that interface; RTTI supplements them when necessary.

## Polymorphism and Its Uses

### Meaning of Polymorphism

**Polymorphism** allows the same operation name or interface to select different implementations for different types or arguments.

A member call can be modeled as:

```cpp
object.f(arguments);
```

The requested operation is named `f`, but the selected implementation can depend on:

- The receiver's type.
- Argument types.
- Whether selection is static or involves runtime dispatch.

Abstraction, encapsulation, and inheritance describe objects and relationships. Polymorphism lets clients use an interface without encoding every concrete difference themselves.

### Static and Dynamic Polymorphism

| Category | Main basis | Selection time | Common mechanisms |
| -------- | -------------------------------------------- | ---------- | -------------- |
| Static | Static receiver and argument types | Compile time | Overloads, templates |
| Dynamic | Receiver's dynamic type after static overload resolution | Runtime semantics | Virtual functions |

#### Static Polymorphism: Overloading

A class can provide same-named functions with different parameter lists:

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

Both calls request `print`, but the arguments' static types select different overloads at compile time.

#### Static Polymorphism: Templates

Template arguments also determine concrete code at compile time:

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

`ValuePrinter<int>` and `ValuePrinter<double>` are distinct instantiated types. They reuse one template definition, while static type information determines the specialization used.

#### Dynamic Polymorphism: Virtual Functions

The virtual functions introduced earlier provide dynamic polymorphism:

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

`render` sees `const Shape&`, while `shape.draw()` selects the implementation for the actual circle or rectangle.

#### Virtual Dispatch Uses the Receiver's Dynamic Type

C++ virtual calls dispatch on the **receiver**. Overload resolution still uses the **static types** of argument expressions; ordinary virtual overloading is not multiple dispatch on every argument's dynamic type.

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

First, compile-time overload resolution uses `&b` as `B*` and `pointer` as `A*`. After selecting the virtual operation, the receiver's actual `B` object determines its final overrider.

Both rules matter:

1. Virtual dispatch uses the receiver's dynamic type.
2. Overload matching uses the arguments' static types.

Behavior depending on two dynamic types needs a deliberate design, such as a visitor, coordinated virtual calls, or carefully bounded RTTI logic.

### The Design Value of Virtual Dispatch

Beyond the mechanism, ask which client code can remain stable when implementations change.

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

`checkout` depends only on `Payment`. A new `BankTransferPayment` can implement `pay` without requiring a new branch in `checkout`. **A stable client interface permits changing implementations.**

This is adaptation through subtyping:

```text
Payment::pay()                 稳定接口
├── CardPayment::pay()         变化实现 1
├── WalletPayment::pay()       变化实现 2
└── BankTransferPayment::pay() 未来新增的变化实现
```

`payment.pay(amount)` intentionally leaves the concrete payment method to the object. The client depends on the payment contract rather than a specific implementation.

#### Base Interfaces in Dependencies and Associations

Two common usage forms:

**Dependency: borrow an object through a parameter.**

```cpp
void drawOne(const Shape& shape) {
    shape.draw();
}
```

The function uses the object during the call without owning it. Suitable public `Shape` implementations can all be passed.

**Association: retain a collaborator.**

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

Here `DrawingPanel` owns a `Shape`, with the concrete type selected independently. `std::unique_ptr` makes ownership explicit and destroys the shape when the panel is destroyed.

A non-owning relationship instead uses an appropriate reference, observer pointer, or higher-level lifetime arrangement. Polymorphism does not decide ownership automatically.

### Common Applications

#### Example 1: Let the Object Supply the Variation

A mouse's weight gain depends on fruit energy. Fruit-specific energy calculations vary; the ability to provide energy is stable:

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

`Mouse::eat` need not distinguish an apple from a strawberry. A future `Banana` implements `Fruit` without adding branches or casts to the mouse.

The variation belongs in `Fruit::energy()`. If energy is merely stored data with no varying behavior, a value object may suffice; inheritance is not mandatory.

#### Example 2: A Stable Algorithm with Variable Steps

When the overall sequence is fixed but steps vary, put the sequence in a non-virtual base operation and delegate steps to protected virtual functions:

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

`develop()` fixes the sequence of design, coding, testing, and maintenance. `MobileApp` and `WebApp` supply the steps. This is the **Template Method** pattern.

Calls through that base operation preserve its sequence while virtual steps vary. If the whole workflow must vary too, model that separately rather than accidentally changing the contract.

#### Example 3: Copying the Dynamic Type with clone()

Constructors cannot be virtual. Given only `const Shape&`, a by-value base copy slices away the derived type.

Avoid a growing list of type tests:

```cpp
// 不推荐：每加一种派生类都要修改这里
// if (typeid(shape) == typeid(Circle)) { ... }
// else if (typeid(shape) == typeid(Rectangle)) { ... }
```

Instead, let a virtual operation copy the concrete type:

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

A circle dispatches to `Circle::clone()` and produces a new circle; a rectangle does likewise. This is informally called a **virtual copy constructor**, but the mechanism is an ordinary virtual member function.

A return of `std::unique_ptr<Shape>` expresses ownership more safely than a raw `Shape*`. Smart-pointer specializations do not support covariant overriding, so each override returns the same `unique_ptr<Shape>` type while constructing the appropriate concrete object.

### Independent Dimensions of Variation

One hierarchy handles one main variation axis well. Encoding every combination of several independent behaviors in derived classes causes rapid growth.

Suppose:

- `f()` has 2 implementations.
- `g()` has 3 implementations.
- `h()` has 4 implementations.

One class per combination would require:

```text
2 × 3 × 4 = 24
```

This is **subclass explosion**. Independent dimensions multiply the count, often leaving many classes with almost identical code.

#### Separate the Dimensions with Composition

Give each behavior its own small interface and implementations, then combine collaborators:

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

The basic strategies can now be developed independently: `2 + 3 + 4 = 9` implementations instead of 24 combination classes.

```text
单棵继承树：  X_1_1_1、X_1_1_2、……、X_2_3_4
               └── 需要枚举全部组合，共 24 类

组合策略：      F 的 2 个实现 + G 的 3 个实现 + H 的 4 个实现
               └── 创建 X 时组装，共 9 个基础实现类
```

Interdependent behaviors may still need coordination. For independent axes, composition is usually easier to extend than enumerating every combination through inheritance.

| Situation | Useful approach |
| ---------------------------------- | ------------------------ |
| Stable subtypes of one abstraction | Public inheritance and virtual functions |
| Fixed workflow with variable steps | Template Method |
| Independent behavior axes | Composed strategies |
| Copying through a base interface | `clone()` |
| Frequent branches on derived type | First consider virtual behavior |

### Chapter Recap

| Topic | Key point |
| ------------ | ---------------------------------------------- |
| Polymorphism | One interface can select different implementations |
| Static polymorphism | Overloads and templates select using static information |
| Dynamic polymorphism | Virtual dispatch uses the actual receiver type |
| C++ virtual calls | Dynamic receiver dispatch follows static overload selection |
| Design benefit | Clients use a stable interface while implementations vary |
| Template Method | Base workflow calls overridable steps |
| `clone()` | A virtual operation copies the concrete type |
| Multiple axes | Separate them with collaborating objects |

Useful polymorphism puts variation in the objects responsible for it. Clients describe the capability they need, allowing new implementations without repeated changes to existing call sites.

## Object-Oriented Design

### From Problem Domain to Class Design

Start by understanding the problem, modeling responsibilities and relationships, then expressing them as C++ classes and functions—not by creating classes first and connecting them afterward.

A common process is:

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

This is iterative. Later discoveries about misplaced responsibilities or variation can require revisiting the model.

| Stage | Main question | Typical result |
| ---------- | ---------------------------------- | ---------------------- |
| Model | What are the important domain concepts and relationships? | Initial types and relationships |
| Refine | What does each concept do, and how do they cooperate? | More precise responsibilities |
| Abstract and represent | How should C++ express the model? | Interfaces and representations |
| Encapsulate variation | Which likely changes deserve isolation? | Replaceable collaborators or interfaces |
| Accommodate change | How can new implementations fit? | Subtypes, strategies, composition |

#### Model Horizontal Relationships First

A library system might initially identify:

- Members.
- Books.
- Loan records.
- A collection or catalog.
- Librarians.

Before choosing integer fields or drawing a hierarchy, ask who uses whom, who owns what, and who performs each operation.

Dependencies, associations, aggregation, and composition describe collaboration. Starting there helps avoid confusing “related to” with “is a.”

#### Refine Responsibilities

The high-level model needs more detail:

- `Book` handles bibliographic information and lending state.
- `Loan` records a particular borrowing period.
- `Catalog` supports finding and managing books.
- `Member` handles reader-related behavior.
- `LibraryService` coordinates borrowing and returns.

Discuss behavior and responsibility before data layout. A tidy class diagram built on weak domain understanding can still assign responsibilities badly.

#### Abstraction Before Representation

Abstraction identifies meaningful concepts, behavior, and state. Representation implements them with C++ types and members.

For example, a coordinate can have several representations:

| Context | Possible representation |
| ------------ | -------------------- |
| Screen pixels | Two integers, `x, y` |
| Plane geometry | Two doubles |
| 3D space | Three components, `x, y, z` |
| High-precision surveying | Specialized numeric types |

Exposing `int x, y` everywhere makes representation changes expensive. A stable semantic interface limits the spread of those changes.

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

Users depend on coordinate queries and translation operations, while `Point` chooses Cartesian, polar, or another internal representation.

### Encapsulating Variation

Requirements, algorithms, formats, platforms, and external services change. The aim is to localize **important, plausible changes**, not predict every possible future.

Consider:

```cpp
class A {
public:
    void process(int count, int mode);

private:
    int values_[50];
};
```

Potential changes include:

| Variation | Coupled location |
| -------------------------- | ---------------------- |
| Parameter count or meaning | `process(int, int)` |
| Processing algorithm | The `process` body |
| Element type | `int` |
| Storage organization | `values_[50]` |

Do not immediately turn every possibility into an abstract class. Weigh likelihood and change cost; small stable code may be clearest as a direct implementation.

If storage genuinely needs to vary, isolate it:

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

`Processor` now depends on `DataStore` capabilities rather than a particular array, list, or database representation.

Avoid both extremes:

| Extreme | Problem |
| -------------- | ------------------------------------------ |
| Hard-code every choice | A local change forces many client changes |
| Abstract every possibility | Excessive layers and configuration obscure the system |

Prioritize demonstrated, consequential variation based on requirements, frequency, cost, and risk.

### Subtyping and Multiple Variation Axes

For one main axis, a stable base interface and different derived implementations provide a useful extension point:

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

A new format can be added as a `Formatter` subtype without changing clients of the interface.

Several independent axes are less suitable for one inheritance tree. Suppose there are:

- Two output formats.
- Three storage mechanisms.
- Four transport mechanisms.

Enumerating combinations would require:

```text
2 × 3 × 4 = 24 种组合类
```

Instead, separate the axes through horizontal relationships:

```text
主对象
├── Formatter   ：负责格式变化
├── DataStore   ：负责存储变化
└── Transport   ：负责传输变化
```

Each small hierarchy handles one kind of variation; the main object combines the selected collaborators.

### Combining Horizontal Relationships with Inheritance

A broad comparison:

| Kind | Relationships | Meaning | Reuse style |
| -------- | ---------------------- | ---------------- | -------- |
| Horizontal | Dependency, association, aggregation, composition | Collaboration | Black-box reuse |
| Vertical | Public inheritance | A subtype is a kind of its base | Subtyping |

A practical system often has several short hierarchies linked through collaboration, rather than one giant inheritance tree.

Public inheritance should preserve the base contract and support meaningful substitution. For implementation reuse alone, composition is usually a better first choice than private or protected inheritance.

#### Dependency plus Inheritance: Temporary Collaboration

A dependency can appear as a parameter, local, or temporary call. In these examples, the caller borrows rather than owns the collaborator.

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

`Mouse::eat` depends on `Fruit`, so adding bananas or strawberries need not add type tests to the mouse.

If mouse behavior also varies, keep the eating workflow in the base and make the absorption factor virtual:

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

Two independent hierarchies cooperate: fruit determines its weight and edible proportion; mouse determines absorption. No class is needed for every fruit–mouse combination.

#### Mutual, Self, and Derived-Class Dependencies

If the edible proportion depends on the mouse, pass its interface to the fruit:

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

This is a **mutual dependency**: each interface uses the other. `*this` refers through the `Mouse` interface but can denote a derived mouse; fruit-specific logic can query virtual mouse operations.

Objects can also depend on others in their own hierarchy. Fighting monsters illustrate **self-dependency**:

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

The base owns the stable fight sequence; derived types supply attacks. A derived type can add an operation that also depends on the base interface:

```cpp
class Crocodile : public Monster {
public:
    void kill(Monster& target);

protected:
    bool attack(Monster& target) override;
};
```

`Crocodile` is a `Monster`, and `kill` uses another `Monster`. Inheritance and dependency describe different facts and can coexist.

#### Association plus Inheritance: Ongoing Collaboration

A retained base-interface member lets the concrete collaborator vary without changing the client class.

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

`Police` borrows a `Vehicle` over time without owning it. A reference expresses a non-null relationship, while requiring the vehicle to outlive its use.

Passing an operation's work to a collaborator is **delegation**:

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

`Scientist` needs an area calculation; `Computer` performs it. The concrete computing service can change without rewriting the scientist. This is black-box reuse.

#### Composition plus Inheritance: Owning Polymorphic Parts

A whole that owns its parts can store them through `std::unique_ptr<Base>`, combining dynamic types with explicit ownership:

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

`Basket` manages one `Fruit` interface rather than separate apple and orange arrays. Smart pointers automatically destroy the owned fruits.

Composition can be recursive. A company can be a department that contains other departments:

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

`FinanceDepartment` is a leaf; `Company` is both a `Department` and an owner of departments. Clients use the same interface for a leaf, a department group, or a subsidiary.

### Choosing Relationships

| Intended fact | Useful relationship | Typical code |
| ---------------------------- | ---------------- | --------------------------------- |
| Used for one operation | Dependency | Parameter `const T&`, `T&`, or `T*` |
| Retained but not owned | Association | Reference or observer-pointer member |
| Owned as a part | Composition | Value member or `unique_ptr<T>` |
| Independent parts grouped or a lifetime genuinely shared | Aggregation or explicit shared ownership, according to the model | Clearly defined lifetime rules |
| Substitutable for the base | Public inheritance | `class Derived : public Base` |
| Reuse another object's capability | Prefer composition/delegation | Object or interface member |

Useful questions are simple:

1. Does this type use the other, or is it a kind of the other?
2. Is that use temporary or ongoing?
3. Who owns, creates, and destroys the object?
4. Which is likely to vary: type, algorithm, or collaborator combination?

Clear answers usually make the relationship choice clearer too.

### Chapter Recap

| Topic | Key point |
| ---------- | ---------------------------------------------------- |
| Process | Model, refine, represent, isolate variation, and iterate |
| Starting point | Domain responsibilities and collaboration before hierarchies |
| Abstraction/representation | Define meaning before choosing storage |
| Variation | Isolate real, consequential changes without over-abstraction |
| Subtyping | Stable interface for one main variation axis |
| Multiple axes | Separate and compose small collaborators |
| Dependency | Temporary use, often through a parameter |
| Association/composition | Ongoing collaboration with explicit ownership rules |
| Inheritance | Public inheritance expresses substitutable is-a relationships |

Good design aligns responsibilities, relationships, ownership, and variation. Small, clear interfaces connect the parts while keeping changes local.

## Exception Handling

### Errors, Exceptions, and Handling Models

Many conditions prevent an operation from completing normally. Distinguish programming defects from reportable runtime failures:

| Category | Examples | Appropriate response |
| ---------- | ---------------------------------------------- | ------------------------------------------------ |
| Programming defect | Out-of-bounds access, null dereference, broken precondition | Fix the code; assertions and diagnostics help find it |
| Runtime failure | Allocation failure, inaccessible file, network failure, invalid input | Report to code that can choose recovery, retry, notification, or termination |

Exceptions should not hide defects. Fix invalid indexing; report a failed file open through an appropriate exception or error result, since external conditions can change despite earlier checks.

Two broad handling models:

| Model | After failure | Characteristic |
| -------- | ---------------------------------- | -------------------------------- |
| Resumption | Recover near the failure and resume | Supported by some systems |
| Termination | Abandon the current path and transfer to a handler | The basic C++ exception model |

Throwing does not skip one statement and continue at the next. Control searches for a matching handler. As scopes are exited toward it, completed automatic objects are destroyed through **stack unwinding**.

### Exception Types

C++ can throw many complete object types, including these simple values; the exception object must satisfy the applicable initialization and destruction rules:

```cpp
throw 42;
throw "file error";

class MyError {
};

throw MyError{};
```

Prefer meaningful exception classes over integers or string literals. They carry structured context and support category-based handling:

```cpp
#include <stdexcept>
#include <string>

class ConfigError : public std::runtime_error {
public:
    explicit ConfigError(const std::string& message)
        : std::runtime_error(message) {}
};
```

`what()` supplies readable information, and callers may handle the specific type or a base such as `std::runtime_error` or `std::exception`.

#### Common Standard Exceptions

Common exceptions in the `std::exception` hierarchy include:

| Type | Typical meaning |
| ----------------------- | --------------------------------- |
| `std::bad_alloc` | Allocation failure |
| `std::bad_cast` | Failed checked reference cast |
| `std::invalid_argument` | Invalid argument value |
| `std::out_of_range` | Checked access outside an allowed range |
| `std::length_error` | A requested length exceeds a limit |
| `std::domain_error` | Invalid mathematical domain |
| `std::overflow_error` | Reported arithmetic overflow |
| `std::underflow_error` | Reported arithmetic underflow |
| `std::runtime_error` | General runtime failure |

`invalid_argument`, `domain_error`, `length_error`, and `out_of_range` derive from `logic_error`; `range_error`, `overflow_error`, and `underflow_error` derive from `runtime_error`. These types classify reported failures; built-in arithmetic or unchecked indexing does not automatically throw them.

### throw, try, and catch

The three basic components are:

```cpp
try {
    // 可能抛出异常的代码
} catch (const SomeError& error) {
    // 处理 SomeError
}
```

#### Throwing

A throw-expression initializes an exception object. Include useful context in its type and message:

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

Ordinary execution after the throw is abandoned. Control transfers to a matching handler or propagates outward.

#### Catching

A try-block may have several handlers:

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

Handlers are considered **in order, and the first match wins**. Put derived exceptions before their base types:

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

A prior `catch (const FileError&)` also matches `FileNotFound`, making the later handler unreachable. `catch (...)` must be last. Use it where the layer can meaningfully handle or propagate any failure, not merely hide it.

#### Why Catch by Const Reference?

The usual form is:

```cpp
catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
}
```

Reference binding avoids an extra copy and preserves the dynamic exception type. Const access avoids accidental modification. Catching a derived exception by base value can slice it:

```cpp
// 不推荐：若实际异常是 FileNotFound，按值接收 FileError 会切片
catch (FileError error) {
    // ...
}
```

Small value exceptions without inheritance may be caught differently, but `const T&` is a clear default for exception classes.

### Propagation, Rethrowing, and Nested Handlers

#### Propagation Through Calls

Suppose the call chain is:

```text
main → run → loadConfig → parse
```

An unhandled exception from `parse` travels outward until a handler matches. If none does, `std::terminate()` is called; whether unwinding occurs before termination in that case is implementation-defined.

During normal unwinding to a handler, completed automatic objects are destroyed in reverse order:

```cpp
void writeReport() {
    File file("report.txt");
    Transaction transaction(file);

    writeContent(file);  // 这里若抛出异常
    transaction.commit();
} // 栈展开时先析构 transaction，再析构 file
```

RAII owners release files, locks, and memory on exceptional exits. C++ has no language-level `finally`; destructors provide scoped cleanup.

#### Rethrowing: throw; versus throw error;

A layer may record context or clean up without being able to decide the final response:

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

Bare `throw;` rethrows the current exception with its dynamic type intact. `throw error;` creates a new exception from the expression's static type and can slice a base-reference view.

A module can deliberately translate a low-level exception into its public error type:

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

That changes what callers see. It is appropriate at a deliberate abstraction boundary, but differs from preserving the original exception unchanged.

#### Nested Try-Blocks

Nested handlers can separate local recovery from higher-level policy:

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

Not every layer needs a catch. If its only purpose is deleting a buffer, prefer an RAII owner and let the exception propagate naturally.

### noexcept and Exception Specifications

`noexcept` specifies that a function does not allow exceptions to escape:

```cpp
void mayThrow();             // 默认可能抛出
void neverThrow() noexcept;  // 承诺不抛出
```

It also has a conditional form:

```cpp
template <typename T>
void swapValue(T& left, T& right)
    noexcept(noexcept(T(std::move(left))) && noexcept(left = std::move(right)));
```

The condition is a constant expression. True makes the function non-throwing; false permits propagation.

**If an exception escapes a noexcept function, std::terminate() is called** instead of reaching an outer handler. Use it for a justified guarantee or deliberate termination policy, not as a cosmetic safety label.

```cpp
void wrong() noexcept {
    throw std::runtime_error("failure"); // 运行时将导致 std::terminate
}
```

Old `throw()` and `throw(Type1, Type2)` specifications are obsolete; typed dynamic exception specifications were removed from modern C++. Use `noexcept` rather than trying to list throwable types.

### Exceptions in Constructors and Destructors

#### Constructors May Throw

If construction cannot establish a valid object, throwing prevents callers from receiving a partly initialized object as a successful result.

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

When a constructor throws, the complete object's destructor does not run, but successfully constructed bases and members are destroyed. RAII members are therefore essential:

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

If `readEntries` throws during `entries_` initialization, the already-constructed `file_` is destroyed and closes the file. No manual cleanup chain is needed.

#### Destructors Should Not Let Exceptions Escape

Destructors should normally provide non-throwing cleanup:

```cpp
class FileWriter {
public:
    ~FileWriter() noexcept {
        closeNoThrow();
    }
};
```

If a destructor invoked during unwinding exits by throwing, termination results. Put reportable failures, such as a failing commit or close operation, in an explicit operation that callers can handle before destruction. A destructor must still perform reliable fallback cleanup.

### Exception-Safety Guarantees

The guarantee describes the state left after an operation fails:

| Guarantee | Meaning |
| ---------- | -------------------------------------------------- |
| Basic | No resource leaks; invariants hold and objects remain usable or safely destructible |
| Strong | Success, or no change to the protected state |
| No-throw | The operation does not propagate an exception |

Guarantees must be designed across dependencies. An operation that corrupts shared state on failure is difficult for its caller to recover from; isolation or transactional preparation may be needed to provide a stronger outer guarantee.

#### Basic Guarantee: Preserve Validity

This assignment operator is unsafe:

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

If `new Data(...)` throws, the old allocation is already gone and `data_` dangles. Even the basic guarantee is violated.

Prepare the new resource before replacing the old one. A modern owner can manage cleanup automatically:

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

If copying the by-value `right` fails, the assignment body has not started and the target is unchanged. Otherwise a non-throwing swap commits the update and the temporary cleans up the old resource. This **copy-and-swap** implementation provides the strong guarantee.

#### Strong Guarantee: Commit or Roll Back

Do throwing preparation without modifying the original state, then commit through non-throwing operations.

```text
准备新状态（可能抛出）
        ↓ 成功后
一次不抛出的提交/交换
        ↓
对象进入新状态
```

For example, build a replacement container and swap it into place only after success. Failure during preparation leaves the original intact.

Another technique separates reading a value from removing it:

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

Combining extraction and removal can modify the stack before construction of the returned value fails. Separating `top()` and `pop()` lets callers obtain the value successfully before changing the stack.

### Exception Neutrality

An **exception-neutral** intermediary preserves exceptions from operations it invokes when it cannot handle them, allowing callers to decide what to do.

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

This pattern is often problematic:

```cpp
try {
    stepOne();
    stepTwo();
} catch (...) {
    std::cerr << "发生错误\n";
    // 异常被吞掉，调用方误以为操作成功
}
```

Swallowing a failure removes the caller's chance to retry, roll back, notify, or stop. End propagation only when the layer has fully handled it and provides an unambiguous outcome, such as a documented failure result.

An intermediary may still perform useful work:

- Use RAII for cleanup.
- Record diagnostics.
- Deliberately translate an exception at a module boundary when its public contract requires that; this is distinct from strict exception neutrality.
- Rethrow with `throw;` to preserve the original, or document an intentional replacement exception.

### Chapter Recap

| Topic | Key point |
| ------------ | -------------------------------------------------------- |
| Model | Throwing abandons the current normal path and searches for a handler |
| Types | Prefer meaningful exceptions based on `std::exception` |
| Handler order | Derived before base; catch-all last |
| Catch form | Usually `const T&` to avoid copies and slicing |
| Rethrow | `throw;` preserves the current exception; `throw error;` may copy or slice |
| `noexcept` | Escaping exceptions cause termination |
| Construction/destruction | Constructors may throw; destructors should not let exceptions escape |
| Basic guarantee | Valid state and no leaks after failure |
| Strong guarantee | Success or unchanged protected state |
| Neutrality | Preserve an exception when the layer cannot handle it |

Effective exception handling defines who decides failure policy, who owns resources, and which state guarantees hold. RAII and well-placed handlers matter more than the number of try-blocks.

## Templates

### Parameterization and Generic Programming

A **template** parameterizes types or compile-time values, reusing one definition for related algorithms or data structures with different element types, capacities, or policies.

Rather than duplicate a maximum-selection function for integers, doubles, and students, parameterize the type:

```cpp
template <typename T>
T larger(const T& left, const T& right) {
    return left < right ? right : left;
}
```

Calls:

```cpp
int bigger_int = larger(3, 8);             // 实例化 larger<int>
double bigger_double = larger(2.5, 1.7);  // 实例化 larger<double>
```

`T` is a **type parameter**, deduced from arguments here. This is static polymorphism: specialization is determined at compile time rather than by virtual dispatch on a runtime object.

A template can also take a compile-time value, such as capacity:

```cpp
template <typename T, std::size_t Capacity>
class FixedBuffer {
    // ...
};
```

`T` is a type parameter; `Capacity` is a non-type template parameter.

#### Templates, Specializations, and Instantiation

Distinguish the terms:

| Term | Meaning | Example |
| -------- | ------------------------------------------ | ----------------------------------- |
| Template | Parameterized definition | `template <typename T> class Stack` |
| Template argument | Type or value supplied | `int`, `std::string`, `8` |
| Instantiated specialization | Entity for particular arguments | `Stack<int>` |
| Instantiation | Producing the required entity from the template | Instantiating a used member of `Stack<int>` |
| Explicit specialization | Dedicated implementation for specific arguments | `template <> class Formatter<bool>` |

`Stack<int>` and `Stack<std::string>` are different types. Their instantiated members and static data belong to their respective specializations.

### Function Templates

#### Definition and Deduction

General form:

```cpp
template <typename T>
返回类型 函数名(含有 T 的参数列表) {
    // 通用实现
}
```

`typename` and `class` are equivalent in a type-parameter declaration:

```cpp
template <typename T>
void print(const T& value);

template <class T>
void printAgain(const T& value);
```

Template arguments can usually be deduced from **function arguments**:

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

If deduction cannot find one consistent `T`, specify it or convert the arguments deliberately:

```cpp
// larger(2, 3.5); // 不能从 int 与 double 推导出唯一的 T

double result = larger<double>(2, 3.5);
```

The destination variable's type does not normally supply deduction for a function's return-only template parameter:

```cpp
template <typename T>
T makeValue();

// int value = makeValue(); // 通常无法据返回类型推导 T
int value = makeValue<int>();
```

#### Templates and Ordinary Overloads

A template and an ordinary function can share a name. With otherwise equally good candidates, overload resolution prefers the non-template function:

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

This allows a tailored overload alongside a generic implementation.

#### Requirements on Template Arguments

A template is not guaranteed to work with every type. The argument type must support the operations actually used.

`larger` uses comparison and returns a value from its inputs, so those operations must be valid for `T`:

```cpp
template <typename T>
T larger(const T& left, const T& right) {
    return left < right ? right : left;
}
```

A class without the required `<` produces an error when that expression is instantiated:

```cpp
class Book {
};

Book first;
Book second;
// larger(first, second); // 错误：Book 不支持 <
```

This is compile-time structural compatibility. C++20 **concepts** can make requirements explicit:

```cpp
#include <concepts>

template <std::totally_ordered T>
T larger(const T& left, const T& right) {
    return left < right ? right : left;
}
```

Concepts are not required to understand basic templates, but can replace long implementation errors with clearer interface constraints.

### Class Templates

Class templates parameterize an entire class, useful for containers, smart pointers, matrices, and other reusable structures.

#### Example: Stack<T>

A stack implemented with `std::vector`:

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

Specify the element type in this example:

```cpp
Stack<int> integer_stack;
integer_stack.push(10);

Stack<std::string> string_stack;
string_stack.push("template");
```

Member definitions are generally instantiated as needed. For example:

```cpp
Stack<int> values;
```

An unused dependent member that calls `T::someFunc()` need not make `Stack<int>` invalid immediately; instantiating that member exposes the invalid operation. Non-dependent errors still require diagnosis when the template is defined.

`top()` returns `const T&` to avoid copying. That reference remains valid only while the element remains alive and uninvalidated. A pop, destruction, or vector reallocation can invalidate it. Copy the value if independent ownership is needed:

```cpp
std::string value = string_stack.top();
string_stack.pop();
```

#### Definitions Usually Belong in Headers

Ordinary function bodies can live in a separately compiled `.cpp`. Template definitions normally need to be available where their required specializations are instantiated.

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

Keep definitions in headers or in `.tpp` files included by them. Explicit instantiation can move selected fixed specializations into a `.cpp`, but a general-purpose template normally follows the visible-definition model.

### Non-Type Template Parameters

A fixed-capacity stack can parameterize a compile-time value:

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

`FixedStack<int, 8>` and `FixedStack<int, 1024>` are different types. This suits genuinely fixed capacities where dynamic allocation is unwanted.

This simple `std::array<T, Capacity>` implementation initializes all elements, requiring a suitable default initialization for `T` when the capacity is nonzero. Supporting non-default-constructible elements needs more careful storage and lifetime management.

### Explicit Specialization

A dedicated implementation can handle a particular argument that genuinely needs different behavior:

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

The primary example only supports types accepted by `std::to_string`. Custom types need a suitable formatting interface, stream operation, or explicit constraint. Generic code still has requirements.

`Formatter<int>` uses the primary template; `Formatter<bool>` uses the specialization:

```cpp
template <>
class 模板名<具体参数> {
    // 专门实现
};
```

The course's `Stack<std::string>` backed by `std::deque<std::string>` illustrates the same option: choose a special representation when there is a sound reason.

Do not specialize every type unnecessarily. If storage policy varies independently, make it a separate parameter or collaborator instead.

### Template Inheritance and a CRTP Singleton

`Singleton<T>` illustrates passing the derived type itself as a base-template argument:

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

This is the **Curiously Recurring Template Pattern (CRTP)**. `Singleton<Logger>` and `Singleton<OtherType>` are distinct specializations, each with its own function-local static instance.

Since C++11, concurrent initialization of a function-local static is coordinated by the language. This protects first initialization, not every later use of the object. Friendship lets `Singleton<Logger>` invoke `Logger`'s private constructor.

Use a singleton only when process-wide uniqueness is a real requirement. Global state and hidden dependencies complicate testing; explicit dependency injection is often easier to replace and isolate.

### The STL and Generic Programming

**Generic programming** combines algorithms, iterators, types, and callables through compile-time interfaces. The STL is a central example.

Main components:

| Component | Role | Examples |
| -------------------- | ------------------------------ | ---------------------------------- |
| Containers | Store objects | `vector`, `list`, `map` |
| Algorithms | Operate on ranges | `sort`, `find`, `remove` |
| Iterators | Connect element sequences to algorithms | Iterators obtained from `begin()` and `end()` |
| Function objects | Supply callable behavior | Comparators and predicates |
| Adapters | Present another interface over a component | `stack`, `queue`, `priority_queue` |
| Allocators | Manage underlying storage allocation | Standard and custom allocators |

Container categories:

| Category | Examples | Organization |
| ------------ | -------------------------------------------------- | ---------------------- |
| Sequence containers | `vector`, `deque`, `list`, `forward_list`, `array` | Elements by position |
| Ordered associative containers | `set`, `multiset`, `map`, `multimap` | Keys ordered by a comparison |
| Unordered associative containers | `unordered_set`, `unordered_map`, etc. | Hash-based lookup |
| Container adapters | `stack`, `queue`, `priority_queue` | Restricted interface over underlying storage |

Historical `hash_set` and `hash_map` names were non-standard. Use standard `std::unordered_set` and `std::unordered_map` where appropriate.

#### Containers, Iterators, and Algorithms

`std::vector` is a common sequence container:

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

Classic standard algorithms often take an iterator pair rather than a container type:

```cpp
#include <algorithm>
#include <vector>

std::vector<int> numbers{1, 2, 3, 2};

auto new_end = std::remove(numbers.begin(), numbers.end(), 2);
numbers.erase(new_end, numbers.end());
```

This is the **erase–remove idiom**. `std::remove` moves retained values forward and returns a new logical end; it does not shrink the vector. `erase` removes the trailing elements.

Iterators connect algorithms to containers with the required capabilities. `std::sort` needs random-access iterators, so it cannot directly sort a `std::list`; the list provides its own `sort()` member.

#### Function Objects

An object with `operator()` can be invoked like a function. A templated comparator can reuse one rule for several types:

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

`CompareByValue<T>` requires `T::value()` and can be passed to an algorithm:

```cpp
std::sort(scores.begin(), scores.end(), CompareByValue<Score>{});
```

Function objects can retain state and reusable logic. Lambdas suit small local behaviors; named types remain useful for configurable, reusable operations.

### Costs and Guidelines

Templates provide type-checked static reuse, with trade-offs:

| Aspect | Consideration |
| ---------- | ------------------------------------------------------------------ |
| Compilation | Instantiations can increase build time and code size |
| Diagnostics | Unclear requirements can produce long errors |
| Interface requirements | Argument types must support instantiated operations |
| Runtime replacement | Template arguments are fixed statically; dynamic choices need another mechanism |

Practical advice:

1. Parameterize real type or compile-time variation, not every imaginable choice.
2. Prefer standard containers, strings, and smart pointers over handwritten replacements.
3. Make requirements clear; use concepts where C++20 is available and appropriate.
4. Keep definitions available for instantiation, commonly in headers.
5. Distinguish static generic reuse from runtime polymorphism; select the mechanism that matches when the choice is made.

### Chapter Recap

| Topic | Key point |
| ------------ | --------------------------------------------------- |
| Templates | Parameterize types and compile-time values |
| Function templates | Deduce arguments or provide explicit `<T>` |
| Class templates | Different arguments generally produce distinct types |
| Definition location | Usually available through a header |
| Non-type parameters | Compile-time values such as the `8` in `FixedStack<int, 8>` |
| Specialization | A justified implementation for particular arguments |
| CRTP singleton | Each derived type selects its own base specialization |
| STL | Containers, algorithms, iterators, callables, and related infrastructure |
| Polymorphism | Templates select statically; virtual functions dispatch dynamically |

Templates express the capabilities an algorithm or structure needs so one definition can work across compatible types. Combine them with standard-library components, clear constraints, and runtime polymorphism where appropriate.
