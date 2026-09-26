# Residream の blog

[residream.com](https://residream.com) 的源代码，记录网络安全、CTF、编程与学习笔记。

基于 [Astro](https://astro.build) 和 [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure) 构建，并按个人写作与维护习惯进行调整。

[访问博客](https://residream.com) · [部署说明](./scripts/README.md) · [博客翻新日志](https://residream.com/blog/wordpress-astro)

## 功能

- **静态博客**：支持 Markdown / MDX、明暗主题、全文搜索、RSS 和 Waline 评论。
- **文章导入**：从本地 Markdown 自动定位图片、提取头图主题色、补齐发布时间，保留已有文章的原始日期。
- **GitHub 项目卡片**：普通 Markdown 中也能插入项目卡片，构建时获取项目信息，失败时使用缓存。
- **每日公开数据更新**：每天更新项目 Stars / Forks，以及 About 页的粉丝、游戏和好友数量；各来源独立更新，失败保留旧值，无需重新构建整站。
- **部署与回滚**：发布前预览变更，上线前备份，完成后检查页面并清理缓存，支持恢复上次版本。

## 本地开发

准备 Node.js 22.12+ 和 Bun，然后运行：

```sh
git clone https://github.com/residream/residream-blog.git
cd residream-blog
bun install
bun dev
```

开发地址默认为 `http://localhost:4321`。

- [src/site.config.ts](./src/site.config.ts)：站点信息、导航和集成配置。
- [src/content/blog/](./src/content/blog/)：文章与随文图片。
- [packages/pure/](./packages/pure/)：通过 Bun workspace 引用的主题源码，修改后可直接构建。

检查项目使用 `bun run check`，构建使用 `bun run build`，预览构建结果使用 `bun run preview`。静态产物位于 `dist/`。

## 写作与发布

首次部署前，参考 [.deploy.env.example](./.deploy.env.example) 配置本地 `.deploy.env`。写好 Markdown 后，在项目目录运行：

```sh
bun run deploy "$HOME/Desktop/Blog/文章.md"
```

脚本会先显示图片来源、主题色和文章目录，确认后导入并创建本地 Git 提交，再构建网站、预览线上差异并确认发布。脚本不会自动推送 GitHub。

仅验证文章导入结果时：

```sh
bun run deploy "$HOME/Desktop/Blog/文章.md" --dry-run
```

Markdown 格式、图片查找规则、仅导入、备份回滚和每日数据更新的完整说明见 [scripts/README.md](./scripts/README.md)。

## 致谢

- [Orac1e 学长](https://orac1e.me) 的 [博客源码](https://github.com/Byforacle/astro-blog)：博客改造与页面设计的参考。
- [CWorld](https://cworld0.com) 与 [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure)：本项目使用的上游主题。
- [Astro](https://astro.build)、[Pagefind](https://pagefind.app) 与 [Waline](https://github.com/walinejs/waline)：静态构建、全文搜索和评论。
- [catzz](https://catzz.work)：站点使用的配图插画。

## 许可

代码沿用仓库的 [Apache-2.0 许可证](./LICENSE)，并保留上游版权声明。

原创文章采用 CC BY-NC-SA 4.0，第三方图片、代码片段和引用内容的版权归原作者所有，详见 [版权说明](https://residream.com/terms/copyright)。
