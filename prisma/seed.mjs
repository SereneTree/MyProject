import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ==========================================
// 1. 年级数据
// ==========================================
const grades = [
  { id: 'freshman_fall', name: '大一上', sortOrder: 1 },
  { id: 'freshman_spring', name: '大一下', sortOrder: 2 },
  { id: 'sophomore_fall', name: '大二上', sortOrder: 3 },
  { id: 'sophomore_spring', name: '大二下', sortOrder: 4 },
  { id: 'junior_fall', name: '大三上', sortOrder: 5 },
  { id: 'junior_spring', name: '大三下', sortOrder: 6 },
  { id: 'senior_fall', name: '大四上', sortOrder: 7 },
  { id: 'senior_spring', name: '大四下', sortOrder: 8 }
];

// ==========================================
// 2. 会员套餐数据
// ==========================================
const plans = [
  {
    id: 'free',
    level: 'free',
    name: '免费体验版',
    tagline: '先看懂题目方向，判断这份资源是否适合你',
    price: 0,
    period: '永久',
    benefits: ['作业概要与解题方向预览', '基础知识点框架梳理', '部分参考解析片段'],
    isActive: true
  },
  {
    id: 'study',
    level: 'study',
    name: '学业提升版',
    tagline: '系统吃透课程作业，把会做题转化为绩点提升',
    price: 299,
    period: '学期',
    benefits: ['完整参考解析与步骤拆解', '高频考点与知识网络提炼', '常见错误与拿分风险提醒', '按课程阶段提供复习建议'],
    isActive: true
  },
  {
    id: 'career',
    level: 'career',
    name: '职场进阶版',
    tagline: '把课堂知识升级为项目能力、AI 实战能力和职业竞争力',
    price: 499,
    period: '学期',
    benefits: ['包含学业提升版全部权益', '企业真实应用场景与工程化案例', 'AI 辅助实现、提示词与代码生成思路', '可写入简历的扩展项目方案', '升学、实习与职业规划优先咨询名额'],
    isActive: true
  }
];

