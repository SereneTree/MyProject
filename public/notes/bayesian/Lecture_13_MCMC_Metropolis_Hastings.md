# Lecture 13：MCMC——Metropolis-Hastings 算法

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 确定马尔可夫链的状态和状态空间
2. 计算转移概率
3. 计算多步后的联合概率
4. 求马尔可夫链的长期分布
5. 使用 Metropolis-Hastings 算法构建以后验为稳态的马尔可夫链

---

## 一、为什么需要 MCMC？

### 问题背景

当选择**非共轭先验**时，后验的归一化常数难以计算：

$$p(\theta|\text{data}) = \frac{p(\theta)\,p(\text{data}|\theta)}{\int p(\theta)p(\text{data}|\theta)\,d\theta}$$

积分 $\int p(\theta)p(\text{data}|\theta)\,d\theta$ **可能没有解析解**。

### MCMC 的思路

不直接计算积分，而是：

1. 构造一个**马尔可夫链**，使其稳态分布 = 目标后验 $g(\theta)$
2. 让链运行足够长，达到稳态
3. 从链中采样，近似从后验采样（Monte Carlo 方法）

> **无需计算归一化常数**，只需要知道 $g(\theta) \propto p(\theta)\,p(\text{data}|\theta)$（后验的形状）。

---

## 二、随机过程与马尔可夫链

### 随机过程

随时间演化且包含随机性的过程。

- **离散时间随机过程**：$X(0),X(1),X(2),\dots$（仅在整数时刻改变）
- **状态**：过程在时刻 t 的取值 $X(t)$
- **状态空间**：所有可能状态的集合

### 马尔可夫性质（Markov Property）

$$P(X(n+1)=j|X(n)=i,X(n-1),\dots) = P(X(n+1)=j|X(n)=i)$$

**下一状态只依赖当前状态，与历史无关。**

### 转移概率矩阵 P

$$P_{ij} = P(X(n+1)=j|X(n)=i)$$

性质：每行之和为 1，$\sum_j P_{ij} = 1$

### n 步转移

$$P^{(n)} = \underbrace{P \times P \times \dots \times P}_{n\text{ 次}}$$

$$P^{(m+n)} = P^{(m)} \times P^{(n)}$$

### 例：天气模型

| | 明天雨 | 明天晴 |
|--|--------|--------|
| **今天雨** | 0.3 | 0.7 |
| **今天晴** | 0.6 | 0.4 |

$$P = \begin{pmatrix}0.3 & 0.7\\0.6 & 0.4\end{pmatrix}$$

2 步转移矩阵：$P^2 = P\times P = \begin{pmatrix}0.51 & 0.49\\0.42 & 0.58\end{pmatrix}$

---

## 三、长期分布（稳态分布）

### 定义

若马尔可夫链存在与初始状态无关的极限分布：

$$\pi = \lim_{n\to\infty}\alpha(0)\,P^n$$

则 $\pi$ 称为**长期分布**（long-run distribution）。

### 稳态方程

任意满足 $\hat\pi = \hat\pi \times P$ 的分布称为**稳态分布**（steady-state distribution）。

> **注意**：长期分布一定满足稳态方程；但稳态方程的解**不一定**是长期分布（如周期性链）。

### 例：天气模型的稳态

长期运行后：$\pi \approx (0.461,\; 0.539)$（约 46.1% 雨天，53.9% 晴天）

验证：$\begin{pmatrix}0.461 & 0.539\end{pmatrix}\begin{pmatrix}0.3 & 0.7\\0.6 & 0.4\end{pmatrix} = \begin{pmatrix}0.461 & 0.539\end{pmatrix}$ ✓

---

## 四、Metropolis-Hastings 算法

### 核心思想

给定目标后验 $g(\theta)$（只知道形状，不知道归一化常数），构造一个马尔可夫链使其稳态分布恰好等于 $g(\theta)$。

### 算法步骤（两状态离散情形）

**Step 1**：选择初始值 $\theta_0$

**Step 2**：重复 $i = 1,\dots,m$：

