import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const resources = new URL('../@Resources/', import.meta.url);

async function readResource(name) {
  return readFile(new URL(name, resources), 'utf8');
}

test('local calendar UI fulfils the standalone widget contract', async () => {
  const [html, css, js, model] = await Promise.all([
    readResource('calendar.html'),
    readResource('calendar.css'),
    readResource('calendar.js'),
    readResource('calendar-model.mjs'),
  ]);
  const source = `${html}\n${css}\n${js}`;

  assert.doesNotMatch(`${html}\n${css}`, /https?:\/\//i);
  assert.doesNotMatch(html, /<a\b/i);
  assert.match(html, /aria-label="이전 달"/);
  assert.match(html, /aria-label="다음 달"/);
  assert.match(html, /<script type="importmap">[\s\S]*?"ical\.js"\s*:\s*"\.\/vendor\/ical\.js"[\s\S]*?<\/script>/);
  assert.match(html, /<script type="module" src="\.\/calendar\.js"><\/script>/);
  assert.match(css, /html,\s*body\s*\{[^}]*width:\s*600px;[^}]*height:\s*420px;/s);
  assert.match(css, /\.calendar-shell\s*\{[^}]*width:\s*600px;[^}]*height:\s*420px;[^}]*border-radius:\s*26px;/s);
  assert.match(js, /buildMonthMatrix\(state\.year,\s*state\.monthIndex\)/);
  assert.match(model, /Array\.from\(\{\s*length:\s*42\s*\}/);
  assert.match(js, /events\.slice\(0,\s*2\)/);
});

test('double-clicking the local calendar delegates eligible targets to the host bridge', async () => {
  const js = await readResource('calendar.js');

  assert.match(js, /import \{ openGoogleCalendar, shouldOpenGoogleCalendar \} from '\.\/calendar-host\.mjs';/);
  assert.match(js, /document\.addEventListener\('dblclick', \(event\) => \{/);
  assert.match(js, /if \(!shouldOpenGoogleCalendar\(event\.target\)\) return;/);
  assert.match(js, /openGoogleCalendar\(window\);/);
  assert.doesNotMatch(js, /function (?:getRainmeterApi|openGoogleCalendar)\(/);
});

test('Today is placed in the header and restores the current feed snapshot', async () => {
  const [html, css, js] = await Promise.all([
    readResource('calendar.html'),
    readResource('calendar.css'),
    readResource('calendar.js'),
  ]);

  assert.match(html, /id="previous-month"[\s\S]*?id="today-button"[\s\S]*?class="month-heading"/);
  assert.match(html, /id="today-button"[^>]*>오늘<\/button>/);
  assert.match(css, /\.calendar-header\s*\{[^}]*grid-template-columns:\s*34px\s+46px\s+1fr\s+46px\s+34px;[^}]*gap:\s*8px;/s);
  assert.match(css, /#next-month\s*\{[^}]*grid-column:\s*5;/s);
  assert.match(css, /\.today-button\s*\{[^}]*width:\s*46px;[^}]*height:\s*28px;[^}]*border-radius:/s);
  assert.match(js, /const todayButton = document\.querySelector\('#today-button'\);/);
  assert.match(js, /todayButton\.addEventListener\('click', goToToday\);/);
});

test('calendar date tracking stays live and follows the current month until navigation', async () => {
  const js = await readResource('calendar.js');

  assert.doesNotMatch(js, /^const today = new Date\(\);$/m);
  assert.match(js, /let followsToday = true;/);
  assert.match(js, /function render\(\)\s*\{[\s\S]*?const currentDate = new Date\(\);[\s\S]*?isSameLocalDay\(cell, currentDate\)/);
  assert.match(js, /function updateMonth\(delta\)\s*\{[\s\S]*?followsToday = false;/);
  assert.match(js, /function goToToday\(\)\s*\{[\s\S]*?followsToday = true;[\s\S]*?syncStateToToday\(\);/);
  assert.match(js, /window\.handleClockTick = function handleClockTick\(\)\s*\{[\s\S]*?syncStateToToday\(\);[\s\S]*?applySnapshot\(feedStore\.snapshot\(state\.year, state\.monthIndex\)\);/);
  assert.match(js, /window\.reloadCalendar = async function reloadCalendar\(\)\s*\{[\s\S]*?syncStateToToday\(\);/);
});

test('calendar controls and labels use centered, clipped inset-only styling', async () => {
  const [html, css] = await Promise.all([
    readResource('calendar.html'),
    readResource('calendar.css'),
  ]);

  assert.match(html, /id="previous-month"[^>]*>\s*<\/button>/);
  assert.match(html, /id="next-month"[^>]*>\s*<\/button>/);
  assert.match(css, /\.nav-button,\s*\.today-button,\s*\.settings-button\s*\{[^}]*place-items:\s*center;[^}]*padding:\s*0;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.nav-button::before\s*\{[^}]*width:\s*8px;[^}]*height:\s*8px;[^}]*border-right:\s*2px[^;]*;[^}]*border-bottom:\s*2px[^;]*;[^}]*transform:\s*rotate\(135deg\);/s);
  assert.match(css, /\.nav-button\.next::before\s*\{[^}]*transform:\s*rotate\(-45deg\);/s);
  assert.match(css, /h1\s*\{[^}]*text-align:\s*center;[^}]*line-height:/s);
  assert.match(css, /\.weekday-row span\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.day-number\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.event\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*height:\s*12px;[^}]*padding:\s*0\s+5px;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.calendar-shell\s*\{[^}]*overflow:\s*hidden;[^}]*box-shadow:\s*inset\s+0\s+0\s+0\s+1px\s+var\(--panel-border\),\s*inset\s+0\s+1px\s+rgb\(var\(--theme-background-rgb\)\s*\/\s*\.72\);/s);
  assert.doesNotMatch(css, /--shadow:/);
  assert.doesNotMatch(css, /0\s+20px\s+52px/);
});

