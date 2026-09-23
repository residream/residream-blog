import path from 'node:path'
import type { APIRoute, ImageMetadata } from 'astro'
import { getImage } from 'astro:assets'
import type { CollectionEntry } from 'astro:content'
import rss from '@astrojs/rss'
import type { Root } from 'hast'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import config from 'virtual:config'

import { getBlogCollection, sortMDByDate } from 'astro-pure/server'

const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/blog/**/*.{jpeg,jpg,png,gif,avif,webp,svg,tif,tiff}'
)

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!
  )

async function renderContent(post: CollectionEntry<'blog'>, site: URL) {
  const sourceDir = path.posix.dirname(
    '/' + (post.filePath || `src/content/blog/${post.id}/index.md`)
  )
  const articleUrl = new URL(`/blog/${post.id}`, site)
  function absoluteUrls() {
    return async (tree: Root) => {
      const tasks: Promise<void>[] = []
      visit(tree, 'element', (node) => {
        if (node.tagName === 'a' && typeof node.properties.href === 'string') {
          node.properties.href = new URL(node.properties.href, articleUrl).href
        }
        if (node.tagName !== 'img' || typeof node.properties.src !== 'string') return
        const src = node.properties.src
        if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(src)) {
          node.properties.src = new URL(src, site).href
          return
        }
        const file = path.posix.normalize(
          path.posix.join(sourceDir, decodeURIComponent(src.split(/[?#]/)[0]))
        )
        const load = images[file]
        if (!load) throw new Error(`RSS 图片无法定位：${post.id} → ${src}`)
        tasks.push(
          load().then(async ({ default: image }) => {
            node.properties.src = new URL((await getImage({ src: image })).src, site).href
          })
        )
      })
      await Promise.all(tasks)
    }
  }
  return String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(absoluteUrls)
      .use(rehypeStringify)
      .process(post.body ?? '')
  )
}

export const GET: APIRoute = async (context) => {
  const posts = sortMDByDate(await getBlogCollection()) as CollectionEntry<'blog'>[]
  const site = context.site ?? new URL(import.meta.env.SITE)
  return rss({
    trailingSlash: false,
    xmlns: { h: 'http://www.w3.org/TR/html4/', atom: 'http://www.w3.org/2005/Atom' },
    stylesheet: '/scripts/pretty-feed-v3.xsl',
    title: config.title,
    description: config.description,
    site,
    items: await Promise.all(
      posts.map(async (post) => {
        const hero = post.data.heroImage?.src
        const heroPath =
          typeof hero === 'string' ? hero : hero ? (await getImage({ src: hero })).src : undefined
        return {
          ...post.data,
          pubDate: post.data.publishDate,
          link: `/blog/${post.id}`,
          customData: [
            heroPath ? `<h:img src="${escapeXml(new URL(heroPath, site).href)}" />` : '',
            post.data.updatedDate
              ? `<atom:updated>${post.data.updatedDate.toISOString()}</atom:updated>`
              : ''
          ].join('\n'),
          content: await renderContent(post, site)
        }
      })
    )
  })
}
