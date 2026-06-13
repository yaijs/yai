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
        if (this.#isTerminated) {
            throw new DOMException('Worker already terminated', 'AbortError');
        }
        if (this.#pendingPromise) {
            throw new Error('[YaiWorker] Worker is already running.');
        }

        // 1. Register WeakRef BEFORE creating promise (avoids race conditions)
        if (this.#options.targetElement) {
            TaskRegistry.register(this.#taskId, new WeakRef(this.#options.targetElement));
        }

        // 2. Store callbacks BEFORE postMessage (avoids early-message race)
        this.#pendingPromise = new Promise((resolve, reject) => {
            this.#resolveCallback = resolve;
            this.#rejectCallback = reject;
        });

        // 3. Wire listeners
        this.#worker.onmessage = (e) => this.#handleWorkerMessage(e);
        this.#worker.onerror = (e) => this.#handleWorkerError(e);

        // 4. Wire external AbortSignal
        if (this.#options.abortSignal) {
            this.#options.abortSignal.addEventListener('abort', () => {
                if (!this.#isTerminated) this.terminate();
            }, {once: true});
        }

        // 5. Launch worker
        this.#worker.postMessage(
            {
                type: 'run',
                taskId: this.#taskId,
                inputData,
                sharedBuffer: this.#options.sharedBuffer ?? null
            },
            transferables || [] // Second arg: transfer list
        );

        return this.#pendingPromise;
    }

    terminate() {
        if (this.#isTerminated) return;
        this.#isTerminated = true;

        this.#worker?.terminate();
        this.#worker = null;

        if (this.#workerUrl) {
            URL.revokeObjectURL(this.#workerUrl);
            this.#workerUrl = null;
        }

        if (this.#rejectCallback) {
            this.#rejectCallback(new DOMException('Operation aborted', 'AbortError'));
        }

        TaskRegistry.unregister(this.#taskId);
        this.#pendingPromise = null;
        this.#resolveCallback = null;
        this.#rejectCallback = null;
    }

    // ── Private Methods ──────────────────────────────────────────────────────

    #setupWorker() {
        if (this.#options.workerUrl) {
            // Explicit URL: pre-compiled worker — no blob, no CSP detection, no init message
            this.#worker = new Worker(this.#options.workerUrl);
            return;
        }

        const restricted = isCSPRestricted();
        const taskStr = typeof this.#task === 'function' ? this.#task.toString() : this.#task;

        if (restricted) {
            // CSP fallback: static asset path (works for BOTH transient and persistent modes)
            this.#worker = new Worker('/assets/yai-worker-bridge.js');
            this.#worker.postMessage({
                type: 'init',
                code: taskStr,
                importScripts: this.#options.importScripts
            });
        } else {
            // Primary path: inline Blob
            const scripts = this.#options.importScripts
                .map(u => `importScripts(${JSON.stringify(u)});`)
                .join('\n');

            const blobSrc = [
                `'use strict';`,
                scripts,
                `var _task = ${taskStr};`,
                WORKER_BRIDGE_SOURCE
            ].join('\n');

            const blob = new Blob([blobSrc], {type: 'application/javascript'});
            this.#workerUrl = URL.createObjectURL(blob);
            this.#worker = new Worker(this.#workerUrl);
        }
    }

    #handleWorkerMessage(e) {
        const env = e.data;
        // Drop stale or malformed messages
        if (!env?.taskId || env.taskId !== this.#taskId) return;

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
                        detail: {taskId: this.#taskId, payload: err.message, originElement: el}
                    }));
                }
            } catch (_) { }
        }

        this.#rejectCallback?.(err);
        this.#cleanup();
    }

    #cleanup() {
        // Only revoke URL and unregister. Do NOT set isTerminated here.
        // Persistent workers survive cleanup; terminate() handles full teardown.
        if (this.#options.mode === 'transient') {
            if (this.#workerUrl) {
                URL.revokeObjectURL(this.#workerUrl);
                this.#workerUrl = null;
            }
            this.#worker?.terminate();
            this.#worker = null;
            this.#isTerminated = true;
        }

        TaskRegistry.unregister(this.#taskId);
        this.#pendingPromise = null;
        this.#resolveCallback = null;
        this.#rejectCallback = null;
    }
}
