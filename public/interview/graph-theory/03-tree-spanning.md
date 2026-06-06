# 模块 3：树与生成树

> 树是图论中最基础也是应用最广的结构。最小生成树(MST)是面试必考题，LCA和树形DP是进阶考点。

---

## 一、树的基本性质

### 1.1 等价定义（面试必背）

以下条件**等价**——任意一条成立即可定义"树"：

| 序号 | 条件 | 面试话术 |
|------|------|---------|
| 1 | 连通无环图 | "树就是连通且没有环的图" |
| 2 | 连通且恰好 V-1 条边 | "n个节点n-1条边且连通" |
| 3 | 无环且恰好 V-1 条边 | "n-1条边且无环" |
| 4 | 任意两点间有且仅有一条路径 | "任何两个节点之间的路径唯一" |
| 5 | 连通，删去任意一条边后不连通 | "每条边都是桥" |
| 6 | 无环，加入任意一条边后产生恰好一个环 | "加边必成环" |

### 1.2 常见树的类型

| 类型 | 特征 | 面试场景 |
|------|------|---------|
| 无根树 | 无特定根，边无方向 | MST问题 |
| 有根树 | 指定根节点，有父子关系 | LCA、树形DP |
| 二叉树 | 每个节点最多两个孩子 | 数据结构面试核心 |
| 完全二叉树 | 除最后一层外全满 | 堆的底层结构 |
| 平衡二叉树(AVL) | 左右子树高度差≤1 | 查找效率保证 |
| B树/B+树 | 多路平衡搜索树 | 数据库索引 |

### 1.3 树的基本定理

```
1. n个节点的树恰好有 n-1 条边
2. 树中任意两点之间有且仅有一条简单路径
3. n个节点的有标号树有 n^(n-2) 棵 (Cayley公式)
4. 树是最小连通图(删任意边不连通)
5. 树是最大无环图(加任意边出现环)
```

---

## 二、最小生成树(MST)

### 2.1 问题定义

```
给定无向连通加权图 G = (V, E, W)
找一棵生成树 T(包含所有V个节点，V-1条边)
使得总边权 Σw(e) 最小

关键性质:
- 割边性质(Cut Property): 对于任意割，跨越该割的最小边一定在某棵MST中
- 环边性质(Cycle Property): 对于任意环，环中最大边一定不在某棵MST中
```

### 2.2 Kruskal 算法

```python
def kruskal(edges, n):
    """
    Kruskal: 按边权排序 + 并查集
    
    思路: 贪心选最小边，只要不成环就加入MST
    时间: O(ElogE) = O(ElogV)  (排序为瓶颈)
    适合: 稀疏图(E远小于V²)
    """
    edges.sort(key=lambda x: x[2])  # 按权重排序
    uf = UnionFind(n)
    mst = []
    total_weight = 0
    
    for u, v, w in edges:
        if not uf.connected(u, v):  # 不在同一集合(不会成环)
            uf.union(u, v)
            mst.append((u, v, w))
            total_weight += w
            
            if len(mst) == n - 1:  # 已选够n-1条边
                break
    
    if len(mst) != n - 1:
        return None  # 图不连通
    return mst, total_weight
```

### 2.3 Prim 算法

```python
import heapq

def prim(graph, n):
    """
    Prim: 从一个点开始，每次选最小的"跨边"扩展
    
    思路: 类似Dijkstra，维护"已加入MST的节点集合"，每次贪心选最小跨边
    时间: O(ElogV) (优先队列)
    适合: 稠密图 或 需要从特定点出发
    """
    visited = [False] * n
    mst = []
    total_weight = 0
    
    # 从节点0出发
    pq = [(0, 0, -1)]  # (权重, 当前节点, 来源节点)
    
    while pq and len(mst) < n:
        w, u, prev = heapq.heappop(pq)
        
        if visited[u]:
            continue
        visited[u] = True
        
        if prev != -1:
            mst.append((prev, u, w))
            total_weight += w
        
        for v, weight in graph.neighbors(u):
            if not visited[v]:
                heapq.heappush(pq, (weight, v, u))
    
    return mst, total_weight
```

### 2.4 Kruskal vs Prim 面试对比

```
面试话术:
"Kruskal和Prim都是贪心算法，区别在于贪心策略：

Kruskal(边视角):
  - 全局按边排序，每次选最小边(不成环则加入)
  - 用并查集判断环
  - O(ElogE)，适合稀疏图(边少排序快)
  - 天然支持不连通图(求最小生成森林)

Prim(点视角):
  - 从一个点出发，每次选最小跨边扩展
  - 用优先队列维护候选边
  - O(ElogV)，适合稠密图
  - 类似Dijkstra的扩展方式

选择建议:
  E < V²/logV → Kruskal更快
  E ≈ V²(稠密) → Prim(数组版O(V²))更快
  面试编码 → Kruskal更好写(排序+并查集)"
```

---

## 三、最近公共祖先(LCA)

### 3.1 问题定义

```
给定有根树，查询两个节点u和v的最近公共祖先(LCA)
即: u和v的公共祖先中深度最大的那个

应用:
- 树上两点距离: dist(u,v) = depth(u) + depth(v) - 2*depth(LCA(u,v))
- 树上路径查询: u→v的路径经过LCA
- 版本控制(Git): 两个分支的共同祖先commit
```

### 3.2 倍增法(Binary Lifting)

