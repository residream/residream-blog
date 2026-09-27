import { BuiltInIcons } from '../pure/libs/icons'

type Link = { title: string; link: string; pos?: number; style?: string }
export type SiteConfig = {
  title: string
  author: string
  header: { menu?: Link[] }
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
const classes = (value: string, app: boolean) =>
  escape(
    value
      .split(/\s+/)
      .map((name) => (app ? `rd-u-${name}` : name))
      .join(' ')
  )
const icon = (name: string, className = '', size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"${className ? ` class="${className}"` : ''}>${BuiltInIcons[name as keyof typeof BuiltInIcons] || ''}</svg>`

// The blog's original utility classes and DOM structure are the source of truth.
// Apps use the same template, with namespaced utilities compiled by UnoCSS.
export function renderHeader(
  config: SiteConfig,
  origin = '',
  { navigation = true, pageTitle }: { navigation?: boolean; pageTitle?: string } = {}
) {
  const app = !navigation
  const c = (value: string) => classes(value, app)
  const brand = `<a class="rd-brand ${c('z-30 text-xl font-medium group-[.not-top]:ms-2 sm:group-[.not-top]:ms-3')}" style="transition:margin-inline 0.3s" href="${url('/', origin)}" aria-label="Brand">${escape(config.title)}</a>`
  return `<rd-header class="rd-header ${c('group sticky top-4 z-50 max-md:z-30 mb-12 flex items-center justify-between rounded-xl border border-transparent max-sm:py-1 sm:rounded-2xl')}${app ? ' rd-app-header' : ''}" role="banner">
    ${pageTitle ? `<div class="rd-breadcrumb">${brand}<h1 class="rd-current-page ${c('text-xl font-medium')}"><span class="rd-separator" aria-hidden="true">/</span><a href="/">${escape(pageTitle)}</a></h1></div>` : brand}
    <div class="${c('flex items-center gap-x-2')}">
      ${
        navigation
          ? `<div id="headerExpandContent" class="${c('end-0 start-0 top-12 grid border border-transparent group-[.not-top]:rounded-xl group-[.expanded]:opacity-100 dark:group-[.expanded.not-top]:bg-muted max-sm:absolute max-sm:opacity-0 max-sm:group-[.not-top]:border-border max-sm:group-[.expanded.not-top]:bg-background max-sm:group-[.not-top]:px-4 max-sm:group-[.not-top]:py-2 sm:grid-rows-1')}">
        <div class="${c('flex flex-col items-center justify-center overflow-hidden sm:flex-row')}">
        ${(config.header.menu || []).map((item) => `<a href="${url(item.link, origin)}" class="${c('w-full flex-none grow py-2 text-right font-medium transition-none hover:text-primary sm:w-fit sm:px-3')}" aria-label="Nav menu item" data-astro-prefetch>${escape(item.title)}</a>`).join(' ')}
          <div class="${c('flex w-full grow flex-row justify-end gap-x-3 sm:w-fit sm:gap-x-5')}"><a class="${c('px-1 py-2 transition-none sm:px-2')}" href="${url('/search', origin)}" title="Search"><span class="${c('sr-only')}">Search</span>${icon('search', c('size-5'))}</a></div>
        </div>
      </div>`
          : ''
      }
      <div class="${c('z-30 flex gap-x-4 group-[.not-top]:gap-x-2')}" style="transition:gap 0.3s">
        <button id="toggleDarkMode" type="button" data-rd-theme-toggle class="${c('group/dark box-content size-5 rounded-md border p-1.5 transition-colors hover:bg-border sm:group-[.not-top]:rounded-xl')}">
          <span class="${c('sr-only')}">Dark Theme</span>
          ${icon('computer', `system ${c('size-5 group-hover/dark:text-primary')}`)}
          ${icon('sun', `light ${c('hidden size-5 group-hover/dark:text-primary')}`)}
          ${icon('moon', `dark ${c('hidden size-5 group-hover/dark:text-primary')}`)}
        </button>
        ${navigation ? `<button id="toggleMenu" type="button" data-rd-menu-toggle aria-expanded="false" aria-controls="headerExpandContent" class="${c('rounded-md border p-1.5 transition-colors hover:bg-border sm:hidden sm:group-[.not-top]:rounded-xl')}"><span class="${c('sr-only')}">Menu</span>${icon('menu', c('size-5'))}</button>` : ''}
      </div>
    </div>
    <template data-rd-toast-icon data-rd-toast-class="${c('animate fixed bottom-8 z-20 px-4 py-2 bg-muted text-foreground rounded-lg border shadow-lg flex items-center gap-2')}">${icon('info', '', 22)}</template>
  </rd-header>`
}

export function renderFooter(
  config: SiteConfig,
  origin = '',
  poweredBy?: { name: string; href: string }
) {
  const c = (value: string) => classes(value, !!poweredBy)
  const links = config.footer.links || []
  const link = (item: Link) =>
    `<a href="${url(item.link, origin)}" target="_blank" rel="noopener noreferrer"${item.style ? ` class="${c(item.style)}"` : ''}>${escape(item.title)} </a>`
  return `<footer class="rd-footer ${c('mx-auto mb-5 mt-16 w-full')}"><div class="${c('border-t pt-5')}"><div class="${c('flex items-center gap-y-3 max-sm:flex-col sm:justify-between sm:gap-y-0')}">
    <div class="${c('flex items-center gap-x-4 gap-y-2 text-muted-foreground max-sm:flex-col')}">
      ${
        links.some((item) => (item.pos ?? 1) === 1)
          ? `<div>${links
              .filter((item) => (item.pos ?? 1) === 1)
              .map(link)
              .join(`<span class="${c('mx-1')}">•</span> `)}</div>`
          : ''
      }
      <div>${escape(config.footer.year || `© ${new Date().getFullYear()}`)} ${escape(config.author)}${
        links.length
          ? ' &amp; <span>' +
            links
              .filter((item) => item.pos === 2)
              .map((item) => `<span>${link(item)}</span>`)
              .join(' ') +
            '</span>'
          : ''
      }</div>
      ${config.footer.credits && !poweredBy ? '<span><a href="https://github.com/withastro/astro" target="_blank">Astro</a> &amp; <a href="https://github.com/cworld1/astro-theme-pure" target="_blank">Pure</a> theme powered</span>' : ''}
    </div>
    <div class="${c('flex items-center gap-x-4')}">${(config.footer.social || []).map((item) => `<a href="${url(item.href, origin)}" rel="me" class="${c('sl-flex')}"><span class="${c('sr-only')}">${escape(item.label)}</span>${icon(item.icon)}</a>`).join(' ')}</div>
  </div></div>${poweredBy ? `<div class="rd-credit">Powered by <a href="${url(poweredBy.href, origin)}" target="_blank" rel="noopener noreferrer">${escape(poweredBy.name)}</a></div>` : ''}</footer>`
}
