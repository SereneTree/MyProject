# 02 事务与 MVCC

> **难度**：⭐⭐⭐⭐⭐  
> **出现率**：95%+  
> **核心**：ACID → 隔离级别 → 三大读异常 → MVCC 实现原理

---

## 一、什么是事务？

事务（Transaction）是一组**不可分割的数据库操作**，要么全部成功，要么全部失败。

### 经典案例：转账

```sql
BEGIN;
  UPDATE account SET balance = balance - 100 WHERE id = 1;  -- A扣钱
  UPDATE account SET balance = balance + 100 WHERE id = 2;  -- B加钱
COMMIT;
```

如果中间崩溃，必须保证「A 没扣，B 没加」。

---

## 二、ACID 四大特性（必背）

| 特性 | 含义 | InnoDB 如何实现？ |
|------|------|------------------|
| **A** Atomicity 原子性 | 全做或全不做 | **undo log**（回滚） |
| **C** Consistency 一致性 | 数据从一个一致状态到另一个一致状态 | A+I+D 共同保证 |
| **I** Isolation 隔离性 | 并发事务互不干扰 | **锁 + MVCC** |
| **D** Durability 持久性 | 提交后永久保存 | **redo log**（崩溃恢复） |

**记忆口诀**：**「原一隔持」**。

### 面试金句
> A 由 undo log 实现，D 由 redo log 实现，I 由锁 + MVCC 实现，C 是最终目的，由 AID 共同保证。

---

## 三、并发事务的三大异常（必考）

### 3.1 脏读（Dirty Read）

> 读到了**其他事务还未提交**的数据。

```
T1: UPDATE balance = 0 WHERE id = 1;  (未提交)
T2: SELECT balance FROM account WHERE id = 1;  → 读到 0
T1: ROLLBACK;  → T2 读到了不存在的数据
```

### 3.2 不可重复读（Non-repeatable Read）

> 同一事务**两次读同一行**，结果不同（被其他事务 UPDATE）。

```
T1: SELECT balance FROM account WHERE id = 1;  → 100
T2: UPDATE account SET balance = 200 WHERE id = 1; COMMIT;
T1: SELECT balance FROM account WHERE id = 1;  → 200  ❌
```

### 3.3 幻读（Phantom Read）

> 同一事务**两次范围查询**，结果集不同（被其他事务 INSERT/DELETE）。

```
T1: SELECT * FROM order WHERE amount > 100;  → 5 条
T2: INSERT INTO order VALUES (...); COMMIT;
T1: SELECT * FROM order WHERE amount > 100;  → 6 条  ❌
```

**对比**：
- 不可重复读 → **行数据被修改**
- 幻读 → **行数变化（新增/删除）**

---

## 四、四种隔离级别（必背）

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 性能 |
|---------|------|-----------|------|------|
| 读未提交 (Read Uncommitted, RU) | ❌ | ❌ | ❌ | 最高 |
| 读已提交 (Read Committed, RC) | ✅ | ❌ | ❌ | 高 |
| **可重复读 (Repeatable Read, RR)** | ✅ | ✅ | ✅* | **中** |
| 串行化 (Serializable) | ✅ | ✅ | ✅ | 最低 |

> **MySQL InnoDB 默认 RR**，且**通过 Next-Key Lock 解决了幻读**（标准 RR 是不解决幻读的）。

### 设置方式

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT @@transaction_isolation;
```

---

## 五、MVCC 多版本并发控制（高频核心）

### 5.1 为什么需要 MVCC？

加锁可以保证一致性，但会让读写互相阻塞，**性能差**。MVCC 让 **读不加锁**，提升并发度。

> 一句话定义：**MVCC = 多版本 + 快照 + 一致性视图**

### 5.2 三个核心组件

#### ① 隐藏字段（每行 InnoDB 都有）

| 字段 | 作用 |
|------|------|
| `DB_TRX_ID` | 最近修改该行的事务 ID（6B） |
| `DB_ROLL_PTR` | 指向 undo log 中的前一个版本（7B） |
| `DB_ROW_ID` | 隐式主键（无主键时用）（6B） |

#### ② Undo log 版本链

每次 UPDATE，把旧值写入 undo log，新行的 `DB_ROLL_PTR` 指向旧版本：

```
当前数据 (trx_id=300)
   ↓ DB_ROLL_PTR
旧版本1 (trx_id=200)
   ↓
旧版本2 (trx_id=100)
   ↓
NULL
```

#### ③ ReadView 一致性视图

事务执行 `SELECT` 时生成 ReadView，包含：

| 字段 | 含义 |
|------|------|
| `m_ids` | 当前活跃（未提交）事务 ID 列表 |
| `min_trx_id` | m_ids 的最小值 |
| `max_trx_id` | 系统下一个待分配的事务 ID |
| `creator_trx_id` | 创建该 ReadView 的事务 ID |

### 5.3 可见性判断算法（核心）

对版本链上某行的 `trx_id`：

```
if trx_id == creator_trx_id:
    可见  # 自己改的当然能看到
elif trx_id < min_trx_id:
    可见  # 该事务在 ReadView 之前已提交
elif trx_id >= max_trx_id:
    不可见  # 该事务在 ReadView 之后才开始
elif trx_id in m_ids:
    不可见  # 该事务尚未提交
else:
    可见  # 已提交
