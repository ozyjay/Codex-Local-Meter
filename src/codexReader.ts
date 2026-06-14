import * as fs from 'fs';
import * as path from 'path';

export interface RawEvent {
    sessionId: string;
    timestamp: Date;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    messageCount?: number;
    /** 5-hour rate-limit used % from Codex API (payload.rate_limits.primary.used_percent) */
    primaryUsedPercent?: number;
    /** 7-day rate-limit used % from Codex API (payload.rate_limits.secondary.used_percent) */
    secondaryUsedPercent?: number;
    /** 5-hour rate-limit reset timestamp from Codex API (payload.rate_limits.primary.resets_at) */
    primaryResetsAt?: Date;
    /** 7-day rate-limit reset timestamp from Codex API (payload.rate_limits.secondary.resets_at) */
    secondaryResetsAt?: Date;
}

interface ReadResult {
    events: RawEvent[];
    parseErrors: string[];
}

/**
 * Discovers all *.jsonl files under <codexPath>/sessions/, reads them line-by-line,
 * and extracts RawEvent records. Never throws — parse errors are collected and returned.
 */
export async function readEvents(codexPath: string): Promise<ReadResult> {
    const events: RawEvent[] = [];
    const parseErrors: string[] = [];

    const sessionsDir = path.join(codexPath, 'sessions');

    // Verify the sessions directory exists
    try {
        const stat = await fs.promises.stat(sessionsDir);
        if (!stat.isDirectory()) {
            parseErrors.push(`Expected a directory at: ${sessionsDir}`);
            return { events, parseErrors };
        }
    } catch {
        // ~/.codex/sessions simply doesn't exist yet — not an error
        return { events, parseErrors };
    }

    const jsonlFiles = await collectJsonlFiles(sessionsDir, parseErrors);

    for (const filePath of jsonlFiles) {
        await parseJsonlFile(filePath, events, parseErrors);
    }

    return { events, parseErrors };
}

/** Recursively collects all *.jsonl file paths under a directory. */
async function collectJsonlFiles(dir: string, parseErrors: string[]): Promise<string[]> {
    const results: string[] = [];
    let entries: fs.Dirent[];

    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
        parseErrors.push(`Cannot read directory ${dir}: ${errorMessage(err)}`);
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const nested = await collectJsonlFiles(fullPath, parseErrors);
            results.push(...nested);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            results.push(fullPath);
        }
    }

    return results;
}

/** Reads one JSONL file line-by-line, extracting RawEvent records from each line. */
async function parseJsonlFile(
    filePath: string,
    events: RawEvent[],
    parseErrors: string[]
): Promise<void> {
    let content: string;
    try {
        content = await fs.promises.readFile(filePath, 'utf8');
    } catch (err) {
        parseErrors.push(`Cannot read file ${filePath}: ${errorMessage(err)}`);
        return;
    }

    // Derive a stable session ID from the file path (last two path segments)
    const parts = filePath.split(path.sep);
    const sessionId = parts.slice(-2).join('/');

    let lineNumber = 0;
    for (const line of content.split('\n')) {
        lineNumber++;
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        let record: unknown;
        try {
            record = JSON.parse(trimmed);
        } catch {
            parseErrors.push(`${filePath}:${lineNumber}: invalid JSON — skipped`);
            continue;
        }

        const event = extractEvent(record, sessionId);
        if (event) {
            events.push(event);
        }
    }
}

/**
 * Attempts to extract a RawEvent from a parsed JSON object.
 * Returns undefined if the record lacks a usable timestamp.
 *
 * Handles two formats:
 *   1. Codex Desktop JSONL: {timestamp, type, payload} wrapper
 *   2. Generic flat format: token fields at the top level or under `usage`
 */
