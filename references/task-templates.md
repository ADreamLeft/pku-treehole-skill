# Task Templates

## Contents

- Search and summarize
- Fetch one post with replies
- Browse hot recent posts
- Export Markdown

## Search and summarize

```bash
mkdir -p raw_data summaries
opencli treehole search "数学期末" --pages 5 --sort likes --site-session persistent -f json > raw_data/math_final_search.json
opencli treehole post 8164148 --all-comments --site-session persistent -f json > raw_data/post_8164148.json
```

## Fetch one post with replies

```bash
mkdir -p raw_data
opencli treehole post 8164148 --all-comments --site-session persistent -f json > raw_data/post_8164148.json
```

## Browse hot recent posts

```bash
mkdir -p raw_data
opencli treehole latest --pages 3 --min-likes 5 --min-replies 10 --site-session persistent -f json > raw_data/hot_latest.json
```

## Export Markdown

```bash
opencli treehole export-markdown treehole_job.md --keyword "数学期末" --pages 5 --site-session persistent -f json
opencli treehole export-markdown job_experience.md --tag-id 3 --pages 5 --title 求职经历 --site-session persistent -f json
```
