import ICAL from 'ical.js';

const UNTITLED = '(제목 없음)';
const MAX_RECURRENCE_OCCURRENCES = 10000;
const dateTimeFormatters = new Map();
const dateKeyFormatters = new Map();

function utcDateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKeyFromUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function dateKeyFromTime(time) {
  return [
    time.year,
    String(time.month).padStart(2, '0'),
    String(time.day).padStart(2, '0'),
  ].join('-');
}

function shiftDateKey(key, days) {
  const date = utcDateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromUtcDate(date);
}

function dateTimeParts(epochMs, zone) {
  let formatter = dateTimeFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    dateTimeFormatters.set(zone, formatter);
  }
  const values = Object.create(null);
  for (const part of formatter.formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return values;
}

function wallTimeToEpoch(time, zone) {
  const wallClockAsUtc = Date.UTC(
    time.year,
    time.month - 1,
    time.day,
    time.hour || 0,
    time.minute || 0,
    time.second || 0,
  );
  let candidate = wallClockAsUtc;

  // Re-evaluating the offset handles zones whose offset differs at the guessed instant.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = dateTimeParts(candidate, zone);
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    );
    const next = wallClockAsUtc - (shownAsUtc - candidate);
    if (next === candidate) break;
    candidate = next;
  }

  return candidate;
}

function propertyZone(item, propertyName, time, fallbackZone) {
  const property = item?.component?.getFirstProperty(propertyName);
  const parameterZone = property?.getParameter('tzid');
  if (parameterZone) return parameterZone;
  if (time?.zone?.tzid && time.zone.tzid !== 'floating') return time.zone.tzid;
  return fallbackZone;
}

function timeToEpoch(time, item, propertyName, fallbackZone) {
  const sourceZone = propertyZone(item, propertyName, time, fallbackZone);
  try {
    return wallTimeToEpoch(time, sourceZone);
  } catch (error) {
    // A VTIMEZONE may use a non-IANA identifier which Intl cannot resolve.
    if (time?.zone?.tzid && time.zone.tzid !== 'floating') {
      return time.toUnixTime() * 1000;
    }
    throw error;
  }
}

