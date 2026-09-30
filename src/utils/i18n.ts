import en from '../i18n/en.json'

export type Locale = 'zh-CN' | 'en'

export function getLocale(url: URL | string): Locale {
  const pathname = typeof url === 'string' ? url : url.pathname
  return /^\/en(?:\/|$)/.test(pathname) ? 'en' : 'zh-CN'
}

export function withoutLocale(path: string): string {
  return path.replace(/^\/en(?=\/|$|[?#])/, '') || '/'
}

export function localePath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const base = withoutLocale(path)
  return locale === 'en' ? `/en${base === '/' ? '' : base}` : base
}

export function blogCollection(locale: Locale) {
  return locale === 'en' ? 'blogEn' : 'blog'
}

export function uiText(key: keyof typeof en, fallback: string, locale: Locale): string {
  return locale === 'en' ? en[key] : fallback
}
