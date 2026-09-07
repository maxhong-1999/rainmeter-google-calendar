# GitHub and RMSKIN Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Rainmeter calendar skin into a privacy-safe MIT-licensed GitHub project with bilingual setup documentation, tested release staging, Windows CI, and a verified `.rmskin` release path.

**Architecture:** Keep personal values in ignored `.inc` files and treat `public-files.json` as the public-source allowlist. A small Node release builder will copy a separate runtime allowlist into a clean staging tree, generate placeholder configuration files and `RMSKIN.ini`, then reject unsafe output; a PowerShell entry point will run tests before invoking it. Rainmeter's official Skin Packager remains the final archive producer.

**Tech Stack:** Rainmeter INI, HTML/CSS/JavaScript ES modules, Node.js built-in test runner, pnpm 11.19.0, PowerShell, GitHub Actions on Windows.

## Global Constraints

- Publish source and a `.rmskin` release without any real iCal URL, Google account, Chrome profile, local user path, or downloaded calendar cache.
- License project-authored code under MIT and preserve the vendored `ical.js` 2.2.1 MPL-2.0 notice.
- Maintain English `README.md` and Korean `README.ko.md` with equivalent installation and troubleshooting workflows.
- Keep `Private.inc` and `ChromeProfile.inc` ignored and generate package placeholders only from their tracked `.example` files.
- Preserve both variable files during installer upgrades with `VariableFiles` in `RMSKIN.ini`.
- Do not bundle WebView2 or RunCommand plugin binaries.
- Use test-first development for executable behavior and run fresh full verification before completion or publishing.

---

## File structure

- `LICENSE`: MIT terms for project-authored code.
- `README.md`: primary English user and contributor guide.
- `README.ko.md`: Korean guide with the same operational content.
- `THIRD_PARTY_NOTICES.md`: `ical.js` attribution and upstream license boundary.
- `rmskin-files.json`: exact runtime files permitted in release packages.
- `scripts/prepare-rmskin.mjs`: safe, deterministic package-staging implementation.
- `scripts/prepare-release.ps1`: Windows entry point that tests before staging.
- `tests/distribution-contract.test.mjs`: repository, documentation, CI, and legal contract tests.
- `tests/prepare-rmskin.test.mjs`: behavioral tests for clean staging and privacy rejection.
- `.github/workflows/test.yml`: Windows push and pull-request verification.
- `docs/RELEASING.md`: exact official Skin Packager and GitHub Release checklist.
- `docs/plans/2026-09-07-github-rmskin-distribution-design.md`: approved design record.
- `docs/superpowers/plans/2026-09-07-github-rmskin-distribution.md`: this execution plan.
- `.gitignore`: local data and generated release-output exclusions.
- `package.json`: test and release-preparation commands.
- `public-files.json`: exact tracked-file/publication manifest.

---

### Task 1: Legal and bilingual documentation contract

**Files:**
- Create: `LICENSE`
- Create: `README.ko.md`
- Modify: `README.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Create: `tests/distribution-contract.test.mjs`

**Interfaces:**
- Consumes: the existing English setup instructions and configuration examples.
- Produces: stable document headings and legal language used by CI and privacy tests.

- [ ] **Step 1: Write failing documentation and license tests**

Add tests that read `README.md`, `README.ko.md`, `LICENSE`, and `THIRD_PARTY_NOTICES.md`, then assert:

```js
test('project uses MIT while retaining the ical.js license boundary', async () => {
  const [license, notices] = await Promise.all([
    readProjectFile('LICENSE'),
    readProjectFile('THIRD_PARTY_NOTICES.md'),
  ]);
  assert.match(license, /^MIT License/m);
  assert.match(license, /Rainmeter Google Calendar contributors/);
  assert.match(notices, /ical\.js 2\.2\.1/i);
  assert.match(notices, /MPL-2\.0/i);
});

