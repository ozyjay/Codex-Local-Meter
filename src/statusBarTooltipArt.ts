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
    backgroundColour: string;
}

const circumference = 2 * Math.PI * 63;
const fontFamily = 'Segoe UI, Arial, sans-serif';

export function buildTooltipDashboardDataUri(
    summary: UsageSummary,
    thresholds: TooltipThresholds
): string {
    const primary: Ring = {
        label: '5-hour',
        percent: summary.primaryUsedPercent,
        resetsAt: summary.primaryResetsAt,
        colour: '#f1f1ef',
        backgroundColour: '#3a3a3a',
    };
    const secondary: Ring = {
        label: '7-day',
        percent: summary.secondaryUsedPercent,
        resetsAt: summary.secondaryResetsAt,
        colour: '#ff8a1d',
        backgroundColour: '#111315',
    };
    const state = usageState(summary, thresholds);
    const pathText = `Folder ${truncateMiddle(summary.codexPath, 44)}`;
    const activityText = formatRelativeTime(summary.lastActivity);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="500" viewBox="0 0 420 500" role="img" aria-label="Codex Local Meter rate-limit dashboard">
  <defs>
    <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect x="4" y="4" width="412" height="492" rx="22" fill="#111315" stroke="#6b6b6c" stroke-width="1" filter="url(#shadow)"/>
  <text x="22" y="34" fill="#f4f4f2" font-family="${fontFamily}" font-size="13" font-weight="800">Codex Local Meter</text>
  <text x="22" y="52" fill="#a4a6a8" font-family="${fontFamily}" font-size="11">Local estimates only. No session content leaves your Mac.</text>
  ${panel(22, 70, primary, true)}
  ${panel(22, 248, secondary, false)}
  ${footer(state, activityText, pathText)}
</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function panel(x: number, y: number, ring: Ring, filled: boolean): string {
    const percent = clampPercent(ring.percent);
    const dash = circumference * percent / 100;
    const resetText = formatReset(ring.resetsAt);
    const detail = ring.percent === undefined
        ? `${ring.label} usage not found`
        : `${formatPercent(ring.percent)}% of ${ring.label} rate limit`;
    const description = ring.percent === undefined
        ? ['No local Codex rate-limit event has', 'been found yet.']
        : ['Based on the latest local Codex rate-', 'limit event.'];
    const panelBack = filled
        ? `<rect x="${x}" y="${y}" width="382" height="170" rx="8" fill="${ring.backgroundColour}"/>`
        : '';
    const infoX = x + 174;

    return `<g>
    ${panelBack}
    <circle cx="${x + 82}" cy="${y + 85}" r="63" fill="none" stroke="#2f3030" stroke-width="14"/>
    <circle cx="${x + 82}" cy="${y + 85}" r="63" fill="none" stroke="${ring.colour}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${x + 82} ${y + 85})"/>
    <circle cx="${x + 82}" cy="${y + 85}" r="48" fill="#20241d"/>
    <path d="M ${x + 35} ${y + 86} H ${x + 129} A 48 48 0 0 1 ${x + 82} ${y + 133} A 48 48 0 0 1 ${x + 35} ${y + 86}" fill="#272b23"/>
    <path d="M ${x + 35} ${y + 86} H ${x + 129}" stroke="#3b4236" stroke-width="1"/>
    <text x="${x + 82}" y="${y + 49}" fill="#9da19b" font-family="${fontFamily}" font-size="10" font-weight="800" text-anchor="middle">used</text>
    <text x="${x + 82}" y="${y + 79}" fill="${ring.colour}" font-family="${fontFamily}" font-size="27" font-weight="800" text-anchor="middle">${escapeSvg(percentLabel(ring.percent))}</text>
    <text x="${x + 82}" y="${y + 105}" fill="#9da19b" font-family="${fontFamily}" font-size="10" font-weight="800" text-anchor="middle">remaining</text>
    <text x="${x + 82}" y="${y + 128}" fill="#aeb3ad" font-family="${fontFamily}" font-size="17" font-weight="800" text-anchor="middle">${escapeSvg(resetText)}</text>
    <text x="${infoX}" y="${y + 50}" fill="#a9abad" font-family="${fontFamily}" font-size="11">${escapeSvg(ring.label)} window</text>
    <text x="${infoX}" y="${y + 75}" fill="#f4f4f2" font-family="${fontFamily}" font-size="16" font-weight="800">${escapeSvg(detail)}</text>
    <circle cx="${infoX + 4}" cy="${y + 95}" r="4" fill="none" stroke="#9b9d9f" stroke-width="1.2"/>
    <path d="M ${infoX + 4} ${y + 92} V ${y + 95} L ${infoX + 7} ${y + 95}" fill="none" stroke="#9b9d9f" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${infoX + 16}" y="${y + 99}" fill="#c3c4c5" font-family="${fontFamily}" font-size="11">Clears in ${escapeSvg(resetText)}</text>
    ${multilineText(infoX, y + 121, description, '#b4b6b7', 11)}
  </g>`;
}

function footer(state: string, activityText: string, pathText: string): string {
    const stateColour = state === 'Danger'
        ? '#d83b01'
        : state === 'Warning'
        ? '#ff8a1d'
        : '#5f6f52';

    return `<g>
    <path d="M 25 421 L 29 413 L 33 421 Z" fill="${stateColour}"/>
    <text x="43" y="423" fill="${stateColour}" font-family="${fontFamily}" font-size="11" font-weight="800">${escapeSvg(state)}</text>
    <circle cx="354" cy="419" r="4" fill="none" stroke="#8f9295" stroke-width="1.2"/>
    <path d="M 354 416 V 419 L 357 419" fill="none" stroke="#8f9295" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="368" y="423" fill="#b9bbbd" font-family="${fontFamily}" font-size="11">${escapeSvg(activityText)}</text>
    <text x="22" y="462" fill="#9a9d9f" font-family="${fontFamily}" font-size="10">${escapeSvg(pathText)}</text>
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

function multilineText(x: number, y: number, lines: string[], fill: string, fontSize: number): string {
    const lineHeight = fontSize + 4;
    const tspans = lines
        .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeSvg(line)}</tspan>`)
        .join('');

    return `<text x="${x}" y="${y}" fill="${fill}" font-family="${fontFamily}" font-size="${fontSize}">${tspans}</text>`;
}

function truncateMiddle(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }

    const keep = maxLength - 3;
    const front = Math.ceil(keep / 2);
    const back = Math.floor(keep / 2);
    return `${value.slice(0, front)}...${value.slice(value.length - back)}`;
}

function escapeSvg(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
