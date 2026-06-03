import { cli, Strategy } from '@jackwener/opencli/registry';

import { loadPostBundle } from './client.js';
import { parsePositiveInt } from './utils.js';

cli({
  site: 'treehole',
  name: 'post',
  access: 'read',
  description: '北大树洞单帖详情和回复',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  defaultFormat: 'json',
  args: [
    { name: 'pid', required: true, positional: true, help: 'Post ID, with or without leading #' },
    { name: 'comments-limit', type: 'int', default: 100, help: 'Maximum comments to return (1-1000)' },
    { name: 'all-comments', type: 'boolean', default: false, help: 'Fetch all comment pages through the in-page API' },
  ],
  columns: ['post', 'comments'],
  example: 'opencli treehole post 8164148 --all-comments -f json',
  func: async (page, kwargs) => {
    const commentsLimit = parsePositiveInt(kwargs['comments-limit'], 'comments-limit', 1, 1000, 100);
    return loadPostBundle(page, {
      pid: kwargs.pid,
      allComments: Boolean(kwargs['all-comments']),
      commentsLimit,
    });
  },
});
