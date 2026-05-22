# 计算机专业学习与发展规划平台 - 数据结构设计文档

## 1. 概述

本文档描述了计算机专业学习与发展规划平台的完整数据库结构设计。

## 2. 核心实体关系图

主要实体包括：
- User（用户）
- Grade（年级）
- Course（课程）
- Assignment（作业）
- AssignmentModule（作业模块）
- MembershipPlan（会员套餐）
- Order（订单）
- ConsultationLead（咨询意向）
- UserFavorite（用户收藏）

## 3. 数据库表设计

### 3.1 用户表（users）

```sql
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY COMMENT '用户唯一标识',
    phone VARCHAR(16) UNIQUE NOT NULL COMMENT '手机号',
    nickname VARCHAR(64) DEFAULT '未命名同学' COMMENT '昵称',
    school VARCHAR(128) COMMENT '学校',
    major VARCHAR(128) COMMENT '专业',
    grade_id VARCHAR(64) COMMENT '年级ID',
    goal VARCHAR(32) COMMENT '目标方向：就业/考研/保研/留学/暂不确定',
    member_level ENUM('free', 'study', 'career') DEFAULT 'free' COMMENT '会员等级',
    member_expires_at DATETIME COMMENT '会员到期时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME COMMENT '删除时间',
    
    INDEX idx_phone (phone),
    INDEX idx_grade (grade_id),
    INDEX idx_member_level (member_level)
) COMMENT '用户表';
```

### 3.2 年级表（grades）

```sql
CREATE TABLE grades (
    id VARCHAR(64) PRIMARY KEY COMMENT '年级唯一标识',
    name VARCHAR(32) NOT NULL COMMENT '年级名称：大一/大二/大三/大四',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_sort_order (sort_order)
) COMMENT '年级表';
```

### 3.3 课程表（courses）

```sql
CREATE TABLE courses (
    id VARCHAR(64) PRIMARY KEY COMMENT '课程唯一标识',
    grade_id VARCHAR(64) NOT NULL COMMENT '年级ID',
    name VARCHAR(128) NOT NULL COMMENT '课程名称',
    is_hot BOOLEAN DEFAULT FALSE COMMENT '是否热门',
    view_count INT DEFAULT 0 COMMENT '浏览量',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_grade_id (grade_id),
    INDEX idx_is_hot (is_hot),
    INDEX idx_view_count (view_count DESC),
    
    FOREIGN KEY (grade_id) REFERENCES grades(id)
) COMMENT '课程表';
```

### 3.4 作业表（assignments）

```sql
CREATE TABLE assignments (
    id VARCHAR(64) PRIMARY KEY COMMENT '作业唯一标识',
    course_id VARCHAR(64) NOT NULL COMMENT '课程ID',
    title VARCHAR(256) NOT NULL COMMENT '作业标题',
    summary TEXT COMMENT '作业摘要',
    difficulty ENUM('easy', 'medium', 'hard') NOT NULL COMMENT '难度：入门/中等/挑战',
    assignment_type ENUM('coding', 'theory', 'project') NOT NULL COMMENT '作业类型：编程类/理论类/项目类',
    view_count INT DEFAULT 0 COMMENT '浏览量',
    favorite_count INT DEFAULT 0 COMMENT '收藏数',
    is_free_full BOOLEAN DEFAULT FALSE COMMENT '是否免费完整',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at DATETIME COMMENT '删除时间',
    
    INDEX idx_course_id (course_id),
    INDEX idx_difficulty (difficulty),
    INDEX idx_assignment_type (assignment_type),
    INDEX idx_view_count (view_count DESC),
    INDEX idx_favorite_count (favorite_count DESC),
    
    FOREIGN KEY (course_id) REFERENCES courses(id)
) COMMENT '作业表';
```

### 3.5 作业模块表（assignment_modules）

```sql
CREATE TABLE assignment_modules (
    id VARCHAR(128) PRIMARY KEY COMMENT '模块唯一标识',
    assignment_id VARCHAR(64) NOT NULL COMMENT '作业ID',
    module_type VARCHAR(64) NOT NULL COMMENT '模块类型：overview/thinking_guide/knowledge_preview/full_solution/full_knowledge/enterprise_case/ai_implementation/extension_project',
    title VARCHAR(128) NOT NULL COMMENT '模块标题',
    required_level ENUM('free', 'study', 'career') NOT NULL DEFAULT 'free' COMMENT '需要的会员等级',
    content TEXT NOT NULL COMMENT '模块完整内容',
    preview_content TEXT COMMENT '模块预览内容',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_assignment_id (assignment_id),
    INDEX idx_module_type (module_type),
    INDEX idx_required_level (required_level),
    INDEX idx_sort_order (sort_order),
    
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
) COMMENT '作业模块表';
```

### 3.6 会员套餐表（membership_plans）

```sql
CREATE TABLE membership_plans (
    id VARCHAR(64) PRIMARY KEY COMMENT '套餐唯一标识',
    level ENUM('free', 'study', 'career') NOT NULL UNIQUE COMMENT '会员等级',
    name VARCHAR(64) NOT NULL COMMENT '套餐名称',
    tagline VARCHAR(256) COMMENT '宣传语',
    price DECIMAL(10, 2) NOT NULL COMMENT '价格',
    period VARCHAR(32) NOT NULL COMMENT '付费周期：永久/学期/年',
    benefits JSON NOT NULL COMMENT '权益列表',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_level (level),
    INDEX idx_is_active (is_active)
) COMMENT '会员套餐表';
```

### 3.7 订单表（orders）

