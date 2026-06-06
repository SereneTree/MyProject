# 树与二叉树——面试高频考点

## 知识框架

```
树
├── 二叉树 (Binary Tree)
│   ├── 遍历 (前序/中序/后序/层序)
│   ├── 二叉搜索树 (BST)
│   ├── 平衡二叉树
│   │   ├── AVL树
│   │   └── 红黑树
│   └── 完全二叉树 → 堆
├── 多路搜索树
│   ├── B树 (B-Tree)
│   ├── B+树
│   └── 2-3树 / 2-3-4树
├── 字典树 (Trie)
└── 线段树 / 树状数组
```

---

## 一、二叉树遍历 (最高频考点)

### 1.1 四种遍历方式

```
        1
       / \
      2   3
     / \   \
    4   5   6

前序 (Pre-order):   1 → 2 → 4 → 5 → 3 → 6  (根-左-右)
中序 (In-order):    4 → 2 → 5 → 1 → 3 → 6  (左-根-右)
后序 (Post-order):  4 → 5 → 2 → 6 → 3 → 1  (左-右-根)
层序 (Level-order): 1 → 2 → 3 → 4 → 5 → 6  (BFS)
```

### 1.2 递归实现

```java
// 前序遍历
void preorder(TreeNode root, List<Integer> res) {
    if (root == null) return;
    res.add(root.val);        // 根
    preorder(root.left, res);  // 左
    preorder(root.right, res); // 右
}

// 中序遍历
void inorder(TreeNode root, List<Integer> res) {
    if (root == null) return;
    inorder(root.left, res);   // 左
    res.add(root.val);         // 根
    inorder(root.right, res);  // 右
}

// 后序遍历
void postorder(TreeNode root, List<Integer> res) {
    if (root == null) return;
    postorder(root.left, res);  // 左
    postorder(root.right, res); // 右
    res.add(root.val);          // 根
}
```

### 1.3 迭代实现 (用栈模拟递归)

```java
// 前序遍历 - 迭代
List<Integer> preorderIterative(TreeNode root) {
    List<Integer> res = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    if (root != null) stack.push(root);
    while (!stack.isEmpty()) {
        TreeNode node = stack.pop();
        res.add(node.val);
        if (node.right != null) stack.push(node.right); // 先右后左
        if (node.left != null) stack.push(node.left);
    }
    return res;
}

// 中序遍历 - 迭代
List<Integer> inorderIterative(TreeNode root) {
    List<Integer> res = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode curr = root;
    while (curr != null || !stack.isEmpty()) {
        while (curr != null) {
            stack.push(curr);
            curr = curr.left;  // 一路向左
        }
        curr = stack.pop();
        res.add(curr.val);     // 访问
        curr = curr.right;     // 转向右子树
    }
    return res;
}
```

### 1.4 层序遍历 (BFS)

```java
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> res = new ArrayList<>();
    if (root == null) return res;
    Queue<TreeNode> queue = new LinkedList<>();
    queue.offer(root);
    while (!queue.isEmpty()) {
        int size = queue.size();
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.offer(node.left);
            if (node.right != null) queue.offer(node.right);
        }
        res.add(level);
    }
    return res;
}
```

---

## 二、二叉搜索树 (BST)

### 2.1 核心性质

```
BST性质：左子树所有节点 < 根 < 右子树所有节点
         中序遍历结果是有序递增序列

操作复杂度:
  - 查找: O(h)，h为树高
  - 插入: O(h)
  - 删除: O(h)
  - 平衡BST: h = O(log n)
  - 退化链表: h = O(n)
```

### 2.2 BST 的增删查

```java
// 查找
TreeNode search(TreeNode root, int target) {
    if (root == null || root.val == target) return root;
    return target < root.val ? search(root.left, target) : search(root.right, target);
}

// 插入
TreeNode insert(TreeNode root, int val) {
    if (root == null) return new TreeNode(val);
    if (val < root.val) root.left = insert(root.left, val);
    else root.right = insert(root.right, val);
    return root;
}

// 删除 (三种情况)
TreeNode delete(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.val) root.left = delete(root.left, key);
    else if (key > root.val) root.right = delete(root.right, key);
    else {
        // 情况1&2: 只有一个子节点或无子节点
        if (root.left == null) return root.right;
        if (root.right == null) return root.left;
        // 情况3: 两个子节点 → 找右子树最小值(后继)替换
        TreeNode successor = findMin(root.right);
        root.val = successor.val;
        root.right = delete(root.right, successor.val);
    }
    return root;
}
```

