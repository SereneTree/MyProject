# 数组与链表——面试高频考点

## 知识框架

```
线性表
├── 数组 (Array)
│   ├── 静态数组 (固定长度)
│   ├── 动态数组 (ArrayList/Vector)
│   └── 多维数组 / 矩阵
└── 链表 (Linked List)
    ├── 单链表
    ├── 双向链表
    ├── 循环链表
    └── 跳表 (Skip List)
```

---

## 一、数组 vs 链表 速查对比表

| 对比维度 | 数组 (Array) | 链表 (Linked List) |
|----------|-------------|-------------------|
| 内存布局 | **连续**存储 | **离散**存储(指针连接) |
| 随机访问 | O(1) — 按下标直接定位 | O(n) — 需要从头遍历 |
| 头部插入 | O(n) — 需要整体后移 | O(1) — 修改指针 |
| 尾部插入 | O(1) 摊销 (动态数组) | O(1) (维护tail指针) |
| 中间插入 | O(n) — 需要移动后续元素 | O(1) — 找到位置后改指针 |
| 删除 | O(n) — 需要移动元素 | O(1) — 改指针(已知前驱) |
| 空间利用 | 可能浪费(预分配) | 无浪费但有指针开销 |
| 缓存友好 | ✅ 连续内存，预取高效 | ❌ 随机地址，缓存不友好 |
| 扩容 | 需要重新分配+复制 | 天然支持动态增长 |
| 适用场景 | 频繁随机访问、已知大小 | 频繁插删、大小不定 |

---

## 二、数组核心考点

### 2.1 动态数组扩容机制

```
ArrayList (Java) / vector (C++) 扩容策略：

初始容量: 10 (Java ArrayList)
扩容时机: size == capacity
扩容倍率: 1.5倍 (Java) / 2倍 (C++ vector)
过程:
  1. 新建 1.5倍大小的数组
  2. 复制旧数组元素 → O(n)
  3. 释放旧数组

均摊时间复杂度分析：
  n次push_back的总复制次数 ≤ n + n/2 + n/4 + ... ≈ 2n
  均摊每次 push_back = O(1)
```

### 2.2 面试高频操作

| 操作 | 时间复杂度 | 技巧 |
|------|-----------|------|
| 两数之和 | O(n) | 哈希表存 target-nums[i] |
| 三数之和 | O(n²) | 排序+双指针 |
| 移除元素 | O(n) | 快慢指针(原地操作) |
| 合并有序数组 | O(m+n) | 从后向前填充 |
| 螺旋矩阵 | O(m×n) | 上下左右四边界收缩 |
| 最大子数组和 | O(n) | Kadane算法(动态规划) |

### 2.3 双指针技巧

```
类型1: 对撞指针 (两端向中间)
  - 有序数组两数之和
  - 接雨水
  - 回文判断

类型2: 快慢指针 (同向不同速)
  - 移除重复元素
  - 链表环检测
  - 找中间节点

类型3: 滑动窗口 (左右边界)
  - 无重复字符最长子串
  - 最小覆盖子串
  - 长度最小的子数组
```

---

## 三、链表核心考点

### 3.1 单链表基本操作

```java
// 节点定义
class ListNode {
    int val;
    ListNode next;
    ListNode(int val) { this.val = val; }
}

// 头插法建表 O(1)
node.next = head;
head = node;

// 尾插法建表 O(1)  (维护tail)
tail.next = node;
tail = node;

// 删除节点 (已知前驱prev)
prev.next = prev.next.next;

// 在node后插入newNode
newNode.next = node.next;
node.next = newNode;
```

### 3.2 哨兵节点(虚拟头节点)技巧

```java
// 很多链表题加一个dummy节点可以统一边界处理
ListNode dummy = new ListNode(0);
dummy.next = head;
// ... 操作 ...
return dummy.next;  // 新的头节点
```

### 3.3 链表经典面试题

#### 反转链表 (最高频！)

```java
// 迭代法
ListNode reverse(ListNode head) {
    ListNode prev = null, curr = head;
    while (curr != null) {
        ListNode next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

// 递归法
ListNode reverse(ListNode head) {
    if (head == null || head.next == null) return head;
    ListNode newHead = reverse(head.next);
    head.next.next = head;
    head.next = null;
    return newHead;
}
```

#### 快慢指针检测环

```java
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}

// 找环入口 (Floyd算法)
ListNode detectCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {
            ListNode ptr = head;
            while (ptr != slow) {
                ptr = ptr.next;
                slow = slow.next;
            }
            return ptr; // 环入口
        }
    }
    return null;
}
```

