import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

import { purge, purgeUrls } from './deploy-cache.mjs'
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

test('in-place synchronization preserves image markup and an explicit disabled cover', async (t) => {
  const f = await fixture(t)
  await picture(path.join(f.notes, 'cover.png'))
  const body = '\n正文\n\n![说明](./cover.png "原说明")\n'
  await put(f.source, '---\ntitle: No Cover\nheroImage: false\n---\n' + body)
  const first = await preparePost(f)
  assert.equal(metadata(first).heroImage, false)
  assert.equal(readMarkdown(output(first)).body, body)
  await writePreparedPost(first, f.repoRoot)
  const second = await preparePost({
    ...f,
    source: path.join(f.repoRoot, first.postDir, 'index.md')
  })
  assert.equal(output(second), output(first))
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

test('deployment and cache recovery use isolated remote fixtures on system Bash', async (t) => {
  const f = await fixture(t)
  for (const script of ['deploy.sh', 'deploy-remote.py', 'deploy-cache.mjs']) {
    await put(
      path.join(f.repoRoot, 'scripts', script),
      await fs.readFile(path.join(project, 'scripts', script))
    )
  }
  for (const script of ['update.py', 'chart.py', 'server.py']) {
    await put(
      path.join(f.repoRoot, 'scripts/public-stats', script),
      await fs.readFile(path.join(project, 'scripts/public-stats', script))
    )
  }
  await put(path.join(f.repoRoot, '.gitignore'), 'dist/\n')
  const git = (...args) => execFileSync('git', args, { cwd: f.repoRoot, encoding: 'utf8' }).trim()
  git('init', '-q')
  git('config', 'user.name', 'Deploy Test')
  git('config', 'user.email', 'deploy-test@example.invalid')
  git('add', '.')
  git('commit', '-qm', 'fixture')
  const oldHome = '<script id="counterscale-script"></script>old'
  const newHome = '<script id="counterscale-script"></script>new'
  const webRoot = path.join(f.root, 'live')
  for (const [name, text] of Object.entries({
    'index.html': oldHome,
    '404.html': 'not found',
    'blog/example/index.html': 'article'
  })) {
    await put(path.join(webRoot, name), text)
    await put(path.join(f.repoRoot, 'dist', name), name === 'index.html' ? newHome : text)
  }
  // Same size and mtime: the final publish must still replace the content.
  const stamp = new Date('2026-01-01T00:00:00Z')
  await fs.utimes(path.join(webRoot, 'index.html'), stamp, stamp)
  await fs.utimes(path.join(f.repoRoot, 'dist/index.html'), stamp, stamp)
  const bin = path.join(f.root, 'bin')
  const log = path.join(f.root, 'remote.log')
  await fs.mkdir(path.join(f.root, 'stats'))
  await put(path.join(f.root, 'refresh.service'), 'fixture unit')
  const realRsync = execFileSync('which', ['rsync'], { encoding: 'utf8' }).trim()
  const realBun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim()
  const fetchMock = await put(
    path.join(f.root, 'fetch-mock.mjs'),
    `
import fs from 'node:fs';
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.cloudflare.com/client/v4/zones/fixture-zone/purge_cache') throw new Error('Unexpected network request');
  fs.appendFileSync(process.env.DEPLOY_TEST_LOG, 'purge ' + options.body + '\\n');
  return Response.json({ success: process.env.DEPLOY_TEST_CF_FAIL !== '1' }, { status: process.env.DEPLOY_TEST_CF_FAIL === '1' ? 403 : 200 });
};
`
  )
  const stubs = {
    ssh: `#!/bin/bash
[ "$DEPLOY_TEST_SSH_FAIL" != 1 ] || exit 255
while [ "$#" -gt 0 ]; do
  case "$1" in -n) shift ;; -o) shift 2 ;; *) shift; break ;; esac
done
printf 'ssh %s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  *mktemp*) mktemp -d "$DEPLOY_TEST_ROOT/blog-stage.XXXXXX" ;;
  *'sudo -n true && if'*) if [ "$DEPLOY_TEST_STATS" = 1 ]; then printf 'yes\\n'; else printf 'no\\n'; fi ;;
  *) command="$(printf '%s' "$*" | sed "s|/opt/residream-public-stats/|$DEPLOY_TEST_ROOT/stats/|g" | sed "s|/etc/systemd/system/residream-public-refresh.service|$DEPLOY_TEST_ROOT/refresh.service|g")"
     /bin/bash -c "$command" ;;
esac
`,
    sudo: `#!/bin/sh
[ "$1" != -n ] || shift
exec "$@"
`,
    security: `#!/bin/sh
exit 1
`,
    systemctl: `#!/bin/sh
printf 'systemctl %s\\n' "$*" >> "$DEPLOY_TEST_LOG"
`,
    rsync: `#!/bin/bash
args=()
while [ "$#" -gt 0 ]; do
  case "$1" in -e) shift 2 ;; *) args+=("\${1#fixture.invalid:}"); shift ;; esac
done
exec '${realRsync}' "\${args[@]}"
`,
    bun: `#!/bin/sh
if [ "$1" = scripts/deploy-cache.mjs ]; then exec node --import "$DEPLOY_TEST_FETCH_MOCK" "$@"; fi
exec '${realBun}' "$@"
`,
    curl: `#!/bin/sh
for arg in "$@"; do url="$arg"; done
printf 'GET %s\\n' "$url" >> "$DEPLOY_TEST_LOG"
if [ "$DEPLOY_TEST_ORIGIN_FAIL" = 1 ]; then printf 503; exit 0; fi
case "$url" in
  */this-page-does-not-exist) printf 404 ;;
  */index.php/archive/) printf 301 ;;
  *) printf 200 ;;
esac
`
  }
  for (const [name, script] of Object.entries(stubs)) {
    const file = await put(path.join(bin, name), script)
    await fs.chmod(file, 0o755)
  }
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    DEPLOY_HOST: 'fixture.invalid',
    WEB_ROOT: webRoot,
    SITE_HOST: 'example.invalid',
    STAGE_DIR: 'blog-stage',
    CF_API_TOKEN: 'fixture-token',
    CF_ZONE_ID: 'fixture-zone',
    DEPLOY_TEST_LOG: log,
    DEPLOY_TEST_ROOT: f.root,
    DEPLOY_TEST_FETCH_MOCK: fetchMock,
    DEPLOY_TEST_SSH_FAIL: '0',
    DEPLOY_TEST_CF_FAIL: '0',
    DEPLOY_TEST_ORIGIN_FAIL: '0'
  }
  const run = (args, overrides = {}) =>
    spawnSync('/bin/bash', ['scripts/deploy.sh', ...args], {
      cwd: f.repoRoot,
      encoding: 'utf8',
      env: { ...env, ...overrides },
      timeout: 30000
    })
  const flags = ['--skip-build', '--yes']
  const preview = run(['--skip-build', '--dry-run'])
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  assert.equal(await fs.readFile(path.join(webRoot, 'index.html'), 'utf8'), oldHome)
  await assert.rejects(fs.stat(webRoot + '.deploy'), { code: 'ENOENT' })
  assert.doesNotMatch(await fs.readFile(log, 'utf8'), /purge /)
  const published = run(flags)
  assert.equal(published.status, 0, published.stdout + published.stderr)
  assert.equal(await fs.readFile(path.join(webRoot, 'index.html'), 'utf8'), newHome)
  assert.equal(await fs.readFile(path.join(webRoot + '.prev', 'index.html'), 'utf8'), oldHome)
  assert.match(published.stdout, /已发布：/)
  const calls = await fs.readFile(log, 'utf8')
  assert.match(calls, /GET https:\/\/example.invalid\/blog\/example/)
  assert.match(calls, /purge .*"files"/)
  assert.doesNotMatch(calls, /purge_everything/)
  const repeated = run(flags)
  assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr)
  assert.match(repeated.stdout, /线上页面已经是这个版本/)
  await put(path.join(f.repoRoot, 'dist/about/index.html'), 'about')
  const failedPurge = run(flags, { DEPLOY_TEST_CF_FAIL: '1' })
  assert.equal(failedPurge.status, 1, failedPurge.stdout + failedPurge.stderr)
  assert.equal(await fs.readFile(path.join(webRoot, 'about/index.html'), 'utf8'), 'about')
  assert.equal((await fs.readdir(path.join(webRoot + '.deploy', 'purge'))).length, 1)
  const recovered = run(flags)
  assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr)
  assert.match(recovered.stdout, /线上页面已经是这个版本/)
  assert.match(recovered.stdout, /已按 URL 清理 3 项缓存/)
  assert.deepEqual(await fs.readdir(path.join(webRoot + '.deploy', 'purge')), [])
  const failedOrigin = run(flags, { DEPLOY_TEST_ORIGIN_FAIL: '1' })
  assert.equal(failedOrigin.status, 0, 'unchanged content does not republish')
  await put(path.join(f.repoRoot, 'dist/about/index.html'), 'broken version')
  const restored = run(flags, { DEPLOY_TEST_ORIGIN_FAIL: '1' })
  assert.equal(restored.status, 1, restored.stdout + restored.stderr)
  assert.match(restored.stdout, /已恢复发布前的文件/)
  assert.equal(await fs.readFile(path.join(webRoot, 'about/index.html'), 'utf8'), 'about')
  await put(path.join(f.repoRoot, 'dist/about/index.html'), 'second version')
  assert.equal(run(flags).status, 0)
  const rollback = run(['--rollback', '--yes'])
  assert.equal(rollback.status, 0, rollback.stdout + rollback.stderr)
  assert.equal(await fs.readFile(path.join(webRoot, 'about/index.html'), 'utf8'), 'about')
  const only = run(['--purge-only'])
  assert.equal(only.status, 0, only.stdout + only.stderr)
  assert.match(only.stdout, /没有待清理的缓存/)
  const full = run(['--purge-only', '--purge-all', '--yes'])
  assert.equal(full.status, 0, full.stdout + full.stderr)
  assert.match(await fs.readFile(log, 'utf8'), /purge_everything/)
  assert.equal(run(['--purge-only', '--rollback']).status, 2)
  assert.equal(run(['--purge-only', '--dry-run']).status, 2)
  for (const root of ['/', '//', '/var/www', '/var/www//blog', '/etc', '/srv/blog/.']) {
    const unsafe = run(flags, { WEB_ROOT: root })
    assert.equal(unsafe.status, 1)
    assert.match(unsafe.stderr, /WEB_ROOT/)
    assert.doesNotMatch(unsafe.stdout, /检查 SSH/)
  }
  await put(path.join(f.repoRoot, 'uncommitted.txt'), 'local change')
  const dirty = run([...flags, '--allow-dirty'])
  assert.equal(dirty.status, 0, dirty.stdout + dirty.stderr)
  assert.match(dirty.stdout, /（含未提交改动）/)
  const unknown = run(['--unknown'])
  assert.equal(unknown.status, 2)
  const offline = run([...flags, '--allow-dirty'], { DEPLOY_TEST_SSH_FAIL: '1' })
  assert.equal(offline.status, 1)
  assert.match(offline.stderr, /无法登录 fixture.invalid。/)
  const restarts = async () =>
    (await fs.readFile(log, 'utf8')).match(/^systemctl restart /gm)?.length ?? 0
  const synced = run([...flags, '--allow-dirty'], { DEPLOY_TEST_STATS: '1' })
  assert.equal(synced.status, 0, synced.stdout + synced.stderr)
  assert.equal(await restarts(), 1)
  for (const name of ['update.py', 'chart.py', 'server.py']) {
    assert.deepEqual(
      await fs.readFile(path.join(f.root, 'stats', name)),
      await fs.readFile(path.join(f.repoRoot, 'scripts/public-stats', name))
    )
  }
  const sameScripts = run([...flags, '--allow-dirty'], { DEPLOY_TEST_STATS: '1' })
  assert.equal(sameScripts.status, 0, sameScripts.stdout + sameScripts.stderr)
  assert.equal(await restarts(), 1, 'unchanged task scripts must not restart the service')
  assert.ok((await fs.readdir(f.root)).every((name) => !name.startsWith('blog-stage.')))
})

