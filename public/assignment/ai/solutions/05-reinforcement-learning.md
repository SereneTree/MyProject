# HW5: Reinforcement Learning（强化学习）题目解析

## 知识点概述

本次作业覆盖强化学习的核心内容：
- **MDP vs RL 的区别**：已知模型 vs 未知模型
- **Model-based vs Model-free**：是否显式学习环境模型
- **Q-Learning**：离策略的无模型学习算法
- **TD Learning**：时序差分学习
- **关键概念辨析**：直接评估、策略评估、off-policy学习

---

## 第一部分：基础概念辨析

### (a) MDP 与 RL 的核心区别

| 特性 | MDP | RL |
|------|-----|-----|
| 模型 | **已知** (T, R 已给定) | **未知** (需要学习) |
| 目标 | **计算**最优策略 | **学习**最优策略 |
| 方法 | 值迭代/策略迭代 | 试错法（trial and error） |
| 信息来源 | 转移概率和奖励函数 | 与环境交互获得的样本 |

**关键区别**：
- MDP：一切信息已知 → 纯计算问题
- RL：信息未知 → 需要通过探索（exploration）来学习

### (b) Model-Based vs Model-Free

| 方法 | Model-Based | Model-Free |
|------|------------|-----------|
| 思路 | 先学模型(T̂, R̂)，再用模型计算策略 | 直接学习策略/Q值，不建模型 |
| 代表算法 | 被动RL → 估计T和R → 值迭代 | Q-Learning, TD Learning |
| 优点 | 样本效率高 | 实现简单，不需要存储模型 |
| 缺点 | 模型可能不准确 | 需要更多样本 |

> **Model-Based**：从经验中估计 T̂(s,a,s') 和 R̂(s,a,s')，然后假装模型正确来计算策略。
> **Model-Free**：不学习转移概率或奖励函数，直接从经验中学习Q值或策略。

---

## 第二部分：强化学习实践

### 问题设定

四个状态 {A, B, C, X}，两个动作 {←, →}，记录的交互序列：

| 状态 | 动作 | 下一状态 | 奖励 | Q-learning迭代编号 |
|------|------|---------|------|-------------------|
| A | → | B | 0 | 1, 10, 19, ... |
| B | → | C | 0 | 2, 11, 20, ... |
| C | ← | B | 0 | 3, 12, 21, ... |
| B | ← | A | 0 | 4, 13, 22, ... |
| A | → | B | 0 | 5, 14, 23, ... |
| B | → | A | 0 | 6, 15, 24, ... |
| A | → | B | 0 | 7, 16, 25, ... |
| B | → | C | 0 | 8, 17, 26, ... |
| C | → | X | 1 | 9, 18, 27, ... |

### (a) Model-Based 计算

**T̂(B, →, C) = 2/3**

解析：从B执行→的次数：
- B → C: 出现2次（第2、8行）
- B → A: 出现1次（第6行）
- 总计：B执行→共3次，其中转移到C有2次 → 2/3

**R̂(C, →, X) = 1**

解析：从C执行→到X的所有样本中，奖励都是1。

### (b) Q-Learning 传播分析

**Q-Learning 更新公式**：
```
Q(s,a) ← Q(s,a) + α[R + γ max_a' Q(s',a') - Q(s,a)]
```

**Q(A, →) 何时首次非零？** → **第14次迭代**

传播链分析：
1. 迭代9：C→X获得奖励1 → Q(C,→) 变为非零
2. 迭代11（第2轮的B→C）：使用 max Q(C,·) → Q(B,→) 变为非零
3. 但需要等到A→B后使用 max Q(B,·) → 第14次迭代（第2轮的A→B）

**Q(B, ←) 何时首次非零？** → **第22次迭代**

传播链：
1. 先需要 Q(A,·) 中某个值非零
2. Q(A,→) 在第14次变为非零
3. B←到达A → 在第22次迭代（第3轮的B←A）时 max Q(A,·) 非零

> **核心理解**：Q值通过Bellman更新逐步从奖励源（终止状态）向后传播，每个epoch传播一步。

### (c) 判断题解析

#### (i) "Q-Learning 中不学习模型" → **True** ✓

Q-Learning是**model-free**的算法：
- 直接学习 Q(s,a) 值
- 不显式估计 T(s,a,s') 或 R(s,a,s')
- 但隐含地学习了最优策略（通过Q值体现）

#### (ii) "TD Learning 中将所有奖励乘以常数p，仍能保证找到最优策略" → **False** ✗

关键：TD Learning **不是**找最优策略的算法！
- TD Learning 只学习给定策略下各状态的**值函数 V^π**
- 它是**策略评估**方法，不做策略改进
- 缩放奖励不影响相对排序，但TD本身就不找最优策略

#### (iii) "Direct Evaluation 中，每次转移后都重新计算状态值" → **False** ✗

Direct Evaluation的工作方式：
- 收集**完整的episodes**（而非单次转移）
- 对每个状态，取其在所有episodes中观察到的**平均回报**
- 是基于episode的方法，不是基于单次转移

#### (iv) "Q-Learning 要求所有样本来自最优策略才能找到最优Q值" → **False** ✗

**Q-Learning是off-policy的**：
- 即使行为策略（收集数据的策略）不是最优的
- 只要所有状态-动作对被充分访问
- Q值仍然会收敛到最优Q*值
- 这是Q-Learning相比SARSA的关键优势

---

## 核心算法对比

| 算法 | 类型 | On/Off-Policy | 学什么 |
|------|------|--------------|--------|
| Direct Evaluation | Model-Free | On-Policy | V^π |
| TD Learning | Model-Free | On-Policy | V^π |
| Q-Learning | Model-Free | **Off-Policy** | Q* (最优) |
| SARSA | Model-Free | On-Policy | Q^π |
| Model-Based RL | Model-Based | - | T̂, R̂ → π* |

---

## Q-Learning 关键特性

| 特性 | 说明 |
|------|------|
| Off-Policy | 无论行为策略如何，都能学到最优Q值 |
| 探索保证 | 需要充分探索所有(s,a)对 |
| 学习率α | 需要满足收敛条件（如随时间递减） |
| 值传播 | 从奖励源逐步向后传播 |
| 收敛条件 | 无限次访问每个(s,a)对 + 适当的α衰减 |

---

## 总结：RL 学习方法谱系

```
强化学习
├── Model-Based
│   └── 学习 T̂, R̂ → 使用值迭代/策略迭代
└── Model-Free
    ├── 被动RL（策略评估）
    │   ├── Direct Evaluation（完整episode）
    │   └── TD Learning（单步bootstrap）
    └── 主动RL（策略学习）
        ├── Q-Learning（off-policy, 学Q*）
        └── SARSA（on-policy, 学Q^π）
```

| 考点 | 关键理解 |
|------|---------|
| MDP vs RL | 已知模型 vs 未知模型 |
| Model-based vs Free | 是否先学T和R |
| Q-Learning传播 | 每轮向后传播一步，off-policy |
| TD vs Direct Eval | 单步更新 vs 完整episode |
| 探索与利用 | ε-greedy平衡探索与利用 |
