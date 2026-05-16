# Test Agent Guide

Tests live under `src/test` and compile to `out/test`.

## Test Strategy

- Prefer focused unit tests for parser and calculator behavior.
- Use synthetic records and temporary directories instead of real `~/.codex` data.
- Keep tests deterministic; avoid depending on the current machine's Codex sessions.
- When testing time windows, build dates relative to the test's captured `now` or use sufficiently clear offsets.

## Commands

- `npm run compile` builds tests into `out/test`.
- `npm run unit-test` runs the compiled parser and calculator unit tests.
- `npm test` runs the VS Code extension test runner.

## Coverage Expectations

Parser tests should cover:

- Empty or missing `sessions/`.
- Malformed JSONL lines.
- Codex Desktop wrapper events.
- Flat legacy token fields and nested `usage` fields.
- Message-count fallback.

Calculator tests should cover:

- Empty event arrays.
- Token-based summaries.
- Message-count estimated summaries.
- 5-hour and 7-day window boundaries.
- Direct rate-limit percentages taking priority when present.

Extension tests should stay light and verify activation, command registration, and lifecycle behavior without reading real user data.
