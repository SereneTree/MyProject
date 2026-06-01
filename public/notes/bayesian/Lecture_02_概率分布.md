# Lecture 2：概率分布

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 识别离散和连续随机变量
2. 计算各概率分布的概率值
3. 掌握 PMF 和 PDF 的性质
4. 计算随机变量函数的期望与方差

---

## 一、随机变量

**随机变量**：取值受随机变化影响的变量；在贝叶斯推断中，是"我们作出概率陈述的未知数值量"。

### 离散 vs 连续

| 类型 | 取值 | 概率函数 |
|------|------|---------|
| **离散** | 有限个或可数无穷个 | PMF（概率质量函数）$p(x)$ |
| **连续** | 不可数无穷多个 | PDF（概率密度函数）$f(x)$ |

---

## 二、期望与方差

$$E[X] = \begin{cases} \sum_x x\,p(x) & \text{离散} \\ \int_{-\infty}^{\infty} x\,f(x)\,dx & \text{连续} \end{cases}$$

$$\text{Var}[X] = E[(X-E[X])^2] = E[X^2] - (E[X])^2$$

标准差 $\sigma_X = \sqrt{\text{Var}[X]}$

---

## 三、PMF 与 PDF 性质

### PMF 性质（离散）

1. $0 \leq p(x) \leq 1 \quad \forall x$
2. $\sum_{x \in X} p(x) = 1$
3. $p(x \in A) = \sum_{x \in A} p(x)$

### PDF 性质（连续）

1. $f(x) \geq 0$（非负）
2. $\int_{-\infty}^{\infty} f(x)\,dx = 1$
3. $p(a \leq X \leq b) = \int_a^b f(x)\,dx$（曲线下面积）
4. **注意**：$f(x)$ 不必 $\leq 1$（它不是单点的概率）
5. $p(X = a) = 0$（连续变量取单点概率为零）

---

## 四、重要分布速查

### 二项分布 Binomial(n, θ)

- **适用**：n 次独立试验，每次成功概率为 θ
- **PMF**：$p(Y=y|\theta) = \binom{n}{y}\theta^y(1-\theta)^{n-y}, \quad y \in \{0,1,\dots,n\}$
- **均值**：$E[Y|\theta] = n\theta$
- **方差**：$\text{Var}[Y|\theta] = n\theta(1-\theta)$
- **条件**：各次试验独立，成功概率恒为 θ

---

### 泊松分布 Poisson(μ)

- **适用**：单位时间/空间内事件计数（发生率恒定，n→∞，θ→0，nθ=μ 固定）
- **PMF**：$p(Y=y|\mu) = \dfrac{\mu^y e^{-\mu}}{y!}$
- **均值**：$E[Y|\mu] = \mu$
- **方差**：$\text{Var}[Y|\mu] = \mu$

> **关系**：Poisson 是 $n\to\infty, \theta\to 0, n\theta=\mu$ 时二项分布的极限情形。

---

### 均匀分布 U(a, b)

- **PDF**：$f(x) = \dfrac{1}{b-a}, \quad a \leq x \leq b$
- **均值**：$E[X] = \dfrac{a+b}{2}$
- **方差**：$\text{Var}[X] = \dfrac{(b-a)^2}{12}$

---

### Beta 分布 Beta(a, b)

- **支撑**：$x \in (0,1)$（适合建模概率/比例）
- **PDF**：$f(x|a,b) = \dfrac{\Gamma(a+b)}{\Gamma(a)\Gamma(b)}\,x^{a-1}(1-x)^{b-1}$
- **均值**：$E[X] = \dfrac{a}{a+b}$
- **方差**：$\text{Var}[X] = \dfrac{ab}{(a+b)^2(a+b+1)}$
- **特殊情况**：Beta(1,1) = U(0,1)

**形状直觉**：
- $a$ 越大 → 分布偏向 1
- $b$ 越大 → 分布偏向 0
- $a = b$ → 关于 0.5 对称

---

### 正态分布 N(μ, σ²)

- **PDF**：$f(x|\mu,\sigma^2) = \dfrac{1}{\sqrt{2\pi}\,\sigma}\exp\!\left(-\dfrac{(x-\mu)^2}{2\sigma^2}\right)$
- **均值**：$E[X] = \mu$
- **方差**：$\text{Var}[X] = \sigma^2$
- **标准正态**：$Z = \dfrac{X-\mu}{\sigma} \sim N(0,1)$
- **95% 区间**：$[\mu - 1.96\sigma,\; \mu + 1.96\sigma]$

---

### Gamma 分布 Gamma(a, b)

- **支撑**：$x \geq 0$（适合建模正数量，如均值、速率）
- **PDF**：$f(x|a,b) = \dfrac{b^a}{\Gamma(a)}\,x^{a-1}e^{-bx}$
- **均值**：$E[X] = \dfrac{a}{b}$
- **方差**：$\text{Var}[X] = \dfrac{a}{b^2}$
- **参数**：a = 形状参数，b = 率参数（注意：部分教材中 b 为尺度参数，互为倒数）
- **特殊情况**：Gamma(1, b) = 指数分布 Exp(b)

---

## 五、分布对比总表

| 分布 | 类型 | 支撑 | 均值 | 方差 | 贝叶斯中的典型用途 |
|------|------|------|------|------|--------------------|
| Bin(n,θ) | 离散 | {0,…,n} | nθ | nθ(1-θ) | 计数型数据似然 |
| Pois(μ) | 离散 | {0,1,2,…} | μ | μ | 计数型数据似然 |
| U(a,b) | 连续 | [a,b] | (a+b)/2 | (b-a)²/12 | 无信息先验 |
| Beta(a,b) | 连续 | (0,1) | a/(a+b) | — | θ∈(0,1) 的先验 |
| N(μ,σ²) | 连续 | (-∞,+∞) | μ | σ² | 连续数据似然/先验 |
| Gamma(a,b) | 连续 | (0,+∞) | a/b | a/b² | 正值参数的先验 |

---

## 六、随机变量的函数

### 离散情形

若 $Y = g(X)$，则：$p(y) = \sum_{\{x|g(x)=y\}} p(x)$

期望值规则：$E[g(X)] = \sum_x g(x)\,p(x)$

### 连续情形

期望值规则：$E[g(X)] = \int_{-\infty}^{\infty} g(x)\,f(x)\,dx$

$$\text{Var}[X] = E[(X-E[X])^2] = \int_{-\infty}^{\infty}(x-E[X])^2 f(x)\,dx$$

---

## Gamma 函数速记

$$\Gamma(c) = (c-1)! \quad (c \in \mathbb{Z}^+)$$

例：$\Gamma(5) = 4! = 24$，$\Gamma(1) = 1$，$\Gamma(1/2) = \sqrt{\pi}$

---

## 考试重点

- [ ] 能写出各分布的 PMF/PDF、均值和方差（尤其是 Beta 和 Gamma）
- [ ] 理解 PMF 和 PDF 的性质差异（PDF 可以 > 1）
- [ ] 知道 Beta(1,1) = U(0,1)，Gamma(1,b) = Exp(b)
- [ ] 能计算离散和连续随机变量的期望与方差
- [ ] 能识别问题中适合使用哪种分布
