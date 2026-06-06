# 案例三：字节跳动内容去重——布隆过滤器与 Count-Min Sketch

## 概览

| 项目 | 内容 |
|------|------|
| 企业 | 字节跳动 (ByteDance) |
| 产品 | 抖音/今日头条 推荐系统、爬虫引擎 |
| 核心数据结构 | 布隆过滤器 (Bloom Filter)、Count-Min Sketch |
| 应用场景 | 推荐去重、内容指纹判重、URL爬取去重、热点计数 |
| 处理规模 | 日均数百亿次判重请求，数十亿URL/内容指纹 |

---

## 一、业务痛点

### 1.1 推荐系统去重

```
用户刷抖音/头条：
  - 每天产生 ~100亿次 推荐请求
  - 每次推荐需要过滤掉「用户已看过」的内容
  - 每个用户可能已看过 10,000+ 条内容
  
问题：如何在 <10ms 内判断「用户X是否看过内容Y」？
```

### 1.2 为什么不能用 HashSet？

| 方案 | 1亿用户×1万条已读 | 存储开销 |
|------|-------------------|---------|
| HashSet (Java) | 1亿 × 1万 × 48B/entry | **~48 PB** ❌ |
| Redis Set | 1亿 × 1万 × 64B | **~64 PB** ❌ |
| 布隆过滤器 | 1亿 × 1万 × 10bit | **~12 TB** ✅ |

**存储节省：4000倍！** 代价仅为 ~1% 假阳性率（少推荐一些内容，用户无感知）。

### 1.3 爬虫 URL 去重

```
字节跳动搜索爬虫：
  - 已爬取 URL 池：数百亿条
  - 新发现 URL → 需要判断是否已爬取
  - 用 HashSet 存储所有URL → 内存爆炸
  - 用布隆过滤器 → 数GB内存搞定
```

---

## 二、布隆过滤器设计详解

### 2.1 基本原理

```
┌──────────────────────────────────────────────────┐
│  位数组 (Bit Array):  m = 100 bits                │
│  [0|0|1|0|1|0|0|1|0|0|1|0|0|1|0|0|0|1|0|0|...] │
└──────────────────────────────────────────────────┘

插入元素 "hello":
  h1("hello") = 3  → bit[3] = 1
  h2("hello") = 7  → bit[7] = 1  
  h3("hello") = 13 → bit[13] = 1

查询元素 "world":
  h1("world") = 5  → bit[5] = 0 → 一定不存在! (快速返回)

查询元素 "hello":
  h1("hello") = 3  → bit[3] = 1 ✓
  h2("hello") = 7  → bit[7] = 1 ✓
  h3("hello") = 13 → bit[13] = 1 ✓
  → 可能存在 (有一定假阳性率)
```

### 2.2 关键特性

| 特性 | 说明 |
|------|------|
| 假阴性 | **不可能** — 说不存在就一定不存在 |
| 假阳性 | **可能** — 说存在有一定概率误判 |
| 删除支持 | **不支持** — 一个 bit 可能被多个元素共享 |
| 空间效率 | 每元素仅需 ~10 bits (对比 HashSet 的 ~48 bytes) |
| 时间复杂度 | O(k)，k为哈希函数数量，通常 k < 10 |

### 2.3 参数设计公式

```
已知：
  n = 预期插入元素数
  p = 期望假阳性率

最优参数：
  m = -(n × ln(p)) / (ln2)²     ← 位数组大小
  k = (m/n) × ln2               ← 最优哈希函数数量

实际案例（字节推荐去重）：
  n = 10,000 (用户已看条数)
  p = 0.01 (1% 误判率)
  → m = 95,851 bits ≈ 12 KB / 用户
  → k = 7 个哈希函数
  
  1亿用户总计: 12KB × 1亿 = 1.2 TB (可接受!)
```

---

## 三、字节跳动的工程优化

### 3.1 分层布隆过滤器

```
┌─────────────────────────────────────────┐
│ Layer 1: 热用户 (DAU前10%) → Redis      │
│          布隆过滤器 in-memory            │
│          响应 < 1ms                      │
├─────────────────────────────────────────┤
│ Layer 2: 活跃用户 → 分布式布隆过滤器     │
│          分片存储在多台机器               │
│          响应 < 5ms                      │
├─────────────────────────────────────────┤
│ Layer 3: 低活用户 → 磁盘布隆过滤器       │
│          按需加载, LRU缓存               │
│          响应 < 20ms                     │
└─────────────────────────────────────────┘
```

