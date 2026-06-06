# 模块 4：匹配与着色

> 二分图匹配和图着色是图论中理论性最强的部分，面试中侧重**建模能力**——将实际问题抽象为匹配/着色问题。

---

## 一、二分图基础

### 1.1 二分图定义与判定

```
定义: 图G=(V,E)的节点可分为两个互不相交的集合X和Y，
      使得每条边的两个端点分别在X和Y中。
      
等价条件: 图中不包含奇数长度的环(奇环)

判定方法: BFS/DFS染色法(2-着色)
```

```python
from collections import deque

def is_bipartite(graph, n):
    """
    判断图是否是二分图: BFS染色
    如果能用2种颜色给所有节点染色(相邻节点不同色) → 二分图
    时间: O(V+E)
    """
    color = [-1] * n
    
    for start in range(n):
        if color[start] != -1:
            continue
        
        queue = deque([start])
        color[start] = 0
        
        while queue:
            u = queue.popleft()
            for v, _ in graph.neighbors(u):
                if color[v] == -1:
                    color[v] = 1 - color[u]
                    queue.append(v)
                elif color[v] == color[u]:
                    return False  # 相邻同色 → 有奇环 → 非二分图
    
    return True
```

### 1.2 面试话术

```
"二分图判定的本质是2-着色问题：
 如果一个图能用2种颜色染色使相邻节点不同色，那它就是二分图。
 等价地，二分图中不存在奇数长度的环。
 
 判定用BFS染色，O(V+E)。
 
 典型二分图场景：
 - 人员分配(员工 vs 岗位)
 - 匹配撮合(男 vs 女、供 vs 需)
 - 课程排期(时间段 vs 课程)"
```

---

## 二、最大匹配

### 2.1 概念体系

| 概念 | 定义 | 面试要点 |
|------|------|---------|
| 匹配(Matching) | 边的子集，任意两边不共享端点 | 每个节点最多匹配一次 |
| 最大匹配 | 边数最多的匹配 | 匈牙利算法 O(VE) |
| 完美匹配 | 所有节点都被匹配 | 需要 \|X\| = \|Y\| |
| 增广路(Augmenting Path) | 起终点都未匹配的交替路 | 匈牙利核心操作 |
| 最大权匹配 | 总权重最大的匹配 | KM算法 O(V³) |

### 2.2 匈牙利算法

```python
def hungarian(graph, n_left, n_right):
    """
    匈牙利算法: 二分图最大匹配
    
    核心思想: 反复寻找增广路，每找到一条增广路匹配数+1
    增广路: 从未匹配的左节点出发，交替经过非匹配边和匹配边，
            到达未匹配的右节点
    
    时间: O(VE)
    """
    match_right = [-1] * n_right  # 右集合节点的匹配对象
    
    def dfs(u, visited):
        """为左节点u寻找增广路"""
        for v, _ in graph.neighbors(u):
            if v in visited:
                continue
            visited.add(v)
            
            # v未匹配 或 v的匹配对象能找到其他增广路
            if match_right[v] == -1 or dfs(match_right[v], visited):
                match_right[v] = u
                return True
        return False
    
    matching = 0
    for u in range(n_left):
        visited = set()
        if dfs(u, visited):
            matching += 1
    
    return matching
```

### 2.3 KM算法(最大权完美匹配)

```python
def km_algorithm(cost_matrix, n):
    """
    KM(Kuhn-Munkres)算法: 二分图最大权完美匹配
    
    核心思想:
    - 为每个节点赋"顶标"(lx[], ly[])
    - 只在lx[i]+ly[j]=cost[i][j]的边上寻找完美匹配
    - 找不到时调整顶标(放宽条件)
    
    时间: O(n³)
    """
    INF = float('inf')
    lx = [max(cost_matrix[i]) for i in range(n)]  # 左顶标
    ly = [0] * n  # 右顶标
    match_l = [-1] * n
    match_r = [-1] * n
    
    for i in range(n):
        # 为左节点i找匹配
        while True:
            vx = [False] * n
            vy = [False] * n
            if dfs_km(i, cost_matrix, lx, ly, vx, vy, match_l, match_r, n):
                break
            # 调整顶标
            delta = INF
            for x in range(n):
                if vx[x]:
                    for y in range(n):
                        if not vy[y]:
                            delta = min(delta, lx[x] + ly[y] - cost_matrix[x][y])
            for x in range(n):
                if vx[x]: lx[x] -= delta
            for y in range(n):
                if vy[y]: ly[y] += delta
    
    return sum(cost_matrix[match_r[j]][j] for j in range(n) if match_r[j] != -1)
```

