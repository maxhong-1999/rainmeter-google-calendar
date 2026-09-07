import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthMatrix,
  formatMonthLabel,
  isSameLocalDay,
  monthStateForDate,
  shiftMonth,
  syncMonthStateToDate,
} from '../@Resources/calendar-model.mjs';

test('September 2026 is a fixed Sunday-first 6x7 matrix', () => {
  const cells = buildMonthMatrix(2026, 8);
  assert.equal(cells.length, 42);
  assert.deepEqual(cells[0], { year: 2026, monthIndex: 7, day: 30, inMonth: false });
  assert.deepEqual(cells[2], { year: 2026, monthIndex: 8, day: 1, inMonth: true });
  assert.deepEqual(cells[31], { year: 2026, monthIndex: 8, day: 30, inMonth: true });
});

test('local day comparison advances from September 3 to September 4', () => {
  const september3 = { year: 2026, monthIndex: 8, day: 3 };
  const september4 = { year: 2026, monthIndex: 8, day: 4 };
  const now = new Date(2026, 8, 4, 0, 0, 1);

  assert.equal(isSameLocalDay(september3, now), false);
  assert.equal(isSameLocalDay(september4, now), true);
});

test('date-to-month state crosses the month boundary', () => {
  assert.deepEqual(monthStateForDate(new Date(2026, 9, 1, 0, 0, 1)), {
    year: 2026,
    monthIndex: 9,
  });
});

test('followed month state rolls over, pauses after navigation, and resumes after Today', () => {
  const state = { year: 2026, monthIndex: 8 };

  syncMonthStateToDate(state, true, new Date(2026, 8, 30, 12));
  syncMonthStateToDate(state, true, new Date(2026, 9, 1, 0, 0, 1));
  assert.deepEqual(state, { year: 2026, monthIndex: 9 });

  Object.assign(state, shiftMonth(state.year, state.monthIndex, 1));
  syncMonthStateToDate(state, false, new Date(2026, 9, 2, 12));
  assert.deepEqual(state, { year: 2026, monthIndex: 10 });

  syncMonthStateToDate(state, true, new Date(2026, 9, 2, 12));
  assert.deepEqual(state, { year: 2026, monthIndex: 9 });

  syncMonthStateToDate(state, true, new Date(2026, 10, 1, 0, 0, 1));
  assert.deepEqual(state, { year: 2026, monthIndex: 10 });
});

test('month navigation crosses year boundaries', () => {
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, monthIndex: 0 });
});

test('month label is Korean', () => {
  assert.equal(formatMonthLabel(2026, 8), '2026년 9월');
});
