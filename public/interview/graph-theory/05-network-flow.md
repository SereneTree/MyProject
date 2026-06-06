# 模块 5：网络流

> 网络流是图论中最具工程应用价值的专题。掌握最大流/最小割/费用流，面试中主要考察**建模能力**——将业务问题转化为网络流模型。

---

## 一、基本概念

### 1.1 流网络定义

```
流网络 G = (V, E, c, s, t)
- V: 节点集合
- E: 有向边集合
- c(u,v): 边(u,v)的容量(≥0)
- s: 源点(source)
- t: 汇点(sink)

可行流 f 满足:
1. 容量约束: 0 ≤ f(u,v) ≤ c(u,v)   (每条边流量不超过容量)
2. 流量守恒: Σf(u,v) = Σf(v,w)       (除s,t外，进=出)

流量值: |f| = 从s流出的净流量 = 流入t的净流量
目标: 最大化 |f|
```

### 1.2 核心概念

| 概念 | 定义 | 面试要点 |
|------|------|---------|
| 残余图(Residual Graph) | 表示还能"增加"或"撤回"多少流量的图 | 前向边(容量-流量)、后向边(当前流量) |
| 增广路(Augmenting Path) | 残余图中从s到t的路径 | 沿增广路推流 = 增大总流量 |
| 割(Cut) | 将V分为S(含s)和T(含t)的划分 | 割的容量 = S→T的边容量和 |
| 最小割(Min-Cut) | 容量最小的割 | 最大流 = 最小割 |
| 瓶颈(Bottleneck) | 增广路上容量最小的边 | 每次增广最多推流=瓶颈 |

---

## 二、最大流最小割定理

### 2.1 定理内容

```
最大流 = 最小割

即: 从s到t的最大可行流量 = 将s和t分开的最小边容量和

证明思路(三个等价):
1. |f| ≤ c(S,T) 对任意流f和任意割(S,T)成立
2. 以下三条等价:
   - f是最大流
   - 残余图中无s到t的增广路
   - 存在割(S,T)使得 |f| = c(S,T)

面试话术:
"最大流最小割定理说的是：网络中从源到汇能推的最大流量，
 恰好等于把源和汇'切断'所需要切的最小边容量。
 直觉上，最小割就是网络的'瓶颈'——限制了最大吞吐量。"
```

### 2.2 最小割的求法

```
求最大流后，在残余图中：
- 从s出发BFS/DFS能到达的节点集合 = S
- 不能到达的节点集合 = T
- S→T的原图中的满流边 = 最小割的边集
```

---

## 三、Ford-Fulkerson 方法

### 3.1 核心思想

```
算法框架:
1. 初始化所有边流量为0
2. 在残余图中找增广路(s→t的路径)
3. 沿增广路推流(推流量=路径上最小残余容量)
4. 重复直到无增广路

关键: 后向边允许"撤回"之前的流量 → 保证能找到最大流
```

### 3.2 Edmonds-Karp (BFS找增广路)

```python
from collections import deque

def edmonds_karp(graph, source, sink, n):
    """
    Edmonds-Karp: BFS找最短增广路的Ford-Fulkerson
    时间: O(VE²)
    
    优势: BFS保证找最短增广路 → 最多VE/2次增广
    """
    # 邻接表存储: graph[u] = [(v, capacity, rev_index), ...]
    # rev_index: 反向边在graph[v]中的索引
    
    def bfs(source, sink, parent):
        """BFS找增广路，返回瓶颈容量"""
        visited = [False] * n
        visited[source] = True
        queue = deque([source])
        
        while queue:
            u = queue.popleft()
            for i, (v, cap, _) in enumerate(graph[u]):
                if not visited[v] and cap > 0:
                    visited[v] = True
                    parent[v] = (u, i)
                    if v == sink:
                        # 计算瓶颈
                        bottleneck = float('inf')
                        node = sink
                        while node != source:
                            prev_node, edge_idx = parent[node]
                            bottleneck = min(bottleneck, graph[prev_node][edge_idx][1])
                            node = prev_node
                        return bottleneck
                    queue.append(v)
        return 0
    
    max_flow = 0
    parent = [None] * n
    
    while True:
        parent = [None] * n
        bottleneck = bfs(source, sink, parent)
        if bottleneck == 0:
            break  # 无增广路
        
        # 沿增广路推流
        node = sink
        while node != source:
            prev_node, edge_idx = parent[node]
            graph[prev_node][edge_idx][1] -= bottleneck  # 前向-
            rev_idx = graph[prev_node][edge_idx][2]
            graph[node][rev_idx][1] += bottleneck  # 后向+
            node = prev_node
        
        max_flow += bottleneck
    
    return max_flow
```

