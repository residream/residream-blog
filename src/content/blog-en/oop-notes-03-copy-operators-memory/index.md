---
title: "OOP Review Notes (3): Copying, Operators, and Memory"
description: "Reviewing object copying, copy assignment, operator overloading, and dynamic memory management in C++."
publishDate: "2026-06-03T23:09:37"
tags:
  - "c-cpp"
heroImage:
  src: ../../blog/oop-notes-03-copy-operators-memory/a-new-day.jpg
  color: "#AA70AE"
  alt: "OOP Review Notes (3): Copying, Operators, and Memory"
language: 'en'
draft: false
---

## Copying and Assignment

### Copying Objects

**Copying an object** means creating a **new object** from an existing one.

The key is “new.” When a same-type source initializes a target that does not yet exist, the operation uses **copy construction**, subject to the applicable move and elision rules.

> To distinguish copy construction from assignment, ask whether the target already existed before the statement, not whether the statement contains `=`.

```cpp
class A {
    // 略
};

A a1;
A a2(a1);  // 根据 a1 创建新对象 a2：拷贝构造
A a3 = a1; // 根据 a1 创建新对象 a3：也是拷贝构造
```

Copying an object is not necessarily a raw memory copy. Scalar members may copy directly, but class-type members follow their own copy rules. A class managing memory, file handles, or other resources needs carefully designed copying semantics.

**Why copy objects?** Passing and returning objects by value are common contexts.

A by-value parameter is a separate object, not the argument object itself:

```cpp
class A {
    // 略
};

void function(A a) {
    // a 是由实参复制得到的新对象
}

int main() {
    A obj;
    function(obj); // 可能调用拷贝构造函数
}
```

A by-value return also provides a result object for the caller. An ordinary local such as `a` cannot simply remain available after its lifetime ends:

```cpp
class A {
public:
    void g() const;
};

A function() {
    A a;
    return a;
}

int main() {
    function().g();
}
```

These examples motivate copy construction, but **return value optimization** (RVO), copy elision, and moving may avoid an actual copy. In C++17, some prvalue cases construct the result directly as a language guarantee, rather than merely an optional optimization. Do not infer the general copying rules from a single observed constructor trace.

For example, return an unnamed object directly:

```cpp
A function() {
    return A(2);
}
```

The result can be constructed directly in its destination; for a same-type prvalue return in C++17, this direct construction is guaranteed.

### Copy Constructors

A **copy constructor** constructs a new object from an existing object of the same class.

A typical declaration:

```cpp
class T {
public:
    T(const T& rhs);
};
```

It has the usual constructor properties:

- Its name matches the class name.
- It has no return type.
- It can be public, protected, or private.
- Its first parameter is a reference to the class type. The common form used here has only that parameter; any additional parameters must have defaults.

The usual parameter type is `const T&`:

```cpp
T(const T& rhs);
```

Here:

- `T&` passes by reference, avoiding another copy merely to pass the parameter.
- `const` gives read-only access to the source `rhs`.

**Why not pass by value?** Consider:

```cpp
T(T rhs); // 错误的设计
```

Passing `rhs` by value would itself require copying a `T`, leading back to the same operation. C++ rejects this form; the source parameter of a copy constructor must be a reference.

This form is also possible:

```cpp
T(T& rhs);
```

But it cannot copy a const source, so it is more restrictive. Prefer `const T&` unless the class deliberately requires different semantics.

> C++11's `T(T&& rhs)` is a **move constructor**, often used to transfer resources from an rvalue. It is distinct from the usual copy constructor, `T(const T& rhs)`.

**Construction versus assignment:** does the target already exist?

```cpp
A a1;
A a2;
a1 = a2; // 赋值：a1 在这条语句之前已经存在

B b1;
B b2(b1);  // 拷贝构造：b2 在这条语句之前不存在
B b3 = b1; // 拷贝构造：b3 在这条语句之前不存在
```

The `=` in `B b3 = b1;` is part of initialization, not an assignment to an existing `b3`.

Assignment between existing class objects uses an overloaded operator, conceptually:

```cpp
A& operator=(const A& rhs);
```

For a suitable class, the compiler implicitly supplies an assignment operator with an effect like:

```cpp
A& operator=(const A& rhs) {
    this->x = rhs.x;
    return *this;
}
```

Thus:

```cpp
a1 = a2;
```

Calls:

```cpp
a1.operator=(a2);
```

By contrast, `b3` does not yet exist in this declaration, so it is copy-constructed:

```cpp
B(const B& rhs);
```

Conceptually equivalent here to:

```cpp
B b3(b1);
```

Comparison:

| Aspect | Copy construction | Copy assignment |
| ------------ | ---------------------------- | ---------------------------- |
| Target object | Created by this declaration | Already exists |
| Typical syntax | `B b2(b1);`, `B b3 = b1;` | `b2 = b1;` |
| Member function | `B(const B& rhs)` | `B& operator=(const B& rhs)` |
| Purpose | Establish a new object's state | Replace an existing object's state |

For class types, parentheses can make the construction intent easy to recognize:

```cpp
B b2(b1);
```

This style clearly creates a new object. Built-in types often use the familiar form:

```cpp
int x = 10;
double y = 3.14;
```

**Member objects follow their own construction rules**:

```cpp
class A {
public:
    A(int n);
    A(const A& rhs);
};

class B {
public:
    B(A& a) : a_(a) {} // 用 a 构造成员 a_，调用 A 的拷贝构造函数
    B(int n) : a_(n) {} // 用 n 构造成员 a_，调用 A(int)

private:
    A a_;
};
```

The `A` member `a_` must be constructed before the `B` constructor body runs. Initializing it from an `A` uses copy construction; initializing it from an `int` selects `A(int)`.

### Implicit Copy Constructors

If no copy constructor is explicitly declared, the compiler normally implicitly declares one.

```cpp
class A {
public:
    int value_;
};

A a1;
A a2(a1); // 使用编译器提供的缺省拷贝构造函数
```

A simplified model of its effect is:

```cpp
class A {
public:
    A(const A& rhs) {
        value_ = rhs.value_;
    }

private:
    int value_;
};
```

The actual generated operation follows the rules for each base and member. It does not infer who should own a resource merely from a pointer's presence.

This differs from an implicit default constructor: declaring an ordinary constructor suppresses the latter, but does not by itself suppress copying. Copying can still become unavailable under other rules, for example with non-copyable members or user-declared move operations.

An implicitly declared copy constructor is public. It may be defined as deleted if required base or member copying is unavailable or inaccessible.

**Implicit copying is memberwise.** For a raw pointer, that means copying its value without duplicating the pointee—a shallow copy of that relationship. Class-type members may themselves implement deeper copying.

### Shallow Copying

A **shallow copy** copies stored member values without recursively duplicating resources reached through raw pointers. It is sometimes loosely called a bitwise copy, but memberwise copying and raw byte copying are not generally interchangeable.

Consider:

```cpp
class AA {
    // 略
};

class My {
public:
    My(AA& a) : ref_aa_(a) {}

private:
    int value_;
    AA* p_aa_;
    AA& ref_aa_;
    AA aa_;
};
```

Construct `m2` with the implicit copy constructor:

```cpp
My m1(a);
My m2(m1);
```

The members are handled roughly as follows:

- **Static data members** are not part of the individual object's state and are not copied.
- **Scalar members**, such as `int value_`, copy their values.
- **Pointer members**, such as `AA* p_aa_`, copy their stored addresses.
- **Reference members**, such as `AA& ref_aa_`, bind the new reference to the same referent as the source reference.
- **Class-type members**, such as `AA aa_`, are constructed using their class's copy constructor.

The shallow aspect is particularly clear for a raw pointer:

```cpp
m2.p_aa_ == m1.p_aa_;
```

The pointer members belong to different objects, but hold the same address and therefore refer to the same resource.

**The ownership problem:** if both objects treat that pointer as owning and delete it in their destructors, shallow copying can cause a double free.

```cpp
class A {
    // 略
};

class B {
public:
    B() {
        p_a_ = new A;
    }

    ~B() {
        delete p_a_;
    }

private:
    A* p_a_;
};

int main() {
    B b1;
    B b2(b1); // 使用缺省拷贝构造函数，浅拷贝 p_a_
}
```

After `B b2(b1);`, the relationship is:

