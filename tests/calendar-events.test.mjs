import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventsForMonth } from '../@Resources/calendar-events.mjs';

const fixture = await readFile(new URL('./fixtures/sample.ics', import.meta.url), 'utf8');

test('groups timed and all-day events by Seoul date', () => {
  const grouped = eventsForMonth(fixture, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.get('2026-09-03')[0].title, '프로젝트 회의');
  assert.equal(grouped.get('2026-09-07')[0].allDay, true);
});

test('places a multi-day event on every covered day', () => {
  const grouped = eventsForMonth(fixture, 2026, 8, 'Asia/Seoul');
  for (const day of ['10', '11', '12']) {
    assert.ok(grouped.get(`2026-09-${day}`).some(event => event.title === '학술 행사'));
  }
});

test('expands weekly recurrence and honors EXDATE', () => {
  const grouped = eventsForMonth(fixture, 2026, 8, 'Asia/Seoul');
  assert.ok(grouped.get('2026-09-01').some(event => event.title === '주간 세미나'));
  assert.ok(grouped.get('2026-09-08').some(event => event.title === '주간 세미나'));
  assert.equal(grouped.get('2026-09-15')?.some(event => event.title === '주간 세미나') ?? false, false);
});

test('RDATE-only recurrence includes DTSTART in addition to RDATE', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:rdate-only@example.test\r
DTSTART;VALUE=DATE:20260901\r
DTEND;VALUE=DATE:20260902\r
RDATE;VALUE=DATE:20260905\r
SUMMARY:RDATE series\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.get('2026-09-01')?.filter(event => event.title === 'RDATE series').length, 1);
  assert.equal(grouped.get('2026-09-05')?.filter(event => event.title === 'RDATE series').length, 1);
});

test('RDATE-only recurrence does not duplicate a repeated DTSTART', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:rdate-repeats-start@example.test\r
DTSTART;VALUE=DATE:20260901\r
DTEND;VALUE=DATE:20260902\r
RDATE;VALUE=DATE:20260901,20260905\r
SUMMARY:RDATE repeated start\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.get('2026-09-01')?.filter(event => event.title === 'RDATE repeated start').length, 1);
});

test('RDATE-only recurrence still excludes DTSTART via EXDATE', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:rdate-excluded-start@example.test\r
DTSTART;VALUE=DATE:20260901\r
DTEND;VALUE=DATE:20260902\r
RDATE;VALUE=DATE:20260905\r
EXDATE;VALUE=DATE:20260901\r
SUMMARY:RDATE excluded start\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.get('2026-09-01')?.some(event => event.title === 'RDATE excluded start') ?? false, false);
  assert.equal(grouped.get('2026-09-05')?.filter(event => event.title === 'RDATE excluded start').length, 1);
});

test('recurrence expansion stops at the per-series occurrence budget', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:high-frequency@example.test\r
DTSTART;TZID=Asia/Seoul:20260901T000000\r
DTEND;TZID=Asia/Seoul:20260901T000001\r
RRULE:FREQ=SECONDLY;COUNT=10001\r
SUMMARY:High frequency\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  const emitted = [...grouped.values()].flat()
    .filter(event => event.title === 'High frequency');
  assert.equal(emitted.length, 10000);
});

test('uses recurrence exceptions and omits cancelled occurrences', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:exception-series@example.test\r
DTSTART;TZID=Asia/Seoul:20260901T090000\r
DTEND;TZID=Asia/Seoul:20260901T100000\r
RRULE:FREQ=WEEKLY;COUNT=3\r
SUMMARY:기본 세미나\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:exception-series@example.test\r
RECURRENCE-ID;TZID=Asia/Seoul:20260908T090000\r
DTSTART;TZID=Asia/Seoul:20260909T110000\r
DTEND;TZID=Asia/Seoul:20260909T120000\r
SUMMARY:변경 세미나\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:exception-series@example.test\r
RECURRENCE-ID;TZID=Asia/Seoul:20260915T090000\r
DTSTART;TZID=Asia/Seoul:20260915T090000\r
DTEND;TZID=Asia/Seoul:20260915T100000\r
STATUS:CANCELLED\r
SUMMARY:취소 세미나\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.get('2026-09-08')?.some(event => event.title === '기본 세미나') ?? false, false);
  assert.ok(grouped.get('2026-09-09').some(event => event.title === '변경 세미나'));
  assert.equal(grouped.get('2026-09-15')?.length ?? 0, 0);
});

test('limits recurrence output to seven days around the target month', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:daily-window@example.test\r
DTSTART;VALUE=DATE:20260824\r
DTEND;VALUE=DATE:20260825\r
RRULE:FREQ=DAILY;COUNT=46\r
SUMMARY:경계 일정\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.has('2026-08-24'), false);
  assert.equal(grouped.has('2026-08-25'), true);
  assert.equal(grouped.has('2026-10-07'), true);
  assert.equal(grouped.has('2026-10-08'), false);
});

test('treats timed event ends as exclusive at a local midnight', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:midnight-end@example.test\r
DTSTART:20260930T145900Z\r
DTEND:20260930T150000Z\r
SUMMARY:자정 전 일정\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:midnight-crossing@example.test\r
DTSTART:20260930T140000Z\r
DTEND:20260930T160000Z\r
SUMMARY:자정 통과 일정\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.ok(grouped.get('2026-09-30').some(event => event.title === '자정 전 일정'));
  assert.equal(grouped.get('2026-10-01').some(event => event.title === '자정 전 일정'), false);
  assert.ok(grouped.get('2026-09-30').some(event => event.title === '자정 통과 일정'));
  assert.ok(grouped.get('2026-10-01').some(event => event.title === '자정 통과 일정'));
});

test('sorts all-day events first, then start time, then title', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:late@example.test\r
DTSTART;TZID=Asia/Seoul:20260920T100000\r
DTEND;TZID=Asia/Seoul:20260920T110000\r
SUMMARY:늦은 일정\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:all-day-z@example.test\r
DTSTART;VALUE=DATE:20260920\r
DTEND;VALUE=DATE:20260921\r
SUMMARY:종일 나\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:early@example.test\r
DTSTART;TZID=Asia/Seoul:20260920T090000\r
DTEND;TZID=Asia/Seoul:20260920T093000\r
SUMMARY:이른 일정\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:all-day-a@example.test\r
DTSTART;VALUE=DATE:20260920\r
DTEND;VALUE=DATE:20260921\r
SUMMARY:종일 가\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.deepEqual(grouped.get('2026-09-20').map(event => event.title), [
    '종일 가',
    '종일 나',
    '이른 일정',
    '늦은 일정',
  ]);
});

test('keeps an untitled event from crashing the month', () => {
  const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:untitled@example.test\r
DTSTART;VALUE=DATE:20260925\r
DTEND;VALUE=DATE:20260926\r
END:VEVENT\r
END:VCALENDAR`;

  const grouped = eventsForMonth(calendar, 2026, 8, 'Asia/Seoul');
  assert.equal(grouped.get('2026-09-25')[0].title, '(제목 없음)');
});