// ==========================================
// 3. 课程数据 (信息与计算科学 + 数字媒体 + 电子信息工程)
// ==========================================
const courses = [
  // —— 信息与计算科学（沿用原 8 门） ——
  // 信息与计算科学大一上
  { id: 'pdp', gradeId: 'freshman_fall', name: '个人发展规划&企业技能', isHot: false, viewCount: 5280 },
  { id: 'math-analysis', gradeId: 'freshman_fall', name: '数学分析', isHot: true, viewCount: 5280 },
  { id: 'advanced-algebra', gradeId: 'freshman_fall', name: '高等代数', isHot: true, viewCount: 5280 },
  { id: 'cs-intro', gradeId: 'freshman_fall', name: '计算机导论&程序设计', isHot: false, viewCount: 5280 },

  // 信息与计算科学大一下
  { id: 'analytic-geometry', gradeId: 'freshman_spring', name: '空间解析几何', isHot: false, viewCount: 2310 },
  { id: 'data-science-intro', gradeId: 'freshman_spring', name: '数科编程导论', isHot: false, viewCount: 2310 },
  
  // 信息与计算科学大二上
  { id: 'data-structure', gradeId: 'sophomore_fall', name: '数据结构', isHot: true, viewCount: 6890 },
  { id: 'program-design', gradeId: 'sophomore_fall', name: '项目设计', isHot: true, viewCount: 6890 },
  { id: 'advanced-physics', gradeId: 'sophomore_fall', name: '大学物理', isHot: true, viewCount: 6890 },
  { id: 'probability-statistics', gradeId: 'sophomore_fall', name: '概率论与数理统计', isHot: true, viewCount: 6890 },
  { id: 'exploratory-data-analysis', gradeId: 'sophomore_fall', name: '数据分析', isHot: true, viewCount: 6890 },
  { id: 'ordinary-diff-equation', gradeId: 'sophomore_fall', name: '常微分方程', isHot: true, viewCount: 6890 },

  // 信息与计算科学大二下
  { id: 'data-science', gradeId: 'sophomore_spring', name: '数据科学', isHot: true, viewCount: 4520 },
  { id: 'ai', gradeId: 'sophomore_spring', name: '人工智能', isHot: true, viewCount: 4520 },
  { id: 'computer-network', gradeId: 'sophomore_spring', name: '计算机网络', isHot: true, viewCount: 4520 },
  { id: 'math-model', gradeId: 'sophomore_spring', name: '数学模型', isHot: true, viewCount: 4520 },
  { id: 'numerical-model', gradeId: 'sophomore_spring', name: '数值模型', isHot: true, viewCount: 4520 },

  // 信息与计算科学大三上
  { id: 'linear-programming', gradeId: 'junior_fall', name: '线性规划&博弈论', isHot: true, viewCount: 5670 },
  { id: 'ml', gradeId: 'junior_fall', name: '机器学习', isHot: true, viewCount: 7120 },
  { id: 'database', gradeId: 'junior_fall', name: '数据库系统', isHot: true, viewCount: 7120 },
  { id: 'dsp-fundamentals', gradeId: 'junior_fall', name: '数字信号处理入门', isHot: true, viewCount: 7120 },
  { id: 'diff-equation', gradeId: 'junior_fall', name: '微分方程数值解', isHot: true, viewCount: 7120 },

  // 信息与计算科学大三下
  { id: 'block-chain', gradeId: 'junior_spring', name: '区块链', isHot: true, viewCount: 4890 },
  { id: 'graph-theory', gradeId: 'junior_spring', name: '图论', isHot: true, viewCount: 4890 },
  { id: 'bayesian', gradeId: 'junior_spring', name: '贝叶斯统计', isHot: true, viewCount: 4890 },
  { id: 'complex-networks', gradeId: 'junior_spring', name: '复杂网络', isHot: true, viewCount: 4890 },
  { id: 'dl', gradeId: 'junior_spring', name: '深度学习', isHot: true, viewCount: 4890 },

  // 信息与计算科学大四上
  { id: 'aaa', gradeId: 'senior_fall', name: 'aaa', isHot: true, viewCount: 7120 },

  // 信息与计算科学大四下
  { id: 'xxx', gradeId: 'senior_spring', name: 'xxx', isHot: true, viewCount: 7120 },

  // —— 数字媒体专业课程 ——
  { id: 'dm-design-basics', gradeId: 'freshman_fall', name: '设计基础', isHot: false, viewCount: 1320 },
  { id: 'dm-color-theory', gradeId: 'freshman_fall', name: '色彩构成', isHot: false, viewCount: 1180 },
  { id: 'dm-image-process', gradeId: 'freshman_spring', name: '数字图像处理', isHot: true, viewCount: 2480 },
  { id: 'dm-typography', gradeId: 'freshman_spring', name: '字体与版式设计', isHot: false, viewCount: 1420 },
  { id: 'dm-graphic-design', gradeId: 'sophomore_fall', name: '平面设计实战', isHot: true, viewCount: 2360 },
  { id: 'dm-3d-modeling', gradeId: 'sophomore_spring', name: '三维建模与动画', isHot: true, viewCount: 3120 },
  { id: 'dm-motion-graphics', gradeId: 'sophomore_spring', name: '动态图形设计', isHot: false, viewCount: 1860 },
  { id: 'dm-web-design', gradeId: 'junior_fall', name: '网页设计与交互', isHot: true, viewCount: 2890 },
  { id: 'dm-ui-ux', gradeId: 'junior_fall', name: 'UI/UX 设计', isHot: true, viewCount: 3210 },
  { id: 'dm-video-edit', gradeId: 'junior_spring', name: '影视后期与剪辑', isHot: true, viewCount: 2740 },
  { id: 'dm-final-project', gradeId: 'senior_spring', name: '数字媒体毕业作品', isHot: false, viewCount: 980 },

  // —— 电子信息工程专业课程 ——
  { id: 'ei-circuit', gradeId: 'freshman_fall', name: '电路分析基础', isHot: false, viewCount: 1820 },
  { id: 'ei-c-lang', gradeId: 'freshman_spring', name: 'C 语言程序设计 (电信)', isHot: true, viewCount: 2640 },
  { id: 'ei-analog', gradeId: 'sophomore_fall', name: '模拟电子技术', isHot: false, viewCount: 1980 },
  { id: 'ei-digital', gradeId: 'sophomore_spring', name: '数字电子技术', isHot: true, viewCount: 2360 },
  { id: 'ei-signal-system', gradeId: 'junior_fall', name: '信号与系统', isHot: true, viewCount: 2540 },
  { id: 'ei-mcu', gradeId: 'junior_spring', name: '单片机原理与应用', isHot: true, viewCount: 2870 },
  { id: 'ei-embedded', gradeId: 'junior_spring', name: '嵌入式系统设计', isHot: false, viewCount: 1980 },
  { id: 'ei-comm', gradeId: 'senior_fall', name: '通信原理', isHot: false, viewCount: 1620 },

];

