import * as path from 'path';
import { runTests } from '@vscode/test-electron';

export function quoteShellArgForWindows(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`;
}

function formatPathForVSCodeTestRunner(value: string): string {
    return process.platform === 'win32' ? quoteShellArgForWindows(value) : value;
}

export async function runWithoutElectronRunAsNode<T>(action: () => Promise<T>): Promise<T> {
    const original = process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.ELECTRON_RUN_AS_NODE;

    try {
        return await action();
    } finally {
        if (original === undefined) {
            delete process.env.ELECTRON_RUN_AS_NODE;
        } else {
            process.env.ELECTRON_RUN_AS_NODE = original;
        }
    }
}

async function main(): Promise<void> {
    const testCachePath = path.resolve(__dirname, '../../.vscode-test');

    // The folder containing the extension's package.json
    const extensionDevelopmentPath = formatPathForVSCodeTestRunner(path.resolve(__dirname, '../../'));

    // The path to the compiled test suite entry point
    const extensionTestsPath = formatPathForVSCodeTestRunner(path.resolve(__dirname, './suite/index'));

    await runWithoutElectronRunAsNode(() => runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        launchArgs: [
            `--extensions-dir=${formatPathForVSCodeTestRunner(path.join(testCachePath, 'extensions'))}`,
            `--user-data-dir=${formatPathForVSCodeTestRunner(path.join(testCachePath, 'user-data'))}`
        ]
    }));
}

if (require.main === module) {
    main().catch(err => {
        console.error('Test run failed:', err);
        process.exit(1);
    });
}
