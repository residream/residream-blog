import { matchingAssets, updateLanguageContent } from './language-dom.js'

const key = 'residream:language-navigation'
const root = document.documentElement
const headingSelector = 'h1, h2, h3, h4, h5, h6'
const normalizedPath = (path) => path.replace(/\/+$/, '') || '/'
const pagePath = (path) => normalizedPath(path.replace(/^\/en(?=\/|$)/, ''))
const clamp = (value) => Math.max(0, Math.min(1, value))
const cache = new Map()
let renderedPath = normalizedPath(location.pathname)
let request = null
let active = null
let arrival = null
let interrupted = false
let restoredAt = 0
let historyTimer = 0
let usingHistory = false

try {
  const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
  sessionStorage.removeItem(key)
  if (
    saved &&
    Array.isArray(saved.expanded) &&
    Number.isFinite(saved.section) &&
    Number.isFinite(saved.ratio) &&
    Number.isFinite(saved.progress) &&
    typeof saved.from === 'string' &&
    saved.to === renderedPath &&
    saved.from !== saved.to &&
    pagePath(saved.from) === pagePath(saved.to) &&
    Date.now() - saved.at < 15000 &&
    performance.getEntriesByType('navigation')[0]?.type === 'navigate'
  ) {
    arrival = saved
    root.setAttribute('data-language-arrival', '')
    root.setAttribute('data-language-restoring', '')
  }
} catch {
  // Normal links still work when storage is unavailable.
}

function measure() {
  const content = document.getElementById('content')
  const headings = content ? Array.from(content.querySelectorAll(headingSelector)) : []
  const top = (element) => element.getBoundingClientRect().top + window.scrollY
  return {
    content,
    headings,
    outline: headings.map((heading) => heading.tagName).join(','),
    // Include the introduction and footer as ranges outside the numbered headings.
    stops: [0, ...headings.map(top), document.documentElement.scrollHeight],
    line: parseFloat(getComputedStyle(root).fontSize) * 4
  }
}

function capture(to) {
  const { content, headings, outline, stops, line } = measure()
  const position = window.scrollY + line
  let section = 0
  while (section + 1 < stops.length - 1 && stops[section + 1] <= position) section++
  return {
    from: renderedPath,
    to,
    at: Date.now(),
    top: window.scrollY < 1,
    section,
    outline,
    ratio: clamp((position - stops[section]) / Math.max(1, stops[section + 1] - stops[section])),
    progress: clamp(window.scrollY / Math.max(1, root.scrollHeight - innerHeight)),
    hashHeading: headings.findIndex((heading) => `#${encodeURI(heading.id)}` === location.hash),
    expanded: content
      ? Array.from(content.querySelectorAll('.astro-code')).flatMap((block, index) =>
          block.querySelector('.collapse-toggle') && !block.classList.contains('collapsed')
            ? [index]
            : []
        )
      : []
  }
}