```text
b1.p_a_ ──┐
          ├── 同一块堆区 A 对象
b2.p_a_ ──┘
```

At scope exit, destruction happens in reverse construction order:

1. `b2` deletes the `A` reached through its `p_a_`.
2. `b1` tries to delete the same object again.

The second `delete` has undefined behavior, often appearing as a crash or runtime error.

Shallow copying is not inherently wrong. For a non-owning pointer, preserving the same referent may be exactly right. The problem is **giving two objects exclusive ownership of the same resource**.

### Providing a Copy Constructor

If implicit memberwise copying does not match the class's semantics, define an appropriate copy constructor.

A common goal is an independent resource for the new object: a **deep copy**.

For the `B` that owns a dynamically allocated `A`:

```cpp
class B {
public:
    B() : p_a_(new A) {}

    B(const B& rhs)
        : p_a_(new A(*rhs.p_a_)) {}

    ~B() {
        delete p_a_;
    }

private:
    A* p_a_;
};
```

`new A(*rhs.p_a_)` constructs a separate `A` from the source's pointee and stores its address in the new object's `p_a_`.

Now:

```text
b1.p_a_ ──────> 堆区 A 对象 1
b2.p_a_ ──────> 堆区 A 对象 2
```

The two `A` objects have equivalent contents but different addresses. Each `B` owns and deletes its own resource. That is a deep copy.

Allocation can also occur in the constructor body:

```cpp
B::B(const B& rhs) {
    p_a_ = new A(*rhs.p_a_);
}
```

This can work for a pointer member, but an initializer list more directly expresses initialization during construction.

**The normal initialization rules still apply.** Reference members, const members, and class-type members without usable default constructors need suitable initialization, normally through the initializer list unless a default member initializer supplies it:

```cpp
class B {
public:
    B(const B& rhs)
        : p_a_(new A(*rhs.p_a_)),
          ref_a_(rhs.ref_a_),
          a_(rhs.a_) {}

private:
    A* p_a_;
    A& ref_a_;
    A a_;
};
```

`ref_a_` binds during initialization, and `a_(rhs.a_)` calls `A`'s copy constructor.

**Reasons to customize or disable copying:**

- A class needs an independent copy of a resource it owns, where that resource supports meaningful duplication.
- Domain rules require special behavior, such as tracking copies or allocating a new identifier.
- Copying should be prohibited, as for a mutex or certain exclusive-resource and singleton types.

**The old way to prohibit copying:** declare a private copy constructor without defining it.

```cpp
class My {
public:
    My() = default;

private:
    My(const My& rhs); // 只声明，不实现
};
```

An outside attempt to copy:

```cpp
My obj1;
My obj2(obj1); // 编译错误：私有成员不可访问
```

The user declaration prevents the compiler from supplying another usable implicit copy constructor.

A private function with a definition differs from one without a definition:

```cpp
class My {
public:
    My() = default;

private:
    My(const My& rhs) {
        // 略
    }

    void f() {
        My m1;
        My m2(m1); // 类内部可以访问私有拷贝构造函数
    }
};
```

Members and friends can call a private function. Omitting its definition was the old way to make such calls fail too, typically at link time.

Declaring a public copy constructor without defining it is also unhelpful:

```cpp
class My {
public:
    My() = default;
    My(const My& rhs); // 没有实现
};
```

The code can compile and then fail to link. An immediate compile-time diagnostic is clearer.

**Since C++11, prefer `= delete`:**

```cpp
class My {
public:
    My() = default;
    My(const My& rhs) = delete;
};
```

This explicitly makes calls to that function ill-formed.

Disabling copying also affects by-value calls and returns when they require a copy; moving or guaranteed copy elision can make some cases valid without one:

```cpp
void wrong(My obj); // 调用时需要拷贝构造

My make(); // 某些语境下也需要可访问的拷贝或移动构造
```

Non-copyable objects are commonly passed by reference or pointer, such as `void f(const My& obj);`.

### Assigning Objects

**Object assignment** updates an existing target from an existing source.

```cpp
int main() {
    A a1;
    A a2(a1);  // 拷贝构造：a2 原来不存在
    A a3 = a2; // 拷贝构造：a3 原来不存在

    a3 = a1;   // 对象赋值：a3 原来已经存在
}
```

The distinction is:

- **Copy construction:** create a new object.
- **Copy assignment:** change an object that already exists.

The relevant function is the **copy assignment operator**, an overload of `=`.

The compiler normally implicitly declares one when the user does not:

```cpp
class A {
public:
    int value_;
};

A a1;
A a2;
a2 = a1; // 使用缺省赋值函数
```

When usable, the implicit operator is public and assigns bases and non-static members according to their types. Raw pointers receive shallow assignment.

Member behavior includes:

- Scalars copy values.
- Pointers copy addresses.
- Class-type members use their assignment operators.
- Static members are not part of the per-object state being assigned.
- Reference members cannot be rebound; a non-static reference member causes the defaulted copy assignment operator to be deleted.

For example:

```cpp
class AA {
    // 略
};

class My {
public:
    My(AA& ra) : ref_aa_(ra) {}

private:
    int value_;
    AA* p_aa_;
    AA& ref_aa_;
    AA aa_;
};

int main() {
    AA a1;
    AA a2;
    My m1(a1);
    My m2(a2);

    m1 = m2; // 通常错误：引用成员不能被重新绑定
}
```

Making `m1.ref_aa_` refer to `a2` would require rebinding an existing reference, which C++ does not allow. The implicit copy assignment operator is therefore deleted.

A programmer can still define `operator=` with deliberate semantics. For example, `ref_aa_ = rhs.ref_aa_` assigns to the **referred-to `AA` object**; it does not rebind the reference. Whether that behavior is appropriate depends on the class.

**Shallow assignment adds another ownership hazard:** it can lose the target's old resource before creating shared ownership of the source's resource.

```cpp
class A {
    // 略
};

class B {
public:
    B() : p_a_(new A) {}

    ~B() {
        delete p_a_;
    }

private:
    A* p_a_;
};

int main() {
    B b1;
    B b2;
    b1 = b2; // 使用缺省赋值函数，浅赋值 p_a_
}
```

Initially, `b1` and `b2` each own an `A`. Shallow assignment effectively does:

```cpp
b1.p_a_ = b2.p_a_;
```

This causes two problems:

1. **Memory leak:** `b1`'s old address is overwritten without releasing the allocation, leaving no owning pointer to it.
2. **Double free:** both objects now hold the same owning address and will try to delete it.

A resource-owning class needs assignment semantics as well as construction and destruction semantics.

### Providing an Assignment Operator

When implicit assignment is unsuitable, a typical custom declaration is:

```cpp
class T {
public:
    T& operator=(const T& rhs);
};
```

Its parts are:

| Part | Meaning |
| -------------- | --------------------- |
| `T&` | Return a reference to the current object |
| `operator=` | Function name for the assignment operator |
| `const T& rhs` | Right-hand source object |

For:

```cpp
left = right;
```

In member-function form:

- `rhs` represents `right`.
- `this` implicitly points to `left`.
- `*this` denotes the current left-hand object.

**The source usually has type `const T&`:**

```cpp
T& operator=(const T& rhs);
```

- `const` provides read-only access to the source.
- `&` avoids an extra copy just to pass the argument.

**Why return `T&`?** Built-in assignment expressions support chaining:

```cpp
int a;
int b;
int c;

a = b = c;
```

That groups as:

```cpp
a = (b = c);
```

Returning the current object by reference gives user-defined assignment the same conventional behavior:

```cpp
T& T::operator=(const T& rhs) {
    // 完成赋值
    return *this;
}
```

If it returns `void`:

```cpp
void operator=(const T& rhs);
```

`b = c` produces no value usable by the outer assignment, so ordinary `a = b = c` chaining fails.

If it returns `T`:

```cpp
T operator=(const T& rhs);
```

Some chains may compile, but extra temporary objects result. `(a = b) = c` can then assign to a temporary rather than to `a`, unlike built-in assignment semantics.

> `this` is a pointer of type `T*`; `*this` is an lvalue denoting the current `T` object. The conventional return is therefore `*this`, not `this`.

**A basic deep-assignment implementation:**

