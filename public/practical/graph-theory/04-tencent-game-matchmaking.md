# 案例 04：腾讯游戏匹配——公平对战的二分图匹配

## 企业背景

| 维度 | 信息 |
|------|------|
| 企业 | 腾讯（Tencent） |
| 产品 | 王者荣耀 / 和平精英 / LOL 等竞技游戏 |
| 规模 | 王者荣耀日活超1亿，高峰期每秒数十万匹配请求 |
| 挑战 | 在秒级延迟内完成公平、快速、高质量的玩家匹配 |

---

## 一、业务痛点

### 1.1 为什么需要图匹配？

竞技游戏的核心体验取决于**匹配质量**——实力差距过大会让弱者沮丧、强者无聊。匹配本质是一个**图上的最优分配问题**。

| 场景 | 痛点 | 图论视角 |
|------|------|---------|
| 5v5 匹配 | 10个人如何分成实力均衡的两队？ | 二分图最大权匹配(最小化实力差) |
| 段位保护 | 同段位玩家优先匹配 | 带约束的匹配(边仅在相近段位间存在) |
| 位置预选 | 每人有擅长位置，队伍需覆盖所有位置 | 二分图完美匹配(玩家→位置) |
| 组队匹配 | 2+3人组队 vs 对应配置的对手 | 超图匹配 / 分组约束匹配 |
| 服务器分配 | 玩家就近分配到低延迟服务器 | 二分图匹配(玩家→服务器) |

### 1.2 业务规模

```
同时在线玩家:      ~1 亿(王者荣耀高峰)
每秒匹配请求:      ~50 万
匹配池规模:        ~数万-数十万玩家同时等待
匹配延迟要求:      < 30 秒(理想 < 10 秒)
匹配公平度指标:    两队预测胜率差 < 5%
```

---

## 二、图建模

### 2.1 玩家兼容性图

```
G_compat = (V, E, W)

V(节点): 当前匹配池中等待的玩家
E(边):   两个玩家"可以匹配在一起"(满足基本条件)
W(权重): 匹配质量分(越高表示越适合组队/对抗)

边存在的条件:
  - 段位差 ≤ 2
  - 延迟差 ≤ 50ms(同区域)
  - 不在对方黑名单中
  - 等待时间在容忍范围内

权重计算:
  w(u,v) = α·MMR相似度 + β·位置互补度 + γ·胜率匹配度 + δ·英雄池多样性
```

### 2.2 二分图建模(5v5)

```
匹配一局5v5的本质:

Step 1: 从匹配池中选出10个兼容的玩家
Step 2: 将10人分为两队(5+5)，使两队实力均衡

Step 2 可以建模为二分图匹配:
  左集合: Team A 的5个位置 {上单, 打野, 中单, ADC, 辅助}
  右集合: Team B 的5个位置 {上单, 打野, 中单, ADC, 辅助}
  
  先分配10人到位置(人→位置的二分图匹配)
  再将位置分组为两队(最小化队伍实力差)
```

### 2.3 位置分配的二分图

```
二分图 G = (Players, Positions, E)

左集合 Players: {P1, P2, P3, P4, P5}  (5个玩家)
右集合 Positions: {上单, 打野, 中单, ADC, 辅助}

边 E: 玩家Pi可以打位置Pj (基于历史胜率和偏好)
权重 W: 玩家Pi在位置Pj上的预期表现(胜率/评分)

目标: 找最大权完美匹配 → 每人分到最擅长的位置
```

---

## 三、核心算法

### 3.1 匈牙利算法——完美匹配

```python
def hungarian_matching(players, positions, preference_matrix):
    """
    匈牙利算法 / KM算法:
    在二分图上找最大权完美匹配
    
    应用: 5个玩家分配到5个位置，最大化总体表现
    
    时间复杂度: O(n³) — n=5时极快
    """
    n = len(players)
    
    # KM算法(Kuhn-Munkres)
    # 初始化顶标
    lx = [max(preference_matrix[i]) for i in range(n)]  # 左集合顶标
    ly = [0] * n  # 右集合顶标
    
    match_l = [-1] * n  # 左集合匹配结果
    match_r = [-1] * n  # 右集合匹配结果
    
    for i in range(n):
        # 为左集合节点i寻找增广路
        while True:
            visited_l = [False] * n
            visited_r = [False] * n
            
            if dfs_augment(i, preference_matrix, lx, ly, 
                          visited_l, visited_r, match_l, match_r):
                break
            
            # 调整顶标
            delta = min(lx[x] + ly[y] - preference_matrix[x][y]
                       for x in range(n) if visited_l[x]
                       for y in range(n) if not visited_r[y])
            
            for x in range(n):
                if visited_l[x]: lx[x] -= delta
            for y in range(n):
                if visited_r[y]: ly[y] += delta
    
    # 返回匹配结果
    assignment = {players[i]: positions[match_l[i]] for i in range(n)}
    total_score = sum(preference_matrix[i][match_l[i]] for i in range(n))
    return assignment, total_score
```

### 3.2 图着色——冲突避免

