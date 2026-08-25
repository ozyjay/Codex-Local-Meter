import { RateLimitWindow, RateLimits, RawEvent } from './codexReader';

export interface ActivitySummary {
    fiveHourTokens?: number;
    fiveHourMessages?: number;
    sevenDayTokens?: number;
    sevenDayMessages?: number;
}

export interface UsageSummary extends ActivitySummary {
    /** true when no token counts were found — numbers are message-count estimates */
    isEstimated: boolean;
    lastActivity?: Date;
    codexPath: string;
    sessionCount: number;
    modelNames: string[];
    parseErrors: string[];
    /** Most-recent fresh rate-limit windows reported directly by Codex. */
    rateLimits: RateLimits;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const UNKNOWN_RATE_LIMIT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
            rateLimits: {},
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
    let latestPrimaryRateLimitTs = -Infinity;
    let latestSecondaryRateLimitTs = -Infinity;
    let latestPrimaryRateLimit: RateLimitWindow | undefined;
    let latestSecondaryRateLimit: RateLimitWindow | undefined;

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

        // A rate_limits object is an authoritative snapshot. Its slots are updated
        // independently, and an omitted/null slot clears an older value for that slot.
        if (event.rateLimits !== undefined) {
            if (eventMs >= latestPrimaryRateLimitTs) {
                latestPrimaryRateLimitTs = eventMs;
                latestPrimaryRateLimit = isRateLimitFresh(event.rateLimits.primary, eventMs, now)
                    ? event.rateLimits.primary
                    : undefined;
            }
            if (eventMs >= latestSecondaryRateLimitTs) {
                latestSecondaryRateLimitTs = eventMs;
                latestSecondaryRateLimit = isRateLimitFresh(event.rateLimits.secondary, eventMs, now)
                    ? event.rateLimits.secondary
                    : undefined;
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
        rateLimits: {
            ...(latestPrimaryRateLimit === undefined ? {} : { primary: latestPrimaryRateLimit }),
            ...(latestSecondaryRateLimit === undefined ? {} : { secondary: latestSecondaryRateLimit }),
        },
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

function isRateLimitFresh(
    window: RateLimitWindow | undefined,
    eventMs: number,
    now: number
): window is RateLimitWindow {
    if (window === undefined) {
        return false;
    }
    if (window.resetsAt !== undefined) {
        return window.resetsAt.getTime() > now;
    }
    if (window.windowMinutes !== undefined) {
        return eventMs + window.windowMinutes * 60_000 > now;
    }

    // Older local records can omit both reset and duration. Keep a recent
    // observation for compatibility, but never let an old session persist forever.
    return eventMs >= now - UNKNOWN_RATE_LIMIT_MAX_AGE_MS;
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
 * Formats a rate-limit percentage as a whole-number estimate.
 */
export function formatPercent(percent: number): string {
    return Math.round(percent).toString();
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

/**
 * Returns a compact future duration string, e.g. "25 min", "2 h", "1.5 d".
 */
export function formatRelativeFuture(date: Date | undefined): string | undefined {
    if (!date) {
        return undefined;
    }

    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) {
        return 'now';
    }

    const diffMin = Math.ceil(diffMs / 60_000);
    if (diffMin < 60) {
        return `${diffMin} min`;
    }

    const diffHours = diffMs / 3_600_000;
    if (diffHours < 24) {
        return `${Math.ceil(diffHours)} h`;
    }

    const diffDays = Math.round((diffHours / 24) * 10) / 10;
    return `${diffDays.toFixed(diffDays % 1 === 0 ? 0 : 1)} d`;
}
