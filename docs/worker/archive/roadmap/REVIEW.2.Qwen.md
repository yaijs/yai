Here is the final, unified, and locked Implementation Plan for `YaiWorker`. All frictions from previous reviews have been resolved. This blueprint is absolute, unambiguous, and ready for immediate execution by a coding agent.

---

### 📁 1. Exact File Structure
*Strict adherence to module types is required to prevent runtime errors.*

```text
/src/
├── yai-worker.js                  ← ES Module (Public API, `export default class`)
└── internal/
    ├── TaskRegistry.js            ← ES Module (WeakRef mapping)
    ├── CSPDetector.js             ← ES Module (Environment sniffing)
    ├── SerializationGuard.js      ← ES Module (Regex validation)
    └── worker-bridge-src.js       ← ES Module (Exports the worker code as a string constant)

/assets/
└── yai-worker-bridge.js           ← Classic Script (Byte-identical to the string in worker-bridge-src.js)
```
**Hard Rules:**
1. `worker-bridge-src.js` and `assets/yai-worker-bridge.js` must contain **zero** ES Module syntax (`import`/`export`). They are Classic Scripts.
2. The public API is strictly exposed via `/src/yai-worker.js`.

---

### 📐 2. Exact Public API Signature

```javascript
/**
 * @typedef {Object} YaiWorkerOptions
 * @property {'transient'|'persistent'} [mode='transient'] - Lifecycle mode.
 * @property {HTMLElement} [targetElement] - Initiating DOM element for YEH event dispatch.
 * @property {string[]} [importScripts=[]] - CDN URLs for classic worker importScripts().
 * @property {ArrayBuffer[]} [transferables=[]] - Zero-copy transfer list for start().
 * @property {SharedArrayBuffer} [sharedBuffer] - Optional bidirectional progress buffer.
 * @property {(progress: any) => void} [onProgress] - Callback for 'progress' envelopes.
 * @property {AbortSignal} [abortSignal] - External cancellation signal.
 * @property {boolean} [allowThis=false] - Suppress 'this' reference validation warning.
 */

export default class YaiWorker {
  /**
   * @param {Function|string} task - Self-contained function or code string.
   * @param {YaiWorkerOptions} [options={}]
   */
  constructor(task, options = {}) {}

  /**
   * Static one-shot convenience. Constructs, starts, and auto-terminates.
   * @param {Function|string} task
   * @param {any} [inputData=null]
   * @param {Omit<YaiWorkerOptions, 'mode'>} [options={}]
   * @returns {Promise<any>}
   */
  static async run(task, inputData = null, options = {}) {}

  /**
   * Start execution. Returns a Promise. Also dispatches YEH CustomEvents if targetElement is set.
   * @param {any} [inputData=null]
   * @returns {Promise<any>}
   * @throws {DOMException} 'AbortError' if already terminated.
   * @throws {Error} if already running.
   */
  async start(inputData = null) {}

  /**
   * Forcefully terminate. Kills worker, revokes blob URL, rejects pending promise, cleans registry.
   * Idempotent (safe to call multiple times).
   */
  terminate() {}
}
```

---

### 📦 3. Exact Structural Shape of Internal Message Envelopes

**Main Thread → Worker (`YaiWorkerCommand`)**
```javascript
/**
 * @typedef {Object} YaiWorkerCommand
 * @property {'init'|'run'|'terminate'} type
 * @property {string} [taskId]        - Required for 'run'
 * @property {string} [code]          - Serialized function string; ONLY in CSP fallback 'init'
 * @property {string[]} [importScripts] - CDN URLs; ONLY in 'init'
 * @property {any} [inputData]       - Task input; ONLY in 'run'
 * @property {SharedArrayBuffer} [sharedBuffer] - Optional; ONLY in 'run'
 */
```

**Worker → Main Thread (`YaiWorkerEnvelope`)**
```javascript
/**
 * @typedef {Object} YaiWorkerEnvelope
 * @property {string} taskId          - Always present. Main thread drops message if missing/mismatched.
 * @property {'success'|'error'|'progress'} status
 * @property {any} payload            - Result value | error message string | progress value (0–1 number)
 */
```
**Invariant:** The worker must *always* copy `taskId` from `e.data.taskId` into its response envelope.

---

### ⚙️ 4. Precise Logic: Main Thread Coordinator (`yai-worker.js`)

