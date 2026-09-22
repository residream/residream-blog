---
title: "OOP复(yù)习(xí)笔记（二）：类、对象与生命周期"
description: "OOP 复习笔记第二篇，整理类与对象、前置声明、成员函数、this 指针、访问控制、封装、静态成员、构造与析构及对象生命周期。"
publishDate: "2026-06-03T23:08:17"
tags:
  - "c-cpp"
heroImage: { src: './pain.jpg', color: '#66A4B7' }
language: '简中'
draft: false
---

## 类和对象

### 类成员的书写顺序

C++ 语法并不强制要求先写函数再写数据，也不强制要求先写 `public` 再写 `private`。

但 C++ 中常见习惯是：

1. 把对外可见的 `public` 行为放在前面。
2. 把内部使用的 `private` 数据放在后面。

原因是读代码的人通常更关心一个类对外能做什么，而不是它内部怎么存。

### 类定义通常放在头文件

因为其他 `.cpp` 文件要使用这个类，就需要知道类的声明和定义结构。

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

而类定义放在头文件时，必须注意**包含警戒**，否则同一个翻译单元中多次包含同一个头文件，可能导致类重复定义，违反**单一定义规则**。

### 前置声明

```cpp
class Cat;

class Dog {
public:
    void fight(Cat& cat);
};
```

这里 `class Cat;` 并没有给出 `Cat` 的完整定义，只告诉编译器 `Cat` 是一个类名。这样编译器在看到 `Cat&` 时就能识别它。

这样可以**解决循环定义**的问题，例如如果 `Dog.h` 包含 `Cat.h`，同时 `Cat.h` 又包含 `Dog.h`，就会形成循环包含：

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

这时编译器就会陷入死循环（或者报错找不到定义），因为它不知道到底该先编译哪一个。

前置声明在这里就是更好的方式了：

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

这样两个头文件可以独立存在，避免相互 `#include` 导致循环定义。

此外前置声明还有一个重要作用，即**降低文件之间的编译期依赖**：

如果 `Dog.h` 直接包含 `Bone.h`：

```cpp
//Dog.h
#include "Bone.h"

class Dog {
public:
    void eat(Bone& bone);
};
```

那么任何包含 `Dog.h` 的 `.cpp` 文件，都会间接依赖 `Bone.h`。只要 `Bone.h` 改动，所有直接或间接包含它的文件都必须**重新编译**，这在包含几百万行代码的工程中会导致灾难性的编译时间（也就是所谓的“编译级联依赖”）

如果改成前置声明：

```cpp
class Bone;

class Dog {
public:
    void eat(Bone& bone);
};
```

那么 `Dog.h` 不再依赖 `Bone.h` 的完整定义。`Bone.h` 的普通改动不会无谓触发大量重新编译。

不过前置声明也有使用边界，其只能在“不需要知道完整类定义”的场景使用，例如：

- 声明指针：`Cat*`
- 声明引用：`Cat&`
- 声明函数参数或返回类型

如果要按值保存对象，就需要完整定义，因为编译器必须知道对象大小：

```cpp
class Cat;

class Dog {
private:
    Cat cat_; // 通常不行：编译器不知道 Cat 的大小
};
```

这时就需要包含 `Cat.h`。

### 类的成员

**引用成员表示必须绑定对象**

如果一个类中有引用成员，表示这个成员必须绑定到一个真实对象。

```cpp
class Person {
};

class Dog {
private:
    Person& owner_;
};
```

`owner_` 是引用成员，意味着每个 `Dog` 对象都必须有一个主人对象与之对应。引用不能为 `nullptr`，所以语义上比指针更强。

**类不能按值包含自身类型成员**，即类中不能直接定义一个同类型的对象成员：

```cpp
class Dog {
private:
    Dog part_; // 错误
};
```

原因是对象大小会无限递归：

- 一个 `Dog` 中包含一个 `Dog part_`
- `part_` 中又包含一个 `Dog part_`
- 如此无限下去，编译器无法确定 `Dog` 对象大小

这种情况属于递归式的对象包含，不能成立。

但**类可以包含自身类型的指针或引用**

虽然不能按值包含自身对象，但可以包含自身类型的指针或引用：

```cpp
class Dog {
private:
    Dog* next_;
    Dog& friendDog_;
};
```

指针成员本身只占一个指针大小，不需要把另一个完整 `Dog` 对象嵌入进来，所以不会导致无限递归。

引用成员在底层实现上通常也按类似指针处理，因此也不会导致对象大小无限递归。

**不同类之间也要避免递归对象包含**

如果两个类互相按值包含，也会出问题：

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

这同样会导致无限递归：`Dog` 里有 `Cat`，`Cat` 里又有 `Dog`。

解决思路通常是改用指针或引用，并结合**前置声明**：

```cpp
class Cat;

class Dog {
private:
    Cat* cat_;
};
```

**const 成员与静态成员的初始化**

现代 C++ 允许在类内对某些数据成员给出默认初始值：

```cpp
class Dog {
private:
    int age_ = 3;
    double weight_ = 12.5;
};
```

对于 `static` 成员，早期 C++ 中只有“静态常量整型成员”比较适合在类内初始化：

```cpp
class Dog {
private:
    static const int legs_ = 4;
};
```

普通静态数据成员通常需要在类外定义：

```cpp
class Dog {
private:
    static int count_;
};

int Dog::count_ = 0;
```

因为static关键字下的数据直接存储在全局/静态区，因此这个数据应当是属于这个类的，这个类所产生的每个对象都能访问他，所以需要类内声明的同时在类外定义

#### static关键字

- 全局变量或全局函数前的static： 他会限制变量或函数的作用域，使其仅在定义他们的文件中可见，即具有内部链接属性
- 函数内局部变量前的static： 因为常规情况下，局部变量分配在栈上，函数开始执行时，变量诞生，函数结束时，变量销毁，而对于加上了static关键字的局部变量，其存储位置有栈转为了全局/静态区，并且只在首次执行到变量定义语句时初始化，之后保持其值不变，例如，当程序第一次执行这个函数，见到了这个static变量的赋值，会在全局数据区给他分配内存，即完成首次初始化，第二次及以后若再执行这个函数，看到了static变量的赋值，则直接跳过了，但若是改为static仅定义，后赋值的操作，则赋值操作在函数中为普通的执行语句，失去了记忆性，其可以用来设计重置接口
- 类内部的成员变量前的static： 常规情况下类的成员变量跟着对象走，存储位置取决于对象创建在了哪里，只能是普通创建时放在栈区或者使用new时创建在堆区，但加了static后，成员变量存储在了全局/静态区，显然其也就不属于了某一个特定的对象私有的一份，而是所有该类的对象共享的一个静态变量，属于整个类而非某具体对象，内存也由各个对象各一处节省到了唯一一处
- 类内部的成员函数前的static： 成员函数加了static后为静态函数，其完全没有了隐含的this指针，也就根本无法定位到自己所在的对象，只能访问类的静态成员变量和其他静态函数，无法调用类的非静态成员函数，连非常函数也不可，因为其也有this指针，若调用，则静态函数根本无法提供这么个this指针，其可以用来设计成管理全局状态的数据，也可以先将构造函数放在private下，再用static自己设计一个静态函数，其返回指向new的堆区对象的指针，这样再在函数体内先检验输入数据，若不通过则return nullptr，通过再返回的同时new一个用构造函数创建的对象，这样能优雅的在创建失败时报错，充当创建对象的安检通道，也引出了当构造函数不存在或在private下时，无法直接通过构造函数实例化对象，这一特性并不是抽象类独有的，其次其还可以设计为一个类工具箱，里面存放的都是函数，只提供服务，类似于std，但注意std实际上是命名空间而非类，因为命名空间可以夸文件而工具类不行，这里引出只是为了方便理解其用途

### 成员函数隐含当前对象

假设我们有一个简单的 `Car` 类：

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

