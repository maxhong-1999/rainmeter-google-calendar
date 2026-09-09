import { eventsForMonth } from './calendar-events.mjs';
import { createCalendarFeedStore } from './calendar-feed-store.mjs';
import {
  buildMonthMatrix,
  formatMonthLabel,
  isSameLocalDay,
  monthStateForDate,
  shiftMonth,
  syncMonthStateToDate,
} from './calendar-model.mjs';
import { openGoogleCalendar, shouldOpenGoogleCalendar } from './calendar-host.mjs';
import { createThemeSettingsController } from './calendar-theme-ui.mjs';
import { createColorPicker } from './calendar-color-picker.mjs';

const CALENDAR_FEEDS = [
  { source: 'personal', path: '../DownloadFile/personal.ics' },
  { source: 'holidays', path: '../DownloadFile/holidays.ics' },
];

const grid = document.querySelector('#calendar-grid');
const monthLabel = document.querySelector('#month-label');
const syncState = document.querySelector('#sync-state');
const previousButton = document.querySelector('#previous-month');
const todayButton = document.querySelector('#today-button');
const themeSettingsButton = document.querySelector('#theme-settings-button');
const themeSettingsPanel = document.querySelector('#theme-settings-panel');
const themeBackground = document.querySelector('#theme-background');
const themeForeground = document.querySelector('#theme-foreground');
const themeBackgroundHex = document.querySelector('#theme-background-hex');
const themeForegroundHex = document.querySelector('#theme-foreground-hex');
const themeOpacity = document.querySelector('#theme-opacity');
const themeOpacityValue = document.querySelector('#theme-opacity-value');
const themeReset = document.querySelector('#theme-reset');
const nextButton = document.querySelector('#next-month');
const feedStore = createCalendarFeedStore(CALENDAR_FEEDS, eventsForMonth);

let themeStorage = null;
try {
  themeStorage = window.localStorage;
} catch {}

const state = monthStateForDate(new Date());
let followsToday = true;

let eventsByDay = new Map();

const themeSettings = createThemeSettingsController({
  root: document.documentElement,
  storage: themeStorage,
  settingsButton: themeSettingsButton,
  settingsPanel: themeSettingsPanel,
  backgroundInput: themeBackground,
  foregroundInput: themeForeground,
  backgroundHexInput: themeBackgroundHex,
  foregroundHexInput: themeForegroundHex,
  opacityInput: themeOpacity,
  opacityOutput: themeOpacityValue,
  resetButton: themeReset,
  documentTarget: document,
});

const colorPicker = createColorPicker({
  host: window,
  panel: document.querySelector('#color-picker'),
  palette: document.querySelector('#picker-palette'),
  cursor: document.querySelector('#picker-cursor'),
  hue: document.querySelector('#picker-hue'),
  preview: document.querySelector('#picker-preview'),
  channels: ['r', 'g', 'b'].map(channel => document.querySelector(`#picker-${channel}`)),
  eyedropper: document.querySelector('#picker-eyedropper'),
  closeButton: document.querySelector('#picker-close'),
  status: document.querySelector('#picker-status'),
  heading: document.querySelector('#picker-heading'),
  helpPanel: document.querySelector('#picker-help'),
  helpStatus: document.querySelector('#picker-help-status'),
  installButton: document.querySelector('#picker-install'),
  refreshButton: document.querySelector('#picker-refresh'),
  dismissButton: document.querySelector('#picker-help-dismiss'),
  swatches: { background: themeBackground, foreground: themeForeground },
  onColor: (target, hex) => themeSettings.applyPickedColor(target, hex),
});
new MutationObserver(() => {
  if (themeSettingsPanel.hidden) colorPicker.close();
}).observe(themeSettingsPanel, { attributes: true, attributeFilter: ['hidden'] });

function dateKey(cell) {
  return `${cell.year}-${String(cell.monthIndex + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
}

function render() {
  const currentDate = new Date();
  monthLabel.textContent = formatMonthLabel(state.year, state.monthIndex);
  grid.replaceChildren();

  for (const cell of buildMonthMatrix(state.year, state.monthIndex)) {
    const day = document.createElement('section');
    day.className = `day${cell.inMonth ? '' : ' outside-month'}${isSameLocalDay(cell, currentDate) ? ' today' : ''}`;
    day.setAttribute('role', 'gridcell');
    day.setAttribute('aria-label', `${cell.monthIndex + 1}월 ${cell.day}일`);

    const dayNumber = document.createElement('span');
    dayNumber.className = 'day-number';
    dayNumber.textContent = String(cell.day);
    day.append(dayNumber);

    const events = eventsByDay.get(dateKey(cell)) || [];
    for (const eventDetails of events.slice(0, 2)) {
      const event = document.createElement('div');
      event.className = `event event-${eventDetails.source}`;
      event.textContent = eventDetails.title;
      event.title = eventDetails.title;
      day.append(event);
    }
    grid.append(day);
  }
}

function syncMessage(snapshot) {
  if (snapshot.sync === 'synced') return '';
  if (snapshot.sync === 'loading') return '';
  if (snapshot.sync === 'partial-error') return '일부 일정은 마지막 동기화 내용 표시 중';
  return snapshot.cachedSources.length ? '마지막 동기화 일정 표시 중' : '일정을 불러오지 못함';
}

function applySnapshot(snapshot) {
  eventsByDay = snapshot.eventsByDay;
  document.documentElement.dataset.sync = snapshot.sync;
  syncState.textContent = syncMessage(snapshot);
  render();
}

function syncStateToToday() {
  syncMonthStateToDate(state, followsToday, new Date());
}

function updateMonth(delta) {
  followsToday = false;
  Object.assign(state, shiftMonth(state.year, state.monthIndex, delta));
  applySnapshot(feedStore.snapshot(state.year, state.monthIndex));
}

function goToToday() {
  followsToday = true;
  syncStateToToday();
  applySnapshot(feedStore.snapshot(state.year, state.monthIndex));
}

async function loadFeedText(feed) {
  const response = await fetch(`${feed.path}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Calendar cache request failed: ${response.status}`);
  return response.text();
}

previousButton.addEventListener('click', () => updateMonth(-1));
todayButton.addEventListener('click', goToToday);
nextButton.addEventListener('click', () => updateMonth(1));
document.addEventListener('dblclick', (event) => {
  if (themeSettingsPanel.contains(event.target)) return;
  if (!shouldOpenGoogleCalendar(event.target)) return;
  openGoogleCalendar(window);
});

window.markCalendarFeedError = function markCalendarFeedError(source) {
  feedStore.markFeedError(source);
  applySnapshot(feedStore.snapshot(state.year, state.monthIndex));
};

window.receiveScreenColor = function receiveScreenColor() {
  return colorPicker.receiveScreenColor();
};

window.markCalendarFeedSuccess = function markCalendarFeedSuccess(source) {
  feedStore.markFeedSuccess(source);
};

window.handleClockTick = function handleClockTick() {
  syncStateToToday();
  applySnapshot(feedStore.snapshot(state.year, state.monthIndex));
};

window.reloadCalendar = async function reloadCalendar() {
  syncStateToToday();
  document.documentElement.dataset.sync = 'loading';
  syncState.textContent = syncMessage({ sync: 'loading' });
  const snapshot = await feedStore.reloadMonth(state.year, state.monthIndex, loadFeedText);
  applySnapshot(snapshot);
};

render();
window.reloadCalendar();
