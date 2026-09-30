---
title: "OOP Review Notes (2): Classes and Object Lifetimes"
description: "Reviewing C++ classes, member functions, constructors, destructors, and object lifetimes."
publishDate: "2026-06-03T23:08:17"
tags:
  - "c-cpp"
heroImage:
  src: ../../blog/oop-notes-02-classes-lifecycle/pain.jpg
  color: "#66A4B7"
  alt: "OOP Review Notes (2): Classes and Object Lifetimes"
language: 'en'
draft: false
---

## Classes and Objects

### Ordering Class Members

C++ does not require functions to appear before data members, or `public` sections before `private` sections.

A common convention is nevertheless to:

1. Put the externally visible `public` interface first.
2. Put internal `private` data afterward.

Readers usually want to know what a class can do before learning how it stores its state.

### Class Definitions Usually Go in Headers

Other `.cpp` files using a class often need its complete definition.

```cpp
// Dog.h
#ifndef DOG_H
#define DOG_H

class Dog {
public:
    void bark();
};

#endif
```

Use **include guards** when putting a class definition in a header. Repeated inclusion within the same translation unit can otherwise redefine the class and violate the **one-definition rule**.

### Forward Declarations

```cpp
class Cat;

class Dog {
public:
    void fight(Cat& cat);
};
```

`class Cat;` does not define `Cat` completely; it tells the compiler that `Cat` names a class, allowing declarations such as `Cat&`.

This can **break circular dependencies**. If `Dog.h` includes `Cat.h` and `Cat.h` includes `Dog.h`, the headers include each other:

```cpp
// Dog.h
#include "Cat.h"

class Dog {
public:
    void fight(Cat& cat);
};
// Cat.h
#include "Dog.h"

class Cat {
public:
    void fight(Dog& dog);
};
```

Without guards, inclusion can recurse until the compiler reports an error. With guards, a required complete definition may still be unavailable at the point where it is needed.

A forward declaration is a better fit here:

```cpp
// Dog.h
class Cat;

class Dog {
public:
    void fight(Cat& cat);
};
// Cat.h
class Dog;

class Cat {
public:
    void fight(Dog& dog);
};
```

The two headers can now stand independently instead of including one another.

Forward declarations also **reduce compile-time dependencies**:

Suppose `Dog.h` directly includes `Bone.h`:

```cpp
//Dog.h
#include "Bone.h"

class Dog {
public:
    void eat(Bone& bone);
};
```

Every `.cpp` file including `Dog.h` then indirectly depends on `Bone.h`. Changing `Bone.h` can force all of those translation units to **recompile**, producing a costly cascade in a large project.

With a forward declaration instead:

```cpp
class Bone;

class Dog {
public:
    void eat(Bone& bone);
};
```

`Dog.h` no longer needs the complete definition from `Bone.h`, so ordinary changes to that header need not trigger unrelated recompilation.

Forward declarations work only where the complete class definition is unnecessary, for example:

- Declaring a pointer: `Cat*`.
- Declaring a reference: `Cat&`.
- Declaring a function's parameter or return type.

A by-value data member requires a complete type because the compiler must know its size:

```cpp
class Cat;

class Dog {
private:
    Cat cat_; // 通常不行：编译器不知道 Cat 的大小
};
```

That case requires including `Cat.h`.

### Class Members

**A reference member must bind to an object**

A reference data member requires a referent:

```cpp
class Person {
};

class Dog {
private:
    Person& owner_;
};
```

The reference member `owner_` means every `Dog` must be associated with an owner. A reference has no valid null state, unlike a pointer; the owner's lifetime must still be managed correctly.

**A class cannot contain a non-static member of its own type by value**:

```cpp
class Dog {
private:
    Dog part_; // 错误
};
```

The required size would recurse indefinitely:

- A `Dog` contains a `Dog part_`.
- That `part_` contains another `Dog part_`.
- The nesting never ends, so no finite object size can be determined.

Recursive containment by value therefore cannot work.

**A class can contain a pointer or reference to its own type**

The following declarations do not embed another complete object:

```cpp
class Dog {
private:
    Dog* next_;
    Dog& friendDog_;
};
```

A pointer member occupies storage for a pointer, not for another complete `Dog`, so there is no infinite nesting.

Reference members are also typically implemented using pointer-like storage, without embedding the referred-to object.

**Different classes must avoid mutual containment by value too**

Two classes cannot each contain the other by value:

```cpp
class Cat {
private:
    Dog dog_;
};

class Dog {
private:
    Cat cat_;
};
```

This has the same recursive problem: `Dog` contains `Cat`, which contains `Dog`, and so on.

Use pointers or references together with **forward declarations** where appropriate:

```cpp
class Cat;

class Dog {
private:
    Cat* cat_;
};
```

**Initializing const and static members**

Modern C++ allows default member initializers inside a class:

```cpp
class Dog {
private:
    int age_ = 3;
    double weight_ = 12.5;
};
```

In older C++, an integral or enumeration `static const` member could have a constant initializer inside the class:

```cpp
class Dog {
private:
    static const int legs_ = 4;
};
```

An ordinary static data member generally needs an out-of-class definition:

```cpp
class Dog {
private:
    static int count_;
};

int Dog::count_ = 0;
```

A static data member has static storage duration and is associated with the class rather than each object. Traditionally, the class declaration and the storage-providing definition are separate. Since C++17, an `inline static` member can instead be defined in the class. A non-inline static const member may still need an out-of-class definition when odr-used.

#### The static Keyword

- **At namespace scope**, `static` gives a variable or function internal linkage. Its name does not identify the same entity from another translation unit; this is a linkage rule, not simply a change of lexical scope.
- **On a local variable**, `static` gives it static storage duration. Dynamic initialization happens when execution first reaches its declaration, and later calls retain its current value rather than repeat that initialization. A separate assignment statement still runs on each visit, so it can deliberately reset the value. Constant initialization may happen earlier.
- **On a data member**, `static` makes the member shared by the class's objects instead of storing a separate copy in each object. Ordinary members follow their containing object's storage duration, whether that object is automatic, dynamic, or static; a static member has its own static storage duration.
- **On a member function**, `static` removes the implicit `this` parameter. It can directly use static members, but needs an explicit object to access non-static members. Such functions can manage shared state or act as factories: make the constructor private, validate input in a static creation function, and return a new object only on success. A factory can report failure with `nullptr`, though production code should also express ownership clearly. Inaccessible constructors can prevent direct construction without making a class abstract. Static functions can also form a utility collection, although a namespace is often a more natural choice; `std` is a namespace, not a class, and namespaces can be extended across files.

### Member Functions Have an Implicit Current Object

Consider a simple `Car` class:

```cpp
class Car {
public:
    int speed;

    // 一个普通的成员函数，表面上看它只有 1 个参数 s
    void setSpeed(int s) {
        speed = s; 
    }
};

int main() {
    Car myCar;
    Car yourCar;

    myCar.setSpeed(100);  // 给 myCar 设置速度
    yourCar.setSpeed(120); // 给 yourCar 设置速度

    return 0;
}
```

One way to understand the implementation is to lower the object-oriented syntax into C-like procedural pseudocode.

Imagine an extra pointer parameter receiving the current object's address. The exact ABI is implementation-specific, but the idea looks like this:

```cpp
// 1. 函数定义被改写：增加了一个隐藏的 Car* const this 参数
void Car_setSpeed(Car* const this, int s) {
    this->speed = s; // 内部所有的成员变量访问，都被隐式地加上了 "this->"
}

int main() {
    Car myCar;
    Car yourCar;

    // 2. 函数调用被改写：自动把对象的地址作为第一个参数传进去
    Car_setSpeed(&myCar, 100);   // myCar.setSpeed(100) 的真面目
    Car_setSpeed(&yourCar, 120); // yourCar.setSpeed(120) 的真面目

    return 0;
}
```

