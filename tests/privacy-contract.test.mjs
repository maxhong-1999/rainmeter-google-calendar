import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const integrationTest = new URL('./rainmeter-integration.test.mjs', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const manifestFile = new URL('../public-files.json', import.meta.url);

function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, projectRoot), 'utf8');
}

async function readPublicManifest() {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  assert.ok(Array.isArray(manifest), 'public-files.json must contain a JSON array');
  return manifest;
}

function assertSafeManifestPath(relativePath) {
  assert.equal(typeof relativePath, 'string');
  assert.ok(relativePath.length > 0);
  assert.equal(relativePath, relativePath.replaceAll('\\', '/'));
  assert.equal(relativePath, posix.normalize(relativePath));
  assert.equal(posix.isAbsolute(relativePath), false);
  assert.equal(win32.isAbsolute(relativePath), false);
  assert.notEqual(relativePath, '.');
  assert.doesNotMatch(relativePath, /(?:^|\/)\.\.(?:\/|$)/);

  const lowerPath = relativePath.toLowerCase();
  const segments = lowerPath.split('/');
  assert.equal(segments.includes('.git'), false);
  assert.equal(segments.includes('node_modules'), false);
  assert.equal(segments.includes('downloadfile'), false);
  assert.doesNotMatch(lowerPath, /(?:^|\/)private\.inc$/);
  assert.doesNotMatch(lowerPath, /(?:^|\/)chromeprofile\.inc$/);
}

async function readGitTrackedPaths() {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
      cwd: fileURLToPath(projectRoot),
      encoding: 'utf8',
    });
    return stdout.split('\0').filter(Boolean);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 128) return null;
    throw error;
  }
}

test('public manifest contains unique normalized safe relative paths', async () => {
  const publicFiles = await readPublicManifest();

  assert.ok(publicFiles.length > 0);
  publicFiles.forEach(assertSafeManifestPath);
  assert.equal(new Set(publicFiles).size, publicFiles.length);
  assert.ok(publicFiles.includes('public-files.json'));
});

test('public manifest exactly matches Git tracked files when repository metadata is available', async () => {
  const publicFiles = await readPublicManifest();
  const trackedFiles = await readGitTrackedPaths();

  if (trackedFiles === null) return;
  assert.deepEqual([...publicFiles].sort(), trackedFiles.sort());
});

test('privacy checks scan the combined text of every public manifest file', async () => {
  const publicFiles = await readPublicManifest();
  publicFiles.forEach(assertSafeManifestPath);
  const publicText = (await Promise.all(publicFiles.map(readProjectFile))).join('\n');

  assert.doesNotMatch(publicText, /C:\\Users\\/i);
  assert.doesNotMatch(publicText, new RegExp(['\uD64D', '\uC815\uBBFC'].join('')));
  assert.doesNotMatch(publicText, new RegExp(['max', 'hong99'].join(''), 'i'));
  assert.doesNotMatch(publicText, new RegExp(['hanyang', '\\.ac\\.kr'].join(''), 'i'));
  assert.doesNotMatch(publicText, /calendar\/ical\/(?!ko\.south_korea%23holiday%40group\.v\.calendar\.google\.com\/public\/basic\.ics)/i);
});

test('public examples and ignore rules preserve the local-only configuration contract', async () => {
  const [ignore, privateExample, profileExample] = await Promise.all([
    readProjectFile('.gitignore'),
    readProjectFile('@Resources/Private.inc.example'),
    readProjectFile('@Resources/ChromeProfile.inc.example'),
  ]);

  assert.match(ignore, /^@Resources\/Private\.inc$/m);
  assert.match(ignore, /^@Resources\/ChromeProfile\.inc$/m);
  assert.match(ignore, /^DownloadFile\/\*\.ics$/m);
  assert.match(ignore, /^node_modules\/$/m);
  assert.match(privateExample, /^\[Variables\]\r?\nCalendarURL=PASTE_YOUR_SECRET_ICAL_URL_HERE\s*$/);
  assert.match(profileExample, /^\[Variables\]\r?\n/);
  assert.match(profileExample, /^ChromePath=C:\\Program Files\\Google\\Chrome\\Application\\chrome\.exe$/m);
  assert.match(profileExample, /^ChromeProfileDirectory=Default$/m);
  assert.match(profileExample, /^GoogleAccount=you@example\.com$/m);
});

test('package metadata pins the supported pnpm release', async () => {
  const packageJson = JSON.parse(await readProjectFile('package.json'));
  assert.equal(packageJson.packageManager, 'pnpm@11.19.0');
});

test('README documents prerequisites, reproducible tests, failures, and launcher fallback policy', async () => {
  const readme = await readProjectFile('README.md');

  for (const prerequisite of ['Rainmeter', 'Chrome', 'WebView2', 'RunCommand', 'Node.js', 'pnpm']) {
    assert.match(readme, new RegExp(prerequisite, 'i'));
  }
  assert.match(readme, /corepack enable\s+pnpm install --frozen-lockfile\s+pnpm test/);
  assert.match(readme, /no default-browser fallback/i);
  assert.match(readme, /missing/i);
});

test('README and third-party notice state the MIT and ical.js legal boundaries', async () => {
  const [readme, thirdPartyNotices] = await Promise.all([
    readProjectFile('README.md'),
    readProjectFile('THIRD_PARTY_NOTICES.md'),
  ]);

  assert.match(readme, /MIT License/i);
  assert.match(readme, /THIRD_PARTY_NOTICES\.md/);
  assert.match(thirdPartyNotices, /ical\.js 2\.2\.1/i);
  assert.match(thirdPartyNotices, /MPL-2\.0/i);
});

test('integration verification consumes the runtime allowlist without traversing the filesystem', async () => {
  const source = await readFile(integrationTest, 'utf8');

  assert.match(source, /rmskin-files\.json/);
  assert.doesNotMatch(source, /const publishableSourcePaths = \[/);
  assert.doesNotMatch(source, /\breaddir\b/);
});

test('integration verification does not depend on or open ignored calendar caches', async () => {
  const source = await readFile(integrationTest, 'utf8');

  assert.doesNotMatch(source, /(?:personal|holiday|obsolete)Cache/);
  assert.doesNotMatch(source, /\baccess\s*\(/);
  assert.doesNotMatch(source, /readFile\([^\n]*(?:personal|holiday|obsolete)Cache/);
});
