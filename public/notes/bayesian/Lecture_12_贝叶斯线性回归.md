# Lecture 12：贝叶斯线性回归

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 推导线性回归的似然函数并解释其分解
2. 理解精度（precision）概念
3. 计算 α 和 β 的共轭后验
4. 构建斜率 β 的可信区间和假设检验
5. 推导预测分布

---

## 一、贝叶斯框架回顾

**目标**：对回归参数 $\alpha_{\bar{x}}$（截距）和 $\beta$（斜率）做贝叶斯推断。

$$y_i|x_i \sim N(\alpha_{\bar{x}}+\beta(x_i-\bar{x}),\; \sigma^2)$$

后验 ∝ 先验 × 似然，需要：
1. 似然函数 $L(\alpha_{\bar{x}},\beta)$
2. 先验分布 $p(\alpha_{\bar{x}})$，$p(\beta)$

---

## 二、似然函数的分解

### 关键结论

通过对指数中的 $Q = \sum_i[y_i-\alpha_{\bar{x}}-\beta(x_i-\bar{x})]^2$ 进行**配方**（中心化消除交叉项），样本似然**完全分解**：

$$\boxed{L_\text{sample}(\alpha_{\bar{x}},\beta) \propto \underbrace{e^{-\frac{n}{2\sigma^2}(\alpha_{\bar{x}}-A_{\bar{x}})^2}}_{L(\alpha_{\bar{x}})} \times \underbrace{e^{-\frac{SS_x}{2\sigma^2}(\beta-B)^2}}_{L(\beta)}}$$

读出两个正态核：

| 参数 | 似然中心 | 似然方差 |
|------|---------|---------|
| $\alpha_{\bar{x}}$ | $A_{\bar{x}} = \bar{y}$ | $\sigma^2/n$ |
| $\beta$ | $B = SS_{xy}/SS_x$ | $\sigma^2/SS_x$ |

> **为何可以分解**：以 $\bar{x}$ 为中心后，$\sum(x_i-\bar{x}) = 0$，消除了 α 和 β 的交叉项。  
> **实际意义**：可以**独立**对 α 和 β 做贝叶斯更新。

---

## 三、先验分布

选择独立的正态共轭先验：

$$\alpha_{\bar{x}} \sim N(m_\alpha, s_\alpha^2), \qquad \beta \sim N(m_\beta, s_\beta^2)$$

---

## 四、精度（Precision）

**精度** $\tau = 1/\sigma^2$（方差的倒数）

- 精度大 → 分布窄 → 不确定性小

**正态-正态更新的精度加法规则**：

$$\underbrace{\tau_\text{后验}}_{\text{posterior}} = \underbrace{\tau_\text{先验}}_{\text{prior}} + \underbrace{\tau_\text{数据}}_{\text{data}}$$

---

## 五、后验分布

### 截距 $\alpha_{\bar{x}}$ 的后验

$$\tau_\text{prior} = \frac{1}{s_\alpha^2}, \quad \tau_\text{data} = \frac{n}{\sigma^2}$$

$$s'^2_\alpha = \frac{1}{\tau_\text{prior}+\tau_\text{data}} = \frac{1}{1/s_\alpha^2 + n/\sigma^2}$$

$$m'_\alpha = s'^2_\alpha \left(\frac{n A_{\bar{x}}}{\sigma^2} + \frac{m_\alpha}{s_\alpha^2}\right)$$

### 斜率 $\beta$ 的后验

$$\tau_\text{prior} = \frac{1}{s_\beta^2}, \quad \tau_\text{data} = \frac{SS_x}{\sigma^2}$$

$$s'^2_\beta = \frac{1}{1/s_\beta^2 + SS_x/\sigma^2}$$

$$m'_\beta = s'^2_\beta\left(\frac{SS_x\,B}{\sigma^2}+\frac{m_\beta}{s_\beta^2}\right)$$

**后验均值 = 精度加权平均**：

$$m'_\beta = \frac{\tau_\text{data}}{\tau_\text{prior}+\tau_\text{data}}\,B + \frac{\tau_\text{prior}}{\tau_\text{prior}+\tau_\text{data}}\,m_\beta$$

---

## 六、数值例题：水分含量数据

已知：$B=3.1536$，$A_{\bar{x}}=\bar{y}=14.21$，$\sigma^2=0.03998$，$n=5$，$SS_x=0.03028$

先验：$\alpha_{\bar{x}}\sim N(15,1)$，$\beta\sim N(1,0.09)$

#### 截距 α 的后验

