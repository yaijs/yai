Both DeepSeek and Grok produced remarkably convergent plans — which is a good sign the architecture is solid. They agree on ~90% of it. Let me do what you actually need here: resolve the remaining frictions precisely, then output the locked blueprint with the specific decisions the reviews left ambiguous.

---

## Friction Points to Resolve Before the Blueprint

**Friction 1: `#handleWorkerMessage` closure bug (both reviews have it)**

Both plans store `resolveCallback`/`rejectCallback` as instance properties set inside `start()`, but then wire `onmessage` as `(e) => this.#handleWorkerMessage(e, resolve, reject)` (DeepSeek) or capture them via `this.resolveCallback` (Grok). The Grok pattern is cleaner but has a subtle bug: if `onmessage` is assigned *before* `resolveCallback` is stored, a racing early message could call `undefined`. **Fix:** assign callbacks first, then `postMessage`.

**Friction 2: CSP fallback only for `transient` — what about `persistent`?**

Both plans restrict the CSP fallback to `mode: 'transient'` only, but give no handling for `persistent` in a CSP-restricted environment. **Decision:** in a CSP-restricted context, `persistent` mode also uses the asset fallback — no silent failure. The `type: 'init'` + `type: 'run'` two-message protocol works identically for both modes.

**Friction 3: `validateTask` false positives on `this` in arrow functions**

DeepSeek's guard only skips the `this` check for arrow functions using `!fnStr.includes('=>')`. That breaks on mixed functions like `function() { return arr.map(x => this.process(x)) }` — the arrow inside doesn't make the outer `this` safe. **Fix:** detect `this` usage only outside of string literals and comments, or conservatively flag any `this.` in non-arrow functions and let the developer opt out with `{ allowThis: true }`.

**Friction 4: `worker-bridge.js` CSP fallback needs its own `init` → `run` state machine**

Neither review fully specifies the fallback worker's internal state. When used as a static asset, it receives `{ type: 'init', code, importScripts }` first, then `{ type: 'run', taskId, inputData }`. The bridge needs to store the compiled `_task` between those two messages. **Exact spec below.**

**Friction 5: Async task functions**

Neither plan specifies what happens if the user passes `async function heavyTask() { ... }`. The worker calls `_task(inputData)` and gets a Promise back — which it then serializes as the payload, not `await`s. **Fix:** the worker bridge must detect if `_task` returns a Promise and `await` it before `postMessage`-ing. This requires the worker `onmessage` handler to be `async`.

---

## Locked Implementation Blueprint

### File Structure

```
/src/
├── yai-worker.js                  ← ES Module  (public API, export default)
└── internal/
    ├── worker-bridge.js           ← Classic Script  (no export, no import)
    ├── TaskRegistry.js            ← ES Module
    ├── CSPDetector.js             ← ES Module
    └── SerializationGuard.js      ← ES Module

/assets/
└── yai-worker-bridge.js          ← Exact copy of internal/worker-bridge.js
                                     (Classic Script, deployed statically)
```

**Hard rules:**
- `worker-bridge.js` / `yai-worker-bridge.js`: no `export`, no `import`, no top-level `await`, no ES module syntax of any kind.
- All `internal/*.js` except `worker-bridge.js`: ES Modules with named exports.
- `yai-worker.js`: single `export default class YaiWorker`.

---

### Message Envelope Shapes

```javascript
/**
 * Main Thread → Worker
 * @typedef {Object} YaiWorkerCommand
 * @property {'init'|'run'|'terminate'} type
 * @property {string}   [taskId]        - Required for 'run'
 * @property {string}   [code]          - Serialized function string; only in CSP fallback 'init'
 * @property {string[]} [importScripts] - CDN URLs; only in 'init'
 * @property {any}      [inputData]     - Task input; only in 'run'
 * @property {SharedArrayBuffer} [sharedBuffer] - Optional; only in 'run'
 */

/**
 * Worker → Main Thread
 * @typedef {Object} YaiWorkerEnvelope
 * @property {string}                       taskId   - Always present; main thread drops message if missing
 * @property {'success'|'error'|'progress'} status
 * @property {any}                          payload  - Result value | error message string | progress value (0–1 number)
 */
```

**Invariants enforced at runtime:**
- Main thread: any incoming message where `envelope.taskId !== this.taskId` is silently dropped.
- Worker: every outgoing `postMessage` must include `taskId` copied from `e.data.taskId`.

---

### Public API Signature