function restore() {
  if (
    !arrival ||
    interrupted ||
    (restoredAt && performance.now() - restoredAt > 1500) ||
    document.readyState === 'loading'
  )
    return false
  const content = document.getElementById('content')
  content?.querySelectorAll('.astro-code').forEach((block, index) => {
    if (!arrival.expanded.includes(index)) return
    block.classList.remove('collapsed')
    block.querySelector('.collapse-toggle')?.setAttribute('aria-expanded', 'true')
  })
  const { headings, outline, stops, line } = measure()
  const matched = outline === arrival.outline && arrival.section < stops.length - 1
  const start = stops[arrival.section]
  const end = stops[arrival.section + 1]
  const y = arrival.top
    ? 0
    : matched
      ? start + (end - start) * arrival.ratio - line
      : arrival.progress * (root.scrollHeight - innerHeight)
  // Do not animate a long scroll through a translated article before displaying it.
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
  window.dispatchEvent(new Event('rd:scroll-restored'))
  if (!restoredAt) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.removeAttribute('data-language-restoring'))
    })
  }
  restoredAt ||= performance.now()
  if (matched && arrival.hashHeading >= 0 && headings[arrival.hashHeading]) {
    const hash = `#${encodeURIComponent(headings[arrival.hashHeading].id)}`
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`)
  }
  return true
}

function paired(target) {
  return (
    target.origin === location.origin &&
    normalizedPath(target.pathname) !== renderedPath &&
    pagePath(target.pathname) === pagePath(renderedPath)
  )
}

function linkFrom(event) {
  return event.target instanceof Element
    ? event.target.closest('a[data-language-switch][href]')
    : null
}

async function load(target) {
  const path = normalizedPath(target.pathname)
  if (cache.has(path)) return cache.get(path)
  if (request?.path === path) return request.promise
  request?.controller.abort()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  const promise = (async () => {
    const response = await fetch(target.href, {
      signal: controller.signal,
      credentials: 'same-origin'
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
      throw new Error('Translation unavailable')
    const url = new URL(response.url)
    if (url.origin !== location.origin || normalizedPath(url.pathname) !== path)
      throw new Error('Translation redirected')
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
    if (
      !doc.getElementById('main-container') ||
      !matchingAssets(doc) ||
      doc.documentElement.lang === root.lang ||
      !['en', 'zh-CN'].includes(doc.documentElement.lang)
    )
      throw new Error('Translation requires a full navigation')
    // Prepare both halves while prefetching, outside the reader's click whenever possible.
    if (!cache.has(renderedPath)) cache.set(renderedPath, document.cloneNode(true))
    cache.set(path, doc)
    return doc
  })().finally(() => {
    clearTimeout(timer)
    if (request?.controller === controller) request = null
  })
  request = { path, controller, promise }
  return promise
}

function remember() {
  if (!usingHistory || normalizedPath(location.pathname) !== renderedPath) return
  history.replaceState(
    {
      ...history.state,
      rdLanguage: { path: renderedPath, position: capture(renderedPath) }
    },
    ''
  )
}

async function switchLanguage(target, { traversal = false, position = null } = {}) {
  if (!paired(target) || active) return
  const token = {}
  active = token
  const toggle = document.querySelector('[data-language-switch]')
  toggle?.setAttribute('aria-busy', 'true')
  const previousRestoration = history.scrollRestoration
  if (traversal) history.scrollRestoration = 'manual'
  try {
    const animateButton =
      toggle && !traversal && !matchMedia('(prefers-reduced-motion: reduce)').matches
    if (animateButton)
      toggle.dataset.locale = /^\/en(?:\/|$)/.test(target.pathname) ? 'en' : 'zh-CN'
    const [doc] = await Promise.all([
      load(target),
      animateButton ? new Promise((resolve) => setTimeout(resolve, 180)) : undefined
    ])
    if (active !== token) return
    // Capture at commit time so a slow connection does not undo intervening scrolling.
    const saved = position || capture(normalizedPath(target.pathname))
    document.dispatchEvent(new Event('rd:before-language-change'))
    if (!traversal) {
      usingHistory = true
      remember()
      history.pushState({}, '', target.href)
    }
    root.setAttribute('data-language-arrival', '')
    root.setAttribute('data-language-restoring', '')
    updateLanguageContent(doc)
    renderedPath = normalizedPath(target.pathname)
    arrival = saved
    interrupted = false
    restoredAt = 0
    restore()
    document.dispatchEvent(new Event('rd:language-change'))
    usingHistory = true
    remember()
    document.fonts.ready.then(restore)
  } catch {
    if (active !== token) return
    try {
      sessionStorage.setItem(key, JSON.stringify(capture(normalizedPath(target.pathname))))
    } catch {
      /* Storage is optional. */
    }
    if (traversal) location.replace(target.href)
    else location.assign(target.href)
  } finally {
    if (active === token) active = null
    toggle?.removeAttribute('aria-busy')
    if (toggle) toggle.dataset.locale = root.lang
    if (traversal)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          history.scrollRestoration = previousRestoration
        })
      })
  }
}

function prefetch() {
  const connection = navigator.connection
  if (document.hidden || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''))
    return
  const link = document.querySelector('a[data-language-switch][href]')
  if (link) {
    const target = new URL(link.href)
    if (paired(target)) void load(target).catch(() => {})
  }
}

for (const name of ['pointerover', 'focusin', 'pointerdown']) {
  document.addEventListener(
    name,
    (event) => {
      if (linkFrom(event)) prefetch()
    },
    { passive: true }
  )
}
const preloadOnIdle = () => {
  if ('requestIdleCallback' in window) window.requestIdleCallback(prefetch, { timeout: 3000 })
  else setTimeout(prefetch, 1000)
}
if (document.readyState === 'complete') preloadOnIdle()
else window.addEventListener('load', preloadOnIdle, { once: true })

document.addEventListener('click', (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  const link = linkFrom(event)
  if (!link) {
    if (event.target instanceof Element && event.target.closest('a[href]')) {
      active = null
      request?.controller.abort()
      const toggle = document.querySelector('[data-language-switch]')
      toggle?.removeAttribute('aria-busy')
      if (toggle) toggle.dataset.locale = root.lang
    }
    return
  }
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return
  const target = new URL(link.href)
  if (!paired(target)) return
  event.preventDefault()
  void switchLanguage(target)
})

window.addEventListener('popstate', (event) => {
  const target = new URL(location.href)
  if (!paired(target)) return
  active = null
  void switchLanguage(target, {
    traversal: true,
    position:
      event.state?.rdLanguage?.path === normalizedPath(target.pathname)
        ? event.state.rdLanguage.position
        : null
  })
})
window.addEventListener(
  'scroll',
  () => {
    if (!usingHistory) return
    clearTimeout(historyTimer)
    historyTimer = setTimeout(remember, 150)
  },
  { passive: true }
)
window.addEventListener('pagehide', () => {
  remember()
  arrival = null
  active = null
  request?.controller.abort()
})
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    arrival = null
    active = null
  }
})
for (const name of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
  window.addEventListener(
    name,
    () => {
      if (restoredAt) interrupted = true
    },
    { passive: true }
  )
}
if (document.readyState !== 'loading') {
  restore()
  document.fonts.ready.then(restore)
} else
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      restore()
      document.fonts.ready.then(restore)
    },
    { once: true }
  )