function keyForEpoch(epochMs, zone) {
  let formatter = dateKeyFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateKeyFormatters.set(zone, formatter);
  }
  const values = Object.create(null);
  for (const part of formatter.formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function isCancelled(item) {
  return String(item?.component?.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED';
}

function titleFor(item) {
  const title = item?.summary;
  return title == null || String(title).trim() === '' ? UNTITLED : String(title);
}

function addToDay(grouped, key, event) {
  const dayEvents = grouped.get(key);
  if (dayEvents) dayEvents.push(event);
  else grouped.set(key, [event]);
}

function addOccurrence(grouped, details, window, zone) {
  const { startDate, endDate, item } = details;
  if (!startDate || !endDate || isCancelled(item)) return;

  const allDay = Boolean(startDate.isDate);
  const title = titleFor(item);

  if (allDay) {
    const startKey = dateKeyFromTime(startDate);
    let endKey = dateKeyFromTime(endDate);
    if (endKey <= startKey) endKey = shiftDateKey(startKey, 1);
    const startMs = wallTimeToEpoch(startDate, zone);
    const firstKey = startKey < window.startKey ? window.startKey : startKey;
    const lastExclusiveKey = endKey > window.endKey ? window.endKey : endKey;

    for (let key = firstKey; key < lastExclusiveKey; key = shiftDateKey(key, 1)) {
      addToDay(grouped, key, { title, allDay, startMs });
    }
    return;
  }

  const startMs = timeToEpoch(startDate, item, 'dtstart', zone);
  let endMs = timeToEpoch(endDate, item, 'dtend', propertyZone(item, 'dtstart', startDate, zone));
  if (endMs <= startMs) endMs = startMs + 1;
  if (endMs <= window.startMs || startMs >= window.endMs) return;

  const eventFirstKey = keyForEpoch(startMs, zone);
  const eventLastKey = keyForEpoch(endMs - 1, zone);
  const windowLastKey = shiftDateKey(window.endKey, -1);
  const firstKey = eventFirstKey < window.startKey ? window.startKey : eventFirstKey;
  const lastKey = eventLastKey > windowLastKey ? windowLastKey : eventLastKey;
  for (let key = firstKey; key <= lastKey; key = shiftDateKey(key, 1)) {
    addToDay(grouped, key, { title, allDay, startMs });
  }
}

function exceptionForOccurrence(event, occurrence) {
  const direct = event.exceptions[occurrence.toString()];
  if (direct) return direct;
  const utcKey = occurrence.convertToZone(ICAL.Timezone.utcTimezone).toString();
  return event.exceptions[utcKey];
}

function expansionStopMs(occurrence, event, zone) {
  return timeToEpoch(occurrence, event, 'dtstart', zone);
}

function recurrenceKey(occurrence) {
  return `${occurrence.isDate ? 'D' : 'T'}:${occurrence.toString()}`;
}

function isExcludedOccurrence(component, occurrence) {
  for (const property of component.getAllProperties('exdate')) {
    for (const excluded of property.getValues()) {
      if (!occurrence.isDate && excluded.isDate) {
        if (dateKeyFromTime(occurrence) === dateKeyFromTime(excluded)) return true;
      } else if (occurrence.compare(excluded) === 0) {
        return true;
      }
    }
  }
  return false;
}

function makeWindow(year, monthIndex, zone) {
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  startDate.setUTCDate(startDate.getUTCDate() - 7);
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  endDate.setUTCDate(endDate.getUTCDate() + 7);

  const startKey = dateKeyFromUtcDate(startDate);
  const endKey = dateKeyFromUtcDate(endDate);
  const startTime = {
    year: startDate.getUTCFullYear(),
    month: startDate.getUTCMonth() + 1,
    day: startDate.getUTCDate(),
  };
  const endTime = {
    year: endDate.getUTCFullYear(),
    month: endDate.getUTCMonth() + 1,
    day: endDate.getUTCDate(),
  };

  return {
    startKey,
    endKey,
    startMs: wallTimeToEpoch(startTime, zone),
    endMs: wallTimeToEpoch(endTime, zone),
  };
}

function eventSort(left, right) {
  if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
  if (left.startMs !== right.startMs) return left.startMs - right.startMs;
  return left.title < right.title ? -1 : left.title > right.title ? 1 : 0;
}

export function eventsForMonth(icsText, year, monthIndex, zone = 'Asia/Seoul') {
  const grouped = new Map();
  const window = makeWindow(year, monthIndex, zone);
  const calendar = new ICAL.Component(ICAL.parse(icsText));
  const components = calendar.getAllSubcomponents('vevent');
  const exceptionsByUid = new Map();

  for (const component of components) {
    if (!component.hasProperty('recurrence-id')) continue;
    const uid = component.getFirstPropertyValue('uid');
    if (uid == null) continue;
    const exceptions = exceptionsByUid.get(uid);
    if (exceptions) exceptions.push(component);
    else exceptionsByUid.set(uid, [component]);
  }

  for (const component of components) {
    if (component.hasProperty('recurrence-id')) continue;

    try {
      const uid = component.getFirstPropertyValue('uid');
      const event = new ICAL.Event(component, {
        exceptions: uid == null ? [] : (exceptionsByUid.get(uid) || []),
        strictExceptions: true,
      });
      if (!event.startDate || isCancelled(event)) continue;

      if (!event.isRecurring()) {
        addOccurrence(grouped, {
          startDate: event.startDate,
          endDate: event.endDate,
          item: event,
        }, window, zone);
        continue;
      }

      const emittedExceptions = new Set();
      const emittedOccurrences = new Set();
      let examinedOccurrences = 0;
      const emitOccurrence = (occurrence) => {
        const key = recurrenceKey(occurrence);
        if (emittedOccurrences.has(key)) return;
        emittedOccurrences.add(key);
        if (isExcludedOccurrence(component, occurrence)) return;

        const exception = exceptionForOccurrence(event, occurrence);
        if (exception) emittedExceptions.add(exception.recurrenceId.toString());
        if (isCancelled(exception)) return;
        addOccurrence(grouped, event.getOccurrenceDetails(occurrence), window, zone);
      };

      // ical.js omits DTSTART from an RDATE-only iterator, although DTSTART is
      // part of the recurrence set. RRULE iterators already include it.
      if (!component.hasProperty('rrule') && examinedOccurrences < MAX_RECURRENCE_OCCURRENCES) {
        examinedOccurrences += 1;
        if (expansionStopMs(event.startDate, event, zone) < window.endMs) {
          emitOccurrence(event.startDate);
        }
      }

      const iterator = event.iterator();
      let occurrence;
      while (examinedOccurrences < MAX_RECURRENCE_OCCURRENCES && (occurrence = iterator.next())) {
        examinedOccurrences += 1;
        if (expansionStopMs(occurrence, event, zone) >= window.endMs) break;
        emitOccurrence(occurrence);
      }

      // A moved exception can start inside the window even when its recurrence-id lies outside it.
      for (const exception of Object.values(event.exceptions)) {
        if (emittedExceptions.has(exception.recurrenceId.toString()) || isCancelled(exception)) continue;
        if (!exception.startDate) continue;
        addOccurrence(grouped, {
          startDate: exception.startDate,
          endDate: exception.endDate,
          item: exception,
        }, window, zone);
      }
    } catch {
      // A malformed optional field in one VEVENT must not hide the rest of the month.
    }
  }

  for (const events of grouped.values()) events.sort(eventSort);
  return grouped;
}
