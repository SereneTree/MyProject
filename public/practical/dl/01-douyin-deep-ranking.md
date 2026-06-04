# 抖音推荐系统的深度排序模型

## 应用场景

抖音日活超 7 亿，每个用户每次刷新 Feed 流时，系统需要在 **< 50ms** 内从百万候选视频中挑出最可能让用户"停留 → 点赞 → 完播"的内容。这是一个典型的**大规模深度排序（Deep Ranking）**问题。

### 业务挑战

- 用户兴趣多样且快速变化（早上看新闻，晚上看搞笑）
- 候选集规模：数百万条视频需在毫秒级完成排序
- 多目标平衡：完播率、点赞率、评论率、分享率需要联合优化，不能只追求单指标
- 冷启动：新视频和新用户缺乏行为数据

## 系统架构

```
用户请求 → 召回层（多路召回，~1000条）→ 粗排（轻量双塔，~200条）→ 精排（深度多任务模型，~50条）→ 重排（多样性/频控）→ 展示
```

本案例聚焦**精排阶段的深度多任务模型**。

## 设计思路

### 1. 多任务学习框架（MMoE / PLE）

字节内部在精排侧采用 **PLE（Progressive Layered Extraction）** 架构：

```
                    ┌── Task A Tower（完播率）
                    │
Input → Expert 网络 ─┼── Task B Tower（点赞率）
   (共享 + 任务私有)  │
                    └── Task C Tower（分享率）
```

**核心思想**：
- 不同任务共享底层特征表达（共享 Expert），同时各任务有自己的私有 Expert
- 通过 Gate 网络动态决定每个任务从共享/私有 Expert 获取多少信息
- 避免了传统 Hard Parameter Sharing 中"任务冲突"导致的跷跷板效应

### 2. 特征交叉层

采用类 DCN-V2（Deep & Cross Network V2）的显式特征交叉：

```python
# 伪代码：Cross Layer
def cross_layer(x0, xl, W):
    # x0: 原始输入, xl: 第 l 层输出
    return x0 * (W @ xl) + xl  # 显式二阶交叉 + 残差
```

**为什么重要**：
- 推荐场景中，`<用户年龄, 视频类别>` 的交叉比单独特征信息量大得多
- 显式交叉 + 隐式 MLP 并行，避免只靠 MLP 隐式学习交叉（需要更多参数和数据）

### 3. 用户行为序列建模

用户最近 50 次交互行为用 **Multi-Head Target Attention** 建模：

```
Query = 候选视频 Embedding
Key/Value = 用户历史行为序列 Embedding

Attention(Q, K, V) → 用户对当前候选的兴趣强度
```

**关键设计**：
- Target Attention：以待排序视频为 Query 去 attend 用户历史，比 Self-Attention 更贴合排序场景
- 多时间窗口：近 1 小时 / 近 1 天 / 近 7 天 分别建模，捕捉不同粒度兴趣

### 4. 样本构建与 Debias

- **位置偏差消除**：训练时加入 position feature，推理时置为默认值
- **曝光偏差**：使用 IPS（Inverse Propensity Score）加权或因果推断方法
- **样本加权**：完播时长 > 5s 的正样本权重更高，避免"误触"噪声

## 技术亮点

| 维度 | 方案 | 效果 |
|------|------|------|
| 模型结构 | PLE 多任务 + DCN-V2 交叉 | 多目标同时提升，消除跷跷板 |
| 序列建模 | Multi-Head Target Attention | 完播率 +2.1%，时效性捕捉更准 |
| 训练策略 | 流式训练 + 小时级模型更新 | 模型时效性 < 2 小时 |
| 推理优化 | INT8 量化 + 算子融合 + 预计算 | P99 延迟 < 15ms（单次精排） |
| 特征体系 | 1000+ 维用户/视频/上下文特征 | 覆盖统计、实时、序列三类特征 |

## 工程落地关键

1. **模型时效性**：采用"小时级全量 + 分钟级增量"混合更新策略
2. **大规模 Embedding 表**：
   - 视频 ID Embedding：数十亿 key，分布式参数服务器存储
   - 频率过滤：低频 ID 共享默认 Embedding，节省 90% 存储
3. **在线 AB 实验**：字节内部 DataTester 平台，支持千级并行实验
4. **模型压缩**：Teacher → Student 蒸馏，精排模型从 1.2B 参数压缩到 300M，延迟降低 40%

## 面试常考点

1. **为什么用 PLE 而不是简单的 Shared-Bottom？**
   → 任务相关性不均匀时，Shared-Bottom 会因梯度冲突导致部分任务退化

2. **Target Attention vs Self-Attention 的区别？**
   → Target Attention 以候选 item 为 Query，更直接建模"用户对当前候选的偏好"

3. **如何解决推荐系统中的 Position Bias？**
   → 训练时引入 position 特征，推理时 mask 掉；或使用 PAL（Position-Aware Learning）

4. **流式训练的挑战是什么？**
   → 数据分布漂移 + 灾难性遗忘 + 样本延迟（展示到转化有时间差）

## 参考资料

- [字节跳动 PLE 论文 (RecSys 2020)](https://dl.acm.org/doi/10.1145/3383313.3412236)
- [DCN-V2 (WWW 2021)](https://arxiv.org/abs/2008.13535)
- [DIN: Deep Interest Network (KDD 2018)](https://arxiv.org/abs/1706.06978)
