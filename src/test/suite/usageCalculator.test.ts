import * as assert from 'assert';
import { calculate, formatTokens, formatRelativeTime, formatRelativeFuture } from '../../usageCalculator';
import { RawEvent } from '../../codexReader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<RawEvent> & { minsAgo: number }): RawEvent {
    const { minsAgo, ...rest } = overrides;
    return {
        sessionId: rest.sessionId ?? 'sess-1',
        timestamp: new Date(Date.now() - minsAgo * 60 * 1000),
        ...rest,
    };
}

// ---------------------------------------------------------------------------
// calculate()
// ---------------------------------------------------------------------------

suite('usageCalculator — calculate()', () => {

    test('empty events returns zero-state summary', () => {
        const s = calculate([], '/fake/.codex', []);
        assert.strictEqual(s.sessionCount, 0);
        assert.strictEqual(s.isEstimated, true);
        assert.strictEqual(s.fiveHourTokens, undefined);
        assert.strictEqual(s.fiveHourMessages, undefined);
        assert.deepStrictEqual(s.modelNames, []);
        assert.strictEqual(s.lastActivity, undefined);
        assert.strictEqual(s.codexPath, '/fake/.codex');
    });

    test('token-based path: sums input+output tokens correctly', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 10, inputTokens: 500, outputTokens: 200, sessionId: 's1' }),
            makeEvent({ minsAgo: 20, inputTokens: 300, outputTokens: 100, sessionId: 's2' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.isEstimated, false);
        assert.strictEqual(s.fiveHourTokens, 1100);   // 500+200+300+100
        assert.strictEqual(s.sevenDayTokens, 1100);
        assert.strictEqual(s.fiveHourMessages, undefined);
    });

    test('message-count fallback when no token fields present', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 5,  messageCount: 3, sessionId: 's1' }),
            makeEvent({ minsAgo: 15, messageCount: 2, sessionId: 's2' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.isEstimated, true);
        assert.strictEqual(s.fiveHourMessages, 5);
        assert.strictEqual(s.sevenDayMessages, 5);
        assert.strictEqual(s.fiveHourTokens, undefined);
    });

    test('events with no messageCount default to 1 message each in fallback', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 5, sessionId: 's1' }),   // no tokens, no messageCount
            makeEvent({ minsAgo: 10, sessionId: 's2' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.isEstimated, true);
        assert.strictEqual(s.fiveHourMessages, 2);
    });

    test('5-hour window excludes events older than 5 hours', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 10,  inputTokens: 100, outputTokens: 50,  sessionId: 's1' }),  // within 5h
            makeEvent({ minsAgo: 360, inputTokens: 900, outputTokens: 100, sessionId: 's2' }),  // 6h ago — outside 5h
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.fiveHourTokens, 150);    // only the 10-min-ago event
        assert.strictEqual(s.sevenDayTokens, 1150);   // both events
    });

    test('7-day window excludes events older than 7 days', () => {
        const eightDaysAgo = 8 * 24 * 60; // minutes
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 30,        inputTokens: 200, outputTokens: 100, sessionId: 's1' }),
            makeEvent({ minsAgo: eightDaysAgo, inputTokens: 999, outputTokens: 1, sessionId: 's2' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.sevenDayTokens, 300);   // old event excluded
    });

    test('sessionCount counts unique session IDs within 7-day window', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 1,  sessionId: 'a', inputTokens: 10, outputTokens: 5 }),
            makeEvent({ minsAgo: 2,  sessionId: 'a', inputTokens: 10, outputTokens: 5 }),
            makeEvent({ minsAgo: 3,  sessionId: 'b', inputTokens: 10, outputTokens: 5 }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.sessionCount, 2);
    });

    test('sessionCount excludes sessions older than 7 days', () => {
        const eightDaysAgo = 8 * 24 * 60; // minutes
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 30,          sessionId: 'recent', inputTokens: 10, outputTokens: 5 }),
            makeEvent({ minsAgo: eightDaysAgo, sessionId: 'old',    inputTokens: 10, outputTokens: 5 }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.sessionCount, 1, 'only the recent session should count');
    });

    test('modelNames collects unique model strings', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 1, model: 'gpt-4o',    inputTokens: 1, outputTokens: 1, sessionId: 's1' }),
            makeEvent({ minsAgo: 2, model: 'gpt-4o',    inputTokens: 1, outputTokens: 1, sessionId: 's2' }),
            makeEvent({ minsAgo: 3, model: 'o3',        inputTokens: 1, outputTokens: 1, sessionId: 's3' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.deepStrictEqual(s.modelNames, ['gpt-4o', 'o3']);
    });

    test('lastActivity is the most recent timestamp', () => {
        const t1 = new Date(Date.now() - 60_000);
        const t2 = new Date(Date.now() - 10_000);
        const events: RawEvent[] = [
            { sessionId: 's1', timestamp: t1, inputTokens: 1, outputTokens: 1 },
            { sessionId: 's2', timestamp: t2, inputTokens: 1, outputTokens: 1 },
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.lastActivity?.getTime(), t2.getTime());
    });

    test('parseErrors are passed through to summary', () => {
        const errs = ['file.jsonl:3: invalid JSON — skipped'];
        const s = calculate([], '/fake', errs);
        assert.deepStrictEqual(s.parseErrors, errs);
    });

    test('mixed events: token-based when at least one event has tokens', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 5, inputTokens: 100, outputTokens: 50, sessionId: 's1' }),
            makeEvent({ minsAgo: 6, messageCount: 3, sessionId: 's2' }), // no tokens
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.isEstimated, false);
        assert.strictEqual(s.fiveHourTokens, 150);
    });

    test('primaryUsedPercent: most-recent rate-limit % is tracked across events', () => {
        const now = Date.now();
        const olderPrimaryReset = new Date(now + 60 * 60_000);
        const newerPrimaryReset = new Date(now + 120 * 60_000);
        const newerSecondaryReset = new Date(now + 3 * 86_400_000);
        const events: RawEvent[] = [
            {
                sessionId: 's1',
                timestamp: new Date(now - 10_000), // older
                primaryUsedPercent: 2.5,
                secondaryUsedPercent: 0.8,
                primaryResetsAt: olderPrimaryReset,
            },
            {
                sessionId: 's1',
                timestamp: new Date(now - 5_000), // more recent
                inputTokens: 1000,
                outputTokens: 50,
                primaryUsedPercent: 3.0,
                secondaryUsedPercent: 1.0,
                primaryResetsAt: newerPrimaryReset,
                secondaryResetsAt: newerSecondaryReset,
            },
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.primaryUsedPercent, 3.0, 'most recent primary % wins');
        assert.strictEqual(s.secondaryUsedPercent, 1.0, 'most recent secondary % wins');
        assert.strictEqual(s.primaryResetsAt?.getTime(), newerPrimaryReset.getTime(), 'most recent primary reset wins');
        assert.strictEqual(s.secondaryResetsAt?.getTime(), newerSecondaryReset.getTime(), 'most recent secondary reset wins');
    });

    test('primaryUsedPercent: later event wins when rate-limit timestamps are equal', () => {
        const timestamp = new Date();
        const events: RawEvent[] = [
            {
                sessionId: 's1',
                timestamp,
                primaryUsedPercent: 2.0,
                secondaryUsedPercent: 1.0,
            },
            {
                sessionId: 's1',
                timestamp,
                inputTokens: 1000,
                outputTokens: 50,
                primaryUsedPercent: 6.0,
                secondaryUsedPercent: 2.0,
            },
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.primaryUsedPercent, 6.0, 'later same-timestamp primary % wins');
        assert.strictEqual(s.secondaryUsedPercent, 2.0, 'later same-timestamp secondary % wins');
    });

    test('primaryUsedPercent: undefined when no events carry rate-limit data', () => {
        const events: RawEvent[] = [
            makeEvent({ minsAgo: 5, inputTokens: 100, outputTokens: 50, sessionId: 's1' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.primaryUsedPercent, undefined);
        assert.strictEqual(s.secondaryUsedPercent, undefined);
    });

    test('primaryUsedPercent: ignores stale five-hour rate-limit values', () => {
        const events: RawEvent[] = [
            makeEvent({
                minsAgo: 301,
                inputTokens: 20,
                outputTokens: 10,
                primaryUsedPercent: 82,
                sessionId: 'old',
            }),
            makeEvent({ minsAgo: 1, inputTokens: 1, outputTokens: 2, sessionId: 'recent' }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.primaryUsedPercent, undefined);
        assert.strictEqual(s.fiveHourTokens, 3);
        assert.strictEqual(s.sevenDayTokens, 33);
        assert.strictEqual(s.primaryResetsAt, undefined);
    });

    test('secondaryUsedPercent: keeps older seven-day rate-limit values while still in the weekly window', () => {
        const events: RawEvent[] = [
            makeEvent({
                minsAgo: 4 * 24 * 60,
                inputTokens: 20,
                outputTokens: 10,
                secondaryUsedPercent: 41,
                secondaryResetsAt: new Date(Date.now() + 2 * 86_400_000),
                sessionId: 'weekly',
            }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.primaryUsedPercent, undefined);
        assert.strictEqual(s.secondaryUsedPercent, 41);
        assert.ok(s.secondaryResetsAt, 'secondary reset timestamp should be preserved');
    });

    test('secondaryUsedPercent: ignores seven-day rate-limit values after reset expiry', () => {
        const events: RawEvent[] = [
            makeEvent({
                minsAgo: 4 * 24 * 60,
                secondaryUsedPercent: 41,
                secondaryResetsAt: new Date(Date.now() - 60_000),
                sessionId: 'expired',
            }),
        ];
        const s = calculate(events, '/fake', []);
        assert.strictEqual(s.secondaryUsedPercent, undefined);
        assert.strictEqual(s.secondaryResetsAt, undefined);
    });
});

// ---------------------------------------------------------------------------
// formatRelativeFuture()
// ---------------------------------------------------------------------------

suite('usageCalculator — formatRelativeFuture()', () => {
    test('undefined returns undefined', () => {
        assert.strictEqual(formatRelativeFuture(undefined), undefined);
    });

    test('future minutes and hours are formatted compactly', () => {
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() + 25 * 60_000)), '25 min');
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() + 2 * 3_600_000)), '2 h');
    });

    test('future days are formatted with one decimal for partial days', () => {
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() + 36 * 3_600_000)), '1.5 d');
    });

    test('past dates return now', () => {
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() - 60_000)), 'now');
    });
});

