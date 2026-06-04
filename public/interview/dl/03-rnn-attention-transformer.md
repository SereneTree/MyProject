# 循环网络与注意力机制

## 考点概览

| 考点 | 重要度 | 考法 |
|------|--------|------|
| RNN 梯度问题 | ⭐⭐⭐⭐ | 为什么 vanilla RNN 难训练 |
| LSTM 门控机制 | ⭐⭐⭐⭐⭐ | 画结构图 + 解释每个门 |
| GRU 简化设计 | ⭐⭐⭐ | 与 LSTM 对比 |
| Seq2Seq + Attention | ⭐⭐⭐⭐ | 注意力机制动机、计算过程 |
| Transformer 架构 | ⭐⭐⭐⭐⭐ | Self-Attention 全过程、Multi-Head |
| 位置编码 | ⭐⭐⭐⭐ | sin/cos 设计、可学习 PE |
| 多头注意力 | ⭐⭐⭐⭐ | 为什么多头、参数量 |

---

## 一、循环神经网络 RNN

### 基本结构

```
h_t = tanh(W_hh · h_{t-1} + W_xh · x_t + b)
y_t = W_hy · h_t
```

### 梯度消失问题

```
∂L/∂h_0 = ∏_{t=1}^{T} ∂h_t/∂h_{t-1} · ∂L/∂h_T
         = ∏_{t=1}^{T} W_hh^T · diag(tanh'(z_t)) · ∂L/∂h_T

若 ||W_hh|| < 1 且 tanh' < 1 → 连乘趋向 0 → 梯度消失
若 ||W_hh|| > 1            → 连乘趋向 ∞ → 梯度爆炸
```

**结论**：Vanilla RNN 难以学习长距离依赖（T > 20 就很困难）

---

## 二、LSTM（⭐ 高频考点）

### 结构图

```
       ┌─────────────────────────────────────────┐
       │            Cell State (C_t)               │
       │  C_{t-1} ──[×f_t]──[+]──────────── C_t  │
       │                      ↑                    │
       │                   [×i_t]                  │
       │                      ↑                    │
       │                    C̃_t                    │
       └─────────────────────────────────────────┘
                              ↓ [×o_t]
                             h_t
```

### 四个公式（必背）

```
遗忘门：f_t = σ(W_f · [h_{t-1}, x_t] + b_f)      → 决定丢弃旧信息的比例
输入门：i_t = σ(W_i · [h_{t-1}, x_t] + b_i)      → 决定写入新信息的比例
候选值：C̃_t = tanh(W_c · [h_{t-1}, x_t] + b_c)   → 生成候选新信息
更新：  C_t = f_t ⊙ C_{t-1} + i_t ⊙ C̃_t          → 更新 Cell State
输出门：o_t = σ(W_o · [h_{t-1}, x_t] + b_o)      → 决定输出多少
隐状态：h_t = o_t ⊙ tanh(C_t)                     → 最终输出
```

### 为什么 LSTM 能缓解梯度消失？

```
∂C_t/∂C_{t-1} = f_t    (遗忘门，值在 0~1 之间)

关键：f_t 是独立对每个时间步学习的，而非固定的 W_hh
→ 网络可以学会让 f_t ≈ 1（保持梯度不衰减）
→ Cell State 是梯度的"高速公路"，无需经过非线性压缩
```

---

## 三、GRU

### 简化设计

```
重置门：r_t = σ(W_r · [h_{t-1}, x_t])
更新门：z_t = σ(W_z · [h_{t-1}, x_t])
候选：  h̃_t = tanh(W · [r_t ⊙ h_{t-1}, x_t])
输出：  h_t = (1 - z_t) ⊙ h_{t-1} + z_t ⊙ h̃_t
```

### LSTM vs GRU 对比

| 维度 | LSTM | GRU |
|------|------|-----|
| 门数量 | 3 个（遗忘、输入、输出） | 2 个（重置、更新） |
| 状态 | Cell State + Hidden State | 仅 Hidden State |
| 参数量 | 更多 | 约少 25% |
| 适用 | 长序列、需要精细控制 | 短序列、数据较少 |
| 效果 | 大多数任务略优 | 简单任务差距不大 |

---

## 四、Seq2Seq + Attention

### Seq2Seq 的瓶颈

```
Encoder: x_1...x_T → h_T (最后一个隐状态作为"瓶颈向量")
Decoder: h_T → y_1...y_T'

问题：所有信息压缩到一个固定长度向量 h_T，信息瓶颈！
```

### Attention 机制

```
对 Decoder 每一步 s_t，动态关注 Encoder 不同位置：

score(s_t, h_i) = s_t^T · h_i        (dot-product)
               or v^T · tanh(W[s_t; h_i])  (additive)

α_ti = softmax(score(s_t, h_i))       → 注意力权重
c_t  = Σ α_ti · h_i                   → 上下文向量
output = f([s_t; c_t])                 → 融合输出
```

**核心思想**：解码每个词时"动态选择性地关注"输入的不同部分

---

## 五、Transformer（⭐⭐ 最核心考点）

### 整体架构

```
Input → Embedding + Positional Encoding
     → N × Encoder Layer:
         ├── Multi-Head Self-Attention
         ├── Add & LayerNorm
         ├── Feed-Forward Network
         └── Add & LayerNorm
     → Encoder Output

Target → Embedding + Positional Encoding
      → N × Decoder Layer:
          ├── Masked Multi-Head Self-Attention
          ├── Add & LayerNorm
          ├── Multi-Head Cross-Attention (Q from decoder, KV from encoder)
          ├── Add & LayerNorm
          ├── Feed-Forward Network
          └── Add & LayerNorm
      → Linear + Softmax → Output
```

