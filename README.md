# Codex Local Meter

Codex Local Meter shows a compact, local-only estimate of Codex CLI usage in the VS Code status bar. It reads local Codex session files from `~/.codex`, derives usage metadata, and keeps all data on your machine.

This extension is designed for people who want a quick view of recent Codex activity without sending session data anywhere.

## Highlights

- Status bar indicator for recent Codex usage.
- Tooltip with 5-hour and 7-day activity details.
- Details panel with usage estimates, detected models, session counts, source path, and parse issues.
- Diagnostics command for checking whether the extension can find and read local Codex files.
- Configurable Codex folder path, refresh interval, display mode, and warning thresholds.
- Local-only by design: no network calls, no telemetry, and no writes to Codex files.

## Privacy

Codex Local Meter only reads local files and only displays derived metadata.

| The extension does | The extension does not |
| --- | --- |
| Read `sessions/**/*.jsonl` under your Codex folder | Upload or transmit data |
| Show counts, percentages, timestamps, models, paths, and parse-error counts | Show prompts, responses, code snippets, or tool output |
| Watch for local session-file changes | Modify, delete, or normalize Codex files |
| Estimate usage when exact values are unavailable | Claim estimates are official billing or quota numbers |

## Status Bar

The status bar item appears after VS Code startup and refreshes automatically.

Examples:

| State | Example |
| --- | --- |
| Rate-limit data found | `$(codex-local-meter) 42.0% 5h` |
| Token counts found | `$(codex-local-meter) 12.4k 5h` |
| Message-count fallback | `$(codex-local-meter) ~12 msgs 5h` |
| No local data yet | `$(codex-local-meter) --` |
| Compact mode | `$(codex-local-meter) 42.0%` |

The status bar text changes color when usage reaches the configured warning or danger threshold.

## Details Panel

Run **Codex Local Meter: Open Status** or click the status bar item to open the details panel.

The panel shows:

- 5-hour activity or rate-limit usage.
- 7-day activity or rate-limit usage.
- Last detected Codex activity.
- Number of sessions seen in the 7-day window.
- Model names detected in local metadata.
- Codex folder path being read.
- Whether token counts or rate-limit data were found.
- Non-fatal parse issues.

The panel uses static HTML and CSS only. It does not run scripts or load external resources.

## Commands

| Command | What it does |
| --- | --- |
| `Codex Local Meter: Open Status` | Opens the details panel. |
| `Codex Local Meter: Refresh Now` | Re-reads local Codex files immediately. |
| `Codex Local Meter: Select Codex Folder` | Sets a custom Codex folder path. |
| `Codex Local Meter: Open Settings` | Opens this extension's settings. |
| `Codex Local Meter: Show Diagnostics` | Writes a privacy-safe diagnostics report to the output channel. |

## Settings

All settings are under `codexLocalMeter.*`.

| Setting | Default | Description |
| --- | --- | --- |
| `codexPath` | `""` | Override the Codex data directory. Empty means `~/.codex`. |
| `refreshIntervalSeconds` | `300` | How often to re-read local Codex files. Minimum 30 seconds. |
| `showFiveHourUsage` | `true` | Show 5-hour usage in the status bar. |
| `showWeeklyUsage` | `true` | Show 7-day usage in the tooltip. |
| `warningThresholdPercent` | `70` | Show warning colors at or above this percentage. |
| `dangerThresholdPercent` | `90` | Show danger colors at or above this percentage. |
| `compactMode` | `false` | Use shorter status bar text. |

## How Usage Is Estimated

Codex Local Meter scans local Codex JSONL session files and looks for usage-relevant records. When local rate-limit percentages are present, those values are shown first. When token counts are present, token totals are shown. When neither is available, the extension falls back to message counts and marks the result as an estimate.

These numbers are best-effort local estimates. They are not official billing records, account quota records, or service-side usage statements.

## Image Assets

The `images/` directory contains both hand-authored source files and generated outputs.

