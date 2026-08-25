import * as assert from 'assert';
import { buildDetailsHtml } from '../../detailsPanel';
import { UsageSummary } from '../../usageCalculator';

function summary(overrides: Partial<UsageSummary>): UsageSummary {
    return {
        isEstimated: false,
        codexPath: '/fake/.codex',
        sessionCount: 4,
        modelNames: ['gpt-5'],
        parseErrors: [],
        rateLimits: {},
        ...overrides,
    };
}

function occurrences(value: string, search: string): number {
    return value.split(search).length - 1;
}

suite('detailsPanel - buildDetailsHtml()', () => {
    test('renders Primary-only weekly data as Primary and omits Secondary', () => {
        const html = buildDetailsHtml(summary({
            rateLimits: { primary: { usedPercent: 37, windowMinutes: 10_080 } },
        }));

        assert.strictEqual(occurrences(html, 'metric-label">Primary'), 1);
        assert.strictEqual(occurrences(html, 'metric-label">Secondary'), 0);
        assert.ok(html.includes('37% <span>used</span>'));
        assert.ok(html.includes('Weekly limit'));
        assert.ok(html.includes('Local rate-limit data'));
    });

    test('renders both reported limits with their own durations', () => {
        const html = buildDetailsHtml(summary({
            rateLimits: {
                primary: { usedPercent: 18, windowMinutes: 300 },
                secondary: { usedPercent: 42, windowMinutes: 10_080 },
            },
        }));

        assert.strictEqual(occurrences(html, 'metric-label">Primary'), 1);
        assert.strictEqual(occurrences(html, 'metric-label">Secondary'), 1);
        assert.ok(html.includes('5-hour limit'));
        assert.ok(html.includes('Weekly limit'));
    });

    test('labels fallback values as local activity rather than Primary or Secondary', () => {
        const html = buildDetailsHtml(summary({
            fiveHourTokens: 6_900_000,
            sevenDayTokens: 20_000_000,
        }));

        assert.ok(html.includes('metric-label">5-hour local activity'));
        assert.ok(html.includes('metric-label">7-day local activity'));
        assert.ok(!html.includes('metric-label">Primary'));
        assert.ok(html.includes('6.9M <span>tokens</span>'));
    });

    test('escapes privacy-safe dynamic metadata', () => {
        const html = buildDetailsHtml(summary({
            codexPath: '/fake/<codex>&"sessions"',
            modelNames: ['model<&>'],
        }));

        assert.ok(html.includes('/fake/&lt;codex&gt;&amp;&quot;sessions&quot;'));
        assert.ok(html.includes('model&lt;&amp;&gt;'));
        assert.ok(!html.includes('/fake/<codex>&"sessions"'));
    });
});
