const TYPES = ['note', 'tip', 'important', 'warning', 'caution'];
const TITLES = {
  note: '说明',
  tip: '提示',
  important: '重要',
  warning: '警告',
  caution: '注意'
};
const ICONS = {
  note: 'fa-circle-info',
  tip: 'fa-lightbulb',
  important: 'fa-star',
  warning: 'fa-triangle-exclamation',
  caution: 'fa-fire'
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCallout(type, title, contentLines, foldable = true, expanded = true) {
  const safeTitle = escapeHtml(title || TITLES[type]);
  const icon = ICONS[type] || 'fa-circle-info';
  const openAttr = expanded ? ' open' : '';

  return [
    `<details class="admonition ${type}${foldable ? ' is-foldable' : ''}"${openAttr}>`,
    `<summary class="admonition-title"><span class="admonition-title-main"><i class="solitude fas ${icon}"></i><span>${safeTitle}</span></span><i class="solitude fas fa-chevron-down admonition-fold-icon"></i></summary>`,
    '<div class="admonition-content">',
    ...contentLines,
    '</div>',
    '</details>'
  ];
}

hexo.extend.filter.register('before_post_render', function(data) {
  if (!data || !data.content) return data;

  const lines = data.content.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^>\s*\[!([A-Za-z]+)\]([+-])?\s*(.*)$/);
    if (!match) {
      result.push(lines[i]);
      continue;
    }

    const type = match[1].toLowerCase();
    if (!TYPES.includes(type)) {
      result.push(lines[i]);
      continue;
    }

    const foldMarker = match[2] || '';
    const customTitle = match[3].trim();
    const title = customTitle || TITLES[type];
    const block = [];

    i += 1;
    while (i < lines.length && /^> ?/.test(lines[i])) {
      block.push(lines[i].replace(/^> ?/, ''));
      i += 1;
    }
    i -= 1;

    const foldable = foldMarker === '+' || foldMarker === '-';
    const expanded = foldMarker !== '-';
    result.push(...buildCallout(type, title, block, foldable, expanded));
  }

  data.content = result.join('\n');
  return data;
});



