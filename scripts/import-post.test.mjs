import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

import { preparePost, readMarkdown, writePreparedPost } from './import-post.mjs'

const project = fileURLToPath(new URL('..', import.meta.url))
const now = new Date('2026-09-23T06:30:00Z')

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'residream-import-test-')))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const repoRoot = path.join(root, 'repo')
  const notes = path.join(root, 'notes')
  await fs.mkdir(repoRoot)
  await fs.mkdir(notes)
  const source = path.join(notes, 'article.md')
  return { root, repoRoot, notes, source, now }
}

async function put(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, text)
  return file
}

async function picture(file, background = '#248cb4') {
  return put(
    file,
    await sharp({ create: { width: 16, height: 16, channels: 3, background } })
      .png()
      .toBuffer()
  )
}

const output = (plan) => plan.files.get(`${plan.postDir}/index.md`).toString()
const metadata = (plan) => readMarkdown(output(plan)).doc.toJS()

test('the example format resolves a nested library and fills both placeholders without modifying the source', async (t) => {
  const f = await fixture(t)
  const library = path.join(f.notes, 'catzz-web-1200-jpg/images')
  const cover = await picture(path.join(library, 'rain-in-the-sky.jpg'))
  const original =
    '\uFEFF---\r\ntitle: "博客翻新日志：从 WordPress 迁移到 Astro"\r\ndescription: "翻新记录"\r\npublishDate: "xxxxxx"\r\nheroImage: { src: "./rain-in-the-sky.jpg", color: "#xxxxxx" }\r\ndraft: true\r\n---\r\n\r\n正文\r\n'
  await put(f.source, original)
  const plan = await preparePost(f)
  assert.equal(plan.slug, 'wordpress-astro')
  assert.equal(plan.heroFile, cover)
  assert.equal(metadata(plan).publishDate, now.toISOString())
  assert.equal(metadata(plan).draft, false)
  assert.match(metadata(plan).heroImage.color, /^#[0-9A-F]{6}$/)
  const rgb = metadata(plan)
    .heroImage.color.match(/[0-9A-F]{2}/g)
    .map((n) => parseInt(n, 16))
  assert.ok(
    Math.abs(rgb[0] - 36) < 10 && Math.abs(rgb[1] - 140) < 10 && Math.abs(rgb[2] - 180) < 10
  )
  assert.equal(await fs.readFile(f.source, 'utf8'), original)
  assert.deepEqual(await fs.readdir(f.repoRoot), [])
  await writePreparedPost(plan, f.repoRoot)
  assert.equal(
    await fs.readFile(path.join(f.repoRoot, plan.postDir, 'index.md'), 'utf8'),
    output(plan)
  )
  assert.deepEqual(
    await fs.readFile(path.join(f.repoRoot, plan.postDir, 'rain-in-the-sky.jpg')),
    await fs.readFile(cover)
  )
})

test('parses multiline YAML, reference images, spaces, parentheses, and skips code examples', async (t) => {
  const f = await fixture(t)
  await picture(path.join(f.notes, '文章.assets/截图 (1).png'))
  const code =
    '~~~md\n![](./missing-fence.png)\n~~~\n\n    ![](./missing-indented.png)\n\n`![](./missing-inline.png)`'
  await put(
    f.source,
    `---\ntitle: "Example: with colon"\ndescription: >-\n  多行描述\n  继续\npublishDate: 2026-03-01\nheroImage:\n  src: 文章.assets/截图%20(1).png\n  color: '#aabbcc'\n---\n## 步骤\n\n![img](<文章.assets/截图 (1).png> "说明")\n\n![引用][shot]\n\n[shot]: <文章.assets/截图 (1).png> "引用标题"\n\n${code}\n`
  )
  const plan = await preparePost(f)
  const data = metadata(plan)
  assert.equal(data.description, '多行描述 继续')
  assert.equal(data.publishDate, '2026-03-01')
  assert.equal(data.heroImage.color, '#aabbcc')
  assert.equal(plan.localImages, 1)
  assert.match(output(plan), /步骤 配图1/)
  assert.match(output(plan), /%20\(1\)\.png/)
  assert.match(output(plan), /引用标题/)
  assert.ok(output(plan).includes(code))
})

test('supports absolute paths, file URLs, parent paths and HTML images with public output', async (t) => {
  const f = await fixture(t)
  f.source = path.join(f.notes, '本地图片.md')
  const image = await picture(path.join(f.root, 'outside/picture with space.png'))
  await put(
    f.source,
    `# 本地图片\n\n简介\n\n![一](<${image}>)\n\n![二](${pathToFileURL(image)})\n\n![三](<../outside/picture with space.png>)\n\n<img src="${image}" style="zoom:50%" alt="图">\n`
  )
  const plan = await preparePost(f)
  assert.match(plan.slug, /^post-[0-9a-f]{8}$/)
  assert.equal(plan.localImages, 1)
  assert.ok(metadata(plan).heroImage)
  assert.match(
    output(plan),
    /<img src="\/images\/posts\/post-[a-f0-9]{8}\/[a-f0-9]+\.png" style="zoom:50%" alt="图">/
  )
  assert.ok([...plan.files.keys()].some((file) => file.startsWith('public/images/posts/')))
  assert.ok([...plan.files.keys()].every((file) => !file.includes('..')))
  await writePreparedPost(plan, f.repoRoot)
  assert.ok(await fs.stat(path.join(f.repoRoot, plan.postDir, 'index.md')))
})

test('uses IMAGE_DIRS recursively, rejects ambiguous different images, and tolerates identical copies', async (t) => {
  const f = await fixture(t)
  const library = path.join(f.root, 'library')
  const first = await picture(path.join(library, 'a/cover.png'))
  await put(f.source, '---\ntitle: Library\nheroImage: cover.png\n---\n正文\n')
  const options = { ...f, imageDirs: [library] }
  assert.equal((await preparePost(options)).heroFile, first)
  await picture(path.join(library, 'b/cover.png'), '#bc1818')
  await assert.rejects(preparePost(options), /多个不同的同名文件/)
  await put(path.join(library, 'b/cover.png'), await fs.readFile(first))
  assert.equal((await preparePost(options)).localImages, 1)
})

test('missing or invalid images fail before creating a destination', async (t) => {
  const f = await fixture(t)
  await put(f.source, '# Missing\n\n![x](assets/not-here.png)\n')
  await assert.rejects(preparePost(f), /找不到图片/)
  assert.deepEqual(await fs.readdir(f.repoRoot), [])
  await put(path.join(f.notes, 'assets/not-here.png'), 'not actually an image')
  await assert.rejects(preparePost(f), /无法读取图片/)
  assert.deepEqual(await fs.readdir(f.repoRoot), [])
})

test('updates reuse the slug and publication date, preserve attachments, and are idempotent', async (t) => {
  const f = await fixture(t)
  await picture(path.join(f.notes, 'cover.png'))
  await put(f.source, '---\ntitle: Repeat\nheroImage: ./cover.png\npublishDate: auto\n---\n正文\n')
  const first = await preparePost({ ...f, slug: 'custom-slug' })
  await writePreparedPost(first, f.repoRoot)
  const attachment = path.join(f.repoRoot, first.postDir, 'attachment.pdf')
  await put(attachment, 'keep me')
  const second = await preparePost({ ...f, now: new Date('2026-10-01') })
  assert.equal(second.slug, 'custom-slug')
  assert.equal(output(first), output(second))
  await writePreparedPost(second, f.repoRoot)
  assert.equal(await fs.readFile(attachment, 'utf8'), 'keep me')
  const inPlace = await preparePost({
    ...f,
    source: path.join(f.repoRoot, second.postDir, 'index.md')
  })
  assert.equal(output(inPlace), output(second))
})

test('remote body images stay unchanged and a text-only article needs no image', async (t) => {
  const f = await fixture(t)
  const body = '# Text Only\n\n正文\n\n![remote](https://example.com/cover.png)\n'
  await put(f.source, body)
  const plan = await preparePost(f)
  assert.equal(plan.localImages, 0)
  assert.equal(plan.remoteImages, 1)
  assert.equal(metadata(plan).heroImage, undefined)
  assert.ok(output(plan).endsWith(body))
})

test('validates YAML, dates and slugs and refuses to overwrite a different article', async (t) => {
  const f = await fixture(t)
  assert.throws(() => readMarkdown('---\ntitle: x\ntitle: y\n---\n'), /frontmatter 格式错误/)
  await put(f.source, '---\ntitle: One\npublishDate: definitely-wrong\n---\n正文\n')
  await assert.rejects(preparePost(f), /不是有效日期/)
  await put(f.source, '---\ntitle: One\npublishDate: 2026-02-31\n---\n正文\n')
  await assert.rejects(preparePost(f), /不是有效日期/)
  await put(f.source, '# One\n')
  await assert.rejects(preparePost({ ...f, slug: '../escape' }), /无效的文章目录名/)
  const first = await preparePost(f)
  await writePreparedPost(first, f.repoRoot)
  await put(f.source, '# Another\n')
  await assert.rejects(preparePost({ ...f, slug: first.slug }), /已属于另一篇文章/)
})

test('a CLI slug overrides the frontmatter URL as well as the destination directory', async (t) => {
  const f = await fixture(t)
  await put(f.source, '---\ntitle: URL\nslug: old-url\n---\n正文\n')
  const plan = await preparePost({ ...f, slug: 'new-url' })
  assert.equal(plan.slug, 'new-url')
  assert.equal(metadata(plan).slug, 'new-url')
  assert.equal(plan.postDir, 'src/content/blog/new-url')
})

test('refuses symlinked output paths before writing any files', async (t) => {
  const f = await fixture(t)
  await picture(path.join(f.notes, 'cover.png'))
  await put(f.source, '# Symlink\n\n![](cover.png)\n')
  const plan = await preparePost(f)
  await fs.mkdir(path.join(f.repoRoot, 'src/content/blog'), { recursive: true })
  await fs.symlink(f.notes, path.join(f.repoRoot, plan.postDir))
  await assert.rejects(writePreparedPost(plan, f.repoRoot), /符号链接/)
  assert.equal(await fs.readFile(f.source, 'utf8'), '# Symlink\n\n![](cover.png)\n')
  await assert.rejects(fs.stat(path.join(f.notes, 'index.md')), { code: 'ENOENT' })
})

test('deploy CLI previews without SSH or git changes, then imports locally and skips a no-op commit', async (t) => {
  const f = await fixture(t)
  for (const script of ['deploy.sh', 'import-post.mjs']) {
    await put(
      path.join(f.repoRoot, 'scripts', script),
      await fs.readFile(path.join(project, 'scripts', script))
    )
  }
  await fs.symlink(path.join(project, 'node_modules'), path.join(f.repoRoot, 'node_modules'))
  await put(path.join(f.repoRoot, '.gitignore'), 'node_modules/\n')
  const git = (...args) => execFileSync('git', args, { cwd: f.repoRoot, encoding: 'utf8' }).trim()
  git('init', '-q')
  git('config', 'user.name', 'Import Test')
  git('config', 'user.email', 'import-test@example.invalid')
  git('add', '.')
  git('commit', '-qm', 'fixture')
  await picture(path.join(f.notes, 'cover.png'))
  await put(
    f.source,
    '---\ntitle: CLI Test\nheroImage: cover.png\npublishDate: xxxxxx\n---\n正文\n'
  )
  const cli = (...args) =>
    spawnSync('bash', ['scripts/deploy.sh', f.source, ...args], {
      cwd: f.repoRoot,
      encoding: 'utf8',
      env: { ...process.env, DEPLOY_HOST: '', IMAGE_DIRS: '' }
    })
  const preview = cli('--dry-run')
  assert.equal(preview.status, 0, preview.stderr)
  assert.match(preview.stdout, /仅本地预览/)
  assert.equal(git('status', '--porcelain'), '')
  assert.equal(git('rev-list', '--count', 'HEAD'), '1')
  const imported = cli('--import-only', '--yes')
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(git('rev-list', '--count', 'HEAD'), '2')
  assert.equal(git('status', '--porcelain'), '')
  const repeat = cli('--import-only', '--yes')
  assert.equal(repeat.status, 0, repeat.stderr)
  assert.match(repeat.stdout, /跳过提交/)
  assert.equal(git('rev-list', '--count', 'HEAD'), '2')
  assert.equal(cli('--rollback', '--dry-run').status, 2)
  await put(path.join(f.repoRoot, 'unrelated.txt'), 'not committed')
  const dirty = cli('--import-only', '--yes')
  assert.equal(dirty.status, 1)
  assert.match(dirty.stderr, /其他未提交/)
  assert.equal(git('rev-list', '--count', 'HEAD'), '2')
})