// ==========================================
// 3.1 专业数据
// ==========================================
const majors = [
  { id: 'info_computing', name: '信息与计算科学', sortOrder: 1 },
  { id: 'digital_media', name: '数字媒体', sortOrder: 2 },
  { id: 'electronic_info', name: '电子信息工程', sortOrder: 3 }
];

// ==========================================
// 3.2 专业-课程关联 (决定不同专业学生在个人页看到的课程)
// 说明：courseId 必须在上方 courses 中实际存在；
//      主键为 (majorId, courseId)，同一专业不能重复关联同一 courseId。
// ==========================================
const majorCourses = [
  // —— 信息与计算科学 (按年级 + sortOrder 排列) ——
  // 大一上
  { majorId: 'info_computing', courseId: 'pdp', sortOrder: 1 },
  { majorId: 'info_computing', courseId: 'math-analysis', sortOrder: 2 },
  { majorId: 'info_computing', courseId: 'advanced-algebra', sortOrder: 3 },
  { majorId: 'info_computing', courseId: 'cs-intro', sortOrder: 4 },

  // 大一下
  { majorId: 'info_computing', courseId: 'analytic-geometry', sortOrder: 5 },
  { majorId: 'info_computing', courseId: 'data-science-intro', sortOrder: 6 },

  // 大二上
  { majorId: 'info_computing', courseId: 'data-structure', sortOrder: 7 },
  { majorId: 'info_computing', courseId: 'program-design', sortOrder: 8 },
  { majorId: 'info_computing', courseId: 'advanced-physics', sortOrder: 9 },
  { majorId: 'info_computing', courseId: 'probability-statistics', sortOrder: 10 },
  { majorId: 'info_computing', courseId: 'exploratory-data-analysis', sortOrder: 11 },
  { majorId: 'info_computing', courseId: 'ordinary-diff-equation', sortOrder: 12 },

  // 大二下
  { majorId: 'info_computing', courseId: 'data-science', sortOrder: 13 },
  { majorId: 'info_computing', courseId: 'ai', sortOrder: 14 },
  { majorId: 'info_computing', courseId: 'computer-network', sortOrder: 15 },
  { majorId: 'info_computing', courseId: 'math-model', sortOrder: 16 },
  { majorId: 'info_computing', courseId: 'numerical-model', sortOrder: 17 },

  // 大三上
  { majorId: 'info_computing', courseId: 'linear-programming', sortOrder: 18 },
  { majorId: 'info_computing', courseId: 'ml', sortOrder: 19 }, // 注： courses 中 ml 出现于大三上/大四上/大四下， id 重复会被后写的覆盖
  { majorId: 'info_computing', courseId: 'database', sortOrder: 20 },
  { majorId: 'info_computing', courseId: 'dsp-fundamentals', sortOrder: 21 },
  { majorId: 'info_computing', courseId: 'diff-equation', sortOrder: 22 },

  // 大三下
  { majorId: 'info_computing', courseId: 'block-chain', sortOrder: 23 },
  { majorId: 'info_computing', courseId: 'graph-theory', sortOrder: 24 },
  { majorId: 'info_computing', courseId: 'bayesian', sortOrder: 25 },
  { majorId: 'info_computing', courseId: 'complex-networks', sortOrder: 26 },
  { majorId: 'info_computing', courseId: 'dl', sortOrder: 27 },

  // —— 数字媒体专业（仅展示数字媒体自己的课程，不与信息与计算科学共享） ——
  { majorId: 'digital_media', courseId: 'dm-design-basics', sortOrder: 1 },
  { majorId: 'digital_media', courseId: 'dm-color-theory', sortOrder: 2 },
  { majorId: 'digital_media', courseId: 'dm-image-process', sortOrder: 3 },
  { majorId: 'digital_media', courseId: 'dm-typography', sortOrder: 4 },
  { majorId: 'digital_media', courseId: 'dm-graphic-design', sortOrder: 5 },
  { majorId: 'digital_media', courseId: 'dm-3d-modeling', sortOrder: 6 },
  { majorId: 'digital_media', courseId: 'dm-motion-graphics', sortOrder: 7 },
  { majorId: 'digital_media', courseId: 'dm-web-design', sortOrder: 8 },
  { majorId: 'digital_media', courseId: 'dm-ui-ux', sortOrder: 9 },
  { majorId: 'digital_media', courseId: 'dm-video-edit', sortOrder: 10 },
  { majorId: 'digital_media', courseId: 'dm-final-project', sortOrder: 11 },

  // —— 电子信息工程专业（仅展示电子信息工程自己的课程） ——
  { majorId: 'electronic_info', courseId: 'ei-circuit', sortOrder: 1 },
  { majorId: 'electronic_info', courseId: 'ei-c-lang', sortOrder: 2 },
  { majorId: 'electronic_info', courseId: 'ei-analog', sortOrder: 3 },
  { majorId: 'electronic_info', courseId: 'ei-digital', sortOrder: 4 },
  { majorId: 'electronic_info', courseId: 'ei-signal-system', sortOrder: 5 },
  { majorId: 'electronic_info', courseId: 'ei-mcu', sortOrder: 6 },
  { majorId: 'electronic_info', courseId: 'ei-embedded', sortOrder: 7 },
  { majorId: 'electronic_info', courseId: 'ei-comm', sortOrder: 8 }

  // 说明：三个专业的 courseId 完全互斥，不存在共享课程；
  //      另外 schema 里 (majorId, courseId) 是复合主键，天然保证了严格隔离。
];

