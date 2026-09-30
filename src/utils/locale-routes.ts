import { getBlogCollection } from 'astro-pure/server'
import config from '@/site-config'

import { blogCollection, getLocale, localePath, withoutLocale } from './i18n'

export async function languageLinks(url: URL) {
  const locale = getLocale(url)
  const targetLocale = locale === 'en' ? 'zh-CN' : 'en'
  const path = withoutLocale(decodeURI(url.pathname)).replace(/\/$/, '') || '/'
  let targetPath: string | undefined = path

  if (path.startsWith('/blog') || path.startsWith('/tags/')) {
    const posts = await getBlogCollection(blogCollection(targetLocale))
    const article = path.match(/^\/blog\/([^/]+)$/)
    const page = path.match(/^\/blog(?:\/(\d+))?$/)
    const tag = path.match(/^\/tags\/([^/]+)(?:\/(\d+))?$/)
    if (page || tag) {
      const count = tag
        ? posts.filter((post) => post.data.tags.includes(tag[1])).length
        : posts.length
      const maxPage = Math.max(1, Math.ceil(count / (config.content.blogPageSize ?? 10)))
      const number = Math.min(Number((tag ? tag[2] : page?.[1]) || 1), maxPage)
      const base = tag ? `/tags/${tag[1]}` : '/blog'
      targetPath = count ? `${base}${number > 1 ? `/${number}` : ''}` : undefined
    } else if (article && !posts.some((post) => post.id === article[1])) {
      targetPath = undefined
    }
  }

  const href = targetPath ? localePath(targetPath, targetLocale) : undefined
  // Pagination may land on a different slice of posts; it is not a translated page pair.
  const alternates =
    targetPath === path && path !== '/404'
      ? [
          { lang: 'zh-CN', href: localePath(path, 'zh-CN') },
          { lang: 'en', href: localePath(path, 'en') }
        ]
      : []
  return { locale, targetLocale, href, alternates }
}