This separates object state from the code operating on it:

- **Data members:** each object has its own state. `myCar` and `yourCar` store `speed` separately.
- **Member functions:** objects do not each contain a copy of the function's machine code. They use the same implementation, subject to compiler optimizations such as inlining.

If ten thousand `Car` objects use `setSpeed`, how does a call know which object's `speed` to change?

The **implicit `this` pointer** identifies the object for that call, allowing the function to locate the correct data.

This also explains the exception: **a static member function has no implicit current object**. Declaring `static void foo()` associates the function with the class without supplying `this`. It cannot directly access ordinary data members unless an object is explicitly available.

### Classes and Objects

A class describes a category of things; an object is a particular instance. Creating an object from a class is called **instantiation**.

An object can be declared directly in the current scope:

```cpp
Bottle b10(10, 10);
```

An ordinary local object has automatic storage duration, commonly described as being on the **stack**.

An object can also be dynamically allocated with `new`, commonly on the **heap**:

```cpp
Bottle* p = new Bottle(10, 10);
```

The dynamically allocated object is accessed through `p`. A raw allocation with `new` needs a matching `delete` when ownership is managed manually:

```cpp
delete p;
```

**Do not confuse composition with the class–instance relationship**

Distinguish an instance of a category from a component of a larger whole.

Examples of class–instance relationships:

- Student and Zhang San: Zhang San is an instance of Student.
- College and the College of Computer Science: the latter is an instance of College.
- Menu item and Exit: Exit can be a particular menu-item object.

Examples that instead describe composition:

- University and College of Computer Science: whole and part, rather than class and instance.
- Menu and Exit: a menu contains menu items; Exit is a menu item, not a menu.
- Bookstore and book: a bookstore contains books; a book is not an instance of Bookstore.

**Accessing an object**

Directly through an object:

```cpp
object.f(20);
```

Use the **dot operator**, `.`.

Through a reference:

```cpp
MyClass& ref = object;
ref.f(99);
```

A reference is an alias, so member access still uses `.`.

Through a pointer:

```cpp
MyClass* p = &object;
p->f(66);
```

Use the **arrow operator**, `->`.

#### Object Size

An instantiated object occupies storage. Its size depends mainly on **non-static data members**, not on the number of member functions.

Relevant factors commonly include:

- The number and types of non-static data members.
- Support for **virtual functions** and inheritance.
- **Alignment** requirements.

Factors that do not directly add per-object storage include:

- The number of **member functions**.
- The number and types of **static data members**.
- **Access-control labels**, such as `public` and `private`.

A few useful observations:

1. **Member functions are not stored inside every object.** Objects hold state; they do not need duplicate copies of the code implementing their behavior.
2. **Access control does not itself allocate storage.** `public`, `private`, and `protected` govern accessibility. They do not remove data members from an object, although exact layout guarantees depend on the class and language version.
3. **A complete empty-class object has nonzero size.** Even a class with no data members occupies storage when instantiated as a complete object:

   ```cpp
      class Empty {
      };

      Empty e;
   ```

   `sizeof(Empty)` is at least 1, and is commonly exactly 1.

   This allows distinct complete objects of that type, including array elements, to have distinct addresses.

   ```cpp
      Empty a[2];
   ```

   With zero-sized elements, `a[0]` and `a[1]` could have the same address. Empty base subobjects and certain overlapping members have separate rules.

4. **Virtual functions can affect object size.** A typical implementation stores a **virtual table pointer**, or `vptr`, in a polymorphic object:

   ```cpp
      class A {
      public:
          virtual void f();
      };
   ```

   This often adds a pointer-sized field, although the exact layout depends on the implementation and inheritance hierarchy.

5. **Alignment can add padding.** Object size is not necessarily the sum of its member sizes. Consider this member order:

   ```cpp
      char c_;
      int arr_[2];
   ```

   A `char` occupies one byte, but the following `int` array may require four-byte alignment. The compiler can insert unused bytes after the `char` to satisfy that requirement.

   Those extra bytes are called padding.

   Alignment is required by the platform's layout rules and often enables efficient memory access; padding may increase object size.

Consider this class:

```cpp
class A {
public:
    void f();
    int v1;

private:
    int g();
    int v2;
    char c;
    int arr[2];
    Person person;
    Car* pCar;
    Person& obj;
    static int num;
};
```

Its members can be classified as follows:

| Member | Contributes to each `A` object's storage? | Reason |
| ------------------ | ------------------------- | ---------------------------------------------------- |
| `void f()` | No | Function code is not copied into each object |
| `int g()` | No | A private member function is no different in this respect |
| `int v1`, `int v2` | Yes | Non-static data members |
| `char c` | Yes | A non-static data member that may also introduce padding |
| `int arr[2]` | Yes | The complete array is embedded in the object |
| `Person person` | Yes | A complete member object is embedded |
| `Car* pCar` | Yes | The pointer itself is a data member |
| `Person& obj` | Typically | Implementations usually store reference members using pointer-like storage; the standard does not prescribe its representation |
| `static int num` | No | The member belongs to the class, not to each object |

## Member Functions

A common arrangement defines the class in a header, **declares member functions inside the class**, and **defines them outside it**, separating interface from implementation.

```cpp
// Student.h
class Student {
public:
    Student();
    void study(int hours);
    void exercise();

private:
    int score_;
    int energy_;
};

// Student.cpp
#include "Student.h"

void Student::study(int hours) {
    score_ += hours;
    energy_ -= 2;
}

void Student::exercise() {
    energy_ += 3;
}
```

An out-of-class definition uses the **scope-resolution operator**, `::`:

```cpp
void Student::study(int hours) {
    score_ += hours;
}
```

`Student::study` identifies the definition as the `study` member of `Student`, rather than a free function.

A call to an ordinary non-static member function supplies an implicit **`this` pointer** to the current object.

```cpp
s1.study(4);
```

Conceptually, the call resembles:

```cpp
Student::study(&s1, 4);
```

Although the source shows only the explicit argument `4`, the call also has an object context.

Thus:

```cpp
void Student::study(int hours) {
    score_ += hours;
}
```

Can be understood as:

```cpp
void Student::study(int hours) {
    this->score_ += hours;
}
```

Usually `this->` can be omitted; an unqualified member name accesses the current object's member.

A member function can also call other members of its class directly:

```cpp
void Student::study(int hours) {
    score_ += hours;
    energy_ -= 2;
    exercise();
}
```

Here `exercise()` likewise means:

```cpp
this->exercise();
```

### The this Pointer

`this` points to the current object, so it is available in contexts with an implicit object, rather than in static member functions.

An ordinary member function has `this`:

```cpp
class Student {
public:
    void study(int hours);
};
```

A static member function does not:

```cpp
class Student {
public:
    static int count();
};
```

**Static data members** and **static member functions** belong to the class rather than a particular object. A static member function consequently has **no current object**.

A useful mental model is a pointer whose target cannot be changed by assignment. The following pseudocode illustrates that restriction; strictly speaking, `this` is a pointer prvalue, not a declared local const pointer:

```cpp
T* const this
```

Here `T` is the current class type.

For a member of `Student`, the model is:

```cpp
Student* const this
```

The intended point of the `const` in this model is that `this` cannot be reseated:

```cpp
this = other; // 错误：this 不能改指向
```

This does not make the current object const. A non-const member function can modify its data through `this`:

```cpp
this->score_ += 1;
```

**Context and lifetime:** inside a non-static member-function body, `this` refers to the object involved in that call.

```cpp
void Student::study(int hours) {
    this->score_ += hours; // 有效
}
```

A later member-function call has its own object context. Saving a copy of the pointer does not extend the object's lifetime.

**Syntax:** `this->` can be explicit or implicit.

These forms are equivalent:

