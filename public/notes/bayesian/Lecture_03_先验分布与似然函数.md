# Lecture 3：先验分布与似然函数

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 定义并识别独立同分布（i.i.d.）随机变量
2. 识别 Bayes 定理中的先验和似然
3. 计算未知总体参数的最大似然估计（MLE）

---

## 一、条件独立性

### 边际独立

$$P(A \cap B) = P(A)\,P(B)$$

### 条件独立

$$P(A \cap B | C) = P(A|C)\,P(B|C)$$

等价条件：$P(A|B \cap C) = P(A|C)$（已知 C 后，B 不再提供 A 的额外信息）

---

## 二、i.i.d. 随机变量

若 $Y_1,\dots,Y_n$ 满足：
1. 给定 θ 条件独立：$P(Y_1=y_1,\dots,Y_n=y_n|\theta) = \prod_{i=1}^n P(Y_i=y_i|\theta)$
2. 服从相同分布

则记作 $Y_1,\dots,Y_n|\theta \sim \text{i.i.d.}\; p(y|\theta)$

### 举例：Bernoulli 模型

投硬币 3 次，$\theta = P(\text{正面})$，每次 $Y_i \sim \text{Ber}(\theta)$：

$$P(Y_1=H, Y_2=T, Y_3=H|\theta) = \theta(1-\theta)\theta = \theta^2(1-\theta)$$

---

## 三、先验分布

**先验分布 $p(\theta)$**：观测数据之前，对未知参数 θ 的信念的概率分布。

### 离散先验

$$\sum_{\theta \in \Theta} p(\theta) = 1$$

**例**：urn 中 9 个球（红或绿），θ = 红球数，Θ = {0,1,…,9}，均匀先验：

$$p(\theta) = \frac{1}{10}, \quad \forall\,\theta \in \{0,1,\dots,9\}$$

### 连续先验

$$\int_a^b p(\theta)\,d\theta = 1$$

**例**：硬币正面概率 θ ∈ [0,1]，均匀先验：

$$\theta \sim U[0,1], \quad p(\theta) = 1, \quad 0 \leq \theta \leq 1$$

---

## 四、似然函数

$$L(\theta|Y) = p(Y|\theta)$$

**视角转换**：
- $p(Y|\theta)$：固定 θ，看 Y 的函数（概率分布）
- $L(\theta|Y)$：固定 Y（观测数据），看 θ 的函数（**不是** θ 的概率分布）

> **重要**：$\sum_{\theta\in\Theta} L(\theta|Y) \neq 1$，似然函数**不是**概率分布。

### 如何计算联合似然（i.i.d. 数据）

$$L(\theta|Y) = p(Y|\theta) = \prod_{i=1}^n p(y_i|\theta)$$

**例**：$n=1000$ 次投硬币，600 次正面，$Y_i \sim \text{i.i.d. Ber}(\theta)$：

$$L(\theta|Y) = \prod_{i=1}^{1000} \theta^{y_i}(1-\theta)^{1-y_i} = \theta^{600}(1-\theta)^{400}$$

---

## 五、最大似然估计（MLE）

$$\hat{\theta}_\text{MLE} = \arg\max_{\theta \in \Theta}\, L(\theta|Y)$$

> **直觉**：使观测到当前数据的可能性最大的参数值。

### 对数似然（Log-Likelihood）

由于对数函数单调，等价地最大化：

$$\ell(\theta|Y) = \log L(\theta|Y)$$

$$\hat\theta = \arg\max L(\theta|Y) = \arg\max \ell(\theta|Y)$$

对数将乘积变为求和，**大大简化计算**。

### MLE 推导举例：Bernoulli 数据

$$\ell(\theta|Y) = 600\log\theta + 400\log(1-\theta)$$

$$\ell'(\theta|Y) = \frac{600}{\theta} - \frac{400}{1-\theta} = 0 \implies \hat\theta = 0.6$$

即样本均值 $\bar{y} = 600/1000 = 0.6$。

### 常用 MLE 速查表

| 数据分布 | MLE $\hat\theta$ |
|----------|-----------------|
| $Y_i \sim \text{i.i.d. Ber}(\theta)$ | $\bar{y}$（样本均值） |
| $Y_i \sim \text{i.i.d. Pois}(\lambda)$ | $\bar{y}$ |
| $Y_i \sim \text{i.i.d. N}(\mu,\sigma^2)$ | $\bar{y}$ |
| $Y_i \sim \text{i.i.d. Exp}(\lambda)$ | $1/\bar{y}$ |
| $Y_i \sim U[0,\theta]$ | $\max(y_i)$ |

### MLE 推导：指数分布

$$L(\theta|Y) = \theta^n e^{-\theta\sum y_i}$$

$$\ell(\theta|Y) = n\log\theta - \theta\sum y_i$$

$$\ell'(\theta|Y) = \frac{n}{\theta} - \sum y_i = 0 \implies \hat\theta = \frac{n}{\sum y_i} = \frac{1}{\bar{y}}$$

---

## 六、Bayes 定理回顾

$$p(\theta|Y) = \frac{p(Y|\theta)\,p(\theta)}{p(Y)}$$

| 组成 | 作用 |
|------|------|
| $p(\theta)$ — 先验 | 数据前的信念 |
| $p(Y|\theta)$ — 似然 | 数据在各 θ 下的可能性 |
| $p(Y)$ — 边际 | 归一化常数（对 θ 积分） |
| $p(\theta|Y)$ — 后验 | 数据后的更新信念 |

> $\text{后验} \propto \text{似然} \times \text{先验}$（比例常数为 $1/p(Y)$）

---

## 考试重点

- [ ] 能写出 i.i.d. 数据的联合似然（乘积形式）
- [ ] 知道似然函数**不是** θ 的概率分布
- [ ] 会用对数似然求 MLE（对导数令为零）
- [ ] 记住 5 种常见分布的 MLE（尤其是"都是样本均值"的规律）
- [ ] 理解先验分布是一个**合法的概率分布**（积分/求和为 1）
