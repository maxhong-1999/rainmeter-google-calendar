import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PRIVATE_CALENDAR_PLACEHOLDER = 'CalendarURL=PASTE_YOUR_SECRET_ICAL_URL_HERE';
const CHROME_ACCOUNT_PLACEHOLDER = 'GoogleAccount=you@example.com';

function isDescendant(parentPath, childPath) {
  const pathRelative = relative(parentPath, childPath);
  return pathRelative.length > 0 && !pathRelative.startsWith(`..${sep}`) && pathRelative !== '..';
}

function assertReleaseVersion(version) {
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new Error('Release version must use major.minor.patch format.');
  }
}

function assertSafeRelativePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\\')) {
    throw new Error('Release allowlist entries must use non-empty forward-slash relative paths.');
  }

  const normalizedPath = filePath.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  if (
    normalizedPath.startsWith('/') ||
    normalizedPath.includes(':') ||
    segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('Release allowlist contains an unsafe path.');
  }

  const lowered = normalizedPath.toLowerCase();
  if (lowered.includes('/.git/') || lowered.startsWith('.git/') || lowered.includes('node_modules') || lowered.includes('downloadfile')) {
    throw new Error('Release allowlist contains a forbidden directory.');
  }
  if (lowered.endsWith('/private.inc') || lowered.endsWith('/chromeprofile.inc')) {
    throw new Error('Release allowlist must not include local configuration.');
  }
}

async function readRuntimeFiles(rootDir) {
  const manifestPath = resolve(rootDir, 'rmskin-files.json');
  const runtimeFiles = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(runtimeFiles) || runtimeFiles.length === 0) {
    throw new Error('Release allowlist must be a non-empty JSON array.');
  }
  runtimeFiles.forEach(assertSafeRelativePath);
  if (new Set(runtimeFiles).size !== runtimeFiles.length) {
    throw new Error('Release allowlist must not contain duplicate paths.');
  }
  return runtimeFiles;
}

async function copyRuntimeFiles(rootDir, skinRoot, runtimeFiles) {
  for (const runtimeFile of runtimeFiles) {
    const source = resolve(rootDir, runtimeFile);
    if (!isDescendant(rootDir, source)) {
      throw new Error('Release allowlist resolves outside the project.');
    }
    const sourceStat = await lstat(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      throw new Error('Release allowlist entries must reference regular project files.');
    }

    const destination = resolve(skinRoot, runtimeFile);
    if (!isDescendant(skinRoot, destination)) {
      throw new Error('Release destination resolves outside the skin directory.');
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

function assertPlaceholderConfiguration(privateConfig, chromeConfig) {
  if (!privateConfig.split(/\r?\n/).includes(PRIVATE_CALENDAR_PLACEHOLDER)) {
    throw new Error('Generated configuration contains a private calendar URL.');
  }
  if (!chromeConfig.split(/\r?\n/).includes(CHROME_ACCOUNT_PLACEHOLDER)) {
    throw new Error('Generated configuration contains a non-placeholder Google account.');
  }
}

function assertPublicText(text) {
  if (/C:\\Users\\/i.test(text)) {
    throw new Error('Release staging contains a Windows user path.');
  }
  if (/CalendarURL=(?!PASTE_YOUR_SECRET_ICAL_URL_HERE\s*$)/m.test(text)) {
    throw new Error('Release staging contains a private calendar URL.');
  }
  if (/GoogleAccount=(?!you@example\.com\s*$)/m.test(text)) {
    throw new Error('Release staging contains a non-placeholder Google account.');
  }
}

function renderRmskinManifest(version) {
  return [
    '[rmskin]',
    'Name=Google Calendar',
    'Author=Rainmeter Google Calendar contributors',
    `Version=${version}`,
    'LoadType=Skin',
    'Load=GoogleCalendar\\GoogleCalendar.ini',
    'MinimumRainmeter=4.5.0',
    'MinimumWindows=10.0',
    'VariableFiles=GoogleCalendar\\@Resources\\Private.inc|GoogleCalendar\\@Resources\\ChromeProfile.inc',
    '',
  ].join('\n');
}

export function parseCliArguments(argumentsList) {
  let version;
  let outputDir = 'output/rmskin-stage';

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--version' || argument === '--output') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === '--version') version = value;
      if (argument === '--output') outputDir = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!version) {
    throw new Error('--version is required.');
  }
  return { version, outputDir };
}

export async function prepareRmskinStage({ rootDir, outputDir, version }) {
  assertReleaseVersion(version);

  const resolvedRoot = resolve(rootDir);
  const resolvedOutput = resolve(outputDir);
  const ownedOutputRoot = resolve(resolvedRoot, 'output');
  if (!isDescendant(ownedOutputRoot, resolvedOutput)) {
    throw new Error('Release output directory must be inside the project output directory.');
  }

  const runtimeFiles = await readRuntimeFiles(resolvedRoot);
  const privateExamplePath = resolve(resolvedRoot, '@Resources', 'Private.inc.example');
  const profileExamplePath = resolve(resolvedRoot, '@Resources', 'ChromeProfile.inc.example');
  const [privateConfig, chromeConfig] = await Promise.all([
    readFile(privateExamplePath, 'utf8'),
    readFile(profileExamplePath, 'utf8'),
  ]);
  assertPlaceholderConfiguration(privateConfig, chromeConfig);

  await rm(resolvedOutput, { recursive: true, force: true });
  const skinRoot = resolve(resolvedOutput, 'Skins', 'GoogleCalendar');
  await mkdir(resolve(skinRoot, '@Resources'), { recursive: true });
  await copyRuntimeFiles(resolvedRoot, skinRoot, runtimeFiles);
  await writeFile(resolve(skinRoot, '@Resources', 'Private.inc'), privateConfig, 'utf8');
  await writeFile(resolve(skinRoot, '@Resources', 'ChromeProfile.inc'), chromeConfig, 'utf8');
  await writeFile(resolve(resolvedOutput, 'RMSKIN.ini'), renderRmskinManifest(version), 'utf8');

  assertPublicText(privateConfig);
  assertPublicText(chromeConfig);
  assertPublicText(await readFile(resolve(resolvedOutput, 'RMSKIN.ini'), 'utf8'));

  return { stageRoot: resolvedOutput, copiedFiles: runtimeFiles };
}

async function runCli() {
  const { version, outputDir } = parseCliArguments(process.argv.slice(2));
  const result = await prepareRmskinStage({
    rootDir: process.cwd(),
    outputDir: resolve(process.cwd(), outputDir),
    version,
  });
  console.log(`Prepared RMSKIN staging tree: ${result.stageRoot}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