```

不可见就**沿 DB_ROLL_PTR 找上一个版本**，直到找到可见版本或 NULL。

### 5.4 RC 与 RR 的关键区别

| 隔离级别 | ReadView 生成时机 |
|---------|-------------------|
| **RC** | **每次 SELECT 都生成新的** ReadView → 总能看到最新提交 → 不可重复读 |
| **RR** | **首次 SELECT 时生成，整个事务复用** → 读到的永远一致 → 解决不可重复读 |

---

## 六、当前读 vs 快照读

| 读类型 | 触发场景 | 走 MVCC？ |
|-------|---------|-----------|
| **快照读** | 普通 `SELECT` | ✅ 走 ReadView，不加锁 |
| **当前读** | `SELECT ... FOR UPDATE` / `LOCK IN SHARE MODE` / `INSERT/UPDATE/DELETE` | ❌ 读最新版本，加锁 |

### 6.1 快照读示例

```sql
-- 事务 A
BEGIN;
SELECT * FROM user WHERE id = 1;  -- 快照读，走 MVCC
-- 事务 B 修改并提交
SELECT * FROM user WHERE id = 1;  -- RR 下仍读到旧值
COMMIT;
```

### 6.2 当前读示例

```sql
-- 事务 A
BEGIN;
SELECT * FROM user WHERE id = 1 FOR UPDATE;  -- 当前读，加 X 锁
UPDATE user SET name = '李四' WHERE id = 1;
COMMIT;
```

---

## 七、InnoDB 如何在 RR 下解决幻读？（高频）

InnoDB 在 RR 隔离级别用两套机制解决幻读：

### 7.1 快照读：MVCC 解决

整个事务用同一个 ReadView，新增的行的 `trx_id` 不在视图中，直接不可见。

### 7.2 当前读：Next-Key Lock 解决

`SELECT ... FOR UPDATE` 等当前读，会加 **Next-Key Lock = 行锁 + 间隙锁**，禁止其他事务在范围内插入新行。

```sql
-- 假设 id 列上有 5、10、15 三条记录
SELECT * FROM t WHERE id BETWEEN 5 AND 15 FOR UPDATE;
-- 加锁范围：(-∞,5] ∪ (5,10] ∪ (10,15] ∪ (15,+∞)
-- 其他事务无法 INSERT id 在此范围的新行
```

---

## 八、三大日志（高频）

| 日志 | 作用 | 写入时机 | 特征 |
|------|------|---------|------|
| **redo log** | 崩溃恢复（D） | 事务提交前 | InnoDB 引擎层、循环写、物理日志 |
| **undo log** | 回滚（A）+ MVCC | 事务执行中 | InnoDB 引擎层、版本链 |
| **binlog** | 主从复制 + 归档 | 事务提交后 | Server 层、追加写、逻辑日志 |

### 两阶段提交（重点）

```
事务提交：
  1. 写 redo log → prepare 状态
  2. 写 binlog
  3. redo log → commit 状态
```

**目的**：保证 redo log 与 binlog 数据一致，避免主从数据不一致。

### 崩溃恢复

```
扫描 redo log：
  - 状态为 commit → 提交
  - 状态为 prepare → 检查 binlog 是否完整
      完整 → 提交（用 binlog 让从库也提交）
      不完整 → 回滚
```

---

## 九、必考题速答

### Q1：MySQL 事务的 ACID 是什么？怎么实现？
A：原子性（undo log）、一致性（AID 共同保证）、隔离性（锁 + MVCC）、持久性（redo log）。

### Q2：MySQL 隔离级别有哪些？默认是什么？
A：RU、RC、**RR（默认）**、串行化。InnoDB 在 RR 下通过 Next-Key Lock 额外解决了幻读。

### Q3：MVCC 怎么工作的？
A：每行有 trx_id 和 roll_ptr 隐藏字段，UPDATE 把旧值写到 undo log 形成版本链；事务 SELECT 时生成 ReadView，根据可见性算法沿版本链找到可见版本。

### Q4：RC 和 RR 的本质区别？
A：ReadView 的生成时机。RC 每次 SELECT 都新建，所以能看到最新提交（不可重复读）；RR 首次 SELECT 创建后复用，所以读到的总是一致（可重复读）。

### Q5：什么是当前读？什么是快照读？
A：快照读 = 普通 SELECT，走 MVCC 不加锁；当前读 = `FOR UPDATE` / `LOCK IN SHARE MODE` / DML，读最新版本并加锁。

### Q6：InnoDB 怎么解决幻读？
A：快照读靠 MVCC（新行 trx_id 不在 ReadView 中，不可见）；当前读靠 Next-Key Lock（行锁 + 间隙锁，禁止区间内插入）。

### Q7：redo / undo / binlog 区别？
A：redo log 是 InnoDB 引擎层物理日志，用于崩溃恢复；undo log 是 InnoDB 引擎层逻辑日志，用于回滚 + MVCC；binlog 是 Server 层逻辑日志，用于主从复制和归档。

### Q8：什么是两阶段提交？为什么需要？
A：redo log 先 prepare → 写 binlog → redo log commit。保证两个日志一致，避免主从数据不一致。

---

## 🎯 必背图谱

```
事务 (Transaction)
  ├── ACID
  │     ├── A 原子性 → undo log
  │     ├── C 一致性 → 综合
  │     ├── I 隔离性 → 锁 + MVCC
  │     └── D 持久性 → redo log
  ├── 4 种隔离级别 (RU < RC < RR < Serializable)
  ├── 3 种读异常（脏读 / 不可重复读 / 幻读）
  └── MVCC
        ├── 隐藏字段 (trx_id, roll_ptr)
        ├── undo log 版本链
        └── ReadView (可见性判断)
```

上一篇 ← [01 索引原理与优化](./01-index-and-optimization.md)  
下一篇 → [03 锁机制](./03-lock-mechanism.md)
