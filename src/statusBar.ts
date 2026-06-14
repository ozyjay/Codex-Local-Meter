import * as vscode from 'vscode';
import { UsageSummary } from './usageCalculator';
import { Settings } from './settingsManager';
import { formatPercent, formatRelativeFuture, formatTokens } from './usageCalculator';
import { buildStatusBarText } from './statusBarText';
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
        this.item.tooltip = buildTooltip(summary);
        const pct = usagePercent(summary);
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

function buildTooltip(summary: UsageSummary): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = { enabledCommands: ['codexLocalMeter.openStatus'] };
    md.supportThemeIcons = true;

    const percent = fiveHourPercent(summary);
    const value = fiveHourValue(summary);
    const source = summary.primaryUsedPercent !== undefined
        ? 'live local rate-limit data'
        : summary.isEstimated
        ? 'message-count estimate'
        : 'local token count';

    md.appendMarkdown('$(codex-local-meter) **Codex Local Meter**\n\n');
    md.appendMarkdown(`![5-hour usage meter](${circularMeterDataUri(percent, value)})\n\n`);
    md.appendMarkdown(`$(watch) 5-hour limit: **${escapeMarkdown(value)}**\n\n`);
    const primaryRemaining = formatRelativeFuture(summary.primaryResetsAt);
    const secondaryRemaining = formatRelativeFuture(summary.secondaryResetsAt);
    if (primaryRemaining) {
        md.appendMarkdown(`$(clock) 5-hour reset: **${escapeMarkdown(primaryRemaining)} left**\n\n`);
    }
    if (secondaryRemaining) {
        md.appendMarkdown(`$(calendar) 7-day reset: **${escapeMarkdown(secondaryRemaining)} left**\n\n`);
    }
    md.appendMarkdown(`\`${escapeCode(source)}\`\n\n`);

    md.appendMarkdown('---\n\n');
    md.appendMarkdown('$(go-to-file) [Open details panel](command:codexLocalMeter.openStatus)');

    return md;
}

function fiveHourPercent(summary: UsageSummary): number | undefined {
    if (summary.primaryUsedPercent !== undefined) {
        return summary.primaryUsedPercent;
    }

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

function fiveHourValue(summary: UsageSummary): string {
    if (summary.primaryUsedPercent !== undefined) {
        return `${formatPercent(summary.primaryUsedPercent)}% used`;
    }
    if (summary.isEstimated) {
        return `~${summary.fiveHourMessages ?? 0} messages`;
    }
    return `${formatTokens(summary.fiveHourTokens) ?? '0'} tokens`;
}

function circularMeterDataUri(percent: number | undefined, value: string): string {
    const numericPercent = percent === undefined
        ? 0
        : Math.max(0, Math.min(100, Math.round(percent)));
    const circumference = 326.73;
    const dashOffset = circumference - (circumference * numericPercent / 100);
    const centerText = percent === undefined
        ? '5h'
        : `${formatPercent(numericPercent)}%`;
    const detailText = percent === undefined
        ? value
        : 'used';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="188" height="188" viewBox="0 0 188 188" role="img" aria-label="5-hour usage ${escapeSvg(value)}">
  <rect width="188" height="188" rx="20" fill="transparent"/>
  <circle cx="94" cy="94" r="52" fill="none" stroke="#3c3c3c" stroke-width="16"/>
  <circle cx="94" cy="94" r="52" fill="none" stroke="#3794ff" stroke-width="16" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 94 94)"/>
  <text x="94" y="88" fill="#f2f2f2" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle">${escapeSvg(centerText)}</text>
  <text x="94" y="114" fill="#bdbdbd" font-family="Segoe UI, Arial, sans-serif" font-size="16" text-anchor="middle">${escapeSvg(detailText)}</text>
</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeMarkdown(value: string): string {
    return value.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
}

function escapeCode(value: string): string {
    return value.replace(/`/g, '\\`');
}

function escapeSvg(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