当代码被编译时，C++ 编译器会把面向对象的语法“降级”成类似 C 语言的面向过程语法。

编译器会在成员函数的参数列表**最前面**加了一个隐藏的指针参数，用来接收当前对象的地址。上面的代码在编译器眼中其实是这样的（伪代码）：

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

这样设计其实是出于**节省内存**的极致考量：

- **成员变量**：每个对象都有一份独立的拷贝。`myCar` 和 `yourCar` 在内存中有各自独立的空间来存储 `speed`。
- **成员函数**：代码逻辑是一模一样的！为了节省内存，**类的所有成员函数在内存的代码段中只存了一份**，所有对象共享这一段函数代码。

既然一万个 `Car` 对象共享同一个 `setSpeed` 函数，当这个函数被调用时，它怎么知道究竟该去修改哪一个对象的 `speed` 变量呢？

答案就是**隐含传入的 `this` 指针**。谁调用这个函数，编译器就把谁的地址传进去，函数顺着这个地址，就能精准地找到对应对象的数据。

由于普通成员函数必须依赖这个隐含的当前对象（`this` 指针）才能运行，这就引出了一个重要的特例：**静态成员函数没有隐含的当前对象。**这也是我们前文在static关键字处提及的，如果你把函数声明为 `static void foo()`，它属于整个类，而不是某个具体对象，编译器**不会**给它传递隐藏的 `this` 指针，因此，静态成员函数内部绝对无法直接访问普通的成员变量，因为它根本不知道这些变量属于哪个对象。

### 类和对象

类描述一类事物，对象是这一类事物中的具体个体，从类创建对象，称为**对象实例化**。

对象可以直接创建在当前作用域中：

```cpp
Bottle b10(10, 10);
```

这种对象通常具有自动存储期，常说是在**栈区**创建。

也可以用 `new` 在**堆区**创建：

```cpp
Bottle* p = new Bottle(10, 10);
```

这时对象本身没有普通对象名，调用者通过指针 `p` 访问它。用 `new` 创建的对象需要配合 `delete` 释放：

```cpp
delete p;
```

**不要把组成关系误认为类和对象的关系**

判断“类和对象”关系时，要区分“某类的一个实例”和“整体的组成部分”。

正确例子：

- 学生 与 张三：张三是学生类的对象。
- 学院 与 计算机学院：计算机学院是学院类的对象。
- 菜单项 与 “退出”：退出可以是一个菜单项对象。

容易误判的例子：

- 学校 与 计算机学院：更像整体与组成部分，不是类与对象。
- 菜单 与 “退出”：菜单包含菜单项，“退出”不是菜单对象，而是菜单项对象。
- 书店 与 图书：书店包含图书，不是类与对象关系。

**对象访问形式**

直接通过对象访问

```cpp
object.f(20);
```

使用**点运算符** `.`。

通过引用访问

```cpp
MyClass& ref = object;
ref.f(99);
```

引用是对象的别名，访问形式仍然使用 `.`。

通过指针访问

```cpp
MyClass* p = &object;
p->f(66);
```

通过指针访问成员时使用**箭头运算符** `->`。

#### 对象的存储大小

对象实例化后会占据存储空间。对象大小主要由**非静态数据成员**决定，而不是由成员函数数量决定。

对象大小通常与这些因素有关：

- 非静态数据成员的个数和类型
- 是否有**虚函数**
- **字节对齐**方式

通常与这些因素无关：

- **成员函数**个数
- **静态数据成员**个数和类型
- `public` / `private` 等**访问控制**

其中有意思的就是：

1. 成员函数不计入每个对象大小 因为对象保存状态，函数代码属于类的公共行为实现；每个对象不需要重复保存同样的函数代码。
2. 访问控制不影响对象大小 `public`、`private`、`protected` 只是控制访问权限，不改变数据成员是否属于对象。
3. 空类对象大小不为 0 即使类中没有任何数据成员，对象大小也不能是 0：

   ```cpp
      class Empty {
      };

      Empty e;
   ```

   通常 `sizeof(Empty)` 至少为 1。

   原因是：C++ 需要通过对象地址区分不同对象。

   ```cpp
      Empty a[2];
   ```

   如果每个 `Empty` 对象大小为 0，则 `a[0]` 和 `a[1]` 可能拥有相同地址，这会破坏“不同对象应有不同地址”的基本要求。

4. 虚函数会影响对象大小 如果类中有**虚函数**，对象中通常会额外保存一个**虚函数表指针**，即 `vptr`。

   ```cpp
      class A {
      public:
          virtual void f();
      };
   ```

   当类含有虚函数时，对象大小通常会增加一个指针大小，用来支持运行时多态。

5. 字节对齐会影响对象大小 对象大小不仅是成员大小简单相加，还可能受**字节对齐**影响。 例如成员顺序中出现：

   ```cpp
      char c_;
      int arr_[2];
   ```

   `char` 只占 1 字节，但后面的 `int` 数组可能要求按 4 字节边界存放。编译器可能在 `char` 后面填充若干无用字节，让后面的成员对齐。

   这种填充称为 padding。

   字节对齐的目的通常是提高读取速度，但会增加对象大小。

例如以下类：

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

判断时可以做标记区分：

| 成员               | 是否影响每个 `A` 对象大小 | 原因                                                 |
| ------------------ | ------------------------- | ---------------------------------------------------- |
| `void f()`         | 否                        | 成员函数代码不复制进每个对象                         |
| `int g()`          | 否                        | `private` 成员函数也不进对象                         |
| `int v1`, `int v2` | 是                        | 非静态数据成员                                       |
| `char c`           | 是                        | 非静态数据成员，还可能引发对齐填充                   |
| `int arr[2]`       | 是                        | 数组作为成员整体嵌入对象                             |
| `Person person`    | 是                        | 成员对象完整嵌入                                     |
| `Car* pCar`        | 是                        | 指针本身是数据成员                                   |
| `Person& obj`      | 是                        | 引用变量，底层是常量指针，会占用与指针完全一样的空间 |
| `static int num`   | 否                        | 静态数据成员属于类，不属于单个对象                   |

## 成员函数

一般是类定义在头文件中，同时成员函数在**类内声明**、**类外实现**，这样可以把“接口声明”和“实现细节”分开。

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

而在类外实现成员函数时，通常要用到**作用域解析符** `::` ，例如：

```cpp
void Student::study(int hours) {
    score_ += hours;
}
```

`Student::study` 表示：这里实现的是 `Student` 类中的 `study` 成员函数，而不是一个普通全局函数。

同时普通成员函数调用时，C++ 会隐含传入一个**this指针**，它指向当前对象。

```cpp
s1.study(4);
```

可以理解为底层类似：

```cpp
Student::study(&s1, 4);
```

即虽然源代码中只写了一个显式参数 `4`，但实际还隐含传入了当前对象地址。

因此：

```cpp
void Student::study(int hours) {
    score_ += hours;
}
```

可以理解为：

```cpp
void Student::study(int hours) {
    this->score_ += hours;
}
```

平时 `this->` 可以省略；省略后默认访问当前对象。

成员函数内部也可以直接调用同类的其他成员函数：

```cpp
void Student::study(int hours) {
    score_ += hours;
    energy_ -= 2;
    exercise();
}
```

这里的 `exercise()` 也默认是：

```cpp
this->exercise();
```

### this指针

`this` 指向当前对象，因此只有存在“当前对象”的成员函数才有 `this`。

普通成员函数有 `this`：

```cpp
class Student {
public:
    void study(int hours);
};
```

静态成员函数没有 `this`：

```cpp
class Student {
public:
    static int count();
};
```

因为**静态数据成员**和**静态成员函数**属于类，不属于某一个对象，所以静态成员函数中**没有当前对象**。

在普通成员函数中，`this` 可以理解为一个指向当前类对象的常量指针：

```cpp
T* const this
```

其中 `T` 是当前类类型。

例如在 `Student` 的成员函数中：