#### 合并两个有序链表

```java
ListNode mergeTwoLists(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0);
    ListNode curr = dummy;
    while (l1 != null && l2 != null) {
        if (l1.val <= l2.val) {
            curr.next = l1;
            l1 = l1.next;
        } else {
            curr.next = l2;
            l2 = l2.next;
        }
        curr = curr.next;
    }
    curr.next = (l1 != null) ? l1 : l2;
    return dummy.next;
}
```

### 3.4 双向链表

```
结构: prev ← [A] ⇄ [B] ⇄ [C] ⇄ [D] → next

优势：
  - 双向遍历，支持O(1)删除(无需知道前驱)
  - LRU缓存的核心组件

应用：
  - Java LinkedList (双向链表+实现List和Deque)
  - LRU Cache (HashMap + 双向链表)
  - 浏览器前进后退
```

---

## 四、跳表 (Skip List)

### 4.1 结构原理

```
Level 3:  HEAD ────────────────────→ 50 ────────→ NIL
Level 2:  HEAD ──→ 20 ────────────→ 50 ──→ 70 ──→ NIL
Level 1:  HEAD → 10 → 20 → 30 → 40 → 50 → 60 → 70 → NIL
```

### 4.2 复杂度

| 操作 | 平均 | 最坏 |
|------|------|------|
| 查找 | O(log n) | O(n) |
| 插入 | O(log n) | O(n) |
| 删除 | O(log n) | O(n) |
| 空间 | O(n) | O(n log n) |

### 4.3 面试要点

> **Q: 为什么Redis用跳表不用红黑树？**
> - 实现简单(~200行 vs 500+行)
> - 范围查询天然支持(沿底层链表遍历)
> - 并发友好(局部CAS，无需全局旋转)
> - 功能等价(增删查都是O(log n))

---

## 五、面试真题与话术

### Q1: 数组和链表的区别？什么时候用哪个？

> **答**：数组连续存储，支持O(1)随机访问，但插删需要移动元素O(n)，且需要预分配空间。链表离散存储用指针连接，插删O(1)但访问需O(n)遍历。选择标准：频繁随机读取选数组(如数据库行存储)；频繁插删且大小不定选链表(如LRU缓存、操作系统进程调度)。现代实践中，由于CPU缓存局部性，数组通常性能更好(如std::vector优先于std::list)。

### Q2: 如何O(1)时间删除链表节点(只给目标节点指针)？

> **答**：把下一个节点的值拷贝到当前节点，然后删除下一个节点。即 `node.val = node.next.val; node.next = node.next.next;`。注意：这个方法不适用于尾节点。

### Q3: 动态数组为什么选择1.5倍或2倍扩容？

> **答**：扩容倍率是时间(复制频率)和空间(浪费率)的折中。倍率太大浪费空间，太小频繁扩容。1.5倍(Java)比2倍(C++)更省空间但扩容稍频繁。数学上，2倍扩容使得旧空间永远不能被复用(对内存分配器不友好)，1.5倍可以。

### Q4: 如何找到链表倒数第K个节点？

> **答**：双指针法。快指针先走K步，然后快慢同步走，快指针到达末尾时慢指针就在倒数第K个。时间O(n)，空间O(1)。也可以用栈或先遍历计算长度再正向走(n-k)步。

### Q5: ArrayList和LinkedList在Java中如何选择？

> **答**：几乎所有场景都选ArrayList。原因：①CPU缓存局部性使连续内存访问快几十倍；②LinkedList每个节点额外24字节开销(prev+next+对象头)；③即使中间插删，ArrayList移动元素的memcpy比链表追指针快(小数据量下)。LinkedList仅在频繁头部操作且不需随机访问时才有优势。

---

## 六、复杂度速查卡

| 数据结构 | 访问 | 查找 | 插入 | 删除 | 空间 |
|----------|------|------|------|------|------|
| 数组 | O(1) | O(n) | O(n) | O(n) | O(n) |
| 动态数组 | O(1) | O(n) | O(1)* | O(n) | O(n) |
| 单链表 | O(n) | O(n) | O(1)† | O(1)† | O(n) |
| 双向链表 | O(n) | O(n) | O(1)† | O(1) | O(n) |
| 跳表 | O(logn) | O(logn) | O(logn) | O(logn) | O(n) |

> *均摊O(1)；†已知位置时O(1)
