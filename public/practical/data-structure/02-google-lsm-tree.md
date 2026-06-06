# 案例二：Google LevelDB/Bigtable——LSM-Tree 存储引擎

## 概览

| 项目 | 内容 |
|------|------|
| 企业 | Google |
| 产品 | LevelDB / Bigtable / RocksDB (Facebook 分支) |
| 核心数据结构 | LSM-Tree (Log-Structured Merge Tree) |
| 辅助数据结构 | 跳表(MemTable)、布隆过滤器(查询加速)、SSTable(有序文件) |
| 应用场景 | 海量KV存储、时序数据库、区块链状态存储、消息队列 |
| 影响范围 | RocksDB/Cassandra/HBase/TiKV 等数十个存储系统的基础 |

---

## 一、业务痛点

### 1.1 写多读少的现代互联网场景

| 场景 | 写:读比例 | 数据量 |
|------|----------|--------|
| 用户行为日志 | 100:1 | 每天数十TB |
| 消息队列存储 | 50:1 | 百亿条/天 |
| 时序监控数据 | 1000:1 | 每秒千万指标点 |
| 社交Feed流 | 10:1 | 亿级用户动态 |

### 1.2 传统 B+树的瓶颈

```
B+树写入路径：
  写入 → 查找叶节点 → 就地修改/分裂 → 随机磁盘IO
                                          ↑
                              瓶颈！机械硬盘随机写 ~100 IOPS
                              即使SSD，随机写也远慢于顺序写
```

**核心矛盾**：B+树为读优化(有序结构)，但写入需要**随机IO**，在写密集场景下成为瓶颈。

---

## 二、LSM-Tree 的设计哲学

### 核心思想：将随机写转化为顺序写

```
传统B+树:  写入 → 随机IO修改磁盘页 (慢)
LSM-Tree:  写入 → 追加写内存 → 批量顺序刷盘 (快)
```

**本质**：用「读放大」和「空间放大」换取「写放大」的降低。

| 指标 | B+树 | LSM-Tree |
|------|------|----------|
| 写放大 | 高 (随机IO) | 低 (顺序IO) |
| 读放大 | 低 (单次查找) | 中 (可能查多层) |
| 空间放大 | 低 | 中 (多版本暂存) |
| 适合场景 | 读多写少 (OLTP数据库) | 写多读少 (日志/时序) |

---

## 三、架构设计详解

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      写入路径                            │
│  Client Write → WAL (追加写日志) → MemTable (内存跳表)   │
└─────────────────────┬───────────────────────────────────┘
                      │ MemTable 满 → 冻结为 Immutable
                      ↓
┌─────────────────────────────────────────────────────────┐
│                      Level 0 (最新)                       │
│  [SSTable-0a] [SSTable-0b] [SSTable-0c]  ← 可能重叠     │
├─────────────────────────────────────────────────────────┤
│                      Level 1                              │
│  [SST-1a][SST-1b][SST-1c][SST-1d]       ← 不重叠(有序) │
├─────────────────────────────────────────────────────────┤
│                      Level 2                              │
│  [SST-2a][SST-2b]...[SST-2p]            ← 容量×10       │
├─────────────────────────────────────────────────────────┤
│                      Level N (最冷)                       │
│  [SST-Na]...[SST-Nz]                    ← 最大层         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 各组件的数据结构

| 组件 | 数据结构 | 作用 |
|------|---------|------|
| WAL | 追加写日志文件 | 崩溃恢复，保证持久性 |
| MemTable | **跳表** (LevelDB) / 红黑树 | 内存中有序写入，O(log n) |
| SSTable | 有序键值对文件 + 索引块 + 布隆过滤器 | 磁盘持久化存储 |
| Manifest | 版本元信息 | 记录各层 SSTable 分布 |
| Bloom Filter | **布隆过滤器** | 快速判断 key 是否可能在某 SSTable 中 |

### 3.3 写入流程

```
步骤 1: 追加写 WAL (顺序IO, 保证持久性)
步骤 2: 插入 MemTable (跳表, 内存操作, 超快)
步骤 3: MemTable 满 (默认4MB) → 冻结为 Immutable MemTable
步骤 4: 后台线程将 Immutable MemTable 序列化为 SSTable 写入 Level 0
步骤 5: Level 0 文件过多时，触发 Compaction (归并排序) 到 Level 1
```

### 3.4 读取流程

```
步骤 1: 查 MemTable (最新数据)
步骤 2: 查 Immutable MemTable
步骤 3: 查 Level 0 各 SSTable (用布隆过滤器快速跳过)
步骤 4: 查 Level 1 (二分定位 + 布隆过滤器)
步骤 5: 逐层向下，直到找到或确认不存在
```

### 3.5 Compaction (核心难点)

```
Level 0 Compaction (Size-Tiered):
  多个重叠 SSTable → 归并排序 → 生成不重叠的 Level 1 文件

Level N Compaction (Leveled):
  选择 Level N 的一个 SSTable
  → 找到 Level N+1 中 key 范围重叠的所有文件
  → 多路归并排序
  → 生成新的 Level N+1 文件
  → 删除旧文件
```

---

