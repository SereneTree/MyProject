import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.mjs';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const memberRank = { free: 0, study: 1, career: 2 };

// ==========================================
// 1. 首页资源接口
// ==========================================
app.get('/api/resources/home', async (req, res) => {
  try {
    // 并行从数据库拉取数据
    const [grades, courses, assignments] = await Promise.all([
      prisma.grade.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.course.findMany(),
      prisma.assignment.findMany({
        where: { deletedAt: null },
        include: {
          course: {
            include: { grade: true }
          }
        }
      })
    ]);

    // 格式化输出匹配前端所需的数据结构
    const formattedAssignments = assignments.map(a => ({
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      summary: a.summary,
      difficulty: a.difficulty,
      assignmentType: a.assignmentType,
      viewCount: a.viewCount,
      favoriteCount: a.favoriteCount,
      isFreeFull: a.isFreeFull,
      courseName: a.course.name,
      gradeId: a.course.grade.id,
      gradeName: a.course.grade.name
    }));

    res.json({
      grades,
      courses,
      assignments: formattedAssignments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取资源失败' });
  }
});

// ==========================================
// 2. 搜索与筛选作业列表接口
// ==========================================
app.get('/api/assignments', async (req, res) => {
  try {
    const { gradeId, courseId, q } = req.query;
    
    // 构建查询条件
    const where = { deletedAt: null };
    
    if (courseId) {
      where.courseId = String(courseId);
    } else if (gradeId) {
      where.course = { gradeId: String(gradeId) };
    }
    
    if (q) {
      const keyword = String(q).trim();
      where.OR = [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { course: { name: { contains: keyword } } }
      ];
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        course: { include: { grade: true } }
      }
    });

    const formattedAssignments = assignments.map(a => ({
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      summary: a.summary,
      difficulty: a.difficulty,
      assignmentType: a.assignmentType,
      viewCount: a.viewCount,
      favoriteCount: a.favoriteCount,
      isFreeFull: a.isFreeFull,
      courseName: a.course.name,
      gradeId: a.course.grade.id,
      gradeName: a.course.grade.name
    }));

    res.json({ data: formattedAssignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取作业列表失败' });
  }
});

// ==========================================
// 3. 作业详情接口 (带权限控制)
// ==========================================
app.get('/api/assignments/:id', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const level = String(req.query.level || 'free');
    const currentRank = memberRank[level] ?? 0;

    // 获取作业基础信息
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId, deletedAt: null },
      include: {
        course: { include: { grade: true } }
      }
    });

    if (!assignment) {
      return res.status(404).json({ message: '作业不存在' });
    }

    // 更新浏览量 (异步执行，不阻塞接口返回)
    prisma.assignment.update({
      where: { id: assignmentId },
      data: { viewCount: { increment: 1 } }
    }).catch(console.error);

    // 获取作业详情模块
    const modules = await prisma.assignmentModule.findMany({
      where: { assignmentId },
      orderBy: { sortOrder: 'asc' }
    });

    // 权限过滤
    const filteredModules = modules.map(item => {
      const allowed = currentRank >= (memberRank[item.requiredLevel] || 0);
      return {
        id: item.id,
        moduleType: item.moduleType,
        title: item.title,
        requiredLevel: item.requiredLevel,
        locked: !allowed,
        content: allowed ? item.content : item.previewContent,
        previewContent: item.previewContent
      };
    });

    // 获取会员套餐数据，供前端展示升级引导
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true }
    });

    res.json({
      id: assignment.id,
      courseId: assignment.courseId,
      title: assignment.title,
      summary: assignment.summary,
      difficulty: assignment.difficulty,
      assignmentType: assignment.assignmentType,
      viewCount: assignment.viewCount,
      favoriteCount: assignment.favoriteCount,
      isFreeFull: assignment.isFreeFull,
      courseName: assignment.course.name,
      gradeId: assignment.course.grade.id,
      gradeName: assignment.course.grade.name,
      modules: filteredModules,
      plans
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取作业详情失败' });
  }
});

// ==========================================
// 4. 会员套餐列表接口
// ==========================================
app.get('/api/membership/plans', async (req, res) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true }
    });
    res.json({ data: plans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取套餐失败' });
  }
});

