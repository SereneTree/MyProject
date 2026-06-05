# Question 1：线性回归与MMSE (25 分)

## 题目概览

- (a) 简单线性回归 MMSE 求解 (15分)
  - (i) 求 MMSE 系数 w₀, w₁ (10分)
  - (ii) 计算训练 MSE (5分)
- (b) 三次多项式模型分析 (10分)
  - (i) 三次模型的训练 MSE 预期 (4分)
  - (ii) 部署时的误差来源分析 (6分)

---

## 核心知识点

### 1. 线性回归模型

$$y = w_0 + w_1 x$$

- w₀：截距 (intercept/bias)
- w₁：斜率 (slope)

### 2. 设计矩阵 (Design Matrix)

对于模型 y = w₀ + w₁x，设计矩阵 X 的每行对应一个样本：

$$X = \begin{pmatrix} 1 & x_1 \\ 1 & x_2 \\ \vdots & \vdots \\ 1 & x_N \end{pmatrix}$$

- 第一列全1（对应 w₀ 的系数）
- 第二列为特征值（对应 w₁ 的系数）

### 3. MMSE 公式（最小均方误差解）

$$\mathbf{w} = (X^\top X)^{-1} X^\top \mathbf{y}$$

这是使 MSE 最小化的解析解（也称正规方程 Normal Equation）。

### 4. 均方误差 (MSE)

$$\text{MSE} = \frac{1}{N} \sum_{i=1}^{N} (y_i - f(x_i))^2$$

### 5. 偏差-方差分解 (Bias-Variance Decomposition)

$$\text{Expected Error} = \text{Noise Variance} + \text{Bias}^2 + \text{Variance}$$

- **噪声方差**：数据中固有的随机性，不可减少
- **偏差 (Bias)**：模型假设与真实模式之间的差距
- **方差 (Variance)**：由于训练数据采样不同导致模型的波动

---

## 详细解答

### 训练数据 (Table 1)

| x | y |
|---|---|
| 2 | 1 |
| 4 | 5 |
| 1 | 2 |
| 3 | 2 |

---

### Part (a)(i) — 求 MMSE 系数 (10分)

**第一步：构造设计矩阵 X**

模型 y = w₀ + w₁x，因此：

$$X = \begin{pmatrix} 1 & 2 \\ 1 & 4 \\ 1 & 1 \\ 1 & 3 \end{pmatrix}$$

**第二步：计算 X⊤**

$$X^\top = \begin{pmatrix} 1 & 1 & 1 & 1 \\ 2 & 4 & 1 & 3 \end{pmatrix}$$

**第三步：计算 X⊤X**

$$X^\top X = \begin{pmatrix} 1 & 1 & 1 & 1 \\ 2 & 4 & 1 & 3 \end{pmatrix} \begin{pmatrix} 1 & 2 \\ 1 & 4 \\ 1 & 1 \\ 1 & 3 \end{pmatrix} = \begin{pmatrix} 4 & 10 \\ 10 & 30 \end{pmatrix}$$

**第四步：使用题目给出的 (X⊤X)⁻¹**

$$(X^\top X)^{-1} = \begin{pmatrix} 1.5 & -0.5 \\ -0.5 & 0.2 \end{pmatrix}$$

**第五步：计算 X⊤y**

$$\mathbf{y} = \begin{pmatrix} 1 \\ 5 \\ 2 \\ 2 \end{pmatrix}$$

$$X^\top \mathbf{y} = \begin{pmatrix} 1 & 1 & 1 & 1 \\ 2 & 4 & 1 & 3 \end{pmatrix} \begin{pmatrix} 1 \\ 5 \\ 2 \\ 2 \end{pmatrix} = \begin{pmatrix} 10 \\ 30 \end{pmatrix}$$

**第六步：计算 w**

