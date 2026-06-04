# 百度 Apollo 自动驾驶感知系统

## 应用场景

百度 Apollo 自动驾驶平台为 Robotaxi（萝卜快跑）提供 L4 级感知能力：车辆需在城市复杂路况中实时检测周围的行人、车辆、交通标志、车道线等，做出安全驾驶决策。感知系统每秒处理来自 **6 个摄像头 + 1 个 128 线激光雷达 + 5 个毫米波雷达** 的海量数据。

### 业务挑战

- 安全性极高：漏检一个行人可能致命，要求检测召回率 > 99.9%
- 实时性强：端到端延迟 < 100ms（感知 + 决策 + 控制全链路）
- 多传感器融合：相机、LiDAR、Radar 数据格式完全不同，需统一理解
- 极端场景：夜晚、暴雨、逆光、遮挡等长尾场景必须覆盖

## 系统架构

```
传感器输入
├── 6 × Camera (1920×1080, 30fps)  → 2D 检测 + 语义分割
├── 1 × LiDAR (128线, 10fps)       → 3D 点云检测
└── 5 × Radar                       → 速度估计

→ 时空同步（硬件时间戳 + 外参标定）
→ 多模态融合（BEV 空间）
→ 3D 目标输出（位置、尺寸、朝向、速度、类别、跟踪 ID）
→ 下游：预测模块 → 规划模块
```

## 设计思路

### 1. 点云 3D 目标检测：PointPillars → CenterPoint

**PointPillars** 将无序点云转为伪图像，再用 2D 卷积检测：

```
原始点云 → 体素化（Pillar 柱体）→ PointNet 编码每个 Pillar
         → 散射为 BEV 伪图像 → 2D Backbone（ResNet）
         → Detection Head → 3D BBox
```

进阶方案 **CenterPoint**：

```python
# CenterPoint 核心思想：Anchor-Free
# 在 BEV 视角下，将每个目标建模为一个"中心点"
# 不需要预定义 Anchor，直接回归：
#   - 中心点热力图（分类）
#   - 中心偏移（亚像素精度）
#   - 目标尺寸 (l, w, h)
#   - 朝向角 (yaw)
#   - 速度 (vx, vy)

class CenterPointHead(nn.Module):
    def forward(self, bev_features):
        heatmap = self.hm_head(bev_features)    # [B, C, H, W] 类别热力图
        offset = self.offset_head(bev_features)  # [B, 2, H, W]
        size = self.size_head(bev_features)      # [B, 3, H, W]
        rot = self.rot_head(bev_features)        # [B, 2, H, W] sin/cos
        vel = self.vel_head(bev_features)        # [B, 2, H, W]
        return heatmap, offset, size, rot, vel
```

**技术亮点**：
- Anchor-Free 设计避免了大量超参数调优（anchor 尺寸、比例、IoU 阈值）
- 在 BEV 空间下检测，天然适配下游规划模块（也在 BEV 下工作）
- 两阶段 refine：第一阶段 CenterPoint 检出 → 第二阶段用点云特征二次精修框

### 2. 多模态 BEV 融合：BEVFusion

将相机图像和 LiDAR 点云统一投影到 **BEV（Bird's Eye View）** 空间：

```
Camera 分支：
  6 张图像 → 2D Backbone (Swin-T) → 2D 特征 F_img
  → LSS / BEVFormer 将 2D 特征"提升"到 3D BEV 空间

LiDAR 分支：
  点云 → VoxelNet / PointPillars → BEV 特征 F_lidar

融合：
  F_bev = Conv(Concat(F_img_bev, F_lidar_bev))
  → 共享检测头输出 3D 目标
```

**为什么统一到 BEV？**
- BEV 下物体没有遮挡和透视形变，尺度一致
- 方便与高精地图对齐（地图也是 BEV 表示）
- 融合后相机弥补 LiDAR 的纹理/颜色缺失，LiDAR 弥补相机的深度不确定性

### 3. 时序融合与目标跟踪

单帧检测不够 → 多帧时序信息提升稳定性：

```
t-2 帧 BEV 特征 ──┐
t-1 帧 BEV 特征 ──┼── 时序对齐（自车运动补偿）→ Temporal Conv → 当前帧增强特征
t   帧 BEV 特征 ──┘
```

**跟踪方案**：
- 基于 CenterPoint 的跟踪：匹配相邻帧的中心点（匈牙利算法 + 运动预测）
- 输出连续的 Track ID，为下游预测模块提供轨迹历史

### 4. 安全冗余设计

- **多模型投票**：主模型 + 轻量安全校验模型，两者不一致时触发紧急制动
- **传感器故障降级**：LiDAR 故障时切换为纯视觉模式（精度降级但不停车）
- **置信度校准**：使用 Temperature Scaling 确保模型输出的置信度反映真实概率

## 技术亮点

| 维度 | 方案 | 效果 |
|------|------|------|
| 3D 检测 | CenterPoint (Anchor-Free) | 车辆 mAP 72.3%（nuScenes） |
| 多模态融合 | BEVFusion（统一 BEV 空间） | 相比纯 LiDAR +4.2% mAP |
| 时序建模 | BEV 时序对齐 + Temporal Conv | 远距离目标召回 +8.7% |
| 推理延迟 | TensorRT + 多流水线并行 | 全套感知 < 60ms（Orin 平台） |
| 安全保障 | 双模型冗余 + 传感器降级 | 误检率 < 0.01% |

## 工程落地关键

1. **传感器标定**：6 相机 + LiDAR 的联合外参标定精度直接影响融合质量，百度使用自动标定 pipeline
2. **车端计算平台**：NVIDIA Orin (254 TOPS) 或自研昆仑芯片，功耗 < 80W
3. **数据闭环**：
   - 难例场景自动触发数据回传（Edge Case Mining）
   - 仿真引擎生成稀缺场景（暴雨、事故、施工）
4. **模型量化部署**：FP32 训练 → INT8 量化 + Layer Fusion，保证车端实时运行
5. **OTA 更新**：模型按版本灰度发布，新版本先在影子模式（不控车）验证 3 天

## 面试常考点

1. **PointPillars vs VoxelNet vs PointNet++ 的优劣？**
   → PointPillars 用 2D 卷积快但丢失高度信息；VoxelNet 3D 卷积精度高但慢；PointNet++ 点级别处理精度最高但不可扩展

2. **BEV 融合相比后融合（Late Fusion）的优势？**
   → BEV 空间统一度量，几何对齐更自然；Late Fusion 在检测结果层面融合，无法互补底层特征

3. **自动驾驶感知对延迟有多敏感？**
   → 100km/h 时每延迟 100ms，车辆多行驶 2.78m；端到端必须 < 200ms，感知 budget 一般 < 80ms

4. **如何处理自动驾驶的长尾问题？**
   → 数据闭环（难例挖掘 + 仿真数据）+ 多任务联合训练增强泛化 + 安全冗余兜底

## 参考资料

- [CenterPoint (CVPR 2021)](https://arxiv.org/abs/2006.11275)
- [BEVFusion (ICRA 2023)](https://arxiv.org/abs/2205.13542)
- [PointPillars (CVPR 2019)](https://arxiv.org/abs/1812.05784)
- [百度 Apollo 开源平台](https://github.com/ApolloAuto/apollo)
