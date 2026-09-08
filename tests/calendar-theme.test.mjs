import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  hexToRgbChannels,
  loadTheme,
  normalizeHexColor,
  normalizeOpacity,
  saveTheme,
  settingsSurfaceForForeground,
  shadowForForeground,
  todayMarkerForForeground,
} from '../@Resources/calendar-theme.mjs';

test('defines the complete immutable default theme', () => {
  assert.deepEqual(DEFAULT_THEME, {
    background: '#FFFFFF',
    foreground: '#FFFFFF',
    backgroundOpacity: 78,
  });
  assert.equal(Object.isFrozen(DEFAULT_THEME), true);
});

test('normalizes strict six-digit hex colors and uses the supplied fallback', () => {
  assert.equal(normalizeHexColor('#1a2B3c'), '#1A2B3C');
  assert.equal(normalizeHexColor('white', '#123456'), '#123456');
});

test('converts a hex color to space-separated decimal RGB channels', () => {
  assert.equal(hexToRgbChannels('#1A2B3C'), '26 43 60');
});

test('normalizes valid opacity bounds, numeric strings, and fractional values', () => {
  assert.equal(normalizeOpacity(0), 0);
  assert.equal(normalizeOpacity(100), 100);
  assert.equal(normalizeOpacity('78'), 78);
  assert.equal(normalizeOpacity(78.5), 79);
});

test('falls back for malformed opacity values', () => {
  const fallback = 34;
  for (const value of [undefined, '', '  ', 'invalid', Infinity, -1, 101]) {
    assert.equal(normalizeOpacity(value, fallback), fallback);
  }
});

test('chooses a contrasting shadow from foreground luminance', () => {
  assert.equal(shadowForForeground('#FFFFFF'), 'rgba(3, 18, 36, 0.86)');
  assert.equal(shadowForForeground('#111111'), 'rgba(255, 255, 255, 0.72)');
});

test('chooses a fixed contrasting settings surface from foreground luminance', () => {
  assert.equal(settingsSurfaceForForeground('#FFFFFF'), '3 18 36');
  assert.equal(settingsSurfaceForForeground('#111111'), '248 251 255');
});

test('chooses a complete opposing today marker for light and dark foregrounds', () => {
  assert.deepEqual(todayMarkerForForeground('#FFFFFF'), {
    surface: 'rgb(6 59 82 / .88)', border: 'rgb(224 250 255 / .96)', glow: 'rgb(116 225 255 / .46)',
  });
  assert.deepEqual(todayMarkerForForeground('#111111'), {
    surface: 'rgb(182 246 255 / .88)', border: 'rgb(5 60 79 / .92)', glow: 'rgb(5 60 79 / .28)',
  });
});

test('loads legacy saved colors and migrates missing opacity to the default', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, THEME_STORAGE_KEY);
      return '{"background":"#123456","foreground":"#ABCDEF"}';
    },
  };

  assert.deepEqual(loadTheme(storage), { background: '#123456', foreground: '#ABCDEF', backgroundOpacity: 78 });
});

test('falls back independently for each malformed saved color', () => {
  const storage = {
    getItem() {
      return '{"background":"invalid","foreground":"#abcdef"}';
    },
  };

  assert.deepEqual(loadTheme(storage), {
    background: DEFAULT_THEME.background,
    foreground: '#ABCDEF',
    backgroundOpacity: DEFAULT_THEME.backgroundOpacity,
  });

  const foregroundStorage = {
    getItem() {
      return '{"background":"#123456","foreground":"invalid"}';
    },
  };

  assert.deepEqual(loadTheme(foregroundStorage), {
    background: '#123456',
    foreground: DEFAULT_THEME.foreground,
    backgroundOpacity: DEFAULT_THEME.backgroundOpacity,
  });
});

test('falls back independently for malformed saved opacity', () => {
  const storage = {
    getItem() {
      return '{"background":"#123456","foreground":"#ABCDEF","backgroundOpacity":"invalid"}';
    },
  };

  assert.deepEqual(loadTheme(storage), {
    background: '#123456',
    foreground: '#ABCDEF',
    backgroundOpacity: DEFAULT_THEME.backgroundOpacity,
  });
});

test('storage failures and malformed JSON fail safely', () => {
  assert.deepEqual(loadTheme(), DEFAULT_THEME);
  assert.deepEqual(loadTheme({ getItem: () => '{invalid' }), DEFAULT_THEME);
  assert.deepEqual(loadTheme({ getItem: () => { throw new Error('unavailable'); } }), DEFAULT_THEME);
  assert.equal(saveTheme({ setItem: () => { throw new Error('unavailable'); } }, DEFAULT_THEME), false);
});

test('saves normalized colors and opacity as exactly the theme fields under the versioned key', () => {
  let savedKey;
  let savedValue;
  const storage = {
    setItem(key, value) {
      savedKey = key;
      savedValue = value;
    },
  };

  assert.equal(saveTheme(storage, { background: '#abcdef', foreground: '#123456', backgroundOpacity: '78.4' }), true);
  assert.equal(savedKey, THEME_STORAGE_KEY);
  assert.deepEqual(JSON.parse(savedValue), { background: '#ABCDEF', foreground: '#123456', backgroundOpacity: 78 });
});
