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
language: 'zh-CN'
draft: false
---

原博客本来是 2026 年 2 月搭建的，一直跑在 WordPress + Argon 主题上，但后来发现这种动态网页虽然管理起来比较方便，WordPress 的生态也比较齐全，但网站的加载速度一直感觉一般，并且 Argon 主题也越用越觉得花哨

所以最近参考了 [Orac1e](https://orac1e.me) 和 [CWorld](https://cworld0.com) 的博客，把整站换成了 [Astro](https://astro.build) + [astro-pure](https://github.com/cworld1/astro-theme-pure) 主题的静态站，这篇记录一下迁移日志

## 架构

| 部分     | 方案                                                       | 部署位置                              |
| -------- | ---------------------------------------------------------- | ------------------------------------- |
| 主站     | Astro 静态构建 + nginx                                     | 阿里云 ECS，经 Cloudflare 代理        |
| 评论     | 自建 [Waline](https://waline.js.org)（Node + SQLite）      | 同一台 ECS                            |
| 公开数据 | 每日定时任务（Python）                                     | 同一台 ECS                            |
| 状态页   | [UptimeFlare](https://github.com/lyc8503/UptimeFlare)      | Cloudflare Workers                    |
| 访问统计 | [Counterscale](https://github.com/benvinegar/counterscale) | Cloudflare Workers + Analytics Engine |

## 旧链接跳转

WordPress 的文章地址是 `/index.php/2026/09/05/26-9-1/` 这种格式，迁移后肯定访问不到，所以给每篇文章都加了 301 跳转，旧的 `?p=` 短链接和 `/feed` 也一并跳到新地址

跳转确认都没问题后，服务器上的 WordPress、MariaDB 和 PHP 就全部删掉了，最终的站点备份留在了本地

## 功能补充

主题本身已经很完整了，在此基础上又补了几处：

Markdown 里写一个 `<github-card data-repo="owner/repo">` 就能插入 GitHub 项目卡片，致谢里那几张就是这么来的，项目信息在构建时获取，页面上不会再去请求 GitHub

卡片上的 Stars / Forks 和 About 页的粉丝、游戏、好友数量，由服务器每天凌晨更新一次，不用重新构建整站，哪个来源请求失败就先保留旧值

Pagefind 建索引时和浏览器对中文的分词不一定一致，搜中文短语时会漏掉结果，现在搜中文会再按原文匹配一遍，把漏掉的文章补回来

## 部署脚本

迁到静态站之后，写文章本身没什么变化，但发布前要做的事变多了：整理图片、复制头图、填主题色、改草稿状态，然后构建、上传、清缓存

于是借助 Astra 把这些操作收进了部署脚本，现在只需要把 Markdown 写好，再运行：

```bash
bun run deploy "$HOME/Desktop/Blog/博客翻新日志：从-WordPress-迁移到-Astro.md"
```

脚本会按 Markdown 中的路径查找图片，找不到再搜索文章目录和配置的图片库，复制图片时一起修正引用，头图用 `sharp` 缩小后提取主色，自动填入 `heroImage.color`，不用再手动挑色

日期和颜色可以留空或写 `xxxxxx` 占位；新文章补上当前时间，更新文章保留原发布时间，`draft` 自动改成 `false`，已经手动填好的有效日期和颜色会保留

导入前会列出图片、主题色和文章目录供确认。确认后提交文章、构建网站，再预览线上差异；上线时先备份，完成后检查页面并清除 Cloudflare 缓存

只想检查导入结果就加 `--dry-run`，只同步到本地仓库就加 `--import-only`，Blog 里的原稿不会被改动，更多选项放在[部署说明](https://github.com/residream/residream-blog/blob/main/scripts/README.md)里

最后在上线前又让 Astra 做了一轮项目检查和依赖安全扫描喵

## 翻页闪退

上线之后发现，用 Chrome 在博客列表翻页有时会直接闪退，查下来是 Astro 实验性的 `clientPrerender` 在作怪：它会在后台提前渲染链接指向的页面，点进去几乎是瞬间切换，但 Chrome 154 的几次崩溃都落在它自己的预渲染模块里

最后把 `clientPrerender` 关掉，只保留普通预取，链接进入视野时先把页面下载下来，本地对照测试翻页速度没看出明显差别

## 加载提速

前段时间一直在补功能，这次和 Opus 一起回头看了看性能，发现文章页上有两个从 jsDelivr 加载的脚本（二维码和图片放大）会阻塞页面解析：在它们下载完之前，页头菜单、主题切换、目录和评论都只能干等。jsDelivr 在国内时快时慢，慢的时候页面看起来已经加载好了，点了却没反应

现在两者都随站点一起打包：图片放大还是 medium-zoom，二维码换成了更小的 uqr，而且滚到文末附近才生成；Waline 的表情包也放到了本站，博客不再从 jsDelivr 加载任何东西

评论区改成快滚到时才加载 Waline，阅读量和评论数仍然在打开页面时统计；目录每 100ms 一次的轮询也去掉了，滚动时只在数值真正变化时才更新页面

在本地用 4 倍 CPU 降速模拟中端手机，对比了一下文章页：

| 指标                           | 改动前  | 改动后 |
| ------------------------------ | ------- | ------ |
| 可交互时间                     | 1417 ms | 197 ms |
| 可交互时间（jsDelivr 慢 3 秒） | 3389 ms | 205 ms |
| 加载时下载的 JS（未压缩）      | 211 KB  | 29 KB  |
| 停留 3 秒内的后台唤醒          | 30 次   | 0 次   |

可交互时间指页头菜单、目录这些脚本开始工作的时刻，数字是三次测试的中位数，只看量级就好

站内跳转也提前做了准备：读到文末时，上一篇和下一篇会提前下载好；在 Chrome、Edge 这类浏览器里，鼠标悬停或手指按下链接时也会先把页面取回来。主题里按钮链接的预取因为写法问题一直没生效，这次也一并修好了。在模拟 300ms 网络延迟的本地测试里，点开下一篇、回首页和打开标签页，首次绘制都从 350ms 左右降到了 40–70ms

## 页面动效

要不要加动效其实纠结了挺久，最后定的原则是只用浏览器原生能力（CSS 动画、View Transitions 和滚动驱动动画），不引入动画库，也不把站点改成单页应用：

- 站内跳转时页头保持不动，旧页面先淡出，新内容再按主题原版的节奏小幅上移入场
- 切换主题时，新主题从按钮的位置圆形展开（参考了 [antfu.me](https://antfu.me)），顺便修好了切换瞬间部分元素变色慢一拍的问题
- 文章页顶部加了一条阅读进度条，用 CSS 滚动驱动动画实现，不需要脚本
- 头图后面的模糊光晕会随滚动连续变淡，滚回顶部再恢复
- 移动端的目录抽屉补上了关闭动画，可以按 Esc 关闭，选完章节会自动收起
- 系统开启"减少动态效果"后，这些过渡都会关闭或简化

不支持这些特性的浏览器会保持原来的样子

中间还踩了个坑：测试时发现滚动驱动动画完全没生效，查下来是 CSS 压缩时把 `animation-timeline` 并进了 `animation` 简写，浏览器不接受带时间轴的简写，整条声明直接被丢弃，最后把属性逐项写开才解决

访问统计、网站状态和在线工具三个子站共用主站的页头和主题，新的主题切换也一并同步了过去


## 致谢

感谢 Orac1e 学长的博客源码和这些开源项目，让主站、搜索、评论、状态页、访问统计和在线工具都能顺利搭起来：

<github-card data-repo="Byforacle/astro-blog"><a href="https://github.com/Byforacle/astro-blog">Orac1e 学长 · 博客源码</a></github-card>

<github-card data-repo="cworld1/astro-theme-pure"><a href="https://github.com/cworld1/astro-theme-pure">astro-theme-pure · 博客主题</a></github-card>

<github-card data-repo="Pagefind/pagefind"><a href="https://github.com/Pagefind/pagefind">Pagefind · 站内搜索</a></github-card>

<github-card data-repo="walinejs/waline"><a href="https://github.com/walinejs/waline">Waline · 评论系统</a></github-card>

<github-card data-repo="lyc8503/UptimeFlare"><a href="https://github.com/lyc8503/UptimeFlare">UptimeFlare · 网站状态</a></github-card>

<github-card data-repo="benvinegar/counterscale"><a href="https://github.com/benvinegar/counterscale">Counterscale · 访问统计</a></github-card>

<github-card data-repo="gchq/CyberChef"><a href="https://github.com/gchq/CyberChef">CyberChef · 在线工具</a></github-card>

- 参考：[Orac1e](https://orac1e.me) 和 [CWorld](https://cworld0.com) 的博客
- 头图：画师 [catzz](https://space.bilibili.com/308124) 的作品
