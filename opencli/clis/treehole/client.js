import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

import {
  KNOWN_TAGS,
  TREEHOLE_URL,
  normalizeComments,
  normalizePid,
  normalizePosts,
  sortPosts,
  unwrapEvaluateResult,
} from './utils.js';

const INITIAL_LOAD_WAIT_SECONDS = 0.5;
const ACTION_SETTLE_SECONDS = 0.4;
const POLL_SECONDS = 0.6;
const SCROLL_THROTTLE_SECONDS = 3.4;

function normalizeWriteText(value, name = 'text') {
  const text = String(value ?? '').trim();
  if (!text) throw new ArgumentError(`${name} must not be empty`);
  return text;
}

function normalizeOptionalPositiveInt(value, name) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ArgumentError(`${name} must be a safe positive integer`);
  }
  return parsed;
}

function normalizeOptionalTagId(value) {
  const tagId = normalizeOptionalPositiveInt(value, 'tag-id');
  if (tagId == null) return null;
  if (!Object.hasOwn(KNOWN_TAGS, tagId)) {
    throw new ArgumentError(`tag-id must be one of: ${Object.keys(KNOWN_TAGS).join(', ')}`);
  }
  return tagId;
}

async function optionalWait(page, seconds) {
  if (typeof page.wait === 'function') {
    await page.wait(seconds);
  }
}

async function assertLoggedIn(page) {
  const state = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_ASSERT_LOGGED_IN */
    (() => {
      const app = document.querySelector('#app');
      const root = app && app.__vue__;
      const indexVm = root && root.$children && root.$children[0];
      return {
        hasRoot: !!root,
        hasIndex: !!indexVm,
        text: document.body ? document.body.innerText.slice(0, 300) : '',
      };
    })()
  `));

  if (!state?.hasRoot || !state?.hasIndex || !String(state?.text ?? '').includes('北大树洞')) {
    throw new AuthRequiredError(
      'treehole.pku.edu.cn',
      `Open ${TREEHOLE_URL} in Chrome, complete PKU login, then retry.`,
    );
  }
}

async function openTreehole(page) {
  await page.goto(TREEHOLE_URL, { settleMs: 1000 });
  await optionalWait(page, INITIAL_LOAD_WAIT_SECONDS);
  await assertLoggedIn(page);
}

async function postState(page) {
  const state = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_POST_STATE */
    (() => {
      const root = document.querySelector('#app')?.__vue__;
      const indexVm = root?.$children?.[0];
      if (!indexVm) return { error: 'missing-index-vm', loading: false, length: 0 };
      return {
        loading: !!indexVm.loading,
        length: Array.isArray(indexVm.list) ? indexVm.list.length : 0,
      };
    })()
  `));
  if (state?.error) {
    throw new CommandExecutionError(`Treehole page state is unavailable: ${state.error}`);
  }
  return state;
}

async function waitForPosts(page, { minCount = 1, timeoutMs = 15000, requireIdle = true } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastLength = -1;
  let stableRounds = 0;

  while (Date.now() < deadline) {
    const state = await postState(page);
    const currentLength = Number(state.length || 0);
    const loadingReady = !requireIdle || !state.loading;
    if (loadingReady && currentLength >= minCount) {
      if (currentLength === lastLength) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
      }
      if (stableRounds >= 1) return;
    }
    lastLength = currentLength;
    await optionalWait(page, POLL_SECONDS);
  }
}

async function runSearch(page, keyword, { timeoutMs = 15000, requireIdle = true } = {}) {
  const result = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_RUN_SEARCH */
    (() => {
      const root = document.querySelector('#app')?.__vue__;
      const indexVm = root?.$children?.[0];
      const headerVm = indexVm?.$children?.find((component) => {
        const name = component.$options.name || component.$options._componentTag;
        return name === 'headerTop';
      });
      if (!headerVm || typeof headerVm.search !== 'function') {
        return { ok: false, error: 'missing-header-search' };
      }
      headerVm.keyword = ${JSON.stringify(keyword)};
      headerVm.search();
      return { ok: true };
    })()
  `));
  if (!result?.ok) {
    throw new CommandExecutionError(`Treehole search failed: ${result?.error ?? 'unknown error'}`);
  }
  await waitForPosts(page, { minCount: 1, timeoutMs, requireIdle });
  await optionalWait(page, ACTION_SETTLE_SECONDS);
}

async function extractPosts(page, tagId) {
  const payload = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_EXTRACT_POSTS */
    (() => {
      const root = document.querySelector('#app')?.__vue__;
      const indexVm = root?.$children?.[0];
      if (!indexVm) return [];
      return (indexVm.list || []).map((item) => ({
        pid: item.pid,
        text: item.text || '',
        type: item.type || '',
        timestamp: item.timestamp || null,
        reply: item.reply || 0,
        likenum: item.likenum || 0,
        tag: item.tag || '',
        url: item.url || null,
      }));
    })()
  `));
  if (!Array.isArray(payload)) {
    throw new CommandExecutionError('Treehole post extraction returned malformed data');
  }
  return normalizePosts(payload, tagId);
}

