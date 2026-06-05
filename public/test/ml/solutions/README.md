# 机器学习原理 (Principles of Machine Learning QHM5703) — 期末考试题目解析

> **课程**：Principles of Machine Learning QHM5703  
> **考试**：Paper A, 2024/25  
> **考官**：Dr Nikesh Bajaj, Dr Pengfei Fan  
> **时长**：2 小时，回答全部 4 道题  
> **总分**：100 分（每题 25 分）

---

## 文档索引

| 序号 | 文件 | 覆盖题目 | 核心知识点 |
|------|------|---------|-----------|
| 01 | [线性回归与MMSE](./01-linear-regression-mmse.md) | Question 1 | 设计矩阵、MMSE求解、训练MSE、过拟合、偏差-方差分解 |
| 02 | [分类器与贝叶斯](./02-classification-bayes.md) | Question 2 | 线性分类器、决策区域、混淆矩阵、贝叶斯分类器 |
| 03 | [模型优化与验证](./03-optimization-validation.md) | Question 3 | K-Means收敛、局部/全局最小值、验证集方法、模型选择 |
| 04 | [神经网络与CNN](./04-neural-networks-cnn.md) | Question 4 | 全连接层vs卷积层、平移等变性、特征图、参数计算 |

---

## 知识体系总览

```
机器学习原理 (Principles of Machine Learning)
├── 回归 (Regression)
│   ├── 线性模型: y = w₀ + w₁x
│   ├── 设计矩阵 X 与 MMSE: w = (X⊤X)⁻¹X⊤y
│   ├── 均方误差 MSE = (1/N)Σ(yᵢ - f(xᵢ))²
│   ├── 多项式模型与过拟合
│   └── 偏差-方差权衡 (Bias-Variance Tradeoff)
├── 分类 (Classification)
│   ├── 线性分类器: w⊤x = 0 决策边界
│   ├── 混淆矩阵 (Confusion Matrix)
│   │   ├── 灵敏度 Sensitivity = TP/(TP+FN)
│   │   └── 特异度 Specificity = TN/(TN+FP)
│   ├── 贝叶斯分类器
│   │   ├── 先验 P(C)、似然 P(x|C)
│   │   └── 后验 P(C|x) ∝ P(x|C)P(C)
│   └── 决策区域与决策边界
├── 模型优化 (Optimization)
│   ├── 误差函数 / 损失函数
│   ├── 局部最小值 vs 全局最小值
│   ├── K-Means 聚类与收敛
│   └── 随机重启策略
├── 模型选择与验证 (Model Selection)
│   ├── 训练误差 vs 验证误差
│   ├── 验证集方法 (Validation-set Approach)
│   ├── 泛化能力 (Generalisation)
│   └── 统计显著性
└── 神经网络 (Neural Networks)
    ├── 全连接层 (Fully-Connected)
    ├── 卷积层 (Convolutional)
    │   ├── 卷积核/滤波器
    │   ├── 特征图 (Feature Maps)
    │   └── 平移等变性 (Translation Equivariance)
    ├── 池化层 (Pooling)
    └── 参数计算
```

---

## 考试分值分布

| 题号 | 分值 | 核心考点 | 难度 |
|------|------|---------|------|
| Question 1 | 25 分 | 线性回归 MMSE 计算 + 过拟合分析 | ⭐⭐⭐ |
| Question 2 | 25 分 | 线性分类器 + 贝叶斯分类 | ⭐⭐⭐ |
| Question 3 | 25 分 | K-Means 优化 + 模型验证方法 | ⭐⭐ |
| Question 4 | 25 分 | CNN 理论 + 参数计算 | ⭐⭐⭐ |

---

## 备考建议

1. **回归计算**：熟练掌握设计矩阵构造、矩阵乘法、MMSE公式推导
2. **分类器**：画决策边界、构造混淆矩阵、计算各项指标
3. **贝叶斯**：先验/似然/后验的关系，等方差下的简化判断
4. **优化**：理解局部/全局最小值概念，K-Means随机重启策略
5. **验证**：为什么不能用训练误差评估模型（泛化能力）
6. **CNN**：参数数量计算（滤波器参数+偏置）、池化降维、深度D的含义