test('the shell border is layout-neutral and preserves the baseline 18px content inset', async () => {
  const css = await readResource('calendar.css');
  const shellRule = css.match(/\.calendar-shell\s*\{[^}]*\}/s)?.[0] ?? '';
  const padding = Number(shellRule.match(/padding:\s*(\d+)px;/)?.[1] ?? 0);
  const border = Number(shellRule.match(/border:\s*(\d+)px\b/)?.[1] ?? 0);

  assert.equal(padding + border, 18);
  assert.match(shellRule, /box-shadow:\s*inset\s+0\s+0\s+0\s+1px\s+var\(--panel-border\),\s*inset\s+0\s+1px\s+rgb\(var\(--theme-background-rgb\)\s*\/\s*\.72\);/s);
});

test('the current-day number keeps the centered block-grid layout', async () => {
  const css = await readResource('calendar.css');

  assert.match(css, /\.day\.today \.day-number\s*\{[^}]*display:\s*grid;/s);
});

test('current day uses the theme background inside and foreground around its border', async () => {
  const css = await readResource('calendar.css');
  const todayRule = css.match(/\.day\.today \.day-number\s*\{[^}]*\}/s)?.[0] ?? '';
  assert.match(todayRule, /background:\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*var\(--theme-background-opacity\)\);/);
  assert.match(todayRule, /box-shadow:\s*inset\s+0\s+0\s+0\s+2px\s+rgb\(var\(--theme-foreground-rgb\)\s*\/\s*\.96\),\s*0\s+0\s+10px\s+rgb\(var\(--theme-foreground-rgb\)\s*\/\s*\.30\);/);
});

test('event text is explicitly centered on both axes', async () => {
  const css = await readResource('calendar.css');

  assert.match(css, /\.event\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/s);
});

test('holiday pills inherit the slider-derived event surface and retain their stronger border', async () => {
  const [css, js] = await Promise.all([
    readResource('calendar.css'),
    readResource('calendar.js'),
  ]);

  assert.match(js, /event-\$\{eventDetails\.source\}/);
  assert.match(css, /\.event\s*\{[^}]*background:\s*var\(--event\);/s);
  const holidayRule = css.match(/\.event-holidays\s*\{[^}]*\}/s)?.[0] ?? '';
  assert.doesNotMatch(holidayRule, /background\s*:/);
  assert.match(holidayRule, /box-shadow:\s*inset\s+0\s+0\s+0\s+1px\s+rgb\(var\(--theme-foreground-rgb\)\s*\/\s*\.78\);/s);
});

