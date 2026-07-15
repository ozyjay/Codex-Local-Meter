import * as assert from 'assert';
import { buildTooltipDashboardDataUri } from '../../statusBarTooltipArt';
import { UsageSummary } from '../../usageCalculator';

function summary(overrides: Partial<UsageSummary>): UsageSummary {
    return {
        isEstimated: false,
        codexPath: '/fake/.codex',
        sessionCount: 4,
        modelNames: [],
        parseErrors: [],
        ...overrides,
    };
}

function decodeDataUri(uri: string): string {
    assert.ok(uri.startsWith('data:image/svg+xml,'));
    return decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
}

suite('statusBarTooltipArt - buildTooltipDashboardDataUri()', () => {
    test('renders a two-window rate-limit dashboard', () => {
        const now = Date.now();
        const svg = decodeDataUri(buildTooltipDashboardDataUri(
            summary({
                fiveHourUsedPercent: 29,
                sevenDayUsedPercent: 78,
                fiveHourResetsAt: new Date(now + 28 * 60_000),
                sevenDayResetsAt: new Date(now + (2 * 24 + 23) * 3_600_000),
                lastActivity: new Date(now - 5 * 60_000),
            }),
            {
                warningThresholdPercent: 70,
                dangerThresholdPercent: 90,
            }
        ));

        assert.ok(svg.includes('Codex Local Meter'));
        assert.ok(svg.includes('Local estimates only. No session content leaves your Mac.'));
        assert.ok(svg.includes('29% of 5-hour rate limit'));
        assert.ok(svg.includes('78% of 7-day rate limit'));
        assert.ok(svg.includes('Clears in 28 min'));
        assert.ok(svg.includes('Clears in 2 d 23 h'));
        assert.ok(svg.includes('Warning'));
        assert.ok(svg.includes('5 min ago'));
        assert.ok(svg.includes('fill="#111315"'));
        assert.ok(svg.includes('Based on the latest local Codex rate-'));
        assert.ok(svg.includes('limit event.'));
        assert.ok(!svg.includes('>Based on the latest local Codex rate-limit event.<'));
        assert.ok(!svg.includes('Refreshing'));
        assert.ok(!svg.includes('Diagnostics'));
    });

    test('renders weekly-only data without assigning it to the five-hour panel', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(
            summary({ sevenDayUsedPercent: 95 }),
            {
                warningThresholdPercent: 70,
                dangerThresholdPercent: 90,
            }
        ));

        assert.ok(svg.includes('5-hour usage not found'));
        assert.ok(svg.includes('95% of 7-day rate limit'));
        assert.ok(svg.includes('>Danger<'));
    });

    test('escapes dynamic text before embedding it in SVG', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(
            summary({
                codexPath: '/fake/<codex>&"sessions"',
                fiveHourUsedPercent: 1,
                sevenDayUsedPercent: 2,
            }),
            {
                warningThresholdPercent: 70,
                dangerThresholdPercent: 90,
            }
        ));

        assert.ok(svg.includes('/fake/&lt;codex&gt;&amp;&quot;sessions&quot;'));
        assert.ok(!svg.includes('/fake/<codex>&"sessions"'));
    });
});
