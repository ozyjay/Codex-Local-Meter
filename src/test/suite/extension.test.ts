import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

suite('Extension — activation', () => {

    test('extension is present and activates', async () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        const extensionId = `${packageJson.publisher}.${packageJson.name}`;
        const ext = vscode.extensions.getExtension(extensionId);
        assert.ok(ext, `Extension not found: ${extensionId}`);

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