test('cache targets cover both languages, deleted pages, encoded assets and page aliases', () => {
  const urls = purgeUrls('example.invalid', [
    {
      paths: [
        'index.html',
        'about/index.html',
        'en/about/index.html',
        'removed/index.html',
        'images/中文 #1.png',
        'rss.xml',
        'about/index.html'
      ]
    }
  ])
  for (const url of [
    '/',
    '/index.html',
    '/about',
    '/about/',
    '/about/index.html',
    '/en/about',
    '/removed',
    '/rss.xml',
    '/images/%E4%B8%AD%E6%96%87%20%231.png'
  ]) {
    assert.ok(urls.includes('https://example.invalid' + url), url)
  }
  assert.equal(urls.length, new Set(urls).size)
  assert.throws(() => purgeUrls('https://bad', []))
  assert.throws(() => purgeUrls('example.invalid', [{ paths: ['../outside'] }]))
})

test('independent data and new Astro resources are excluded, but reused asset names remain covered', () => {
  const paths = [
    'data/public-stats.json',
    'data/github-contributions.svg',
    '.release',
    '_astro/new-hash.js',
    '_astro/reused.js',
    'pagefind/pagefind.js'
  ]
  assert.deepEqual(purgeUrls('example.invalid', [{ paths, added: ['_astro/new-hash.js'] }]), [
    'https://example.invalid/_astro/reused.js',
    'https://example.invalid/pagefind/pagefind.js'
  ])
})