```javascript
export default class YaiWorker {

    /**
     * @param {Function|string} task
     * @param {Object}  [options]
     * @param {'transient'|'persistent'}  [options.mode='transient']
     * @param {HTMLElement}               [options.targetElement]    - Initiating DOM element for YEH dispatch
     * @param {string[]}                  [options.importScripts=[]] - importScripts() URLs (classic worker only)
     * @param {ArrayBuffer[]}             [options.transferables=[]] - Zero-copy transfer list for start()
     * @param {SharedArrayBuffer}         [options.sharedBuffer]     - Optional bidirectional progress buffer
     * @param {(progress: any) => void}   [options.onProgress]       - Called on 'progress' envelopes
     * @param {AbortSignal}               [options.abortSignal]      - External cancellation signal
     * @param {boolean}                   [options.allowThis=false]  - Suppress this-reference validation warning
     */
    constructor(task, options = {})

    /**
     * Static one-shot convenience. Constructs, starts, and auto-terminates.
     * @param {Function|string} task
     * @param {any}    [inputData=null]
     * @param {Object} [options={}]      - Same shape as constructor options, minus mode (always 'transient')
     * @returns {Promise<any>}
     */
    static async run(task, inputData = null, options = {})

    /**
     * Start execution. Returns a Promise that resolves/rejects with the worker result.
     * If options.targetElement was provided, also dispatches YEH CustomEvents.
     * @param {any} [inputData=null]
     * @returns {Promise<any>}
     * @throws {DOMException} 'AbortError' if already terminated
     * @throws {Error}        if already running (pendingPromise exists)
     */
    async start(inputData = null)

    /**
     * Forcefully terminate. Kills worker thread, revokes blob URL,
     * rejects pending promise with DOMException('AbortError'), cleans registry.
     * Safe to call multiple times (idempotent).
     */
    terminate()
}
```

---

### `TaskRegistry.js`

```javascript
// ES Module
// Internal map: taskId (string) → WeakRef<HTMLElement>

const _map = new Map();

export const TaskRegistry = {
    register(taskId, weakRef) {
        _map.set(taskId, weakRef);
    },
    lookup(taskId) {
        return _map.get(taskId) ?? null;   // returns WeakRef or null
    },
    unregister(taskId) {
        _map.delete(taskId);
    }
};
```

---

### `CSPDetector.js`

```javascript
// ES Module
export function isCSPRestricted() {
    // Check 1: Chrome Extension context (MV3 always restricts blob:)
    if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
        return true;
    }
    // Check 2: <meta http-equiv="Content-Security-Policy"> present and excludes blob:
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (meta) {
        const content = meta.content;
        // If script-src is specified and does NOT include blob:, we're restricted
        if (/script-src/.test(content) && !/blob:/.test(content)) {
            return true;
        }
    }
    return false;
}
```

---

### `SerializationGuard.js`

```javascript
// ES Module
const FORBIDDEN = /\b(window|document|localStorage|sessionStorage|parent|top|opener|location)\b/;

export function validateTask(fn, { allowThis = false } = {}) {
    const src = typeof fn === 'function' ? fn.toString() : fn;

    if (FORBIDDEN.test(src)) {
        const match = src.match(FORBIDDEN)[0];
        throw new Error(
            `[YaiWorker] Task references forbidden main-thread global "${match}". ` +
            `Workers have no DOM access. Pass data as inputData instead.`
        );
    }

    // Detect `this.` usage in non-arrow functions only, unless allowThis is set
    const isArrow = /^(\s*async\s*)?\s*(\w+|\([^)]*\))\s*=>/.test(src);
    if (!allowThis && !isArrow && /\bthis\b/.test(src)) {
        throw new Error(
            `[YaiWorker] Task uses "this" which loses binding when serialized. ` +
            `Use an arrow function, or pass { allowThis: true } to suppress.`
        );
    }
    return true;
}
```

---

### `worker-bridge.js` (Classic Script — inner worker)

This is the **complete source** for both the Blob-embedded template and the static asset fallback. It must handle both usage paths:

