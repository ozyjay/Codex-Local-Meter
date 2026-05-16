import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension — activation', () => {

    test('extension is present and activates', async () => {
        // Extension ID must match publisher.name in package.json
        const ext = vscode.extensions.getExtension('codex-local-meter.codex-local-meter');
        assert.ok(ext, 'Extension not found — check publisher/name in package.json');

        await ext!.activate();
        assert.strictEqual(ext!.isActive, true, 'Extension did not become active');
    });

    test('all commands are registered after activation', async () => {
        const expected = [
            'codexLocalMeter.openStatus',
            'codexLocalMeter.refreshNow',
            'codexLocalMeter.selectCodexFolder',
            'codexLocalMeter.openSettings',
            'codexLocalMeter.showDiagnostics',
        ];

        const registered = await vscode.commands.getCommands(true);
        for (const cmd of expected) {
            assert.ok(registered.includes(cmd), `Command not registered: ${cmd}`);
        }
    });

    test('refreshNow command executes without throwing', async () => {
        await assert.doesNotReject(
            Promise.resolve(vscode.commands.executeCommand('codexLocalMeter.refreshNow')),
            'refreshNow command threw an error'
        );
    });
});
