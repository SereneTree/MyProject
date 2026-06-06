# 图——面试高频考点

## 知识框架

```
图 (Graph)
├── 存储方式
│   ├── 邻接矩阵
│   ├── 邻接表
│   └── 边集数组
├── 遍历
│   ├── BFS (广度优先)
│   └── DFS (深度优先)
├── 最短路径
│   ├── Dijkstra (单源，无负权)
│   ├── Bellman-Ford (单源，可负权)
│   ├── Floyd (多源)
│   └── SPFA (队列优化BF)
├── 最小生成树
│   ├── Prim (顶点贪心)
│   └── Kruskal (边贪心+并查集)
├── 拓扑排序 (DAG)
├── 关键路径
└── 并查集 (Union-Find)
```

---

## 一、图的存储方式

### 1.1 速查对比

| 存储方式 | 空间 | 查边 | 遍历邻居 | 适用场景 |
|----------|------|------|---------|---------|
| 邻接矩阵 | O(V²) | O(1) | O(V) | 稠密图、小规模 |
| 邻接表 | O(V+E) | O(degree) | O(degree) | 稀疏图、大规模 |
| 边集数组 | O(E) | O(E) | O(E) | Kruskal、边操作 |

### 1.2 邻接表实现

```java
// 邻接表 (最常用)
List<List<int[]>> graph = new ArrayList<>();
for (int i = 0; i < n; i++) graph.add(new ArrayList<>());

// 添加边 u → v, 权重 w
graph.get(u).add(new int[]{v, w});
// 无向图则双向添加
graph.get(v).add(new int[]{u, w});
```

---

## 二、BFS 与 DFS

### 2.1 BFS (广度优先搜索)

```java
// BFS 模板 — 层序遍历/最短路径
void bfs(int start, List<List<Integer>> graph) {
    boolean[] visited = new boolean[n];
    Queue<Integer> queue = new LinkedList<>();
    queue.offer(start);
    visited[start] = true;
    int level = 0;
    
    while (!queue.isEmpty()) {
        int size = queue.size();
        for (int i = 0; i < size; i++) {
            int node = queue.poll();
            // 处理当前节点
            for (int neighbor : graph.get(node)) {
                if (!visited[neighbor]) {
                    visited[neighbor] = true;
                    queue.offer(neighbor);
                }
            }
        }
        level++;
    }
}
```

### 2.2 DFS (深度优先搜索)

```java
// DFS 模板 — 递归版
void dfs(int node, boolean[] visited, List<List<Integer>> graph) {
    visited[node] = true;
    // 处理当前节点
    for (int neighbor : graph.get(node)) {
        if (!visited[neighbor]) {
            dfs(neighbor, visited, graph);
        }
    }
}

// DFS 模板 — 迭代版(显式栈)
void dfsIterative(int start, List<List<Integer>> graph) {
    boolean[] visited = new boolean[n];
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(start);
    while (!stack.isEmpty()) {
        int node = stack.pop();
        if (visited[node]) continue;
        visited[node] = true;
        // 处理当前节点
        for (int neighbor : graph.get(node)) {
            if (!visited[neighbor]) stack.push(neighbor);
        }
    }
}
```

### 2.3 BFS vs DFS 对比

| 对比维度 | BFS | DFS |
|----------|-----|-----|
| 数据结构 | 队列 | 栈/递归 |
| 空间复杂度 | O(宽度) | O(深度) |
| 最短路径 | ✅ 无权图天然最短 | ❌ 不保证最短 |
| 完整性 | ✅ 一定能找到解 | ✅ (有限图) |
| 适用场景 | 最短路径、层级关系 | 连通性、拓扑排序、路径枚举 |
| 面试应用 | 岛屿问题、迷宫最短路 | 全排列、N皇后、判环 |

---

## 三、最短路径算法

### 3.1 Dijkstra (单源最短路径，非负权)

```java
// Dijkstra + 优先队列 — O(E log V)
int[] dijkstra(int start, List<List<int[]>> graph, int n) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[start] = 0;
    // 小顶堆: [距离, 节点]
    PriorityQueue<int[]> pq = new PriorityQueue<>((a,b) -> a[0] - b[0]);
    pq.offer(new int[]{0, start});
    
    while (!pq.isEmpty()) {
        int[] curr = pq.poll();
        int d = curr[0], u = curr[1];
        if (d > dist[u]) continue; // 已找到更短路径，跳过
        for (int[] edge : graph.get(u)) {
            int v = edge[0], w = edge[1];
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.offer(new int[]{dist[v], v});
            }
        }
    }
    return dist;
}
```

### 3.2 最短路径算法对比

| 算法 | 时间复杂度 | 负权边 | 负环检测 | 适用场景 |
|------|-----------|--------|---------|---------|
| Dijkstra | O(E log V) | ❌ | ❌ | 导航、网络路由 |
| Bellman-Ford | O(VE) | ✅ | ✅ | 汇率套利检测 |
| Floyd | O(V³) | ✅ | ✅ | 多源最短路径 |
| SPFA | O(VE) 最坏 | ✅ | ✅ | BF的队列优化 |

---

## 四、拓扑排序

### 4.1 核心概念

```
前提：有向无环图 (DAG)
结果：线性序列，满足所有边 u→v 中 u 排在 v 前面
应用：课程选修顺序、编译依赖、任务调度
```