### 2.3 BST 面试高频题

| 题目 | 思路 |
|------|------|
| 验证BST | 中序遍历是否递增 / 递归传递上下界 |
| BST第K小 | 中序遍历到第K个 |
| BST最近公共祖先 | 利用BST性质，值在p和q之间即为LCA |
| 将有序数组转为BST | 二分取中点作为根，递归建左右子树 |

---

## 三、平衡二叉树

### 3.1 AVL 树

```
性质：任一节点的左右子树高度差(平衡因子) ≤ 1
维护：插入/删除后通过旋转恢复平衡

四种旋转：
  LL (左左): 右旋
  RR (右右): 左旋
  LR (左右): 先左旋后右旋
  RL (右左): 先右旋后左旋
```

### 3.2 红黑树 (面试超高频！)

```
五大性质：
  1. 每个节点是红色或黑色
  2. 根节点是黑色
  3. 叶子节点(NIL)是黑色
  4. 红色节点的子节点必须是黑色(不能连续红)
  5. 从任一节点到叶子的所有路径包含相同数目的黑色节点

推论：最长路径 ≤ 2 × 最短路径 (红黑交替 vs 全黑)
```

### 3.3 AVL vs 红黑树对比

| 对比维度 | AVL 树 | 红黑树 |
|----------|--------|--------|
| 平衡严格度 | 严格 (高度差≤1) | 近似 (最长≤2×最短) |
| 查询性能 | 略优 (更矮) | 略逊 |
| 插删性能 | 较慢 (旋转多) | 较快 (旋转少，最多3次) |
| 适用场景 | 查询密集(数据库) | 插删频繁(内存数据结构) |
| 工程应用 | 数据库索引 | Java TreeMap/HashMap、Linux CFS |

---

## 四、B树与B+树 (数据库必考)

### 4.1 B树 (B-Tree)

```
性质 (m阶B树):
  - 每个节点最多 m 个子节点
  - 每个非根非叶节点至少 ⌈m/2⌉ 个子节点
  - 根节点至少2个子节点 (除非是叶子)
  - 所有叶子在同一层
  - 节点内关键字有序

特点：
  - 多路平衡，树高极低 (3-4层存储数千万数据)
  - 每个节点可存多个关键字，减少磁盘IO次数
```

### 4.2 B+树 (面试重点！)

```
B+树 vs B树的区别：
┌────────────────────────┬──────────────────────────────┐
│         B树            │           B+树               │
├────────────────────────┼──────────────────────────────┤
│ 数据存在所有节点       │ 数据只存在叶子节点           │
│ 非叶节点存数据+指针    │ 非叶节点只存索引+指针        │
│ 搜索可能不到叶子就结束 │ 搜索必须到叶子              │
│ 叶子无链表连接         │ 叶子节点形成有序链表         │
│ 范围查询需要中序遍历   │ 范围查询沿链表顺序读取       │
└────────────────────────┴──────────────────────────────┘

B+树适合数据库索引的三个原因：
  1. 非叶节点不存数据 → 每个节点能放更多索引 → 树更矮 → IO更少
  2. 叶子有序链表 → 范围查询(WHERE age BETWEEN 20 AND 30)极高效
  3. 查询路径等长 → 性能稳定可预测
```

### 4.3 B+树结构示意

```
          [30 | 60]              ← 内部节点(只有索引)
         /    |    \
   [10|20] [30|40|50] [60|70|80]  ← 叶子节点(存真实数据)
      ↔         ↔         ↔      ← 叶子间双向链表
```

---

## 五、堆 (Heap)

### 5.1 核心性质与操作

```
完全二叉树 + 堆序性:
  - 大顶堆: parent ≥ children
  - 小顶堆: parent ≤ children

数组存储 (下标从0开始):
  - parent(i) = (i-1) / 2
  - left(i)   = 2*i + 1
  - right(i)  = 2*i + 2

核心操作:
  - siftUp:   插入后上浮 O(log n)
  - siftDown: 删除堆顶后下沉 O(log n)
  - buildHeap: 从最后一个非叶节点开始下沉 O(n)
```