```cpp
Student* const this
```

这里的 `const` 修饰的是指针本身，表示 `this` 不能改指向：

```cpp
this = other; // 错误：this 不能改指向
```

但这不代表当前对象一定不可修改。普通成员函数中仍可以通过 `this` 修改当前对象的数据成员：

```cpp
this->score_ += 1;
```

**作用域和生存周期**：`this` 只在当前非静态成员函数的函数体内有效。

```cpp
void Student::study(int hours) {
    this->score_ += hours; // 有效
}
```

离开这个函数体后，这次调用对应的 `this` 就不再存在。下次调用成员函数时，编译器会根据新的调用对象重新提供一个 `this`。

**写法**：可显式写，也可省略

下面两种写法等价：

```cpp
happiness_ += 5;
this->happiness_ += 5;
```

一般情况下可以省略 `this->`。当形参或局部变量与成员同名时，显式写 `this->` 可以消除歧义：

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

当当前对象与其他对象共同参与行为，成员函数的参数列表中通常只写“除当前对象以外的参与者”。

例如：

```cpp
class Hero {
public:
    void fight(Monster& monster);
};
```

`fight` 行为由两个对象参与：

- 当前 `Hero` 对象：由 `this` 表示
- 一个 `Monster` 对象：由参数 `monster` 表示

调用：

```cpp
hero.fight(monster);
```

可以理解为：

```cpp
Hero::fight(&hero, monster);
```

当前对象不需要写进显式参数列表，因为它由 `this` 隐含提供。

**`return *this`** 实现了链式调用，就类似 `std::cin << "一" << "二" << std::endl` 的效果

如果成员函数希望返回当前对象本身，可以返回 `*this`。

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

`this` 是指针，`*this` 就是当前对象本身。

因为当前对象在函数结束后仍然存在，所以返回 `*this` 的引用是合法的。

而如果 `fight` 返回 `Hero&`：

```cpp
hero.fight(m1).fight(m1).fight(m2);
```

含义是：

1. `hero` 打一次 `m1`
2. 返回 `hero` 本身的引用
3. 继续让同一个 `hero` 再打一次 `m1`
4. 再返回同一个 `hero`
5. 继续打 `m2`

即**链式调用**。

但是如果写成按值返回：

```cpp
Hero fight(Monster& monster) {
    happiness_ += 5;
    return *this;
}
```

语法上也可能通过，但返回的是当前对象的副本。

```cpp
hero.fight(m1).fight(m1).fight(m2);
```

这时：

- 第一次 `fight(m1)` 修改原来的 `hero`
- 返回一个新的临时 `Hero` 副本
- 后续 `fight(m1)`、`fight(m2)` 操作的是副本，不再是原来的 `hero`

因此，如果希望连续调用都作用在同一个原对象上，通常应返回引用：

```cpp
Hero& fight(Monster& monster);
```

### 外联实现和内联实现

**外联实现**即在类定义外部给出成员函数的函数体。

头文件中只写声明：

```cpp
// Car.h
class Car {
public:
    Car();
    void move();
    void brake();
};
```

`.cpp` 文件中写实现：

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

这里 `Car::move` 使用**作用域解析符**，表示这是 `Car` 类中的 `move` 成员函数。

**执行特点**为外联实现通常按普通函数调用执行。

调用成员函数时，需要：

- 保存返回地址
- 传递参数
- 隐含传入**this指针**
- 进入函数体执行
- 函数结束后返回调用点
- 进行必要的栈清理

如果函数体很小，又被频繁调用，函数调用本身的开销可能显得偏大。

这也是引入内联机制的原因之一。

**内联实现**的常见写法是在类定义中直接给出函数体：

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

这种写法本质上隐含了 `inline`。

也可以显式写：

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

这两种写法在本质上没有区别。

**inline**的意思不是“强制内联”，而是向编译器提出建议：

> 如果合适，请在调用点直接展开函数体。

例如：

```cpp
car.move();
```

如果编译器决定内联，可能把 `move` 的函数体直接插入调用点，从而省掉函数调用过程。

优点：

- 减少函数调用开销
- 小函数频繁调用时可能更快

缺点：

- 每个调用点都可能复制一份函数体
- 可执行文件体积可能增大
- 代码复杂时不一定能真正内联

**要注意是否真正内联由编译器决定。**

即使写了：

```cpp
inline void f() {
    // ...
}
```

编译器也可能不展开。

常见不适合内联的情况包括：

- 函数体很大
- 函数逻辑复杂
- 递归函数
- 编译器基于优化策略认为不适合展开

**考点为 `inline` 不是命令，而是建议。写了 `inline` 不保证一定内联。**

只在函数声明前写 `inline`，但不给出函数体，意义不大：

```cpp
class A {
public:
    inline void f(); // 只有声明，没有函数体
};
```

因为编译器想在调用点展开函数体时，必须看见函数体内容。

有意义的是：

```cpp
class A {
public:
    inline void f() {
        // 函数体
    }
};
```

或：

```cpp
class A {
public:
    void f();
};

inline void A::f() {
    // 函数体
}
```

关键是：`inline` 要和函数定义一起出现，编译器才有机会看到要展开的代码。

且内联函数通常放在头文件，如果某个函数要内联，编译器在每个调用它的 翻译单元 中都需要看到函数体。

因此内联函数通常放在**头文件**中：

```cpp
// A.h
class A {
public:
    void f() {
        // 内联实现
    }
};
```

或者：

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

如果只把内联函数体放在某个 `.cpp` 文件中，其他 `.cpp` 文件调用它时看不到函数体，就无法在调用点展开。

不能都写成内联的原因在于把所有成员函数都写在类定义中，看起来方便，但会带来问题。

问题一：**代码体积可能增大**

内联展开会在每个调用点插入函数体。调用点越多，可执行代码可能越大。

问题二：**增加头文件依赖**

内联函数体放在头文件中，会让头文件暴露更多实现细节。

如果函数体里调用其他类的成员函数，就要求当前头文件看见对方类的完整定义，而不仅仅是**前置声明**。

例如：

```cpp
class B;

class A {
public:
    void af(B& b) {
        b.bf(); // 这里需要知道 B 中确实有 bf
    }
};
```

只有 `class B;` 不够，因为编译器只知道 `B` 是一个类，不知道它有没有 `bf()`。

如果 `A.h` 需要 `B.h`，而 `B.h` 也需要 `A.h`，就容易形成相互依赖。

此时外联实现则可以降低依赖，即头文件只声明，函数体放到 `.cpp`：

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

这样 `A.h` 只需要知道 `B` 是一个类即可，完整的 `B` 定义放到 `A.cpp` 中再引入。

这能降低头文件之间的 编译期依赖，也能减少循环包含问题。

总结来看：

适合内联：

- 函数体很短
- 逻辑简单
- 频繁调用
- 不引入复杂头文件依赖

适合外联：

- 函数体较长
- 逻辑复杂
- 依赖其他类实现细节
- 可能造成头文件互相依赖
- 希望隐藏实现细节

实际中的工程习惯：

简单 getter/setter、极短函数可考虑内联；涉及复杂逻辑或其他类成员调用时，优先外联实现。

单 getter/setter 可以写在类内：

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

复杂一点的函数建议类外实现：

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

### 访问控制

C++ 类中常见访问控制关键字：`public`、`private`、`protected`

这就到了结构体 `struct` 与类 `class` 的区别所在，前者默认public，后者默认private

访问控制标号可以按任意顺序出现：

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

也可以先写 `private` 再写 `public`。语法上没有固定顺序要求。

一个访问控制标号会影响它后面直到下一个访问控制标号之间的成员。

```cpp
class A {
public:
    void f(); // public

private:
    int x_;  // private
    void h(); // private
};
```

**public**：类外可以访问

`public` 成员是类的外部接口。

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

类外代码能通过对象访问 `public` 成员。

在面向对象设计中，`public` 部分通常代表这个类型对外提供的行为。