```cpp
happiness_ += 5;
this->happiness_ += 5;
```

Usually the prefix can be omitted. If a parameter or local variable hides a member name, `this->` disambiguates it:

```cpp
class Student {
public:
    void setScore(int score) {
        this->score = score;
    }

private:
    int score;
};
```

When an operation involves the current object and another object, its explicit parameters normally describe only the other participants.

For example:

```cpp
class Hero {
public:
    void fight(Monster& monster);
};
```

Two objects participate in `fight`:

- The current `Hero`, represented by `this`.
- A `Monster`, represented by the `monster` parameter.

Call:

```cpp
hero.fight(monster);
```

Conceptually:

```cpp
Hero::fight(&hero, monster);
```

The current object is implicit, so it does not appear in the explicit parameter list.

**Returning `*this` by reference enables chaining**, much like chained stream operations with `std::cout` and `<<`.

A member function can return the current object through `*this`:

```cpp
class Hero {
public:
    Hero& fight(Monster& monster) {
        happiness_ += 5;
        return *this;
    }

private:
    int happiness_ = 0;
};
```

`this` is a pointer; dereferencing it yields the current object.

Returning a reference to `*this` is valid as long as that object remains alive while the caller uses the reference.

If `fight` returns `Hero&`:

```cpp
hero.fight(m1).fight(m1).fight(m2);
```

The chain does the following:

1. Have `hero` fight `m1`.
2. Return a reference to `hero`.
3. Have the same `hero` fight `m1` again.
4. Return the same `hero` again.
5. Have it fight `m2`.

This is **method chaining**.

If the function returns by value instead:

```cpp
Hero fight(Monster& monster) {
    happiness_ += 5;
    return *this;
}
```

The code may still compile, but it returns a copy of the current object.

```cpp
hero.fight(m1).fight(m1).fight(m2);
```

In that case:

- The first `fight(m1)` modifies the original `hero`.
- The return creates a temporary `Hero` copy.
- Subsequent `fight(m1)` and `fight(m2)` calls operate on copies, not on the original `hero`.

To make every call in the chain act on the same original object, normally return a reference:

```cpp
Hero& fight(Monster& monster);
```

### Out-of-Class and Inline Definitions

An **out-of-class definition** supplies the member-function body outside the class definition.

The header contains its declaration:

```cpp
// Car.h
class Car {
public:
    Car();
    void move();
    void brake();
};
```

The `.cpp` file contains its definition:

```cpp
// Car.cpp
#include "Car.h"

Car::Car() {
}

void Car::move() {
}

void Car::brake() {
}
```

`Car::move` uses the **scope-resolution operator** to associate `move` with `Car`.

An out-of-class definition can be compiled as an ordinary function call, though an optimizer may still inline it.

A non-inlined call conceptually involves:

- Saving a return address.
- Passing arguments.
- Supplying the implicit **`this` pointer**.
- Executing the function body.
- Returning to the call site.
- Performing any stack cleanup required by the ABI.

For a tiny, frequently called function, that overhead can be noticeable relative to the work it performs.

Avoiding such overhead is one motivation for inline expansion.

A common **inline definition** places the body directly in the class:

```cpp
class Car {
public:
    void move() {
        speed_++;
    }

private:
    int speed_ = 0;
};
```

In the traditional header-based model used here, this implicitly makes the function `inline`.

It can also be written explicitly:

```cpp
class Car {
public:
    inline void move() {
        speed_++;
    }

private:
    int speed_ = 0;
};
```

These two forms have the same inline status.

**`inline` does not force inline expansion.** Historically it suggests that expansion may be desirable:

> If appropriate, substitute the function body at the call site.

For example:

```cpp
car.move();
```

The compiler may substitute the body of `move` at the call site, eliminating the ordinary call sequence.

Potential benefits:

- Less call overhead.
- Better performance for small, frequently called functions.

Potential costs:

- A copy of the body may appear at each call site.
- The executable may become larger.
- Complex functions may not be expanded at all.

**The optimizer decides whether expansion actually happens.**

Even with this declaration:

```cpp
inline void f() {
    // ...
}
```

The compiler may keep an ordinary call.

Reasons to avoid expansion can include:

- A large function body.
- Complicated control flow.
- Recursion.
- The optimizer's overall size/performance trade-offs.

**Exam takeaway: `inline` is not an order to the optimizer. It does not guarantee expansion.** Its important language-level effect is allowing matching definitions in multiple translation units under the relevant ODR rules.

Putting `inline` on a declaration without making the definition available is insufficient for normal header-based use:

```cpp
class A {
public:
    inline void f(); // 只有声明，没有函数体
};
```

The compiler generally needs the body to expand a call, and an inline definition must be reachable in every translation unit where the function is odr-used.

A useful arrangement is:

```cpp
class A {
public:
    inline void f() {
        // 函数体
    }
};
```

Or:

```cpp
class A {
public:
    void f();
};

inline void A::f() {
    // 函数体
}
```

The key is to make the definition available, not merely attach `inline` to a declaration.

Inline definitions therefore normally live in headers, making the body available to each translation unit that needs it.

For example, in a **header**:

```cpp
// A.h
class A {
public:
    void f() {
        // 内联实现
    }
};
```

Or:

```cpp
// A.h
class A {
public:
    void f();
};

inline void A::f() {
    // 内联实现
}
```

Hiding the sole inline definition in a `.cpp` file while calling it from other translation units is not a valid substitute. Link-time optimization may inline ordinary functions across files, but that is a separate optimization mechanism.

Writing every member body inside the class is convenient, but it has trade-offs.

First, **code size may grow**.

When expansion actually occurs, multiple call sites may each contain a copy of the body.

Second, **header dependencies may increase**.

A body in a header exposes implementation details to every includer.

If it calls members of another class, that class generally needs to be completely defined, rather than merely **forward-declared**.

For example:

```cpp
class B;

class A {
public:
    void af(B& b) {
        b.bf(); // 这里需要知道 B 中确实有 bf
    }
};
```

`class B;` alone is insufficient: the compiler knows `B` is a class but does not know whether it has `bf()`.

If `A.h` needs `B.h` and vice versa, mutual dependencies can follow.

An out-of-class definition in a `.cpp` file reduces that coupling:

```cpp
// A.h
class B;

class A {
public:
    void af(B& b);
};
// A.cpp
#include "A.h"
#include "B.h"

void A::af(B& b) {
    b.bf();
}
```

Now `A.h` needs only the declaration of `B`; `A.cpp` includes its complete definition.

This reduces compile-time dependencies between headers and helps avoid circular inclusion.

As a practical guideline:

Consider an inline definition when:

- The body is very short.
- The logic is simple.
- Calls are frequent.
- It does not introduce complicated header dependencies.

Prefer an out-of-class definition when:

- The body is long.
- The logic is complex.
- It relies on other classes' implementation details.
- Defining it in the header would create mutual dependencies.
- Hiding implementation details is valuable.

A common engineering convention:

Simple getters, setters, and tiny functions can go inline. More involved logic or calls into other classes often belong in a `.cpp` file.

A simple getter/setter can be defined inside the class:

```cpp
class Student {
private:
    int age;

public:
    int getAge() {
        return age;
    }

    void setAge(int a) {
        age = a;
    }
};
```

A more involved function can be defined outside it:

```cpp
class Student {
private:
    int age;

public:
    void updateInfo();
};

void Student::updateInfo() {
    // 比较复杂的逻辑
}
```

### Access Control

C++ provides three access specifiers: `public`, `private`, and `protected`.

This is also a key difference between `struct` and `class`: members are public by default in a `struct` and private by default in a `class`.

Access labels may appear in any order:

```cpp
class A {
public:
    void f();

private:
    int x_;

public:
    void g();
};
```

Putting `private` before `public` is equally valid; the syntax imposes no fixed order.

