# Codex Local Meter Agent Guide

## Project Identity

Codex Local Meter is a VS Code extension that estimates local Codex CLI usage from files under the user's Codex data directory, usually `~/.codex`, and shows the result in the VS Code status bar.

The extension is intentionally local-only:

- Do not add network calls.
- Do not add telemetry, analytics, crash reporting, or remote logging.
- Do not write to, rename, delete, or normalize files under the user's Codex directory.
- Do not display prompt text, response text, code snippets, or other session content.
- Only display derived metadata such as counts, percentages, timestamps, model names, session IDs, file paths, and parse-error locations.
- Treat all usage values as estimates unless they are direct local rate-limit values found in Codex files.

## Stack

- Language: TypeScript with `strict` enabled.
- Runtime: VS Code extension host, CommonJS output.
- Entry point: `src/extension.ts`, compiled to `out/extension.js`.
- Tests: Mocha plus `@vscode/test-electron`.
- Linting: ESLint with `@typescript-eslint`.

## Useful Commands

- `npm run compile` checks TypeScript and writes `out/`.
- `npm run watch` runs the TypeScript compiler in watch mode.
- `npm run lint` checks TypeScript style.
- `npm run unit-test` runs the compiled unit tests directly with Mocha.
- `npm test` compiles first, then runs the VS Code extension test runner.
- `npm run vscode:prepublish` compiles before packaging.

Run `npm run compile` after TypeScript changes. Run `npm run lint` for source changes. Prefer `npm run unit-test` for logic-only changes and `npm test` when activation, commands, or VS Code APIs are touched.

## Architecture

- `src/extension.ts` wires activation, refresh flow, timers, file watchers, commands, and disposables.
- `src/settingsManager.ts` reads VS Code settings and resolves the Codex path.
- `src/codexReader.ts` discovers `sessions/**/*.jsonl` and extracts privacy-safe usage events.
- `src/usageCalculator.ts` aggregates raw events into 5-hour and 7-day summaries.
- `src/statusBar.ts` formats status bar text, tooltip content, and warning/danger colors.
- `src/detailsPanel.ts` renders the details webview without scripts or external resources.
- `src/diagnostics.ts` writes a privacy-safe diagnostics report to the output channel.
- `src/test/suite/` contains tests for parsing, calculation, and extension activation.

## Implementation Rules

- Keep file I/O asynchronous with `fs.promises`.
- Wrap file reads, directory scans, and JSON parsing so a bad or changing session file does not break the extension.
- Accumulate non-fatal parse or access issues in `parseErrors`; expose them through diagnostics instead of throwing from refresh paths.
- Use `os.homedir()` and `path.join()` for platform-aware paths.
- Avoid blocking the extension host with synchronous scans or large eager work.
- Keep webviews script-free unless a feature truly requires scripts. If scripts are introduced, add a nonce-based CSP and keep local resource roots narrow.
- Keep user-facing language honest: "estimate", "~", or "not found" should appear where data is incomplete or inferred.
- Do not introduce dependencies unless they materially reduce risk or complexity.

## Package Manifest Notes

When adding commands or settings, update both:

- `package.json` under `contributes.commands` or `contributes.configuration`.
- The relevant TypeScript wiring, usually `src/extension.ts` and `src/settingsManager.ts`.

Keep command IDs under the `codexLocalMeter.` prefix. Keep setting IDs under the `codexLocalMeter.` namespace.

## Testing Guidance

- Parser changes need tests that cover malformed JSONL, unknown schemas, and missing files.
- Calculator changes need deterministic synthetic `RawEvent[]` tests for token and message fallback paths.
- UI formatting changes should be covered through exported helpers when practical; otherwise verify through compile, lint, and extension tests.
- Any privacy-sensitive change should have a test or direct inspection proving prompt/response content is not rendered.

## Generated Files

Do not hand-edit generated build output under `out/`. Change `src/` and let `npm run compile` regenerate output.

Ignore local artifacts such as `node_modules/`, `.vscode-test/`, packaged `*.vsix` files, and `out/` unless the task explicitly concerns packaging output.
