/**
 * 🧵 **YaiWorker - Zero-Build Web Worker Orchestration**
 *
 * Runs any serializable function in a dedicated `Worker` thread without a build step.
 * Handles worker creation, message routing, promise settlement, CSP fallback, and
 * cleanup automatically — leaving the caller with a clean `async/await` interface.
 *
 * **🚀 Key Features:**
 * - **Two modes:** `transient` (auto-terminated after one run) and `persistent` (reusable)
 * - **CSP-safe:** falls back to a static asset worker when `blob:` URLs are blocked
 * - **DOM integration:** dispatches `CustomEvent`s to a `targetElement` alongside promise resolution
 * - **Transferables:** zero-copy `ArrayBuffer` / `SharedArrayBuffer` support
 * - **AbortSignal:** integrates with the native cancellation API
 * - **Progress callbacks:** `onProgress` receives intermediate payloads without settling the promise
 * - **Fail-fast validation:** `SerializationGuard` rejects tasks that reference DOM globals before spawning
 *
 * **📊 Performance:**
 * - Worker is spawned eagerly in the constructor, so `start()` has no cold-start delay
 * - Blob URL is revoked immediately after the worker exits (transient mode)
 * - `SharedArrayBuffer` transfers avoid serialization overhead for large data
 *
 * @author YaiJS Team
 * @license MIT
 * @see https://github.com/yaijs/yai/tree/main/worker
 */

/**
 * ⚙️ **YaiWorker Configuration Options**
 *
 * Passed as the second argument to the `YaiWorker` constructor (and forwarded by `YaiWorker.run`).
 *
 * @example
 * ```typescript
 * const options: YaiWorkerOptions = {
 *   mode: 'persistent',
 *   targetElement: document.querySelector('#result'),
 *   onProgress: (payload) => console.log('Progress:', payload),
 *   abortSignal: controller.signal,
 *   importScripts: ['https://cdn.example.com/lib.js'],
 *   transferables: [buffer],
 * };
 * ```
 */
export interface YaiWorkerOptions {
  /**
   * Worker lifecycle mode.
   * - `'transient'` — worker is terminated automatically after a single `start()` call (default).
   * - `'persistent'` — worker survives after `start()` completes and can be reused.
   * @default 'transient'
   */
  mode?: 'transient' | 'persistent';

  /**
   * DOM element that receives `worker:success` and `worker:error` `CustomEvent`s.
   * When omitted, no DOM events are dispatched — only the returned promise is settled.
   */
  targetElement?: HTMLElement;

  /**
   * URLs passed to `importScripts()` inside the worker context before the task runs.
   * Useful for loading helper libraries available as classic scripts.
   * @default []
   */
  importScripts?: string[];

  /**
   * `ArrayBuffer` objects to transfer (zero-copy) to the worker with the initial `run` message.
   * Can be overridden per-call via the second argument of `start()`.
   * @default []
   */
  transferables?: ArrayBuffer[];

  /**
   * A `SharedArrayBuffer` shared between the main thread and the worker.
   * Passed as the third argument to the task function: `(inputData, taskId, sharedBuffer)`.
   * Enables zero-copy, lock-free shared memory between threads via `Atomics`.
   */
  sharedBuffer?: SharedArrayBuffer;

  /**
   * Called whenever the worker posts an intermediate `progress` envelope.
   * Receives the raw `payload` value from the worker message.
   * Progress messages do **not** settle the promise and do **not** dispatch a DOM `CustomEvent`.
   */
  onProgress?: (payload: any) => void;

  /**
   * An `AbortSignal` that terminates the worker when aborted.
   * Equivalent to calling `terminate()` manually, but integrates with the native cancellation API.
   */
  abortSignal?: AbortSignal;

  /**
   * Suppress the serialization error thrown when a non-arrow function contains `this`.
   * Only set this when you are certain the binding is not needed inside the worker.
   * @default false
   */
  allowThis?: boolean;

  /**
   * URL of a pre-compiled worker file that already implements the YaiWorker message protocol.
   *
   * When set, YaiWorker bypasses task serialization, CSP detection, and Blob URL creation
   * entirely — it simply calls `new Worker(workerUrl)`. The `task` constructor argument is
   * ignored and may be `null`.
   *
   * The worker file must handle `{ type: 'run', taskId, inputData, sharedBuffer }` messages
   * and respond with standard envelopes:
   * - `{ taskId, status: 'success', payload: result }`
   * - `{ taskId, status: 'error', payload: errorMessage }`
   * - `{ taskId, status: 'progress', payload: progressData }` (optional)
   *
   * **Primary use case:** Chrome Extension MV3, where `new Function` is blocked by CSP
   * and `blob:` workers are unavailable. Pass `chrome.runtime.getURL('your-worker.js')`.
   *
   * @example
   * ```typescript
   * // Chrome Extension MV3
   * const worker = new YaiWorker(null, {
   *   workerUrl: chrome.runtime.getURL('workers/sync-worker.js'),
   *   mode: 'persistent',
   * });
   * const plan = await worker.start({ local, server });
   * ```
   */
  workerUrl?: string;
}