```javascript
// Classic Script — NO import, NO export
// Used two ways:
//   A) Blob path:  _task is injected directly into the template string above this onmessage
//   B) Asset path: receives { type:'init', code, importScripts } first, then { type:'run', ... }

(function () {
    'use strict';

    // In asset fallback mode, _task starts undefined and is built from 'init' message
    // In blob mode, _task is injected by the template before this script runs
    var _taskFn = typeof _task !== 'undefined' ? _task : null;

    self.onmessage = async function (e) {
        var msg = e.data;

        // ── INIT (CSP fallback path only) ──────────────────────────────────
        if (msg.type === 'init') {
            if (msg.importScripts && msg.importScripts.length) {
                importScripts.apply(self, msg.importScripts);
            }
            try {
                // Reconstruct the function from the serialized string
                _taskFn = (new Function('return (' + msg.code + ')'))();
            } catch (err) {
                // Can't do much here — the run message will fail and report back
                _taskFn = null;
            }
            return; // wait for 'run'
        }

        // ── RUN ────────────────────────────────────────────────────────────
        if (msg.type === 'run') {
            if (typeof _taskFn !== 'function') {
                self.postMessage({
                    taskId: msg.taskId,
                    status: 'error',
                    payload: '[YaiWorker] Task function is not defined or failed to initialize.'
                });
                return;
            }
            try {
                // Await handles both sync and async task functions
                var result = await _taskFn(msg.inputData);
                self.postMessage({
                    taskId: msg.taskId,
                    status: 'success',
                    payload: result
                });
            } catch (err) {
                self.postMessage({
                    taskId: msg.taskId,
                    status: 'error',
                    payload: err.message || String(err)
                });
            }
        }
    };
}());
```

---

### `yai-worker.js` — Main Thread Coordinator (full pseudocode)

```javascript
import { TaskRegistry }     from './internal/TaskRegistry.js';
import { isCSPRestricted }  from './internal/CSPDetector.js';
import { validateTask }     from './internal/SerializationGuard.js';
import workerBridgeSource   from './internal/worker-bridge.js?raw'; // build-tool import
// NOTE FOR ZERO-BUILD: inline worker-bridge source as a template literal instead (see below)

let _taskCounter = 0;
function generateTaskId() {
    return `YAI-${Date.now()}-${++_taskCounter}`;
}

export default class YaiWorker {

    #task; #options; #taskId;
    #worker = null; #workerUrl = null;
    #isTerminated = false;
    #resolveCallback = null; #rejectCallback = null;
    #pendingPromise = null;

    constructor(task, options = {}) {
        this.#task = task;
        this.#options = { mode: 'transient', importScripts: [], transferables: [], ...options };
        this.#taskId = generateTaskId();

        validateTask(task, { allowThis: this.#options.allowThis ?? false });
        this.#setupWorker();
    }

    static async run(task, inputData = null, options = {}) {
        const w = new YaiWorker(task, { ...options, mode: 'transient' });
        try {
            return await w.start(inputData);
        } finally {
            // cleanup is handled inside start() → #cleanup()
            // but guard against re-terminate if already done
            if (!w.#isTerminated) w.terminate();
        }
    }

    async start(inputData = null) {
        if (this.#isTerminated)
            throw new DOMException('Worker already terminated', 'AbortError');
        if (this.#pendingPromise)
            throw new Error('[YaiWorker] Worker is already running. Await the current task or terminate first.');

        // Register WeakRef BEFORE creating promise (avoids race)
        if (this.#options.targetElement) {
            TaskRegistry.register(this.#taskId, new WeakRef(this.#options.targetElement));
        }

        // Store callbacks BEFORE postMessage (avoids early-message race)
        this.#pendingPromise = new Promise((resolve, reject) => {
            this.#resolveCallback = resolve;
            this.#rejectCallback  = reject;
        });

        this.#worker.onmessage = (e) => this.#handleWorkerMessage(e);
        this.#worker.onerror   = (e) => this.#handleWorkerError(e);

        // Wire external AbortSignal
        if (this.#options.abortSignal) {
            this.#options.abortSignal.addEventListener('abort', () => {
                if (!this.#isTerminated) this.terminate();
            }, { once: true });
        }

        this.#worker.postMessage(
            {
                type: 'run',
                taskId: this.#taskId,
                inputData,
                sharedBuffer: this.#options.sharedBuffer ?? null
            },
            this.#options.transferables  // second arg: transfer list (empty array is safe)
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
        this.#rejectCallback  = null;
    }

    // ── Private ──────────────────────────────────────────────────────────────

    #setupWorker() {
        const restricted = isCSPRestricted();
        const taskStr = typeof this.#task === 'function'
            ? this.#task.toString()
            : this.#task;

        if (restricted) {
            // CSP fallback: static asset path (works for both modes)
            this.#worker = new Worker('/assets/yai-worker-bridge.js');
            this.#worker.postMessage({
                type: 'init',
                code: taskStr,
                importScripts: this.#options.importScripts
            });
        } else {
            // Primary path: inline Blob
            // worker-bridge.js source is inlined here as a template literal
            // (zero-build projects paste the worker-bridge.js source directly)
            const scripts = this.#options.importScripts
                .map(u => `importScripts(${JSON.stringify(u)});`)
                .join('\n');

            const blobSrc = [
                `'use strict';`,
                scripts,
                `var _task = ${taskStr};`,
                WORKER_BRIDGE_SOURCE   // ← inlined classic script body (see note)
            ].join('\n');

            const blob = new Blob([blobSrc], { type: 'application/javascript' });
            this.#workerUrl = URL.createObjectURL(blob);
            this.#worker = new Worker(this.#workerUrl);
        }
    }

    #handleWorkerMessage(e) {
        const env = e.data;

        // Drop stale or malformed messages
        if (!env?.taskId || env.taskId !== this.#taskId) return;

        // ── 1. Progress (non-terminal, no promise action) ──────────────────
        if (env.status === 'progress') {
            if (typeof this.#options.onProgress === 'function') {
                try { this.#options.onProgress(env.payload); } catch (_) {}
            }
            return; // do NOT resolve/reject, do NOT cleanup
        }

        // ── 2. YEH dispatch (crash-isolated, before promise settlement) ────
        if (this.#options.targetElement) {
            try {
                const el = TaskRegistry.lookup(this.#taskId)?.deref();
                if (el) {
                    el.dispatchEvent(new CustomEvent(`worker:${env.status}`, {
                        bubbles: true,
                        detail: {
                            taskId:        env.taskId,
                            payload:       env.payload,
                            originElement: el
                        }
                    }));
                }
                // Optional global YEH hub dispatch
                window.YEH?.dispatch?.(`worker:${env.status}`, {
                    taskId:        env.taskId,
                    payload:       env.payload,
                    originElement: TaskRegistry.lookup(this.#taskId)?.deref() ?? null
                });
            } catch (dispatchErr) {
                console.error('[YaiWorker] YEH dispatch error (promise unaffected):', dispatchErr);
            }
        }

        // ── 3. Promise settlement ──────────────────────────────────────────
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
        err.lineno   = errorEvent.lineno;

        if (this.#options.targetElement) {
            try {
                const el = TaskRegistry.lookup(this.#taskId)?.deref();
                if (el) {
                    el.dispatchEvent(new CustomEvent('worker:error', {
                        bubbles: true,
                        detail: { taskId: this.#taskId, error: err.message }
                    }));
                }
            } catch (_) {}
        }

        this.#rejectCallback?.(err);
        this.#cleanup();
    }

    #cleanup() {
        // Only revoke URL and unregister — do NOT set isTerminated
        // (persistent workers survive cleanup; terminate() handles full teardown)
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
        this.#pendingPromise   = null;
        this.#resolveCallback  = null;
        this.#rejectCallback   = null;
    }
}
```

