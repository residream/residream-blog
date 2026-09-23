---
title: "C++ 入门黑马程序员学习记录"
description: "跟着黑马程序员敲 C++ 的练手记录，几个管理系统小项目。"
publishDate: "2026-02-13T00:16:57"
tags:
  - "c-cpp"
heroImage:
  src: ./acoustic-session.jpg
  color: "#A0957D"
  alt: C++ 入门黑马程序员学习记录
language: '简中'
draft: false
---

## 通讯录管理系统

大一上学完C，刚好寒假无聊所以把Cpp给学了，这是跟着黑马程序员写的通讯录管理系统，极其简单甚至没用到类与对象，纯粹是当保持敲码的手感

### 通讯录管理系统.cpp

```cpp
#include <iostream>
#include <string>

using namespace std;

#define MAX 1000

//设计联系人结构体
struct Person
{
	//姓名
	string m_Name;
	//性别	1.男 2.女
	int m_Sex;
	//年龄
	int m_Age;
	//电话
	string m_Phone;
	//住址
	string m_Addr;
};

//设计通讯录结构体
struct Addressbooks
{
	//通讯录中保存的联系人的数组
	struct Person personArray[MAX];

	//通讯录中当前记录的联系人个数
	int m_Size;
};

//菜单界面
void showMenu()
{
	cout << "***********************" << endl;
	cout << "*****1、添加联系人*****" << endl;
	cout << "*****2、显示联系人*****" << endl;
	cout << "*****3、删除联系人*****" << endl;
	cout << "*****4、查找联系人*****" << endl;
	cout << "*****5、修改联系人*****" << endl;
	cout << "*****6、清空联系人*****" << endl;
	cout << "*****0、退出通讯录*****" << endl;
	cout << "***********************" << endl;
}

//检测联系人是否存在，如果存在则返回位置，不存在则返回-1
int isExist(Addressbooks* abs, string name)
{
	for (int i = 0; i < abs->m_Size; i++)
	{
		if (abs->personArray[i].m_Name == name)
		{
			return i;
		}
	}
	return -1;
}

//1、添加联系人
void addPerson(Addressbooks* abs)
{
	//判断通讯录是否已满，如果已满则不再添加
	if (abs->m_Size == MAX)
	{
		cout << "通讯录已满，无法添加！" << endl;
		return;
	}
	else
	{
		//添加具体联系人

		//姓名
		string name;
		cout << "请输入姓名：" << endl;
		cin >> name;
		abs->personArray[abs->m_Size].m_Name = name;

		//性别
		int sex;
		cout << "请输入性别" << endl;
		cout << "1 ———— 男" << endl;
		cout << "2 ———— 女" << endl;
		while (true)
		{
			cin >> sex;
			if (sex == 1 || sex == 2)
			{
				abs->personArray[abs->m_Size].m_Sex = sex;
				break;
			}
			cout << "输入有误，请重新输入";
		}

		//年龄
		int age = 0;
		cout << "请输入年龄：" << endl;
		while (true)
		{
			cin >> age;
			if (age > 0 || age < 130)
			{
				abs->personArray[abs->m_Size].m_Age = age;
				break;
			}
			cout << "输入有误，请重新输入";
		}

		//电话
		string phone;
		cout << "请输入联系电话：" << endl;
		while (true)
		{
			cin >> phone;
			abs->personArray[abs->m_Size].m_Phone = phone;
			break;
			cout << "输入有误，请重新输入";
		}

		//地址
		string address;
		cout << "请输入家庭住址：" << endl;
		cin >> address;
		abs->personArray[abs->m_Size].m_Addr = address;

		//更新通讯录人数
		abs->m_Size++;
		
		cout << "添加成功";

		system("pause");//请按任意键继续
		system("cls");//清屏操作
	}
}

//2、显示联系人
void showPerson(Addressbooks* abs)
{
	//判断通讯录中人数
	if (abs->m_Size == 0)
	{
		cout << "通讯录为空" << endl;
	}
	else
	{
		for (int i = 0; i < abs->m_Size; i++)
		{
			cout << "姓名：" << abs->personArray[i].m_Name << "\t";
			cout << "性别：" << (abs->personArray[i].m_Sex == 1 ? "男" : "女") << "\t";
			cout << "年龄：" << abs->personArray[i].m_Age << "\t";
			cout << "电话：" << abs->personArray[i].m_Phone << "\t";
			cout << "地址：" << abs->personArray[i].m_Addr << endl;
		}
	}

	system("pause");//按任意键继续
	system("cls");//清屏
}

//3、删除联系人
void deletePerson(Addressbooks* abs)
{
	cout << "请输入您要删除的联系人姓名" << endl;
	string name;
	cin >> name;
	int ret = isExist(abs, name);
	if (ret != -1)
	{
		//查到此人，进行删除
		for (int i = ret; i < abs->m_Size; i++)
		{
			//数据前移
			abs->personArray[i] = abs->personArray[i + 1];
		}
		abs->m_Size--;//更新通讯录中人员数
		cout << "删除成功" << endl;
	}
	else
	{
		cout << "查无此人" << endl;
	}

	system("pause");
	system("cls");
}

//4、查找联系人
void findPerson(Addressbooks* abs)
{
	cout << "请输入您要查找的联系人姓名" << endl;
	string name;
	cin >> name;
	int ret = isExist(abs, name);
	if (ret != -1)
	{
		cout << "姓名：" << abs->personArray[ret].m_Name << "\t\t";
		cout << "性别：" << abs->personArray[ret].m_Sex << "\t\t";
		cout << "年龄：" << abs->personArray[ret].m_Age << "\t\t";
		cout << "电话：" << abs->personArray[ret].m_Phone << "\t\t";
		cout << "地址：" << abs->personArray[ret].m_Addr << "\t\t";
	}
	else
	{
		cout << "查无此人" << endl;
	}

	system("pause");
	system("cls");
}

//5、修改联系人
void modifyPerson(Addressbooks* abs)
{
	cout << "请输入您要修改联系人的姓名" << endl;
	string name;
	cin >> name;
	int ret = isExist(abs, name);
	if (ret != -1)//找到指定联系人
	{
		cout << "已找到，请随提示输入修改信息" << endl;

		//姓名
		string name;
		cout << "请输入姓名：" << endl;
		cin >> name;
		abs->personArray[ret].m_Name = name;

		//性别
		int sex;
		cout << "请输入性别" << endl;
		cout << "1 ———— 男" << endl;
		cout << "2 ———— 女" << endl;
		while (true)
		{
			cin >> sex;
			if (sex == 1 || sex == 2)
			{
				abs->personArray[ret].m_Sex = sex;
				break;
			}
			cout << "输入有误，请重新输入";
		}

		//年龄
		int age = 0;
		cout << "请输入年龄：" << endl;
		while (true)
		{
			cin >> age;
			if (age > 0 || age < 130)
			{
				abs->personArray[ret].m_Age = age;
				break;
			}
			cout << "输入有误，请重新输入";
		}

		//电话
		string phone;
		cout << "请输入联系电话：" << endl;
		while (true)
		{
			cin >> phone;
			abs->personArray[ret].m_Phone = phone;
			break;
			cout << "输入有误，请重新输入";
		}

		//地址
		string address;
		cout << "请输入家庭住址：" << endl;
		cin >> address;
		abs->personArray[ret].m_Addr = address;

		cout << "修改成功";

		system("pause");//请按任意键继续
		system("cls");//清屏操作
	}
	else//未找到
	{
		cout << "查无此人" << endl;
	}

	system("pause");
	system("cls");
}

//6、清空联系人
void cleanPerson(Addressbooks* abs)
{
	abs->m_Size = 0;
	cout << "通讯录已清空" << endl;

	system("pause");
	system("cls");
}

int main()
{
	//创建通讯录结构体变量
	Addressbooks abs;

	//初始化通讯录中当前人员个数
	abs.m_Size = 0;

	//初始化选择
	int select = 0;
	
	while (true)
	{
		//菜单调用
		showMenu();

		cin >> select;

		switch (select)
		{
		case 1:		//1、添加联系人
			addPerson(&abs);
			break;

		case 2:		//2、显示联系人
			showPerson(&abs);
			break;

		case 3:		//3、删除联系人
			deletePerson(&abs);
			break;

		case 4:		//4、查找联系人
			findPerson(&abs);
			break;

		case 5:		//5、修改联系人
			modifyPerson(&abs);
			break;

		case 6:		//6、清空联系人
			cleanPerson(&abs);
			break;

		case 0:		//0、退出通讯录
			cout << "欢饮下次使用" << endl;
			system("pause");
			return 0;
			break;
		}
	}

	return 0;
}
```

## 职工管理系统

这里起学完类与对象了，感觉这相当有意思，封装继承多态，以及多文件项目的编写，非常奇妙，不过这个职工管理系统也还是相当基础，bug也很多懒得改，纯当寒假练手了

### 职工管理系统.cpp

