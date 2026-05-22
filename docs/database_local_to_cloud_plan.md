# 数据库搭建与上云实施计划

## 1. Summary

- 目标：把当前使用内存数组的 Express 接口改造成基于 MySQL + Prisma 的真实数据库方案，并预留后续迁移到阿里云或腾讯云托管 MySQL 的路径。
- 最终效果：
  - 本地开发环境使用本机 MySQL。
  - 后端通过 Prisma 读写数据库，不再依赖内存数组。
  - 提供初始化数据、迁移脚本、日常管理方式和备份思路。
  - 后续能平滑切换到云端数据库并继续接支付、域名和正式部署。
- 实施原则：
  - 先本地跑通，再上云。
  - 先静态内容数据与基础业务表，后接真实用户、支付、登录链路。
  - 把“数据库结构”“初始化数据”“接口改造”“上线迁移”拆成独立阶段，降低风险。

## 2. Current State Analysis

### 2.1 代码与技术栈

- 前端是 React + Vite，接口通过 `fetch('/api/...')` 调用后端。
- 后端是单文件 Express 服务，入口是 server/index.mjs。
- 项目依赖里已经安装了 `prisma`、`@prisma/client` 和 `mysql2`，见 package.json。

### 2.2 当前数据实现方式

- 当前所有年级、课程、作业、模块、套餐、订单、咨询意向都直接定义在 server/index.mjs 内存数组里。
- 当前接口是“演示可用、重启即丢”的状态：
  - 首页资源接口、作业列表和详情接口直接读取内存数组。
  - 订单和咨询接口只是在内存数组 `orders`、`consultationLeads` 里临时追加数据。
- 这意味着：
  - 服务重启后订单和咨询数据会丢失。
  - 无法支持正式上线后的真实用户数据。
  - 无法为支付、登录、收藏、后台管理提供可靠存储。

### 2.3 现有数据库设计基础

- 业务层面已经有完整数据库设计文档，见 docs/database-schema.md。
- 该文档已经覆盖主要业务实体：users, grades, courses, assignments, assignment_modules, membership_plans, orders, consultation_leads, user_favorites, login_records
- 文档还包含：初始化数据、视图设计、收藏数更新的存储过程/触发器思路

### 2.4 当前计划采用的关键决策

- 数据库：MySQL
- ORM：Prisma
- 云方向：阿里云/腾讯云的托管 MySQL
- 执行策略：先完成本地数据库接入和后端改造，再做云端迁移

## 3. Proposed Changes

### 3.1 阶段 A：本地数据库基础搭建

#### 目标
- 在电脑上装好 MySQL。
- 创建一个本地开发数据库。
- 让项目通过环境变量连接本地数据库。

#### 计划修改的文件
- 新增 prisma/schema.prisma
- 新增 prisma/seed.mjs 或等价 seed 文件
- 新增 server/lib/prisma.mjs
- 新增 .env.example
- 更新 package.json

#### 具体动作
1. 安装并启动本地 MySQL。
2. 在本地创建数据库，例如 `cs_growth_platform`。
3. 新增 `.env` 配置，核心变量为 `DATABASE_URL`。
4. 初始化 Prisma，并设置 provider 为 MySQL。
5. 在 Prisma schema 中定义所有核心模型和枚举。

### 3.2 阶段 B：把设计文档落成 Prisma 数据模型

#### 目标
- 把 docs/database-schema.md 中的 SQL 设计翻译成 Prisma 模型。
- 统一表结构、关系、枚举和默认值。

#### Prisma 层建议落地的模型
- User, Grade, Course, Assignment, AssignmentModule, MembershipPlan, Order, ConsultationLead, UserFavorite, LoginRecord

#### 设计落地时的实现决策
- 继续保留字符串主键的业务表。
- UserFavorite 和 LoginRecord 使用自增主键。
- benefits、deviceInfo 使用 Prisma 的 Json。
- deletedAt 保留为软删除字段。
- favoriteCount 优先先由应用层更新，不在第一阶段强依赖数据库触发器，降低实现复杂度。
- createdAt、updatedAt 用 Prisma 的默认时间能力维护。

### 3.3 阶段 C：执行迁移并生成数据库结构

#### 目标
- 把 Prisma schema 真正变成 MySQL 里的表。

#### 计划修改的文件
- 新增 prisma/migrations 目录下的迁移文件

#### 具体动作
1. 执行 `prisma migrate dev` 生成首个迁移。
2. 让本地 MySQL 自动创建表结构。
3. 用 Prisma Studio 或 SQL 客户端检查表是否成功生成。

### 3.4 阶段 D：初始化种子数据

#### 目标
- 把演示数据从代码搬进数据库，让前端页面继续能正常展示。

#### 计划修改的文件
- 新增或更新 prisma/seed.mjs

#### 初始化范围
- grades, membership_plans, courses, assignments, assignment_modules

