import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { createGenerator } from 'unocss'

import unoConfig from '../../uno.config'
import { renderFooter, renderHeader, type SiteConfig } from './render'

const required = (source: string, pattern: RegExp, label: string) => {
  const match = source.match(pattern)
  if (!match?.[1]) throw new Error(`Cannot extract ${label} from the blog; update the UI exporter.`)
  return match[1]
}

const namespace = (css: string) => {
  const sheet = postcss.parse(css)
  sheet.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
    rule.selector = selectorParser((selectors) => {
      selectors.walkClasses((node) => {
        if (!node.value.startsWith('rd-') && !['dark', 'not-top', 'expanded'].includes(node.value))
          node.value = `rd-u-${node.value}`
      })
    }).processSync(rule.selector)
  })
  return sheet.toString()
}

export async function buildSiteUI(root: string, config: SiteConfig) {
  const read = (path: string) => readFile(join(root, path), 'utf8')
  const [layout, home, section, theme, componentCSS, appCSS, globalCSS, builtHome] =
    await Promise.all([
      read('src/layouts/BaseLayout.astro'),
      read('src/pages/index.astro'),
      read('src/components/home/Section.astro'),
      read('src/assets/styles/app.css'),
      read('packages/site-ui/style.css'),
      read('packages/site-ui/apps.css'),
      read('src/assets/styles/global.css'),
      read('dist/index.html')
    ])

  // Derive the app aliases from the actual blog templates, including breakpoints.
  const sectionDivs = [...section.matchAll(/<div class='([^']+)'/g)]
  if (sectionDivs.length !== 2) throw new Error('The blog section structure changed.')
  const shortcuts = {
    'rd-body': required(layout, /<body class='([^']+)'/, 'body'),
    'rd-shell': required(layout, /id='main-container'\s+class='([^']+)'/, 'container'),
    'rd-main': required(layout, /<Header\s*\/>\s*<div class='([^']+)'/, 'main'),
    'rd-sections': required(home, /<div id='content' class='([^']+)'/, 'sections').replace(
      /\banimate\s*/g,
      ''
    ),
    'rd-section': required(section, /<section class=\{cn\('([^']+)'/, 'section'),
    'rd-section-heading': sectionDivs[0]![1]!,
    'rd-section-content': sectionDivs[1]![1]!
  }
  const markup =
    renderHeader(config) +
    renderFooter(config) +
    renderHeader(config, '', { navigation: false, pageTitle: 'App' }).replaceAll('rd-u-', '')
  const tokens = new Set([
    ...Object.keys(shortcuts),
    ...[...markup.matchAll(/(?:class|data-rd-toast-class)="([^"]+)"/g)].flatMap((match) =>
      match[1]!.split(/\s+/)
    )
  ])
  const uno = await createGenerator({ ...unoConfig, shortcuts, safelist: [] })
  const { css: utilities } = await uno.generate(tokens)

  // Use Astro's real font output: all normal/italic faces and adjusted fallbacks.
  const fontStyle = [...builtHome.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1]!)
    .find((css) => css.includes('@font-face') && css.includes('--font-satoshi'))
  if (!fontStyle) throw new Error('Build the blog before exporting its font resources.')
  const fonts = new Map<string, string>()
  const fontCSS = fontStyle.replace(
    /url\(["']?(\/_astro\/fonts\/[^"')]+)["']?\)/g,
    (_, path: string) => {
      if (path.includes('..')) throw new Error('Unexpected font asset path.')
      const name = basename(path)
      fonts.set(name, join(root, 'dist', path.slice(1)))
      return `url('./fonts/${name}')`
    }
  )
  if (!fonts.size) throw new Error('No local font resources found in the blog build.')

  // Reset only shared chrome; application widgets retain their own framework reset.
  const resetPath = import.meta.resolve('@unocss/reset/tailwind.css')
  const reset = postcss.parse(await readFile(new URL(resetPath), 'utf8'))
  reset.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
    const selectors = selectorParser()
      .astSync(rule.selector)
      .nodes.map((node) => node.toString())
    rule.selector = selectors
      .flatMap((selector) => [
        `:where(.rd-header, .rd-footer) ${selector}`,
        `:where(.rd-header, .rd-footer):is(${selector})`
      ])
      .join(',')
  })
  const scopedTheme = postcss.parse(theme)
  scopedTheme.walkRules((rule) => {
    if (rule.selector === 'a') rule.selector = ':where(.rd-header, .rd-footer) a'
    if (rule.selector.startsWith('footer'))
      rule.selector = rule.selector.replace('footer', '.rd-footer')
  })
  const animation = globalCSS.split('/* [Katex] */')[0]!
  const scrollbar = required(globalCSS, /\/\* Scroll bar \*\/([\s\S]+)/, 'scrollbar styles')
  const css = [
    fontCSS,
    reset.toString(),
    namespace(utilities),
    componentCSS
      .replaceAll('#main-container', '.rd-shell')
      .replace(/\bfooter a\b/g, '.rd-footer a'),
    scopedTheme.toString(),
    namespace(animation),
    scrollbar,
    appCSS
  ].join('\n')
  return { css, fonts }
}