```cpp
#include <iostream>
#include "workerManager.h"
using namespace std;
#include "worker.h"
#include "employee.h"
#include "manager.h"
#include "boss.h"

int main()
{
	workerManager wm;
	int choice = 0;
	while (true)
	{
		//展示菜单
		wm.show_Menu();

		cout << "请输入您的选择：" << endl;

		cin >> choice;

		switch (choice)
		{
		case 0: //退出系统
			wm.exitSystem();
			break;
		case 1: //添加职工
			wm.add_Emp();
			break;
		case 2: //显示职工
			wm.show_Emp();
			break;
		case 3: //删除职工
			wm.del_Emp();
			break;
		case 4: //修改职工
			wm.mod_Emp();
			break;
		case 5: //查找职工
			wm.find_Emp();
			break;
		case 6: //排序职工
			wm.sort_Emp();
			break;
		case 7: //清空文件
			wm.clean_File();
			break;
		default:
			system("cls");
			break;
		}
	}
	system("pause");
	return 0;
}
```

### workerManager.h

```cpp
#pragma once //防止头文件重复包含
#include <iostream> //包含输入输出流头文件
using namespace std; //使用标准命名空间
#include "worker.h"
#include "employee.h"
#include "manager.h"
#include "boss.h"
#include <fstream>
#define FILENAME "empFile.txt"

class workerManager
{
public:
	//构造函数
	workerManager();

	//展示菜单
	void show_Menu();

	//退出系统
	void exitSystem();

	//记录职工人数
	int m_empNum;

	//职工数组指针
	Worker** m_empArray;

	//添加职工
	void add_Emp();

	//保存文件
	void save();

	//判断文件是否为空标志
	bool m_fileisEmpty;

	//统计文件中人数
	int get_empNum();

	//初始化员工
	void init_Emp();

	//显示职工
	void show_Emp();

	//删除职工
	void del_Emp();

	//判断职工是否存在，如果存在返回职工所在数组中的位置，不存在返回-1
	int isExist(int ID);

	//修改职工
	void mod_Emp();

	//查找职工
	void find_Emp();

	//排序职工
	void sort_Emp();

	//排序算法
	void quickSort(int l, int r, int select);

	//清空文件
	void clean_File();

	//析构函数
	~workerManager();
};
```

### workerManager.cpp

```cpp
#include "workerManager.h"

workerManager::workerManager()
{
	//1、文件不存在
	ifstream ifs;
	ifs.open(FILENAME, ios::in); //读文件
	if (!ifs.is_open())
	{
		//初始化属性
		this->m_empNum = 0; //初始化记录人数
		this->m_empArray = NULL; //初始化数组指针
		this->m_fileisEmpty = true; //初始化文件是否为空
		ifs.close();
		return;
	}
	//2、文件存在但数据为空
	char ch;
	ifs >> ch;
	if (ifs.eof())
	{
		//初始化属性
		this->m_empNum = 0; //初始化记录人数
		this->m_empArray = NULL; //初始化数组指针
		this->m_fileisEmpty = true; //初始化文件是否为空
		ifs.close();
		return;
	}
	//3、文件存在且有数据
	int num = this->get_empNum();
	this->m_empNum = num;
	//开辟空间
	this->m_empArray = new Worker * [this->m_empNum];
	//将文件中的数据存到数组中
	this->init_Emp();
}

//展示菜单
void workerManager::show_Menu()
{
	cout << "**************************************" << endl;
	cout << "*********欢迎使用职工管理系统*********" << endl;
	cout << "************0.退出管理系统************" << endl;
	cout << "************1.增加职工信息************" << endl;
	cout << "************2.显示职工信息************" << endl;
	cout << "************3.删除离职职工************" << endl;
	cout << "************4.修改职工信息************" << endl;
	cout << "************5.查找职工信息************" << endl;
	cout << "************6.按照编号排序************" << endl;
	cout << "************7.清空所有文档************" << endl;
	cout << "**************************************" << endl;
	cout << endl;
}

//退出系统
void workerManager::exitSystem()
{
	cout << "欢迎下次使用" << endl;
	system("pause");
	exit(0); //退出程序
}

//添加职工
void workerManager::add_Emp()
{
	cout << "请输入添加职工数量：" << endl;

	int addNum = 0; //保存用户的输入数量
	cin >> addNum;
	if (addNum > 0)
	{
		//添加
		//计算添加新空间大小
		int newSize = this->m_empNum + addNum; //新空间人数 = 原来记录人数 + 新增人数 
		//开辟新空间
		Worker** newSpace = new Worker * [newSize];
		//将原来空间下数据拷贝到新空间下
		if (this->m_empArray != NULL)
		{
			for (int i = 0; i < this->m_empNum; i++)
			{
				newSpace[i] = this->m_empArray[i];
			}
		}
		//批量添加新数据
		for (int i = 0; i < addNum; i++)
		{
			int id; //职工编号
			string name; //职工姓名
			int dSelect; //部门选择
			cout << "请输入第" << i + 1 << "个新职工编号" << endl;
			cin >> id;
			cout << "请输入第" << i + 1 << "个新职工姓名" << endl;
			cin >> name;
			cout << "请选择该职工岗位：" << endl;
			cout << "1、普通职工" << endl;
			cout << "2、经理" << endl;
			cout << "3、老板" << endl;
			cin >> dSelect;

			Worker* worker = NULL;
			switch (dSelect)
			{
			case 1:
				worker = new Employee(id, name, 1);
				break;
			case 2:
				worker = new Manager(id, name, 2);
				break;
			case 3:
				worker = new Boss(id, name, 3);
				break;
			default:
				break;
			}
			//将创建职工职责，保存到数组中
			newSpace[this->m_empNum + i] = worker;
		}
		//释放原有空间
		delete[] this->m_empArray;
		//更改新空间的指向
		this->m_empArray = newSpace;
		//更新新的职工人数
		this->m_empNum = newSize;
		//更新职工不为空标志
		this->m_fileisEmpty = false;
		//保存数据到文件中
		this->save();
		//提示添加成功
		cout << "成功添加" << addNum << "名新职工" << endl;
	}
	else
	{
		cout << "输入数据有误" << endl;
	}
	//按任意键后清屏回到上级目录
	system("pause");
	system("cls");
}

//保存文件
void workerManager::save()
{
	ofstream ofs;
	ofs.open(FILENAME, ios::out); //用输出的方式打开文件 -- 写文件
	//将每个人数据写入到文件中
	for (int i = 0; i < this->m_empNum; i++)
	{
		ofs << this->m_empArray[i]->m_ID << " "
			<< this->m_empArray[i]->m_Name << " "
			<< this->m_empArray[i]->m_DeptID << endl;
	}
	//关闭文件
	ofs.close();
}

//统计文件中人数
int workerManager::get_empNum()
{
	ifstream ifs;
	ifs.open(FILENAME, ios::in); //打开文件并读取
	int ID;
	string Name;
	int dID;
	int num = 0;
	while(ifs >> ID && ifs >> Name && ifs >> dID)
	{
		//统计人数变量
		num++;
	}
	return num;
}

//初始化员工
void workerManager::init_Emp()
{
	ifstream ifs;
	ifs.open(FILENAME, ios::in);
	int ID;
	string Name;
	int dID;
	int index = 0;
	while (ifs >> ID && ifs >> Name && ifs >> dID)
	{
		Worker* worker = NULL;
		//普通职工
		if (dID == 1)
		{
			worker = new Employee(ID, Name, dID);
		}
		//经理
		else if (dID == 2)
		{
			worker = new Manager(ID, Name, dID);
		}
		//老板
		else
		{
			worker = new Boss(ID, Name, dID);
		}
		this->m_empArray[index] = worker;
		index++;
	}
	//关闭文件
	ifs.close();
}

//显示职工
void workerManager::show_Emp()
{
	//判断文件是否为空
	if (this->m_fileisEmpty)
	{
		cout << "文件不存在或记录为空！" << endl;
	}
	else
	{
		for (int i = 0; i < m_empNum; i++)
		{
			//利用多态调用程序接口
			this->m_empArray[i]->showInfo();
		}
	}
	//按任意键后清屏
	system("pause");
	system("cls");
}

//删除职工
void workerManager::del_Emp()
{
	if (this->m_fileisEmpty)
	{
		cout << "文件不存在或记录为空！" << endl;
	}
	else
	{
		//按照职工编号删除
		cout << "请输入想要删除职工的编号" << endl;
		int ID = 0;
		cin >> ID;
		int index = this->isExist(ID);
		if (index != -1) //职工存在，删除index位置上的职工
		{
			//数据迁移
			for (int i = index; i < this->m_empNum - 1; i++)
			{
				this->m_empArray[i] = this->m_empArray[i + 1];
			}
			this->m_empNum--; //更新数组中记录人员个数
			//数据同步更新到文件中
			this->save();
			cout << "删除成功" << endl;
		}
		else
		{
			cout << "删除失败，未找到该职工" << endl;
		}
	}
	//按任意键清屏
	system("pause");
	system("cls");
}

//判断职工是否存在，如果存在返回职工所在数组中的位置，不存在返回-1
int workerManager::isExist(int ID)
{
	int index = -1;
	for (int i = 0; i < this->m_empNum; i++)
	{
		if (this->m_empArray[i]->m_ID == ID)
		{
			//找到员工
			index = i;
			break;
		}
	}
	return index;
}

//修改职工
void workerManager::mod_Emp()
{
	if (this->m_fileisEmpty)
	{
		cout << "文件不存在或记录为空！" << endl;
	}
	else
	{
		cout << "请输入需要修改职工的编号：" << endl;
		int ID;
		cin >> ID;
		int ret = this->isExist(ID);
		if (ret != -1)
		{
			//查找到该编号的职工
			delete this->m_empArray[ret];
			int newID = 0;
			string newName = "";
			int dSelect = 0;
			cout << "查到：" << ID << "号职工，请输入新职工号：" << endl;
			cin >> newID;
			cout << "请输入新姓名：" << endl;
			cin >> newName;
			cout << "请选择新岗位" << endl;
			cout << "1、普通职工" << endl;
			cout << "2、经理" << endl;
			cout << "3、老板" << endl;
			cin >> dSelect;
			Worker* worker = NULL;
			switch (dSelect)
			{
			case 1:
				worker = new Employee(newID, newName, dSelect);
				break;
			case 2:
				worker = new Manager(newID, newName, dSelect);
				break;
			case 3:
				worker = new Boss(newID, newName, dSelect);
				break;
			default:
				break;
			}
			//更新数据到数组中
			this->m_empArray[ret] = worker;
			cout << "修改成功！" << endl;
			//保存到文件中
			this->save();
		}
		else
		{
			cout << "修改失败，查无此人" << endl;
		}
	}
	system("pause");
	system("cls");
}

//查找职工
void workerManager::find_Emp()
{
	if (this->m_fileisEmpty)
	{
		cout << "文件不存在或记录为空！" << endl;
	}
	else
	{
		cout << "请输入查找的方式：" << endl;
		cout << "1、按职工编号查找" << endl;
		cout << "2、按职工姓名查找" << endl;
		int select = 0;
		cin >> select;
		if (select == 1)
		{
			//按照编号查
			int ID;
			cout << "请输入查找的职工编号：" << endl;
			cin >> ID;
			int ret = this->isExist(ID);
			if (ret != -1)
			{
				//找到职工
				cout << "查找成功！该职工信息如下：" << endl;
				this->m_empArray[ret]->showInfo();
			}
			else
			{
				cout << "查找失败，查无此人" << endl;
			}
		}
		else if (select == 2)
		{
			//按照姓名查
			string Name;
			cout << "请输入查找的职工编号：" << endl;
			cin >> Name;
			//加入判断是否查到的标志
			bool flag = false;
			for (int i = 0; i < m_empNum; i++)
			{
				if (this->m_empArray[i]->m_Name == Name)
				{
					cout << "查找成功，该职工信息如下" << endl;
					this->m_empArray[i]->showInfo();
					flag = true;
				}
			}
			if (!flag)
			{
				cout << "查找失败，查无此人！" << endl;
			}
		}
		else
		{
			cout << "输入选项有误！" << endl;
		}
	}
	//按任意键清屏
	system("pause");
	system("cls");
}

//排序职工
void workerManager::sort_Emp()
{
	if (this->m_fileisEmpty)
	{
		cout << "文件不存在或记录为空！" << endl;
		system("pause");
		system("cls");
	}
	else
	{
		cout << "请选择排序方式：" << endl;
		cout << "1、按职工号进行升序" << endl;
		cout << "2、按职工号进行降序" << endl;
		int select = 0;
		cin >> select;
		if (select == 1 || select == 2)
		{
			this->quickSort(0, m_empNum - 1, select);
			this->save();
			cout << "排序成功，排序后结果为：" << endl;
			this->show_Emp();
		}
		else
		{
			cout << "输入选项有误！" << endl;
			system("pause");
			system("cls");
		}
	}
}

//排序算法
void workerManager::quickSort(int l, int r, int select)
{
	if (l >= r) return;
	int pivot = this->m_empArray[l]->m_ID;
	int i = l - 1, j = r + 1;
	if (select == 1)
	{
		while (i < j)
		{
			do i++; while (this->m_empArray[i]->m_ID < pivot);
			do j--; while (this->m_empArray[j]->m_ID > pivot);
			if (i < j)
			{
				swap(m_empArray[i], m_empArray[j]);
			}
		}
	}
	else
	{
		while (i < j)
		{
			do i++; while (this->m_empArray[i]->m_ID > pivot);
			do j--; while (this->m_empArray[j]->m_ID < pivot);
			if (i < j)
			{
				swap(m_empArray[i], m_empArray[j]);
			}
		}
	}
	quickSort(l, j, select);
	quickSort(j + 1, r, select);
}

//清空文件
void workerManager::clean_File()
{
	cout << "确认清空？" << endl;
	cout << "1、确认" << endl;
	cout << "2、返回" << endl;
	int select = 0;
	cin >> select;
	if (select == 1)
	{
		//确认清空
		ofstream ofs(FILENAME, ios::trunc); //删除文件后重新创建
		ofs.close();
		if (this->m_empArray != NULL)
		{
			//删除堆区的每个职工对象
			for (int i = 0; i < this->m_empNum; i++)
			{
				if (this->m_empArray[i] != NULL)
				{
					delete this->m_empArray[i];
				}
			}
			//删除堆区数组指针
			delete[] this->m_empArray;
			this->m_empArray = NULL;
			this->m_empNum = 0;
			this->m_fileisEmpty = true;
		}
		cout << "清空成功" << endl;
	}
	system("pause");
	system("cls");
}

workerManager::~workerManager()
{
	if (this->m_empArray != NULL)
	{
		for (int i = 0; i < this->m_empNum; i++)
		{
			if (this->m_empArray[i] != NULL)
			{
				delete this->m_empArray[i];
			}
		}
		delete[] this->m_empArray;
		this->m_empArray = NULL;
	}
}
```