// ---------------------------------------------------------------------------
// formatTokens()
// ---------------------------------------------------------------------------

suite('usageCalculator — formatTokens()', () => {
    test('undefined returns undefined', () => {
        assert.strictEqual(formatTokens(undefined), undefined);
    });

    test('small numbers returned as-is', () => {
        assert.strictEqual(formatTokens(0),   '0');
        assert.strictEqual(formatTokens(999), '999');
    });

    test('thousands formatted with k suffix', () => {
        assert.strictEqual(formatTokens(1000),  '1.0k');
        assert.strictEqual(formatTokens(12400), '12.4k');
        assert.strictEqual(formatTokens(999900), '999.9k');
    });

    test('near-million boundary rounds up to M, not 1000.0k', () => {
        // 999_950 and above would have rounded to "1000.0k" with naive .toFixed(1)
        assert.ok(!formatTokens(999_999)!.endsWith('k'), 'should use M suffix near 1 million');
        assert.strictEqual(formatTokens(999_999), '1.0M');
    });

    test('millions formatted with M suffix', () => {
        assert.strictEqual(formatTokens(1_000_000), '1.0M');
        assert.strictEqual(formatTokens(2_500_000), '2.5M');
    });
});

// ---------------------------------------------------------------------------
// formatRelativeTime()
// ---------------------------------------------------------------------------

suite('usageCalculator — formatRelativeTime()', () => {
    test('undefined returns "never"', () => {
        assert.strictEqual(formatRelativeTime(undefined), 'never');
    });

    test('less than 1 minute returns "just now"', () => {
        assert.strictEqual(formatRelativeTime(new Date(Date.now() - 30_000)), 'just now');
    });

    test('minutes ago', () => {
        assert.strictEqual(formatRelativeTime(new Date(Date.now() - 5 * 60_000)), '5 min ago');
    });

    test('hours ago', () => {
        assert.strictEqual(formatRelativeTime(new Date(Date.now() - 2 * 3_600_000)), '2 h ago');
    });

    test('days ago', () => {
        assert.strictEqual(formatRelativeTime(new Date(Date.now() - 3 * 86_400_000)), '3 d ago');
    });
});
