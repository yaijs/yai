/**
 * The public ES Module API.Orchestrates everything.
 */
import {isCSPRestricted} from './internal/CSPDetector.js';
import {validateTask} from './internal/SerializationGuard.js';
import {TaskRegistry} from './internal/TaskRegistry.js';
import {WORKER_BRIDGE_SOURCE} from './internal/worker-bridge-src.js';

let _taskCounter = 0;
const generateTaskId = () => `YAI-${Date.now()}-${++_taskCounter}`;

export default class YaiWorker {
    #task;
    #options;
    #taskId;
    #worker = null;
    #workerUrl = null;
    #isTerminated = false;
    #resolveCallback = null;
    #rejectCallback = null;
    #pendingPromise = null;
    #abortSignal = null;
    #abortHandler = null;
    #nextRunId = 0;
    #activeRunId = null;
    #fatalError = null;

    /**
     * @param {Function|string} task
     * @param {Object} [options={}]
     * @param {'transient'|'persistent'} [options.mode='transient']
     * @param {HTMLElement} [options.targetElement]
     * @param {string[]} [options.importScripts=[]]
     * @param {ArrayBuffer[]} [options.transferables=[]]
     * @param {SharedArrayBuffer} [options.sharedBuffer]
     * @param {Function} [options.onProgress]
     * @param {AbortSignal} [options.abortSignal]
     * @param {boolean} [options.allowThis=false]
     * @param {string} [options.workerUrl] Portable pre-compiled worker URL. Required for restricted CSP.
     */
    constructor(task, options = {}) {
        this.#task = task;
        this.#options = {
            mode: 'transient',
            importScripts: [],
            transferables: [],
            ...options
        };
        this.#taskId = generateTaskId();

        // Skip serialization validation when using a pre-compiled worker file
        if (!this.#options.workerUrl) {
            validateTask(task, {allowThis: this.#options.allowThis ?? false});
        }
        this.#setupWorker();
        this.#bindAbortSignal();
    }

    /**
     * MICRO-ADJUSTMENT 1: Static one-shot convenience
     */
    static async run(task, inputData = null, options = {}) {
        const w = new YaiWorker(task, {...options, mode: 'transient'});
        try {
            return await w.start(inputData);
        } finally {
            if (!w.#isTerminated) w.terminate();
        }
    }

    /**
     * @param {any} [inputData=null]
     * @param {ArrayBuffer[]} [transferables] - MICRO-ADJUSTMENT 3: Explicit per-run transfer list
     * @returns {Promise<any>}
     */
    async start(inputData = null, transferables = this.#options.transferables) {
        if (this.#fatalError) {
            throw this.#fatalError;
        }
        if (this.#isTerminated) {
            throw new DOMException('Worker already terminated', 'AbortError');
        }
        if (this.#pendingPromise) {
            throw new Error('[YaiWorker] Worker is already running.');
        }

        // taskId identifies this worker for its lifetime; runId identifies one operation.
        // Persistent workers need both so a delayed reply cannot settle a later run.
        this.#activeRunId = ++this.#nextRunId;

        // 1. Register WeakRef BEFORE creating promise (avoids race conditions)
        if (this.#options.targetElement) {
            TaskRegistry.register(this.#taskId, new WeakRef(this.#options.targetElement));
        }

        // 2. Store callbacks BEFORE postMessage (avoids early-message race)
        this.#pendingPromise = new Promise((resolve, reject) => {
            this.#resolveCallback = resolve;
            this.#rejectCallback = reject;
        });

        try {
            // 3. Launch worker. Structured-clone and transfer-list failures throw synchronously.
            this.#worker.postMessage(
                {
                    type: 'run',
                    taskId: this.#taskId,
                    runId: this.#activeRunId,
                    inputData,
                    sharedBuffer: this.#options.sharedBuffer ?? null
                },
                transferables || [] // Second arg: transfer list
            );
        } catch (error) {
            // Do not reject the internal promise: start() exposes this synchronous failure
            // through its own rejected promise, and an unobserved inner rejection is noisy.
            this.#clearOperation();
            if (this.#options.mode === 'transient') {
                this.#isTerminated = true;
                this.#shutdownWorker();
                this.#unbindAbortSignal();
            }
            throw error;
        }

        return this.#pendingPromise;
    }

