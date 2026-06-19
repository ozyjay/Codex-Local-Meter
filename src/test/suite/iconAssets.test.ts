import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

suite('icon assets', () => {
    test('status icon source does not depend on filled boxes or fill-rule counters', () => {
        const svg = fs.readFileSync(path.join(repoRoot, 'images', 'icon-mono.svg'), 'utf8');

        assert.ok(!svg.includes('<rect'), 'status icon source should not contain filled rectangles');
        assert.ok(!svg.includes('fill-rule'), 'status icon source should not depend on fill-rule');
        assert.ok(!svg.includes('stroke='), 'status icon source should use closed filled paths for icon fonts');
    });

    test('package rebuild regenerates marketplace png from svg source', () => {
        const rebuildScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'RebuildVsix.ps1'), 'utf8');

        assert.ok(rebuildScript.includes('Build-MarketplaceIcon'), 'rebuild script should define marketplace icon generation');
        assert.ok(rebuildScript.includes('images/icon.svg'), 'rebuild script should read the marketplace SVG source');
        assert.ok(rebuildScript.includes('images/icon.png'), 'rebuild script should write the marketplace PNG output');
        assert.ok(rebuildScript.includes('@resvg/resvg-js-cli'), 'rebuild script should use the documented SVG to PNG renderer');
    });

    test('version bump packaging queries marketplace before computing next version', () => {
        const rebuildScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'RebuildVsix.ps1'), 'utf8');

        assert.ok(rebuildScript.includes('Get-MarketplaceVersion'), 'rebuild script should fetch the published version');
        assert.ok(
            rebuildScript.includes('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'),
            'rebuild script should use the Marketplace gallery query API'
        );
        assert.ok(
            rebuildScript.includes('$itemName =') &&
                rebuildScript.includes('$($identity.Publisher)') &&
                rebuildScript.includes('$($identity.Name)'),
            'rebuild script should query the extension by publisher and package name'
        );
        assert.ok(
            rebuildScript.includes('Get-NextVersion'),
            'rebuild script should compute the next version from the Marketplace version'
        );
        assert.ok(
            rebuildScript.includes("Invoke-CheckedCommand npm @('version', $nextVersion, '--no-git-tag-version')"),
            'rebuild script should set the exact computed version, not bump from local package.json'
        );
        assert.ok(
            !rebuildScript.includes('npm version $VersionBump --no-git-tag-version'),
            'rebuild script should not bump directly from the local package.json version'
        );
        assert.ok(
            rebuildScript.includes('$identity.Version -eq $nextVersion'),
            'rebuild script should skip npm version when local package.json already has the computed version'
        );
        assert.ok(
            rebuildScript.includes('Invoke-CheckedCommand'),
            'rebuild script should check external command exit codes'
        );
    });

    test('package scripts use PowerShell Core for cross-platform packaging and publishing', () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        const scripts = packageJson.scripts as Record<string, string>;

        for (const name of [
            'package:vsix',
            'package:patch',
            'package:minor',
            'package:major',
            'publish:vsix',
            'publish:patch',
            'publish:minor',
            'publish:major',
        ]) {
            assert.ok(scripts[name].startsWith('pwsh '), `${name} should run with pwsh`);
            assert.ok(!scripts[name].startsWith('powershell '), `${name} should not require Windows PowerShell`);
        }
    });

    test('publish script wraps packaging and Marketplace publish safely', () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        const scripts = packageJson.scripts as Record<string, string>;
        const publishScriptPath = path.join(repoRoot, 'scripts', 'PublishVsix.ps1');
        const publishScript = fs.readFileSync(publishScriptPath, 'utf8');

        assert.ok(scripts['publish:vsix'].includes('./scripts/PublishVsix.ps1'));
        assert.ok(scripts['publish:patch'].includes('-VersionBump patch'));
        assert.ok(publishScript.includes("Set-StrictMode -Version Latest"), 'publish script should fail on unsafe PowerShell usage');
        assert.ok(publishScript.includes("Invoke-CheckedCommand npm @('run', \"package:$VersionBump\")"), 'publish script should reuse existing version-bump packaging');
        assert.ok(publishScript.includes("Invoke-CheckedCommand npm @('run', 'package:vsix')"), 'publish script should support publishing without a version bump');
        assert.ok(publishScript.includes("Invoke-CheckedCommand npx @('vsce', 'publish', '--packagePath', $packagePath.FullName)"), 'publish script should publish the generated VSIX');
        assert.ok(publishScript.includes("Invoke-CheckedCommand npx @('vsce', 'show', $itemName)"), 'publish script should verify the Marketplace item after publishing');
        assert.ok(!publishScript.includes('VSCE_PAT='), 'publish script should not store or hard-code publishing tokens');
    });

    test('maintainer docs are excluded from packaged extension', () => {
        const vscodeIgnore = fs.readFileSync(path.join(repoRoot, '.vscodeignore'), 'utf8');

        assert.ok(
            vscodeIgnore.split(/\r?\n/).includes('DEVELOPMENT.md'),
            'DEVELOPMENT.md should stay out of the Marketplace VSIX'
        );
    });
});
