import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    // The folder containing the extension's package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the compiled test suite entry point
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

main().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
