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
// 3. 课程数据
// ==========================================
const courses = [
  { id: 'c-lang', gradeId: 'freshman_fall', name: 'C 语言程序设计', isHot: true, viewCount: 5280 },
  { id: 'discrete-math', gradeId: 'freshman_spring', name: '离散数学', isHot: false, viewCount: 2310 },
  { id: 'data-structure', gradeId: 'sophomore_fall', name: '数据结构', isHot: true, viewCount: 6890 },
  { id: 'database', gradeId: 'sophomore_spring', name: '数据库系统', isHot: true, viewCount: 4520 },
  { id: 'os', gradeId: 'junior_fall', name: '操作系统', isHot: true, viewCount: 5670 },
  { id: 'network', gradeId: 'junior_spring', name: '计算机网络', isHot: true, viewCount: 4890 },
  { id: 'ml', gradeId: 'senior_fall', name: '机器学习', isHot: true, viewCount: 7120 },
  { id: 'career-project', gradeId: 'senior_spring', name: '毕业设计与职业项目', isHot: false, viewCount: 1890 }
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
