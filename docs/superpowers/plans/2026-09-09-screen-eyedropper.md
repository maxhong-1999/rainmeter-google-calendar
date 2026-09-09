# Screen Eyedropper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable Rainmeter-native screen colour picking for both calendar theme colours.

**Architecture:** HTML buttons ask `calendar.js` to invoke one of two YourPicker magnifier measures through `RainmeterAPI.Bang`. Each measure returns a HEX value to `window.applyPickedThemeColor`; the theme controller validates it and applies only the target field.

**Tech Stack:** Rainmeter, YourPicker v1.6.0, WebView2 bridge, browser ES modules, Node built-in test runner.

## Global Constraints

- Do not bundle the external YourPicker DLL or any user configuration.
- Keep colour and HEX controls available if the plugin is not installed.
- Accept only six-digit `#RRGGBB` picker output.
- Preserve background opacity and the non-target theme colour.

---

### Task 1: Theme-controller picker callback

**Files:**
- Modify: `@Resources/calendar-theme-ui.mjs`
- Modify: `tests/calendar-theme-ui.test.mjs`

- [ ] Write a failing test that calls `applyPickedColor('background', '#0a0b0c')` and asserts the saved theme changes only background.
- [ ] Run `node --test tests/calendar-theme-ui.test.mjs` and confirm the test fails because the controller has no callback.
- [ ] Add `applyPickedColor(target, value)` to validate the target and use `applyTheme` with the current control values.
- [ ] Run `node --test tests/calendar-theme-ui.test.mjs` and confirm it passes.

### Task 2: WebView and Rainmeter bridge

**Files:**
- Modify: `@Resources/calendar.html`
- Modify: `@Resources/calendar.css`
- Modify: `@Resources/calendar.js`
- Modify: `GoogleCalendar.ini`
- Modify: `tests/calendar-ui.test.mjs`
- Modify: `tests/rainmeter-integration.test.mjs`

- [ ] Write contracts for two accessible picker buttons, bridge bangs, the global callback, and two `YourPicker` `-mp` measures.
- [ ] Run the focused tests and confirm they fail on the missing controls/contracts.
- [ ] Add the controls and callback plumbing; use two measures to keep the colour target unambiguous.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Distribution documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `README.ko.md`
- Modify: `public-files.json`
- Modify: `tests/privacy-contract.test.mjs`

- [ ] Add a failing public-documentation contract for optional YourPicker installation and the failure path.
- [ ] Add concise English and Korean setup/troubleshooting text with the upstream release link, without adding the DLL to package manifests.
- [ ] Add this design and plan to `public-files.json`.
- [ ] Run `pnpm test` and confirm the full suite passes.
- [ ] Inspect `git diff --check`, scan tracked public files for personal calendar URLs, then commit the changes.