---

## 四、Dinic 算法

### 4.1 核心思想

```
Dinic = 分层图 + 阻塞流

优化思路:
1. BFS构建层次图(按距离分层)
2. 在层次图中DFS找所有增广路(一次DFS找多条)
3. 重复直到层次图中s到t不可达

时间: O(V²E)  (单位容量网络O(E√V))
实际表现: 远快于Edmonds-Karp
```

### 4.2 实现

```python
from collections import deque

class Dinic:
    """
    Dinic算法求最大流
    时间: O(V²E)
    """
    def __init__(self, n):
        self.n = n
        self.graph = [[] for _ in range(n)]
    
    def add_edge(self, u, v, cap):
        """添加边(正向+反向)"""
        self.graph[u].append([v, cap, len(self.graph[v])])
        self.graph[v].append([u, 0, len(self.graph[u]) - 1])
    
    def bfs(self, s, t):
        """BFS建层次图"""
        self.level = [-1] * self.n
        self.level[s] = 0
        queue = deque([s])
        
        while queue:
            u = queue.popleft()
            for v, cap, _ in self.graph[u]:
                if cap > 0 and self.level[v] == -1:
                    self.level[v] = self.level[u] + 1
                    queue.append(v)
        
        return self.level[t] != -1  # t是否可达
    
    def dfs(self, u, t, pushed):
        """DFS找增广路(带当前弧优化)"""
        if u == t:
            return pushed
        
        while self.iter[u] < len(self.graph[u]):
            v, cap, rev = self.graph[u][self.iter[u]]
            
            if cap > 0 and self.level[v] == self.level[u] + 1:
                flow = self.dfs(v, t, min(pushed, cap))
                if flow > 0:
                    self.graph[u][self.iter[u]][1] -= flow
                    self.graph[v][rev][1] += flow
                    return flow
            
            self.iter[u] += 1
        
        return 0
    
    def max_flow(self, s, t):
        """求s到t的最大流"""
        flow = 0
        while self.bfs(s, t):
            self.iter = [0] * self.n  # 当前弧优化
            while True:
                f = self.dfs(s, t, float('inf'))
                if f == 0:
                    break
                flow += f
        return flow
```

---

## 五、最小费用最大流

### 5.1 问题定义

```
在流网络中，每条边除了容量c(u,v)外还有单位费用w(u,v)
目标: 在最大流的前提下，最小化总费用 Σ f(u,v)×w(u,v)

算法: SPFA找最短路(费用为边权)的增广路 → 沿最短增广路推流
     重复直到无增广路

时间: O(V²E) ~ O(VE²) 取决于实现
```

### 5.2 实现

```python
from collections import deque

def min_cost_max_flow(n, graph, source, sink):
    """
    最小费用最大流: SPFA找增广路
    每次沿"费用最短"的增广路推流
    """
    max_flow = 0
    min_cost = 0
    
    while True:
        # SPFA找最短路(按费用)
        dist = [float('inf')] * n
        dist[source] = 0
        in_queue = [False] * n
        prev_edge = [-1] * n
        prev_node = [-1] * n
        
        queue = deque([source])
        in_queue[source] = True
        
        while queue:
            u = queue.popleft()
            in_queue[u] = False
            
            for i, (v, cap, cost, rev) in enumerate(graph[u]):
                if cap > 0 and dist[u] + cost < dist[v]:
                    dist[v] = dist[u] + cost
                    prev_node[v] = u
                    prev_edge[v] = i
                    if not in_queue[v]:
                        queue.append(v)
                        in_queue[v] = True
        
        if dist[sink] == float('inf'):
            break  # 无增广路
        
        # 找瓶颈
        bottleneck = float('inf')
        node = sink
        while node != source:
            u = prev_node[node]
            idx = prev_edge[node]
            bottleneck = min(bottleneck, graph[u][idx][1])
            node = u
        
        # 推流
        node = sink
        while node != source:
            u = prev_node[node]
            idx = prev_edge[node]
            graph[u][idx][1] -= bottleneck
            rev = graph[u][idx][3]
            graph[node][rev][1] += bottleneck
            node = u
        
        max_flow += bottleneck
        min_cost += bottleneck * dist[sink]
    
    return max_flow, min_cost
```