```cpp
class B {
public:
    B() : pch_(new char('\0')) {}

    B(const B& rhs) : pch_(new char(*rhs.pch_)) {}

    ~B() {
        delete pch_;
    }

    B& operator=(const B& rhs) {
        if (this != &rhs) {
            delete pch_;
            pch_ = new char(*rhs.pch_);
        }
        return *this;
    }

private:
    char* pch_;
};
```

This illustrates four steps:

1. Check for self-assignment.
2. Release the old resource.
3. Allocate and copy an independent replacement.
4. Return `*this` for chaining.

**Why this implementation needs a self-assignment check:** the obvious case is:

```cpp
B b1;
b1 = b1;
```

An alias can make the same situation less obvious:

```cpp
B b1;
B& b2 = b1;

b1 = b2;
```

Despite the different names, `b2` is a reference to `b1`; they denote the same object.

Without the check, this order fails:

```cpp
delete pch_;
pch_ = new char(*rhs.pch_);
```

If `rhs` is the current object, the first line deletes the very resource later read through `rhs.pch_`. The resulting use-after-free has undefined behavior.

Compare object addresses:

```cpp
if (this != &rhs) {
    // 只有左右对象不是同一个对象时，才执行资源替换
}
```

Addresses detect aliases; variable names do not.

The basic version avoids self-assignment failure, leaks, and double deletion during successful execution. But if allocation throws after the old resource is deleted, the object can be left invalid. Prepare the replacement first:

```cpp
B& B::operator=(const B& rhs) {
    if (this != &rhs) {
        char* new_pch = new char(*rhs.pch_);
        delete pch_;
        pch_ = new_pch;
    }
    return *this;
}
```

If `new` throws now, the old `pch_` has not been deleted and the object retains its previous valid state.

Resource-owning classes should consider copy construction, copy assignment, and destruction together:

```cpp
class B {
public:
    B();
    B(const B& rhs);             // 深拷贝
    B& operator=(const B& rhs);  // 深赋值
    ~B();                        // 释放资源
};
```

This is the **Rule of Three**: if one of these operations needs customization, review whether the other two need it too.

Modern C++ extends that review to move construction and move assignment—the Rule of Five. Preferably, use RAII members such as `std::string`, `std::vector`, or smart pointers so handwritten special members are unnecessary: the Rule of Zero. The central distinction remains: **construction creates a new object; assignment updates an existing one. Raw resource ownership often needs more than shallow copying.**

## Operator Overloading

### Overloading Operators

**Operator overloading** defines the behavior of an existing C++ operator for a user-defined type, allowing expressions resembling those for built-in types.

For example, adding 2D vectors can use an ordinary member:

```cpp
class TVector {
public:
    TVector(int x, int y) : x_(x), y_(y) {}

    TVector addVector(const TVector& rhs) const {
        return TVector(x_ + rhs.x_, y_ + rhs.y_);
    }

private:
    int x_;
    int y_;
};

TVector v1(1, 2);
TVector v2(3, 4);
TVector result = v1.addVector(v2);
```

That works, but vector addition has a familiar mathematical notation:

```cpp
TVector result = v1 + v2;
```

Readers can recognize addition without first learning the name `addVector`. An overloaded operator can express an intuitive operation using familiar syntax.

An ordinary free function can do the same computation:

```cpp
TVector addVector(const TVector& lhs, const TVector& rhs);
```

Function names might vary between `addVector`, `add`, and `plus`, while `+` carries a familiar meaning. Overloading adds no fundamental computational power; it can make an interface better fit its domain.

> Overloading assigns a meaning to an existing overloadable operator. It does not invent a new operator.

**Classification by operand count:**

- **Unary:** one operand, as in `+a`, `-a`, `++a`, `a++`, `!a`, `~a`, `*p`, and `&a`.
- **Binary:** two operands, as in `a + b`, `a * b`, `a = b`, `a += b`, and `a << b`.
- **Ternary:** three operands, as in the conditional expression `a > b ? a : b`.

An operator function's name combines `operator` with the operator token:

```text
operator+
operator=
operator[]
operator()
operator->
```

For example:

```cpp
TVector operator+(const TVector& lhs, const TVector& rhs);
```

`operator+` is a function name. Despite its unusual spelling, it still names a function.

**Underlying mechanism:** an overloaded-operator expression selects a corresponding function call.

```cpp
a + b;
```

For a free-function overload, conceptually:

```cpp
operator+(a, b);
```

For a member overload:

```cpp
a.operator+(b);
```

Parameter passing, return types, access control, constness, and overload resolution still apply.

**Overloadable operators:** most existing operators can be overloaded, for example:

```text
+  -  *  /  %  ^  &  |  ~
!  =  <  >  +=  -=  *=  /=  %=
^= &= |= << >> >>= <<=
== != <= >= && || ++ --
->* -> , [] ()
new delete new[] delete[]
```

`new`, `delete`, `new[]`, and `delete[]` also have overloadable allocation/deallocation functions. Later sections discuss custom allocation strategies.

**Operators or language constructs that cannot be overloaded** include:

```text
.    .*    ::    ?:
sizeof    typeid
static_cast    dynamic_cast    const_cast    reinterpret_cast
```

In particular, remember `.`, `.*`, `::`, and `?:`. The ternary conditional operator cannot be overloaded.

**Restrictions:** operator overloading does not allow arbitrary changes to C++ syntax.

1. **Operand count cannot be changed.** Binary `+` remains binary, and `++` remains unary. The dummy `int` in postfix `operator++(int)` distinguishes the two forms; it does not make increment a binary operator.
2. **Precedence and associativity cannot be changed.**

   ```cpp
      a + b * c;
   ```

   Whether overloaded or not, `*` binds more tightly than `+`, so the multiplication result is the operand of the addition.

   Similarly, `+` remains left-associative:

   ```cpp
      a + b + c;
   ```

   In member-function notation:

   ```cpp
      a.operator+(b).operator+(c);
   ```

   Assignment remains right-associative:

   ```cpp
      a = b = c;
   ```

   Conceptually:

   ```cpp
      a.operator=(b.operator=(c));
   ```

3. **New operators cannot be invented.** Symbols such as `**`, `⊕`, and `∩` cannot be introduced with a new operator declaration. Only existing overloadable C++ operators are available.
4. **An ordinary overloaded operator needs a class or enumeration operand.** It cannot redefine an operation solely between built-in types:

   ```cpp
      int operator+(int lhs, int rhs); // 错误
   ```

   At least one operand must have class or enumeration type. Overloading cannot change the meaning of `int + int` or `double * double`.

5. **Preserve familiar semantics.** Implementing `+` as subtraction might compile, but it misleads readers. The aim is clarity, not a puzzle.

### Binary Operator Overloads

A **binary operator** has two operands:

```cpp
v1 + v2;
```

`v1` is the left operand and `v2` the right. Common implementations are free functions and member functions.

**Free-function form:** both operands are explicit parameters.

```cpp
class TVector {
public:
    TVector(int x, int y) : x_(x), y_(y) {}

    int getX() const { return x_; }
    int getY() const { return y_; }

private:
    int x_;
    int y_;
};

TVector operator+(const TVector& lhs, const TVector& rhs) {
    return TVector(lhs.getX() + rhs.getX(),
                   lhs.getY() + rhs.getY());
}
```

The expression:

```cpp
v1 + v2;
```

Can be understood as:

```cpp
operator+(v1, v2);
```

This treats both operands symmetrically. Free functions often suit non-mutating operators such as `+`, `-`, `*`, `/`, `==`, and `<`.

If access to private data is needed, the class can declare the function a **friend**:

```cpp
class A {
    friend A operator+(const A& lhs, const A& rhs);

public:
    A(int x, int y) : x_(x), y_(y) {}

private:
    int x_;
    int y_;
};

A operator+(const A& lhs, const A& rhs) {
    return A(lhs.x_ + rhs.x_, lhs.y_ + rhs.y_);
}
```

`operator+` is still a non-member with no implicit `this`; friendship grants access, not membership.

**Member-function form:** the current object supplies the left operand, and the right operand is explicit.

```cpp
class TVector {
public:
    TVector(int x, int y) : x_(x), y_(y) {}

    TVector operator+(const TVector& rhs) const {
        return TVector(x_ + rhs.x_, y_ + rhs.y_);
    }

private:
    int x_;
    int y_;
};
```

