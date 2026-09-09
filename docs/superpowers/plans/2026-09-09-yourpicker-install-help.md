# YourPicker installation help implementation plan

**Goal:** When the popup eyedropper lacks YourPicker, show installation guidance, an official release-page button, and a calendar refresh button. Include it in the next public installer.

**Architecture:** Rainmeter's bundled FileView checks only the standard user and application plugin folders, filtering the exact YourPicker.dll filename without recursion. A Calc measure exposes a numeric presence flag independently of the last sampled color, which may be empty even for installed plugins. Native FileView avoids Lua io.open character-encoding limitations on Windows paths. Rainmeter opens the fixed official URL, and refreshes only this skin. No automatic download or installation.

**Global constraints:** Preserve RGB/HEX editing, the current colors and opacity, private configuration, the 600 x 420 layout, and cancellation behavior. Do not package DLLs or private settings. Fixed URL: https://github.com/NSTechBytes/YourPicker/releases . No arbitrary URL execution.

## Task 1: Popup help (subagent)

Files: calendar-color-picker.mjs, calendar.html, calendar.css, calendar.js under @Resources; tests/calendar-color-picker.test.mjs and tests/calendar-ui.test.mjs.

- [ ] First add failing tests: a presence flag of 0 shows help and sends no pick command; 1 with an empty color still starts picking; help actions send only fixed commands; closing or switching fields clears help; bridge errors preserve theme.
- [ ] Extend createColorPicker with helpPanel, installButton, refreshButton. The parent implements [MeasureYourPickerAvailable], returning numeric 1 or 0 on skin load. Read it using ReplaceVariables. Treat missing/unresolved flag as unable to verify; show guidance without crashing.
- [ ] Expose openInstallPage() and refreshCalendar() for deterministic tests. Use api.Bang('["https://github.com/NSTechBytes/YourPicker/releases"]') and api.Bang('[!Refresh]') respectively. Use the existing direct/sync bridge selection. No window.open (WebView disables new windows).
- [ ] Show Korean missing-plugin message, installation instructions, 설치 페이지 열기 and 달력 새로고침. Keep help within the popup's existing bounds, replacing the palette temporarily if necessary; allow dismissing it to resume RGB editing.
- [ ] Run focused tests; report changed files and results. Do not modify packaging or INI.

## Task 2: Host presence and public package (parent)

- [ ] Add two FileView measures before the plugin measure, using Type=FileCount, WildcardSearch=YourPicker.dll, ShowFolder=0, ShowDotDot=0, Recursive=0, at #SETTINGSPATH#Plugins/ and #PROGRAMPATH#Plugins/. A Calc measure exposes `(MeasureYourPickerUserFiles + MeasureYourPickerProgramFiles) > 0`. No filesystem mutation or additional dependency.
- [ ] Add runtime and public manifest entries and integration contracts, including the fixed official URL in the runtime URL allowlist.
- [ ] Review the task diff, run the full suite, inspect popup visually with missing/present bridge cases, and deploy only changed runtime files with backups.
- [ ] Rebuild a new versioned RMSKIN from public allowlisted files; verify all runtime contents, generated placeholder configurations, exact archive entry list, and SHA-256. Update README links and tests. Keep existing published versions intact.
- [ ] Commit, push, create a GitHub release, attach the verified installer, and verify its downloadable checksum. Do not claim publishing if authentication prevents asset upload.
