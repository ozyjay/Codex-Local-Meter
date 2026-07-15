import * as vscode from 'vscode';
import { UsageSummary } from './usageCalculator';
import { formatPercent, formatTokens, formatRelativeTime, formatRelativeFuture } from './usageCalculator';

const VIEW_TYPE = 'codexLocalMeter.details';
const TITLE = 'Codex Local Meter';

export class DetailsPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private lastSummary: UsageSummary | undefined;

    /** Opens (or reveals) the panel and renders the latest summary. */
    show(summary: UsageSummary, _extensionUri: vscode.Uri): void {
        this.lastSummary = summary;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            this.panel.webview.html = buildDetailsHtml(summary);
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

        this.panel.webview.html = buildDetailsHtml(summary);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /** Push a fresh summary to an already-open panel, if one exists. */
    update(summary: UsageSummary, _extensionUri: vscode.Uri): void {
        this.lastSummary = summary;
        if (this.panel) {
            this.panel.webview.html = buildDetailsHtml(summary);
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

export function buildDetailsHtml(summary: UsageSummary): string {
    const hasRateLimitData = summary.fiveHourUsedPercent !== undefined
        || summary.sevenDayUsedPercent !== undefined;
    const hasTokenCounts = !summary.isEstimated;

    const dataState = hasRateLimitData
        ? 'Local rate-limit data'
        : hasTokenCounts
        ? 'Local token counts'
        : 'Message-count estimate';

    const fiveHourPrimary = summary.fiveHourUsedPercent !== undefined
        ? `${formatPercent(summary.fiveHourUsedPercent)}% used`
        : summary.isEstimated
        ? `~${summary.fiveHourMessages ?? 0} messages`
        : `${formatTokens(summary.fiveHourTokens) ?? '0'} tokens`;

    const sevenDayPrimary = summary.sevenDayUsedPercent !== undefined
        ? `${formatPercent(summary.sevenDayUsedPercent)}% used`
        : summary.isEstimated
        ? `~${summary.sevenDayMessages ?? 0} messages`
        : `${formatTokens(summary.sevenDayTokens) ?? '0'} tokens`;

    const fiveHourRemaining = formatRelativeFuture(summary.fiveHourResetsAt);
    const sevenDayRemaining = formatRelativeFuture(summary.sevenDayResetsAt);

    const fiveHourMeta = summary.fiveHourUsedPercent !== undefined
        ? fiveHourRemaining ? `Resets in ${fiveHourRemaining}` : 'Reset time not found'
        : summary.isEstimated ? 'Message-count estimate' : 'Local token count';
    const sevenDayMeta = summary.sevenDayUsedPercent !== undefined
        ? sevenDayRemaining ? `Resets in ${sevenDayRemaining}` : 'Reset time not found'
        : summary.isEstimated ? 'Message-count estimate' : 'Local token count';
    const fiveHourSupplement = summary.fiveHourUsedPercent !== undefined && hasTokenCounts
        ? `${formatTokens(summary.fiveHourTokens) ?? '0'} local tokens`
        : undefined;
    const sevenDaySupplement = summary.sevenDayUsedPercent !== undefined && hasTokenCounts
        ? `${formatTokens(summary.sevenDayTokens) ?? '0'} local tokens`
        : undefined;

    const lastActivity = formatRelativeTime(summary.lastActivity);
    const lastActivityFull = summary.lastActivity
        ? summary.lastActivity.toLocaleString()
        : '—';

    const modelBadges = summary.modelNames.length > 0
        ? summary.modelNames
            .map(model => `<span class="badge">${escapeHtml(model)}</span>`)
            .join('\n')
        : '<span class="muted">None detected</span>';

    const parseErrorRows = summary.parseErrors.length > 0
        ? summary.parseErrors
            .map(e => `<li>${escapeHtml(e)}</li>`)
            .join('\n')
        : '<li class="ok">None</li>';

    const refreshedAt = new Date().toLocaleString();
    const sourceNote = summary.isEstimated
        ? 'Token counts were not found in local Codex files, so activity is estimated from message counts.'
        : 'Token counts were found in local Codex files. Rate-limit percentages are shown when Codex records them locally.';

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
    :root {
      color-scheme: dark light;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
    }
    .shell {
      width: min(920px, 100%);
      margin: 0 auto;
      padding: 28px 32px 32px;
    }
    .hero {
      display: grid;
      grid-template-columns: 54px minmax(0, 1fr);
      gap: 16px;
      align-items: center;
      margin-bottom: 20px;
    }
    .mark {
      width: 54px;
      height: 54px;
      border-radius: 8px;
      filter: drop-shadow(0 8px 18px rgba(0,0,0,0.2));
    }
    h1 {
      font-size: 1.7rem;
      line-height: 1.08;
      font-weight: 700;
      margin: 0 0 5px;
      color: var(--vscode-foreground);
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 0.94rem;
      line-height: 1.35;
      margin: 0;
    }
    .summary-card {
      background: var(--vscode-editorWidget-background,
                       var(--vscode-sideBar-background));
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.32));
      border-radius: 8px;
      box-shadow: 0 18px 42px rgba(0,0,0,0.18);
      overflow: hidden;
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 24px 8px;
    }
    .eyebrow {
      color: var(--vscode-descriptionForeground);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0;
    }
    .pill {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      border-radius: 999px;
      padding: 3px 10px;
      border: 1px solid var(--vscode-badge-background, rgba(80,160,220,0.45));
      background: color-mix(in srgb, var(--vscode-badge-background, #2b6f9e) 18%, transparent);
      color: var(--vscode-badge-foreground, var(--vscode-foreground));
      font-weight: 600;
      white-space: nowrap;
    }
    .meter-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 10px 24px 20px;
    }
    .metric {
      min-height: 132px;
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.24));
      border-radius: 8px;
      padding: 14px 16px;
      background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.06));
    }
    .metric-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 2rem;
      line-height: 1.1;
      font-weight: 700;
    }
    .metric-value span {
      font-size: 1rem;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
    }
    .metric-meta {
      color: var(--vscode-descriptionForeground);
      font-size: 0.92rem;
      margin-top: 8px;
    }
    .metric-extra {
      color: var(--vscode-descriptionForeground);
      font-size: 0.86rem;
      margin-top: 6px;
    }
    .context-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 24px;
      margin: 0 24px;
      padding: 4px 0 18px;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.22));
    }
    .context-item {
      min-width: 0;
      padding-top: 14px;
    }
    .context-wide {
      grid-column: 1 / -1;
    }
    .context-label {
      color: var(--vscode-descriptionForeground);
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .context-value {
      min-width: 0;
      font-size: 0.98rem;
      line-height: 1.4;
    }
    .detail-meta {
      margin-top: 7px;
    }
    .bar {
      width: 100%;
      height: 7px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--vscode-progressBar-background, rgba(128,128,128,0.18));
    }
    .bar-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--vscode-charts-blue, #3794ff);
    }
    code {
      display: inline-block;
      max-width: 100%;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.96rem;
      background: var(--vscode-textCodeBlock-background,
                       rgba(128,128,128,0.15));
      padding: 4px 8px;
      border-radius: 6px;
      word-break: break-all;
    }
    .sections {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 0.72fr);
      gap: 18px;
      margin-top: 18px;
    }
    section {
      min-width: 0;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.28));
      padding-top: 16px;
    }
    h2 {
      font-size: 0.96rem;
      font-weight: 700;
      margin: 0 0 10px;
      color: var(--vscode-foreground);
    }
    .supporting {
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
      margin: 0;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      max-width: 100%;
      border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.28));
      border-radius: 999px;
      padding: 4px 9px;
      background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.06));
      word-break: break-word;
    }
    details {
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.28));
      margin-top: 18px;
      padding-top: 14px;
    }
    summary {
      cursor: default;
      font-weight: 700;
    }
    ul.errors {
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.92rem;
      line-height: 1.45;
    }
    ul.errors li {
      margin-bottom: 5px;
      word-break: break-word;
    }
    ul.errors li.ok {
      color: var(--vscode-testing-iconPassed, #4caf50);
    }
    .muted {
      color: var(--vscode-descriptionForeground);
    }
    .footer {
      color: var(--vscode-descriptionForeground);
      font-size: 0.86rem;
      margin-top: 24px;
      padding-bottom: 4px;
    }
    @media (max-width: 720px) {
      .shell {
        padding: 24px 18px;
      }
      .hero {
        grid-template-columns: 52px minmax(0, 1fr);
        gap: 14px;
      }
      .mark {
        width: 52px;
        height: 52px;
      }
      h1 {
        font-size: 1.7rem;
      }
      .card-head,
      .meter-grid {
        padding-left: 18px;
        padding-right: 18px;
      }
      .card-head {
        display: block;
      }
      .pill {
        margin-top: 14px;
      }
      .meter-grid,
      .sections {
        grid-template-columns: 1fr;
      }
      .context-grid {
        grid-template-columns: 1fr;
        margin-left: 18px;
        margin-right: 18px;
      }
      .context-wide {
        grid-column: auto;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <svg class="mark" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
        <path d="M93 8H35C20.0883 8 8 20.0883 8 35V93C8 107.912 20.0883 120 35 120H93C107.912 120 120 107.912 120 93V35C120 20.0883 107.912 8 93 8Z" fill="url(#detailsIconBase)"/>
        <path d="M93 8H35C20.0883 8 8 20.0883 8 35V93C8 107.912 20.0883 120 35 120H93C107.912 120 120 107.912 120 93V35C120 20.0883 107.912 8 93 8Z" fill="url(#detailsIconGlow)"/>
        <path d="M29 82C23 54 42 29 64 29C89 29 108 48 108 73" stroke="#2D3347" stroke-width="10" stroke-linecap="round"/>
        <path d="M29 82C23 54 42 29 64 29C84 29 100 41 106 59" stroke="url(#detailsIconGauge)" stroke-width="10" stroke-linecap="round"/>
        <path d="M106 65C109.314 65 112 62.3137 112 59C112 55.6863 109.314 53 106 53C102.686 53 100 55.6863 100 59C100 62.3137 102.686 65 106 65Z" fill="#E9F8FF"/>
        <path d="M106 62C107.657 62 109 60.6569 109 59C109 57.3431 107.657 56 106 56C104.343 56 103 57.3431 103 59C103 60.6569 104.343 62 106 62Z" fill="#38BDF8"/>
        <path d="M46 48L60 64L46 80" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M70 78H93" stroke="white" stroke-width="9" stroke-linecap="round"/>
        <path opacity="0.9" d="M35 97C36.6569 97 38 95.6569 38 94C38 92.3431 36.6569 91 35 91C33.3431 91 32 92.3431 32 94C32 95.6569 33.3431 97 35 97Z" fill="#23F7B5"/>
        <path opacity="0.8" d="M47 100C48.1046 100 49 99.1046 49 98C49 96.8954 48.1046 96 47 96C45.8954 96 45 96.8954 45 98C45 99.1046 45.8954 100 47 100Z" fill="#38BDF8"/>
        <path opacity="0.75" d="M59 102C60.1046 102 61 101.105 61 100C61 98.8954 60.1046 98 59 98C57.8954 98 57 98.8954 57 100C57 101.105 57.8954 102 59 102Z" fill="#A78BFA"/>
        <defs>
          <linearGradient id="detailsIconBase" x1="16" y1="14" x2="116" y2="120" gradientUnits="userSpaceOnUse">
            <stop stop-color="#23283A"/>
            <stop offset="0.55" stop-color="#11131F"/>
            <stop offset="1" stop-color="#07080D"/>
          </linearGradient>
          <radialGradient id="detailsIconGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(83 39) rotate(121) scale(78 72)">
            <stop stop-color="#38BDF8" stop-opacity="0.34"/>
            <stop offset="0.56" stop-color="#38BDF8" stop-opacity="0.08"/>
            <stop offset="1" stop-color="#38BDF8" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="detailsIconGauge" x1="25" y1="84" x2="104" y2="36" gradientUnits="userSpaceOnUse">
            <stop stop-color="#23F7B5"/>
            <stop offset="0.52" stop-color="#38BDF8"/>
            <stop offset="1" stop-color="#A78BFA"/>
          </linearGradient>
        </defs>
      </svg>
      <div>
        <h1>Codex Local Meter</h1>
        <p class="subtitle">Local Codex usage from session metadata. Values are estimates unless rate-limit data is found.</p>
      </div>
    </header>

    <article class="summary-card" aria-label="Codex Local Meter usage details">
      <div class="card-head">
        <div class="eyebrow">Usage windows</div>
        <div class="pill">${escapeHtml(dataState)}</div>
      </div>

      <div class="meter-grid">
        ${metricTile('5-hour window', fiveHourPrimary, fiveHourMeta, summary.fiveHourUsedPercent, fiveHourSupplement)}
        ${metricTile('7-day window', sevenDayPrimary, sevenDayMeta, summary.sevenDayUsedPercent, sevenDaySupplement)}
      </div>

      <div class="context-grid">
        ${contextItem('Last activity', escapeHtml(lastActivity), escapeHtml(lastActivityFull))}
        ${contextItem('Sessions (7 days)', escapeHtml(summary.sessionCount.toString()))}
        ${contextItem('Codex folder', `<code>${escapeHtml(summary.codexPath)}</code>`, undefined, true)}
      </div>
    </article>

    <div class="sections">
      <section>
        <h2>Models Detected</h2>
        <div class="badges">
          ${modelBadges}
        </div>
      </section>

      <section>
        <h2>Data Source</h2>
        <p class="supporting">${escapeHtml(sourceNote)}</p>
      </section>
    </div>

    <details ${summary.parseErrors.length > 0 ? 'open' : ''}>
      <summary>Parse Issues (${summary.parseErrors.length})</summary>
      <ul class="errors">
        ${parseErrorRows}
      </ul>
    </details>

    <div class="footer">
      Refreshed at ${escapeHtml(refreshedAt)} &nbsp;·&nbsp;
      Local-only &nbsp;·&nbsp; No network calls &nbsp;·&nbsp; No telemetry
    </div>
  </main>
</body>
</html>`;
}

function metricTile(
    label: string,
    value: string,
    meta: string,
    percent?: number,
    supplemental?: string
): string {
    const supplementalHtml = supplemental
        ? `<div class="metric-extra">${escapeHtml(supplemental)}</div>`
        : '';
    const progressHtml = percent === undefined
        ? ''
        : progressBar(percent, `${label} usage`);

    return `<div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${formatMetricValue(value)}</div>
      <div class="metric-meta">${escapeHtml(meta)}</div>
      ${supplementalHtml}
      ${progressHtml}
    </div>`;
}

function formatMetricValue(value: string): string {
    const match = /^(.+?)\s(used|messages|tokens)$/.exec(value);
    if (!match) {
        return escapeHtml(value);
    }
    return `${escapeHtml(match[1])} <span>${escapeHtml(match[2])}</span>`;
}

function contextItem(label: string, valueHtml: string, metaHtml?: string, wide = false): string {
    const meta = metaHtml
        ? `<div class="metric-extra">${metaHtml}</div>`
        : '';

    return `<div class="context-item${wide ? ' context-wide' : ''}">
      <div class="context-label">${escapeHtml(label)}</div>
      <div class="context-value">${valueHtml}${meta}</div>
    </div>`;
}

function progressBar(percent: number, label: string): string {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));

    return `<div class="detail-meta" role="img" aria-label="${escapeHtml(label)} ${clamped}%">
      <div class="bar"><div class="bar-fill" style="width: ${clamped}%"></div></div>
    </div>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
