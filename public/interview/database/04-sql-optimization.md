# 04 SQL 优化与慢查询

> **难度**：⭐⭐⭐⭐  
> **出现率**：实操高频（一面常考）  
> **核心**：EXPLAIN → 慢查询定位 → 索引调整 → SQL 改写

---

## 一、慢查询定位三板斧

### 1.1 开启慢查询日志

```sql
-- 查看
SHOW VARIABLES LIKE 'slow_query_log%';
SHOW VARIABLES LIKE 'long_query_time';

-- 开启 + 设置阈值
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;  -- 超过 1 秒记录
```

### 1.2 分析慢日志：mysqldumpslow / pt-query-digest

```bash
# 按耗时排序，看前 10 条
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

# 更强大：pt-query-digest（生产推荐）
pt-query-digest /var/log/mysql/slow.log > report.txt
```

### 1.3 看实时进程

```sql
SHOW PROCESSLIST;            -- 看正在执行的查询
SHOW FULL PROCESSLIST;       -- 完整 SQL
```

---

## 二、EXPLAIN 执行计划（必背）

### 2.1 使用方法

```sql
EXPLAIN SELECT * FROM user WHERE name = '张三';
EXPLAIN ANALYZE ...   -- MySQL 8.0+，实际执行并展示耗时
```

### 2.2 关键字段速查

| 字段 | 含义 | 关注点 |
|------|------|--------|
| `id` | 查询编号 | 数字越大越先执行 |
| `select_type` | SIMPLE / PRIMARY / SUBQUERY | DERIVED 多表示有派生子查询 |
| `table` | 表名 | 看 JOIN 顺序 |
| `type` | **访问类型 ⭐** | **见下方** |
| `possible_keys` | 可能用到的索引 | NULL 说明没索引 |
| `key` | 实际用到的索引 | NULL 说明没用上 |
| `key_len` | 索引使用长度 | 越短越好；联合索引看用了几列 |
| `rows` | 预估扫描行数 | 越小越好 |
| `filtered` | 过滤百分比 | 越接近 100 越好 |
| `Extra` | **附加信息 ⭐** | **见下方** |

### 2.3 type 字段优劣（高频）

> 从好到差：`system > const > eq_ref > ref > range > index > ALL`

| type | 含义 | 触发条件 |
|------|------|---------|
| `const` | 常量查询 | 主键/唯一索引等值 |
| `eq_ref` | 主键 JOIN | JOIN 走主键 |
| `ref` | 普通索引等值 | 普通索引 = 值 |
| `range` | 范围扫描 | `BETWEEN` / `>` / `<` / `IN` |
| `index` | 索引全扫描 | 走了索引但扫了全部 |
| **`ALL`** | **全表扫描 ❌** | **必须优化** |

**面试金句**：
> 优化目标至少达到 `range`，最好是 `ref` 或 `const`。看到 `ALL` 必须优化。

### 2.4 Extra 字段（重点）

| Extra | 含义 | 好坏 |
|-------|------|------|
| `Using index` | **覆盖索引** | ✅ 极好 |
| `Using where` | 用 WHERE 过滤 | 中性 |
| `Using index condition` | **索引下推 (ICP)** | ✅ 好 |
| `Using temporary` | 用了临时表 | ❌ 性能差 |
| `Using filesort` | 文件排序 | ❌ 性能差 |
| `Using join buffer` | JOIN 没用索引 | ❌ |
| `Impossible WHERE` | 条件永远为假 | 优化器识别 |

---

## 三、SQL 优化的 10 个常见技巧

### 3.1 用具体字段替代 SELECT *

```sql
-- ❌ 容易失去覆盖索引
SELECT * FROM user WHERE name = '张三';

-- ✅ 列出需要的字段
SELECT id, name FROM user WHERE name = '张三';
```

### 3.2 LIMIT 大偏移量优化（高频）

```sql
-- ❌ 慢：每次都扫前 1000020 条然后丢弃
SELECT * FROM user ORDER BY id LIMIT 1000000, 20;

-- ✅ 方法 1：延迟关联（推荐）
SELECT u.* FROM user u
INNER JOIN (
  SELECT id FROM user ORDER BY id LIMIT 1000000, 20
) t ON u.id = t.id;

-- ✅ 方法 2：游标分页（最优，但前端要改）
SELECT * FROM user WHERE id > #{lastId} ORDER BY id LIMIT 20;
```

### 3.3 IN vs EXISTS

```sql
-- 子查询表小：用 IN
SELECT * FROM user WHERE dept_id IN (SELECT id FROM dept WHERE region = '华东');

-- 子查询表大：用 EXISTS
SELECT * FROM order o WHERE EXISTS (SELECT 1 FROM user u WHERE u.id = o.user_id AND u.vip = 1);
```

### 3.4 COUNT 优化

```sql
-- 性能：COUNT(*) ≈ COUNT(1) > COUNT(主键) > COUNT(字段)
-- COUNT(*) 是 SQL 标准，会优化器特殊处理，最快
-- COUNT(字段) 要扫描非空值，最慢

-- InnoDB 大表精确 COUNT 没法快，可以：
-- 1) 用 EXPLAIN 看 rows 估算
-- 2) 维护单独的计数表（Redis 或 MySQL）
```

### 3.5 OR 改 UNION

