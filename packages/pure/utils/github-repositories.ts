import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import snapshots from '../libs/github-repositories.json'

export interface GithubRepository {
  description: string
  stars: number
  forks: number
  language: string | null
  license: string | null
  avatar: string
}

interface CacheEntry {
  fetchedAt: string
  data: GithubRepository
}

type RepositorySnapshot = GithubRepository & { updatedAt: string }

const cacheAge = 24 * 60 * 60 * 1000
const pending = new Map<string, Promise<RepositorySnapshot | undefined>>()
const fallback = snapshots as Record<string, CacheEntry>

function validData(data: GithubRepository): boolean {
  return (
    !!data &&
    typeof data.description === 'string' &&
    Number.isFinite(data.stars) &&
    data.stars >= 0 &&
    Number.isFinite(data.forks) &&
    data.forks >= 0 &&
    (data.language === null || typeof data.language === 'string') &&
    (data.license === null || typeof data.license === 'string') &&
    /^https:\/\/avatars\.githubusercontent\.com\/[\w/?=&.-]+$/.test(data.avatar)
  )
}

async function load(repo: string): Promise<RepositorySnapshot | undefined> {
  const key = repo.toLowerCase()
  const file = resolve('.astro/github-cards', `${key.replace('/', '--')}.json`)
  let cached = fallback[key]
  try {
    const saved = JSON.parse(await readFile(file, 'utf8')) as CacheEntry
    if (validData(saved.data) && Number.isFinite(Date.parse(saved.fetchedAt))) cached = saved
  } catch {
    // A fresh checkout can use the checked-in public repository snapshots.
  }
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < cacheAge)
    return { ...cached.data, updatedAt: cached.fetchedAt }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'residream-blog' },
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    if (result.private !== false || result.full_name?.toLowerCase() !== key)
      throw new Error('Only public repositories can be displayed')

    const data: GithubRepository = {
      description: result.description || '查看 GitHub 项目',
      stars: result.stargazers_count,
      forks: result.forks_count,
      language: result.language || null,
      license: result.license?.spdx_id || null,
      avatar: result.owner?.avatar_url
    }
    if (!validData(data)) throw new Error('Invalid repository response')
    const entry: CacheEntry = { fetchedAt: new Date().toISOString(), data }
    try {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(entry))
    } catch {
      console.warn(`[GitHubCard] Could not save cache for ${repo}`)
    }
    return { ...data, updatedAt: entry.fetchedAt }
  } catch {
    console.warn(`[GitHubCard] ${repo}: using saved project information`)
    return cached ? { ...cached.data, updatedAt: cached.fetchedAt } : undefined
  }
}

export function getGithubRepository(repo: string): Promise<RepositorySnapshot | undefined> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return Promise.resolve(undefined)
  const key = repo.toLowerCase()
  if (!pending.has(key)) pending.set(key, load(repo))
  return pending.get(key)!
}
