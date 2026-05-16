import * as vscode from 'vscode';
import { UsageSummary } from './usageCalculator';
import { Settings } from './settingsManager';
import { formatTokens, formatRelativeTime } from './usageCalculator';

export class StatusBarManager implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.item.command = 'codexLocalMeter.openStatus';
        this.item.name = 'Codex Local Meter';
        this.item.text = '$(graph) Codex: …';
        this.item.show();
    }

    update(summary: UsageSummary, settings: Settings): void {
        this.item.text = buildText(summary, settings);
        this.item.tooltip = buildTooltip(summary, settings);
        const pct = usagePercent(summary);
        this.item.color = resolveColor(pct, settings);
        this.item.backgroundColor = resolveBackground(pct, settings);
    }

    /** Shows a transient "refreshing" indicator without waiting for the real data. */
    setRefreshing(): void {
        this.item.text = '$(sync~spin) Codex: …';
    }

    dispose(): void {
        this.item.dispose();
    }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function buildText(summary: UsageSummary, settings: Settings): string {
    const icon = '$(graph)';

    if (summary.sessionCount === 0 && summary.parseErrors.length === 0) {
        return `${icon} Codex: —`;
    }

    if (settings.compactMode) {
        return buildCompactText(summary);
    }

    return buildFullText(summary, settings);
}

function buildFullText(summary: UsageSummary, settings: Settings): string {
    const icon = '$(graph)';

    if (!settings.showFiveHourUsage) {
        return `${icon} Codex`;
    }

    // Prefer the authoritative rate-limit % from the Codex API
    if (summary.primaryUsedPercent !== undefined) {
        return `${icon} Codex: ${summary.primaryUsedPercent.toFixed(1)}% 5h`;
    }

    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `${icon} Codex: ~${msgs} msgs 5h`;
    }

    const tokens = summary.fiveHourTokens ?? 0;
    const formatted = formatTokens(tokens) ?? '0';
    return `${icon} Codex: ${formatted} 5h`;
}

function buildCompactText(summary: UsageSummary): string {
    if (summary.primaryUsedPercent !== undefined) {
        return `Codex ${summary.primaryUsedPercent.toFixed(1)}%`;
    }
    if (summary.isEstimated) {
        const msgs = summary.fiveHourMessages ?? 0;
        return `Codex ~${msgs}`;
    }
    const tokens = formatTokens(summary.fiveHourTokens ?? 0) ?? '0';
    return `Codex ${tokens}`;
}

// ---------------------------------------------------------------------------
// Tooltip (markdown)
// ---------------------------------------------------------------------------

function buildTooltip(summary: UsageSummary, settings: Settings): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = false;
    md.supportThemeIcons = true;

    const estimate = summary.isEstimated && summary.primaryUsedPercent === undefined
        ? ' *(estimates — no token counts found)*'
        : '';
    md.appendMarkdown(`**Codex Local Meter**${estimate}\n\n`);

    md.appendMarkdown('| | |\n|---|---|\n');

    if (settings.showFiveHourUsage) {
        if (summary.primaryUsedPercent !== undefined) {
            md.appendMarkdown(`| 5-hour rate limit | **${summary.primaryUsedPercent.toFixed(1)}%** used |\n`);
        } else if (summary.isEstimated) {
            md.appendMarkdown(`| 5-hour activity | ~${summary.fiveHourMessages ?? 0} messages |\n`);
        } else {
            md.appendMarkdown(`| 5-hour tokens | ${formatTokens(summary.fiveHourTokens) ?? '0'} |\n`);
        }
    }

    if (settings.showWeeklyUsage) {
        if (summary.secondaryUsedPercent !== undefined) {
            md.appendMarkdown(`| 7-day rate limit | **${summary.secondaryUsedPercent.toFixed(1)}%** used |\n`);
        } else if (summary.isEstimated) {
            md.appendMarkdown(`| 7-day activity | ~${summary.sevenDayMessages ?? 0} messages |\n`);
        } else {
            md.appendMarkdown(`| 7-day tokens | ${formatTokens(summary.sevenDayTokens) ?? '0'} |\n`);
        }
    }

    // Show token counts as supplemental context when rate-limit % is the primary metric
    if (summary.primaryUsedPercent !== undefined && !summary.isEstimated) {
        if (summary.fiveHourTokens !== undefined && settings.showFiveHourUsage) {
            md.appendMarkdown(`| 5-hour tokens | ${formatTokens(summary.fiveHourTokens) ?? '0'} |\n`);
        }
        if (summary.sevenDayTokens !== undefined && settings.showWeeklyUsage) {
            md.appendMarkdown(`| 7-day tokens | ${formatTokens(summary.sevenDayTokens) ?? '0'} |\n`);
        }
    }

    md.appendMarkdown(`| Last activity | ${formatRelativeTime(summary.lastActivity)} |\n`);
    md.appendMarkdown(`| Sessions (7 d) | ${summary.sessionCount} |\n`);

    if (summary.modelNames.length > 0) {
        md.appendMarkdown(`| Models | ${summary.modelNames.join(', ')} |\n`);
    }

    md.appendMarkdown(`| Codex path | \`${summary.codexPath}\` |\n`);
    md.appendMarkdown(`| Rate limits | ${summary.primaryUsedPercent !== undefined ? 'live ✓' : 'not found'} |\n`);
    md.appendMarkdown(`| Token counts | ${summary.isEstimated ? 'not found' : 'found ✓'} |\n`);

    if (summary.parseErrors.length > 0) {
        md.appendMarkdown(`| Parse errors | ${summary.parseErrors.length} (see Diagnostics) |\n`);
    }

    md.appendMarkdown('\n\n*Click to open details panel.*');

    return md;
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * Derives a 0–100 "usage percent" for color threshold purposes.
 * When token counts are available, uses the 5-hour window scaled to a
 * rolling peak (max seen so far in the 7-day window).
 * Falls back to message-count ratio when no tokens are present.
 * Returns undefined if there is no data to compare.
 */
function usagePercent(summary: UsageSummary): number | undefined {
    // Prefer the authoritative rate-limit % from the Codex API (primary = 5-hour window)
    if (summary.primaryUsedPercent !== undefined) {
        return summary.primaryUsedPercent;
    }

    // Fallback: estimate from token/message ratios
    if (summary.isEstimated) {
        const five = summary.fiveHourMessages;
        const seven = summary.sevenDayMessages;
        if (five === undefined || seven === undefined || seven === 0) {
            return undefined;
        }
        return Math.min(100, Math.round((five / (seven / (7 * 24 / 5))) * 100));
    }

    const five = summary.fiveHourTokens;
    const seven = summary.sevenDayTokens;
    if (five === undefined || seven === undefined || seven === 0) {
        return undefined;
    }
    return Math.min(100, Math.round((five / (seven / (7 * 24 / 5))) * 100));
}

function resolveColor(pct: number | undefined, settings: Settings): vscode.ThemeColor | undefined {
    if (pct === undefined) {
        return undefined;
    }
    if (pct >= settings.dangerThresholdPercent) {
        return new vscode.ThemeColor('statusBarItem.errorForeground');
    }
    if (pct >= settings.warningThresholdPercent) {
        return new vscode.ThemeColor('statusBarItem.warningForeground');
    }
    return undefined;
}

function resolveBackground(
    pct: number | undefined,
    settings: Settings
): vscode.ThemeColor | undefined {
    if (pct === undefined) {
        return undefined;
    }
    if (pct >= settings.dangerThresholdPercent) {
        return new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    if (pct >= settings.warningThresholdPercent) {
        return new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    return undefined;
}
