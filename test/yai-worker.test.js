import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupDOM, createMockContainer } from './setup.js';

// ─── MockWorker ──────────────────────────────────────────────────────────────
// Simulates the browser Worker API without spawning real threads.
// Tests configure responses via MockWorker.succeedNext() / MockWorker.failNext()
// before constructing a YaiWorker, or via instance.autoSucceed() / autoFail()
// after construction.

const mockInstances = [];

class MockWorker {
    static _nextHandler = null;

    constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
        this._terminated = false;
        this._messages = [];
        this._runHandler = null;
        mockInstances.push(this);
    }

    postMessage(data) {
        if (this._terminated) return;
        this._messages.push(data);

        if (data.type === 'run') {
            const handler = this._runHandler ?? MockWorker._nextHandler;
            MockWorker._nextHandler = null;
            if (typeof handler === 'function') {
                Promise.resolve().then(() => {
                    if (this._terminated || !this.onmessage) return;
                    const response = handler(data);
                    if (response) this.onmessage({ data: response });
                });
            }
        }
    }

    terminate() {
        this._terminated = true;
    }

    // Instance helpers — configure AFTER construction, BEFORE start()
    autoSucceed(payload) {
        this._runHandler = (msg) => ({ taskId: msg.taskId, status: 'success', payload });
        return this;
    }
    autoFail(message) {
        this._runHandler = (msg) => ({ taskId: msg.taskId, status: 'error', payload: message });
        return this;
    }
    sendProgress(payload) {
        const runMsg = this._messages.find(m => m.type === 'run');
        if (runMsg && this.onmessage) {
            this.onmessage({ data: { taskId: runMsg.taskId, status: 'progress', payload } });
        }
    }
    // Trigger success/error directly — use instead of autoSucceed when the run message
    // was already sent (e.g. after calling sendProgress mid-flight).
    triggerSuccess(payload) {
        const runMsg = this._messages.find(m => m.type === 'run');
        if (runMsg) {
            Promise.resolve().then(() => {
                if (!this._terminated && this.onmessage) {
                    this.onmessage({ data: { taskId: runMsg.taskId, status: 'success', payload } });
                }
            });
        }
    }
    triggerError(payload) {
        const runMsg = this._messages.find(m => m.type === 'run');
        if (runMsg) {
            Promise.resolve().then(() => {
                if (!this._terminated && this.onmessage) {
                    this.onmessage({ data: { taskId: runMsg.taskId, status: 'error', payload } });
                }
            });
        }
    }
    triggerThreadError(message = 'Thread crashed') {
        Promise.resolve().then(() => {
            if (!this._terminated && this.onerror) {
                this.onerror({ message, filename: 'worker.js', lineno: 1 });
            }
        });
    }

    // Static helpers — configure BEFORE construction (for static run() etc.)
    static succeedNext(payload) {
        MockWorker._nextHandler = (msg) => ({ taskId: msg.taskId, status: 'success', payload });
    }
    static failNext(message) {
        MockWorker._nextHandler = (msg) => ({ taskId: msg.taskId, status: 'error', payload: message });
    }
    static last() {
        return mockInstances[mockInstances.length - 1] ?? null;
    }
    static reset() {
        mockInstances.length = 0;
        MockWorker._nextHandler = null;
    }
}

// Install mock globals before module imports execute
global.Worker = MockWorker;
URL.createObjectURL = vi.fn(() => 'blob:mock-worker-url');
URL.revokeObjectURL = vi.fn();

// ─── Imports ─────────────────────────────────────────────────────────────────

import { validateTask } from '../worker/internal/SerializationGuard.js';
import { TaskRegistry } from '../worker/internal/TaskRegistry.js';
import { isCSPRestricted } from '../worker/internal/CSPDetector.js';
import { WORKER_BRIDGE_SOURCE } from '../worker/internal/worker-bridge-src.js';
import YaiWorker from '../worker/yai-worker.js';