// ==========================================
// 3.3 批量学生数据 (3 个专业 × 5 人)
// ==========================================
const students = [
  // —— 信息与计算科学 ——
  { phone: '13900000101', nickname: '信息小赵', school: '海南大学',         majorId: 'info_computing',  major: '信息与计算科学', gradeId: 'junior_fall' },
  { phone: '13900000102', nickname: '信息小钱', school: '海南师范大学',     majorId: 'info_computing',  major: '信息与计算科学', gradeId: 'sophomore_fall' },
  { phone: '13900000103', nickname: '信息小孙', school: '海南热带海洋学院', majorId: 'info_computing',  major: '信息与计算科学', gradeId: 'junior_spring' },
  { phone: '13900000104', nickname: '信息小李', school: '海南医学院',       majorId: 'info_computing',  major: '信息与计算科学', gradeId: 'senior_fall' },
  { phone: '13900000105', nickname: '信息小周', school: '海南大学',         majorId: 'info_computing',  major: '信息与计算科学', gradeId: 'sophomore_spring' },

  // —— 数字媒体 ——
  { phone: '13900000201', nickname: '媒体小吴', school: '海南大学',           majorId: 'digital_media', major: '数字媒体', gradeId: 'junior_fall' },
  { phone: '13900000202', nickname: '媒体小郑', school: '海南师范大学',       majorId: 'digital_media', major: '数字媒体', gradeId: 'sophomore_fall' },
  { phone: '13900000203', nickname: '媒体小王', school: '海南科技职业学院',   majorId: 'digital_media', major: '数字媒体', gradeId: 'junior_spring' },
  { phone: '13900000204', nickname: '媒体小冯', school: '三亚学院',           majorId: 'digital_media', major: '数字媒体', gradeId: 'senior_fall' },
  { phone: '13900000205', nickname: '媒体小陈', school: '海南大学',           majorId: 'digital_media', major: '数字媒体', gradeId: 'freshman_spring' },

  // —— 电子信息工程 ——
  { phone: '13900000301', nickname: '电子小褚', school: '海南大学',           majorId: 'electronic_info', major: '电子信息工程', gradeId: 'junior_fall' },
  { phone: '13900000302', nickname: '电子小卫', school: '海南师范大学',       majorId: 'electronic_info', major: '电子信息工程', gradeId: 'sophomore_fall' },
  { phone: '13900000303', nickname: '电子小蒋', school: '海南热带海洋学院',   majorId: 'electronic_info', major: '电子信息工程', gradeId: 'junior_spring' },
  { phone: '13900000304', nickname: '电子小沈', school: '海口经济学院',       majorId: 'electronic_info', major: '电子信息工程', gradeId: 'senior_fall' },
  { phone: '13900000305', nickname: '电子小韩', school: '海南大学',           majorId: 'electronic_info', major: '电子信息工程', gradeId: 'sophomore_spring' }
];

