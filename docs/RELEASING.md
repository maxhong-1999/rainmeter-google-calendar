# Releasing Google Calendar for Rainmeter

This guide creates a release candidate without reading any personal calendar, account, or Chrome-profile values. Run every command from the project root.

## 1. Choose a version and prepare the staging tree

Use a three-part version such as `1.0.0`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-release.ps1 -Version 1.0.0
```

The command runs `pnpm test` first. On success, it writes a clean tree to `output/rmskin-stage` and creates `output/GoogleCalendar_<version>.rmskin`. The archive contains the runtime skin, its audited `RMSKIN.ini`, and placeholder `Private.inc` and `ChromeProfile.inc` files generated only from the tracked examples. It appends the 16-byte package footer used by Rainmeter's [official packager](https://github.com/rainmeter/rainmeter/blob/master/Library/DialogPackage.cpp); a ZIP renamed to `.rmskin` is insufficient.

Do not replace those generated files with the local files from a working installation.

## 2. Inspect the staging tree

Confirm that it has this structure:

```text
output/rmskin-stage/
  RMSKIN.ini
  Skins/
    GoogleCalendar/
      GoogleCalendar.ini
      @Resources/
        Private.inc
        ChromeProfile.inc
        ...calendar runtime files...
```

Open the two `.inc` files. Their only calendar/account values must remain `PASTE_YOUR_SECRET_ICAL_URL_HERE` and `you@example.com`. `RMSKIN.ini` must contain both files in its `VariableFiles` value.

## 3. Use the generated installer

Use the generated `output/GoogleCalendar_1.0.0.rmskin` archive. Do not recreate it with Rainmeter Skin Packager: its UI can replace the audited `RMSKIN.ini` and remove the `VariableFiles` setting that preserves personal configuration during upgrades. Do not add plugins, layouts, a real calendar cache, or local configuration files to the package.

Keep the resulting `.rmskin` inside `output/`, which is ignored by Git.

## 4. Verify a clean install and an upgrade

1. Install the `.rmskin` in a clean Rainmeter profile or test machine.
2. Confirm the skin loads at 600 x 420 and uses placeholder configuration before personal setup.
3. Enter disposable values in the installed `Private.inc` and `ChromeProfile.inc` files.
4. Install the same `.rmskin` again as an update.
5. Confirm the disposable values remain after the update; this verifies `VariableFiles` preservation.
6. Check previous/next month navigation, Today, theme settings, ten-minute refresh behavior, and the configured double-click launcher.
7. Set `CalendarPeek.ini` to a non-default corner, upgrade, and confirm the setting is preserved. Test 400 ms corner dwell, moving into the popup, 600 ms outside dismissal, Escape, fullscreen suppression, and restoring the desktop position after refreshing while the popup is open.
8. Hover each horizontal week row and confirm full titles and times appear while other rows show only dates. Check scrolling, pointer exit after a click, rapid week changes, keyboard navigation across a feed refresh, automatic month rollover, and reduced-motion preferences. (각 주를 펼쳐 제목·시간과 다른 주의 날짜 표시를 확인합니다. 스크롤, 클릭 후 이탈, 빠른 주 이동, 갱신 중 키보드 탐색, 자동 월 변경과 움직임 줄이기도 검사합니다.)

Version 1.3.1 includes `calendar-week-focus.mjs` in the runtime allowlist and installer. Check adaptive height for empty, single-event and dense weeks, stationary-pointer retention when switching weeks, and height shrinking after feed updates. (1.3.1은 주 선택 제어 모듈을 배포 목록과 설치 파일에 포함합니다. 빈 주·한 일정·많은 일정의 적응형 높이, 주 변경 중 커서 유지와 갱신 후 높이 축소를 확인합니다.)

Version 1.2.0 includes the PowerShell/C# hot-corner controller and its default settings. The `VariableFiles` value must also contain `GoogleCalendar\@Resources\CalendarPeek.ini`. Its settings must remain in `[Variables]`: Rainmeter's [installer](https://github.com/rainmeter/rainmeter/blob/master/Library/DialogInstall.cpp) preserves only matching keys in this section. The local `CalendarPeek.state` recovery file must never be packaged. No AutoHotkey installation or third-party executable is required.

## 5. Publish the GitHub Release

For 1.4.0 include the editor module and native bridge, and generate an empty CalendarBridge.ini only from its tracked example. Never package responses, local requests, OAuth client files or connection tokens. Verify holiday/guest protection, failed calendar changes, and successful writes followed by read failures with isolated fixtures. Real authentication requires a desktop OAuth client and browser consent. (1.4.0은 편집 모듈과 실행기를 포함하고 요청 파일은 예시에서 빈 상태로 생성합니다. 실제 요청·응답과 계정 자료는 배포하지 않습니다. 권한 보호·달력 선택 실패·쓰기 후 조회 실패는 예시로 검사하며, 실제 인증은 사용자 설정과 로그인이 필요합니다.)

1. Run `pnpm test` again and inspect `git status`.
2. Commit only public files, then push the release branch after CI succeeds.
3. Create and push an annotated tag such as `v1.0.0`.
4. Create a GitHub Release with the same version and attach the verified `.rmskin` asset.
5. In the release notes, link to [README.md](../README.md), list the WebView2 and RunCommand prerequisites, and remind users to add their own private iCal URL after installation.

Never upload local `Private.inc`, `ChromeProfile.inc`, `DownloadFile` caches, logs, or the `output/rmskin-stage` directory.