// ─── SerializationGuard ───────────────────────────────────────────────────────

describe('SerializationGuard', () => {
    it('passes for a clean arrow function', () => {
        expect(() => validateTask((data) => data * 2)).not.toThrow();
    });

    it('passes for a string source with no forbidden globals', () => {
        expect(() => validateTask('(data) => data.toUpperCase()')).not.toThrow();
    });

    it('throws for each forbidden DOM global', () => {
        const forbidden = ['window', 'document', 'localStorage', 'sessionStorage', 'parent', 'top', 'opener', 'location'];
        for (const global of forbidden) {
            expect(
                () => validateTask(`(data) => ${global}.foo`),
                `should reject "${global}"`
            ).toThrow(`"${global}"`);
        }
    });

    it('throws when a non-arrow function uses this', () => {
        expect(() => validateTask(function (data) { return this.multiplier * data; })).toThrow('this');
    });

    it('passes when allowThis suppresses the this check', () => {
        expect(() => validateTask(function (data) { return this.x * data; }, { allowThis: true })).not.toThrow();
    });

    it('passes for a regular function that does not use this', () => {
        expect(() => validateTask(function (data) { return data + 1; })).not.toThrow();
    });
});

// ─── TaskRegistry ─────────────────────────────────────────────────────────────

describe('TaskRegistry', () => {
    const el = document.createElement('div');

    afterEach(() => {
        TaskRegistry.unregister('test-task-1');
        TaskRegistry.unregister('test-task-2');
    });

    it('registers and looks up a WeakRef by taskId', () => {
        const ref = new WeakRef(el);
        TaskRegistry.register('test-task-1', ref);
        expect(TaskRegistry.lookup('test-task-1')).toBe(ref);
    });

    it('returns null for an unknown taskId', () => {
        expect(TaskRegistry.lookup('nonexistent')).toBeNull();
    });

    it('unregister removes the entry', () => {
        TaskRegistry.register('test-task-1', new WeakRef(el));
        TaskRegistry.unregister('test-task-1');
        expect(TaskRegistry.lookup('test-task-1')).toBeNull();
    });

    it('multiple tasks do not conflict', () => {
        const el2 = document.createElement('span');
        const ref1 = new WeakRef(el);
        const ref2 = new WeakRef(el2);
        TaskRegistry.register('test-task-1', ref1);
        TaskRegistry.register('test-task-2', ref2);
        expect(TaskRegistry.lookup('test-task-1')).toBe(ref1);
        expect(TaskRegistry.lookup('test-task-2')).toBe(ref2);
    });
});

// ─── CSPDetector ──────────────────────────────────────────────────────────────

describe('CSPDetector', () => {
    afterEach(() => {
        delete global.chrome;
        document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(m => m.remove());
    });

    it('returns false in a normal test environment', () => {
        expect(isCSPRestricted()).toBe(false);
    });

    it('returns true when chrome.runtime.id is present', () => {
        global.chrome = { runtime: { id: 'extension-id' } };
        expect(isCSPRestricted()).toBe(true);
    });

    it('returns true when a CSP meta tag contains script-src without blob:', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Security-Policy');
        meta.setAttribute('content', "script-src 'self' https://cdn.example.com");
        document.head.appendChild(meta);
        expect(isCSPRestricted()).toBe(true);
    });

    it('returns false when CSP meta tag includes blob:', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Security-Policy');
        meta.setAttribute('content', "script-src 'self' blob:");
        document.head.appendChild(meta);
        expect(isCSPRestricted()).toBe(false);
    });
});

// ─── WORKER_BRIDGE_SOURCE ────────────────────────────────────────────────────

