import test from 'node:test';
import assert from 'node:assert/strict';
import { weekTracks, formatEventTime, createWeekFocusController } from '../@Resources/calendar-week-focus.mjs';
import { eventsForMonth } from '../@Resources/calendar-events.mjs';

test('week expansion preserves the grid height and readable date rows', () => {
  assert.deepEqual(weekTracks(null).split(' ').map(parseFloat), [52,52,52,52,52,52]);
  for (let week=0;week<6;week++) {
    const tracks=weekTracks(week).split(' ').map(parseFloat);
    assert.equal(tracks[week], 172);
    assert.equal(tracks.reduce((sum,n)=>sum+n,0)+5,317);
    assert.ok(tracks.every(n=>n>=28));
  }
  for (const invalid of [-1,6,NaN,'2']) assert.equal(weekTracks(invalid),weekTracks(null));
});
test('details distinguish all-day, timed and overnight events in Seoul time', () => {
  assert.equal(formatEventTime({allDay:true},'2026-10-12'),'종일');
  assert.equal(formatEventTime({startMs:Date.parse('2026-10-12T09:00:00+09:00'),endMs:Date.parse('2026-10-12T10:30:00+09:00')},'2026-10-12'),'09:00–10:30');
  assert.equal(formatEventTime({startMs:Date.parse('2026-10-12T23:00:00+09:00'),endMs:Date.parse('2026-10-13T01:00:00+09:00')},'2026-10-12'),'23:00–10/13 01:00');
});
test('parsed occurrences retain their actual end time for details', () => {
  const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:time@example.test\r\nDTSTART:20261012T000000Z\r\nDTEND:20261012T013000Z\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const event=eventsForMonth(ics,2026,9).get('2026-10-12')[0];
  assert.equal(event.endMs-event.startMs,90*60*1000);
});

function controllerFixture() {
  const handlers = {}, documentHandlers = {}, timers = new Map();
  let now = 0, timerId = 0;
  const classes = () => {
    const values = new Set();
    return {
      toggle: (name, on) => on ? values.add(name) : values.delete(name),
      remove: name => values.delete(name),
      contains: name => values.has(name),
    };
  };
  const document = { activeElement: null, hidden: false, addEventListener: (name, fn) => { documentHandlers[name] = fn; } };
  const grid = {
    dataset: {}, style: {}, classList: classes(), ownerDocument: document,
    addEventListener: (name, fn) => { handlers[name] = fn; },
    querySelectorAll: () => days,
    contains: node => days.includes(node),
  };
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = {
      dataset: { week: String(Math.floor(index / 7)) }, classList: classes(), tabIndex: -1,
      keyboard: false, closest: () => day, matches: () => day.keyboard,
      setAttribute() {}, querySelector: () => ({ setAttribute() {} }),
      focus() { document.activeElement = day; handlers.focusin({ target: day }); },
    };
    return day;
  });
  createWeekFocusController(grid, {
    setTimer: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimer: id => timers.delete(id), hoverAllowed: () => true,
  });
  function advance(ms) {
    const until = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = until;
  }
  return { grid, days, document, advance, emit: (name, event = {}) => handlers[name](event), documentHandlers };
}

test('mouse focus does not pin a week after pointer exit', () => {
  const ui = controllerFixture(), day = ui.days[14];
  ui.emit('pointerover', { target: day, pointerType: 'mouse' }); ui.advance(80);
  ui.emit('pointerdown'); day.focus();
  ui.emit('pointerleave'); ui.advance(139);
  assert.equal(ui.grid.dataset.activeWeek, '2');
  ui.advance(1);
  assert.equal(ui.grid.dataset.activeWeek, undefined);
});

test('keyboard selection survives pointer exit and moves with arrow keys', () => {
  const ui = controllerFixture(), day = ui.days[14];
  day.keyboard = true; day.focus();
  ui.emit('pointerleave'); ui.advance(400);
  assert.equal(ui.grid.dataset.activeWeek, '2');
  ui.days[21].keyboard = true;
  ui.emit('keydown', { key: 'ArrowDown', target: day, preventDefault() {} });
  assert.equal(ui.grid.dataset.activeWeek, '3');
  assert.equal(ui.document.activeElement, ui.days[21]);
  ui.emit('focusout', { relatedTarget: null });
  assert.equal(ui.grid.dataset.activeWeek, undefined);
});

test('rapid hover retargeting cancels stale selection and hidden views reset', () => {
  const ui = controllerFixture();
  ui.emit('pointerover', { target: ui.days[0], pointerType: 'touch' }); ui.advance(100);
  assert.equal(ui.grid.dataset.activeWeek, undefined);
  ui.emit('pointerover', { target: ui.days[0], pointerType: 'mouse' }); ui.advance(40);
  ui.emit('pointerover', { target: ui.days[21], pointerType: 'mouse' }); ui.advance(79);
  assert.equal(ui.grid.dataset.activeWeek, undefined);
  ui.advance(1); assert.equal(ui.grid.dataset.activeWeek, '3');
  ui.document.hidden = true; ui.documentHandlers.visibilitychange(); ui.advance(400);
  assert.equal(ui.grid.dataset.activeWeek, undefined);
});
