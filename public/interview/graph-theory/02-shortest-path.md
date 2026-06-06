# 模块 2：最短路径算法

> 最短路径是图论面试中**出现频率最高**的模块，几乎每一轮技术面试都会涉及。必须对四种经典算法的适用场景、实现细节和工程优化了如指掌。

---

## 一、算法全景对比

| 算法 | 适用场景 | 时间复杂度 | 空间 | 能否处理负权 | 核心思想 |
|------|---------|-----------|------|------------|---------|
| BFS | 无权图单源最短路 | O(V+E) | O(V) | — | 层序扩展 |
| Dijkstra | 非负权单源最短路 | O((V+E)logV) | O(V) | ❌ | 贪心+松弛 |
| Bellman-Ford | 允许负权单源最短路 | O(VE) | O(V) | ✅(可检测负环) | 全边松弛V-1轮 |
| SPFA | Bellman-Ford优化 | 平均O(kE) 最坏O(VE) | O(V) | ✅ | 队列优化松弛 |
| Floyd | 全源最短路 | O(V³) | O(V²) | ✅(可检测负环) | DP: 经过k中转 |
| DAG最短路 | 有向无环图 | O(V+E) | O(V) | ✅ | 拓扑序+DP |

---

## 二、Dijkstra 算法

### 2.1 核心思想

```
贪心策略: 每次选择当前距离最小的未确认节点，确认其最短距离，然后松弛其邻居。

正确性前提: 所有边权非负 → 已确认的节点不会被后续更短路径更新

松弛(Relaxation): 
  if dist[u] + w(u,v) < dist[v]:
      dist[v] = dist[u] + w(u,v)
```

### 2.2 实现(优先队列)

```python
import heapq

def dijkstra(graph, start, n):
    """
    Dijkstra + 优先队列(最小堆)
    时间: O((V+E)logV)
    空间: O(V)
    
    适用: 非负权图，单源最短路
    """
    dist = [float('inf')] * n
    dist[start] = 0
    visited = [False] * n
    pq = [(0, start)]  # (距离, 节点)
    prev = [-1] * n
    
    while pq:
        d, u = heapq.heappop(pq)
        
        if visited[u]:
            continue  # 已确认，跳过(惰性删除)
        visited[u] = True
        
        for v, w in graph.neighbors(u):
            if not visited[v] and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                heapq.heappush(pq, (dist[v], v))
    
    return dist, prev

def get_path(prev, start, end):
    """从prev数组还原路径"""
    path = []
    node = end
    while node != -1:
        path.append(node)
        node = prev[node]
    return path[::-1] if path[-1] == start else []
```

### 2.3 为什么不能处理负权？

```
反例:
  A --1--> B --(-3)--> C
  A --2--> C

Dijkstra过程:
  确认A(dist=0) → 松弛B(dist=1), C(dist=2)
  确认B(dist=1) → 松弛C(dist=1+(-3)=-2)
  但C已经被确认为dist=2 ❌ (实际最短是-2)

根本原因: 贪心策略假设"已确认的节点不会被更新"，负权边打破了这个假设。
```

### 2.4 面试话术

```
"Dijkstra的核心是贪心策略：每次选距离最小的未确认节点扩展，保证已确认的不再更新。
 用优先队列优化后时间复杂度O((V+E)logV)。
 它不能处理负权边——因为贪心假设'后确认的距离不会更短'在负权下不成立。
 
 工程上的常见优化：
 - 只需要s到t的路径时，可以提前终止(弹出t时)
 - A*算法用启发式函数加速(如地图导航用直线距离做下界)
 - 大规模图用Contraction Hierarchies预处理到~1ms查询"
```

---

## 三、Bellman-Ford 算法

### 3.1 核心思想

```
思路: 对所有边重复松弛V-1轮。
      第k轮结束后，保证经过≤k条边的最短路径被正确计算。
      V-1轮后，所有最短路径(最多V-1条边)都正确。

负环检测: 第V轮如果还能松弛 → 存在负权环(可以无限缩短)
```

### 3.2 实现