## 四、布隆过滤器在 LSM-Tree 中的关键角色

### 4.1 问题：读放大

不做优化时，一次读操作可能需要查询所有层级的所有 SSTable → 大量无效磁盘IO。

### 4.2 解决方案

```
每个 SSTable 文件自带一个布隆过滤器 (存储在文件尾部)

查询 key 时：
  先查布隆过滤器：
    → 返回"不存在" → 100%跳过此文件 (零IO)
    → 返回"可能存在" → 才真正读取数据块
    
效果：99%+ 的无效 SSTable 被布隆过滤器拦截
```

### 4.3 参数选择

| 参数 | LevelDB 默认 | 说明 |
|------|-------------|------|
| bits_per_key | 10 bits | 每个 key 占用 10 bit 位图空间 |
| 假阳性率 | ~1% | 100次查询中约1次误读 |
| 哈希函数数 | k ≈ 0.69 × (bits/key) ≈ 7 | 最优哈希函数个数 |

---

## 五、实际应用场景

### 5.1 Google Bigtable (论文级应用)

- 存储 Google 搜索索引、Gmail、Google Earth 等核心数据
- 单表支持 PB 级数据
- 底层使用 GFS + LSM-Tree 架构

### 5.2 Facebook RocksDB (工业级优化)

```
RocksDB 对 LevelDB 的改进：
├── 多线程 Compaction (LevelDB 单线程)
├── Column Family (逻辑隔离不同数据)
├── 压缩算法可选 (Snappy/Zstd/LZ4)
├── Rate Limiter (限制 Compaction IO 影响)
└── Universal Compaction (适合写极重场景)
```

### 5.3 TiKV (分布式KV)

- PingCAP TiDB 的存储引擎
- 基于 RocksDB + Raft 共识协议
- 支持事务、分布式一致性

### 5.4 Kafka 消息存储

- 消息日志本身就是 LSM-Tree 思想：追加写 + 分段文件 + 后台清理

---

## 六、技术亮点总结

| 亮点 | 说明 |
|------|------|
| 🎯 写入路径全顺序IO | WAL追加 + MemTable内存 + SSTable顺序刷盘，写吞吐量可达数十万QPS |
| 🎯 数据结构组合拳 | 跳表(内存有序) + 布隆过滤器(快速判空) + 归并排序(Compaction) |
| 🎯 分层容量指数增长 | Level N 容量 = Level 0 × 10^N，自动适应数据增长 |
| 🎯 WAL保证持久性 | 即使进程崩溃，已写WAL的数据可恢复，不丢数据 |
| 🎯 Compaction可调优 | Leveled/Size-Tiered/FIFO 多种策略，适配不同读写比 |

---

## 七、面试高频问题

### Q1: LSM-Tree 和 B+树的区别？各自适合什么场景？

> **答题要点**：LSM-Tree 将随机写转为顺序写，适合写多读少(日志、时序、消息队列)。B+树支持原地更新和高效点查/范围查，适合读多写少(OLTP数据库如MySQL)。LSM-Tree 有读放大和空间放大问题，通过布隆过滤器和 Compaction 缓解。

### Q2: Compaction 为什么是必须的？有什么代价？

> **答题要点**：不做 Compaction → 层级越来越多 → 读放大严重。Compaction 通过归并排序合并重叠数据、删除过期版本。代价：写放大(同一数据被多次搬运)、后台IO抖动。优化方式：限速(Rate Limiter)、多线程、调整触发条件。

### Q3: 为什么 MemTable 用跳表而不用哈希表？

> **答题要点**：MemTable 需要有序(flush 为有序 SSTable)。哈希表无序，flush 时需要额外排序 O(n log n)。跳表天然有序，且写入 O(log n)，遍历输出就是有序序列。

---

## 八、核心代码片段 (LevelDB 简化)

```cpp
// MemTable 写入 (跳表插入)
void MemTable::Add(SequenceNumber seq, ValueType type,
                   const Slice& key, const Slice& value) {
    // 编码 internal_key = user_key + sequence + type
    // 插入跳表
    table_.Insert(buf);  // table_ 是 SkipList
}

// 读取路径 (逐层查找)
Status DBImpl::Get(const ReadOptions& options,
                   const Slice& key, std::string* value) {
    // 1. 查 MemTable
    if (mem->Get(key, value, &s)) return s;
    // 2. 查 Immutable MemTable
    if (imm != nullptr && imm->Get(key, value, &s)) return s;
    // 3. 查 SSTable (逐层, 用布隆过滤器加速)
    s = current->Get(options, key, value);
    return s;
}
```

---

## 九、延伸思考

1. **写放大量化**：Level N 的 Compaction 写放大约为 10×(层数)，如何通过调参优化？
2. **Compaction 调度**：高峰期应降低 Compaction 频率避免 IO 争抢，如何设计自适应策略？
3. **新硬件适配**：NVMe SSD 的随机写性能大幅提升，LSM-Tree 的优势是否减弱？

---

> 📖 **推荐阅读**：Google 论文《Bigtable: A Distributed Storage System for Structured Data》(2006) 和 LevelDB 源码 `db/db_impl.cc`，是理解 LSM-Tree 工程实现的最佳材料。
