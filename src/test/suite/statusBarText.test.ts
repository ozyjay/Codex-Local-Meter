import * as assert from 'assert';
import { Settings } from '../../settingsManager';
import { buildStatusBarText, selectStatusBarUsagePercent } from '../../statusBarText';
import { UsageSummary } from '../../usageCalculator';

const baseSettings: Settings = {
    codexPath: '/fake/.codex',
    refreshIntervalSeconds: 300,
    showFiveHourUsage: true,
    showWeeklyUsage: true,
    warningThresholdPercent: 70,
    dangerThresholdPercent: 90,
    compactMode: false,
};

function summary(overrides: Partial<UsageSummary>): UsageSummary {
    return {
        isEstimated: false,
        codexPath: '/fake/.codex',
        sessionCount: 1,
        modelNames: [],
        parseErrors: [],
        ...overrides,
    };
}

suite('statusBarText - buildStatusBarText()', () => {
    const nowMs = Date.UTC(2026, 6, 17, 0, 0, 0);

    test('formats rate-limit usage without repeating the product name', () => {
        const text = buildStatusBarText(
            summary({ fiveHourUsedPercent: 42 }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) 42%');
        assert.ok(!text.includes('Codex'));
    });

    test('adds actual weekly days left to the current percentage in full mode', () => {
        const text = buildStatusBarText(
            summary({
                fiveHourUsedPercent: 42,
                sevenDayResetsAt: new Date(nowMs + (4 * 24 + 2) * 3_600_000),
            }),
            baseSettings,
            nowMs
        );

        assert.strictEqual(text, '$(codex-local-meter) 42% 5d');
    });

    test('rounds fractional rate-limit percentages to whole numbers', () => {
        const text = buildStatusBarText(
            summary({ fiveHourUsedPercent: 2.55 }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) 3%');
    });

    test('uses the weekly percentage and its actual reset countdown as a fallback', () => {
        const text = buildStatusBarText(
            summary({
                sevenDayUsedPercent: 18,
                sevenDayResetsAt: new Date(nowMs + 3 * 24 * 3_600_000),
            }),
            baseSettings,
            nowMs
        );

        assert.strictEqual(text, '$(codex-local-meter) 18% 3d');
    });

    test('does not invent days left when the weekly reset is unavailable', () => {
        const text = buildStatusBarText(
            summary({ fiveHourUsedPercent: 42 }),
            baseSettings,
            nowMs
        );

        assert.strictEqual(text, '$(codex-local-meter) 42%');
    });

    test('does not use the weekly fallback when weekly usage is hidden', () => {
        const text = buildStatusBarText(
            summary({ fiveHourTokens: 12400, sevenDayUsedPercent: 18 }),
            { ...baseSettings, showWeeklyUsage: false }
        );

        assert.strictEqual(text, '$(codex-local-meter) 12.4k 5h');
    });

    test('selects the weekly percentage for status-bar threshold coloring', () => {
        assert.strictEqual(
            selectStatusBarUsagePercent(summary({ sevenDayUsedPercent: 95 }), baseSettings),
            95
        );
    });

    test('formats token usage without repeating the product name', () => {
        const text = buildStatusBarText(
            summary({ fiveHourTokens: 12400, sevenDayTokens: 30000 }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) 12.4k 5h');
    });

    test('formats estimated message fallback without repeating the product name', () => {
        const text = buildStatusBarText(
            summary({ isEstimated: true, fiveHourMessages: 12, sevenDayMessages: 20 }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) ~12 msgs 5h');
    });

    test('formats compact mode with the icon and value only', () => {
        const text = buildStatusBarText(
            summary({ fiveHourUsedPercent: 42.5 }),
            { ...baseSettings, compactMode: true }
        );

        assert.strictEqual(text, '$(codex-local-meter) 43%');
    });

    test('formats weekly-only compact mode without the window suffix', () => {
        const text = buildStatusBarText(
            summary({ sevenDayUsedPercent: 18 }),
            { ...baseSettings, compactMode: true }
        );

        assert.strictEqual(text, '$(codex-local-meter) 18%');
    });

    test('formats no-data state quietly', () => {
        const text = buildStatusBarText(
            summary({ sessionCount: 0, isEstimated: true }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) --');
    });
});
