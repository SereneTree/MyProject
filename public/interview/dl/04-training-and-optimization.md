# 训练技巧与优化器

## 考点概览

| 考点 | 重要度 | 考法 |
|------|--------|------|
| SGD / Momentum / Adam | ⭐⭐⭐⭐⭐ | 原理对比 + 选型策略 |
| 学习率调度策略 | ⭐⭐⭐⭐ | Warmup、Cosine Decay |
| BatchNorm vs LayerNorm | ⭐⭐⭐⭐⭐ | 原理 + 适用场景 + 面试对比 |
| Dropout | ⭐⭐⭐⭐ | 原理 + 训练/推理差异 |
| 正则化方法 | ⭐⭐⭐⭐ | L1/L2/Dropout/数据增强 |
| 过拟合与欠拟合 | ⭐⭐⭐⭐ | 诊断方法 + 对策 |
| 混合精度训练 | ⭐⭐⭐ | FP16 + Loss Scaling |
| 分布式训练 | ⭐⭐⭐ | 数据并行 / 模型并行 |

---

## 一、优化器

### SGD 系列

```python
# Vanilla SGD
θ = θ - lr × ∇L

# SGD + Momentum（动量）
v_t = β·v_{t-1} + ∇L          # β 通常取 0.9
θ = θ - lr × v_t
# 作用：加速收敛 + 减少震荡（像小球滚下山坡有惯性）

# Nesterov Momentum（前瞻梯度）
v_t = β·v_{t-1} + ∇L(θ - β·v_{t-1})
θ = θ - lr × v_t
# 先按动量方向"走一步"，再算梯度，比普通 Momentum 更智能
```

### Adam（⭐ 最常用）

```python
# 一阶动量（梯度的指数移动平均）
m_t = β1·m_{t-1} + (1-β1)·g_t        # β1=0.9

# 二阶动量（梯度平方的指数移动平均）
v_t = β2·v_{t-1} + (1-β2)·g_t²       # β2=0.999

# 偏差修正（初始阶段 m 和 v 偏向 0）
m̂_t = m_t / (1 - β1^t)
v̂_t = v_t / (1 - β2^t)

# 参数更新
θ = θ - lr × m̂_t / (√v̂_t + ε)
```

**Adam 的直觉**：
- m_t：方向估计（历史梯度加权平均 → 动量效果）
- v_t：步长调节（梯度大的参数用小步长 → 自适应学习率）
- 效果：对稀疏梯度友好、超参数不敏感、收敛快

### AdamW（权重衰减修正）

```python
# Adam 中 L2 正则化的梯度会被 adaptive lr 缩放，削弱正则效果
# AdamW 将权重衰减解耦出来：
θ = θ - lr × (m̂_t / (√v̂_t + ε) + λ·θ)
```

### 优化器选型速查

| 场景 | 推荐 | 理由 |
|------|------|------|
| CV 训练（ImageNet） | SGD + Momentum + CosineAnnealing | 泛化性更好 |
| NLP / Transformer | AdamW + Warmup + Cosine | 收敛快、对 lr 不敏感 |
| 微调预训练模型 | AdamW (小 lr: 1e-5~5e-5) | 避免破坏预训练知识 |
| GAN 训练 | Adam (β1=0, β2=0.9) | 减少动量带来的不稳定 |
| 小数据集 | SGD + 大动量 | 更好泛化，Adam 易过拟合 |

---

## 二、学习率调度

### 常见策略

```
StepLR:      每 N epoch 衰减为 γ 倍
MultiStep:   在指定 epoch 衰减
Exponential: lr = lr_0 × γ^epoch
Cosine:      lr = lr_min + 0.5(lr_max - lr_min)(1 + cos(πt/T))
Warmup:      前 N 步从 0 线性增长到 lr_max
```

### Warmup + Cosine Decay（Transformer 标配）

```
lr
 ↑     /‾‾‾\
 │    /      \
 │   /        \
 │  /          \______
 └──────────────────→ steps
   warmup   decay
```

**为什么需要 Warmup？**
- 训练初期参数随机 → 梯度方向不稳定 → 大 lr 会导致发散
- Warmup 给模型一个"适应期"，先小步探索再大步前进
- 尤其重要：Adam 的二阶动量 v_t 初期估计不准，需要积累

---

## 三、Batch Normalization（⭐ 必考）

### 计算过程

```python
# 对 mini-batch B 中的每个特征维度：
μ_B = (1/m) Σ x_i              # batch 均值
σ²_B = (1/m) Σ (x_i - μ_B)²   # batch 方差
x̂_i = (x_i - μ_B) / √(σ²_B + ε)  # 标准化
y_i = γ · x̂_i + β              # 缩放 + 平移（可学习参数）
```

### 作用

1. **加速收敛**：各层输入分布稳定，可以用更大 lr
2. **缓解梯度消失**：避免激活值进入饱和区
3. **正则化效果**：batch 统计引入噪声，类似 Dropout
4. **降低初始化敏感度**：网络对权重初始化不那么敏感

### 训练 vs 推理

```
训练：使用当前 mini-batch 的 μ_B, σ²_B
推理：使用训练阶段积累的 running_mean, running_var（指数移动平均）

→ 推理时 BN 退化为固定的线性变换，可以和卷积层融合
```

---

## 四、Layer Normalization

### 计算过程

```python
# 对每个样本在所有特征维度上归一化：
μ = (1/d) Σ x_j               # 当前样本所有特征的均值
σ² = (1/d) Σ (x_j - μ)²
x̂_j = (x_j - μ) / √(σ² + ε)
y_j = γ · x̂_j + β
```

### BN vs LN 全面对比