test('cache requests are deduplicated and batched, and full-zone purge requires its explicit option', async () => {
  const bodies = []
  const options = {
    host: 'example.invalid',
    token: 'fixture-token',
    zone: 'fixture-zone',
    sleep: async () => {},
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body))
      assert.ok(options.signal instanceof AbortSignal)
      return new Response('{ "success": true }', { status: 200 })
    }
  }
  const batches = [{ paths: Array.from({ length: 205 }, (_, i) => `images/${i}.svg`) }]
  assert.equal(await purge({ ...options, batches }), 205)
  assert.deepEqual(
    bodies.map((body) => body.files.length),
    [100, 100, 5]
  )
  assert.ok(bodies.every((body) => !('purge_everything' in body)))
  bodies.length = 0
  await purge({ ...options, batches: [], all: true })
  assert.deepEqual(bodies, [{ purge_everything: true }])
})

test('transient cache errors retry with a bound, while rejected credentials stop immediately', async () => {
  const options = {
    host: 'example.invalid',
    token: 'fixture-token',
    zone: 'fixture-zone',
    batches: [{ paths: ['index.html'] }]
  }
  const waits = []
  let calls = 0
  await purge({
    ...options,
    sleep: async (delay) => waits.push(delay),
    fetchImpl: async () => {
      const status = [500, 429, 200][calls++]
      return Response.json({ success: status === 200 }, { status, headers: { 'retry-after': '2' } })
    }
  })
  assert.equal(calls, 3)
  assert.deepEqual(waits, [2000, 2000])
  calls = 0
  await assert.rejects(
    purge({
      ...options,
      sleep: async () => {},
      fetchImpl: async () => {
        calls++
        return Response.json(
          { success: false, errors: [{ code: 9109, message: 'do not echo this' }] },
          { status: 403 }
        )
      }
    }),
    /HTTP 403，错误码 9109/
  )
  assert.equal(calls, 1)
  calls = 0
  await assert.rejects(
    purge({
      ...options,
      sleep: async () => {},
      fetchImpl: async () => {
        calls++
        throw new Error('offline')
      }
    }),
    /请求失败、超时或响应无效/
  )
  assert.equal(calls, 3)
})

test('an empty cache queue needs no token, but outstanding work must not be reported as complete', async () => {
  assert.equal(
    await purge({
      host: 'example.invalid',
      batches: [],
      fetchImpl: async () => assert.fail('unexpected network request')
    }),
    0
  )
  await assert.rejects(
    purge({ host: 'example.invalid', batches: [{ paths: ['index.html'] }] }),
    /未配置/
  )
})
