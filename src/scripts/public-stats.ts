type Stat = { value: number; updatedAt: string | null }
type Snapshot = { version: 1; values: Record<string, Stat> }

const requests = new Map<string, { at: number; result: Promise<Snapshot | null> }>()
const latest: Record<string, Stat> = {}
type Chart = { image: HTMLImageElement; version: string }
let chartRequest: Promise<void> | undefined
let readyChart: Chart | undefined
let chartCheckedAt = 0
const revisitInterval = 10 * 60 * 1000

function validStat(entry: unknown): entry is Stat {
  if (!entry || typeof entry !== 'object') return false
  const { value, updatedAt } = entry as Stat
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    (updatedAt === null ||
      (typeof updatedAt === 'string' && Number.isFinite(Date.parse(updatedAt))))
  )
}

async function readSnapshot(url: string, timeout: number) {
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      signal: AbortSignal.timeout(timeout)
    })
    if (!response.ok) return null
    const snapshot = await response.json()
    return snapshot?.version === 1 && snapshot.values && typeof snapshot.values === 'object'
      ? (snapshot as Snapshot)
      : null
  } catch {
    return null
  }
}

function snapshotRequest(url: string, timeout: number) {
  const saved = requests.get(url)
  if (saved && Date.now() - saved.at < revisitInterval) return saved.result
  const result = readSnapshot(url, timeout)
  requests.set(url, { at: Date.now(), result })
  return result
}

function applyValues(values: Record<string, Stat>) {
  const compact = new Intl.NumberFormat('en-us', { notation: 'compact', maximumFractionDigits: 1 })
  for (const element of document.querySelectorAll<HTMLElement>('[data-stat-key]')) {
    const key = element.dataset.statKey!
    const entry = values[key]
    if (!validStat(entry)) continue
    const receivedAt = entry.updatedAt ? Date.parse(entry.updatedAt) : 0
    const renderedAt = Date.parse(element.dataset.statUpdatedAt || '') || 0
    if (receivedAt < renderedAt || (!receivedAt && element.dataset.statValue !== undefined))
      continue

    const text =
      element.dataset.statFormat === 'compact' ? compact.format(entry.value) : String(entry.value)
    if (element.textContent !== text) element.textContent = text
    element.title = String(entry.value)
    element.dataset.statValue = String(entry.value)
    if (entry.updatedAt) element.dataset.statUpdatedAt = entry.updatedAt
    latest[key] = entry
  }
}

async function updateNumbers() {
  const keys = [
    ...new Set(
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-stat-key]'),
        (element) => element.dataset.statKey!
      )
    )
  ].sort()
  if (!keys.length) return
  applyValues(latest)

  const cachedUrl = '/data/public-stats.json'
  const cached = await snapshotRequest(cachedUrl, 5000)
  if (cached) applyValues(cached.values)

  const query = new URLSearchParams()
  for (const key of keys) query.append('key', key)
  const url = '/data/public-refresh.json?' + query
  const fresh = await snapshotRequest(url, 25000)
  if (fresh) applyValues(fresh.values)
}

async function loadChart(url: string, expectedVersion?: string) {
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(5000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('image/svg+xml')) return
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > 250000) return
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const version = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  if (expectedVersion && version !== expectedVersion) return
  const current = document.querySelector<HTMLImageElement>('[data-contribution-chart]')
  if (current?.dataset.chartVersion === version) {
    readyChart = { image: current.cloneNode() as HTMLImageElement, version }
    return version
  }

  const image = new Image()
  image.src =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new TextDecoder().decode(bytes))
  await image.decode()
  readyChart = { image, version }
  await displayChart()
  return version
}

async function displayChart() {
  const current = document.querySelector<HTMLImageElement>('[data-contribution-chart]')
  const next = readyChart
  if (!current || !next || current.dataset.chartVersion === next.version) return
  const replacement = current.cloneNode() as HTMLImageElement
  replacement.src = next.image.src
  replacement.dataset.chartVersion = next.version
  try {
    await replacement.decode()
    if (current.isConnected && readyChart === next) current.replaceWith(replacement)
  } catch {
    // Keep the current image on a failed decode as well as on network errors.
  }
}

async function refreshChart() {
  let version = readyChart?.version
  try {
    version ??= await loadChart('/data/github-contributions.svg')
  } catch {
    // The chart embedded in the HTML remains visible if the cache is unavailable.
  }
  try {
    const response = await fetch('/data/public-refresh.json?chart=1', {
      credentials: 'omit',
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok) return
    const data = await response.json()
    if (
      data?.version !== 1 ||
      typeof data.chart !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.chart) ||
      data.chart === version
    )
      return
    await loadChart('/data/github-contributions.svg?v=' + data.chart, data.chart)
  } catch {
    // The visible chart is never removed while an update is unavailable.
  }
}

async function updateChart() {
  if (!document.querySelector('[data-contribution-chart]')) return
  await displayChart()
  if (!chartRequest || Date.now() - chartCheckedAt >= revisitInterval) {
    chartCheckedAt = Date.now()
    chartRequest = refreshChart()
  }
  await chartRequest
}

function update() {
  if ((document as Document & { prerendering?: boolean }).prerendering || document.hidden) return
  void updateNumbers()
  void updateChart()
}

document.addEventListener('rd:language-change', update)
document.addEventListener('prerenderingchange', update, { once: true })
document.addEventListener('visibilitychange', update)
update()