| 维度 | BatchNorm | LayerNorm |
|------|-----------|-----------|
| 归一化方向 | batch 维度（跨样本） | 特征维度（单样本） |
| 依赖 batch size | 是（小 batch 不稳定） | 否 |
| 训练/推理差异 | 有（running mean/var） | 无 |
| 适用场景 | CNN（图像分类） | Transformer / RNN |
| 序列长度变化 | 需要相同长度 | 不受限制 |

### 其他归一化

| 方法 | 归一化维度 | 典型应用 |
|------|-----------|---------|
| InstanceNorm | H×W（单通道单样本） | 风格迁移 |
| GroupNorm | 通道分组 | 小 batch 目标检测 |
| RMSNorm | LayerNorm 去掉中心化 | LLaMA 等 LLM |

---

## 五、Dropout

### 原理

```python
# 训练时：
mask = Bernoulli(p=keep_prob)  # 每个神经元以 1-p 概率被屏蔽
output = input * mask / keep_prob   # Inverted Dropout：除以 keep_prob 保持期望不变

# 推理时：
output = input  # 所有神经元都参与，无需额外缩放
```

### 为什么有效？

1. **模型集成**：等价于训练 2^n 个子网络的集成（每次 mask 不同 = 不同子网络）
2. **打破共适应**：防止神经元过度依赖特定其他神经元
3. **正则化效果**：向权重施加隐式 L2 约束

### Dropout 注意事项

- 通常只加在全连接层（p=0.5）或 Attention 输出（p=0.1）
- 卷积层很少用 Dropout（空间相关性使得效果不佳 → 改用 DropBlock）
- 推理时必须关闭（`model.eval()`）

---

## 六、正则化综合

### 过拟合诊断

```
训练损失低 + 验证损失高 → 过拟合
训练损失高 + 验证损失高 → 欠拟合
```

### 对策速查表

| 方法 | 针对 | 机制 |
|------|------|------|
| L2 正则化 | 过拟合 | 约束权重大小，平滑决策边界 |
| L1 正则化 | 过拟合 + 稀疏 | 产生稀疏权重（特征选择） |
| Dropout | 过拟合 | 随机屏蔽，模型集成 |
| 数据增强 | 过拟合 | 等价于扩大数据集 |
| 早停 (Early Stopping) | 过拟合 | 在验证集最优点停止 |
| 减小模型 | 过拟合 | 降低模型容量 |
| 增大模型 | 欠拟合 | 提高拟合能力 |
| 增加训练轮数 | 欠拟合 | 更充分学习 |
| 减小正则化 | 欠拟合 | 放松约束 |

### L1 vs L2

```
L1: |w| → 梯度恒为 ±1 → 倾向产生精确的 0（稀疏）
L2: w² → 梯度为 2w → 权重均匀缩小但不归零（平滑）
```

---

## 七、混合精度训练

```
FP32 (master weights) → 转 FP16 前向 → FP16 反向 → FP32 更新

关键技术：
1. Loss Scaling：将 loss 放大 → 梯度放大 → 避免 FP16 下溢
2. 动态 Loss Scale：自动调整放大倍数
3. 保留 FP32 的地方：BN 统计量、Softmax、Loss 计算
```

**收益**：内存减半 + 计算加速 2~3 倍（Tensor Core）

---

## 八、分布式训练

### 数据并行（Data Parallel）

```
每个 GPU 持有完整模型副本
数据切分到不同 GPU
每步：各 GPU 独立前向反向 → AllReduce 同步梯度 → 统一更新

通信量：O(参数量) 每步
扩展性：受通信带宽限制，通常 8~64 GPU 高效
```

### 模型并行

```
Tensor 并行：将大矩阵切分到多卡（如 Megatron-LM）
Pipeline 并行：不同层放不同卡，流水线执行
ZeRO：优化器状态 / 梯度 / 参数分片存储（DeepSpeed）
```

---

## 速答 6 道

**Q1：Adam 和 SGD 谁泛化性更好？为什么？**

→ SGD 通常泛化更好。Adam 自适应 lr 使得 sharp minima 和 flat minima 都能快速收敛，SGD 倾向收敛到 flat minima（泛化更好）。实践中大规模 CV 任务（ImageNet）常用 SGD。

**Q2：BatchNorm 为什么在小 batch size 下效果差？**

→ 小 batch 的均值和方差估计不准，噪声过大；此时改用 GroupNorm 或 LayerNorm。目标检测等任务（batch=2~4）推荐 GroupNorm。

**Q3：为什么 Transformer 用 LayerNorm 而不是 BatchNorm？**

→ ①NLP 序列长度不固定，batch 维度统计不稳定②小 batch 训练常见③LayerNorm 对每个 token 独立归一化，不依赖其他样本。

**Q4：Warmup 的直觉解释？**

→ 训练初期参数随机 → Adam 的二阶动量 v_t 估计不准（偏向 0 →分母小 → 实际 lr 过大）→ warmup 限制初期 lr，等统计量稳定后再放开。

**Q5：L2 正则化和权重衰减是一回事吗？**

→ 在 vanilla SGD 中等价；在 Adam 中不等价！L2 的梯度会被 adaptive lr 缩放，而权重衰减（AdamW）直接对参数本身衰减，不受 v_t 影响，正则效果更稳定。

**Q6：如何选择 batch size？**

→ 大 batch：训练快但泛化可能差（需配合大 lr + warmup + LARS/LAMB）；小 batch：泛化好但训练慢。典型：CV 用 256~1024，NLP 用 16~64（受序列长度限制）。线性 Scaling Rule：batch 翻倍 lr 翻倍。
