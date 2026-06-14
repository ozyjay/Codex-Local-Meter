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
            rebuildScript.includes('npm version $nextVersion --no-git-tag-version'),
            'rebuild script should set the exact computed version, not bump from local package.json'
        );
        assert.ok(
            !rebuildScript.includes('npm version $VersionBump --no-git-tag-version'),
            'rebuild script should not bump directly from the local package.json version'
        );
    });
});
