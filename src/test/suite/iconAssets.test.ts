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
});