**private**：本类可以访问

`private` 成员不能被类外直接访问：

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

但在 `Student` 的成员函数内部，可以访问本类的私有成员：

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

这里 `study` 是 `Student` 类的成员函数，所以可以访问 `Student` 的 `private` 成员。

**private** 是本类访问，不是本对象访问

这是本节最容易考错的地方。

`private` 的含义是 **“本类可以访问”，不是“只能当前对象访问”**。

因此，同一个类的成员函数可以访问另一个同类对象的私有成员。

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

虽然 `other` 不是当前对象，但它的类型仍然是 `Student`。当前代码位于 `Student` 类的成员函数内部，所以可以访问 `Student` 类对象的私有成员。

如果 `Student` 的成员函数访问 `Course` 的私有成员，就不允许：

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

`Student` 不是 `Course` 本类，所以不能访问 `Course` 的私有成员。

常见设计是：**数据成员设为 `private`，通过 `public` 成员函数提供必要访问。**

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

外部不能直接操作 `difficulty_`，只能通过 `getDifficulty()` 获取。

这样做的好处是：

- 保护对象内部状态。
- 避免外部代码随意修改数据。
- 保持类的实现细节可变化。
- 对外只暴露稳定行为。

这就是**封装**的基础。

`protected` 与继承关系有关，表示本类和派生类可以访问，类外不能直接访问。后续在**继承**时会详细展开。

还有一些继承语境下会出现的“不可访问”成员，本节只需要知道它们仍然是类的成员，只是当前上下文不能访问。

### 封装和信息隐蔽

**C++中封装的实现手段——class**

**C++中信息隐蔽的实现手段——访问控制**

简单说：

- 封装：把事物的数据、行为和相关信息打包成一个整体。
- 信息隐蔽：把不需要外部知道的细节隐藏起来。

**封装**：

在程序中，一个类通常把下面内容封装在一起：

- 数据成员
- 成员函数
- 对外接口
- 内部实现细节

例如一本书：

- 对外表现：可以阅读、翻页、查询书名
- 内部细节：纸张材质、页码组织方式、文字排版、数据存储结构

使用者通常只关心书能不能读，不需要知道纸张材料和每页如何组织。

封装符合人理解世界的方式：

人理解事物时，通常先把它看成整体，而不是一开始就深入内部细节。

例如认识一个新同学，不需要知道他的全部生活细节，也能和他交流。只要双方都能说话、听懂对方，就可以完成交互。

这和面向对象相同：

- 对象对外暴露必要特征。
- 外部通过这些特征与对象交互。
- 内部细节可以先不关心。

**信息隐蔽**：

**信息隐蔽**是在封装过程中，让部分信息对外部不可见。

被隐藏的信息可以是：

- 数据成员
- 成员函数
- 内部状态
- 实现细节
- 辅助算法

在 C++ 中，通常用 `private` 隐藏内部信息：

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

外部只通过 `read`、`turnTo` 使用书，不直接操作 `currentPage_`。

**封装和信息隐蔽的关系**：

封装是“打包成整体”，信息隐蔽是“隐藏内部细节”。

二者关系可以理解为：

- 封装提供一个整体。
- 信息隐蔽决定哪些内容对外可见、哪些内容对外不可见。

没有信息隐蔽的封装，只是把东西放在一起；有了信息隐蔽，外部才能真正只依赖接口，而不依赖内部细节。

**分离使用和实现**：

封装和信息隐蔽的第一个作用是：分离使用和实现。

例如使用链表：

```cpp
list.pushBack(2);
list.pushBack(3);
list.pushBack(1);
```

使用者只需要知道链表有 `pushBack` 行为，不需要知道：

- 链表是否用数组实现
- 是否用节点和指针实现
- 节点在堆上如何分配
- 每个节点占多少字节

这就是“使用”和“实现”的分离。

> 关键思想：
> 使用者依赖对象提供的行为，不依赖对象内部如何实现。

**分离接口和实现**：

封装进一步带来**接口**与实现的分离。

接口关注“能做什么”：

```cpp
class Game {
public:
    void initialize();
    void run();
    void terminate();
};
```

实现关注“怎么做”：

```cpp
void Game::run() {
    // 游戏主循环、渲染、输入、物理、AI 等细节
}
```

主程序可能只写：

```cpp
int main() {
    Game game;
    game.initialize();
    game.run();
    game.terminate();
}
```

它不需要知道游戏内部如何加载资源、如何更新画面、如何处理输入。

从而有了**针对接口编程**

当接口和实现分离后，就可以**针对接口编程**。

也就是说，设计时先考虑对象应该提供什么功能，而不是先纠结每个功能内部怎么实现。

例如：

```cpp
game.initialize();
game.run();
game.terminate();
```

这些接口足够表达“游戏生命周期”。至于 `run()` 里面是 2D 游戏、3D 游戏、网络游戏还是单机游戏，可以后续再实现。

这也是面向对象适合建模的原因：分析阶段可以先抓对象的公共行为，把实现细节延后。

以及能够**促进软件复用**

封装和信息隐蔽最终服务于**软件复用**。

如果一个类对外接口稳定，内部实现就可以变化，而使用者代码不必跟着大改。

例如链表的接口不变：

```cpp
list.pushBack(2);
list.pushBack(3);
```

内部实现可以从链式节点改成动态数组，只要接口语义不变，使用者代码仍然可以工作。

软件复用不只是代码复用，还包括：

- 结构复用
- 设计思想复用
- 接口复用
- 模块复用

**类与访问控制如何实现这些思想**

在 C++ 中：

- **类**用来封装数据和行为。
- **public**成员构成外部可见接口。
- **private**成员隐藏内部实现。
- **访问控制**限制外部代码直接依赖内部细节。

典型结构：

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

外部只知道 `pushBack` 和 `get`，不需要知道 `Node` 的内部结构。

### 常成员函数

**常成员函数**是在成员函数参数列表后加 `const` 的成员函数。

```cpp
class MyClass {
public:
    int value() const;
};
```

它的含义是：这个成员函数不应该修改当前对象。

本节最重要的理解是：

> 常成员函数末尾的 `const` 修饰的是隐含的**this指针**。

常成员函数的**格式**

普通成员函数：

```cpp
int f();
```

常成员函数：

```cpp
int f() const;
```

注意 `const` 写在参数列表后面，而不是返回类型前面。

```cpp
int getValue() const;
```

这表示 `getValue` 是一个不会修改当前对象的成员函数。

**const 修饰 this 指针**

普通成员函数中，`this` 可以理解为：

```cpp
T* const this
```

常成员函数中，`this` 可以理解为：

```cpp
const T* const this
```

差别是：

- 普通成员函数：`this` 不能改指向，但可以通过 `this` 修改对象。
- 常成员函数：`this` 不能改指向，也不能通过 `this` 修改对象。

因此常成员函数中不能修改普通数据成员：

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

**常成员函数可以读取对象**

常成员函数可以读取成员：

```cpp
int MyClass::get() const {
    return value_;
}
```

也可以基于成员计算结果：

```cpp
int MyClass::nextValue() const {
    return value_ + 1;
}
```

只要不修改当前对象，就可以。

**const 与成员函数重载**

同名成员函数可以同时有 const 版本和非 const 版本：

```cpp
class MyClass {
public:
    int f();
    int f() const;
};
```

它们可以构成**函数重载**，因为隐含的 `this` 参数类型不同：

- 非 const 版本：`T* const this`
- const 版本：`const T* const this`

这也是为什么 `const` 成员函数可以和非 `const` 成员函数同名、同显式参数列表共存。

**非 const 对象调用规则**

非 const 对象可以调用普通成员函数，也可以调用常成员函数。

```cpp
MyClass obj;

obj.f();       // 如果有非 const 版本，优先匹配非 const 版本
obj.g();       // 普通成员函数可以调用
obj.value();   // 常成员函数也可以调用
```

