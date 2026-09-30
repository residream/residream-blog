---
title: "C Course Project — Hospital Management System"
description: "C language course project: a development log for a hospital management system."
publishDate: "2026-04-03T23:13:36"
tags:
  - "c-cpp"
heroImage:
  src: ../../blog/his-course-design/location-unknown.jpg
  color: "#6A9796"
  alt: "C Course Project — Hospital Management System"
language: 'en'
draft: false
---

I've been busy with my course project lately, so I haven't updated the CTF writeups much. Also, after spending the entire winter break learning C++ OOP, I found out the second-semester project in my first year requires C + linked lists... Not being able to use inheritance made the code pretty verbose and repetitive, and I had to implement loading, saving, and freeing the linked lists myself. I finally appreciate the benefits of object-oriented programming. Because I haven't learned enough yet, the project currently only has a command-line interface — I probably won't be able to finish refactoring it into a GUI before the defense. Still, I've learned about raylib+raygui for pure C and Qt for C++, and I've also started using CMake for builds, Git for a more structured development workflow, paying attention to project structure, and so on. Hoping to keep improving from here.

**Project repository**

**[his-course-design](https://github.com/Residream/his-course-design)**

**README**

## HIS — Hospital Management System

> Jilin University (JLU) Class of 2025 "Fundamentals of Programming — Course Project" assignment
>
> A terminal-based Hospital Information System built in C, using linked-list data structures and pipe-delimited flat-file persistence. Supports login and business operations for three roles: patient, doctor, and admin.

### Platform support

| Platform | Compiler    | Status                    |
| -------- | ----------- | ------------------------- |
| Windows  | MinGW (GCC) | ✅ Primary dev environment |
| macOS    | Clang       | ✅ Primary dev environment |
| Linux    | GCC         | ✅ Verified                |
| Windows  | MSVC        | ✅ Adapted                 |

> Requires C11 support and CMake ≥ 3.10.

---

### Feature overview

#### Patient portal

| Module         | Features                                                                   |
| -------------- | -------------------------------------------------------------------------- |
| Account        | Self-registration, login, view/edit personal info                          |
| Appointment    | Book an appointment by department and doctor, view records, cancel         |
| Visit          | View visit records and diagnoses                                           |
| Examination    | View exam items and results                                                |
| Hospitalization| View admission/discharge records                                           |
| Prescription   | View prescription medication records (paginated)                           |

#### Doctor portal

| Module          | Features                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Account         | Login, view/edit personal info                                                                                               |
| Patient         | View patient info, view own appointment list                                                                                 |
| Consultation    | Accept visit, write diagnosis, order exams, write prescriptions, process admission/discharge, end visit (mark completed)      |
| Medical records | Full visit history of own patients, query by category, print by category (appointment/visit/exam/hospitalization/prescription) |
| Dispensing      | Dispense prescriptions (with department-permission and inventory double-check)                                                |

#### Admin portal

| Module                | Features                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Patient management    | CRUD (with fuzzy name search), paginated browsing                                                                                  |
| Doctor management     | CRUD (with fuzzy name/department search)                                                                                           |
| Department management | CRUD                                                                                                                               |
| Wards / Beds          | Ward management (ICU/General/VIP types with department association), batch bed creation and release                                 |
| Drug management       | Drug info (with fuzzy name search), pharmacy management, inventory restocking and dispensing                                        |
| Medical records       | Full patient visit history, query by category, delete by category, print by category (appointment/visit/exam/hospitalization/prescription — unified operations) |
| Data analysis         | Ward utilization, department outpatient trends, ward optimization suggestions, drug usage ranking and inventory alerts, length-of-stay distribution and prediction |

---

### Data model

The system contains 12 core entities, all organized as singly linked lists:

```text
Patient ──┐
          ├── Registration ── Visit ──┬── Exam
Doctor  ──┘                           ├── Prescription ── Drug
Department                            └── Hospitalization ── Ward ── Bed
Pharmacy ── PharmacyDrug ── Drug
```

Each entity corresponds to a `data/*.txt` file with `|`-delimited fields, one record per line. The file formats are:

| File                   | Field format                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ |
| `patients.txt`         | `id\|name\|gender\|age\|pwd_hash\|salt`                                        |
| `doctors.txt`          | `id\|name\|gender\|department\|pwd_hash\|salt`                                 |
| `admins.txt`           | `name\|pwd_hash\|salt`                                                         |
| `departments.txt`      | `name` (one department name per line)                                           |
| `registrations.txt`    | `reg_id\|p_id\|d_id\|when\|status`                                             |
| `visits.txt`           | `visit_id\|reg_id\|when\|status\|diagnosis`                                    |
| `exams.txt`            | `exam_id\|visit_id\|item\|result`                                              |
| `hospitalizations.txt` | `hosp_id\|visit_id\|p_id\|ward_id\|bed_id\|admit_date\|discharge_date\|status` |
| `wards.txt`            | `ward_id\|name\|type\|department\|capacity\|occupied`                          |
| `beds.txt`             | `bed_id\|ward_id\|bed_no\|status`                                              |
| `drugs.txt`            | `id\|generic_name\|trade_name\|alias\|price\|stock\|department`                |
| `pharmacies.txt`       | `id\|name\|location`                                                           |
| `pharmacy_drugs.txt`   | `pharmacy_id\|drug_id\|quantity`                                               |
| `prescriptions.txt`    | `pr_id\|visit_id\|d_id\|p_id\|drug_id\|dose\|frequency\|dispensed`             |

---

### Project structure

```text
HIS/
├── CMakeLists.txt                  CMake 构建配置
├── README.md
├── include/
│   ├── core/                       基础设施头文件
│   │   ├── config.h                    全局配置宏、数据文件路径、状态常量
│   │   ├── structs.h                   所有结构体定义（12 个实体）
│   │   ├── auth.h                      登录验证与患者注册
│   │   ├── session.h                   会话管理（角色、用户ID）
│   │   ├── sha256.h                    SHA-256 哈希算法
│   │   └── utils.h                     工具函数（输入、校验、文件安全写入、表格对齐）
│   ├── model/                      数据模型头文件
│   │   ├── patient.h                   患者
│   │   ├── doctor.h                    医生
│   │   ├── department.h                科室
│   │   ├── registration.h              挂号
│   │   ├── visit.h                     看诊
│   │   ├── exam.h                      检查
│   │   ├── hospitalization.h           住院
│   │   ├── ward.h                      病房
│   │   ├── bed.h                       床位
│   │   ├── drug.h                      药品与药房
│   │   ├── prescription.h              处方
│   │   ├── medical.h                   医疗记录跨表操作（全程查询、分类查询/删除/打印）
│   │   └── analytics.h                 数据分析模块常量与入口
│   └── ui/
│       └── menu.h                      菜单系统
├── src/
│   ├── core/                       基础设施实现
│   │   ├── main.c                      程序入口
│   │   ├── auth.c                      认证逻辑
│   │   ├── session.c                   会话状态管理
│   │   ├── sha256.c                    SHA-256 实现
│   │   ├── config.c                    状态文本数组定义
│   │   └── utils.c                     工具函数实现
│   ├── model/                      数据模型实现（加载/保存/CRUD/业务逻辑）
│   │   ├── patient.c, doctor.c, department.c
│   │   ├── registration.c, visit.c, exam.c
│   │   ├── hospitalization.c, ward.c, bed.c
│   │   ├── drug.c                      药品 + 药房 + 药房库存 + 发药业务
│   │   ├── prescription.c              处方管理
│   │   ├── medical.c                   医疗记录跨表聚合（全程查询、分类查询/删除/打印）
│   │   └── analytics.c                 数据分析报表与统计逻辑
│   └── ui/
│       └── menu.c                      三角色菜单驱动
├── data/                           数据文件（管道符分隔 .txt）
│   ├── patients.txt, doctors.txt, admins.txt
│   ├── departments.txt, registrations.txt, visits.txt
│   ├── exams.txt, hospitalizations.txt
│   ├── wards.txt, beds.txt
│   ├── drugs.txt, pharmacies.txt, pharmacy_drugs.txt
│   └── prescriptions.txt
├── tools/
│   └── gen_data.py                 测试数据生成脚本（Python）
└── build/                          构建产物（不入版本控制）
```

---

### Build and run

#### Build steps

```bash
cd HIS
mkdir build
cd build
cmake ..
cmake --build .
```

#### Run

```text
# 在 build 目录下运行
# Linux / macOS
./his

# Windows (GCC/MinGW)
./his.exe

# Windows (MSVC)
Debug\his.exe
```

> ⚠️ The executable must be run from the `build/` directory — the program accesses data files through the `../data/` relative path.

#### Default accounts

In the test data generated by `gen_data.py`, the admin username is `root` with password `root`. Patient passwords follow the pattern `p` + number (e.g. `p0001`), and doctor passwords follow the pattern `d` + number (e.g. `d0001`).

#### Test data generation

```bash
python tools/gen_data.py
```

The script automatically locates the `data/` directory under the project root, so it works correctly regardless of where it is run from. Generated data includes: 130 patients, 30 doctors, 5 departments, 8 wards (ICU/General/VIP types), 35 drugs, 3 pharmacies, and a complete chain of appointment → visit → exam → prescription → hospitalization with fully linked records.

---

### Technical implementation

#### Data storage and file replacement

- Each entity corresponds to a `.txt` file with `|`-delimited fields, one record per line
- Reads and writes go through linked lists: on load, lines are parsed one by one to build the list; on save, the list is traversed to write the file
- Writes are staged in a temporary file and committed with `rename` (`safe_fopen_tmp` → `safe_fclose_commit`), reducing the risk of leaving partially written file contents
- On Windows, the code calls `remove` before `rename` because the C runtime used here requires the destination to be absent. These two calls are not an atomic replacement: interruption between them can leave the destination missing

#### Multi-table coordination and rollback strategy

Several business operations involve coordinated changes across multiple tables. A uniform rollback strategy ensures data consistency:

**Operations involving multi-table coordination:**

| Operation                    | Linked tables                     |
| ---------------------------- | --------------------------------- |
| Admit / discharge            | hospitalizations + beds + wards   |
| Start consultation           | registrations + visits            |
| Add / delete beds            | beds + wards                      |
| Restock / dispense           | pharmacy_drugs + drugs            |
| Delete drug / pharmacy       | drugs/pharmacies + pharmacy_drugs |

**Rollback flow (admission as an example):**

```text
1. 快照: 保存修改前的床位状态、病房占用数等关键字段
2. 修改: 在内存中执行入院操作（新增住院记录、占用床位、增加病房计数）
3. 保存: 顺序写入 hospitalizations → beds → wards 三个文件
4. 校验: 若三个文件全部保存成功，则提交完成
5. 回滚: 若任一文件保存失败，从快照恢复内存状态，重新写入全部文件
6. 告警: 若回滚写入也失败，提示用户检查数据文件
```

> **Design limitation**: Multi-file saves are executed sequentially rather than atomically. If the process is killed (e.g. by a power outage) after file A has been written but before file B is written, inter-file inconsistency can occur. A thorough solution would require write-ahead logging (WAL) or two-phase commit, which is beyond the scope of this course project.

#### Data integrity constraints

Cascade safety checks are performed before deletions to prevent dangling references:

- Before deleting a department, check for associated doctors — refuse if any exist
- Before deleting a doctor, check for incomplete appointment records
- Before deleting a patient, check for incomplete appointments or active hospitalizations
- Before deleting a ward, check for associated bed records
- Before deleting a drug or pharmacy, check for associated `pharmacy_drugs` records — refuse if any exist; the records must first be removed one by one via "remove drug from pharmacy"
- Before deleting a drug, check for associated prescriptions — refuse if any exist
- System invariant enforced: `drug.stock = Σ pharmacy_drugs.quantity` — new drugs default to stock=0, increased only through "pharmacy restocking"; removing a drug from a pharmacy also decrements the global stock
- Refuse to delete an occupied bed
- Dispensing checks both pharmacy inventory and global drug stock to prevent negative inventory

#### Password security

- User passwords are stored after hashing with a 16-byte random salt + SHA-256
- On login, the hash is recomputed for comparison — plaintext passwords are never written to disk
- Patients must verify their old password before changing it
- Admin storage format: `name|hash|salt`; patient/doctor hashes and salts are embedded in their respective record fields

#### Session management

- Based on a global `Session` struct that records the currently logged-in role (patient / doctor / admin) and user ID
- On successful login, `session_set()` establishes the session; on logout, `session_clear()` clears it

#### Cross-table medical records module

The admin and doctor portals share a single medical records module (`model/medical.c`) for cross-entity aggregation queries and management:

| Feature                 | Description                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Full patient visit history | Given a patient ID, loads all linked lists at once and displays the patient's complete visit timeline: appointment → visit → exam → prescription → hospitalization |
| Query by category       | Independent query entry points for five categories (appointment/visit/exam/hospitalization/prescription), with unified multi-dimensional search (see below) |
| Delete by category      | Admin only — cascade checks before deletion (e.g. refuse to delete a visit that has prescriptions or exams)              |
| Print by category       | Browse all records of a category in a paginated table, with left/right to switch categories and up/down to page           |

**Role scoping**: The same entry function checks the caller's identity via `g_session.role`. The admin view shows all system records; the doctor view automatically filters to "own" records — only appointments, visits, exams, and prescriptions handled by the current doctor, plus the corresponding hospitalizations.

#### Query features

All five category queries under the medical records module use a unified four-dimensional search pattern:

| Query entry       | By ID (exact) | By patient name (fuzzy) | By doctor name (fuzzy) | Fourth dimension (fuzzy)                              |
| ----------------- | ------------- | ----------------------- | ---------------------- | ----------------------------------------------------- |
| Appointments      | reg_id        | ✓                       | ✓                      | By status (pending/completed/cancelled)               |
| Visits            | visit_id      | ✓                       | ✓                      | By status (in progress/completed)                     |
| Exams             | exam_id       | ✓                       | ✓                      | By exam item                                          |
| Hospitalizations  | hosp_id       | ✓                       | ✓                      | By status (admitted/discharged)                        |
| Prescriptions     | pr_id         | ✓                       | ✓                      | By drug name (generic/trade/alias)                    |

Other modules' queries:

- Patient query: by ID (exact) / by name (fuzzy)
- Doctor query: by ID (exact) / by name (fuzzy) / by department (fuzzy)
- Drug query: by ID / by name (generic/trade/alias) / by department (fuzzy)
- Fuzzy search is based on `strstr` substring matching, supporting display of multiple results

#### Data analysis

The admin portal provides five analysis modules, all based on linked-list traversal and in-memory aggregation:

| Module               | Analysis content                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Ward utilization     | Utilization overview (with progress bars), turnover rate, empty-bed ranking, average LOS   |
| Dept. outpatient trends | Appointment volume/completion/cancellation rate by department, trend percentages over time windows, top-N doctors by visit volume |
| Ward optimization    | Hospitalization stats per ward, department–ward distribution matrix, expansion/reduction/buffer recommendations |
| Drug usage           | Top-N usage ranking, estimated department drug expenditure, inventory alerts (by months of supply) |
| Length of stay       | Day-count distribution histogram, average days by ward, overdue inpatient alerts           |

#### Input safety

- Filters the pipe character `|` to prevent breaking the file delimiter format
- Comprehensive input validation: names allow only Chinese characters (UTF-8), age range 1–150 (with negative-number rejection), gender enumeration, option range checks, etc.
- Uses `safe_input()` for unified input-buffer handling, automatically clearing residual data
- All `strtok` parsing validates each field — malformed lines are silently skipped

#### Display

- Menu-driven interaction with paginated browsing (10 items per page)
- Adaptive-width table output with correct Chinese character width handling (UTF-8 double-width display)
- Unicode-bordered menu frames
- Data analysis modules support text-based visualization: tables, progress bars `[████░░░░]`, bar charts

#### Coding and style conventions

- Source files use UTF-8 encoding with LF line endings
- Comment style: standalone comments use `/* */`; trailing end-of-line comments use `//`
- Compiled against C11, passes `-Wall -Wextra -Werror` with zero warnings
- CMakeLists.txt supports GCC, Clang, and MSVC (auto-detected)
- If Chinese characters display as garbled text in Windows CMD/PowerShell, uncomment the `if(WIN32)` block in `CMakeLists.txt` to enable the `-fexec-charset=GBK` compiler option, then rebuild