### 5.2 堆排序

```java
void heapSort(int[] arr) {
    int n = arr.length;
    // 建堆 O(n)
    for (int i = n/2 - 1; i >= 0; i--) siftDown(arr, n, i);
    // 逐个取出堆顶 O(n log n)
    for (int i = n - 1; i > 0; i--) {
        swap(arr, 0, i);       // 堆顶(最大)放到末尾
        siftDown(arr, i, 0);   // 恢复堆性质
    }
}

void siftDown(int[] arr, int n, int i) {
    int largest = i;
    int left = 2*i + 1, right = 2*i + 2;
    if (left < n && arr[left] > arr[largest]) largest = left;
    if (right < n && arr[right] > arr[largest]) largest = right;
    if (largest != i) {
        swap(arr, i, largest);
        siftDown(arr, n, largest);
    }
}
```

---

## 六、字典树 (Trie)

```
应用：自动补全、拼写检查、IP路由、词频统计

结构：
       root
      / | \
     a  b  c
    / \    |
   p   n   a
   |   |   |
   p   d   t  → "cat"
   |
   l
   |
   e  → "apple"

时间复杂度：O(L)，L为字符串长度(与总数据量无关！)
```

---

## 七、面试真题与话术

### Q1: 二叉树前中后序遍历的区别和应用？

> **答**：前序(根左右)适合复制树、序列化；中序(左根右)对BST产生有序序列；后序(左右根)适合计算子树大小/释放内存(先处理子节点再处理父节点)。三种遍历都是DFS的变体，时间空间都是O(n)。

### Q2: 为什么MySQL用B+树做索引而不用红黑树/哈希？

> **答**：三个原因：①B+树多路扁平，3-4层可存千万级数据，而红黑树二叉结构层数达20+层，磁盘IO多几十倍；②B+树叶子链表支持范围查询(BETWEEN/ORDER BY)，哈希不支持；③B+树每次查询路径等长，性能稳定可预测。哈希只适合等值查询(=)，不支持范围/排序/模糊匹配。

### Q3: 红黑树的五大性质？为什么能保证O(log n)？

> **答**：①节点红或黑；②根黑；③NIL叶黑；④红节点的子节点必黑(不连续红)；⑤任一节点到叶子的黑色节点数相同。由性质4和5推出：最长路径(红黑交替)≤2×最短路径(全黑)，所以树高≤2log(n+1)，保证O(log n)。

### Q4: 堆和BST的区别？什么时候用堆？

> **答**：BST保证左<根<右，支持有序遍历和查找O(logn)。堆只保证父≥子(大顶堆)，不支持任意查找但取最大/最小是O(1)。用堆的场景：只关心最值(Top K、优先级调度)而不需要全局有序时选堆；需要有序操作(范围查询、中序遍历)时选BST。

### Q5: 完全二叉树为什么可以用数组存储？

> **答**：完全二叉树除最后一层外全满，最后一层从左到右连续。这意味着节点编号连续无空洞，父子关系可通过下标计算(parent=i/2, left=2i, right=2i+1)。相比链式存储，数组节省指针空间(每节点省2个指针=16字节)，且内存连续缓存友好。堆的实现都用数组。

### Q6: 如何根据前序+中序还原二叉树？

> **答**：前序第一个元素是根；在中序中找到根的位置，左边是左子树，右边是右子树；根据左子树长度在前序中切分出左右子树的前序序列；递归重建。时间O(n)，用哈希表存中序位置可加速查找。

---

## 八、复杂度速查卡

| 数据结构 | 查找 | 插入 | 删除 | 空间 |
|----------|------|------|------|------|
| BST (平均) | O(log n) | O(log n) | O(log n) | O(n) |
| BST (最坏) | O(n) | O(n) | O(n) | O(n) |
| AVL树 | O(log n) | O(log n) | O(log n) | O(n) |
| 红黑树 | O(log n) | O(log n) | O(log n) | O(n) |
| B+树 (磁盘) | O(log_m n) | O(log_m n) | O(log_m n) | O(n) |
| 堆 | O(n)* | O(log n) | O(log n) | O(n) |
| Trie | O(L) | O(L) | O(L) | O(N×L) |

> *堆查找任意元素O(n)，查找最大/最小O(1)

