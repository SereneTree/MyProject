# Question 4：DFT 与频谱分析 (25 分)

## 题目

连续信号带宽为 4kHz，采样频率 fₛ = 8kHz，得到 N=16 个离散样本 x[n]。
已给出 x[n] 的时域数据和 DFT 的幅度谱、相位谱（图 3、图 4）。

(a) 求信号的 DC 值（平均值）(5分)  
(b) 连续信号包含哪些频率分量（Hz）？(10分)  
(c) 写出 x[n] 的 IDFT 表达式 (10分)

---

## 核心知识点

### 1. DFT 公式

$$X[k] = \sum_{n=0}^{N-1} x[n] e^{-j\frac{2\pi}{N}nk}, \quad k = 0, 1, \ldots, N-1$$

### 2. IDFT 公式

$$x[n] = \frac{1}{N} \sum_{k=0}^{N-1} X[k] e^{j\frac{2\pi}{N}nk}, \quad n = 0, 1, \ldots, N-1$$

### 3. 频率分辨率

$$\Delta f = \frac{f_S}{N}$$

第 k 个频率 bin 对应的模拟频率：

$$f_k = k \cdot \Delta f = k \cdot \frac{f_S}{N}$$

### 4. DC 分量

$$\text{DC value} = \frac{1}{N} \sum_{n=0}^{N-1} x[n] = \frac{X[0]}{N}$$

### 5. DFT 对称性（实信号）

对于实信号 x[n]：
- |X[k]| = |X[N-k]|（幅度对称）
- ∠X[k] = -∠X[N-k]（相位反对称）

### 6. 欧拉公式

$$\cos(\omega n) = \frac{e^{j\omega n} + e^{-j\omega n}}{2}$$

$$\sin(\omega n) = \frac{e^{j\omega n} - e^{-j\omega n}}{2j}$$

---

## 题目数据

**采样参数**：
- 带宽 fₘₐₓ = 4kHz
- 采样频率 fₛ = 8kHz
- 样本数 N = 16
- 频率分辨率 Δf = fₛ/N = 8000/16 = 500Hz

**时域信号 x[n]**：

| n | x[n] | n | x[n] |
|---|------|---|------|
| 0 | 2.0000 | 8 | 2.0000 |
| 1 | 3.5549 | 9 | -0.1407 |
| 2 | -0.4142 | 10 | 2.4142 |
| 3 | -0.4725 | 11 | 1.0583 |
| 4 | 2.0000 | 12 | -2.0000 |
| 5 | -0.4725 | 13 | 1.0583 |
| 6 | -0.4142 | 14 | 2.4142 |
| 7 | 3.5549 | 15 | -0.1407 |

**DFT 幅度谱 |X[k]|**（从图 3 读取）：

| k | |X[k]| | 对应频率 |
|---|--------|---------|
| 0 | 16 | DC (0Hz) |
| 2 | 8 | 1kHz |
| 5 | 16 | 2.5kHz |
| 11 | 16 | 5.5kHz (= 8-2.5 = 对称) |
| 14 | 8 | 7kHz (= 8-1 = 对称) |
| 其他 | 0 | — |

**DFT 相位谱 ∠X[k]**（从图 4 读取）：

| k | ∠X[k] |
|---|--------|
| 0 | 0 |
| 2 | 0 |
| 5 | -π/2 |
| 11 | π/2 |
| 14 | 0 |

---

## 详细解答

### (a) DC 值（信号平均值）(5分)

**DFT 在 k=0 处的定义**：

$$X[0] = \sum_{n=0}^{N-1} x[n] e^{-j \cdot 0} = \sum_{n=0}^{N-1} x[n]$$

（当 k=0 时，指数项为 1）

**信号平均值**：

$$\bar{x} = \frac{1}{N} \sum_{n=0}^{N-1} x[n] = \frac{X[0]}{N}$$

从幅度谱读出 |X[0]| = 16，相位为 0，所以 X[0] = 16。

$$\boxed{\text{DC value} = \frac{X[0]}{N} = \frac{16}{16} = 1}$$

---

### (b) 频率分量识别 (10分)

**频率分辨率**：

$$\Delta f = \frac{f_S}{N} = \frac{8000}{16} = 500\text{Hz}$$

**从幅度谱中找非零频率 bin**：

**k = 0**：
$$\omega = 0 \times \frac{2\pi}{16} = 0 \text{ rad/sample}$$
$$f = 0 \times 500 = 0\text{Hz (DC)}$$

**k = 2**：
$$\omega = 2 \times \frac{2\pi}{16} = \frac{\pi}{4} \text{ rad/sample}$$
$$f = 2 \times 500 = 1000\text{Hz} = 1\text{kHz}$$

**k = 5**：
$$\omega = 5 \times \frac{2\pi}{16} = \frac{5\pi}{8} \text{ rad/sample}$$
$$f = 5 \times 500 = 2500\text{Hz} = 2.5\text{kHz}$$