Each label applies to the following members up to the next access label.

```cpp
class A {
public:
    void f(); // public

private:
    int x_;  // private
    void h(); // private
};
```

**public: accessible from outside the class**

Public members form the class's external interface.

```cpp
class Student {
public:
    void study();
};

int main() {
    Student s;
    s.study(); // 可以
}
```

Outside code can access them through an object.

In object-oriented design, the public section normally expresses the behavior a type offers its users.

**private: accessible to the class itself**

Ordinary outside code cannot directly access private members:

```cpp
class Student {
private:
    int score_;
    void otherFunc();
};

int main() {
    Student s;
    s.score_ = 100;   // 错误
    s.otherFunc();    // 错误
}
```

A member function of `Student` can access its class's private members:

```cpp
class Student {
public:
    void study() {
        score_ += 1;
        otherFunc();
    }

private:
    int score_ = 0;
    void otherFunc() {}
};
```

`study` has that access because it is a member of `Student`. Friends, discussed later, can also be granted access.

**Private access belongs to the class, not just the current object**

This is an easy point to miss on an exam.

`private` means **accessible within the class**, not **accessible only through the current object**.

A member function can therefore access the private members of another object of the same class.

```cpp
class Student {
public:
    void help(Student& other) {
        other.score_ += 1;   // 可以：other 也是 Student
        other.energy_ -= 2;  // 可以：同类对象的 private 成员
        other.otherFunc();   // 可以：同类对象的 private 成员函数
    }

private:
    int score_ = 0;
    int energy_ = 100;
    void otherFunc() {}
};
```

Although `other` is not the current object, it is still a `Student`. The access occurs inside a `Student` member function, so it is permitted.

The same function cannot access a `Course` object's private members without additional access, such as friendship:

```cpp
class Course {
public:
    int getDifficulty() const;

private:
    int terms() const;
    int difficulty_;
};

class Student {
public:
    void study(Course& course) {
        int d = course.getDifficulty(); // 可以：public
        int n = course.terms();         // 错误：Course 的 private
    }
};
```

Being a member of `Student` does not grant access to `Course` internals.

A common design is to **keep data members private and expose necessary operations through public member functions**.

```cpp
class Course {
public:
    int getDifficulty() const {
        return difficulty_;
    }

private:
    int difficulty_;
};
```

Outside code cannot directly change `difficulty_`; it reads the value through `getDifficulty()`.

Benefits include:

- Protecting the object's internal state.
- Preventing uncontrolled external changes.
- Allowing implementation details to evolve.
- Exposing a stable interface.

This is a foundation of **encapsulation**.

`protected` also permits access from derived-class contexts, subject to its access rules. It does not expose members to ordinary outside code. The **inheritance** section covers this in detail.

A member that is inaccessible in a particular context still exists as part of the class; access control does not remove it.

### Encapsulation and Information Hiding

**Classes provide a mechanism for encapsulation in C++.**

**Access control provides a mechanism for information hiding.**

Put simply:

- Encapsulation bundles related data and behavior into a unit.
- Information hiding keeps unnecessary implementation details out of the public interface.

**Encapsulation**:

A class commonly brings together:

- Data members.
- Member functions.
- A public interface.
- Internal implementation details.

Consider a book:

- Visible operations: read, turn pages, and query the title.
- Internal details: paper material, page organization, typesetting, or a digital storage representation.

A reader mainly wants to read the book, without needing to understand how its pages are manufactured or represented.

Encapsulation fits the way we understand things:

We usually treat something as a whole before investigating every internal detail.

For example, you can talk to a new classmate without knowing their entire life story. A shared way to communicate is enough.

Object-oriented interaction follows a similar pattern:

- An object exposes the features users need.
- Other code interacts with those features.
- Its internal details can remain hidden.

**Information hiding**:

Information hiding makes selected details unavailable to outside users of the encapsulated unit.

Those details can include:

- Data members.
- Member functions.
- Internal state.
- Implementation details.
- Helper algorithms.

In C++, `private` is commonly used for this:

```cpp
class Book {
public:
    void read();
    void turnTo(int page);

private:
    int currentPage_;
    int totalPages_;
};
```

Outside code uses the book through `read` and `turnTo`, rather than manipulating `currentPage_` directly.

**How the two concepts relate**:

Encapsulation bundles a unit; information hiding conceals its internal details.

The relationship is:

- Encapsulation provides the unit.
- Information hiding determines what is visible outside it.

Without information hiding, encapsulation may merely group things together. Hiding details lets callers depend on an interface instead of the implementation behind it.

**Separating use from implementation**:

One benefit is that using a component no longer requires knowing how it works internally.

For example, using a list:

```cpp
list.pushBack(2);
list.pushBack(3);
list.pushBack(1);
```

A caller needs to know that `pushBack` exists, without needing to know:

- Whether the list abstraction uses an array internally.
- Whether it uses nodes and pointers.
- How nodes are dynamically allocated.
- How many bytes each node occupies.

This separates use from implementation.

> The central idea:
> Callers depend on the operations an object provides, not on how those operations are implemented.

**Separating interface from implementation**:

Encapsulation also separates the **interface** from its implementation.

The interface describes what can be done:

```cpp
class Game {
public:
    void initialize();
    void run();
    void terminate();
};
```

The implementation describes how:

```cpp
void Game::run() {
    // 游戏主循环、渲染、输入、物理、AI 等细节
}
```

The main program may need only:

```cpp
int main() {
    Game game;
    game.initialize();
    game.run();
    game.terminate();
}
```

It need not know how the game loads assets, updates the display, or handles input.

This supports **programming to an interface**.

Once interface and implementation are separated, code can be designed around the interface.

Start by deciding what operations an object should offer, rather than immediately working out every internal step.

For example:

```cpp
game.initialize();
game.run();
game.terminate();
```

These operations describe a game's lifecycle. Whether `run()` implements a 2D or 3D game, online or offline, can be decided later.

This is useful for modeling: identify public behavior during analysis and defer implementation details.

It also encourages **software reuse**.

Encapsulation and information hiding support reusable software.

With a stable interface, an implementation can change without forcing extensive changes to its callers.

For example, the list interface can remain:

```cpp
list.pushBack(2);
list.pushBack(3);
```

An implementation might switch from linked nodes to a dynamic array while preserving the promised interface semantics. Any guarantees about iterator validity or complexity also need to be respected.

Reuse includes more than copying code:

- Reusing structures.
- Reusing design ideas.
- Reusing interfaces.
- Reusing modules.

**How classes and access control support these ideas**

In C++:

- **Classes** encapsulate data and behavior.
- **Public members** form the externally visible interface.
- **Private members** hide implementation details.
- **Access control** prevents ordinary outside code from directly relying on those details.

A typical structure:

```cpp
class List {
public:
    void pushBack(int value);
    int get(int index) const;

private:
    struct Node;
    Node* head_;
};
```

Callers know `pushBack` and `get`, without needing the internal layout of `Node`.

### Const Member Functions

A **const member function** has `const` after its parameter list.

```cpp
class MyClass {
public:
    int value() const;
};
```

It provides const access to the current object through `this`.

The key idea is:

> The trailing `const` makes the implicit **`this` pointer point to const**, restricting modification through it.

**Syntax**

An ordinary member function:

```cpp
int f();
```

A const member function:

```cpp
int f() const;
```

The qualifier goes after the parameter list, not before the return type.

```cpp
int getValue() const;
```

`getValue` is a member function that provides read-only access to the object's non-`mutable` state through `this`.

**Const and this**

For an ordinary member, the earlier non-reseatable-pointer model is:

```cpp
T* const this
```

For a const member, that model becomes:

```cpp
const T* const this
```

The difference is:

- A non-const member cannot reseat `this`, but can modify the object through it.
- A const member cannot reseat `this` or modify non-`mutable` members through it. Strictly, `this` has type `const T*`, rather than being a declared `const T* const` variable.

Thus an ordinary data member cannot be modified through `this` in a const member function:

```cpp
class MyClass {
public:
    int get() const {
        return value_; // 可以：读取
    }

    int bad() const {
        return ++value_; // 错误：修改当前对象
    }

private:
    int value_ = 0;
};
```

**Const members can read the object**

They can read data members:

```cpp
int MyClass::get() const {
    return value_;
}
```

They can also compute a result from those members:

```cpp
int MyClass::nextValue() const {
    return value_ + 1;
}
```

The restriction is on mutation through const access, not on computation.

**Const and overloading**

A member can have const and non-const overloads:

```cpp
class MyClass {
public:
    int f();
    int f() const;
};
```

These form an **overload pair** with different implicit object qualifications. Using the earlier conceptual pointer notation:

- Non-const version: `T* const this`.
- Const version: `const T* const this`.

That distinction lets the functions share a name and explicit parameter list.

**Calls on non-const objects**

A non-const object can call either kind of member function.

```cpp
MyClass obj;

obj.f();       // 如果有非 const 版本，优先匹配非 const 版本
obj.g();       // 普通成员函数可以调用
obj.value();   // 常成员函数也可以调用
```

For otherwise equivalent const and non-const overloads, the non-const object prefers the non-const overload.

**Calls on const objects**

A **const object** can call only const non-static members; static members are also available.

```cpp
const MyClass obj;

obj.value(); // 可以：value 是 const 成员函数
obj.g();     // 错误：g 不是 const 成员函数
```

Even if `g()` does nothing, a const object cannot call it unless its declaration has the required qualifier.

```cpp
class MyClass {
public:
    void g() {
        // 空函数体
    }
};

const MyClass obj;
obj.g(); // 错误：g 没有 const 修饰
```

The type system treats an unqualified non-static member function as potentially requiring mutable access to the object.

**Why mark read-only operations const?**

If a member function is intended to preserve the object's logical state, declare it const where appropriate.

```cpp
class Student {
public:
    int score() const {
        return score_;
    }

private:
    int score_;
};
```

This:

- Makes the interface's meaning clearer.
- Allows calls on const objects.
- Allows calls through const reference parameters.
- Helps catch accidental modifications.
- Makes code easier to read and debug.

**Omitting const limits where an operation can be used**

A read-only function without the qualifier can cause a problem:

```cpp
class A {
public:
    int f(); // 实际不修改对象，但没写 const
};

void use(const A& a) {
    a.f(); // 错误：const A 只能调用 const 成员函数
}
```

Otherwise reasonable calling code then fails to compile.

Prefer const member functions for operations intended to leave the object's logical state unchanged.

**Const access can arise through other interfaces**

Avoid assuming that there will be no const access just because you did not explicitly declare a const object locally.

It can arise from:

- Const variables.
- Const reference parameters.
- Temporaries bound to const references; temporaries are not inherently const.
- Casts or intermediate expressions that provide const access.
- Standard-library or third-party API requirements.

Without suitable const members, the class becomes unusable in many of these contexts.

### Instance Variables, Instance Methods, Class Variables, and Class Methods

**Instance variables: one set per object**

An **instance variable** is a data member belonging to a particular object.

For example, a student class:

```cpp
class Student {
public:
    int age;
    int score;
};
```

Create two objects:

```cpp
Student a;
Student b;

a.age = 18;
b.age = 20;
```

`a.age` and `b.age` are separate data members.

In other words:

- `a` has its own `age` and `score`.
- `b` has its own `age` and `score` too.
- Changing `a.age` does not automatically change `b.age`.

This per-object data is what the term instance variable describes.

**Instance constants: per-object values fixed after initialization**

An **instance constant** is a const data member within an object.

For example, a student's ID:

```cpp
class Student {
public:
    const int id;
    int score;
};
```

`id` belongs to a particular student, but cannot be changed after initialization.

The distinction is:

- `score` is an instance variable that can change with exams and assignments.
- `id` is an instance constant: it still belongs to an object, but remains fixed after initialization.

An instance constant differs from a class variable: each object still has its own copy; that copy is simply const.

**Instance methods: operations invoked on an object**

An **instance method** is an ordinary non-static member function.

```cpp
class Student {
public:
    void study();
    void exercise();
};
```

It describes behavior performed by a particular object.

For example:

```cpp
Student s;
s.study();
```

In `s.study()`, the function knows which object is current through the **`this` pointer**.

It can therefore directly access that object's instance variables:

```cpp
class Student {
public:
    void addScore(int value) {
        score += value;
    }

private:
    int score = 0;
};
```

`score += value` can be understood as:

```cpp
this->score += value;
```

**Class variables: one shared value for the class**

A **class variable** belongs to the class rather than to a particular object.

C++ expresses this with a **static data member**:

```cpp
class Student {
public:
    static int studentCount;
};
```

If all students in this model attend the same school, the school's name can be shared at class level rather than duplicated in every student object.

A class variable:

- Belongs to the class, rather than an individual object.
- Is shared by all its objects.
- Does not contribute to each object's ordinary storage size.
- Traditionally needs an out-of-class definition, unless a rule such as C++17 inline variables permits an in-class one.

For example:

```cpp
class Example {
public:
    int value;
    static int number;
};

int Example::number = 0;
```

Each `Example` has its own `value`; all `Example` objects share `number`.

**Static data members are not stored inside each object**

Consider:

```cpp
class Example {
public:
    int value;
    static int number;
};
```

An `Example` object's layout includes `value`, but not a separate copy of `number`.

That is because:

- `value` is a **non-static data member** belonging to the object.
- `number` is a **static data member** belonging to the class.
- No per-object storage is reserved for `number`.

This relates to the separate definition traditionally required for a static data member:

```cpp
int Example::number = 0;
```

`static int number;` inside the class is a declaration. A definition provides the storage for that member.

**Class methods: operations associated with the class**

A **class method** is commonly represented by a **static member function** in C++.

```cpp
class Example {
public:
    static int nextNumber();
};
```

A typical call is:

```cpp
Example::nextNumber();
```

This uses the **scope-resolution operator**, `::`.

Although `obj.nextNumber()` can also name an accessible static member, `Example::nextNumber()` better communicates that the operation belongs to the class, not to one object.

**Static member functions have no this pointer**

An ordinary member function has an implicit **`this` pointer**:

```cpp
void f() {
    value++;
}
```

Within it, `value++` can be understood as:

```cpp
this->value++;
```

A **static member function** has no implicit `this`.

It therefore cannot directly access an instance variable without an object:

```cpp
class Example {
public:
    static void f() {
        value++; // 错误：静态成员函数没有 this
    }

private:
    int value = 0;
};
```

Nor can it directly call an instance method without one:

```cpp
class Example {
public:
    void instanceMethod();

    static void classMethod() {
        instanceMethod(); // 错误：没有当前对象
    }
};
```

The reason is straightforward: a class method may be called when no object exists at all.

**What can a static member function access?**

It can directly access class variables and call other class methods.

```cpp
class Example {
public:
    static int nextNumber() {
        return ++number;
    }

private:
    static int number;
};

int Example::number = 0;
```

`nextNumber` can access `number` because neither requires an object context.

The direct-access rules are:

| Member | Direct access from a static member function? | Reason |
| -------- | ------------------------ | ------------------------------- |
| Instance variable | No | No `this` identifies the object |
| Instance method | No | Requires an object |
| Class variable | Yes | Class-level member |
| Class method | Yes | Class-level member |

**Const member functions and class variables**

A **const member function** restricts modification of the current object through `this`.

A class variable is not part of that object, so changing a mutable static variable is different from changing the object's instance data.

