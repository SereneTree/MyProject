# 模块 1：图的基础与表示

> 本模块覆盖图论最底层的概念、存储方式、遍历算法和连通性分析，是后续所有专题的基石。

---

## 一、图的基本概念

### 1.1 图的分类

| 分类维度 | 类型 | 说明 | 面试要点 |
|---------|------|------|---------|
| 方向 | 无向图/有向图 | 边是否有方向 | 有向图的入度、出度区分 |
| 权重 | 无权图/加权图 | 边是否有权值 | 加权影响最短路算法选择 |
| 密度 | 稀疏图/稠密图 | E接近V还是V² | 影响存储结构和算法选择 |
| 重边 | 简单图/多重图 | 是否允许重边和自环 | 面试默认简单图，除非特别说明 |
| 连通性 | 连通/非连通 | 任意两点是否可达 | 无向图连通分量、有向图SCC |

### 1.2 核心术语速查

| 术语 | 定义 | 面试话术 |
|------|------|---------|
| 度(Degree) | 与该节点相连的边数 | "无向图中节点v的度=与它相邻的边数" |
| 入度/出度 | 有向图中指向/离开该节点的边数 | "入度是指向它的边数，出度是从它出发的边数" |
| 路径(Path) | 从u到v经过的边序列 | "不重复经过节点的叫简单路径" |
| 环(Cycle) | 起点=终点的路径 | "有向图检测环用DFS或拓扑排序" |
| 连通(Connected) | u到v存在路径 | "无向图连通=任意两点可达" |
| 完全图(K_n) | 任意两节点间都有边 | "n个节点的完全图有n(n-1)/2条边" |
| 子图(Subgraph) | V'⊆V, E'⊆E | "只保留原图的部分节点和边" |
| 补图(Complement) | 原图没边的地方有边 | "G和G̅的边并集=完全图" |

### 1.3 握手定理

```
定理: Σ deg(v) = 2|E|

推论:
- 任何图中，奇度节点个数为偶数
- 如果所有节点度≥k，则 |E| ≥ k|V|/2

面试话术:
"每条边贡献两个端点各一个度，所以所有度之和等于边数的两倍。
 由此推出奇度节点的个数一定是偶数——这是证明欧拉路径存在条件的基础。"
```

---

## 二、图的存储结构

### 2.1 邻接矩阵 vs 邻接表

| 对比维度 | 邻接矩阵 | 邻接表 |
|---------|---------|--------|
| 空间复杂度 | O(V²) | O(V+E) |
| 查询边(u,v)是否存在 | O(1) | O(度(u)) |
| 遍历u的所有邻居 | O(V) | O(度(u)) |
| 添加/删除边 | O(1) | O(度) |
| 适用场景 | 稠密图(E≈V²) | 稀疏图(E≈V) |
| Floyd全源最短路 | 天然适配 | 需转换 |
| 实际工业应用 | 小规模/GPU并行 | 大多数场景首选 |

### 2.2 代码实现

```python
# 邻接表实现(最常用)
from collections import defaultdict

class Graph:
    def __init__(self, directed=False):
        self.adj = defaultdict(list)  # 邻接表
        self.directed = directed
    
    def add_edge(self, u, v, weight=1):
        self.adj[u].append((v, weight))
        if not self.directed:
            self.adj[v].append((u, weight))
    
    def neighbors(self, u):
        return self.adj[u]

# 邻接矩阵实现
class GraphMatrix:
    def __init__(self, n):
        self.n = n
        self.matrix = [[0] * n for _ in range(n)]
    
    def add_edge(self, u, v, weight=1):
        self.matrix[u][v] = weight
        self.matrix[v][u] = weight  # 无向图
    
    def has_edge(self, u, v):
        return self.matrix[u][v] != 0  # O(1)
```

### 2.3 面试话术

```
面试官: "什么时候用邻接矩阵，什么时候用邻接表？"

标准回答:
"选择取决于图的密度和操作类型：
 - 稠密图(边数接近V²)或需要O(1)判断边是否存在时，用邻接矩阵
 - 稀疏图(边数接近V)时，邻接表节省大量空间：O(V+E) vs O(V²)
 - Floyd等需要遍历所有点对的算法天然适配矩阵
 - 实际工程中，90%场景用邻接表，因为真实世界的图大多稀疏

工程补充：
 - 大规模图数据库(Neo4j/JanusGraph)底层是邻接表的变体
 - GPU图计算(如cuGraph)有时用CSR(压缩稀疏行)格式，本质是邻接表的紧凑编码"
```

---

## 三、图的遍历

### 3.1 BFS（广度优先搜索）

