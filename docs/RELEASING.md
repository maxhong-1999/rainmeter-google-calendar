# Releasing Google Calendar for Rainmeter

This guide creates a release candidate without reading any personal calendar, account, or Chrome-profile values. Run every command from the project root.

## 1. Choose a version and prepare the staging tree

Use a three-part version such as `1.0.0`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-release.ps1 -Version 1.0.0
```

The command runs `pnpm test` first. On success, it writes a clean tree to `output/rmskin-stage` and creates `output/GoogleCalendar_<version>.rmskin`. The archive contains the runtime skin, its audited `RMSKIN.ini`, and placeholder `Private.inc` and `ChromeProfile.inc` files generated only from the tracked examples.

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

## 5. Publish the GitHub Release

1. Run `pnpm test` again and inspect `git status`.
2. Commit only public files, then push the release branch after CI succeeds.
3. Create and push an annotated tag such as `v1.0.0`.
4. Create a GitHub Release with the same version and attach the verified `.rmskin` asset.
5. In the release notes, link to [README.md](../README.md), list the WebView2 and RunCommand prerequisites, and remind users to add their own private iCal URL after installation.

Never upload local `Private.inc`, `ChromeProfile.inc`, `DownloadFile` caches, logs, or the `output/rmskin-stage` directory.
