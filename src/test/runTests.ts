import * as path from 'path';
import { runTests } from '@vscode/test-electron';

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
    const extensionRoot = process.env.CODEX_LOCAL_METER_TEST_EXTENSION_PATH
        ?? path.resolve(__dirname, '../../');
    const extensionDevelopmentPath = path.resolve(extensionRoot);

    // The path to the compiled test suite entry point
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runWithoutElectronRunAsNode(() => runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        launchArgs: [
            `--extensions-dir=${path.join(testCachePath, 'extensions')}`,
            `--user-data-dir=${path.join(testCachePath, 'user-data')}`
        ]
    }));
}

if (require.main === module) {
    main().catch(err => {
        console.error('Test run failed:', err);
        process.exit(1);
    });
}
