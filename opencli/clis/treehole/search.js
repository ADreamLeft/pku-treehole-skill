import { ArgumentError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

import { loadPosts } from './client.js';
import { parsePositiveInt } from './utils.js';

const SORTS = ['time', 'likes'];

cli({
  site: 'treehole',
  name: 'search',
  access: 'read',
  description: '北大树洞关键词搜索',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  args: [
    { name: 'keyword', required: true, positional: true, help: 'Search keyword. Use #PID for a specific post.' },
    { name: 'pages', type: 'int', default: 5, help: 'Maximum pages to scan (1-20)' },
    { name: 'limit', type: 'int', default: 25, help: 'Items per page (1-50)' },
    { name: 'tag-id', type: 'int', help: 'Optional tag id: 1 课程心得, 2 失物招领, 3 求职经历, 5 跳蚤市场' },
    { name: 'sort', choices: SORTS, default: 'time', help: 'Sort order: time or likes' },
  ],
  columns: ['pid', 'time', 'likes', 'replies', 'tag', 'text', 'url'],
  example: 'opencli treehole search "数学期末" --pages 5 -f json',
  func: async (page, kwargs) => {
    const keyword = String(kwargs.keyword ?? '').trim();
    if (!keyword) throw new ArgumentError('treehole search keyword must not be empty');
    const pages = parsePositiveInt(kwargs.pages, 'pages', 1, 20, 5);
    const limit = parsePositiveInt(kwargs.limit, 'limit', 1, 50, 25);
    const sort = String(kwargs.sort ?? 'time');
    if (!SORTS.includes(sort)) throw new ArgumentError(`sort must be one of: ${SORTS.join(', ')}`);
    const tagId = kwargs['tag-id'] == null ? null : parsePositiveInt(kwargs['tag-id'], 'tag-id', 1, 999);
    return loadPosts(page, { keyword, pages, limit, tagId, sort });
  },
});
