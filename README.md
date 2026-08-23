# Codex Local Meter

Codex Local Meter shows a compact, local-only estimate of Codex CLI usage in the VS Code status bar. It reads local Codex session files from `~/.codex`, derives usage metadata, and keeps all data on your machine.

This extension is designed for people who want a quick view of recent Codex activity without sending session data anywhere.

## Highlights

- Status bar indicator for recent Codex usage.
- Compact tooltip showing the available primary and secondary rate limits from local Codex data.
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

The meter icon appears before each value. Example text:

| State | Example |
| --- | --- |
| Primary rate-limit data with a secondary reset in five days | `42% 5d` |
| Secondary rate-limit fallback with a reset in three days | `18% 3d` |
| Token counts found | `12.4k primary` |
| Message-count fallback | `~12 primary` |
| No local data yet | `--` |
| Compact token count | `12.4k` |

The status bar text changes color when usage reaches the configured warning or danger threshold.

### Hover Tooltip

The status bar tooltip shows a rate-limit card only when that limit was found in local Codex data. For example, if only the secondary limit is available, the tooltip shows only the secondary card. It does not display an empty or "unknown" primary card.

When neither rate limit is available, the tooltip shows one compact unavailable state and links to the details panel, where local token or message-count activity can still be viewed. The secondary tooltip card also respects the `showWeeklyUsage` setting.

## Details Panel

Run **Codex Local Meter: Open Status** or click the status bar item to open the details panel.

The panel shows:

- Primary activity or rate-limit usage.
- Secondary activity or rate-limit usage.
- Last detected Codex activity.
- Number of recently seen sessions.
- Model names detected in local metadata.
- Codex folder path being read.
- Whether token counts or rate-limit data were found.
- Reset timing when local Codex rate-limit data includes it.
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
| `showFiveHourUsage` | `true` | Show available primary usage in the status bar. |
| `showWeeklyUsage` | `true` | Show available secondary usage in the tooltip and status bar. |
| `warningThresholdPercent` | `70` | Show warning colors at or above this percentage. |
| `dangerThresholdPercent` | `90` | Show danger colors at or above this percentage. |
| `compactMode` | `false` | Hide primary and message suffixes in status-bar fallback text, such as `12.4k` instead of `12.4k primary`. |

## How Usage Is Estimated

Codex Local Meter scans local Codex JSONL session files and looks for usage-relevant records. When local rate-limit percentages are present, those values are shown first as primary and secondary limits. Codex may store either limit under either the `primary` or `secondary` field, so the extension identifies the limits by their reported duration rather than trusting a field name. When token counts are present, token totals are shown. When neither is available, the extension falls back to message counts and marks the result as an estimate.

The extension supports the available primary limit without assuming it is always present. Unavailable rate-limit cards are omitted from the hover tooltip.

These numbers are best-effort local estimates. They are not official billing records, account quota records, or service-side usage statements.

## Troubleshooting

If the status bar shows no data:

1. Run **Codex Local Meter: Show Diagnostics**.
2. Confirm the reported Codex folder is correct.
3. If your Codex files live somewhere else, run **Codex Local Meter: Select Codex Folder**.
4. Check whether `sessions/` exists under that folder.

Malformed or changing JSONL files are treated as non-fatal parse issues. They appear in diagnostics so the extension can keep working while Codex is writing session files.