### worker.h

```cpp
#pragma once
#include <iostream>
#include <string>
using namespace std;

//职工抽象基类
class Worker
{
public:
	//显示个人信息
	virtual void showInfo() = 0;
	//获取岗位名称
	virtual string getDeptName() = 0;

	int m_ID; //职工编号
	string m_Name; //职工信息
	int m_DeptID; //职工所在部门名称编号
};
```

### employee.h

```cpp
#pragma once
#include <iostream>
#include <string>
using namespace std;
#include "worker.h"

class Employee :public Worker
{
public:
	//构造函数
	Employee(int id, string, int did);

	//显示个人信息
	virtual void showInfo();
	
	//获取岗位名称
	virtual string getDeptName();
};
```

### employee.cpp

```cpp
#include "employee.h"

//构造函数
Employee::Employee(int id, string name, int did)
{
	this->m_ID = id;
	this->m_Name = name;
	this->m_DeptID = did;
}

//显示个人信息
void Employee::showInfo()
{
	cout << "职工编号：" << this->m_ID
		<< "\t职工姓名：" << this->m_Name
		<< "\t岗位：" << this->getDeptName()
		<< "\t岗位职责：完成经理交给的任务" << endl;
}

//获取岗位名称
string Employee::getDeptName()
{
	return string("员工");
}
```

### manager.h

```cpp
#pragma once
#include <iostream>
#include <string>
using namespace std;
#include "worker.h"

class Manager :public Worker
{
public:
	//构造函数
	Manager(int id, string, int did);

	//显示个人信息
	virtual void showInfo();

	//获取岗位名称
	virtual string getDeptName();
};
```

### manager.cpp

```cpp
#include "manager.h"

//构造函数
Manager::Manager(int id, string name, int did)
{
	this->m_ID = id;
	this->m_Name = name;
	this->m_DeptID = did;
}

//显示个人信息
void Manager::showInfo()
{
	cout << "职工编号：" << this->m_ID
		<< "\t职工姓名：" << this->m_Name
		<< "\t岗位：" << this->getDeptName()
		<< "\t岗位职责：完成老板交给的任务，并下发任务给员工" << endl;
}

//获取岗位名称
string Manager::getDeptName()
{
	return string("经理");
}
```

### boss.h

```cpp
#pragma once
#include <iostream>
#include <string>
using namespace std;
#include "worker.h"

class Boss :public Worker
{
public:
	//构造函数
	Boss(int id, string, int did);

	//显示个人信息
	virtual void showInfo();

	//获取岗位名称
	virtual string getDeptName();

};
```

### boss.cpp

```cpp
#include "boss.h"

//构造函数
Boss::Boss(int id, string name, int did)
{
	this->m_ID = id;
	this->m_Name = name;
	this->m_DeptID = did;
}

//显示个人信息
void Boss::showInfo()
{
	cout << "职工编号：" << this->m_ID
		<< "\t职工姓名：" << this->m_Name
		<< "\t岗位：" << this->getDeptName()
		<< "\t岗位职责：管理公司所有事务" << endl;
}

//获取岗位名称
string Boss::getDeptName()
{
	return string("老板");
}
```

## 通用数组类模板案例

刚学完模板

### myArray.hpp