function extractEvent(record: unknown, sessionId: string): RawEvent | undefined {
    if (typeof record !== 'object' || record === null) {
        return undefined;
    }

    const r = record as Record<string, unknown>;

    // --- Timestamp (required) ---
    const ts = resolveTimestamp(r);
    if (!ts) {
        return undefined;
    }

    // --- Codex Desktop JSONL wrapper: {timestamp, type: string, payload: object} ---
    if (typeof r['type'] === 'string' && typeof r['payload'] === 'object' && r['payload'] !== null) {
        return extractCodexDesktopEvent(r, ts, sessionId);
    }

    // --- Generic / legacy flat format ---
    const model = typeof r['model'] === 'string' ? r['model'] : undefined;

    const inputTokens =
        resolveNumber(r, 'input_tokens') ??
        resolveNumber(r, 'inputTokens') ??
        resolveNumber(r, 'prompt_tokens') ??
        resolveNestedNumber(r, 'usage', 'input_tokens') ??
        resolveNestedNumber(r, 'usage', 'prompt_tokens');

    const outputTokens =
        resolveNumber(r, 'output_tokens') ??
        resolveNumber(r, 'outputTokens') ??
        resolveNumber(r, 'completion_tokens') ??
        resolveNestedNumber(r, 'usage', 'output_tokens') ??
        resolveNestedNumber(r, 'usage', 'completion_tokens');

    const messageCount = resolveNumber(r, 'message_count') ?? resolveNumber(r, 'messageCount');

    return { sessionId, timestamp: ts, model, inputTokens, outputTokens, messageCount };
}

/**
 * Parses the Codex Desktop JSONL wrapper format.
 * Returns an event only for lines that carry usage-relevant data;
 * returns undefined for all other event types (session_meta, response_item, etc.).
 */
function extractCodexDesktopEvent(
    r: Record<string, unknown>,
    ts: Date,
    sessionId: string
): RawEvent | undefined {
    const payload = r['payload'] as Record<string, unknown>;
    const eventType = r['type'] as string;
    const payloadType = payload['type'];

    // token_count events: per-turn token usage + current rate-limit state
    if (eventType === 'event_msg' && payloadType === 'token_count') {
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        const info = payload['info'];
        if (typeof info === 'object' && info !== null) {
            const lastUsage = (info as Record<string, unknown>)['last_token_usage'];
            if (typeof lastUsage === 'object' && lastUsage !== null) {
                const u = lastUsage as Record<string, unknown>;
                inputTokens = resolveNumber(u, 'input_tokens');
                outputTokens = resolveNumber(u, 'output_tokens');
            }
        }

        let primaryUsedPercent: number | undefined;
        let secondaryUsedPercent: number | undefined;
        let primaryResetsAt: Date | undefined;
        let secondaryResetsAt: Date | undefined;

        const rl = payload['rate_limits'];
        if (typeof rl === 'object' && rl !== null) {
            const primary = (rl as Record<string, unknown>)['primary'];
            const secondary = (rl as Record<string, unknown>)['secondary'];
            if (typeof primary === 'object' && primary !== null) {
                const p = primary as Record<string, unknown>;
                primaryUsedPercent = resolveNumber(p, 'used_percent');
                primaryResetsAt = resolveUnixSecondsDate(p, 'resets_at');
            }
            if (typeof secondary === 'object' && secondary !== null) {
                const s = secondary as Record<string, unknown>;
                secondaryUsedPercent = resolveNumber(s, 'used_percent');
                secondaryResetsAt = resolveUnixSecondsDate(s, 'resets_at');
            }
        }

        return {
            sessionId,
            timestamp: ts,
            inputTokens,
            outputTokens,
            primaryUsedPercent,
            secondaryUsedPercent,
            primaryResetsAt,
            secondaryResetsAt,
        };
    }

    // user_message events: count as one message turn for the message-count fallback
    if (eventType === 'event_msg' && payloadType === 'user_message') {
        return { sessionId, timestamp: ts, messageCount: 1 };
    }

    // All other Codex Desktop events carry no usage metrics
    return undefined;
}

function resolveTimestamp(r: Record<string, unknown>): Date | undefined {
    for (const key of ['timestamp', 'ts', 'created_at', 'time', 'date']) {
        const val = r[key];
        if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                return d;
            }
        }
    }
    return undefined;
}

function resolveNumber(r: Record<string, unknown>, key: string): number | undefined {
    const val = r[key];
    return typeof val === 'number' ? val : undefined;
}

function resolveUnixSecondsDate(r: Record<string, unknown>, key: string): Date | undefined {
    const seconds = resolveNumber(r, key);
    if (seconds === undefined) {
        return undefined;
    }

    const date = new Date(seconds * 1000);
    return isNaN(date.getTime()) ? undefined : date;
}

function resolveNestedNumber(
    r: Record<string, unknown>,
    parentKey: string,
    childKey: string
): number | undefined {
    const parent = r[parentKey];
    if (typeof parent === 'object' && parent !== null) {
        return resolveNumber(parent as Record<string, unknown>, childKey);
    }
    return undefined;
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
