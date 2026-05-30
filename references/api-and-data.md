# API And Data Reference

## Contents

- Environment
- Access model
- Safety rules
- Page model
- Data fields
- Troubleshooting

## Environment

- OpenCLI is installed.
- `opencli doctor` reports that Browser Bridge is connected.
- Chrome is logged into `https://treehole.pku.edu.cn/web/`.
- If multiple Chrome profiles are connected, use `opencli profile use <profile>` before running Treehole commands.

Useful checks:

```bash
opencli doctor
opencli profile list
opencli treehole --help
opencli treehole tags -f table
```

## Access Model

The OpenCLI adapter uses Browser Bridge to operate inside the user's logged-in browser session. It reads Treehole content through the browser page state and page-native methods, and emits structured output through OpenCLI formats such as JSON, Markdown, CSV, or table.

Use persistent site sessions for repeated commands:

```bash
opencli treehole search "数学期末" --pages 5 --site-session persistent -f json
```

This reuses OpenCLI's `site:treehole` browser session. Login state remains in Chrome/OpenCLI Browser Bridge; the skill does not store PKU credentials or manually exported cookies.

Preferred order:

1. Verify Browser Bridge with `opencli doctor`.
2. Use `opencli treehole search`, `latest`, `post`, `tags`, or `export-markdown`, with `--site-session persistent` for browser-backed commands.
3. Request `-f json` for downstream analysis and summarization.
4. If OpenCLI cannot connect, ask the user to reopen Chrome, check the Browser Bridge extension, run `opencli daemon restart`, and log into Treehole again if needed.

## Safety rules

- Keep actions strictly serial. Do not use concurrent command fan-out or aggressive retry loops.
- Do not aggressively refresh the same keyword or PID.
- Do not open multiple automation tabs at once.
- Keep one run modest. Stay within the adapter's `--pages` limit and split larger tasks into batches.
- Do not ask for or store PKU username/password, copied cookies, bearer tokens, UUID, or XSRF tokens.

## Page Model

The current skill uses OpenCLI to read from the logged-in web app rather than directly calling REST endpoints from standalone scripts.

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

### Treehole is not logged in

Open `https://treehole.pku.edu.cn/web/` in the connected Chrome profile and confirm the feed is visible before running the skill.

### Browser Bridge is disconnected

Run `opencli doctor`. If it reports a disconnected extension, open Chrome, check the OpenCLI Browser Bridge extension, then run:

```bash
opencli daemon restart
opencli doctor
```

### Search results look unrelated

A blank keyword means the latest feed rather than search mode. Pass a non-empty keyword when you want search semantics.

### A hot thread returns partial comments

Very hot threads may render replies incrementally in the page. Retry once with `opencli treehole post <pid> --all-comments --site-session persistent -f json`, keep the batch small, and avoid repeated refreshes.

### Need direct cookie-file mode

This skill deliberately does not implement direct cookie-file mode. Use Chrome/OpenCLI Browser Bridge persistent sessions instead.