The expression:

```cpp
v1 + v2;
```

Can be understood as:

```cpp
v1.operator+(v2);
```

Thus:

- `this` identifies the left operand, `v1`.
- The parameter list contains the right operand, `v2`.
- The left operand must support that member call.

This creates an asymmetry. If only this overload exists:

```cpp
class Complex {
public:
    Complex operator+(double rhs) const;
};
```

It supports:

```cpp
complex + 2.0;
```

But not directly:

```cpp
2.0 + complex;
```

`2.0` is a `double`; there is no `2.0.operator+(complex)` member call. A free-function `operator+` is usually more suitable when both operand orders should work naturally.

**Trailing const:** an ordinary addition that preserves its operands often has this member declaration:

```cpp
TVector operator+(const TVector& rhs) const;
```

The two qualifiers have different roles:

- `const TVector& rhs` gives read-only access to the right operand.
- The trailing `const` gives const access to the left operand through `this`.

Since ordinary `+` produces a new result without changing either operand, a member version should normally be const.

**Choose return types to match familiar semantics:** successful compilation alone is not enough.

| Expression | Usual return type | Reason |
| -------- | ------------ | -------------------------- |
| `!a` | `bool` | Produces a truth value |
| `a * b` | `T` | Produces a new result |
| `a = b` | `T&` | Updates the left operand and supports chaining |
| `a *= b` | `T&` | Updates and returns the left operand |

Ordinary arithmetic usually returns a new value:

```cpp
TVector operator+(const TVector& lhs, const TVector& rhs);
```

Assignment and compound assignment normally return a reference to the modified left operand:

```cpp
TVector& operator+=(const TVector& rhs);
TVector& operator=(const TVector& rhs);
```

Do not return a reference to a local object:

```cpp
const TVector& badAdd(const TVector& lhs, const TVector& rhs) {
    TVector result(lhs.getX() + rhs.getX(), lhs.getY() + rhs.getY());
    return result; // 错误：result 离开函数后被销毁
}
```

Returning a new value is correct for ordinary `+`. **Return value optimization** can avoid copying; a fear of copies does not justify returning a dangling reference.

### Related Operator Pairs

Related operations should usually be offered together. A common pair is:

```text
+
+=
```

Ordinary addition `+` and add-assignment `+=`.

```cpp
a = a + b;
a += b;
```

The first computes a sum and assigns it; the second directly expresses adding to `a` itself. Users familiar with built-in types often expect both forms.

**The meaning of +=:** because it modifies the left operand, a member function is a natural fit:

```cpp
class A {
public:
    A(int x, int y) : x_(x), y_(y) {}

    A& operator+=(const A& rhs) {
        x_ += rhs.x_;
        y_ += rhs.y_;
        return *this;
    }

private:
    int x_;
    int y_;
};
```

`a += b` corresponds to:

```cpp
a.operator+=(b);
```

It returns `*this` for the same reason as assignment:

- `this` is the object's address.
- `*this` denotes the object itself.
- Returning `A&` keeps the expression referring to the left operand.

For example:

```cpp
(a += b) += c;
```

The first `a += b` returns a reference to `a`, so the second operation modifies that same object.

**The meaning of +:** preserve both original operands and return a new result.

Implement `+=` first, then reuse it for `+`:

```cpp
class A {
public:
    A(int x, int y) : x_(x), y_(y) {}

    A& operator+=(const A& rhs) {
        x_ += rhs.x_;
        y_ += rhs.y_;
        return *this;
    }

private:
    int x_;
    int y_;
};

A operator+(A lhs, const A& rhs) {
    lhs += rhs;
    return lhs;
}
```

The by-value `lhs` is an independent object. `lhs += rhs` changes it rather than the original left operand, and the function returns the result by value.

This also:

1. Keeps the addition logic in one place, `operator+=`.
2. Avoids direct private-member access in `operator+`, so friendship may be unnecessary.

If a third coordinate `z_` is later added, updating `operator+=` also updates the behavior of the `operator+` built on it.

Other related pairs:

| Ordinary operation | Compound assignment |
| -------- | ------------ |
| `+`      | `+=`         |
| `-`      | `-=`         |
| `*`      | `*=`         |
| `/`      | `/=`         |
| `%`      | `%=`         |

The purpose is to meet familiar expectations for the type, not merely to provide more overloads.

### Unary Operator Overloads

**Unary operators** take one operand: unary plus/minus, logical negation, bitwise complement, increment, and decrement are examples. Here the focus is prefix and postfix `++`.

For a built-in `int`:

```cpp
int a = 10;
++a;
a++;
```

Both add `1` to `a`, but produce different results.

**Prefix ++a:** modify the object, then yield the updated object.

Conceptually:

```cpp
a += 1;
return a;
```

A user-defined prefix overload therefore commonly looks like:

```cpp
class A {
public:
    A& operator++() {
        ++num_;
        ++den_;
        return *this;
    }

private:
    int num_;
    int den_;
};
```

The expression:

```cpp
++a;
```

Corresponds to:

```cpp
a.operator++();
```

It normally returns `A&`, since the result denotes the updated current object.

**Postfix a++:** save the old value, modify the object, then yield the old value.

Conceptually:

```cpp
int temp = a;
a += 1;
return temp;
```

Both forms are named `operator++`. C++ distinguishes postfix with an extra dummy `int` parameter:

```cpp
class A {
public:
    A operator++(int) {
        A temp(*this);
        ++num_;
        ++den_;
        return temp;
    }

private:
    int num_;
    int den_;
};
```

The expression:

```cpp
a++;
```

Corresponds to:

```cpp
a.operator++(0);
```

The compiler supplies `0` for this syntax marker. The parameter is normally unused and does not mean “how much to increment.”

Remember the signatures and conventional returns together:

| Expression | Member form | Result | Usual return type |
| ----- | ----------------- | ------------------ | ------------ |
| `++a` | `operator++()` | Updated current object | `A&` |
| `a++` | `operator++(int)` | Saved old value | `A` |

**A fraction example:** for a fraction `num_ / den_`, adding the denominator to the numerator increments the fraction by one.

```cpp
class Fraction {
public:
    Fraction(int num = 0, int den = 1) : num_(num), den_(den) {}

    Fraction& operator++() {
        num_ += den_;
        return *this;
    }

    Fraction operator++(int) {
        Fraction temp(*this);
        num_ += den_;
        return temp;
    }

private:
    int num_;
    int den_;
};
```

Starting with `a` equal to `1/3`:

```cpp
Fraction b = ++a;
```

Both `a` and `b` become `4/3`, because prefix increment yields the updated value.

```cpp
Fraction c = a++;
```

`c` receives the old value while `a` is incremented. Postfix therefore saves and returns the prior value.

### Overloading [], (), ->, and Stream Operators

These operators have especially familiar meanings. Their overloads should behave in ways users expect from arrays, functions, pointers, and streams.

**Subscript []:** provide array-like element access.

```cpp
class A {
public:
    int operator[](int index) const {
        return nums_[index];
    }

    int& operator[](int index) {
        return nums_[index];
    }

private:
    int nums_[100];
};
```

Usage:

```cpp
A a1;
a1[0] = 10;

const A& a2 = a1;
int value = a2[0];
```

Const and non-const overloads are common:

- `int operator[](int) const`: read an element from a const object by value.
- `int& operator[](int)`: return a mutable element reference, allowing `a1[0] = 10`.

If the non-const overload also returned `int`:

```cpp
int operator[](int index);
```

`a1[0]` would be a result value, not an assignable reference to the stored element.

Teaching examples often omit bounds checks. Many array-like interfaces leave `operator[]` unchecked and provide a separate checked operation such as `at()`.

> `operator[]` must be a member. For an owning container, a const overload should not expose mutable access to its elements, or it would undermine the intended const interface.

**Function call ():** overloading it makes an object callable.

```cpp
class A {
public:
    int operator()() const {
        return 999;
    }

    int operator()(int a, int b) const {
        return a + b;
    }
};
```

Usage:

```cpp
A a;
int x = a();
int y = a(10, 30);
```

`operator()` can have multiple parameter lists, like other overloaded functions. Objects providing it are called **function objects** or **functors**.

They are useful for comparators, configurable strategies, and callbacks to standard-library algorithms. Lambdas cover many small one-off cases; named function objects remain useful for state and reusable logic.

