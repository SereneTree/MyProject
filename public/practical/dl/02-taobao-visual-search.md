# 淘宝图像搜索「拍立淘」

## 应用场景

用户在淘宝 App 中拍一张照片（或截图），系统自动识别图中商品并返回相似商品列表，支持"看到就能买"的购物体验。日均调用量超 **1 亿次**，覆盖服饰、家居、食品等全品类。

### 业务挑战

- 商品库规模：10 亿+ SKU 图片，检索延迟要求 < 200ms
- 图像多样性：用户拍照角度、光线、背景千差万别
- 细粒度识别：同一件衣服不同颜色/图案需区分；不同品牌相似款需关联
- 多主体：一张图中可能有多个商品（如穿搭照），需要先检测再识别

## 系统架构

```
用户拍照 → 图像预处理 → 主体检测（目标检测模型）
         → 特征提取（深度CNN）→ 向量化 Embedding
         → 向量检索（ANN引擎）→ 商品候选集
         → 精排（属性匹配 + 商业权重）→ 结果展示
```

## 设计思路

### 1. 主体检测：从复杂背景中"框出"商品

采用改进的 **YOLO / Faster R-CNN** 目标检测模型：

```
输入图像 → Backbone（ResNet-50）→ FPN 多尺度特征
        → RPN 生成候选框 → ROI Align → 分类 + 边框回归
```

**关键设计**：
- 针对电商场景定制了 **80+ 商品类别**（上装、裤子、鞋子、包、手表…）
- 小目标增强：FPN 底层特征保留更多细节，解决"远景拍摄小商品"问题
- 多主体返回：一张图可能返回 3~5 个商品框，用户可选择感兴趣的

### 2. 特征提取：深度度量学习

核心目标：将商品图像映射到 **128 维向量空间**，使"同款商品近、异款商品远"。

```python
# 模型结构
class ProductEncoder(nn.Module):
    def __init__(self):
        self.backbone = EfficientNet_B3(pretrained=True)
        self.neck = GeM_Pooling()       # 广义均值池化，比 GAP 更关注显著区域
        self.head = ArcFace(128, num_classes=10M)  # 大规模分类头

    def forward(self, x):
        feat = self.backbone(x)
        feat = self.neck(feat)
        embedding = F.normalize(feat, dim=1)  # L2 归一化
        return embedding
```

**训练策略**：
- **ArcFace Loss**：在角度空间添加 margin，增强类间可分性
- **对比学习预训练**：MoCo v3 在 5 亿电商图片上无监督预训练，再用 ArcFace 微调
- **难负例挖掘（Hard Negative Mining）**：每个 batch 中挑选最难区分的负样本对
- **数据增强**：随机裁剪、颜色抖动、背景替换（模拟真实拍照场景）

### 3. 向量检索：十亿级 ANN 搜索

10 亿商品 Embedding 存储与检索：

```
离线：商品图 → 模型推理 → 128维向量 → 建库（HNSW 图索引）

在线：Query 向量 → HNSW 图搜索 → Top-K 近邻 → 返回商品 ID
```

**关键技术**：
- **HNSW（Hierarchical Navigable Small World）**：多层图结构，Recall@100 > 95%，QPS 达万级
- **PQ 量化（Product Quantization）**：128 维 → 16 个子空间 × 8bit 码本，内存从 512GB 压缩到 16GB
- **分片 + 副本**：10 亿向量按品类分片，每片 3 副本，支持动态扩缩容

### 4. 精排与属性融合

向量召回的 Top-200 候选进入精排：

- **属性匹配**：颜色、材质、风格等结构化属性二次打分
- **跨模态特征**：商品标题文本 Embedding 与图像 Embedding 联合排序
- **商业因素**：商品销量、店铺评分、广告出价加权

## 技术亮点

| 维度 | 方案 | 效果 |
|------|------|------|
| 特征提取 | EfficientNet + GeM + ArcFace | 同款召回率 92%，Top-10 |
| 预训练 | MoCo v3 无监督 → ArcFace 微调 | 相比 ImageNet 预训练，mAP +5.3% |
| 向量检索 | HNSW + PQ | 10 亿库，P99 < 30ms |
| 模型压缩 | TensorRT FP16 + 动态 batch | 单卡推理 5000 QPS |
| 增量更新 | 新商品 T+1 入库，热门商品实时更新 | 新品次日可搜 |

## 工程落地关键

1. **特征一致性**：离线建库和在线 Query 必须使用完全相同的预处理流程（resize、归一化参数）
2. **模型版本管理**：模型升级时需要全量重建向量库（10 亿商品重推理），通常用 MapReduce 并行跑
3. **长尾商品**：销量极低的商品训练样本不足 → 用"类别级原型（Prototype）"替代个体 Embedding
4. **GPU 推理集群**：数千张 GPU 卡专门做在线特征提取，按流量弹性伸缩

## 面试常考点

1. **ArcFace 相比 Triplet Loss 的优势？**
   → ArcFace 在角度空间加 margin，梯度更稳定；Triplet Loss 对采样策略敏感且收敛慢

2. **为什么用 GeM Pooling 而不是 Global Average Pooling？**
   → GeM 通过可学习的幂次参数 p，在平均与最大池化之间自适应，更关注显著区域

3. **PQ 量化的原理？精度损失如何控制？**
   → 将高维向量切分为子空间，每个子空间独立量化；通过增加码本大小 / OPQ 旋转优化降低精度损失

4. **向量检索的 Recall 和延迟如何平衡？**
   → HNSW 通过调节 efSearch 参数实现 Recall-Latency trade-off；分片并行进一步降低延迟

## 参考资料

- [阿里巴巴「拍立淘」技术揭秘 (CVPR 2020 Workshop)](https://arxiv.org/abs/2003.11369)
- [ArcFace (CVPR 2019)](https://arxiv.org/abs/1801.07698)
- [HNSW 算法 (TPAMI 2020)](https://arxiv.org/abs/1603.09320)