### 3.2 时间衰减布隆过滤器

```
问题：用户看过的内容会无限增长 → 布隆过滤器越来越大 → 假阳性率上升

解决方案：Rotating Bloom Filter (滚动布隆过滤器)

┌──────────┐  ┌──────────┐  ┌──────────┐
│ 本周 BF  │  │ 上周 BF  │  │ 上上周BF │ → 过期删除
│ (写入中) │  │ (只读)   │  │ (只读)   │
└──────────┘  └──────────┘  └──────────┘

查询时：OR(本周, 上周, 上上周)
效果：自动遗忘3周前看过的内容 → 允许重新推荐
```

### 3.3 Redis Bloom Filter 模块

```redis
# 字节内部使用的 Redis Bloom 命令
BF.RESERVE user:1001:seen 0.01 10000   # 创建: 1%误判率, 预期1万元素
BF.ADD user:1001:seen "content:12345"   # 标记已看
BF.EXISTS user:1001:seen "content:67890" # 查询是否看过
BF.INFO user:1001:seen                   # 查看当前状态
```

---

## 四、Count-Min Sketch：热点内容计数

### 4.1 业务场景

```
抖音热搜/热门：
  - 实时统计每条视频的播放次数
  - 视频总量：数十亿条
  - 精确计数 (HashMap<videoId, count>) → 内存爆炸
  
  解决：用 Count-Min Sketch 进行近似频率统计
  - 只需几MB内存，就能跟踪所有视频的播放量级
  - 对热门内容(Top K)的统计几乎精确
```

### 4.2 Count-Min Sketch 原理

```
d = 5 行 (5个独立哈希函数)
w = 10000 列

       col_0   col_1   col_2   ...   col_9999
row_0: [  0  ] [  3  ] [  0  ] ... [  2  ]
row_1: [  1  ] [  0  ] [  5  ] ... [  0  ]
row_2: [  0  ] [  2  ] [  0  ] ... [  1  ]
row_3: [  3  ] [  0  ] [  0  ] ... [  0  ]
row_4: [  0  ] [  0  ] [  4  ] ... [  0  ]

插入 "video_A":
  h0("video_A") = 1 → counter[0][1] += 1
  h1("video_A") = 2 → counter[1][2] += 1
  h2("video_A") = 1 → counter[2][1] += 1
  h3("video_A") = 0 → counter[3][0] += 1
  h4("video_A") = 2 → counter[4][2] += 1

查询 "video_A" 的频率:
  min(counter[0][1], counter[1][2], counter[2][1], counter[3][0], counter[4][2])
  → 取最小值作为估计 (只可能高估，不会低估)
```

### 4.3 与精确计数的对比

| 对比维度 | HashMap 精确计数 | Count-Min Sketch |
|----------|-----------------|-----------------|
| 空间 | O(n) — 数十亿条目 | O(d×w) — 几MB固定 |
| 查询 | O(1) 精确值 | O(d) 近似值 (偏高) |
| 适用 | 精确需求 | Top K / 热度排序 |
| 内存 (10亿视频) | ~64GB | ~8MB |

---

## 五、实际应用架构

### 5.1 抖音推荐去重完整链路

```
用户请求推荐 → 召回层 (候选集1000条)
                    ↓
              布隆过滤器去重 (过滤已看, 剩余800条)
                    ↓
              粗排模型打分 (保留200条)
                    ↓
              精排模型打分 (保留50条)
                    ↓
              多样性/时效性重排 (最终10条)
                    ↓
              返回用户 + BF.ADD 标记已看
```

### 5.2 爬虫 URL 去重架构

```
新发现 URL
    ↓
本地布隆过滤器 (L1, in-process, ns级)
    ↓ 可能是新URL
分布式布隆过滤器 (L2, Redis集群, ms级)
    ↓ 确认是新URL
写入爬取队列 + 同时写入 L1 & L2 布隆过滤器
```

---

## 六、技术亮点总结