**Arrow ->:** provide pointer-like or proxy behavior.

```cpp
class A {
public:
    void f() {}
};

class B {
public:
    B(A* p) : p_a_(p) {}

    A* operator->() {
        return p_a_;
    }

private:
    A* p_a_;
};
```

Usage:

```cpp
A a;
B b(&a);
b->f();
```

Conceptually:

```cpp
(b.operator->())->f();
```

The return must support the next step of arrow access:

1. A pointer to an appropriate object; or
2. Another class object with its own applicable `operator->`.

This allows a proxy chain:

```cpp
c->f();
```

If `c.operator->()` returns a `b` object and `b.operator->()` returns `A*`, arrow resolution continues until it reaches a pointer that supports `->f()`. Smart pointers and proxies use this mechanism.

**Stream insertion <<:** a non-member overload supports `cout << obj`.

```cpp
#include <ostream>

class A {
public:
    int getX() const { return x_; }
    int getY() const { return y_; }

private:
    int x_ = 0;
    int y_ = 0;
};

std::ostream& operator<<(std::ostream& out, const A& obj) {
    out << obj.getX() << ' ' << obj.getY();
    return out;
}
```

Usage:

```cpp
std::cout << obj << std::endl;
```

An `A` member overload would put the `A` object on the left:

```cpp
obj.operator<<(std::cout);
```

That describes `obj << cout`, not `cout << obj`. We cannot add arbitrary members to the standard `std::ostream` class, so a free function is appropriate.

Use public getters or grant friendship if the output function needs access to private data.

**Stream extraction >>:** also normally a non-member.

```cpp
#include <istream>

class A {
public:
    void setX(int x) { x_ = x; }
    void setY(int y) { y_ = y; }

private:
    int x_ = 0;
    int y_ = 0;
};

std::istream& operator>>(std::istream& in, A& obj) {
    int x;
    int y;
    in >> x >> y;
    obj.setX(x);
    obj.setY(y);
    return in;
}
```

The object parameter is a non-const `A&`, because input modifies it.

Returning the stream by reference allows chaining:

```cpp
std::cout << a << b << std::endl;
std::cin >> a >> b;
```

Each operation returns the same stream to be the next operation's left operand.

### Operator-Overloading Guidelines

This is an interface-design question as much as a syntax question. **Preserve the familiar expectations of the corresponding built-in operator.**

For example:

- `+` should produce a new result without quietly modifying an operand.
- `+=` should modify and normally return the left operand.
- `==` should mean equality comparison.
- `[]` should mean element access.
- `a++` should yield the old value; `++a` should yield the updated object.
- Stream insertion `<<` should return the stream for chaining.

If the symbol does not help a reader understand the operation, use a named function instead.

**Member or non-member?** Useful guidelines:

| Operator category | Common or required form | Reason |
| --------------------------- | ---------------------- | -------------------------------------- |
| Unary operators | Member, often convenient | The operand is naturally the current object |
| `=`, `[]`, `()`, `->` | Member required; non-static in the C++17 model here | Language constraints; C++23 also permits static `[]` and `()` |
| Compound assignments such as `+=`, `-=`, `*=` | Member recommended | Modify the left operand |
| Other ordinary binary operators | Non-member often recommended | Symmetric operands and conversions on the left |

For C++17, remember the four operators requiring non-static member overloads: `operator=`, `operator[]`, `operator()`, and `operator->`. C++23 relaxed the non-static requirement for `[]` and `()`, while retaining their member requirement.

**Why members often suit unary operators:** the sole operand is the current object.

```cpp
++a;
```

The member form is natural:

```cpp
a.operator++();
```

Some unary operators can also be free functions. This is a design preference, not a universal language restriction.

**Why members suit compound assignment:**

```cpp
a += b;
a -= b;
a *= b;
```

These operators change the left operand, so accessing it through `this` is straightforward:

```cpp
A& operator+=(const A& rhs);
```

**Why non-members often suit other binary operations:**

```cpp
a + b;
a == b;
a < b;
```

Both operands can be explicit and symmetric. This also supports a user-defined object on the right:

```cpp
Complex operator+(double lhs, const Complex& rhs);
Complex operator+(const Complex& lhs, double rhs);
```

A member-only implementation may support `complex + 2.0` but cannot by itself support `2.0 + complex`.

**Usually avoid overloading &&, ||, and comma:**

Built-in `&&` and `||` short-circuit:

```cpp
if (p != nullptr && p->valid()) {
}
```

If `p == nullptr`, the right side is not evaluated. Overloaded `operator&&` and `operator||` evaluate both operands for the call and cannot preserve that short-circuit behavior.

The comma operator also carries familiar evaluation and reading expectations. Overloading these operators often obscures intent, even where the language permits it.

A practical checklist:

1. Does the operation fit the symbol's familiar meaning?
2. Does it change the left operand, and should it return a new value or a reference?
3. Must a class object always appear on the left, or should a non-member support symmetric use?
4. Follow the member requirements for `=`, `[]`, `()`, and `->`.
5. Avoid clever overloads that break short-circuit expectations or obscure reading.

Good overloads make a type feel as natural as a number, array, pointer, or stream. The objective is clear behavior, not merely fewer characters.

## Dynamic Memory Management

### Storage Regions

A useful implementation model separates the regions where code and data are commonly stored.

The course uses five regions: code, constant data, variable data, stack, and heap. These are implementation concepts, not a required C++ memory layout. The central distinction is between automatic local lifetimes and dynamically allocated objects whose ownership must arrange destruction.

| Region | Typical contents | Lifetime or management |
| --------------- | ------------------------------------------ | ----------------------------------------------- |
| Code | Compiled machine instructions | Loaded executable code, commonly read-only |
| Constant data | String literals and read-only data | Often lasts for the program's execution |
| Global/static data | Globals, static variables, and static data members | Static storage duration |
| Stack | Call frames, automatic locals, and some parameters | Normally managed with calls and scope exit |
| Heap/free store | Dynamically allocated objects and arrays | Managed through allocation and ownership cleanup |

> The **free store** describes storage used for ordinary C++ dynamic allocation; a **heap** is a common implementation mechanism. Here “heap” informally refers to storage managed with ordinary `new` and `delete`.

**Global/static data** commonly includes:

```cpp
int total = 88; // 全局变量

class A {
public:
    static int base;
};

int A::base = 5; // 静态数据成员的定义
```

These objects do not belong to a particular call frame. Their storage duration spans the program, although initialization timing follows specific rules.

A local static variable is still not an ordinary automatic stack object:

```cpp
void f() {
    static int count = 0;
    ++count;
}
```

`count` has local **scope** but static storage duration. Dynamically initialized local statics initialize on first passage through their declaration; this constant-initialized example can initialize earlier. Writing a declaration inside a function does not imply automatic storage duration.

The **stack** commonly supports function calls. A call frame holds information such as a return address and storage for some parameters and locals; optimizations may keep values in registers or eliminate them.

```cpp
int add(int a, int b) {
    int result = a + b;
    return result;
}
```

Each call to `add` has its own parameters and local state. Recursive calls likewise have independent invocation state:

```cpp
int sumTo(int n) {
    if (n == 0) {
        return 0;
    }

    int local = n;
    return local + sumTo(n - 1);
}
```

The **heap/free store** supports dynamic allocation:

```cpp
A* p = new A(10);
delete p;
```

An ordinary local pointer `p` has automatic storage duration, while its pointee is dynamically allocated. **The pointer and the object it points to can live in entirely different storage regions.**

Comparison:

| Aspect | Static or automatic objects | Dynamic objects |
| ---------- | ------------------------------ | ---------------------------- |
| Examples | Globals, statics, automatic locals | Objects allocated by `new` |
| Creation | According to static initialization or local execution rules | When the allocation expression executes |
| Destruction | Normal termination or scope exit, as applicable | When ownership cleanup destroys them |
| Management | Language/runtime lifetime rules | Programmer-defined ownership, ideally through RAII |
| Risks | Limited stack capacity; lifetime may not fit the task | Leaks, double frees, dangling pointers |

### Limits of Static and Automatic Storage

Language-managed lifetimes are convenient: automatic local objects are destroyed at scope exit, and static objects have their own termination rules, without manual `delete` calls.

