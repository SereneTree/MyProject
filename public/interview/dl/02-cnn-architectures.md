# 卷积神经网络 CNN

## 考点概览

| 考点 | 重要度 | 考法 |
|------|--------|------|
| 卷积运算与参数计算 | ⭐⭐⭐⭐⭐ | 手算输出尺寸、参数量 |
| 感受野计算 | ⭐⭐⭐⭐ | 给定网络结构求感受野 |
| 经典网络设计思想 | ⭐⭐⭐⭐⭐ | VGG/ResNet/Inception 设计动机 |
| 池化层 | ⭐⭐⭐ | MaxPool vs AvgPool、作用 |
| 1×1 卷积 | ⭐⭐⭐⭐ | 多种用途 |
| 深度可分离卷积 | ⭐⭐⭐⭐ | MobileNet 核心思想、计算量对比 |
| 空洞卷积 | ⭐⭐⭐ | 扩大感受野但不降分辨率 |
| 转置卷积 | ⭐⭐⭐ | 上采样原理、棋盘效应 |

---

## 一、卷积运算

### 基本公式

```
输出尺寸 = (W - K + 2P) / S + 1

W = 输入宽度
K = 卷积核大小
P = Padding
S = Stride
```

### 参数量与计算量

```
参数量 = K × K × C_in × C_out + C_out（bias）
计算量（FLOPs）= K × K × C_in × C_out × H_out × W_out
```

**示例**：输入 224×224×3，64 个 3×3 卷积核，stride=1, padding=1
- 输出尺寸：(224 - 3 + 2) / 1 + 1 = 224，即 224×224×64
- 参数量：3×3×3×64 + 64 = 1,792
- FLOPs：3×3×3×64×224×224 ≈ 87M

### 卷积的三个核心性质

| 性质 | 含义 | 好处 |
|------|------|------|
| 局部连接 | 每个输出只看输入的一小块 | 参数量远小于全连接 |
| 权重共享 | 同一个 kernel 滑过整张图 | 进一步减少参数，平移等变性 |
| 平移等变性 | 目标平移 → 特征图等量平移 | 不需要为每个位置单独学习 |

---

## 二、感受野

### 递推公式

```
RF_l = RF_{l-1} + (K_l - 1) × ∏_{i=1}^{l-1} S_i
```

### 计算示例（VGG 前 5 层）

```
Layer 1: 3×3, s=1 → RF = 3
Layer 2: 3×3, s=1 → RF = 3 + (3-1)×1 = 5
Layer 3: 3×3, s=1 → RF = 5 + (3-1)×1 = 7
Pool:    2×2, s=2 → RF = 7 + (2-1)×1 = 8
Layer 4: 3×3, s=1 → RF = 8 + (3-1)×2 = 12
```

### 核心结论

- **两个 3×3 卷积** 等效感受野 = 一个 5×5 卷积，但参数少 `2×(3²C²) < 1×(5²C²)`
- **三个 3×3** = 一个 7×7，这是 VGG 的核心设计思想
- 增大感受野的方法：更多层 / 更大 stride / 池化 / 空洞卷积

---

## 三、经典网络架构

### AlexNet (2012) — 开创性

- 5 层卷积 + 3 层全连接
- 首次使用 ReLU + Dropout + GPU 训练
- 分组卷积（受限于 GPU 显存）

### VGGNet (2014) — 深度提升

- **核心思想**：用连续小卷积（3×3）替代大卷积
- 为什么：同等感受野，参数更少，非线性更多
- 缺点：参数量仍很大（138M），全连接层占比高

### GoogLeNet / Inception (2014) — 多尺度

```
Inception Module:
        ┌── 1×1 conv ───────────────┐
Input ──┼── 1×1 → 3×3 conv ────────┼── Concat → Output
        ├── 1×1 → 5×5 conv ────────┤
        └── 3×3 pool → 1×1 conv ───┘
```

- **核心思想**：同一层用不同尺寸卷积并行，拼接得到多尺度特征
- 1×1 卷积做瓶颈降维，控制计算量

### ResNet (2015) — ⭐ 最高频考点

```python
# 残差块
def residual_block(x):
    identity = x
    out = conv_bn_relu(x)
    out = conv_bn(out)
    out = out + identity    # shortcut 连接
    out = relu(out)
    return out
```

**为什么 ResNet 能训练很深？**

1. **梯度直通**：∂L/∂x = ∂L/∂F · ∂F/∂x + ∂L/∂x（identity 梯度恒为 1）
2. **退化问题解决**：极端情况下 F(x)→0，网络退化为恒等映射，至少不会比浅网络差
3. **学习残差更容易**：学习"在恒等基础上的微小修正"比直接学习映射容易

