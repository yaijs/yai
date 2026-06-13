/**
 * 🌉 **worker-bridge-src - Inline Worker Bootstrap Source**
 *
 * Exports the classic Worker runtime logic as a string constant for zero-build
 * Blob injection. `YaiWorker` concatenates this string with the serialized task
 * function and injects the result into a `new Worker(blobUrl)` on the primary
 * (non-CSP) code path.
 *
 * The bridge handles two message types sent from the main thread:
 *
 * - **`'init'`** *(CSP fallback path only)* — Receives `{ code, importScripts }`,
 *   runs any `importScripts` URLs, then reconstructs the task function via
 *   `new Function('return (' + code + ')')()`.
 * - **`'run'`** — Receives `{ taskId, inputData, sharedBuffer }`, calls the task
 *   as `await _task(inputData, taskId, sharedBuffer)`, and posts back a result envelope:
 *   - `{ taskId, status: 'success', payload }` on resolution
 *   - `{ taskId, status: 'error', payload }` on rejection
 *
 * The task can post intermediate progress by calling:
 * ```javascript
 * self.postMessage({ taskId, status: 'progress', payload: value });
 * ```
 *
 * @module worker-bridge-src
 * @internal
 */

/**
 * The worker bootstrap source code as a raw string, ready for Blob injection.
 *
 * **Format when used by `YaiWorker`:**
 * ```javascript
 * const blobSrc = [
 *   `'use strict';`,
 *   importScriptLines,      // importScripts("url1"); importScripts("url2");
 *   `var _task = ${taskFn.toString()};`,
 *   WORKER_BRIDGE_SOURCE,   // ← this constant
 * ].join('\n');
 *
 * const blob = new Blob([blobSrc], { type: 'application/javascript' });
 * const worker = new Worker(URL.createObjectURL(blob));
 * ```
 *
 * @example
 * ```typescript
 * import { WORKER_BRIDGE_SOURCE } from './worker-bridge-src.js';
 *
 * const taskFn = (data: number) => data ** 3;
 * const blobSrc = `'use strict';\nvar _task = ${taskFn.toString()};\n${WORKER_BRIDGE_SOURCE}`;
 * const worker = new Worker(URL.createObjectURL(new Blob([blobSrc], { type: 'application/javascript' })));
 * ```
 */
export declare const WORKER_BRIDGE_SOURCE: string;