    terminate() {
        if (this.#isTerminated) return;
        this.#isTerminated = true;

        if (this.#rejectCallback) {
            this.#rejectCallback(new DOMException('Operation aborted', 'AbortError'));
        }

        this.#clearOperation();
        this.#shutdownWorker();
        this.#unbindAbortSignal();
    }

    // ── Private Methods ──────────────────────────────────────────────────────

    #setupWorker() {
        if (this.#options.workerUrl) {
            // Explicit URL: pre-compiled worker — no blob, no CSP detection, no init message
            this.#worker = new Worker(this.#options.workerUrl);
            this.#attachWorkerHandlers(this.#worker);
            return;
        }

        const restricted = isCSPRestricted();
        const taskStr = typeof this.#task === 'function' ? this.#task.toString() : this.#task;

        if (restricted) {
            throw new Error(
                '[YaiWorker] Serialized function tasks require Blob workers and are unavailable in CSP-restricted environments. ' +
                'Provide options.workerUrl for a portable pre-compiled worker.'
            );
        }

        // Primary path: inline Blob. Header CSP cannot be inspected, so Worker
        // construction remains the authoritative Blob-worker capability check.
        let workerUrl = null;
        try {
            const baseUrl = typeof document !== 'undefined' ? document.baseURI : undefined;
            const scripts = this.#options.importScripts
                .map(u => `importScripts(${JSON.stringify(new URL(u, baseUrl).href)});`)
                .join('\n');
            const blobSrc = [
                `'use strict';`,
                scripts,
                `var _task = ${taskStr};`,
                WORKER_BRIDGE_SOURCE
            ].join('\n');
            const blob = new Blob([blobSrc], {type: 'application/javascript'});
            workerUrl = URL.createObjectURL(blob);
            this.#worker = new Worker(workerUrl);
            this.#workerUrl = workerUrl;
            this.#attachWorkerHandlers(this.#worker);
        } catch (error) {
            if (workerUrl) URL.revokeObjectURL(workerUrl);
            if (error?.name === 'SecurityError') {
                const cspError = new Error(
                    '[YaiWorker] Blob workers are blocked by Content Security Policy. ' +
                    'Provide options.workerUrl for a portable pre-compiled worker.'
                );
                cspError.cause = error;
                throw cspError;
            }
            throw error;
        }
    }

    #attachWorkerHandlers(worker) {
        worker.onmessage = (event) => this.#handleWorkerMessage(event);
        worker.onerror = (event) => this.#handleWorkerError(event);
    }

    /**
     * A persistent worker owns one external abort subscription for its entire lifetime.
     * terminate() is the matching finalizer and removes it where supported.
     */
    #bindAbortSignal() {
        const signal = this.#options.abortSignal;
        if (!signal) return;

        this.#abortSignal = signal;
        this.#abortHandler = () => {
            if (!this.#isTerminated) this.terminate();
        };
        signal.addEventListener('abort', this.#abortHandler, {once: true});

        if (signal.aborted) {
            this.#abortHandler();
        }
    }

    #unbindAbortSignal() {
        if (this.#abortSignal && this.#abortHandler) {
            this.#abortSignal.removeEventListener?.('abort', this.#abortHandler);
        }
        this.#abortSignal = null;
        this.#abortHandler = null;
    }

    #handleWorkerMessage(e) {
        const env = e.data;
        // Drop stale or malformed messages
        if (!env?.taskId || env.taskId !== this.#taskId || env.runId !== this.#activeRunId) return;

        // STEP 1: Progress (non-terminal, no promise action)
        if (env.status === 'progress') {
            if (typeof this.#options.onProgress === 'function') {
                try {this.#options.onProgress(env.payload);} catch (_) { }
            }
            return;
        }

        // STEP 2: YEH dispatch
        if (this.#options.targetElement) {
            try {
                const el = TaskRegistry.lookup(this.#taskId)?.deref();
                if (el) {
                    el.dispatchEvent(new CustomEvent(`worker:${env.status}`, {
                        bubbles: true,
                        detail: {
                            taskId: env.taskId,
                            runId: env.runId,
                            payload: env.payload,
                            originElement: el
                        }
                    }));
                }
            } catch (dispatchErr) {
                console.error('[YaiWorker] CustomEvent dispatch error (promise unaffected):', dispatchErr);
            }
        }

        // STEP 3: Promise settlement
        if (env.status === 'success') {
            this.#resolveCallback?.(env.payload);
        } else if (env.status === 'error') {
            this.#rejectCallback?.(new Error(env.payload));
        } else {
            return;
        }

        this.#cleanup();
    }

    #handleWorkerError(errorEvent) {
        const err = new Error(`[YaiWorker] Thread error: ${errorEvent.message}`);
        err.filename = errorEvent.filename;
        err.lineno = errorEvent.lineno;

        if (this.#options.targetElement) {
            try {
                const el = TaskRegistry.lookup(this.#taskId)?.deref();
                if (el) {
                    el.dispatchEvent(new CustomEvent('worker:error', {
                        bubbles: true,
                        detail: {
                            taskId: this.#taskId,
                            runId: this.#activeRunId,
                            payload: err.message,
                            originElement: el
                        }
                    }));
                }
            } catch (_) { }
        }

        this.#rejectCallback?.(err);
        this.#clearOperation();
        this.#fatalError = err;
        this.#isTerminated = true;
        this.#shutdownWorker();
        this.#unbindAbortSignal();
    }

    #cleanup() {
        // Only revoke URL and unregister. Do NOT set isTerminated here.
        // Persistent workers survive cleanup; terminate() handles full teardown.
        if (this.#options.mode === 'transient') {
            this.#isTerminated = true;
            this.#shutdownWorker();
            this.#unbindAbortSignal();
        }

        this.#clearOperation();
    }

    #clearOperation() {
        TaskRegistry.unregister(this.#taskId);
        this.#pendingPromise = null;
        this.#resolveCallback = null;
        this.#rejectCallback = null;
        this.#activeRunId = null;
    }

    #shutdownWorker() {
        this.#worker?.terminate();
        this.#worker = null;
        if (this.#workerUrl) {
            URL.revokeObjectURL(this.#workerUrl);
            this.#workerUrl = null;
        }
    }
}