```cpp
class Example {
public:
    void f() const {
        ++number; // 可以理解为修改类级共享数据，不是修改 this 指向的对象内部数据
    }

private:
    static int number;
};
```

Constness here does not prohibit every change to program state; it restricts modification through the current object's const access path.

> **Common pitfall**
> Do not interpret “a const member cannot modify members” as “nothing declared in the class can change.” Ordinary non-`mutable` instance members are restricted through `this`; static members are separate from the current object.

**Comparison**

| Term | Usual C++ form | Belongs to | One per object? | Has this? |
| ------------ | ---------------------- | ---- | ---------------- | ----------- |
| **Instance variable** | Non-static data member | Object | Yes | N/A |
| **Instance constant** | Const non-static data member | Object | Yes | N/A |
| **Instance method** | Non-static member function | Object interface | N/A | Yes |
| **Class variable** | Static data member | Class | No | N/A |
| **Class method** | Static member function | Class | N/A | No |

### A Reasonable Card Design

**The card-back image can be a class variable** if all 52 cards in this model share the same back.

Functions that read or change that shared image can then be **class methods**.

**ID, suit, and rank can be instance constants**: each card has its own values, which should remain fixed.

**Width, height, and position can be instance variables**, changing with scaling, animation, or layout.

**Suit and rank suit enumeration types**, since both have finite sets of values. Prefer **scoped enums** where appropriate.

Instance methods that return suit and rank names should be **const member functions**.

Short suit/rank comparison functions are reasonable candidates for **inline definitions**.

A position setter changes the object and is non-const. Position getters, including a calculated bottom-right coordinate, can be const because they only read state.

Putting those decisions together gives this structure:

```cpp
class Card {
public:
    enum class Suit { Clubs, Diamonds, Hearts, Spades };    //花色枚举
    enum class Rank { Ace, Two, Three, Four, Five, Six, Seven,
                      Eight, Nine, Ten, Jack, Queen, King };    //面值枚举

    static int getBackImageId();    //背面图案是类变量，用类方法读取，静态成员函数
    static void setBackImageId(int id);    //背面图案是类变量，用类方法设置，静态成员函数

    const char* suitName() const;    //花色是实例常量，用常成员函数返回
    const char* rankName() const;    //面值是实例常量，用常成员函数返回

      //判断函数，通常很短，适合写成内联实现，且不改变当前对象，写成常成员函数
    bool hasSameSuit(const Card& other) const {
        return suit_ == other.suit_;
    }

    bool hasSameRank(const Card& other) const {
        return rank_ == other.rank_;
    }

    bool isSuit(Suit suit) const {
        return suit_ == suit;
    }

    bool isRank(Rank rank) const {
        return rank_ == rank;
    }

    void setPosition(int x, int y);    //设置坐标会改变当前对象，因此不是常成员函数
    Point position() const;    //获取坐标不改变当前对象，可以写成常成员函数
    Point rightBottom() const;    //获取右下角坐标也只是计算结果，不修改当前对象

private:
    static int backImageId_;    //背面图案共用且可变，类变量，静态数据成员，注意这里还要在类外定义

    const int id_;    //id唯一且不可变，实例常量
    const Suit suit_;    //花色唯一且不可变，实例常量，且有限，Suit枚举类型
    const Rank rank_;    //面值唯一且不可变，实例常量，且有限，Rank枚举类型

    int width_;    //宽度唯一且随缩放而改变，实例变量
    int height_;    //高度唯一且随缩放而改变，实例变量
    int x_;    //位置唯一且随缩放而改变，实例变量
    int y_;    //位置唯一且随缩放而改变，实例变量
};
```

This is not the only possible design, but it illustrates the reasoning behind the choices.

## Construction and Destruction

### User-Declared Constructors

A **constructor** is a special member function used when creating an object, primarily to initialize it.

A user-declared constructor is one explicitly declared by the programmer, who can also provide its implementation.

Basic properties:

- Its name matches the **class name**.
- It has no return type, not even `void`.
- Object initialization selects an applicable constructor using the supplied arguments.

```cpp
class Name {
public:
    Name();
    Name(int value);
    Name(int value1, int value2);
};
```

> Constructors can be overloaded, have access restrictions, and use default arguments. A constructor callable with one argument may participate in implicit conversion; use `explicit` when that conversion is undesirable.

**Purpose:** establish the object's required initial state as it is created.

For example:

```cpp
class Point {
public:
    Point(int x, int y);

private:
    int x_;
    int y_;
};
```

When creating an object:

```cpp
Point p(1, 2);
```

The arguments `(1, 2)` select the matching constructor.

**Constructors can be overloaded** using different parameter lists.

```cpp
class Name {
public:
    Name();          // 无参构造
    Name(int value); // 一个 int 参数
    Name(Address a); // 一个 Address 参数
};
```

Initialization selects the best matching overload:

```cpp
Name object1;        // 调用 Name()
Name object2(100);   // 调用 Name(int)
Address addr;
Name object3(addr);  // 调用 Name(Address)
```

This follows the usual principles of **overload resolution**.

**Constructors and implicit conversion:** a constructor callable with one argument can also define a conversion to the class type.

```cpp
class Name {
public:
    Name(int value);
};

void f(const Name& obj);

f(100); // 可能隐式调用 Name(100)，先把 int 转成 Name
```

Here `f` expects a `Name`, but the argument is `100`.

If `Name(int)` permits implicit conversion, the compiler can create a temporary `Name` for the call.

This is an implicit conversion through a **converting constructor**.

**Use explicit to prevent implicit conversion:**

```cpp
class Name {
public:
    explicit Name(int value);
};

void f(const Name& obj);

f(100);       // 错误：不能隐式把 int 转成 Name
f(Name(100)); // 可以：显式构造
```

`explicit` requires an appropriate explicit initialization rather than allowing the constructor to supply an implicit conversion.

> It does not prohibit constructing an object; it prevents the compiler from silently using that constructor for an implicit conversion.

**Constructors obey access control:** they can be `public`, `protected`, or `private`.

```cpp
class Name {
private:
    Name(int x, int y);
};

Name obj(1, 2); // 类外错误：私有构造函数不能直接访问
```

Ordinary outside code cannot directly call a private constructor.

Members of the class can still access it, as can friends.

**Private constructors** are useful for controlling how objects are created.

For example, creation can go through a class method:

```cpp
class Name {
public:
    static Name& create() {
        static Name object;
        return object;
    }

private:
    Name();
};
```

Here:

- `Name()` is private, so ordinary outside code cannot write `Name obj;`.
- `create()` is a **class method**, called as `Name::create()`.
- As a class member, it can access the private constructor.
- `object` is a **static local object**, initialized once and returned on subsequent calls.

This illustrates the **singleton pattern**: control creation so users share one instance. A complete singleton design also needs to control copying and moving as appropriate.

**Why make this factory static?** A non-static `create()` would require an object before it could be called:

```cpp
Name n;
n.create();
```

But outside code cannot first construct `Name n` through the private constructor. The entry point must be callable without an existing object:

```cpp
Name::create();
```

A **static member function** provides that entry point.

**Reference-returning and pointer-returning singleton forms:** one approach returns a reference to a static local object:

```cpp
static Name& create() {
    static Name object;
    return object;
}
```

Another stores the object address in a static pointer:

```cpp
class Name {
public:
    static Name* create() {
        if (object_ == nullptr) {
            object_ = new Name();
        }
        return object_;
    }

private:
    Name();
    static Name* object_;
};
```

The pointer form needs an explicit lifetime and cleanup policy, and a manual check-then-allocate implementation may also need synchronization. The main idea here is that a private constructor and a static function can control creation.

**Default arguments can make constructor calls ambiguous:**

```cpp
class Name {
public:
    Name();
    Name(int x);
    Name(int x, int y = 999);
};
```