```sql
-- ❌ 索引可能失效
SELECT * FROM user WHERE name = '张三' OR phone = '13800000000';

-- ✅ 各自走索引
SELECT * FROM user WHERE name = '张三'
UNION
SELECT * FROM user WHERE phone = '13800000000';
```

### 3.6 避免函数操作

```sql
-- ❌ 索引失效
WHERE DATE(create_time) = '2024-01-01'

-- ✅ 范围条件
WHERE create_time >= '2024-01-01' AND create_time < '2024-01-02'
```

### 3.7 JOIN 优化

```sql
-- 1) 小表驱动大表（驱动表越小越好）
-- 2) JOIN 字段必须有索引（否则用 join buffer，O(n*m)）
-- 3) 字段类型必须一致（否则隐式转换 → 索引失效）

-- ✅ 推荐：小表 LEFT JOIN 大表（小表为驱动）
SELECT u.name, COUNT(o.id)
  FROM dept d                          -- 小表先
  LEFT JOIN user u ON u.dept_id = d.id  -- 大表后
  LEFT JOIN order o ON o.user_id = u.id
GROUP BY d.id;
```

### 3.8 排序优化

```sql
-- ❌ filesort
ORDER BY 多个字段，未走索引

-- ✅ 在排序字段建联合索引
KEY idx_status_create (status, create_time DESC)
WHERE status = 1 ORDER BY create_time DESC;
```

### 3.9 分组优化

```sql
-- 利用索引避免临时表
KEY idx_dept_status (dept_id, status)

-- ✅ 索引覆盖 GROUP BY
SELECT dept_id, COUNT(*) FROM user GROUP BY dept_id;
```

### 3.10 使用合适的字段类型

| 选择 | 建议 |
|------|------|
| 整数 | INT/BIGINT，能小不大 |
| 字符串 | VARCHAR(N)，N 按实际+冗余 |
| 时间 | DATETIME（绝对）/ TIMESTAMP（自动转时区）|
| 金额 | DECIMAL，**绝不用 float** |
| 状态 | TINYINT，不用 VARCHAR |

---

## 四、索引选择问题

### 4.1 优化器选错索引怎么办？

```sql
-- 强制使用某索引
SELECT * FROM user FORCE INDEX (idx_name) WHERE name = '张三';

-- 忽略某索引
SELECT * FROM user IGNORE INDEX (idx_age) WHERE name = '张三';

-- 推荐使用
SELECT * FROM user USE INDEX (idx_name) WHERE name = '张三';
```

### 4.2 ANALYZE TABLE 更新统计信息

```sql
ANALYZE TABLE user;
```

优化器选错索引常因统计信息过旧，重新分析即可。

---

## 五、大表 DDL 优化

> 在线大表加索引、改字段，**绝对不能直接 ALTER**。

### 方案 1：MySQL 8.0 instant DDL

某些操作（加列）支持秒级，无需重建表。

### 方案 2：pt-online-schema-change

```bash
pt-online-schema-change \
  --alter "ADD INDEX idx_name (name)" \
  D=mydb,t=user \
  --execute
```

原理：建影子表 → 触发器同步 → 重命名替换。

### 方案 3：gh-ost（GitHub 出品）

不依赖触发器，用 binlog 同步，对主库压力更小。

---

## 六、典型面试题速答

### Q1：怎么排查慢 SQL？
A：
1. 开启慢查询日志，`long_query_time` 设 1s
2. 用 pt-query-digest 分析 top SQL
3. 对慢 SQL 用 EXPLAIN 看执行计划
4. 重点看 type、key、rows、Extra
5. 调整索引或改写 SQL

### Q2：EXPLAIN 看哪些字段？
A：重点看 type（访问类型，至少 range）、key（实际索引）、rows（扫描行数）、Extra（覆盖索引/临时表/文件排序）。

### Q3：100 万数据 LIMIT 100w, 20 怎么优化？
A：
1. **延迟关联**：先用主键索引拿到 20 个 id，再回表
2. **游标分页**：传上一页最大 id，`WHERE id > xxx LIMIT 20`
3. **业务限制**：禁止跳页跳太远

### Q4：COUNT(*) 慢怎么办？
A：InnoDB 没有计数器，必须扫描。优化方案：
1. 维护单独计数表（实时更新）
2. Redis 计数（高并发场景）
3. 接受估算值（`SHOW TABLE STATUS`）

### Q5：JOIN 怎么优化？
A：
1. 小表驱动大表（驱动表小）
2. JOIN 字段必须建索引
3. JOIN 字段类型一致（防止隐式转换）
4. 控制 JOIN 表数量（一般不超过 3 个）

### Q6：索引失效场景？
A：函数操作、隐式类型转换、左模糊（`LIKE '%xx'`）、`OR` 不全索引、`!=`、范围列后续、不符合最左前缀。

### Q7：怎么给一个表加索引（生产环境）？
A：小表直接 ALTER；大表用 pt-online-schema-change 或 gh-ost，避免锁表；MySQL 8.0 部分操作支持 instant DDL。

---

## 🎯 SQL 优化口诀

```
查询走索引，索引覆盖好；
LIMIT 大偏移，延迟关联巧；
JOIN 小表先，类型要一致；
COUNT 用 *，分页用游标；
函数转换 OR，索引就失效；
EXPLAIN 多瞅瞅，慢日志开起。
```

上一篇 ← [03 锁机制](./03-lock-mechanism.md)  
下一篇 → [05 高频问答话术](./05-faq-talking-points.md)
