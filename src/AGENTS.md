# Source Agent Guide

This directory contains the extension implementation. Follow the root `AGENTS.md` first, then these source-specific rules.

## Module Boundaries

- Keep `extension.ts` focused on wiring and lifecycle concerns.
- Keep `codexReader.ts` focused on discovery and extraction of privacy-safe `RawEvent` data.
- Keep `usageCalculator.ts` pure where possible; it should not depend on VS Code APIs or the filesystem.
- Keep `statusBar.ts`, `detailsPanel.ts`, and `diagnostics.ts` as presentation layers over `UsageSummary`.
- Keep settings reads in `settingsManager.ts` so defaults and clamping are centralized.

## Privacy And Safety

- Never pass raw JSONL records into UI modules.
- Do not add fields to `RawEvent` or `UsageSummary` that contain prompts, responses, tool outputs, file contents, or source snippets.
- Diagnostics may show paths and parse-error locations, but not line contents.

## VS Code API Use

- Register disposables with `context.subscriptions`.
- Dispose timers, watchers, panels, output channels, and status bar items.
- Avoid global mutable state outside VS Code lifecycle objects unless it is clearly bounded and tested.
- Use `vscode.MarkdownString` safely with `isTrusted = false` for tooltips.

## Webview Rules

- Escape all dynamic text with `escapeHtml`.
- Keep `enableScripts: false` unless scripts are required.
- Do not load external resources.
- Keep CSP restrictive.

## Error Handling

Refresh paths should degrade gracefully:

- Missing Codex directory: no usage data, no thrown error.
- Missing `sessions/`: no usage data, no thrown error.
- Malformed JSONL line: add a parse error and continue.
- Unreadable file or directory: add a parse error and continue.
