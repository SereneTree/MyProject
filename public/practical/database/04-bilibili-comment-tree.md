# 案例四：B站评论系统多级评论树设计

> **来源场景**：哔哩哔哩 - 评论系统（视频/动态/专栏通用）
> **数据规模**：累计评论 100 亿+，单视频最高百万评论，热门评论日新增千万
> **核心挑战**：树状嵌套结构、楼中楼、按热度排序、海量数据存储

---

## 一、应用场景

B 站评论是典型的「**写少读多 + 树状结构 + 复杂排序**」场景：

- **多业务复用**：视频、专栏、动态、漫画都用同一套评论系统
- **二级评论结构**：一级评论（楼层） + 二级评论（楼中楼）
- **多种排序**：按热度、按时间、按点赞数
- **复杂运营**：UP 主置顶、官方加精、敏感词审核、举报折叠

---

## 二、设计思路

### 2.1 评论结构的三种存储模型对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **邻接表 (parent_id)** | 简单直观 | 递归查询性能差 | 浅层级 |
| **路径枚举 (path='1/3/5')** | 单次查询整棵子树 | 路径过长、深度受限 | 中等深度 |
| **闭包表 (closure table)** | 任意深度高效查询 | 写入成本高 (N²) | 复杂层级 |

B 站评论选择 **「二级评论结构 + 邻接表」**——
**强制最多 2 级**（一级评论 → 楼中楼），用业务约束消解树状复杂度。

### 2.2 表结构设计

```sql
-- 评论主体表（按业务+对象分片）
CREATE TABLE comment (
  id              BIGINT       PRIMARY KEY  COMMENT '评论ID(雪花算法)',
  obj_id          BIGINT       NOT NULL     COMMENT '业务对象ID(视频av号等)',
  obj_type        TINYINT      NOT NULL     COMMENT '1视频 2专栏 3动态',

  -- 评论树结构
  root_id         BIGINT       NOT NULL DEFAULT 0 COMMENT '顶级评论ID(0表示自己是顶级)',
  parent_id       BIGINT       NOT NULL DEFAULT 0 COMMENT '直接父评论ID',
  reply_to_uid    BIGINT       NULL         COMMENT '@的用户ID(显示"回复@xxx")',

  user_id         BIGINT       NOT NULL,
  content         TEXT         NOT NULL,

  -- 互动数据
  like_count      INT          NOT NULL DEFAULT 0,
  reply_count     INT          NOT NULL DEFAULT 0,

  -- 状态/排序
  status          TINYINT      NOT NULL DEFAULT 0  COMMENT '0正常 1隐藏 2删除',
  is_top          TINYINT      NOT NULL DEFAULT 0  COMMENT '是否UP置顶',
  hot_score       BIGINT       NOT NULL DEFAULT 0  COMMENT '热度分(预计算)',

  create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- 索引
  KEY idx_root_time (obj_id, root_id, create_time),       -- 楼中楼查询
  KEY idx_obj_hot (obj_id, status, hot_score DESC),       -- 按热度排序
  KEY idx_obj_time (obj_id, status, create_time DESC),    -- 按时间排序
  KEY idx_user_create (user_id, create_time)              -- 个人主页"我的评论"
) ENGINE=InnoDB COMMENT='评论主表';
```

### 2.3 核心字段解读

```
顶级评论：root_id=0,    parent_id=0
楼中楼：  root_id=10086, parent_id=10086 (直接回复一级评论)
楼中楼：  root_id=10086, parent_id=20001 (回复另一条楼中楼)
```

**关键约束**：所有楼中楼的 `root_id` 都指向**最顶层评论**，不管二级嵌套多深。

这样查询「一级评论 #10086 下所有回复」只要一条 SQL：

```sql
SELECT * FROM comment
 WHERE obj_id = 12345
   AND root_id = 10086
   AND status = 0
 ORDER BY create_time
 LIMIT 0, 20;
```

---

## 三、技术亮点

### 3.1 计数字段的高频更新优化

`like_count` 和 `reply_count` 是**热点更新字段**，每秒可能更新数千次：

```sql
-- ❌ 直接 UPDATE 会导致行锁竞争
UPDATE comment SET like_count = like_count + 1 WHERE id = 10086;
```

**优化方案：Redis 计数 + 异步落库**

```
[点赞]
   ↓
Redis INCR comment_like:10086     ← 实时计数
   ↓
每 30 秒 / 计数变化 ≥ 100 时
   ↓
批量 UPDATE 回 MySQL
   ↓
binlog → ES（保持搜索同步）
```

读取时优先查 Redis，未命中再查 DB。

### 3.2 热度分的设计（决定排序）

热度不是简单的「点赞数」，而是综合因子：

