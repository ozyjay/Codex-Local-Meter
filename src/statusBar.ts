import * as vscode from 'vscode';
import { UsageSummary } from './usageCalculator';
import { Settings } from './settingsManager';
import { buildStatusBarText, selectStatusBarUsagePercent } from './statusBarText';
import { buildTooltipDashboardDataUri } from './statusBarTooltipArt';
import { resolveStatusBarBackgroundToken, resolveStatusBarForegroundToken } from './statusBarColors';

export class StatusBarManager implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.item.command = 'codexLocalMeter.openStatus';
        this.item.name = 'Codex Local Meter';
        this.item.text = '$(codex-local-meter) ...';
        this.item.show();
    }

    update(summary: UsageSummary, settings: Settings): void {
        this.item.text = buildText(summary, settings);
        this.item.tooltip = buildTooltip(summary, settings);
        const pct = usagePercent(summary, settings);
        this.item.color = resolveColor(pct, settings);
        this.item.backgroundColor = resolveBackground(pct, settings);
    }

    /** Shows a transient "refreshing" indicator without waiting for the real data. */
    setRefreshing(): void {
        this.item.text = '$(sync~spin) ...';
    }

    dispose(): void {
        this.item.dispose();
    }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function buildText(summary: UsageSummary, settings: Settings): string {
    return buildStatusBarText(summary, settings);
}

// ---------------------------------------------------------------------------
// Tooltip (markdown)
// ---------------------------------------------------------------------------

function buildTooltip(summary: UsageSummary, settings: Settings): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = { enabledCommands: ['codexLocalMeter.openStatus'] };
    md.supportThemeIcons = true;

    const dashboardUri = buildTooltipDashboardDataUri(summary, {
        warningThresholdPercent: settings.warningThresholdPercent,
        dangerThresholdPercent: settings.dangerThresholdPercent,
        showWeeklyUsage: settings.showWeeklyUsage,
    });

    md.appendMarkdown(`![Codex Local Meter rate-limit dashboard](${dashboardUri})\n\n`);
    md.appendMarkdown(
        '$(sync) [Refresh](command:codexLocalMeter.refreshNow)  ' +
        '$(folder-opened) [Folder](command:codexLocalMeter.selectCodexFolder)  ' +
        '$(tools) [Diagnostics](command:codexLocalMeter.showDiagnostics)  ' +
        '$(list-tree) [Details](command:codexLocalMeter.openStatus)'
    );

    return md;
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * Derives a 0–100 "usage percent" for color threshold purposes.
 * Prefers the authoritative window shown in the status text. When token counts
 * are available, the fallback uses the 5-hour window scaled to a rolling peak.
 * Falls back to message-count ratio when no tokens are present.
 * Returns undefined if there is no data to compare.
 */
function usagePercent(summary: UsageSummary, settings: Settings): number | undefined {
    const authoritativePercent = selectStatusBarUsagePercent(summary, settings);
    if (authoritativePercent !== undefined) {
        return authoritativePercent;
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
    const token = resolveStatusBarForegroundToken(pct, settings);
    return token === undefined ? undefined : new vscode.ThemeColor(token);
}

function resolveBackground(
    pct: number | undefined,
    settings: Settings
): vscode.ThemeColor | undefined {
    const token = resolveStatusBarBackgroundToken(pct, settings);
    return token === undefined ? undefined : new vscode.ThemeColor(token);
}