/**
 * 📬 **Worker Success Event Detail**
 *
 * Shape of `event.detail` on the `worker:success` `CustomEvent` dispatched to `targetElement`.
 */
export interface WorkerSuccessDetail {
  /** Unique identifier of the task that produced this result. */
  taskId: string;
  /** The value returned (or resolved) by the task function. */
  payload: any;
  /** The element that originally triggered the worker. */
  originElement: HTMLElement;
}

/**
 * 📬 **Worker Error Event Detail**
 *
 * Shape of `event.detail` on the `worker:error` `CustomEvent` dispatched to `targetElement`.
 * Fired for both task-level throws and fatal worker thread crashes.
 */
export interface WorkerErrorDetail {
  /** Unique identifier of the task that produced this error. */
  taskId: string;
  /** The error message string from the worker thread. */
  payload: string;
  /** The element that originally triggered the worker. */
  originElement: HTMLElement;
}

/**
 * 🧵 **YaiWorker - Web Worker Orchestration Class**
 *
 * Wraps a `Worker` thread around any serializable function, exposing a
 * promise-based API with optional DOM event integration.
 *
 * **📖 Usage Examples:**
 *
 * @example
 * **One-shot convenience (static):**
 * ```typescript
 * const result = await YaiWorker.run(
 *   (data) => data.map((n) => n * 2),
 *   [1, 2, 3]
 * );
 * console.log(result); // [2, 4, 6]
 * ```
 *
 * @example
 * **Transient worker (default mode):**
 * ```typescript
 * const worker = new YaiWorker((data) => data.reduce((a, b) => a + b, 0));
 * const sum = await worker.start([10, 20, 30]);
 * console.log(sum); // 60
 * // Worker is automatically terminated after start() resolves
 * ```
 *
 * @example
 * **Persistent worker:**
 * ```typescript
 * const worker = new YaiWorker(
 *   (data) => data * data,
 *   { mode: 'persistent' }
 * );
 *
 * const a = await worker.start(4);  // 16
 * const b = await worker.start(5);  // 25
 * worker.terminate();
 * ```
 *
 * @example
 * **Progress updates:**
 * ```typescript
 * const worker = new YaiWorker(
 *   async (data, taskId) => {
 *     for (let i = 0; i <= 100; i += 10) {
 *       self.postMessage({ taskId, status: 'progress', payload: i });
 *       await new Promise(r => setTimeout(r, 50));
 *     }
 *     return 'done';
 *   },
 *   { onProgress: (pct) => console.log(`${pct}%`) }
 * );
 * await worker.start();
 * ```
 *
 * @example
 * **DOM event integration:**
 * ```typescript
 * const button = document.querySelector('#run');
 * button.addEventListener('worker:success', (e: CustomEvent<WorkerSuccessDetail>) => {
 *   console.log('Result:', e.detail.payload);
 * });
 *
 * const worker = new YaiWorker(
 *   (data) => data.toUpperCase(),
 *   { targetElement: button }
 * );
 * await worker.start('hello');
 * ```
 *
 * @example
 * **AbortSignal cancellation:**
 * ```typescript
 * const controller = new AbortController();
 * const worker = new YaiWorker(
 *   (data) => heavyComputation(data),
 *   { abortSignal: controller.signal }
 * );
 *
 * setTimeout(() => controller.abort(), 2000);
 *
 * try {
 *   const result = await worker.start(largeDataset);
 * } catch (e) {
 *   if (e instanceof DOMException && e.name === 'AbortError') {
 *     console.log('Worker was cancelled');
 *   }
 * }
 * ```
 *
 * @example
 * **Transferable ArrayBuffer (zero-copy):**
 * ```typescript
 * const buffer = new ArrayBuffer(1024 * 1024 * 16); // 16 MB
 * const worker = new YaiWorker(
 *   (buf) => new Uint8Array(buf).reduce((a, b) => a + b, 0),
 *   { transferables: [buffer] }
 * );
 * const sum = await worker.start(buffer);
 * ```
 */
