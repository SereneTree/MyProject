# 案例 04：滴滴出行——城市交通的复杂网络建模与优化

## 企业背景

| 维度 | 信息 |
|------|------|
| 企业 | 滴滴出行（DiDi Global） |
| 产品 | 网约车 / 出租车 / 公交 / 自动驾驶 |
| 规模 | 覆盖400+城市，日均订单超3000万，高峰秒级调度数百万司机 |
| 挑战 | 在动态变化的城市路网上实现最优路径规划、供需匹配与拥堵预测 |

---

## 一、业务痛点

### 1.1 为什么需要复杂网络建模？

城市交通系统天然是一个**大规模动态加权有向网络**。传统的静态最短路已无法满足实时出行需求：

| 场景 | 痛点 | 网络视角 |
|------|------|---------|
| 实时路径规划 | 哪条路现在最快？（非最短） | 动态加权图上的最短路径（权重=实时耗时） |
| 拥堵预测 | 未来15分钟哪里会堵？ | 网络传播模型：拥堵在路网上的扩散 |
| 司机调度 | 空车应该往哪开去接单？ | 网络流：供需不平衡区域间的运力流动 |
| 城市规划 | 新建一条路是否能缓解拥堵？ | 网络鲁棒性：增加边对网络性能的影响 |
| ETA预估 | 从A到B需要多久？ | 路径上所有边权重之和 + 路口延迟 |

### 1.2 关键业务数据

```
城市路网节点数(以北京为例):  ~30万个路口
城市路网边数:               ~50万条路段
日均GPS轨迹数据:           ~100亿条定位点
实时更新频率:               路段速度每3分钟更新一次
高峰期并发路径规划请求:     ~百万次/秒
```

---

## 二、网络建模

### 2.1 城市路网的图表示

```
G = (V, E, W(t))

V: 路口/交叉点 (Intersection)
E: 路段 (Road Segment), 有向边
W(t): 时变权重函数
   - w_distance: 路段物理长度(m)
   - w_time(t):  当前时刻通过该路段的预估耗时(s)
   - w_speed(t): 当前时刻路段平均速度(km/h)
```

### 2.2 多层交通网络

```
Layer 1: 道路网络（基础层）
   └── 节点: 路口
   └── 边: 道路段 (有向，双向道路=两条有向边)
   └── 属性: 道路等级(高速/主干/支路)、车道数、限速

Layer 2: 公共交通网络
   └── 节点: 公交/地铁站
   └── 边: 公交线路连接
   └── 属性: 班次频率、在途时间

Layer 3: 行政区域网络（宏观）
   └── 节点: 行政区/商圈/交通小区
   └── 边: 区域间的OD流量
   └── 属性: 时段流量、供需比

Layer 4: 时空网络（时间展开）
   └── 节点: (路口, 时间片) 二元组
   └── 边: 同一路口相邻时间片 + 相邻路口同时间片
   └── 用途: 将动态问题转化为静态图问题
```

### 2.3 动态权重更新

```python
import numpy as np
from datetime import datetime

class DynamicRoadNetwork:
    """动态道路网络：边权随时间变化"""
    
    def __init__(self, static_graph):
        self.G = static_graph  # 静态拓扑（不变）
        self.edge_speeds = {}  # 实时速度缓存
    
    def update_edge_weight(self, edge, gps_data):
        """
        基于实时GPS轨迹数据更新路段通行时间
        """
        u, v = edge
        # 从GPS数据中提取通过该路段的车辆速度
        speeds = [s['speed'] for s in gps_data 
                  if s['road_segment'] == (u, v)]
        
        if speeds:
            avg_speed = np.mean(speeds)
            distance = self.G[u][v]['distance']
            travel_time = distance / max(avg_speed, 1.0)  # 避免除0
            
            self.G[u][v]['travel_time'] = travel_time
            self.G[u][v]['speed'] = avg_speed
            self.G[u][v]['congestion_level'] = self._speed_to_congestion(avg_speed, self.G[u][v]['speed_limit'])
    
    def _speed_to_congestion(self, current_speed, speed_limit):
        """速度→拥堵等级映射"""
        ratio = current_speed / speed_limit
        if ratio > 0.7: return 'smooth'        # 畅通
        elif ratio > 0.4: return 'slow'         # 缓行
        elif ratio > 0.2: return 'congested'    # 拥堵
        else: return 'blocked'                  # 严重拥堵
```

