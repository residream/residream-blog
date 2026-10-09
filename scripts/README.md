# 写好 Markdown 后部署

在项目目录运行，带空格或中文的路径用引号包住：

```sh
bun run deploy "$HOME/Desktop/Blog/博客翻新日志：从-WordPress-迁移到-Astro.md"
```

脚本会先显示图片来源、文章目录、主题色和发布时间。确认后导入并提交文章，构建网站、列出线上改动，再确认上线。需要全程自动执行时加 `--yes`。

## Markdown 格式

沿用现有文章的格式即可。`publishDate` 和 `color` 可以不写，也可以像下面这样保留占位符：

```md
---
title: '博客翻新日志：从 WordPress 迁移到 Astro'
description: '从 WordPress 到 Astro 的博客翻新记录。'
publishDate: 'xxxxxx'
tags:
  - 'astro'
heroImage: { src: './rain-in-the-sky.jpg', color: '#xxxxxx' }
language: 'zh-CN'
draft: true
---

正文……

![截图](./文章.assets/截图.png)
```

- 自动找到 `rain-in-the-sky.jpg`，复制到文章目录，并从图片提取主色。`heroImage` 也支持多行写法或直接写图片路径。
- 日期、颜色缺省、为空、写 `auto` 或全为 `x` 的占位符时自动补齐。合法的手动日期和十六进制颜色会保留；其他无效值会报错。
- 新文章使用导入时的时间；更新文章时保留原发布时间。`draft` 自动改为 `false`。
- `language` 使用 `zh-CN`（简体中文）或 `en`（英文）。旧稿中的 `简中`、`Zh`、`zh`、`zh-cn` 会在导入时统一为 `zh-CN`。
- 目录名先用 `--slug` 或 Markdown 的 `slug`，否则复用同标题文章的目录，再根据标题/文件名生成。纯中文名称会生成稳定的短编号，不需要临时填写。
- 不写头图时，使用正文第一张本地图片；完全没有本地图片时使用站点默认色。写 `heroImage: false` 可以不设头图。
- 没有 frontmatter 的普通 Markdown 也能导入：用一级标题或文件名作标题，从第一段提取描述。标题最多 60 字，描述最多 160 字。

## GitHub 项目卡片

普通 `.md` 也可以插入主题的项目卡片，复制这一行并修改仓库名和链接即可：

```html
<github-card data-repo="cworld1/astro-theme-pure"><a href="https://github.com/cworld1/astro-theme-pure">astro-theme-pure</a></github-card>
```

构建时读取项目简介、Stars、Forks 和许可证，缓存 24 小时，直接写入页面。接口暂时不可用时沿用缓存，首次构建也可使用已保存的公开项目资料。构建缓存位于 `.astro/github-cards/`，不会提交到仓库。Stars、Forks 上线后还会通过下面的每日任务更新。

## 公开数据与贡献图更新

服务器每天北京时间 03:00 获取 GitHub 卡片的 Stars、Forks、About 的 GitHub/Bilibili 粉丝数、Steam 游戏数和好友数，以及 Projects 的 GitHub 贡献图。每个来源独立更新；超时、限流或无效响应时保留该项上次成功值，合法的 `0` 正常更新。部署后也会触发一次更新。

任务从已经发布的页面自动识别数字对应的仓库和账号，新增卡片或修改 About 的账号后正常部署即可。贡献图的账号与配色配置在 `scripts/public-stats/chart.py`；`public/data/github-contributions.svg` 是本地预览和首次安装的底图，日常更新不修改仓库文件。

页面先显示已有数字，贡献图底图直接随 HTML 内嵌，首次打开也无需等待额外图片请求；后台再读取同站缓存并检查更新。有相关数字时先读取 `/data/public-stats.json`，再由 `/data/public-refresh.json` 检查当前页面用到的来源。访问触发的检查中，数字每个来源最多一小时一次，贡献图最多十分钟一次；失败后等待十分钟再尝试。并发访问复用缓存，不会重复请求同一来源。每日任务保留，作为无人访问时的预热。