// ==========================================
// 5. 提交订单接口
// ==========================================
app.post('/api/orders', async (req, res) => {
  try {
    const { level } = req.body;
    
    const plan = await prisma.membershipPlan.findUnique({
      where: { level }
    });

    if (!plan || plan.level === 'free') {
      return res.status(400).json({ message: '无效的会员套餐' });
    }

    // 由于我们还没有真实用户登录，暂时用一个虚拟的测试用户 ID
    // 等后续接了登录系统后，这里要换成 req.user.id
    const mockUserId = 'user_test_001';
    
    // 如果数据库里没有这个测试用户，我们先临时建一个，以免外键报错
    await prisma.user.upsert({
      where: { id: mockUserId },
      update: {},
      create: { id: mockUserId, phone: '13800000000', nickname: '测试用户' }
    });

    // 创建订单记录到数据库
    const order = await prisma.order.create({
      data: {
        id: `order-${Date.now()}`,
        userId: mockUserId,
        planId: plan.id,
        planLevel: plan.level,
        planName: plan.name,
        amount: plan.price,
        status: 'paid', // 临时直接设置为已支付，等接入真实支付后再改
        paidAt: new Date()
      }
    });

    res.json({ data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '创建订单失败' });
  }
});

// ==========================================
// 6. 提交咨询意向接口
// ==========================================
app.post('/api/consultation/leads', async (req, res) => {
  try {
    const { name, contact, school, major, gradeId, goal, description } = req.body;
    
    if (!name || !contact || !description) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    const lead = await prisma.consultationLead.create({
      data: {
        id: `lead-${Date.now()}`,
        name,
        contact,
        school,
        major,
        gradeId,
        goal,
        description,
        status: 'new'
      }
    });

    res.json({ data: lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '提交咨询失败' });
  }
});

// ==========================================
// 7. 管理后台统计接口
// ==========================================
app.get('/api/admin/summary', async (req, res) => {
  try {
    const [usersCount, assignmentsCount, ordersCount, leadsCount] = await Promise.all([
      prisma.user.count(),
      prisma.assignment.count({ where: { deletedAt: null } }),
      prisma.order.count(),
      prisma.consultationLead.count()
    ]);

    // 简单计算一下付费转化率
    const conversionRate = usersCount > 0 
      ? ((ordersCount / usersCount) * 100).toFixed(1) + '%'
      : '0.0%';

    res.json({
      data: {
        users: usersCount,
        assignments: assignmentsCount,
        orders: ordersCount,
        consultationLeads: leadsCount,
        conversionRate
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

// ==========================================
// 8. 管理后台获取咨询列表
// ==========================================
app.get('/api/admin/consultation-leads', async (req, res) => {
  try {
    const leads = await prisma.consultationLead.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取咨询列表失败' });
  }
});

// ==========================================
// 9. 专业列表接口 (供个人页下拉选择)
// ==========================================
app.get('/api/majors', async (req, res) => {
  try {
    const majors = await prisma.major.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ data: majors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取专业列表失败' });
  }
});

// ==========================================
// 10. 根据手机号获取用户信息及其专业课程
//     前端个人页登录后调用，返回该用户专业下的全部课程（用于展示不同专业看到不同课程）
// ==========================================
app.get('/api/users/courses', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!phone) {
      return res.status(400).json({ message: '缺少手机号参数' });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { majorRef: true, grade: true }
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 未绑定专业的用户返回空列表
    if (!user.majorId) {
      return res.json({
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            school: user.school,
            major: user.major,
            majorId: user.majorId,
            majorName: null,
            gradeId: user.gradeId,
            gradeName: user.grade?.name || null,
            unlockedGradeIds: Array.isArray(user.accessibleGradeIds) ? user.accessibleGradeIds : []
          },
          courses: []
        }
      });
    }

    // 拉取该专业下的课程（含年级信息）
    const majorCourses = await prisma.majorCourse.findMany({
      where: { majorId: user.majorId },
      orderBy: { sortOrder: 'asc' },
      include: {
        course: { include: { grade: true } }
      }
    });

    const courses = majorCourses.map(mc => ({
      id: mc.course.id,
      name: mc.course.name,
      gradeId: mc.course.gradeId,
      gradeName: mc.course.grade.name,
      isHot: mc.course.isHot,
      viewCount: mc.course.viewCount,
      sortOrder: mc.sortOrder
    }));

    res.json({
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          school: user.school,
          major: user.major,
          majorId: user.majorId,
          majorName: user.majorRef?.name || user.major || null,
          gradeId: user.gradeId,
          gradeName: user.grade?.name || null,
          unlockedGradeIds: Array.isArray(user.accessibleGradeIds) ? user.accessibleGradeIds : []
        },
        courses
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取用户课程失败' });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