export declare class YaiWorker {
  /**
   * 🏗️ **Create a YaiWorker Instance**
   *
   * Validates the task with `SerializationGuard`, detects CSP restrictions via
   * `CSPDetector`, and spawns the underlying `Worker` eagerly so `start()` has
   * no cold-start latency.
   *
   * @param task - The function (or serialized source string) to run in the worker.
   *   Receives `(inputData, taskId, sharedBuffer)` as arguments.
   *   Must not reference DOM globals (`window`, `document`, etc.).
   *   Arrow functions are recommended to avoid `this`-binding issues.
   * @param options - Optional configuration overrides.
   * @throws {Error} When `task` references a forbidden main-thread global.
   * @throws {Error} When a non-arrow `task` uses `this` and `allowThis` is not set.
   *
   * @example
   * ```typescript
   * const worker = new YaiWorker((data: number[]) => Math.max(...data));
   * const max = await worker.start([3, 1, 4, 1, 5, 9]);
   * ```
   */
  constructor(task: Function | string, options?: YaiWorkerOptions);

  /**
   * ▶️ **Run the Worker Task**
   *
   * Posts a `run` message to the worker thread and returns a promise that settles
   * when the task completes. Only one `start()` call may be active at a time.
   *
   * If `targetElement` is configured, a `worker:success` or `worker:error`
   * `CustomEvent` is dispatched to the element alongside promise resolution.
   *
   * In `transient` mode the worker is automatically terminated after this resolves.
   *
   * @param inputData - Arbitrary serializable data passed as the first argument to the task.
   *   Defaults to `null`.
   * @param transferables - Per-call list of `ArrayBuffer` objects to transfer zero-copy.
   *   Falls back to the `transferables` array from constructor options.
   * @returns Promise that resolves with the task return value, or rejects on error or abort.
   * @throws {DOMException} `'AbortError'` when the worker has already been terminated.
   * @throws {Error} When called while a previous `start()` is still pending.
   *
   * @example
   * ```typescript
   * const result = await worker.start({ items: [1, 2, 3] });
   * ```
   */
  start(inputData?: any, transferables?: ArrayBuffer[]): Promise<any>;

  /**
   * 🛑 **Terminate the Worker**
   *
   * Immediately stops the underlying `Worker`, revokes the blob URL (if any),
   * rejects any pending promise with an `AbortError`, and unregisters the task
   * from `TaskRegistry`. Safe to call multiple times — subsequent calls are no-ops.
   *
   * @example
   * ```typescript
   * const worker = new YaiWorker(longTask, { mode: 'persistent' });
   * await worker.start(data1);
   * await worker.start(data2);
   * worker.terminate(); // explicit cleanup
   * ```
   */
  terminate(): void;

  /**
   * ⚡ **Static One-Shot Convenience**
   *
   * Creates a transient worker, runs the task once, terminates it, and returns
   * the result. Equivalent to:
   * ```typescript
   * const w = new YaiWorker(task, { ...options, mode: 'transient' });
   * const result = await w.start(inputData);
   * w.terminate();
   * ```
   *
   * @param task - The function (or serialized source string) to run.
   * @param inputData - Data passed to the task. Defaults to `null`.
   * @param options - Worker options (mode is forced to `'transient'`).
   * @returns Promise resolving with the task return value.
   *
   * @example
   * ```typescript
   * const sorted = await YaiWorker.run(
   *   (arr) => [...arr].sort((a, b) => a - b),
   *   [5, 3, 8, 1]
   * );
   * console.log(sorted); // [1, 3, 5, 8]
   * ```
   */
  static run(task: Function | string, inputData?: any, options?: YaiWorkerOptions): Promise<any>;
}

/**
 * 📤 **Module Exports**
 */
export default YaiWorker;

/**
 * 🎯 **Quick Start**
 *
 * **1. One-shot (simplest):**
 * ```typescript
 * import YaiWorker from '@yaijs/core/worker';
 *
 * const result = await YaiWorker.run((n) => n ** 2, 12);
 * console.log(result); // 144
 * ```
 *
 * **2. Persistent worker:**
 * ```typescript
 * const w = new YaiWorker((x) => x * 2, { mode: 'persistent' });
 * console.log(await w.start(5));  // 10
 * console.log(await w.start(7));  // 14
 * w.terminate();
 * ```
 *
 * **3. DOM events:**
 * ```typescript
 * const el = document.querySelector('#output');
 * el.addEventListener('worker:success', (e) => {
 *   el.textContent = e.detail.payload;
 * });
 * await new YaiWorker((d) => d.toUpperCase(), { targetElement: el }).start('hello');
 * ```
 *
 * **🔒 Forbidden in task functions:**
 * `window`, `document`, `localStorage`, `sessionStorage`, `parent`, `top`, `opener`, `location`
 *
 * Pass data instead via `inputData` or `SharedArrayBuffer`.
 */
