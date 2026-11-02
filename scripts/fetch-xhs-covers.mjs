// 把 server/data/xhs-articles.json 里的小红书封面图下载到 public/xhs-covers/，
// 并把 cover 字段改成本地路径（/xhs-covers/xxx.webp），避免外链签名过期后图片失效。
//
// 用法：node scripts/fetch-xhs-covers.mjs
// 说明：
//   1. 幂等。已经指向本地且文件存在的条目会跳过；原外链备份在 coverSource 字段。
//   2. 小红书图床地址带时效签名（约一周），过期后直接 403。此时用浏览器打开笔记页，
//      从 HTML 的 "urlDefault" 里取新签名地址，按文章顺序写进 scripts/xhs-cover-sources.json，
//      脚本会用它覆盖旧地址下载，并用 spectrum 文件 ID 校验一处一图没串行。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonFile = path.join(root, 'server/data/xhs-articles.json');
const sourcesFile = path.join(root, 'scripts/xhs-cover-sources.json');
const outDir = path.join(root, 'public/xhs-covers');

const EXT_BY_TYPE = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
};

const HEADERS = {
  // 小红书图床对空 UA 会拒绝，带上浏览器 UA 与来源页
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  referer: 'https://www.xiaohongshu.com/',
  accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

const articles = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
const sources = fs.existsSync(sourcesFile) ? JSON.parse(fs.readFileSync(sourcesFile, 'utf-8')) : [];
fs.mkdirSync(outDir, { recursive: true });

// 从 .../spectrum/<fileId>!suffix 里取 fileId，用来校验下载的图与文章是否对应
const fileIdOf = (url) => {
  const m = String(url || '').match(/spectrum\/([^!?]+)/);
  return m ? m[1] : null;
};

let downloaded = 0;
let skipped = 0;
const failed = [];

for (let i = 0; i < articles.length; i += 1) {
  const a = articles[i];
  const cover = String(a.cover || '');
  const seq = String(i + 1).padStart(2, '0');
  const base = `xhs-${a.date || 'nodate'}-${seq}`;

  // 已本地化：只要文件在就不再重复下载
  if (cover.startsWith('/xhs-covers/')) {
    if (fs.existsSync(path.join(outDir, path.basename(cover)))) {
      skipped += 1;
      continue;
    }
  }

  const original = /^https?:\/\//.test(cover) ? cover : String(a.coverSource || '');
  const fresh = sources[i];
  const expectedId = fileIdOf(original);
  if (fresh && expectedId && fileIdOf(fresh) !== expectedId) {
    failed.push({ title: a.title, error: `签名地址与文章不匹配（期望 ${expectedId}，来源 ${fileIdOf(fresh)}）` });
    continue;
  }

  const target = fresh || original;
  if (!/^https?:\/\//.test(target)) {
    skipped += 1;
    continue;
  }

  try {
    const res = await fetch(target, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = EXT_BY_TYPE[type] || '.jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error(`响应过小（${buf.length}B），疑似被拦截`);
    const fileName = `${base}${ext}`;
    fs.writeFileSync(path.join(outDir, fileName), buf);
    if (!a.coverSource && /^https?:\/\//.test(cover)) a.coverSource = cover;
    a.cover = `/xhs-covers/${fileName}`;
    downloaded += 1;
    console.log(`✓ ${fileName}  ${(buf.length / 1024).toFixed(0)}KB  ${a.title}`);
  } catch (error) {
    failed.push({ title: a.title, error: String(error.message || error) });
    console.error(`✗ ${a.title}  ${error.message || error}`);
  }
}

fs.writeFileSync(jsonFile, `${JSON.stringify(articles, null, 2)}\n`, 'utf-8');
console.log(`\n新下载 ${downloaded} 张，跳过 ${skipped} 条，失败 ${failed.length} 条`);
if (failed.length) {
  console.log('失败明细：');
  for (const f of failed) console.log(` - ${f.title}: ${f.error}`);
  process.exitCode = 1;
}
