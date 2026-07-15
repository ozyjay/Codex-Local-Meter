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
        assert.ok(svg.includes('Local only · No session content leaves your device'));
        assert.ok(svg.includes('5-hour limit'));
        assert.ok(svg.includes('7-day limit'));
        assert.ok(svg.includes('29% used'));
        assert.ok(svg.includes('78% used'));
        assert.ok(svg.includes('Resets in 28 min'));
        assert.ok(svg.includes('Resets in 2 d 23 h'));
        assert.ok(svg.includes('Warning'));
        assert.ok(svg.includes('5 min ago'));
        assert.ok(svg.includes('fill="#111315"'));
        assert.ok(svg.includes('height="360"'));
        assert.ok(!svg.includes('Based on the latest local Codex'));
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

        assert.ok(!svg.includes('5-hour limit'));
        assert.ok(!svg.includes('Usage not found'));
        assert.ok(svg.includes('7-day limit'));
        assert.ok(svg.includes('95% used'));
        assert.ok(svg.includes('>Danger<'));
        assert.ok(svg.includes('height="246"'));
    });

    test('renders one compact empty state when no rate-limit windows are available', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(
            summary({ fiveHourTokens: 12_000, sevenDayTokens: 48_000 }),
            {
                warningThresholdPercent: 70,
                dangerThresholdPercent: 90,
            }
        ));

        assert.ok(!svg.includes('5-hour limit'));
        assert.ok(!svg.includes('7-day limit'));
        assert.ok(svg.includes('Rate-limit data not found'));
        assert.ok(svg.includes('Open Details to view local activity estimates.'));
        assert.ok(svg.includes('>Unavailable<'));
        assert.ok(svg.includes('height="208"'));
    });

    test('hides the weekly row and ignores it for state when weekly usage is disabled', () => {
        const svg = decodeDataUri(buildTooltipDashboardDataUri(
            summary({ fiveHourUsedPercent: 20, sevenDayUsedPercent: 95 }),
            {
                warningThresholdPercent: 70,
                dangerThresholdPercent: 90,
                showWeeklyUsage: false,
            }
        ));

        assert.ok(svg.includes('5-hour limit'));
        assert.ok(!svg.includes('7-day limit'));
        assert.ok(svg.includes('>Normal<'));
        assert.ok(svg.includes('height="246"'));
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
