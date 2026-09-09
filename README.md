# Google Calendar for Rainmeter

[한국어 안내](README.ko.md)

A 600 x 420 Rainmeter calendar skin that displays a private Google Calendar iCal feed and Korea's public holidays. It provides previous/next month controls, a Today button, persistent glass-theme settings, ten-minute refreshes aligned to the hour, and an optional double-click shortcut that opens Google Calendar in a selected Chrome profile.

## Requirements

- Windows and [Rainmeter](https://www.rainmeter.net/).
- Google Chrome, if you want the double-click shortcut.
- The Rainmeter **WebView2** plugin, which renders the calendar surface.
- The Rainmeter **RunCommand** plugin, which opens the configured Chrome profile.
- The optional [YourPicker](https://github.com/NSTechBytes/YourPicker/releases) plugin for the screen-color eyedropper buttons.

Install both plugins before loading the skin. WebView2 is required for the calendar surface; RunCommand is required only for the double-click shortcut.

If YourPicker is missing, clicking the eyedropper inside the color popup shows installation help. Choose **설치 페이지 열기** (Open installation page), install the plugin's `.rmskin` from the official releases, then choose **달력 새로고침** (Refresh calendar). Nothing is downloaded or installed automatically. Choose **RGB 편집으로 돌아가기** (Return to RGB editing) to keep using the palette and RGB/HEX inputs without the plugin. The plugin DLL is intentionally not bundled with this skin.

## Install from a release

1. Download [GoogleCalendar_1.1.1.rmskin](https://github.com/maxhong-1999/rainmeter-google-calendar/releases/download/v1.1.1/GoogleCalendar_1.1.1.rmskin).
2. Double-click the downloaded file, confirm the Rainmeter installer, and select **Install**.
3. Open `Documents\Rainmeter\Skins\GoogleCalendar\@Resources`.
4. Edit `Private.inc` and `ChromeProfile.inc` as described below, then refresh `GoogleCalendar` in Rainmeter.

The installer contains placeholder configuration only. It never contains another user's calendar, email address, or Chrome profile.

SHA-256 (v1.1.1): `6352CCE46CBC3D6C7C584E43FC15866A4F073EF74511F135444FF38F3165B766`

v1.1.1 includes the updated today outline, HEX/RGB editing, the screen eyedropper and color-reading fix, plus missing-plugin guidance with an official installation-page link. Screen sampling requires the separately installed YourPicker plugin; it is not bundled. Upgrades preserve the existing calendar/account configuration through `VariableFiles`.

## Install from source

1. Copy this project folder to `Documents\Rainmeter\Skins\GoogleCalendar`.
2. Copy `@Resources\Private.inc.example` to `@Resources\Private.inc`.
3. Copy `@Resources\ChromeProfile.inc.example` to `@Resources\ChromeProfile.inc`.
4. Configure both local files, then refresh `GoogleCalendar` in Rainmeter.

## Configure your calendar

Open Google Calendar in a browser. For the calendar you want to show, open **Settings and sharing** → **Integrate calendar**, then copy its **Secret address in iCal format**.

Paste that value into the local `@Resources\Private.inc` file:

```ini
[Variables]
CalendarURL=PASTE_YOUR_SECRET_ICAL_URL_HERE
```

Treat this secret iCal URL like a password: anyone holding it can read the events exposed by that feed. Do not paste it into issues, screenshots, commits, or messages. Korea's public-holiday calendar is enabled by default and needs no personal configuration.

## Configure the Chrome shortcut

Open `chrome://version` in the Chrome profile you want to use. Its profile path ends with a directory such as `Default` or `Profile 1`. Use that directory name and the intended Google account in `@Resources\ChromeProfile.inc`:

```ini
[Variables]
ChromePath=C:\Program Files\Google\Chrome\Application\chrome.exe
ChromeProfileDirectory=Default
GoogleAccount=you@example.com
```

Set `ChromePath` only if Chrome is installed elsewhere. Double-click the calendar background to open Google Calendar using these exact settings. There is intentionally **no default-browser fallback**: incorrect settings or a missing RunCommand plugin result in no new browser window rather than opening a different account.

## Use the calendar

- Select the left or right arrow to move between months.
- Select **Today** to return to the current month.
- Select the gear icon to set the shared background color, foreground color, and glass opacity. Settings are stored locally in the calendar surface.
- Select a color swatch to open the palette. Use the eyedropper inside this popup to pick a screen color: the R/G/B inputs fill automatically and the selected theme color updates immediately. You can also edit R/G/B (0–255) directly. Press `Esc` during screen picking to cancel without changing the theme.
- The skin refreshes both feeds every 10 minutes, including every hour on the hour. It keeps the last readable data if a refresh fails.
- Double-click empty calendar space to open Google Calendar in the configured Chrome profile. Buttons and event links keep their normal click behavior.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Empty calendar or a Rainmeter include error | Confirm that `Private.inc` exists, has a `[Variables]` line, and contains a valid secret iCal URL. |
| Calendar surface is not visible | Install or update the Rainmeter WebView2 plugin, then refresh the skin. |
| Double-click does not open Chrome | Install RunCommand, verify `ChromePath`, `ChromeProfileDirectory`, and `GoogleAccount`, then refresh the skin. |
| Events look old | Wait for the next ten-minute refresh or refresh `GoogleCalendar` manually in Rainmeter. |
| Screen color picker does not start | Install the optional YourPicker plugin and refresh Rainmeter; normal color and HEX controls do not need it. |
| A secret URL was committed | Regenerate the iCal secret in Google Calendar, remove it from every commit before publishing, and invalidate any shared copy. |

Rainmeter's log is the best place to find missing-plugin or INI-configuration errors.

## Update and uninstall

Install a newer `.rmskin` over the existing skin. The release manifest preserves `Private.inc` and `ChromeProfile.inc`, so personal values are not overwritten. To remove the skin, unload it in Rainmeter and delete `Documents\Rainmeter\Skins\GoogleCalendar`; delete the two local `.inc` files with it if you no longer need them.

## Develop and test

Install Node.js with Corepack, then install the locked dependencies and run the suite:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
```

The test suite verifies calendar behavior, Rainmeter integration, public-file boundaries, and known personal-data patterns. See [RELEASING.md](docs/RELEASING.md) for the package and release checklist.

## Contributing

Keep personal configuration and downloaded `.ics` files local. Start from the example `.inc` files, add or update tests with behavior changes, and run `pnpm test` before opening a pull request.

## License

Project-authored code is available under the [MIT License](LICENSE). The vendored `ical.js` parser has separate MPL-2.0 terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
