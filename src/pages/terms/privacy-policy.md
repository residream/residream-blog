---
layout: '@/layouts/IndividualPage.astro'

title: 'Privacy Policy'
description: '最后更新：2026-09-22'
language: 'Zh'
back: '/terms'
---

本站是静态站点，页面本身不含服务端程序，不主动收集访客信息。以下情形除外。

## 服务器日志

站点托管于阿里云 ECS，并经 Cloudflare 代理分发。Web 服务器按常规记录访问日志，包含 IP 地址、访问时间、请求路径与 User Agent，用于故障排查和安全审计。

由于流量经 Cloudflare 中转，Cloudflare 会处理你的 IP 地址与请求信息，其数据处理遵循 [Cloudflare 隐私政策](https://www.cloudflare.com/privacypolicy/)。

## 评论

本站使用 [Waline](https://waline.js.org) 承载评论。发表评论时会记录：

- 昵称、邮箱、网址（由你自行填写）
- IP 地址与 User Agent
- 评论内容及所在页面

邮箱用于在收到回复时通知你，并会经哈希处理后用于获取 Gravatar 头像。文章页显示的阅读量同样由 Waline 记录，只保存路径与计数，不关联到具体个人。

## 访问统计

本站使用自建的 [Counterscale](https://github.com/benvinegar/counterscale) 统计访问情况，部署在 Cloudflare Workers 上。记录的内容为：

- 站点域名与页面路径
- 来源页面（referrer）
- 国家/地区
- 浏览器名称与版本、设备类型与型号、User Agent
- URL 中的 `utm_*` 系列参数（若有）
- 是否为新访客、新会话，以及跳出情况

**不使用 Cookie，也不在你的浏览器中写入任何存储。** 不保存你的 IP 地址——独立访客数由 IP 与 User Agent 派生出的每日轮换哈希值统计，无法反向还原，也无法跨天关联。

数据存于 Cloudflare Analytics Engine，**90 天后自动删除**。

统计看板是公开的，任何人都可以查看：<https://stats.residream.com>

## 第三方资源

页面会从以下第三方加载资源，它们可能因此获知你的 IP 与 User Agent：

- 字体服务 Fontshare
- 统计接口 Substats，用于展示 GitHub、Steam 等平台的公开数字
- 语录接口 一言（hitokoto），用于首页底部的随机句子

这些服务的数据处理遵循各自的隐私政策。

## 联系方式

如需查询、更正或删除你在本站留下的数据，可通过 <me@residream.dev> 联系我。