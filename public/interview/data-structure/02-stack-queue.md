# 栈与队列——面试高频考点

## 知识框架

```
栈与队列
├── 栈 (Stack) — LIFO
│   ├── 数组栈 / 链栈
│   ├── 单调栈
│   └── 最小栈
├── 队列 (Queue) — FIFO
│   ├── 普通队列
│   ├── 双端队列 (Deque)
│   ├── 循环队列
│   └── 优先队列 (堆)
└── 设计题
    ├── 用栈实现队列
    ├── 用队列实现栈
    └── 滑动窗口最大值
```

---

## 一、栈与队列速查对比

| 对比维度 | 栈 (Stack) | 队列 (Queue) |
|----------|-----------|-------------|
| 原则 | LIFO (后进先出) | FIFO (先进先出) |
| 核心操作 | push / pop / peek | enqueue / dequeue / front |
| 典型实现 | 数组尾部操作 / 链表头部 | 循环数组 / 链表 |
| 经典应用 | 括号匹配、表达式求值、DFS | BFS、消息队列、缓冲区 |
| Java实现 | `Deque<Integer> stack = new ArrayDeque<>()` | `Queue<Integer> q = new LinkedList<>()` |

---

## 二、栈的核心考点

### 2.1 典型应用场景

| 场景 | 说明 |
|------|------|
| 括号匹配 | 左括号入栈，右括号匹配栈顶 |
| 表达式求值 | 中缀→后缀(操作符栈)，后缀求值(操作数栈) |
| 函数调用栈 | 递归本质是栈，栈溢出=递归太深 |
| 撤销/重做 | 操作栈(Undo) + 重做栈(Redo) |
| DFS遍历 | 显式栈代替递归 |
| 浏览器前进后退 | 两个栈互相转移 |

### 2.2 有效的括号 (LeetCode 20)

```java
boolean isValid(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        if (c == '(') stack.push(')');
        else if (c == '[') stack.push(']');
        else if (c == '{') stack.push('}');
        else if (stack.isEmpty() || stack.pop() != c)
            return false;
    }
    return stack.isEmpty();
}
```

### 2.3 最小栈 (LeetCode 155)

```java
// 辅助栈：同步记录当前最小值
class MinStack {
    Deque<Integer> stack = new ArrayDeque<>();
    Deque<Integer> minStack = new ArrayDeque<>();
    
    void push(int val) {
        stack.push(val);
        minStack.push(minStack.isEmpty() ? val : Math.min(val, minStack.peek()));
    }
    void pop() { stack.pop(); minStack.pop(); }
    int top() { return stack.peek(); }
    int getMin() { return minStack.peek(); }  // O(1)
}
```

### 2.4 单调栈 (Monotone Stack)

```
核心思想：栈内元素保持单调递增/递减

经典应用：「下一个更大元素」「每日温度」「接雨水」「柱状图最大矩形」

模板 (下一个更大元素):
```

```java
int[] nextGreater(int[] nums) {
    int n = nums.length;
    int[] res = new int[n];
    Arrays.fill(res, -1);
    Deque<Integer> stack = new ArrayDeque<>(); // 存索引
    
    for (int i = 0; i < n; i++) {
        while (!stack.isEmpty() && nums[i] > nums[stack.peek()]) {
            res[stack.pop()] = nums[i];
        }
        stack.push(i);
    }
    return res;
}
// 时间O(n)，每个元素最多入栈出栈各一次
```

### 2.5 表达式求值 (逆波兰/后缀表达式)

```
中缀: 3 + 4 * 2 - 1
后缀: 3 4 2 * + 1 -

转换规则 (操作符栈)：
  - 数字 → 直接输出
  - 左括号 → 入栈
  - 右括号 → 弹栈直到左括号
  - 操作符 → 弹出栈顶所有优先级≥自己的操作符，再入栈

后缀求值 (操作数栈)：
  - 数字 → 入栈
  - 操作符 → 弹出两个操作数，计算结果入栈
```

---

## 三、队列的核心考点

### 3.1 循环队列 (LeetCode 622)

```java
class MyCircularQueue {
    int[] data;
    int head = 0, tail = 0, size = 0, capacity;
    
    MyCircularQueue(int k) { data = new int[k]; capacity = k; }
    
    boolean enQueue(int value) {
        if (isFull()) return false;
        data[tail] = value;
        tail = (tail + 1) % capacity;
        size++;
        return true;
    }
    boolean deQueue() {
        if (isEmpty()) return false;
        head = (head + 1) % capacity;
        size--;
        return true;
    }
    int Front() { return isEmpty() ? -1 : data[head]; }
    int Rear() { return isEmpty() ? -1 : data[(tail - 1 + capacity) % capacity]; }
    boolean isEmpty() { return size == 0; }
    boolean isFull() { return size == capacity; }
}
```

### 3.2 双端队列 (Deque)

```
支持两端插入和删除：
  - addFirst / addLast
  - removeFirst / removeLast
  - peekFirst / peekLast

Java: ArrayDeque (推荐) 或 LinkedList
应用: 滑动窗口、工作窃取调度
```