```python
def schedule_without_conflict(players, conflict_graph):
    """
    图着色应用: 确保有冲突的玩家不在同一队
    
    冲突图:
      节点 = 玩家
      边 = 两个玩家有冲突(黑名单/最近频繁对战/网络互斥)
    
    目标: 用2种颜色(Team A / Team B)给10人着色
          使得有冲突边的两端颜色不同
    
    本质: 二着色问题(判断是否是二部图)
    """
    # 检查冲突图是否是二部图(可2-着色)
    color = {}
    
    def bfs_2color(start):
        queue = deque([start])
        color[start] = 0  # Team A
        
        while queue:
            node = queue.popleft()
            for neighbor in conflict_graph.neighbors(node):
                if neighbor not in color:
                    color[neighbor] = 1 - color[node]  # 不同颜色
                    queue.append(neighbor)
                elif color[neighbor] == color[node]:
                    return False  # 无法2-着色(冲突无法满足)
        return True
    
    # 如果不能完美2-着色，用贪心近似(最小化冲突数)
    for player in players:
        if player not in color:
            if not bfs_2color(player):
                return greedy_minimize_conflicts(players, conflict_graph)
    
    team_a = [p for p, c in color.items() if c == 0]
    team_b = [p for p, c in color.items() if c == 1]
    return team_a, team_b
```

### 3.3 最大权匹配——队伍平衡

```python
def balance_teams(players_10, mmr_scores, synergy_matrix):
    """
    将10人分为两队，使得:
    1. 两队总MMR差最小(公平性)
    2. 队内协同度最高(趣味性)
    
    建模为最优化问题:
    minimize |Σ MMR(Team_A) - Σ MMR(Team_B)| 
    maximize Σ synergy(Team_A) + Σ synergy(Team_B)
    """
    n = 10
    best_split = None
    best_score = float('inf')
    
    # C(10,5) = 252 种分法，可以枚举
    from itertools import combinations
    
    for team_a_indices in combinations(range(n), 5):
        team_b_indices = [i for i in range(n) if i not in team_a_indices]
        
        # 公平性: MMR差
        mmr_a = sum(mmr_scores[i] for i in team_a_indices)
        mmr_b = sum(mmr_scores[i] for i in team_b_indices)
        fairness = abs(mmr_a - mmr_b)
        
        # 协同度: 队内玩家之间的配合分
        synergy_a = sum(synergy_matrix[i][j] 
                       for i in team_a_indices for j in team_a_indices if i < j)
        synergy_b = sum(synergy_matrix[i][j] 
                       for i in team_b_indices for j in team_b_indices if i < j)
        
        # 综合评分(越小越好)
        score = fairness - 0.3 * (synergy_a + synergy_b)
        
        if score < best_score:
            best_score = score
            best_split = (list(team_a_indices), list(team_b_indices))
    
    return best_split
```

### 3.4 在线匹配——动态二分图

```python
class OnlineMatchmaker:
    """
    在线匹配引擎:
    玩家不断加入/离开匹配池，需要持续寻找最优匹配
    
    策略: 每隔Δt秒对当前匹配池做一次批量匹配
    """
    
    def __init__(self):
        self.pool = []  # 当前等待中的玩家
        self.match_interval = 3  # 每3秒做一次匹配
    
    def batch_match(self):
        """
        批量匹配: 从当前池中尽可能多地匹配出完整对局
        """
        # 构建兼容性图
        compat_graph = self.build_compatibility_graph(self.pool)
        
        # 贪心匹配: 每次从图中找一组10人(形成完整对局)
        matches = []
        remaining = set(self.pool)
        
        while len(remaining) >= 10:
            # 找一个质量最高的10人组合
            best_group = self.find_best_group(compat_graph, remaining)
            if best_group is None:
                break
            
            matches.append(best_group)
            remaining -= set(best_group)
        
        return matches
    
    def find_best_group(self, graph, candidates):
        """
        从候选人中找10个兼容度最高的玩家
        使用贪心: 从MMR最接近的一对出发，逐步扩展到10人
        """
        # 按MMR排序，选中间段连续10人作为候选
        sorted_candidates = sorted(candidates, key=lambda p: p.mmr)
        
        best_score = float('-inf')
        best_group = None
        
        # 滑动窗口: 每10个连续玩家作为一组候选
        for i in range(len(sorted_candidates) - 9):
            group = sorted_candidates[i:i+10]
            score = self.evaluate_group_quality(group)
            if score > best_score:
                best_score = score
                best_group = group
        
        return best_group if best_score > self.min_quality_threshold else None
    
    def evaluate_group_quality(self, group):
        """评估一组10人的匹配质量"""
        mmr_values = [p.mmr for p in group]
        mmr_range = max(mmr_values) - min(mmr_values)
        
        # 质量 = 1/(MMR差距) + 位置覆盖度 + 延迟兼容度
        quality = (1.0 / max(mmr_range, 1) * 1000 +
                   self.position_coverage(group) * 500 +
                   self.latency_compatibility(group) * 200)
        return quality
```

---

## 四、技术亮点