```python
def bellman_ford(edges, start, n):
    """
    Bellman-Ford算法
    时间: O(VE)
    空间: O(V)
    
    适用: 有负权边的单源最短路 + 负环检测
    
    edges: [(u, v, w), ...] 边列表
    """
    dist = [float('inf')] * n
    dist[start] = 0
    prev = [-1] * n
    
    # V-1 轮松弛
    for i in range(n - 1):
        updated = False
        for u, v, w in edges:
            if dist[u] != float('inf') and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                updated = True
        
        if not updated:
            break  # 提前终止优化
    
    # 第V轮检测负环
    for u, v, w in edges:
        if dist[u] != float('inf') and dist[u] + w < dist[v]:
            return None, None  # 存在负权环
    
    return dist, prev
```

### 3.3 面试话术

```
"Bellman-Ford的核心是'松弛V-1轮'：
 - 因为最短路径最多经过V-1条边，第k轮保证≤k条边的路径正确
 - 如果第V轮还能松弛，说明存在负环(可以绕环无限减小距离)
 
 和Dijkstra对比:
 - 优势：能处理负权边、能检测负环
 - 劣势：O(VE)比Dijkstra的O((V+E)logV)慢很多
 
 SPFA是它的队列优化版本：只对'距离刚被更新的节点'重新松弛出边，平均O(kE)但最坏仍O(VE)。"
```

---

## 四、Floyd-Warshall 算法

### 4.1 核心思想

```
动态规划:
  dp[k][i][j] = 只经过编号≤k的中间节点时，i到j的最短距离
  
转移方程:
  dp[k][i][j] = min(dp[k-1][i][j], dp[k-1][i][k] + dp[k-1][k][j])

空间优化: 滚动数组 → dp[i][j] = min(dp[i][j], dp[i][k] + dp[k][j])
关键: k必须在最外层循环!
```

### 4.2 实现

```python
def floyd_warshall(graph_matrix, n):
    """
    Floyd全源最短路
    时间: O(V³)
    空间: O(V²)
    
    适用: 稠密图/小规模图的全源最短路
    负环检测: 对角线出现负值 → 有负环
    """
    # 初始化距离矩阵
    dist = [[float('inf')] * n for _ in range(n)]
    for i in range(n):
        dist[i][i] = 0
    for u in range(n):
        for v, w in graph_matrix.neighbors(u):
            dist[u][v] = w
    
    # DP: k在最外层！
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    
    # 负环检测
    for i in range(n):
        if dist[i][i] < 0:
            return None  # 存在负环
    
    return dist
```

### 4.3 面试话术

```
"Floyd本质是DP：逐步引入中间节点k，更新所有点对的最短距离。
 三重循环顺序必须是k-i-j，因为k代表'允许经过的中间节点范围'。
 
 优势: 代码极简(三重循环)、求全源最短路、能处理负权
 劣势: O(V³)，只适合V≤500的小规模图
 
 判断负环: 如果dp[i][i] < 0，说明i可以通过一个负环回到自己。
 
 典型应用: 传递闭包(判断任意两点是否可达)、多源最短路查询。"
```

---

## 五、DAG 上的最短/最长路径

### 5.1 核心思想

```
DAG的特殊性: 无环 → 有拓扑序 → 可按拓扑序做DP

最短路: 按拓扑序松弛，O(V+E)，可处理负权！
最长路: 取负权转最短路；或直接DP取max
```

### 5.2 实现

```python
def dag_shortest_path(graph, start, n):
    """
    DAG最短路: 拓扑排序 + DP
    时间: O(V+E)
    
    关键: 只有DAG可以这么做(无环保证拓扑序存在)
    """
    # Step 1: 拓扑排序
    topo_order = topological_sort_kahn(graph, n)
    
    # Step 2: 按拓扑序松弛
    dist = [float('inf')] * n
    dist[start] = 0
    
    for u in topo_order:
        if dist[u] == float('inf'):
            continue
        for v, w in graph.neighbors(u):
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    
    return dist

def dag_longest_path(graph, n):
    """
    DAG最长路径(关键路径):
    取负权后用最短路，或直接DP取max
    """
    topo_order = topological_sort_kahn(graph, n)
    longest = [0] * n
    
    for u in topo_order:
        for v, w in graph.neighbors(u):
            longest[v] = max(longest[v], longest[u] + w)
    
    return max(longest)
```

