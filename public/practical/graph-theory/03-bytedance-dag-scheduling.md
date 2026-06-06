# 案例 03：字节跳动 DAG 调度——大规模数据流水线编排

## 企业背景

| 维度 | 信息 |
|------|------|
| 企业 | 字节跳动（ByteDance） |
| 产品 | 数据中台 / 推荐引擎 / AB实验平台 / 数据报表 |
| 规模 | 每日运行数百万个数据任务，任务间依赖关系形成超大规模DAG |
| 挑战 | 在资源有限条件下，按正确顺序高效执行有复杂依赖关系的海量任务 |

---

## 一、业务痛点

### 1.1 为什么需要DAG与拓扑排序？

字节跳动的数据平台每天要运行数百万个ETL(数据抽取-转换-加载)任务。这些任务之间存在**依赖关系**——任务B需要任务A的输出数据，任务C需要B和D都完成后才能开始。

| 场景 | 痛点 | 图论视角 |
|------|------|---------|
| 任务执行顺序 | 数百万任务如何确定正确的执行顺序？ | DAG上的拓扑排序 |
| 并行调度 | 哪些任务可以同时执行？ | DAG中无依赖关系的节点可并行 |
| 瓶颈分析 | 整条流水线的最慢环节在哪？ | DAG上的关键路径(Critical Path) |
| 故障传播 | 一个任务失败，哪些下游任务会被阻塞？ | DFS/BFS找所有后继节点 |
| 循环依赖检测 | 配置错误导致任务互相等待(死锁)？ | 有向图中的环检测 |

### 1.2 业务规模

```
每日任务数:        ~数百万个
单个DAG最大节点:   ~数万个任务
最深依赖链:        ~50-100层
日均调度次数:      ~数亿次任务触发
最大并行度:        ~数万任务同时执行
```

---

## 二、图建模

### 2.1 任务依赖DAG

```
G = (V, E)  — 有向无环图(DAG)

V(节点): 数据处理任务
  - 数据源抽取任务(Source)
  - 数据清洗任务(Transform)
  - 数据聚合任务(Aggregate)
  - 报表生成任务(Report)
  - 模型训练任务(ML Train)

E(有向边): 依赖关系
  (A → B): B依赖A的输出，A完成后B才能开始
  
属性:
  节点属性: 预估执行时间、资源需求(CPU/内存/GPU)、优先级
  边属性:   数据传输大小、传输时间
```

### 2.2 示例DAG

```
数据源抽取          数据清洗           聚合           报表
┌────┐         ┌────┐          ┌────┐       ┌────┐
│ S1 │────────→│ T1 │─────────→│ A1 │──────→│ R1 │
└────┘    ╲    └────┘     ╱    └────┘       └────┘
           ╲              ╱
┌────┐      ╲  ┌────┐   ╱     ┌────┐       ┌────┐
│ S2 │───────→│ T2 │──→      │ A2 │──────→│ R2 │
└────┘         └────┘ ╲       └────┘       └────┘
                        ╲      ↑
┌────┐         ┌────┐    ╲    │
│ S3 │────────→│ T3 │─────→──→│
└────┘         └────┘
```

### 2.3 多层DAG架构

```
Level 1: 物理DAG (数百万节点)
  - 最细粒度: 每个SQL/Spark任务为一个节点
  - 完整的依赖关系

Level 2: 逻辑DAG (数万节点)
  - 将相关任务组合为"任务组"
  - 任务组间的依赖关系

Level 3: 业务流DAG (数百节点)
  - 以数据产品/报表为单位
  - 用于业务监控和SLA管理
```

---

## 三、核心算法

### 3.1 拓扑排序——确定执行顺序

```python
from collections import deque

def topological_sort_kahn(dag):
    """
    Kahn算法(BFS拓扑排序):
    - 维护每个节点的入度
    - 入度为0的节点可以立即执行
    - 执行完后将其后继节点入度减1
    - 新产生的入度为0的节点加入就绪队列
    
    时间复杂度: O(V + E)
    空间复杂度: O(V)
    """
    in_degree = {node: 0 for node in dag.nodes()}
    for u, v in dag.edges():
        in_degree[v] += 1
    
    # 入度为0的节点 → 可以立即执行
    ready_queue = deque([n for n in dag.nodes() if in_degree[n] == 0])
    execution_order = []
    
    while ready_queue:
        # 从就绪队列中取出节点执行
        node = ready_queue.popleft()
        execution_order.append(node)
        
        # 执行完毕，更新后继节点入度
        for successor in dag.successors(node):
            in_degree[successor] -= 1
            if in_degree[successor] == 0:
                ready_queue.append(successor)
    
    # 检测是否有环(如果无法处理所有节点，说明有环)
    if len(execution_order) != len(dag.nodes()):
        raise CyclicDependencyError("DAG中存在循环依赖!")
    
    return execution_order
```

