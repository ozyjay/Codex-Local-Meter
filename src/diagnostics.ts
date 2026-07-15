import * as fs from 'fs';
import * as vscode from 'vscode';
import { UsageSummary } from './usageCalculator';
import { formatRelativeTime, formatRelativeFuture } from './usageCalculator';

/**
 * Writes a human-readable diagnostics report to the output channel and reveals it.
 * Shows only paths, counts, and error types — never file contents or session data.
 */
export async function showDiagnostics(
    outputChannel: vscode.OutputChannel,
    summary: UsageSummary
): Promise<void> {
    const lines: string[] = [];
    const hr = '─'.repeat(52);

    lines.push(hr);
    lines.push(`  Codex Local Meter — Diagnostics`);
    lines.push(`  ${new Date().toLocaleString()}`);
    lines.push(hr);
    lines.push('');

    // Path health
    lines.push('PATH');
    lines.push(`  Codex folder : ${summary.codexPath}`);
    const pathStatus = await checkPath(summary.codexPath);
    lines.push(`  Folder exists: ${pathStatus.exists ? 'yes' : 'NO — folder not found'}`);
    if (pathStatus.exists) {
        lines.push(`  sessions/    : ${pathStatus.sessionsExists ? 'found' : 'not found'}`);
        lines.push(`  config.toml  : ${pathStatus.configExists ? 'found' : 'not found'}`);
        lines.push(`  auth.json    : ${pathStatus.authExists ? 'found (not read)' : 'not found'}`);
    }
    lines.push('');

    // Usage summary
    lines.push('USAGE (estimates)');
    lines.push(`  Sessions (7 d)  : ${summary.sessionCount}`);
    lines.push(`  Token counts    : ${summary.isEstimated ? 'NOT FOUND — using message counts' : 'found'}`);
    if (summary.isEstimated) {
        lines.push(`  5-hour messages : ~${summary.fiveHourMessages ?? 0}`);
        lines.push(`  7-day messages  : ~${summary.sevenDayMessages ?? 0}`);
    } else {
        lines.push(`  5-hour tokens   : ${summary.fiveHourTokens ?? 0}`);
        lines.push(`  7-day tokens    : ${summary.sevenDayTokens ?? 0}`);
    }
    lines.push(`  5-hour reset    : ${formatReset(summary.fiveHourResetsAt)}`);
    lines.push(`  7-day reset     : ${formatReset(summary.sevenDayResetsAt)}`);
    lines.push(`  Last activity   : ${formatRelativeTime(summary.lastActivity)}`);
    lines.push(`  Models detected : ${summary.modelNames.length > 0 ? summary.modelNames.join(', ') : '(none)'}`);
    lines.push('');

    // Parse errors
    lines.push(`PARSE ISSUES (${summary.parseErrors.length})`);
    if (summary.parseErrors.length === 0) {
        lines.push('  None.');
    } else {
        for (const err of summary.parseErrors) {
            lines.push(`  • ${err}`);
        }
    }
    lines.push('');

    lines.push('PRIVACY');
    lines.push('  Network calls  : none');
    lines.push('  Telemetry      : none');
    lines.push('  File writes    : none (read-only)');
    lines.push('  Content shown  : paths, counts, timestamps only');
    lines.push('');
    lines.push(hr);

    outputChannel.clear();
    for (const line of lines) {
        outputChannel.appendLine(line);
    }
    outputChannel.show(true /* preserveFocus */);
}

function formatReset(date: Date | undefined): string {
    const remaining = formatRelativeFuture(date);
    if (!date || !remaining) {
        return 'not found';
    }

    return `${remaining} left (${date.toLocaleString()})`;
}

interface PathStatus {
    exists: boolean;
    sessionsExists: boolean;
    configExists: boolean;
    authExists: boolean;
}

async function checkPath(codexPath: string): Promise<PathStatus> {
    const result: PathStatus = {
        exists: false,
        sessionsExists: false,
        configExists: false,
        authExists: false,
    };

    try {
        const stat = await fs.promises.stat(codexPath);
        result.exists = stat.isDirectory();
    } catch {
        return result;
    }

    result.sessionsExists = await pathExists(`${codexPath}/sessions`);
    result.configExists = await pathExists(`${codexPath}/config.toml`);
    result.authExists = await pathExists(`${codexPath}/auth.json`);

    return result;
}

async function pathExists(p: string): Promise<boolean> {
    try {
        await fs.promises.access(p);
        return true;
    } catch {
        return false;
    }
}
