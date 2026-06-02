# 案例三：美团外卖订单状态机与冷热数据分离

> **来源场景**：美团外卖 - 订单中心
> **数据规模**：日订单量 7000 万+，年订单量 200 亿+
> **核心挑战**：订单状态流转复杂、高频更新、长尾查询、冷数据归档

---

## 一、应用场景

外卖订单生命周期短（30-60 分钟）但**状态复杂**，每个订单要经历：

```
下单 → 支付 → 商家接单 → 商家备餐 → 骑手接单
  → 骑手到店 → 骑手取餐 → 配送中 → 已送达 → 用户确认
```

业务特征：
- **状态频繁变更**：每个订单平均更新 8-12 次
- **状态机严格**：不允许「已送达」回退到「配送中」
- **强时效性**：订单 1 小时后基本「凉了」，长期数据价值低
- **客诉/对账长尾**：3 个月内的订单仍有较高查询频率

---

## 二、设计思路

### 2.1 订单状态机表设计

```sql
CREATE TABLE waimai_order (
  id              BIGINT       PRIMARY KEY,
  order_no        VARCHAR(32)  NOT NULL,
  user_id         BIGINT       NOT NULL,
  poi_id          BIGINT       NOT NULL    COMMENT '商家ID',
  rider_id        BIGINT       NULL        COMMENT '骑手ID',
  total_fee       DECIMAL(10,2) NOT NULL,

  -- 状态机字段
  status          TINYINT      NOT NULL    COMMENT '订单状态码',
  sub_status      TINYINT      NULL        COMMENT '子状态(细分场景)',
  status_path     VARCHAR(64)  NOT NULL    COMMENT '状态流转路径',

  -- 时间戳字段（每个状态对应一个时间）
  create_time     DATETIME(3)  NOT NULL,
  pay_time        DATETIME(3)  NULL,
  accept_time     DATETIME(3)  NULL        COMMENT '商家接单',
  ready_time      DATETIME(3)  NULL        COMMENT '出餐完成',
  rider_take_time DATETIME(3)  NULL        COMMENT '骑手取餐',
  delivered_time  DATETIME(3)  NULL        COMMENT '送达',
  finish_time     DATETIME(3)  NULL        COMMENT '完成',

  version         INT          NOT NULL    DEFAULT 0 COMMENT '乐观锁版本',

  UNIQUE KEY uk_order_no (order_no),
  KEY idx_user_status (user_id, status, create_time),
  KEY idx_poi_status (poi_id, status, create_time),
  KEY idx_rider_status (rider_id, status),
  KEY idx_create (create_time)
) ENGINE=InnoDB COMMENT='外卖订单主表';
```

### 2.2 状态机驱动的更新

订单状态变更必须**严格按状态机**进行，使用 **CAS（前置状态校验）**：

```sql
-- 商家接单：从「已支付(20)」流转到「已接单(30)」
UPDATE waimai_order
   SET status = 30,
       accept_time = NOW(3),
       version = version + 1
 WHERE order_no = #{orderNo}
   AND status = 20         -- 关键：前置状态校验
   AND version = #{version}; -- 乐观锁

-- 受影响行数 = 0 → 状态非法或已被其他线程更新
-- 受影响行数 = 1 → 流转成功
```

**优势**：
- 即使在 MQ 消息重复消费下，也只有一次能成功更新
- 天然防止状态回退（已送达不可能再回到配送中）

### 2.3 状态变更日志表

主表只保留当前状态，**完整流转历史另存**：

```sql
CREATE TABLE waimai_order_status_log (
  id              BIGINT       PRIMARY KEY,
  order_no        VARCHAR(32)  NOT NULL,
  from_status     TINYINT      NOT NULL,
  to_status       TINYINT      NOT NULL,
  operator_type   TINYINT      NOT NULL    COMMENT '1用户 2商家 3骑手 4系统',
  operator_id     BIGINT       NULL,
  reason          VARCHAR(128) NULL,
  create_time     DATETIME(3)  NOT NULL    DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_order_no (order_no, create_time),
  KEY idx_create (create_time)
) ENGINE=InnoDB COMMENT='订单状态流转日志';
```

每次状态变更**插入一条日志**（INSERT 永远比 UPDATE 快），用于：
- 客诉时回溯订单全貌
- 监控状态流转耗时（如「商家接单后到出餐」P99 时间）
- 审计追责

---

## 三、技术亮点

### 3.1 三级冷热分离架构