```python
from collections import deque

def bfs(graph, start):
    """
    BFS核心特性:
    1. 层序遍历：同层节点距起点相同
    2. 无权图最短路：第一次到达某节点的路径就是最短路径
    3. 时间复杂度: O(V+E)
    """
    visited = {start}
    queue = deque([start])
    distance = {start: 0}
    parent = {start: None}
    
    while queue:
        node = queue.popleft()
        for neighbor, _ in graph.neighbors(node):
            if neighbor not in visited:
                visited.add(neighbor)
                distance[neighbor] = distance[node] + 1
                parent[neighbor] = node
                queue.append(neighbor)
    
    return distance, parent

# BFS应用：无权图最短路径还原
def shortest_path_bfs(graph, start, end):
    distance, parent = bfs(graph, start)
    if end not in parent:
        return None  # 不可达
    
    path = []
    node = end
    while node is not None:
        path.append(node)
        node = parent[node]
    return path[::-1]
```

**BFS典型应用**：
| 应用 | 说明 |
|------|------|
| 无权图最短路径 | 第一次到达即最短 |
| 层次遍历 | 树的层序遍历就是BFS |
| 连通分量计数 | 对每个未访问节点BFS |
| 二分图判定 | BFS染色法 |
| 拓扑排序(Kahn) | BFS+入度 |

### 3.2 DFS（深度优先搜索）

```python
def dfs_iterative(graph, start):
    """
    DFS核心特性:
    1. 深入回溯：一条路走到底再回头
    2. 发现时间/完成时间：用于SCC、拓扑排序等
    3. 时间复杂度: O(V+E)
    """
    visited = set()
    stack = [start]
    order = []
    
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        
        for neighbor, _ in graph.neighbors(node):
            if neighbor not in visited:
                stack.append(neighbor)
    
    return order

def dfs_recursive(graph, node, visited=None):
    """递归DFS(更直观，但大图可能栈溢出)"""
    if visited is None:
        visited = set()
    
    visited.add(node)
    for neighbor, _ in graph.neighbors(node):
        if neighbor not in visited:
            dfs_recursive(graph, neighbor, visited)
    
    return visited
```

**DFS典型应用**：
| 应用 | 说明 |
|------|------|
| 环检测 | 有向图三色标记法 |
| 拓扑排序 | DFS后序翻转 |
| 强连通分量 | Tarjan/Kosaraju |
| 割点与桥 | DFS树+low值 |
| 回溯搜索 | 组合/排列/子集枚举 |

### 3.3 BFS vs DFS 面试对比

```
面试话术:
"BFS和DFS都是O(V+E)的遍历，区别在于遍历顺序和适用场景：

BFS(队列)：
  - 层序展开，先访问近邻再访问远端
  - 适合：最短路径(无权)、层次分析、最小步数问题
  - 空间：O(V)(最坏情况队列存一整层)

DFS(栈/递归)：
  - 深入到底再回溯
  - 适合：环检测、拓扑排序、连通分量、回溯搜索
  - 空间：O(V)(递归深度/栈深度)

关键区别：BFS保证无权图最短路径，DFS不保证。
工程上：BFS的内存压力通常更大(一层很宽时)，DFS递归有栈溢出风险(链很深时)。"
```

---

## 四、连通性分析

### 4.1 无向图连通分量

```python
def count_connected_components(graph, n):
    """
    求无向图的连通分量数
    方法: 对每个未访问的节点启动BFS/DFS
    """
    visited = set()
    count = 0
    
    for node in range(n):
        if node not in visited:
            count += 1
            bfs(graph, node)  # 标记整个连通分量
            # visited 会被更新
    
    return count
```

### 4.2 有向图强连通分量(Tarjan)

```python
def tarjan_scc(graph, n):
    """
    Tarjan算法求强连通分量:
    - dfn[u]: u的DFS发现时间
    - low[u]: u能回溯到的最早发现时间
    - 当 dfn[u] == low[u] 时，u是一个SCC的根
    
    时间复杂度: O(V+E)
    """
    dfn = [0] * n
    low = [0] * n
    on_stack = [False] * n
    stack = []
    timer = [0]
    sccs = []
    
    def dfs(u):
        timer[0] += 1
        dfn[u] = low[u] = timer[0]
        stack.append(u)
        on_stack[u] = True
        
        for v, _ in graph.neighbors(u):
            if dfn[v] == 0:  # 未访问
                dfs(v)
                low[u] = min(low[u], low[v])
            elif on_stack[v]:  # 在栈中(回边)
                low[u] = min(low[u], dfn[v])
        
        # 如果u是SCC的根
        if dfn[u] == low[u]:
            scc = []
            while True:
                v = stack.pop()
                on_stack[v] = False
                scc.append(v)
                if v == u:
                    break
            sccs.append(scc)
    
    for i in range(n):
        if dfn[i] == 0:
            dfs(i)
    
    return sccs
```