---

## 六、SPFA 算法

```python
from collections import deque

def spfa(graph, start, n):
    """
    SPFA: Bellman-Ford的队列优化
    只对'距离刚被更新的节点'重新松弛出边
    
    平均: O(kE), k为常数
    最坏: O(VE) (退化为Bellman-Ford)
    
    负环检测: 某个节点入队次数≥V → 有负环
    """
    dist = [float('inf')] * n
    dist[start] = 0
    in_queue = [False] * n
    count = [0] * n  # 入队次数
    queue = deque([start])
    in_queue[start] = True
    count[start] = 1
    
    while queue:
        u = queue.popleft()
        in_queue[u] = False
        
        for v, w in graph.neighbors(u):
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                if not in_queue[v]:
                    queue.append(v)
                    in_queue[v] = True
                    count[v] += 1
                    if count[v] >= n:
                        return None  # 负环
    
    return dist
```

---

## 七、工程优化与变种

### 7.1 A* 算法

```python
def a_star(graph, start, goal, heuristic):
    """
    A*: Dijkstra + 启发式函数
    f(n) = g(n) + h(n)
      g(n): 起点到n的实际距离
      h(n): n到终点的估计距离(启发式)
    
    要求: h(n) ≤ 实际距离(可接受启发式) → 保证最优解
    应用: 地图导航(h=直线距离)、游戏寻路(h=曼哈顿距离)
    """
    open_set = [(heuristic(start, goal), 0, start)]
    g_score = {start: 0}
    came_from = {}
    
    while open_set:
        f, g, current = heapq.heappop(open_set)
        
        if current == goal:
            return reconstruct_path(came_from, start, goal), g
        
        for neighbor, weight in graph.neighbors(current):
            tentative_g = g + weight
            if tentative_g < g_score.get(neighbor, float('inf')):
                g_score[neighbor] = tentative_g
                came_from[neighbor] = current
                f_score = tentative_g + heuristic(neighbor, goal)
                heapq.heappush(open_set, (f_score, tentative_g, neighbor))
    
    return None, float('inf')
```

### 7.2 多源最短路优化

| 方案 | 适用 | 思路 |
|------|------|------|
| 多次Dijkstra | 源点少(k个) | k次Dijkstra，O(k(V+E)logV) |
| Floyd | V≤500 | 全源O(V³) |
| 虚拟源点 | 多源到单目标 | 添加虚拟源连接所有真实源，一次Dijkstra |

---

## 八、高频面试题精选

| 题目 | 答案要点 |
|------|---------|
| Dijkstra为什么不能处理负权？ | 贪心假设"已确认不会更新"被负权打破；举反例说明 |
| Floyd为什么k必须在最外层？ | k代表DP的"阶段"(允许的中间节点范围)，i/j是"状态"，颠倒会导致用到未计算完的子问题 |
| 如何检测负权环？ | Bellman-Ford第V轮还能松弛；Floyd对角线出现负值；SPFA节点入队≥V次 |
| A*和Dijkstra的关系？ | A*=Dijkstra+启发式；h(n)=0时退化为Dijkstra；h(n)可接受时保证最优 |
| 稀疏图和稠密图分别用什么最短路算法？ | 稀疏图：Dijkstra+堆 O((V+E)logV)；稠密图(E≈V²)：Dijkstra+数组 O(V²) 或 Floyd O(V³) |
| 如何求图中两点间的k短路？ | A*反复搜索(第k次弹出目标=第k短路)；或Yen's算法 |
| DAG上最短路比Dijkstra快在哪？ | DAG拓扑序+DP只需O(V+E)，不需要优先队列；且可处理负权 |

---

> 💡 **记忆口诀**：Dijkstra贪心不负权，Bellman松弛V-1遍，Floyd三循环k在前，DAG拓扑一遍完。
