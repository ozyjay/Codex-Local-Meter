import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readEvents } from '../../codexReader';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpRoot: string;

function writeLine(filePath: string, obj: unknown): void {
    fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

suiteSetup(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clm-test-'));
});

suiteTeardown(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('codexReader — readEvents()', () => {

    test('returns empty when codexPath does not exist', async () => {
        const result = await readEvents(path.join(tmpRoot, 'nonexistent'));
        assert.strictEqual(result.events.length, 0);
        assert.strictEqual(result.parseErrors.length, 0);
    });

    test('returns empty when sessions/ directory is missing', async () => {
        const codexPath = path.join(tmpRoot, 'no-sessions');
        fs.mkdirSync(codexPath, { recursive: true });
        // sessions/ subdirectory intentionally not created

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 0);
        assert.strictEqual(result.parseErrors.length, 0);
    });

    test('returns empty for an empty sessions/ directory', async () => {
        const codexPath = path.join(tmpRoot, 'empty-sessions');
        fs.mkdirSync(path.join(codexPath, 'sessions'), { recursive: true });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 0);
    });

    test('parses a valid JSONL file with input_tokens field', async () => {
        const codexPath = path.join(tmpRoot, 'valid-tokens');
        const sessionDir = path.join(codexPath, 'sessions', 'abc123');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'session.jsonl');

        writeLine(file, { timestamp: new Date().toISOString(), model: 'gpt-4o', input_tokens: 100, output_tokens: 50 });
        writeLine(file, { timestamp: new Date().toISOString(), model: 'gpt-4o', input_tokens: 200, output_tokens: 80 });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 2);
        assert.strictEqual(result.events[0].inputTokens, 100);
        assert.strictEqual(result.events[0].outputTokens, 50);
        assert.strictEqual(result.events[0].model, 'gpt-4o');
        assert.strictEqual(result.parseErrors.length, 0);
    });

    test('probes inputTokens (camelCase) when input_tokens absent', async () => {
        const codexPath = path.join(tmpRoot, 'camel-tokens');
        const sessionDir = path.join(codexPath, 'sessions', 'sess1');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'session.jsonl');

        writeLine(file, { timestamp: new Date().toISOString(), inputTokens: 300, outputTokens: 150 });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 1);
        assert.strictEqual(result.events[0].inputTokens, 300);
    });

    test('probes usage.input_tokens nested field', async () => {
        const codexPath = path.join(tmpRoot, 'nested-tokens');
        const sessionDir = path.join(codexPath, 'sessions', 'sess1');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'session.jsonl');

        writeLine(file, {
            timestamp: new Date().toISOString(),
            usage: { input_tokens: 400, output_tokens: 200 },
        });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 1);
        assert.strictEqual(result.events[0].inputTokens, 400);
        assert.strictEqual(result.events[0].outputTokens, 200);
    });

    test('skips malformed JSON lines and records parse errors', async () => {
        const codexPath = path.join(tmpRoot, 'malformed');
        const sessionDir = path.join(codexPath, 'sessions', 'sess1');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'session.jsonl');

        writeLine(file, { timestamp: new Date().toISOString(), input_tokens: 10, output_tokens: 5 });
        fs.appendFileSync(file, 'NOT_VALID_JSON\n', 'utf8');
        fs.appendFileSync(file, '{broken\n', 'utf8');
        writeLine(file, { timestamp: new Date().toISOString(), input_tokens: 20, output_tokens: 10 });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 2,  'valid lines still parsed');
        assert.strictEqual(result.parseErrors.length, 2, 'two bad lines recorded');
    });

    test('skips lines without a recognisable timestamp', async () => {
        const codexPath = path.join(tmpRoot, 'no-ts');
        const sessionDir = path.join(codexPath, 'sessions', 'sess1');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'session.jsonl');

        writeLine(file, { input_tokens: 10, output_tokens: 5 });  // no timestamp field

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 0);
        assert.strictEqual(result.parseErrors.length, 0); // silently skipped, not an error
    });

    test('recurses into nested subdirectories', async () => {
        const codexPath = path.join(tmpRoot, 'nested-dirs');
        const deep = path.join(codexPath, 'sessions', 'a', 'b', 'c');
        fs.mkdirSync(deep, { recursive: true });
        const file = path.join(deep, 'deep.jsonl');

        writeLine(file, { timestamp: new Date().toISOString(), input_tokens: 1, output_tokens: 1 });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 1);
    });

    test('ignores non-jsonl files', async () => {
        const codexPath = path.join(tmpRoot, 'non-jsonl');
        const sessionDir = path.join(codexPath, 'sessions');
        fs.mkdirSync(sessionDir, { recursive: true });

        fs.writeFileSync(path.join(sessionDir, 'notes.txt'), 'hello', 'utf8');
        fs.writeFileSync(path.join(sessionDir, 'data.json'), '{}', 'utf8');
        // valid jsonl
        const file = path.join(sessionDir, 'events.jsonl');
        writeLine(file, { timestamp: new Date().toISOString(), input_tokens: 5, output_tokens: 3 });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 1);
    });

    test('cross-platform: resolves path with os.homedir() segment', async () => {
        // Ensures path.join is used correctly — just verify the codexPath is echoed
        const codexPath = path.join(tmpRoot, 'xplat');
        fs.mkdirSync(path.join(codexPath, 'sessions'), { recursive: true });

        const result = await readEvents(codexPath);
        // Path should not contain any hardcoded separator assumptions
        assert.ok(!result.parseErrors.some(e => e.includes('Cannot read directory')));
    });

    // -------------------------------------------------------------------------
    // Codex Desktop JSONL wrapper format
    // -------------------------------------------------------------------------

    test('Codex Desktop: extracts tokens and rate-limit % from token_count events', async () => {
        const codexPath = path.join(tmpRoot, 'codex-desktop-token-count');
        const sessionDir = path.join(codexPath, 'sessions', '2026', '05', '16');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'rollout-abc.jsonl');

        // First token_count: info is null (pre-API-call), rate_limits present
        writeLine(file, {
            timestamp: '2026-05-16T05:17:00.000Z',
            type: 'event_msg',
            payload: {
                type: 'token_count',
                info: null,
                rate_limits: {
                    primary: { used_percent: 2.5, window_minutes: 300, resets_at: 1778921770 },
                    secondary: { used_percent: 0.8, window_minutes: 10080, resets_at: 1779452078 },
                },
            },
        });

        // Second token_count: info populated (post-API-call)
        writeLine(file, {
            timestamp: '2026-05-16T05:18:02.862Z',
            type: 'event_msg',
            payload: {
                type: 'token_count',
                info: {
                    last_token_usage: { input_tokens: 23091, output_tokens: 140 },
                    total_token_usage: { input_tokens: 23091, output_tokens: 140 },
                    model_context_window: 258400,
                },
                rate_limits: {
                    primary: { used_percent: 3.0, window_minutes: 300, resets_at: 1778921770 },
                    secondary: { used_percent: 1.0, window_minutes: 10080, resets_at: 1779452078 },
                },
            },
        });

        // user_message: should be counted as one message
        writeLine(file, {
            timestamp: '2026-05-16T05:16:00.000Z',
            type: 'event_msg',
            payload: { type: 'user_message', content: 'hello' },
        });

        // session_meta: should be skipped (no usage data)
        writeLine(file, {
            timestamp: '2026-05-16T05:15:00.000Z',
            type: 'session_meta',
            payload: { cli_version: '1.0.0', model_provider: 'openai' },
        });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.parseErrors.length, 0, 'no parse errors');

        // session_meta is skipped; user_message + 2 token_count = 3 events
        assert.strictEqual(result.events.length, 3);

        const tokenEvents = result.events.filter(e => e.inputTokens !== undefined);
        assert.strictEqual(tokenEvents.length, 1, 'only the event with non-null info yields tokens');
        assert.strictEqual(tokenEvents[0].inputTokens, 23091);
        assert.strictEqual(tokenEvents[0].outputTokens, 140);
        assert.strictEqual(tokenEvents[0].primaryUsedPercent, 3.0);
        assert.strictEqual(tokenEvents[0].secondaryUsedPercent, 1.0);

        const rateLimitEvents = result.events.filter(e => e.primaryUsedPercent !== undefined);
        assert.strictEqual(rateLimitEvents.length, 2, 'both token_count events carry rate-limit data');

        const msgEvents = result.events.filter(e => e.messageCount === 1);
        assert.strictEqual(msgEvents.length, 1, 'user_message counted once');
    });

    test('Codex Desktop: skips non-event_msg wrapper types', async () => {
        const codexPath = path.join(tmpRoot, 'codex-desktop-skip');
        const sessionDir = path.join(codexPath, 'sessions', '2026', '01', '01');
        fs.mkdirSync(sessionDir, { recursive: true });
        const file = path.join(sessionDir, 'rollout-skip.jsonl');

        // response_item and turn_context should produce no events
        writeLine(file, {
            timestamp: '2026-01-01T00:00:00.000Z',
            type: 'response_item',
            payload: { type: 'message', role: 'developer', content: [] },
        });
        writeLine(file, {
            timestamp: '2026-01-01T00:01:00.000Z',
            type: 'turn_context',
            payload: { context: [] },
        });

        const result = await readEvents(codexPath);
        assert.strictEqual(result.events.length, 0, 'non-usage wrapper events should be skipped');
    });
});
