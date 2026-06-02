# 案例二：微信红包高并发扣减与防超卖

> **来源场景**：微信支付 - 微信红包业务
> **数据规模**：除夕峰值每秒 76 万次红包发送，每秒 50 万次拆红包
> **核心挑战**：超高并发下的金额扣减一致性、防止超发、防止重复领取

---

## 一、应用场景

微信红包是典型的「极致高并发 + 强一致性 + 资金安全」场景：

- **集中爆发**：除夕跨年夜瞬时流量是平时的几百倍
- **强一致性要求**：1 元钱都不能错，禁止超发或漏发
- **幂等性要求**：网络重试不能导致重复扣款或重复领取
- **公平性**：先到先得，每个红包只能被领取一次

---

## 二、设计思路

### 2.1 经典方案的瓶颈

❌ **方案A：数据库行锁（悲观锁）**

```sql
BEGIN;
SELECT remaining FROM red_packet WHERE id = 100 FOR UPDATE;  -- 行锁
UPDATE red_packet SET remaining = remaining - 1 WHERE id = 100;
COMMIT;
```

问题：万人抢同一个红包时，所有请求在 `FOR UPDATE` 处串行排队，TPS 只能跑到几百。

❌ **方案B：纯数据库乐观锁**

```sql
UPDATE red_packet
SET remaining = remaining - 1, version = version + 1
WHERE id = 100 AND version = ? AND remaining > 0;
```

问题：高并发下大量请求同时进入数据库再失败重试，DB 仍然是瓶颈。

### 2.2 微信红包的方案：SET 化 + 内存预扣 + DB 落地

```
       客户端拆红包请求
            │
            ▼
    ┌────────────────┐
    │  CGI 接入层    │   按红包ID路由到固定SET
    └───────┬────────┘
            ▼
    ┌────────────────┐
    │  红包服务SET   │   单SET单机处理同一个红包
    │   (cache)      │   排队 + 预扣减
    └───────┬────────┘
            ▼ 异步落地
    ┌────────────────┐
    │  MySQL集群     │   按红包ID分片
    └────────────────┘
```

**核心思想**：
1. **同一个红包永远落到同一台机器**（SET 化），消除分布式锁
2. **请求在内存中排队**，单机内用 CAS 处理，吞吐量百万级
3. **异步批量落库**，DB 只承担最终持久化

---

## 三、技术亮点

### 3.1 表结构设计

```sql
-- 红包主表（按红包ID取模分片）
CREATE TABLE red_packet (
  id              BIGINT       PRIMARY KEY COMMENT '红包ID',
  user_id         BIGINT       NOT NULL    COMMENT '发红包用户',
  total_amount    BIGINT       NOT NULL    COMMENT '总金额(分)',
  total_count     INT          NOT NULL    COMMENT '红包个数',
  remain_amount   BIGINT       NOT NULL    COMMENT '剩余金额(分)',
  remain_count    INT          NOT NULL    COMMENT '剩余个数',
  status          TINYINT      NOT NULL    COMMENT '0进行中 1已抢完 2已退回',
  expire_time     DATETIME     NOT NULL,
  create_time     DATETIME     NOT NULL    DEFAULT CURRENT_TIMESTAMP,

  KEY idx_user_create (user_id, create_time),
  KEY idx_expire (expire_time, status)
) ENGINE=InnoDB COMMENT='红包主表';

-- 抢红包记录表（按红包ID分片）
CREATE TABLE red_packet_record (
  id              BIGINT       PRIMARY KEY,
  packet_id       BIGINT       NOT NULL    COMMENT '红包ID',
  user_id         BIGINT       NOT NULL    COMMENT '抢红包用户',
  amount          BIGINT       NOT NULL    COMMENT '抢到金额(分)',
  grab_time       DATETIME     NOT NULL    DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE KEY uk_packet_user (packet_id, user_id),  -- 防止重复抢
  KEY idx_user_grab (user_id, grab_time)
) ENGINE=InnoDB COMMENT='抢红包记录';
```