如果同名函数同时存在 const 和非 const 版本，非 const 对象会优先调用非 const 版本，因为它更匹配。

**const 对象调用规则**

**常对象**只能调用常成员函数。

```cpp
const MyClass obj;

obj.value(); // 可以：value 是 const 成员函数
obj.g();     // 错误：g 不是 const 成员函数
```

即使 `g()` 函数体什么都不做，只要它没有写 `const`，常对象也不能调用。

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

原因是：没有 `const` 的成员函数在类型系统中被认为“可能修改当前对象”。

**为什么应该主动写 const**

如果一个成员函数本意上不应该修改当前对象，就应该写成常成员函数。

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

这样做有几个好处：

- 让接口语义更清楚。
- 允许常对象调用。
- 允许 `const` 引用参数调用。
- 更容易发现错误修改。
- 更方便调试和阅读代码。

**不写 const 会限制代码使用**

如果函数本来只是读取对象，却没有写 `const`：

```cpp
class A {
public:
    int f(); // 实际不修改对象，但没写 const
};

void use(const A& a) {
    a.f(); // 错误：const A 只能调用 const 成员函数
}
```

这会导致本来合理的代码无法编译。

因此，所有不修改对象的成员函数，都应尽量写成常成员函数。

**const 对象可能由系统或临时对象产生**

不要以为自己不写 `const`，程序里就不会出现 const 对象。

const 对象可能来自：

- `const` 变量
- `const` 引用参数
- 临时对象
- 类型转换产生的中间对象
- 标准库或其他库的接口要求

因此，如果类中没有提供常成员函数，很多场景下会无法调用。

### 实例变量、实例方法、类变量、类方法

**实例变量：每个对象各有一份**

**实例变量**是某个具体对象拥有的数据成员。

例如定义一个学生类：

```cpp
class Student {
public:
    int age;
    int score;
};
```

如果创建两个对象：

```cpp
Student a;
Student b;

a.age = 18;
b.age = 20;
```

`a.age` 和 `b.age` 是两份不同的数据。

也就是说：

- `a` 有自己的 `age` 和 `score`
- `b` 也有自己的 `age` 和 `score`
- 修改 `a.age` 不会自动修改 `b.age`

这类“每个对象自己拥有一份”的数据，就是实例变量。

**实例常量：对象拥有但初始化后不可变**

**实例常量**是对象内部的常量数据成员。

例如学生的学号：

```cpp
class Student {
public:
    const int id;
    int score;
};
```

`id` 属于具体学生对象，但一旦对象创建完成，它就不应该再被修改。

可以这样理解：

- `score` 是实例变量，可以随着考试、作业发生变化。
- `id` 是实例常量，仍然属于某个对象，但创建后保持不变。

实例常量和类变量不同：实例常量仍然是“每个对象一份”，只是每一份不能随意修改。

**实例方法：通过对象调用的方法**

**实例方法**是普通成员函数。

```cpp
class Student {
public:
    void study();
    void exercise();
};
```

它描述的是某个对象可以执行的行为。

例如：

```cpp
Student s;
s.study();
```

调用 `s.study()` 时，函数内部隐含地知道“当前对象是谁”。这个“当前对象”就是通过**this指针**表示的。

因此，实例方法可以直接访问当前对象的实例变量：

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

这里的 `score += value` 实际上可以理解为：

```cpp
this->score += value;
```

**类变量：整个类共享一份**

**类变量**是属于类本身的数据，而不是属于某一个对象的数据。

C++ 中通常用**静态数据成员**表示类变量：

```cpp
class Student {
public:
    static int studentCount;
};
```

如果所有学生都属于同一所学校，学校名称就不适合放成每个对象各存一份的实例变量，而更适合抽象成类级别的共享信息。

类变量的特点：

- 属于类，而不是属于某个对象。
- 所有对象共享同一份。
- 不计入单个对象的普通存储大小。
- 通常需要在类外进行定义或初始化。

例如：

```cpp
class Example {
public:
    int value;
    static int number;
};

int Example::number = 0;
```

`value` 是实例变量，每个 `Example` 对象各有一份；`number` 是类变量，整个 `Example` 类共享一份。

**static 数据成员不在对象内部**

看下面这个类：

```cpp
class Example {
public:
    int value;
    static int number;
};
```

一个 `Example` 对象的大小通常只包含 `value`，不包含 `number`。

原因是：

- `value` 是**非静态数据成员**，属于对象。
- `number` 是**静态数据成员**，属于类。
- 对象内部没有为每个 `number` 单独保存一份空间。

这也解释了为什么静态数据成员通常需要单独定义：

```cpp
int Example::number = 0;
```

类体中的 `static int number;` 更像是声明，告诉编译器这个类有一个类变量；真正的存储空间需要通过定义来分配。

**类方法：属于类的方法**

**类方法**是属于类本身的函数，在 C++ 中通常用**静态成员函数**表示。

```cpp
class Example {
public:
    static int nextNumber();
};
```

类方法的典型调用方式是：

```cpp
Example::nextNumber();
```

这里使用的是**作用域解析符** `::`。

虽然有些静态成员函数也可以通过对象写成 `obj.nextNumber()`，但从语义上更推荐使用 `Example::nextNumber()`，因为它强调这个函数属于类，而不是属于某个具体对象。

**静态成员函数没有 this 指针**

普通成员函数有隐含的**this指针**：

```cpp
void f() {
    value++;
}
```

在实例方法中，`value++` 可以理解成：

```cpp
this->value++;
```

但是**静态成员函数**没有隐含的 `this` 指针。

因此，静态成员函数不能直接访问实例变量：

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

它也不能直接调用实例方法：

```cpp
class Example {
public:
    void instanceMethod();

    static void classMethod() {
        instanceMethod(); // 错误：没有当前对象
    }
};
```

原因很直接：类方法可能在没有任何对象存在时就被调用，此时不存在“当前对象”。

**静态成员函数能访问什么**

静态成员函数可以访问类变量，也可以调用其他类方法。

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

这里 `nextNumber` 可以访问 `number`，因为二者都属于类。

静态成员函数的访问规则可以概括为：

| 成员     | 静态成员函数能否直接访问 | 原因                            |
| -------- | ------------------------ | ------------------------------- |
| 实例变量 | 不能                     | 没有 `this`，不知道是哪一个对象 |
| 实例方法 | 不能                     | 实例方法依赖当前对象            |
| 类变量   | 能                       | 同属类级别成员                  |
| 类方法   | 能                       | 同属类级别成员                  |

**const 成员函数与类变量**

**常成员函数**承诺的是“不修改当前对象”。

类变量不属于当前对象，因此常成员函数中修改类变量，并不等价于修改当前对象的实例数据。

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

这说明：`const` 成员函数限制的是通过 `this` 修改当前对象，而不是禁止修改程序中的所有数据。

> **易错点**
> 不要把“常成员函数不能修改成员”机械理解成“不能修改类里的任何东西”。准确说法是：常成员函数不能修改当前对象的普通实例状态，但静态数据成员不属于当前对象内部。

**一组对比**

| 名称         | C++ 常见形式           | 归属 | 是否每个对象一份 | 是否有 this |
| ------------ | ---------------------- | ---- | ---------------- | ----------- |
| **实例变量** | 非静态数据成员         | 对象 | 是               | 不适用      |
| **实例常量** | `const` 非静态数据成员 | 对象 | 是               | 不适用      |
| **实例方法** | 普通成员函数           | 对象 | 不适用           | 有          |
| **类变量**   | `static` 数据成员      | 类   | 否               | 不适用      |
| **类方法**   | `static` 成员函数      | 类   | 不适用           | 无          |

### 合理的 Card 设计骨架

**背面图案应该是类变量**，一副牌中的 52 张牌通常共用同一个背面图案

既然背面图案是类变量，读取和设置背面图案的函数也应设计成**类方法**