These declarations can coexist, but a call can be **ambiguous**:

```cpp
Name obj(200);
```

Both `Name(int x)` and `Name(int x, int y = 999)` match, leaving no unique best candidate.

**Combining constructors with defaults:** if overloads differ only in the number of supplied arguments, one constructor with defaults may suffice:

```cpp
class Name {
public:
    Name(int x = 0, int y = 999);
};
```

Then:

```cpp
Name a;        // x = 0, y = 999
Name b(200);   // x = 200, y = 999
Name c(1, 2);  // x = 1, y = 2
```

One constructor covers zero, one, and two supplied arguments without competing overloads.

### Implicitly Declared Default Constructors

A **default constructor** is any constructor callable with no arguments. Under certain conditions, the compiler implicitly declares one with a form like:

```cpp
class A {
public:
    A();
};
```

This implicit declaration occurs when the class has no user-declared constructor or constructor template.

> Declaring any constructor suppresses that implicit default constructor, even if the declaration is private, takes arguments, or has no definition yet.

**When it is provided:** if a class declares no constructors:

```cpp
class A {
public:
    int value;
};
```

The compiler implicitly declares a default constructor. `A a;` can then work if that constructor is usable; some member or base configurations can cause it to be defined as deleted. This is determined during compilation, not created dynamically at runtime.

**A user-declared constructor suppresses it:**

```cpp
class A {
public:
    A(int value);
};
```

`A a;` is now invalid because no `A()` is supplied automatically.

**A private declaration still counts:**

```cpp
class A {
private:
    A();
};
```

There is no additional implicit default constructor, and ordinary outside code cannot call the private one.

**A declaration without a definition still counts as user-declared:**

```cpp
class A {
public:
    A(int value); // 只有声明，也算用户声明
};
```

The compiler does not add `A()`. If `A(int)` is used, its definition must also exist; otherwise a linker error may result.

Common cases:

| Class declarations | Implicit default constructor? | Is `A a;` usable? |
| -------------------- | ------------------------------ | ------------------------------ |
| No declared constructors | Yes | Usually, unless the constructor is deleted or otherwise unusable |
| `A(int)` declared | No | No, unless a usable default constructor is also declared |
| Private `A()` declared | No additional one | Not from ordinary outside code |
| Some constructor declared but not defined | No | Depends on whether a usable default constructor exists and is defined |

The basic rule: declare no constructors and one may be supplied; declare any constructor and the compiler stops supplying that implicit default constructor.

### Initializing Objects

Object creation establishes member state. This section compares assignment in the constructor body, default member initializers, and the separate rules for static data members.

> Base and member initialization happens before the constructor body runs. The complete object's construction is still in progress, but assigning in the body is not the same as initializing a member. In particular, it cannot initialize a const member by later assignment.

**Assignment in the constructor body:**

```cpp
class A {
public:
    A(int value) {
        x = 0;
        y = value;
    }

private:
    int x;
    int y;
};
```

By the time the body runs, member initialization has already been processed. `x = 0; y = value;` assigns to those members rather than directly initializing them.

**Const members cannot be initialized by body assignment:**

```cpp
class A {
public:
    A(int value) {
        x = value; // 错误
    }

private:
    const int x;
};
```

This is invalid: assigning `x = value` attempts to modify a const member after its initialization phase. Body assignment is not a universal replacement for initialization.

**Default member initializers:** since C++11, non-static data members can have initializers in the class definition.

```cpp
class Card {
private:
    int x_ = 5;
    int y_ = 6;
    double data_ = 0.1;
    const int id_ = 100;
};
```

An initializer is used when a constructor does not explicitly initialize that member another way. It can provide defaults for both ordinary and const data members.

**Static members follow different rules:** they do not belong to individual objects, so constructing an object does not allocate or initialize a fresh copy.

```cpp
class A {
private:
    static int count_; // 声明
};
```

The traditional form defines the member outside the class:

```cpp
int A::count_ = 0;
```

A non-inline definition in a shared header can create multiple-definition problems. Since C++17, `inline static` permits an in-class definition under the inline-variable rules.

**The special case of static integral constants:** older C++ already permitted certain static const integral or enumeration members to have in-class constant initializers.

```cpp
class Card {
public:
    static const int CardCount = 52;
};
```

Such members can be used as compile-time constants. This is a specific language rule, not a general exemption created by constant folding: an odr-use may still require a separate definition. Modern `constexpr` and inline static members provide additional options.

Comparison:

| Member | Part of each object? | Initialized with each object? | In-class initializer |
| ---------------- | ------------ | -------------------- | ------------------ |
| Ordinary instance variable | Yes | Yes | Common |
| Instance constant | Yes | Yes | Common |
| Ordinary static data member | No | No | Requires applicable rules, e.g. C++17 `inline static` |
| Static integral constant | No | Independent of objects | Permitted under the constant-initializer rules |

Three places to establish or adjust member state:

```cpp
class Card {
public:
    Card(int id, Player& player)
        : id_(id), player_(player), x_(0), y_(0) // 初始化列表
    {
        width_ = 100;  // 构造函数体内赋值
        height_ = 150;
    }

private:
    int x_ = 0;          // 类内初始值
    int y_ = 0;
    int width_;
    int height_;
    const int id_;
    Player& player_;
};
```

Their roles differ:

| Form | When it applies | Suitable uses |
| -------------- | ---------------------- | -------------------------------------------------------- |
| Default member initializer | Default during member initialization | Defaults for ordinary or const members |
| Constructor initializer list | Actual member initialization | Const members, references, member objects, and explicit constructor arguments |
| Assignment in the body | After member initialization | Later adjustment of assignable members |

> Const and reference members need proper initialization; assignment in the body cannot replace it.

### Constructor Initializer Lists

An **initializer list** follows the constructor's parameter list and precedes its body, in the form `: member1(args), member2(args), ...`. It initializes bases and members before the body executes.

```cpp
class Card {
public:
    Card(int aId, Player& aPlayer)
        : x(99), id(aId), player(aPlayer), desc(id)
    {
        y = 88;
    }

private:
    int x;
    int y;
    const int id;
    Player& player;
    Description desc;
};

class Description {
public:
    Description(int n);
};
```

**Which members require it?** Ordinary members can also be assigned later. Const members, references, and class-type members without a usable default constructor need an appropriate initializer. In the examples below this is supplied by the initializer list; a suitable default member initializer can also satisfy the requirement.

| Member type | Explicit initialization needed? | Reason |
| -------------------------- | -------------------- | -------------------------------------- |
| Ordinary assignable member | Optional, but usually preferable | Can be assigned in the body |
| Const data member | Yes, unless another valid initialization applies | Later assignment would modify const data |
| Reference member | Yes | Must bind during initialization |
| Class-type member with no default constructor | Yes | Default initialization cannot construct it |

`Description` has only `Description(int n)`, so `desc` needs an initializer such as `desc(id)` or `desc(aId)` when no default member initializer is available. Otherwise no `Description()` can be called.

**Initialization versus assignment:** the initializer list establishes a member directly. An `=` in the body acts afterward. Const and reference members need their initial value or binding established during initialization; they cannot wait for a later assignment.

**Members initialize in declaration order**, regardless of the written order in the constructor initializer list.

```cpp
class Card {
public:
    Card(int aId, Player& aPlayer)
        : desc(id), x(99), id(aId), player(aPlayer) // 书写顺序被打乱
    {
        y = 88;
    }

private:
    int x;           // 1
    int y;
    const int id;    // 3
    Player& player;
    Description desc; // 5
};
```

The explicitly initialized members follow `x → id → player → desc` in their declaration order; omitted `y` is also default-initialized at its declared position before the body, though a scalar may remain indeterminate until assigned there. Compilers often warn when initializer-list order differs from declaration order.

