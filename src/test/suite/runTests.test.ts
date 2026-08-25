import * as assert from 'assert';
import { runWithoutElectronRunAsNode } from '../runTests';

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