describe('WORKER_BRIDGE_SOURCE', () => {
    it('is a non-empty string', () => {
        expect(typeof WORKER_BRIDGE_SOURCE).toBe('string');
        expect(WORKER_BRIDGE_SOURCE.length).toBeGreaterThan(0);
    });

    it('contains the bridge message protocol keywords', () => {
        expect(WORKER_BRIDGE_SOURCE).toContain('self.onmessage');
        expect(WORKER_BRIDGE_SOURCE).toContain("status: 'success'");
        expect(WORKER_BRIDGE_SOURCE).toContain("status: 'error'");
        expect(WORKER_BRIDGE_SOURCE).toContain('sharedBuffer');
    });
});

// ─── YaiWorker ───────────────────────────────────────────────────────────────

describe('YaiWorker', () => {
    beforeEach(() => {
        MockWorker.reset();
        vi.clearAllMocks();
        cleanupDOM();
    });

    afterEach(() => {
        MockWorker.last()?._terminated || MockWorker.last()?.terminate();
    });

    // ── Constructor ────────────────────────────────────────────────────────

    describe('Constructor', () => {
        it('throws for a task that references a forbidden global', () => {
            expect(() => new YaiWorker((data) => window.alert(data))).toThrow('"window"');
        });

        it('throws for a regular function using this', () => {
            expect(() => new YaiWorker(function (data) { return this.x + data; })).toThrow('this');
        });

        it('passes with allowThis: true', () => {
            expect(() => new YaiWorker(
                function (data) { return this.x + data; },
                { allowThis: true }
            )).not.toThrow();
        });

        it('creates the underlying Worker immediately on construction', () => {
            new YaiWorker((x) => x * 2);
            expect(MockWorker.last()).not.toBeNull();
        });

        it('uses a blob URL on the primary (non-CSP) path', () => {
            new YaiWorker((x) => x);
            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(MockWorker.last().url).toBe('blob:mock-worker-url');
        });

        it('accepts a serialized function string as the task', () => {
            expect(() => new YaiWorker('(data) => data + 1')).not.toThrow();
        });
    });

    // ── workerUrl option ───────────────────────────────────────────────────

    describe('workerUrl option', () => {
        it('uses the provided URL directly — no blob, no validation', () => {
            const worker = new YaiWorker(null, { workerUrl: '/workers/my-sync.js' });
            expect(MockWorker.last().url).toBe('/workers/my-sync.js');
            expect(URL.createObjectURL).not.toHaveBeenCalled();
        });

        it('skips SerializationGuard so a forbidden task does not throw', () => {
            // task would fail validation, but workerUrl path bypasses it
            expect(() => new YaiWorker(
                (data) => window.open(data),
                { workerUrl: '/workers/my-sync.js' }
            )).not.toThrow();
        });

        it('sends no init message — the worker file already contains the logic', () => {
            const worker = new YaiWorker(null, { workerUrl: '/workers/my-sync.js' });
            // Only a run message should appear after start(), never an init
            expect(MockWorker.last()._messages).toHaveLength(0);
        });

        it('still routes start() / terminate() normally', async () => {
            const worker = new YaiWorker(null, { workerUrl: '/workers/my-sync.js' });
            MockWorker.last().autoSucceed('result-from-file');
            const result = await worker.start({ query: 'test' });
            expect(result).toBe('result-from-file');
        });
    });

    // ── start() ───────────────────────────────────────────────────────────

    describe('start()', () => {
        it('resolves with the value returned by the task', async () => {
            const worker = new YaiWorker((x) => x * 10);
            MockWorker.last().autoSucceed(99);
            await expect(worker.start(5)).resolves.toBe(99);
        });

        it('passes inputData to the worker in the run message', async () => {
            const worker = new YaiWorker((x) => x);
            MockWorker.last().autoSucceed(null);
            await worker.start({ key: 'value' });
            const runMsg = MockWorker.last()._messages.find(m => m.type === 'run');
            expect(runMsg.inputData).toEqual({ key: 'value' });
        });

        it('passes sharedBuffer to the worker in the run message', async () => {
            const sab = new SharedArrayBuffer(4);
            const worker = new YaiWorker((x) => x, { sharedBuffer: sab });
            MockWorker.last().autoSucceed(null);
            await worker.start(null);
            const runMsg = MockWorker.last()._messages.find(m => m.type === 'run');
            expect(runMsg.sharedBuffer).toBe(sab);
        });

        it('rejects when the task throws inside the worker', async () => {
            const worker = new YaiWorker((x) => x);
            MockWorker.last().autoFail('Something went wrong');
            await expect(worker.start()).rejects.toThrow('Something went wrong');
        });

        it('throws synchronously if called while already running', async () => {
            const worker = new YaiWorker((x) => x); // no auto-response → stays pending
            const pending = worker.start('first');

            await expect(worker.start('second')).rejects.toThrow('already running');

            // Terminate to resolve the hanging promise
            worker.terminate();
            await pending.catch(() => {});
        });

        it('throws if the worker was already terminated', async () => {
            const worker = new YaiWorker((x) => x);
            worker.terminate();
            await expect(worker.start()).rejects.toMatchObject({ name: 'AbortError' });
        });
    });

    // ── terminate() ───────────────────────────────────────────────────────

    describe('terminate()', () => {
        it('rejects a pending promise with AbortError', async () => {
            const worker = new YaiWorker((x) => x);
            const pending = worker.start('data');
            worker.terminate();
            await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        });

        it('is idempotent — calling twice does not throw', () => {
            const worker = new YaiWorker((x) => x);
            expect(() => {
                worker.terminate();
                worker.terminate();
            }).not.toThrow();
        });

        it('revokes the blob URL', () => {
            const worker = new YaiWorker((x) => x);
            worker.terminate();
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-worker-url');
        });
    });

    // ── static run() ──────────────────────────────────────────────────────

    describe('static run()', () => {
        it('resolves with the task result', async () => {
            MockWorker.succeedNext('static-result');
            const result = await YaiWorker.run((x) => x, 'input');
            expect(result).toBe('static-result');
        });

        it('passes inputData to the worker', async () => {
            MockWorker.succeedNext(null);
            await YaiWorker.run((x) => x, { hello: 'world' });
            const runMsg = MockWorker.last()._messages.find(m => m.type === 'run');
            expect(runMsg.inputData).toEqual({ hello: 'world' });
        });

        it('auto-terminates after completion', async () => {
            MockWorker.succeedNext('done');
            await YaiWorker.run((x) => x, null);
            expect(MockWorker.last()._terminated).toBe(true);
        });

        it('rejects on task error', async () => {
            MockWorker.failNext('run-error');
            await expect(YaiWorker.run((x) => x)).rejects.toThrow('run-error');
        });
    });

    // ── Progress ──────────────────────────────────────────────────────────

    describe('Progress', () => {
        it('calls onProgress with the payload and does not settle the promise', async () => {
            const received = [];
            const worker = new YaiWorker(
                async (data, taskId) => data,
                { onProgress: (p) => received.push(p) }
            );

            const mock = MockWorker.last();
            const pending = worker.start('data');

            // Send progress mid-flight, then trigger success directly
            mock.sendProgress({ pct: 25 });
            mock.sendProgress({ pct: 75 });
            mock.triggerSuccess('done');
            await pending;

            expect(received).toEqual([{ pct: 25 }, { pct: 75 }]);
        });

        it('does not dispatch a worker:progress CustomEvent on targetElement', async () => {
            const el = createMockContainer();
            const events = [];
            el.addEventListener('worker:progress', (e) => events.push(e));

            const worker = new YaiWorker((x) => x, { targetElement: el, onProgress: () => {} });
            const mock = MockWorker.last();
            mock.autoSucceed(null);
            mock.sendProgress({ pct: 50 });
            await worker.start();

            expect(events).toHaveLength(0);
        });

        it('does not throw when onProgress callback throws', async () => {
            const worker = new YaiWorker(
                (x) => x,
                { onProgress: () => { throw new Error('bad callback'); } }
            );
            const mock = MockWorker.last();
            const pending = worker.start('data');
            mock.sendProgress('anything');
            mock.triggerSuccess('result');
            await expect(pending).resolves.toBe('result');
        });
    });

    // ── targetElement CustomEvents ─────────────────────────────────────────

    describe('targetElement', () => {
        it('dispatches worker:success on the element when the task succeeds', async () => {
            const el = createMockContainer();
            const events = [];
            el.addEventListener('worker:success', (e) => events.push(e));

            const worker = new YaiWorker((x) => x, { targetElement: el });
            MockWorker.last().autoSucceed('hello');
            await worker.start();

            expect(events).toHaveLength(1);
            expect(events[0].detail.payload).toBe('hello');
            expect(events[0].detail.originElement).toBe(el);
            expect(events[0].detail.taskId).toMatch(/^YAI-/);
            expect(events[0].bubbles).toBe(true);
        });

        it('dispatches worker:error on the element when the task fails', async () => {
            const el = createMockContainer();
            const events = [];
            el.addEventListener('worker:error', (e) => events.push(e));

            const worker = new YaiWorker((x) => x, { targetElement: el });
            MockWorker.last().autoFail('task failed');
            await worker.start().catch(() => {});

            expect(events).toHaveLength(1);
            expect(events[0].detail.payload).toBe('task failed');
            expect(events[0].detail.originElement).toBe(el);
        });

        it('dispatches worker:error on the element on a thread crash (onerror path)', async () => {
            const el = createMockContainer();
            const events = [];
            el.addEventListener('worker:error', (e) => events.push(e));

            const worker = new YaiWorker((x) => x, { targetElement: el });
            MockWorker.last().triggerThreadError('Syntax error in worker');
            const pending = worker.start();
            await pending.catch(() => {});

            expect(events).toHaveLength(1);
            expect(events[0].detail.payload).toContain('Thread error');
        });

        it('does not hang the promise when a DOM dispatch listener throws', async () => {
            const el = createMockContainer();
            el.addEventListener('worker:success', () => { throw new Error('listener blew up'); });

            const worker = new YaiWorker((x) => x, { targetElement: el });
            MockWorker.last().autoSucceed('value');
            await expect(worker.start()).resolves.toBe('value');
        });
    });

    // ── AbortSignal ───────────────────────────────────────────────────────

    describe('AbortSignal', () => {
        it('terminates the worker when the signal fires', async () => {
            const controller = new AbortController();
            const worker = new YaiWorker((x) => x, { abortSignal: controller.signal });
            const pending = worker.start('data');

            controller.abort();

            await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
            expect(MockWorker.last()._terminated).toBe(true);
        });
    });

    // ── Mode ──────────────────────────────────────────────────────────────

    describe('Mode', () => {
        it('transient: terminates the worker after start() resolves', async () => {
            const worker = new YaiWorker((x) => x, { mode: 'transient' });
            MockWorker.last().autoSucceed('result');
            await worker.start();
            expect(MockWorker.last()._terminated).toBe(true);
        });

        it('persistent: keeps the worker alive after start() resolves', async () => {
            const worker = new YaiWorker((x) => x, { mode: 'persistent' });
            MockWorker.last().autoSucceed('first');
            await worker.start('a');
            expect(MockWorker.last()._terminated).toBe(false);
            worker.terminate();
        });

        it('persistent: allows multiple sequential start() calls', async () => {
            const worker = new YaiWorker((x) => x, { mode: 'persistent' });
            const mock = MockWorker.last();

            mock.autoSucceed(10);
            const r1 = await worker.start('a');

            mock.autoSucceed(20);
            const r2 = await worker.start('b');

            expect(r1).toBe(10);
            expect(r2).toBe(20);
            worker.terminate();
        });
    });
});