```cpp
#pragma once
#include <iostream>

using namespace std;

template<class T>
class MyArray
{
public:
	//构造函数
	MyArray(int capacity)
	{
		cout << "MyArray的构造函数调用" << endl;
		this->m_Capacity = capacity;
		this->m_Size = 0;
		this->pAddress = new T[this->m_Capacity];
	}

	//拷贝构造
	MyArray(const MyArray& arr)
	{
		cout << "MyArray的拷贝函数调用" << endl;
		this->m_Capacity = arr.m_Capacity;
		this->m_Size = arr.m_Size;
		//深拷贝
		this->pAddress = new T[arr.m_Capacity];
		for (int i = 0; i < this->m_Size; i++)
		{
			this->pAddress[i] = arr.pAddress[i];
		}
	}

	//尾插法
	void Push_Back(const T& value)
	{
		cout << "尾插法存入" << endl;
		//判断容量是否等于大小
		if (this->m_Capacity == this->m_Size)
		{
			return;
		}
		this->pAddress[this->m_Size] = value;
		this->m_Size++;
	}

	//尾删法
	void Pop_Back()
	{
		cout << "尾插法调用" << endl;
		if (this->m_Size == 0)
		{
			return;
		}
		this->m_Size--;
	}

	//通过下标方式访问数组中的元素
	T& operator[](int index)
	{
		return this->pAddress[index];
	}

	//返回数组容量
	int getCapacity()
	{
		return this->m_Capacity;
	}
	//返回数组大小
	int getSize()
	{
		return this->m_Size;
	}

	//析构函数
	~MyArray()
	{
		cout << "MyArray的析构函数调用" << endl;
		if (this->pAddress != NULL)
		{
			delete[] this->pAddress;
			this->pAddress = NULL;
		}
	}

	//operator=防止浅拷贝问题
	MyArray& operator=(const MyArray& arr)
	{
		cout << "MyArray的operator=函数调用" << endl;
		//先判断是否有数据，若有则先释放
		if (this->pAddress != NULL)
		{
			delete[] this->pAddress;
			this->pAddress = NULL;
			this->m_Capacity = 0;
			this->m_Size = 0;
		}

		//深拷贝
		this->m_Capacity = arr.m_Capacity;
		this->m_Size = arr.m_Size;
		this->pAddress = new T[arr.m_Capacity];
		for (int i = 0; i < this->m_Size; i++)
		{
			this->pAddress[i] = arr.pAddress[i];
		}
		return *this;
	}



private:
	//指向堆区开辟的真实数组的指针
	T* pAddress;
	//数组容量
	int m_Capacity;
	//数组大小
	int m_Size;

};
```

### 数组类封装.cpp

```cpp
#include <iostream>
#include <string>
#include "myArray.hpp"

using namespace std;

void test01()
{
	MyArray<int> arr1(5);

	MyArray<int> arr2(arr1);

	MyArray<int> arr3(100);
	arr3 = arr1;

	for (int i = 0; i < 5; i++)
	{
		arr1.Push_Back(i);
	}
	for (int i = 0; i < 5; i++)
	{
		arr1.Pop_Back();
		cout << "当前数组容量：" << arr1.getCapacity() << endl;
		cout << "当前数组大小：" << arr1.getSize() << endl;
	}
}

//测试自定义数据类型
class Person
{
public:
	//需要声明默认构造函数，因为MyArray构造函数中new T[n]时会调用T类的无参构造函数来初始化这n个对象
	Person() {};
	Person(string name, int age)
	{
		this->m_Name = name;
		this->m_Age = age;
	}
	string m_Name;
	int m_Age;
};

void printPersonArray(MyArray<Person>& arr)
{
	for (int i = 0; i < arr.getSize(); i++)
	{
		cout << "姓名：" << arr[i].m_Name << " " << "年龄：" << arr[i].m_Age << endl;
	}
}

void test02()
{
	MyArray<Person> arr(10);

	Person p1("张三", 18);
	Person p2("李四", 19);
	Person p3("王五", 20);

	arr.Push_Back(p1);
	arr.Push_Back(p2);
	arr.Push_Back(p3);

	printPersonArray(arr);
}


int main()
{
	test01();
	test02();
	system("pause");
}
```

## 演讲比赛流程管理系统

依旧复健

### 演讲比赛流程管理系统.cpp

```cpp
#include <iostream>
#include "SpeechManager.h"

using namespace std;

int main()
{
	//创建管理类对象
	SpeechManager sm;

	int choice = 0;	//存储用户的选项

	while(true)
	{
		sm.show_Menu();

		cout << "请输入您的选择：" << endl;
		cin >> choice;	//接收用户的选项

		switch (choice)
		{
		case 1:	//开始比赛
			sm.startSpeech();
			break;
		case 2:	//查看记录
			sm.showRecord();
			break;
		case 3:	//清空记录
			sm.clearRecord();
			break;
		case 0:	//退出系统
			sm.exitSystem();
			break;
		default:
			system("cls");	//清屏
			break;
		}
	}

	system("pause");
	return 0;
}
```

### SpeechManager.h

```cpp
#pragma once
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <deque>
#include <algorithm>
#include <functional>
#include <numeric>
#include <random>
#include <fstream>
#include "speaker.h"

using namespace std;

//设计演讲比赛管理类
class SpeechManager
{
public:

	//构造函数
	SpeechManager();

	//菜单功能
	void show_Menu();

	//退出系统
	void exitSystem();

	//析构函数
	~SpeechManager();

	//初始化容器和属性
	void initSpeech();

	//创建12名选手
	void creatSpeaker();

	//开始比赛	比赛整个流程控制函数
	void startSpeech();

	//抽签
	void speechDraw();

	//比赛
	void speechContest();

	//显示比赛结果
	void showScore();

	//保存记录
	void saveRecord();

	//读取记录
	void loadRecord();

	//文件为空的标志
	bool fileisEmpty;

	//存放往届记录的容器
	map<int, vector<string>> m_Record;

	//显示往届得分
	void showRecord();

	//清空记录
	void clearRecord();

	//成员属性
	//保存第一轮比赛选手编号的容器
	vector<int> v1;

	//第一轮晋级选手编号容器
	vector<int> v2;

	//生出前三名选手编号容器
	vector<int> vVictory;

	//存放编号以及对应具体选手容器
	map<int, Speaker> m_Speaker;

	//存放比赛轮数
	int m_Index;

};
```

### SpeechManager.cpp

