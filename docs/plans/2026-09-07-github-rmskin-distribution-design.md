# GitHub and RMSKIN Distribution Design

Date: 2026-09-07

## Goal

Publish the Rainmeter Google Calendar skin as a privacy-safe public GitHub project that other people can install, configure, update, test, and redistribute under the MIT License.

The repository will support two installation paths:

1. A downloadable `.rmskin` release for normal users.
2. Source installation for contributors and advanced users.

## Public repository contents

The repository will contain the runtime skin files, sanitized configuration examples, tests, documentation, packaging metadata and scripts, the MIT license, and third-party notices.

The following data must never be committed or packaged from the working installation:

- A user's secret Google Calendar iCal URL.
- A user's Google email address or account selector.
- A user's Chrome profile directory or local Windows user path.
- Downloaded personal or holiday calendar caches.
- Generated dependencies, logs, backups, or temporary package staging files.

`public-files.json` remains the source of truth for files that may be tracked and scanned. Privacy tests must compare this manifest with Git-tracked files and scan all public text for known personal markers and secret calendar URL patterns.

## License and third-party code

Project-authored code will be released under the MIT License. The copyright line will use the project-neutral name "Rainmeter Google Calendar contributors" so the public repository does not expose the original user's identity.

The vendored `ical.js` parser remains governed by MPL-2.0. `THIRD_PARTY_NOTICES.md` will clearly identify its version, license, and upstream source. The MIT License will not be described as replacing third-party terms.

## Documentation

`README.md` will be the primary English guide. `README.ko.md` will provide the same user workflow in Korean. Each document will link to the other language near the top.

Both guides will lead with the release installer and cover:

- Features and the 600 x 420 layout.
- Required Rainmeter, WebView2, RunCommand, and Chrome components.
- One-click `.rmskin` installation.
- Source installation.
- Finding and configuring a private Google Calendar iCal URL.
- Enabling the Korean public-holiday calendar.
- Selecting a specific Chrome profile and Google account for double-click launch.
- Calendar navigation, the Today button, automatic ten-minute and on-the-hour refresh behavior, and double-click behavior.
- Changing the shared foreground color, glass background color, and background opacity.
- Privacy and safe handling of secret iCal URLs.
- Common failures and focused remedies.
- Updating, uninstalling, testing, and contributing.

The documentation will use placeholders only. It will not include a real account, calendar URL, profile name, or local absolute path.

## Installer design

The release package will use Rainmeter's standard root-config layout:

```text
Skins/
  GoogleCalendar/
    GoogleCalendar.ini
    @Resources/
      ...runtime files...
      Private.inc
      ChromeProfile.inc
```

The repository will continue to track only `Private.inc.example` and `ChromeProfile.inc.example`. The packaging preparation script will create placeholder copies named `Private.inc` and `ChromeProfile.inc` in an ignored staging directory. It will never copy the developer's real local files.

The package manifest will load `GoogleCalendar\GoogleCalendar.ini` after installation. Its `VariableFiles` declaration will preserve the installed user's values in `Private.inc` and `ChromeProfile.inc` during upgrades. Packaging preparation will fail if a staged file contains a Windows user path, a non-placeholder account, or a non-placeholder private calendar URL.

The project will prepare a deterministic staging tree and manifest. The distributable `.rmskin` will be produced using Rainmeter's official Skin Packager and then verified by inspecting its contents and installing it into a clean test location before a GitHub release is published.

External Rainmeter plugins will not be bundled. Users will install WebView2 and RunCommand from their official distribution pages so their binaries and licenses remain independently maintained.

## Release workflow

The repository will include a PowerShell preparation command that:

1. Runs the complete test suite.
2. Validates `public-files.json` against tracked files.
3. Creates a clean ignored staging directory.
4. Copies only the runtime allowlist into `Skins\GoogleCalendar`.
5. Generates placeholder `Private.inc` and `ChromeProfile.inc` files from the tracked examples.
6. Writes the Rainmeter package manifest.
7. Scans the staged output for private data and forbidden files.
8. Prints the exact remaining Skin Packager and release steps.

The script will not read or copy the working installation's private configuration files. A release checklist will cover versioning, official packaging, clean-install verification, update-preservation verification, and GitHub Release upload.

## Continuous integration

A GitHub Actions workflow will run on pushes and pull requests. It will install the pinned Node and pnpm versions, perform a frozen dependency install, and run all tests on Windows. Tests will verify:

- Calendar model and UI behavior.
- Rainmeter integration contracts.
- Public manifest equality.
- Privacy boundaries.
- Bilingual README presence and required setup guidance.
- MIT and third-party license declarations.
- Packaging preparation behavior, including rejection of unsafe staged content.

Release packaging remains an explicit Windows release step because the final archive must be created and tested with Rainmeter's official tooling.

## Failure handling

- Missing private configuration: show setup guidance in the README; the placeholder installation must not expose anyone else's calendar.
- Invalid or inaccessible iCal URL: keep the calendar surface usable and explain Rainmeter log checks and URL regeneration.
- Missing WebView2: explain that the calendar surface cannot render and link to the prerequisite.
- Missing RunCommand or invalid Chrome settings: explain that double-click intentionally does not fall back to another browser or profile.
- Failed refresh: retain the last readable calendar data when possible and document the ten-minute/on-the-hour schedule.
- Packaging privacy failure: stop the release process before an archive is produced.

## Acceptance criteria

- The tracked repository contains no known personal information or calendar cache.
- The project is licensed under MIT while preserving the `ical.js` MPL-2.0 notice.
- English and Korean setup guides are complete and mutually linked.
- A clean user can configure the skin without editing program source files.
- The package staging process never consumes real local configuration.
- Existing configuration values survive a tested installer upgrade.
- The full local and CI test suite passes.
- A release checklist identifies every manual action needed to create and publish a verified `.rmskin` asset.
