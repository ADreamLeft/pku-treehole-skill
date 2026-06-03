---
name: pku-treehole
description: "Use when Codex needs to retrieve, search, browse, filter, summarize, export, or explicitly publish text posts/comments on PKU Treehole via the local OpenCLI treehole adapter. Reuses a persistent logged-in browser session through OpenCLI Browser Bridge, reads/writes through page-native APIs, and does not ask for PKU credentials or manually extracted cookies. Supports keyword search, post details with replies, recent posts, tags, Markdown export, text post publishing, and text comment publishing."
---

# PKU Treehole

## Overview

Use only the local OpenCLI adapter for Treehole access. It reuses OpenCLI Browser Bridge and the user's logged-in Chrome session, reads Treehole page state directly, can publish text posts/comments through page-native APIs when explicitly requested, and does not ask for PKU credentials or manually extracted cookies.

Use persistent site sessions so repeated commands can reuse the same OpenCLI Treehole tab and browser login state.

## Prerequisites

- OpenCLI is installed and `opencli doctor` reports the Browser Bridge extension connected.
- Chrome is already logged into `https://treehole.pku.edu.cn/web/`.
- Prefer a named/default OpenCLI profile if multiple Chrome profiles are connected: `opencli profile list`, then `opencli profile use <profile>`.

## Workflow

1. **Connection Check**: Run `opencli doctor` first. If the extension is disconnected, start Chrome and retry `opencli daemon restart`.
2. **Search Strategy**: Generally, start by using `search` to look for keywords. If you find a post with a long comment section that appears informative, use the `post <id> --all-comments` command to fetch the full discussion.
3. **Data Organization**: Always organize relevant raw post data into a dedicated folder (e.g., `raw_data/`), and place generated summaries into a separate folder (e.g., `summaries/`).
4. Use `--site-session persistent` unless the local adapter already defaults to persistent sessions. For standard operations, use:
   - `search`: keyword search, optional tag filter, optional JSON output
   - `latest`: recent posts with optional hot-post filtering
   - `post`: single post plus replies
   - `tags`: available tag list
   - `export-markdown`: export filtered posts to a Markdown file
   - `write`: publish a plain-text Treehole post; dry-run by default, requires `--confirm` to send
   - `comment`: publish a plain-text comment under a post; dry-run by default, requires `--confirm` to send
5. For write actions, only send when the user clearly requested the exact action/content. Run without `--confirm` first if you need to preview arguments.
6. For custom analysis or one-off transforms, use OpenCLI JSON output first and process the saved JSON files locally.
7. Keep every action strictly serial. Never use concurrent fetching, tab fan-out, or aggressive refresh loops.
8. Keep one task reasonably small. Split large crawls into batches with pauses between runs.

## Common Commands

```bash
opencli treehole search "数学期末" --pages 5 --site-session persistent -f json
opencli treehole post 8164148 --all-comments --site-session persistent -f json
opencli treehole latest --pages 3 --min-likes 5 --min-replies 10 --site-session persistent -f json
opencli treehole export-markdown treehole_job.md --tag-id 3 --pages 5 --site-session persistent -f json
opencli treehole tags -f table
opencli treehole write "炒作是什么意思" -f json
opencli treehole write "炒作是什么意思" --confirm -f json
opencli treehole comment 8279942 "莫名其妙的热梗" --confirm -f json
```

## References

- Read [references/api-and-data.md](references/api-and-data.md) for setup, page model, tag IDs, data fields, rate limiting, and troubleshooting.
- Read [references/task-templates.md](references/task-templates.md) when you need ready-made OpenCLI command patterns for search, detail retrieval, hot-post browsing, or Markdown export.

## Guardrails

- Prefer the OpenCLI `treehole` adapter over ad-hoc DOM scraping scripts.
- Respect the adapter's conservative paging; do not bypass it with custom browser scripts or direct API loops.
- Do not publish posts or comments unless the user explicitly asks for that exact write action and content.
- Write commands dry-run by default; add `--confirm` only after checking the target PID/content.
- Keep one task reasonably small; if the user requests a very large crawl, split it into batches with pauses between runs.
- Do not ask the user for PKU username/password, copied cookies, bearer tokens, UUID, or XSRF tokens.
