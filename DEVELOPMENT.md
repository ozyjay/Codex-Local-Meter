# Codex Local Meter Development

This document is for maintaining, packaging, and publishing Codex Local Meter. The user-facing README stays focused on what the extension does and how to use it.

## Install

Install dependencies:

```powershell
npm install
```

Packaging scripts use PowerShell Core (`pwsh`). On macOS or Linux, install PowerShell Core before running the package commands.

## Common Commands

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

`npm test` launches a VS Code Electron test instance. If it aborts with `SIGABRT` under a restricted shell or sandbox, rerun it in a normal terminal.

Keep `@vscode/vsce` current before publishing. Check the local version with:

```powershell
npx vsce --version
```

Update it when the packaging command warns about a newer release:

```powershell
npm install --save-dev @vscode/vsce@latest
```

## Image Assets

The `images/` directory contains both hand-authored source files and generated outputs.

| File | Kind | How to update |
| --- | --- | --- |
| `icon-mono.svg` | **Source** — hand-authored | Edit directly. Monochrome filled paths only (no stroke, no colour); font renderers discard those. |
| `icon.svg` | **Source** — hand-authored | Edit directly. Full-colour version used as the marketplace/extension thumbnail. |
| `codex-local-meter.woff` | **Generated** from `icon-mono.svg` | Rebuilt automatically by `scripts/RebuildVsix.ps1` via `svgtofont`. Do not hand-edit or commit. |
| `icon.png` | **Generated** from `icon.svg` | Rebuilt automatically by `scripts/RebuildVsix.ps1` via `@resvg/resvg-js-cli`. Do not hand-edit or commit. |

The two SVGs serve different purposes. `icon-mono.svg` is the status bar glyph source: it must be plain filled shapes so `svgtofont` can embed it as a font glyph. `icon.svg` is the richer coloured version displayed in the VS Code Marketplace and the Extensions panel.

Note: `svgtofont` output is non-deterministic. `codex-local-meter.woff` changes on every rebuild even when `icon-mono.svg` has not changed, so generated icon outputs are ignored by git and should be recreated from the SVG sources.

## Packaging

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

These scripts query the VS Code Marketplace for the current published version, compute the next version from that value, update `package.json` and `package-lock.json` with `npm version <next-version> --no-git-tag-version`, then run the same compile, lint, unit-test, and package flow. If the local package version already matches the computed next version, the script skips `npm version` and continues packaging. If the Marketplace version cannot be found, the script stops before changing the local version.

The package script checks native command exit codes explicitly. If `npm`, `npx`, `svgtofont`, `resvg`, lint, tests, or `vsce package` fail, the script stops instead of continuing with a stale or partial package.

You can also call the packaging script directly when you need options:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -Install
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -SkipLint
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -SkipUnitTests
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/RebuildVsix.ps1 -VersionBump patch
```

Use the skip flags only for local iteration. Release packages should run lint and unit tests.

## Publishing

Publish to the VS Code Marketplace:

1. Build a release package with the right version bump:

   ```powershell
   npm run package:patch
   ```

   Use `package:minor` or `package:major` instead when the change warrants it. The package script reads the current published Marketplace version first, then writes the next version locally before creating the `.vsix`.

2. Authenticate `vsce`.

   For local publishing with a Personal Access Token, create the token under the CrunchyCodes Azure DevOps organization:

   1. Open <https://dev.azure.com/crunchycodes/>.
   2. Use the profile menu to open **Personal access tokens**.
   3. Create a new token for the `crunchycodes` organization.
   4. Choose **Custom defined** scopes.
   5. Enable **Marketplace** -> **Manage**.
   6. Copy the token immediately; Azure DevOps will not show it again.

   Then log `vsce` in to the Marketplace publisher:

   ```powershell
   npx vsce login CrunchyCodes
   ```

   If you have recently logged in, there is no need to do this. Paste the PAT when prompted. Do not commit or store the token in this repository. Microsoft's current publishing docs note that global Azure DevOps PATs are retired on December 1, 2026; for automated publishing, prefer Microsoft Entra ID with `vsce publish --azure-credential`.

3. Publish the generated VSIX:

   ```powershell
   npx vsce publish --packagePath .\codex-local-meter-<version>.vsix
   ```

   Replace `<version>` with the version generated by the package step.

4. Verify the published extension:

   ```powershell
   npx vsce show CrunchyCodes.codex-local-meter
   ```

   Also check the Marketplace page: <https://marketplace.visualstudio.com/items?itemName=CrunchyCodes.codex-local-meter>

Official publishing reference: <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>

## Project Layout

- `src/extension.ts` activates the extension, registers commands, starts refresh timers, and wires watchers.
- `src/codexReader.ts` reads local Codex JSONL session files and extracts privacy-safe usage events.
- `src/usageCalculator.ts` aggregates usage windows and rate-limit values.
- `src/statusBar.ts` formats the status bar item and tooltip.
- `src/detailsPanel.ts` renders the details webview.
- `src/diagnostics.ts` writes privacy-safe diagnostics.
- `src/settingsManager.ts` reads and clamps VS Code settings.

## Packaging Notes

The extension manifest points at `out/extension.js`, so compile before packaging. The packaged extension details page is rendered from `README.md`; maintainer-only notes in `DEVELOPMENT.md` are excluded by `.vscodeignore`. If VS Code still shows "No README available", rebuild the `.vsix` and reinstall the newly packaged file.
