import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.mjs';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

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
// 源文件位于仓库根目录的 public/notes/<courseId>/*.md，
// 依靠 vite 构建时拷贝到 dist/notes/，生产环境由 nginx 直接服务。
// 开发环境仍然由本处 express.static 提供，路径一致。
const publicNotesDir = path.resolve(__dirname, '../public/notes');
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

// ==========================================
// 静态文件服务：互联网大厂实际应用 / 岗位背景提升与面试准备
// 源文件位于 public/<section>/<courseId>/*.md
// section: practical | interview
// ==========================================
const publicPracticalDir = path.resolve(__dirname, '../public/practical');
const publicInterviewDir = path.resolve(__dirname, '../public/interview');
for (const [route, dir] of [
  ['/practical', publicPracticalDir],
  ['/interview', publicInterviewDir],
]) {
  app.use(
    route,
    express.static(dir, {
      fallthrough: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.md')) {
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        }
      },
    }),
  );
  app.use(route, (err, req, res, next) => {
    if (err && err.statusCode === 404) {
      return res.status(404).json({ message: '文档不存在' });
    }
    return next(err);
  });
}

// ==========================================
// 通用 markdown 文档目录扫描工具
// 给定根目录下的某课程子目录，提取每个 *.md 的标题、摘要、序号
// ==========================================
async function scanCourseDocs(rootDir, urlPrefix, courseId) {
  const dir = path.join(rootDir, courseId);
  if (!fs.existsSync(dir)) return [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map((e) => e.name);

  const items = await Promise.all(
    mdFiles.map(async (filename) => {
      const fullPath = path.join(dir, filename);
      const stat = await fsp.stat(fullPath);
      const fd = await fsp.open(fullPath, 'r');
      const buf = Buffer.alloc(Math.min(stat.size, 4096));
      await fd.read(buf, 0, buf.length, 0);
      await fd.close();
      const head = buf.toString('utf-8');
      const h1 = head.match(/^#\s+(.+?)\s*$/m);
      const title = h1 ? h1[1].trim() : filename.replace(/\.md$/i, '');

      const lines = head.split(/\r?\n/);
      let summary = '';
      for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('```')) continue;
        summary = t.replace(/^[-*]\s+/, '').replace(/[*_`]/g, '');
        if (summary.length > 0) break;
      }
      if (summary.length > 120) summary = summary.slice(0, 120) + '…';

      // 文件名前缀 01-xxx.md / 第1章xxx.md / Lec01_xxx.md / 1-xxx.md → 1
      const orderMatch =
        filename.match(/^第\s*(\d+)\s*章/) ||
        filename.match(/^Lec(?:ture)?[_\s]*(\d+)/i) ||
        filename.match(/^(\d+)[\-_\s]/);
      const order = orderMatch ? Number(orderMatch[1]) : Number.POSITIVE_INFINITY;

      // README 单独排到最前
      const isReadme = /^readme\.md$/i.test(filename);

      return {
        filename,
        title,
        summary,
        order: isReadme ? -1 : order,
        isReadme,
        url: `${urlPrefix}/${encodeURIComponent(courseId)}/${encodeURIComponent(filename)}`,
        size: stat.size,
      };
    }),
  );

  items.sort((a, b) => a.order - b.order || a.filename.localeCompare(b.filename));
  return items;
}

// 课程 ID → 中文名称映射（用于二级页面课程卡片展示）
// 后续新增课程子目录时，在此追加映射即可。
const DOCS_COURSE_NAME_MAP = {
  database: '数据库',
  dl: '深度学习',
};

// ==========================================
// GET /api/docs/:section/courses
// 列出 public/<section> 下所有课程子目录（每个目录视作一门课程）
// section ∈ {practical, interview}
// ==========================================
app.get('/api/docs/:section/courses', async (req, res) => {
  try {
    const { section } = req.params;
    const rootMap = { practical: publicPracticalDir, interview: publicInterviewDir };
    const root = rootMap[section];
    if (!root) return res.status(400).json({ message: '非法 section' });
    if (!fs.existsSync(root)) return res.json({ data: [] });

    const entries = await fsp.readdir(root, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const items = await Promise.all(
      dirs.map(async (courseId) => {
        const sub = await fsp.readdir(path.join(root, courseId), { withFileTypes: true });
        const count = sub.filter(
          (e) => e.isFile() && e.name.toLowerCase().endsWith('.md') && !/^readme\.md$/i.test(e.name),
        ).length;
        return {
          courseId,
          name: DOCS_COURSE_NAME_MAP[courseId] || courseId,
          count,
        };
      }),
    );
    items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    res.json({ data: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取课程列表失败' });
  }
});

// ==========================================
// GET /api/docs/:section/courses/:courseId
// 返回某课程目录下的所有 markdown 文档列表
// ==========================================
app.get('/api/docs/:section/courses/:courseId', async (req, res) => {
  try {
    const { section, courseId } = req.params;
    if (!/^[A-Za-z0-9_-]+$/.test(courseId)) {
      return res.status(400).json({ message: '非法课程 ID' });
    }
    const rootMap = {
      practical: { dir: publicPracticalDir, prefix: '/practical' },
      interview: { dir: publicInterviewDir, prefix: '/interview' },
    };
    const cfg = rootMap[section];
    if (!cfg) return res.status(400).json({ message: '非法 section' });

    const items = await scanCourseDocs(cfg.dir, cfg.prefix, courseId);
    res.json({
      data: {
        section,
        courseId,
        courseName: DOCS_COURSE_NAME_MAP[courseId] || courseId,
        items,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取文档列表失败' });
  }
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
// 3.6 大作业题目解析列表
// GET /api/assignment/:courseId/solutions
// 扫描 public/assignment/<courseId>/solutions/ 下的 markdown 文件
// ==========================================
app.get('/api/assignment/:courseId/solutions', async (req, res) => {
  try {
    const { courseId } = req.params;
    // 安全校验
    if (/[\/\\\.]/.test(courseId)) {
      return res.status(400).json({ message: '非法 courseId' });
    }
    const rootDir = path.resolve(__dirname, '../public/assignment', courseId);
    const urlPrefix = `/assignment/${encodeURIComponent(courseId)}`;
    const items = await scanCourseDocs(rootDir, urlPrefix, 'solutions');
    res.json({ data: { courseId, items } });
  } catch (error) {
    console.error('[assignment solutions]', error);
    res.status(500).json({ message: '获取题目解析失败' });
  }
});

// ==========================================
// 3.6b 考试试卷材料列表
// GET /api/test/:courseId/materials
// 扫描 public/test/<courseId>/material/ 下的所有文件（PDF等）
// ==========================================
app.get('/api/test/:courseId/materials', async (req, res) => {
  try {
    const { courseId } = req.params;
    if (/[\/\\.]/.test(courseId)) {
      return res.status(400).json({ message: '非法 courseId' });
    }
    const dir = path.resolve(__dirname, `../public/test/${courseId}/material`);
    if (!fs.existsSync(dir)) {
      return res.json({ data: { courseId, items: [] } });
    }
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dir, entry.name);
      const stat = await fsp.stat(fullPath);
      items.push({
        filename: entry.name,
        url: `/test/${encodeURIComponent(courseId)}/material/${encodeURIComponent(entry.name)}`,
        size: stat.size,
      });
    }
    res.json({ data: { courseId, items } });
  } catch (error) {
    console.error('[test materials]', error);
    res.status(500).json({ message: '获取考试试卷列表失败' });
  }
});

// ==========================================
// 3.6c 考试题目解析列表
// GET /api/test/:courseId/solutions
// 扫描 public/test/<courseId>/solutions/ 下的 markdown 文件
// ==========================================
app.get('/api/test/:courseId/solutions', async (req, res) => {
  try {
    const { courseId } = req.params;
    if (/[\/\\.]/.test(courseId)) {
      return res.status(400).json({ message: '非法 courseId' });
    }
    const rootDir = path.resolve(__dirname, '../public/test', courseId);
    const urlPrefix = `/test/${encodeURIComponent(courseId)}`;
    const items = await scanCourseDocs(rootDir, urlPrefix, 'solutions');
    res.json({ data: { courseId, items } });
  } catch (error) {
    console.error('[test solutions]', error);
    res.status(500).json({ message: '获取考试题目解析失败' });
  }
});

// ==========================================
// 3.7 大作业资料打包下载
// GET /api/resources/material/download/:courseId
// 将 public/assignment/<courseId>/material 下所有文件打包为 zip 流式下载
// ==========================================
app.get('/api/resources/material/download/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const materialDir = path.resolve(__dirname, `../public/assignment/${courseId}/material`);

    // 安全检查：防止路径穿越
    const publicAssignDir = path.resolve(__dirname, '../public/assignment');
    if (!materialDir.startsWith(publicAssignDir)) {
      return res.status(400).json({ message: '非法路径' });
    }

    if (!fs.existsSync(materialDir)) {
      return res.status(404).json({ message: '该课程暂无可下载资料' });
    }

    const files = await fsp.readdir(materialDir);
    if (files.length === 0) {
      return res.status(404).json({ message: '该课程暂无可下载资料' });
    }

    // 设置响应头
    const zipName = `${courseId}-material.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

    // 创建 zip 流
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) res.status(500).json({ message: '打包失败' });
    });
    archive.pipe(res);
    archive.directory(materialDir, false);
    await archive.finalize();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ message: '下载失败' });
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

    // 检查该课程是否有真实的大作业资料（material 或 solutions 目录）
    let hasHomeworkMaterial = false;
    const assignmentBase = path.resolve(__dirname, `../public/assignment/${courseId}`);
    try {
      const matDir = path.join(assignmentBase, 'material');
      const solDir = path.join(assignmentBase, 'solutions');
      const [matExists, solExists] = await Promise.all([
        fsp.readdir(matDir).then(f => f.length > 0).catch(() => false),
        fsp.readdir(solDir).then(f => f.filter(x => x.toLowerCase().endsWith('.md')).length > 0).catch(() => false),
      ]);
      hasHomeworkMaterial = matExists || solExists;
    } catch { hasHomeworkMaterial = false; }

    // 检查该课程是否有真实的考试资料 (在 public/test/<courseId>/material 目录)
    let hasExamMaterial = false;
    const examDir = path.resolve(__dirname, `../public/test/${courseId}/material`);
    try {
      const files = await fsp.readdir(examDir);
      hasExamMaterial = files.length > 0;
    } catch { hasExamMaterial = false; }

    const categories = ['lecture', 'homework', 'exam', 'career'];
    const groups = categories.map((cat) => {
      let filtered = resources.filter((r) => r.category === cat);
      // 如果没有实际资料，过滤掉对应分类的资源
      if (cat === 'homework' && !hasHomeworkMaterial) filtered = [];
      if (cat === 'exam' && !hasExamMaterial) filtered = [];
      const items = filtered.map((r) => {
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
// 扫描 <仓库>/public/notes/<courseId>/ 下的所有 *.md 文件，
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
        // - 第1章-xxx.md / 第 10 章xxx.md → 1 / 10
        // - Lecture_01_xxx.md / Lec01_xxx.md → 1
        // - L1_xxx.md / 1-xxx.md → 1
        // 未命中则为 Infinity，排在后面
        const orderMatch =
          filename.match(/^第\s*(\d+)\s*章/) ||
          filename.match(/^Lec(?:ture)?[_\s]*(\d+)/i) ||
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

    // 检查该课程是否有可下载的大作业资料
    let hasMaterial = false;
    let hasSolutions = false;
    if (resource.category === 'homework' && resource.subType === 'project') {
      const materialDir = path.resolve(__dirname, `../public/assignment/${resource.courseId}/material`);
      try {
        const files = await fsp.readdir(materialDir);
        hasMaterial = files.length > 0;
      } catch { hasMaterial = false; }
      const solutionsDir = path.resolve(__dirname, `../public/assignment/${resource.courseId}/solutions`);
      try {
        const files = await fsp.readdir(solutionsDir);
        hasSolutions = files.filter(f => f.toLowerCase().endsWith('.md')).length > 0;
      } catch { hasSolutions = false; }
    }

    // 检查该课程是否有考试资料（试卷 + 解析）
    let hasTestMaterial = false;
    let hasTestSolutions = false;
    if (resource.category === 'exam') {
      const testMatDir = path.resolve(__dirname, `../public/test/${resource.courseId}/material`);
      try {
        const files = await fsp.readdir(testMatDir);
        hasTestMaterial = files.length > 0;
      } catch { hasTestMaterial = false; }
      const testSolDir = path.resolve(__dirname, `../public/test/${resource.courseId}/solutions`);
      try {
        const files = await fsp.readdir(testSolDir);
        hasTestSolutions = files.filter(f => f.toLowerCase().endsWith('.md')).length > 0;
      } catch { hasTestSolutions = false; }
    }

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
      hasMaterial,
      hasSolutions,
      hasTestMaterial,
      hasTestSolutions,
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
// 5.1 管理员接口：手动升绑会员等级
// POST /api/admin/users/upgrade-membership
// Header：X-Admin-Token: <与 .env 中 ADMIN_TOKEN 一致>
// Body  ：{ phone: "13900000101", level: "career" | "study" | "free",
//          durationDays?: number,           // 可选，自定义有效天数
//          expiresAt?: "2027-05-31T00:00:00Z" }  // 可选，ISO 时间，优先级最高
// 默认规则：free → 清空到期；study → 180 天；career → 365 天。
// 不创建订单记录，仅修改 users.member_level / member_expires_at。
// ==========================================
function requireAdminToken(req, res, next) {
  const expected = (process.env.ADMIN_TOKEN || '').trim();
  if (!expected) {
    console.error('[ADMIN] 未配置 ADMIN_TOKEN，管理接口默认禁用');
    return res.status(503).json({ message: '服务未配置管理员凭据' });
  }
  const token = String(req.headers['x-admin-token'] || '').trim();
  if (!token || token !== expected) {
    return res.status(401).json({ message: '管理员凭据无效' });
  }
  return next();
}

app.post('/api/admin/users/upgrade-membership', requireAdminToken, async (req, res) => {
  try {
    const { phone, level, durationDays, expiresAt: expiresAtRaw } = req.body || {};

    // 1) 参数校验
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '请传入正确的 11 位手机号' });
    }
    const ALLOWED_LEVELS = ['free', 'study', 'career'];
    if (!ALLOWED_LEVELS.includes(level)) {
      return res.status(400).json({ message: `level 必须为以下之一：${ALLOWED_LEVELS.join(', ')}` });
    }

    // 2) 查找用户
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: `手机号 ${phone} 对应用户不存在` });
    }

    // 3) 计算到期时间
    let expiresAt = null;
    if (level !== 'free') {
      if (expiresAtRaw) {
        const parsed = new Date(expiresAtRaw);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ message: 'expiresAt 不是合法的日期字符串' });
        }
        expiresAt = parsed;
      } else if (durationDays !== undefined && durationDays !== null) {
        const d = Number(durationDays);
        if (!Number.isFinite(d) || d <= 0 || d > 36500) {
          return res.status(400).json({ message: 'durationDays 必须为 1–36500 之间的数字' });
        }
        expiresAt = new Date(Date.now() + d * 24 * 3600 * 1000);
      } else {
        // 默认：study 180 天、career 365 天
        const days = level === 'career' ? 365 : 180;
        expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);
      }
    }

    // 4) 更新
    const updated = await prisma.user.update({
      where: { phone },
      data: { memberLevel: level, memberExpiresAt: expiresAt },
      include: { majorRef: true, grade: true }
    });

    console.log(`[ADMIN] 升绑会员 phone=${phone} level=${level} expiresAt=${expiresAt ? expiresAt.toISOString() : 'null'}`);
    return res.json({ data: await serializeUser(updated) });
  } catch (error) {
    console.error('[ADMIN upgrade-membership]', error);
    return res.status(500).json({ message: '升绑会员失败' });
  }
});

