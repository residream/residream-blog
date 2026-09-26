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
language: '简中'
draft: true
---

正文……

![截图](./文章.assets/截图.png)
```

- 自动找到 `rain-in-the-sky.jpg`，复制到文章目录，并从图片提取主色。`heroImage` 也支持多行写法或直接写图片路径。
- 日期、颜色缺省、为空、写 `auto` 或全为 `x` 的占位符时自动补齐。合法的手动日期和十六进制颜色会保留；其他无效值会报错。
- 新文章使用导入时的时间；更新文章时保留原发布时间。`draft` 自动改为 `false`。
- 目录名先用 `--slug` 或 Markdown 的 `slug`，否则复用同标题文章的目录，再根据标题/文件名生成。纯中文名称会生成稳定的短编号，不需要临时填写。
- 不写头图时，使用正文第一张本地图片；完全没有本地图片时使用站点默认色。写 `heroImage: false` 可以不设头图。
- 没有 frontmatter 的普通 Markdown 也能导入：用一级标题或文件名作标题，从第一段提取描述。标题最多 60 字，描述最多 160 字。

## GitHub 项目卡片

普通 `.md` 也可以插入主题的项目卡片，复制这一行并修改仓库名和链接即可：

```html
<github-card data-repo="cworld1/astro-theme-pure"><a href="https://github.com/cworld1/astro-theme-pure">astro-theme-pure</a></github-card>
```

构建时读取项目简介、Stars、Forks 和许可证，缓存 24 小时，直接写入页面。接口暂时不可用时沿用缓存，首次构建也可使用已保存的公开项目资料。构建缓存位于 `.astro/github-cards/`，不会提交到仓库。Stars、Forks 上线后还会通过下面的每日任务更新。

## 每日公开数据更新

服务器每天北京时间 03:00 获取 GitHub 卡片的 Stars、Forks，以及 About 的 GitHub/Bilibili 粉丝数、Steam 游戏数和好友数。每个来源独立更新；超时、限流或无效响应时保留该项上次成功值，合法的 `0` 正常更新。部署后也会触发一次更新。

任务从已经发布的页面自动识别仓库和账号，新增卡片或修改 About 的账号后正常部署即可。GitHub 贡献图、评论和访问统计继续使用各自的更新方式。

页面先显示构建时的数字，仅在有相关数字的页面请求一次 `/data/public-stats.json`。数据比页面旧或请求失败时继续保留页面已有数字，不影响页面加载。浏览器无需访问第三方统计 API。

数据文件保存在服务器 `/var/lib/residream-public-stats/public-stats.json`，逐项记录成功更新时间，写完后整体替换。它位于网站发布目录之外，部署、回滚不会覆盖，也不提交 Git。任务无需额外依赖，运行结束即退出，内存上限 64 MiB。

服务文件位于 `scripts/public-stats/`，首次安装到服务器时：

1. 创建系统用户 `residream-stats`，把 `update.py` 放入 `/opt/residream-public-stats/`，两个 systemd 文件放入 `/etc/systemd/system/`。
2. 把 `nginx.conf` 放入 `/etc/nginx/snippets/residream-public-stats.conf`，在主站 `server` 中引用并验证配置后重新加载。
3. 在 Cloudflare 添加仅匹配 `/data/public-stats.json` 的缓存规则，排在现有规则之后，边缘与浏览器缓存均遵循源站的 10 分钟缓存头。
4. 重新加载 systemd 配置并启用 `residream-public-stats.timer`。首次发布带数据标记的页面后启动 `residream-public-stats.service`。

现有服务器已按此方式配置。后续 `bun run deploy` 会同步采集脚本并触发更新；修改服务、定时器或 Nginx 配置时需单独同步对应文件。若调整 `WEB_ROOT`，同时调整服务文件的 `--web-root`。

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

回滚会直接检查服务器上恢复的页面，不需要本地构建产物。恢复成功后即使自检失败，也会继续清理缓存并报告错误。

导入不会改动 Blog 中的源 Markdown；如果直接传入仓库内的文章，则原地更新。重复导入相同内容会跳过提交，也不会删除原有附件或图片。仓库有其他未提交改动时默认停止；确实希望一起构建时可加 `--allow-dirty`。部署会创建文章的本地 Git 提交，不会自动推送远端。

服务器与 Cloudflare 配置继续使用 `.deploy.env`，参考项目根目录的 `.deploy.env.example`。本地导入预览无需配置 `DEPLOY_HOST`。

维护脚本后可运行 `bun run test:deploy`，检查图片查找、取色、占位符、重复导入和本地部署流程。

主题源码通过 Bun workspace 直接引用 `packages/pure/`。首次安装或拉取依赖配置变更后运行一次 `bun install`，之后修改主题即可直接构建，无需同步依赖目录中的副本。

## 备份

服务器每天凌晨备份评论库和访问统计数据，保留 14 天；每周日归档服务器与服务配置，保留 5 周。密码、私钥等另行归档，只保存在服务器上。

```sh
# 把服务器上的备份同步到本机（位置见 .deploy.env 中的 BACKUP_DIR），并校验最新一份
bun run backup
```

本机副本不会被自动删除，需要时手动清理。
