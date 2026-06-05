# DSP基础 (Fundamentals of DSP QHE5107) — 期末考试题目解析与知识点讲解

> **课程**：Fundamentals of DSP QHE5107  
> **考试**：Paper A, 2024/25  
> **考官**：Dr Fabrício de Oliveira Ourique, Dr Jesús Requena Carrion  
> **时长**：3 小时，回答全部 4 道题  
> **总分**：100 分（每题 25 分）

---

## 文档索引

| 序号 | 文件 | 覆盖题目 | 核心知识点 |
|------|------|---------|-----------|
| 01 | [离散时间系统分析](./01-discrete-time-system.md) | Question 1 | 卷积、冲激响应、LTI判断、因果性、稳定性 |
| 02 | [采样与滤波器设计](./02-sampling-filter-design.md) | Question 2 | 奈奎斯特采样、带阻滤波器、零点设计 |
| 03 | [递归系统与频率响应](./03-recursive-system-frequency-response.md) | Question 3 | 递归/非递归、系统函数H(z)、FIR/IIR、频率响应 |
| 04 | [DFT与频谱分析](./04-dft-spectrum-analysis.md) | Question 4 | DFT公式、DC分量、频率分辨率、IDFT重构 |

---

## 知识体系总览

```
数字信号处理 (Digital Signal Processing)
├── 离散时间信号与系统
│   ├── 信号分类（因果/非因果）
│   ├── 系统性质
│   │   ├── 线性 (Linearity)
│   │   ├── 时不变性 (Time-Invariance)
│   │   ├── 因果性 (Causality): h[n]=0, n<0
│   │   └── 稳定性 (BIBO Stability): Σ|h[n]| < ∞
│   ├── 卷积 (Convolution): y[n] = x[n] * h[n]
│   └── 冲激响应 (Impulse Response)
├── 采样理论
│   ├── 奈奎斯特定理: fs > 2fmax
│   ├── 混叠 (Aliasing)
│   └── ADC/DAC 转换
├── Z 变换与系统函数
│   ├── 系统函数 H(z) = Y(z)/X(z)
│   ├── 零点与极点
│   ├── FIR vs IIR
│   └── 递归 vs 非递归
├── 频率响应
│   ├── H(e^jω) = H(z)|z=e^jω
│   ├── 滤波器类型（LP/HP/BP/BS）
│   └── 极点/零点与频率响应的关系
├── 滤波器设计
│   ├── 带阻滤波器（陷波器）
│   ├── 零点放置策略
│   └── 数字频率与模拟频率转换
└── DFT/IDFT
    ├── DFT 公式: X[k] = Σx[n]e^(-j2πnk/N)
    ├── IDFT 公式: x[n] = (1/N)ΣX[k]e^(j2πnk/N)
    ├── DC 分量: X[0]/N
    ├── 频率分辨率: Δf = fs/N
    └── 频谱对称性
```

---

## 考试分值分布

| 题号 | 分值 | 核心考点 | 难度 |
|------|------|---------|------|
| Question 1 | 25 分 | 系统分析（LTI/因果/稳定） | ⭐⭐⭐ |
| Question 2 | 25 分 | 采样定理 + 滤波器设计 | ⭐⭐⭐⭐ |
| Question 3 | 25 分 | 系统函数 + 频率响应计算 | ⭐⭐⭐ |
| Question 4 | 25 分 | DFT 频谱分析 + IDFT 重构 | ⭐⭐⭐⭐ |

---

## 备考建议

1. **系统性质判断**（Q1）：牢记 LTI/因果/稳定的判据和反例构造
2. **采样与滤波器设计**（Q2）：掌握数字频率 ω = 2πf/fs 的转换，零点放置法消除干扰
3. **Z变换与系统函数**（Q3）：部分分式展开 + 极点位置判断滤波器类型
4. **DFT/IDFT**（Q4）：掌握频谱解读（幅度+相位→频率成分），IDFT 时域重构
