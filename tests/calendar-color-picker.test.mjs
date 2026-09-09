import test from 'node:test';
import assert from 'node:assert/strict';
import { createColorPicker, rgbToHex, hexToRgb } from '../@Resources/calendar-color-picker.mjs';

class Element extends EventTarget {
  value = '';
  hidden = true;
  textContent = '';
  style = { setProperty() {} };
  focus() {}
  removeAttribute() {}
  setAttribute() {}
}
function setup(api) {
  const changes = [];
  const elements = Object.fromEntries(['panel', 'palette', 'cursor', 'hue', 'preview', 'eyedropper', 'closeButton', 'status', 'heading', 'helpPanel', 'installButton', 'refreshButton', 'dismissButton'].map(key => [key, new Element()]));
  const channels = [new Element(), new Element(), new Element()];
  const swatches = { background: new Element(), foreground: new Element() };
  swatches.background.value = '#5CD6FF';
  swatches.foreground.value = '#FFFFFF';
  const picker = createColorPicker({ ...elements, channels, swatches, host: api, onColor: (...args) => changes.push(args) });
  return { picker, changes, channels, ...elements };
}

test('RGB conversion round-trips known colors and rejects invalid channels', () => {
  assert.equal(rgbToHex([92, 214, 255]), '#5CD6FF');
  assert.deepEqual(hexToRgb('#5cd6ff'), [92, 214, 255]);
  for (const input of [[-1, 0, 0], [256, 0, 0], ['', 0, 0], [1.1, 2, 3], [NaN, 2, 3]]) assert.equal(rgbToHex(input), null);
  assert.equal(hexToRgb('[MeasureYourPicker]'), null);
});

test('screen sampling reads the post-selection value into RGB and the active field', async () => {
  let latest = '#FFFFFF';
  const commands = [];
  const { picker, channels, changes } = setup({ RainmeterAPI: {
    ReplaceVariables: async value => value === '[MeasureYourPickerAvailable]' ? '1' : latest,
    Bang: async action => commands.push(action),
  } });
  picker.open('background');
  assert.deepEqual(channels.map(c => c.value), ['92', '214', '255']);
  await picker.pickScreen();
  latest = '#123456';
  assert.equal(await picker.receiveScreenColor(), true);
  assert.deepEqual(channels.map(c => c.value), ['18', '52', '86']);
  assert.deepEqual(changes, [['background', '#123456']]);
  assert.deepEqual(commands, ['[!CommandMeasure MeasureYourPicker "-mp"]']);
  picker.open('foreground');
  await picker.pickScreen();
  latest = '#aabbcc';
  await picker.receiveScreenColor();
  assert.deepEqual(changes.at(-1), ['foreground', '#AABBCC']);
});

test('RGB edits apply a valid value without applying incomplete input', () => {
  const { picker, channels, changes } = setup({});
  picker.open('foreground');
  channels[0].value = '92';
  channels[1].value = '214';
  channels[2].dispatchEvent(new Event('input'));
  assert.deepEqual(changes, [['foreground', '#5CD6FF']]);
  channels[0].value = '';
  channels[0].dispatchEvent(new Event('input'));
  assert.equal(changes.length, 1);
});

test('YourPicker bare HEX output fills RGB and applies the selected color', async () => {
  const { picker, channels, changes } = setup({ RainmeterAPI: {
    ReplaceVariables: value => value === '[MeasureYourPickerAvailable]' ? '1' : '5CD6FF',
    Bang() {},
  } });
  picker.open('background');
  await picker.pickScreen();
  assert.equal(await picker.receiveScreenColor(), true);
  assert.deepEqual(channels.map(c => c.value), ['92', '214', '255']);
  assert.deepEqual(changes, [['background', '#5CD6FF']]);
});