1. 提议一个候选状态 $\theta^* \neq \theta_{i-1}$
2. 计算接受率：$\alpha = \dfrac{g(\theta^*)}{g(\theta_{i-1})}$
3. 接受/拒绝规则：
   - 若 $\alpha \geq 1$：接受，令 $\theta_i = \theta^*$
   - 若 $\alpha < 1$：以概率 $\alpha$ 接受（$\theta_i = \theta^*$），以概率 $1-\alpha$ 拒绝（$\theta_i = \theta_{i-1}$）

**构造的转移矩阵**：

$$P(\theta_{i-1}\to\theta^*) = \alpha, \quad P(\theta_{i-1}\to\theta_{i-1}) = 1-\alpha$$

### 算法直觉

- 若候选状态 $\theta^*$ 的后验更高（$\alpha>1$）：**总是接受**（往"更好"的地方走）
- 若候选状态后验更低（$\alpha<1$）：**以 α 的概率接受**（以小概率往"更差"的地方走，保证探索完整后验）

---

## 五、离散例题

### 例 1：硬币投掷

**设定**：$\theta \in \{0.5, 0.7\}$，$p(\text{偏斜})=0.6$，$p(\text{公平})=0.4$

5 次投掷，2 次正面，计算后验：$g(\theta=0.5) = 0.612$，$g(\theta=0.7) = 0.388$

**M-H 应用**：

- 从 $\theta=0.5$ 提议 $\theta^*=0.7$：$\alpha = 0.388/0.612 = 0.634$
  → 以 0.634 接受；转移概率 $P(0.5\to0.7)=0.634$
- 从 $\theta=0.7$ 提议 $\theta^*=0.5$：$\alpha = 0.612/0.388 = 1.577 > 1$
  → 总是接受；转移概率 $P(0.7\to0.5)=1$

转移矩阵：$P = \begin{pmatrix}0.366 & 0.634\\1 & 0\end{pmatrix}$

验证：$(0.612,\; 0.388)\times P = (0.612,\; 0.388)$ ✓

### 例 2：疾病诊断

$g(\theta=\text{mild})=0.4375$，$g(\theta=\text{severe})=0.5625$

- mild → severe：$\alpha = 0.5625/0.4375 = 1.286 > 1$ → 总接受
- severe → mild：$\alpha = 0.4375/0.5625 = 0.778$

转移矩阵：$P' = \begin{pmatrix}0 & 1\\0.778 & 0.222\end{pmatrix}$

---

## 六、已知转移矩阵的 Metropolis 算法

**已知**：现有转移矩阵 P，目标稳态 π。**求**：更新后的矩阵 P' 使 $\pi P' = \pi$。

**Step 1**：对每对 $(i,j)$，计算接受率：

$$\alpha_{i,j} = \min\!\left[\frac{\pi_j\, p_{j,i}}{\pi_i\, p_{i,j}},\; 1\right]$$

**Step 2**：新转移概率（$j \neq i$）：

$$p'_{i,j} = \alpha_{i,j}\cdot p_{i,j}$$

**Step 3**：对角元素（停留概率）：

$$p'_{i,i} = 1 - \sum_{j\neq i} p'_{i,j}$$

---

## 七、燃烧期（Burn-in）

### 问题

链的初始样本受起始值 $\theta_0$ 影响，**不代表后验**。

### 实践做法

1. 模拟 $m$（如 10000）步
2. 丢弃前 $m_0$（如 1000）步 → **燃烧期**
3. 使用剩余 $\{θ_{m_0+1},\dots,\theta_m\}$ 作为近似后验样本

### 如何确定 $m_0$？

- 观察**迹图**（trace plot）：若链已稳定则可截断
- 无通用标准，依赖目标分布和提议分布

---

## 考试重点

- [ ] 写出马尔可夫性质，能判断过程是否满足
- [ ] 能构造给定转移概率的矩阵 P，计算 n 步转移 P^n
- [ ] 能求马尔可夫链的稳态分布（解 πP=π）
- [ ] 理解 M-H 算法的每个步骤（尤其是接受率公式）
- [ ] 能对两状态问题应用 M-H，构造转移矩阵并验证稳态
- [ ] 理解燃烧期的概念和目的