**id、花色、面值应是实例常量**，每张牌都有自己的唯一编号、花色和面值，所以它们属于对象。

**宽度、高度和位置可以是实例变量**，牌的宽度、高度、坐标位置可以随着界面缩放、动画或布局调整而变化。

**花色和面值适合用枚举表示**，花色和面值都是有限集合，适合用**枚举**表示，且更推荐使用**强类型枚举**

为 `Card` 提供读取花色名和面值名的实例方法，应该写成**常成员函数**。

判断是否相同花色、相同面值的函数通常很短，可以写成**内联实现**。

设置坐标会改变当前对象，因此不是常成员函数，获取坐标不改变当前对象，可以写成常成员函数，获取右下角坐标也只是计算结果，不修改当前对象，也写成常成员函数。

综合上面的分析，可以得到一个更合理的结构：

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

这不是唯一答案，但它展示了类设计时的判断过程。

## 构造和析构

### 自定义构造函数

**构造函数**是创建对象时自动调用的特殊成员函数，主要负责对象初始化。

自定义构造函数就是程序员自己在类中声明并实现的构造函数。

它有三个基本特征：

- 函数名与 **类名** 完全相同。
- 没有返回值类型，连 `void` 也不写。
- 创建对象时根据参数列表自动匹配调用。

```cpp
class Name {
public:
    Name();
    Name(int value);
    Name(int value1, int value2);
};
```

> 构造函数可以重载，可以设置访问控制，可以有默认参数；单参数构造函数还可能参与隐式类型转换，必要时应使用 `explicit`。

**作用**：构造函数的本意是在对象创建的同时，完成必要初始化。

例如：

```cpp
class Point {
public:
    Point(int x, int y);

private:
    int x_;
    int y_;
};
```

创建对象时：

```cpp
Point p(1, 2);
```

编译器会根据参数 `(1, 2)` 选择匹配的构造函数。

**构造函数可以重载**：同一个类中可以有多个构造函数，只要参数列表不同。

```cpp
class Name {
public:
    Name();          // 无参构造
    Name(int value); // 一个 int 参数
    Name(Address a); // 一个 Address 参数
};
```

创建对象时会自动选择最匹配的版本：

```cpp
Name object1;        // 调用 Name()
Name object2(100);   // 调用 Name(int)
Address addr;
Name object3(addr);  // 调用 Name(Address)
```

这与普通函数的**函数重载**规则类似。

**构造函数与隐式类型转换**：单参数构造函数不仅可以用来创建对象，也可能被编译器当成“类型转换方式”。

```cpp
class Name {
public:
    Name(int value);
};

void f(const Name& obj);

f(100); // 可能隐式调用 Name(100)，先把 int 转成 Name
```

从表面看，`f` 需要的是 `Name` 对象，但实参是 `100`。

如果 `Name(int)` 允许隐式调用，编译器可以先构造一个临时 `Name` 对象，再传给 `f`。

这种由构造函数参与的转换称为 **转换构造函数** 带来的隐式转换。

**explicit禁止隐式调用**：如果不希望单参数构造函数被自动用于隐式转换，可以加 **explicit关键字**。

```cpp
class Name {
public:
    explicit Name(int value);
};

void f(const Name& obj);

f(100);       // 错误：不能隐式把 int 转成 Name
f(Name(100)); // 可以：显式构造
```

`explicit` 的含义是：这个构造函数必须被明确调用。

> `explicit` 不是禁止构造对象，而是禁止“编译器悄悄替你调用这个构造函数做隐式转换”。

**构造函数也受访问控制限制**：构造函数可以是 `public`、`protected` 或 `private`。

```cpp
class Name {
private:
    Name(int x, int y);
};

Name obj(1, 2); // 类外错误：私有构造函数不能直接访问
```

如果构造函数是私有的，类外不能直接创建对象。

但是本类内部仍然可以访问私有构造函数。

**私有构造函数的用途**：**私有构造函数**常用于限制对象创建方式。

例如通过类方法统一创建对象：

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

这里：

- `Name()` 是私有的，类外不能直接 `Name obj;`
- `create()` 是 **类方法**，可以通过 `Name::create()` 调用。
- `create()` 在类内部，所以可以访问私有构造函数。
- `object` 是 **静态局部变量**，第一次调用时创建，之后反复返回同一个对象。

这就是**单例模式**的基本思想：控制一个类最多只创建一个实例。

**为什么 create 必须是静态成员函数**：如果 `create()` 不是 `static`，就必须先有对象才能调用：

```cpp
Name n;
n.create();
```

但构造函数是私有的，类外根本创建不出 `Name n`。因此创建入口必须能通过类名直接调用：

```cpp
Name::create();
```

这就要求把它设计成 **静态成员函数**。

**返回引用与返回指针的两种单例写法**：一种写法是返回静态局部对象的引用：

```cpp
static Name& create() {
    static Name object;
    return object;
}
```

另一种写法是用静态指针记录对象：

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

指针写法更灵活，但需要考虑 `new` 之后如何释放、生命周期如何管理等问题。当前阶段重点是理解：私有构造函数可以配合类方法控制对象创建。

**带默认参数的构造函数可能造成二义性**：构造函数可以有 **默认参数**。

```cpp
class Name {
public:
    Name();
    Name(int x);
    Name(int x, int y = 999);
};
```

这三个声明本身看起来都能成立，但调用时可能产生 **二义性**：

```cpp
Name obj(200);
```

这既可以匹配 `Name(int x)`，也可以匹配 `Name(int x, int y = 999)`。编译器无法确定该调用哪一个，就会报二义性错误。

**用默认参数合并构造函数**：如果多个构造函数只是参数个数不同，可以考虑用默认参数合并：

```cpp
class Name {
public:
    Name(int x = 0, int y = 999);
};
```

这样：

```cpp
Name a;        // x = 0, y = 999
Name b(200);   // x = 200, y = 999
Name c(1, 2);  // x = 1, y = 2
```

一个构造函数就覆盖了无参、一个参数、两个参数三种情况，同时避免多个重载版本互相冲突。

### 缺省的构造函数

**缺省构造函数**是编译器在特定情况下自动提供的无参构造函数，它的典型形式类似：

```cpp
class A {
public:
    A();
};
```

但它只在“用户没有声明任何构造函数”时才会由编译器自动提供。

> 只要用户声明了任意一个构造函数，编译器就不再自动提供缺省构造函数。这个构造函数可以是有参的、私有的，甚至只是声明而没有实现。

**编译器什么时候提供缺省构造函数**：如果类中没有写任何构造函数：

```cpp
class A {
public:
    int value;
};
```

编译器会自动提供一个缺省构造函数，使得 `A a;` 可以成立。这个函数是编译时由编译器补充的，不是程序运行到某处才产生。

**用户声明了构造函数后，编译器不再提供**：下面这种类已经有一个用户声明的构造函数：

```cpp
class A {
public:
    A(int value);
};
```

此时 `A a;` 错误，因为编译器不再自动提供 `A()`。

**私有构造函数也算用户声明**：即使构造函数是私有的，也算用户声明。

```cpp
class A {
private:
    A();
};
```

这会导致：编译器不再自动提供缺省构造函数；类外不能直接调用这个私有构造函数；因此 `A a;` 在类外不可用。

**只有声明没有实现也算用户声明**：只要类中出现了构造函数声明，就算用户提供了构造函数。

```cpp
class A {
public:
    A(int value); // 只有声明，也算用户声明
};
```

此时编译器不会再自动补一个 `A()`。如果后续真的调用 `A(int)`，还需要提供函数定义，否则可能在链接阶段出错。

把几种常见情况汇总如下：

| 类中情况             | 编译器是否自动提供缺省构造函数 | `A a;` 是否可用                |
| -------------------- | ------------------------------ | ------------------------------ |
| 没写任何构造函数     | 是                             | 通常可用                       |
| 写了 `A(int)`        | 否                             | 不可用，除非另写 `A()`         |
| 写了私有 `A()`       | 否                             | 类外不可用                     |
| 只声明了某个构造函数 | 否                             | 取决于是否存在可访问的无参构造 |

