import { Settings } from './settingsManager';
import { UsageSummary, formatTokens } from './usageCalculator';

export function buildStatusBarText(summary: UsageSummary, settings: Settings): string {
    const icon = '$(graph)';

    if (summary.sessionCount === 0 && summary.parseErrors.length === 0) {
        return `${icon} --`;
    }

    if (settings.compactMode) {
        return buildCompactText(summary);
    }

    return buildFullText(summary, settings);
}

function buildFullText(summary: UsageSummary, settings: Settings): string {
    const icon = '$(graph)';

    if (!settings.showFiveHourUsage) {
        return icon;
    }

    if (summary.primaryUsedPercent !== undefined) {
        return `${icon} ${summary.primaryUsedPercent.toFixed(1)}% 5h`;
    }

    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} ~${msgs} msgs 5h`;
    }

    const tokens = summary.fiveHourTokens ?? 0;
    const formatted = formatTokens(tokens) ?? '0';
    return `${icon} ${formatted} 5h`;
}

function buildCompactText(summary: UsageSummary): string {
    const icon = '$(graph)';

    if (summary.primaryUsedPercent !== undefined) {
        return `${icon} ${summary.primaryUsedPercent.toFixed(1)}%`;
    }
    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} ~${msgs}`;
    }
    const tokens = formatTokens(summary.fiveHourTokens ?? 0) ?? '0';
    return `${icon} ${tokens}`;
}
