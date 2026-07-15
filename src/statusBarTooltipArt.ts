import { UsageSummary, formatPercent, formatRelativeTime } from './usageCalculator';

export interface TooltipOptions {
    warningThresholdPercent: number;
    dangerThresholdPercent: number;
    showWeeklyUsage?: boolean;
}

interface Ring {
    label: string;
    percent: number;
    resetsAt: Date | undefined;
    colour: string;
}

const circumference = 2 * Math.PI * 35;
const fontFamily = 'Segoe UI, Arial, sans-serif';

export function buildTooltipDashboardDataUri(
    summary: UsageSummary,
    options: TooltipOptions
): string {
    const rings: Ring[] = [];

    if (summary.fiveHourUsedPercent !== undefined) {
        rings.push({
            label: '5-hour limit',
            percent: summary.fiveHourUsedPercent,
            resetsAt: summary.fiveHourResetsAt,
            colour: '#f1f1ef',
        });
    }

    if (options.showWeeklyUsage !== false && summary.sevenDayUsedPercent !== undefined) {
        rings.push({
            label: '7-day limit',
            percent: summary.sevenDayUsedPercent,
            resetsAt: summary.sevenDayResetsAt,
            colour: '#ff8a1d',
        });
    }

    const panelStartY = 62;
    const panelHeight = 104;
    const panelGap = 10;
    const contentHeight = rings.length > 0
        ? rings.length * (panelHeight + panelGap)
        : 76;
    const footerY = panelStartY + contentHeight + 4;
    const height = footerY + 66;
    const state = usageState(rings, options);
    const pathText = `Folder ${truncateMiddle(summary.codexPath, 44)}`;
    const activityText = formatRelativeTime(summary.lastActivity);
    const content = rings.length > 0
        ? rings
            .map((ring, index) => panel(22, panelStartY + index * (panelHeight + panelGap), ring))
            .join('')
        : emptyState(22, panelStartY);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${height}" viewBox="0 0 420 ${height}" role="img" aria-label="Codex Local Meter rate-limit dashboard">
  <rect x="4" y="4" width="412" height="${height - 8}" rx="18" fill="#111315" stroke="#6b6b6c" stroke-width="1"/>
  <text x="22" y="31" fill="#f4f4f2" font-family="${fontFamily}" font-size="13" font-weight="800">Codex Local Meter</text>
  <text x="22" y="48" fill="#a4a6a8" font-family="${fontFamily}" font-size="11">Local only · No session content leaves your device</text>
  ${content}
  ${footer(footerY, state, activityText, pathText)}
</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function panel(x: number, y: number, ring: Ring): string {
    const percent = clampPercent(ring.percent);
    const dash = circumference * percent / 100;
    const resetText = ring.resetsAt === undefined
        ? 'Reset time not found'
        : `Resets in ${formatReset(ring.resetsAt)}`;
    const statusText = `${formatPercent(ring.percent)}% used`;
    const infoX = x + 112;

    return `<g>
    <rect x="${x}" y="${y}" width="376" height="104" rx="8" fill="#1b1d1f"/>
    <circle cx="${x + 54}" cy="${y + 52}" r="35" fill="none" stroke="#343638" stroke-width="9"/>
    <circle cx="${x + 54}" cy="${y + 52}" r="35" fill="none" stroke="${ring.colour}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${x + 54} ${y + 52})"/>
    <text x="${x + 54}" y="${y + 49}" fill="${ring.colour}" font-family="${fontFamily}" font-size="18" font-weight="800" text-anchor="middle">${escapeSvg(percentLabel(ring.percent))}</text>
    <text x="${x + 54}" y="${y + 65}" fill="#9da19b" font-family="${fontFamily}" font-size="9" font-weight="700" text-anchor="middle">USED</text>
    <text x="${infoX}" y="${y + 37}" fill="#f4f4f2" font-family="${fontFamily}" font-size="14" font-weight="800">${escapeSvg(ring.label)}</text>
    <text x="${infoX}" y="${y + 59}" fill="#c3c4c5" font-family="${fontFamily}" font-size="12">${escapeSvg(statusText)}</text>
    <text x="${infoX}" y="${y + 79}" fill="#9a9d9f" font-family="${fontFamily}" font-size="11">${escapeSvg(resetText)}</text>
  </g>`;
}

function emptyState(x: number, y: number): string {
    return `<g>
    <rect x="${x}" y="${y}" width="376" height="76" rx="8" fill="#1b1d1f"/>
    <text x="${x + 18}" y="${y + 31}" fill="#f4f4f2" font-family="${fontFamily}" font-size="13" font-weight="800">Rate-limit data not found</text>
    <text x="${x + 18}" y="${y + 52}" fill="#9a9d9f" font-family="${fontFamily}" font-size="11">Open Details to view local activity estimates.</text>
  </g>`;
}

function footer(y: number, state: string, activityText: string, pathText: string): string {
    const stateColour = state === 'Danger'
        ? '#d83b01'
        : state === 'Warning'
        ? '#ff8a1d'
        : state === 'Unavailable'
        ? '#9a9d9f'
        : '#7d916d';

    return `<g>
    <circle cx="26" cy="${y + 10}" r="4" fill="${stateColour}"/>
    <text x="38" y="${y + 14}" fill="${stateColour}" font-family="${fontFamily}" font-size="11" font-weight="800">${escapeSvg(state)}</text>
    <text x="398" y="${y + 14}" fill="#b9bbbd" font-family="${fontFamily}" font-size="11" text-anchor="end">${escapeSvg(activityText)}</text>
    <text x="22" y="${y + 43}" fill="#9a9d9f" font-family="${fontFamily}" font-size="10">${escapeSvg(pathText)}</text>
  </g>`;
}

function usageState(rings: Ring[], thresholds: TooltipOptions): string {
    if (rings.length === 0) {
        return 'Unavailable';
    }

    const highest = Math.max(...rings.map(ring => ring.percent));
    if (highest >= thresholds.dangerThresholdPercent) {
        return 'Danger';
    }
    if (highest >= thresholds.warningThresholdPercent) {
        return 'Warning';
    }
    return 'Normal';
}

function clampPercent(percent: number): number {
    return Math.max(0, Math.min(100, Math.round(percent)));
}

function percentLabel(percent: number): string {
    return `${formatPercent(percent)}%`;
}

function formatReset(date: Date): string {
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