```python
import math

class LCA:
    """
    倍增法求LCA
    预处理: O(VlogV)
    单次查询: O(logV)
    """
    def __init__(self, tree, root, n):
        self.LOG = int(math.log2(n)) + 1
        self.depth = [0] * n
        self.up = [[0] * n for _ in range(self.LOG)]  # up[k][v] = v的2^k祖先
        
        # BFS预处理depth和直接父节点
        from collections import deque
        queue = deque([root])
        visited = [False] * n
        visited[root] = True
        self.up[0][root] = root
        
        while queue:
            u = queue.popleft()
            for v, _ in tree.neighbors(u):
                if not visited[v]:
                    visited[v] = True
                    self.depth[v] = self.depth[u] + 1
                    self.up[0][v] = u  # v的直接父节点=u
                    queue.append(v)
        
        # 预处理倍增表: up[k][v] = up[k-1][up[k-1][v]]
        for k in range(1, self.LOG):
            for v in range(n):
                self.up[k][v] = self.up[k-1][self.up[k-1][v]]
    
    def query(self, u, v):
        """查询u和v的LCA"""
        # 保证u更深
        if self.depth[u] < self.depth[v]:
            u, v = v, u
        
        # 将u提升到和v同深度
        diff = self.depth[u] - self.depth[v]
        for k in range(self.LOG):
            if (diff >> k) & 1:
                u = self.up[k][u]
        
        if u == v:
            return u
        
        # 同时往上跳，找到LCA的下一层
        for k in range(self.LOG - 1, -1, -1):
            if self.up[k][u] != self.up[k][v]:
                u = self.up[k][u]
                v = self.up[k][v]
        
        return self.up[0][u]  # 再跳一步就是LCA
```

---

## 四、树形DP

### 4.1 树的直径

```python
def tree_diameter(tree, n):
    """
    树的直径: 树中最长路径的长度
    
    方法1: 两次BFS
      - 从任意点出发BFS找最远点u
      - 从u出发BFS找最远点v
      - dist(u,v) = 直径
    
    方法2: 树形DP
      - 对每个节点，计算经过它的最长路径
      - = 最深子树 + 次深子树
    """
    # 方法2: 树形DP
    diameter = [0]
    
    def dfs(node, parent):
        max_depth = 0
        second_depth = 0
        
        for child, weight in tree.neighbors(node):
            if child == parent:
                continue
            child_depth = dfs(child, node) + weight
            
            if child_depth > max_depth:
                second_depth = max_depth
                max_depth = child_depth
            elif child_depth > second_depth:
                second_depth = child_depth
        
        # 经过当前节点的最长路径 = 最深+次深
        diameter[0] = max(diameter[0], max_depth + second_depth)
        return max_depth
    
    dfs(0, -1)
    return diameter[0]
```

### 4.2 树的中心(重心)

```python
def tree_centroid(tree, n):
    """
    树的重心: 删除后最大子树最小的节点
    
    性质:
    - 以重心为根，所有子树大小 ≤ n/2
    - 树最多有两个重心(相邻)
    - 应用: 点分治的分治中心
    """
    subtree_size = [0] * n
    max_subtree = [n] * n  # 删除该节点后最大连通分量
    centroid = [0]
    
    def dfs(node, parent):
        subtree_size[node] = 1
        max_part = 0
        
        for child, _ in tree.neighbors(node):
            if child == parent:
                continue
            dfs(child, node)
            subtree_size[node] += subtree_size[child]
            max_part = max(max_part, subtree_size[child])
        
        # 不在子树中的部分
        max_part = max(max_part, n - subtree_size[node])
        max_subtree[node] = max_part
        
        if max_part < max_subtree[centroid[0]]:
            centroid[0] = node
    
    dfs(0, -1)
    return centroid[0]
```

---

## 五、树的遍历(有根树)

| 遍历方式 | 顺序 | 应用 |
|---------|------|------|
| 前序(Pre-order) | 根→左→右 | 复制树结构、表达式前缀记法 |
| 中序(In-order) | 左→根→右 | BST得到有序序列 |
| 后序(Post-order) | 左→右→根 | 计算子树大小、释放内存 |
| 层序(Level-order) | 按层从左到右 | BFS、按层输出 |

```python
# 欧拉序(Euler Tour): 进出各记录一次 → 区间查询
def euler_tour(tree, root, n):
    """
    欧拉序: 每个节点记录进入时间和离开时间
    子树u的所有节点 = euler[tin[u] : tout[u]+1]
    用途: 将树上查询转化为区间查询(线段树/BIT)
    """
    tin = [0] * n
    tout = [0] * n
    timer = [0]
    euler = []
    
    def dfs(u, parent):
        timer[0] += 1
        tin[u] = timer[0]
        euler.append(u)
        
        for v, _ in tree.neighbors(u):
            if v != parent:
                dfs(v, u)
        
        tout[u] = timer[0]
    
    dfs(root, -1)
    return tin, tout, euler
```

---

## 六、高频面试题精选

| 题目 | 答案要点 |
|------|---------|
| 如何判断一个图是树？ | 连通 + 边数=V-1；或连通+无环 |
| Kruskal和Prim哪个适合稀疏图？ | Kruskal O(ElogE)；稀疏图E≈V，Kruskal更快 |
| MST一定唯一吗？ | 不一定！边权有相同值时可能多棵；边权两两不同则唯一 |
| 如何求树上两点距离？ | dist(u,v) = depth(u) + depth(v) - 2×depth(LCA(u,v)) |
| 树的直径怎么求？ | 两次BFS(找最远点)或树形DP(最深+次深) |
| 什么是最小生成树的割边性质？ | 对任意割，跨越该割的最小权边一定属于MST |
| n个节点的有标号树有多少棵？ | Cayley公式: n^(n-2) 棵 |
| 并查集在MST中的作用？ | Kruskal用并查集O(α(n))判断加边是否成环 |

---

> 💡 **记忆口诀**：树连通n减一边，Kruskal排序查集判，Prim扩展选最短，LCA倍增跳祖先。