test('every fixed grid row visibly fits a date and two event pills', async () => {
  const css = await readResource('calendar.css');

  assert.match(css, /\.calendar-header\s*\{[^}]*height:\s*44px;/s);
  assert.match(css, /\.calendar-content\s*\{[^}]*margin-top:\s*4px;/s);
  assert.match(css, /\.weekday-row\s*\{[^}]*height:\s*17px;/s);
  assert.match(css, /\.calendar-grid\s*\{[^}]*grid-template-rows:\s*repeat\(6,\s*52px\);[^}]*gap:\s*1px;/s);
  assert.match(css, /\.day\s*\{[^}]*padding:\s*1px\s+4px;/s);
  assert.match(css, /\.event\s*\{[^}]*margin-top:\s*1px;[^}]*height:\s*12px;[^}]*padding:\s*0\s+5px;[^}]*font-size:\s*10px;[^}]*line-height:\s*1;/s);

  const rowHeight = 52;
  const dayPadding = 1 * 2;
  const dateNumberHeight = 24;
  const eventMargins = 1 * 2;
  const eventOuterHeight = 12;
  assert.ok(
    dayPadding + dateNumberHeight + eventMargins + (eventOuterHeight * 2) <= rowHeight,
    'two event pills must fit within the visible day row',
  );

  const availableContentHeight = 420 - (18 * 2) - (1 * 2);
  const gridHeight = (6 * rowHeight) + (5 * 1);
  assert.equal(44 + 4 + 17 + gridHeight, availableContentHeight);
});

test('readability styling uses theme foreground contrast while retaining faded adjacent-month dates', async () => {
  const css = await readResource('calendar.css');

  assert.match(css, /--panel:\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*calc\(var\(--theme-background-opacity\)\s*\*\s*\.82\)\);/);
  assert.match(css, /--panel-border:\s*rgb\(var\(--theme-foreground-rgb\)\s*\/\s*0\.56\);/);
  assert.match(css, /--muted:\s*rgb\(var\(--theme-foreground-rgb\)\s*\/\s*0\.82\);/);
  assert.match(css, /--event:\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*calc\(var\(--theme-background-opacity\)\s*\*\s*\.77\)\);/);
  assert.match(css, /--today:\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*calc\(var\(--theme-background-opacity\)\s*\*\s*\.92\)\);/);
  assert.match(css, /h1\s*\{[^}]*font-weight:\s*800;/s);
  assert.match(css, /\.weekday-row\s*\{[^}]*color:\s*var\(--text\);[^}]*font-weight:\s*800;/s);
  assert.match(css, /\.day-number\s*\{[^}]*font-weight:\s*700;/s);
  assert.match(css, /\.event\s*\{[^}]*font-weight:\s*700;/s);
  assert.match(css, /\.nav-button,\s*\.settings-button\s*\{[^}]*font-weight:\s*800;/s);
  assert.match(css, /h1,\s*\.weekday-row,\s*\.day-number,\s*\.event,\s*\.nav-button,\s*\.today-button,\s*\.settings-button,\s*\.theme-reset\s*\{[^}]*text-shadow:\s*0\s+1px\s+4px\s+var\(--theme-shadow\);/s);
  assert.match(css, /\.day\.outside-month\s*\{[^}]*opacity:\s*\.58;/s);
});

test('weekday labels use the fully opaque themed foreground', async () => {
  const css = await readResource('calendar.css');

  assert.match(css, /\.weekday-row\s*\{[^}]*color:\s*var\(--text\);/s);
});

