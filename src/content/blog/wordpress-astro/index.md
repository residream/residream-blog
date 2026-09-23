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

迁到静态站后，把找图、取色、构建和上传都收进了脚本。平时只需要写好 Markdown，再运行：

```bash
bun run deploy "$HOME/Desktop/Blog/博客翻新日志：从-WordPress-迁移到-Astro.md"
```

脚本会按 Markdown 中的路径查找图片，找不到再搜索文章目录和配置的图片库，复制图片时一起修正引用。头图用 `sharp` 缩小后提取主色，自动填入 `heroImage.color`，不用再手动挑色

日期和颜色可以留空或写 `xxxxxx` 占位；新文章补上当前时间，更新文章保留原发布时间，`draft` 自动改成 `false`。已经手动填好的有效日期和颜色会保留

导入前会列出图片、主题色和文章目录供确认。确认后提交文章、构建网站，再预览线上差异；上线时先备份，完成后检查页面并清除 Cloudflare 缓存

只想检查导入结果就加 `--dry-run`，只同步到本地仓库就加 `--import-only`。Blog 里的原稿不会被改动，更多选项放在[部署说明](https://github.com/residream/residream-blog/blob/main/scripts/README.md)里


## 致谢

- 主题：[astro-pure](https://github.com/cworld1/astro-theme-pure)，作者 CWorld
- 参考：[orac1e](https://orac1e.me) 和 [CWorld](https://cworld0.com) 的博客
- 头图：画师 [catzz](https://space.bilibili.com/308124) 的作品