test('malformed native picker output does not change the theme', async () => {
  for (const value of ['', '0', 'not-a-color', '12345678', '##123456']) {
    const { picker, changes } = setup({ RainmeterAPI: {
      ReplaceVariables: expression => expression === '[MeasureYourPickerAvailable]' ? '1' : value,
      Bang() {},
    } });
    picker.open('foreground');
    await picker.pickScreen();
    assert.equal(await picker.receiveScreenColor(), false, value);
    assert.deepEqual(changes, [], value);
  }
});

test('presence flag 0 shows installation help and sends no pick command', async () => {
  const commands = [];
  const { picker, helpPanel, changes } = setup({ RainmeterAPI: {
    Bang: action => commands.push(action),
    ReplaceVariables: () => '0',
  } });
  picker.open('background');
  assert.equal(await picker.pickScreen(), false);
  assert.equal(helpPanel.hidden, false);
  assert.deepEqual(commands, []);
  assert.deepEqual(changes, []);
});

test('presence flag 1 starts picking even when the last color is empty', async () => {
  const commands = [];
  const { picker, helpPanel } = setup({ RainmeterAPI: {
    Bang: action => commands.push(action),
    ReplaceVariables: expression => expression === '[MeasureYourPickerAvailable]' ? '1' : '',
  } });
  picker.open('background');
  assert.equal(await picker.pickScreen(), true);
  assert.equal(helpPanel.hidden, true);
  assert.deepEqual(commands, ['[!CommandMeasure MeasureYourPicker "-mp"]']);
});

test('help actions send only the fixed release URL and skin refresh commands', async () => {
  const commands = [];
  const { picker, installButton, refreshButton } = setup({ RainmeterAPI: { Bang: action => commands.push(action) } });
  assert.equal(await picker.openInstallPage(), true);
  assert.equal(await picker.refreshCalendar(), true);
  installButton.dispatchEvent(new Event('click'));
  refreshButton.dispatchEvent(new Event('click'));
  await Promise.resolve();
  assert.deepEqual(commands, [
    '["https://github.com/NSTechBytes/YourPicker/releases"]',
    '[!Refresh]',
    '["https://github.com/NSTechBytes/YourPicker/releases"]',
    '[!Refresh]',
  ]);
});

test('closing, dismissing, or switching fields clears help and stale presence results', async () => {
  let resolvePresence;
  const { picker, helpPanel, dismissButton } = setup({ RainmeterAPI: {
    Bang() {},
    ReplaceVariables: () => new Promise(resolve => { resolvePresence = resolve; }),
  } });
  picker.open('background');
  const pending = picker.pickScreen();
  picker.open('foreground');
  resolvePresence('0');
  assert.equal(await pending, false);
  assert.equal(helpPanel.hidden, true);
  helpPanel.hidden = false;
  dismissButton.dispatchEvent(new Event('click'));
  assert.equal(helpPanel.hidden, true);
  helpPanel.hidden = false;
  picker.close();
  assert.equal(helpPanel.hidden, true);
});

test('bridge errors show guidance without changing the selected theme', async () => {
  const { picker, helpPanel, channels, changes } = setup({ RainmeterAPI: {
    ReplaceVariables() { throw new Error('bridge failed'); },
    Bang() { throw new Error('must not execute'); },
  } });
  picker.open('foreground');
  const before = channels.map(channel => channel.value);
  assert.equal(await picker.pickScreen(), false);
  assert.equal(helpPanel.hidden, false);
  assert.deepEqual(channels.map(channel => channel.value), before);
  assert.deepEqual(changes, []);
});

test('WebView synchronous bridge works and stale results after closing are ignored', async () => {
  const { picker, changes } = setup({ chrome: { webview: { hostObjects: { sync: { RainmeterAPI: { Bang() {}, ReplaceVariables: expression => expression === '[MeasureYourPickerAvailable]' ? '1' : '#010203' } } } } } });
  picker.open('background');
  assert.equal(await picker.pickScreen(), true);
  picker.close();
  picker.open('foreground');
  assert.equal(await picker.receiveScreenColor(), false);
  assert.deepEqual(changes, []);
});
