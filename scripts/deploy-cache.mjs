import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const independent = new Set(['data/public-stats.json', 'data/github-contributions.svg'])

export function purgeUrls(host, batches) {
  if (!/^[a-z\d.-]+$/i.test(host)) throw new Error('无效的 SITE_HOST')
  const urls = new Set()
  const paths = batches.flatMap((batch) =>
    batch.paths.filter((name) => !(name.startsWith('_astro/') && batch.added?.includes(name)))
  )
  for (const name of new Set(paths)) {
    if (independent.has(name) || name === '.release') continue
    if (name.startsWith('/') || name.split('/').some((part) => part === '..' || !part))
      throw new Error(`无效的缓存文件路径：${name}`)
    const encoded = name.split('/').map(encodeURIComponent).join('/')
    urls.add(`https://${host}/${encoded}`)
    if (name === 'index.html') urls.add(`https://${host}/`)
    else if (name.endsWith('/index.html')) {
      const base = `https://${host}/${encoded.slice(0, -11)}`
      urls.add(base)
      urls.add(base + '/')
    }
  }
  return [...urls].sort()
}

export async function purge({
  host,
  batches,
  token,
  zone,
  all = false,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  const urls = purgeUrls(host, batches)
  if (!all && !urls.length) return 0
  if (!token || !zone) throw new Error('未配置 Cloudflare 令牌或 CF_ZONE_ID')
  if (!/^[a-z\d_-]+$/i.test(zone)) throw new Error('无效的 CF_ZONE_ID')
  const payloads = all
    ? [{ purge_everything: true }]
    : Array.from({ length: Math.ceil(urls.length / 100) }, (_, i) => ({
        files: urls.slice(i * 100, (i + 1) * 100)
      }))
  for (const [index, payload] of payloads.entries()) {
    if (index > 0) await sleep(200)
    for (let attempt = 0; ; attempt++) {
      let retry = true
      let delay = 1000 * 2 ** attempt
      try {
        const response = await fetchImpl(
          `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20000)
          }
        )
        retry = response.status === 429 || response.status >= 500
        const result = await response.json()
        if (response.ok && result.success === true) break
        const retryAfter = Number(response.headers.get('retry-after'))
        if (Number.isFinite(retryAfter) && retryAfter > 0)
          delay = Math.min(10000, retryAfter * 1000)
        const codes = (result.errors ?? []).map((error) => error.code).join(', ')
        throw new Error(
          `Cloudflare 清缓存失败（HTTP ${response.status}${codes ? `，错误码 ${codes}` : ''}）`
        )
      } catch (error) {
        if (!retry || attempt >= 2) {
          if (error.message?.startsWith('Cloudflare 清缓存失败（HTTP ')) throw error
          throw new Error('Cloudflare 请求失败、超时或响应无效')
        }
        await sleep(delay)
      }
    }
  }
  return urls.length
}

async function main() {
  const [file, mode, ackFile] = process.argv.slice(2)
  const pending = JSON.parse(await fs.readFile(file, 'utf8'))
  const all = mode === 'all'
  const count = await purge({
    ...pending,
    all,
    token: process.env.CF_API_TOKEN,
    zone: process.env.CF_ZONE_ID
  })
  await fs.writeFile(ackFile, pending.batches.map((batch) => batch.id).join('\n'))
  console.log(
    all
      ? '  已清除整个 Cloudflare Zone 的缓存'
      : count
        ? `  已按 URL 清理 ${count} 项缓存`
        : '  没有待清理的缓存'
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const all = process.argv[3] === 'all'
    console.error(
      `注意：${error.message}；${all ? '全量清理未完成' : '待清理清单已保留'}，可运行 bun run deploy --purge-only${all ? ' --purge-all' : ''} 重试`
    )
    process.exitCode = 1
  })
}
