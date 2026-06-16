import { UsageSummary, formatPercent, formatRelativeTime } from './usageCalculator';

export interface TooltipThresholds {
    warningThresholdPercent: number;
    dangerThresholdPercent: number;
}

interface Ring {
    label: string;
    percent: number | undefined;
    resetsAt: Date | undefined;
    colour: string;
}

const circumference = 2 * Math.PI * 54;

export function buildTooltipDashboardDataUri(
    summary: UsageSummary,
    thresholds: TooltipThresholds
): string {
    const primary: Ring = {
        label: '5-hour',
        percent: summary.primaryUsedPercent,
        resetsAt: summary.primaryResetsAt,
        colour: '#343434',
    };
    const secondary: Ring = {
        label: '7-day',
        percent: summary.secondaryUsedPercent,
        resetsAt: summary.secondaryResetsAt,
        colour: '#ff8a1d',
    };
    const state = usageState(summary, thresholds);
    const pathText = `Folder ${summary.codexPath}`;
    const activityText = formatRelativeTime(summary.lastActivity);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="500" viewBox="0 0 420 500" role="img" aria-label="Codex Local Meter rate-limit dashboard">
  <defs>
    <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect x="8" y="8" width="404" height="484" rx="22" fill="#eeeeec" opacity="0.94" filter="url(#shadow)"/>
  <text x="28" y="40" fill="#3b3b3b" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">Codex Local Meter</text>
  <text x="28" y="58" fill="#555555" font-family="Segoe UI, Arial, sans-serif" font-size="11">Local estimates only. No session content leaves your Mac.</text>
  ${panel(28, 80, primary, '#d4d4d2')}
  ${panel(28, 258, secondary, '#eeeeec')}
  ${footer(state, activityText, pathText)}
</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function panel(x: number, y: number, ring: Ring, fill: string): string {
    const percent = clampPercent(ring.percent);
    const dash = circumference * percent / 100;
    const resetText = formatReset(ring.resetsAt);
    const detail = ring.percent === undefined
        ? `${ring.label} usage not found`
        : `${formatPercent(ring.percent)}% of ${ring.label} rate limit`;
    const description = ring.percent === undefined
        ? 'No local Codex rate-limit event has been found yet.'
        : 'Based on the latest local Codex rate-limit event.';

    return `<g>
    <rect x="${x}" y="${y}" width="364" height="158" rx="8" fill="${fill}"/>
    <circle cx="${x + 74}" cy="${y + 79}" r="54" fill="none" stroke="#c7c7c5" stroke-width="14"/>
    <circle cx="${x + 74}" cy="${y + 79}" r="54" fill="none" stroke="${ring.colour}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${x + 74} ${y + 79})"/>
    <circle cx="${x + 74}" cy="${y + 79}" r="39" fill="#f9f9f8"/>
    <path d="M ${x + 36} ${y + 80} H ${x + 112} A 39 39 0 0 1 ${x + 74} ${y + 118} A 39 39 0 0 1 ${x + 36} ${y + 80}" fill="#efefed"/>
    <text x="${x + 74}" y="${y + 51}" fill="#7b7b7b" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" text-anchor="middle">used</text>
    <text x="${x + 74}" y="${y + 83}" fill="${ring.colour}" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800" text-anchor="middle">${escapeSvg(percentLabel(ring.percent))}</text>
    <text x="${x + 74}" y="${y + 106}" fill="#8a8a8a" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" text-anchor="middle">remaining</text>
    <text x="${x + 74}" y="${y + 128}" fill="#777777" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" text-anchor="middle">${escapeSvg(resetText)}</text>
    <text x="${x + 168}" y="${y + 47}" fill="#666666" font-family="Segoe UI, Arial, sans-serif" font-size="11">${escapeSvg(ring.label)} window</text>
    <text x="${x + 168}" y="${y + 72}" fill="#202020" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="800">${escapeSvg(detail)}</text>
    <text x="${x + 168}" y="${y + 96}" fill="#565656" font-family="Segoe UI, Arial, sans-serif" font-size="11">Clears in ${escapeSvg(resetText)}</text>
    <text x="${x + 168}" y="${y + 119}" fill="#4f4f4f" font-family="Segoe UI, Arial, sans-serif" font-size="11">${escapeSvg(description)}</text>
  </g>`;
}

function footer(state: string, activityText: string, pathText: string): string {
    const stateColour = state === 'Danger'
        ? '#d83b01'
        : state === 'Warning'
        ? '#ff8a1d'
        : '#5f6f52';

    return `<g>
    <text x="28" y="432" fill="${stateColour}" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="800">${escapeSvg(state)}</text>
    <text x="342" y="432" fill="#555555" font-family="Segoe UI, Arial, sans-serif" font-size="11">${escapeSvg(activityText)}</text>
    <text x="28" y="462" fill="#777777" font-family="Segoe UI, Arial, sans-serif" font-size="10">${escapeSvg(pathText)}</text>
  </g>`;
}

function usageState(summary: UsageSummary, thresholds: TooltipThresholds): string {
    const highest = Math.max(
        summary.primaryUsedPercent ?? -1,
        summary.secondaryUsedPercent ?? -1
    );
    if (highest >= thresholds.dangerThresholdPercent) {
        return 'Danger';
    }
    if (highest >= thresholds.warningThresholdPercent) {
        return 'Warning';
    }
    return 'Normal';
}

function clampPercent(percent: number | undefined): number {
    if (percent === undefined) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(percent)));
}

function percentLabel(percent: number | undefined): string {
    return percent === undefined ? '--' : `${formatPercent(percent)}%`;
}

function formatReset(date: Date | undefined): string {
    if (date === undefined) {
        return 'not found';
    }

    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) {
        return 'now';
    }

    const totalMinutes = Math.ceil(diffMs / 60_000);
    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours < 24) {
        return minutes === 0 ? `${totalHours} h` : `${totalHours} h ${minutes} min`;
    }

    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}

function escapeSvg(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