| 亮点 | 说明 |
|------|------|
| 🎯 4000倍空间压缩 | 布隆过滤器相比HashSet节省数千倍内存，使亿级去重成为可能 |
| 🎯 假阳性率可控 | 通过调参(m, k)精确控制误判率，业务可接受1%漏推 |
| 🎯 滚动过期策略 | Rotating BF 解决无限增长问题，兼顾去重和内容重新曝光 |
| 🎯 分层存储策略 | 热/温/冷用户不同存储层，成本和性能最优化 |
| 🎯 CMS + Top K 联合 | Count-Min Sketch 低成本追踪全量频率，仅对Top K精确维护 |

---

## 七、面试高频问题

### Q1: 布隆过滤器的原理？为什么不能删除元素？

> **答题要点**：位数组 + k个哈希函数。插入时将k个位置置1，查询时检查k个位置是否全为1。不能删除因为一个bit可能被多个元素映射到(共享)，删除一个元素会影响其他元素的判断。变体「Counting Bloom Filter」用计数器替代bit可支持删除，但空间扩大3-4倍。

### Q2: 如何选择布隆过滤器的参数？

> **答题要点**：给定预期元素数n和期望误判率p，最优位数组大小 m = -(n·ln(p))/(ln2)²，最优哈希函数数 k = (m/n)·ln2。实际工程中常用 bits_per_key = 10 (对应 p ≈ 1%)。

### Q3: 布隆过滤器和 HashMap 在什么场景下选谁？

> **答题要点**：需要精确判断 → HashMap；只需判断"可能存在/一定不存在"且数据量巨大 → 布隆过滤器。场景示例：缓存穿透防护(BF拦截不存在的key)、推荐去重(漏推可接受)、爬虫URL判重。

### Q4: 什么是 Count-Min Sketch？和布隆过滤器有什么关系？

> **答题要点**：CMS是布隆过滤器的"计数版"推广。布隆过滤器回答"是否存在"(0/1)，CMS回答"出现了多少次"(计数)。结构类似(二维数组+多哈希)，CMS取所有行的最小值作为频率估计。适合大规模流式数据的频率统计(Top K热搜、流量异常检测)。

---

## 八、代码实现参考

### 8.1 简易布隆过滤器 (Python)

```python
import mmh3  # MurmurHash3

class BloomFilter:
    def __init__(self, size: int, num_hashes: int):
        self.size = size
        self.num_hashes = num_hashes
        self.bit_array = [0] * size
    
    def add(self, item: str):
        for seed in range(self.num_hashes):
            index = mmh3.hash(item, seed) % self.size
            self.bit_array[index] = 1
    
    def might_contain(self, item: str) -> bool:
        for seed in range(self.num_hashes):
            index = mmh3.hash(item, seed) % self.size
            if self.bit_array[index] == 0:
                return False  # 一定不存在
        return True  # 可能存在

# 使用示例
bf = BloomFilter(size=100000, num_hashes=7)
bf.add("content:12345")
bf.add("content:67890")

print(bf.might_contain("content:12345"))  # True
print(bf.might_contain("content:99999"))  # False (大概率)
```

### 8.2 简易 Count-Min Sketch (Python)

```python
import mmh3

class CountMinSketch:
    def __init__(self, width: int, depth: int):
        self.width = width
        self.depth = depth
        self.table = [[0] * width for _ in range(depth)]
    
    def add(self, item: str, count: int = 1):
        for i in range(self.depth):
            j = mmh3.hash(item, i) % self.width
            self.table[i][j] += count
    
    def estimate(self, item: str) -> int:
        return min(
            self.table[i][mmh3.hash(item, i) % self.width]
            for i in range(self.depth)
        )

# 使用示例
cms = CountMinSketch(width=10000, depth=5)
for _ in range(100):
    cms.add("hot_video_001")
for _ in range(3):
    cms.add("cold_video_999")

print(cms.estimate("hot_video_001"))  # ≈100
print(cms.estimate("cold_video_999"))  # ≈3
```

---

## 九、延伸思考

1. **Cuckoo Filter**：支持删除的布隆过滤器替代方案，空间效率更优，字节新系统逐步采用
2. **HyperLogLog**：另一种概率数据结构，用于基数(UV)统计，12KB 内存可统计 2^64 个不同元素
3. **分布式布隆过滤器一致性**：多机部署时如何保证各分片的一致性？最终一致还是强一致？

---

> 📖 **推荐论文**：《Space/Time Trade-offs in Hash Coding with Allowable Errors》(Bloom, 1970) 和 《An Improved Data Stream Summary: The Count-Min Sketch》(Cormode & Muthukrishnan, 2005)
