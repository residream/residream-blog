import * as pagefind from '../../pagefind/pagefind.js'

export * from '../../pagefind/pagefind.js'

let documents

const escapeHtml = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]
  )

async function loadDocuments() {
  documents ??= pagefind
    .search(null)
    .then(async ({ results }) =>
      Promise.all(results.map(async (entry) => ({ entry, data: await entry.data() })))
    )
    .catch((error) => {
      documents = undefined
      throw error
    })
  return documents
}

function countFilters(records) {
  const counts = {}
  for (const { data } of records) {
    for (const [key, values] of Object.entries(data.filters)) {
      counts[key] ??= {}
      for (const value of values) counts[key][value] = (counts[key][value] ?? 0) + 1
    }
  }
  return counts
}

function literalResult({ entry, data }, terms) {
  const content = data.content
  const lower = content.toLocaleLowerCase()
  const start = Math.max(0, Math.min(...terms.map((term) => lower.indexOf(term))) - 45)
  const excerpt = content.slice(start, start + 220)
  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'giu'
  )
  const highlighted = excerpt
    .split(pattern)
    .map((part, i) => (i % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('')
  return {
    ...entry,
    data: async () => ({
      ...data,
      excerpt: highlighted,
      plain_excerpt: excerpt,
      sub_results: [
        {
          url: data.meta.url || data.url,
          title: data.meta.title,
          excerpt: highlighted,
          locations: []
        }
      ]
    })
  }
}

// Pagefind's index and the browser can disagree on Chinese word boundaries.
// Reuse its compressed fragments for literal matches, loaded only for Chinese queries.
export async function search(term, options = {}) {
  const original = await pagefind.search(term, options)
  if (!term || !/\p{Script=Han}/u.test(term)) return original
  try {
    const records = await loadDocuments()
    const query = term.trim().toLocaleLowerCase()
    const terms = /^".+"$/.test(query) ? [query.slice(1, -1)] : query.split(/\s+/)
    const matches = records.filter(({ data }) =>
      terms.every((word) => data.content.toLocaleLowerCase().includes(word))
    )
    const hasFilters = Object.keys(options.filters ?? {}).length > 0
    const unfiltered = hasFilters
      ? await pagefind.search(term, { ...options, filters: {} })
      : original
    const allIds = new Set([
      ...unfiltered.results.map((r) => r.id),
      ...matches.map((r) => r.entry.id)
    ])
    const allowed = hasFilters
      ? new Set((await pagefind.search(null, options)).results.map((r) => r.id))
      : allIds
    const results = new Map(original.results.map((entry) => [entry.id, entry]))
    for (const record of matches) {
      if (allowed.has(record.entry.id) && !results.has(record.entry.id)) {
        results.set(record.entry.id, literalResult(record, terms))
      }
    }
    const titleMatches = new Set(
      records
        .filter(({ data }) =>
          terms.every((word) => (data.meta.title ?? '').toLocaleLowerCase().includes(word))
        )
        .map(({ entry }) => entry.id)
    )
    return {
      ...original,
      results: [...results.values()].sort(
        (a, b) => Number(titleMatches.has(b.id)) - Number(titleMatches.has(a.id))
      ),
      unfilteredResultCount: allIds.size,
      filters: countFilters(records.filter(({ entry }) => results.has(entry.id))),
      totalFilters: countFilters(records.filter(({ entry }) => allIds.has(entry.id)))
    }
  } catch (error) {
    console.warn('Chinese search fallback unavailable:', error)
    return original
  }
}
