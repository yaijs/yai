**✅ Unified Final Implementation Plan: `YaiWorker`**

**Target Constraints:** <1,000 LOC total, Zero Build Tools, 100% Vanilla ES Modules (public API), Classic Workers (internal), Tight YEH Integration.

### 1. Exact File Structure

```
/src/
├── yai-worker.js                 # Public ES Module - Main entry point (export default class)
├── internal/
│   ├── worker-bridge.js          # Classic Script (NO exports/imports) - Blob template + fallback logic
│   ├── TaskRegistry.js           # ES Module - WeakRef + taskId registry
│   ├── CSPDetector.js            # ES Module - isCSPRestricted() utility
│   └── SerializationGuard.js     # ES Module - validateTask() scanner
└── assets/                       # Packaged static fallback (copied during build/dist)
    └── yai-worker-bridge.js      # Exact copy of internal/worker-bridge.js (Classic Script)
```

**Rules:**
- All `internal/*.js` (except `worker-bridge.js`) are ES Modules (`import`/`export`).
- `worker-bridge.js` and `assets/yai-worker-bridge.js` are **Classic Scripts** (use `self`, no `export`, no top-level `await`).
- `yai-worker.js` is the only file exposed to users.

---

### 2. Exact Public API Signature

```js
// yai-worker.js
export default class YaiWorker {
  /**
   * @param {Function|string} task - Self-contained function or code string
   * @param {Object} options
   * @param {'transient'|'persistent'} [options.mode='transient']
   * @param {HTMLElement} [options.targetElement] - For automatic YEH event dispatch
   * @param {string[]} [options.importScripts] - CDN URLs for importScripts()
   * @param {ArrayBuffer[]} [options.transferables] - For zero-copy on start()
   * @param {SharedArrayBuffer} [options.sharedBuffer] - Optional progress tracking
   * @param {Function} [options.onProgress] - (progressPayload) => void
   * @param {AbortSignal} [options.abortSignal]
   */
  constructor(task, options = {});

  /**
   * Static one-shot Promise helper
   * @returns {Promise<any>}
   */
  static async run(task, inputData = null, options = {});

  /**
   * Start execution (returns Promise)
   * Also triggers YEH events if targetElement was provided
   * @returns {Promise<any>}
   */
  async start(inputData = null);

  /**
   * Force terminate + cleanup
   */
  terminate();
}
```

**Usage examples (for docs):**
```js
const worker = new YaiWorker(myTaskFn, { targetElement: btn });
const result = await worker.start(largeData);

await YaiWorker.run(myTaskFn, data, { mode: 'transient' });
```

---

### 3. Exact Structural Shape of Internal Message Envelopes

**Main → Worker (`YaiWorkerCommand`):**
```js
{
  type: 'init' | 'run' | 'terminate',
  taskId?: string,
  code?: string,           // Only used in CSP fallback
  inputData?: any,
  importScripts?: string[],
  sharedBuffer?: SharedArrayBuffer,
  transferables?: ArrayBuffer[]   // Handled via second param of postMessage
}
```

**Worker → Main (`YaiWorkerEnvelope`):**
```js
{
  taskId: string,                  // Required - always present
  status: 'success' | 'error' | 'progress',
  payload: any,                    // Result, error message, or progress value
  transferList?: ArrayBuffer[]     // Optional
}
```

**Hard rule:** Any incoming message on main thread **without** matching `taskId` is ignored.

---

### 4. Precise Logic: Main Thread Coordinator

#### Constructor Flow (`yai-worker.js`)
1. Store `this.task`, `this.options`, `this.taskId = this.#generateTaskId()`
2. Call `SerializationGuard.validateTask(this.task)`
3. Call `this.#setupWorker()`
4. Initialize `this.pendingPromise = null`, `this.worker = null`, `this.workerUrl = null`, `this.isTerminated = false`

#### `#setupWorker()`
```js
#setupWorker() {
  const isRestricted = CSPDetector.isCSPRestricted();

  if (isRestricted && this.options.mode === 'transient') {
    // Fallback path
    this.worker = new Worker('/assets/yai-worker-bridge.js');
    this.worker.postMessage({
      type: 'init',
      code: typeof this.task === 'function' ? this.task.toString() : this.task,
      importScripts: this.options.importScripts || []
    });
  } else {
    // Blob path
    let code = `'use strict';\n`;
    if (this.options.importScripts?.length) {
      code += this.options.importScripts.map(u => `importScripts('${u}');`).join('\n') + '\n';
    }
    code += `
      const _task = ${typeof this.task === 'function' ? this.task.toString() : this.task};
      self.onmessage = function(e) { /* worker logic - see below */ };
    `;

    const blob = new Blob([code], { type: 'application/javascript' });
    this.workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(this.workerUrl);
  }
}
```

