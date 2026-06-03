# PKU Treehole Skill

这是一个给 Codex 使用的北大树洞 skill。它只配合 OpenCLI 的 `treehole` adapter 使用，通过 OpenCLI Browser Bridge 复用本机已登录的 Chrome 会话读取树洞页面状态，并可在明确要求时发布纯文字帖子/评论；它不要求输入学号密码，也不要求手动复制 cookie、token、UUID 或 XSRF。

## 能做什么

- 搜索关键词或 `#PID`
- 浏览最近帖子，按点赞数和回复数筛选
- 读取单帖详情和回复
- 查询已知标签 ID
- 导出筛选结果为 Markdown
- 发布纯文字树洞帖子，默认 dry-run，需 `--confirm` 才会发送
- 在帖子下发布纯文字评论，默认 dry-run，需 `--confirm` 才会发送

## 安装

先安装 OpenCLI：

```bash
npm install -g @jackwener/opencli
```

再安装北大树洞 adapter：

```bash
npx @adreamleft/opencli-treehole-adapter install
opencli treehole --help
```

`opencli treehole --help` 应该能看到 `search`、`latest`、`post`、`tags`、`export-markdown`、`write` 和 `comment`。

把仓库克隆到 Codex skills 目录：

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/ADreamLeft/pku-treehole-skill.git ~/.codex/skills/pku-treehole
```

然后重启 Codex，或重新加载 skills。

如果 npm/npx 不方便使用，也可以从仓库手动安装 adapter：

```bash
mkdir -p ~/.opencli/clis/treehole ~/.opencli/node_modules/@jackwener
cp -R ~/.codex/skills/pku-treehole/opencli/clis/treehole/*.js ~/.opencli/clis/treehole/
test -f ~/.opencli/package.json || cp ~/.codex/skills/pku-treehole/opencli/package.json ~/.opencli/package.json
test -e ~/.opencli/node_modules/@jackwener/opencli || ln -s "$(npm root -g)/@jackwener/opencli" ~/.opencli/node_modules/@jackwener/opencli
opencli treehole --help
```

## OpenCLI 准备

需要先安装并配置 OpenCLI，确保 Browser Bridge 扩展已经连接：

```bash
opencli doctor
```

如果 Browser Bridge 没有连接，先打开 Chrome，确认扩展可用，然后重启 OpenCLI daemon：

```bash
opencli daemon restart
opencli doctor
```

同时需要在 Chrome 中登录：

```text
https://treehole.pku.edu.cn/web/
```

如果有多个 Chrome profile 连接到 Browser Bridge，先固定默认 profile：

```bash
opencli profile list
opencli profile use <profile>
```

## 持久会话

推荐使用 OpenCLI 的持久站点会话：

```bash
opencli treehole search "数学期末" --pages 5 --site-session persistent -f json
```

`persistent` 会让 OpenCLI 复用 `site:treehole` 会话和浏览器中的登录态。它的效果接近本地记住 cookie，但凭据仍留在 Chrome/OpenCLI Browser Bridge 的浏览器上下文里，skill 不会保存学号密码或手动导出的 cookie 文件。

## 直接使用 OpenCLI

常用命令：

```bash
opencli treehole search "数学期末" --pages 5 --site-session persistent -f json
opencli treehole post 8164148 --all-comments --site-session persistent -f json
opencli treehole latest --pages 3 --min-likes 5 --min-replies 10 --site-session persistent -f json
opencli treehole tags -f table
opencli treehole export-markdown ./treehole.md --keyword "数学期末" --pages 5 --site-session persistent -f json
opencli treehole write "炒作是什么意思" -f json
opencli treehole write "炒作是什么意思" --confirm -f json
opencli treehole comment 8279942 "莫名其妙的热梗" --confirm -f json
```

可查看 adapter 参数：

```bash
opencli treehole --help
opencli treehole search --help
opencli treehole post --help
opencli treehole write --help
opencli treehole comment --help
```

## 在 Codex 中使用

可以直接点名 skill：

```text
Use $pku-treehole to search "数学期末" on PKU Treehole, save raw JSON, and summarize the most relevant posts.
```

中文也可以：

```text
用 $pku-treehole 搜索“数学期末”，把原始结果保存到 raw_data/，再整理一个简短总结。
```

这个 skill 会指导 Codex：

- 先运行 `opencli doctor` 检查 Browser Bridge；
- 调用 `opencli treehole ... --site-session persistent`；
- 对需要进一步分析的长帖再读取单帖和全部回复；
- 对发帖/评论先确认目标和正文；没有 `--confirm` 时只 dry-run；
- 原始数据和总结分开放置；
- 保持串行、低频、分批读取，避免大规模抓取。

## 文件结构

```text
.
├── SKILL.md
├── README.md
├── agents/
│   └── openai.yaml
├── opencli/
│   ├── package.json
│   └── clis/
│       └── treehole/
│           ├── client.js
│           ├── client.test.js
│           ├── comment.js
│           ├── export-markdown.js
│           ├── latest.js
│           ├── post.js
│           ├── search.js
│           ├── tags.js
│           ├── utils.js
│           ├── utils.test.js
│           └── write.js
├── references/
│   ├── api-and-data.md
│   └── task-templates.md
```

## 注意事项

- 只用于你有权限访问的树洞内容。
- 不要发布或转存包含个人隐私的原始帖子、评论或图片。
- 不要在用户没有明确要求时发布帖子或评论。
- 不要做并发抓取、长时间刷新或超大规模导出。
- 不要让 agent、脚本或配置文件保存 PKU 学号密码、手动复制的 cookie、bearer token、UUID 或 XSRF。
