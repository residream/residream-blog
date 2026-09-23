import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { parseFragment } from 'parse5'
import sharp from 'sharp'
import { Document, isMap, parseDocument } from 'yaml'

const BLOG = 'src/content/blog'
const IMAGE = /\.(?:png|jpe?g|webp|gif|avif|tiff?|svg)$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const remote = (url) => /^(?:https?:)?\/\//i.test(url) || /^data:/i.test(url)
const automatic = (value) => value == null || /^(?:#?x+|auto)?$/i.test(String(value).trim())
const digest = (data) => createHash('sha256').update(data).digest('hex').slice(0, 12)
const exists = async (file) =>
  fs.stat(file).then(
    (s) => s.isFile(),
    () => false
  )
const inside = (root, file) => file === root || file.startsWith(root + path.sep)
const expandHome = (file) => file.replace(/^~(?=\/|$)/, os.homedir())
const plainText = (node) => node.value ?? node.children?.map(plainText).join('') ?? ''

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

export function readMarkdown(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!/^---[ \t]*\n/.test(text)) return { doc: new Document({}), body: text }
  const match = text.match(/^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/)
  if (!match) throw new Error('frontmatter 缺少结尾的 ---')
  const doc = parseDocument(match[1])
  if (doc.errors.length) throw new Error(`frontmatter 格式错误：${doc.errors[0].message}`)
  if (!isMap(doc.contents)) throw new Error('frontmatter 必须是 YAML 键值表')
  return { doc, body: text.slice(match[0].length) }
}

// All references come from the Markdown tree: fenced/indented code and inline code
// must never be mistaken for images. Keep offsets so unrelated prose stays intact.
function imageReferences(tree) {
  const definitions = new Map()
  walk(tree, (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node)
    }
  })
  const refs = []
  let section = ''
  walk(tree, (node) => {
    if (node.type === 'heading') section = plainText(node)
    if (node.type === 'image' || node.type === 'imageReference') {
      const definition = node.type === 'image' ? node : definitions.get(node.identifier)
      if (!definition) return
      refs.push({ node, url: definition.url, title: definition.title, section })
    }
    if (node.type !== 'html') return
    const fragment = parseFragment(node.value, { sourceCodeLocationInfo: true })
    const visit = (element) => {
      if (element.tagName === 'img') {
        const attr = element.attrs.find((item) => item.name === 'src')
        const loc = element.sourceCodeLocation?.attrs?.src
        if (attr && loc) refs.push({ node, url: attr.value, html: loc, section })
      }
      for (const child of element.childNodes ?? []) visit(child)
    }
    visit(fragment)
  })
  return refs
}

