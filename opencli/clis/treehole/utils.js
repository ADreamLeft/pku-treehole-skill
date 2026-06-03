import { ArgumentError } from '@jackwener/opencli/errors';

export const TREEHOLE_URL = 'https://treehole.pku.edu.cn/web/';

export const KNOWN_TAGS = {
  1: '课程心得',
  2: '失物招领',
  3: '求职经历',
  5: '跳蚤市场',
};

export function parsePositiveInt(value, name, min, max, defaultValue) {
  if (value == null || value === '') {
    if (defaultValue != null) return defaultValue;
    throw new ArgumentError(`${name} is required`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ArgumentError(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

export function normalizePid(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '');
  if (!/^\d+$/.test(raw)) {
    throw new ArgumentError('post id must be numeric', 'Example: opencli treehole post 8164148');
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ArgumentError('post id must be a safe positive integer');
  }
  return parsed;
}

export function formatUnixSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const date = new Date((seconds + 8 * 3600) * 1000);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

export function normalizePosts(items, tagId) {
  const tagName = tagId == null ? '' : KNOWN_TAGS[Number(tagId)] ?? null;
  if (tagName === null) return [];

  const rows = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const pid = toSafeInt(item?.pid, 0);
    if (!pid || seen.has(pid)) continue;
    const tag = cleanText(item?.tag);
    if (tagName && tag !== tagName) continue;
    seen.add(pid);
    rows.push({
      pid,
      time: formatUnixSeconds(item?.timestamp),
      likes: toSafeInt(item?.likenum, 0),
      replies: toSafeInt(item?.reply, 0),
      tag,
      text: cleanText(item?.text),
      url: cleanText(item?.url),
    });
  }
  return rows;
}

export function sortPosts(rows, sort = 'time', tagId) {
  const tagName = tagId == null ? '' : KNOWN_TAGS[Number(tagId)] ?? null;
  if (tagName === null) return [];
  const filtered = tagName ? rows.filter((row) => row.tag === tagName) : [...rows];
  if (sort === 'likes') {
    return filtered.sort((a, b) => (b.likes - a.likes) || String(b.time).localeCompare(String(a.time)));
  }
  return filtered.sort((a, b) => String(b.time).localeCompare(String(a.time)));
}

function normalizeCommentText(comment) {
  let text = cleanText(comment?.text);
  const name = cleanText(comment?.name);
  for (const prefix of [name ? `[${name}] ` : '', comment?.islz ? '[洞主] ' : '']) {
    if (prefix && text.startsWith(prefix)) {
      text = text.slice(prefix.length);
    }
  }
  return text;
}

export function normalizeComments(items) {
  const rows = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const cid = toSafeInt(item?.cid, 0);
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    rows.push({
      cid,
      pid: toSafeInt(item?.pid, 0),
      time: formatUnixSeconds(item?.timestamp),
      name: cleanText(item?.name),
      is_lz: Boolean(item?.islz),
      quote_text: item?.quote_text == null ? null : cleanText(item.quote_text),
      text: normalizeCommentText(item),
    });
  }
  return rows;
}

export function unwrapEvaluateResult(payload) {
  if (
    payload &&
    !Array.isArray(payload) &&
    typeof payload === 'object' &&
    'session' in payload &&
    'data' in payload
  ) {
    return payload.data;
  }
  return payload;
}

export function renderMarkdown(posts, title = '树洞导出') {
  const lines = [`# ${title}`, ''];
  for (const post of posts) {
    lines.push(`## #${post.pid} (${post.time})`, '');
    lines.push(`赞 ${post.likes}  回复 ${post.replies}`, '');
    if (post.tag) {
      lines.push(`标签：${post.tag}`, '');
    }
    lines.push(post.text || '', '', '---');
  }
  return `${lines.join('\n')}\n`;
}
