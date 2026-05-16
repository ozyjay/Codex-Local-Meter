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
| Rate-limit data found | `$(graph) 42.0% 5h` |
| Token counts found | `$(graph) 12.4k 5h` |
| Message-count fallback | `$(graph) ~12 msgs 5h` |
| No local data yet | `$(graph) --` |
| Compact mode | `$(graph) 42.0%` |

The status bar changes color when usage reaches the configured warning or danger threshold.

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

Package locally:

```powershell
npx vsce package
```

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