// ==========================================
// 4. 作业数据 (18条真实模拟数据)
// ==========================================
const assignments = [
  {
    id: 'a-c-001', courseId: 'c-lang',
    title: '数组与函数：学生成绩统计系统', summary: '实现成绩录入、均值、最高分、最低分和排序输出。',
    difficulty: 'easy', assignmentType: 'coding', viewCount: 2381, favoriteCount: 321, isFreeFull: true
  },
  {
    id: 'a-c-002', courseId: 'c-lang',
    title: '结构体与文件读写：图书管理系统', summary: '使用结构体数组保存图书信息，并通过文件实现数据持久化。',
    difficulty: 'medium', assignmentType: 'project', viewCount: 1760, favoriteCount: 218, isFreeFull: false
  },
  {
    id: 'a-c-003', courseId: 'c-lang',
    title: '指针与字符串：简易文本统计工具', summary: '统计字符数、单词数和关键词出现次数，训练指针与字符串处理。',
    difficulty: 'medium', assignmentType: 'coding', viewCount: 2115, favoriteCount: 286, isFreeFull: false
  },
  {
    id: 'a-dm-001', courseId: 'discrete-math',
    title: '命题逻辑与真值表推导', summary: '围绕复合命题、等价变换和真值表构造进行系统练习。',
    difficulty: 'easy', assignmentType: 'theory', viewCount: 1460, favoriteCount: 192, isFreeFull: true
  },
  {
    id: 'a-dm-002', courseId: 'discrete-math',
    title: '图论基础：最短路径与连通性分析', summary: '理解图的表示、连通分量、BFS 与最短路径建模。',
    difficulty: 'medium', assignmentType: 'theory', viewCount: 1688, favoriteCount: 224, isFreeFull: false
  },
  {
    id: 'a-ds-001', courseId: 'data-structure',
    title: '链表反转与环检测综合题', summary: '掌握链表指针操作、快慢指针与边界条件。',
    difficulty: 'medium', assignmentType: 'coding', viewCount: 4188, favoriteCount: 812, isFreeFull: false
  },
  {
    id: 'a-ds-002', courseId: 'data-structure',
    title: '栈与队列：表达式求值器', summary: '实现中缀表达式转后缀表达式，并完成四则运算求值。',
    difficulty: 'medium', assignmentType: 'coding', viewCount: 3320, favoriteCount: 501, isFreeFull: false
  },
  {
    id: 'a-ds-003', courseId: 'data-structure',
    title: '二叉树遍历与层序输出', summary: '实现前序、中序、后序和层序遍历，并分析递归与非递归写法。',
    difficulty: 'medium', assignmentType: 'coding', viewCount: 3742, favoriteCount: 548, isFreeFull: false
  },
  {
    id: 'a-db-001', courseId: 'database',
    title: '学生选课系统 SQL 查询设计', summary: '围绕多表连接、聚合统计、子查询和索引优化展开。',
    difficulty: 'medium', assignmentType: 'project', viewCount: 3560, favoriteCount: 604, isFreeFull: false
  },
  {
    id: 'a-db-002', courseId: 'database',
    title: '事务隔离级别与并发异常分析', summary: '通过案例理解脏读、不可重复读、幻读以及不同隔离级别的取舍。',
    difficulty: 'hard', assignmentType: 'theory', viewCount: 2266, favoriteCount: 336, isFreeFull: false
  },
  {
    id: 'a-db-003', courseId: 'database',
    title: '索引优化与慢查询分析实验', summary: '使用 explain 分析查询计划，比较不同索引策略的性能差异。',
    difficulty: 'hard', assignmentType: 'project', viewCount: 2498, favoriteCount: 389, isFreeFull: false
  },
  {
    id: 'a-os-001', courseId: 'os',
    title: '进程调度算法模拟实验', summary: '实现 FCFS、SJF、RR 调度，并分析平均等待时间。',
    difficulty: 'hard', assignmentType: 'coding', viewCount: 2892, favoriteCount: 455, isFreeFull: false
  },
  {
    id: 'a-os-002', courseId: 'os',
    title: '页面置换算法模拟实验', summary: '实现 FIFO、LRU、OPT 页面置换策略，并对比缺页率。',
    difficulty: 'hard', assignmentType: 'coding', viewCount: 2540, favoriteCount: 402, isFreeFull: false
  },
  {
    id: 'a-net-001', courseId: 'network',
    title: 'TCP 三次握手与拥塞控制分析', summary: '理解连接建立、可靠传输、慢启动和拥塞避免。',
    difficulty: 'medium', assignmentType: 'theory', viewCount: 3016, favoriteCount: 512, isFreeFull: false
  },
  {
    id: 'a-net-002', courseId: 'network',
    title: 'HTTP 请求流程与缓存机制分析', summary: '从 DNS、TCP、TLS 到 HTTP 缓存，梳理一次网页请求的完整链路。',
    difficulty: 'medium', assignmentType: 'theory', viewCount: 2810, favoriteCount: 466, isFreeFull: false
  },
  {
    id: 'a-ml-001', courseId: 'ml',
    title: '线性回归与梯度下降实验', summary: '实现线性回归训练、损失函数可视化和参数调优。',
    difficulty: 'hard', assignmentType: 'project', viewCount: 1980, favoriteCount: 277, isFreeFull: false
  },
  {
    id: 'a-ml-002', courseId: 'ml',
    title: '分类模型评估：准确率、召回率与 F1', summary: '构造混淆矩阵，理解不同评估指标在真实业务中的适用场景。',
    difficulty: 'medium', assignmentType: 'project', viewCount: 1875, favoriteCount: 246, isFreeFull: false
  },
  {
    id: 'a-career-001', courseId: 'career-project',
    title: '毕业设计选题：AI 辅助学习平台原型', summary: '从需求分析、功能拆解、技术选型到 MVP 展示，完成毕设选题规划。',
    difficulty: 'medium', assignmentType: 'project', viewCount: 1598, favoriteCount: 198, isFreeFull: false
  },
  {
    id: 'a-career-002', courseId: 'career-project',
    title: '简历项目包装：课程作业到工程项目', summary: '将课程实验延展为可展示的项目经历，突出技术难点和个人贡献。',
    difficulty: 'easy', assignmentType: 'project', viewCount: 2218, favoriteCount: 367, isFreeFull: false
  }
];