// ==========================================
// 5.2 管理员接口：解锁 / 锁定年级
// POST /api/admin/users/unlock-grades
// Header：X-Admin-Token
// Body  ：{ phone, gradeIds: ["junior_spring", ...], action?: "add" | "set" | "remove" }
//   action="add" (默认)：在现有基础上追加
//   action="set"：替换为传入的 gradeIds
//   action="remove"：从现有列表中移除指定 gradeIds
// ==========================================
app.post('/api/admin/users/unlock-grades', requireAdminToken, async (req, res) => {
  try {
    const { phone, gradeIds, action = 'add' } = req.body || {};

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '请传入正确的 11 位手机号' });
    }
    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
      return res.status(400).json({ message: 'gradeIds 必须为非空数组，如 ["junior_spring"]' });
    }
    const VALID_ACTIONS = ['add', 'set', 'remove'];
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ message: `action 必须为以下之一：${VALID_ACTIONS.join(', ')}` });
    }

    // 校验 gradeIds 合法性
    const validGrades = await prisma.grade.findMany({ select: { id: true } });
    const validIds = new Set(validGrades.map(g => g.id));
    const invalid = gradeIds.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return res.status(400).json({ message: `以下年级ID不合法：${invalid.join(', ')}。可用值：${[...validIds].join(', ')}` });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: `手机号 ${phone} 对应用户不存在` });
    }

    // 计算最终的年级列表
    const current = Array.isArray(user.accessibleGradeIds) ? user.accessibleGradeIds : [];
    let finalGrades;
    if (action === 'set') {
      finalGrades = [...new Set(gradeIds)];
    } else if (action === 'remove') {
      const removeSet = new Set(gradeIds);
      finalGrades = current.filter(id => !removeSet.has(id));
    } else {
      // add
      finalGrades = [...new Set([...current, ...gradeIds])];
    }

    const updated = await prisma.user.update({
      where: { phone },
      data: { accessibleGradeIds: finalGrades },
      include: { majorRef: true, grade: true }
    });

    console.log(`[ADMIN] 年级解锁 phone=${phone} action=${action} gradeIds=${JSON.stringify(finalGrades)}`);
    return res.json({ data: await serializeUser(updated) });
  } catch (error) {
    console.error('[ADMIN unlock-grades]', error);
    return res.status(500).json({ message: '年级解锁操作失败' });
  }
});

