---
name: pku-treehole
description: "Use when Codex needs to retrieve, search, browse, filter, summarize, or export content from PKU Treehole via the local OpenCLI treehole adapter. Reuses the logged-in Chrome session through OpenCLI Browser Bridge, reads page state directly, and does not extract cookies. Supports keyword search, post details with replies, recent posts, tags, and Markdown export."
---

# PKU Treehole

## Overview

Prefer the local OpenCLI adapter for Treehole access. It reuses the OpenCLI Browser Bridge and the user's logged-in Chrome session, reads the Treehole page state directly, and does not extract cookies.

The legacy bundled Python client remains available as a fallback for cases where OpenCLI Browser Bridge is unavailable but a Chrome debug port is already running.

> Location note: The scripts are inside this skill directory (for example, `~/.codex/skills/pku-treehole/scripts/`), not in the target repository root. Run commands from this skill folder, or use the full script path.

## Prerequisites

- OpenCLI is installed and `opencli doctor` reports the Browser Bridge extension connected.
- Chrome is already logged into `https://treehole.pku.edu.cn/web/`.
- For the legacy Python fallback only: use `python3`, ensure `requests` and `playwright` are installed, and start Chrome with `--remote-debugging-port=<port>` (default `9222`).

## Workflow

1. **Connection Check**: Run `opencli doctor` first. If the extension is disconnected, start Chrome and retry `opencli daemon restart`.
2. **Search Strategy**: Generally, start by using `search` to look for keywords. If you find a post with a long comment section that appears informative, use the `post <id> --all-comments` command to fetch the full discussion.
3. **Data Organization**: Always organize relevant raw post data into a dedicated folder (e.g., `raw_data/`), and place generated summaries into a separate folder (e.g., `summaries/`).
4. For standard operations, use the CLI commands:
   - `search`: keyword search, optional tag filter, optional JSON output
   - `latest`: recent posts with optional hot-post filtering
   - `post`: single post plus replies
   - `tags`: available tag list
   - `export-markdown`: export filtered posts to a Markdown file
5. For custom analysis or one-off transforms, prefer OpenCLI JSON output first. Import `scripts/treehole_client.py` only when OpenCLI is unavailable.
6. Keep every action strictly serial. Never use concurrent fetching, tab fan-out, or aggressive refresh loops.
7. Keep one task reasonably small. Split large crawls into batches with pauses between runs.

## Common Commands

```bash
opencli treehole search "数学期末" --pages 5 -f json
opencli treehole post 8164148 --all-comments -f json
opencli treehole latest --pages 3 --min-likes 5 --min-replies 10 -f json
opencli treehole export-markdown treehole_job.md --tag-id 3 --pages 5 -f json
opencli treehole tags -f table
```

Legacy Python fallback:

```bash
python3 scripts/treehole_cli.py search "数学期末" --pages 5
python3 scripts/treehole_cli.py post 8164148 --all-comments
export TREEHOLE_DEBUG_PORT=9222
export TREEHOLE_DEBUG_HOST=localhost
export TREEHOLE_URL=https://treehole.pku.edu.cn/web/
```

## References

- Read [references/api-and-data.md](references/api-and-data.md) for setup, page model, tag IDs, data fields, rate limiting, and troubleshooting.
- Read [references/task-templates.md](references/task-templates.md) when you need ready-made Python snippets for search, detail retrieval, hot-post browsing, or Markdown export.

## Guardrails

- Prefer the OpenCLI `treehole` adapter over ad-hoc DOM scraping scripts.
- Respect the adapter's conservative paging and the built-in throttling in `treehole_client.py`; do not bypass either.
- Keep one task reasonably small; if the user requests a very large crawl, split it into batches with pauses between runs.
- `bookmarks` is not currently supported in direct-page mode.
