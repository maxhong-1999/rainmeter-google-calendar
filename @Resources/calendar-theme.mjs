export const THEME_STORAGE_KEY = 'rainmeter-google-calendar-theme-v1';

export const DEFAULT_THEME = Object.freeze({
  background: '#FFFFFF',
  foreground: '#FFFFFF',
  backgroundOpacity: 78,
});

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHexColor(value, fallback = '#FFFFFF') {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toUpperCase() : fallback;
}

export function normalizeOpacity(value, fallback = DEFAULT_THEME.backgroundOpacity) {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return fallback;
  const opacity = Number(value);
  return Number.isFinite(opacity) && opacity >= 0 && opacity <= 100 ? Math.round(opacity) : fallback;
}

export function hexToRgbChannels(hex) {
  const normalized = normalizeHexColor(hex);
  return [1, 3, 5].map(index => Number.parseInt(normalized.slice(index, index + 2), 16)).join(' ');
}

function isLightForeground(hex) {
  const [red, green, blue] = hexToRgbChannels(hex).split(' ').map(Number);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 150;
}

export function shadowForForeground(hex) {
  return isLightForeground(hex) ? 'rgba(3, 18, 36, 0.86)' : 'rgba(255, 255, 255, 0.72)';
}

export function settingsSurfaceForForeground(hex) {
  return isLightForeground(hex) ? '3 18 36' : '248 251 255';
}

export function loadTheme(storage) {
  try {
    const saved = storage?.getItem(THEME_STORAGE_KEY);
    if (typeof saved !== 'string') return { ...DEFAULT_THEME };
    const theme = JSON.parse(saved);
    return {
      background: normalizeHexColor(theme?.background, DEFAULT_THEME.background),
      foreground: normalizeHexColor(theme?.foreground, DEFAULT_THEME.foreground),
      backgroundOpacity: normalizeOpacity(theme?.backgroundOpacity),
    };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(storage, theme) {
  try {
    if (!storage?.setItem) return false;
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify({
      background: normalizeHexColor(theme?.background, DEFAULT_THEME.background),
      foreground: normalizeHexColor(theme?.foreground, DEFAULT_THEME.foreground),
      backgroundOpacity: normalizeOpacity(theme?.backgroundOpacity),
    }));
    return true;
  } catch {
    return false;
  }
}