浏览器仅在贡献图内容不同时下载新版，完整解码成功后才替换；未变化、超时或图片损坏时保留原图。数字仅接受比页面更新的有效值，在固定位置短暂过渡到新值；数值未变、切换中英或开启减少动态效果时直接显示。中英切换复用近期已获取的结果；离开页面再返回时，超过十分钟可再次检查。浏览器只访问同站接口，评论和访问统计继续使用各自的更新方式。

数据保存在服务器 `/var/lib/residream-public-stats/`，数字和 SVG 均采用原子替换；部署、回滚不会覆盖，也不提交 Git。两个任务共用文件锁与刷新记录。每日任务运行结束即退出；按需刷新服务只监听 `127.0.0.1:8791`，由 Nginx 转发，最多四个并发请求，只接受已发布的数字和固定贡献图，不接受任意上游地址。两者均使用 Python 标准库，内存各限制为 64 MiB。

服务文件位于 `scripts/public-stats/`，首次安装到服务器时：

1. 创建系统用户 `residream-stats`，把三个 `.py` 文件放入 `/opt/residream-public-stats/`，三个 systemd 文件放入 `/etc/systemd/system/`。
2. 把 `nginx.conf` 放入 `/etc/nginx/snippets/residream-public-stats.conf`，在主站 `server` 中引用并验证配置后重新加载。
3. 在 Cloudflare 让 `/data/public-stats.json` 和 `/data/github-contributions.svg` 遵循源站的 10 分钟缓存头并保留完整查询参数作为缓存键；`/data/public-refresh.json` 必须绕过缓存，并且不能被强制覆盖 `no-store`。
4. 首次先把已验证的 `public/data/github-contributions.svg` 放到状态目录，并以 `residream-stats` 用户运行一次 `update.py`，生成数字缓存及来源清单。重新加载 systemd 配置并启用 `residream-public-stats.timer`、`residream-public-refresh.service`。

后续 `bun run deploy` 会检查三个 Python 文件，内容变化时更新并重启已安装的刷新服务，随后触发每日任务；修改服务、定时器或 Nginx 配置时需单独同步对应文件。若调整 `WEB_ROOT`，同时调整每日服务文件的 `--web-root`。

维护时查看 `residream-public-stats.timer` 的下次运行时间，以及 `residream-public-stats.service` 的日志；日志会列出失败并沿用旧值的数据来源。

## 图片放在哪里

优先按 Markdown 中的路径查找，支持相对路径、绝对路径、`file://` 地址、中文、空格和 URL 编码。找不到时依次递归查找：

1. Markdown 所在目录及子目录，例如 `文章.assets/`、`images/` 或 Blog 下的图片库。
2. `.deploy.env` 中的 `IMAGE_DIRS`，可以用冒号分隔多个目录。
3. 已有文章的目录。
4. 项目的 `src/assets/`、`public/` 和其他文章图片。

```sh
# .deploy.env，一次配置后不必每篇重复填写
IMAGE_DIRS="$HOME/Desktop/Blog/catzz-web-1200-jpg/images:$HOME/Pictures"
```

同一查找范围内存在内容不同的同名图时，会列出候选路径并停止；在 Markdown 中补全目录即可。缺图或损坏的图片会在导入前报错。

支持 Markdown 内联图片、引用式图片，以及 HTML `<img src="…">`。代码示例中的图片语法不会被误处理。Markdown 图片随文章保存，HTML 图片保存到 `public/images/posts/`，以保证构建后仍能访问并保留原来的样式。远程正文图片保留原链接；需要自动取色的头图使用本地图片。空白或 `img` 图片说明会用所在章节自动补齐。

## 预览与其他选项

```sh
# 只检查导入结果，不改源文件/仓库，不需要连接服务器
bun run deploy "文章.md" --dry-run

# 只导入并提交到本地，不构建/上线
bun run deploy "文章.md" --import-only

# 可选：指定文章 URL 中的目录名
bun run deploy "文章.md" --slug=blog-renovation

# 构建并部署已导入的内容
bun run deploy

# 构建并查看与线上的差异，不发布（此模式需要 SSH）
bun run deploy --dry-run

# 恢复上一次部署前的版本
bun run deploy --rollback
```

