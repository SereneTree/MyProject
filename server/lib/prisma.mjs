import { PrismaClient } from '@prisma/client';

// ==========================================
// DATABASE_URL 启动校验
// ==========================================
// 目标：
// 1. 必须显式配置 DATABASE_URL，不允许使用 Prisma/驱动默认连接
// 2. 强制使用业务专用账号（默认 prisma_user），禁止生产环境用 root 直连
// 3. 检测出明显的默认/弱密码（如 example 模板占位符）时直接报错退出
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[FATAL] 未设置 DATABASE_URL，请在 .env 中配置（参考 .env.example）');
  process.exit(1);
}

try {
  const u = new URL(url);
  const user = decodeURIComponent(u.username || '');
  const password = decodeURIComponent(u.password || '');

  if (!user) {
    console.error('[FATAL] DATABASE_URL 缺少用户名');
    process.exit(1);
  }

  // 生产环境（NODE_ENV=production）禁止使用 root 账号
  if (process.env.NODE_ENV === 'production' && user === 'root') {
    console.error('[FATAL] 生产环境禁止使用 root 账号连接数据库，请改用 prisma_user');
    process.exit(1);
  }

  // 检测明显的占位符 / 弱密码
  const weakPasswords = new Set(['', '123456', 'password', 'root', '<YOUR_STRONG_PASSWORD>']);
  if (weakPasswords.has(password)) {
    console.error('[FATAL] DATABASE_URL 中检测到占位符或弱密码，请改用强密码');
    process.exit(1);
  }
} catch (err) {
  console.error('[FATAL] DATABASE_URL 解析失败：', err.message);
  process.exit(1);
}

const prisma = new PrismaClient();

export default prisma;