// ==========================================
// 5.3 管理员接口：综合更新用户信息
// POST /api/admin/users/update
// Header：X-Admin-Token
// Body  ：{ phone, level?, durationDays?, expiresAt?,
//          gradeIds?, gradeAction?, nickname?, school?, majorId?, gradeId? }
// 一次调用可同时更新会员等级 + 解锁年级 + 基本信息
// ==========================================
app.post('/api/admin/users/update', requireAdminToken, async (req, res) => {
  try {
    const { phone, level, durationDays, expiresAt: expiresAtRaw,
            gradeIds, gradeAction = 'add',
            nickname, school, majorId, gradeId } = req.body || {};

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: '请传入正确的 11 位手机号' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: `手机号 ${phone} 对应用户不存在` });
    }

    const data = {};

    // 1) 会员等级
    if (level !== undefined) {
      const ALLOWED_LEVELS = ['free', 'study', 'career'];
      if (!ALLOWED_LEVELS.includes(level)) {
        return res.status(400).json({ message: `level 必须为以下之一：${ALLOWED_LEVELS.join(', ')}` });
      }
      data.memberLevel = level;

      if (level === 'free') {
        data.memberExpiresAt = null;
      } else if (expiresAtRaw) {
        const parsed = new Date(expiresAtRaw);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ message: 'expiresAt 不是合法的日期字符串' });
        }
        data.memberExpiresAt = parsed;
      } else if (durationDays !== undefined && durationDays !== null) {
        const d = Number(durationDays);
        if (!Number.isFinite(d) || d <= 0 || d > 36500) {
          return res.status(400).json({ message: 'durationDays 必须为 1–36500 之间的数字' });
        }
        data.memberExpiresAt = new Date(Date.now() + d * 24 * 3600 * 1000);
      } else {
        const days = level === 'career' ? 365 : 180;
        data.memberExpiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);
      }
    }

    // 2) 解锁年级
    if (Array.isArray(gradeIds) && gradeIds.length > 0) {
      const validGrades = await prisma.grade.findMany({ select: { id: true } });
      const validIds = new Set(validGrades.map(g => g.id));
      const invalid = gradeIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({ message: `以下年级ID不合法：${invalid.join(', ')}` });
      }

      const current = Array.isArray(user.accessibleGradeIds) ? user.accessibleGradeIds : [];
      if (gradeAction === 'set') {
        data.accessibleGradeIds = [...new Set(gradeIds)];
      } else if (gradeAction === 'remove') {
        const removeSet = new Set(gradeIds);
        data.accessibleGradeIds = current.filter(id => !removeSet.has(id));
      } else {
        data.accessibleGradeIds = [...new Set([...current, ...gradeIds])];
      }
    }

    // 3) 基本信息
    if (nickname !== undefined) data.nickname = String(nickname);
    if (school !== undefined) data.school = String(school);
    if (majorId !== undefined) data.majorId = majorId || null;
    if (gradeId !== undefined) data.gradeId = gradeId || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: '请至少传入一个需要更新的字段' });
    }

    const updated = await prisma.user.update({
      where: { phone },
      data,
      include: { majorRef: true, grade: true }
    });

    console.log(`[ADMIN] 综合更新 phone=${phone} fields=${Object.keys(data).join(', ')}`);
    return res.json({ data: await serializeUser(updated) });
  } catch (error) {
    console.error('[ADMIN users/update]', error);
    return res.status(500).json({ message: '更新用户信息失败' });
  }
});

