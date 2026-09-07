export const OPEN_GOOGLE_CALENDAR_ACTION = '[!CommandMeasure MeasureOpenGoogleCalendar "Run"]';

export function openGoogleCalendar(host = window) {
  try {
    const api = host.RainmeterAPI
      || host.chrome?.webview?.hostObjects?.sync?.RainmeterAPI;
    if (!api || typeof api.Bang !== 'function') return false;

    api.Bang(OPEN_GOOGLE_CALENDAR_ACTION);
    return true;
  } catch {
    return false;
  }
}

export function shouldOpenGoogleCalendar(target) {
  return !target?.closest?.('button, a');
}
