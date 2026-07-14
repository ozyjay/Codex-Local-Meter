import * as path from 'path';
import * as vscode from 'vscode';
import { readEvents } from './codexReader';
import { calculate, UsageSummary } from './usageCalculator';
import { getSettings } from './settingsManager';
import { StatusBarManager } from './statusBar';
import { DetailsPanel } from './detailsPanel';
import { showDiagnostics } from './diagnostics';
import { createRefreshDebouncer, createRefreshScheduler } from './refreshScheduler';

const FILE_WATCH_REFRESH_DELAY_MS = 1_000;

export { UsageSummary };

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel('Codex Local Meter');
    const statusBar = new StatusBarManager();
    const detailsPanel = new DetailsPanel();
    context.subscriptions.push(outputChannel, statusBar, detailsPanel);

    // Core refresh: read events → calculate summary → update status bar + open panel if visible
    async function refresh(): Promise<UsageSummary> {
        const settings = getSettings();
        const { events, parseErrors } = await readEvents(settings.codexPath);
        const summary = calculate(events, settings.codexPath, parseErrors);
        statusBar.update(summary, settings);
        if (detailsPanel.isOpen()) {
            detailsPanel.update(summary, context.extensionUri);
        }
        outputChannel.appendLine(
            `[${new Date().toISOString()}] Refreshed — ` +
            `path: ${summary.codexPath}, sessions: ${summary.sessionCount}, ` +
            `estimated: ${summary.isEstimated}, parseErrors: ${summary.parseErrors.length}`
        );
        return summary;
    }
    const refreshScheduler = createRefreshScheduler(refresh);
    const requestRefresh = (): Promise<UsageSummary> => refreshScheduler.requestRefresh();
    const watchedFileRefresh = createRefreshDebouncer(
        () => { void requestRefresh(); },
        FILE_WATCH_REFRESH_DELAY_MS
    );

    // Auto-refresh timer — recreated whenever settings change
    let refreshTimer: ReturnType<typeof setInterval> | undefined;

    function startTimer(): void {
        if (refreshTimer !== undefined) {
            clearInterval(refreshTimer);
        }
        const { refreshIntervalSeconds } = getSettings();
        refreshTimer = setInterval(() => { void requestRefresh(); }, refreshIntervalSeconds * 1000);
    }

    let startupRefreshTimer: ReturnType<typeof setTimeout> | undefined;

    function scheduleStartupFollowUpRefresh(): void {
        startupRefreshTimer = setTimeout(() => { void requestRefresh(); }, 10_000);
    }

    // Dispose timers on deactivation
    context.subscriptions.push({ dispose: () => { if (refreshTimer !== undefined) { clearInterval(refreshTimer); } } });
    context.subscriptions.push({ dispose: () => { if (startupRefreshTimer !== undefined) { clearTimeout(startupRefreshTimer); } } });

    // File-system watcher — triggers an immediate refresh when session files are written
    let fsWatcher: vscode.FileSystemWatcher | undefined;

    function startWatcher(): void {
        fsWatcher?.dispose();
        const { codexPath } = getSettings();
        const sessionsUri = vscode.Uri.file(path.join(codexPath, 'sessions'));
        const pattern = new vscode.RelativePattern(sessionsUri, '**/*.jsonl');
        fsWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        const onActivity = () => { watchedFileRefresh.requestRefresh(); };
        fsWatcher.onDidChange(onActivity);
        fsWatcher.onDidCreate(onActivity);
    }

    // Dispose the watcher on deactivation
    context.subscriptions.push({ dispose: () => { fsWatcher?.dispose(); } });
    context.subscriptions.push(watchedFileRefresh);

    // Restart timer and watcher if any setting changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codexLocalMeter')) {
                startTimer();
                startWatcher();
                void requestRefresh();
            }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('codexLocalMeter.openStatus', async () => {
            const summary = await requestRefresh();
            detailsPanel.show(summary, context.extensionUri);
        }),

        vscode.commands.registerCommand('codexLocalMeter.refreshNow', async () => {
            statusBar.setRefreshing();
            await requestRefresh();
        }),

        vscode.commands.registerCommand('codexLocalMeter.selectCodexFolder', async () => {
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Codex Folder',
            });
            if (uris && uris.length > 0) {
                await vscode.workspace
                    .getConfiguration('codexLocalMeter')
                    .update('codexPath', uris[0].fsPath, vscode.ConfigurationTarget.Global);
                await requestRefresh();
            }
        }),

        vscode.commands.registerCommand('codexLocalMeter.openSettings', () => {
            void vscode.commands.executeCommand(
                'workbench.action.openSettings',
                '@ext:codex-local-meter.codex-local-meter'
            );
        }),

        vscode.commands.registerCommand('codexLocalMeter.showDiagnostics', async () => {
            const summary = await requestRefresh();
            await showDiagnostics(outputChannel, summary);
        })
    );

    startWatcher();
    // Initial load, followed by one short retry in case Codex writes session metadata during startup.
    await requestRefresh();
    startTimer();
    scheduleStartupFollowUpRefresh();
}

export function deactivate(): void {
    // Disposables cleaned up via context.subscriptions
}
