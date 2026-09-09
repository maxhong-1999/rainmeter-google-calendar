import {
  DEFAULT_THEME,
  hexToRgbChannels,
  loadTheme,
  normalizeHexColor,
  normalizeOpacity,
  saveTheme,
  settingsSurfaceForForeground,
  shadowForForeground,
} from './calendar-theme.mjs';

export function createThemeSettingsController({
  root,
  storage,
  settingsButton,
  settingsPanel,
  backgroundInput,
  foregroundInput,
  backgroundHexInput = null,
  foregroundHexInput = null,
  opacityInput,
  opacityOutput,
  resetButton,
  documentTarget,
}) {
  function applyTheme(theme, persist = true) {
    const backgroundOpacity = normalizeOpacity(theme?.backgroundOpacity);
    const normalizedTheme = {
      background: normalizeHexColor(theme?.background, DEFAULT_THEME.background),
      foreground: normalizeHexColor(theme?.foreground, DEFAULT_THEME.foreground),
      backgroundOpacity,
    };
    root.style.setProperty('--theme-background-rgb', hexToRgbChannels(normalizedTheme.background));
    root.style.setProperty('--theme-foreground-rgb', hexToRgbChannels(normalizedTheme.foreground));
    root.style.setProperty('--theme-background-opacity', String(backgroundOpacity / 100));
    root.style.setProperty('--settings-surface-rgb', settingsSurfaceForForeground(normalizedTheme.foreground));
    root.style.setProperty('--theme-shadow', shadowForForeground(normalizedTheme.foreground));
    backgroundInput.value = normalizedTheme.background;
    foregroundInput.value = normalizedTheme.foreground;
    if (backgroundHexInput) backgroundHexInput.value = normalizedTheme.background;
    if (foregroundHexInput) foregroundHexInput.value = normalizedTheme.foreground;
    opacityInput.value = String(backgroundOpacity);
    opacityOutput.textContent = `${backgroundOpacity}%`;
    if (persist) saveTheme(storage, normalizedTheme);
  }

  function setOpen(open) {
    settingsPanel.hidden = !open;
    settingsButton.setAttribute('aria-expanded', String(open));
    if (open) backgroundInput.focus();
  }

  function applyPickedColor(target, value) {
    if (target !== 'background' && target !== 'foreground') return;
    const fallback = target === 'background' ? backgroundInput.value : foregroundInput.value;
    const color = normalizeHexColor(value, fallback);
    applyTheme({
      background: target === 'background' ? color : backgroundInput.value,
      foreground: target === 'foreground' ? color : foregroundInput.value,
      backgroundOpacity: opacityInput.value,
    });
  }

  settingsButton.addEventListener('click', () => setOpen(settingsPanel.hidden));
  backgroundInput.addEventListener('input', () => applyTheme({ background: backgroundInput.value, foreground: foregroundInput.value, backgroundOpacity: opacityInput.value }));
  foregroundInput.addEventListener('input', () => applyTheme({ background: backgroundInput.value, foreground: foregroundInput.value, backgroundOpacity: opacityInput.value }));
  backgroundHexInput?.addEventListener('change', () => applyTheme({ background: backgroundHexInput.value, foreground: foregroundInput.value, backgroundOpacity: opacityInput.value }));
  foregroundHexInput?.addEventListener('change', () => applyTheme({ background: backgroundInput.value, foreground: foregroundHexInput.value, backgroundOpacity: opacityInput.value }));
  opacityInput.addEventListener('input', () => applyTheme({ background: backgroundInput.value, foreground: foregroundInput.value, backgroundOpacity: opacityInput.value }));
  resetButton.addEventListener('click', () => applyTheme(DEFAULT_THEME));
  documentTarget.addEventListener('click', (event) => {
    if (!settingsPanel.hidden && !settingsPanel.contains(event.target) && !settingsButton.contains(event.target)) {
      setOpen(false);
    }
  });
  documentTarget.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !settingsPanel.hidden) {
      setOpen(false);
      settingsButton.focus();
    }
  });

  applyTheme(loadTheme(storage), false);
  return { applyTheme, applyPickedColor, setOpen };
}
