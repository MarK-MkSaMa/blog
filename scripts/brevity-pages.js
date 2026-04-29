'use strict';

/**
 * 朋友圈数据加载与单条静态页生成
 *
 * 数据源：source/_essays/*.md
 *   - 文件名（去扩展名）即朋友圈 id
 *   - front matter 提供 date / image / location / link / video / aplayer 等元数据
 *   - 正文（markdown body）即朋友圈内容
 *
 * 输出：
 *   1. site.data.brevity = 全部条目数组（按 date 倒序）
 *   2. /essay/{id}/  每条独立页面，用于评论区隔离 + 单条分享
 */

const fs = require('fs');
const path = require('path');
const yfm = require('hexo-front-matter');

const ESSAY_DIR = '_essays';

function loadEssays(hexo) {
  const dir = path.join(hexo.source_dir, ESSAY_DIR);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => /\.(md|markdown)$/i.test(f))
    .map(file => {
      const id = file.replace(/\.(md|markdown)$/i, '');
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
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
