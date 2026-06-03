import { cli, Strategy } from '@jackwener/opencli/registry';

import { readTags } from './client.js';

cli({
  site: 'treehole',
  name: 'tags',
  access: 'read',
  description: '北大树洞已知标签 ID',
  domain: 'treehole.pku.edu.cn',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['id', 'name'],
  example: 'opencli treehole tags -f table',
  func: async () => readTags(),
});