```cpp
#include "SpeechManager.h"

//构造函数
SpeechManager::SpeechManager()
{
	//初始化容器和属性
	this->initSpeech();

	//创建12名选手
	this->creatSpeaker();

	//加载往届记录
	this->loadRecord();
}

//展示菜单
void SpeechManager::show_Menu()
{
	cout << "**************************************" << endl;
	cout << "***********欢迎参加演讲比赛***********" << endl;
	cout << "************1.开始演讲比赛************" << endl;
	cout << "************2.查看往届记录************" << endl;
	cout << "************3.清空比赛记录************" << endl;
	cout << "************0.退出比赛程序************" << endl;
	cout << "**************************************" << endl;
	cout << endl;
}

//退出系统
void SpeechManager::exitSystem()
{
	cout << "欢迎下次使用" << endl;
	cout << endl;
	system("pause");
	exit(0);
}

//初始化容器和属性
void SpeechManager::initSpeech()
{
	//容器都置空
	this->v1.clear();
	this->v2.clear();
	this->vVictory.clear();
	this->m_Speaker.clear();

	//初始化比赛轮数
	this->m_Index = 1;

	//初始化记录容器
	this->m_Record.clear();
}

//创建12名选手
void SpeechManager::creatSpeaker()
{
	string nameSeed = "ABCDEFGHIJKL";
	for (int i = 0; i < nameSeed.size(); i++)
	{
		string name = "选手";
		name += nameSeed[i];

		//创建具体选手
		Speaker sp;
		sp.m_Name = name;

		for (int j = 0; j < 2; j++)
		{
			sp.m_Score[j] = 0;
		}

		//创建选手编号并放入到v1容器中
		this->v1.push_back(i + 10001);

		//选手编号以及对应选手放入到map容器中
		this->m_Speaker.insert(make_pair(i + 10001, sp));
	}
}

//开始比赛	比赛整个流程控制函数
void SpeechManager::startSpeech()
{
	//第一轮开始比赛
	//1、抽签
	this->speechDraw();
	//2、比赛
	this->speechContest();
	//3、显示晋级结果
	this->showScore();

	//第二轮开始比赛
	this->m_Index++;
	//1、抽签
	this->speechDraw();
	//2、比赛
	this->speechContest();
	//3、显示晋级结果
	this->showScore();
	//4、保存分数到文件中
	this->saveRecord();

	//重置比赛
	//初始化容器和属性
	this->initSpeech();
	//创建12名选手
	this->creatSpeaker();
	//加载往届记录
	this->loadRecord();
}

//抽签
void SpeechManager::speechDraw()
{
	cout << endl;
	cout << "-----------------------------第" << this->m_Index << "轮比赛选手正在抽签--------------------------" << endl;
	cout << "抽签后演讲顺序如下：" << endl;

	//创建随机数引擎
	random_device rd;
	mt19937 g(rd());

	if (this->m_Index == 1)
	{
		//第一轮比赛
		shuffle(v1.begin(), v1.end(), g);
		for (vector<int>::iterator it = v1.begin(); it != v1.end(); it++)
		{
			cout << *it << " ";
		}
		cout << endl;
	}
	else
	{
		//第二轮比赛
		shuffle(v2.begin(), v2.end(), g);
		for (vector<int>::iterator it = v2.begin(); it != v2.end(); it++)
		{
			cout << *it << " ";
		}
		cout << endl;
	}
	cout << "----------------------------------------------------------------------------" << endl;
	cout << endl;
	system("pause");
}

//比赛
void SpeechManager::speechContest()
{
	cout << endl;
	cout << "-----------------------------第" << this->m_Index << "轮比赛正式开始------------------------------" << endl;

	//准备临时容器存放小组成绩
	multimap<double, int, greater<double>> groupScore;
	int num = 0;	//记录人员个数 6人一组

	vector<int>v_Src;	//比赛选手容器
	if (this->m_Index == 1)
	{
		v_Src = v1;
	}
	else
	{
		v_Src = v2;
	}

	//遍历所有选手进行比赛
	for (vector<int>::iterator it = v_Src.begin(); it != v_Src.end(); it++)
	{
		num++;
		//评委大粪
		deque<double> d;
		for (int i = 0; i < 10; i++)
		{
			double score = (rand() % 401 + 600) / 10.f;
			d.push_back(score);
		}

		sort(d.begin(), d.end(), greater<double>());
		d.pop_front();
		d.pop_back();

		double sum = accumulate(d.begin(), d.end(), 0.0f);	//总分
		double avg = sum / (double)d.size();	//平均分

		//将平均分放入到map容器中
		this->m_Speaker[*it].m_Score[this->m_Index - 1] = avg;

		//将打分数据放入到临时小组容器中
		groupScore.insert(make_pair(avg, *it));	//key是得分，value是具体选手编号
		//每6人取出前三名
		if (num % 6 == 0)
		{
			cout << "第" << num / 6 << "小组比赛名次：" << endl;
			for (multimap<double, int, greater<double>>::iterator it = groupScore.begin(); it != groupScore.end(); it++)
			{
				cout << "编号：" << it->second << "姓名：" << this->m_Speaker[it->second].m_Name << "成绩：" << this->m_Speaker[it->second].m_Score[m_Index - 1] << endl;
			}
			//取走前三名
			int count = 0;
			for (multimap<double, int, greater<double>>::iterator it = groupScore.begin(); it != groupScore.end() && count < 3; it++, count++)
			{
				if (this->m_Index == 1)
				{
					v2.push_back((*it).second);
				}
				else
				{
					vVictory.push_back((*it).second);
				}
			}
			groupScore.clear();	//小组容器清空
			cout << endl;
		}
	}

	cout << "-----------------------------第" << this->m_Index << "轮比赛完毕----------------------------------" << endl; 
	cout << endl;
	system("pause");
}

//显示比赛结果
void SpeechManager::showScore()
{
	cout << endl;
	cout << "-----------------------------第" << this->m_Index << "轮晋级选手信息如下--------------------------" << endl;

	vector<int> v;
	if (this->m_Index == 1)
	{
		v = v2;
	}
	else
	{
		v = vVictory;
	}
	for (vector<int>::iterator it = v.begin(); it != v.end(); it++)
	{
		cout << "选手编号：" << *it << "姓名：" << this->m_Speaker[*it].m_Name << "得分：" << this->m_Speaker[*it].m_Score[this->m_Index - 1] << endl;
	}
	cout << "----------------------------------------------------------------------------" << endl;

	cout << endl;
	system("pause");
	system("cls");
	this->show_Menu();
}

//保存记录
void SpeechManager::saveRecord()
{
	ofstream ofs;
	ofs.open("speech.csv", ios::out | ios::app);	//以追加的方式写文件

	//将每个选手数据写到文件中
	for (vector<int>::iterator it = vVictory.begin(); it != vVictory.end(); it++)
	{
		ofs << *it << "," << m_Speaker[*it].m_Score[1] << ",";
	}
	ofs << endl;

	//关闭文件
	ofs.close();
	cout << "记录已保存" << endl;

	//更改文件不为空状态
	this->fileisEmpty = false;

	cout << endl;
	system("pause");
	system("cls");
}

//读取记录
void SpeechManager::loadRecord()
{
	ifstream ifs("speech.csv", ios::in);	//读文件

	if (!ifs.is_open())
	{
		this->fileisEmpty = true;
		ifs.close();
		return;
	}

	//文件清空情况
	char ch;
	ifs >> ch;
	if (ifs.eof())
	{
		this->fileisEmpty = true;
		ifs.close();
		return;
	}

	//文件不为空
	this->fileisEmpty = false;
	ifs.putback(ch);	//将上面读取的单个字符放回来

	string data;
	int index = 0;

	while (ifs >> data)
	{
		vector<string> v;	//存放6个string的字符串

		int pos = -1;	//查到","位置的变量
		int start = 0;

		while (true)
		{
			pos = data.find(",", start);
			if (pos == -1)
			{
				//没有找到情况
				break;
			}
			string temp = data.substr(start, pos - start);
			v.push_back(temp);
			start = pos + 1;
		}
		this->m_Record.insert(make_pair(index, v));
		index++;
	}

	ifs.close();
}

//显示往届得分
void SpeechManager::showRecord()
{
	if (this->fileisEmpty)
	{
		cout << "文件为空或文件不存在" << endl;
	}
	else
	{
		for (int i = 0; i < this->m_Record.size(); i++)
		{
			cout << "第" << i + 1 << "届" << " "
				<< "冠军编号：" << this->m_Record[i][0] << " 得分：" << this->m_Record[i][1] << "  "
				<< "亚军编号：" << this->m_Record[i][2] << " 得分：" << this->m_Record[i][3] << "  "
				<< "季军编号：" << this->m_Record[i][4] << " 得分：" << this->m_Record[i][5] << endl;
		}
	}

	cout << endl;
	system("pause");
	system("cls");
}

//清空记录
void SpeechManager::clearRecord()
{
	cout << endl;
	cout << "确认清空？" << endl;
	cout << "1、确认" << endl;
	cout << "2、返回" << endl;
	cout << "请输入您的选择：" << endl;

	int select = 0;
	cin >> select;

	if (select == 1)
	{
		//确认清空
		ofstream ofs("speech.csv", ios::trunc);
		ofs.close();

		//初始化容器和属性
		this->initSpeech();

		//创建12名选手
		this->creatSpeaker();

		//加载往届记录
		this->loadRecord();

		cout << "清空成功！" << endl;
	}
	
	cout << endl;
	system("pause");
	system("cls");
}

//析构函数
SpeechManager::~SpeechManager()
{

}
```

### speaker.h

```cpp
#pragma once
#include <iostream>

using namespace std;

class Speaker
{
public:
	string m_Name;	//姓名
	double m_Score[2];	//分数	最多有两轮得分
};
```

## 机房预约系统

学完黑马程序员的C++了，完结撒花

### 机房预约系统.cpp

