import { setNumber } from './number-transition'

type SavedCount = { value: number; at: number }
const cacheKey = 'residream:page-counts:v1'
const maxAge = 7 * 24 * 60 * 60 * 1000
const counts = new Map<string, SavedCount>()
const observers = new Map<HTMLElement, MutationObserver>()

try {
  const entries: unknown = JSON.parse(localStorage.getItem(cacheKey) || '[]')
  if (Array.isArray(entries)) {
    for (const entry of entries.slice(-100)) {
      if (!Array.isArray(entry) || entry.length !== 2) continue
      const [key, saved] = entry
      if (
        typeof key === 'string' &&
        /^(views|comments):\//.test(key) &&
        saved &&
        Number.isSafeInteger(saved.value) &&
        saved.value >= 0 &&
        Number.isFinite(saved.at) &&
        Date.now() - saved.at >= 0 &&
        Date.now() - saved.at < maxAge
      )
        counts.set(key, saved)
    }
  }
} catch {
  // The counters still load normally when browser storage is unavailable.
}

function save(key: string, value: number) {
  counts.delete(key)
  counts.set(key, { value, at: Date.now() })
  while (counts.size > 100) counts.delete(counts.keys().next().value!)
  try {
    localStorage.setItem(cacheKey, JSON.stringify([...counts]))
  } catch {
    // Keep the current page's value even when storage is full or disabled.
  }
}

function initialize() {
  for (const [element, observer] of observers) {
    if (element.isConnected) continue
    observer.disconnect()
    observers.delete(element)
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-page-count]')) {
    if (observers.has(element)) continue
    const source = element.querySelector<HTMLElement>('[data-count-source]')
    const display = element.querySelector<HTMLElement>('[data-count-value]')
    if (!source || !display || !source.dataset.path) continue
    const key = `${element.dataset.pageCount}:${source.dataset.path}`
    const saved = counts.get(key)
    if (saved && Date.now() - saved.at < maxAge) setNumber(display, saved.value, false)

    // Observe only Waline's result, never the animated text or the rest of the page.
    const receive = () => {
      const text = source.textContent?.trim() ?? ''
      if (!/^\d+$/.test(text)) return
      const value = Number(text)
      if (!Number.isSafeInteger(value)) return
      setNumber(display, value)
      save(key, value)
    }
    const observer = new MutationObserver(receive)
    observer.observe(source, { childList: true, characterData: true, subtree: true })
    observers.set(element, observer)
    receive()
  }
}

document.addEventListener('rd:language-change', initialize)
initialize()