---

## 三、König定理与相关定理

### 3.1 核心定理

```
König定理(二分图):
  最大匹配数 = 最小顶点覆盖数

推论:
  最大独立集 = |V| - 最大匹配数(二分图)
  最小边覆盖 = |V| - 最大匹配数(无孤立点)

Hall定理(完美匹配存在条件):
  二分图G=(X∪Y, E)存在X的完美匹配
  ⟺ 对X的任意子集S，|N(S)| ≥ |S|
  (S的邻居数≥S的大小)
```

### 3.2 面试话术

```
"König定理是二分图中'匹配、覆盖、独立集'三者关系的桥梁：

最大匹配 = 最小顶点覆盖
  → 用最少的节点'盖住'所有边 = 最大匹配数

最大独立集 = V - 最大匹配
  → 最多选多少节点使任意两个不相邻

实际应用：
  - 最少机器覆盖所有任务 → 最小覆盖 → 求最大匹配
  - 最多互不冲突的选择 → 最大独立集

注意：以上等式只在二分图中成立！一般图要用其他方法。"
```

---

## 四、图着色

### 4.1 基本概念

| 概念 | 定义 | 面试要点 |
|------|------|---------|
| 顶点着色 | 给节点染色使相邻节点不同色 | 最常见的着色问题 |
| 色数 χ(G) | 所需最少颜色数 | NP-hard(一般图) |
| k-可着色 | 存在用k种颜色的合法着色 | 2-可着色=二分图 |
| 边着色 | 给边染色使邻边不同色 | χ'(G) = Δ(G) 或 Δ(G)+1 (Vizing) |
| 色多项式 | P(G,k) = 用k种颜色的着色方案数 | 理论工具 |

### 4.2 贪心着色

```python
def greedy_coloring(graph, n):
    """
    贪心着色:
    按某种顺序遍历节点，每个节点选最小可用颜色
    
    性质:
    - 一定能用 ≤ Δ(G)+1 种颜色(Δ为最大度)
    - 不一定是最优(最少颜色)
    - 节点顺序影响结果
    """
    colors = [-1] * n
    
    for node in range(n):
        # 收集邻居已用的颜色
        neighbor_colors = set()
        for v, _ in graph.neighbors(node):
            if colors[v] != -1:
                neighbor_colors.add(colors[v])
        
        # 选最小可用颜色
        color = 0
        while color in neighbor_colors:
            color += 1
        colors[node] = color
    
    return colors, max(colors) + 1  # 着色方案和使用颜色数
```

### 4.3 特殊图的色数

| 图 | 色数 | 说明 |
|----|------|------|
| 树 | 2 | 树是二分图 |
| 偶环 C_{2k} | 2 | 二分图 |
| 奇环 C_{2k+1} | 3 | 最小非二分图 |
| 完全图 K_n | n | 每个节点都与其他相邻 |
| 二分图 | 2 | 定义 |
| 平面图 | ≤ 4 | 四色定理 |
| 轮图 W_n | 3或4 | 中心+n环 |

### 4.4 四色定理

```
定理: 任何平面图都是4-可着色的

含义: 给地图着色，只需4种颜色就能保证相邻区域不同色

面试话术:
"四色定理说的是任何平面图最多需要4种颜色。
 这是1976年用计算机辅助证明的——第一个计算机证明的重大数学定理。
 实际应用中，地图着色、频率分配、考试排期等都是图着色问题。
 
 注意区分：
 - 2-着色 = 二分图判定 → O(V+E) 用BFS
 - 3-着色 = NP-complete
 - k-着色(k≥3) = NP-complete
 - 但平面图的4-着色 → 多项式时间可解(O(V²))"
```

---

## 五、独立集与顶点覆盖

### 5.1 概念关系