### 3.3 优先队列 / 堆 (PriorityQueue)

```
底层: 完全二叉树 (数组存储)
性质: 父节点 ≤ 子节点 (小顶堆) 或 ≥ (大顶堆)

核心操作:
  - insert: 尾部插入 + 上浮 siftUp — O(log n)
  - poll:   取出堆顶 + 末尾元素补顶 + 下沉 siftDown — O(log n)
  - peek:   O(1) 取最小/最大

应用场景:
  - Top K 问题 (维护大小为K的小顶堆)
  - 合并K个有序链表
  - Dijkstra最短路径
  - 中位数维护 (大顶堆+小顶堆)
  - 任务调度(操作系统进程优先级)
```

```java
// Top K 最大元素 — 用小顶堆
PriorityQueue<Integer> minHeap = new PriorityQueue<>(k);
for (int num : nums) {
    minHeap.offer(num);
    if (minHeap.size() > k) minHeap.poll(); // 淘汰最小的
}
// minHeap 中剩下的就是最大的K个
```

---

## 四、经典设计题

### 4.1 用栈实现队列 (LeetCode 232)

```java
class MyQueue {
    Deque<Integer> inStack = new ArrayDeque<>();
    Deque<Integer> outStack = new ArrayDeque<>();
    
    void push(int x) { inStack.push(x); }
    
    int pop() {
        if (outStack.isEmpty()) {
            while (!inStack.isEmpty()) outStack.push(inStack.pop());
        }
        return outStack.pop();
    }
    
    int peek() {
        if (outStack.isEmpty()) {
            while (!inStack.isEmpty()) outStack.push(inStack.pop());
        }
        return outStack.peek();
    }
    
    boolean empty() { return inStack.isEmpty() && outStack.isEmpty(); }
}
// 均摊时间复杂度 O(1)
```

### 4.2 滑动窗口最大值 (LeetCode 239)

```java
// 单调递减双端队列
int[] maxSlidingWindow(int[] nums, int k) {
    int n = nums.length;
    int[] res = new int[n - k + 1];
    Deque<Integer> deque = new ArrayDeque<>(); // 存索引
    
    for (int i = 0; i < n; i++) {
        // 移除超出窗口的元素
        while (!deque.isEmpty() && deque.peekFirst() < i - k + 1)
            deque.pollFirst();
        // 维护单调递减
        while (!deque.isEmpty() && nums[deque.peekLast()] < nums[i])
            deque.pollLast();
        deque.offerLast(i);
        // 记录结果
        if (i >= k - 1) res[i - k + 1] = nums[deque.peekFirst()];
    }
    return res;
}
// 时间O(n)，空间O(k)
```

---

## 五、面试真题与话术

### Q1: 栈和队列的区别？各自应用场景？

> **答**：栈是LIFO(后进先出)，像一摞盘子；队列是FIFO(先进先出)，像排队。栈适合具有"嵌套"特征的问题：括号匹配、函数调用、表达式求值、DFS。队列适合具有"先来先服务"特征的问题：BFS层序遍历、消息队列、任务调度、缓冲区。

### Q2: 如何用两个栈实现队列？时间复杂度是多少？

> **答**：一个输入栈in、一个输出栈out。入队时push到in栈。出队时如果out栈非空直接pop；out栈空则将in栈全部倒入out再pop。每个元素最多被搬运一次，所以均摊时间复杂度O(1)。

### Q3: 什么是单调栈？适用什么问题？

> **答**：单调栈是栈内元素保持单调递增或递减的栈。当新元素破坏单调性时，弹出栈顶直到恢复。适用于「寻找下一个更大/更小元素」类问题：每日温度、接雨水、柱状图最大矩形。时间复杂度O(n)，因为每个元素最多进出栈各一次。

### Q4: 堆（优先队列）的核心操作和应用？

> **答**：堆是完全二叉树，大/小顶堆保证父节点大于/小于子节点。核心操作：insert上浮O(logn)、poll下沉O(logn)、peek O(1)、buildHeap O(n)。应用：Top K(小顶堆维护K个最大)、合并K路有序(每次取最小)、Dijkstra(贪心取最短)、中位数(双堆法)。

### Q5: 循环队列的判空和判满条件？

> **答**：用size变量最清晰：`size==0`为空，`size==capacity`为满。如果不用size，用front和rear指针：牺牲一个空间，`front==rear`为空，`(rear+1)%capacity==front`为满。

---

## 六、复杂度速查卡

| 数据结构 | push/enqueue | pop/dequeue | peek/front | 空间 |
|----------|-------------|-------------|-----------|------|
| 数组栈 | O(1)* | O(1) | O(1) | O(n) |
| 链栈 | O(1) | O(1) | O(1) | O(n) |
| 循环队列 | O(1) | O(1) | O(1) | O(n) |
| 优先队列(堆) | O(log n) | O(log n) | O(1) | O(n) |
| 双端队列 | O(1) | O(1) | O(1) | O(n) |

> *均摊O(1)，极端情况需要扩容O(n)
