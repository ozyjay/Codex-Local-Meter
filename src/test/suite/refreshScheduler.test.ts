import * as assert from 'assert';
import { createRefreshDebouncer, createRefreshScheduler } from '../../refreshScheduler';

suite('refreshScheduler', () => {
    test('coalesces overlapping requests and runs one follow-up refresh', async () => {
        let releaseFirstRefresh: (() => void) | undefined;
        let calls = 0;

        const scheduler = createRefreshScheduler(async () => {
            calls++;
            if (calls === 1) {
                await new Promise<void>(resolve => {
                    releaseFirstRefresh = resolve;
                });
            }
            return calls;
        });

        const first = scheduler.requestRefresh();
        const second = scheduler.requestRefresh();
        const third = scheduler.requestRefresh();

        assert.strictEqual(calls, 1, 'overlapping requests should not start parallel refreshes');
        releaseFirstRefresh?.();

        const results = await Promise.all([first, second, third]);

        assert.strictEqual(calls, 2, 'one follow-up refresh should run for queued requests');
        assert.deepStrictEqual(results, [1, 2, 2]);
    });

    test('debounces a burst of file watcher refresh requests', async () => {
        let calls = 0;
        const debouncer = createRefreshDebouncer(() => { calls++; }, 20);

        debouncer.requestRefresh();
        debouncer.requestRefresh();
        debouncer.requestRefresh();

        assert.strictEqual(calls, 0, 'refresh should wait until the burst is quiet');
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(calls, 1, 'the burst should produce one refresh');

        debouncer.dispose();
    });

    test('disposing a debouncer cancels its pending refresh', async () => {
        let calls = 0;
        const debouncer = createRefreshDebouncer(() => { calls++; }, 20);

        debouncer.requestRefresh();
        debouncer.dispose();

        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(calls, 0);
    });
});
