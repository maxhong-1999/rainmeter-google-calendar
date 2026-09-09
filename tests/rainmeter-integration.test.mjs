import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = new URL('../GoogleCalendar.ini', import.meta.url);
const calendarScript = new URL('../@Resources/calendar.js', import.meta.url);
const runtimeManifestFile = new URL('../rmskin-files.json', import.meta.url);
const holidayUrl = 'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics';
const googleCalendarUrl = 'https://calendar.google.com/calendar/u/0/r?authuser=#GoogleAccount#';

function parseIni(text) {
  const sections = new Map();
  let currentSection;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      currentSection = new Map();
      sections.set(header[1], currentSection);
      continue;
    }
    const separator = line.indexOf('=');
    if (currentSection && separator > 0) {
      currentSection.set(line.slice(0, separator), line.slice(separator + 1));
    }
  }

  return sections;
}

async function readAuthoredRuntimeSources() {
  const runtimeFiles = JSON.parse(await readFile(runtimeManifestFile, 'utf8'));
  const authoredPaths = runtimeFiles.filter(path => !path.startsWith('@Resources/vendor/'));
  const contents = await Promise.all(
    authoredPaths.map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')),
  );
  return contents.join('\n');
}

test('Rainmeter sections own the complete dual-feed and local WebView contracts', async () => {
  const ini = await readFile(config, 'utf8');
  const sections = parseIni(ini);
  const rainmeter = sections.get('Rainmeter');
  const clockTime = sections.get('MeasureClockTime');
  const scheduler = sections.get('MeasureClockAlignedRefresh');
  const personal = sections.get('MeasurePersonalCalendarFeed');
  const holidays = sections.get('MeasureHolidayCalendarFeed');
  const openGoogleCalendar = sections.get('MeasureOpenGoogleCalendar');
  const screenPicker = sections.get('MeasureYourPicker');
  const webView = sections.get('WebView2');
  const bounds = sections.get('Bounds');

  assert.equal(rainmeter.get('@Include'), '#@#Private.inc');
  assert.equal(rainmeter.get('@Include2'), '#@#ChromeProfile.inc');
  assert.deepEqual(Object.fromEntries(clockTime), {
    Measure: 'Time',
    Format: '%M%S',
  });
  assert.deepEqual(Object.fromEntries(scheduler), {
    Measure: 'Calc',
    Formula: '[MeasureClockTime]',
    DynamicVariables: '1',
    IfCondition: '(MeasureClockAlignedRefresh % 1000) = 0',
    IfTrueAction: '[!CommandMeasure MeasurePersonalCalendarFeed "Update"][!CommandMeasure MeasureHolidayCalendarFeed "Update"][!CommandMeasure WebView2 "Execute window.handleClockTick && window.handleClockTick()"]',
  });
  assert.deepEqual(Object.fromEntries([...personal].filter(([key]) => [
    'Measure', 'URL', 'UpdateRate', 'Download', 'DownloadFile', 'Flags',
  ].includes(key))), {
    Measure: 'WebParser',
    URL: '#CalendarURL#',
    UpdateRate: '600',
    Download: '1',
    DownloadFile: 'personal.ics',
    Flags: 'ForceReload|NoCookies',
  });
  assert.match(personal.get('FinishAction'), /markCalendarFeedSuccess\('personal'\).*window\.reloadCalendar\(\)/);
  assert.match(personal.get('OnDownloadErrorAction'), /markCalendarFeedError\('personal'\)/);

  assert.deepEqual(Object.fromEntries([...holidays].filter(([key]) => [
    'Measure', 'URL', 'UpdateRate', 'Download', 'DownloadFile', 'Flags',
  ].includes(key))), {
    Measure: 'WebParser',
    URL: holidayUrl,
    UpdateRate: '600',
    Download: '1',
    DownloadFile: 'holidays.ics',
    Flags: 'ForceReload|NoCookies',
  });
  assert.match(holidays.get('FinishAction'), /markCalendarFeedSuccess\('holidays'\).*window\.reloadCalendar\(\)/);
  assert.match(holidays.get('OnDownloadErrorAction'), /markCalendarFeedError\('holidays'\)/);

  assert.deepEqual(Object.fromEntries(openGoogleCalendar), {
    Measure: 'Plugin',
    Plugin: 'RunCommand',
    Program: '""#ChromePath#""',
    Parameter: '--profile-directory="#ChromeProfileDirectory#" --new-window "https://calendar.google.com/calendar/u/0/r?authuser=#GoogleAccount#"',
    State: 'Hide',
    DynamicVariables: '1',
  });

  assert.equal([...sections.values()].filter(section => section.get('Plugin') === 'YourPicker').length, 1);
  assert.deepEqual(Object.fromEntries(screenPicker), {
    Measure: 'Plugin',
    Plugin: 'YourPicker',
    ReturnValue: 'Hex',
    DarkMode: '1',
    OnFinishAction: '[!CommandMeasure WebView2 "Execute window.receiveScreenColor && window.receiveScreenColor()"]',
  });

  assert.deepEqual(Object.fromEntries(webView), {
    Measure: 'Plugin',
    Plugin: 'WebView2',
    HostSecurity: '1',
    HostOrigin: '0',
    HostPath: '#CURRENTPATH#',
    URL: '@Resources/calendar.html',
    X: '0',
    Y: '0',
    W: '600',
    H: '420',
    Clickthrough: '2',
    ZoomFactor: '1.0',
    ZoomControl: '0',
    AssistiveFeatures: '0',
    NewWindow: '0',
  });
  assert.deepEqual(Object.fromEntries(bounds), {
    Meter: 'Image', X: '0', Y: '0', W: '600', H: '420', SolidColor: '0,0,0,1',
  });
});

test('calendar JavaScript fetches exactly the two staged cache paths', async () => {
  const js = await readFile(calendarScript, 'utf8');
  const paths = [...js.matchAll(/path:\s*'([^']+\.ics)'/g)].map(match => match[1]);

  assert.deepEqual(paths, [
    '../DownloadFile/personal.ics',
    '../DownloadFile/holidays.ics',
  ]);
  assert.match(js, /fetch\(`\$\{feed\.path\}\?ts=\$\{Date\.now\(\)\}`/);
  assert.doesNotMatch(js, /DownloadFile\/calendar\.ics/);
});

test('authored public sources allow only approved runtime URLs without opening calendar data', async () => {
  const sources = await readAuthoredRuntimeSources();
  const externalUrls = sources.match(/https?:\/\/[^\s'"\]]+/gi) || [];
  assert.deepEqual(
    [...new Set(externalUrls)].sort(),
    [holidayUrl, googleCalendarUrl].sort(),
  );
  assert.doesNotMatch(sources, /calendar\.google\.com\/calendar\/ical\/(?!ko\.south_korea%23holiday%40group\.v\.calendar\.google\.com\/public\/basic\.ics)/i);
  assert.doesNotMatch(sources, /CalendarURL\s*=\s*https?:\/\//i);
  assert.doesNotMatch(sources, new RegExp(['private', '-'].join(''), 'i'));
});
