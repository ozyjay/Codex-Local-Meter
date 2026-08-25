import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export interface Settings {
    codexPath: string;
    refreshIntervalSeconds: number;
    showPrimaryUsage: boolean;
    showSecondaryUsage: boolean;
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
        showPrimaryUsage: resolveBooleanSetting(cfg, 'showPrimaryUsage', 'showFiveHourUsage', true),
        showSecondaryUsage: resolveBooleanSetting(cfg, 'showSecondaryUsage', 'showWeeklyUsage', true),
        warningThresholdPercent,
        dangerThresholdPercent,
        compactMode: cfg.get<boolean>('compactMode', false),
    };
}

/**
 * New setting values take precedence. Until users explicitly set a replacement,
 * preserve the effective value of the deprecated setting without modifying their
 * global or workspace configuration.
 */
export function resolveBooleanSetting(
    configuration: vscode.WorkspaceConfiguration,
    currentKey: string,
    legacyKey: string,
    defaultValue: boolean
): boolean {
    if (hasExplicitValue(configuration.inspect<boolean>(currentKey))) {
        return configuration.get<boolean>(currentKey, defaultValue);
    }
    if (hasExplicitValue(configuration.inspect<boolean>(legacyKey))) {
        return configuration.get<boolean>(legacyKey, defaultValue);
    }
    return defaultValue;
}

interface ConfigurationInspection<T> {
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
    globalLanguageValue?: T;
    workspaceLanguageValue?: T;
    workspaceFolderLanguageValue?: T;
}

function hasExplicitValue<T>(inspection: ConfigurationInspection<T> | undefined): boolean {
    return inspection?.globalValue !== undefined
        || inspection?.workspaceValue !== undefined
        || inspection?.workspaceFolderValue !== undefined
        || inspection?.globalLanguageValue !== undefined
        || inspection?.workspaceLanguageValue !== undefined
        || inspection?.workspaceFolderLanguageValue !== undefined;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
