---
name: pku-treehole
description: "Use when Codex needs to retrieve, search, browse, filter, summarize, or export content from PKU Treehole via the local OpenCLI treehole adapter. Reuses a persistent logged-in browser session through OpenCLI Browser Bridge, reads page state directly, and does not ask for PKU credentials or manually extracted cookies. Supports keyword search, post details with replies, recent posts, tags, and Markdown export."
---

# PKU Treehole

## Overview

Use only the local OpenCLI adapter for Treehole access. It reuses OpenCLI Browser Bridge and the user's logged-in Chrome session, reads Treehole page state directly, and does not ask for PKU credentials or manually extracted cookies.

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
5. For custom analysis or one-off transforms, use OpenCLI JSON output first and process the saved JSON files locally.
6. Keep every action strictly serial. Never use concurrent fetching, tab fan-out, or aggressive refresh loops.
7. Keep one task reasonably small. Split large crawls into batches with pauses between runs.

## Common Commands

```bash
opencli treehole search "数学期末" --pages 5 --site-session persistent -f json
opencli treehole post 8164148 --all-comments --site-session persistent -f json
opencli treehole latest --pages 3 --min-likes 5 --min-replies 10 --site-session persistent -f json
opencli treehole export-markdown treehole_job.md --tag-id 3 --pages 5 --site-session persistent -f json
opencli treehole tags -f table
```

## References

- Read [references/api-and-data.md](references/api-and-data.md) for setup, page model, tag IDs, data fields, rate limiting, and troubleshooting.
- Read [references/task-templates.md](references/task-templates.md) when you need ready-made OpenCLI command patterns for search, detail retrieval, hot-post browsing, or Markdown export.

## Guardrails

- Prefer the OpenCLI `treehole` adapter over ad-hoc DOM scraping scripts.
- Respect the adapter's conservative paging; do not bypass it with custom browser scripts or direct API loops.
- Keep one task reasonably small; if the user requests a very large crawl, split it into batches with pauses between runs.
- Do not ask the user for PKU username/password, copied cookies, bearer tokens, UUID, or XSRF tokens.
