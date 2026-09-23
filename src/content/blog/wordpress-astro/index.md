---
title: "博客翻新日志：从 WordPress 迁移到 Astro"
description: "从 WordPress 到 Astro 的博客翻新记录。"
publishDate: "2026-09-23T06:41:38.627Z"
tags:
  - "astro"
heroImage:
  src: ./rain-in-the-sky.jpg
  color: "#282838"
  alt: 博客翻新日志：从 WordPress 迁移到 Astro
language: '简中'
draft: false
---

原博客本来是 2026 年 2 月搭建的，一直跑在 Wordpress + Argon 主题上，但后来发现这种动态网页虽然管理起来比较方便，Wordpress 的生态也比较齐全，但网站的加载速度一直感觉一般，并且 Argon 主题也越用越觉得花哨

所以最近参考了 [orac1e](https://orac1e.me) 和 [CWorld](https://cworld0.com) 的博客，把整站换成了 [Astro](https://astro.build) + [astro-pure](https://github.com/cworld1/astro-theme-pure) 主题的静态站，这篇记录一下迁移日志

## 架构

| 部分     | 方案                                                       | 部署位置                              |
| -------- | ---------------------------------------------------------- | ------------------------------------- |
| 主站     | Astro 静态构建 + nginx                                     | 阿里云 ECS，经 Cloudflare 代理        |
| 评论     | 自建 [Waline](https://waline.js.org)（Node + SQLite）      | 同一台 ECS                            |
| 状态页   | [UptimeFlare](https://github.com/lyc8503/UptimeFlare)      | Cloudflare Workers                    |
| 访问统计 | [Counterscale](https://github.com/benvinegar/counterscale) | Cloudflare Workers + Analytics Engine |

## 旧链接跳转

WordPress 的文章地址是 `/index.php/2026/09/05/26-9-1/` 这种格式，迁移后肯定访问不到，所以给每篇文章都加了 301 跳转，旧的 `?p=` 短链接和 `/feed` 也一并跳到新地址

## 部署脚本

迁到静态站之后，写文章本身没什么变化，但发布前要做的事变多了：整理图片、复制头图、填主题色、改草稿状态，然后构建、上传、清缓存

于是借助 Astra 把这些操作收进了部署脚本，现在只需要把 Markdown 写好，再运行：

```bash
bun run deploy "$HOME/Desktop/Blog/博客翻新日志：从-WordPress-迁移到-Astro.md"
```

入口是 `scripts/deploy.sh`，负责确认、Git 提交、构建和上线；Markdown 解析与图片处理放在 `scripts/import-post.mjs` 里

### 自动找图

头图只需要在 frontmatter 里写文件名，例如 `./rain-in-the-sky.jpg`，不用先复制进项目。脚本先按 Markdown 中的路径查找，找不到再搜索文章所在目录的子目录、配置的图片库，以及项目中已有的图片

所以像我这样把文章和 catzz 图片库都放在 Blog 目录下，只写文件名就能定位到图片。图片库在其他地方时，也可以在不入库的 `.deploy.env` 里配置一次：

```bash
IMAGE_DIRS="$HOME/Desktop/Blog/catzz-web-1200-jpg/images"
```

正文图片通过 Markdown 语法树识别，支持相对路径、绝对路径、带空格的文件名和引用式图片，代码块里的 `![](...)` 不会被当成真的图片。复制时一起重写路径；HTML 的 `<img>` 则放进 `public/images/posts/`，保留原来的尺寸和样式，保证构建后仍然能访问

如果找不到图片，或者同一个查找范围里出现内容不同的同名图，脚本会在导入前停下来并提示路径，避免带着坏图上线

### 自动取色和补齐元数据

文章开头可以直接使用 `publishDate: "xxxxxx"` 和 `color: '#xxxxxx'` 占位，新文章导入时会补上当前时间，更新文章则保留已有的发布时间；`draft` 自动改成 `false` ，已经手动填好的有效日期和颜色会保留，也可以把颜色改成 `auto` 重新提取

取色复用了项目已有的 `sharp` ，先缩小头图、处理透明背景，再提取主色并转成十六进制：

```js
export async function extractThemeColor(file) {
  const sample = await sharp(file)
    .rotate()
    .resize(96, 96, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .png()
    .toBuffer()

  const { dominant } = await sharp(sample).stats()
  return (
    '#' +
    [dominant.r, dominant.g, dominant.b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}
```

这里先输出一次 buffer，是因为 `stats()` 不会自动应用前面尚未输出的图片处理操作。提取出来的颜色写回导入副本的 `heroImage.color`，供文章页和列表卡片使用，例如这篇的 `rain-in-the-sky.jpg` 得到的主色就是 `#282838`

文章目录名也会自动生成，同标题的文章会复用已有目录；有特别想用的地址时，再通过 frontmatter 的 `slug` 或 `--slug=名字` 指定

### 先预览，再发布

导入分成准备和应用两个阶段：先把 Markdown、图片和元数据放进临时目录，检查完成后展示结果；确认后再写入项目并提交。只想看看脚本找到了哪些图片、会用什么主题色，可以运行：

```bash
bun run deploy "文章.md" --dry-run
```

这个模式只做本地检查，不改源文件或仓库，也不连接服务器。正式导入使用的就是已经检查过的那份临时文件，核心调用是：

```bash
# 准备文章和图片，生成导入清单
IMAGE_DIRS="$IMAGE_DIRS" bun scripts/import-post.mjs prepare \
  "$POST" "$IMPORT_STAGE" "--slug=$SLUG"

# 用户确认后，再把这份结果写入博客
bun scripts/import-post.mjs apply "$IMPORT_STAGE"
```

后面的发布流程沿用原来的方案：本地提交文章，执行 `bun run build`，用 rsync 比较与线上相比的新增、修改和删除，再确认发布。上线前备份当前版本，上线后检查首页、文章页、404 和旧链接跳转，最后清除 Cloudflare 缓存

需要回到上一次部署前的版本时，运行 `bun run deploy --rollback`。平时仍然在 Blog 目录维护原稿，脚本处理导入副本；重复导入相同内容会跳过提交，更新文章也不会顺手删掉原有附件

## 致谢

- 主题：[astro-pure](https://github.com/cworld1/astro-theme-pure)，作者 CWorld
- 参考：[orac1e](https://orac1e.me) 和 [CWorld](https://cworld0.com) 的博客
- 头图：画师 [catzz](https://space.bilibili.com/308124) 的作品