// ==========================================
// 6. 提交咨询意向接口
// ==========================================

// --- 钉钉群机器人通知 ---
async function sendDingTalkNotification(lead) {
  const webhookUrl = (process.env.DINGTALK_WEBHOOK_URL || '').trim();
  if (!webhookUrl) return; // 未配置则静默跳过

  const secret = (process.env.DINGTALK_WEBHOOK_SECRET || '').trim();
  let url = webhookUrl;

  // 加签模式：用 HmacSHA256 计算签名
  if (secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = encodeURIComponent(
      crypto.createHmac('sha256', secret).update(stringToSign).digest('base64')
    );
    url += `&timestamp=${timestamp}&sign=${sign}`;
  }

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const markdown = [
    '### 📨 新咨询意向',
    '',
    `- **姓名**: ${lead.name || '-'}`,
    `- **联系方式**: ${lead.contact || '-'}`,
    `- **学校**: ${lead.school || '-'}`,
    `- **专业**: ${lead.major || '-'}`,
    `- **年级**: ${lead.gradeId || '-'}`,
    `- **咨询方向**: ${lead.goal || '-'}`,
    `- **当前困惑**: ${lead.description || '-'}`,
    `- **提交时间**: ${now}`,
  ].join('\n');

  const body = {
    msgtype: 'markdown',
    markdown: {
      title: '新咨询意向',
      text: markdown
    }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const result = await resp.json();
  if (result.errcode !== 0) {
    throw new Error(`钉钉返回错误: errcode=${result.errcode} errmsg=${result.errmsg}`);
  }
  console.log('[DingTalk] 通知发送成功');
}

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

    // 异步发送钉钉通知（不阻塞响应）
    sendDingTalkNotification({ name, contact, school, major, gradeId, goal, description }).catch((err) => {
      console.error('[DingTalk] 通知发送失败:', err.message);
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
