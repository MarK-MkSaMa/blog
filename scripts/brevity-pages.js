'use strict';

/**
 * 朋友圈数据加载与单条静态页生成
 *
 * 数据源：source/_essays/**\/*.md（递归扫描，支持 YYYY/MM/ 子目录）
 *   - 文件名（去扩展名）即朋友圈 id
 *   - front matter 提供 date / image / location / link / video / aplayer 等元数据
 *   - 正文（markdown body）即朋友圈内容
 *
 * 输出：
 *   1. site.data.brevity = 全部条目数组（按 date 倒序）
 *   2. /essay/{id}/      每条独立页面（评论区路径 + OG 分享）
 *   3. /essay/page/N/    分页（generator 在 brevity-paginate 处理）
 */

const fs = require('fs');
const path = require('path');
const yfm = require('hexo-front-matter');

const ESSAY_DIR = '_essays';

function walkMd(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMd(full, out);
    else if (/\.(md|markdown)$/i.test(entry.name)) out.push(full);
  }
}

function loadEssays(hexo) {
  const root = path.join(hexo.source_dir, ESSAY_DIR);
  if (!fs.existsSync(root)) return [];

  const files = [];
  walkMd(root, files);

  return files.map(filepath => {
    const file = path.basename(filepath);
    const id = file.replace(/\.(md|markdown)$/i, '');
    const raw = fs.readFileSync(filepath, 'utf8');
    const parsed = yfm.parse(raw);
    const body = (parsed._content || '').trim();

    return {
      id: parsed.id || id,
      date: parsed.date,
      content: body || (parsed.content !== undefined ? String(parsed.content) : ''),
      image: parsed.image,
      video: parsed.video,
      aplayer: parsed.aplayer,
      link: parsed.link,
      location: parsed.location
    };
  })
    .filter(item => item.date && item.content)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// hexo essay <id>  → 自动按 id 中的 YYYYMMDD 创建 _essays/YYYY/MM/<id>.md
hexo.extend.console.register('essay', 'Create a new brevity entry under _essays/YYYY/MM/', {
  arguments: [{ name: 'id', desc: 'YYYYMMDD-NN, e.g. 20260504-01' }]
}, function (args) {
  const id = args._[0];
  if (!id) {
    hexo.log.error('Usage: hexo essay <id>  (e.g. hexo essay 20260504-01)');
    return;
  }
  const m = id.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) {
    hexo.log.error('id 必须以 YYYYMMDD 开头，收到:', id);
    return;
  }
  const [, year, month, day] = m;
  const filepath = path.join(hexo.source_dir, ESSAY_DIR, year, month, id + '.md');
  if (fs.existsSync(filepath)) {
    hexo.log.error('文件已存在:', filepath);
    return;
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const front = `---\ndate: ${year}-${month}-${day} ${hh}:${mm}\n---\n\n`;
  fs.writeFileSync(filepath, front);
  hexo.log.info('[essay] 已创建:', filepath);
});

// 把朋友圈数据注入 site.data.brevity，兼容现有模板
hexo.extend.filter.register('before_generate', function () {
  const items = loadEssays(hexo);
  const Data = hexo.model('Data');
  const existing = Data.findById('brevity');
  if (existing) {
    return Data.replaceById('brevity', { _id: 'brevity', data: items });
  }
  return Data.insert({ _id: 'brevity', data: items });
}, 9);

// 为每条朋友圈生成独立页面 /essay/{id}/
hexo.extend.generator.register('brevity-single', function () {
  const items = loadEssays(hexo);
  return items.map(item => {
    const text = (item.content || '').replace(/\s+/g, ' ').trim();
    const excerpt = text.length > 60 ? text.slice(0, 60) + '…' : text;
    const cover = item.image && item.image[0]
      ? (typeof item.image[0] === 'string' ? item.image[0] : item.image[0].url)
      : null;

    return {
      path: `essay/${item.id}/`,
      layout: 'page',
      data: {
        title: excerpt || `朋友圈 · ${item.id}`,
        date: item.date,
        type: 'brevity-single',
        brevity: item,
        comment: true,
        aside: true,
        description: excerpt,
        cover: cover
      }
    };
  });
});

// 朋友圈分页：第 2 页起生成 /essay/page/N/，第 1 页保留 essay/index.md 自身
hexo.extend.generator.register('brevity-paginate', function () {
  const items = loadEssays(hexo);
  const themeBrevity = (hexo.theme.config && hexo.theme.config.brevity) || {};
  const perPage = themeBrevity.strip > 0 ? themeBrevity.strip : 30;
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  if (totalPages <= 1) return [];

  // 复用 essay/index.md 的 banner 配置
  const indexFile = path.join(hexo.source_dir, 'essay', 'index.md');
  let baseFront = {};
  if (fs.existsSync(indexFile)) {
    try { baseFront = yfm.parse(fs.readFileSync(indexFile, 'utf8')); } catch (e) {}
  }

  const pages = [];
  for (let i = 1; i < totalPages; i++) {
    const slice = items.slice(i * perPage, (i + 1) * perPage);
    pages.push({
      path: `essay/page/${i + 1}/`,
      layout: 'page',
      data: {
        title: `朋友圈 · 第 ${i + 1} 页`,
        type: 'brevity',
        brevity_items: slice,
        brevity_page: i + 1,
        brevity_total_pages: totalPages,
        comment: false,
        aside: true,
        cover: baseFront.cover,
        desc: baseFront.desc,
        leftend: baseFront.leftend || '',
        rightend: baseFront.rightend || ''
      }
    });
  }
  return pages;
});
