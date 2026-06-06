# 哈希表——面试高频考点

## 知识框架

```
哈希表 (Hash Table)
├── 哈希函数设计
│   ├── 除留余数法
│   ├── 乘法散列
│   └── 一致性哈希
├── 冲突解决
│   ├── 链地址法 (Chaining)
│   ├── 开放寻址法 (Open Addressing)
│   │   ├── 线性探测
│   │   ├── 二次探测
│   │   └── 双重哈希
│   └── 再哈希法
├── 扩容与缩容
│   ├── 负载因子
│   ├── rehash
│   └── 渐进式rehash (Redis)
└── 工程实现
    ├── Java HashMap
    ├── Java ConcurrentHashMap
    ├── Redis Dict
    └── 一致性哈希 (分布式)
```

---

## 一、哈希表核心原理

### 1.1 基本思想

```
目标：实现 O(1) 的键值存取

原理：
  key → hash(key) → index (桶位置) → value

示例：
  hash("apple") = 5  →  table[5] = "苹果"
  hash("banana") = 2 →  table[2] = "香蕉"
```

### 1.2 哈希函数设计原则

| 原则 | 说明 |
|------|------|
| 确定性 | 同一key始终映射到同一位置 |
| 均匀性 | 尽量均匀分散到各桶，减少冲突 |
| 高效性 | 计算速度快，O(1) |
| 雪崩效应 | 输入微小变化 → 输出巨大变化 |

### 1.3 常见哈希函数

```
1. 除留余数法: hash(key) = key % m  (m取质数效果好)
2. 乘法散列:   hash(key) = floor(m × (key×A mod 1))  A≈0.618
3. MurmurHash: 工业级通用哈希(Redis/Kafka使用)
4. MD5/SHA:    密码学哈希(用于校验,太慢不适合哈希表)
```

---

## 二、冲突解决方案

### 2.1 链地址法 (Chaining) — 最主流

```
table[0] → NULL
table[1] → [key1,val1] → [key5,val5] → NULL
table[2] → [key2,val2] → NULL
table[3] → [key3,val3] → [key7,val7] → [key9,val9] → NULL
...

优点：简单、删除方便、负载因子可>1
缺点：链表过长性能退化为O(n)
优化：链表→红黑树 (Java HashMap, 长度>8时转换)
```

### 2.2 开放寻址法 (Open Addressing)

```
冲突时按规则探测下一个空位：

线性探测: h(key, i) = (h(key) + i) % m
  优点：简单，缓存友好(连续内存)
  缺点：聚集现象(cluster)

二次探测: h(key, i) = (h(key) + c1*i + c2*i²) % m
  优点：减少一次聚集
  缺点：二次聚集仍可能

双重哈希: h(key, i) = (h1(key) + i*h2(key)) % m
  优点：分布最均匀
  缺点：计算稍复杂
```

### 2.3 两种方案对比

| 对比维度 | 链地址法 | 开放寻址法 |
|----------|---------|-----------|
| 实现 | 数组+链表/树 | 纯数组 |
| 内存 | 额外指针/节点开销 | 无额外开销 |
| 缓存 | 链表跳转不友好 | 数组连续友好 |
| 负载因子 | 可>1 | 必须<1 (通常<0.7) |
| 删除 | 简单(断链) | 需要标记(懒删除) |
| 应用 | Java HashMap | Python dict、Redis |

---

## 三、Java HashMap 深度剖析 (面试最高频！)

### 3.1 底层结构

```
JDK 8 HashMap = 数组 + 链表 + 红黑树

┌─────┐
│  0  │ → null
├─────┤
│  1  │ → [Node] → [Node] → null      (链表)
├─────┤
│  2  │ → [TreeNode 红黑树]             (链长>8)
├─────┤
│ ... │
├─────┤
│  15 │ → [Node] → null
└─────┘

默认初始容量: 16
负载因子: 0.75
扩容阈值: 16 × 0.75 = 12
```

### 3.2 put() 流程

```
1. 计算 hash: (h = key.hashCode()) ^ (h >>> 16)  ← 扰动函数
2. 计算桶位: index = hash & (capacity - 1)      ← 等价于 % capacity
3. 若桶为空 → 直接放入 Node
4. 若桶非空：
   a. key相同(equals) → 覆盖value
   b. 是TreeNode → 红黑树插入
   c. 是链表 → 尾插法
      - 插入后链长>8 且 capacity≥64 → 转红黑树 (treeify)
5. size > threshold → 扩容 resize()
```

### 3.3 扩容 (resize) 机制

```
触发条件: size > capacity × loadFactor

扩容过程:
  1. 新容量 = 旧容量 × 2  (始终是2的幂)
  2. 新建数组
  3. rehash: 每个元素重新计算桶位
     JDK8优化: hash & oldCap == 0 → 位置不变
                hash & oldCap == 1 → 位置+oldCap
     (无需重新计算hash，只看多出的一位)
```

### 3.4 为什么容量是2的幂？

```
1. 取模优化: hash % capacity = hash & (capacity - 1)  (位运算更快)
2. 扩容优化: 新位置 = 原位置 或 原位置+oldCap (只看一个bit)
3. 分布均匀: 配合扰动函数效果最好
```

### 3.5 线程安全问题

