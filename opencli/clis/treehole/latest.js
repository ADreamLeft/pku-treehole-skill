import { EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

import { loadPosts } from './client.js';
import { parsePositiveInt } from './utils.js';

cli({
  site: 'treehole',
  name: 'latest',
  access: 'read',
  description: '北大树洞最新帖子',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  args: [
    { name: 'pages', type: 'int', default: 3, help: 'Maximum pages to scan (1-20)' },
    { name: 'limit', type: 'int', default: 25, help: 'Items per page (1-50)' },
    { name: 'min-likes', type: 'int', default: 0, help: 'Keep posts with at least this many likes' },
    { name: 'min-replies', type: 'int', default: 0, help: 'Keep posts with at least this many replies' },
  ],
  columns: ['pid', 'time', 'likes', 'replies', 'tag', 'text', 'url'],
  example: 'opencli treehole latest --pages 3 --limit 25 -f json',
  func: async (page, kwargs) => {
    const pages = parsePositiveInt(kwargs.pages, 'pages', 1, 20, 3);
    const limit = parsePositiveInt(kwargs.limit, 'limit', 1, 50, 25);
    const minLikes = parsePositiveInt(kwargs['min-likes'], 'min-likes', 0, 100000, 0);
    const minReplies = parsePositiveInt(kwargs['min-replies'], 'min-replies', 0, 100000, 0);
    const rows = await loadPosts(page, { pages, limit, sort: 'time' });
    const filtered = rows.filter((row) => row.likes >= minLikes || row.replies >= minReplies);
    if (!filtered.length) {
      throw new EmptyResultError('treehole latest', 'No recent Treehole posts matched the filters.');
    }
    return filtered;
  },
});
