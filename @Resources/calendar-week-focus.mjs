const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function weekTracks(week) {
  const focused = Number.isInteger(week) && week >= 0 && week < 6;
  return Array.from({ length: 6 }, (_, index) => `${focused ? index === week ? 172 : 28 : 52}px`).join(' ');
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
  const days = () => [...grid.querySelectorAll('.day')];
  function cancelEnter() { if (entering !== null) clearTimer(entering); entering = pendingWeek = null; }
  function cancelLeave() { if (leaving !== null) clearTimer(leaving); leaving = null; }
  function refresh() {
    grid.style.gridTemplateRows = weekTracks(active);
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
  function reset() { cancelEnter(); cancelLeave(); select(null); }
  grid.addEventListener('pointerover', event => {
    if ((event.pointerType && event.pointerType !== 'mouse') || !hoverAllowed()) return;
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
    cancelEnter(); cancelLeave();
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