#### `async start(inputData = null)`
1. Guard: if terminated or already pending → throw
2. If `targetElement` → `TaskRegistry.register(this.taskId, new WeakRef(targetElement))`
3. Create new `Promise` and store `resolveCallback` / `rejectCallback`
4. Set `this.worker.onmessage` and `this.worker.onerror` (one-time)
5. `this.worker.postMessage({ type: 'run', taskId: this.taskId, inputData, sharedBuffer: this.options.sharedBuffer }, this.options.transferables || [])`
6. Wire `abortSignal` if provided
7. Return the promise

#### `#handleWorkerMessage(e)`
```js
#handleWorkerMessage(e) {
  const envelope = e.data;
  if (!envelope?.taskId || envelope.taskId !== this.taskId) return;

  // 1. YEH Dispatch (isolated)
  if (this.options.targetElement && envelope.status !== 'progress') {
    try {
      const target = TaskRegistry.lookup(this.taskId)?.deref();
      if (target) {
        target.dispatchEvent(new CustomEvent(`worker:${envelope.status}`, {
          bubbles: true,
          detail: { taskId: envelope.taskId, payload: envelope.payload, originElement: target }
        }));

        window.YEH?.dispatch?.(`worker:${envelope.status}`, {
          taskId: envelope.taskId,
          payload: envelope.payload,
          originElement: target
        });
      }
    } catch (err) {
      console.error('[YaiWorker] YEH dispatch failed:', err);
    }
  }

  // 2. Progress callback
  if (envelope.status === 'progress' && typeof this.options.onProgress === 'function') {
    try { this.options.onProgress(envelope.payload); } catch (_) {}
  }

  // 3. Promise resolution (after events)
  if (envelope.status === 'success') {
    this.resolveCallback?.(envelope.payload);
    this.#cleanup();
  } else if (envelope.status === 'error') {
    this.rejectCallback?.(new Error(envelope.payload));
    this.#cleanup();
  }
}
```

#### `#handleWorkerError(errorEvent)`
- Create enhanced `Error`
- Dispatch `worker:error` via `targetElement` and YEH (try/catch)
- `rejectCallback(enhancedError)`
- `#cleanup()`

#### `terminate()`
- Set `isTerminated = true`
- `this.worker?.terminate()`
- `URL.revokeObjectURL(this.workerUrl)` if exists
- Reject pending promise with `new DOMException('Operation aborted', 'AbortError')`
- `TaskRegistry.unregister(this.taskId)`
- Null out references

---

### 5. Precise Logic: Inner Worker (`worker-bridge.js`)

**For Blob path (embedded in template):**
```js
self.onmessage = function(e) {
  if (e.data.type === 'run') {
    try {
      const result = _task(e.data.inputData);   // or await if async support added later
      self.postMessage({
        taskId: e.data.taskId,
        status: 'success',
        payload: result
      });
    } catch (err) {
      self.postMessage({
        taskId: e.data.taskId,
        status: 'error',
        payload: err.message || String(err)
      });
    }
  }
};
```

**For CSP fallback (`init` message):**
- Store received `code` as `_task`
- Then behave identically to above on `run` messages.

**Progress / SharedArrayBuffer:** Handled inside `_task` if user provides `sharedBuffer` (optional, user responsibility for `Atomics`).

---

**Pre-Coding Checklist (Lock these in):**
- `validateTask()` throws early on forbidden globals/`this` issues.
- All envelopes enforce `taskId`.
- YEH dispatch **before** Promise resolution, inside try/catch.
- `terminate()` always rejects pending promise with `AbortError`.
- CSP fallback only for transient mode.
- `TaskRegistry` uses `WeakRef` + `Map`.
- Cleanup always revokes URL and unregisters task.

This blueprint is now **completely locked**. A junior developer can implement it file-by-file following the pseudocode above. No deviations.

Ready for code generation. 🚀