### 4.3 割点与桥

```python
def find_bridges(graph, n):
    """
    求桥(删除后图不连通的边):
    条件: 边(u,v)是桥 ⟺ low[v] > dfn[u]
    即v的子树无法回到u或u的祖先
    """
    dfn = [0] * n
    low = [0] * n
    timer = [0]
    bridges = []
    
    def dfs(u, parent):
        timer[0] += 1
        dfn[u] = low[u] = timer[0]
        
        for v, _ in graph.neighbors(u):
            if v == parent:
                continue
            if dfn[v] == 0:
                dfs(v, u)
                low[u] = min(low[u], low[v])
                if low[v] > dfn[u]:  # 桥的判定条件
                    bridges.append((u, v))
            else:
                low[u] = min(low[u], dfn[v])
    
    for i in range(n):
        if dfn[i] == 0:
            dfs(i, -1)
    
    return bridges
```

### 4.4 并查集(Union-Find)

```python
class UnionFind:
    """
    并查集: 动态连通性判断
    - find: 找到根节点(带路径压缩)
    - union: 合并两个集合(按秩合并)
    - 摊还复杂度: O(α(n)) ≈ O(1)
    """
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.count = n  # 连通分量数
    
    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # 路径压缩
        return self.parent[x]
    
    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return False  # 已连通
        
        # 按秩合并
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        
        self.count -= 1
        return True
    
    def connected(self, x, y):
        return self.find(x) == self.find(y)
```

---

## 五、拓扑排序

### 5.1 Kahn算法(BFS)

```python
from collections import deque

def topological_sort_kahn(graph, n):
    """
    Kahn算法:
    1. 计算所有节点入度
    2. 入度为0的加入队列
    3. 弹出节点，减少后继入度
    4. 新产生的入度为0的加入队列
    
    如果最终排序长度 < n → 有环!
    """
    in_degree = [0] * n
    for u in range(n):
        for v, _ in graph.neighbors(u):
            in_degree[v] += 1
    
    queue = deque([i for i in range(n) if in_degree[i] == 0])
    order = []
    
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor, _ in graph.neighbors(node):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
    
    if len(order) != n:
        return None  # 有环
    return order
```

### 5.2 DFS后序法

```python
def topological_sort_dfs(graph, n):
    """
    DFS拓扑排序:
    - DFS完成后序(post-order)的逆序 = 拓扑序
    - 同时可检测环(遇到灰色节点)
    """
    WHITE, GRAY, BLACK = 0, 1, 2
    color = [WHITE] * n
    result = []
    has_cycle = [False]
    
    def dfs(u):
        if has_cycle[0]:
            return
        color[u] = GRAY
        
        for v, _ in graph.neighbors(u):
            if color[v] == GRAY:
                has_cycle[0] = True
                return
            if color[v] == WHITE:
                dfs(v)
        
        color[u] = BLACK
        result.append(u)
    
    for i in range(n):
        if color[i] == WHITE:
            dfs(i)
    
    if has_cycle[0]:
        return None
    return result[::-1]  # 后序翻转
```

---

## 六、高频面试题精选

| 题目 | 答案要点 |
|------|---------|
| 如何判断无向图是否有环？ | DFS中遇到已访问且非父节点的邻居=有环；或并查集(加边时两端同根=有环) |
| 如何判断有向图是否有环？ | DFS三色法(遇灰=有环)；或拓扑排序(无法排完所有点=有环) |
| 如何求无向图连通分量数？ | BFS/DFS对每个未访问点启动遍历，启动次数=分量数；或并查集统计根数 |
| BFS求最短路的前提条件？ | 无权图(或所有边权相同)；加权图必须用Dijkstra |
| 并查集的时间复杂度？ | 单次操作O(α(n))，α为反阿克曼函数，实际视为O(1) |
| 拓扑排序两种方法区别？ | Kahn(BFS入度法)适合并行调度/输出一个拓扑序；DFS后序法更适合检测环/缩点 |
| 什么时候用DFS什么时候用BFS？ | 最短路/层次→BFS；环检测/拓扑/SCC/回溯→DFS |
| 图的存储如何选择？ | 稀疏图+遍历操作→邻接表；稠密图+判断边存在→邻接矩阵 |

---

> 💡 **记忆口诀**：BFS层层扩(队列)找最短，DFS一路深(栈)探连通。握手定理度和双边数，并查集近O(1)判连通。