---

## 三、核心算法与分析方法

### 3.1 动态最短路径——实时路径规划

```python
import heapq

def time_dependent_dijkstra(G, source, target, departure_time):
    """
    时间依赖的Dijkstra算法：
    - 权重不是固定值，而是取决于到达该边时的时间
    - 到达时间 = 出发时间 + 前序路径耗时
    """
    # dist[v] = (到达v的最早时间, 前驱节点)
    dist = {source: departure_time}
    prev = {source: None}
    pq = [(departure_time, source)]
    visited = set()
    
    while pq:
        current_time, u = heapq.heappop(pq)
        
        if u in visited:
            continue
        visited.add(u)
        
        if u == target:
            break
        
        for v in G.neighbors(u):
            if v in visited:
                continue
            
            # 关键：边权取决于"到达u时的时间"
            travel_time = get_travel_time(G, u, v, current_time)
            arrival_time = current_time + travel_time
            
            if v not in dist or arrival_time < dist[v]:
                dist[v] = arrival_time
                prev[v] = u
                heapq.heappush(pq, (arrival_time, v))
    
    # 重构路径
    path = reconstruct_path(prev, source, target)
    total_time = dist[target] - departure_time
    return path, total_time

def get_travel_time(G, u, v, current_time):
    """
    获取在current_time时刻通过边(u,v)的耗时
    基于历史模式 + 实时数据融合
    """
    # 实时数据（如果有最近3分钟数据）
    if G[u][v].get('last_update') and (current_time - G[u][v]['last_update'] < 180):
        return G[u][v]['travel_time']
    
    # 历史模式（同一时段的历史平均）
    hour = current_time.hour
    day_type = 'weekday' if current_time.weekday() < 5 else 'weekend'
    return G[u][v]['historical_travel_time'][(day_type, hour)]
```

**工程优化（应对百万级QPS）**：

| 优化技术 | 方法 | 效果 |
|---------|------|------|
| 分层路径规划(CH) | Contraction Hierarchies：预处理生成快捷边 | 查询加速1000x |
| A*启发式 | 用直线距离/地标距离做下界估计 | 搜索空间减少60% |
| 分区路由 | 城市分片，片间预计算→片内精细搜索 | 长距离查询加速 |
| 预计算+缓存 | 热门OD对的路径缓存(LRU) | 90%请求直接命中 |

### 3.2 拥堵传播建模

**核心发现**：拥堵在路网上的传播类似于SIR模型在网络上的扩散。

```python
def congestion_propagation_model(G, initial_congested_edges, beta=0.3, recovery_rate=0.1):
    """
    拥堵传播模型：
    - S(Smooth): 畅通路段
    - I(Congested): 拥堵路段 → 会"感染"相邻路段
    - R(Recovering): 恢复中路段
    
    beta: 拥堵传播率（受下游拥堵影响，上游也变堵的概率）
    recovery_rate: 拥堵自然消散率
    """
    edge_status = {e: 'S' for e in G.edges()}
    for e in initial_congested_edges:
        edge_status[e] = 'I'
    
    history = []
    
    for t in range(max_steps):
        new_status = edge_status.copy()
        
        for (u, v) in G.edges():
            if edge_status[(u, v)] == 'I':
                # 拥堵向上游传播：如果(u,v)堵了，进入u的边也可能变堵
                for predecessor in G.predecessors(u):
                    edge_key = (predecessor, u)
                    if edge_key in edge_status and edge_status[edge_key] == 'S':
                        # 传播概率取决于拥堵程度和道路容量
                        p_spread = beta * G[u][v].get('congestion_severity', 1.0)
                        if random.random() < p_spread:
                            new_status[edge_key] = 'I'
                
                # 自然恢复
                if random.random() < recovery_rate:
                    new_status[(u, v)] = 'R'
        
        edge_status = new_status
        congested_count = sum(1 for s in edge_status.values() if s == 'I')
        history.append(congested_count)
    
    return history
```

**拥堵预测流程**：
```
实时GPS → 识别当前拥堵路段 → 网络传播模型预测15分钟后 → 提前绕行推荐
```

### 3.3 网络流——运力调度优化

