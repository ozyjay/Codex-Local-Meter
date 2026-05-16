import * as vscode from 'vscode';
import { UsageSummary } from './usageCalculator';
import { formatTokens, formatRelativeTime } from './usageCalculator';

const VIEW_TYPE = 'codexLocalMeter.details';
const TITLE = 'Codex Local Meter';

export class DetailsPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private lastSummary: UsageSummary | undefined;

    /** Opens (or reveals) the panel and renders the latest summary. */
    show(summary: UsageSummary, extensionUri: vscode.Uri): void {
        this.lastSummary = summary;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            this.panel.webview.html = buildHtml(this.panel.webview, summary, extensionUri);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            VIEW_TYPE,
            TITLE,
            vscode.ViewColumn.One,
            {
                enableScripts: false,           // no JS needed — pure HTML/CSS
                retainContextWhenHidden: false,
                localResourceRoots: [],         // no local file access
            }
        );

        this.panel.webview.html = buildHtml(this.panel.webview, summary, extensionUri);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /** Push a fresh summary to an already-open panel, if one exists. */
    update(summary: UsageSummary, extensionUri: vscode.Uri): void {
        this.lastSummary = summary;
        if (this.panel) {
            this.panel.webview.html = buildHtml(this.panel.webview, summary, extensionUri);
        }
    }

    /** Returns true if the panel tab exists (open or in background). */
    isOpen(): boolean {
        return this.panel !== undefined;
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function buildHtml(
    _webview: vscode.Webview,
    summary: UsageSummary,
    _extensionUri: vscode.Uri
): string {
    const estimateNote = summary.primaryUsedPercent !== undefined
        ? '<p class="note ok">✓ Live rate-limit data found in local Codex files.</p>'
        : summary.isEstimated
        ? '<p class="note">⚠ Token counts were not found in local Codex files. ' +
          'Activity figures below are <strong>message-count estimates only</strong>.</p>'
        : '<p class="note ok">✓ Token counts found in local Codex files.</p>';

    const fiveHourValue = summary.primaryUsedPercent !== undefined
        ? `${summary.primaryUsedPercent.toFixed(1)}% of 5-hour rate limit`
        : summary.isEstimated
        ? `~${summary.fiveHourMessages ?? 0} messages`
        : `${formatTokens(summary.fiveHourTokens) ?? '0'} tokens`;

    const sevenDayValue = summary.secondaryUsedPercent !== undefined
        ? `${summary.secondaryUsedPercent.toFixed(1)}% of 7-day rate limit`
        : summary.isEstimated
        ? `~${summary.sevenDayMessages ?? 0} messages`
        : `${formatTokens(summary.sevenDayTokens) ?? '0'} tokens`;

    const lastActivity = formatRelativeTime(summary.lastActivity);
    const lastActivityFull = summary.lastActivity
        ? summary.lastActivity.toLocaleString()
        : '—';

    const models = summary.modelNames.length > 0
        ? escapeHtml(summary.modelNames.join(', '))
        : '—';

    const parseErrorRows = summary.parseErrors.length > 0
        ? summary.parseErrors
            .map(e => `<li>${escapeHtml(e)}</li>`)
            .join('\n')
        : '<li class="ok">None</li>';

    const refreshedAt = new Date().toLocaleString();

    // Strict CSP: no scripts, no external resources, inline styles only
    const csp = [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TITLE}</title>
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 32px;
      max-width: 680px;
    }
    h1 {
      font-size: 1.3em;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-foreground);
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-bottom: 20px;
    }
    .note {
      background: var(--vscode-inputValidation-warningBackground,
                       rgba(255,200,0,0.12));
      border-left: 3px solid var(--vscode-inputValidation-warningBorder,
                                  #cca700);
      padding: 8px 12px;
      margin-bottom: 20px;
      border-radius: 2px;
      font-size: 0.9em;
    }
    .note.ok {
      background: var(--vscode-inputValidation-infoBackground,
                       rgba(0,120,212,0.10));
      border-left-color: var(--vscode-inputValidation-infoBorder,
                              #0078d4);
    }
    section {
      margin-bottom: 28px;
    }
    h2 {
      font-size: 1em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border,
                                    rgba(128,128,128,0.3));
      padding-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 6px 8px;
      vertical-align: top;
    }
    td:first-child {
      width: 44%;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    tr:nth-child(even) td {
      background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.06));
    }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.92em;
      background: var(--vscode-textCodeBlock-background,
                       rgba(128,128,128,0.15));
      padding: 1px 4px;
      border-radius: 3px;
      word-break: break-all;
    }
    ul.errors {
      margin: 0;
      padding-left: 18px;
      font-size: 0.88em;
    }
    ul.errors li { margin-bottom: 3px; }
    ul.errors li.ok { color: var(--vscode-testing-iconPassed, #4caf50); }
    .footer {
      color: var(--vscode-descriptionForeground);
      font-size: 0.82em;
      margin-top: 32px;
      border-top: 1px solid var(--vscode-widget-border,
                                  rgba(128,128,128,0.3));
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <h1>Codex Local Meter</h1>
  <p class="subtitle">All figures are <strong>estimates</strong> derived from local Codex session files.</p>

  ${estimateNote}

  <section>
    <h2>Usage (estimates)</h2>
    <table>
      <tr><td>5-hour window</td><td>${fiveHourValue}</td></tr>
      <tr><td>7-day window</td><td>${sevenDayValue}</td></tr>
    </table>
  </section>

  <section>
    <h2>Activity</h2>
    <table>
      <tr><td>Last activity</td><td>${escapeHtml(lastActivity)} <span style="opacity:0.6">(${escapeHtml(lastActivityFull)})</span></td></tr>
      <tr><td>Sessions (7 d)</td><td>${summary.sessionCount}</td></tr>
      <tr><td>Models detected</td><td>${models}</td></tr>
    </table>
  </section>

  <section>
    <h2>Source</h2>
    <table>
      <tr><td>Codex path</td><td><code>${escapeHtml(summary.codexPath)}</code></td></tr>
      <tr><td>Token counts</td><td>${summary.isEstimated ? 'Not found — using message counts' : 'Found ✓'}</td></tr>
    </table>
  </section>

  <section>
    <h2>Parse issues (${summary.parseErrors.length})</h2>
    <ul class="errors">
      ${parseErrorRows}
    </ul>
  </section>

  <div class="footer">
    Refreshed at ${escapeHtml(refreshedAt)} &nbsp;·&nbsp;
    Local-only &nbsp;·&nbsp; No network calls &nbsp;·&nbsp; No telemetry
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
