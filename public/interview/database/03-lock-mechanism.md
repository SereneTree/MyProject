# 03 锁机制

> **难度**：⭐⭐⭐⭐  
> **出现率**：90%+  
> **核心**：锁的分类 → 行锁 3 兄弟 → 死锁 → 悲观锁 vs 乐观锁

---

## 一、锁的分类全景图

```
按粒度
├── 全局锁 (FTWRL)        — 备份用
├── 表级锁
│   ├── 表锁 (LOCK TABLES)
│   ├── 元数据锁 (MDL)    — 阻止 DDL/DML 冲突
│   └── 意向锁 (IS / IX)  — 协调表锁与行锁
└── 行级锁 (InnoDB)
    ├── 记录锁 (Record Lock)
    ├── 间隙锁 (Gap Lock)
    └── 临键锁 (Next-Key Lock)

按类型
├── 共享锁 (S Lock) — 读锁
└── 排他锁 (X Lock) — 写锁

按思想
├── 悲观锁 — DB 层 (FOR UPDATE)
└── 乐观锁 — 应用层 (version 字段)
```

---

## 二、表级锁

### 2.1 全局锁 (FTWRL)

```sql
FLUSH TABLES WITH READ LOCK;  -- 加锁
UNLOCK TABLES;                -- 释放
```

- **场景**：全库逻辑备份（mysqldump 用 `--single-transaction` 替代）
- **代价**：整库只读，业务不可用

### 2.2 表锁

```sql
LOCK TABLES user READ;   -- 读锁，其他人可读不可写
LOCK TABLES user WRITE;  -- 写锁，其他人不可读不可写
UNLOCK TABLES;
```

InnoDB 中很少手动用，行锁能力够用。MyISAM 默认是表锁。

### 2.3 元数据锁 (MDL)

> 自动加锁，无需手动操作。

- 增删改查 → 自动加 **MDL 读锁**
- DDL（ALTER TABLE 等） → 自动加 **MDL 写锁**

⚠️ **经典坑**：DDL 等待长事务释放读锁 → 后续所有 DML 排队 → **业务雪崩**。

### 2.4 意向锁 (IS / IX)

存在意义：**让加表锁的判断变快**。

- IS（意向共享锁）：要加 S 行锁前先加 IS 表锁
- IX（意向排他锁）：要加 X 行锁前先加 IX 表锁

例：要加表写锁时，看到表有 IX → 立刻知道有人在改某行，无需扫描所有行。

---

## 三、行级锁三兄弟（InnoDB 核心，必考）

> 前提：**只有走索引的查询才能加行锁**，否则退化为表锁。

### 3.1 Record Lock (记录锁)

锁的是**索引上的某条记录**。

```sql
-- id 是主键
SELECT * FROM user WHERE id = 10 FOR UPDATE;
```

只锁 id=10 这一行。

### 3.2 Gap Lock (间隙锁)

锁的是**索引记录之间的「空隙」**，禁止其他事务插入新行。

```
索引上有 id = 1, 5, 10
间隙：(-∞,1), (1,5), (5,10), (10,+∞)
```

```sql
SELECT * FROM user WHERE id BETWEEN 6 AND 8 FOR UPDATE;
-- 锁住 (5,10) 间隙，无法 INSERT id=7
```

### 3.3 Next-Key Lock (临键锁) ⭐

= 记录锁 + 它前面的间隙锁，**左开右闭区间**。

```sql
SELECT * FROM user WHERE id = 5 FOR UPDATE;
-- RR 默认加 Next-Key Lock，锁定 (1, 5]
```

**InnoDB 在 RR 下默认加 Next-Key Lock**，这是解决幻读的核心。

### 3.4 加锁规则（重要）

**两个原则 + 两个优化（极客时间丁奇老师总结）**：

1. 加锁的基本单位是 Next-Key Lock，**左开右闭**
2. 查询过程中**访问到的对象**才会加锁
3. **优化 1**：索引等值查询，命中**唯一索引**时退化为 Record Lock
4. **优化 2**：索引等值查询，**向右遍历到不满足条件的第一个值**时，退化为 Gap Lock

---

## 四、行锁失效场景（必考）

行锁加在**索引**上。如果走不到索引，会退化为**表锁**：

```sql
-- 假设 name 没有索引
SELECT * FROM user WHERE name = '张三' FOR UPDATE;
-- → 全表扫描 → 退化为表锁 → 整张表被锁住
```

**解决方案**：保证 WHERE 条件能走索引。

---

## 五、死锁

### 5.1 经典死锁示例

```
T1: BEGIN;
    UPDATE account SET balance = balance - 100 WHERE id = 1;  -- 锁 1

T2: BEGIN;
    UPDATE account SET balance = balance - 100 WHERE id = 2;  -- 锁 2

T1: UPDATE account SET balance = balance + 100 WHERE id = 2;  -- 等 T2
T2: UPDATE account SET balance = balance + 100 WHERE id = 1;  -- 等 T1
                                                              ↓
                                                            🔒 死锁
```

