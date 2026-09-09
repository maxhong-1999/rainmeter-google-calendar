const PICK_ACTION = '[!CommandMeasure MeasureYourPicker "-mp"]';
const PICK_VALUE = '[MeasureYourPicker]';
const PICK_AVAILABLE = '[MeasureYourPickerAvailable]';
const INSTALL_ACTION = '["https://github.com/NSTechBytes/YourPicker/releases"]';
const REFRESH_ACTION = '[!Refresh]';

export function rgbToHex(values) {
  if (values.length !== 3 || values.some(v => String(v).trim() === '' || !Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 255)) return null;
  return `#${values.map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function hexToRgb(hex) {
  if (typeof hex !== 'string' || !/^#[\da-f]{6}$/i.test(hex)) return null;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function rgbToHsv(rgb, previousHue) {
  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = previousHue;
  if (delta) {
    h = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max ? delta / max : 0, max];
}

function hsvToHex(h, s, v) {
  const f = n => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return rgbToHex([f(5), f(3), f(1)]);
}

function rainmeterApi(host) {
  return host.RainmeterAPI || host.chrome?.webview?.hostObjects?.sync?.RainmeterAPI;
}

export function createColorPicker({ host, panel, palette, cursor, hue, preview, channels, eyedropper, closeButton, status, heading, helpPanel, installButton, refreshButton, dismissButton, swatches, onColor }) {
  let target = null;
  let samplingTarget = null;
  let generation = 0;
  let hsv = [0, 0, 1];
  let dragging = false;

  function hideHelp() {
    helpPanel.hidden = true;
  }

  function showHelp() {
    samplingTarget = null;
    status.textContent = '';
    helpPanel.hidden = false;
    installButton.focus();
  }

  function display(hex, preserveHsv = false) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    if (!preserveHsv) hsv = rgbToHsv(rgb, hsv[0]);
    channels.forEach((input, i) => { input.value = String(rgb[i]); input.removeAttribute('aria-invalid'); });
    preview.style.backgroundColor = hex;
    palette.style.setProperty('--picker-hue', String(hsv[0]));
    cursor.style.left = `${hsv[1] * 100}%`;
    cursor.style.top = `${(1 - hsv[2]) * 100}%`;
    hue.value = String(hsv[0]);
    return true;
  }

  function commit(hex, preserveHsv = false) {
    if (!target || !display(hex, preserveHsv)) return false;
    onColor(target, hex.toUpperCase());
    return true;
  }

  function open(nextTarget) {
    if (!Object.hasOwn(swatches, nextTarget)) return;
    generation += 1;
    samplingTarget = null;
    hideHelp();
    target = nextTarget;
    display(swatches[target].value);
    heading.textContent = target === 'background' ? '배경색' : '글자색';
    status.textContent = '';
    panel.hidden = false;
    eyedropper.focus();
  }

  function close() {
    generation += 1;
    samplingTarget = null;
    hideHelp();
    panel.hidden = true;
    swatches[target]?.focus();
    target = null;
  }

  async function pickScreen() {
    const requestGeneration = generation;
    if (!target) return false;
    try {
      const api = rainmeterApi(host);
      if (typeof api?.Bang !== 'function' || typeof api?.ReplaceVariables !== 'function') throw new Error('bridge missing');
      const available = String(await api.ReplaceVariables(PICK_AVAILABLE)).trim();
      if (requestGeneration !== generation) return false;
      if (available !== '1') {
        showHelp();
        return false;
      }
      samplingTarget = target;
      status.textContent = '화면에서 색을 클릭하세요 · Esc 취소';
      await api.Bang(PICK_ACTION);
      return true;
    } catch {
      if (requestGeneration === generation) {
        showHelp();
      }
      return false;
    }
  }

  async function sendHelpAction(action) {
    try {
      const api = rainmeterApi(host);
      if (typeof api?.Bang !== 'function') throw new Error('bridge missing');
      await api.Bang(action);
      return true;
    } catch {
      status.textContent = 'Rainmeter 명령을 실행하지 못했습니다.';
      return false;
    }
  }

  function openInstallPage() {
    return sendHelpAction(INSTALL_ACTION);
  }

  function refreshCalendar() {
    return sendHelpAction(REFRESH_ACTION);
  }

  async function receiveScreenColor() {
    const requestGeneration = generation;
    const selectedTarget = samplingTarget;
    if (!selectedTarget) return false;
    try {
      // Read after the plugin updates its measure; embedding its value in
      // OnFinishAction would freeze it when YourPicker reads the INI.
      const value = String(await rainmeterApi(host).ReplaceVariables(PICK_VALUE)).trim();
      // YourPicker ColorToHex returns RRGGBB without CSS's leading '#'.
      const hex = /^#?[\da-f]{6}$/i.test(value) ? `#${value.replace(/^#/, '')}` : null;
      if (requestGeneration !== generation || selectedTarget !== target) return false;
      samplingTarget = null;
      if (!commit(hex)) {
        status.textContent = '선택한 색을 읽지 못했습니다. 다시 선택하세요.';
        return false;
      }
      status.textContent = '선택한 색을 RGB에 반영했습니다.';
      return true;
    } catch {
      if (requestGeneration === generation) status.textContent = '선택한 색을 읽지 못했습니다. 다시 선택하세요.';
      return false;
    }
  }

  for (const input of channels) {
    input.addEventListener('input', () => {
      const hex = rgbToHex(channels.map(c => c.value));
      if (!hex) { input.setAttribute('aria-invalid', 'true'); return; }
      status.textContent = '';
      commit(hex);
    });
  }
  hue.addEventListener('input', () => {
    hsv[0] = Number(hue.value);
    commit(hsvToHex(...hsv), true);
  });
  function movePalette(event) {
    const bounds = palette.getBoundingClientRect();
    hsv[1] = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    hsv[2] = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    commit(hsvToHex(...hsv), true);
  }
  palette.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragging = true;
    palette.setPointerCapture(event.pointerId);
    movePalette(event);
  });
  palette.addEventListener('pointermove', event => { if (dragging) movePalette(event); });
  palette.addEventListener('pointerup', () => { dragging = false; });
  palette.addEventListener('pointercancel', () => { dragging = false; });
  palette.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? .1 : .01;
    if (event.key === 'ArrowLeft') hsv[1] -= step;
    if (event.key === 'ArrowRight') hsv[1] += step;
    if (event.key === 'ArrowUp') hsv[2] += step;
    if (event.key === 'ArrowDown') hsv[2] -= step;
    hsv[1] = Math.max(0, Math.min(1, hsv[1]));
    hsv[2] = Math.max(0, Math.min(1, hsv[2]));
    commit(hsvToHex(...hsv), true);
  });
  eyedropper.addEventListener('click', () => { void pickScreen(); });
  installButton.addEventListener('click', () => { void openInstallPage(); });
  refreshButton.addEventListener('click', () => { void refreshCalendar(); });
  dismissButton.addEventListener('click', () => { hideHelp(); eyedropper.focus(); });
  closeButton.addEventListener('click', close);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
  });
  for (const [name, swatch] of Object.entries(swatches)) swatch.addEventListener('click', () => open(name));
  return { open, close, pickScreen, receiveScreenColor, openInstallPage, refreshCalendar };
}
