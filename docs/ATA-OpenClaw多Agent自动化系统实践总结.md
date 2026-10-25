# OpenClaw 多 Agent 自动化系统实践总结

> 原文来源:[ATA 文章 11020599636](https://alidocs.dingtalk.com/i/nodes/Y1OQX0akWmzdBowLFNG9oX4MVGlDd3mE)
> 主题:基于 OpenClaw 框架搭建 7×24 运行的多 Agent 自动化团队——从系统设计、踩坑到 Agent 自主进化的完整实践

---

## 一句话总结

作者用半个月的下班时间,基于 OpenClaw 搭建了一个「1 个编排者 + 5 个专业 Agent + 6 类 ACP 编码专家」的自动化团队,52 个 cron 任务驱动其 7×24 运转,并沉淀出一套解决**上下文管理、记忆成长、多 Agent 协作**三大核心工程问题的方法论——核心结论是:**这不是 prompt 问题,是系统工程问题**。

---

## 系统全景

| 维度 | 数据 |
|---|---|
| 团队阵型 | 1 编排者(Zoe) + 5 专业 Agent + 6 类 ACP 编码专家(最大 6 并发) |
| 定时任务 | 52 个 cron(凌晨 3:00 备份 → 23:45 全员反思) |
| Skills | 118 个(33 全局共享 + 85 Agent 专属) |
| LLM | 29 个注册模型,每天几千次调用 |
| 运维 | 2086 行自愈脚本,半个月 23 次自动恢复 |

## 团队阵型(1+5+6)

| 成员 | 角色 | 要点 |
|---|---|---|
| **Zoe** | CTO / 首席编排者 | 每天 3 次巡检(6 大维度: cron 状态/磁盘/session/CDP 泄露/.learnings/共享上下文); 最有价值能力是**方案设计**(三态协议、Task Watcher 均为其自主设计) |
| **AI 哨兵(ainews)** | 情报中枢 | 100+ 信息源(GitHub Trending/arXiv/RSS/HN),7 个 cron,晨午晚三报; 主动评估技术发现对系统的影响并输出 P0/P1/P2 建议; 防幻觉: 每条新闻必带原文 URL |
| **交易蜘蛛(Trading)** | 量化分析师 | 任务最密集: 21 个 cron、20 个量化工具、15 个 Skills(68000+ 行); 四步分析框架: 宏观因子→多维评分→逆向检验→输出(标的+评分+止损+置信度); 硬规则: **NEVER 给出没有止损的买入建议** |
| **Macro** | 首席经济学家 | 宏观→传导→国内→市场四层映射因子包; 9 个 cron 双时区覆盖; 分析纪律: 区分事实/判断、标注置信度、每判断配反面论据 |
| **内容蜘蛛(Content)** | 内容策略师 | Research→Ideate→Write→Reflect 四阶段流水线; 从 54 平台热榜取材; 自研「去 AI 味」Skill 发布到 ClawHub; 自己设计了「X 五篮子」热点框架并自加配额(AI 内容 ≤40%) |
| **管家蜘蛛(Butler)** | 生活管家 | 深度集成 Apple 生态; 理念「不多不少刚刚好」: 单次 <50 字、间隔 ≥1.5h、深夜仅紧急事项 |
| **ACP 编码专家** | 编码执行 | Pi / Claude Code / Codex / OpenCode / Gemini / GPT-5.3-Codex,`sessions_spawn` 按需委派,6 并发 / 120min TTL |

**团队设计教训:**
- **不要让分析 Agent 直接编码**——早期设的 coding/architect/PM 角色与 Zoe+ACP 组合高度重叠,全砍
- **复杂度随人数快速上升**: 3 个 Agent = 3 对交互,6 个 = 15 对; 每加一个新 Agent 需半天到一天调试

---

## 三大核心工程问题与解法

### 问题一: 上下文是 Agent 的操作系统

**问题本质**: 不加约束,熵只增不减——持续运行的 Agent 系统**确定性地**走向崩溃。

三个真实事故(按严重度):
- **P0** — session 膨胀到 235K tokens → Gateway compaction 永远超时 → crash → 守护进程 `ThrottleInterval=1` 每秒重启 → **全团队瘫痪 8 小时**(四层防线全部缺失)
- **P1** — 3500 字报告触发框架自动「智能压缩」到 800 字,数据表格被 LLM summarize 掉——数据密集场景下 AI 的「智能」是灾难
- **P2** — SOUL.md 堆满规则 + session 膨胀 → Agent「选择性遵守」,管家越界做投资分析

**解法: 双层控制,缺一不可**

1. **Context Engineering(设计信息架构)**
   - `SOUL.md` 置于 system prompt 最前 = Agent「宪法」,只放核心约束
   - `AGENTS.md` 定义操作规范与协作协议
   - Skills 通过 `extraDirs` **按需加载**(Trading 15 个 Skills 不可能全常驻)
   - `shared-context/` 跨 Agent 共享状态; Obsidian 做冷存储不参与推理
   - **规则措辞面向最弱模型**: `"建议不编造数据"` 弱模型无视;`"MUST + P0 + NON-NEGOTIABLE"` 才可靠
2. **Harness(框架自动管理生命周期)**

| 机制 | 触发条件 | 动作 |
|---|---|---|
| compaction memoryFlush | session > 40K tokens | 提取精华到 `memory/YYYY-MM-DD.md` |
| contextPruning | > 6 小时 | cache-ttl 裁剪,保留最近 3 条 |
| session reset | 每天 5:00 或空闲 30min | 自动重置 |
| session maintenance | 文件 > 7 天 | 清理,磁盘上限 100MB |
| self-improving-agent | Agent 启动时 | 注入 `.learnings/` 历史经验 |

### 问题二: 让 Agent 真正「记住」并「成长」

**问题本质**: session 重置后记忆丢失——交易蜘蛛 5 次把龙虎榜 API 字段名搞错;用户纠正过的策略 3 天后又犯。**Agent 与 chatbot 的分水岭: 能从错误中学习且下次不犯**。

**解法: 五层记忆(借鉴人类认知模型)**

| 层 | 存储 | 管理方式 |
|---|---|---|
| L1 身份层 | SOUL.md | **人工确认**才能修改(Agent 不能改自己的「宪法」) |
| L2 长期记忆 | MEMORY.md(<3000 tokens) | Agent 自主维护 |
| L3 中期记忆 | memory/ + memory.db | Harness 自动提取 |
| L4 短期记忆 | .learnings/(ERRORS/LEARNINGS/FEATURE_REQUESTS) | 即时记录,不审查直接写入 |
| L5 持久化 | Skills + Obsidian + ontology 知识图谱 + 向量库 | 共享/归档/语义检索 |

**核心机制 — 记忆自主迭代 6 步循环**:
触发事件(失败/纠正/更优做法) → `.learnings/` 即时记录 → 每日反思 cron 验证(出现 **≥3 次**才 promote,防偶发事件污染) → promote 到 MEMORY.md(超 3000 tokens 自主精简) → 新 session 经 hook 加载 → 行为改进

**进阶形态**:
- **假设驱动迭代**: 每日提出 3-5 条可验证假设,晚间用实际数据验证——验证通过固化为规则/Skill,失败则淘汰。从「被动修复」跃迁到「主动改进」
- **Tech Radar 闭环**: ainews 发现新技术(如 ReMe 记忆框架) → Zoe 源码级评估 → 用户确认 → ACP 委派 Claude Code 分阶段落地
- **框架 vs 运营的边界**: OpenClaw 自带 Session 管理/Harness/ACP;而反思迭代、三态协议、Task Watcher、记忆压缩全是**运营层自建**

### 问题三: 多 Agent 协作是协议问题,不是群聊问题

**问题本质**: 把 Agent 放进群聊 ≠ 协作。Macro 和 Trading 互相「收到/确认」刷十几轮——`requireMention` 下互相 @ 形成经典 **ACK storm**,与 TCP 早期问题同构。解法不是「让 Agent 少说话」(建议式规则对弱模型无效),而是**设计带状态机的通信协议**。

**解法: 协议级设计**

- **固定三态通信协议**: `request → confirmed → final → 静默`(final 全线程仅 1 条,发出后全员静默,客套话一律 NO_REPLY)
- **V1 线程协议**: 同线程仅一个 ack_id / final 后禁止续话 / 超时≠失败不得重试同 ack_id / 重试 1 次后转文件投递 / 5 分钟无 confirmed 催办、10 分钟升级 Zoe 仲裁
- **三种通信机制**: `sessions_send`(实时分派)、`shared-context/`(异步状态,**从消息驱动升级为状态驱动**)、结构化知识接口(报告末尾留「改写要点」)
- **DRI 原则**: 一个问题只有一个直接负责人出最终结论,非 DRI 只能补充
- **安全边界**: `exec.security: allowlist` 白名单执行 / SOUL.md 与 openclaw.json 禁止 Agent 修改 / 密钥只放 env / ACP 代码走 review 不直接部署

**两个自主进化的基础设施**(均由 Zoe 设计、委派 ACP 编码实现):
1. **Task Watcher**: 解决「Agent 说了会做但实际没做」和「cron 执行了但零产出」——Task Callback Event Bus(注册→轮询→Adapter 检查→Policy 决策→Notifier 通知),130 个单元测试,已开源发布为 Skill
2. **通信 Guardrail + 11 态请求生命周期**(~3000 行 Python): 关键语义 `timeout ≠ failed`(引入 ambiguous_success)、`completed ≠ delivered`(工作完成 ≠ 结果送达)

---

## 五层工程架构总览

| 层 | 核心机制 | 解决什么 |
|---|---|---|
| 通信层 | 三态协议 + ack_id + shared-context/ | Agent 间可靠协作 |
| 记忆层 | 五层存储 + Harness 管理 + 反思迭代 | 记住经验并持续成长 |
| 自愈层 | 三层自愈 + heartbeat-guardian | 7×24 稳定运行 |
| 进化层 | .learnings → promote → Skill 自研 | 从执行者变成设计者 |
| 编排层 | Zoe 巡检 + 圆桌 + Task Watcher + ACP | 谁来协调这一切 |

五层相互依赖强化: 协议诞生于编排层的问题发现,记忆压缩是自愈层的一部分,Skill 自研能力来自跨 Agent 协作。

---

## 半个月运行后的 5 条认知(全文精华)

1. **90% 的时间花在工程问题上,不是 AI 问题上**——解法在分布式系统与 SRE 经典知识里,不在 AI 论文里。瓶颈不是模型能力,是基础设施成熟度
2. **AI 的「智能」在生产环境中经常是灾难**——需要精确、可预测输出的场景下,「智能压缩」「智能修复」都是事故源。**显式 > 隐式,硬规则 > 软建议,可预测 > 可解释**
3. **持续运行的系统必然退化——不是 bug,是热力学**——对策是反退化机制栈: compaction 管 session、maintenance 管记忆、巡检管行为漂移;每层兜底都需要自己的兜底
4. **协作是协议问题,不是 prompt 问题**——同一个模型,加三态协议后从十几轮废话变成一份可执行策略文档。两个 Agent 共享 Thread 不写协议 = 两个进程共享内存不加锁
5. **Agent 最大的价值不是执行力,而是「参与设计」**——从「你让我做什么」到「我发现问题、调研三种方案、推荐 B、你确认我就落地」,设计目标不是让 Agent 听话,而是让它有能力自己解决问题

---

## 上手路线建议(从 1 个 Agent 开始)

- **第 1-2 天(单 Agent 稳定)**: ① SOUL.md 当宪法不当操作手册 ② Session 参数第一天就设好(`idleMinutes=30` / `pruneAfter=7d` / `maxDiskBytes=100MB`),不设 = 定时炸弹 ③ 第一天就启用 `.learnings/` + 反思 cron
- **第 3-5 天(双 Agent 协作)**: Discord 配置比想象的复杂 10 倍(独立 Bot 账号/requireMention/textChunkLimit 等);协作必须上三态协议 + ack_id + 超时升级
- **第 2 周起(扩展阵型)**: 规则用最强措辞面向最弱模型 / 严格定义「成功」(投递成功 ≠ 归档成功,无报错 ≠ 有产出) / 关键数据走文件可追溯 / 每加一个 Agent 预留半天到一天调试

> 原文还提供 [MiniClaw](https://ata.atatech.org/articles/11020599201)(~2700 行 Python 复现 OpenClaw 11 个核心架构模式),适合先理解原理再动手。

---

## 附录: 技术栈速查

| 类别 | 配置 |
|---|---|
| LLM 分层 | 主对话 GPT-5.4 / 编码 K2.5 / cron 任务 Qwen3.5+ / 心跳 Ollama qwen3:8b(免费); Fallback 链: gpt-5.4 → k2.5 → qwen3.5-plus → ollama/qwen3:8b |
| 数据源 | A 股 AKShare+TuShare Pro / 美股 yfinance+Finnhub / 信息 Tavily+RSS 13 源+54 平台热榜 / 浏览器 Playwright |
| 部署 | Mac 本地 7×24,launchctl 守护(`ThrottleInterval=10`),每日 3:00 全量备份,Zoe 3 次/天巡检 + crontab 15 分钟健康检查 |
| 归档 | Obsidian Vault + obsidian-livesync |

## 原文系列文章

| 文章 | 内容 |
|---|---|
| [踩坑笔记](https://ata.atatech.org/articles/11020597619) | 规模陷阱/消息风暴/ACP 协作/Gateway 死循环等 |
| [7×24 生存指南](https://ata.atatech.org/articles/11020597618) | 三层自愈架构,23 次自动恢复 |
| [进化笔记](https://ata.atatech.org/articles/11020599223) | Agent 自主设计协议、写代码、发布 Skill 的 10 个案例 |
| [MiniClaw](https://ata.atatech.org/articles/11020599201) | ~2700 行 Python 复现 OpenClaw 核心架构 |
