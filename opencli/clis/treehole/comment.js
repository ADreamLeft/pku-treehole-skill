import { cli, Strategy } from '@jackwener/opencli/registry';

import { publishComment } from './client.js';

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

cli({
  site: 'treehole',
  name: 'comment',
  access: 'write',
  description: '在北大树洞帖子下发布纯文字评论',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  defaultFormat: 'json',
  args: [
    { name: 'pid', required: true, positional: true, help: 'Post ID, with or without leading #' },
    { name: 'text', required: true, positional: true, help: 'Comment text to publish' },
    { name: 'comment-id', type: 'int', help: 'Optional comment ID to reply to' },
    { name: 'confirm', type: 'boolean', default: false, help: 'Actually publish. Default is dry-run preview only.' },
  ],
  columns: ['status', 'pid', 'cid', 'text', 'name', 'message'],
  example: 'opencli treehole comment 8279942 "莫名其妙的热梗" --confirm -f json',
  func: async (page, kwargs) => {
    const result = await publishComment(page, {
      pid: kwargs.pid,
      text: kwargs.text,
      commentId: kwargs['comment-id'] ?? null,
      dryRun: !isTruthyFlag(kwargs.confirm),
    });
    return {
      status: result.dry_run ? 'dry-run' : 'commented',
      ...result,
    };
  },
});