### 亮点 1：ELO/MMR + 图匹配的结合

```
传统MMR匹配: 单纯按分数排队 → 可能忽略位置/英雄池互补性
图匹配增强:  构建质量加权图 → 考虑多维度最优匹配

质量权重融合:
  w(u,v) = 0.4 × MMR_similarity(u,v)    // 实力接近
          + 0.2 × position_complement(u,v) // 位置互补
          + 0.2 × hero_pool_diversity(u,v) // 英雄池多样
          + 0.1 × latency_similarity(u,v)  // 延迟接近
          + 0.1 × play_style_match(u,v)    // 风格匹配
```

### 亮点 2：分层匹配池 + 松弛策略

```
等待时间 < 10s:  严格匹配(段位差≤1, 位置精确匹配)
等待时间 10-30s: 放宽条件(段位差≤2, 位置允许副选)
等待时间 > 30s:  进一步松弛(段位差≤3, 跨区匹配)

实现: 图的边随时间增加(等待越久，兼容性图越稠密)
     → 匹配成功率随时间递增
     → 平衡等待时间和匹配质量
```

### 亮点 3：实时增量图更新

```
传统: 每次匹配重建整个兼容性图 → O(N²)
优化: 增量更新
  - 新玩家加入: 只计算该玩家与池中其他人的边 → O(N)
  - 玩家离开: 只删除与该玩家相关的边 → O(度数)
  - 匹配完成: 批量删除已匹配玩家的所有边

效果: 从 O(N²) 每轮重建 → O(增量变化量) 持续更新
     在百万级匹配池上节省 99%+ 计算
```

---

## 五、面试与项目参考

### 高频面试题

| 问题 | 参考答案要点 |
|------|-------------|
| 游戏匹配的本质是什么图论问题？ | 带权二分图匹配：玩家→位置/队伍分配，最大化匹配质量 |
| 匈牙利算法和KM算法的区别？ | 匈牙利：最大匹配(无权)O(VE)；KM：最大权完美匹配O(n³) |
| 如何保证匹配公平性？ | 两队MMR总和差最小化 + 枚举C(10,5)=252种分法选最优 |
| 图着色在游戏中怎么用？ | 冲突玩家不能同队→2-着色分队；考试/赛程排期→多着色避冲突 |
| 匹配等待时间长怎么优化？ | 松弛策略(时间越长约束越松)→等价于图中逐步添加边→匹配概率增大 |

### 可复用的设计模式

```
模式1: 加权二分图匹配
适用场景: 资源分配、广告投放(广告→位置)、排班(员工→岗位)
实现思路: 构建二分图+权重 → KM算法求最大权匹配 → 小规模精确/大规模近似

模式2: 在线批量匹配
适用场景: 网约车(乘客→司机)、外卖(订单→骑手)、匹配撮合
实现思路: 维护动态兼容图 → 定时批量匹配 → 增量更新图

模式3: 图着色做冲突避免
适用场景: 考试排期、频率分配、寄存器分配、并行任务无冲突调度
实现思路: 冲突关系→边 → 着色(贪心/回溯) → 最小颜色数=最少资源

模式4: 松弛匹配策略
适用场景: 任何需要平衡"匹配质量"和"等待时间"的场景
实现思路: 约束随时间逐步放宽 → 等价于图中边逐步增多 → 匹配概率单调增
```

---

## 六、与课程知识的映射

| 课程概念 | 腾讯游戏匹配中的体现 |
|----------|---------------------|
| 二分图 | 玩家-位置分配；两队人员划分 |
| 最大匹配(匈牙利算法) | 无权匹配：确保每人都能分到位置 |
| 最大权匹配(KM算法) | 有权匹配：每人分到最擅长的位置(最大化总体表现) |
| 图着色 | 冲突玩家分队(2-着色)；赛程排期(多色着色) |
| 完美匹配 | 恰好5人匹配5个位置，无人空闲无位置空缺 |
| 增广路 | 匈牙利算法的核心操作：通过交替路径改进匹配 |
| NP问题 | 最优分队是NP-hard(但10人规模可枚举) |
| 在线算法 | 玩家动态加入/离开，需要在线决策 |

---

## 七、延伸——二分图匹配的更多工业应用

| 应用场景 | 二分图建模 | 备注 |
|---------|-----------|------|
| 滴滴司乘匹配 | 乘客-司机二分图 | 权重=预计到达时间 |
| 广告竞价 | 广告-广告位二分图 | 权重=eCPM(预期千次收入) |
| 员工排班 | 员工-班次二分图 | 约束=技能/偏好/法规 |
| 论文审稿 | 审稿人-论文二分图 | 权重=专业匹配度 |
| 相亲匹配 | 男-女二分图 | 权重=兴趣/条件匹配度 |
| 肾脏交换 | 患者对-患者对的匹配环 | 寻找交换环(cycle cover) |

---

> 💡 **思考题**：如果5v5匹配中有一个"三人组队"的玩家和一对"双人组队"的玩家，如何修改匹配模型？这时还是标准的二分图匹配吗？