async function scrollForMorePosts(page) {
  await optionalWait(page, SCROLL_THROTTLE_SECONDS);
  if (typeof page.autoScroll === 'function') {
    await page.autoScroll({ times: 1, delayMs: 350 });
  } else if (typeof page.scroll === 'function') {
    await page.scroll('down', 6000);
  } else {
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  }
  await optionalWait(page, ACTION_SETTLE_SECONDS);
}

export async function loadPosts(page, { keyword = '', pages = 3, limit = 25, tagId = null, sort = 'time' } = {}) {
  const targetItems = Math.max(1, pages) * Math.max(1, limit);
  await openTreehole(page);
  if (keyword) {
    await runSearch(page, keyword);
  } else {
    await waitForPosts(page, { minCount: 1 });
  }

  let rows = await extractPosts(page, tagId);
  let stalledRounds = 0;
  while (rows.length < targetItems && stalledRounds < 2) {
    const before = rows.length;
    await scrollForMorePosts(page);
    rows = await extractPosts(page, tagId);
    stalledRounds = rows.length <= before ? stalledRounds + 1 : 0;
  }

  const sorted = sortPosts(rows, sort, tagId).slice(0, targetItems);
  if (!sorted.length) {
    throw new EmptyResultError('treehole search', 'No Treehole posts matched the current query.');
  }
  return sorted;
}

function normalizeApiCommentPayload(payload) {
  if (!payload?.success) return [];
  const data = payload.data ?? {};
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map((item) => ({
    cid: item.cid,
    pid: item.pid,
    text: item.text || '',
    name: item.name || '',
    islz: item.islz || item.name === '洞主',
    quote_text: item.quote && typeof item.quote === 'object' ? item.quote.text || null : null,
    timestamp: item.timestamp || null,
  }));
}

async function fetchAllCommentsViaPage(page, pid) {
  const payload = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_FETCH_COMMENTS */
    (async () => {
      function getCookie(name) {
        const escaped = name.replace(/[.$?*|{}()\\[\\]\\/\\+^]/g, '\\\\$&');
        const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
      }
      const token = getCookie('pku_token');
      const uuid = localStorage.getItem('pku-uuid') || '';
      const headers = {
        Authorization: 'Bearer ' + token,
        Uuid: uuid,
        Accept: 'application/json, text/plain, */*',
      };
      async function getPage(pageNum) {
        const resp = await fetch('/api/pku_comment_v3/${pid}?page=' + pageNum + '&limit=10', {
          headers,
          credentials: 'same-origin',
        });
        if (!resp.ok) return { success: false, status: resp.status };
        return await resp.json();
      }
      const first = await getPage(1);
      if (!first || !first.success) return first || { success: false };
      const data = first.data || {};
      const lastPage = Number(data.last_page || 1);
      const rows = Array.isArray(data.data) ? [...data.data] : [];
      for (let pageNum = 2; pageNum <= lastPage; pageNum += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));
        const next = await getPage(pageNum);
        if (!next || !next.success) break;
        const nextRows = Array.isArray(next.data?.data) ? next.data.data : [];
        rows.push(...nextRows);
      }
      return { success: true, data: { data: rows, total: Number(data.total || rows.length), last_page: lastPage } };
    })()
  `));
  return normalizeApiCommentPayload(payload);
}

async function extractRenderedComments(page, pid) {
  const payload = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_EXTRACT_COMMENTS */
    (() => {
      const root = document.querySelector('#app')?.__vue__;
      const indexVm = root?.$children?.[0];
      const replyVms = (indexVm?.$children || []).filter((component) => {
        const name = component.$options.name || component.$options._componentTag;
        return name === 'reply';
      });
      const match = replyVms.find((component) => Number(component.pid || 0) === Number(${pid}));
      if (!match) return [];
      return (match.data || []).map((item) => ({
        cid: item.cid,
        pid: item.pid,
        text: item.text || '',
        name: item.name || '',
        islz: item.islz,
        quote_text: item.quote_text || null,
        timestamp: item.timestamp || null,
      }));
    })()
  `));
  return Array.isArray(payload) ? payload : [];
}

export async function loadPostBundle(page, { pid, allComments = false, commentsLimit = 100 } = {}) {
  const postId = normalizePid(pid);
  await openTreehole(page);
  await runSearch(page, `#${postId}`, { timeoutMs: 5000, requireIdle: false });
  const posts = await extractPosts(page);
  const post = posts.find((row) => row.pid === postId);
  if (!post) {
    throw new EmptyResultError('treehole post', `No Treehole post was found for #${postId}.`);
  }

  let comments = [];
  if (allComments && post.replies > 0) {
    comments = await fetchAllCommentsViaPage(page, postId);
  }
  if (!comments.length && post.replies > 0) {
    comments = await extractRenderedComments(page, postId);
  }

  return {
    post,
    comments: normalizeComments(comments).slice(0, commentsLimit),
  };
}