// ==========================================
// 5. 作业详情模块生成逻辑
// ==========================================
function generateModulesForAssignment(assignment) {
  const title = assignment.title;
  return [
    {
      moduleType: 'overview', title: '作业概要', requiredLevel: 'free',
      content: `【${title}】适合用于训练课程核心概念、作业拆解能力和规范化表达能力。在这里你可以先了解这道题的核心考点，评估自己是否掌握了对应的知识。`
    },
    {
      moduleType: 'thinking_guide', title: '思路引导', requiredLevel: 'free',
      content: '建议先明确题目输入输出、关键知识点和边界条件，再拆分为可逐步完成的小任务。不要急于写代码，先用伪代码或流程图理清思路。'
    },
    {
      moduleType: 'knowledge_preview', title: '基础知识点预览', requiredLevel: 'free',
      content: '本题会涉及课程基础概念、常见解题范式、实验报告表达和结果验证方法。重点复习本章节老师强调的核心算法。'
    },
    {
      moduleType: 'full_solution', title: '完整参考解析', requiredLevel: 'study',
      content: `关于【${title}】的完整解析：\n\n1. 题目理解：明确输入参数和预期输出。\n2. 关键步骤：拆解核心循环和判断逻辑。\n3. 实现方案：提供清晰、带注释的参考代码。\n4. 易错点：比如数组越界、空指针、内存泄漏等常见错误提醒。\n5. 结果校验：提供多组测试用例供你验证。`
    },
    {
      moduleType: 'full_knowledge', title: '完整知识点提炼', requiredLevel: 'study',
      content: '我们会把本题相关概念整理成复习框架。这不仅仅是一道题的解法，更是整个知识模块的缩影，方便你用于期末复习、撰写实验报告以及同类题目的迁移。'
    },
    {
      moduleType: 'enterprise_case', title: '企业实际应用案例', requiredLevel: 'career',
      content: '在真实的互联网大厂中，这个知识点通常用于什么场景？例如：大厂的订单统计系统、高并发缓存设计、网络异常重试机制等。掌握这些能让你在面试时脱颖而出。'
    },
    {
      moduleType: 'ai_implementation', title: 'AI 技术实现展示', requiredLevel: 'career',
      content: '如何用 ChatGPT 或 Copilot 等 AI 工具辅助完成这道题？这里会展示优秀的提示词（Prompt）工程，教你如何让 AI 帮你写测试用例、优化代码复杂度。'
    },
    {
      moduleType: 'extension_project', title: '扩展知识与项目实战', requiredLevel: 'career',
      content: '教你如何把这道简单的课程作业，包装升级成一个可以写进简历的“亮点项目”。补充项目目标、技术难点攻克过程和简历上的专业表达建议。'
    }
  ];
}