```sql
CREATE TABLE orders (
    id VARCHAR(64) PRIMARY KEY COMMENT '订单唯一标识',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    plan_id VARCHAR(64) NOT NULL COMMENT '套餐ID',
    plan_level ENUM('free', 'study', 'career') NOT NULL COMMENT '会员等级',
    plan_name VARCHAR(64) COMMENT '套餐名称快照',
    amount DECIMAL(10, 2) NOT NULL COMMENT '订单金额',
    status ENUM('pending', 'paid', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
    paid_at DATETIME COMMENT '支付时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
) COMMENT '订单表';
```

### 3.8 咨询意向表（consultation_leads）

```sql
CREATE TABLE consultation_leads (
    id VARCHAR(64) PRIMARY KEY COMMENT '咨询ID',
    user_id VARCHAR(64) COMMENT '用户ID（登录用户）',
    name VARCHAR(64) NOT NULL COMMENT '姓名',
    contact VARCHAR(128) NOT NULL COMMENT '联系方式',
    school VARCHAR(128) COMMENT '学校',
    major VARCHAR(128) COMMENT '专业',
    grade_id VARCHAR(64) COMMENT '年级ID',
    goal VARCHAR(64) COMMENT '咨询方向：实习与就业/考研与保研/留学/其他',
    description TEXT NOT NULL COMMENT '当前困惑',
    status ENUM('new', 'contacted', 'processing', 'completed', 'closed') NOT NULL DEFAULT 'new' COMMENT '状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (grade_id) REFERENCES grades(id)
) COMMENT '咨询意向表';
```

### 3.9 用户收藏表（user_favorites）

```sql
CREATE TABLE user_favorites (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '收藏ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    assignment_id VARCHAR(64) NOT NULL COMMENT '作业ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    UNIQUE KEY uk_user_assignment (user_id, assignment_id),
    INDEX idx_user_id (user_id),
    INDEX idx_assignment_id (assignment_id),
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
) COMMENT '用户收藏表';
```

### 3.10 登录记录表（login_records）

```sql
CREATE TABLE login_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    ip_address VARCHAR(64) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',
    device_info JSON COMMENT '设备信息',
    login_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_login_at (login_at DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id)
) COMMENT '登录记录表';
```

## 4. 初始化数据

### 4.1 年级数据

```sql
INSERT INTO grades (id, name, sort_order) VALUES
('freshman', '大一', 1),
('sophomore', '大二', 2),
('junior', '大三', 3),
('senior', '大四', 4);
```

### 4.2 会员套餐数据

```sql
INSERT INTO membership_plans (id, level, name, tagline, price, period, benefits, is_active) VALUES
('free', 'free', '免费体验版', '先看懂题目方向，判断这份资源是否适合你', 0.00, '永久', 
'["作业概要与解题方向预览","基础知识点框架梳理","部分参考解析片段"]', TRUE),
('study', 'study', '学业提升版', '系统吃透课程作业，把会做题转化成绩点提升', 299.00, '学期', 
'["完整参考解析与步骤拆解","高频考点与知识网络提炼","常见错误与拿分风险提醒","按课程阶段提供复习建议"]', TRUE),
('career', 'career', '职场进阶版', '把课堂知识升级为项目能力、AI实战能力和职业竞争力', 499.00, '学期', 
'["包含学业提升版全部权益","企业真实应用场景与工程化案例","AI辅助实现、提示词与代码生成思路","可写入简历的扩展项目方案","升学、实习与职业规划优先咨询名额"]', TRUE);
```

## 5. 视图设计

### 5.1 作业详情视图

```sql
CREATE VIEW v_assignment_details AS
SELECT 
    a.*,
    c.name AS course_name,
    g.id AS grade_id,
    g.name AS grade_name
FROM assignments a
JOIN courses c ON a.course_id = c.id
JOIN grades g ON c.grade_id = g.id
WHERE a.deleted_at IS NULL;
```

## 6. 存储过程设计

### 6.1 更新作业收藏数

```sql
DELIMITER //
CREATE PROCEDURE update_assignment_favorite_count(IN p_assignment_id VARCHAR(64))
BEGIN
    UPDATE assignments 
    SET favorite_count = (
        SELECT COUNT(*) 
        FROM user_favorites 
        WHERE assignment_id = p_assignment_id
    )
    WHERE id = p_assignment_id;
END //
DELIMITER ;
```

## 7. 触发器设计

### 7.1 收藏变更时更新收藏数

```sql
DELIMITER //
CREATE TRIGGER after_user_favorite_insert
AFTER INSERT ON user_favorites
FOR EACH ROW
BEGIN
    CALL update_assignment_favorite_count(NEW.assignment_id);
END //

CREATE TRIGGER after_user_favorite_delete
AFTER DELETE ON user_favorites
FOR EACH ROW
BEGIN
    CALL update_assignment_favorite_count(OLD.assignment_id);
END //
DELIMITER ;
```

## 8. 数据字典

| 实体 | 说明 |
|------|------|
| users | 用户账户和个人信息 |
| grades | 年级分类 |
| courses | 课程信息 |
| assignments | 作业资源 |
| assignment_modules | 作业内容模块（分权限展示） |
| membership_plans | 会员套餐配置 |
| orders | 订单记录 |
| consultation_leads | 咨询意向 |
| user_favorites | 用户收藏关系 |
| login_records | 登录日志（用于安全风控） |

## 9. 权限设计原则

1. **内容权限控制**：作业模块根据 required_level 和用户 member_level 进行匹配
2. **访问日志**：记录关键操作，便于后续安全分析
3. **软删除**：重要数据使用 deleted_at 进行软删除，保留审计线索

---

文档版本：v1.0
最后更新：2026-05-18