```cpp
#include <iostream>
#include <fstream>

#include "Identity.h"
#include "student.h"
#include "teacher.h"
#include "manager.h"
#include "globalFile.h"

//进入学生子菜单界面
void studentMenu(Identity*& student)
{
	while (true)
	{
		//调用学生子菜单
		student->openMenu();

		//将父类指针转为子类指针，调用子类里其他接口
		Student* stu = (Student*)student;

		int select = 0;	//接收用户选择

		std::cin >> select;

		if (select == 1)
		{
			//申请预约
			stu->applyOrder();
		}
		else if (select == 2)
		{
			//查看自身预约
			stu->showmyOrder();
		}
		else if (select == 3)
		{
			//查看所有人预约
			stu->showallOrder();
		}
		else if (select == 4)
		{
			//取消预约
			stu->cancelOrder();
		}
		else if (select == 0)
		{
			//注销登录
			delete student;	//销毁堆区对象
			std::cout << "注销成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("cls");
		}
	}
}

//进入教师子菜单界面
void teacherMenu(Identity*& teacher)
{
	while (true)
	{
		//调用教师子菜单
		teacher->openMenu();

		//将父类指针转为子类指针，调用子类里其他接口
		Teacher* tea = (Teacher*)teacher;

		int select = 0;	//接收用户选择

		std::cin >> select;

		if (select == 1)
		{
			//查看所有预约
			tea->showallOrder();
		}
		else if (select == 2)
		{
			//审核预约
			tea->validOrder();
		}
		else if (select == 0)
		{
			//注销登录
			delete teacher;	//销毁堆区对象
			std::cout << "注销成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("cls");

			return;
		}
	}
}

//进入管理员子菜单界面
void managerMenu(Identity*& manager)
{
	while (true)
	{
		//调用管理员子菜单
		manager->openMenu();

		//将父类指针转为子类指针，调用子类里其他接口
		Manager* man = (Manager*)manager;

		int select = 0;	//接收用户选择

		std::cin >> select;

		if (select == 1)
		{
			//添加账号
			man->addPerson();
		}
		else if (select == 2)
		{
			//查看账号
			man->showPerson();
		}
		else if (select == 3)
		{
			//查看机房信息
			man->showComputer();
		}
		else if (select == 4)
		{
			//清空预约记录
			man->clearFile();
		}
		else if (select == 0)
		{
			//注销登录
			delete manager;	//销毁堆区对象
			std::cout << "注销成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("cls");
		}
	}
}

//登录功能
void LoginIn(std::string fileName, int type)
{
	//父类指针，用于指向子类对象
	Identity* person = NULL;

	//读文件
	std::ifstream ifs;
	ifs.open(fileName, std::ios::in);

	//判断文件是否存在
	if (!ifs.is_open())
	{
		std::cout << "文件不存在" << std::endl;
		ifs.close();
		return;
	}

	//准备接收用户信息
	int id = 0;
	std::string name;
	std::string pwd;

	//判断身份
	if (type == 1)
	{
		std::cout << "请输入你的学号：";
		std::cin >> id;
	}
	else if (type == 2)
	{
		std::cout << "请输入您的职工号：";
		std::cin >> id;
	}

	std::cout << "请输入用户名：";
	std::cin >> name;

	std::cout << "请输入密码：";
	std::cin >> pwd;

	if (type == 1)
	{
		//学生身份验证
		int fId;	//从文件中读取的id号
		std::string fName;	//从文件中获取的姓名
		std::string fPwd;	//从文件中获取的密码
		while (ifs >> fId && ifs >> fName && ifs >> fPwd)
		{
			//与用户输入的信息做对比
			if (fId == id && fName == name && fPwd == pwd)
			{
				std::cout << "学生验证登录成功！" << std::endl;
				//登陆成功后按任意键进入学生界面
				std::cout << std::endl;
				system("pause");
				system("cls");
				//创建学生对象
				person = new Student(id, name, pwd);
				//进入学生身份的子菜单
				studentMenu(person);

				return;
			}
		}
	}
	else if (type == 2)
	{
		//教师身份验证
		int fId;	//从文件中读取的id号
		std::string fName;	//从文件中获取的姓名
		std::string fPwd;	//从文件中获取的密码
		while (ifs >> fId && ifs >> fName && ifs >> fPwd)
		{
			//与用户输入的信息做对比
			if (fId == id && fName == name && fPwd == pwd)
			{
				std::cout << "教师验证登录成功！" << std::endl;
				//登陆成功后按任意键进入教师界面
				std::cout << std::endl;
				system("pause");
				system("cls");
				//创建教师对象
				person = new Teacher(id, name, pwd);
				//进入教师身份的子菜单
				teacherMenu(person);
				
				return;
			}
		}
	}
	else if (type == 3)
	{
		//管理员身份验证
		std::string fName;	//从文件中获取的姓名
		std::string fPwd;	//从文件中获取的密码
		while (ifs >> fName && ifs >> fPwd)
		{
			//与用户输入的信息做对比
			if (fName == name && fPwd == pwd)
			{
				std::cout << "管理员验证登录成功！" << std::endl;
				//登陆成功后按任意键进入管理员界面
				std::cout << std::endl;
				system("pause");
				system("cls");
				//创建管理员对象
				person = new Manager(name, pwd);
				//进入管理员身份的子菜单
				managerMenu(person);

				return;
			}
		}
	}
	std::cout << "登陆验证失败" << std::endl;

	std::cout << std::endl;
	system("pause");
	system("cls");

	return;
}

int main()
{
	int select = 0;

	while (true)
	{
		std::cout << "===================  欢迎来到机房预约系统  ==================="<< std::endl;
		std::cout << std::endl << "请选择您的身份" << std::endl;
		std::cout << "\t\t ---------------------------- \n";
		std::cout << "\t\t|                            |\n";
		std::cout << "\t\t|         1.学生代表         |\n";
		std::cout << "\t\t|                            |\n";
		std::cout << "\t\t|         2.教    师         |\n";
		std::cout << "\t\t|                            |\n";
		std::cout << "\t\t|         3.管 理 员         |\n";
		std::cout << "\t\t|                            |\n";
		std::cout << "\t\t|         0.退    出         |\n";
		std::cout << "\t\t|                            |\n";
		std::cout << "\t\t ---------------------------- \n";
		std::cout << "请输入您的选择：";

		std::cin >> select;	//接收用户选择

		switch (select)
		{
		case 1:	//学生身份
			LoginIn(STUDENT_FILE, 1);
			break;
		case 2:	//老师身份
			LoginIn(TEACHER_FILE, 2);
			break;
		case 3:	//管理员身份
			LoginIn(MANAGER_FILE, 3);
			break;
		case 0:	//退出系统
			std::cout << "欢迎下次使用" << std::endl;
			std::cout << std::endl;
			system("pause");
			return 0;
			break;
		default:
			std::cout << "输入有误，请重新选择！" << std::endl;
			std::cout << std::endl;
			system("pause");
			system("cls");
			break;
		}

	}

	return 0;
}
```

### Identity.h

```cpp
#pragma once
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <algorithm>

#include "globalFile.h"
#include "computerRoom.h"
#include "orderFile.h"

//身份抽象类
class Identity
{
public:

	//操作菜单
	virtual void openMenu() = 0;

	std::string m_Name;	//用户名
	std::string m_Pwd;	//密码

};
```

### student.h

```cpp
#pragma once

#include "Identity.h"

//学生类
class Student :public Identity
{
public:
	//默认构造
	Student();

	//有参构造
	Student(int id, std::string name, std::string pwd);

	//菜单界面
	virtual void openMenu();

	//申请预约
	void applyOrder();

	//查看我的预约
	void showmyOrder();

	//查看所有预约
	void showallOrder();

	//取消预约
	void cancelOrder();

	//学生号
	int m_Id;

	//机房信息
	std::vector<computerRoom> vCom;

};
```

### student.cpp

```cpp
#include "student.h"

//默认构造
Student::Student()
{

}

//有参构造
Student::Student(int id, std::string name, std::string pwd)
{
	//初始化学生信息
	this->m_Id = id;
	this->m_Name = name;
	this->m_Pwd = pwd;

	//初始化机房信息
	std::ifstream ifs;
	ifs.open(COMPUTER_FILE, std::ios::in);
	computerRoom com;
	while (ifs >> com.m_ComId && ifs >> com.m_MaxCap)
	{
		vCom.push_back(com);
	}
	ifs.close();
}

//菜单界面
void Student::openMenu()
{
	std::cout << "=====================  欢迎学生代表登录  =====================" << std::endl;
	std::cout << std::endl << "您好，" << this->m_Name << "！请选择您的操作" << std::endl;
	std::cout << "\t\t ---------------------------- \n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      1.申  请  预  约      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      2.查看 自身 预约      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      3.查看所有人预约      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      4.取  消  预  约      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      0.注  销  登  录      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t ---------------------------- \n";
	std::cout << "请输入您的选择：";
}

//申请预约
void Student::applyOrder()
{
	int date = 0;	//日期
	std::cout << std::endl << "机房开放时间为周一至周五！" << std::endl;
	std::cout << "请选择申请预约的时间" << std::endl;
	std::cout << "1.周一" << std::endl;
	std::cout << "2.周二" << std::endl;
	std::cout << "3.周三" << std::endl;
	std::cout << "4.周四" << std::endl;
	std::cout << "5.周五" << std::endl;
	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> date;
		if (date >= 1 && date <= 5)
		{
			break;
		}
		else if (date == 0)
		{
			std::cout << "返回成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("Cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	int interval = 0;	//时间段
	std::cout << std::endl << "请选择申请预约的时间段" << std::endl;
	std::cout << "1.上午" << std::endl;
	std::cout << "2.下午" << std::endl;
	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> interval;
		if (interval >= 1 && interval <= 2)
		{
			break;
		}
		else if (interval == 0)
		{
			std::cout << "返回成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("Cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	int room = 0;	//机房编号
	std::cout << std::endl << "请选择申请预约的机房编号" << std::endl;
	for (int i = 0; i < vCom.size(); i++)
	{
		std::cout << vCom[i].m_ComId << "号机房容量为：" << vCom[i].m_MaxCap << std::endl;
	}
	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> room;
		if (room >= 1 && room <= vCom.size())
		{
			break;
		}
		else if (room == 0)
		{
			std::cout << "返回成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("Cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	std::cout << "预约成功！请耐心等待审核" << std::endl;

	std::ofstream ofs;
	ofs.open(ORDER_FILE, std::ios::app);
	ofs << "date:" << date << " ";
	ofs << "interval:" << interval << " ";
	ofs << "stuID:" << this->m_Id << " ";
	ofs << "stuName:" << this->m_Name << " ";
	ofs << "roomID:" << room << " ";
	ofs << "status:" << 1 << std::endl;
	ofs.close();

	std::cout << std::endl;
	system("pause");
	system("cls");
}

//查看我的预约
void Student::showmyOrder()
{
	OrderFile of;
	if (of.m_Size == 0)
	{
		std::cout << "无预约记录！" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("cls");
		
		return;
	}

	std::string weekdays[] = {"","周一","周二","周三","周四","周五"};
	for (int i = 0; i < of.m_Size; i++)
	{
		if (this->m_Id == stoi(of.m_orderData[i]["stuID"]))
		{
			std::cout << "预约日期：" << weekdays[stoi(of.m_orderData[i]["date"])];
			std::cout << "  时间段：" << (of.m_orderData[i]["interval"] == "1" ? "上午" : "下午");
			std::cout << "  机房号：" << of.m_orderData[i]["roomID"];
			std::string status = "  状态：";
			if (of.m_orderData[i]["status"] == "1")
			{
				status += "审核中";
			}
			else if (of.m_orderData[i]["status"] == "2")
			{
				status += "预约成功";
			}
			else if (of.m_orderData[i]["status"] == "-1")
			{
				status += "审核未通过";
			}
			else if (of.m_orderData[i]["status"] == "0")
			{
				status += "预约已取消";
			}
			std::cout << status << std::endl;
		}
	}

	std::cout << std::endl;
	system("pause");
	system("cls");

	return;
}

//查看所有预约
void Student::showallOrder()
{
	OrderFile of;
	if (of.m_Size == 0)
	{
		std::cout << "无预约记录！" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("cls");

		return;
	}

	std::string weekdays[] = { "","周一","周二","周三","周四","周五" };
	for (int i = 0; i < of.m_Size; i++)
	{
		std::cout << i + 1 << ".";
		std::cout << "预约日期：" << weekdays[stoi(of.m_orderData[i]["date"])];
		std::cout << "  时间段：" << (of.m_orderData[i]["interval"] == "1" ? "上午" : "下午");
		std::cout << "  学号：" << of.m_orderData[i]["stuID"];
		std::cout << "  姓名：" << of.m_orderData[i]["stuName"];
		std::cout << "  机房号：" << of.m_orderData[i]["roomID"];
		std::string status = "  状态：";
		if (of.m_orderData[i]["status"] == "1")
		{
			status += "审核中";
		}
		else if (of.m_orderData[i]["status"] == "2")
		{
			status += "预约成功";
		}
		else if (of.m_orderData[i]["status"] == "-1")
		{
			status += "审核未通过";
		}
		else if (of.m_orderData[i]["status"] == "0")
		{
			status += "预约已取消";
		}
		std::cout << status << std::endl;
	}

	std::cout << std::endl;
	system("pause");
	system("cls");

	return;
}


//取消预约
void Student::cancelOrder()
{
	OrderFile of;
	if (of.m_Size == 0)
	{
		std::cout << "无预约记录！" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("cls");

		return;
	}
	std::cout << "审核中或预约成功的记录可以取消，请选择您要取消的预约记录" << std::endl;

	std::vector<int> v;
	int index = 1;
	std::string weekdays[] = { "","周一","周二","周三","周四","周五" };
	for (int i = 0; i < of.m_Size; i++)
	{
		//判断是否是自身学号
		if (this->m_Id == stoi(of.m_orderData[i]["stuID"]))
		{
			//筛选状态
			if (of.m_orderData[i]["status"] == "1" || of.m_orderData[i]["status"] == "2")
			{
				v.push_back(i);
				std::cout << index++ << ".";
				std::cout << "预约日期：" << weekdays[stoi(of.m_orderData[i]["date"])];
				std::cout << "  时间段：" << (of.m_orderData[i]["interval"] == "1" ? "上午" : "下午");
				std::cout << "  机房号：" << of.m_orderData[i]["roomID"];
				std::string status = "  状态：";
				if (of.m_orderData[i]["status"] == "1")
				{
					status += "审核中";
				}
				else if (of.m_orderData[i]["status"] == "2")
				{
					status += "预约成功";
				}
				std::cout << status << std::endl;
			}
		}
	}

	int select = 0;

	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> select;
		if (select > 0 && select <= v.size())
		{
			of.m_orderData[v[select - 1]]["status"] = "0";
			of.updateOrder();
			std::cout << "取消预约成功" << std::endl;
			break;
		}
		else if (select == 0)
		{
			std::cout << "返回成功" << std::endl;
			break;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	std::cout << std::endl;
	system("pause");
	system("cls");

	return;
}
```

