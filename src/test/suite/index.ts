import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 15000,
    });

    const testsRoot = __dirname;

    // Discover all compiled *.test.js files in this directory
    const files = fs.readdirSync(testsRoot).filter(f => f.endsWith('.test.js'));
    for (const file of files) {
        mocha.addFile(path.join(testsRoot, file));
    }

    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} test(s) failed.`));
            } else {
                resolve();
            }
        });
    });
}
