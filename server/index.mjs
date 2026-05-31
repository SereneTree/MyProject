import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// ==========================================
// CORS 跨域配置
// ==========================================
// 支持两种白名单方式，二者可同时生效：
// 1. CORS_ORIGINS：逗号分隔的精确字符串列表（完全匹配 origin）
//    示例：CORS_ORIGINS="https://example.com,https://www.example.com"
//    设为 '*' 或为空时放行所有来源（仅开发环境）。
// 2. CORS_ORIGIN_PATTERNS：逗号分隔的正则表达式源串（默认不区分大小写）
//    示例：CORS_ORIGIN_PATTERNS="^https?://([a-z0-9-]+\.)*neowhale\.cn$"
//    代码中还内置了一组默认正则，涵盖 *.neowhale.cn / localhost / 127.0.0.1。

const allowedOriginsEnv = (process.env.CORS_ORIGINS || '*').trim();
const allowAllOrigins = allowedOriginsEnv === '*' || allowedOriginsEnv === '';
const allowedOrigins = allowAllOrigins
  ? null
  : allowedOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean);

// 内置默认正则白名单：
// - http(s)://(任意子域.)neowhale.cn【作为主域名集中放行】
// - http(s)://localhost(:端口)
// - http(s)://127.0.0.1(:端口)
const defaultOriginPatterns = [
  /^https?:\/\/([a-z0-9-]+\.)*neowhale\.cn$/i,
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
];

