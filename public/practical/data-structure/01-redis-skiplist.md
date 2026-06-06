# 案例一：Redis 跳表——高性能有序集合的基石

## 概览

| 项目 | 内容 |
|------|------|
| 企业 | Redis Labs (开源社区 + 商业公司) |
| 产品 | Redis 有序集合 (Sorted Set / ZSet) |
| 核心数据结构 | 跳表 (Skip List) |
| 应用场景 | 游戏排行榜、延迟队列、限流滑动窗口、地理位置排序 |
| 日均调用量 | 千亿级 (全球 Redis 实例的 ZRANGEBYSCORE/ZADD 操作) |

---

## 一、业务痛点

### 1.1 实际需求

互联网产品中大量场景需要**按分数排序的动态集合**：

- 游戏排行榜：实时更新玩家分数，查询 Top N 或某玩家排名
- 延迟队列：以执行时间为 score，取出所有到期任务
- Feed 流：以时间戳排序，支持分页拉取
- 限流窗口：滑动窗口内的请求计数

### 1.2 技术挑战

| 操作 | 要求 |
|------|------|
| 插入/更新分数 | O(log n)，不能因排序阻塞 |
| 按排名查询 | 支持 ZRANK (第几名)，O(log n) |
| 范围查询 | ZRANGEBYSCORE，返回某区间内所有元素 |
| 并发安全 | 多客户端同时读写，锁粒度尽可能小 |
| 实现复杂度 | Redis 核心代码追求**简单可维护** |

---

## 二、为什么选跳表而非红黑树？

这是一个经典面试题。Redis 作者 antirez 的回答：

| 对比维度 | 跳表 (Skip List) | 红黑树 (Red-Black Tree) |
|----------|-----------------|----------------------|
| 实现复杂度 | ~200行C代码 | ~500+行，旋转逻辑复杂 |
| 范围查询 | 天然支持，沿底层链表遍历 | 需要中序遍历，不直观 |
| 并发友好 | 局部锁 (CAS 可实现无锁跳表) | 旋转操作影响大范围节点 |
| 内存局部性 | 节点随机分布，但层数可控 | 节点也是动态分配 |
| 排名查询 | 每层记录 span 即可 O(log n) | 需要额外的 size 域 |

**结论：跳表在功能等价的前提下，代码更简单、范围操作更自然、并发扩展性更好。**

---

## 三、设计思路

### 3.1 跳表基本结构

```
Level 3:  HEAD ───────────────────────────────→ 50 ──────────────────→ NIL
Level 2:  HEAD ────────→ 20 ─────────────────→ 50 ──────→ 70 ──────→ NIL
Level 1:  HEAD ──→ 10 → 20 → 30 → 40 → 50 → 60 → 70 → 80 → 90 → NIL
```

- 底层是完整有序链表
- 每一层是下一层的「快速通道」
- 查找时从最高层开始，逐层下降，类似二分查找

### 3.2 Redis 中的实现 (t_zset.c)

```c
// Redis 跳表节点定义 (简化版)
typedef struct zskiplistNode {
    sds ele;                    // 成员值 (字符串)
    double score;               // 排序分数
    struct zskiplistNode *backward; // 后退指针 (用于反向遍历)
    struct zskiplistLevel {
        struct zskiplistNode *forward; // 前进指针
        unsigned long span;            // 跨度 (用于计算排名)
    } level[];                  // 柔性数组，层数随机生成
} zskiplistNode;

typedef struct zskiplist {
    struct zskiplistNode *header, *tail;
    unsigned long length;       // 节点总数
    int level;                  // 当前最大层数
} zskiplist;
```

### 3.3 层数随机化策略

```c
// Redis 的随机层数生成 (最大32层)
int zslRandomLevel(void) {
    int level = 1;
    while ((random() & 0xFFFF) < (ZSKIPLIST_P * 0xFFFF)) // P = 0.25
        level += 1;
    return (level < ZSKIPLIST_MAXLEVEL) ? level : ZSKIPLIST_MAXLEVEL;
}
```

- P = 0.25 意味着平均每4个节点有1个升到上一层
- 期望层数 = 1/(1-P) = 1.33，非常节省空间
- 最大32层，理论支持 4^32 ≈ 10^19 个元素

### 3.4 排名计算 (span 字段的妙用)

```
ZRANK key member → 返回 member 的排名

实现方式：
- 每个 level[i].span 记录「从当前节点到 level[i].forward 之间跳过了多少个节点」
- 查找时累加路径上所有 span 值 = 目标节点的排名
- 时间复杂度 O(log n)，无需额外遍历
```

