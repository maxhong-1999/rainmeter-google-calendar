import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCliArguments, prepareRmskinStage } from '../scripts/prepare-rmskin.mjs';

const temporaryRoots = [];

after(async () => {
  await Promise.all(temporaryRoots.map(path => rm(path, { recursive: true, force: true })));
});

async function writeFixtureFile(rootDir, relativePath, content) {
  const target = join(rootDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function createFixture({ runtimeFiles = ['GoogleCalendar.ini', '@Resources/calendar.html', '@Resources/vendor/ical.js'], privateExample = '[Variables]\nCalendarURL=PASTE_YOUR_SECRET_ICAL_URL_HERE\n' } = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), 'rainmeter-google-calendar-'));
  temporaryRoots.push(rootDir);

  await writeFixtureFile(rootDir, 'rmskin-files.json', JSON.stringify(runtimeFiles, null, 2));
  await writeFixtureFile(rootDir, '@Resources/Private.inc.example', privateExample);
  await writeFixtureFile(rootDir, '@Resources/ChromeProfile.inc.example', [
    '[Variables]',
    'ChromePath=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'ChromeProfileDirectory=Default',
    'GoogleAccount=you@example.com',
    '',
  ].join('\n'));

  for (const relativePath of runtimeFiles) {
    await writeFixtureFile(rootDir, relativePath, `fixture:${relativePath}\n`);
  }

  await writeFixtureFile(rootDir, '@Resources/Private.inc', '[Variables]\nCalendarURL=https://private.example.invalid/feed\n');
  await writeFixtureFile(rootDir, '@Resources/ChromeProfile.inc', '[Variables]\nGoogleAccount=private-user@example.invalid\n');
  return rootDir;
}

test('stages runtime files and placeholder configuration without copying local values', async () => {
  const rootDir = await createFixture();
  const outputDir = join(rootDir, 'output', 'rmskin-stage');

  const result = await prepareRmskinStage({ rootDir, outputDir, version: '1.0.0' });
  const privateConfig = await readFile(join(result.stageRoot, 'Skins', 'GoogleCalendar', '@Resources', 'Private.inc'), 'utf8');
  const profileConfig = await readFile(join(result.stageRoot, 'Skins', 'GoogleCalendar', '@Resources', 'ChromeProfile.inc'), 'utf8');
  const manifest = await readFile(join(result.stageRoot, 'RMSKIN.ini'), 'utf8');

  assert.equal(result.stageRoot, outputDir);
  assert.deepEqual(result.copiedFiles, ['GoogleCalendar.ini', '@Resources/calendar.html', '@Resources/vendor/ical.js']);
  assert.equal(privateConfig, '[Variables]\nCalendarURL=PASTE_YOUR_SECRET_ICAL_URL_HERE\n');
  assert.match(profileConfig, /^GoogleAccount=you@example\.com$/m);
  assert.doesNotMatch(`${privateConfig}\n${profileConfig}`, /private-user@example\.invalid|private\.example\.invalid/);
  assert.match(manifest, /^Version=1\.0\.0$/m);
  assert.match(manifest, /^Load=GoogleCalendar\\GoogleCalendar\.ini$/m);
  assert.match(manifest, /^VariableFiles=GoogleCalendar\\@Resources\\Private\.inc\|GoogleCalendar\\@Resources\\ChromeProfile\.inc$/m);
});

test('rejects an unsafe release allowlist before it copies files', async () => {
  const rootDir = await createFixture({ runtimeFiles: ['GoogleCalendar.ini', '@Resources/Private.inc'] });

  await assert.rejects(
    prepareRmskinStage({ rootDir, outputDir: join(rootDir, 'output', 'rmskin-stage'), version: '1.0.0' }),
    /local configuration/i,
  );
});

test('rejects output paths outside the owned output directory', async () => {
  const rootDir = await createFixture();

  await assert.rejects(
    prepareRmskinStage({ rootDir, outputDir: join(tmpdir(), 'not-owned-by-project'), version: '1.0.0' }),
    /output directory/i,
  );
});

test('rejects unsafe generated placeholder content', async () => {
  const rootDir = await createFixture({
    privateExample: '[Variables]\nCalendarURL=https://private.example.invalid/feed\n',
  });

  await assert.rejects(
    prepareRmskinStage({ rootDir, outputDir: join(rootDir, 'output', 'rmskin-stage'), version: '1.0.0' }),
    /private calendar URL/i,
  );
});

test('rejects invalid release versions', async () => {
  const rootDir = await createFixture();

  await assert.rejects(
    prepareRmskinStage({ rootDir, outputDir: join(rootDir, 'output', 'rmskin-stage'), version: '1.0' }),
    /version/i,
  );
});

test('parses an explicit version and optional output argument for the release CLI', () => {
  assert.deepEqual(
    parseCliArguments(['--version', '1.0.0', '--output', 'output/custom-stage']),
    { version: '1.0.0', outputDir: 'output/custom-stage' },
  );
  assert.throws(() => parseCliArguments(['--version', '1.0.0', '--unknown']), /unknown argument/i);
  assert.throws(() => parseCliArguments(['--output', 'output/custom-stage']), /--version/i);
});
