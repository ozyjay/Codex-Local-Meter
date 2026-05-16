import { Settings } from './settingsManager';

export type StatusBarSeverity = 'warning' | 'danger';

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
    _pct: number | undefined,
    _settings: Settings
): undefined {
    return undefined;
}
