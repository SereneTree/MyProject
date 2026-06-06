# 案例 02：美团即时配送——骑手路径优化与图建模

## 企业背景

| 维度 | 信息 |
|------|------|
| 企业 | 美团（Meituan） |
| 产品 | 美团外卖、美团买菜、美团闪购 |
| 规模 | 日订单量超 6000 万，活跃骑手超 600 万人 |
| 挑战 | 在30分钟内完成取餐-配送，同时为每个骑手规划最优多单路径 |

---

## 一、业务痛点

### 1.1 为什么需要图论？

外卖配送的核心是一个**图上的路径优化问题**：城市道路是图，商家和用户是图上的节点，骑手需要在图上找到最优路线。

| 场景 | 痛点 | 图论视角 |
|------|------|---------|
| 单单配送 | 从商家到用户的最快路线 | 加权有向图上的最短路径 |
| 多单合并 | 一个骑手同时配送3-5单的最优顺序 | 旅行商问题(TSP)变体 |
| 取送顺序 | 先取A再取B还是反过来？ | 带约束的TSP(取必须在送之前) |
| 运力调度 | 区域间骑手如何分配？ | 网络流/二分图匹配 |
| ETA预估 | 预计多久送达？ | 图上路径权重求和 |

### 1.2 业务规模

```
城市道路网节点:     ~百万级路口(单个大城市)
日均配送订单:       ~6000 万单
高峰期并发路径请求:  ~千万次/分钟
单骑手同时携带:     3-8 单
30分钟送达率要求:   > 95%
```

---

## 二、图建模

### 2.1 城市路网图

```
G_road = (V, E, W)

V: 路口(Intersection) / 道路端点
E: 有向路段(单行道=单向边，双向道=两条有向边)
W: 边权重 = f(距离, 实时速度, 红绿灯等待, 道路等级)
```

### 2.2 配送任务图

```
G_task = (V_task, E_task, C)

V_task: 
  - 骑手当前位置 S
  - 取餐点 P1, P2, P3 (Pickup)
  - 送餐点 D1, D2, D3 (Delivery)

E_task: 任意两个任务点之间的最短路径(预计算)
C: 约束条件
  - Pi 必须在 Di 之前访问(先取后送)
  - 时间窗口: 每个 Di 有截止时间
  - 容量约束: 骑手餐箱容量有限
```

### 2.3 分层图模型

```
Layer 1: 底层路网图(百万节点)
  → 用于精确导航

Layer 2: 区域POI图(万级节点)
  → 商家/用户/骑手位置 → 预计算区域间距离矩阵

Layer 3: 任务图(个位数节点)
  → 当前骑手的取送点 → 求解TSP
```

---

## 三、核心算法

### 3.1 最短路径——Dijkstra 及其优化

```python
import heapq

def dijkstra_with_time_weight(G, source, target, departure_time):
    """
    时间依赖的 Dijkstra:
    - 边权(通行时间)随出发时刻变化
    - 高峰期主干道慢，小路可能更快
    """
    dist = {source: 0}
    prev = {source: None}
    pq = [(0, source)]
    visited = set()
    
    while pq:
        d, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        
        if u == target:
            return dist[target], reconstruct_path(prev, source, target)
        
        current_time = departure_time + d
        for v in G.neighbors(u):
            # 关键: 边权取决于到达u的时刻
            w = get_travel_time(G, u, v, current_time)
            new_dist = d + w
            if v not in dist or new_dist < dist[v]:
                dist[v] = new_dist
                prev[v] = u
                heapq.heappush(pq, (new_dist, v))
    
    return float('inf'), []
```

**工程优化**：

| 优化技术 | 方法 | 效果 |
|---------|------|------|
| Contraction Hierarchies (CH) | 预处理快捷边，双向搜索 | 查询 ~1ms (百万节点) |
| A*启发式 | 直线距离做下界 | 搜索空间减少 60% |
| 距离矩阵预计算 | 热门POI对之间预算最短路 | 在线O(1)查表 |
| 分层路由 | 长距离走主干道(高层)，末端走小路(低层) | 减少搜索范围 |

### 3.2 旅行商问题(TSP)——多单路径优化

