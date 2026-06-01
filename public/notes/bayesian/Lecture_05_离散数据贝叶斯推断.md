# Lecture 5：离散数据的贝叶斯推断

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 识别数据服从离散分布的问题
2. 为未知参数选择合适的先验
3. 执行完整的后验分析

---

## 一、Beta-Binomial 共轭

### 问题设定（幸福感数据）

- 数据：129 名 65 岁以上城市女性，问是否幸福（$y_i = 1$ 幸福，$y_i = 0$ 不幸福）
- 未知参数：$\theta$ = 总体中幸福的比例，$\theta \in [0,1]$（**连续**参数）
- 数据分布：$Y_i \sim \text{i.i.d. Ber}(\theta)$（**离散**数据）

### 先验选择

不知道 θ 的信息 → **均匀先验**：$\theta \sim U(0,1) = \text{Beta}(1,1)$

$$p(\theta) = 1, \quad \theta \in [0,1]$$

### 似然函数

设 118 人幸福，11 人不幸福（$\sum y_i = 118$）：

$$p(y_1,\dots,y_{129}|\theta) = \theta^{118}(1-\theta)^{11}$$

### 边际概率

利用 Beta 分布积分公式 $\int_0^1 x^{a-1}(1-x)^{b-1}dx = \dfrac{\Gamma(a)\Gamma(b)}{\Gamma(a+b)}$：

$$p(Y) = \int_0^1 \theta^{118}(1-\theta)^{11}d\theta = \frac{\Gamma(119)\Gamma(12)}{\Gamma(131)}$$

### 后验分布

$$p(\theta|Y) = \frac{\Gamma(131)}{\Gamma(119)\Gamma(12)}\,\theta^{118}(1-\theta)^{11} = \text{Beta}(119,12)$$

---

### Beta-Binomial 共轭公式（通用）

$$\boxed{\underbrace{Y_i|\theta \sim \text{i.i.d. Bin}(1,\theta)}_{\text{二项似然}} + \underbrace{\theta \sim \text{Beta}(a,b)}_{\text{先验}} \implies \underbrace{\theta|Y \sim \text{Beta}(a+y,\;b+n-y)}_{\text{后验}}}$$

其中 $y = \sum_{i=1}^n y_i$（成功次数），$n-y$（失败次数）。

**直觉**：先验参数 $a$ 加上成功次数，$b$ 加上失败次数。

---

### 后验统计量

| 统计量 | 公式 |
|--------|------|
| 先验均值 | $E[\theta] = \dfrac{a}{a+b}$ |
| 样本均值 | $\bar{y} = \dfrac{\sum y_i}{n}$ |
| **后验均值** | $E[\theta|Y] = \dfrac{a+y}{a+b+n}$ |
| 先验方差 | $\text{Var}[\theta] = \dfrac{ab}{(a+b)^2(a+b+1)}$ |
| **后验方差** | $\text{Var}[\theta|Y] = \dfrac{(a+y)(b+n-y)}{(a+b+n)^2(a+b+n+1)}$ |

**幸福感例子中**（先验 Beta(1,1)，后验 Beta(119,12)）：

| | 值 |
|--|--|
| 先验均值 | 0.5 |
| 样本均值 | 118/129 = 0.915 |
| **后验均值** | 119/131 = **0.908** |
| 先验方差 | 0.083 |
| **后验方差** | **0.0006**（大幅减少！） |

> 后验均值介于先验均值和样本均值之间，但因 n=129 远大于先验信息量，更接近样本均值。

---

## 二、Gamma-Poisson 共轭

### 问题设定（生育率数据）

- 数据：155 名 40 岁以上女性，记录孩子数量
- 未知参数：$\theta_1$ = 无大学学历女性的平均孩子数，$\theta_2$ = 有大学学历的平均孩子数
- $\theta_1, \theta_2 \in [0,\infty)$（不能用 Beta，因为 Beta 的支撑为 [0,1]）

### 为何选 Poisson 似然？

孩子数量是计数型、可取任意非负整数 → $X_i \sim \text{i.i.d. Pois}(\theta_1)$

### 为何选 Gamma 先验？

$\theta_1,\theta_2 \in [0,\infty)$，Gamma 分布的支撑正好是 $[0,\infty)$，且与 Poisson 构成共轭对。

### Gamma-Poisson 共轭公式（通用）

$$\boxed{\underbrace{Y_i|\theta \sim \text{i.i.d. Pois}(\theta)}_{\text{泊松似然}} + \underbrace{\theta \sim \text{Gamma}(a,b)}_{\text{先验}} \implies \underbrace{\theta|Y \sim \text{Gamma}\!\left(a+\sum x_i,\;b+n\right)}_{\text{后验}}}$$

**直觉**：先验 a 加上总观测计数，先验 b 加上样本量 n。

---

### 数值例子

**先验**：$\theta_1, \theta_2 \sim \text{i.i.d. Gamma}(2,1)$（先验均值 = 2）

数据：$n_1=111$，$\sum x_i = 217$；$n_2=44$，$\sum y_i = 66$

| | 无大学学历 θ₁ | 有大学学历 θ₂ |
|--|--------------|--------------|
| **后验** | Gamma(219, 112) | Gamma(68, 45) |
| 样本均值 | 1.95 | 1.50 |
| **后验均值** | 219/112 = **1.955** | 68/45 = **1.511** |
| 先验方差 | 2 | 2 |
| **后验方差** | 0.017 | 0.033 |

---

## 三、共轭先验汇总

| 似然（数据类型） | 共轭先验 | 后验 |
|----------------|----------|------|
| Binomial | **Beta** | Beta |
| Poisson | **Gamma** | Gamma |
| Normal | **Normal** | Normal |

> **选择共轭先验的原因**：使后验有解析形式，计算可行。（也可选非共轭先验，但需数值方法。）

---

## 四、剩余问题（后续讲次解答）

1. **如何选择先验参数** $a, b$？ → Lecture 7（共轭性）
2. **需要多少数据**才能有意义的推断？ → Lecture 8（等价样本量）

---

## 考试重点

- [ ] 能写出 Beta-Binomial 和 Gamma-Poisson 的完整共轭更新公式
- [ ] 能根据数据类型选择合适的先验（[0,1] → Beta；[0,∞) → Gamma）
- [ ] 能计算后验的均值和方差
- [ ] 知道 $U(0,1) = \text{Beta}(1,1)$，并能推导对应后验
- [ ] 理解后验均值是先验均值和样本均值的加权结合