$$\tau_\text{data}^\alpha = 5/0.03998 \approx 125.06, \quad \tau_\text{prior}^\alpha = 1/1 = 1.00$$

$$s'^2_\alpha = 1/(1.00+125.06) \approx 0.00793$$

$$m'_\alpha = 0.00793\times(125.06\times14.21+1.00\times15) \approx 14.216$$

→ $\alpha_{\bar{x}}|\text{data} \sim N(14.216,\; 0.00793)$（数据精度远大于先验，后验集中在 $\bar{y}$）

#### 斜率 β 的后验

$$\tau_\text{data}^\beta = 0.03028/0.03998 \approx 0.757, \quad \tau_\text{prior}^\beta = 1/0.09 \approx 11.11$$

$$s'^2_\beta = 1/(11.11+0.757) \approx 0.0843, \quad s'_\beta \approx 0.290$$

$$m'_\beta = 0.0843\times(0.757\times3.1536+11.11\times1.00) \approx 1.137$$

→ $\beta|\text{data} \sim N(1.137,\; 0.0843)$（先验精度远大于数据精度，仅 5 个点，先验主导）

---

## 七、斜率 β 的推断

### 可信区间

$$m'_\beta \pm z_{1-s/2} \cdot s'_\beta$$

**例（95% CI）**：$1.137 \pm 1.96\times0.290 = [0.569,\; 1.706]$

> β 在 95% 概率下位于 [0.57, 1.71]（过程水分每增加 1 单位，最终水分增加 0.57~1.71）

### 单侧检验

$H_0: \beta \leq \beta_0$ vs $H_1: \beta > \beta_0$

$$P(\beta \leq \beta_0|\text{data}) = P\!\left(Z \leq \frac{\beta_0-m'_\beta}{s'_\beta}\right)$$

若 < α 则拒绝 $H_0$。

### 双侧检验（是否存在线性关系）

$H_0: \beta = 0$ vs $H_1: \beta \neq 0$

使用 95% 可信区间 $[a,b]$：
- $0 \notin [a,b]$ → 拒绝 $H_0$，存在线性关系 ✓
- $0 \in [a,b]$ → 不拒绝 $H_0$，线性模型可能不适合

**例**：$[0.569, 1.706]$ 不包含 0 → **拒绝** $H_0$，确认存在正向线性关系。

---

## 八、预测分布

### 问题

已知新预测值 $x_{n+1}$，预测响应 $y_{n+1}$。

### 不确定性来源

1. **参数不确定性**：$\alpha_{\bar{x}},\beta$ 未知（用后验描述）
2. **观测噪声**：即使知道参数，$y_{n+1}$ 仍围绕均值随机散布（$e_{n+1}\sim N(0,\sigma^2)$）

### 预测分布

$$\boxed{f(y_{n+1}|x_{n+1},\text{data}) \sim N(m'_\mu,\; s'^2_\mu+\sigma^2)}$$

其中：
$$m'_\mu = m'_\alpha + m'_\beta(x_{n+1}-\bar{x}) \quad\text{（预测均值）}$$
$$s'^2_\mu = s'^2_\alpha + s'^2_\beta(x_{n+1}-\bar{x})^2 \quad\text{（参数不确定性）}$$

**预测方差 = 参数不确定性 $s'^2_\mu$ + 不可消除的观测噪声 $\sigma^2$**

> 预测区间总比均值的可信区间更宽，因为多了 $\sigma^2$ 这一不可消除的成分。

### 预测例题：第 6 批次

$x_6 = 14.50$，$x_6 - \bar{x} = 0.052$

$$m'_\mu = 14.216 + 1.137\times0.052 = 14.275$$

$$s'^2_\mu = 0.00793 + 0.0843\times(0.052)^2 = 0.00816$$

预测方差 $= 0.00816 + 0.03998 = 0.04814$，预测标准差 $\approx 0.219$

**95% 预测区间**：$14.275 \pm 1.96\times0.219 = [13.85,\; 14.70]$

不确定性分解：参数不确定性占 17%，观测噪声占 **83%**（不可消除！）

---

## 考试重点

- [ ] 理解似然分解（中心化消除交叉项）的意义
- [ ] 能用精度加法公式计算后验方差和均值
- [ ] 能判断数据精度和先验精度哪个主导后验
- [ ] 能构建斜率 β 的 95% 可信区间并执行双侧检验
- [ ] 能计算预测均值和预测方差，构建预测区间
- [ ] 理解预测方差 = 参数不确定性 + 观测噪声
