import { Settings } from './settingsManager';
import { UsageSummary, formatPercent, formatTokens } from './usageCalculator';

const statusBarIcon = '$(codex-local-meter)';

export function buildStatusBarText(summary: UsageSummary, settings: Settings): string {
    const icon = statusBarIcon;

    if (summary.sessionCount === 0 && summary.parseErrors.length === 0) {
        return `${icon} --`;
    }

    if (settings.compactMode) {
        return buildCompactText(summary, settings);
    }

    return buildFullText(summary, settings);
}

/** Returns the authoritative rate-limit percentage represented in the status text. */
export function selectStatusBarUsagePercent(
    summary: UsageSummary,
    settings: Settings
): number | undefined {
    if (settings.showFiveHourUsage && summary.fiveHourUsedPercent !== undefined) {
        return summary.fiveHourUsedPercent;
    }
    if (settings.showWeeklyUsage && summary.sevenDayUsedPercent !== undefined) {
        return summary.sevenDayUsedPercent;
    }
    return undefined;
}

function buildFullText(summary: UsageSummary, settings: Settings): string {
    const icon = statusBarIcon;

    if (settings.showFiveHourUsage && summary.fiveHourUsedPercent !== undefined) {
        return `${icon} ${formatPercent(summary.fiveHourUsedPercent)}%`;
    }

    if (settings.showWeeklyUsage && summary.sevenDayUsedPercent !== undefined) {
        return `${icon} ${formatPercent(summary.sevenDayUsedPercent)}% 7d`;
    }

    if (!settings.showFiveHourUsage) {
        return icon;
    }

    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} ~${msgs} msgs 5h`;
    }

    const tokens = summary.fiveHourTokens ?? 0;
    const formatted = formatTokens(tokens) ?? '0';
    return `${icon} ${formatted} 5h`;
}

function buildCompactText(summary: UsageSummary, settings: Settings): string {
    const icon = statusBarIcon;

    if (settings.showFiveHourUsage && summary.fiveHourUsedPercent !== undefined) {
        return `${icon} ${formatPercent(summary.fiveHourUsedPercent)}%`;
    }
    if (settings.showWeeklyUsage && summary.sevenDayUsedPercent !== undefined) {
        return `${icon} ${formatPercent(summary.sevenDayUsedPercent)}%`;
    }
    if (!settings.showFiveHourUsage) {
        return icon;
    }
    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} ~${msgs}`;
    }
    const tokens = formatTokens(summary.fiveHourTokens ?? 0) ?? '0';
    return `${icon} ${tokens}`;
}