```javascript
import { TaskRegistry } from './internal/TaskRegistry.js';
import { isCSPRestricted } from './internal/CSPDetector.js';
import { validateTask } from './internal/SerializationGuard.js';
import { WORKER_BRIDGE_SOURCE } from './internal/worker-bridge-src.js';

let _taskCounter = 0;
const generateTaskId = () => `YAI-${Date.now()}-${++_taskCounter}`;

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

    // 1. Validate BEFORE spawning anything
    validateTask(task, { allowThis: this.#options.allowThis ?? false });

    // 2. Setup worker (handles CSP fallback logic internally)
    this.#setupWorker();
  }

  static async run(task, inputData = null, options = {}) {
    const w = new YaiWorker(task, { ...options, mode: 'transient' });
    try {
      return await w.start(inputData);
    } finally {
      if (!w.#isTerminated) w.terminate();
    }
  }

  async start(inputData = null) {
    if (this.#isTerminated) throw new DOMException('Worker already terminated', 'AbortError');
    if (this.#pendingPromise) throw new Error('[YaiWorker] Worker is already running.');

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
      }, { once: true });
    }

    // 5. Launch worker
    this.#worker.postMessage(
      {
        type: 'run',
        taskId: this.#taskId,
        inputData,
        sharedBuffer: this.#options.sharedBuffer ?? null
      },
      this.#options.transferables // Second arg: transfer list
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
        WORKER_BRIDGE_SOURCE // Inlined classic script body
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

    // STEP 1: Progress (non-terminal, no promise action)
    if (env.status === 'progress') {
      if (typeof this.#options.onProgress === 'function') {
        try { this.#options.onProgress(env.payload); } catch (_) {}
      }
      return;
    }

    // STEP 2: YEH dispatch (crash-isolated, BEFORE promise settlement)
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
        // Optional global YEH hub dispatch
        if (typeof window.YEH !== 'undefined' && typeof window.YEH.dispatch === 'function') {
          window.YEH.dispatch(`worker:${env.status}`, {
            taskId: env.taskId,
            payload: env.payload,
            originElement: TaskRegistry.lookup(this.#taskId)?.deref() ?? null
          });
        }
      } catch (dispatchErr) {
        console.error('[YaiWorker] YEH dispatch error (promise unaffected):', dispatchErr);
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
            detail: { taskId: this.#taskId, error: err.message }
          }));
        }
      } catch (_) {}
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
```

---

### ⚙️ 5. Precise Logic: Inner Worker (`worker-bridge-src.js` / `assets/yai-worker-bridge.js`)

*This exact code must be exported as a string constant in `worker-bridge-src.js`, and saved as a raw file in `/assets/yai-worker-bridge.js`.*

```javascript
// Classic Script — NO import, NO export, NO top-level await
(function () {
  'use strict';

  // In asset fallback mode, _task starts undefined and is built from 'init' message.
  // In blob mode, _task is injected by the template before this script runs.
  var _taskFn = typeof _task !== 'undefined' ? _task : null;

  // MUST be async to transparently handle both sync and async user task functions
  self.onmessage = async function (e) {
    var msg = e.data;

    // ── INIT (CSP fallback path only) ──────────────────────────────────
    if (msg.type === 'init') {
      if (msg.importScripts && msg.importScripts.length) {
        importScripts.apply(self, msg.importScripts);
      }
      try {
        // Reconstruct the function from the serialized string safely
        _taskFn = (new Function('return (' + msg.code + ')'))();
      } catch (err) {
        _taskFn = null; // The 'run' message will catch this and report back
      }
      return; // Wait for 'run'
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
        // Await handles both sync and async task functions transparently
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

### 🧩 6. Internal Utility Specifications

**`TaskRegistry.js`**
```javascript
const _map = new Map(); // taskId (string) → WeakRef<HTMLElement>

export const TaskRegistry = {
  register(taskId, weakRef) {
    _map.set(taskId, weakRef);
  },
  lookup(taskId) {
    return _map.get(taskId) ?? null;
  },
  unregister(taskId) {
    _map.delete(taskId);
  }
};
```

**`CSPDetector.js`**
```javascript
export function isCSPRestricted() {
  // Check 1: Chrome Extension context (MV3 always restricts blob:)
  if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
    return true;
  }
  // Check 2: <meta http-equiv="Content-Security-Policy"> present and excludes blob:
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (meta) {
    const content = meta.content;
    if (/script-src/.test(content) && !/blob:/.test(content)) {
      return true;
    }
  }
  return false;
}
```

**`SerializationGuard.js`**
```javascript
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

### ✅ Final Pre-Coding Checklist for the Agent
- [ ] `worker-bridge-src.js` string and `/assets/yai-worker-bridge.js` file are **byte-identical** and contain zero ES module syntax.
- [ ] `#resolveCallback` / `#rejectCallback` are assigned **before** `postMessage` is called in `start()`.
- [ ] `#handleWorkerMessage` returns early on `'progress'` without touching the promise or cleanup.
- [ ] YEH dispatch runs **before** promise settlement, wrapped in a `try/catch` that logs but does not block resolution.
- [ ] `#cleanup()` terminates the worker and revokes the URL **only** in `'transient'` mode.
- [ ] `terminate()` is idempotent and rejects the pending promise with `new DOMException('Operation aborted', 'AbortError')`.
- [ ] `validateTask()` fires in the `constructor` and fails fast before any worker is spawned.
- [ ] All `postMessage` calls from the worker include `taskId` copied directly from `e.data.taskId`.
- [ ] The worker `onmessage` handler is declared `async` to transparently support both sync and async user task functions.

**This blueprint is locked. No further debate is required. Proceed to code generation.**