test('English and Korean guides link to one another and document both install paths', async () => {
  const [english, korean] = await Promise.all([
    readProjectFile('README.md'),
    readProjectFile('README.ko.md'),
  ]);
  assert.match(english, /README\.ko\.md/);
  assert.match(korean, /README\.md/);
  for (const guide of [english, korean]) {
    assert.match(guide, /\.rmskin/i);
    assert.match(guide, /Private\.inc/);
    assert.match(guide, /ChromeProfile\.inc/);
    assert.match(guide, /WebView2/i);
    assert.match(guide, /RunCommand/i);
    assert.match(guide, /10[^\n]*(minute|분)/i);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec node --test tests/distribution-contract.test.mjs`

Expected: FAIL because `LICENSE` and `README.ko.md` do not exist and the old README still says no license was granted.

- [ ] **Step 3: Write the MIT license and complete both guides**

Use the standard MIT text with:

```text
Copyright (c) 2026 Rainmeter Google Calendar contributors
```

Write matching English and Korean workflows for release install, source install, iCal setup, Chrome profile selection, theme settings, refresh schedule, troubleshooting, privacy, update, uninstall, test, and contribution. Link each guide to its counterpart and link `LICENSE` plus `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 4: Run focused and existing privacy tests**

Run: `pnpm exec node --test tests/distribution-contract.test.mjs tests/privacy-contract.test.mjs`

Expected: the new contract tests pass; update obsolete assertions in `privacy-contract.test.mjs` from “no license” to MIT only when their expected failure is observed.

- [ ] **Step 5: Commit the independently testable documentation unit**

```powershell
git add LICENSE README.md README.ko.md THIRD_PARTY_NOTICES.md tests/distribution-contract.test.mjs tests/privacy-contract.test.mjs
git commit -m "docs: add bilingual MIT distribution guide"
```

---

### Task 2: Safe RMSKIN staging builder

**Files:**
- Create: `rmskin-files.json`
- Create: `scripts/prepare-rmskin.mjs`
- Create: `tests/prepare-rmskin.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `{ rootDir, outputDir, version }`, tracked configuration examples, and `rmskin-files.json`.
- Produces: `prepareRmskinStage(options): Promise<{ stageRoot: string, copiedFiles: string[] }>` and a clean `output/rmskin-stage` tree.

- [ ] **Step 1: Write a failing clean-stage test**

Create a temporary project fixture containing the runtime allowlist, example configurations, and deliberately different untracked real configurations. Call the wished-for API and assert:

```js
const result = await prepareRmskinStage({
  rootDir: fixtureRoot,
  outputDir,
  version: '1.0.0',
});
assert.equal(await readFile(join(result.stageRoot, 'Skins/GoogleCalendar/@Resources/Private.inc'), 'utf8'), privateExample);
assert.equal(await readFile(join(result.stageRoot, 'Skins/GoogleCalendar/@Resources/ChromeProfile.inc'), 'utf8'), profileExample);
assert.doesNotMatch(await readTreeText(result.stageRoot), /private-user@example\.com/);
assert.match(await readFile(join(result.stageRoot, 'RMSKIN.ini'), 'utf8'), /Version=1\.0\.0/);
assert.match(await readFile(join(result.stageRoot, 'RMSKIN.ini'), 'utf8'), /VariableFiles=.*Private\.inc.*ChromeProfile\.inc/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec node --test tests/prepare-rmskin.test.mjs`

Expected: FAIL with module-not-found for `scripts/prepare-rmskin.mjs`.

- [ ] **Step 3: Implement the smallest safe builder**

Implement:

```js
export async function prepareRmskinStage({ rootDir, outputDir, version }) {
  validateVersion(version);
  const runtimeFiles = await readJson(join(rootDir, 'rmskin-files.json'));
  runtimeFiles.forEach(assertSafeRelativePath);
  await recreateOwnedOutput(rootDir, outputDir);
  const skinRoot = join(outputDir, 'Skins', 'GoogleCalendar');
  await copyAllowlistedFiles(rootDir, skinRoot, runtimeFiles);
  await copyFile(join(rootDir, '@Resources/Private.inc.example'), join(skinRoot, '@Resources/Private.inc'));
  await copyFile(join(rootDir, '@Resources/ChromeProfile.inc.example'), join(skinRoot, '@Resources/ChromeProfile.inc'));
  await writeFile(join(outputDir, 'RMSKIN.ini'), renderManifest(version), 'utf8');
  await assertStageIsPublic(outputDir);
  return { stageRoot: outputDir, copiedFiles: runtimeFiles };
}
```

Use an explicit runtime allowlist containing `GoogleCalendar.ini`, calendar HTML/CSS/JS modules, and `@Resources/vendor/ical.js`. Reject absolute paths, `..`, `.git`, `node_modules`, `DownloadFile`, real `.inc` source entries, iCal feed URL patterns other than the Korean public holiday feed, Windows user paths, and non-placeholder staged accounts.

Generate this manifest:

```ini
[rmskin]
Name=Google Calendar
Author=Rainmeter Google Calendar contributors
Version=1.0.0
LoadType=Skin
Load=GoogleCalendar\GoogleCalendar.ini
MinimumRainmeter=4.5.0
MinimumWindows=10.0
VariableFiles=GoogleCalendar\@Resources\Private.inc|GoogleCalendar\@Resources\ChromeProfile.inc
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec node --test tests/prepare-rmskin.test.mjs`

Expected: PASS with a placeholder-only staging tree.

- [ ] **Step 5: Add failing rejection and output-boundary tests**

Add tests proving the builder rejects an unsafe runtime manifest, an unsafe example file, an invalid semantic version, and an output path outside `output/` or inside the source tree.

- [ ] **Step 6: Run rejection tests and verify RED**

Run: `pnpm exec node --test tests/prepare-rmskin.test.mjs`

Expected: FAIL on the first unimplemented rejection rule.

- [ ] **Step 7: Implement boundary and content validation**

Resolve both roots before deleting or writing, require the output directory to be a descendant of `<rootDir>/output`, use only `fs.rm(outputDir, { recursive: true, force: true })` after that check, and scan every staged text file. Produce error messages that identify the offending rule without echoing the secret value.

- [ ] **Step 8: Run focused and full tests**

Run: `pnpm exec node --test tests/prepare-rmskin.test.mjs && pnpm test`

Expected: all tests pass with no warnings.

- [ ] **Step 9: Commit the independently testable builder unit**

```powershell
git add .gitignore rmskin-files.json scripts/prepare-rmskin.mjs tests/prepare-rmskin.test.mjs
git commit -m "feat: add privacy-safe rmskin staging"
```

---

### Task 3: Release command and maintainer checklist

**Files:**
- Create: `scripts/prepare-release.ps1`
- Create: `docs/RELEASING.md`
- Modify: `package.json`
- Modify: `tests/distribution-contract.test.mjs`

**Interfaces:**
- Consumes: `Version` as `major.minor.patch` and `scripts/prepare-rmskin.mjs`.
- Produces: `pnpm release:prepare -- 1.0.0` and `powershell -File scripts/prepare-release.ps1 -Version 1.0.0`.

- [ ] **Step 1: Add failing release-entry-point contract tests**

Assert that `package.json` exposes `release:prepare`, the PowerShell script runs `pnpm test` before staging, accepts a mandatory version, and the release guide contains official Skin Packager, clean install, upgrade preservation, archive inspection, tag, and GitHub Release steps.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec node --test tests/distribution-contract.test.mjs`

Expected: FAIL because the release command and guide are absent.

- [ ] **Step 3: Implement the release entry points**

Add this package script:

```json
"release:prepare": "node scripts/prepare-rmskin.mjs"
```

The PowerShell script will use:

```powershell
param([Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  pnpm test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed; release staging was not created.' }
  node scripts/prepare-rmskin.mjs --version $Version --output output/rmskin-stage
  if ($LASTEXITCODE -ne 0) { throw 'RMSKIN staging failed.' }
} finally {
  Pop-Location
}
```

The Node CLI must parse exactly `--version <semver>` and optional `--output <path>`, call `prepareRmskinStage`, and exit nonzero on validation failure.

- [ ] **Step 4: Write the exact release checklist**

Document: run the preparation script, open Rainmeter Manage, choose “Create .rmskin package”, select `output/rmskin-stage`, create the versioned package, inspect the archive for the allowlisted tree and placeholders, install cleanly, set dummy values, install the same package again to verify `VariableFiles` retention, run the live skin, tag `v<version>`, create a GitHub Release, and attach the verified `.rmskin`.

- [ ] **Step 5: Run focused and full tests**

Run: `pnpm exec node --test tests/distribution-contract.test.mjs && pnpm test`

Expected: all tests pass.

- [ ] **Step 6: Commit the independently testable release workflow**

```powershell
git add package.json scripts/prepare-release.ps1 scripts/prepare-rmskin.mjs docs/RELEASING.md tests/distribution-contract.test.mjs
git commit -m "build: add tested release preparation workflow"
```

---

### Task 4: Windows CI and public manifest closure

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `tests/distribution-contract.test.mjs`
- Modify: `public-files.json`

**Interfaces:**
- Consumes: `packageManager: pnpm@11.19.0` and `pnpm test`.
- Produces: pull-request and push checks on `windows-latest`.

- [ ] **Step 1: Add a failing CI contract test**

Assert the workflow contains:

```yaml
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: windows-latest
```

Also assert it uses `actions/checkout`, `actions/setup-node`, Corepack, `pnpm install --frozen-lockfile`, and `pnpm test`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec node --test tests/distribution-contract.test.mjs`

Expected: FAIL because `.github/workflows/test.yml` does not exist.

- [ ] **Step 3: Add the minimal Windows workflow**

Create a workflow using Node 22, pnpm 11.19.0 through Corepack, pnpm store caching, frozen install, and the complete test command. Give the workflow read-only repository contents permission.

- [ ] **Step 4: Update the public manifest from Git-tracked intent**

Add every new public file to `public-files.json`, keep normalized forward-slash paths, sort the list, stage all intended files, and ensure no ignored real configuration or output path appears.

- [ ] **Step 5: Run focused and full tests**

Run: `pnpm exec node --test tests/distribution-contract.test.mjs tests/privacy-contract.test.mjs && pnpm test`

Expected: manifest equality and all other tests pass.

- [ ] **Step 6: Commit the independently testable CI unit**

```powershell
git add .github/workflows/test.yml public-files.json tests/distribution-contract.test.mjs docs/plans docs/superpowers/plans
git commit -m "ci: verify public distribution on Windows"
```

---

### Task 5: Build and inspect the release candidate

**Files:**
- Generate (ignored): `output/rmskin-stage/**`
- Generate with official tool (ignored): `output/GoogleCalendar_1.0.0.rmskin`

**Interfaces:**
- Consumes: the complete repository and Rainmeter Skin Packager.
- Produces: a locally verified `GoogleCalendar_1.0.0.rmskin` release candidate.

- [ ] **Step 1: Run fresh repository verification**

Run: `pnpm install --frozen-lockfile; pnpm test; git diff --check; git status --short --ignored`

Expected: dependency install succeeds, all tests pass, whitespace check is clean, and only documented local/output paths are ignored.

- [ ] **Step 2: Prepare the release staging tree**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-release.ps1 -Version 1.0.0`

Expected: tests pass again and the script reports `output/rmskin-stage` with only placeholder configuration.

- [ ] **Step 3: Inspect staging without reading local private files**

Run a recursive listing of `output/rmskin-stage`, read `RMSKIN.ini`, and scan the staging tree for Windows user-profile paths, private-feed URL patterns, and email addresses other than `you@example.com`.

Expected: no forbidden match; both generated `.inc` files contain only tracked placeholder values.

- [ ] **Step 4: Create the archive with Rainmeter Skin Packager**

Use the official Rainmeter Skin Packager UI with the prepared manifest and skin tree, save `output/GoogleCalendar_1.0.0.rmskin`, and do not add plugins or layouts.

- [ ] **Step 5: Verify clean installation and upgrade preservation**

Install the release candidate in Rainmeter, confirm the skin loads at 600 x 420, enter disposable test values in both variable files, reinstall the same release, and verify those test values remain. Confirm previous/next, Today, settings, refresh schedule, and double-click launcher behavior.

- [ ] **Step 6: Re-run full tests after live verification**

Run: `pnpm test`

Expected: all tests pass with zero failures.

---

### Task 6: Commit and publish the public GitHub repository

**Files:**
- No additional repository files unless a release-verification correction is required; any correction starts with a failing test.

**Interfaces:**
- Consumes: verified main branch and `output/GoogleCalendar_1.0.0.rmskin`.
- Produces: public repository `rainmeter-google-calendar` and GitHub Release `v1.0.0`.

- [ ] **Step 1: Verify repository identity and destination**

Obtain the GitHub account/repository destination and a non-private Git author name/email from the user or existing Git configuration. Confirm the repository is public and named `rainmeter-google-calendar` unless the user chooses a different name.

- [ ] **Step 2: Run the pre-publish privacy gate**

Run the full privacy test suite, then inspect `git diff --check` and `git status --short`.

Expected: tests pass, intended files are staged or committed, and the grep emits no personal-data match.

- [ ] **Step 3: Commit any remaining intended files**

```powershell
git add --all
git commit -m "feat: publish Rainmeter Google Calendar"
```

- [ ] **Step 4: Create/connect the public GitHub repository and push**

Create the repository through the authenticated GitHub account, add its HTTPS URL as `origin`, and push `main`. Do not force-push and do not overwrite an existing repository with unrelated history.

- [ ] **Step 5: Confirm CI before release**

Open the pushed commit's Actions result and verify the Windows test job completed successfully.

- [ ] **Step 6: Tag and publish the installer**

Create annotated tag `v1.0.0`, push it, create a GitHub Release titled `Google Calendar 1.0.0`, summarize prerequisites and setup, attach only the verified `.rmskin`, and confirm the asset downloads successfully.

- [ ] **Step 7: Report durable handoff links**

Provide the public repository URL, release URL, local verified artifact path, test count, and any plugin prerequisites that remain user-installed.
