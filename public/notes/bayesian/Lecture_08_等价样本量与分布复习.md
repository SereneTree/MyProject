# Lecture 8：等价样本量与分布复习

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 评估先验相对于数据的强弱
2. 计算三种模型的等价样本量
3. 复习 Beta、Gamma、正态分布的性质

---

## 一、等价样本量（Equivalent Sample Size）

### 核心问题

> 先验包含的信息量，等价于多少个数据样本提供的信息？

**等价样本量 $n_\text{eq}$**：先验所包含的信息量，等价于大小为 $n_\text{eq}$ 的样本提供的信息量。

### 计算原理

令：**数据在先验均值处的方差 = 先验方差**，解出 n 即为 $n_\text{eq}$。

### 三种模型的 $n_\text{eq}$

#### Beta-Binomial

$$Y \sim \text{Bin}(n,\theta), \quad \theta \sim \text{Beta}(a,b)$$

$$\boxed{n_\text{eq} = a + b + 1}$$

**例**：$\theta \sim \text{Beta}(1,1)$ → $n_\text{eq} = 3$；实际样本 $n=129 \gg 3$，**先验弱，数据主导**。

#### Gamma-Poisson

$$Y \sim \text{Pois}(\mu), \quad \mu \sim \text{Gamma}(a',b')$$

$$\boxed{n_\text{eq} = b'}$$

**例**：$\mu \sim \text{Gamma}(6.25, 2.5)$ → $n_\text{eq} = 2.5$；只要收集 3 个以上数据，数据和先验影响相当。

#### Normal-Normal

$$Y_i \sim N(\mu, \sigma_0^2), \quad \mu \sim N(m, s^2)$$

$$\boxed{n_\text{eq} = \frac{\sigma_0^2}{s^2}}$$

**例**：$Y_i \sim N(\mu, 4)$，$\mu \sim N(30, 16)$ → $n_\text{eq} = 4/16 = 0.25$；仅 1 个数据点就超过先验信息量，**先验极弱**。

### 判断原则

| 比较 | 含义 |
|------|------|
| $n \gg n_\text{eq}$ | 先验弱，后验主要由数据决定 |
| $n \approx n_\text{eq}$ | 先验和数据影响相当 |
| $n \ll n_\text{eq}$ | 先验强，后验主要由先验决定（需谨慎！） |

---

## 二、Beta 分布复习

$$X \sim \text{Beta}(a,b), \quad x \in (0,1)$$

$$f(x|a,b) = \frac{\Gamma(a+b)}{\Gamma(a)\Gamma(b)}\,x^{a-1}(1-x)^{b-1}, \quad k = \frac{\Gamma(a+b)}{\Gamma(a)\Gamma(b)}$$

### 均值推导

$$E[X] = \int_0^1 x \cdot k\,x^{a-1}(1-x)^{b-1}dx = k\int_0^1 x^a(1-x)^{b-1}dx = k\cdot\frac{\Gamma(a+1)\Gamma(b)}{\Gamma(a+b+1)} = \frac{a}{a+b}$$

### 方差推导

$$E[X^2] = \frac{a(a+1)}{(a+b+1)(a+b)}, \quad \text{Var}[X] = E[X^2]-(E[X])^2 = \frac{ab}{(a+b)^2(a+b+1)}$$

### 形状参数直觉

| a vs b | 分布形状 |
|--------|---------|
| a > b | 偏向 1 |
| a < b | 偏向 0 |
| a = b | 关于 0.5 对称 |
| a = b = 1 | 均匀分布 U(0,1) |
| a, b < 1 | U 形（两端高） |

---

## 三、Gamma 分布复习

$$X \sim \text{Gamma}(a,b), \quad x \geq 0$$

$$f(x|a,b) = \frac{b^a}{\Gamma(a)}\,x^{a-1}e^{-bx}$$

### 参数含义

| 参数 | 名称 | 影响 |
|------|------|------|
| a（形状参数） | shape | a=1→指数分布；a>1→钟形曲线，a越大越对称 |
| b（率参数） | rate | b越大→分布越集中在小值处（注意：部分教材 b 为尺度参数，为率参数的倒数）|

### 均值与方差

$$E[X] = \frac{a}{b}, \qquad \text{Var}[X] = \frac{a}{b^2}$$

**推导**：

$$E[X] = \int_0^\infty x \cdot \frac{b^a}{\Gamma(a)}x^{a-1}e^{-bx}dx = \frac{b^a}{\Gamma(a)}\cdot\frac{\Gamma(a+1)}{b^{a+1}} = \frac{a}{b}$$

---

## 四、正态分布复习

$$X \sim N(\mu,\sigma^2)$$

$$f(x|\mu,\sigma^2) = \frac{1}{\sqrt{2\pi\sigma^2}}\exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)$$

### 标准化计算

要求 $p(a \leq X \leq b)$：

$$Z = \frac{X-\mu}{\sigma} \sim N(0,1)$$

$$p(a \leq X \leq b) = p\!\left(\frac{a-\mu}{\sigma} \leq Z \leq \frac{b-\mu}{\sigma}\right)$$

查标准正态表（Z表）得结果。

### 常用分位数

| 概率 | Z 值 |
|------|------|
| 90% | ±1.645 |
| **95%** | **±1.960** |
| 99% | ±2.576 |

---

## 五、Gamma 函数速记

$$\Gamma(n) = (n-1)! \quad n \in \mathbb{Z}^+$$

$$\Gamma(a) = (a-1)\Gamma(a-1) \quad \text{（递推关系）}$$

$$\Gamma(1/2) = \sqrt{\pi}$$

---

## 考试重点

- [ ] 能用公式计算三种模型的 $n_\text{eq}$ 并判断先验强弱
- [ ] 理解等价样本量的计算原理（数据方差 = 先验方差）
- [ ] 能推导 Beta 分布的均值和方差
- [ ] 能推导 Gamma 分布的均值和方差
- [ ] 能用 Z 表计算正态概率（标准化步骤）