一句话：你一个构造都不写，编译器帮你补无参；你写了任何一个，编译器就不再补。

### 对象的初始化

对象创建时要为数据成员建立初始状态。C++ 中初始化对象成员有多种方式，主要讨论三种：在构造函数体内赋值、在类定义中为数据成员指定初值、以及静态数据成员为什么不能随便在类内初始化。

> 构造函数体 `{}` 内执行时，对象已经创建完成；所以函数体内的语句严格说是赋值，不是成员真正的初始化。`const` 数据成员不能靠函数体内赋值完成初始化。

**构造函数体内赋值**：最直观的写法是在构造函数体内给成员赋值：

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

这看起来像初始化，但要注意：当程序执行到构造函数体的大括号内部时，对象已经创建了。因此 `x = 0; y = value;` 更准确地说是给已经存在的成员赋值。

**const 成员不能靠函数体赋值**：如果成员是 **实例常量**：

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

这会出错。原因是 `x` 是 `const` 成员，进入构造函数体时对象已经创建完成，此时再写 `x = value` 就是在修改 `const` 成员。这说明函数体赋值不是万能的初始化方式。

**类内初始值**：C++11 以后，可以在类定义中直接给非静态数据成员指定初值。

```cpp
class Card {
private:
    int x_ = 5;
    int y_ = 6;
    double data_ = 0.1;
    const int id_ = 100;
};
```

含义是：创建对象时，如果构造函数没有另外指定这些成员的初值，就使用类内给出的初值。这种写法对普通实例变量和实例常量都很有用。

**静态数据成员不能随便类内初始化**：**静态数据成员** 不属于单个对象，因此创建某个对象时不会顺便给静态数据成员分配空间。

```cpp
class A {
private:
    static int count_; // 声明
};
```

通常需要在类外定义：

```cpp
int A::count_ = 0;
```

如果允许普通静态成员直接在头文件类定义中初始化，多个 `.cpp` 文件包含这个头文件时，就可能导致多个定义或存储空间分配问题。

**静态整型常量的特殊性**：早期 C++ 对类内初始化支持有限，但允许某些静态整型常量在类内给出初值。

```cpp
class Card {
public:
    static const int CardCount = 52;
};
```

原因是这类值常作为编译期常量使用，编译器可以做 **常量折叠**，在使用处直接替换为具体数值，而不一定需要为它分配对象存储空间。但普通静态变量、静态浮点变量等一般不能用这种方式简单处理。

下表对比类内初始值与静态成员的差异：

| 成员             | 是否属于对象 | 能否随对象创建初始化 | 类内初始值是否常用 |
| ---------------- | ------------ | -------------------- | ------------------ |
| 普通实例变量     | 是           | 是                   | 是                 |
| 实例常量         | 是           | 是                   | 是                 |
| 普通静态数据成员 | 否           | 否                   | 通常不这样写       |
| 静态整型常量     | 否           | 不依赖对象           | 可作为特殊情况     |

对象初始化常见三种位置，可以放在一起比较：

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

三者差别如下：

| 写法           | 发生阶段               | 适合内容                                                 |
| -------------- | ---------------------- | -------------------------------------------------------- |
| 类内初始值     | 成员初始化阶段的默认值 | 普通成员、`const` 成员的默认初值                         |
| 初始化列表     | 成员真正构造/初始化时  | `const` 成员、引用成员、成员对象、需要指定构造参数的成员 |
| 构造函数体赋值 | 成员已经初始化之后     | 普通可赋值成员的后续调整                                 |

> `const` 成员和引用成员必须在真正初始化阶段完成，不能等到构造函数体里再赋值。

### 初始化列表

**初始化列表**是写在构造函数参数列表之后、函数体 `{}` 之前的一段成员初始化语法，用 `: 成员1(实参), 成员2(实参), ...` 的形式，在进入函数体之前就把数据成员构造好。

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

**哪些成员可以、哪些成员必须用初始化列表**：普通数据成员用不用都行；常量数据成员、引用数据成员、以及没有无参构造函数的对象数据成员，则必须用初始化列表。

| 成员类型                   | 是否必须用初始化列表 | 原因                                   |
| -------------------------- | -------------------- | -------------------------------------- |
| 普通数据成员               | 可选                 | 也可以进函数体后再赋值                 |
| 常量数据成员               | 必须                 | 进函数体后赋值等于修改 `const`，非法   |
| 引用数据成员               | 必须                 | 引用在创建时就要绑定，不能先存在再绑定 |
| 对象数据成员（无无参构造） | 必须                 | 不指定就会去调它的无参构造，而它没有   |

上面 `Description` 只有 `Description(int n)`，没有无参构造函数，所以 `desc` 必须在初始化列表里写成 `desc(id)` 或 `desc(aId)`，否则编译器找不到 `Description()` 来初始化它，直接报错。

**初始化列表与构造函数体赋值的区别**：初始化列表里的写法是成员“真正的初始化”，成员在构造时一次到位；构造函数体里的 `=` 是成员已经构造完成之后的赋值。这正是 **实例常量** 和引用成员只能用初始化列表的原因——它们必须在初始化阶段就确定，没有“先建好再赋值”的机会。这一点与对象初始化中“函数体内赋值不是初始化”的观点一致。

**数据成员严格按声明顺序初始化**：非静态数据成员的实际初始化顺序，由它们在类中的**声明顺序**决定，与初始化列表的书写顺序无关。

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

无论初始化列表怎么写，实际初始化仍是 `x → id → player → desc` 这样按声明顺序进行（`y` 没在列表里，进函数体后才赋值）。很多编译器还会对“列表书写顺序与声明顺序不一致”给出警告。

> 初始化列表不是决定成员初始化顺序的依据，类中成员的声明顺序才是依据。

**初始化的完整流程**：构造一个对象时，编译器对每个非静态数据成员，按声明顺序依次处理：

1. 先在初始化列表中查找该成员有没有指定初始化方式；
2. 找到了，就按指定方式初始化；
3. 没找到，就调用它的无参构造函数初始化（内置类型此时值不确定）；
4. 连无参构造函数都没有，就报错（如上面的 `desc`）；
5. 所有成员都初始化完成后，才进入构造函数的 `{}` 执行函数体。

所以构造函数体不是成员开始构造的地方，而是成员全部构造完之后执行额外语句的地方。

**`desc(id)` 与 `desc(aId)` 的区别**：用成员去初始化另一个成员时，要特别小心声明顺序。

- `desc(aId)`：用构造函数参数 `aId` 初始化 `desc`，任何时候都安全；
- `desc(id)`：用成员 `id` 初始化 `desc`。因为 `id` 的声明在 `desc` **之前**，轮到 `desc` 初始化时 `id` 已经初始化好，所以这样写也可行，结果和 `desc(aId)` 相同（前提是 `id` 被初始化成了 `aId`）。

但这种写法依赖声明顺序：如果哪天把 `desc` 的声明挪到 `id` 之前，`desc(id)` 就会读到尚未初始化的 `id`，变成隐蔽的 bug。结论是：用一个成员去初始化另一个成员时，务必确认被用的成员在声明顺序上更靠前。

所以这里举例用 **`desc(id)`** 只是为了说明其中细节，实际环境中还是 **`desc(aId)`** 更加推荐

静态数据成员不属于某个对象，不参与初始化列表，它的初始化在类外单独完成。

### 析构函数

**析构函数**是对象即将被销毁时自动调用的特殊成员函数，与构造函数相对：构造函数让对象从无到有，用于创建和初始化；析构函数让对象从有到无，用于释放和清理。它的基本形式是：

```cpp
class A {
public:
    ~A();
};
```

> 析构函数名是在类名前加 `~`，没有返回值，没有参数，不能重载；用户不写时，编译器会提供缺省析构函数。

