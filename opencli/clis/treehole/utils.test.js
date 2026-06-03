import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KNOWN_TAGS,
  formatUnixSeconds,
  normalizeComments,
  normalizePid,
  normalizePosts,
  parsePositiveInt,
  renderMarkdown,
  sortPosts,
  unwrapEvaluateResult,
} from './utils.js';

test('normalizes post rows from Treehole Vue state', () => {
  const rows = normalizePosts([
    {
      pid: '8164148',
      text: '  hello\nworld  ',
      timestamp: 1767139200,
      likenum: '7',
      reply: '3',
      tag: '课程心得',
      url: 'https://example.test/a.png',
    },
    { pid: null, text: 'skip me' },
  ]);

  assert.deepEqual(rows, [
    {
      pid: 8164148,
      time: '2025-12-31 08:00',
      likes: 7,
      replies: 3,
      tag: '课程心得',
      text: 'hello\nworld',
      url: 'https://example.test/a.png',
    },
  ]);
});

test('filters posts by known tag id and sorts by likes or time', () => {
  const rows = normalizePosts([
    { pid: 1, text: 'old hot', timestamp: 100, likenum: 9, reply: 1, tag: KNOWN_TAGS[3] },
    { pid: 2, text: 'new cold', timestamp: 200, likenum: 1, reply: 2, tag: KNOWN_TAGS[1] },
    { pid: 3, text: 'new hot', timestamp: 300, likenum: 9, reply: 3, tag: KNOWN_TAGS[3] },
  ]);

  assert.deepEqual(sortPosts(rows, 'likes', 3).map((row) => row.pid), [3, 1]);
  assert.deepEqual(sortPosts(rows, 'time').map((row) => row.pid), [3, 2, 1]);
});

test('normalizes comments and strips duplicated anonymous prefixes', () => {
  const rows = normalizeComments([
    {
      cid: '10',
      pid: '8164148',
      text: '[Alice] [洞主] 正文',
      name: 'Alice',
      islz: 1,
      quote_text: 'quoted',
      timestamp: 1767139200,
    },
  ]);

  assert.deepEqual(rows, [
    {
      cid: 10,
      pid: 8164148,
      time: '2025-12-31 08:00',
      name: 'Alice',
      is_lz: true,
      quote_text: 'quoted',
      text: '正文',
    },
  ]);
});

test('parses bounded positive integers and post ids', () => {
  assert.equal(parsePositiveInt('5', 'limit', 1, 20), 5);
  assert.equal(parsePositiveInt(undefined, 'limit', 1, 20, 7), 7);
  assert.throws(() => parsePositiveInt('21', 'limit', 1, 20), /limit must be between 1 and 20/);

  assert.equal(normalizePid('#8164148'), 8164148);
  assert.equal(normalizePid('8164148'), 8164148);
  assert.throws(() => normalizePid('abc'), /post id must be numeric/);
});

test('renders markdown export from normalized posts', () => {
  const rows = normalizePosts([
    { pid: 8164148, text: '正文', timestamp: 1767139200, likenum: 7, reply: 3, tag: '课程心得' },
  ]);

  assert.equal(formatUnixSeconds(1767139200), '2025-12-31 08:00');
  assert.equal(
    renderMarkdown(rows, '树洞导出'),
    '# 树洞导出\n\n## #8164148 (2025-12-31 08:00)\n\n赞 7  回复 3\n\n标签：课程心得\n\n正文\n\n---\n',
  );
});

test('unwraps browser bridge evaluate envelopes', () => {
  assert.deepEqual(unwrapEvaluateResult({ session: 'x', data: [{ ok: true }] }), [{ ok: true }]);
  assert.deepEqual(unwrapEvaluateResult([{ ok: true }]), [{ ok: true }]);
});
