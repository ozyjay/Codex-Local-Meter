import * as assert from 'assert';
import { Settings } from '../../settingsManager';
import { buildStatusBarText, selectStatusBarUsagePercent } from '../../statusBarText';
import { UsageSummary } from '../../usageCalculator';

const baseSettings: Settings = {
    codexPath: '/fake/.codex',
    refreshIntervalSeconds: 300,
    showPrimaryUsage: true,
    showSecondaryUsage: true,
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
        rateLimits: {},
        ...overrides,
    };
}

suite('statusBarText - buildStatusBarText()', () => {
    const nowMs = Date.UTC(2026, 6, 17, 0, 0, 0);

    test('prefers Primary and uses Primary reset time', () => {
        const text = buildStatusBarText(summary({
            rateLimits: {
                primary: { usedPercent: 42, windowMinutes: 10_080, resetsAt: new Date(nowMs + (4 * 24 + 2) * 3_600_000) },
                secondary: { usedPercent: 18, windowMinutes: 300, resetsAt: new Date(nowMs + 2 * 3_600_000) },
            },
        }), baseSettings, nowMs);

        assert.strictEqual(text, '$(codex-local-meter) 42% 5d');
    });

    test('uses Primary hour and minute reset suffixes', () => {
        assert.strictEqual(
            buildStatusBarText(summary({
                rateLimits: { primary: { usedPercent: 42, resetsAt: new Date(nowMs + 2 * 3_600_000) } },
            }), baseSettings, nowMs),
            '$(codex-local-meter) 42% 2h'
        );
        assert.strictEqual(
            buildStatusBarText(summary({
                rateLimits: { primary: { usedPercent: 42, resetsAt: new Date(nowMs + 28 * 60_000) } },
            }), baseSettings, nowMs),
            '$(codex-local-meter) 42% 28m'
        );
    });

    test('uses Secondary only when Primary is unavailable or hidden', () => {
        const secondary = { usedPercent: 18, windowMinutes: 10_080, resetsAt: new Date(nowMs + 3 * 24 * 3_600_000) };
        assert.strictEqual(
            buildStatusBarText(summary({ rateLimits: { secondary } }), baseSettings, nowMs),
            '$(codex-local-meter) 18% 3d'
        );
        assert.strictEqual(
            buildStatusBarText(summary({
                rateLimits: { primary: { usedPercent: 42 }, secondary },
            }), { ...baseSettings, showPrimaryUsage: false }, nowMs),
            '$(codex-local-meter) 18% 3d'
        );
    });

    test('uses Primary-only weekly data as Primary', () => {
        const text = buildStatusBarText(summary({
            rateLimits: { primary: { usedPercent: 88, windowMinutes: 10_080 } },
        }), baseSettings, nowMs);

        assert.strictEqual(text, '$(codex-local-meter) 88%');
        assert.strictEqual(selectStatusBarUsagePercent(summary({
            rateLimits: { primary: { usedPercent: 88, windowMinutes: 10_080 } },
        }), baseSettings), 88);
    });

    test('does not use hidden Secondary as a fallback', () => {
        const text = buildStatusBarText(summary({
            fiveHourTokens: 12_400,
            rateLimits: { secondary: { usedPercent: 18 } },
        }), { ...baseSettings, showSecondaryUsage: false });

        assert.strictEqual(text, '$(codex-local-meter) 12.4k 5h');
    });

    test('formats local activity fallback separately from rate-limit identities', () => {
        assert.strictEqual(
            buildStatusBarText(summary({ fiveHourTokens: 12_400, sevenDayTokens: 30_000 }), baseSettings),
            '$(codex-local-meter) 12.4k 5h'
        );
        assert.strictEqual(
            buildStatusBarText(summary({ isEstimated: true, fiveHourMessages: 12 }), baseSettings),
            '$(codex-local-meter) ~12 5h'
        );
    });

    test('formats compact mode and the no-data state', () => {
        assert.strictEqual(
            buildStatusBarText(summary({ rateLimits: { primary: { usedPercent: 42.5 } } }), { ...baseSettings, compactMode: true }),
            '$(codex-local-meter) 43%'
        );
        assert.strictEqual(
            buildStatusBarText(summary({ sessionCount: 0, isEstimated: true }), baseSettings),
            '$(codex-local-meter) --'
        );
    });
});