### Self-Attention 计算过程

```python
# 输入 X ∈ R^{n × d_model}

Q = X · W_Q    # Query:  n × d_k
K = X · W_K    # Key:    n × d_k
V = X · W_V    # Value:  n × d_v

Attention(Q, K, V) = softmax(Q · K^T / √d_k) · V

# QK^T: n×n 矩阵，表示每对 token 之间的相关性
# softmax: 归一化为注意力权重
# 乘 V: 加权聚合 Value
```

### 为什么除以 √d_k？（必考）

```
假设 Q, K 中的元素独立同分布，均值 0，方差 1
→ Q·K^T 的每个元素是 d_k 个乘积之和
→ 方差 = d_k（每个乘积方差为 1，d_k 个累加）
→ 标准差 = √d_k

如果不除：点积值过大 → softmax 进入饱和区 → 梯度接近 0
除以 √d_k：将方差归一化为 1，保持 softmax 在合理区间
```

### Multi-Head Attention

```python
# 并行做 h 组注意力（h=8 通常）
head_i = Attention(Q·W_i^Q, K·W_i^K, V·W_i^V)
MultiHead = Concat(head_1, ..., head_h) · W_O

# 每个 head: d_k = d_model / h = 512/8 = 64
# 总参数量与单头相当，但能捕捉不同子空间的模式
```

**为什么多头？**
- 不同 head 关注不同的语义子空间（语法、语义、位置等）
- 类似 CNN 的多个卷积核捕捉不同 pattern
- 参数量不增加（总维度拆分到各 head）

### 位置编码

```
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

**为什么用 sin/cos？**
1. 可推广到任意长度（不受训练最大长度限制）
2. PE(pos+k) 可以表示为 PE(pos) 的线性变换 → 模型可学习相对位置
3. 不同维度用不同频率 → 构成位置的"频率编码"

### FFN（前馈网络）

```python
FFN(x) = max(0, x·W_1 + b_1) · W_2 + b_2
# 或 GELU 版本
# W_1: d_model → d_ff (通常 4×d_model)
# W_2: d_ff → d_model

# 作用：对每个位置独立做非线性变换，增加模型容量
```

### Transformer 关键设计总结

| 组件 | 作用 | 没有它会怎样 |
|------|------|-------------|
| Self-Attention | 全局依赖建模 | 只有局部信息，类似 CNN |
| Multi-Head | 多子空间表示 | 表达能力下降 |
| Residual + LayerNorm | 训练稳定性 | 深层无法训练 |
| Positional Encoding | 注入顺序信息 | 词袋模型，丢失语序 |
| FFN | 逐位置非线性变换 | 仅有线性混合，容量不足 |
| Mask (Decoder) | 防止看到未来信息 | 训练时作弊，推理时错误 |

---

## 六、Attention 变体

| 变体 | 方法 | 复杂度 | 应用 |
|------|------|--------|------|
| Standard | Dense Q·K^T | O(n²) | BERT, GPT |
| Sparse (Longformer) | 局部 + 全局 | O(n) | 长文档 |
| Linear (Performer) | 核近似 | O(n) | 长序列 |
| Flash Attention | IO 优化 | O(n²) 但实际快 2~4× | 训练加速 |
| Multi-Query | 共享 KV | 减少 KV cache | 推理加速 |
| Grouped-Query | KV 分组共享 | 折中方案 | LLaMA 2 |

---

## 速答 8 道

**Q1：RNN 为什么存在梯度消失？LSTM 如何解决？**

→ RNN 梯度需经过 ∏ W_hh·tanh' 连乘，指数衰减；LSTM 通过 Cell State 提供梯度直通路径（∂C_t/∂C_{t-1} = f_t），遗忘门可学习为接近 1，保持梯度不消失。

**Q2：Self-Attention 的时间和空间复杂度？**

→ 时间 O(n²·d)，空间 O(n²)（attention matrix），n 为序列长度，d 为维度。这是 Transformer 处理长序列的瓶颈。

**Q3：Transformer 为什么能取代 RNN？**

→ ①并行计算（RNN 必须顺序）②Self-Attention 直接建模任意距离依赖（RNN 需多步传递）③残差+LayerNorm 使训练更稳定。

**Q4：LayerNorm vs BatchNorm 在 Transformer 中？**

→ LayerNorm 对每个样本在特征维度归一化，不依赖 batch size；BatchNorm 对 batch 维度归一化。序列任务中长度不定、batch 统计不稳定，LayerNorm 更适合。

**Q5：Decoder 的 Mask 是怎么做的？**

→ 在 Self-Attention 的 QK^T 矩阵上，将未来位置（上三角）设为 -∞，softmax 后为 0，确保生成第 t 个 token 时只能看到前 t-1 个。

**Q6：Cross-Attention 和 Self-Attention 的区别？**

→ Self-Attention 的 Q/K/V 来自同一序列；Cross-Attention 的 Q 来自 Decoder，K/V 来自 Encoder。作用：解码器查询编码器信息。

**Q7：Transformer 的参数量怎么估算？**

→ 每层主要参数：4×d² (Q/K/V/O 映射) + 8×d² (FFN 的 W1 和 W2，d_ff=4d) ≈ 12d²。N 层总参数 ≈ 12Nd²。例如 BERT-base：12×12×768² ≈ 85M。

**Q8：为什么 GPT 只用 Decoder？BERT 只用 Encoder？**

→ GPT 做自回归生成（逐 token 预测），需要 causal mask，天然是 Decoder 结构。BERT 做双向理解（MLM），需要看到完整上下文，天然是 Encoder 结构。
