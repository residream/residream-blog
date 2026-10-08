type NumberState = {
  current?: number
  target?: number
  from: number
  started: number
  duration: number
}

const states = new WeakMap<HTMLElement, NumberState>()
const active = new Map<HTMLElement, NumberState>()
const compact = new Intl.NumberFormat('en-us', { notation: 'compact', maximumFractionDigits: 1 })
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
let frame = 0

const format = (element: HTMLElement, value: number) =>
  element.dataset.statFormat === 'compact' ? compact.format(value) : String(value)

function write(element: HTMLElement, value: number) {
  const text = format(element, value)
  if (element.textContent !== text) element.textContent = text
}

function finish(element: HTMLElement, state: NumberState) {
  if (state.target !== undefined) {
    state.current = state.target
    write(element, state.target)
  }
  active.delete(element)
}

function tick(now: number) {
  for (const [element, state] of active) {
    if (!element.isConnected) {
      active.delete(element)
      continue
    }
    const progress = Math.max(0, Math.min(1, (now - state.started) / state.duration))
    if (progress >= 1) {
      finish(element, state)
      continue
    }
    state.current = Math.round(
      state.from + (state.target! - state.from) * (1 - (1 - progress) ** 3)
    )
    write(element, state.current)
  }
  frame = active.size ? requestAnimationFrame(tick) : 0
}

export function setNumber(element: HTMLElement, value: number, animate = true) {
  if (!Number.isSafeInteger(value) || value < 0) return
  let state = states.get(element)
  if (!state) {
    const initial = element.dataset.numberValue ?? element.dataset.statValue
    const current = initial !== undefined && /^\d+$/.test(initial) ? Number(initial) : undefined
    state = { current, target: current, from: 0, started: 0, duration: 0 }
    states.set(element, state)
  }
  if (state.target === value) {
    if (!animate) finish(element, state)
    return
  }

  const current = state.current
  const text = format(element, value)
  const digits = Math.max(Number(element.dataset.numberDigits) || 4, text.length)
  element.dataset.numberDigits = String(digits)
  element.style.setProperty('--number-width', `${digits}ch`)
  element.dataset.numberValue = String(value)
  element.removeAttribute('data-number-pending')
  state.target = value

  if (
    !animate ||
    value === 0 ||
    document.hidden ||
    (document as Document & { prerendering?: boolean }).prerendering ||
    reducedMotion.matches ||
    !element.isConnected ||
    (current !== undefined && format(element, current) === text)
  ) {
    finish(element, state)
    return
  }
  const rect = element.getBoundingClientRect()
  if (rect.bottom <= 0 || rect.top >= innerHeight) {
    finish(element, state)
    return
  }

  state.from = current ?? 0
  state.started = performance.now()
  state.duration = current === undefined ? 400 : Math.abs(value - current) <= 10 ? 200 : 300
  write(element, state.from)
  active.set(element, state)
  if (!frame) frame = requestAnimationFrame(tick)
}

function finishAll() {
  cancelAnimationFrame(frame)
  frame = 0
  for (const [element, state] of active) finish(element, state)
}

document.addEventListener('rd:before-language-change', finishAll)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) finishAll()
})
window.addEventListener('pagehide', finishAll)
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) finishAll()
})