```
独立集(Independent Set):
  节点子集S，S中任意两节点不相邻
  最大独立集: 大小最大的独立集 → NP-hard(一般图)

顶点覆盖(Vertex Cover):
  节点子集C，每条边至少有一个端点在C中
  最小顶点覆盖: 大小最小的覆盖 → NP-hard(一般图)

关键关系:
  S是独立集 ⟺ V\S是顶点覆盖
  |最大独立集| + |最小顶点覆盖| = |V|
  
二分图特殊性:
  最小顶点覆盖 = 最大匹配(König)
  最大独立集 = |V| - 最大匹配
```

### 5.2 面试话术

```
"独立集和顶点覆盖是互补的：
 - 独立集S中任意两点不相邻 → 选出互不冲突的最大集合
 - 顶点覆盖C覆盖所有边 → 选出最少的点'监控'所有边
 
 它们满足: |最大独立集| + |最小顶点覆盖| = |V|
 
 在二分图中有多项式解法(König定理+匈牙利)
 在一般图中都是NP-hard
 
 应用：
 - 最大独立集 → 最多安排多少互不冲突的事项
 - 最小顶点覆盖 → 最少放几个摄像头覆盖所有道路
 - 2-近似: 取最大匹配的所有端点 → |C| ≤ 2×OPT"
```

---

## 六、欧拉路径与哈密顿路径

### 6.1 欧拉路径/回路

```
欧拉路径: 经过每条边恰好一次的路径
欧拉回路: 经过每条边恰好一次且回到起点

存在条件:
  无向图欧拉回路: 连通 + 所有节点度为偶数
  无向图欧拉路径: 连通 + 恰好2个奇度节点(起终点)
  有向图欧拉回路: 弱连通 + 每个节点入度=出度
  有向图欧拉路径: 弱连通 + 恰好一个节点出度-入度=1(起点)
                                一个节点入度-出度=1(终点)
                                其余入度=出度

算法: Hierholzer算法 O(E)
```

```python
def find_euler_circuit(graph, n):
    """
    Hierholzer算法求欧拉回路
    时间: O(E)
    """
    # 检查是否所有节点度为偶数
    for u in range(n):
        if len(graph.adj[u]) % 2 != 0:
            return None  # 无欧拉回路
    
    # 从任意有边的节点出发
    stack = [0]
    circuit = []
    adj_copy = {u: list(graph.adj[u]) for u in range(n)}
    
    while stack:
        v = stack[-1]
        if adj_copy[v]:
            u = adj_copy[v].pop()
            adj_copy[u].remove(v)  # 删除已用边
            stack.append(u)
        else:
            circuit.append(stack.pop())
    
    return circuit[::-1]
```

### 6.2 哈密顿路径/回路

```
哈密顿路径: 经过每个顶点恰好一次的路径
哈密顿回路: 经过每个顶点恰好一次且回到起点

与欧拉的区别:
  欧拉: 每条边恰一次 → 多项式可解
  哈密顿: 每个顶点恰一次 → NP-complete

TSP(旅行商问题):
  在加权完全图中找最短哈密顿回路 → NP-hard
  近似: 2-近似(MST法)、3/2-近似(Christofides)
```

---

## 七、高频面试题精选

| 题目 | 答案要点 |
|------|---------|
| 如何判断一个图是二分图？ | BFS染色法：相邻节点不同色能否成功；等价于无奇环 |
| 匈牙利算法的核心操作？ | 寻找增广路(交替路径从未匹配左端到未匹配右端)；找到一条则匹配数+1 |
| König定理内容？ | 二分图中：最大匹配 = 最小顶点覆盖 |
| 最大独立集怎么求？ | 二分图: |V|-最大匹配；一般图: NP-hard |
| 图着色有什么应用？ | 考试排期(无冲突)、频率分配、寄存器分配、地图着色 |
| 欧拉回路和哈密顿回路的区别？ | 欧拉=每边一次(P)；哈密顿=每点一次(NP-complete) |
| 如何判断欧拉回路是否存在？ | 无向图：连通+所有节点度为偶数 |
| KM算法求什么？ | 二分图最大权完美匹配；O(n³)；用顶标+增广 |

---

> 💡 **记忆口诀**：匹配增广路上走，König定理覆盖等匹配。着色二分只需二，四色定理平面图。欧拉边一次看度数，哈密顿点一次NP苦。
