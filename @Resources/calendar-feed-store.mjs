function compareEvents(left, right) {
  if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
  if (left.startMs !== right.startMs) return left.startMs - right.startMs;
  return left.title < right.title ? -1 : left.title > right.title ? 1 : 0;
}

export function mergeMonthMaps(sourceMaps) {
  const merged = new Map();
  for (const [source, monthMap] of sourceMaps) {
    for (const [date, events] of monthMap) {
      const target = merged.get(date) || [];
      target.push(...events.map(event => ({ ...event, source })));
      merged.set(date, target);
    }
  }
  for (const events of merged.values()) events.sort(compareEvents);
  return merged;
}

export function visibleEventsForDay(eventsByDay, date, limit = 2) {
  return (eventsByDay.get(date) || []).slice(0, limit);
}

export function createCalendarFeedStore(feeds, parseCalendar) {
  const lastSuccessfulTexts = new Map();
  const readFailures = new Set();
  const transportFailures = new Set();

  function currentFailures() {
    return new Set([...readFailures, ...transportFailures]);
  }

  function snapshot(year, monthIndex, zone = 'Asia/Seoul') {
    const sourceMaps = [];
    for (const feed of feeds) {
      const text = lastSuccessfulTexts.get(feed.source);
      if (!text) continue;
      try {
        sourceMaps.push([feed.source, parseCalendar(text, year, monthIndex, zone)]);
      } catch {
        readFailures.add(feed.source);
      }
    }

    const failedSources = [...currentFailures()];
    const sync = failedSources.length === 0
      ? 'synced'
      : failedSources.length === feeds.length ? 'error' : 'partial-error';
    return {
      eventsByDay: mergeMonthMaps(sourceMaps),
      sync,
      failedSources,
      cachedSources: feeds.filter(feed => lastSuccessfulTexts.has(feed.source)).map(feed => feed.source),
    };
  }

  async function reloadMonth(year, monthIndex, loadText, zone = 'Asia/Seoul') {
    await Promise.all(feeds.map(async feed => {
      try {
        const text = await loadText(feed);
        parseCalendar(text, year, monthIndex, zone);
        lastSuccessfulTexts.set(feed.source, text);
        readFailures.delete(feed.source);
      } catch {
        readFailures.add(feed.source);
      }
    }));
    return snapshot(year, monthIndex, zone);
  }

  function markFeedError(source) {
    transportFailures.add(source);
  }

  function markFeedSuccess(source) {
    transportFailures.delete(source);
  }

  return { reloadMonth, snapshot, markFeedError, markFeedSuccess };
}