```cpp
void f() {
    A obj;
    // 使用 obj
} // 离开作用域，obj 自动析构
```

Automatic storage works well for small, fixed-size data whose lifetime matches a scope. It also has limitations.

**1. Object counts or array sizes may be known only at runtime.**

```cpp
const int count = 50;
A objects[count];
```

An ordinary built-in array bound in standard C++ needs an appropriate constant expression. If its size comes from input:

```cpp
int count;
std::cin >> count;
```

A local `A objects[count];` is not a standard variable-length array. Use dynamic storage, usually through a container such as `std::vector`.

**2. Automatic lifetime is tied to scope.**

```cpp
A makeA() {
    A obj;
    return obj;
}
```

`obj` is destroyed when the function exits. Returning its address does not let the caller keep it alive; use an appropriate value return or ownership model instead.

**3. Stack space is limited.**

Large local arrays or very deep recursion can exhaust the available stack:

```cpp
void risky() {
    int values[10'000'000]; // 可能导致栈空间不足
}
```

**4. An array declaration without element initializers needs suitable default initialization.**

```cpp
class Card {
public:
    Card(int id);
};

Card cards[54]; // 错误：Card 没有无参构造函数
```

Each element must be initialized. With no supplied element initializer, a class element needs a usable default constructor; `Card(int)` alone cannot satisfy that.

One workaround is an array of pointers with individual allocations:

```cpp
class Poker {
public:
    Poker() {
        for (int i = 0; i < 54; ++i) {
            cards_[i] = new Card(i);
        }
    }

    ~Poker() {
        for (int i = 0; i < 54; ++i) {
            delete cards_[i];
        }
    }

private:
    Card* cards_[54];
};
```

`cards_` contains 54 pointers, not 54 `Card` objects. Each `new Card(i)` constructs one card with its own ID.

This introduces responsibility: 54 successful allocations need 54 matching deletions, and partial construction failure needs cleanup too. Dynamic allocation is flexible, but ownership must be managed.

Automatic and static lifetimes reduce manual cleanup. Dynamic storage adds control over runtime size, creation, and destruction timing.

### Allocating and Deleting One Object

Use ordinary `new` and `delete` for a single dynamically allocated object:

```cpp
T* p = new T(参数列表);
delete p;
```

`T` may be a built-in type, a class, or even a pointer type.

**Basic new expressions:**

```cpp
int* p1 = new int;      // int 未初始化，值不确定
int* p2 = new int(5);   // 值为 5
int* p3 = new int();    // 值初始化为 0

A* p4 = new A;          // 调用 A 的无参构造函数
A* p5 = new A(100, 200); // 调用匹配的有参构造函数
```

`new A(100, 200)` passes arguments to `A`'s constructor. For a class object, the expression both obtains storage and constructs the object.

The allocated object normally has no ordinary variable name:

```cpp
A* p = new A(10);
```

The object lives in dynamic storage and can be accessed through its address in `p`:

```cpp
p->func();
```

If the last owning address is lost or overwritten before cleanup, the allocation becomes a **memory leak**.

**Basic delete expressions:**

```cpp
delete p;
```

For a non-null pointer to a suitable single class object, deletion conceptually:

1. Does nothing to an object if `p` is null.
2. Otherwise invokes the object's destructor.
3. Releases its storage.

Thus:

```cpp
A* p = new A(10);
delete p;
```

The lifecycle is: obtain storage, construct `A`, use it, destroy it, then release the storage.

> Ordinary `new` combines allocation with initialization; `delete` combines destruction with deallocation. Automatic constructor/destructor calls distinguish these expressions from `malloc` and `free`.

`delete` destroys the **pointee**; it does not reset the pointer variable:

```cpp
A* p = new A;
delete p;

// p 还保存着旧地址，但该地址已经不能再作为有效 A 对象访问
```

`p` is now a **dangling pointer**. If the variable remains in use, a defensive reset is:

```cpp
delete p;
p = nullptr;
```

Deleting the null pointer again is harmless. Resetting this pointer does not, however, fix other dangling aliases to the former object.

**Match allocation and deallocation forms.**

```cpp
A* p = new A;
delete p;
```

A single-object `new` pairs with `delete`; `new[]` pairs with `delete[]`.

```cpp
A* array = new A[50];
delete[] array;
```

Mismatching them has undefined behavior:

```cpp
A* p1 = new A;
delete[] p1; // 错误

A* p2 = new A[50];
delete p2;  // 错误
```

**What a new expression does:**

```cpp
T* p = new T(1, 2);
```

Conceptually:

1. Select an appropriate `operator new` to obtain raw storage for `T`.
2. On allocation failure, ordinary throwing allocation reports `std::bad_alloc`, possibly after invoking an installed `new_handler`.
3. Initialize the object, calling its constructor for a class type.
4. Return a `T*` to the constructed object.

A `new_handler` can provide a hook for allocation failure:

```cpp
#include <new>

void onAllocationFailure() {
    // 尝试释放可回收资源、记录日志，或直接抛出异常
    throw std::bad_alloc();
}

int main() {
    std::new_handler old = std::set_new_handler(onAllocationFailure);

    // 此处的普通 new 若无法分配，可能调用 onAllocationFailure

    std::set_new_handler(old); // 恢复原处理函数
}
```

This is mainly useful here for understanding failure handling. Application code commonly lets `std::bad_alloc` propagate or avoids uncontrolled manual allocations.

A simplified model is:

```cpp
void* raw = ::operator new(sizeof(T));
T* p = new (raw) T(1, 2); // 在 raw 指向的内存上构造 T
```

This pseudocode illustrates allocation versus construction. It is not a drop-in replacement: constructor exceptions and matching cleanup need handling. Ordinary `new T(...)` provides that machinery.

**What a delete expression does:**

```cpp
delete p;
```

Conceptually:

```cpp
if (p != nullptr) {
    p->~T();
    ::operator delete(p);
}
```

The compiler selects the applicable destruction and deallocation operations. The key distinction is that destruction and storage release are separate steps.

**new/delete versus malloc/free**

| Aspect | `new/delete` | `malloc/free` |
| ------------ | ------------------------ | ---------------------------------- |
| Origin | C++ language expressions | C library functions |
| Type awareness | Operate with the target type | Allocate or release raw byte storage |
| Construction/destruction | Invoked for class objects | Not automatically invoked |
| Allocation result | Pointer to the target type | `void*` |
| Class lifetime management | Integrated with the language | Requires separate lifetime handling |

Do not mix the families: pair single-object `new` with `delete`, `new[]` with `delete[]`, and `malloc` with `free`. Do not `free` a `new`-constructed object or `delete` a `malloc` allocation.

In modern C++, prefer standard containers and smart pointers over long-lived raw owning pointers.

### Overloading operator new and operator delete

A new-expression and a delete-expression do more than allocate or free bytes. Their raw storage operations are supplied by functions named `operator new` and `operator delete`.

```cpp
A* p = new A(9);
delete p;
```

Separate the four roles:

| Mechanism | Responsibility |
| ----------------- | ---------------------------- |
| `operator new` | Obtain raw storage |
| Constructor | Initialize the object in that storage |
| Destructor | Clean up the object's resources |
| `operator delete` | Release raw storage |

Overloading allocation/deallocation customizes the first and last steps; **it does not replace constructors or destructors**.

**Class-specific operator new:**

```cpp
#include <cstddef>

class A {
public:
    static void* operator new(std::size_t size);
    static void operator delete(void* p) noexcept;
};
```

It returns `void*`, an address of raw storage. Its first parameter is `std::size_t`, specifying the requested size in bytes.

```cpp
A* p = new A;
```

For this expression, the selected allocation function receives the size needed for `A`.

Class-specific allocation and deallocation functions are static members, even without an explicit `static` keyword. They have no implicit `this`: allocation precedes construction, and ordinary deallocation follows destruction.

**Class-specific versus global functions:** ordinary unqualified allocation considers a class-specific overload when one is available; otherwise global functions are used.

```cpp
class A {
public:
    static void* operator new(std::size_t size) {
        return ::operator new(size);
    }

    static void operator delete(void* p) noexcept {
        ::operator delete(p);
    }
};
```

The leading `::` explicitly selects the global `::operator new` or `::operator delete`. An unqualified call from the class-specific function could accidentally call itself recursively.