**ResNet 变体**：
- Pre-activation ResNet：BN → ReLU → Conv（梯度更顺畅）
- ResNeXt：组卷积 + 残差 = 分组聚合变换
- SE-ResNet：加 Squeeze-and-Excitation 通道注意力

### MobileNet (2017) — 轻量化

```
标准卷积：K×K×C_in×C_out → FLOPs = K²·C_in·C_out·H·W

深度可分离卷积 = Depthwise + Pointwise：
  Depthwise: K×K×1×C_in → 每通道独立卷积
  Pointwise: 1×1×C_in×C_out → 跨通道融合
  
FLOPs = K²·C_in·H·W + C_in·C_out·H·W
压缩比 ≈ 1/C_out + 1/K² ≈ 1/9（3×3 卷积）
```

---

## 四、池化层

### MaxPool vs AvgPool

| 类型 | 公式 | 特点 | 适用场景 |
|------|------|------|---------|
| Max Pooling | 取区域最大值 | 保留最显著特征 | 分类任务（关注有无特征） |
| Average Pooling | 取区域均值 | 平滑、保留背景信息 | 语义分割、最后的 GAP 层 |
| Global Average Pooling | 整张特征图取均值 | 替代全连接层 | 减少参数量、防过拟合 |

### GAP 替代全连接层

```
传统：7×7×512 → Flatten → FC(25088, 4096) → FC(4096, 1000)
     参数量：~100M

GAP：7×7×512 → GAP → 1×1×512 → FC(512, 1000)
     参数量：~0.5M
```

---

## 五、特殊卷积

### 空洞卷积（Dilated Convolution）

```
等效卷积核大小 = K + (K-1) × (d-1)

d=1: 标准 3×3 → 感受野 3
d=2: 膨胀 3×3 → 感受野 5
d=4: 膨胀 3×3 → 感受野 9
```

- **优势**：不增加参数量、不降低分辨率，扩大感受野
- **应用**：语义分割（DeepLab）、语音处理（WaveNet）
- **问题**：网格效应（信息采样不均匀）→ 解决：混合 dilation rate

### 转置卷积（Transposed Convolution）

- 作用：上采样（恢复空间分辨率）
- 原理：将标准卷积运算反过来（乘以转置矩阵）
- **棋盘效应**：stride > 1 时重叠区域不均匀 → 解决：使用 resize + conv 替代

---

## 六、现代 CNN 设计趋势

| 阶段 | 代表 | 关键创新 |
|------|------|---------|
| 更深 | VGG, ResNet | 小卷积堆叠、残差连接 |
| 更宽 | GoogLeNet, WideResNet | 多分支并行、宽度 > 深度 |
| 注意力 | SENet, CBAM | 通道/空间注意力加权 |
| 轻量化 | MobileNet, ShuffleNet | 深度可分离/通道洗牌 |
| AutoML | EfficientNet, NAS | 网络架构搜索自动化 |
| 混合 | ConvNeXt | 用纯卷积复刻 Transformer 设计理念 |

---

## 速答 6 道

**Q1：为什么 VGG 用连续 3×3 而不是一个 7×7？**

→ 三个 3×3 感受野等于 7×7，但参数量 3×(9C²) = 27C² 远小于 49C²；且多层非线性增强了表达能力。

**Q2：ResNet 的 shortcut 有几种？什么时候用哪种？**

→ Identity shortcut（维度相同直接相加）和 Projection shortcut（1×1 卷积调整维度）；维度变化时用 projection，否则用 identity。

**Q3：1×1 卷积有哪些用途？**

→ ①通道降维/升维（bottleneck）②跨通道信息融合 ③增加非线性（后接 ReLU）④Network-in-Network 思想。

**Q4：深度可分离卷积如何节省计算量？**

→ 拆为 Depthwise（每通道独立空间卷积）+ Pointwise（1×1 跨通道融合），计算量约为标准卷积的 1/K² + 1/C_out ≈ 1/8~1/9。

**Q5：Batch Normalization 放在激活函数前还是后？**

→ 原始论文放在激活前（Conv → BN → ReLU），实践中两种都有效。ResNet v2（Pre-activation）采用 BN → ReLU → Conv，梯度更顺畅。

**Q6：Global Average Pooling 相比全连接层的优势？**

→ 大幅减少参数（避免全连接百万级参数）；增强空间鲁棒性；天然正则化效果，减少过拟合。
