# API And Data Reference

## Contents

- Environment
- Access model
- Safety rules
- Page model
- Data fields
- Troubleshooting

## Environment

Primary runtime:

- OpenCLI is installed.
- `opencli doctor` reports that Browser Bridge is connected.
- Chrome is logged into `https://treehole.pku.edu.cn/web/`.

Useful checks:

```bash
opencli doctor
opencli treehole --help
opencli treehole tags -f table
```

Legacy Python fallback:

Use this only when OpenCLI Browser Bridge is unavailable and a Chrome debug port is already running.

```bash
python3 -m pip install requests playwright
python3 -m playwright install chromium
export TREEHOLE_DEBUG_HOST=localhost
export TREEHOLE_DEBUG_PORT=9222
export TREEHOLE_URL=https://treehole.pku.edu.cn/web/
```

## Access model

The preferred OpenCLI adapter uses Browser Bridge to operate inside the user's logged-in browser session. It reads Treehole content through the browser page state and page-native methods, and emits structured output through OpenCLI formats such as JSON, Markdown, CSV, or table.

Preferred order:

1. Verify Browser Bridge with `opencli doctor`.
2. Use `opencli treehole search`, `latest`, `post`, `tags`, or `export-markdown`.
3. Request `-f json` for downstream analysis and summarization.
4. Use the bundled Python fallback only for environments where OpenCLI is unavailable.

## Safety rules

- Keep actions strictly serial. Do not use `ThreadPoolExecutor`, `asyncio.gather`, or similar fan-out patterns.
- Do not aggressively refresh the same keyword or PID.
- Do not open multiple automation tabs at once.
- Keep one run modest. As a rule of thumb, avoid going past `max_pages=20` in a single task.

OpenCLI and the bundled fallback are designed for conservative, serial reads. The Python fallback also includes local throttling:

| Item | Value |
| --- | --- |
| Rate target | 18 page actions / 60 seconds |
| Minimum gap | ~3.3s + random jitter |
| Page settle wait | 2.5s |
| Scroll settle wait | 2.5s |

## Page Model

The current skill reads from the logged-in web app rather than directly calling public REST endpoints.

Useful component/data entry points:

- `index.list`: current post list already rendered in page state
- `headerTop.search()`: trigger keyword search
- search keyword `#PID`: fetch one post by PID
- `reply.data`: replies already loaded for one post

Behavior notes:

- A fresh page starts on the latest feed.
- Search results are loaded through the page itself.
- Additional results are loaded conservatively by scrolling.
- Tag IDs are mapped locally using the known built-in labels.

Known tag IDs:

| ID | Name |
| --- | --- |
| `1` | 课程心得 |
| `2` | 失物招领 |
| `3` | 求职经历 |
| `5` | 跳蚤市场 |

## Data fields

### Post

| Field | Type | Meaning |
| --- | --- | --- |
| `pid` | int | post ID |
| `text` | str | post body |
| `type` | str | usually empty or `"image"` |
| `timestamp` | int | Unix timestamp in seconds |
| `likenum` | int | likes |
| `reply` | int | reply count |
| `tag` | str/null | tag name |
| `url` | str/null | image URL when present |

### Comment

| Field | Type | Meaning |
| --- | --- | --- |
| `cid` | int | comment ID |
| `pid` | int | post ID |
| `text` | str | reply body |
| `timestamp` | int | Unix timestamp |
| `name` | str | anonymous display name |
| `islz` | int | `1` when the author is the original poster |
| `quote_text` | str/null | quoted snippet |

## Troubleshooting

### Cannot connect to the debug port

Chrome is not running with `--remote-debugging-port=<port>`, or it is using a different port than `TREEHOLE_DEBUG_PORT`.

### The page opens but the skill says Treehole is not logged in

Reopen the URL configured by `TREEHOLE_URL` in the debug Chrome instance and confirm the feed is visible before running the skill.

### Search results look unrelated

A blank keyword means the latest feed rather than search mode. Pass a non-empty keyword when you want search semantics.

### `get_comments()` returns only part of a hot thread

Very hot threads may render replies incrementally in the page. Retry with `--all-comments`, keep the batch small, and avoid repeated refreshes.

### `bookmarks` fails

Bookmarks are not currently exposed in the direct-page reader.
