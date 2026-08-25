import * as assert from 'assert';
import { buildTooltipDashboardDataUri, formatDurationLabel } from '../../statusBarTooltipArt';
import { UsageSummary } from '../../usageCalculator';

function summary(overrides: Partial<UsageSummary>): UsageSummary {
    return {
        isEstimated: false,
        codexPath: '/fake/.codex',
        sessionCount: 4,
        modelNames: [],
        parseErrors: [],
        rateLimits: {},
        ...overrides,
    };
}

function decodeDataUri(uri: string): string {
    assert.ok(uri.startsWith('data:image/svg+xml,'));
    return decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
}

suite('statusBarTooltipArt - buildTooltipDashboardDataUri()', () => {
    test('renders Primary and Secondary using their reported identities and durations', () => {
        const now = Date.now();
        const svg = decodeDataUri(buildTooltipDashboardDataUri(summary({
            rateLimits: {
                primary: { usedPercent: 29, windowMinutes: 10_080, resetsAt: new Date(now + (2 * 24 + 23) * 3_600_000) },
                secondary: { usedPercent: 78, windowMinutes: 300, resetsAt: new Date(now + 28 * 60_000) },
            },
            lastActivity: new Date(now - 5 * 60_000),
        }), {
            warningThresholdPercent: 70,
            dangerThresholdPercent: 90,
        }));

        assert.ok(svg.includes('>Primary<'));
        assert.ok(svg.includes('>Secondary<'));
        assert.ok(svg.includes('Weekly limit'));
        assert.ok(svg.includes('5-hour limit'));
        assert.ok(svg.includes('29% used'));
        assert.ok(svg.includes('78% used'));
        assert.ok(svg.includes('Resets in 2 d 23 h'));
        assert.ok(svg.includes('Resets in 28 min'));
        assert.ok(svg.includes('Warning'));
    });

    test('renders Primary-only weekly data as Primary', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(summary({
            rateLimits: { primary: { usedPercent: 88, windowMinutes: 10_080 } },
        }), {
            warningThresholdPercent: 70,
            dangerThresholdPercent: 90,
        }));

        assert.ok(svg.includes('>Primary<'));
        assert.ok(!svg.includes('>Secondary<'));
        assert.ok(svg.includes('Weekly limit'));
        assert.ok(svg.includes('88% used'));
    });

    test('omits unavailable Secondary and honours the Secondary display setting', () => {
        const onlyPrimary = decodeDataUri(buildTooltipDashboardDataUri(summary({
            rateLimits: { primary: { usedPercent: 20 }, secondary: undefined },
        }), { warningThresholdPercent: 70, dangerThresholdPercent: 90 }));
        assert.ok(onlyPrimary.includes('>Primary<'));
        assert.ok(!onlyPrimary.includes('>Secondary<'));

        const hiddenSecondary = decodeDataUri(buildTooltipDashboardDataUri(summary({
            rateLimits: { primary: { usedPercent: 20 }, secondary: { usedPercent: 95 } },
        }), {
            warningThresholdPercent: 70,
            dangerThresholdPercent: 90,
            showSecondaryUsage: false,
        }));
        assert.ok(hiddenSecondary.includes('>Primary<'));
        assert.ok(!hiddenSecondary.includes('>Secondary<'));
        assert.ok(hiddenSecondary.includes('>Normal<'));
    });

    test('renders a duration-only rate limit without inventing usage', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(summary({
            rateLimits: { primary: { windowMinutes: 90 } },
        }), { warningThresholdPercent: 70, dangerThresholdPercent: 90 }));

        assert.ok(svg.includes('Usage not reported'));
        assert.ok(svg.includes('90-minute limit'));
        assert.ok(svg.includes('>Unavailable<'));
    });

    test('renders a compact unavailable state without limits', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(summary({
            fiveHourTokens: 12_000,
            sevenDayTokens: 48_000,
        }), { warningThresholdPercent: 70, dangerThresholdPercent: 90 }));

        assert.ok(svg.includes('Rate-limit data not found'));
        assert.ok(!svg.includes('>Primary<'));
        assert.ok(!svg.includes('>Secondary<'));
    });
});

suite('statusBarTooltipArt - formatDurationLabel()', () => {
    test('uses friendly and generic duration labels', () => {
        assert.strictEqual(formatDurationLabel(300), '5-hour limit');
        assert.strictEqual(formatDurationLabel(10_080), 'Weekly limit');
        assert.strictEqual(formatDurationLabel(90), '90-minute limit');
        assert.strictEqual(formatDurationLabel(undefined), 'Duration not reported');
    });
});
