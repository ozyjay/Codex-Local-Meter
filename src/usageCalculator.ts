import { RawEvent } from './codexReader';

export interface UsageSummary {
    fiveHourTokens?: number;
    fiveHourMessages?: number;
    sevenDayTokens?: number;
    sevenDayMessages?: number;
    /** true when no token counts were found — numbers are message-count estimates */
    isEstimated: boolean;
    lastActivity?: Date;
    codexPath: string;
    sessionCount: number;
    modelNames: string[];
    parseErrors: string[];
    /** Most-recent 5-hour rate-limit used % from the Codex API. Takes priority over computed ratios. */
    primaryUsedPercent?: number;
    /** Most-recent 7-day rate-limit used % from the Codex API. */
    secondaryUsedPercent?: number;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function calculate(
    events: RawEvent[],
    codexPath: string,
    parseErrors: string[]
): UsageSummary {
    if (events.length === 0) {
        return {
            isEstimated: true,
            codexPath,
            sessionCount: 0,
            modelNames: [],
            parseErrors,
        };
    }

    const now = Date.now();
    const fiveHourCutoff = now - FIVE_HOURS_MS;
    const sevenDayCutoff = now - SEVEN_DAYS_MS;

    let fiveHourInputTokens = 0;
    let fiveHourOutputTokens = 0;
    let fiveHourMessages = 0;
    let sevenDayInputTokens = 0;
    let sevenDayOutputTokens = 0;
    let sevenDayMessages = 0;
    let hasTokens = false;
    let lastActivity: Date | undefined;
    const sessionIds = new Set<string>();
    const modelSet = new Set<string>();
    let latestRateLimitTs = 0;
    let latestPrimaryUsedPercent: number | undefined;
    let latestSecondaryUsedPercent: number | undefined;

    for (const event of events) {
        const eventMs = event.timestamp.getTime();

        // Track last activity across all events
        if (!lastActivity || eventMs > lastActivity.getTime()) {
            lastActivity = event.timestamp;
        }

        if (event.model) {
            modelSet.add(event.model);
        }

        if (event.inputTokens !== undefined || event.outputTokens !== undefined) {
            hasTokens = true;
        }

        // Track most-recent rate-limit state (authoritative values from the Codex API)
        if ((event.primaryUsedPercent !== undefined || event.secondaryUsedPercent !== undefined)
            && eventMs > latestRateLimitTs) {
            latestRateLimitTs = eventMs;
            if (event.primaryUsedPercent !== undefined) {
                latestPrimaryUsedPercent = event.primaryUsedPercent;
            }
            if (event.secondaryUsedPercent !== undefined) {
                latestSecondaryUsedPercent = event.secondaryUsedPercent;
            }
        }

        // 7-day window (session count is also scoped to this window)
        if (eventMs >= sevenDayCutoff) {
            sessionIds.add(event.sessionId);
            sevenDayInputTokens += event.inputTokens ?? 0;
            sevenDayOutputTokens += event.outputTokens ?? 0;
            sevenDayMessages += event.messageCount ?? 1;
        }

        // 5-hour window
        if (eventMs >= fiveHourCutoff) {
            fiveHourInputTokens += event.inputTokens ?? 0;
            fiveHourOutputTokens += event.outputTokens ?? 0;
            fiveHourMessages += event.messageCount ?? 1;
        }
    }

    const summary: UsageSummary = {
        isEstimated: !hasTokens,
        lastActivity,
        codexPath,
        sessionCount: sessionIds.size,
        modelNames: Array.from(modelSet).sort(),
        parseErrors,
        primaryUsedPercent: latestPrimaryUsedPercent,
        secondaryUsedPercent: latestSecondaryUsedPercent,
    };

    if (hasTokens) {
        summary.fiveHourTokens = fiveHourInputTokens + fiveHourOutputTokens;
        summary.sevenDayTokens = sevenDayInputTokens + sevenDayOutputTokens;
    } else {
        summary.fiveHourMessages = fiveHourMessages;
        summary.sevenDayMessages = sevenDayMessages;
    }

    return summary;
}

/**
 * Formats a token count for display (e.g. 12400 → "12.4k").
 * Returns undefined if value is undefined.
 */
export function formatTokens(count: number | undefined): string | undefined {
    if (count === undefined) {
        return undefined;
    }
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
        // Use Math.round to avoid .toFixed() rounding 999.95+ up to "1000.0k"
        const kRounded = Math.round(count / 100) / 10;
        if (kRounded >= 1_000) {
            return `${(count / 1_000_000).toFixed(1)}M`;
        }
        return `${kRounded.toFixed(1)}k`;
    }
    return `${count}`;
}

/**
 * Formats a rate-limit percentage without hiding meaningful fractional precision.
 */
export function formatPercent(percent: number): string {
    return Number(percent.toFixed(2)).toString();
}

/**
 * Returns a human-readable relative time string, e.g. "3 min ago", "2 h ago".
 */
export function formatRelativeTime(date: Date | undefined): string {
    if (!date) {
        return 'never';
    }
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) {
        return 'just now';
    }
    if (diffMin < 60) {
        return `${diffMin} min ago`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return `${diffHours} h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d ago`;
}
