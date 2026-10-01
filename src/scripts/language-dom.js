// Keep live widgets and unchanged code in place while applying a paired static translation.
const owned = [
  '[data-language-preserve]',
  'script',
  'style',
  'template',
  'comment-component',
  'site-search',
  'quote-component',
  'scroll-button',
  '[data-rd-theme-toggle]',
  '[data-stat-key]',
  '.waline-pageview-count',
  '.waline-comment-count',
  '#qrcode-container'
].join(',')
const headings = /^H[1-6]$/
const liveAttributes = new Set(['inert', 'tabindex', 'aria-expanded', 'aria-hidden', 'aria-busy'])

function compatible(current, next) {
  if (current.nodeType !== next.nodeType) return false
  if (current.nodeType !== Node.ELEMENT_NODE) return true
  return (
    current.tagName === next.tagName && (headings.test(current.tagName) || current.id === next.id)
  )
}

function update(current, next) {
  if (current.nodeType === Node.TEXT_NODE) {
    if (current.data !== next.data) current.data = next.data
    return
  }
  if (!(current instanceof Element) || current.matches(owned)) return
  if (
    current.matches('pre.astro-code') &&
    current.querySelector('code')?.textContent === next.querySelector('code')?.textContent
  )
    return

  const keepClass = current.matches(
    'rd-header, #action-buttons, #sidebar, toc-heading a, .toc-progress, .medium-zoom-image'
  )
  const keepStyle = current.matches('rd-header, #blurImage, .medium-zoom-image, .toc-progress')
  for (const attribute of Array.from(current.attributes)) {
    if (
      liveAttributes.has(attribute.name) ||
      attribute.name === 'data-show' ||
      (attribute.name === 'class' && keepClass) ||
      (attribute.name === 'style' && keepStyle)
    )
      continue
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name)
  }
  for (const { name, value } of next.attributes) {
    if (
      liveAttributes.has(name) ||
      (name === 'class' && keepClass) ||
      (name === 'style' && keepStyle)
    )
      continue
    if (current.getAttribute(name) !== value) current.setAttribute(name, value)
  }

  const children = (element) =>
    Array.from(element.childNodes).filter(
      (node) =>
        node.nodeType !== Node.COMMENT_NODE &&
        !(node instanceof Element && node.matches('script, style'))
    )
  const remaining = children(current)
  let cursor = 0
  for (const child of children(next)) {
    const index = remaining.findIndex((node, i) => i >= cursor && compatible(node, child))
    if (index === -1) {
      current.insertBefore(child.cloneNode(true), remaining[cursor] || null)
      continue
    }
    const match = remaining[index]
    if (index !== cursor) {
      current.insertBefore(match, remaining[cursor])
      remaining.splice(index, 1)
      remaining.splice(cursor, 0, match)
    }
    update(match, child)
    cursor++
  }
  for (const node of remaining.slice(cursor)) node.remove()
}

const metadata =
  'title, meta[name="title"], meta[name="description"], meta[property], link[rel="canonical"], link[rel="alternate"]'

export function updateLanguageContent(next) {
  update(document.getElementById('main-container'), next.getElementById('main-container'))
  document.documentElement.lang = next.documentElement.lang
  const oldMeta = document.head.querySelectorAll(metadata)
  const newMeta = next.head.querySelectorAll(metadata)
  oldMeta.forEach((element) => element.remove())
  newMeta.forEach((element) => document.head.append(element.cloneNode(true)))
}

export function matchingAssets(next) {
  const assets = (doc) =>
    Array.from(doc.querySelectorAll('script[src], link[rel="stylesheet"]'))
      .map((element) => element.getAttribute('src') || element.getAttribute('href'))
      .filter((url) => url?.startsWith('/_astro/'))
      .sort()
      .join('\n')
  return assets(document) === assets(next)
}