// 环境变量提供的额外正则白名单（可选）
const envOriginPatterns = (process.env.CORS_ORIGIN_PATTERNS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((src) => {
    try {
      return new RegExp(src, 'i');
    } catch (e) {
      console.warn(`[CORS] 忽略非法正则: ${src} (${e.message})`);
      return null;
    }
  })
  .filter(Boolean);

const originPatterns = [...defaultOriginPatterns, ...envOriginPatterns];

const corsOptions = {
  origin(origin, callback) {
    // 同源请求、服务端互调、curl/Postman 等无 origin 场景一律放行
    if (!origin) return callback(null, true);
    if (allowAllOrigins) return callback(null, true);
    // 1) 精确白名单
    if (allowedOrigins && allowedOrigins.includes(origin)) return callback(null, true);
    // 2) 正则白名单（默认 + 环境变量补充）
    if (originPatterns.some((re) => re.test(origin))) return callback(null, true);
    return callback(new Error(`CORS 拒绝：未授权的来源 ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// 注：cors() 中间件已会自动响应预检（OPTIONS）请求，无需再调 app.options()。
// Express 5 + path-to-regexp 8 不再支持裸 '*' 通配路径，如需兑底可用 /(.*)/ 正则。

// CORS 错误统一返回 403，避免被 Express 默认 500 报错页出头流后丢头
app.use((err, req, res, next) => {
  if (err && typeof err.message === 'string' && err.message.startsWith('CORS 拒绝')) {
    return res.status(403).json({ message: err.message });
  }
  return next(err);
});

app.use(express.json());

// ==========================================
// 静态文件服务：课件下载目录
// ==========================================
// 将 server/public/files 下的文件映射到 /files 路径。
// 上传示例：
//   server/public/files/lectures/<courseId>.zip
//   访问地址：${API_BASE}/files/lectures/<courseId>.zip
// 生产环境推荐交由 nginx/OSS 提供，代码付始本地开发及轻量部署。
const publicFilesDir = path.resolve(__dirname, 'public/files');
app.use(
  '/files',
  express.static(publicFilesDir, {
    fallthrough: false,
    maxAge: '1d',
    setHeaders(res, filePath) {
      // 默认以附件形式下载，避免浏览器预览
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    },
  }),
);
// 静态文件不存在时统一返 404 JSON，不走默认 HTML 错误页
app.use('/files', (err, req, res, next) => {
  if (err && err.statusCode === 404) {
    return res.status(404).json({ message: '课件文件不存在，请联系管理员上传' });
  }
  return next(err);
});

// ==========================================
// 静态文件服务：学习笔记目录（markdown 在线预览，不强制下载）
// ==========================================
// server/public/notes/<courseId>/L<n>_*.md → GET /notes/<courseId>/<filename>
const publicNotesDir = path.resolve(__dirname, 'public/notes');
app.use(
  '/notes',
  express.static(publicNotesDir, {
    fallthrough: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.md')) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      }
    },
  }),
);
app.use('/notes', (err, req, res, next) => {
  if (err && err.statusCode === 404) {
    return res.status(404).json({ message: '笔记文件不存在' });
  }
  return next(err);
});

const memberRank = { free: 0, study: 1, career: 2 };

// ==========================================
// 用户对象统一序列化（登录/me/profile/orders 统一返回这一份字段）
// ==========================================
async function serializeUser(user) {
  if (!user) return null;
  // 若调用方传入的 user 没有 majorRef/grade 关联，再补查一次
  let majorName = user.majorRef?.name || user.major || null;
  let gradeName = user.grade?.name || null;
  if (!majorName && user.majorId) {
    const m = await prisma.major.findUnique({ where: { id: user.majorId } });
    majorName = m?.name || null;
  }
  if (!gradeName && user.gradeId) {
    const g = await prisma.grade.findUnique({ where: { id: user.gradeId } });
    gradeName = g?.name || null;
  }
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    school: user.school,
    major: user.major,
    majorId: user.majorId,
    majorName,
    gradeId: user.gradeId,
    gradeName,
    memberLevel: user.memberLevel,
    memberExpiresAt: user.memberExpiresAt,
    unlockedGradeIds: Array.isArray(user.accessibleGradeIds) ? user.accessibleGradeIds : []
  };
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^1\d{10}$/.test(phone);
}

// ==========================================
// A. 登录/注册：手机号+验证码（演示环境：任意 6 位数字）
// POST /api/auth/login  body: { phone, code }
// 不存在则自动创建一条 user 记录；已存在则直接返回
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '请输入正确的 11 位手机号' });
    }
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: '验证码为 6 位数字' });
    }
    // 演示环境：任意 6 位数字均通过。生产环境需在此对比短信验证码。
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        nickname: `同学${phone.slice(-4)}`,
        memberLevel: 'free'
      },
      include: { majorRef: true, grade: true }
    });
    res.json({ data: await serializeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '登录失败' });
  }
});

// ==========================================
// B. 当前用户信息：根据 phone 拉取（前端启动 + 刷新时调用）
// GET /api/auth/me?phone=xxx
// ==========================================
app.get('/api/auth/me', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '请提供合法的手机号' });
    }
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { majorRef: true, grade: true }
    });
    if (!user) {
      return res.status(404).json({ message: '用户不存在，请重新登录' });
    }
    res.json({ data: await serializeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取当前用户失败' });
  }
});

// ==========================================
// C. 更新当前用户资料
// PATCH /api/users/me  body: { phone, nickname?, school?, majorId?, gradeId? }
// 用 phone 标识身份（MVP 简化方案，未引入 token）
// ==========================================
app.patch('/api/users/me', async (req, res) => {
  try {
    const { phone, nickname, school, majorId, gradeId } = req.body || {};
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '缺少身份手机号' });
    }
    const exists = await prisma.user.findUnique({ where: { phone } });
    if (!exists) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const data = {};
    if (typeof nickname === 'string') data.nickname = nickname.trim() || null;
    if (typeof school === 'string') data.school = school.trim() || null;
    if (gradeId !== undefined) data.gradeId = gradeId || null;
    if (majorId !== undefined) {
      data.majorId = majorId || null;
      // 写入 major 名字快照，便于老接口与展示
      if (majorId) {
        const m = await prisma.major.findUnique({ where: { id: majorId } });
        data.major = m?.name || null;
      } else {
        data.major = null;
      }
    }
    // 校验 gradeId/majorId 合法性，避免外键约束错误
    if (data.gradeId) {
      const g = await prisma.grade.findUnique({ where: { id: data.gradeId } });
      if (!g) return res.status(400).json({ message: '非法年级 ID' });
    }

    const updated = await prisma.user.update({
      where: { phone },
      data,
      include: { majorRef: true, grade: true }
    });
    res.json({ data: await serializeUser(updated) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '更新资料失败' });
  }
});

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
// 3.5 课程资源列表（按 4 类分组返回）
// GET /api/courses/:id/resources?level=free|study|career
// ==========================================
app.get('/api/courses/:id/resources', async (req, res) => {
  try {
    const courseId = req.params.id;
    const level = String(req.query.level || 'free');
    const currentRank = memberRank[level] ?? 0;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { grade: true },
    });
    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    const resources = await prisma.courseResource.findMany({
      where: { courseId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    const categories = ['lecture', 'homework', 'exam', 'career'];
    const groups = categories.map((cat) => {
      const items = resources
        .filter((r) => r.category === cat)
        .map((r) => {
          const allowed = currentRank >= (memberRank[r.requiredLevel] || 0);
          return {
            id: r.id,
            courseId: r.courseId,
            category: r.category,
            subType: r.subType,
            title: r.title,
            summary: r.summary,
            requiredLevel: r.requiredLevel,
            locked: !allowed,
            viewCount: r.viewCount,
            sortOrder: r.sortOrder,
          };
        });
      return { category: cat, items };
    });

    res.json({
      data: {
        course: {
          id: course.id,
          name: course.name,
          gradeId: course.gradeId,
          gradeName: course.grade.name,
        },
        groups,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取课程资源失败' });
  }
});

// ==========================================
// 3.7 课程学习笔记列表接口
// GET /api/courses/:courseId/notes
// 扫描 server/public/notes/<courseId>/ 下的所有 *.md 文件，
// 返回 [{ filename, title, summary, order, url }]。
// 文件名不限定格式，L<n>_<title>.md 会被提取序号进行排序。
// ==========================================
app.get('/api/courses/:courseId/notes', async (req, res) => {
  try {
    const { courseId } = req.params;
    // 安全校验：只允许纯安全字符，防止路径穿越
    if (!/^[A-Za-z0-9_-]+$/.test(courseId)) {
      return res.status(400).json({ message: '非法课程 ID' });
    }
    const dir = path.join(publicNotesDir, courseId);
    if (!fs.existsSync(dir)) {
      return res.json({ data: [] });
    }
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const mdFiles = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name);

    const items = await Promise.all(
      mdFiles.map(async (filename) => {
        const fullPath = path.join(dir, filename);
        const stat = await fsp.stat(fullPath);
        // 只读前 4KB 提取标题与摘要，避免大文件占内存
        const fd = await fsp.open(fullPath, 'r');
        const buf = Buffer.alloc(Math.min(stat.size, 4096));
        await fd.read(buf, 0, buf.length, 0);
        await fd.close();
        const head = buf.toString('utf-8');

        // 提取 H1 作为标题，未命中则用文件名去后缀
        const h1 = head.match(/^#\s+(.+?)\s*$/m);
        const title = h1 ? h1[1].trim() : filename.replace(/\.md$/i, '');

        // 提取第一段非空、非标题、非引用的文本作为摘要
        const lines = head.split(/\r?\n/);
        let summary = '';
        for (const line of lines) {
          const t = line.trim();
          if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('```')) continue;
          summary = t.replace(/^[-*]\s+/, '').replace(/[*_`]/g, '');
          if (summary.length > 0) break;
        }
        if (summary.length > 120) summary = summary.slice(0, 120) + '…';

        // 提取文件名前缀序号作为排序依据：
        // - L1_xxx.md / 1-xxx.md → 1
        // - 第1章-xxx.md / 第 10 章xxx.md → 1 / 10
        // 未命中则为 Infinity，排在后面
        const orderMatch =
          filename.match(/^第\s*(\d+)\s*章/) ||
          filename.match(/^L?(\d+)[_\-\s]/i);
        const order = orderMatch ? Number(orderMatch[1]) : Number.POSITIVE_INFINITY;

        return {
          filename,
          title,
          summary,
          order,
          url: `/notes/${courseId}/${encodeURIComponent(filename)}`,
          size: stat.size,
        };
      }),
    );

    items.sort((a, b) => a.order - b.order || a.filename.localeCompare(b.filename));
    res.json({ data: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取学习笔记列表失败' });
  }
});

// ==========================================
// 3.6 课程资源详情接口（带会员权限控制）
// GET /api/resources/:id?level=free|study|career
// ==========================================
app.get('/api/resources/:id', async (req, res) => {
  try {
    const resourceId = req.params.id;
    const level = String(req.query.level || 'free');
    const currentRank = memberRank[level] ?? 0;

    const resource = await prisma.courseResource.findUnique({
      where: { id: resourceId },
      include: { course: { include: { grade: true } } },
    });
    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 浏览量 +1 (异步)
    prisma.courseResource
      .update({ where: { id: resourceId }, data: { viewCount: { increment: 1 } } })
      .catch(console.error);

    const allowed = currentRank >= (memberRank[resource.requiredLevel] || 0);

    const plans = await prisma.membershipPlan.findMany({ where: { isActive: true } });

    res.json({
      id: resource.id,
      courseId: resource.courseId,
      courseName: resource.course.name,
      gradeId: resource.course.gradeId,
      gradeName: resource.course.grade.name,
      category: resource.category,
      subType: resource.subType,
      title: resource.title,
      summary: resource.summary,
      requiredLevel: resource.requiredLevel,
      locked: !allowed,
      content: allowed ? resource.content : null,
      url: allowed ? resource.url : null,
      viewCount: resource.viewCount,
      plans,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取资源详情失败' });
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
// 5. 提交订单接口（演示环境：即时模拟支付成功，同步写 users.member_level）
// POST /api/orders  body: { phone, level }
// level=free 表示重置为免费（不创建订单，仅重置会员字段）
// ==========================================
app.post('/api/orders', async (req, res) => {
  try {
    const { level, phone } = req.body || {};
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '请先登录后再购买会员' });
    }
    if (!['free', 'study', 'career'].includes(level)) {
      return res.status(400).json({ message: '无效的会员等级' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 重置为免费：不创建订单，直接重置会员字段
    if (level === 'free') {
      const updated = await prisma.user.update({
        where: { phone },
        data: { memberLevel: 'free', memberExpiresAt: null },
        include: { majorRef: true, grade: true }
      });
      return res.json({ data: { order: null, user: await serializeUser(updated) } });
    }

    const plan = await prisma.membershipPlan.findUnique({ where: { level } });
    if (!plan) {
      return res.status(400).json({ message: '会员套餐不存在' });
    }

    // 计算会员到期时间：学期=180天，年=365天，永久=null
    const now = new Date();
    let expiresAt = null;
    if (plan.period === '学期') expiresAt = new Date(now.getTime() + 180 * 24 * 3600 * 1000);
    else if (plan.period === '年') expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
    else if (plan.period !== '永久') expiresAt = new Date(now.getTime() + 180 * 24 * 3600 * 1000);

    // 事务：写订单 + 同步会员状态
    const [order, updatedUser] = await prisma.$transaction([
      prisma.order.create({
        data: {
          id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: user.id,
          planId: plan.id,
          planLevel: plan.level,
          planName: plan.name,
          amount: plan.price,
          status: 'paid',
          paidAt: now
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { memberLevel: plan.level, memberExpiresAt: expiresAt },
        include: { majorRef: true, grade: true }
      })
    ]);

    res.json({ data: { order, user: await serializeUser(updatedUser) } });
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