> The class's declaration order determines member initialization order, not the order of entries in the initializer list.

**The initialization process:** after base initialization, process non-static data members in declaration order:

1. Look for an explicit initializer for the member in the constructor initializer list.
2. If present, use it.
3. Otherwise, use a default member initializer if present; if none exists, default-initialize the member. For class types this selects a default constructor, while an ordinary scalar may be left without an initialized value.
4. If the required initialization is ill-formed—for example, `desc` has no usable default constructor—report an error.
5. Only after base and member initialization does the constructor body execute.

The body performs additional work after member initialization; it is not where member construction begins.

**`desc(id)` versus `desc(aId)`:** pay attention to declaration order when one member initializes another.

- `desc(aId)` uses the constructor parameter directly, so it does not depend on another member having been initialized.
- `desc(id)` uses the member `id`. This works here because `id` is declared **before** `desc` and is initialized from `aId` first.

Reordering the declarations so that `desc` comes first would make `desc(id)` read an uninitialized member. Always check declaration order when one member's initializer reads another.

The example uses **`desc(id)`** to illustrate this detail; **`desc(aId)`** is clearer when both are intended to use the same constructor argument.

Static members do not participate in an individual object's constructor initializer list. They have separate initialization, whether their definition is outside the class or uses a permitted inline form.

### Destructors

A **destructor** is a special member function that performs cleanup when an object is destroyed. Construction initializes an object; destruction releases its owned resources and tears down its state. The basic form is:

```cpp
class A {
public:
    ~A();
};
```

> A destructor's name is the class name prefixed by `~`. It has no return type or parameters and, in the ordinary classes discussed here, cannot be overloaded. If none is declared, the compiler implicitly declares one.

**Syntax:** a constructor is written `A();`, and a destructor `~A();`. Neither has a return type.

**No parameters:**

```cpp
class A {
public:
    ~A(int value); // 错误
};
```

Destruction acts on the current object and does not take extra caller-supplied arguments. Destructors do not form parameter-based overload sets like constructors.

**No return value:**

```cpp
class A {
public:
    ~A();      // 正确
    void ~A(); // 错误
};
```

Its job is cleanup, not producing a result value.

**No const qualifier:**

```cpp
class A {
public:
    ~A() const; // 错误
};
```

The language does not permit a trailing `const` on a destructor or constructor. These functions manage construction and destruction rather than ordinary operations on an already-live object's const interface. Const objects can still be constructed and destroyed normally.

**Both constructors and destructors have this**, allowing access to the current object's members:

```cpp
class A {
public:
    A() {
        value_ = 0;
    }

    ~A() {
        value_ = 0;
    }

private:
    int value_;
};
```

Remember their different contexts: one runs during construction, the other during destruction.

**Implicit destructor:** if no destructor is declared, the compiler supplies one that follows the language's member and base destruction rules.

```cpp
class Card {
private:
    int x_;
    int y_;
    int id_;
    Player& player_;
    SomeObject object_;
};
```

An `int` needs no special cleanup. A reference member does not destroy its referent. A class-type member such as `object_` has its own destructor invoked automatically. Many classes therefore need no handwritten destructor.

**When to provide one:** a class directly owning dynamic memory, file handles, network connections, locks, or similar resources may need custom cleanup. Destruction-time logging or unregistering can also require it. Prefer resource-owning member types where possible so cleanup happens automatically; later sections discuss ownership in more detail.

**Destroying member objects:**

```cpp
class A {
private:
    B b_;
};
```

Destroying an `A` automatically invokes `B`'s destructor for `b_`. An implicit destructor is therefore not necessarily an empty operation.

**Destruction performs final cleanup:** conceptually, storage is obtained, the object is initialized, it is used, and destruction cleans it up before its storage is released or reused. Consider:

```cpp
class Card {
public:
    ~Card();

private:
    int x;
    int y;
    const int id;
    Player& player;
    Description desc;
};
```

Ordinary `int` and `const int` members need no special cleanup, and a reference member does not own its referent. The member object `desc` is destroyed automatically. Directly owned resources may require explicit cleanup. Destructors are commonly public, though some inheritance designs use protected destructors.

### Access to Constructors and Destructors

The key questions are when constructors and destructors run, whether they are accessible, and in what order member objects are constructed and destroyed.

> Members construct in declaration order and are destroyed in reverse order. Automatic local objects are destroyed on scope exit. Objects allocated with ordinary `new` need corresponding ownership cleanup, commonly `delete` or a smart pointer that performs it.

**Constructor calls** arise from explicit object creation, converting constructions, initialization of member objects and static objects, and dynamic allocation with `new`.

**Explicit object creation:**

```cpp
A a0;
A a1(5);
```

The supplied arguments select a constructor.

**Implicit construction:** a converting constructor can create a temporary automatically:

```cpp
class B {
public:
    B(int value);
};

void f(B b);

f(2); // 可能隐式构造 B(2)
```

Making it **explicit** prevents `f(2)` from implicitly converting `2` to `B`.

**Constructing member objects:** if `A` contains members of type `B`:

```cpp
class A {
private:
    int number_;
    B b1_;
    B b2_;
};
```

Creating `A` must also construct `b1_` and `b2_`. Its **constructor initializer list** specifies how:

```cpp
A::A()
    : number_(0),
      b2_(2)
{
}
```

A member omitted from the list uses its default member initializer if present; otherwise it is default-initialized.

**Declaration order controls construction.** For this `A`, the order is `number_ → b1_ → b2_`, even if the initializer list is written differently:

```cpp
A::A() : b2_(2), number_(0) {}
```

The actual order remains the declaration order.

> Reordering initializer-list entries does not reorder member construction.

**Members initialize before the constructor body.** Explicit initializers or the applicable default rules establish them in declaration order. Only then does the body run, so assignments in the body are later operations rather than member initialization.

**Destructor calls:** the object's storage duration and ownership determine when destruction happens.

| Object storage duration | Usual destruction point | Automatic? |
| ----------------------- | ---------------------- | ------------ |
| Static storage duration | Normal program termination | Yes, for constructed objects requiring destruction |
| Automatic storage duration | Scope exit, including ordinary stack unwinding | Yes |
| Dynamic storage duration | Appropriate ownership cleanup, such as `delete` | Requires explicit ownership management or an RAII owner |

**Automatic local objects are destroyed on scope exit:**

```cpp
void f() {
    A a1;
    A a2(5);
} // 离开作用域，a2、a1 自动析构
```

Locals are normally destroyed in reverse order of completed construction: last constructed, first destroyed.

**Dynamically allocated objects need cleanup:**

```cpp
A* pa = new A(5);
delete pa;
```

`new A(5)` obtains storage, constructs `A`, and returns its address. `delete pa` destroys that object and releases its storage. If `pa` is an ordinary local variable, the pointer itself has automatic storage duration; the object it points to is dynamically allocated.

**Construction and destruction both require appropriate access.** Constructor access controls creation; destructor access controls destruction. Private constructors or destructors can therefore restrict how objects are managed:

| Expression or declaration | Required access |
| --------------- | ----------------------------------------------- |
| `A a;` | Constructor and destructor for scope-exit cleanup |
| `A* p = new A;` | Constructor for this single-object allocation |
| `delete p;` | Destructor |
| Member object `B b;` | The containing class must be able to construct and destroy `B` |

**Destruction reverses construction.** An `A` initializes `number_`, then constructs `b1_`, then `b2_`, then runs its constructor body. Destruction runs `A`'s destructor body first, followed by `b2_` and then `b1_`; the ordinary integer needs no special destruction.

**Static member objects:**

```cpp
class A {
private:
    static B globalB_;
};

B A::globalB_(200);
```

`globalB_` is a **static data member**, traditionally defined and initialized outside the class. It does not belong to any individual `A`, and is destroyed at normal program termination if it was constructed.