**语法格式**：构造函数写作 `A();`，析构函数写作 `~A();`，二者都没有返回值类型。析构函数比构造函数多一个 `~`，读作“析构 A 对象”。

**析构函数没有参数**：

```cpp
class A {
public:
    ~A(int value); // 错误
};
```

原因是析构函数由对象销毁过程自动调用，调用时只需要销毁当前对象，不需要用户再传入额外参数。这也意味着析构函数不能像构造函数那样重载。

**析构函数没有返回值**：

```cpp
class A {
public:
    ~A();      // 正确
    void ~A(); // 错误
};
```

它的职责是清理对象，不通过返回值表达结果。

**析构函数不能是 const**：

```cpp
class A {
public:
    ~A() const; // 错误
};
```

原因是析构函数的本意就是销毁当前对象，销毁显然会改变对象状态，不可能承诺“不修改当前对象”。同理，构造函数也不能是 `const`。

**构造函数和析构函数都有 this 指针**：二者内部都有隐含的 **this指针**，因此都可以访问当前对象的数据成员：

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

只是要注意：构造函数处于对象创建过程，析构函数处于对象销毁过程，二者语义不同。

**缺省析构函数**：如果用户没有写析构函数，编译器会提供 **缺省析构函数**，它会按语言规则销毁对象成员。

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

如果没有手写析构函数：`int` 成员不需要特殊清理；引用成员本身不负责销毁被引用对象；对象成员 `object_` 会自动调用它自己的析构函数。因此很多类不需要显式写析构函数。

**什么时候需要自定义析构函数**：如果类本身没有管理特殊资源，通常不需要手写析构函数。需要考虑自定义析构函数的常见情况包括：类中直接管理动态内存；类中持有文件句柄、网络连接、锁等资源；类需要在对象销毁时记录日志、注销状态或归还资源。当前这一节主要强调语法和默认行为，资源管理的复杂问题会在后续章节展开。

**析构对象成员**：一个对象如果包含其他对象作为成员：

```cpp
class A {
private:
    B b_;
};
```

当 `A` 对象析构时，`b_` 会自动调用 `B` 的析构函数。这说明缺省析构函数不是“什么都不做”，它会按规则处理成员对象的销毁。

**析构是对象销毁前的最后清理**：可以把析构函数理解为对象生命周期的终点动作——分配对象存储空间、构造函数初始化、对象正常使用、生命周期结束、调用析构函数清理、最后释放对象占用的存储。对于下面的类：

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

析构函数通常不需要处理 `int`、`const int` 这类普通成员，引用成员也不负责销毁被引用对象；真正需要关注的是成员对象 `desc`，它会自动调用自己的析构函数。如果类中直接管理动态内存或外部资源，才需要在析构函数中显式清理。析构函数一般设为 `public`，在继承场景中有时会设为 `protected`。

### 构造和析构函数的访问

对象的创建和销毁分别由构造函数和析构函数处理。这一节重点理解三件事：构造函数什么时候被调用、析构函数什么时候被调用、成员对象的构造和析构顺序。

> 成员对象按声明顺序构造，按构造的逆序析构；栈区对象离开作用域自动析构，堆区对象需要 `delete` 才会触发析构。

**构造函数的调用场景**：构造函数主要在对象创建时调用，常见情况包括：显式创建对象；隐式类型转换创建临时对象；成员对象随外层对象一起创建；静态数据成员在类外定义并初始化；`new` 在堆区创建对象。

**显式调用构造函数**：显式调用就是代码明确表达要创建某个类型的对象：

```cpp
A a0;
A a1(5);
```

这类写法会直接根据参数选择构造函数。

**隐式调用构造函数**：如果构造函数允许隐式转换，编译器可能自动调用构造函数创建临时对象：

```cpp
class B {
public:
    B(int value);
};

void f(B b);

f(2); // 可能隐式构造 B(2)
```

如果构造函数加了 **explicit关键字**，则 `f(2)` 不能再隐式把 `2` 转成 `B` 对象。

**对象成员的构造**：如果类 `A` 中包含 `B` 类型成员：

```cpp
class A {
private:
    int number_;
    B b1_;
    B b2_;
};
```

创建 `A` 对象时，`b1_` 和 `b2_` 也必须被构造，此时可以用 **构造函数初始化列表** 指定它们的构造方式：

```cpp
A::A()
    : number_(0),
      b2_(2)
{
}
```

如果某个成员没有在初始化列表中出现，编译器会尝试调用它的无参构造函数。

**成员构造顺序由声明顺序决定**：成员的实际构造顺序由它们在类中的声明顺序决定，不由初始化列表书写顺序决定。对上面的 `A`，构造顺序是 `number_ → b1_ → b2_`，即使初始化列表写成：

```cpp
A::A() : b2_(2), number_(0) {}
```

实际构造仍按声明顺序进行。

> 初始化列表不是决定成员构造顺序的依据，类中成员声明顺序才是依据。

**构造函数体执行前，成员已经构造**：构造 `A` 对象时，流程大致是——按声明顺序构造各个数据成员，使用初始化列表提供的参数或默认构造方式，成员构造完成后再进入构造函数体 `{}`。因此构造函数体不是成员构造开始的地方，而是成员已经构造后执行额外语句的地方，这与对象初始化中“函数体内赋值不是初始化”的观点一致。

**析构函数的调用场景**：析构函数在对象生命周期结束时调用。对象在哪里创建，通常决定了它什么时候销毁。

| 对象位置                | 销毁时机               | 是否自动析构 |
| ----------------------- | ---------------------- | ------------ |
| 程序区或全局/静态存储区 | 程序结束时             | 是           |
| 栈区                    | 离开作用域或函数结束时 | 是           |
| 堆区                    | 执行 `delete` 时       | 需要用户触发 |

**栈区对象自动析构**：局部对象通常位于 **栈区**：

```cpp
void f() {
    A a1;
    A a2(5);
} // 离开作用域，a2、a1 自动析构
```

离开作用域时会自动调用析构函数，局部对象一般按照创建的逆序析构：后创建的先销毁。

**堆区对象需要 delete**：用 `new` 创建的对象位于 **堆区**：

```cpp
A* pa = new A(5);
delete pa;
```

`new A(5)` 会在堆区分配空间、调用 `A` 的构造函数、返回对象地址；`delete pa` 会调用 `pa` 指向对象的析构函数、释放堆区空间。注意 `pa` 这个指针变量本身如果是局部变量，仍然在栈上，堆上的是它指向的对象。

**创建看构造可访问，销毁看析构可访问**：对象能否被创建，首先要看当前位置能否访问对应的构造函数；对象能否被销毁，也要看当前位置能否访问析构函数。这也是私有构造函数、私有析构函数能控制对象创建和销毁方式的原因。常见判断如下：

| 写法            | 需要访问                                        |
| --------------- | ----------------------------------------------- |
| `A a;`          | 构造函数；离开作用域时还要能访问析构函数        |
| `A* p = new A;` | 构造函数                                        |
| `delete p;`     | 析构函数                                        |
| 成员对象 `B b;` | 外层对象构造/析构时能按规则调用 `B` 的构造/析构 |

**析构顺序与构造顺序相反**：如果 `A` 中有成员 `b1_`、`b2_`，构造 `A` 时依次是构造 `number_`、构造 `b1_`、构造 `b2_`、执行 `A` 构造函数体；析构 `A` 时则反过来：执行 `A` 析构函数体、析构 `b2_`、析构 `b1_`，普通整数成员无需特殊析构。这就是 **构造顺序** 与 **析构顺序** 的对应关系。

**静态数据成员对象的构造**：如果类中有静态对象成员：

```cpp
class A {
private:
    static B globalB_;
};

B A::globalB_(200);
```

`globalB_` 是 **静态数据成员**，通常在类外定义并初始化。它存放在静态存储区域，不属于某个 `A` 对象，程序结束时也会被析构。
