# Lecture 11：线性回归

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 识别预测变量 x 和响应变量 y
2. 推导法方程并求最小二乘线
3. 计算回归线周围的方差
4. 陈述线性回归的三大假设
5. 写出数据的概率模型

---

## 一、问题背景

**核心问题**：能否用 x 预测 y？

- **x**（预测变量，predictor）：已知，假设无误差测量
- **y**（响应变量，response）：待预测，依赖 x 并含随机误差

数据表示：n 对观测 $(x_i, y_i)$，$i=1,\dots,n$

---

## 二、最小二乘法

### 残差与目标

**残差**：第 i 个观测点到拟合线的垂直距离 $e_i = y_i - \hat{y}_i$

**目标**：求 $\alpha_0, \beta$ 使残差平方和最小：

$$\min_{\alpha_0,\beta}\; SS_\text{res} = \sum_{i=1}^n \left[y_i - (\alpha_0 + \beta x_i)\right]^2$$

### 法方程（Normal Equations）

对 $\alpha_0$ 和 $\beta$ 分别求偏导，令其为零：

$$\bar{y} - A_0 - B\bar{x} = 0 \quad (1)$$

$$\overline{xy} - A_0\bar{x} - B\overline{x^2} = 0 \quad (2)$$

其中 $\bar{x}=\frac{1}{n}\sum x_i$，$\bar{y}=\frac{1}{n}\sum y_i$，$\overline{xy}=\frac{1}{n}\sum x_iy_i$，$\overline{x^2}=\frac{1}{n}\sum x_i^2$

### 最小二乘估计

$$\boxed{B = \frac{\overline{xy}-\bar{x}\bar{y}}{\overline{x^2}-\bar{x}^2} = \frac{SS_{xy}}{SS_x}, \qquad A_0 = \bar{y} - B\bar{x}}$$

其中 $SS_{xy} = \sum(x_i-\bar{x})(y_i-\bar{y})$，$SS_x = \sum(x_i-\bar{x})^2$

### 以 $\bar{x}$ 为中心的等价形式

$$L:\; y = A_{\bar{x}} + B(x-\bar{x}), \qquad A_{\bar{x}} = \bar{y}$$

**最小二乘线必过点 $(\bar{x},\bar{y})$**。

> **中心化形式**：将线写成 $y = \bar{y} + B(x-\bar{x})$ 形式，在做贝叶斯分析时能使截距和斜率的似然分离（见 Lecture 12）。

---

## 三、方差估计

$$\boxed{\hat\sigma^2 = \frac{\sum_{i=1}^n [y_i - \hat{y}_i]^2}{n-2}}$$

- 分母 $n-2$：估计了 2 个参数（$\alpha_0$ 和 $\beta$），损失 2 个自由度
- $\hat{y}_i = A_{\bar{x}} + B(x_i - \bar{x})$：第 i 个拟合值

---

## 四、数值例题：食品水分含量

| 批次 | x（过程水分） | y（最终水分） |
|------|-------------|-------------|
| 1 | 14.36 | 13.84 |
| 2 | 14.48 | 14.41 |
| 3 | 14.53 | 14.22 |
| 4 | 14.52 | 14.63 |
| 5 | 14.35 | 13.95 |

计算汇总统计量：$\bar{x}=14.448$，$\bar{y}=14.21$，$SS_{xy}=0.01910$，$SS_x=0.00606$

$$B = \frac{0.01910}{0.00606} \approx 3.1536, \qquad A_0 = 14.21 - 3.1536\times14.448 \approx -31.36$$

$$\hat\sigma^2 \approx 0.03998 \quad \text{（由残差计算）}$$

---

## 五、风险分析案例：道路死亡率与温度

**发现**：回归斜率 B ≈ 0.040 > 0（温度越高，死亡率越高）

**直觉上矛盾**！原因分析：
- 夏天行驶里程更多（已按里程标准化，但其他因素仍存在）
- 温度不直接导致事故，而是通过驾驶行为等变量间接影响

> **重要警示**：回归线在数学上正确，但必须结合实际情境解读，不能仅凭数学正确就推导因果关系。**均值假设必须有实质意义支撑。**

---

## 六、三大假设

### 假设 1：均值假设（Linearity）

给定 x，y 的条件均值是 x 的**线性函数**：

$$\mu_{y|x} = \alpha_{\bar{x}} + \beta(x-\bar{x})$$

- **作用**：支撑拟合直线（而非曲线）的合理性

### 假设 2：误差假设（Normality & Homoscedasticity）

$$e_i \sim N(0,\sigma^2) \quad (\text{独立同分布})$$

- 均值为 0：无系统性偏差
- 方差相同 $\sigma^2$：同方差性（homoscedasticity）
- **作用**：确定误差的分布形状，使得可以写出似然函数

### 假设 3：独立假设（Independence）

误差 $e_1,\dots,e_n$ 相互独立。

- **作用**：使联合似然等于各个似然的乘积

---

## 七、概率模型

结合三大假设，得到完整的概率模型：

$$y_i = \alpha_{\bar{x}} + \beta(x_i-\bar{x}) + e_i, \quad e_i \sim N(0,\sigma^2)$$

$$\boxed{y_i|x_i \sim N\!\left(\alpha_{\bar{x}}+\beta(x_i-\bar{x}),\; \sigma^2\right), \quad \text{相互独立}}$$

| 参数 | 含义 |
|------|------|
| $\alpha_{\bar{x}}$ | $x=\bar{x}$ 时 y 的期望值（中心处截距） |
| $\beta$ | x 每增加 1 单位，y 的期望变化量（斜率） |
| $\sigma^2$ | 数据围绕回归线的散布（残差噪声） |

**贝叶斯设定中**：$\alpha_{\bar{x}}$ 和 $\beta$ 是**未知随机变量**，需要赋予先验分布并用数据更新（见 Lecture 12）。

---

## 考试重点

- [ ] 能用最小二乘公式计算斜率 B 和截距
- [ ] 能计算方差估计 $\hat\sigma^2$（注意分母是 n-2）
- [ ] 能陈述三大假设及其各自的作用
- [ ] 能写出概率模型 $y_i|x_i \sim N(\alpha_{\bar{x}}+\beta(x_i-\bar{x}),\sigma^2)$
- [ ] 理解"回归线数学正确"不等于"因果关系成立"