回滚会直接检查服务器上恢复的页面，不需要本地构建产物。发布与回滚都会先完整备份、按内容校验同步，再检查源站；写入或自检失败时恢复操作前的文件，并保留待清缓存清单。服务器需有 Python 3.9+、rsync、curl 和免交互 sudo。

## 发布与缓存清理

默认比较构建产物与线上文件的实际内容，只清理新增、修改、删除文件对应的 URL。修改公共布局或样式导致多个 HTML 变化时，这些页面也会自动纳入；只有时间戳或权限变化不算内容更新。页面同时处理 `/about`、`/about/`、`/about/index.html` 这样的访问形式，以及英文页面。图片、RSS、搜索索引等固定地址的文件也包含在内；新增的 `_astro/` 构建资源使用新地址，不额外清缓存。

每日公开数字与贡献图继续使用独立的缓存和刷新周期。默认清理只针对 `SITE_HOST`，不影响其他子域名；查询参数、自定义缓存键或额外域名不自动展开，调整 Cloudflare 缓存规则时需同时核对这些情况。URL 清理要求缓存规则也能匹配清理请求，详见 [Cloudflare 的说明](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/)。

Cloudflare 请求每批最多 100 个 URL，有超时和有限重试。失败时退出码非零，已发布的页面保留；未完成清单保存在服务器 `${WEB_ROOT}.deploy/`，后续部署即使没有页面变化也会补做清理，或单独运行：

```sh
# 不构建、不上传，只重试待清缓存
bun run deploy --purge-only

# 仅在确实需要时清整个 Zone，包括同区其他子域名
bun run deploy --purge-only --purge-all
```

每次上传使用独立临时目录，并从当前线上文件预填充，以保持增量上传。服务器文件锁阻止两个发布或回滚同时修改线上目录。`${WEB_ROOT}.prev/` 保留上一版，`${WEB_ROOT}.deploy/` 保存锁、中断恢复信息及待清缓存任务；正常结束会清理本次上传和临时备份。强制终止后如仍有中断标记，先运行 `bun run deploy --rollback` 恢复，再重试。

发布仍使用文件同步，不是整个目录的原子切换；同步期间可能有短暂的新旧文件交接。新增的是失败恢复与内容校验，不承诺零中断。`--skip-build` 仍表示使用已有产物，请确认 `dist/` 对应要发布的版本。

导入不会改动 Blog 中的源 Markdown；如果直接传入仓库内的文章，则原地更新。重复导入相同内容会跳过提交，也不会删除原有附件或图片。仓库有其他未提交改动时默认停止；确实希望一起构建时可加 `--allow-dirty`。部署会创建文章的本地 Git 提交，不会自动推送远端。

服务器与 Cloudflare 配置继续使用 `.deploy.env`，参考项目根目录的 `.deploy.env.example`。本地导入预览无需配置 `DEPLOY_HOST`。

维护脚本后可运行 `bun run test:deploy`，检查图片查找、取色、占位符、重复导入、隔离环境中的发布与回滚、缓存失败重试。测试需要本机有 Python 3.9+、Node.js、Bun、Git 和 rsync；SSH、源站请求及 Cloudflare 接口均使用模拟实现，不连接真实服务器。

主题源码通过 Bun workspace 直接引用 `packages/pure/`。首次安装或拉取依赖配置变更后运行一次 `bun install`，之后修改主题即可直接构建，无需同步依赖目录中的副本。

## 备份

服务器每天凌晨备份评论库和访问统计数据，保留 14 天；每周日归档服务器与服务配置，保留 5 周。密码、私钥等另行归档，只保存在服务器上。

```sh
# 把服务器上的备份同步到本机（位置见 .deploy.env 中的 BACKUP_DIR），并校验最新一份
bun run backup
```

本机副本不会被自动删除，需要时手动清理。