```python
def supply_demand_optimization(G_region, supply, demand):
    """
    将司机调度建模为网络流问题：
    
    节点: 城市网格/商圈
    边: 区域间可达关系(距离/时间)
    供给: 每个区域的空车数量
    需求: 每个区域的等待订单数量
    
    目标: 最小化全局总等待时间 ≈ 最小费用最大流
    """
    # 构建流网络
    flow_network = nx.DiGraph()
    
    # 添加源点和汇点
    flow_network.add_node('source')
    flow_network.add_node('sink')
    
    for region in G_region.nodes():
        # 供给侧：源 → 供给区域
        if supply[region] > 0:
            flow_network.add_edge('source', f'supply_{region}', 
                                  capacity=supply[region], weight=0)
        
        # 需求侧：需求区域 → 汇
        if demand[region] > 0:
            flow_network.add_edge(f'demand_{region}', 'sink',
                                  capacity=demand[region], weight=0)
        
        # 区域间调度：供给区域 → 需求区域（费用=调度时间）
        for neighbor in G_region.neighbors(region):
            travel_cost = G_region[region][neighbor]['travel_time']
            flow_network.add_edge(f'supply_{region}', f'demand_{neighbor}',
                                  capacity=float('inf'), weight=travel_cost)
    
    # 求解最小费用最大流
    flow_dict = nx.min_cost_flow(flow_network)
    
    return flow_dict  # 返回调度方案：从哪里派多少车到哪里
```

### 3.4 网络鲁棒性分析——脆弱路段识别

```python
def identify_critical_roads(G, metric='betweenness'):
    """
    识别城市路网中的关键瓶颈路段：
    如果这些路段失效(事故/施工)，对全网影响最大
    """
    if metric == 'betweenness':
        # 边介数中心性：经过该边的最短路径占比
        edge_bc = nx.edge_betweenness_centrality(G, weight='travel_time')
        critical_roads = sorted(edge_bc.items(), key=lambda x: x[1], reverse=True)[:20]
    
    elif metric == 'removal_impact':
        # 移除后对全网平均路径长度的影响
        baseline_apl = nx.average_shortest_path_length(G, weight='travel_time')
        impacts = {}
        
        for edge in G.edges():
            G_temp = G.copy()
            G_temp.remove_edge(*edge)
            if nx.is_connected(G_temp.to_undirected()):
                new_apl = nx.average_shortest_path_length(G_temp, weight='travel_time')
                impacts[edge] = (new_apl - baseline_apl) / baseline_apl
            else:
                impacts[edge] = float('inf')  # 移除后断连→极度关键
        
        critical_roads = sorted(impacts.items(), key=lambda x: x[1], reverse=True)[:20]
    
    return critical_roads

def simulate_road_closure(G, closed_road, affected_od_pairs):
    """
    模拟道路封闭对出行的影响
    """
    G_modified = G.copy()
    G_modified.remove_edge(*closed_road)
    
    total_delay = 0
    for origin, destination in affected_od_pairs:
        # 原最短路
        original_time = nx.shortest_path_length(G, origin, destination, weight='travel_time')
        # 绕行路径
        try:
            new_time = nx.shortest_path_length(G_modified, origin, destination, weight='travel_time')
            total_delay += (new_time - original_time)
        except nx.NetworkXNoPath:
            total_delay += float('inf')  # 无替代路径
    
    return total_delay
```

---

## 四、技术亮点

### 亮点 1：Contraction Hierarchies (CH) 实现毫秒级路径查询

| 阶段 | 操作 | 时间复杂度 |
|------|------|-----------|
| 预处理(离线) | 按节点重要性逐层"收缩"图，添加快捷边 | O(n log n) 一次性 |
| 查询(在线) | 双向 Dijkstra 只在"上行"方向搜索 | O(polylog n) ~1-3ms |

```
原始图: 30万节点, 50万边 → Dijkstra: ~200ms
CH预处理后: 增加~100万快捷边 → CH查询: ~2ms (加速100x)
```

### 亮点 2：拥堵传播的相变现象

关键发现：城市路网存在**拥堵渗流临界点**

```
拥堵比例 < 15%: 局部拥堵，不扩散，系统正常运转
拥堵比例 = 15-25%: 临界区域，可能突然爆发全局拥堵(相变)
拥堵比例 > 25%: 全网性拥堵，平均速度骤降，恢复困难

→ 实际应用：监控全网拥堵比例，在接近临界值时提前干预
  (限流、信号灯调整、鼓励绕行)
```

