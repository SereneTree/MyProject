# 微信语音转文字引擎

## 应用场景

微信的「语音转文字」功能每天为数十亿条语音消息提供实时转写服务。用户长按语音消息即可一键转文字，覆盖普通话、粤语、英语等多语种，支持方言口音、噪声环境、代码切换（中英混合）等复杂场景。

### 业务挑战

- 超大规模：日均数十亿次调用，峰值 QPS 达百万级
- 低延迟：用户期望"秒出"，端到端延迟 < 300ms（含网络传输）
- 高准确率：日常对话 WER（词错误率）需 < 5%
- 多样性：方言、口音、噪声、远场、中英混合等长尾场景
- 端侧推理：部分场景需要在手机本地完成（无网络/弱网环境）

## 系统架构

```
语音输入（PCM/Opus）
→ 前端处理（VAD + 降噪 + 分段）
→ 特征提取（80维 FBank，帧移10ms）
→ 声学模型（Conformer Encoder）
→ 解码器（CTC/Attention 混合解码）
→ 语言模型重打分（N-best Rescoring）
→ 后处理（标点恢复 + 逆文本正则化）
→ 最终文本输出
```

## 设计思路

### 1. 声学模型：Conformer

**Conformer** = Convolution + Transformer，兼顾局部特征和全局依赖：

```
输入特征 (T × 80)
→ Subsampling (Conv2D, 4倍下采样)
→ N × Conformer Block:
    ├── Feed Forward (1/2)
    ├── Multi-Head Self-Attention（全局依赖）
    ├── Convolution Module（局部模式：kernel=15）
    └── Feed Forward (1/2)
→ 输出 (T/4 × d_model)
```

**为什么 Conformer 优于纯 Transformer？**
- 语音信号有强局部相关性（如辅音的短时频谱模式），卷积模块能高效捕捉
- Self-Attention 捕捉长距离依赖（如语调跨越整句）
- 二者互补，相比纯 Transformer ASR 模型 WER 降低 10~15%

### 2. CTC/Attention 混合解码

```python
# 训练时：联合 CTC + Attention 两个 Loss
loss = alpha * ctc_loss + (1 - alpha) * attention_loss
# alpha 通常取 0.3

# 推理时：两轮解码
# 第一轮：CTC greedy/beam search → 快速得到 N-best 候选
# 第二轮：Attention Decoder 对 N-best 重打分 → 选最优
```

**设计考量**：
- **CTC 优势**：单调对齐，天然适合流式输出（边说边出字）
- **Attention 优势**：可以建模输出间依赖（"机器学习" vs "机器雪习"），但需要等完整输入
- **混合方案**：CTC 提供初始候选 + 对齐约束，Attention 做精细重排

### 3. 流式推理：Chunk-based Streaming

实际产品需要"边说边出字"，不能等整句说完才开始解码：

```
音频流 → 按 chunk 切分（每 chunk 640ms）
       → 每个 chunk 独立前向 + 有限右侧 context
       → CTC 流式输出 → 增量更新文本

关键技术：
- Dynamic Chunk Training：训练时随机 chunk 大小，推理时固定
- Causal Attention Mask：Self-Attention 只看当前及左侧 chunk
- 右侧 lookahead：允许看未来 1~2 个 chunk，提升精度
```

**延迟控制**：
- 首字延迟 < 200ms（1 个 chunk + 模型推理）
- 整体 RTF（Real Time Factor）< 0.15（即 1 秒音频用 0.15 秒处理）

### 4. 语言模型与后处理

- **浅融合（Shallow Fusion）**：解码时加权融入外部 N-gram / Neural LM 分数
- **热词增强**：用户通讯录中的人名、地名动态加入解码图，避免"张三"被识别为"张散"
- **标点恢复**：单独的 Transformer 模型预测逗号、句号、问号位置
- **ITN（Inverse Text Normalization）**：将"二零二五年"转为"2025年"，"一百二十三"转为"123"

### 5. 端侧模型（On-Device）

微信还支持无网络环境下的本地语音转文字：

```
完整模型：12层 Conformer, 70M 参数, ~200MB
端侧模型：6层 Conformer,  15M 参数, ~30MB

压缩手段：
- 知识蒸馏：大模型 Teacher → 小模型 Student
- 结构化剪枝：去除冗余 Attention Head
- INT8 量化 + NNAPI/CoreML 加速
- 共享 Embedding + 词表压缩（BPE 4000 → 2000）
```

## 技术亮点

| 维度 | 方案 | 效果 |
|------|------|------|
| 声学模型 | Conformer (12层, d=512) | 普通话 WER 4.2%（测试集） |
| 解码策略 | CTC/Attention 混合 + LM 重打分 | 相比纯 CTC，WER -18% |
| 流式推理 | Dynamic Chunk (640ms) | 首字延迟 < 200ms |
| 端侧部署 | 蒸馏 + INT8 + 6层轻量模型 | 手机端 RTF < 0.3 |
| 多语种 | 共享 Encoder + 语种 Token | 支持 10+ 语种/方言 |

## 工程落地关键

1. **数据飞轮**：
   - 20 万小时标注语音数据训练基础模型
   - 半监督学习：用现有模型标注海量无标注音频，再筛选高置信度样本回训
   - 用户反馈闭环：用户手动纠正的转写结果回流为训练数据
2. **服务架构**：
   - GPU 推理集群：A100/T4 混部，按音频时长动态调度
   - 长音频切分：> 60s 的语音自动分段并行推理，结果拼接
   - 多级缓存：相同音频 hash 命中缓存直接返回
3. **AB 实验**：
   - 每次模型迭代通过线上 AB 测试对比 WER + 用户满意度
   - 灰度发布：先 1% 用户 → 10% → 全量
4. **合规与隐私**：
   - 语音数据不落盘，推理完即销毁
   - 用户可选择是否将转写结果用于模型改进

## 面试常考点

1. **Conformer 中卷积模块的作用？为什么 kernel size 取 15？**
   → 捕捉 ~150ms 的局部频谱模式（辅音、爆破音），15 帧覆盖典型音素长度

2. **CTC 的条件独立假设有什么问题？如何缓解？**
   → CTC 假设输出 token 间相互独立，无法建模语言先验；用 Attention Decoder 重打分或外挂 LM 缓解

3. **流式 ASR 如何处理"当前 chunk 信息不足"的问题？**
   → 右侧 lookahead + endpoint detection；或采用"假设续传"策略，后续 chunk 到来时修正

4. **知识蒸馏在 ASR 中怎么做？**
   → Teacher 输出 soft label（CTC 后验概率分布），Student 同时学习 hard label + soft label（KL 散度）

## 参考资料

- [Conformer (Interspeech 2020)](https://arxiv.org/abs/2005.08100)
- [WeNet: 开源端到端语音识别框架](https://github.com/wenet-e2e/wenet)
- [Unified Streaming and Non-streaming ASR (Interspeech 2021)](https://arxiv.org/abs/2012.05481)
- [微信智聆语音技术](https://cloud.tencent.com/product/asr)
