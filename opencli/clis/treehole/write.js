import { cli, Strategy } from '@jackwener/opencli/registry';

import { publishPost } from './client.js';

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

cli({
  site: 'treehole',
  name: 'write',
  access: 'write',
  description: '发布北大树洞纯文字帖子',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  siteSession: 'persistent',
  defaultFormat: 'json',
  args: [
    { name: 'text', required: true, positional: true, help: 'Text body to publish' },
    { name: 'tag-id', type: 'int', help: 'Optional tag id: 1 课程心得, 2 失物招领, 3 求职经历, 5 跳蚤市场' },
    { name: 'confirm', type: 'boolean', default: false, help: 'Actually publish. Default is dry-run preview only.' },
  ],
  columns: ['status', 'pid', 'text', 'tag_id', 'tag', 'message'],
  example: 'opencli treehole write "炒作是什么意思" --confirm -f json',
  func: async (page, kwargs) => {
    const result = await publishPost(page, {
      text: kwargs.text,
      tagId: kwargs['tag-id'] ?? null,
      dryRun: !isTruthyFlag(kwargs.confirm),
    });
    return {
      status: result.dry_run ? 'dry-run' : 'posted',
      ...result,
    };
  },
});
