# Lecture 14：Gibbs 采样与迹图

> 讲师：Dr. Nivedita Viswanathan

---

## 学习目标

1. 计算多参数联合后验的全条件分布
2. 使用 Gibbs 采样处理多未知参数问题
3. 用迹图诊断马尔可夫链的收敛性

---

## 一、多参数问题的挑战

当有多个未知参数 $(\theta,\phi)$ 时，联合后验为：

$$p(\theta,\phi|Y) \propto g(\theta,\phi)$$

直接对二维分布运行 M-H 复杂，Gibbs 采样提供了更高效的方案。

---

## 二、全条件分布（Full Conditionals）

### 定义

$$p(\theta|\phi,Y) \propto p(\theta,\phi|Y) \propto g(\theta,\phi) \quad \text{（固定 }\phi\text{ 时的 }\theta\text{ 分布）}$$

$$p(\phi|\theta,Y) \propto p(\theta,\phi|Y) \propto g(\theta,\phi) \quad \text{（固定 }\theta\text{ 时的 }\phi\text{ 分布）}$$

**关键**：全条件分布正比于联合后验——只需把另一个参数当作常数即可。

---

## 三、Gibbs 采样

### 核心思想

对每个参数轮流采样：固定其他参数，从当前参数的**全条件分布**中采样。

### 算法步骤

**初始化**：选择初始值 $(\theta^{(0)},\phi^{(0)})$

**每次迭代** $t = 1,2,\dots$：

1. 从 $p(\theta|\phi^{(t-1)},Y)$ 采样 $\theta^{(t)}$
2. 从 $p(\phi|\theta^{(t)},Y)$ 采样 $\phi^{(t)}$
3. （更多参数则继续循环）

重复直到收敛；丢弃燃烧期的样本。

> Gibbs 采样是 Metropolis-Hastings 的特殊情形：在各全条件分布上运行 M-H，且每一步**总是接受**（接受率 = 1）。

---

## 四、层次模型应用：Poisson 计数数据

### 模型设定

$$Y_i|\lambda \sim \text{i.i.d. Pois}(\lambda), \quad i=1,\dots,n$$

$$\lambda|\beta \sim \text{Gamma}(\alpha,\beta) \quad (\alpha\text{ 已知})$$

$$\beta \sim \text{Gamma}(a,b) \quad (a,b\text{ 已知})$$

两个未知参数：$\lambda$ 和 $\beta$。

### 联合后验

$$p(\lambda,\beta|Y) \propto \lambda^{\sum y_i+\alpha-1}\,e^{-(n+\beta)\lambda} \times \beta^{\alpha+a-1}\,e^{-(\lambda+b)\beta}$$

### 全条件分布推导

#### $\lambda|\beta,Y$ 的全条件

固定 $\beta$，将不含 $\lambda$ 的项视为常数：

$$p(\lambda|\beta,Y) \propto \lambda^{\sum y_i+\alpha-1}\,e^{-(n+\beta)\lambda}$$

$$\boxed{\lambda|\beta,Y \sim \text{Gamma}\!\left(\sum_{i=1}^n y_i+\alpha,\; n+\beta\right)}$$

#### $\beta|\lambda,Y$ 的全条件

固定 $\lambda$，将不含 $\beta$ 的项视为常数：

$$p(\beta|\lambda,Y) \propto \beta^{\alpha+a-1}\,e^{-(\lambda+b)\beta}$$

$$\boxed{\beta|\lambda,Y \sim \text{Gamma}(\alpha+a,\; \lambda+b)}$$

### Gibbs 采样流程

```
初始化 (λ⁽⁰⁾, β⁽⁰⁾)
↓
迭代 t = 1, 2, ...:
  1. λ⁽ᵗ⁾ ~ Gamma(Σyᵢ + α,  n + β⁽ᵗ⁻¹⁾)
  2. β⁽ᵗ⁾ ~ Gamma(α + a,  λ⁽ᵗ⁾ + b)
↓
丢弃燃烧期，用剩余样本做后验分析
```

---

## 五、迹图（Trace Plot）

### 定义

对马尔可夫链 $\theta_0,\theta_1,\dots,\theta_m$，迹图以**迭代次数**为横轴、**采样值**为纵轴。

**目的**：直观判断链是否收敛到稳态分布。

### 四种典型形态

| 形态 | 特征 | 含义 | 处理方法 |
|------|------|------|---------|
| **✓ 毛毛虫** | 快速振荡，无趋势，均匀散布 | 已收敛，混合良好 | 正常使用 |
| **✗ 缓慢游走** | 缓慢移动，长段连续值 | 混合差（提议方差太小） | 增大提议方差 |
| **✗ 漂移/趋势** | 均值随迭代持续上升或下降 | 未收敛 | 增加迭代数或燃烧期 |
| **✗ 卡住/平坦** | 长段相同值，偶尔跳跃 | 链卡住（提议方差太大，接受率太低） | 减小提议方差 |

### 好的迹图特征

- 在某个水平线附近快速振荡（"dense, stationary band"）
- 无长期趋势（上升或下降）
- 混合良好（链能访问后验的不同区域）

---

## 六、其他收敛诊断方法（了解）

| 方法 | 说明 |
|------|------|
| **接受率** | 建议保持在 20%~50% 之间 |
| **自相关图（ACF）** | 滞后相关性低 → 混合好 |
| **多链比较** | 从不同起始点运行多条链，检查是否收敛到同一区域 |
| **Gelman-Rubin $\hat{R}$** | 多链方差比，$\hat{R}\approx1$ 表示收敛 |

> 本课程不要求掌握 $\hat{R}$ 的计算，了解其含义即可。

---

## 七、MCMC 完整框架回顾

```
目标：后验 p(θ|data) ∝ g(θ)（归一化常数未知）
         ↓
方法选择：
  单参数 → Metropolis-Hastings
  多参数 → Gibbs 采样（轮流对各参数的全条件分布采样）
         ↓
运行链（足够多步骤）
         ↓
诊断收敛（迹图等）
         ↓
丢弃燃烧期
         ↓
后验分析（均值、可信区间、假设检验…）
```

---

## 考试重点

- [ ] 能计算多参数模型的全条件分布（关键：固定其他参数，找分布形式）
- [ ] 能写出 Gibbs 采样的完整步骤
- [ ] 理解 Gibbs 采样与 Metropolis-Hastings 的关系（特殊情形）
- [ ] 能从联合后验推导出全条件分布（对比 Gamma 分布形式识别）
- [ ] 能识别好/坏迹图的特征，并说明对应问题和解决方案
- [ ] 理解燃烧期的目的和迹图的使用方法
