'use strict';

/**
 * 分类页生成器（覆盖默认 hexo-generator-category）
 *
 * 特性：
 *   - "包含模式"：父分类聚合所有后代文章
 *   - 自动生成 /categories/（全部）+ 每个分类的页（含嵌套）
 *   - 数据传给模板：
 *       category_tree   — 完整树（侧栏）
 *       category_node   — 当前节点（null = 全部）
 *       category_chain  — 祖先链（含自己），用于高亮 + 面包屑
 *       category_posts  — 当前节点 + 后代去重后的文章数组（按 date 倒序）
 *       category_total  — 文章总数
 */

hexo.extend.generator.register('categories-tree', function (locals) {
  const all = locals.categories.toArray();
  if (!all.length) return [];

  // 构建按 id 索引的节点
  const byId = {};
  all.forEach(c => {
    byId[c._id] = {
      id: c._id,
      name: c.name,
      path: c.path,
      slug: c.slug,
      parentId: c.parent || null,
      directLength: c.length,
      posts: c.posts.toArray(),
      children: []
    };
  });

  // 关联父子
  all.forEach(c => {
    if (c.parent && byId[c.parent]) {
      byId[c.parent].children.push(byId[c._id]);
    }
  });

  // 排序（中文按拼音）
  const cmp = (a, b) => a.name.localeCompare(b.name, 'zh-CN');
  function sortRec(node) {
    node.children.sort(cmp);
    node.children.forEach(sortRec);
  }
  const roots = Object.values(byId).filter(n => !n.parentId);
  roots.sort(cmp);
  roots.forEach(sortRec);

  // 聚合每个节点的"自己 + 后代"文章
  function aggregate(node) {
    const seen = new Map();
    (function collect(n) {
      n.posts.forEach(p => seen.set(p._id, p));
      n.children.forEach(collect);
    })(node);
    node.aggregatedPosts = Array.from(seen.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    node.totalLength = node.aggregatedPosts.length;
    node.children.forEach(aggregate);
  }
  roots.forEach(aggregate);

  // 构建祖先链
  function ancestorChain(node) {
    const chain = [];
    let cur = node;
    while (cur) {
      chain.unshift({ id: cur.id, name: cur.name, path: cur.path });
      cur = cur.parentId ? byId[cur.parentId] : null;
    }
    return chain;
  }

  // 给模板的精简树
  function strip(node) {
    return {
      id: node.id,
      name: node.name,
      path: node.path,
      parentId: node.parentId,
      directLength: node.directLength,
      totalLength: node.totalLength,
      children: node.children.map(strip)
    };
  }
  const treeData = roots.map(strip);

  const pages = [];

  // /categories/ 全部 — 从树聚合（locals.posts 在某些 hexo 版本不可靠）
  const allMap = new Map();
  roots.forEach(r => r.aggregatedPosts.forEach(p => allMap.set(p._id, p)));
  const allPosts = Array.from(allMap.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  pages.push({
    path: 'categories/index.html',
    layout: 'page',
    data: {
      type: 'categories',
      title: 'Categories',
      category_tree: treeData,
      category_node: null,
      category_chain: [],
      category_posts: allPosts,
      category_total: allPosts.length,
      comment: false,
      aside: false
    }
  });

  // 每个分类节点
  function emitNode(node) {
    pages.push({
      path: node.path + 'index.html',
      layout: 'page',
      data: {
        type: 'categories',
        title: node.name,
        category_tree: treeData,
        category_node: {
          id: node.id,
          name: node.name,
          path: node.path,
          parentId: node.parentId,
          totalLength: node.totalLength
        },
        category_chain: ancestorChain(node),
        category_posts: node.aggregatedPosts,
        category_total: node.totalLength,
        comment: false,
        aside: false
      }
    });
    node.children.forEach(emitNode);
  }
  roots.forEach(emitNode);

  return pages;
});