function decodeLocal(url) {
  if (/^file:/i.test(url)) return fileURLToPath(url)
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) throw new Error(`不支持的本地图片地址：${url}`)
  // Try literal names before this decoding, so filenames containing % or # work.
  try {
    return decodeURIComponent(url.replace(/[?#].*$/, ''))
  } catch {
    return url
  }
}

async function imageIndex(root) {
  const result = []
  async function scan(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist'].includes(entry.name)) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) await scan(file)
      else if (entry.isFile() && IMAGE.test(entry.name)) result.push(file)
    }
  }
  await scan(root)
  return result.sort()
}

function resolver({ sourceDir, destination, repoRoot, imageDirs, typoraRoot }) {
  const indexes = new Map()
  async function search(roots, ref) {
    const candidates = []
    for (const root of new Set(roots)) {
      if (!indexes.has(root)) indexes.set(root, imageIndex(root))
      candidates.push(
        ...(await indexes.get(root)).filter((file) => path.basename(file) === path.basename(ref))
      )
    }
    const suffix = ref.replace(/^\.\//, '').replaceAll('\\', '/')
    const exact = candidates.filter((file) => file.endsWith('/' + suffix))
    const matches = exact.length ? exact : candidates
    const unique = new Map()
    for (const file of matches) unique.set(await fs.realpath(file), file)
    if (unique.size > 1) {
      const hashes = new Set(
        await Promise.all([...unique.keys()].map(async (file) => digest(await fs.readFile(file))))
      )
      if (hashes.size > 1)
        throw new Error(
          `图片 ${ref} 有多个不同的同名文件，请在 Markdown 写明路径：\n  ${[...unique.keys()].join('\n  ')}`
        )
    }
    return unique.keys().next().value
  }
  return async (url) => {
    const ref = decodeLocal(url)
    const direct = [
      path.resolve(sourceDir, expandHome(url)),
      path.resolve(sourceDir, expandHome(ref))
    ]
    if (typoraRoot) direct.push(path.resolve(sourceDir, typoraRoot, ref.replace(/^\//, '')))
    if (ref.startsWith('/')) direct.push(path.join(repoRoot, 'public', ref))
    for (const file of direct) if (await exists(file)) return fs.realpath(file)
    for (const roots of [
      [sourceDir],
      imageDirs,
      [destination],
      [path.join(repoRoot, 'src/assets'), path.join(repoRoot, 'public'), path.join(repoRoot, BLOG)]
    ]) {
      const found = await search(roots, ref)
      if (found) return found
    }
    throw new Error(
      `找不到图片：${url}\n  请检查 Markdown 中的路径，或在 .deploy.env 的 IMAGE_DIRS 配置图片库目录。`
    )
  }
}

export async function extractThemeColor(file) {
  // stats() needs an already-processed buffer; otherwise it ignores resize/flatten.
  const sample = await sharp(file)
    .rotate()
    .resize(96, 96, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .png()
    .toBuffer()
  const { dominant } = await sharp(sample).stats()
  return (
    '#' +
    [dominant.r, dominant.g, dominant.b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

function dateValue(value, fallback, field) {
  if (automatic(value)) return fallback
  const day = typeof value === 'string' ? value.slice(0, 10) : ''
  const parsedDay = Date.parse(`${day}T00:00:00Z`)
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    Number.isNaN(parsedDay) ||
    new Date(parsedDay).toISOString().slice(0, 10) !== day
  ) {
    throw new Error(`${field} 不是有效日期：${value}（可留空、写 auto 或 xxxxxx）`)
  }
  return value
}

async function existingPosts(repoRoot) {
  const root = path.join(repoRoot, BLOG)
  const entries = await fs.readdir(root, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const posts = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = path.join(root, entry.name, 'index.md')
    if (await exists(file))
      posts.push({
        ...readMarkdown(await fs.readFile(file, 'utf8')).doc.toJS(),
        slug: entry.name,
        file
      })
  }
  return posts
}

function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Prepare the entire import in memory before writing any project files.
export async function preparePost({
  source,
  repoRoot,
  slug: requestedSlug,
  imageDirs = [],
  now = new Date()
}) {
  source = await fs.realpath(source)
  repoRoot = path.resolve(repoRoot)
  if (!/\.(?:md|markdown)$/i.test(source)) throw new Error('请传入 .md 或 .markdown 文件')
  const { doc, body } = readMarkdown(await fs.readFile(source, 'utf8'))
  const data = doc.toJS()
  const tree = fromMarkdown(body)
  const title =
    data.title ??
    (tree.children.find((n) => n.type === 'heading' && n.depth === 1)
      ? plainText(tree.children.find((n) => n.type === 'heading' && n.depth === 1))
      : path.basename(source, path.extname(source)))
  const paragraph = tree.children.find((n) => n.type === 'paragraph')
  const description =
    data.description ??
    (paragraph ? plainText(paragraph).replace(/\s+/g, ' ').trim().slice(0, 160) : title)
  if (typeof title !== 'string' || !title.trim() || title.length > 60)
    throw new Error('title 必须是 1–60 字的标题')
  if (typeof description !== 'string' || description.length > 160)
    throw new Error('description 必须是最多 160 字的文本')
  const posts = await existingPosts(repoRoot)
  const matches = posts.filter((post) => post.title === title)
  const sourcePost = posts.find((post) => path.resolve(post.file) === source)
  if (matches.length > 1 && !requestedSlug && !data.slug && !sourcePost)
    throw new Error('已有多篇同名文章，请通过 --slug 指定要更新的文章')
  const filename = path.basename(source, path.extname(source))
  const slug =
    requestedSlug ||
    data.slug ||
    sourcePost?.slug ||
    matches[0]?.slug ||
    slugify(title) ||
    (filename !== 'index' && slugify(filename)) ||
    `post-${digest(title).slice(0, 8)}`
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error(`无效的文章目录名：${slug}`)
  const existing = posts.find((post) => post.slug === slug)
  if (existing && existing.title !== title && existing.file !== source)
    throw new Error(`目录 ${slug} 已属于另一篇文章「${existing.title}」，请设置不同的 slug`)
  const postDir = `${BLOG}/${slug}`
  const publicDir = `public/images/posts/${slug}`
  const destination = path.join(repoRoot, postDir)
  const findImage = resolver({
    sourceDir: path.dirname(source),
    destination,
    repoRoot,
    imageDirs: imageDirs.filter(Boolean).map((dir) => path.resolve(repoRoot, expandHome(dir))),
    typoraRoot: data['typora-root-url']
  })
  const refs = imageReferences(tree)
  const files = new Map()
  const images = new Map()
  const mappings = []
  const patch = []
  let altCount = 0
  async function loadImage(url) {
    if (images.has(url)) return images.get(url)
    const file = await findImage(url)
    const bytes = await fs.readFile(file)
    try {
      await sharp(bytes).metadata()
    } catch (error) {
      throw new Error(`无法读取图片 ${file}：${error.message}`)
    }
    if (!IMAGE.test(file)) throw new Error(`不支持的图片扩展名：${file}`)
    const result = { file, bytes }
    images.set(url, result)
    return result
  }
  function saveImage(url, image, html = false) {
    const decoded = decodeLocal(url)
    const safeRelative =
      !path.isAbsolute(decoded) &&
      !decoded.split(/[\\/]/).some((part) => part === '..') &&
      /^[\p{L}\p{N}_. /()-]+$/u.test(decoded) &&
      IMAGE.test(decoded)
    let rel = safeRelative
      ? decoded.replace(/^\.\//, '')
      : `images/${path.basename(image.file).replace(/[^\p{L}\p{N}_.-]/gu, '-')}`
    let target = html
      ? `${publicDir}/${digest(image.bytes)}${path.extname(image.file).toLowerCase()}`
      : `${postDir}/${rel}`
    if (files.has(target) && !files.get(target).equals(image.bytes)) {
      rel = `images/${digest(image.bytes)}${path.extname(image.file).toLowerCase()}`
      target = `${postDir}/${rel}`
    }
    files.set(target, image.bytes)
    const rewritten = html ? '/' + target.slice('public/'.length) : './' + rel
    mappings.push({ reference: url, source: image.file, target })
    return rewritten
  }
  for (const ref of refs) {
    if (remote(ref.url)) continue
    const image = await loadImage(ref.url)
    ref.image = image
    const rewritten = saveImage(ref.url, image, Boolean(ref.html))
    const start = ref.node.position.start.offset
    if (ref.html) {
      patch.push({
        start: start + ref.html.startOffset,
        end: start + ref.html.endOffset,
        text: `src="${rewritten}"`
      })
    } else {
      let alt = ref.node.alt ?? ''
      if (!alt.trim() || alt.trim().toLowerCase() === 'img')
        alt = `${ref.section || title} 配图${++altCount}`
      const escaped = alt.replace(/[\\[\]]/g, '\\$&')
      const url = rewritten.split('/').map(encodeURIComponent).join('/')
      const imageTitle = ref.title ? ` ${JSON.stringify(ref.title)}` : ''
      patch.push({
        start,
        end: ref.node.position.end.offset,
        text: `![${escaped}](<${url}>${imageTitle})`
      })
    }
  }
  let hero = typeof data.heroImage === 'string' ? { src: data.heroImage } : data.heroImage
  if (hero != null && hero !== false && (typeof hero !== 'object' || Array.isArray(hero)))
    throw new Error('heroImage 请写图片路径，或包含 src 的键值表')
  let heroFile
  if (hero !== false) {
    const first = refs.find((ref) => ref.image)
    const heroSrc = hero?.src || first?.url
    if (heroSrc) {
      if (typeof heroSrc !== 'string') throw new Error('heroImage.src 必须是图片路径')
      if (remote(heroSrc)) throw new Error('头图请使用本地图片路径或图片库中的文件名，以便自动取色')
      heroFile = await loadImage(heroSrc)
      const color = automatic(hero?.color) ? await extractThemeColor(heroFile.bytes) : hero.color
      if (typeof color !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color))
        throw new Error('heroImage.color 请写十六进制颜色，或留空/写 auto/#xxxxxx 自动取色')
      hero = { ...hero, src: saveImage(heroSrc, heroFile), color, alt: hero?.alt || title }
      doc.set('heroImage', hero)
    } else doc.delete('heroImage')
  } else doc.delete('heroImage')
  const publishDate = dateValue(
    data.publishDate,
    existing?.publishDate || now.toISOString(),
    'publishDate'
  )
  doc.set('title', title)
  doc.set('description', description)
  doc.set('publishDate', publishDate)
  doc.set('draft', false)
  // Astro uses frontmatter.slug as the public ID; a CLI override must update it too.
  if (doc.has('slug')) doc.set('slug', slug)
  if (data.updatedDate != null)
    doc.set('updatedDate', dateValue(data.updatedDate, now.toISOString(), 'updatedDate'))
  if (
    data.tags != null &&
    (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string'))
  )
    throw new Error('tags 必须是字符串列表')
  let output = body
  for (const edit of patch.sort((a, b) => b.start - a.start))
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end)
  files.set(
    `${postDir}/index.md`,
    Buffer.from(`---\n${doc.toString({ lineWidth: 0 })}---\n${output}`)
  )
  return {
    source,
    slug,
    title,
    postDir,
    publicDir,
    files,
    mappings,
    publishDate,
    heroFile: heroFile?.file,
    color: hero?.color,
    altCount,
    existing: Boolean(existing),
    localImages: new Set([...images.values()].map((image) => image.file)).size,
    remoteImages: refs.filter((ref) => remote(ref.url)).length
  }
}

async function safeTarget(root, relative) {
  const absolute = path.resolve(root, relative)
  if (!inside(root, absolute)) throw new Error(`图片路径超出目标目录：${relative}`)
  // Refuse symlink components rather than accidentally writing outside the repo.
  let cursor = root
  for (const part of path.relative(root, absolute).split(path.sep)) {
    cursor = path.join(cursor, part)
    const stat = await fs.lstat(cursor).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (stat?.isSymbolicLink()) throw new Error(`目标路径含符号链接：${cursor}`)
  }
  return absolute
}

export async function writePreparedPost(plan, root) {
  root = path.resolve(root)
  const targets = []
  for (const [relative, bytes] of plan.files)
    targets.push([await safeTarget(root, relative), bytes])
  for (const [file, bytes] of targets) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, bytes)
  }
}

async function main() {
  const [mode, input, stage, ...args] = process.argv.slice(2)
  const repoRoot = fileURLToPath(new URL('..', import.meta.url))
  if (mode === 'prepare' && input && stage) {
    const slugArg = args.find((arg) => arg.startsWith('--slug='))
    const plan = await preparePost({
      source: input,
      repoRoot,
      slug: slugArg?.slice(7),
      imageDirs: (process.env.IMAGE_DIRS || '').split(path.delimiter)
    })
    await writePreparedPost(plan, path.join(stage, 'files'))
    const { files, ...summary } = plan
    await fs.writeFile(
      path.join(stage, 'plan.json'),
      JSON.stringify({ ...summary, files: [...files.keys()] }, null, 2)
    )
    console.log(
      `  文章：${plan.title}\n  目录：${plan.postDir}（${plan.existing ? '更新' : '新增'}）\n  头图：${plan.heroFile || '无'}\n  主题色：${plan.color || '使用站点默认色'}\n  本地图片：${plan.localImages} 张，远程图片：${plan.remoteImages} 张（保留链接）\n  发布时间：${plan.publishDate}\n  draft：false`
    )
    for (const mapping of plan.mappings)
      console.log(`  图片：${mapping.reference} → ${mapping.source}`)
  } else if (mode === 'apply' && input) {
    const plan = JSON.parse(await fs.readFile(path.join(input, 'plan.json'), 'utf8'))
    const files = new Map()
    for (const file of plan.files) {
      if (
        !file.startsWith(`${BLOG}/${plan.slug}/`) &&
        !file.startsWith(`public/images/posts/${plan.slug}/`)
      )
        throw new Error('导入清单包含无效路径')
      files.set(file, await fs.readFile(await safeTarget(path.resolve(input, 'files'), file)))
    }
    await writePreparedPost({ files }, repoRoot)
  } else
    throw new Error(
      '用法：bun scripts/import-post.mjs prepare 文章.md 临时目录 [--slug=目录名]，或 apply 临时目录'
    )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`错误：${error.message}`)
    process.exitCode = 1
  })
}
