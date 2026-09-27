import { BuiltInIcons } from '../pure/libs/icons'

type Link = { title: string; link: string; pos?: number }
export type SiteConfig = {
  title: string
  author: string
  header: { menu: Link[] }
  footer: {
    year?: string
    links?: Link[]
    social?: { label: string; href: string; icon: string }[]
    credits?: boolean
  }
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  )
const url = (path: string, origin: string) =>
  escape(path.startsWith('/') ? `${origin}${path}` : path)
const icon = (name: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${BuiltInIcons[name as keyof typeof BuiltInIcons] || ''}</svg>`

export function renderHeader(
  config: SiteConfig,
  origin = '',
  { navigation = true, pageTitle }: { navigation?: boolean; pageTitle?: string } = {}
) {
  const brand = `<a class="rd-brand" href="${url('/', origin)}" aria-label="Brand">${escape(config.title)}</a>`
  return `<rd-header class="rd-header${navigation ? '' : ' rd-app-header'}" role="banner">
    ${pageTitle ? `<div class="rd-breadcrumb">${brand}<h1 class="rd-current-page"><span class="rd-separator" aria-hidden="true">/</span><a href="/">${escape(pageTitle)}</a></h1></div>` : brand}
    <div class="rd-header-actions">
      ${
        navigation
          ? `<nav id="rd-navigation" class="rd-navigation" aria-label="Main navigation"><div>
        ${config.header.menu.map((item) => `<a href="${url(item.link, origin)}">${escape(item.title)}</a>`).join('')}
        <a class="rd-search" href="${url('/search', origin)}" aria-label="Search" title="Search">${icon('search')}</a>
      </div></nav>`
          : ''
      }
      <button class="rd-icon-button" type="button" data-rd-theme-toggle aria-label="Change theme" title="Change theme">
        <span data-rd-icon="system">${icon('computer')}</span><span data-rd-icon="light">${icon('sun')}</span><span data-rd-icon="dark">${icon('moon')}</span>
      </button>
      ${navigation ? `<button class="rd-icon-button rd-menu-toggle" type="button" data-rd-menu-toggle aria-label="Toggle navigation" aria-expanded="false" aria-controls="rd-navigation">${icon('menu')}</button>` : ''}
    </div>
    <template data-rd-toast-icon>${icon('info', 22)}</template>
  </rd-header>`
}

export function renderFooter(
  config: SiteConfig,
  origin = '',
  poweredBy?: { name: string; href: string }
) {
  const link = (item: Link, after = '') =>
    `<a href="${url(item.link, origin)}" target="_blank" rel="noopener noreferrer">${escape(item.title)}${after}</a>`
  const links = config.footer.links || []
  return `<footer class="rd-footer"><div class="rd-footer-row">
    <div class="rd-footer-copy">
      <div class="rd-footer-links">${links
        .filter((item) => (item.pos ?? 1) === 1)
        // Spaced like the original footer: each link ends with a space, each dot is followed by one
        .map((item) => link(item, ' '))
        .join('<span class="rd-dot">•</span> ')}</div>
      <div>${escape(config.footer.year || `© ${new Date().getFullYear()}`)} ${escape(config.author)}${
        links.some((item) => item.pos === 2)
          ? ' &amp; ' +
            links
              .filter((item) => item.pos === 2)
              .map((item) => link(item))
              .join(' ')
          : ''
      }</div>
    </div>
    <div class="rd-social">${(config.footer.social || []).map((item) => `<a href="${url(item.href, origin)}" rel="me" aria-label="${escape(item.label)}">${icon(item.icon, 24)}</a>`).join('')}</div>
  </div>${poweredBy ? `<div class="rd-credit">Powered by <a href="${url(poweredBy.href, origin)}" target="_blank" rel="noopener noreferrer">${escape(poweredBy.name)}</a></div>` : config.footer.credits ? '<div class="rd-credit">Powered by <a href="https://astro.build">Astro</a> &amp; <a href="https://github.com/cworld1/astro-theme-pure">Pure</a></div>' : ''}</footer>`
}
