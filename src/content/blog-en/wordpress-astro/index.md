---
title: "Blog Revamp Log: Migrating from WordPress to Astro"
description: "A log of revamping my blog by moving it from WordPress to Astro."
publishDate: "2026-09-23T06:41:38.627Z"
tags:
  - "astro"
heroImage:
  src: ../../blog/wordpress-astro/rain-in-the-sky.jpg
  color: "#282838"
  alt: "Blog Revamp Log: Migrating from WordPress to Astro"
language: 'en'
draft: false
---

I originally set up this blog in February 2026, and it ran on WordPress with the Argon theme the whole time. A dynamic site like that is convenient to manage, and the WordPress ecosystem is pretty complete, but I always felt the site loaded rather slowly, and the more I used the Argon theme, the more it felt too flashy.

So recently, taking cues from the blogs of [Orac1e](https://orac1e.me) and [CWorld](https://cworld0.com), I switched the whole site over to a static site built with [Astro](https://astro.build) and the [astro-pure](https://github.com/cworld1/astro-theme-pure) theme. This post is a log of the migration.

## Architecture

| Component    | Setup                                                        | Hosted on                                        |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------ |
| Main site    | Astro static build + nginx                                   | Alibaba Cloud ECS, proxied through Cloudflare    |
| Comments     | Self-hosted [Waline](https://waline.js.org) (Node + SQLite)  | The same ECS instance                            |
| Public data  | Daily scheduled job (Python)                                 | The same ECS instance                            |
| Status page  | [UptimeFlare](https://github.com/lyc8503/UptimeFlare)        | Cloudflare Workers                               |
| Analytics    | [Counterscale](https://github.com/benvinegar/counterscale)   | Cloudflare Workers + Analytics Engine            |

## Redirecting old links

WordPress post URLs looked like `/index.php/2026/09/05/26-9-1/`, which obviously wouldn't resolve after the migration, so I added a 301 redirect for every post. The old `?p=` short links and `/feed` now redirect to the new addresses as well.

Once I'd confirmed that all the redirects worked, I removed WordPress, MariaDB, and PHP from the server entirely. The final backup of the old site is kept locally.

## Extra features

The theme is already quite complete on its own, but I added a few things on top of it:

Writing `<github-card data-repo="owner/repo">` in Markdown inserts a GitHub repository card — that's how the cards in the acknowledgments were made. The repository info is fetched at build time, so the page itself never sends requests to GitHub.

The Stars / Forks on the cards and the follower, game, and friend counts on the About page are refreshed by the server once a day in the early morning, without rebuilding the whole site. If a request to any source fails, the old value is kept for the time being.

Pagefind doesn't always segment Chinese text the same way at index time as the browser does, so searching for a Chinese phrase could miss results. Now a Chinese search also matches against the original text in a second pass and adds back any posts that were missed.

## Deployment script

After moving to a static site, writing posts didn't change much, but there's a lot more to do before publishing: organizing images, copying the cover image, filling in the theme color, flipping the draft status, then building, uploading, and purging the cache.

So, with Astra's help, I rolled all of that into a deployment script. Now I just write the Markdown and run:

```bash
bun run deploy "$HOME/Desktop/Blog/博客翻新日志：从-WordPress-迁移到-Astro.md"
```

The script looks for images using the paths in the Markdown; if an image can't be found there, it searches the post's directory and the configured image library, and it fixes the references while copying the images. The cover image is downscaled with `sharp` and its dominant color is extracted and filled into `heroImage.color` automatically, so there's no more picking colors by hand.

Dates and colors can be left empty or filled with an `xxxxxx` placeholder. New posts get the current time, updated posts keep their original publish time, and `draft` is switched to `false` automatically. Valid dates and colors that were already filled in by hand are kept.

Before importing, the script lists the images, theme color, and post directory for confirmation. Once confirmed, it commits the post, builds the site, and then previews the differences against the live site. When going live, it makes a backup first, and afterwards it checks the pages and purges the Cloudflare cache.

If you only want to check the import result, add `--dry-run`; to sync to the local repository only, add `--import-only`. The original drafts in the Blog folder are never modified. More options are described in the [deployment notes](https://github.com/residream/residream-blog/blob/main/scripts/README.md).

Finally, right before going live, I had Astra run one more round of project checks and a dependency security scan, meow.

## Crashes when paging

After launch, I noticed that paging through the blog list in Chrome would sometimes make it crash outright. The culprit turned out to be Astro's experimental `clientPrerender`: it prerenders the pages that links point to in the background, so clicking through is nearly instant, but the few Chrome 154 crashes I ran into all happened inside Chrome's own prerendering module.

In the end, I turned `clientPrerender` off and kept only regular prefetching, which downloads a page as soon as its link scrolls into view. In a local side-by-side test, I couldn't see any noticeable difference in paging speed.


## Acknowledgments

Thanks to Orac1e, a senior student, for the blog source code, and to these open-source projects, which made it possible to get the main site, search, comments, status page, analytics, and online tools all up and running smoothly:

<github-card data-repo="Byforacle/astro-blog"><a href="https://github.com/Byforacle/astro-blog">Orac1e (senior student) · blog source code</a></github-card>

<github-card data-repo="cworld1/astro-theme-pure"><a href="https://github.com/cworld1/astro-theme-pure">astro-theme-pure · blog theme</a></github-card>

<github-card data-repo="Pagefind/pagefind"><a href="https://github.com/Pagefind/pagefind">Pagefind · site search</a></github-card>

<github-card data-repo="walinejs/waline"><a href="https://github.com/walinejs/waline">Waline · comment system</a></github-card>

<github-card data-repo="lyc8503/UptimeFlare"><a href="https://github.com/lyc8503/UptimeFlare">UptimeFlare · website status</a></github-card>

<github-card data-repo="benvinegar/counterscale"><a href="https://github.com/benvinegar/counterscale">Counterscale · visitor analytics</a></github-card>

<github-card data-repo="gchq/CyberChef"><a href="https://github.com/gchq/CyberChef">CyberChef · online tools</a></github-card>

- References: the blogs of [Orac1e](https://orac1e.me) and [CWorld](https://cworld0.com)
- Cover image: artwork by the illustrator [catzz](https://space.bilibili.com/308124)
