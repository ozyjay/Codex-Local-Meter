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
        ...overrides,
    };
}

function occurrences(value: string, search: string): number {
    return value.split(search).length - 1;
}

suite('detailsPanel - buildDetailsHtml()', () => {
    test('renders each usage window once without a repeated usage headline or rows', () => {
        const html = buildDetailsHtml(summary({
            fiveHourTokens: 6_900_000,
            sevenDayTokens: 20_000_000,
            sevenDayUsedPercent: 5,
        }));

        assert.ok(html.includes('Usage windows'));
        assert.strictEqual(occurrences(html, 'metric-label">5-hour window'), 1);
        assert.strictEqual(occurrences(html, 'metric-label">7-day window'), 1);
        assert.ok(html.includes('6.9M <span>tokens</span>'));
        assert.ok(html.includes('5% <span>used</span>'));
        assert.ok(html.includes('20.0M local tokens'));
        assert.ok(html.includes('Local rate-limit data'));
        assert.ok(!html.includes('Current usage'));
        assert.ok(!html.includes('5-hour tokens</div>'));
        assert.ok(!html.includes('7-day rate limit</div>'));
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