```
HashMap 非线程安全:
  JDK 7: 多线程扩容可能形成环形链表 → 死循环
  JDK 8: 多线程put可能数据覆盖/丢失

解决方案:
  - Collections.synchronizedMap() → 全表锁，性能差
  - ConcurrentHashMap → 分段锁(JDK7) / CAS+synchronized(JDK8)
  - Hashtable → 全表synchronized，已过时
```

---

## 四、ConcurrentHashMap (并发HashMap)

### 4.1 JDK 7 vs JDK 8

| 版本 | 实现方式 | 锁粒度 |
|------|---------|--------|
| JDK 7 | Segment数组(分段锁) + HashEntry | 锁Segment(16段) |
| JDK 8 | Node数组 + CAS + synchronized | 锁单个桶(更细粒度) |

### 4.2 JDK 8 ConcurrentHashMap

```
put流程:
  1. key为null → 抛异常
  2. hash计算桶位
  3. 桶为空 → CAS写入(无锁)
  4. 桶非空 → synchronized锁住桶头节点
     → 链表/红黑树正常插入
  5. 链长>8 → treeify

size统计:
  使用 baseCount + CounterCell[] 分散计数
  类似 LongAdder 思想，减少CAS竞争
```

---

## 五、一致性哈希 (分布式系统)

### 5.1 问题背景

```
传统取模: server = hash(key) % N
问题: 增减机器时，大量key需要重新映射 → 缓存雪崩

一致性哈希: 只影响相邻节点的key，其他不动
```

### 5.2 原理

```
将哈希空间组织成环 (0 ~ 2^32-1):

        Node_A (hash=100)
       /
  ----○----
 /    ↑    \
|     |     ○ Node_B (hash=300)
|     |     |
 \    |    /
  ----○----
       \
        Node_C (hash=500)

key的归属: 顺时针找到的第一个节点
新增节点: 只影响其逆时针相邻节点的部分key
删除节点: 其key顺移给顺时针下一个节点

虚拟节点: 每个物理节点映射多个虚拟节点 → 负载更均衡
```

---

## 六、面试真题与话术

### Q1: HashMap的底层实现？put的流程？

> **答**：JDK8的HashMap底层是数组+链表+红黑树。put时先对key的hashCode做扰动(高16位异或低16位)，然后用hash & (capacity-1)定位桶。桶空直接放；桶非空则遍历链表：key相同覆盖，否则尾插。链表长度>8且数组>=64时转红黑树。最后检查是否超过阈值需要扩容。

### Q2: HashMap为什么线程不安全？怎么解决？

> **答**：JDK7多线程扩容时头插法可能形成环形链表导致死循环。JDK8虽改为尾插法无环，但多线程put仍可能数据覆盖丢失(两个线程同时CAS写同一桶)。解决方案：①ConcurrentHashMap(推荐，CAS+桶锁，细粒度)；②Collections.synchronizedMap(全表锁，性能差)。

### Q3: HashMap扩容机制？为什么容量是2的幂？

> **答**：当元素数>容量×0.75时触发扩容，新容量翻倍。2的幂使得取模可用位运算`hash & (cap-1)`代替(快几倍)。扩容时JDK8用`hash & oldCap`判断新位置：为0留在原位，为1则移到原位+oldCap，无需重算hash值。

### Q4: 哈希冲突的解决方法？HashMap用的哪种？

> **答**：两大类：①链地址法(Java HashMap)：冲突的元素用链表/红黑树串起来；②开放寻址法(Python dict)：冲突时探测下一个空位。HashMap选链地址法+树化优化：链长≤8用链表O(n)退化可接受，>8转红黑树O(logn)保证最坏性能。

### Q5: ConcurrentHashMap如何实现线程安全？

> **答**：JDK8的ConcurrentHashMap：桶为空时用CAS无锁写入；桶非空时用synchronized锁住桶头节点(粒度极细，只锁一个桶)。size统计使用baseCount+CounterCell数组分散计数(类似LongAdder)，避免单点CAS竞争。相比JDK7的Segment分段锁(16段)，JDK8粒度更细、性能更好。

### Q6: 什么是一致性哈希？解决什么问题？

> **答**：传统hash取模在增减机器时大量key需要迁移。一致性哈希将hash空间组织成环，key顺时针找第一个节点存放。增减节点只影响相邻节点的部分key，其他不动。配合虚拟节点(每个物理节点映射多个虚拟节点到环上)解决数据倾斜。应用：分布式缓存(Memcached)、负载均衡、分布式数据库分片。

---

## 七、复杂度速查卡

| 操作 | 平均 | 最坏 | 说明 |
|------|------|------|------|
| 查找 | O(1) | O(n)/O(logn) | 最坏=全冲突(链表/树) |
| 插入 | O(1) | O(n)/O(logn) | 可能触发扩容O(n) |
| 删除 | O(1) | O(n)/O(logn) | |
| 扩容 | O(n) | O(n) | rehash所有元素 |
| 空间 | O(n) | O(n) | |

| HashMap关键参数 | 值 | 说明 |
|----------------|-----|------|
| 初始容量 | 16 | 必须2的幂 |
| 负载因子 | 0.75 | 时间和空间的折中 |
| 树化阈值 | 8 | 链表→红黑树 |
| 反树化阈值 | 6 | 红黑树→链表 |
| 最小树化容量 | 64 | 容量<64时优先扩容 |