test('normal sync states are silent and the empty live region collapses', async () => {
  const [css, js] = await Promise.all([
    readResource('calendar.css'),
    readResource('calendar.js'),
  ]);

  assert.match(css, /#sync-state:empty\s*\{\s*display:\s*none;\s*\}/);
  assert.match(js, /if \(snapshot\.sync === 'synced'\) return '';/);
  assert.match(js, /if \(snapshot\.sync === 'loading'\) return '';/);
  assert.match(js, /syncState\.textContent = syncMessage\(\{\s*sync:\s*'loading'/);
  assert.doesNotMatch(js, /if \(snapshot\.sync === 'synced'\) return '[^']+'/);
});

test('calendar reloads cached feeds once when the module initializes', async () => {
  const js = await readResource('calendar.js');
  const reloadDefinition = js.indexOf('window.reloadCalendar = async function reloadCalendar()');
  const startupReload = js.lastIndexOf('window.reloadCalendar();');
  const startupReloads = js.match(/window\.reloadCalendar\(\);/g) || [];

  assert.ok(reloadDefinition >= 0, 'reloadCalendar must be defined');
  assert.ok(startupReload > reloadDefinition, 'module startup must reload cached feeds after defining reloadCalendar');
  assert.equal(startupReloads.length, 1, 'module startup must invoke reloadCalendar exactly once');
});

test('theme settings retain the aligned, accessible color and opacity control contract', async () => {
  const [html, css, js] = await Promise.all([
    readResource('calendar.html'),
    readResource('calendar.css'),
    readResource('calendar.js'),
  ]);

  assert.match(html, /id="previous-month"[\s\S]*?id="today-button"[\s\S]*?id="month-label"[\s\S]*?id="theme-settings-button"[\s\S]*?id="next-month"/);
  assert.match(html, /id="theme-settings-button"[^>]*aria-label="색상 설정"[^>]*aria-expanded="false"[^>]*aria-controls="theme-settings-panel"/);
  assert.match(html, /id="theme-settings-panel"[^>]*role="dialog"[^>]*hidden/);
  assert.match(html, /id="theme-background"[^>]*type="color"/);
  assert.match(html, /id="theme-foreground"[^>]*type="color"/);
  assert.match(html, /id="theme-background-hex"[^>]*type="text"[^>]*maxlength="7"/);
  assert.match(html, /id="theme-foreground-hex"[^>]*type="text"[^>]*maxlength="7"/);
  assert.match(html, /id="theme-background-eyedropper"[^>]*type="button"[^>]*aria-label="배경색 화면에서 추출"/);
  assert.match(html, /id="theme-foreground-eyedropper"[^>]*type="button"[^>]*aria-label="글자색 화면에서 추출"/);
  assert.match(html, /id="theme-foreground"[\s\S]*?<label class="theme-opacity-field" for="theme-opacity">[\s\S]*?id="theme-opacity-value"[^>]*for="theme-opacity"[^>]*>78%<\/output>[\s\S]*?id="theme-opacity"[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*step="1"[^>]*value="78"[\s\S]*?id="theme-reset"/);
  assert.match(html, /id="theme-reset"[^>]*>초기화<\/button>/);

  assert.match(css, /#previous-month\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(css, /#today-button\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(css, /\.month-heading\s*\{[^}]*grid-column:\s*3;/s);
  assert.match(css, /#theme-settings-button\s*\{[^}]*grid-column:\s*4;[^}]*justify-self:\s*center;/s);
  assert.match(css, /#next-month\s*\{[^}]*grid-column:\s*5;/s);
  assert.match(css, /\.calendar-shell\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.theme-settings-panel\s*\{[^}]*position:\s*absolute;[^}]*top:\s*58px;[^}]*right:\s*18px;[^}]*z-index:\s*20;[^}]*width:\s*212px;[^}]*background:\s*rgb\(var\(--settings-surface-rgb\)\s*\/\s*\.94\);[^}]*backdrop-filter:\s*blur\(20px\);/s);
  assert.doesNotMatch(css.match(/\.theme-settings-panel\s*\{[^}]*\}/s)?.[0] ?? '', /(?:height|overflow):/);
  assert.match(css, /--theme-background-rgb:\s*255\s+255\s+255;/);
  assert.match(css, /--theme-foreground-rgb:\s*255\s+255\s+255;/);
  assert.doesNotMatch(css, /--theme-(?:background|foreground)-rgb:\s*[^;]*,/);
  assert.match(css, /--theme-background-opacity:\s*\.78;/);
  assert.match(css, /--settings-surface-rgb:\s*3\s+18\s+36;/);
  assert.match(css, /--theme-shadow:/);
  assert.match(css, /text-shadow:\s*0\s+1px\s+4px\s+var\(--theme-shadow\);/);
  assert.match(css, /\.calendar-shell\s*\{[^}]*background:\s*linear-gradient\(145deg,\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*var\(--theme-background-opacity\)\),\s*var\(--panel\)\);/s);
  assert.match(css, /\.nav-button,\s*\.settings-button\s*\{[^}]*background:\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*calc\(var\(--theme-background-opacity\)\s*\*\s*\.72\)\);/s);
  assert.match(css, /\.nav-button:hover,[^}]*background:\s*rgb\(var\(--theme-background-rgb\)\s*\/\s*calc\(var\(--theme-background-opacity\)\s*\*\s*\.84\)\);/s);
  assert.match(css, /\.theme-opacity-field\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr\s+auto;[^}]*gap:\s*8px;[^}]*margin-top:\s*10px;[^}]*font-size:\s*12px;[^}]*font-weight:\s*700;/s);
  assert.match(css, /\.theme-opacity-field output\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/s);
  assert.match(css, /\.theme-opacity-field input\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*width:\s*100%;[^}]*margin:\s*0;[^}]*accent-color:\s*rgb\(var\(--theme-foreground-rgb\)\);[^}]*cursor:\s*pointer;/s);
  assert.match(css, /\.theme-opacity-field input:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--text\);[^}]*outline-offset:\s*2px;/s);
  assert.doesNotMatch(css, /color:\s*(?:#fff|#ffffff|rgb\(255\s*,\s*255\s*,\s*255\))/i);

  assert.match(js, /import \{ createThemeSettingsController \} from '\.\/calendar-theme-ui\.mjs';/);
  assert.match(js, /const themeOpacity = document\.querySelector\('#theme-opacity'\);/);
  assert.match(js, /const themeBackgroundHex = document\.querySelector\('#theme-background-hex'\);/);
  assert.match(js, /const themeForegroundHex = document\.querySelector\('#theme-foreground-hex'\);/);
  assert.match(js, /const themeBackgroundEyedropper = document\.querySelector\('#theme-background-eyedropper'\);/);
  assert.match(js, /const themeForegroundEyedropper = document\.querySelector\('#theme-foreground-eyedropper'\);/);
  assert.match(js, /const themeOpacityValue = document\.querySelector\('#theme-opacity-value'\);/);
  assert.match(js, /createThemeSettingsController\(\{[\s\S]*?root:\s*document\.documentElement,[\s\S]*?storage:\s*themeStorage,[\s\S]*?documentTarget:\s*document,/);
  assert.match(js, /createThemeSettingsController\(\{[\s\S]*?opacityInput:\s*themeOpacity,[\s\S]*?opacityOutput:\s*themeOpacityValue,/);
  assert.match(js, /createThemeSettingsController\(\{[\s\S]*?backgroundHexInput:\s*themeBackgroundHex,[\s\S]*?foregroundHexInput:\s*themeForegroundHex,/);
  assert.match(js, /window\.applyPickedThemeColor = function applyPickedThemeColor\(target, color\)\s*\{[\s\S]*?themeSettings\.applyPickedColor\(target, color\);/);
  assert.match(js, /themeBackgroundEyedropper\.addEventListener\('click', \(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?requestScreenColor\('MeasureBackgroundScreenPicker'\);[\s\S]*?\}\);/);
  assert.match(js, /themeForegroundEyedropper\.addEventListener\('click', \(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?requestScreenColor\('MeasureForegroundScreenPicker'\);[\s\S]*?\}\);/);
  assert.match(js, /themeSettingsPanel\.contains\(event\.target\)/);
  assert.doesNotMatch(js, /function (?:applyTheme|setThemePanelOpen)\(/);
});