---

## 四、核心操作时间复杂度

| 操作 | Redis 命令 | 时间复杂度 | 说明 |
|------|-----------|-----------|------|
| 插入 | ZADD | O(log n) | 随机层数 + 逐层插入 |
| 删除 | ZREM | O(log n) | 逐层断链 |
| 查排名 | ZRANK | O(log n) | span 累加 |
| 分数范围查询 | ZRANGEBYSCORE | O(log n + m) | m = 返回元素数 |
| Top N | ZREVRANGE 0 N | O(log n + N) | 从 tail 反向遍历 |

---

## 五、实际业务应用示例

### 5.1 游戏排行榜

```redis
# 更新玩家分数
ZADD leaderboard 9500 "player:1001"
ZADD leaderboard 8700 "player:1002"

# 查询 Top 10
ZREVRANGE leaderboard 0 9 WITHSCORES

# 查询某玩家排名 (0-based)
ZREVRANK leaderboard "player:1001"

# 查询 8000~9000 分段的玩家
ZRANGEBYSCORE leaderboard 8000 9000
```

### 5.2 延迟队列

```redis
# 添加延迟任务 (score = 执行时间戳)
ZADD delay_queue 1716000000 "task:send_email_001"
ZADD delay_queue 1716000060 "task:retry_payment_002"

# 消费者轮询：取出所有到期任务
ZRANGEBYSCORE delay_queue 0 <当前时间戳>
ZREM delay_queue "task:send_email_001"  -- 取出后删除
```

### 5.3 API 限流滑动窗口

```redis
# 记录请求 (score = 请求时间戳, member = 唯一ID)
ZADD rate:user:1001 1716000001.123 "req_uuid_1"

# 清除窗口外的旧记录
ZREMRANGEBYSCORE rate:user:1001 0 (当前时间-60秒)

# 统计窗口内请求数
ZCARD rate:user:1001
# 若 > 100，则拒绝请求
```

---

## 六、技术亮点总结

| 亮点 | 说明 |
|------|------|
| 🎯 span 字段设计 | 一个小小的整数域，让排名查询从 O(n) 降到 O(log n) |
| 🎯 P=0.25 的概率选择 | 平衡了空间开销和查询速度，比 P=0.5 更省内存 |
| 🎯 双向链表 + 跳表融合 | backward 指针支持 ZREVRANGE 反向遍历，无需额外结构 |
| 🎯 字典 + 跳表双索引 | Redis ZSet = dict(O(1)查score) + skiplist(O(logn)范围查询) |
| 🎯 渐进式编码优化 | 元素少时用 ziplist (紧凑编码)，超过阈值再转跳表 |

---

## 七、面试高频问题

### Q1: 为什么 Redis 用跳表不用红黑树？

> **答题要点**：范围查询天然支持(沿链表遍历)、实现简单(~200行)、并发扩展性好(局部CAS)、功能上等价(增删改查都是O(log n))。Redis 作者 antirez 亲自解释过这个选择。

### Q2: 跳表的时间复杂度怎么证明是 O(log n)？

> **答题要点**：每个节点以概率 P 升层。期望层数 = log(1/P)(n)。当 P=0.25 时，期望层数 = log4(n)。每层期望检查 1/P = 4 个节点，总期望比较次数 = (1/P) × log(1/P)(n) = O(log n)。

### Q3: 跳表和 B+树哪个更适合数据库索引？

> **答题要点**：B+树更适合磁盘存储(节点大小对齐磁盘页，减少IO)；跳表更适合内存数据库(实现简单、并发友好)。Redis 是内存数据库，所以选跳表。MySQL InnoDB 是磁盘数据库，选 B+树。

---

## 八、延伸思考

1. **ConcurrentSkipListMap** (Java)：JDK 中无锁跳表的实现，对比 ConcurrentHashMap 的适用场景
2. **跳表 vs LSM-Tree MemTable**：LevelDB 的 MemTable 也是跳表，为什么？(写入友好、天然有序)
3. **跳表的空间优化**：如何在 P 值、最大层数之间找到最优平衡点？

---

> 📖 **源码阅读推荐**：Redis 源码 `src/t_zset.c` 中 `zslCreate()`、`zslInsert()`、`zslGetRank()` 三个函数，总计不到 300 行，是学习跳表最好的工业级参考。
