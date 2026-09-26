type Stat = { value: number; updatedAt: string | null }

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

async function updatePublicStats() {
  const elements = document.querySelectorAll<HTMLElement>('[data-stat-key]')
  if (!elements.length) return

  try {
    const response = await fetch('/data/public-stats.json', {
      credentials: 'omit',
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return
    const snapshot = await response.json()
    if (snapshot?.version !== 1 || !snapshot.values || typeof snapshot.values !== 'object') return
    const compact = new Intl.NumberFormat('en-us', {
      notation: 'compact',
      maximumFractionDigits: 1
    })

    for (const element of elements) {
      const entry = snapshot.values[element.dataset.statKey!]
      if (!validStat(entry)) continue
      const receivedAt = entry.updatedAt ? Date.parse(entry.updatedAt) : 0
      const renderedAt = Date.parse(element.dataset.statUpdatedAt || '') || 0
      if (receivedAt < renderedAt) continue
      if (!receivedAt && element.dataset.statValue !== undefined) continue

      element.textContent =
        element.dataset.statFormat === 'compact' ? compact.format(entry.value) : String(entry.value)
      element.title = String(entry.value)
      element.dataset.statValue = String(entry.value)
      if (entry.updatedAt) element.dataset.statUpdatedAt = entry.updatedAt
    }
  } catch {
    // Keep the rendered values if the snapshot is unavailable.
  }
}

if ((document as Document & { prerendering?: boolean }).prerendering) {
  document.addEventListener('prerenderingchange', () => void updatePublicStats(), { once: true })
} else {
  void updatePublicStats()
}