### teacher.h

```cpp
#pragma once

#include "Identity.h"

//教师类
class Teacher :public Identity
{
public:
	//默认构造
	Teacher();

	//有参构造
	Teacher(int empId, std::string name, std::string pwd);

	//菜单界面
	virtual void openMenu();

	//查看所有预约
	void showallOrder();

	//审核预约
	void validOrder();

	//职工号
	int m_EmpId;

};
```

### teacher.cpp

```cpp
#include "teacher.h"

//默认构造
Teacher::Teacher()
{

}

//有参构造
Teacher::Teacher(int empId, std::string name, std::string pwd)
{
	//初始化教师信息
	this->m_EmpId = empId;
	this->m_Name = name;
	this->m_Pwd = pwd;
}

//菜单界面
void Teacher::openMenu()
{
	std::cout << "=======================  欢迎教师登录  =======================" << std::endl;
	std::cout << std::endl << "您好，" << this->m_Name << "！请选择您的操作" << std::endl;
	std::cout << "\t\t ---------------------------- \n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      1.查看 所有 预约      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      2.审  核  预  约      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|      0.注  销  登  录      |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t ---------------------------- \n";
	std::cout << "请输入您的选择：";
}

//查看所有预约
void Teacher::showallOrder()
{
	OrderFile of;
	if (of.m_Size == 0)
	{
		std::cout << "无预约记录！" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("cls");

		return;
	}

	std::string weekdays[] = { "","周一","周二","周三","周四","周五" };
	for (int i = 0; i < of.m_Size; i++)
	{
		std::cout << i + 1 << ".";
		std::cout << "预约日期：" << weekdays[stoi(of.m_orderData[i]["date"])];
		std::cout << "  时间段：" << (of.m_orderData[i]["interval"] == "1" ? "上午" : "下午");
		std::cout << "  学号：" << of.m_orderData[i]["stuID"];
		std::cout << "  姓名：" << of.m_orderData[i]["stuName"];
		std::cout << "  机房号：" << of.m_orderData[i]["roomID"];
		std::string status = "  状态：";
		if (of.m_orderData[i]["status"] == "1")
		{
			status += "审核中";
		}
		else if (of.m_orderData[i]["status"] == "2")
		{
			status += "预约成功";
		}
		else if (of.m_orderData[i]["status"] == "-1")
		{
			status += "审核未通过";
		}
		else if (of.m_orderData[i]["status"] == "0")
		{
			status += "预约已取消";
		}
		std::cout << status << std::endl;
	}

	std::cout << std::endl;
	system("pause");
	system("cls");

	return;
}

//审核预约
void Teacher::validOrder()
{
	OrderFile of;
	if (of.m_Size == 0)
	{
		std::cout << "无预约记录！" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("cls");

		return;
	}
	std::cout << "待审核的预约记录如下，请选择您要审核的预约记录" << std::endl;

	std::vector<int> v;
	int index = 1;
	std::string weekdays[] = { "","周一","周二","周三","周四","周五" };
	for (int i = 0; i < of.m_Size; i++)
	{
		//筛选状态
		if (of.m_orderData[i]["status"] == "1")
		{
			v.push_back(i);
			std::cout << index++ << ".";
			std::cout << "预约日期：" << weekdays[stoi(of.m_orderData[i]["date"])];
			std::cout << "  时间段：" << (of.m_orderData[i]["interval"] == "1" ? "上午" : "下午");
			std::cout << "  机房号：" << of.m_orderData[i]["roomID"];
			std::cout << "  状态：审核中" << std::endl;
		}
	}

	int select = 0;
	int ret = 0;

	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> select;
		if (select > 0 && select <= v.size())
		{
			std::cout << "请选择审核结果" << std::endl;
			std::cout << "1.通过" << std::endl;
			std::cout << "2.不通过" << std::endl;
			std::cout << std::endl << "0代表返回，请输入您的选择：";
			std::cin >> ret;

			if (ret == 1)
			{
				of.m_orderData[v[select - 1]]["status"] = "2";
				std::cout << "审核完毕" << std::endl;
				of.updateOrder();
				break;
			}
			else if (ret == 2)
			{
				of.m_orderData[v[select - 1]]["status"] = "-1";
				std::cout << "审核完毕" << std::endl;
				of.updateOrder();
				break;
			}
			else if (ret == 0)
			{
				std::cout << "返回成功" << std::endl;

				std::cout << std::endl;
				system("pause");
				system("Cls");

				return;
			}
			else
			{
				std::cout << "输入有误，请重新选择！" << std::endl;
			}
		}
		else if (select == 0)
		{
			std::cout << "返回成功" << std::endl;
			break;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	std::cout << std::endl;
	system("pause");
	system("cls");

	return;
}
```

### manager.h

```cpp
#pragma once

#include "Identity.h"
#include "student.h"
#include "teacher.h"

//管理员类
class Manager :public Identity
{
public:
	//默认构造
	Manager();

	//有参构造
	Manager(std::string name, std::string pwd);

	//菜单界面
	virtual void openMenu();

	//添加账号
	void addPerson();

	//查看账号
	void showPerson();

	//查看机房信息
	void showComputer();

	//清空预约记录
	void clearFile();

	//初始化容器
	void initVector();

	//检测重复
	bool checkRepeat(int id, int type);

	//学生容器
	std::vector<Student> vStu;

	//教师容器
	std::vector<Teacher> vTea;

	//机房信息
	std::vector<computerRoom> vCom;

};
```

### manager.cpp

