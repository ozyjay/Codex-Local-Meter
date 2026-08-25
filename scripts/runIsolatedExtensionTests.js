const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const testExtensionRoot = path.join(repoRoot, '.test-out');
const tscPath = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

fs.rmSync(testExtensionRoot, { recursive: true, force: true });

const compile = spawnSync(process.execPath, [tscPath, '-p', './', '--outDir', testExtensionRoot], {
    cwd: repoRoot,
    stdio: 'inherit',
});
if (compile.status !== 0) {
    process.exit(compile.status ?? 1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
manifest.main = './extension.js';
fs.writeFileSync(
    path.join(testExtensionRoot, 'package.json'),
    `${JSON.stringify(manifest, undefined, 2)}\n`,
    'utf8'
);

for (const asset of ['icon.png', 'codex-local-meter.woff']) {
    const source = path.join(repoRoot, 'images', asset);
    if (fs.existsSync(source)) {
        const destinationDir = path.join(testExtensionRoot, 'images');
        fs.mkdirSync(destinationDir, { recursive: true });
        fs.copyFileSync(source, path.join(destinationDir, asset));
    }
}

const testRun = spawnSync(process.execPath, [path.join(testExtensionRoot, 'test', 'runTests.js')], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
        ...process.env,
        CODEX_LOCAL_METER_TEST_EXTENSION_PATH: testExtensionRoot,
    },
});

process.exit(testRun.status ?? 1);
