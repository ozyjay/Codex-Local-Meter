import * as assert from 'assert';
import { Settings } from '../../settingsManager';
import {
    resolveStatusBarBackgroundToken,
    resolveStatusBarForegroundToken,
    resolveStatusBarSeverity,
} from '../../statusBarColors';

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
    test('uses paired warning status bar tokens for warning text', () => {
        assert.strictEqual(resolveStatusBarSeverity(75, baseSettings), 'warning');
        assert.strictEqual(resolveStatusBarForegroundToken(75, baseSettings), 'statusBarItem.warningForeground');
        assert.strictEqual(resolveStatusBarBackgroundToken(75, baseSettings), 'statusBarItem.warningBackground');
    });

    test('uses paired error status bar tokens for danger text', () => {
        assert.strictEqual(resolveStatusBarSeverity(95, baseSettings), 'danger');
        assert.strictEqual(resolveStatusBarForegroundToken(95, baseSettings), 'statusBarItem.errorForeground');
        assert.strictEqual(resolveStatusBarBackgroundToken(95, baseSettings), 'statusBarItem.errorBackground');
    });

    test('leaves normal and unknown usage with default theme colors', () => {
        assert.strictEqual(resolveStatusBarForegroundToken(25, baseSettings), undefined);
        assert.strictEqual(resolveStatusBarBackgroundToken(25, baseSettings), undefined);
        assert.strictEqual(resolveStatusBarForegroundToken(undefined, baseSettings), undefined);
        assert.strictEqual(resolveStatusBarBackgroundToken(undefined, baseSettings), undefined);
    });

    test('lets danger take precedence at the danger threshold', () => {
        assert.strictEqual(resolveStatusBarSeverity(90, baseSettings), 'danger');
        assert.strictEqual(resolveStatusBarForegroundToken(90, baseSettings), 'statusBarItem.errorForeground');
        assert.strictEqual(resolveStatusBarBackgroundToken(90, baseSettings), 'statusBarItem.errorBackground');
    });
});
