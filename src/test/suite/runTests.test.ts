import * as assert from 'assert';
import { quoteShellArgForWindows, runWithoutElectronRunAsNode } from '../runTests';

suite('runTests - quoteShellArgForWindows()', () => {
    test('wraps paths with spaces for the Windows shell', () => {
        assert.strictEqual(
            quoteShellArgForWindows('E:\\Data\\GithubProjects\\Codex Local Meter\\out\\test\\suite\\index'),
            '"E:\\Data\\GithubProjects\\Codex Local Meter\\out\\test\\suite\\index"'
        );
    });

    test('escapes embedded double quotes', () => {
        assert.strictEqual(
            quoteShellArgForWindows('E:\\Data\\GithubProjects\\Codex "Local" Meter'),
            '"E:\\Data\\GithubProjects\\Codex \\"Local\\" Meter"'
        );
    });
});

suite('runTests - runWithoutElectronRunAsNode()', () => {
    test('clears ELECTRON_RUN_AS_NODE while launching VS Code and restores it after', async () => {
        const original = process.env.ELECTRON_RUN_AS_NODE;
        process.env.ELECTRON_RUN_AS_NODE = '1';

        try {
            await runWithoutElectronRunAsNode(async () => {
                assert.strictEqual(process.env.ELECTRON_RUN_AS_NODE, undefined);
            });

            assert.strictEqual(process.env.ELECTRON_RUN_AS_NODE, '1');
        } finally {
            if (original === undefined) {
                delete process.env.ELECTRON_RUN_AS_NODE;
            } else {
                process.env.ELECTRON_RUN_AS_NODE = original;
            }
        }
    });
});
