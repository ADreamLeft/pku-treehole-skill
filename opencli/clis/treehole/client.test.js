import test from 'node:test';
import assert from 'node:assert/strict';

import { TREEHOLE_URL } from './utils.js';
import { loadPosts, loadPostBundle, publishComment, publishPost, readTags } from './client.js';

function makePage(responses = {}) {
  const calls = [];
  const page = {
    calls,
    async goto(url) {
      calls.push(['goto', url]);
    },
    async wait(value) {
      calls.push(['wait', value]);
    },
    async autoScroll(options) {
      calls.push(['autoScroll', options]);
    },
    async evaluate(js) {
      calls.push(['evaluate', js]);
      if (js.includes('TREEHOLE_ASSERT_LOGGED_IN')) return responses.assert ?? { hasRoot: true, hasIndex: true, text: '北大树洞' };
      if (js.includes('TREEHOLE_POST_STATE')) return responses.state ?? { loading: false, length: 1 };
      if (js.includes('TREEHOLE_RUN_SEARCH')) return { ok: true };
      if (js.includes('TREEHOLE_EXTRACT_POSTS')) return responses.posts ?? [];
      if (js.includes('TREEHOLE_FETCH_COMMENTS')) return responses.commentsApi ?? { success: false };
      if (js.includes('TREEHOLE_EXTRACT_COMMENTS')) return responses.comments ?? [];
      if (js.includes('TREEHOLE_PUBLISH_POST')) return {
        ok: true,
        status: 200,
        data: responses.publishPost ?? { success: true, code: 20000, message: 'success' },
      };
      if (js.includes('TREEHOLE_PUBLISH_COMMENT')) return {
        ok: true,
        status: 200,
        data: responses.publishComment ?? {
          success: true,
          code: 20000,
          message: 'success',
          data: { cid: 38104790, pid: 8279942, text: '莫名奇妙的热梗', name: '洞主', timestamp: 1780497462 },
        },
      };
      return null;
    },
  };
  return page;
}

test('loadPosts opens Treehole and normalizes latest rows', async () => {
  const page = makePage({
    posts: [{ pid: 1, text: 'hi', timestamp: 100, likenum: 2, reply: 3, tag: '课程心得' }],
  });

  const rows = await loadPosts(page, { keyword: '', pages: 1, limit: 10 });

  assert.equal(page.calls[0][0], 'goto');
  assert.equal(page.calls[0][1], TREEHOLE_URL);
  assert.deepEqual(rows.map((row) => row.pid), [1]);
});

test('loadPosts runs page-native search for keyword queries', async () => {
  const page = makePage({
    posts: [{ pid: 2, text: 'math', timestamp: 200, likenum: 1, reply: 0, tag: '' }],
  });

  await loadPosts(page, { keyword: '数学期末', pages: 1, limit: 10 });

  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('TREEHOLE_RUN_SEARCH')));
  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('数学期末')));
});

test('loadPostBundle searches by pid and reads comments', async () => {
  const page = makePage({
    posts: [{ pid: 8164148, text: 'post', timestamp: 300, likenum: 5, reply: 1, tag: '' }],
    commentsApi: {
      success: true,
      data: {
        total: 1,
        last_page: 1,
        data: [{ cid: 10, pid: 8164148, text: 'reply', timestamp: 301, name: 'Alice', islz: 0 }],
      },
    },
  });

  const bundle = await loadPostBundle(page, { pid: '#8164148', allComments: true, commentsLimit: 20 });

  assert.equal(bundle.post.pid, 8164148);
  assert.deepEqual(bundle.comments.map((comment) => comment.cid), [10]);
  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('#8164148')));
});

test('publishPost dry-run returns planned payload without opening Treehole', async () => {
  const page = makePage();

  const result = await publishPost(page, { text: '炒作是什么意思', tagId: 3, dryRun: true });

  assert.deepEqual(result, {
    dry_run: true,
    action: 'post',
    text: '炒作是什么意思',
    type: 'text',
    tag_id: 3,
    tag: '求职经历',
  });
  assert.equal(page.calls.length, 0);
});

test('publishPost posts text through page-native API when confirmed', async () => {
  const page = makePage({
    publishPost: { success: true, code: 20000, message: 'success', data: { pid: 8279942, text: '炒作是什么意思' } },
  });

  const result = await publishPost(page, { text: '炒作是什么意思', dryRun: false });

  assert.equal(result.success, true);
  assert.equal(result.pid, 8279942);
  assert.equal(result.text, '炒作是什么意思');
  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('TREEHOLE_PUBLISH_POST')));
  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('/api/pku_store')));
});

test('publishComment posts text through page-native API when confirmed', async () => {
  const page = makePage();

  const result = await publishComment(page, { pid: '#8279942', text: '莫名奇妙的热梗', dryRun: false });

  assert.equal(result.success, true);
  assert.equal(result.cid, 38104790);
  assert.equal(result.pid, 8279942);
  assert.equal(result.text, '莫名奇妙的热梗');
  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('TREEHOLE_PUBLISH_COMMENT')));
  assert.ok(page.calls.some(([kind, js]) => kind === 'evaluate' && String(js).includes('/api/pku_comment_v3')));
});

test('readTags returns known local tag map', () => {
  assert.deepEqual(readTags().map((tag) => tag.id), [1, 2, 3, 5]);
});
