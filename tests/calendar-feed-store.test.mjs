import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCalendarFeedStore,
  mergeMonthMaps,
  visibleEventsForDay,
} from '../@Resources/calendar-feed-store.mjs';

const feeds = [
  { source: 'personal', path: '../DownloadFile/personal.ics' },
  { source: 'holidays', path: '../DownloadFile/holidays.ics' },
];

function eventMap(...events) {
  return new Map([['2026-09-03', events]]);
}

test('merged rendering labels both sources and applies one total two-event cap', () => {
  const merged = mergeMonthMaps([
    ['personal', eventMap({ title: '개인 1', allDay: false, startMs: 2 })],
    ['holidays', eventMap(
      { title: '공휴일 1', allDay: true, startMs: 1 },
      { title: '공휴일 2', allDay: true, startMs: 3 },
    )],
  ]);

  assert.deepEqual(merged.get('2026-09-03').map(({ title, source }) => ({ title, source })), [
    { title: '공휴일 1', source: 'holidays' },
    { title: '공휴일 2', source: 'holidays' },
    { title: '개인 1', source: 'personal' },
  ]);
  assert.equal(visibleEventsForDay(merged, '2026-09-03').length, 2);
});

test('a partial then full failure retains each source last-successful text without throwing', async () => {
  const parseCalendar = text => eventMap({ title: text, allDay: false, startMs: 1 });
  const store = createCalendarFeedStore(feeds, parseCalendar);
  let responses = new Map([['personal', '개인 캐시 1'], ['holidays', '공휴일 캐시 1']]);
  const loadText = async feed => {
    const value = responses.get(feed.source);
    if (value instanceof Error) throw value;
    return value;
  };

  let snapshot = await store.reloadMonth(2026, 8, loadText);
  assert.equal(snapshot.sync, 'synced');
  assert.deepEqual(snapshot.eventsByDay.get('2026-09-03').map(event => event.title), ['개인 캐시 1', '공휴일 캐시 1']);

  responses = new Map([['personal', new Error('offline')], ['holidays', '공휴일 캐시 2']]);
  snapshot = await store.reloadMonth(2026, 8, loadText);
  assert.equal(snapshot.sync, 'partial-error');
  assert.deepEqual(snapshot.eventsByDay.get('2026-09-03').map(event => event.title), ['개인 캐시 1', '공휴일 캐시 2']);

  responses = new Map([['personal', new Error('offline')], ['holidays', new Error('offline')]]);
  snapshot = await store.reloadMonth(2026, 8, loadText);
  assert.equal(snapshot.sync, 'error');
  assert.deepEqual(snapshot.eventsByDay.get('2026-09-03').map(event => event.title), ['개인 캐시 1', '공휴일 캐시 2']);
});
