const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function weekTracks(week, contentHeight = 0, pointerY = null) {
  const focused = Number.isInteger(week) && week >= 0 && week < 6;
  if (!focused) return Array(6).fill('52px').join(' ');
  let height = 30 + (Number.isFinite(contentHeight) ? contentHeight : 0);
  if (Number.isFinite(pointerY) && pointerY >= 0 && pointerY <= 317) {
    const origin = week * (312 / 5 + 1);
    if (week > 0) height = Math.max(height, (origin - pointerY + 2) * 5 / week);
    if (week < 5) height = Math.max(height, (pointerY + 2 - origin) / (1 - week / 5));
  }
  height = Math.max(52, Math.min(108, Math.ceil(height)));
  return Array.from({ length: 6 }, (_, index) => `${index === week ? height : (312 - height) / 5}px`).join(' ');
}

export function formatEventTime(event, day) {
  if (event.allDay) return '종일';
  function label(ms) {
    const value = new Date(ms);
    const key = date.format(value);
    const prefix = key === day ? '' : `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))} `;
    return prefix + clock.format(value);
  }
  if (!Number.isFinite(event.startMs)) return '';
  return label(event.startMs) + (Number.isFinite(event.endMs) ? `–${label(event.endMs)}` : '');
}

export function createWeekFocusController(grid, {
  setTimer = setTimeout, clearTimer = clearTimeout,
  hoverAllowed = () => grid.ownerDocument.defaultView.matchMedia('(hover: hover) and (pointer: fine)').matches,
} = {}) {
  let active = null, entering = null, leaving = null, pendingWeek = null;
  let pointerY = null;
  const days = () => [...grid.querySelectorAll('.day')];
  function cancelEnter() { if (entering !== null) clearTimer(entering); entering = pendingWeek = null; }
  function cancelLeave() { if (leaving !== null) clearTimer(leaving); leaving = null; }
  function contentHeight(week) {
    return Math.max(0, ...days().filter(day => Number(day.dataset.week) === week).map(day =>
      [...(day.querySelector('.day-details')?.children || [])].reduce((height, item) => {
        const style = grid.ownerDocument.defaultView.getComputedStyle(item);
        return height + item.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      }, 0)));
  }
  function trackPointer(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (Number.isFinite(event.clientY)) pointerY = event.clientY - grid.getBoundingClientRect().top;
  }
  function refresh() {
    grid.style.gridTemplateRows = weekTracks(active, active === null ? 0 : contentHeight(active), grid.classList.contains('keyboard-focus') ? null : pointerY);
    grid.classList.toggle('is-week-expanded', active !== null);
    if (active === null) delete grid.dataset.activeWeek;
    else grid.dataset.activeWeek = String(active);
    for (const day of days()) {
      const selected = active !== null && Number(day.dataset.week) === active;
      day.classList.toggle('is-week-focused', selected);
      day.setAttribute('aria-expanded', String(selected));
      day.querySelector('.day-events')?.setAttribute('aria-hidden', String(active !== null));
      day.querySelector('.day-details')?.setAttribute('aria-hidden', String(!selected));
    }
  }
  function select(week, keyboard = false) {
    active = week;
    grid.classList.toggle('keyboard-focus', keyboard);
    refresh();
  }
  function reset() { cancelEnter(); cancelLeave(); pointerY = null; select(null); }
  grid.addEventListener('pointermove', trackPointer);
  grid.addEventListener('pointerover', event => {
    if ((event.pointerType && event.pointerType !== 'mouse') || !hoverAllowed()) return;
    trackPointer(event);
    const day = event.target.closest('.day');
    if (!day || !grid.contains(day)) return;
    const week = Number(day.dataset.week);
    cancelLeave();
    if (week === active) { cancelEnter(); return; }
    if (week === pendingWeek) return;
    cancelEnter(); pendingWeek = week;
    entering = setTimer(() => { entering = pendingWeek = null; select(week); }, 80);
  });
  grid.addEventListener('pointerleave', () => {
    cancelEnter(); cancelLeave(); pointerY = null;
    const focused = grid.ownerDocument.activeElement?.closest('.day');
    if (grid.classList.contains('keyboard-focus') && focused && grid.contains(focused)) {
      select(Number(focused.dataset.week), true); return;
    }
    leaving = setTimer(() => { leaving = null; select(null); }, 140);
  });
  grid.addEventListener('focusin', event => {
    const day = event.target.closest('.day');
    if (!day) return;
    for (const cell of days()) cell.tabIndex = cell === day ? 0 : -1;
    if (!event.target.matches(':focus-visible')) return;
    cancelEnter(); cancelLeave();
    select(Number(day.dataset.week), true);
  });
  grid.addEventListener('pointerdown', () => grid.classList.remove('keyboard-focus'));
  grid.addEventListener('focusout', event => {
    if (!grid.contains(event.relatedTarget)) { cancelEnter(); cancelLeave(); select(null, true); }
  });
  grid.addEventListener('keydown', event => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in steps)) return;
    const cells = days(), index = cells.indexOf(event.target.closest('.day'));
    if (index < 0) return;
    event.preventDefault();
    select(Number(cells[index].dataset.week), true);
    cells[Math.max(0, Math.min(41, index + steps[event.key]))]?.focus();
  });
  grid.ownerDocument.addEventListener('visibilitychange', () => { if (grid.ownerDocument.hidden) reset(); });
  refresh();
  return { reset, refresh };
}
