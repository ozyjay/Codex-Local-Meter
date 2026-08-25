import { Settings } from './settingsManager';
import { RateLimitWindow } from './codexReader';
import { UsageSummary, formatPercent, formatTokens } from './usageCalculator';

const statusBarIcon = '$(codex-local-meter)';

export function buildStatusBarText(
    summary: UsageSummary,
    settings: Settings,
    nowMs: number = Date.now()
): string {
    const icon = statusBarIcon;

    if (summary.sessionCount === 0 && summary.parseErrors.length === 0) {
        return `${icon} --`;
    }

    if (settings.compactMode) {
        return buildCompactText(summary, settings);
    }

    return buildFullText(summary, settings, nowMs);
}

/** Returns the authoritative rate-limit percentage represented in the status text. */
export function selectStatusBarUsagePercent(
    summary: UsageSummary,
    settings: Settings
): number | undefined {
    return selectStatusBarRateLimit(summary, settings)?.usedPercent;
}

function buildFullText(summary: UsageSummary, settings: Settings, nowMs: number): string {
    const icon = statusBarIcon;
    const rateLimit = selectStatusBarRateLimit(summary, settings);
    if (rateLimit?.usedPercent !== undefined) {
        const resetSuffix = formatResetSuffix(rateLimit.resetsAt, nowMs);
        return `${icon} ${formatPercent(rateLimit.usedPercent)}%${resetSuffix}`;
    }

    if (!settings.showPrimaryUsage) {
        return icon;
    }

    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} ~${msgs} 5h`;
    }

    const tokens = summary.fiveHourTokens ?? 0;
    const formatted = formatTokens(tokens) ?? '0';
    return `${icon} ${formatted} 5h`;
}

function selectStatusBarRateLimit(summary: UsageSummary, settings: Settings): RateLimitWindow | undefined {
    if (settings.showPrimaryUsage && summary.rateLimits.primary?.usedPercent !== undefined) {
        return summary.rateLimits.primary;
    }
    if (settings.showSecondaryUsage && summary.rateLimits.secondary?.usedPercent !== undefined) {
        return summary.rateLimits.secondary;
    }
    return undefined;
}

function formatResetSuffix(resetsAt: Date | undefined, nowMs: number): string {
    const resetMs = resetsAt?.getTime();
    if (resetMs === undefined || !Number.isFinite(resetMs) || resetMs <= nowMs) {
        return '';
    }

    const minutes = Math.ceil((resetMs - nowMs) / 60_000);
    if (minutes < 60) {
        return ` ${minutes}m`;
    }
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) {
        return ` ${hours}h`;
    }
    return ` ${Math.ceil(hours / 24)}d`;
}

function buildCompactText(summary: UsageSummary, settings: Settings): string {
    const icon = statusBarIcon;

    const rateLimit = selectStatusBarRateLimit(summary, settings);
    if (rateLimit?.usedPercent !== undefined) {
        return `${icon} ${formatPercent(rateLimit.usedPercent)}%`;
    }
    if (!settings.showPrimaryUsage) {
        return icon;
    }
    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} ~${msgs}`;
    }
    const tokens = formatTokens(summary.fiveHourTokens ?? 0) ?? '0';
    return `${icon} ${tokens}`;
}
