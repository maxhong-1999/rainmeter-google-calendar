import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);

function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, projectRoot), 'utf8');
}

test('project uses MIT while retaining the ical.js license boundary', async () => {
  const [license, notices] = await Promise.all([
    readProjectFile('LICENSE'),
    readProjectFile('THIRD_PARTY_NOTICES.md'),
  ]);

  assert.match(license, /^MIT License/m);
  assert.match(license, /Copyright \(c\) 2026 Rainmeter Google Calendar contributors/);
  assert.match(notices, /ical\.js 2\.2\.1/i);
  assert.match(notices, /MPL-2\.0/i);
});

test('English and Korean guides link to one another and document both install paths', async () => {
  const [english, korean] = await Promise.all([
    readProjectFile('README.md'),
    readProjectFile('README.ko.md'),
  ]);

  assert.match(english, /README\.ko\.md/);
  assert.match(korean, /README\.md/);

  for (const guide of [english, korean]) {
    assert.match(guide, /\.rmskin/i);
    assert.match(guide, /Private\.inc/);
    assert.match(guide, /ChromeProfile\.inc/);
    assert.match(guide, /WebView2/i);
    assert.match(guide, /RunCommand/i);
    assert.match(guide, /10[^\n]*(minute|분)/i);
    assert.match(guide, /Today|오늘/i);
    assert.match(guide, /MIT/i);
  }
});

test('guides document the privacy boundary and intentionally direct Chrome launch', async () => {
  const [english, korean] = await Promise.all([
    readProjectFile('README.md'),
    readProjectFile('README.ko.md'),
  ]);

  for (const guide of [english, korean]) {
    assert.match(guide, /secret iCal|비공개 iCal/i);
    assert.match(guide, /no default-browser fallback|기본 브라우저.*대체/i);
    assert.match(guide, /THIRD_PARTY_NOTICES\.md/);
  }
});

test('release allowlist contains only runtime skin files', async () => {
  const runtimeFiles = JSON.parse(await readProjectFile('rmskin-files.json'));

  assert.deepEqual(runtimeFiles, [
    'GoogleCalendar.ini',
    '@Resources/calendar-events.mjs',
    '@Resources/calendar-feed-store.mjs',
    '@Resources/calendar-host.mjs',
    '@Resources/calendar-model.mjs',
    '@Resources/calendar-theme-ui.mjs',
    '@Resources/calendar-theme.mjs',
    '@Resources/calendar.css',
    '@Resources/calendar.html',
    '@Resources/calendar.js',
    '@Resources/vendor/ical.js',
  ]);
});

test('release preparation command runs tests before staging and is documented', async () => {
  const [packageJsonText, releaseScript, releaseGuide] = await Promise.all([
    readProjectFile('package.json'),
    readProjectFile('scripts/prepare-release.ps1'),
    readProjectFile('docs/RELEASING.md'),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  assert.equal(packageJson.scripts['release:prepare'], 'node scripts/prepare-rmskin.mjs');
  assert.match(releaseScript, /param\(/i);
  assert.match(releaseScript, /Mandatory\s*=\s*\$true/i);
  assert.match(releaseScript, /pnpm test/i);
  assert.match(releaseScript, /node scripts\/prepare-rmskin\.mjs --version \$Version --output output\/rmskin-stage/i);
  for (const phrase of ['Skin Packager', 'clean install', 'VariableFiles', 'GitHub Release']) {
    assert.match(releaseGuide, new RegExp(phrase, 'i'));
  }
});

test('GitHub Actions verifies the project on Windows for pushes and pull requests', async () => {
  const workflow = await readProjectFile('.github/workflows/test.yml');

  assert.match(workflow, /^on:\s*$/m);
  assert.match(workflow, /^\s+push:\s*$/m);
  assert.match(workflow, /^\s+pull_request:\s*$/m);
  assert.match(workflow, /runs-on:\s*windows-latest/i);
  assert.match(workflow, /actions\/checkout@/i);
  assert.match(workflow, /actions\/setup-node@/i);
  assert.match(workflow, /corepack enable/i);
  assert.match(workflow, /pnpm install --frozen-lockfile/i);
  assert.match(workflow, /pnpm test/i);
});
