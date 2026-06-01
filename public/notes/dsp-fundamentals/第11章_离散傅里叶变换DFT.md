# 第11章 离散傅里叶变换 (DFT)

## 11.1 变换体系总览

| 变换 | 域 | 定义 |
|------|-----|------|
| 拉普拉斯变换 | 连续时间 | $X(s) = \int_{-\infty}^{\infty} x(t) e^{-st} dt$ |
| 连续傅里叶变换 | 连续时间 | $X(j\Omega) = \int_{-\infty}^{\infty} x(t) e^{-j\Omega t} dt$ |
| Z变换 | 离散时间 | $X(z) = \sum_{n=-\infty}^{\infty} x[n] z^{-n}$ |
| DTFT | 离散时间 | $X(e^{j\omega}) = \sum_{n=-\infty}^{\infty} x[n] e^{-j\omega n}$ |
| **DFT** | 离散时间 | $X[k] = \sum_{n=0}^{N-1} x[n] e^{-j\frac{2\pi}{N}kn}$ |

> **关键区别**: DTFT的频域是连续的 $\omega$；DFT的频域是离散的 $k$（索引）。DFT适用于有限长序列。

## 11.2 离散傅里叶级数 (DFS)

### 11.2.1 定义

周期为 $N$ 的序列 $\tilde{x}[n] = \tilde{x}[n+N]$ 可展开为DFS:

**综合方程**: $\tilde{x}[n] = \frac{1}{N} \sum_{k=0}^{N-1} \tilde{X}[k] e^{j\frac{2\pi}{N}nk}$

**分析方程**: $\tilde{X}[k] = \sum_{n=0}^{N-1} \tilde{x}[n] e^{-j\frac{2\pi}{N}kn}$

> DFS系数也是周期的: $\tilde{X}[k+N] = \tilde{X}[k]$

### 11.2.2 DFS对

$$\tilde{x}[n] \xleftrightarrow{DFS} \tilde{X}[k]$$

### 11.2.3 周期冲激串的DFS

$$\tilde{x}[n] = \sum_{r=-\infty}^{\infty} \delta[n-rN]$$

$$\tilde{X}[k] = 1, \quad \text{对所有 } k$$

## 11.3 离散傅里叶变换 (DFT)

### 11.3.1 定义

DFT适用于**有限长序列** $x[n]$（长度为 $N$）:

**正变换 (分析方程)**:

$$X[k] = \sum_{n=0}^{N-1} x[n] e^{-j\frac{2\pi}{N}kn}, \quad 0 \leq k \leq N-1$$

**逆变换 (综合方程)**:

$$x[n] = \frac{1}{N} \sum_{k=0}^{N-1} X[k] e^{j\frac{2\pi}{N}kn}, \quad 0 \leq n \leq N-1$$

### 11.3.2 DFT与DTFT的关系

DFT是DTFT在 $\omega = \frac{2\pi k}{N}$（$k=0,1,...,N-1$）处的采样:

$$X[k] = X(e^{j\omega})|_{\omega = \frac{2\pi k}{N}}$$

## 11.4 DFT计算示例

### 11.4.1 矩形脉冲的DFT

$x[n] = 1$, $0 \leq n \leq 4$, $N = 5$

$$X[k] = \sum_{n=0}^{4} e^{-j\frac{2\pi}{5}nk} = \begin{cases}5, & k=0,\pm5,\pm10,...\\0, & \text{其他}\end{cases}$$

### 11.4.2 单位冲激的DFT

$x[n] = \delta[n]$

$$X[k] = \sum_{n=0}^{N-1} \delta[n] e^{-j\frac{2\pi}{N}kn} = 1, \quad 0 \leq k \leq N-1$$

> 单位冲激的DFT在所有频率上都是1（平坦频谱）。

### 11.4.3 常数序列的IDFT

$X[k] = N\delta[k]$

$$x[n] = \frac{1}{N} \sum_{k=0}^{N-1} N\delta[k] e^{j\frac{2\pi}{N}kn} = 1, \quad 0 \leq n \leq N-1$$

### 11.4.4 正弦信号的DFT与频率分析

**例**: $X[k] = 8\delta[k-1] + 8\delta[k-15]$，$N=16$

$$x[n] = \cos\left(\frac{2\pi}{16}n\right) = \cos\left(\frac{\pi}{8}n\right)$$

- 数字频率: $\omega = \frac{2\pi}{16} = \frac{\pi}{8}$，对应 $k=1$
- 模拟频率: $f = \frac{f_s}{16}$ Hz

**重要规律**: 在DFT中，$k$ 和 $N-k$ 处的谱线构成共轭对，对应同一频率分量。

> $X[k]$ 在 $k=1$ 和 $k=15$（即 $N-1$）处的非零值对应一个余弦分量。

### 11.4.5 带相位正弦的DFT

$X[k] = 8\delta[k-2]e^{-j\pi/2} + 8\delta[k-14]e^{j\pi/2}$，$N=16$

$$x[n] = \cos\left(\frac{2 \cdot 2\pi}{16}n - \frac{\pi}{2}\right) = \cos\left(\frac{\pi}{4}n - \frac{\pi}{2}\right)$$

- 频率对应 $k=2$
- 相位由DFT系数的相位决定

## 11.5 从DFT确定频率成分

### 11.5.1 步骤

1. 观察DFT系数 $X[k]$ 的非零位置
2. $k$ 值对应的数字频率: $\omega_k = \frac{2\pi k}{N}$
3. 对应的模拟频率: $f_k = \frac{k \cdot f_s}{N}$

### 11.5.2 频率对应规则

| $k$ 值范围 | 对应频率 |
|-----------|---------|
| $k = 0$ | DC（直流分量） |
| $1 \leq k \leq N/2-1$ | 正频率 |
| $k = N/2$ | 奈奎斯特频率 |
| $N/2+1 \leq k \leq N-1$ | 负频率（等于 $k-N$ 处的正频率） |

## 11.6 考试重点

- DFT和IDFT的定义公式
- DFT与DTFT的关系（频域采样）
- 简单序列的DFT计算（冲激、常数、矩形脉冲）
- 从DFT系数确定信号频率成分
- $k$ 值与频率的映射关系
- 共轭对称性（实信号的DFT）
- DFS与DFT的区别和联系