**Counting allocations:** a class-specific function can track allocations of that class.

```cpp
#include <cstddef>

class A {
public:
    static void* operator new(std::size_t size) {
        void* p = ::operator new(size);
        ++allocation_count_;
        return p;
    }

    static void operator delete(void* p) noexcept {
        ++deallocation_count_;
        ::operator delete(p);
    }

    static int allocationCount() {
        return allocation_count_;
    }

    static int deallocationCount() {
        return deallocation_count_;
    }

private:
    static int allocation_count_;
    static int deallocation_count_;
};

int A::allocation_count_ = 0;
int A::deallocation_count_ = 0;
```

Such counts can reveal mismatched allocation and release paths, but only for operations passing through these overloads. They are not a substitute for a memory-analysis tool.

**Extra allocation parameters:** an overload can take additional arguments, such as a debugging label:

```cpp
class A {
public:
    static void* operator new(std::size_t size, const char* tag);
};

A* p = new ("debug") A(8);
```

`"debug"` selects an allocation overload. It is separate from the constructor argument `8` in `A(8)`.

These forms support pools, source-location tracking, and allocation logs. A matching placement deallocation function is needed to release raw storage if construction throws after such allocation succeeds.

**Deallocation forms:** a common single-object signature is:

```cpp
static void operator delete(void* p) noexcept;
```

A sized form can also be provided:

```cpp
static void operator delete(void* p, std::size_t size) noexcept;
```

Selection follows the language's deallocation rules and visible overloads. The central point is that ordinary `operator delete` releases storage; the delete-expression is responsible for invoking destruction first.

### Allocating and Deleting Arrays

Use `new[]` with matching `delete[]`:

```cpp
T* p = new T[n];
delete[] p;
```

The element count `n` can be determined at runtime:

```cpp
int n;
std::cin >> n;

T* p = new T[n];
// 使用 p[0] 到 p[n - 1]
delete[] p;
```

`new T[n]` conceptually:

1. Obtains contiguous storage for `n` elements, plus any implementation overhead.
2. Initializes the elements in order.
3. Returns a pointer to the first element for a nonempty array.

For a class type:

```cpp
A* array = new A[50];
```

This normally calls `A`'s default constructor 50 times. Thus:

```cpp
class A {
public:
    A(int value);
};

A* array = new A[50]; // 错误：没有 A()
```

Without a usable default constructor, this uninitialized array form is unavailable. Alternatives include individual initialization or a container that constructs elements with supplied arguments, such as `emplace_back`.

Built-in element types also distinguish default initialization from value initialization:

```cpp
int* a = new int[10];   // 元素未初始化，值不确定
int* b = new int[10](); // 值初始化，元素为 0
```

**Array deletion:**

```cpp
delete[] p;
```

Conceptually:

1. If `p` is null, no element needs destruction.
2. Otherwise destroy the elements in reverse construction order.
3. Release the array's storage.

The array form is required so that array destruction and deallocation use the correct rules.

```cpp
A* p = new A[50];
delete[] p; // 正确：析构 50 个 A 对象
```

Do not write:

```cpp
delete p; // 错误：new[] 与 delete 不匹配
```

The element count is not written again in `delete[]`. The implementation retains or derives the information it needs; the programmer must match the allocation form.

**Array allocation functions:** arrays and individual objects use distinct functions.

| Expressions | Allocation/deallocation functions |
| ------------------------- | -------------------------------------- |
| `new T` / `delete p`      | `operator new` / `operator delete`     |
| `new T[n]` / `delete[] p` | `operator new[]` / `operator delete[]` |

A class can customize the array forms too:

```cpp
static void* operator new[](std::size_t size);
static void operator delete[](void* p) noexcept;
```

**A dynamic array of pointers:** when `Card` has no default constructor and the count is runtime-dependent:

```cpp
class Poker {
public:
    Poker(int deck_count)
        : count_(54 * deck_count),
          cards_(new Card*[count_]) {
        for (int i = 0; i < count_; ++i) {
            cards_[i] = new Card(i % 54);
        }
    }

    ~Poker() {
        for (int i = 0; i < count_; ++i) {
            delete cards_[i];
        }
        delete[] cards_;
    }

private:
    int count_;
    Card** cards_;
};
```

There are two allocation levels: each `cards_[i]` points to a separate `Card`, and `cards_` points to a dynamic pointer array. Cleanup deletes each card, then uses `delete[] cards_` for the array.

This shows how manual ownership becomes complex: partial construction, copying, assignment, self-assignment, and exceptional exits all need a policy. Prefer RAII containers and smart pointers such as `std::vector` and `std::unique_ptr` in application code.

### Smart Pointers and Shared Ownership

A raw owning pointer often starts like this:

```cpp
T* p = new T;
p->f();
delete p;
```

The danger lies in the real code between allocation and deletion: early returns, exceptions, and branches can skip cleanup and leak the resource.

A **smart pointer** stores an address in an owner object whose destructor performs the appropriate cleanup.

```text
局部智能指针对象离开作用域
            ↓
调用智能指针析构函数
            ↓
释放其拥有的堆对象
```

This is **RAII**, Resource Acquisition Is Initialization: tie resource ownership to an object's lifetime so destruction releases it.

A minimal exclusive owner illustrates the idea:

```cpp
template <typename T>
class SimplePtr {
public:
    explicit SimplePtr(T* p) : ptr_(p) {}

    ~SimplePtr() {
        delete ptr_;
    }

    T* operator->() {
        return ptr_;
    }

    T& operator*() {
        return *ptr_;
    }

    SimplePtr(const SimplePtr&) = delete;
    SimplePtr& operator=(const SimplePtr&) = delete;

private:
    T* ptr_;
};
```

Usage:

```cpp
void f() {
    SimplePtr<T> ptr(new T);

    ptr->method();
    (*ptr).method();
} // 离开作用域，SimplePtr 析构，自动 delete 内部的 T 对象
```

`ptr->method()` uses the overloaded `operator->`; `(*ptr).method()` uses `operator*`. Parentheses are needed around `*ptr` because member access binds more tightly than unary dereferencing.

`SimplePtr` is only a teaching example. Its essential rule is **exclusive ownership**: two instances must not independently delete the same pointer, so copying is explicitly disabled.

The historical `std::auto_ptr` transferred ownership on copying, an unintuitive behavior; it was removed in C++17. Modern alternatives include:

| Type | Ownership semantics | Typical use |
| -------------------- | -------------------------- | ------------------------------ |
| `std::unique_ptr<T>` | Exclusive; movable, not copyable | Default choice for a single dynamic owner |
| `std::shared_ptr<T>` | Shared lifetime using reference counting | When multiple owners truly need to keep an object alive |
| `std::weak_ptr<T>` | Non-owning observation of shared ownership | Break ownership cycles or obtain temporary access |

Exclusive ownership commonly looks like:

```cpp
#include <memory>

auto ptr = std::make_unique<T>();
ptr->f();
```

No manual `delete` is needed: destruction of the owning `ptr` destroys its `T`.

Use shared ownership when several owners genuinely need to extend the same lifetime:

```cpp
#include <memory>

std::shared_ptr<T> ptr = std::make_shared<T>();
ptr->f();
```

Shared ownership is not inherently better. It adds counting, ownership-cycle, and lifetime-reasoning costs. Prefer a direct member or `unique_ptr` when there is one clear owner.

### Implementing Shared Ownership: Approach 1

Several owners may refer to one allocation, but only the last owner should release it.

Simply copying a raw pointer:

```text
b1.pa_ ──┐
         ├── A 对象
b2.pa_ ──┘
```

With unconditional destruction:

```cpp
delete pa_;
```

Would double-delete the resource. **Reference counting** tracks how many owners remain.

The first approach embeds the count in `A` itself:

```cpp
class A {
public:
    A(int data = 0) : data_(data), use_count_(1) {}

    void addRef() {
        ++use_count_;
    }

    int releaseRef() {
        return --use_count_;
    }

private:
    int data_;
    int use_count_;
};
```

`use_count_` counts the managing objects that share this `A`. One initial owner gives a count of `1`.

The managing class `B` can be written as:

```cpp
class B {
public:
    B(int value = 0) : pa_(new A(value)) {}

    B(const B& rhs) : pa_(rhs.pa_) {
        pa_->addRef();
    }

    B& operator=(const B& rhs) {
        if (this != &rhs) {
            release();
            pa_ = rhs.pa_;
            pa_->addRef();
        }
        return *this;
    }

    ~B() {
        release();
    }

private:
    void release() {
        if (pa_->releaseRef() == 0) {
            delete pa_;
        }
    }

private:
    A* pa_;
};
```

For this construction sequence:

```cpp
B b1(8);  // 新建 A(8)，use_count_ = 1
B b2(b1); // b2.pa_ 指向同一个 A(8)，use_count_ = 2
B b3(10); // 新建另一份 A(10)，其 use_count_ = 1
```

The relationship is:

```text
b1.pa_ ──┐
         ├── A(8), use_count_ = 2
b2.pa_ ──┘

b3.pa_ ─────> A(10), use_count_ = 1
```

If destruction occurs in the order `b3 → b2 → b1`:

1. `b3` decrements `A(10)` from 1 to 0 and deletes it.
2. `b2` decrements `A(8)` from 2 to 1, leaving it alive.
3. `b1` decrements `A(8)` from 1 to 0 and deletes it.

Copy construction no longer deep-copies the resource:

```cpp
pa_ = rhs.pa_;
pa_->addRef();
```

It shares the address and increments the count. Destruction decrements the count and deletes only when it reaches zero.

The limitation is that `A` must include ownership machinery such as `use_count_`, `addRef`, and `releaseRef`. That is unsuitable for an unmodifiable third-party type or a type whose domain logic should remain independent of ownership.

This is **intrusive reference counting**. Standard `shared_ptr` does not require a counter inside the managed object.

### Implementing Shared Ownership: Approach 2

The second approach leaves `A` unchanged and allocates a separate counter, illustrated here with an `int*`:

```cpp
class B {
private:
    A* pa_;
    int* use_;
};
```

Here:

- `pa_` points to the shared `A`.
- `use_` points to the counter shared by that group of owners.

Why not use an ordinary `int` member?

```cpp
class B {
private:
    A* pa_;
    int use_;
};
```

Each `B` would then have its own independent count. Two objects sharing one `A` would not share the information that there are two owners.

Why not use a static member?

```cpp
class B {
private:
    A* pa_;
    static int use_;
};
```

One class-wide count would mix unrelated resources: `b1`/`b2` sharing `A(8)` and `b3` owning `A(10)` need separate counts.

The rule is: **owners sharing one resource also share one counter; unrelated resources have different counters**.

A simplified implementation:

```cpp
class B {
public:
    B(int value = 0)
        : pa_(new A(value)),
          use_(new int(1)) {}

    B(const B& rhs)
        : pa_(rhs.pa_),
          use_(rhs.use_) {
        addRef();
    }

    B& operator=(const B& rhs) {
        if (this != &rhs) {
            releaseRef();
            pa_ = rhs.pa_;
            use_ = rhs.use_;
            addRef();
        }
        return *this;
    }

    ~B() {
        releaseRef();
    }

    A* operator->() const {
        return pa_;
    }

private:
    void addRef() {
        ++(*use_);
    }

    void releaseRef() {
        if (--(*use_) == 0) {
            delete pa_;
            delete use_;
        }
    }

private:
    A* pa_;
    int* use_;
};
```

Responsibilities:

| Operation | Resource pointer `pa_` | Counter pointer `use_` |
| -------- | -------------------------------- | ------------------------- |
| Ordinary construction | Allocate `A` | Allocate a counter initialized to 1 |
| Copy construction | Share the address | Share the counter and increment it |
| Destruction | Delete `A` only for the last owner | Decrement, then delete the counter if it reaches zero |
| Assignment | Leave the old group and join the source group | Decrement the old count and increment the new one |

This assignment implementation must handle self-assignment:

```cpp
if (this != &rhs) {
    // 先放弃当前资源，再共享 rhs 的资源
}
```

Without the check, `b = b;` could release its sole-owned resource before trying to read the now-invalid source pointer from the same object.

Comparison:

| Approach | Count location | Benefit | Cost |
| -------- | ------------------- | ------------------------ | -------------------------------- |
| Intrusive | Inside `A` | Direct and compact | Requires changing the managed type |
| Separate count | Independent dynamic object | Works without modifying `A` | Must manage both resource and count storage |

Real `std::shared_ptr` uses a fuller **control block**, including ownership counts and deletion information. Concurrent ownership operations also require synchronization of that machinery. These examples explain lifetimes; they are not production-quality smart pointers or a guarantee that access to the pointee is thread-safe.

### Further Notes

**Do not apply delete directly to void*.**

```cpp
A* p = new A;
void* q = p;

delete q; // 错误：不能据此正确确定 A 的析构语义
```

A `void*` lacks the static object type required for a typed delete-expression. Compilers may accept deletion through `void*` as an extension with a warning, but it is not a valid portable way to destroy an object.

In the ordinary cases here, delete through a matching object pointer type or through a suitable polymorphic base with a virtual destructor:

```cpp
class Base {
public:
    virtual ~Base() = default;
};

class Derived : public Base {
};

Base* p = new Derived;
delete p; // 正确：虚析构保证 Derived 也会被正确析构
```

Deleting a `Derived` through `Base*` without the required virtual destruction support has undefined behavior.

**Dangling pointers versus memory leaks:**

```cpp
A* p = new A;
delete p;
p->f(); // 悬空指针：对象已经释放，却继续访问旧地址
```

This means the object is gone, but a pointer still refers to its former storage.

```cpp
A* p = new A;
return; // 内存泄漏：对象还在，但再也没有释放入口
```

Here the allocation remains, but the means to release it has been lost. Both problems arise from incorrect lifetime or ownership management.

**Copy on write (COW)** lets readers share a resource until a writer needs an independent copy. Directly modifying shared data would otherwise affect all readers.

The basic strategy:

1. Share the resource for reading.
2. Check the ownership count before writing.
3. If the count is 1, modify the exclusively owned resource.
4. If the count exceeds 1, detach by copying, then modify the private copy.

This illustration prepares the new resource and counter before leaving the old ownership group, preserving the original state if allocation fails:

```cpp
#include <memory>

void B::writeA(int value) {
    if (*use_ > 1) {
        auto new_pa = std::make_unique<A>(*pa_);
        auto new_use = std::make_unique<int>(1);

        --(*use_);              // 当前对象退出旧共享关系
        pa_ = new_pa.release(); // 当前对象持有新资源
        use_ = new_use.release();
    }

    pa_->setData(value);
}
```

That is “share for reads, copy for writes.” It can reduce copies in read-heavy use, but requires careful exception safety, concurrency rules, and coverage of every mutation path. It is not the automatic best choice for every shared data structure.

**Placement new** constructs an object in existing storage rather than obtaining a fresh allocation through the usual allocating form.

Ordinary new:

```cpp
A* p = new A(1);
```

Obtains storage and constructs `A` in it.

The standard non-allocating placement form:

```cpp
#include <cstddef>
#include <new>

alignas(A) std::byte storage[sizeof(A) * 3];

A* p1 = ::new (static_cast<void*>(storage)) A(1);
A* p2 = ::new (static_cast<void*>(storage + sizeof(A))) A(2);
A* p3 = ::new (static_cast<void*>(storage + sizeof(A) * 2)) A(3);
```

`storage` already exists. `::new (address) A(...)` uses that address to initialize the object without allocating another buffer.

`alignas(A)` matters: the buffer needs both enough bytes and appropriate alignment. A plain character buffer used in a conceptual example does not automatically communicate that alignment requirement.

Do not use ordinary `delete` on this placement-constructed object:

```cpp
delete p1; // 错误：p1 的存储不是由普通 new A 得到的
```

It would attempt to deallocate storage from the wrong source. Instead, explicitly destroy the object and let the buffer's owner manage its storage:

```cpp
p3->~A();
p2->~A();
p1->~A();
```

The local array's storage ends at scope exit, but its disappearance does not automatically call the destructor of an `A` manually constructed inside it. Arrange that destruction explicitly when required.

Placement construction is useful in pools, containers, and low-level components. It requires coordinated management of storage, alignment, construction, destruction, and final deallocation. Standard containers and RAII owners are usually safer for ordinary application code.