$$\mathbf{w} = (X^\top X)^{-1} X^\top \mathbf{y} = \begin{pmatrix} 1.5 & -0.5 \\ -0.5 & 0.2 \end{pmatrix} \begin{pmatrix} 10 \\ 30 \end{pmatrix} = \begin{pmatrix} 1.5 \times 10 + (-0.5) \times 30 \\ (-0.5) \times 10 + 0.2 \times 30 \end{pmatrix} = \begin{pmatrix} 0 \\ 1 \end{pmatrix}$$

$$\boxed{w_0 = 0, \quad w_1 = 1}$$

**最终模型**：y = x

---

### Part (a)(ii) — 计算训练 MSE (5分)

模型 f(x) = x，对每个训练样本计算预测误差：

| x | y (真实) | f(x) = x (预测) | 误差 e = y - f(x) | e² |
|---|---------|-----------------|-------------------|-----|
| 2 | 1 | 2 | -1 | 1 |
| 4 | 5 | 4 | 1 | 1 |
| 1 | 2 | 1 | 1 | 1 |
| 3 | 2 | 3 | -1 | 1 |

$$\text{MSE} = \frac{1}{4}(1 + 1 + 1 + 1) = \frac{4}{4} = 1$$

$$\boxed{\text{训练 MSE} = 1}$$

---

### Part (b)(i) — 三次模型的训练 MSE (4分)

三次模型：y = w₀ + w₁x + w₂x² + w₃x³（4个参数）

**关键推理**：

- 训练数据有 4 个样本
- 三次多项式有 4 个自由参数 (w₀, w₁, w₂, w₃)
- 4 个参数可以精确通过 4 个数据点（类似于"过三点确定二次曲线"）

$$\boxed{\text{训练 MSE} = 0}$$

**原因**：参数数量 = 样本数量时，总能找到完美拟合所有训练点的解。

> 注意：这并不意味着模型好——这恰恰是**过拟合**的典型表现！

---

### Part (b)(ii) — 部署时的误差来源 (6分)

假设真实模型为 y = x + n（n 为零均值高斯噪声），三次模型在新数据上的预测误差来源：

**1. 噪声方差 (Noise Variance / Irreducible Error)**

$$\sigma_n^2 = \text{Var}(n)$$

数据中固有的随机噪声，任何模型都无法消除。

**2. 模型偏差 (Bias)**

$$\text{Bias} = \text{三次曲线} - \text{真实直线}$$

真实模式是直线 y=x，但模型假设是三次曲线。三次模型会试图用弯曲的曲线去拟合直线模式，引入系统性误差。

**3. 模型方差 (Variance due to Sampling)**

由于只有 4 个训练样本（带噪声），不同的训练集会产生非常不同的三次拟合曲线。高阶模型对训练数据的微小变化极其敏感。

$$\boxed{\text{总误差} = \text{噪声方差} + \text{偏差}^2 + \text{模型方差}}$$

**总结**：三次模型虽然训练 MSE=0，但由于过拟合，在新数据上的偏差和方差都会很大。

---

## 偏差-方差权衡图示

```
误差
 ↑
 |     总误差
 |    /       \
 |   /    方差 ↗
 |  /   ↗
 | / ↗        偏差 ↘
 |/___↘___________→ 模型复杂度
 简单              复杂
(线性)            (三次)

最优复杂度在"总误差最低"处
```

---

## 知识点速查表

| 概念 | 公式/要点 | 本题结果 |
|------|----------|---------|
| 设计矩阵 | 第一列全1，后续列为特征 | 4×2 矩阵 |
| MMSE 解 | w = (X⊤X)⁻¹X⊤y | w=(0,1)⊤ |
| 训练 MSE | (1/N)Σe² | 1 |
| 过拟合 | 参数数≥样本数 → MSE=0 | 三次模型 |
| 偏差 | 模型假设 vs 真实模式 | 三次 vs 线性 |
| 方差 | 训练集变化 → 模型变化 | 小数据+高阶=高方差 |
