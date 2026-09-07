export function shiftMonth(year, monthIndex, delta) {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function formatMonthLabel(year, monthIndex) {
  return `${year}년 ${monthIndex + 1}월`;
}

export function monthStateForDate(date) {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function isSameLocalDay(cell, date) {
  return cell.year === date.getFullYear()
    && cell.monthIndex === date.getMonth()
    && cell.day === date.getDate();
}

export function syncMonthStateToDate(state, followsToday, date) {
  if (!followsToday) return state;
  Object.assign(state, monthStateForDate(date));
  return state;
}

export function buildMonthMatrix(year, monthIndex) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const firstCell = new Date(year, monthIndex, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + offset);
    return {
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });
}
