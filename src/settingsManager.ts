import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export interface Settings {
    codexPath: string;
    refreshIntervalSeconds: number;
    showFiveHourUsage: boolean;
    showWeeklyUsage: boolean;
    warningThresholdPercent: number;
    dangerThresholdPercent: number;
    compactMode: boolean;
}

export function getSettings(): Settings {
    const cfg = vscode.workspace.getConfiguration('codexLocalMeter');

    const override = cfg.get<string>('codexPath', '').trim();
    const codexPath = override || path.join(os.homedir(), '.codex');

    const warningThresholdPercent = clamp(cfg.get<number>('warningThresholdPercent', 70), 0, 100);
    // Clamp danger so it is always >= warning, keeping the two levels ordered
    const dangerThresholdPercent = Math.max(
        clamp(cfg.get<number>('dangerThresholdPercent', 90), 0, 100),
        warningThresholdPercent
    );

    return {
        codexPath,
        refreshIntervalSeconds: Math.max(30, cfg.get<number>('refreshIntervalSeconds', 300)),
        showFiveHourUsage: cfg.get<boolean>('showFiveHourUsage', true),
        showWeeklyUsage: cfg.get<boolean>('showWeeklyUsage', true),
        warningThresholdPercent,
        dangerThresholdPercent,
        compactMode: cfg.get<boolean>('compactMode', false),
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
