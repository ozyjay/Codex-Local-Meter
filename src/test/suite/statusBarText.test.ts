import * as assert from 'assert';
import { Settings } from '../../settingsManager';
import { buildStatusBarText } from '../../statusBarText';
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
    test('formats rate-limit usage without repeating the product name', () => {
        const text = buildStatusBarText(
            summary({ primaryUsedPercent: 42 }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) 42% 5h');
        assert.ok(!text.includes('Codex'));
    });

    test('preserves fractional rate-limit percentages', () => {
        const text = buildStatusBarText(
            summary({ primaryUsedPercent: 2.55 }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) 2.55% 5h');
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
            summary({ primaryUsedPercent: 42.5 }),
            { ...baseSettings, compactMode: true }
        );

        assert.strictEqual(text, '$(codex-local-meter) 42.5%');
    });

    test('formats no-data state quietly', () => {
        const text = buildStatusBarText(
            summary({ sessionCount: 0, isEstimated: true }),
            baseSettings
        );

        assert.strictEqual(text, '$(codex-local-meter) --');
    });
});
