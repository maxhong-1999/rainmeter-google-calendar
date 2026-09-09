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
  const elements = Object.fromEntries(['panel', 'palette', 'cursor', 'hue', 'preview', 'eyedropper', 'closeButton', 'status', 'heading'].map(key => [key, new Element()]));
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
    ReplaceVariables: async () => latest,
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
    ReplaceVariables: () => '5CD6FF',
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
      ReplaceVariables: () => value,
      Bang() {},
    } });
    picker.open('foreground');
    await picker.pickScreen();
    assert.equal(await picker.receiveScreenColor(), false, value);
    assert.deepEqual(changes, [], value);
  }
});

test('missing plugin is reported and leaves the selected color untouched', async () => {
  const { picker, status, changes } = setup({ RainmeterAPI: { Bang() { throw new Error('must not execute'); }, ReplaceVariables: async value => value } });
  picker.open('background');
  assert.equal(await picker.pickScreen(), false);
  assert.match(status.textContent, /YourPicker/);
  assert.deepEqual(changes, []);
});

test('WebView synchronous bridge works and stale results after closing are ignored', async () => {
  const { picker, changes } = setup({ chrome: { webview: { hostObjects: { sync: { RainmeterAPI: { Bang() {}, ReplaceVariables: () => '#010203' } } } } } });
  picker.open('background');
  assert.equal(await picker.pickScreen(), true);
  picker.close();
  picker.open('foreground');
  assert.equal(await picker.receiveScreenColor(), false);
  assert.deepEqual(changes, []);
});