```python
def solve_delivery_tsp(rider_pos, pickups, deliveries, dist_matrix, constraints):
    """
    带约束的TSP求解:
    - 起点: 骑手当前位置
    - 必须满足: pickup_i 在 delivery_i 之前
    - 目标: 最小化总配送时间(或最大化准时率)
    
    规模: 通常 6-16 个点(3-8单，每单一取一送)
    → 可以用精确算法(动态规划/分支定界)
    """
    n = len(pickups) + len(deliveries)  # 总任务点数
    
    if n <= 12:
        # 小规模: 状态压缩动态规划 O(n² × 2^n)
        return dp_tsp_with_constraints(rider_pos, pickups, deliveries, dist_matrix, constraints)
    else:
        # 大规模: 启发式(最近邻 + 2-opt改进)
        route = nearest_neighbor_heuristic(rider_pos, all_points, dist_matrix, constraints)
        route = two_opt_improvement(route, dist_matrix, constraints)
        return route

def dp_tsp_with_constraints(start, pickups, deliveries, dist_matrix, time_windows):
    """
    状态压缩DP求解带约束TSP
    
    状态: dp[S][i] = 已访问集合为S，最后访问点为i时的最小代价
    转移: dp[S|{j}][j] = min(dp[S][i] + dist[i][j])
          前提: j的前置约束已满足(对应pickup已在S中)
    """
    all_points = [start] + pickups + deliveries
    n = len(all_points)
    INF = float('inf')
    
    # dp[mask][i]: 访问状态为mask，最后在节点i的最小距离
    dp = [[INF] * n for _ in range(1 << n)]
    dp[1][0] = 0  # 起点
    
    for mask in range(1 << n):
        for i in range(n):
            if dp[mask][i] == INF:
                continue
            if not (mask & (1 << i)):
                continue
            
            for j in range(1, n):
                if mask & (1 << j):
                    continue  # 已访问
                
                # 检查约束: delivery_k 需要 pickup_k 已访问
                if not check_precedence(j, mask, pickups, deliveries):
                    continue
                
                # 检查时间窗口
                arrival_time = get_arrival_time(dp[mask][i], i, j, dist_matrix)
                if not check_time_window(j, arrival_time, time_windows):
                    continue
                
                new_mask = mask | (1 << j)
                new_cost = dp[mask][i] + dist_matrix[i][j]
                dp[new_mask][j] = min(dp[new_mask][j], new_cost)
    
    # 找最优完成状态
    full_mask = (1 << n) - 1
    best = min(dp[full_mask][i] for i in range(1, n))
    return best
```

### 3.3 网络流——区域运力调度

```python
def regional_dispatch_optimization(regions, supply, demand, travel_costs):
    """
    区域间运力调度 = 最小费用最大流
    
    节点: 各区域(划分为供给区和需求区)
    边: 区域间可调度路径
    容量: 可调度的最大骑手数
    费用: 调度一个骑手的预计时间
    
    目标: 满足所有区域需求的同时最小化总调度成本
    """
    import networkx as nx
    
    G = nx.DiGraph()
    G.add_node('source')
    G.add_node('sink')
    
    for region in regions:
        if supply[region] > demand[region]:
            # 供给过剩区域 → 从source出发
            surplus = supply[region] - demand[region]
            G.add_edge('source', f'supply_{region}', capacity=surplus, weight=0)
        elif demand[region] > supply[region]:
            # 需求不足区域 → 汇入sink
            deficit = demand[region] - supply[region]
            G.add_edge(f'demand_{region}', 'sink', capacity=deficit, weight=0)
    
    # 区域间调度边
    for r1 in regions:
        for r2 in regions:
            if r1 != r2:
                cost = travel_costs[r1][r2]  # 调度时间
                G.add_edge(f'supply_{r1}', f'demand_{r2}', 
                          capacity=float('inf'), weight=cost)
    
    # 求解最小费用最大流
    flow = nx.min_cost_flow(G)
    return flow
```

### 3.4 ETA预估——图上路径时间累加

```python
def estimate_delivery_time(route, road_graph, current_time):
    """
    ETA = 取餐等待 + 路径通行时间 + 送餐到门时间
    
    路径通行时间 = Σ(路径上每条边的实时通行时间)
    """
    total_time = 0
    time_cursor = current_time
    
    for i in range(len(route) - 1):
        from_node = route[i]
        to_node = route[i + 1]
        
        # 获取两点间实时最短路径时间
        travel_time = shortest_path_time(road_graph, from_node, to_node, time_cursor)
        
        # 累加等待时间(取餐/电梯等)
        wait_time = estimate_wait_time(to_node)
        
        total_time += travel_time + wait_time
        time_cursor += travel_time + wait_time
    
    return total_time
```