async function main() {
  console.log('开始写入初始数据 (Seed)...');

  // 1. 写入年级
  for (const g of grades) {
    await prisma.grade.upsert({
      where: { id: g.id },
      update: g,
      create: g,
    });
  }
  console.log('✅ 年级数据写入完成');

  // 2. 写入会员套餐
  for (const p of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: p.id },
      update: p,
      create: p,
    });
  }
  console.log('✅ 会员套餐写入完成');

  // 3. 写入课程
  for (const c of courses) {
    await prisma.course.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }
  console.log('✅ 课程数据写入完成');

  // 3.1 写入专业
  for (const m of majors) {
    await prisma.major.upsert({
      where: { id: m.id },
      update: m,
      create: m,
    });
  }
  console.log('✅ 专业数据写入完成');

  // 3.2 写入专业-课程关联（先清空后重建，保证顺序一致）
  await prisma.majorCourse.deleteMany();
  for (const mc of majorCourses) {
    await prisma.majorCourse.create({ data: mc });
  }
  console.log(`✅ 专业-课程关联 ${majorCourses.length} 条写入完成`);

  // 4. 写入作业
  for (const a of assignments) {
    await prisma.assignment.upsert({
      where: { id: a.id },
      update: a,
      create: a,
    });
  }
  console.log(`✅ ${assignments.length} 条真实作业资源写入完成`);

  // 5. 写入作业模块 (先清空后写入，避免重复叠加)
  await prisma.assignmentModule.deleteMany();
  
  let moduleCount = 0;
  for (const a of assignments) {
    const modules = generateModulesForAssignment(a);
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      await prisma.assignmentModule.create({
        data: {
          id: `${m.moduleType}-${a.id}`,
          assignmentId: a.id,
          moduleType: m.moduleType,
          title: m.title,
          requiredLevel: m.requiredLevel,
          content: m.content,
          previewContent: m.content.slice(0, 52) + '...',
          sortOrder: i + 1
        }
      });
      moduleCount++;
    }
  }
  console.log(`✅ ${moduleCount} 条作业详情模块写入完成`);



  // 6. 批量写入三个专业的学生（幂等：同手机号重复运行不会报错）
  // 同时随机赋予每个学生可访问的年级权限 accessibleGradeIds：
  //   规则：当前年级 gradeId 必须解锁 + 随机额外 1~3 个其他年级
  const allGradeIds = grades.map((g) => g.id);
  function pickRandomGradeIds(currentGradeId) {
    const others = allGradeIds.filter((id) => id !== currentGradeId);
    // 洗牌 (Fisher–Yates)
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const extraCount = 1 + Math.floor(Math.random() * 3); // 1~3 个
    const extras = others.slice(0, extraCount);
    return [currentGradeId, ...extras];
  }

  for (const s of students) {
    const accessibleGradeIds = pickRandomGradeIds(s.gradeId);
    await prisma.user.upsert({
      where: { phone: s.phone },
      update: {
        nickname: s.nickname,
        school: s.school,
        major: s.major,
        majorId: s.majorId,
        gradeId: s.gradeId,
        accessibleGradeIds,
      },
      create: {
        phone: s.phone,
        nickname: s.nickname,
        school: s.school,
        major: s.major,
        majorId: s.majorId,
        gradeId: s.gradeId,
        accessibleGradeIds,
      },
    });
    console.log(`   · ${s.nickname}(${s.phone}) 解锁年级：${accessibleGradeIds.join(', ')}`);
  }
  console.log(`✅ 批量写入 ${students.length} 名三专业学生完成`);

  console.log('🎉 18条真实模拟数据初始化全部完成！你可以去前端页面查看了！');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