### 4.2 BFS实现 (Kahn算法)

```java
List<Integer> topologicalSort(int n, List<List<Integer>> graph) {
    int[] inDegree = new int[n];
    for (int u = 0; u < n; u++)
        for (int v : graph.get(u)) inDegree[v]++;
    
    Queue<Integer> queue = new LinkedList<>();
    for (int i = 0; i < n; i++)
        if (inDegree[i] == 0) queue.offer(i);
    
    List<Integer> result = new ArrayList<>();
    while (!queue.isEmpty()) {
        int u = queue.poll();
        result.add(u);
        for (int v : graph.get(u)) {
            if (--inDegree[v] == 0) queue.offer(v);
        }
    }
    // result.size() < n → 有环!
    return result.size() == n ? result : new ArrayList<>();
}
```

---

## 五、最小生成树

### 5.1 Kruskal (边贪心 + 并查集)

```java
// 按边权排序，逐条加入不形成环的边
int kruskal(int n, int[][] edges) {
    Arrays.sort(edges, (a,b) -> a[2] - b[2]); // 按权重排序
    UnionFind uf = new UnionFind(n);
    int cost = 0, count = 0;
    for (int[] edge : edges) {
        int u = edge[0], v = edge[1], w = edge[2];
        if (uf.find(u) != uf.find(v)) {
            uf.union(u, v);
            cost += w;
            if (++count == n - 1) break; // n-1条边
        }
    }
    return cost;
}
```

### 5.2 Prim vs Kruskal

| 对比维度 | Prim | Kruskal |
|----------|------|---------|
| 策略 | 顶点贪心(从已选集合扩展) | 边贪心(选全局最短边) |
| 时间复杂度 | O(E log V) | O(E log E) |
| 数据结构 | 优先队列 | 并查集 |
| 适用场景 | 稠密图 | 稀疏图 |

---

## 六、并查集 (Union-Find)

```java
class UnionFind {
    int[] parent, rank;
    
    UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    
    int find(int x) {
        if (parent[x] != x)
            parent[x] = find(parent[x]); // 路径压缩
        return parent[x];
    }
    
    void union(int x, int y) {
        int rx = find(x), ry = find(y);
        if (rx == ry) return;
        if (rank[rx] < rank[ry]) { int t = rx; rx = ry; ry = t; }
        parent[ry] = rx; // 按秩合并
        if (rank[rx] == rank[ry]) rank[rx]++;
    }
    
    boolean connected(int x, int y) { return find(x) == find(y); }
}

// 应用：连通分量计数、判环(Kruskal)、朋友圈/账号关联
```

---

## 七、面试真题与话术

### Q1: BFS和DFS的区别？各适合什么场景？

> **答**：BFS用队列按层扩散，空间O(宽度)，适合最短路径(无权图)和层级问题(二叉树层序、社交推荐K跳)。DFS用栈/递归深入探索，空间O(深度)，适合连通性判断、拓扑排序、路径枚举(全排列/N皇后)。无权图最短路径必须用BFS，DFS不保证最短。

### Q2: Dijkstra的原理？为什么不能处理负权边？

> **答**：Dijkstra用贪心策略：每次取出距离最小的未访问节点，确认其最短路径，然后松弛其邻居。不能处理负权边是因为贪心假设"已确认的节点不会再被更新"，但负权边可能让已确认节点的距离变更短，破坏贪心正确性。负权图用Bellman-Ford(松弛V-1轮)。

### Q3: 什么是拓扑排序？如何判断图有环？

> **答**：拓扑排序是DAG(有向无环图)的线性排列，保证所有边u→v中u在v前面。Kahn算法(BFS)：不断取出入度为0的节点加入结果，如果最终结果不包含所有节点则有环。应用：课程先修关系、编译依赖顺序、任务调度。

### Q4: 并查集的原理和优化？时间复杂度？

> **答**：并查集用于动态判断元素是否在同一集合。核心操作：find(找根)和union(合并)。两个优化：①路径压缩(find时直接指向根)；②按秩合并(矮树挂高树下)。两者结合后均摊复杂度O(α(n))，α是反阿克曼函数，实际≤5可视为常数。应用：连通分量、Kruskal判环、账号关联。

### Q5: 如何判断无向图是否有环？

> **答**：方法一：并查集，遍历每条边(u,v)，如果find(u)==find(v)说明u,v已连通，再加这条边就形成环。方法二：DFS，如果访问到已在当前路径上的节点(visited且在栈中)则有环。对有向图用DFS的三色标记法更准确(白/灰/黑)。

---

## 八、复杂度速查卡

| 算法 | 时间复杂度 | 空间复杂度 | 适用条件 |
|------|-----------|-----------|---------|
| BFS | O(V+E) | O(V) | 所有图 |
| DFS | O(V+E) | O(V) | 所有图 |
| Dijkstra | O(E log V) | O(V) | 非负权 |
| Bellman-Ford | O(VE) | O(V) | 可负权 |
| Floyd | O(V³) | O(V²) | 多源/负权 |
| Kruskal | O(E log E) | O(V) | MST |
| Prim | O(E log V) | O(V) | MST |
| 拓扑排序 | O(V+E) | O(V) | DAG |
| 并查集 | O(α(n)) | O(V) | 连通性 |
