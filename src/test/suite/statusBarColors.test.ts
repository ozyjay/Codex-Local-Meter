import * as assert from 'assert';
import { Settings } from '../../settingsManager';
import { resolveStatusBarBackgroundToken, resolveStatusBarSeverity } from '../../statusBarColors';

const baseSettings: Settings = {
    codexPath: '/fake/.codex',
    refreshIntervalSeconds: 300,
    showFiveHourUsage: true,
    showWeeklyUsage: true,
    warningThresholdPercent: 70,
    dangerThresholdPercent: 90,
    compactMode: false,
};

suite('statusBarColors', () => {
    test('keeps warning and danger states out of filled status bar backgrounds', () => {
        assert.strictEqual(resolveStatusBarSeverity(75, baseSettings), 'warning');
        assert.strictEqual(resolveStatusBarSeverity(95, baseSettings), 'danger');
        assert.strictEqual(resolveStatusBarBackgroundToken(75, baseSettings), undefined);
        assert.strictEqual(resolveStatusBarBackgroundToken(95, baseSettings), undefined);
    });
});

