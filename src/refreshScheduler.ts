export interface RefreshScheduler<T> {
    requestRefresh(): Promise<T>;
}

export interface RefreshDebouncer {
    requestRefresh(): void;
    dispose(): void;
}

interface Deferred<T> {
    resolve(value: T): void;
    reject(reason: unknown): void;
}

export function createRefreshScheduler<T>(refresh: () => Promise<T>): RefreshScheduler<T> {
    let active = false;
    let queued: Deferred<T>[] = [];

    function runRefresh(): Promise<T> {
        active = true;
        const current = refresh();

        const drainQueue = () => {
            const batch = queued;
            queued = [];

            if (batch.length === 0) {
                active = false;
                return;
            }

            const next = runRefresh();
            void next.then(
                value => {
                    for (const waiter of batch) {
                        waiter.resolve(value);
                    }
                },
                reason => {
                    for (const waiter of batch) {
                        waiter.reject(reason);
                    }
                }
            );
        };

        void current.then(drainQueue, drainQueue);

        return current;
    }

    return {
        requestRefresh(): Promise<T> {
            if (!active) {
                return runRefresh();
            }

            return new Promise<T>((resolve, reject) => {
                queued.push({ resolve, reject });
            });
        },
    };
}

/**
 * Collapses a burst of file-system notifications into one refresh after the
 * files have been quiet for the requested delay.
 */
export function createRefreshDebouncer(
    refresh: () => void,
    delayMs: number
): RefreshDebouncer {
    let timer: ReturnType<typeof setTimeout> | undefined;

    return {
        requestRefresh(): void {
            if (timer !== undefined) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                timer = undefined;
                refresh();
            }, delayMs);
        },

        dispose(): void {
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
        },
    };
}
