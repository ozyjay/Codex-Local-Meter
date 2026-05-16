# Codex Local Meter

Codex Local Meter is a local-only VS Code extension that estimates Codex CLI usage from local Codex session files and shows a compact status bar indicator.

## Privacy Model

- No network calls.
- No telemetry.
- No writes to Codex session files.
- No prompt, response, code, or session content is displayed.
- The UI shows only derived metadata such as counts, percentages, timestamps, model names, session IDs, paths, and parse-error counts.

## Development

Install dependencies:

```powershell
npm install
```

Compile:

```powershell
npm run compile
```

Lint:

```powershell
npm run lint
```

Run logic-focused tests:

```powershell
npm run unit-test
```

Run the VS Code extension test runner:

```powershell
npm test
```

## Project Layout

- `src/extension.ts` activates the extension, registers commands, starts refresh timers, and wires watchers.
- `src/codexReader.ts` reads local Codex JSONL session files and extracts privacy-safe usage events.
- `src/usageCalculator.ts` aggregates usage windows and rate-limit values.
- `src/statusBar.ts` formats the status bar item and tooltip.
- `src/detailsPanel.ts` renders the details webview.
- `src/diagnostics.ts` writes privacy-safe diagnostics.
- `src/settingsManager.ts` reads and clamps VS Code settings.

## Settings

All settings are under `codexLocalMeter.*`:

- `codexPath`: override the Codex data directory. Empty means `~/.codex`.
- `refreshIntervalSeconds`: polling interval, minimum 30 seconds.
- `showFiveHourUsage`: show 5-hour usage in the status bar.
- `showWeeklyUsage`: show 7-day usage in the tooltip.
- `warningThresholdPercent`: warning threshold.
- `dangerThresholdPercent`: danger threshold.
- `compactMode`: use shorter status bar text.

## Packaging

The extension manifest points at `out/extension.js`, so compile before packaging. Packaged `*.vsix` files and build output are local artifacts and are ignored by git.
