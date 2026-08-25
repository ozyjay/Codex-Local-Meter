import * as assert from 'assert';
import * as vscode from 'vscode';
import { resolveBooleanSetting } from '../../settingsManager';

interface InspectValues {
    current?: boolean;
    legacy?: boolean;
}

function configuration(values: InspectValues): vscode.WorkspaceConfiguration {
    return {
        get: <T>(key: string, defaultValue?: T): T => {
            if (key === 'showPrimaryUsage') {
                return (values.current ?? defaultValue) as T;
            }
            return (values.legacy ?? defaultValue) as T;
        },
        inspect: <T>(key: string) => {
            const value = key === 'showPrimaryUsage' ? values.current : values.legacy;
            return value === undefined ? undefined : { key, globalValue: value as T };
        },
    } as unknown as vscode.WorkspaceConfiguration;
}

suite('settingsManager - legacy display settings', () => {
    test('uses an explicit legacy setting while the replacement is unset', () => {
        assert.strictEqual(
            resolveBooleanSetting(configuration({ legacy: false }), 'showPrimaryUsage', 'showFiveHourUsage', true),
            false
        );
    });

    test('gives an explicit replacement setting precedence over the legacy alias', () => {
        assert.strictEqual(
            resolveBooleanSetting(configuration({ current: true, legacy: false }), 'showPrimaryUsage', 'showFiveHourUsage', true),
            true
        );
    });

    test('uses the semantic default when neither setting is explicit', () => {
        assert.strictEqual(
            resolveBooleanSetting(configuration({}), 'showPrimaryUsage', 'showFiveHourUsage', true),
            true
        );
    });
});