| File | Kind | How to update |
| --- | --- | --- |
| `icon-mono.svg` | **Source** — hand-authored | Edit directly. Monochrome filled paths only (no stroke, no colour); font renderers discard those. |
| `icon.svg` | **Source** — hand-authored | Edit directly. Full-colour version used as the marketplace/extension thumbnail. |
| `codex-local-meter.woff` | **Generated** from `icon-mono.svg` | Rebuilt automatically by `scripts/RebuildVsix.ps1` via `svgtofont`. Do not hand-edit or commit. |
| `icon.png` | **Generated** from `icon.svg` | Rebuilt automatically by `scripts/RebuildVsix.ps1` via `@resvg/resvg-js-cli`. Do not hand-edit or commit. |

The two SVGs serve different purposes. `icon-mono.svg` is the status bar glyph source — it must be plain filled shapes so `svgtofont` can embed it as a font glyph. `icon.svg` is the richer coloured version displayed in the VS Code marketplace and the Extensions panel.

Note: `svgtofont` output is non-deterministic. `codex-local-meter.woff` changes on every rebuild even when `icon-mono.svg` has not changed, so generated icon outputs are ignored by git and should be recreated from the SVG sources.

## Troubleshooting

If the status bar shows no data:

1. Run **Codex Local Meter: Show Diagnostics**.
2. Confirm the reported Codex folder is correct.
3. If your Codex files live somewhere else, run **Codex Local Meter: Select Codex Folder**.
4. Check whether `sessions/` exists under that folder.

Malformed or changing JSONL files are treated as non-fatal parse issues. They appear in diagnostics so the extension can keep working while Codex is writing session files.

## Development

Install dependencies:

```powershell
npm install
```

Common npm scripts:

| Script | What it does | When to use it |
| --- | --- | --- |
| `npm run compile` | Runs `tsc -p ./` and writes compiled output to `out/`. | After TypeScript changes and before packaging. |
| `npm run watch` | Runs the TypeScript compiler in watch mode. | While actively editing TypeScript. |
| `npm run lint` | Runs ESLint over `src/**/*.ts`. | After source changes, before release packaging. |
| `npm run unit-test` | Runs the compiled Mocha unit tests for parser, calculator, and status text logic. | For logic-only changes. Run `npm run compile` first if `out/` is stale. |
| `npm test` | Compiles first, then runs the VS Code extension test runner. | When activation, commands, or VS Code APIs are touched. |
| `npm run vscode:prepublish` | Compiles the extension. | Used by VS Code packaging workflows. |

Examples:

```powershell
npm run compile
npm run lint
npm run unit-test
npm test
```

Package locally:

```powershell
npm run package:vsix
```

`package:vsix` calls `scripts/RebuildVsix.ps1`, which compiles, lints, runs unit tests, and then runs `npx vsce package`.

Version-bump packaging scripts:

| Script | Use when |
| --- | --- |
| `npm run package:patch` | Fixes or small internal changes, for example `0.1.1` -> `0.1.2`. |
| `npm run package:minor` | New backward-compatible features, for example `0.1.1` -> `0.2.0`. |
| `npm run package:major` | Breaking changes, for example `0.1.1` -> `1.0.0`. |

These scripts update `package.json` and `package-lock.json` with `npm version <patch|minor|major> --no-git-tag-version`, then run the same compile, lint, unit-test, and package flow.

You can also call the packaging script directly when you need options:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -Install
powershell -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -SkipLint
powershell -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -SkipUnitTests
powershell -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -VersionBump patch
```

Use the skip flags only for local iteration. Release packages should run lint and unit tests.

## Project Layout

- `src/extension.ts` activates the extension, registers commands, starts refresh timers, and wires watchers.
- `src/codexReader.ts` reads local Codex JSONL session files and extracts privacy-safe usage events.
- `src/usageCalculator.ts` aggregates usage windows and rate-limit values.
- `src/statusBar.ts` formats the status bar item and tooltip.
- `src/detailsPanel.ts` renders the details webview.
- `src/diagnostics.ts` writes privacy-safe diagnostics.
- `src/settingsManager.ts` reads and clamps VS Code settings.

## Packaging Notes

The extension manifest points at `out/extension.js`, so compile before packaging. The packaged extension details page is rendered from this README. If VS Code still shows "No README available", rebuild the `.vsix` and reinstall the newly packaged file.