---

## 六、网络流建模（核心考点）

### 6.1 经典建模模式

| 问题 | 建模方法 | 关键 |
|------|---------|------|
| 二分图最大匹配 | 源→左(cap=1)→右(cap=1)→汇 | 最大流=最大匹配 |
| 最小路径覆盖(DAG) | 拆点+二分图匹配 | 路径数=n-最大匹配 |
| 最大独立集(二分图) | 最小割=最小覆盖 | 独立集=n-最小割 |
| 任务分配 | 源→工人(cap=1)→任务(cap=1)→汇 | 带权用费用流 |
| 多源多汇 | 虚拟超级源/汇 | 连接所有源/汇 |
| 节点容量 | 拆点(入点→出点) | 边容量=节点容量 |

### 6.2 典型建模示例

```
示例1: 二分图最大匹配
  源s → 每个左节点(容量1) → 每个右节点(容量1) → 汇t
  最大流 = 最大匹配

示例2: 最小割应用(项目选择)
  n个项目，选/不选。选项目i获利a_i，某些项目对需要同时选否则惩罚c_ij。
  建模: 源=选，汇=不选
  s→i(cap=a_i): 不选i的代价=损失收益a_i
  i→t(cap=0): 选i无代价
  i→j(cap=c_ij): 选i不选j的冲突代价
  最大收益 = Σa_i - 最小割

示例3: 节点有容量
  节点v有容量限制c_v → 拆为v_in和v_out
  原来所有入边→v_in，v_in→v_out(cap=c_v)，v_out→所有出边
```

---

## 七、高频面试题精选

| 题目 | 答案要点 |
|------|---------|
| 最大流最小割定理内容？ | 最大流值=最小割容量；本质是网络的"瓶颈"限制了最大吞吐 |
| Ford-Fulkerson为什么需要反向边？ | 允许"撤回"之前的流量分配→保证能找到全局最优(不被局部决策锁死) |
| Dinic比Edmonds-Karp快在哪？ | Dinic用层次图+DFS一次找多条增广路；EK每次BFS只找一条 |
| 如何用网络流求二分图匹配？ | 源→左集合(cap=1)→右集合(cap=1)→汇；最大流=最大匹配 |
| 什么时候用最小费用流？ | 在满足最大流的前提下追求代价最小：运输问题、任务分配(带偏好) |
| 如何处理节点有容量的情况？ | 拆点：v→(v_in, v_out)，中间连边cap=节点容量 |
| 最小割如何找到具体割边？ | 求最大流后，BFS从s遍历残余图可达的点为S，S→T的满流边为割边 |
| 网络流在实际中的应用？ | 物流调度、通信带宽分配、任务排班、图像分割(前景/背景) |

---

## 八、算法选择指南

```
┌─ 只求最大流?
│  ├─ 稀疏图/规模中等 → Dinic O(V²E)
│  ├─ 单位容量网络 → Dinic O(E√V)
│  └─ 需要简单实现 → Edmonds-Karp O(VE²)
│
├─ 最大流+最小费用?
│  └─ SPFA增广/Primal-Dual
│
├─ 二分图匹配?
│  ├─ 最大匹配 → 匈牙利 O(VE) 或 网络流
│  └─ 最大权匹配 → KM O(n³) 或 费用流
│
└─ 最小割?
   └─ 最大流即为答案(最大流=最小割)
```

---

> 💡 **记忆口诀**：最大流等最小割，增广路上推流量。反向边能撤回流，Dinic分层更快强。费用流选最短路，建模拆点是技巧。
