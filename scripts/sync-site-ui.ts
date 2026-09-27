import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderFooter, renderHeader, type SiteConfig } from '../packages/site-ui/render'
import { theme } from '../src/site.config'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'packages/site-ui')
const projects = resolve(root, '..')
const sites = [
  {
    folder: 'residream-blog-stats',
    assets: 'packages/server/public/site-ui',
    manifest: 'packages/server/site-ui.json',
    title: 'Visitor analytics',
    name: 'Counterscale',
    href: 'https://github.com/benvinegar/counterscale'
  },
  {
    folder: 'residream-blog-status',
    assets: 'public/site-ui',
    manifest: 'site-ui.json',
    title: 'Website status',
    name: 'UptimeFlare',
    href: 'https://github.com/lyc8503/UptimeFlare'
  },
  {
    folder: 'CyberChef',
    assets: 'deploy/cloudflare/site-ui/assets',
    manifest: 'deploy/cloudflare/site-ui/manifest.json',
    title: 'Online tools',
    name: 'CyberChef',
    href: 'https://github.com/gchq/CyberChef'
  }
]
const config = theme as SiteConfig
const files = ['style.css', 'bootstrap.js', 'client.js', 'render.ts']
const hash = createHash('sha256').update(
  JSON.stringify({
    title: config.title,
    author: config.author,
    header: config.header,
    footer: config.footer,
    sites
  })
)
for (const name of files) hash.update(await readFile(join(source, name)))
for (const name of (await readdir(join(source, 'fonts'))).sort())
  hash.update(await readFile(join(source, 'fonts', name)))
const version = hash.digest('hex').slice(0, 16)
const bootstrap = await readFile(join(source, 'bootstrap.js'), 'utf8')

// Each destination owns a complete snapshot; no site needs the blog at runtime.
for (const site of sites) {
  const target = join(projects, site.folder)
  await readFile(join(target, 'package.json'))
  const assetsRoot = join(target, site.assets)
  const output = join(assetsRoot, version)
  await mkdir(output, { recursive: true })
  for (const name of ['style.css', 'client.js']) await cp(join(source, name), join(output, name))
  await cp(join(source, 'fonts'), join(output, 'fonts'), { recursive: true })
  await cp(join(root, 'LICENSE'), join(output, 'LICENSE'))
  const base = `/site-ui/${version}`
  const manifest = {
    generatedBy: 'residream-blog/scripts/sync-site-ui.ts',
    version,
    stylesheet: `${base}/style.css`,
    client: `${base}/client.js`,
    bootstrap,
    header: renderHeader(config, 'https://residream.com', {
      navigation: false,
      pageTitle: site.title
    }),
    footer: renderFooter(config, 'https://residream.com', site)
  }
  const manifestPath = join(target, site.manifest)
  let previous: { generatedBy?: string; version?: string } = {}
  try {
    previous = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch {}
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  if (
    previous.generatedBy === manifest.generatedBy &&
    previous.version !== version &&
    /^[a-f0-9]{16}$/.test(previous.version || '')
  ) {
    await rm(join(assetsRoot, previous.version!), { recursive: true, force: true })
  }
  console.log(`${site.folder}: UI ${version}`)
}