**工程扩展——带优先级的拓扑排序**：
```python
import heapq

def priority_topological_sort(dag, priorities):
    """
    带优先级的拓扑排序:
    当多个节点同时入度为0时，优先调度优先级高的
    
    优先级依据:
    - 下游任务数(多→优先，避免阻塞更多任务)
    - 关键路径上的任务(在关键路径上→优先)
    - 业务SLA等级(核心报表→优先)
    """
    in_degree = {node: 0 for node in dag.nodes()}
    for u, v in dag.edges():
        in_degree[v] += 1
    
    # 用优先队列替代普通队列
    ready_heap = [(-priorities[n], n) for n in dag.nodes() if in_degree[n] == 0]
    heapq.heapify(ready_heap)
    
    execution_order = []
    while ready_heap:
        _, node = heapq.heappop(ready_heap)
        execution_order.append(node)
        
        for successor in dag.successors(node):
            in_degree[successor] -= 1
            if in_degree[successor] == 0:
                heapq.heappush(ready_heap, (-priorities[successor], successor))
    
    return execution_order
```

### 3.2 关键路径(Critical Path)——瓶颈分析

```python
def find_critical_path(dag, task_durations):
    """
    关键路径方法(CPM):
    找到DAG中从源到汇的最长路径 = 整体最短完成时间
    关键路径上的任何延迟都会直接导致整体延迟
    
    步骤:
    1. 正向遍历: 计算每个节点的最早开始时间(ES)
    2. 反向遍历: 计算每个节点的最晚开始时间(LS)
    3. 松弛时间 = LS - ES，松弛为0的节点在关键路径上
    """
    topo_order = topological_sort_kahn(dag)
    
    # 正向: 计算最早开始时间
    earliest_start = {node: 0 for node in dag.nodes()}
    for node in topo_order:
        for successor in dag.successors(node):
            new_es = earliest_start[node] + task_durations[node]
            earliest_start[successor] = max(earliest_start[successor], new_es)
    
    # 整体最早完成时间
    total_duration = max(earliest_start[n] + task_durations[n] for n in dag.nodes() 
                         if dag.out_degree(n) == 0)
    
    # 反向: 计算最晚开始时间
    latest_start = {node: total_duration - task_durations[node] for node in dag.nodes()}
    for node in reversed(topo_order):
        for predecessor in dag.predecessors(node):
            new_ls = latest_start[node] - task_durations[predecessor]
            latest_start[predecessor] = min(latest_start[predecessor], new_ls)
    
    # 关键路径: 松弛时间为0的节点
    critical_nodes = [n for n in dag.nodes() 
                      if latest_start[n] == earliest_start[n]]
    
    # 从关键节点中提取路径
    critical_path = extract_path(dag, critical_nodes)
    
    return critical_path, total_duration

def get_slack(node, earliest_start, latest_start):
    """松弛时间(Float): 任务可以延迟多久不影响整体"""
    return latest_start[node] - earliest_start[node]
```

### 3.3 环检测——循环依赖防御

```python
def detect_cycle_dfs(dag):
    """
    DFS环检测:
    使用三色标记法：
    - WHITE: 未访问
    - GRAY:  正在访问(在当前DFS栈中)
    - BLACK: 已完成
    
    如果DFS过程中遇到GRAY节点 → 发现环!
    """
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node: WHITE for node in dag.nodes()}
    cycle_path = []
    
    def dfs(node, path):
        color[node] = GRAY
        path.append(node)
        
        for successor in dag.successors(node):
            if color[successor] == GRAY:
                # 发现环! 提取环路径
                cycle_start = path.index(successor)
                cycle_path.extend(path[cycle_start:])
                return True
            elif color[successor] == WHITE:
                if dfs(successor, path):
                    return True
        
        path.pop()
        color[node] = BLACK
        return False
    
    for node in dag.nodes():
        if color[node] == WHITE:
            if dfs(node, []):
                return True, cycle_path
    
    return False, []
```

### 3.4 故障影响分析——DFS下游传播

```python
def find_impacted_tasks(dag, failed_task):
    """
    当一个任务失败时，找出所有被阻塞的下游任务
    本质: 从失败节点出发的DFS/BFS，找所有可达后继
    """
    impacted = set()
    stack = [failed_task]
    
    while stack:
        node = stack.pop()
        for successor in dag.successors(node):
            if successor not in impacted:
                impacted.add(successor)
                stack.append(successor)
    
    return impacted

def find_retry_scope(dag, failed_task):
    """
    确定重试范围: 
    失败任务本身 + 所有已执行但输出被污染的上游任务
    (如果上游数据可能有问题需要回溯)
    """
    upstream = set()
    stack = [failed_task]
    
    while stack:
        node = stack.pop()
        for predecessor in dag.predecessors(node):
            if predecessor not in upstream:
                upstream.add(predecessor)
                stack.append(predecessor)
    
    return upstream | {failed_task}
```

---

## 四、技术亮点

