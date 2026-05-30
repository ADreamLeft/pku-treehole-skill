# PKU Treehole Skill

这是一个给 Codex 使用的北大树洞 skill。它默认配合 OpenCLI 的 `treehole` adapter 使用，通过 OpenCLI Browser Bridge 复用本机已登录的 Chrome 会话读取树洞页面状态，不导出、不保存浏览器 cookie。

## 能做什么

- 搜索关键词或 `#PID`
- 浏览最近帖子，按点赞数和回复数筛选
- 读取单帖详情和回复
- 查询已知标签 ID
- 导出筛选结果为 Markdown
- 在 OpenCLI 不可用时，使用随 skill 附带的 Python 脚本作为备用方案

## 安装

把仓库克隆到 Codex skills 目录：

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/ADreamLeft/pku-treehole-skill.git ~/.codex/skills/pku-treehole
```

然后重启 Codex，或重新加载 skills。

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

## 直接使用 OpenCLI

常用命令：

```bash
opencli treehole search "数学期末" --pages 5 -f json
opencli treehole post 8164148 --all-comments -f json
opencli treehole latest --pages 3 --min-likes 5 --min-replies 10 -f json
opencli treehole tags -f table
opencli treehole export-markdown ./treehole.md --keyword "数学期末" --pages 5 -f json
```

可查看 adapter 参数：

```bash
opencli treehole --help
opencli treehole search --help
opencli treehole post --help
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
- 优先调用 `opencli treehole ...`；
- 对需要进一步分析的长帖再读取单帖和全部回复；
- 原始数据和总结分开放置；
- 保持串行、低频、分批读取，避免大规模抓取。

## Python 备用方案

如果 OpenCLI Browser Bridge 暂时不可用，但你已经用 Chrome debug port 登录了树洞，可以使用 `scripts/` 中的 legacy Python fallback：

```bash
cd ~/.codex/skills/pku-treehole
python3 -m pip install requests playwright
python3 -m playwright install chromium

export TREEHOLE_DEBUG_HOST=localhost
export TREEHOLE_DEBUG_PORT=9222
export TREEHOLE_URL=https://treehole.pku.edu.cn/web/

python3 scripts/treehole_cli.py search "数学期末" --pages 5 --json
python3 scripts/treehole_cli.py post 8164148 --all-comments --json
```

macOS 上可以这样启动 debug Chrome：

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=${TREEHOLE_DEBUG_PORT:-9222} \
  --user-data-dir=/tmp/chrome-debug
```

## 文件结构

```text
.
├── SKILL.md
├── README.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── api-and-data.md
│   └── task-templates.md
└── scripts/
    ├── treehole_cli.py
    └── treehole_client.py
```

## 注意事项

- 只用于你有权限访问的树洞内容。
- 不要发布或转存包含个人隐私的原始帖子、评论或图片。
- 不要做并发抓取、长时间刷新或超大规模导出。
- `bookmarks` 当前没有在 direct-page fallback 模式中实现。