**关键约束**：`uk_packet_user (packet_id, user_id)` 是防止重复领取的最后一道防线。

### 3.2 防超发：DB 兜底约束

即便有内存层预扣，DB 也必须保证不会超发：

```sql
-- 扣减库存（带防超发约束）
UPDATE red_packet
   SET remain_amount = remain_amount - #{amount},
       remain_count  = remain_count  - 1,
       status        = CASE WHEN remain_count - 1 = 0 THEN 1 ELSE 0 END
 WHERE id = #{packetId}
   AND remain_count >= 1
   AND remain_amount >= #{amount};   -- 关键：防止扣成负数

-- 受影响行数 = 0 → 扣减失败（已抢完或并发冲突）
-- 受影响行数 = 1 → 扣减成功
```

### 3.3 拆红包金额算法（二倍均值法）

```python
def split(remain_amount, remain_count):
    if remain_count == 1:
        return remain_amount
    # 当前可抢金额 = [1分, 剩余均值的2倍]
    avg = remain_amount / remain_count
    max_amount = avg * 2
    return random.randint(1, max_amount)
```

**优点**：
- 数学期望均匀
- 不需要预先生成全部金额（节省内存）
- 任何抢的顺序都不会出现负数

### 3.4 幂等性保证

| 防重场景 | 解决方案 |
|---------|---------|
| 用户重复点击拆红包 | 唯一键 `uk_packet_user` |
| 网络重试 | 客户端请求带 `request_id`，服务端去重 |
| 消息重投 | 消费幂等表 `consumed_msg(msg_id PK)` |

### 3.5 资金对账：最终一致性

红包业务涉及多个系统：**红包系统 → 财付通 → 用户钱包**

```
[红包扣减] → [发起转账消息] → [财付通收钱]
                  ↓
            [对账任务每5分钟]
            扫描 status='进行中' 但已超时的红包
            → 退回未抢完金额
```

每天凌晨跑「红包流水 vs 财付通流水」全量对账，差异 1 分钱都要追查。

---

## 四、性能数据（公开资料）

| 指标 | 数值 |
|------|------|
| 除夕峰值发红包 | **76 万次/秒** |
| 除夕峰值拆红包 | **50 万次/秒** |
| 单红包最大并发 | **数十万人抢同一红包** |
| 平均拆红包延迟 | < 200ms |

---

## 五、设计权衡与思考

### ✅ 优势

1. **极致吞吐**：内存排队 + DB 异步落地，规避锁竞争
2. **强一致性**：DB 层 `remain_count >= 1` 兜底防超发
3. **故障隔离**：SET 化使单 SET 故障不影响其他红包

### ⚠️ 代价

1. **架构复杂度高**：缓存、消息队列、对账系统缺一不可
2. **故障恢复成本**：内存预扣丢失需要从 DB 重建
3. **开发调试难**：分布式系统排查问题难度大

### 💡 启示

> 高并发不是靠数据库堆机器堆出来的，而是靠**架构层面的"减压"**：
> - 能在内存做的不要进 DB
> - 能在单机做的不要做分布式
> - 必须做分布式时，先 SET 化让请求收敛到单点

---

## 六、可借鉴的设计模式

1. **SET 化部署**：让数据天然分区，避免分布式锁
2. **内存预扣 + DB 落地**：吞吐与一致性双赢
3. **DB 约束兜底**：`字段 >= 0` 是防超卖的最后防线
4. **唯一键防重**：(业务ID, 用户ID) 联合唯一索引是幂等利器
5. **对账兜底**：T+1 全量对账解决最终一致性的「最后 1%」

---

## 参考资料

- 微信团队技术博客：100 亿次的挑战 - 微信红包系统设计
- 微信支付架构演进 - 财付通技术文章
- 《微信红包 OPS 平台演进之路》