---

### Zero-Build Note on `WORKER_BRIDGE_SOURCE`

Since you have no build tools, you can't use `?raw` imports. The bridge source needs to be inlined. Two clean options:

**Option A** (recommended): Export the bridge source as a JS string constant from a separate ES module file:
```javascript
// internal/worker-bridge-src.js  ← ES Module, exports a string
export const WORKER_BRIDGE_SOURCE = `
(function () {
    // ... paste full worker-bridge.js content here as a string ...
}());
`;
```
Then import it in `yai-worker.js`. The `assets/yai-worker-bridge.js` static file remains a separate, identical copy.

**Option B**: Inline the bridge source directly as a template literal inside `#setupWorker()`. More compact, but harder to maintain in sync with the static asset copy.

---

### Final Pre-Coding Checklist

- `worker-bridge.js` and `assets/yai-worker-bridge.js` are byte-identical and contain zero ES module syntax
- `#resolveCallback`/`#rejectCallback` are stored **before** `postMessage` is called
- `#handleWorkerMessage` returns early on `progress` without touching the promise
- YEH dispatch runs **before** promise settlement, wrapped in `try/catch`
- `#cleanup()` terminates the worker only in `transient` mode; persistent workers stay alive for re-use
- `terminate()` is idempotent — safe to call multiple times
- `validateTask()` fires in the constructor — fails before any worker is spawned
- All `postMessage` calls from the worker include `taskId` copied from `e.data.taskId`
- `async onmessage` in the worker bridge handles both sync and async task functions transparently

That's the complete locked blueprint. No ambiguities remain.
