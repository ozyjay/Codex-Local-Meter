import * as assert from 'assert';
import { RawEvent } from '../../codexReader';
import { calculate, formatRelativeFuture, formatRelativeTime, formatTokens } from '../../usageCalculator';

function makeEvent(overrides: Partial<RawEvent> & { minsAgo: number }): RawEvent {
    const { minsAgo, ...rest } = overrides;
    return {
        sessionId: rest.sessionId ?? 'session-1',
        timestamp: new Date(Date.now() - minsAgo * 60_000),
        ...rest,
    };
}

suite('usageCalculator — calculate()', () => {
    test('returns a zero-state summary for no events', () => {
        const result = calculate([], '/fake/.codex', []);
        assert.strictEqual(result.sessionCount, 0);
        assert.strictEqual(result.isEstimated, true);
        assert.deepStrictEqual(result.rateLimits, {});
    });

    test('keeps fixed local activity estimates separate from rate limits', () => {
        const result = calculate([
            makeEvent({ minsAgo: 10, inputTokens: 500, outputTokens: 200, sessionId: 'one' }),
            makeEvent({ minsAgo: 360, inputTokens: 300, outputTokens: 100, sessionId: 'two' }),
        ], '/fake', []);

        assert.strictEqual(result.isEstimated, false);
        assert.strictEqual(result.fiveHourTokens, 700);
        assert.strictEqual(result.sevenDayTokens, 1_100);
        assert.deepStrictEqual(result.rateLimits, {});
    });

    test('keeps message-count fallback when token counts are unavailable', () => {
        const result = calculate([
            makeEvent({ minsAgo: 5, messageCount: 3 }),
            makeEvent({ minsAgo: 15, messageCount: 2 }),
        ], '/fake', []);

        assert.strictEqual(result.isEstimated, true);
        assert.strictEqual(result.fiveHourMessages, 5);
        assert.strictEqual(result.sevenDayMessages, 5);
    });

    test('preserves conventional Primary and Secondary limits without using duration as identity', () => {
        const primaryReset = new Date(Date.now() + 4 * 60 * 60_000);
        const secondaryReset = new Date(Date.now() + 6 * 24 * 60 * 60_000);
        const result = calculate([
            makeEvent({
                minsAgo: 2,
                rateLimits: {
                    primary: { usedPercent: 18, windowMinutes: 300, resetsAt: primaryReset },
                    secondary: { usedPercent: 42, windowMinutes: 10_080, resetsAt: secondaryReset },
                },
            }),
        ], '/fake', []);

        assert.strictEqual(result.rateLimits.primary?.usedPercent, 18);
        assert.strictEqual(result.rateLimits.primary?.windowMinutes, 300);
        assert.strictEqual(result.rateLimits.secondary?.usedPercent, 42);
        assert.strictEqual(result.rateLimits.secondary?.windowMinutes, 10_080);
    });

    test('keeps a Primary-only weekly limit as Primary', () => {
        const result = calculate([
            makeEvent({
                minsAgo: 2,
                rateLimits: {
                    primary: { usedPercent: 88, windowMinutes: 10_080, resetsAt: new Date(Date.now() + 5 * 24 * 60 * 60_000) },
                },
            }),
        ], '/fake', []);

        assert.strictEqual(result.rateLimits.primary?.usedPercent, 88);
        assert.strictEqual(result.rateLimits.primary?.windowMinutes, 10_080);
        assert.strictEqual(result.rateLimits.secondary, undefined);
    });

    test('keeps a Secondary limit independent of its duration', () => {
        const result = calculate([
            makeEvent({
                minsAgo: 2,
                rateLimits: {
                    secondary: { usedPercent: 7, windowMinutes: 299, resetsAt: new Date(Date.now() + 60 * 60_000) },
                },
            }),
        ], '/fake', []);

        assert.strictEqual(result.rateLimits.primary, undefined);
        assert.strictEqual(result.rateLimits.secondary?.usedPercent, 7);
        assert.strictEqual(result.rateLimits.secondary?.windowMinutes, 299);
    });

    test('uses the latest snapshot for each identity and clears explicitly unreported slots', () => {
        const result = calculate([
            makeEvent({
                minsAgo: 10,
                rateLimits: {
                    primary: { usedPercent: 10, windowMinutes: 300, resetsAt: new Date(Date.now() + 60 * 60_000) },
                    secondary: { usedPercent: 40, windowMinutes: 10_080, resetsAt: new Date(Date.now() + 6 * 24 * 60 * 60_000) },
                },
            }),
            makeEvent({
                minsAgo: 1,
                rateLimits: {
                    primary: { usedPercent: 15, windowMinutes: 300, resetsAt: new Date(Date.now() + 2 * 60 * 60_000) },
                },
            }),
        ], '/fake', []);

        assert.strictEqual(result.rateLimits.primary?.usedPercent, 15);
        assert.strictEqual(result.rateLimits.secondary, undefined);
    });

    test('retains a recent Primary lacking duration metadata without inferring one', () => {
        const result = calculate([
            makeEvent({ minsAgo: 30, rateLimits: { primary: { usedPercent: 33 } } }),
        ], '/fake', []);

        assert.strictEqual(result.rateLimits.primary?.usedPercent, 33);
        assert.strictEqual(result.rateLimits.primary?.windowMinutes, undefined);
    });

    test('discards expired and stale rate-limit snapshots', () => {
        const result = calculate([
            makeEvent({ minsAgo: 10, rateLimits: { primary: { usedPercent: 82, resetsAt: new Date(Date.now() - 60_000) } } }),
            makeEvent({ minsAgo: 25 * 60, rateLimits: { secondary: { usedPercent: 41 } } }),
        ], '/fake', []);

        assert.strictEqual(result.rateLimits.primary, undefined);
        assert.strictEqual(result.rateLimits.secondary, undefined);
    });
});

suite('usageCalculator — format helpers', () => {
    test('formats token counts', () => {
        assert.strictEqual(formatTokens(undefined), undefined);
        assert.strictEqual(formatTokens(999), '999');
        assert.strictEqual(formatTokens(12_400), '12.4k');
        assert.strictEqual(formatTokens(999_999), '1.0M');
        assert.strictEqual(formatTokens(2_500_000), '2.5M');
    });

    test('formats relative future values', () => {
        assert.strictEqual(formatRelativeFuture(undefined), undefined);
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() + 25 * 60_000)), '25 min');
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() + 2 * 3_600_000)), '2 h');
        assert.strictEqual(formatRelativeFuture(new Date(Date.now() - 60_000)), 'now');
    });

    test('formats relative activity times', () => {
        assert.strictEqual(formatRelativeTime(undefined), 'never');
        assert.strictEqual(formatRelativeTime(new Date(Date.now() - 30_000)), 'just now');
        assert.strictEqual(formatRelativeTime(new Date(Date.now() - 5 * 60_000)), '5 min ago');
    });
});