> 注：k=11 和 k=14 分别是 k=5 和 k=2 的共轭对称镜像（N-k），不代表独立的频率分量。

$$\boxed{f = 0\text{Hz (DC)}, \quad f = 1\text{kHz}, \quad f = 2.5\text{kHz}}$$

---

### (c) IDFT 表达式重构 x[n] (10分)

**第一步：写出 IDFT 公式**

$$x[n] = \frac{1}{N} \sum_{k=0}^{N-1} X[k] e^{j\frac{2\pi}{N}nk}$$

**第二步：从幅度和相位确定 X[k]**

$$X[k] = |X[k]| \cdot e^{j\angle X[k]}$$

非零分量：
- X[0] = 16 · e^(j·0) = 16
- X[2] = 8 · e^(j·0) = 8
- X[5] = 16 · e^(-jπ/2) = -j16
- X[11] = 16 · e^(jπ/2) = j16
- X[14] = 8 · e^(j·0) = 8

用 δ 函数表示：

$$X[k] = 16\delta[k] + 8\delta[k-2] - j16\delta[k-5] + j16\delta[k-11] + 8\delta[k-14]$$

**第三步：代入 IDFT**

$$x[n] = \frac{1}{16}\left(16 + 8e^{j\frac{2\pi}{16} \cdot 2n} - j16e^{j\frac{2\pi}{16} \cdot 5n} + j16e^{j\frac{2\pi}{16} \cdot 11n} + 8e^{j\frac{2\pi}{16} \cdot 14n}\right)$$

**第四步：利用共轭对称性化简**

注意到 k=14 对应 N-k = 16-14 = 2，k=11 对应 N-k = 16-11 = 5：

$$e^{j\frac{2\pi}{16} \cdot 14n} = e^{j\frac{2\pi}{16}(16-2)n} = e^{j2\pi n} \cdot e^{-j\frac{2\pi}{16} \cdot 2n} = e^{-j\frac{2\pi}{16} \cdot 2n}$$

$$e^{j\frac{2\pi}{16} \cdot 11n} = e^{-j\frac{2\pi}{16} \cdot 5n}$$

因此：

$$x[n] = \frac{1}{16}\left(16 + 8e^{j\frac{2\pi}{16}2n} + 8e^{-j\frac{2\pi}{16}2n} + 16e^{j(\frac{2\pi}{16}5n - \frac{\pi}{2})} + 16e^{-j(\frac{2\pi}{16}5n - \frac{\pi}{2})}\right)$$

**第五步：应用欧拉公式**

$$e^{j\theta} + e^{-j\theta} = 2\cos\theta$$

$$x[n] = 1 + \cos\left(\frac{2\pi}{16} \cdot 2n\right) + 2\cos\left(\frac{2\pi}{16} \cdot 5n - \frac{\pi}{2}\right)$$

由 cos(θ - π/2) = sin(θ)：

$$\boxed{x[n] = 1 + \cos\left(\frac{\pi}{4}n\right) + 2\sin\left(\frac{5\pi}{8}n\right)}$$

**验证**：
- DC 分量 = 1 ✓
- 频率1：ω₁ = π/4 → f₁ = (π/4)/(2π) × 8000 = 1000Hz ✓
- 频率2：ω₂ = 5π/8 → f₂ = (5π/8)/(2π) × 8000 = 2500Hz ✓
- 幅度：cos分量幅度1，sin分量幅度2 → DFT中分别为 8 和 16 ✓

---

## DFT 频谱解读方法

```
步骤 1: 确定参数
    N = 样本数, fs = 采样频率
    Δf = fs/N (频率分辨率)

步骤 2: 读幅度谱
    找出 |X[k]| ≠ 0 的 k 值
    只看 k = 0 到 N/2 (后半部分是镜像)

步骤 3: 读相位谱
    对应的 ∠X[k]

步骤 4: 组合
    X[k] = |X[k]| × e^(j∠X[k])

步骤 5: IDFT 化简
    利用共轭对称 + 欧拉公式
    得到 cos/sin 形式
```

---

## 知识点速查表

| 概念 | 公式 | 本题数值 |
|------|------|---------|
| 频率分辨率 | Δf = fₛ/N | 500Hz |
| DC 值 | X[0]/N | 16/16 = 1 |
| k→频率 | f = k × Δf | k=2→1kHz, k=5→2.5kHz |
| 共轭对称 | X[N-k] = X[k]* | k=14↔k=2, k=11↔k=5 |
| cos 重构 | 2Re{X[k]}→cos项 | 幅度8→cos幅度1 |
| sin 重构 | -2Im{X[k]}→sin项 | 幅度16→sin幅度2 |
| 相位 -π/2 | cos→sin 转换 | X[5]=-j16 → 2sin |
