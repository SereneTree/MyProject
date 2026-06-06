# 复杂网络大作业 —— 北京地铁网络分析 题解与知识点讲解

> 本文档为 Complex Networks Homework 的解题思路、代码参考与知识点详解。  
> 大作业主题：构建、分析并讨论北京地铁系统的网络表示。

---

## 目录

1. [Task 1: 数据描述 (5分)](#task-1-数据描述)
2. [Task 2: 网络构建 (10分)](#task-2-网络构建)
3. [Task 3: 网络分析 (50分)](#task-3-网络分析)
   - [3.1 中心性分析 (10分)](#31-中心性分析)
   - [3.2 鲁棒性分析 (20分)](#32-鲁棒性分析)
   - [3.3 与网络模型比较 (20分)](#33-与网络模型比较)
4. [Task 4: 反思与反馈 (5分)](#task-4-反思与反馈)
5. [核心知识点总结](#核心知识点总结)

---

## Task 1: 数据描述

### 题目要求
描述提供的地铁线路数据（不超过150词），说明数据包含什么内容，以及数据的局限性。

### 解题思路

```python
import pandas as pd

# 读取数据
df = pd.read_excel('metro_lines.xlsx')
print(df.head())
print(df.columns.tolist())
print(df.shape)
print(df.dtypes)
```

### 参考答案

**数据描述：**

The dataset (`metro_lines.xlsx`) contains information about Beijing Metro stations organized by line. Each row represents a station with the following attributes:
- **Line name**: which metro line the station belongs to
- **Station name**: the name of the station (in Chinese/English)
- **Station order**: the sequential position of the station along its line
- **Coordinates**: approximate latitude and longitude of each station

The dataset covers all operational Beijing Metro lines with their constituent stations listed in order.

**数据局限性 (Data Limitations)：**
- No real-time passenger flow data (ridership)
- No travel time between consecutive stations
- No physical distance between stations (需要从坐标计算)
- No information about train frequency or capacity
- Transfer walking time between lines at interchange stations is not captured
- No temporal dimension (peak/off-peak differences)

### 知识点

| 知识点 | 说明 |
|--------|------|
| 数据探索性分析 (EDA) | 了解数据维度、类型、缺失值、分布 |
| 网络数据的表征 | 区分拓扑信息（连接关系）和属性信息（权重、标签等） |
| 数据局限性思维 | 从用户/分析角度思考"还需要什么信息才能做更好的分析" |

---

## Task 2: 网络构建

### 2.1 构建网络

**题目要求**：每个节点代表一个站点，相邻站点（同一线路上连续的两站）之间连边。

```python
import networkx as nx
import pandas as pd
import numpy as np

# 读取数据
df = pd.read_excel('metro_lines.xlsx')

# 创建无向图
G = nx.Graph()

# 按线路分组，创建连续站点之间的边
for line_name, group in df.groupby('line'):
    # 按站序排序
    group_sorted = group.sort_values('station_order')
    stations = group_sorted['station'].tolist()
    
    # 添加节点（含属性）
    for _, row in group_sorted.iterrows():
        if row['station'] not in G:
            G.add_node(row['station'], 
                      lat=row['latitude'], 
                      lon=row['longitude'])
    
    # 连续站点之间添加边
    for i in range(len(stations) - 1):
        s1, s2 = stations[i], stations[i+1]
        # 计算两站间的地理距离作为权重
        lat1, lon1 = G.nodes[s1]['lat'], G.nodes[s1]['lon']
        lat2, lon2 = G.nodes[s2]['lat'], G.nodes[s2]['lon']
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        
        # 如果边已存在(如环线)，不重复添加
        if not G.has_edge(s1, s2):
            G.add_edge(s1, s2, weight=dist, line=line_name)
        else:
            # 多条线路共享同一边，记录所有线路
            existing_lines = G[s1][s2].get('lines', [G[s1][s2]['line']])
            existing_lines.append(line_name)
            G[s1][s2]['lines'] = existing_lines

print(f"Nodes: {G.number_of_nodes()}")
print(f"Edges: {G.number_of_edges()}")
print(f"Connected: {nx.is_connected(G)}")
```

**Haversine 距离计算函数：**

```python
from math import radians, cos, sin, asin, sqrt

def haversine_distance(lat1, lon1, lat2, lon2):
    """计算两个GPS坐标之间的距离(km)"""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # 地球半径(km)
    return c * r
```

### 2.2 可视化网络

```python
import matplotlib.pyplot as plt

# 使用经纬度作为布局
pos = {node: (G.nodes[node]['lon'], G.nodes[node]['lat']) for node in G.nodes()}

plt.figure(figsize=(14, 12))
nx.draw_networkx(G, pos=pos, 
                 node_size=15, 
                 node_color='red',
                 edge_color='gray',
                 with_labels=False,
                 width=0.5,
                 alpha=0.8)
plt.title('Beijing Metro Network (Geographic Layout)')
plt.xlabel('Longitude')
plt.ylabel('Latitude')
plt.axis('equal')
plt.tight_layout()
plt.show()
```

**分析要点：**
- 网络是否反映了北京的"环形+放射状"城市布局？
- 二环/三环内站点密度高，外围放射状线路间距大
- 对比百度地图：网络拓扑与实际道路结构基本一致
- 识别服务不足的区域（如某些方向缺少直达线路）

### 2.3 设计选择说明

**参考答案（150词以内）：**

> I constructed an **undirected, unweighted** network for basic topology analysis, with optional distance-weighted edges for centrality computations. The network is undirected because metro trains run in both directions. Each node represents a unique station (transfer stations are a single node regardless of how many lines pass through). Edge weights represent the Haversine geographic distance between consecutive stations, which approximates travel time. I chose not to create separate nodes for each platform at transfer stations because from a connectivity perspective, passengers can transfer freely. Node attributes include geographic coordinates (for visualization) and line membership. This design captures the essential L-space representation of the metro system, where connections reflect direct physical links rather than reachability (which would be the P-space representation).

### 知识点

| 知识点 | 说明 |
|--------|------|
| L-space vs P-space | L-space: 相邻站点连边；P-space: 同一线路所有站点两两连边 |
| 有向vs无向 | 地铁双向运行→无向图；单行线→有向图 |
| 权重设计 | 可用地理距离、旅行时间、票价等作为边权 |
| 换乘站处理 | 合并为单节点(连通性分析) vs 多节点+换乘边(考虑换乘代价) |
| Haversine公式 | 球面两点间最短距离，用于GPS坐标计算 |

---

## Task 3: 网络分析

### 3.1 中心性分析

**题目要求**：研究度中心性、接近中心性、介数中心性。讨论何时用"距离"作为权重是合理的。计算度分布并讨论结论。

#### 代码参考

```python
# 度中心性
degree_centrality = nx.degree_centrality(G)

# 接近中心性（无权 vs 带权）
closeness_unweighted = nx.closeness_centrality(G)
closeness_weighted = nx.closeness_centrality(G, distance='weight')

# 介数中心性（无权 vs 带权）
betweenness_unweighted = nx.betweenness_centrality(G)
betweenness_weighted = nx.betweenness_centrality(G, weight='weight')

# Top 10 节点
for name, centrality in [('Degree', degree_centrality), 
                          ('Closeness', closeness_unweighted),
                          ('Betweenness', betweenness_unweighted)]:
    top10 = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:10]
    print(f"\n--- Top 10 {name} Centrality ---")
    for station, value in top10:
        print(f"  {station}: {value:.4f}")
```

**度分布分析：**

```python
# 度分布
degrees = [G.degree(n) for n in G.nodes()]
degree_counts = pd.Series(degrees).value_counts().sort_index()

fig, axes = plt.subplots(1, 2, figsize=(12, 5))

# 线性坐标
axes[0].bar(degree_counts.index, degree_counts.values, color='steelblue')
axes[0].set_xlabel('Degree')
axes[0].set_ylabel('Count')
axes[0].set_title('Degree Distribution')

# 对数-对数坐标（检验是否符合幂律）
axes[1].loglog(degree_counts.index, degree_counts.values, 'bo-')
axes[1].set_xlabel('Degree (log)')
axes[1].set_ylabel('Count (log)')
axes[1].set_title('Degree Distribution (log-log)')

plt.tight_layout()
plt.show()

print(f"Average degree: {np.mean(degrees):.2f}")
print(f"Max degree: {max(degrees)} (Station: {max(degree_centrality, key=degree_centrality.get)})")
```

#### 分析要点

1. **何时用距离作为权重？**
   - Closeness centrality: 用距离权重有意义，因为接近中心性衡量"到达所有其他节点的便捷程度"，距离越短越好
   - Betweenness centrality: 用距离权重时，最短路径按物理距离计算，反映真实旅行路径
   - Degree centrality: 不使用权重（仅看连接数量）

2. **度分布结论：**
   - 大多数站点度为2（线路上的普通站点）
   - 度为3-4的是换乘站
   - 度为1的是线路终点站
   - 不符合幂律分布（非无标度网络），更像指数分布
   - 这是因为地铁网络受空间约束，无法像社交网络那样产生"富者更富"效应

### 知识点

| 知识点 | 公式/说明 |
|--------|-----------|
| 度中心性 | C_D(v) = deg(v) / (N-1)，衡量直接连接数量 |
| 接近中心性 | C_C(v) = (N-1) / Σd(v,u)，衡量到其他节点的平均距离 |
| 介数中心性 | C_B(v) = Σ(σ_st(v)/σ_st)，衡量节点作为"桥梁"的重要性 |
| 度分布 | P(k) = 节点度为k的概率；随机网络→泊松分布；无标度→幂律 |
| 空间网络特性 | 受地理约束的网络通常不是无标度网络 |

---

### 3.2 鲁棒性分析

**题目要求**：研究随机故障和定向攻击下的网络鲁棒性。通过最大连通分量大小和平均路径长度来评估。识别脆弱站点/区域并提出建议。

#### 代码参考

```python
import random
import copy

def analyze_robustness(G, attack_type='random', metric='betweenness', seed=42):
    """
    模拟节点移除过程，记录最大连通分量和平均路径长度变化。
    
    attack_type: 'random' | 'targeted'
    metric: 'degree' | 'betweenness' (用于定向攻击的排序依据)
    """
    random.seed(seed)
    G_copy = G.copy()
    n = G_copy.number_of_nodes()
    
    results = {
        'fraction_removed': [0],
        'largest_cc_fraction': [1.0],
        'avg_path_length': [nx.average_shortest_path_length(G_copy) if nx.is_connected(G_copy) else float('inf')]
    }
    
    if attack_type == 'targeted':
        if metric == 'degree':
            node_order = sorted(G_copy.nodes(), key=lambda x: G_copy.degree(x), reverse=True)
        else:  # betweenness
            bc = nx.betweenness_centrality(G_copy)
            node_order = sorted(bc, key=bc.get, reverse=True)
    else:
        node_order = list(G_copy.nodes())
        random.shuffle(node_order)
    
    for i, node in enumerate(node_order):
        if node in G_copy:
            G_copy.remove_node(node)
        
        if G_copy.number_of_nodes() == 0:
            break
            
        # 每移除5%的节点记录一次
        if (i + 1) % max(1, n // 20) == 0:
            largest_cc = max(nx.connected_components(G_copy), key=len)
            largest_cc_size = len(largest_cc) / n
            
            # 平均路径长度（在最大连通分量上计算）
            subgraph = G_copy.subgraph(largest_cc)
            if subgraph.number_of_nodes() > 1:
                avg_pl = nx.average_shortest_path_length(subgraph)
            else:
                avg_pl = 0
            
            results['fraction_removed'].append((i + 1) / n)
            results['largest_cc_fraction'].append(largest_cc_size)
            results['avg_path_length'].append(avg_pl)
    
    return results

# 执行分析
random_results = analyze_robustness(G, attack_type='random')
targeted_degree = analyze_robustness(G, attack_type='targeted', metric='degree')
targeted_betweenness = analyze_robustness(G, attack_type='targeted', metric='betweenness')
```

**可视化：**

```python
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# 最大连通分量
for results, label, color in [(random_results, 'Random', 'green'),
                               (targeted_degree, 'Targeted (Degree)', 'red'),
                               (targeted_betweenness, 'Targeted (Betweenness)', 'orange')]:
    axes[0].plot(results['fraction_removed'], results['largest_cc_fraction'], 
                 label=label, color=color, marker='o', markersize=3)

axes[0].set_xlabel('Fraction of Nodes Removed')
axes[0].set_ylabel('Largest Connected Component (fraction)')
axes[0].set_title('Network Robustness: Largest CC')
axes[0].legend()
axes[0].grid(True, alpha=0.3)

# 平均路径长度
for results, label, color in [(random_results, 'Random', 'green'),
                               (targeted_degree, 'Targeted (Degree)', 'red'),
                               (targeted_betweenness, 'Targeted (Betweenness)', 'orange')]:
    axes[1].plot(results['fraction_removed'], results['avg_path_length'],
                 label=label, color=color, marker='o', markersize=3)

axes[1].set_xlabel('Fraction of Nodes Removed')
axes[1].set_ylabel('Average Path Length')
axes[1].set_title('Network Robustness: Avg Path Length')
axes[1].legend()
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
```

#### 分析要点

1. **随机故障**：网络对随机故障相对鲁棒（地铁网络度分布均匀，没有极端hub节点）
2. **定向攻击**：按介数中心性攻击效果最显著，少量关键换乘站被移除后网络迅速断裂
3. **脆弱站点**：高介数中心性的大型换乘站（如西直门、国贸等）
4. **建议**：
   - 在关键换乘站增加冗余连接
   - 发展平行线路减少单点依赖
   - 为脆弱区域制定应急方案

### 知识点

| 知识点 | 说明 |
|--------|------|
| 鲁棒性(Robustness) | 网络在节点/边移除后保持功能的能力 |
| 随机故障 vs 定向攻击 | 随机：模拟随机设备故障；定向：模拟蓄意破坏 |
| 渗流理论 | 存在临界阈值：移除比例超过阈值后网络突然崩塌 |
| 无标度网络特性 | 对随机故障鲁棒（hub很少被随机选中），对定向攻击脆弱 |
| 最大连通分量(GCC) | 网络中最大的连通子图，衡量网络整体连通性 |
| 平均路径长度 | 所有节点对之间最短路径的平均值，衡量通达效率 |

---

### 3.3 与网络模型比较

**题目要求**：将真实网络的中心性和鲁棒性与保持相同度序列的配置模型(Configuration Model)进行比较。取10次随机实现的平均值，确保结果可复现。

#### 代码参考

```python
def generate_config_model(G, seed=None):
    """生成保持度序列的配置模型随机图"""
    degree_sequence = [d for n, d in G.degree()]
    # 使用配置模型生成随机图
    G_random = nx.configuration_model(degree_sequence, seed=seed)
    # 移除自环和重边，转为简单图
    G_random = nx.Graph(G_random)
    G_random.remove_edges_from(nx.selfloop_edges(G_random))
    return G_random

# 生成10个随机实现
np.random.seed(42)
n_realizations = 10
config_models = []

for i in range(n_realizations):
    G_config = generate_config_model(G, seed=42+i)
    config_models.append(G_config)

# 比较中心性分布
def compare_centrality(G_real, config_models):
    """比较真实网络与配置模型的中心性分布"""
    # 真实网络
    real_bc = list(nx.betweenness_centrality(G_real).values())
    real_cc = list(nx.closeness_centrality(G_real).values())
    
    # 配置模型（平均）
    config_bc_all = []
    config_cc_all = []
    
    for G_config in config_models:
        if nx.is_connected(G_config):
            config_bc_all.append(list(nx.betweenness_centrality(G_config).values()))
            config_cc_all.append(list(nx.closeness_centrality(G_config).values()))
    
    return real_bc, real_cc, config_bc_all, config_cc_all

# 比较鲁棒性
def compare_robustness(G_real, config_models, attack_type='targeted', metric='betweenness'):
    """比较真实网络与配置模型的鲁棒性"""
    real_results = analyze_robustness(G_real, attack_type=attack_type, metric=metric)
    
    config_results_all = []
    for G_config in config_models:
        results = analyze_robustness(G_config, attack_type=attack_type, metric=metric)
        config_results_all.append(results)
    
    # 计算平均值
    avg_config = {
        'fraction_removed': config_results_all[0]['fraction_removed'],
        'largest_cc_fraction': np.mean([r['largest_cc_fraction'] for r in config_results_all], axis=0),
        'avg_path_length': np.mean([r['avg_path_length'] for r in config_results_all], axis=0)
    }
    
    return real_results, avg_config
```

**可视化比较：**

```python
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# 1. 介数中心性分布比较
axes[0,0].hist(real_bc, bins=30, alpha=0.6, label='Real Network', color='blue')
config_bc_mean = np.mean(config_bc_all, axis=0)
axes[0,0].hist(config_bc_mean, bins=30, alpha=0.6, label='Config Model (avg)', color='orange')
axes[0,0].set_title('Betweenness Centrality Distribution')
axes[0,0].legend()

# 2. 接近中心性分布比较
axes[0,1].hist(real_cc, bins=30, alpha=0.6, label='Real Network', color='blue')
config_cc_mean = np.mean(config_cc_all, axis=0)
axes[0,1].hist(config_cc_mean, bins=30, alpha=0.6, label='Config Model (avg)', color='orange')
axes[0,1].set_title('Closeness Centrality Distribution')
axes[0,1].legend()

# 3. 鲁棒性比较（定向攻击-介数）
real_res, config_res = compare_robustness(G, config_models, 'targeted', 'betweenness')
axes[1,0].plot(real_res['fraction_removed'], real_res['largest_cc_fraction'], 
               'b-o', label='Real Network', markersize=3)
axes[1,0].plot(config_res['fraction_removed'], config_res['largest_cc_fraction'],
               'r--s', label='Config Model (avg)', markersize=3)
axes[1,0].set_title('Robustness: Targeted Attack (Betweenness)')
axes[1,0].legend()

# 4. 鲁棒性比较（随机故障）
real_rand, config_rand = compare_robustness(G, config_models, 'random')
axes[1,1].plot(real_rand['fraction_removed'], real_rand['largest_cc_fraction'],
               'b-o', label='Real Network', markersize=3)
axes[1,1].plot(config_rand['fraction_removed'], config_rand['largest_cc_fraction'],
               'r--s', label='Config Model (avg)', markersize=3)
axes[1,1].set_title('Robustness: Random Failure')
axes[1,1].legend()

plt.tight_layout()
plt.show()
```

#### 分析要点

1. **中心性差异**：
   - 真实网络的介数中心性更集中于少数节点（换乘站）→ 空间约束导致特定节点成为必经之路
   - 配置模型介数分布更均匀（随机重连打破了空间结构）

2. **鲁棒性差异**：
   - 真实网络对定向攻击**更脆弱** → 因为空间网络的"瓶颈效应"（关键换乘站不可替代）
   - 配置模型因为边被随机重连，路径选择更多，鲁棒性相对更好
   - 随机故障下两者差异较小

3. **原因分析**：
   - 配置模型保持了度序列但打破了空间结构
   - 真实地铁网络受空间约束，形成局部聚集+长距离连接的特征
   - 这种结构使得某些节点成为不可替代的"桥梁"

### 知识点

| 知识点 | 说明 |
|--------|------|
| 配置模型(Configuration Model) | 给定度序列，随机匹配节点的半边(stubs)生成随机图 |
| 零模型(Null Model) | 保持某些统计特性不变的随机参照网络 |
| 空间网络 vs 随机网络 | 空间约束导致真实网络具有独特的结构特征 |
| 可复现性(Reproducibility) | 设置随机种子确保结果可重复 |
| 平均集成(Ensemble Average) | 多次随机实现取平均，减少随机波动 |

---

## Task 4: 反思与反馈

### 参考答案

> **What I learned:**
> 
> Through this assignment, I gained practical experience in applying network science to real-world infrastructure systems. Key learnings include:
> 1. The importance of design choices (L-space vs P-space, weighted vs unweighted) and how they affect analysis outcomes.
> 2. How spatial constraints fundamentally shape network properties — metro networks differ significantly from social or biological networks.
> 3. The practical implications of centrality measures: identifying critical stations has real policy relevance for urban planning and emergency preparedness.
> 4. The value of null models (configuration model) in distinguishing structural features from degree-sequence effects.
>
> **Feedback requested:**
> I would appreciate more detailed feedback on my robustness analysis methodology, particularly whether my approach to recalculating centrality after each node removal (adaptive attack) versus using initial centrality ranking (static attack) is more appropriate for this context.

---

## 核心知识点总结

### 一、图论基础

| 概念 | 定义 | 本作业中的对应 |
|------|------|--------------|
| 节点(Node) | 网络中的基本单元 | 地铁站 |
| 边(Edge) | 节点间的连接 | 相邻站点之间的线路连接 |
| 度(Degree) | 节点的连接数 | 站点连接的相邻站点数 |
| 路径(Path) | 节点间的连续边序列 | 从A站到B站的乘车路线 |
| 连通分量 | 任意两点间存在路径的最大子图 | 网络的连通性(能否到达任意站) |

### 二、中心性度量

```
度中心性:     直接连接多 → "交际广泛"
接近中心性:   到其他节点近 → "位置优越"  
介数中心性:   在最短路径上多 → "交通枢纽"
特征向量中心性: 连接重要节点 → "圈子高端"
```

### 三、网络模型对比

| 模型 | 度分布 | 聚集系数 | 平均路径 | 现实对应 |
|------|--------|---------|---------|---------|
| ER随机图 | 泊松 | 低 | 短(logN) | — |
| 小世界网络 | 近似正态 | 高 | 短 | 社交网络 |
| 无标度网络 | 幂律 | — | 超短 | 互联网/航空网 |
| 空间网络 | 指数/窄分布 | 中等 | 较长 | 交通/电网 |
| **北京地铁** | 窄分布(2为主) | 低 | 中等 | 空间受限网络 |

### 四、鲁棒性分析框架

```
                    ┌───────────────────┐
                    │   节点移除策略     │
                    └───────┬───────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         随机移除       按度移除       按介数移除
         (故障)        (定向攻击)     (定向攻击)
              │             │             │
              ▼             ▼             ▼
         ┌─────────────────────────────────────┐
         │          监测指标                     │
         │  - 最大连通分量大小                   │
         │  - 平均路径长度                       │
         │  - 网络效率                          │
         └─────────────────────────────────────┘
              │
              ▼
         识别临界阈值 → 脆弱性评估 → 改进建议
```

### 五、配置模型方法论

```python
# 配置模型的核心思想：
# 1. 保持每个节点的度不变
# 2. 随机重连所有边
# 3. 对比真实网络的特殊结构

# 步骤：
# Step 1: 提取真实网络的度序列 [2, 3, 2, 4, 2, ...]
# Step 2: 用配置模型生成随机图(相同度序列)
# Step 3: 重复10次，取平均
# Step 4: 比较中心性分布和鲁棒性曲线
# Step 5: 差异 = 非度序列因素的贡献(如空间结构)
```

---

## 常见扣分点与注意事项

| 常见问题 | 如何避免 |
|----------|---------|
| 只有代码没有解释 | 每个计算结果后必须有文字讨论 |
| 图表没有标题/轴标签 | 每张图要有title、xlabel、ylabel、legend |
| 没有讨论权重的影响 | 明确说明使用/不使用权重的理由 |
| 配置模型只用1次 | 必须多次(10次)并取平均 |
| 没有设置随机种子 | 所有随机操作需设置seed保证可复现 |
| 反思部分敷衍 | 要有具体的学习收获，不要只写"I learned a lot" |
| 运行环境问题 | 提交前务必 Restart Kernel and Run All |

---

> 📖 **推荐阅读**：Barabási, A.-L. *Network Science* (Ch. 3: Random Networks, Ch. 4: Scale-Free Property, Ch. 8: Network Robustness) — 免费在线版: http://networksciencebook.com/