```
hot_score = (like_count × 4 + reply_count × 2 - dislike × 6 + base)
          × time_decay(create_time)
```

其中 `time_decay` 是时间衰减函数（参考 Reddit 算法）：

```python
def hot_score(likes, replies, dislikes, age_hours):
    s = likes * 4 + replies * 2 - dislikes * 6
    sign = 1 if s > 0 else -1
    order = math.log10(max(abs(s), 1))
    # 老评论分数衰减
    return round(sign * order - age_hours / 12.5, 7)
```

**关键技巧**：把 `hot_score` 写入 DB 字段并建索引，**直接 ORDER BY** 即可，不需要每次查询时计算。后台任务每 10 分钟批量重算热门视频的评论热度。

### 3.3 二级评论的「分页+折叠」策略

视频页加载时**不可能拉全量楼中楼**，B 站的策略：

```
GET /comments?oid=123&type=1&pn=1&ps=20

返回：
- 20 条一级评论
- 每条一级评论附带「最热的 3 条楼中楼 + 总回复数」

用户点「展开 50 条回复」时：
GET /comments/reply?root=10086&pn=1&ps=10
```

**SQL 优化**：

```sql
-- 一级评论分页
SELECT * FROM comment
 WHERE obj_id = 123 AND root_id = 0 AND status = 0
 ORDER BY is_top DESC, hot_score DESC
 LIMIT 0, 20;

-- 每条一级评论的「Top 3 楼中楼」（应用层聚合）
SELECT * FROM comment
 WHERE obj_id = 123 AND root_id IN (10086, 10087, ...) AND status = 0
 ORDER BY root_id, hot_score DESC;
-- 应用层按 root_id 分组取 top 3
```

### 3.4 用户屏蔽与举报折叠

```sql
-- 屏蔽列表（用户拉黑别人）
CREATE TABLE comment_user_block (
  user_id     BIGINT NOT NULL,
  blocked_uid BIGINT NOT NULL,
  PRIMARY KEY (user_id, blocked_uid)
) ENGINE=InnoDB;
```

查询评论时，应用层过滤掉 `blocked_uid`，避免在 SQL 中做反连接。

举报折叠通过 `status = 1` 实现，前端判断后将其折叠隐藏，但允许用户手动展开。

### 3.5 分库分表策略

按 **obj_id 取模分片**（同一个视频的评论落到同一分片）：

```
db_index = (obj_id) % 64
tb_index = (obj_id / 64) % 16
```

**好处**：
- 查询某视频评论 → 单库单表
- 楼中楼查询 → 也在同一库（root_id 与 obj_id 在同一片）
- 热度排序 → 直接利用单库索引

### 3.6 评论搜索：异步同步 ES

```
MySQL → Canal → Kafka → ES Consumer → Elasticsearch
```

UP 主搜索自己评论区、运营后台搜敏感词，全部走 ES，避免 LIKE 全表扫描。

---

## 四、性能数据

| 指标 | 数值 |
|------|------|
| 累计评论数 | 100 亿+ |
| 单视频最高评论 | 数百万 |
| 评论列表 P99 | < 100ms |
| 写入 TPS | 数万 |
| 计数更新延迟 | < 30s |

---

## 五、设计权衡与思考

### ✅ 优势

1. **结构简化**：强制二级评论让数据结构扁平，查询代价 O(1)
2. **写性能好**：计数走 Redis，主表写入压力小
3. **多种排序高效**：热度分预计算 + 索引覆盖

### ⚠️ 代价

1. **失去无限嵌套**：用户体验上不如真正的多级嵌套
2. **热度需要重算**：定时任务的资源消耗不小
3. **数据一致性窗口**：Redis 计数与 DB 有 30s 差异

### 💡 启示

> **「先用业务约束简化数据模型，再做技术优化」**——
> 真正的多级嵌套树需要闭包表 + 大量 JOIN，性能极差；
> B 站把树「拍扁」成两级，根本不需要复杂查询，简单 SQL 就能跑得飞快。
> 这是**用产品决策为技术减负**的典范。

---

## 六、可借鉴的设计模式

1. **路径压缩**：通过 `root_id` 直接指向顶层，避免递归查询
2. **二级评论扁平化**：用业务约束把树状变线性
3. **热度分预计算**：把排序逻辑写入字段，依赖索引而非 ORDER BY 表达式
4. **计数 Redis + 异步落库**：解决热点字段更新难题
5. **多排序多索引**：每种业务排序都要专属索引，宁多勿少
6. **应用层过滤**：拉黑、敏感词等逻辑下放应用层，简化 SQL

---

## 参考资料

- 哔哩哔哩技术团队：B 站评论系统架构设计
- 《B 站评论系统的演进与优化》InfoQ
- 《Reddit 热度排序算法解析》
