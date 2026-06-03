import fs from 'node:fs/promises';
import path from 'node:path';

import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

import { loadPosts } from './client.js';
import { parsePositiveInt, renderMarkdown } from './utils.js';

cli({
  site: 'treehole',
  name: 'export-markdown',
  access: 'read',
  description: '导出北大树洞帖子为本地 Markdown 文件',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  defaultFormat: 'json',
  args: [
    { name: 'output', required: true, positional: true, help: 'Output Markdown file path' },
    { name: 'keyword', default: '', help: 'Search keyword. Empty means latest posts.' },
    { name: 'pages', type: 'int', default: 5, help: 'Maximum pages to scan (1-20)' },
    { name: 'limit', type: 'int', default: 25, help: 'Items per page (1-50)' },
    { name: 'tag-id', type: 'int', help: 'Optional tag id: 1 课程心得, 2 失物招领, 3 求职经历, 5 跳蚤市场' },
    { name: 'title', help: 'Markdown document title' },
  ],
  columns: ['output', 'count'],
  example: 'opencli treehole export-markdown ./treehole.md --keyword "数学期末" --pages 5 -f json',
  func: async (page, kwargs) => {
    const output = String(kwargs.output ?? '').trim();
    if (!output) throw new ArgumentError('output path is required');
    const pages = parsePositiveInt(kwargs.pages, 'pages', 1, 20, 5);
    const limit = parsePositiveInt(kwargs.limit, 'limit', 1, 50, 25);
    const tagId = kwargs['tag-id'] == null ? null : parsePositiveInt(kwargs['tag-id'], 'tag-id', 1, 999);
    const rows = await loadPosts(page, {
      keyword: String(kwargs.keyword ?? '').trim(),
      pages,
      limit,
      tagId,
      sort: 'time',
    });
    const resolved = path.resolve(output);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, renderMarkdown(rows, String(kwargs.title ?? '树洞导出')), 'utf8');
    return { output: resolved, count: rows.length };
  },
});
