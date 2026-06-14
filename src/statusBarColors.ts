import { Settings } from './settingsManager';

export type StatusBarSeverity = 'warning' | 'danger';
export type StatusBarForegroundToken = 'statusBarItem.warningForeground' | 'statusBarItem.errorForeground';
export type StatusBarBackgroundToken = 'statusBarItem.warningBackground' | 'statusBarItem.errorBackground';

export function resolveStatusBarSeverity(
    pct: number | undefined,
    settings: Settings
): StatusBarSeverity | undefined {
    if (pct === undefined) {
        return undefined;
    }
    if (pct >= settings.dangerThresholdPercent) {
        return 'danger';
    }
    if (pct >= settings.warningThresholdPercent) {
        return 'warning';
    }
    return undefined;
}

export function resolveStatusBarBackgroundToken(
    pct: number | undefined,
    settings: Settings
): StatusBarBackgroundToken | undefined {
    const severity = resolveStatusBarSeverity(pct, settings);
    if (severity === 'danger') {
        return 'statusBarItem.errorBackground';
    }
    if (severity === 'warning') {
        return 'statusBarItem.warningBackground';
    }
    return undefined;
}

export function resolveStatusBarForegroundToken(
    pct: number | undefined,
    settings: Settings
): StatusBarForegroundToken | undefined {
    const severity = resolveStatusBarSeverity(pct, settings);
    if (severity === 'danger') {
        return 'statusBarItem.errorForeground';
    }
    if (severity === 'warning') {
        return 'statusBarItem.warningForeground';
    }
    return undefined;
}