#### 实现策略
- 把 server/index.mjs 里的静态演示数据整理为 seed 数据源。
- 用 upsert 避免重复导入时报错。
- 第一阶段只初始化内容型数据，不初始化真实用户、真实订单。

### 3.5 阶段 E：后端接口改造为数据库读写

#### 目标
- 把现有 Express API 从“读内存数组”切换为“查数据库”。

#### 计划修改的文件
- 更新 server/index.mjs
- 新增 server/lib/prisma.mjs

#### 改造范围
- /api/resources/home
- /api/assignments
- /api/assignments/:id
- /api/membership/plans
- /api/orders
- /api/consultation/leads
- /api/admin/summary
- /api/admin/consultation-leads

#### 实现决策
- 资源查询类接口：改用 Prisma findMany、findUnique、include。
- 订单和咨询接口：改为真正写入 orders 和 consultation_leads 表。
- 管理统计接口：改用数据库计数。
- 模块权限控制：保留当前 memberRank 思路，但数据源改成数据库中的 requiredLevel 和用户会员等级。

### 3.6 阶段 F：数据库日常管理方案

#### 目标
- 后续开发与排查问题的标准化手段。

#### 管理方式建议
1. 开发阶段：用 Prisma Studio 看表数据；用客户端工具直接查看 MySQL。
2. 结构变更：永远通过 Prisma schema + migration 管理，不直接手改线上表结构。
3. 数据初始化：用 seed 脚本维护系统基础数据。
4. 数据备份：本地开发阶段定期导出 SQL；上云后使用云数据库自动备份。

### 3.7 阶段 G：为真实支付链路预留数据库能力

#### 目标
- 在正式接支付前，先把订单表设计到可扩展状态。

#### 建议在执行时一并补充的字段
- externalTradeNo, paymentChannel, paymentStatus, refundStatus, paidAt, expiredAt, rawCallback

#### 原因
- 未来会接支付，订单不能只保存“套餐等级和金额”。需要为微信支付、支付宝或聚合支付预留回调和对账字段。

### 3.8 阶段 H：迁移到阿里云/腾讯云数据库

#### 目标
- 让网站正式上线时使用云数据库，而不是本地数据库。

#### 推荐路径
1. 购买云服务器或应用部署环境。
2. 购买托管 MySQL 数据库实例。
3. 配置白名单、安全组、数据库账号和最小权限。
4. 在服务器环境配置生产环境 DATABASE_URL。
5. 执行生产迁移。
6. 导入初始化数据或从本地导出再导入。
7. 修改后端部署配置，让线上服务连云数据库。

#### 生产环境关键决策
- 本地开发库与生产库必须分开。
- 生产环境禁止用 root 账号连数据库。
- 使用独立业务账号，只赋予必要权限。
- 打开自动备份和慢 SQL 监控。
- 生产迁移使用受控流程，不直接在线改表。

### 3.9 阶段 I：上线后的数据库运维原则

- 每天自动备份，至少保留 7 到 14 天备份。
- 开启数据库监控，定期检查慢查询。
- 对手机号等敏感信息做脱敏展示。
- 重要操作留操作日志。
- 重大表结构修改先在测试环境演练。

## 4. Assumptions & Decisions

### 已锁定决策
- 使用 MySQL，不改为 PostgreSQL 或 SQLite。
- 使用 Prisma，不采用原生 SQL 作为主数据层。
- 当前项目继续使用 Node.js + Express，不在这轮切换框架。
- 先接数据库，再接正式登录和支付。
- 云端数据库选择阿里云/腾讯云托管 MySQL 方向。

### 本轮不做的内容
- 不在这一轮直接接入真实支付 SDK。
- 不在这一轮直接搭建完整后台管理系统。
- 不在第一步就实现数据库读写分离、分库分表、缓存优化。
- 不把所有统计、触发器、视图一次性做完。

## 5. Verification Steps

### 本地阶段验收
1. 本地 MySQL 能正常启动。
2. 项目 `.env` 中的 `DATABASE_URL` 能连通。
3. `prisma migrate dev` 成功执行。
4. 数据库中能看到全部核心表。
5. seed 脚本执行后能看到年级、课程、作业、模块、套餐数据。
6. 前端首页、作业详情页能正常读取数据库数据。
7. 创建订单、提交咨询后，MySQL 中能看到真实记录。

### 上云阶段验收
1. 云数据库实例创建成功。
2. 生产环境服务能连上云数据库。
3. 生产迁移执行成功。
4. 初始化数据导入成功。
5. 线上网站关键页面查询正常。
6. 云数据库已开启备份和访问控制。

## 6. Recommended Execution Order

### 建议执行顺序
1. 先执行“本地数据库接入”准备工作：建 Prisma schema、建连接配置、建迁移脚本。
2. 完成本地 MySQL 安装和连接信息确认。
3. 执行迁移、seed、接口改造。
4. 本地验收页面和表数据。
5. 后续准备上线时，再做云数据库迁移方案。
6. 最后再接支付、域名、HTTPS 和正式部署。