---

## 四、技术亮点

### 亮点 1：实时动态权重 + 预计算结合

| 场景 | 方案 | 时效 |
|------|------|------|
| 高频请求的热门路线 | 距离矩阵预计算(每3分钟更新) | O(1)查表 |
| 实时路况变化 | 动态Dijkstra(用最新边权) | ~5ms |
| 长距离路径 | CH预处理+增量更新 | ~1ms |

```
混合策略:
  if (origin, dest) in hot_cache and cache_age < 3min:
      return cached_time
  elif distance(origin, dest) > 5km:
      return CH_query(origin, dest)
  else:
      return dijkstra(origin, dest, current_time)
```

### 亮点 2：TSP求解的工程化分层

```
订单数 ≤ 3 (6个点):  暴力枚举所有排列 O(6!) = 720 → <1ms
订单数 4-6 (8-12点): 状态压缩DP O(n²·2^n) → ~10ms
订单数 > 6 (>12点):  启发式(插入法+2-opt) → ~5ms
                     或: 分组后分别求解再拼接
```

### 亮点 3：从离线优化到实时重规划

```
传统: 分配订单时一次性规划路径 → 过程中不更新
美团: 实时重规划(Re-routing)

触发条件:
- 新订单到达(插入当前路径)
- 商家出餐延迟(调整取餐顺序)
- 路况突变(拥堵/事故→绕行)
- 骑手位置偏离预期路线

重规划策略:
  保留已确认的前k步 → 对剩余任务重新求解TSP → 平滑过渡
```

---

## 五、面试与项目参考

### 高频面试题

| 问题 | 参考答案要点 |
|------|-------------|
| 外卖配送的路径规划本质是什么问题？ | 带约束的TSP + 时间依赖的最短路径；约束包括先取后送、时间窗口、容量 |
| TSP是NP-hard的，工业界怎么解？ | 小规模(≤12点)状压DP精确解；大规模用启发式(最近邻+2-opt/Or-opt改进) |
| Dijkstra在配送场景有什么不足？ | 静态权重→需改为时间依赖权重；单源→需预计算距离矩阵或用CH加速 |
| 如何用网络流做运力调度？ | 区域=节点，调度关系=边，供需差=源/汇容量，调度时间=费用→最小费用最大流 |
| ETA预估不准怎么办？ | 图模型(路径时间和)+ML模型(修正偏差)混合；考虑等餐时间、电梯时间等非路径因素 |

### 可复用的设计模式

```
模式1: 分层路径规划
适用场景: 任何大规模图上频繁的点对最短路查询
实现思路: 底层精确图 + 中层区域距离矩阵 + 缓存热门路径

模式2: 带约束TSP的分阶段求解
适用场景: 物流配送、巡检路线、多任务排序
实现思路: 小规模精确解(DP) + 大规模启发式 + 实时重规划

模式3: 网络流做资源调度
适用场景: 运力分配、带宽调度、工人排班
实现思路: 供需建模为源汇 + 调度关系为带容量费用的边 + 最小费用最大流
```

---

## 六、与课程知识的映射

| 课程概念 | 美团配送中的体现 |
|----------|----------------|
| 加权有向图 | 城市路网(单行道/双向道，权重=通行时间) |
| Dijkstra最短路径 | 单单配送的最快路线计算 |
| 旅行商问题(TSP) | 多单配送的最优访问顺序 |
| 状态压缩动态规划 | 小规模TSP的精确求解(O(n²·2^n)) |
| 网络流(最大流/最小费用流) | 区域间骑手运力调度优化 |
| 欧拉路径 | 理想情况下不重复道路的巡回配送 |
| 图的遍历(BFS) | 查找一定范围内可用骑手 |
| 二分图匹配 | 订单-骑手的最优分配 |

---

> 💡 **思考题**：如果每个骑手的餐箱容量有限（最多放5单），且不同商家出餐时间不同，如何将这些约束加入TSP模型？这时还能用状压DP吗？
