import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeSettingsController } from '../@Resources/calendar-theme-ui.mjs';
import { THEME_STORAGE_KEY } from '../@Resources/calendar-theme.mjs';

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.containedTargets = new Set();
    this.focusCount = 0;
    this.hidden = true;
    this.style = {
      properties: new Map(),
      setProperty: (name, value) => this.style.properties.set(name, value),
    };
    this.value = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  contains(target) {
    return target === this || this.containedTargets.has(target);
  }

  focus() {
    this.focusCount += 1;
  }
}

function event(type, properties = {}) {
  const dispatched = new Event(type);
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(dispatched, name, { value });
  }
  return dispatched;
}

function createStorage(savedTheme) {
  const writes = [];
  return {
    writes,
    getItem(key) {
      return key === THEME_STORAGE_KEY ? savedTheme : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
    },
  };
}

test('theme settings controller executes saved-theme, interaction, and reset behavior', () => {
  const root = new FakeElement();
  const settingsButton = new FakeElement();
  const settingsPanel = new FakeElement();
  const backgroundInput = new FakeElement();
  const foregroundInput = new FakeElement();
  const opacityInput = new FakeElement();
  const opacityOutput = new FakeElement();
  const resetButton = new FakeElement();
  const documentTarget = new FakeElement();
  const storage = createStorage(JSON.stringify({ background: '#123456', foreground: '#ABCDEF' }));

  createThemeSettingsController({
    root,
    storage,
    settingsButton,
    settingsPanel,
    backgroundInput,
    foregroundInput,
    opacityInput,
    opacityOutput,
    resetButton,
    documentTarget,
  });

  assert.deepEqual(Object.fromEntries(root.style.properties), {
    '--theme-background-rgb': '18 52 86',
    '--theme-foreground-rgb': '171 205 239',
    '--theme-background-opacity': '0.78',
    '--settings-surface-rgb': '3 18 36',
    '--theme-shadow': 'rgba(3, 18, 36, 0.86)',
    '--today-surface': 'rgb(6 59 82 / .88)',
    '--today-border': 'rgb(224 250 255 / .96)',
    '--today-glow': 'rgb(116 225 255 / .46)',
  });
  assert.equal(root.style.properties.get('--today-surface'), 'rgb(6 59 82 / .88)');
  assert.equal(root.style.properties.get('--today-border'), 'rgb(224 250 255 / .96)');
  assert.equal(root.style.properties.get('--today-glow'), 'rgb(116 225 255 / .46)');
  assert.equal(backgroundInput.value, '#123456');
  assert.equal(foregroundInput.value, '#ABCDEF');
  assert.equal(opacityInput.value, '78');
  assert.equal(opacityOutput.textContent, '78%');
  assert.equal(storage.writes.length, 0);

  settingsButton.dispatchEvent(event('click'));
  assert.equal(settingsPanel.hidden, false);
  assert.equal(settingsButton.getAttribute('aria-expanded'), 'true');
  assert.equal(backgroundInput.focusCount, 1);

  backgroundInput.value = '#654321';
  backgroundInput.dispatchEvent(event('input'));
  assert.deepEqual(storage.writes.at(-1), [THEME_STORAGE_KEY, JSON.stringify({ background: '#654321', foreground: '#ABCDEF', backgroundOpacity: 78 })]);

  foregroundInput.value = '#010203';
  foregroundInput.dispatchEvent(event('input'));
  assert.equal(root.style.properties.get('--theme-foreground-rgb'), '1 2 3');
  assert.equal(root.style.properties.get('--settings-surface-rgb'), '248 251 255');
  assert.deepEqual(storage.writes.at(-1), [THEME_STORAGE_KEY, JSON.stringify({ background: '#654321', foreground: '#010203', backgroundOpacity: 78 })]);

  opacityInput.value = '35';
  opacityInput.dispatchEvent(event('input'));
  assert.equal(opacityOutput.textContent, '35%');
  assert.equal(root.style.properties.get('--theme-background-opacity'), '0.35');
  assert.deepEqual(storage.writes.at(-1), [THEME_STORAGE_KEY, JSON.stringify({ background: '#654321', foreground: '#010203', backgroundOpacity: 35 })]);

  settingsPanel.containedTargets.add(documentTarget);
  documentTarget.dispatchEvent(event('click'));
  assert.equal(settingsPanel.hidden, false);
  settingsPanel.containedTargets.delete(documentTarget);
  documentTarget.dispatchEvent(event('click'));
  assert.equal(settingsPanel.hidden, true);

  settingsButton.dispatchEvent(event('click'));
  documentTarget.dispatchEvent(event('keydown', { key: 'Escape' }));
  assert.equal(settingsPanel.hidden, true);
  assert.equal(settingsButton.focusCount, 1);

  resetButton.dispatchEvent(event('click'));
  assert.equal(backgroundInput.value, '#FFFFFF');
  assert.equal(foregroundInput.value, '#FFFFFF');
  assert.equal(opacityInput.value, '78');
  assert.equal(opacityOutput.textContent, '78%');
  assert.equal(root.style.properties.get('--theme-background-rgb'), '255 255 255');
  assert.equal(root.style.properties.get('--theme-foreground-rgb'), '255 255 255');
  assert.equal(root.style.properties.get('--theme-background-opacity'), '0.78');
  assert.equal(root.style.properties.get('--settings-surface-rgb'), '3 18 36');
  assert.equal(root.style.properties.get('--theme-shadow'), 'rgba(3, 18, 36, 0.86)');
  assert.deepEqual(storage.writes.at(-1), [THEME_STORAGE_KEY, JSON.stringify({ background: '#FFFFFF', foreground: '#FFFFFF', backgroundOpacity: 78 })]);
});