### 亮点 3：多目标路径规划

实际路径规划不只考虑时间，而是多目标优化：

```python
def multi_objective_routing(G, source, target, preferences):
    """
    多目标路径规划：
    - 最快(时间最短)
    - 最短(距离最短)
    - 最省(费用最低：高速费+油费)
    - 最稳(方差最小，不容易遇堵)
    """
    pareto_paths = []
    
    # 目标1: 最快路径
    fastest = dijkstra(G, source, target, weight='travel_time')
    
    # 目标2: 最短路径
    shortest = dijkstra(G, source, target, weight='distance')
    
    # 目标3: 最可靠路径（最小化时间方差）
    most_reliable = dijkstra(G, source, target, weight='travel_time_variance')
    
    # 返回Pareto前沿上的非支配路径集合
    return pareto_front([fastest, shortest, most_reliable])
```

---

## 五、面试与项目参考

### 高频面试题

| 问题 | 参考答案要点 |
|------|-------------|
| 实时路径规划如何实现毫秒级响应？ | Contraction Hierarchies预处理+双向搜索+分层路由 |
| 路网中的"拥堵传播"如何建模？ | 类SIR模型：拥堵段→上游路段传播，考虑道路容量和恢复率 |
| 城市路网的鲁棒性如何分析？ | 边介数中心性→识别瓶颈→模拟移除→评估影响→提出冗余建设建议 |
| 什么是网络流问题？在出行中如何应用？ | 供需调度=最小费用最大流；节点=区域，边=可调度路径，费用=调度时间 |
| 动态图上的最短路和静态图有什么区别？ | 边权随时间变化→到达时间决定后续边权→需要时间依赖的Dijkstra |

### 可复用的设计模式

```
模式1: 分层路径规划(Hierarchical Routing)
适用场景: 任何大规模图上的最短路径查询
实现思路: 预处理阶段收缩+快捷边 → 查询阶段双向搜索 → 定期增量更新

模式2: 网络传播预测+干预
适用场景: 拥堵预测、故障扩散、疫情传播
实现思路: 当前状态检测 → 传播模型推演 → 预测未来状态 → 提前干预

模式3: 网络流优化调度
适用场景: 物流配送、外卖调度、共享单车/充电桩调度
实现思路: 供需抽象为源汇 → 路径抽象为边(容量+费用) → 最小费用最大流求解

模式4: 鲁棒性分析→冗余建设
适用场景: 基础设施规划(道路、电网、通信网)
实现思路: 识别关键边/节点 → 模拟故障 → 评估影响 → 在脆弱处增加冗余
```

---

## 六、与课程知识的映射

| 课程概念 | 滴滴交通网络中的体现 |
|----------|---------------------|
| 有向加权图 | 城市路网（单行道=有向，通行时间=权重） |
| 最短路径(Dijkstra/A*) | 路径规划的核心算法 |
| 网络流(最大流/最小费用流) | 运力调度：从供给区向需求区派车 |
| 边介数中心性 | 识别关键瓶颈路段（交通命脉） |
| 网络鲁棒性 / 渗流理论 | 拥堵渗流临界点→全局拥堵相变 |
| 动态网络 / 时变图 | 路段权重(通行时间)随高峰/平峰变化 |
| 社区结构 | 城市路网的模块化结构(组团式发展) |
| 图的连通性 | 道路封闭后是否仍可达→应急路径规划 |

---

## 七、延伸——与课程大作业（北京地铁网络）的关联

本案例与大作业有很强的呼应关系：

| 大作业内容 | 滴滴业务对应 | 思路拓展 |
|-----------|-------------|---------|
| Task 2: 构建地铁网络 | 构建道路网络(更大规模、有向、加权) | 从L-space拓展到时变加权有向图 |
| Task 3.1: 中心性分析 | 路段介数中心性→瓶颈路段识别 | 加入动态权重的中心性 |
| Task 3.2: 鲁棒性分析 | 道路故障/封闭后网络性能退化 | 从地铁站点→扩展到道路路段 |
| Task 3.3: 配置模型对比 | 真实路网 vs 随机路网的通达效率 | 空间约束如何影响网络性能 |

---

> 💡 **思考题**：北京地铁网络和北京道路网络有什么结构差异？为什么地铁网络的平均度约为2，而道路网络的平均度约为3-4？这对两种网络的鲁棒性有什么不同影响？