### 亮点 1：增量拓扑排序(Dynamic Topological Sort)

| 场景 | 传统方法 | 增量方法 |
|------|---------|---------|
| 新增一条依赖边 | 重新计算全部拓扑序 O(V+E) | 只更新受影响的局部节点 O(受影响节点数) |
| 删除一个任务 | 重建DAG | 只移除节点并释放后继约束 |
| 新增一个任务 | 全量重排 | 插入到拓扑序中合适位置 |

```python
def incremental_add_edge(topo_order, dag, new_edge):
    """
    增量添加边(u→v): 只有当u在v之后时才需要调整
    如果u已在v之前，拓扑序仍然有效，无需操作
    """
    u, v = new_edge
    pos_u = topo_order.index(u)
    pos_v = topo_order.index(v)
    
    if pos_u < pos_v:
        return topo_order  # 已满足约束，无需调整
    
    # u在v之后，需要将u及其后继前移
    # 只对 [pos_v, pos_u] 范围内受影响的节点重排
    affected = get_affected_region(dag, u, v, topo_order)
    local_sort = topological_sort_kahn(dag.subgraph(affected))
    # 将局部排序结果嵌入回全局排序
    return merge_local_sort(topo_order, affected, local_sort)
```

### 亮点 2：关键路径驱动的资源分配

```
策略: 关键路径上的任务获得最高资源优先级

关键路径任务: 分配更多计算资源(CPU/内存)→缩短执行时间→缩短整体耗时
非关键路径任务: 有松弛时间(Slack)→可用较少资源执行→节省成本

效果:
  相同总资源下，整体完成时间缩短 20-30%
  或: 相同完成时间下，总资源消耗减少 30-40%
```

### 亮点 3：DAG分片与分布式调度

```
问题: 单个DAG百万节点，单机调度器成为瓶颈

解决: DAG切分 + 分布式协调

Step 1: 识别DAG中的"切点"(articulation vertex)
        → 切点将DAG分为独立子图

Step 2: 每个子DAG分配给一个调度器独立管理
        → 子DAG内部调度无需跨机通信

Step 3: 子DAG之间通过消息队列传递完成信号
        → 上游子DAG完成 → 发消息 → 下游子DAG启动

效果: 调度延迟从秒级降到毫秒级(单机→分布式)
```

---

## 五、面试与项目参考

### 高频面试题

| 问题 | 参考答案要点 |
|------|-------------|
| 拓扑排序的应用场景？ | 任务调度、编译依赖、课程先修关系、项目进度(PERT) |
| 如何检测DAG中是否有环？ | DFS三色标记法(遇到灰色=有环)；或Kahn算法(无法处理完所有节点=有环) |
| 什么是关键路径？如何求？ | 源到汇的最长路径；正向求ES→反向求LS→松弛为0的节点组成关键路径 |
| DAG调度如何处理任务失败？ | DFS找所有下游受影响任务→标记为阻塞→失败任务重试成功后恢复 |
| 拓扑排序有几种实现方式？ | Kahn(BFS入度法)和DFS后序翻转法；Kahn更适合并行调度(天然给出可并行集) |

### 可复用的设计模式

```
模式1: DAG任务调度器
适用场景: ETL流水线、CI/CD流水线、工作流引擎
实现思路: 构建依赖DAG → 拓扑排序 → 入度为0的任务并行执行 → 完成后更新后继入度

模式2: 关键路径优化
适用场景: 项目管理、生产排程、编译优化
实现思路: 建DAG → 求关键路径 → 优先加速关键路径上的任务 → 非关键任务可延迟

模式3: 增量DAG更新
适用场景: 动态依赖变化的场景(新增/删除任务)
实现思路: 维护拓扑序 → 新增边时检查是否违反序 → 只更新受影响区域

模式4: 故障传播分析
适用场景: 微服务依赖链分析、供应链风险评估
实现思路: 从故障点DFS → 找所有可达后继 → 评估影响范围 → 决定重试/跳过策略
```

---

## 六、与课程知识的映射

| 课程概念 | 字节跳动DAG调度中的体现 |
|----------|----------------------|
| 有向无环图(DAG) | 数据任务的依赖关系天然形成DAG |
| 拓扑排序 | 确定任务执行顺序的核心算法 |
| 关键路径(CPM/PERT) | 找到流水线瓶颈、优化整体耗时 |
| DFS与环检测 | 防止循环依赖导致死锁 |
| BFS(层次遍历) | Kahn算法的核心：逐层释放入度为0的任务 |
| 图的连通性 | DAG切分为独立子图→分布式调度 |
| 可达性(Reachability) | 故障影响分析：从失败节点找所有可达后继 |
| 最长路径(DAG上) | 关键路径 = DAG上的最长路径(可用DP求) |

---

> 💡 **思考题**：如果DAG中存在"条件分支"（即根据运行时数据决定执行哪些后续任务），这还算DAG吗？调度策略需要怎样调整？