function normalizePublishPostResult(payload, text, tagId) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  return {
    success: Boolean(payload?.success),
    code: payload?.code ?? null,
    message: payload?.message ?? '',
    pid: data.pid ?? data.id ?? null,
    text: data.text ?? text,
    tag_id: tagId,
    tag: tagId == null ? '' : KNOWN_TAGS[tagId],
  };
}

function normalizePublishCommentResult(payload, pid, text, commentId) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  return {
    success: Boolean(payload?.success),
    code: payload?.code ?? null,
    message: payload?.message ?? '',
    cid: data.cid ?? null,
    pid: data.pid ?? pid,
    text: data.text ?? text,
    name: data.name ?? '',
    is_lz: Boolean(data.islz),
    comment_id: data.comment_id ?? commentId,
    timestamp: data.timestamp ?? null,
  };
}

export async function publishPost(page, { text, tagId = null, dryRun = true } = {}) {
  const bodyText = normalizeWriteText(text);
  const normalizedTagId = normalizeOptionalTagId(tagId);
  if (dryRun) {
    return {
      dry_run: true,
      action: 'post',
      text: bodyText,
      type: 'text',
      tag_id: normalizedTagId,
      tag: normalizedTagId == null ? '' : KNOWN_TAGS[normalizedTagId],
    };
  }

  await openTreehole(page);
  const payload = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_PUBLISH_POST */
    (async () => {
      function getCookie(name) {
        const escaped = name.replace(/[.$?*|{}()\\[\\]\\/\\+^]/g, '\\\\$&');
        const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
      }
      const token = getCookie('pku_token');
      const uuid = localStorage.getItem('pku-uuid') || '';
      if (!token || !uuid) return { ok: false, status: 0, error: 'missing-auth-material' };
      const body = new FormData();
      body.append('text', ${JSON.stringify(bodyText)});
      body.append('type', 'text');
      const tagId = ${normalizedTagId == null ? 'null' : JSON.stringify(String(normalizedTagId))};
      if (tagId !== null) body.append('label', tagId);
      const resp = await fetch('/api/pku_store', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          Uuid: uuid,
          Accept: 'application/json, text/plain, */*',
        },
        credentials: 'same-origin',
        body,
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      return { ok: resp.ok, status: resp.status, data };
    })()
  `));

  if (!payload?.ok || !payload?.data?.success) {
    throw new CommandExecutionError(
      `Treehole post publish failed: ${payload?.data?.message ?? payload?.error ?? payload?.status ?? 'unknown error'}`,
    );
  }
  return normalizePublishPostResult(payload.data, bodyText, normalizedTagId);
}

export async function publishComment(page, { pid, text, commentId = null, dryRun = true } = {}) {
  const postId = normalizePid(pid);
  const bodyText = normalizeWriteText(text);
  const normalizedCommentId = normalizeOptionalPositiveInt(commentId, 'comment-id');
  if (dryRun) {
    return {
      dry_run: true,
      action: 'comment',
      pid: postId,
      text: bodyText,
      comment_id: normalizedCommentId,
    };
  }

  await openTreehole(page);
  const payload = unwrapEvaluateResult(await page.evaluate(`
    /* TREEHOLE_PUBLISH_COMMENT */
    (async () => {
      function getCookie(name) {
        const escaped = name.replace(/[.$?*|{}()\\[\\]\\/\\+^]/g, '\\\\$&');
        const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
      }
      const token = getCookie('pku_token');
      const uuid = localStorage.getItem('pku-uuid') || '';
      if (!token || !uuid) return { ok: false, status: 0, error: 'missing-auth-material' };
      const body = { pid: ${postId}, text: ${JSON.stringify(bodyText)} };
      const commentId = ${normalizedCommentId == null ? 'null' : normalizedCommentId};
      if (commentId !== null) body.comment_id = commentId;
      const resp = await fetch('/api/pku_comment_v3', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          Uuid: uuid,
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=UTF-8',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      return { ok: resp.ok, status: resp.status, data };
    })()
  `));

  if (!payload?.ok || !payload?.data?.success) {
    throw new CommandExecutionError(
      `Treehole comment publish failed: ${payload?.data?.message ?? payload?.error ?? payload?.status ?? 'unknown error'}`,
    );
  }
  return normalizePublishCommentResult(payload.data, postId, bodyText, normalizedCommentId);
}

export function readTags() {
  return Object.entries(KNOWN_TAGS).map(([id, name]) => ({ id: Number(id), name }));
}