```
┌──────────────────────────────────────────────────┐
│  热数据 (近 3 天)                                │
│  MySQL 主集群 + Redis 缓存                       │
│  支持读写、状态变更、骑手查询                    │
│  写 QPS：10万+   读 QPS：100万+                  │
└─────────────┬────────────────────────────────────┘
              │ 每天凌晨迁移
              ▼
┌──────────────────────────────────────────────────┐
│  温数据 (3 天 ~ 3 个月)                          │
│  MySQL 归档集群（独立实例，机械盘）              │
│  只读，支持客诉查询、用户「我的订单」            │
└─────────────┬────────────────────────────────────┘
              │ 每月归档
              ▼
┌──────────────────────────────────────────────────┐
│  冷数据 (3 个月以上)                             │
│  HBase + 对象存储                                │
│  T+1 离线分析、合规留存                          │
└──────────────────────────────────────────────────┘
```

### 3.2 路由策略

业务方查询时，根据 `create_time` 自动路由：

```python
def query_order(order_no, create_time=None):
    if not create_time:
        # 1. 先查 Redis 缓存
        if cached := redis.get(f"order:{order_no}"):
            return cached
        # 2. 缓存未命中，从订单号解析时间（订单号含时间戳）
        create_time = parse_time_from_order_no(order_no)

    age = now() - create_time
    if age <= 3_days:
        return query_hot_db(order_no)
    elif age <= 3_months:
        return query_warm_db(order_no)
    else:
        return query_cold_storage(order_no)
```

### 3.3 索引设计的精细化

订单业务有三个查询主体：**用户、商家、骑手**，每个主体的查询特征不同：

| 角色 | 查询特征 | 索引 |
|------|---------|------|
| 用户 | 看自己最近订单（带状态过滤） | `(user_id, status, create_time)` |
| 商家 | 看待处理订单 | `(poi_id, status, create_time)` |
| 骑手 | 看分配给自己的进行中订单 | `(rider_id, status)` |

**关键技巧**：把高过滤性字段放在前面，把排序字段放在最后，做到「**索引下推 + 覆盖索引**」。

### 3.4 异步化降低主库压力

```
[订单状态变更]
    ↓
[写主库 + 发 MQ]
    ↓
    ├──→ [状态日志服务]   插日志表
    ├──→ [搜索服务]       同步到 ES
    ├──→ [数仓]           落入 Hive
    └──→ [通知服务]       推送 App / 短信
```

主链路只做 1 次 DB 写，其他衍生数据全部异步处理。

### 3.5 对账：解决主库与衍生系统的不一致

每 5 分钟跑增量对账：

```sql
-- 找出主库有但 ES 没有的订单
SELECT o.order_no
  FROM waimai_order o
  LEFT JOIN order_es_idx e ON o.order_no = e.order_no
 WHERE o.update_time > NOW() - INTERVAL 10 MINUTE
   AND e.order_no IS NULL;
```

发现差异自动补偿写入。

---

## 四、性能数据

| 指标 | 数值 |
|------|------|
| 日订单量 | 7000 万+ |
| 高峰期写入 TPS | 10 万+ |
| 状态变更 TPS | 100 万+ |
| 用户「我的订单」P99 | < 50ms |
| 客诉查询 P99 | < 200ms |

---

## 五、设计权衡与思考

### ✅ 优势

1. **状态机严谨**：CAS 更新 + 状态日志，业务流程不会乱
2. **存储成本可控**：冷热分离，热库容量稳定
3. **查询性能稳定**：每个角色都有专属索引

### ⚠️ 代价

1. **多套存储维护成本**：热/温/冷集群都要监控
2. **跨层查询复杂**：3 个月前的订单要跨两个系统
3. **冷热边界处理**：迁移失败、迁移中查询的边界情况

### 💡 启示

> **「热数据精打细算，冷数据简单粗暴」**——
> 主库只保留 3 天数据，能让索引高度始终维持在 3 层以内，B+ 树查询永远是 3 次磁盘 IO；
> 而 3 个月前的订单很少访问，丢进 HBase 即使慢一点用户也能接受。

---

## 六、可借鉴的设计模式

1. **状态机 + CAS**：用前置状态校验 + 乐观锁确保业务流转正确
2. **状态日志分离**：主表存当前状态，日志表存流转历史，避免大表 UPDATE
3. **冷热三级架构**：热（高速）/温（容量）/冷（合规）分级存储
4. **多角色多索引**：用户/商家/骑手 三套查询路径，三组索引
5. **主链异步化**：核心链路最简，衍生数据异步处理
6. **5 分钟对账**：用增量对账兜底数据一致性

---

## 参考资料

- 美团技术团队：美团外卖订单中心的演进
- InfoQ：美团点评订单系统的高可用架构演进
- 《亿级流量网站架构核心技术》
