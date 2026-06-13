# 🤖 Phase 2: Ultimate Implementation Blueprint

## 📁 1. Exact File Structure

To enforce your constraint of **zero build steps** while strictly respecting the browser's module rules, the architecture splits clean ES Modules from raw classic script strings.

```text
/src/
├── yai-worker.js                  ← ES Module (Public API, `export default class`)
└── internal/
    ├── TaskRegistry.js            ← ES Module (WeakRef tracking & taskId generator)
    ├── CSPDetector.js             ← ES Module (isCSPRestricted sniffer)
    ├── SerializationGuard.js      ← ES Module (regex validation helper)
    └── worker-bridge-src.js       ← ES Module (Exports the worker runtime as a string constant)

/assets/
└── yai-worker-bridge.js           ← Classic Script (Byte-identical to the string in worker-bridge-src.js)

```

* **Crucial Rule:** Both `internal/worker-bridge-src.js` (the string template) and `/assets/yai-worker-bridge.js` must contain **zero** ES module keywords (`import`/`export`). They are classic scripts executed directly inside the worker's thread global scope (`self`).

---

## 📐 2. Public API Signature

```javascript
/**
 * @typedef {Object} YaiWorkerOptions
 * @property {'transient'|'persistent'} [mode='transient'] - Lifecycle execution mode.
 * @property {HTMLElement} [targetElement] - The initiating DOM element for YEH event bubbling.
 * @property {string[]} [importScripts=[]] - External CDN script URLs to import (Classic worker only).
 * @property {boolean} [allowThis=false] - Force bypass the validation check for 'this' contexts.
 */

export default class YaiWorker {
  /**
   * @param {Function|string} task - The self-contained execution logic.
   * @param {YaiWorkerOptions} [options={}]
   */
  constructor(task, options = {}) {}

  /**
   * Triggers the worker execution.
   * @param {any} inputData - Data sent down to the background thread.
   * @param {Transferable[]} [transferables=[]] - Optional zero-copy memory arrays.
   * @returns {Promise<any>} Resolves with result, rejects with Error or AbortError.
   */
  start(inputData, transferables = []) {}

  /**
   * Idempotently terminates the thread, revokes allocations, and cancels pending promises.
   */
  terminate() {}
}

```

---

## 📐 3. The Immutable Envelope Shape

Every single transaction moving across the main thread $\leftrightarrow$ Worker boundary must map to this exact JSON structure:

```typescript
interface YaiWorkerEnvelope {
    taskId: string;                             // Auto-incremented execution ID
    status: 'success' | 'error' | 'progress';   // State of the execution tick
    payload: any;                               // Math result, error message, or telemetry progress
}

```

---

## 🧠 4. Precise Logic & Crucial Edge Case Fixes

Claude, Qwen, and DeepSeek uncovered a few brilliant, subtle traps in their round 2 specs that you need to lock in:

### A. The Race-Condition Fix

Both DeepSeek and Grok initially suggested mapping the Promise callbacks *after* sending the data via `postMessage`. Claude caught the bug: if a worker finishes an ultra-fast operation instantly, it can message back before the main thread finishes setting up the listeners, causing a silent hang.

* **The Blueprint Rule:** Always register the callbacks and store your execution tracking *before* calling `worker.postMessage()`.

### B. The Isolated Event Tick

If a developer binds a buggy UI listener to your `YEH` event hub, and that listener throws a synchronous syntax error during the worker's completion event, it could crash the main script loop and leave the native `start()` Promise hanging forever.

* **The Blueprint Rule:** Wrap the `YEH` custom event dispatch loop inside an internal `try/catch` block. If the DOM event pipeline blows up, log the error but let the script proceed straight down to successfully resolve the Promise.

### C. Persistent Fallbacks

Initially, some specs only allowed the Chrome Extension CSP fallback to run in `transient` mode. Claude and Qwen correctly locked down that **persistent mode must use the fallback too**. In CSP-restricted environments, the asset-based fallback thread will simply stay alive and accept repeated message triggers using an execution flag.

---

## 📝 5. Step-by-Step Execution Flow

### The Main Thread (`start()`) Pipeline

1. Generate an atomic `taskId`.
2. Check `options.targetElement`. If valid, register a `new WeakRef(element)` mapped to the `taskId` inside the `TaskRegistry`.
3. Construct the execution Promise. Save the `resolve` and `reject` handles internally mapped to the `taskId`.
4. Fire `worker.postMessage({ type: 'run', taskId, inputData }, transferables)`.

### The Worker Thread Loop (`worker-bridge.js`)

1. Listen for `onmessage`.
2. If `e.data.type === 'init'`, save the stringified task string to an internal executable handle (`_task = new Function(...)`).
3. If `e.data.type === 'run'`, extract the `taskId` and data.
4. Run an internal `async/await` try block: `const result = await _task(e.data.inputData)`.
5. If successful, fire `self.postMessage({ taskId, status: 'success', payload: result })`.
6. If an execution panic occurs, capture it and fire `self.postMessage({ taskId, status: 'error', payload: err.message })`.

### The Main Thread Reception Loop

1. Extract `taskId`, `status`, and `payload` from the incoming worker message.
2. Locate the corresponding `WeakRef` element from the registry. If `.deref()` is still alive, safely run `YEH.dispatch('worker:' + status, ...)` wrapped tightly inside a `try/catch`.
3. Retrieve the matching Promise hooks. Resolve or Reject the `start()` promise based on the status code.
4. If the mode is `'transient'`, automatically fire the local cleanup hook (`terminate()`).

---

## 🚀 The Plan is Fully Locked

This is an incredibly clean architecture specification. Your "review board" did a spectacular job cleaning up the subtle timing issues and securing the scope validations.

Since your routine is to turn this roadmap into a hard implementation checklist for your coding agent, this layout gives it zero room to hallucinate or wander off course. You are ready to open up the editor and watch it build this out in seconds!

Whenever you're ready, let's write it down!