### 5.2 InnoDB 的死锁处理

- **Wait-for graph 检测算法**：每次有事务等待时检测环，发现死锁直接 ROLLBACK 一个事务（牺牲较小的）
- **超时回滚**：`innodb_lock_wait_timeout`（默认 50s）

### 5.3 排查死锁

```sql
-- 查看最近一次死锁
SHOW ENGINE INNODB STATUS\G
-- 找 LATEST DETECTED DEADLOCK 段

-- 查看当前锁等待
SELECT * FROM information_schema.INNODB_TRX;          -- 当前事务
SELECT * FROM performance_schema.data_locks;          -- 当前锁
SELECT * FROM performance_schema.data_lock_waits;     -- 锁等待
```

### 5.4 避免死锁的实践

| 方法 | 做法 |
|------|------|
| **统一加锁顺序** | 业务约定：转账永远先锁小 id 再锁大 id |
| **缩小事务粒度** | 减少锁持有时间，UPDATE 用 WHERE 主键 |
| **降低隔离级别** | RC 比 RR 间隙锁更少 |
| **拆分大事务** | 不在事务里做远程调用 |
| **失败重试** | 应用层捕获死锁异常，自动 retry |

---

## 六、悲观锁 vs 乐观锁

### 6.1 悲观锁

> 假设冲突一定会发生，**先加锁再操作**。

```sql
BEGIN;
SELECT balance FROM account WHERE id = 1 FOR UPDATE;  -- 加 X 锁
UPDATE account SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

**适用**：写多读少、冲突频繁。

### 6.2 乐观锁

> 假设冲突很少发生，**不加锁，提交时检查**。

```sql
-- 表加一个 version 字段
UPDATE account
   SET balance = balance - 100, version = version + 1
 WHERE id = 1 AND version = #{oldVersion};

-- 受影响行数 = 0 → 有人抢先改了，回滚重试
```

**适用**：读多写少、冲突少（如商品库存、文章编辑）。

### 6.3 对比

| 维度 | 悲观锁 | 乐观锁 |
|------|--------|--------|
| 性能 | 低（加锁开销） | 高 |
| 一致性 | 强 | 最终一致 |
| 失败处理 | 自动等待 | 应用层重试 |
| 冲突场景 | 高冲突 | 低冲突 |

---

## 七、共享锁 vs 排他锁

| 锁 | 别名 | 加锁 SQL | 兼容性 |
|----|------|---------|--------|
| 共享锁 (S) | 读锁 | `SELECT ... LOCK IN SHARE MODE` | S-S 兼容 |
| 排他锁 (X) | 写锁 | `SELECT ... FOR UPDATE` / DML | S-X、X-X 互斥 |

**兼容矩阵**：

```
        S       X
   S    ✅     ❌
   X    ❌     ❌
```

---

## 八、典型面试题速答

### Q1：MySQL 锁有哪些？
A：按粒度分全局锁、表级锁（表锁/MDL/意向锁）、行级锁（记录锁/间隙锁/临键锁）；按类型分共享锁和排他锁；按思想分悲观锁和乐观锁。

### Q2：行锁会升级为表锁吗？
A：InnoDB 没有锁升级机制。但如果 WHERE 走不到索引，会全表扫描并对所有行加锁，**效果上等同于表锁**。

### Q3：InnoDB 怎么防止幻读？
A：在 RR 下，快照读靠 MVCC，当前读靠 Next-Key Lock（记录锁 + 间隙锁），禁止区间内插入新行。

### Q4：什么是间隙锁？什么时候用？
A：锁定索引记录之间的「空隙」，防止其他事务在该区间插入新行。RR 隔离级别 + 当前读时自动加。

### Q5：发生死锁怎么办？
A：1）InnoDB 自动检测死锁并回滚一个事务；2）排查 `SHOW ENGINE INNODB STATUS`；3）应用层重试；4）规范加锁顺序、缩小事务粒度。

### Q6：乐观锁怎么实现？
A：表加 version 字段，UPDATE 时 `WHERE id = ? AND version = ?`，受影响行数为 0 则说明被抢先修改，需要重试。

### Q7：SELECT...FOR UPDATE 会加什么锁？
A：在 RR 下加 Next-Key Lock；唯一索引等值命中时退化为 Record Lock；索引等值不存在记录时退化为 Gap Lock。

---

## 🎯 锁兼容速查表（背诵版）

| 操作 | RC 加锁 | RR 加锁 |
|------|---------|---------|
| 普通 SELECT | 不加锁（MVCC） | 不加锁（MVCC） |
| SELECT...LOCK IN SHARE MODE | Record S | Next-Key S |
| SELECT...FOR UPDATE | Record X | Next-Key X |
| INSERT | 隐式 X 行锁 | 同 + 插入意向锁 |
| UPDATE / DELETE | Record X | Next-Key X |

上一篇 ← [02 事务与 MVCC](./02-transaction-and-mvcc.md)  
下一篇 → [04 SQL 优化与慢查询](./04-sql-optimization.md)
