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

导入不会改动 Blog 中的源 Markdown；如果直接传入仓库内的文章，则原地更新。重复导入相同内容会跳过提交，也不会删除原有附件或图片。仓库有其他未提交改动时默认停止；确实希望一起构建时可加 `--allow-dirty`。部署会创建文章的本地 Git 提交，不会自动推送远端。

服务器与 Cloudflare 配置继续使用 `.deploy.env`，参考项目根目录的 `.deploy.env.example`。本地导入预览无需配置 `DEPLOY_HOST`。

维护脚本后可运行 `bun run test:deploy`，检查图片查找、取色、占位符、重复导入和本地部署流程。