```cpp
#include "manager.h"

//默认构造
Manager::Manager()
{

}

//有参构造
Manager::Manager(std::string name, std::string pwd)
{
	//初始化管理员信息
	this->m_Name = name;
	this->m_Pwd = pwd;

	//初始化容器
	this->initVector();

	//初始化机房信息
	std::ifstream ifs;
	ifs.open(COMPUTER_FILE, std::ios::in);
	computerRoom com;
	while (ifs >> com.m_ComId && ifs >> com.m_MaxCap)
	{
		vCom.push_back(com);
	}
	ifs.close();
}

//菜单界面
void Manager::openMenu()
{
	std::cout << "======================  欢迎管理员登录  ======================" << std::endl;
	std::cout << std::endl << "您好，" << this->m_Name << "！请选择您的操作" << std::endl;
	std::cout << "\t\t ---------------------------- \n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|         1.添加账号         |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|         2.查看账号         |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|         3.查看机房         |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|         4.清空预约         |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t|         0.注销登录         |\n";
	std::cout << "\t\t|                            |\n";
	std::cout << "\t\t ---------------------------- \n";
	std::cout << "请输入您的选择：";
}

//添加账号
void Manager::addPerson()
{
	std::cout << "请选择添加账号的类型" << std::endl;
	std::cout << "1.添加学生" << std::endl;
	std::cout << "2.添加老师" << std::endl;

	std::string fileName;	//操作文件名
	std::string tip;	//提示id号
	std::string errorTip;	//错误提示
	std::ofstream ofs;	//文件操作对象

	int select = 0;	//接收用户选择
	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> select;
		if (select == 1 || select == 2)
		{
			break;
		}
		else if (select == 0)
		{
			std::cout << "返回成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("Cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	if (select == 1)
	{
		//添加的是学生
		fileName = STUDENT_FILE;
		tip = "0代表返回，请输入学号：";
		errorTip = "0代表返回，学号重复，请重新输入学号：";
	}
	else if (select == 2)
	{
		fileName = TEACHER_FILE;
		tip = "0代表返回，请输入职工号：";
		errorTip = "0代表返回，职工号重复，请重新输入职工号：";
	}

	//利用追加的方式写文件
	ofs.open(fileName, std::ios::out | std::ios::app);

	int id;	//学号或职工号
	std::string name;	//姓名
	std::string pwd;	//职工号

	std::cout << std::endl << tip;
	while (true)
	{
		std::cin >> id;
		if (id == 0)
		{
			std::cout << "返回成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("Cls");

			return;
		}
		bool ret = checkRepeat(id, select);
		if (ret)	//有重复情况
		{
			std::cout << std::endl << errorTip;
		}
		else
		{
			break;
		}
	}

	std::cout << std::endl << "0代表返回，请输入姓名：";
	std::cin >> name;
	if (name == "0")
	{
		std::cout << "返回成功" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("Cls");

		return;
	}

	std::cout << std::endl << "0代表返回，请输入密码：";
	std::cin >> pwd;
	if (pwd == "0")
	{
		std::cout << "返回成功" << std::endl;

		std::cout << std::endl;
		system("pause");
		system("Cls");

		return;
	}

	//向文件中添加数据
	ofs << id << " " << name << " " << pwd << " " << std::endl;
	std::cout << "添加成功！" << std::endl;

	std::cout << std::endl;
	system("pause");
	system("cls");

	ofs.close();

	//初始化容器
	this->initVector();
}

//基础打印函数
void printStudent(Student& s)
{
	std::cout << "学号：" << s.m_Id << "  姓名：" << s.m_Name << "  密码：" << s.m_Pwd << std::endl;
}

void printTeacher(Teacher& t)
{
	std::cout << "职工号：" << t.m_EmpId << "  姓名：" << t.m_Name << "  密码：" << t.m_Pwd << std::endl;
}

//查看账号
void Manager::showPerson()
{
	std::cout << "请选择要查看的内容" << std::endl;
	std::cout << "1.查看所有学生" << std::endl;
	std::cout << "2.查看所有老师" << std::endl;

	int select = 0;	//接收用户选择
	while (true)
	{
		std::cout << std::endl << "0代表返回，请输入您的选择：";
		std::cin >> select;
		if (select == 1 || select == 2)
		{
			break;
		}
		else if (select == 0)
		{
			std::cout << "返回成功" << std::endl;

			std::cout << std::endl;
			system("pause");
			system("Cls");

			return;
		}
		else
		{
			std::cout << "输入有误，请重新选择！" << std::endl;
		}
	}

	if (select == 1)
	{
		//查看学生
		std::cout << "所有学生信息如下：" << std::endl;
		for_each(vStu.begin(), vStu.end(), printStudent);
	}
	else if (select == 2)
	{
		//查看教师
		std::cout << "所有教师信息如下：" << std::endl;
		for_each(vTea.begin(), vTea.end(), printTeacher);
	}

	std::cout << std::endl;
	system("pause");
	system("cls");
}

//查看机房信息
void Manager::showComputer()
{
	std::cout << "机房信息如下：" << std::endl;
	for (std::vector<computerRoom>::iterator it = vCom.begin(); it != vCom.end(); it++)
	{
		std::cout << "机房编号：" << it->m_ComId << "  机房最大容量：" << it->m_MaxCap << std::endl;
	}

	std::cout << std::endl;
	system("pause");
	system("cls");
}

//清空预约记录
void Manager::clearFile()
{
	std::ofstream ofs(ORDER_FILE, std::ios::trunc);
	ofs.close();
	std::cout << "清空成功" << std::endl;
	
	std::cout << std::endl;
	system("pause");
	system("cls");
}

//初始化容器
void Manager::initVector()
{
	//确保文件清空状态
	vStu.clear();
	vTea.clear();

	std::ifstream ifs;

	//读取学生信息
	ifs.open(STUDENT_FILE, std::ios::in);
	if (!ifs.is_open())
	{
		std::cout << "文件读取失败" << std::endl;
		return;
	}
	Student s;
	while (ifs >> s.m_Id && ifs >> s.m_Name && ifs >> s.m_Pwd)
	{
		vStu.push_back(s);
	}
	ifs.close();

	//读取老师信息
	ifs.open(TEACHER_FILE, std::ios::in);
	if (!ifs.is_open())
	{
		std::cout << "文件读取失败" << std::endl;
		return;
	}
	Teacher t;
	while (ifs >> t.m_EmpId && ifs >> t.m_Name && ifs >> t.m_Pwd)
	{
		vTea.push_back(t);
	}
	ifs.close();
}

//检测重复
bool Manager::checkRepeat(int id, int type)
{
	if (type == 1)
	{
		//检测学生
		for (std::vector<Student>::iterator it = vStu.begin(); it != vStu.end(); it++)
		{
			if (id == it->m_Id)
			{
				return true;
			}
		}
	}
	else if (type == 2)
	{
		//检测老师
		for (std::vector<Teacher>::iterator it = vTea.begin(); it != vTea.end(); it++)
		{
			if (id == it->m_EmpId)
			{
				return true;
			}
		}
	}
	return false;
}
```

### globalFile.h

```cpp
#pragma once

//学生文件
#define STUDENT_FILE	"student.txt"
//教师文件
#define TEACHER_FILE	"teacher.txt"
//管理员文件
#define MANAGER_FILE	"manager.txt"
//机房信息文件
#define COMPUTER_FILE	"computerRoom.txt"
//订单文件
#define ORDER_FILE		"order.txt"
```

### computerRoom.h

```cpp
#pragma once

//机房类
class computerRoom
{
public:
	//机房号
	int m_ComId;

	//机房最大容量
	int m_MaxCap;

};
```

### orderFile.h

```cpp
#pragma once
#include <iostream>
#include <fstream>
#include <string>
#include <map>

#include "globalFile.h"

class OrderFile
{
public:
	//构造函数
	OrderFile();

	//更新预约记录
	void updateOrder();

	//记录预约条数
	int m_Size;

	//记录所有预约信息的容器
	std::map<int, std::map<std::string, std::string>> m_orderData;

};
```

### orderFile.cpp

```cpp
#include "orderFile.h"

//基础解析函数
void extractKeyValue(const std::string& source, std::map<std::string, std::string>& m)
{
	size_t pos = source.find(":");
	if (pos != std::string::npos)
	{
		std::string key = source.substr(0, pos);
		std::string value = source.substr(pos + 1);
		m.insert(std::make_pair(key, value));
	}
}

//构造函数
OrderFile::OrderFile()
{
	std::ifstream ifs;
	ifs.open(ORDER_FILE, std::ios::in);

	std::string date;	//日期
	std::string interval;	//时间段
	std::string stuID;	//学生编号
	std::string stuName;	//学生姓名
	std::string roomID;	//机房编号
	std::string status;	//预约状态

	this->m_Size = 0;	//记录条数

	while (ifs >> date && ifs >> interval && ifs >> stuID && ifs >> stuName && ifs >> roomID && ifs >> status)
	{
		std::map<std::string, std::string> m;

		extractKeyValue(date, m);
		extractKeyValue(interval, m);
		extractKeyValue(stuID, m);
		extractKeyValue(stuName, m);
		extractKeyValue(roomID, m);
		extractKeyValue(status, m);

		this->m_orderData.insert(make_pair(this->m_Size, m));
		this->m_Size++;
	}

	ifs.close();
}

//更新预约记录
void OrderFile::updateOrder()
{
	if (this->m_Size == 0)
	{
		return;
	}

	std::ofstream ofs(ORDER_FILE, std::ios::out | std::ios::trunc);
	for (int i = 0; i < this->m_Size; i++)
	{
		ofs << "date:" << this->m_orderData[i]["date"] << " ";
		ofs << "interval:" << this->m_orderData[i]["interval"] << " ";
		ofs << "stuID:" << this->m_orderData[i]["stuID"] << " ";
		ofs << "stuName:" << this->m_orderData[i]["stuName"] << " ";
		ofs << "roomID:" << this->m_orderData[i]["roomID"] << " ";
		ofs << "status:" << this->m_orderData[i]["status"] << std::endl;
	}
	ofs.close();
}
```
