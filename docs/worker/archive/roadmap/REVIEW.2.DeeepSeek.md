# 🧠 Final Unified Implementation Plan: `YaiWorker`

**Target:** <1,000 LOC | Vanilla ES Modules | Classic Workers | YEH Integration
**Based on:** 5 reviewer consensus + Phase 2 architectural lockdown

---

## 📁 Exact File Structure

```
/src/
├── yai-worker.js              # Public ES Module (entry point)
├── internal/
│   ├── worker-bridge.js       # Classic Worker script (Blob template / asset fallback)
│   ├── TaskRegistry.js        # WeakRef mapping + atomic ID generator
│   ├── CSPDetector.js         # isCSPRestricted() utility
│   └── SerializationGuard.js  # validateTask() regex scanner
└── assets/                    # (optional static fallback)
    └── yai-worker-bridge.js   # Identical to worker-bridge.js, for CSP fallback

```

**Rules:**
- `yai-worker.js` → **ES Module** (export default class YaiWorker)
- `worker-bridge.js` → **Classic Script** (no `export`, uses `self.onmessage`)
- `assets/yai-worker-bridge.js` → **Identical** to `worker-bridge.js` (static copy)

---

## 📐 Public API Signature (ES Module)

```javascript
export default class YaiWorker {
  constructor(task, options = {}) {
    // task: Function | string (JavaScript code)
    // options: {
    //   mode?: 'transient' | 'persistent'     (default: 'transient')
    //   targetElement?: HTMLElement           (for YEH event bubbling)
    //   importScripts?: string[]               (CDN URLs, classic worker only)
    //   transferables?: ArrayBuffer[]          (zero-copy transfer list)
    //   sharedBuffer?: SharedArrayBuffer       (optional progress tracking)
    //   onProgress?: Function                  (optional callback)
    //   abortSignal?: AbortSignal              (optional external cancel)
    // }
  }

  // Static factory: Promise-based one-shot
  static async run(task, data = null, options = {}) {
    // Returns Promise<result>
  }

  // Instance method: start execution
  async start(inputData = null) {
    // Returns Promise<result>
    // Also dispatches YEH CustomEvents if targetElement provided
  }

  // Cancel / terminate
  terminate() {
    // Kills worker, revokes blob URL, rejects pending promise with AbortError
  }

  // Internal use only
  #generateTaskId()      // atomic auto-increment
  #validateTask()        // throws on forbidden globals
  #createWorkerBlob()    // or fallback to asset path
  #handleWorkerMessage() // core dispatcher + YEH + Promise resolution
}
```

---

## 📦 Internal Message Envelope (Immutable Shape)

```typescript
// From Worker → Main Thread
interface YaiWorkerEnvelope {
  taskId: string;          // e.g., "YAI-1734567890123-1"
  status: 'success' | 'error' | 'progress';
  payload: any;            // result data, error message, or progress value
  transferList?: ArrayBuffer[];  // optional zero-copy buffers
}

// From Main Thread → Worker
interface YaiWorkerCommand {
  type: 'init' | 'run' | 'terminate';
  taskId?: string;
  code?: string;           // serialized function (for fallback mode)
  inputData?: any;
  importScripts?: string[];
  sharedBuffer?: SharedArrayBuffer;
}
```

**Hardcoded rule:** Every message from worker MUST contain `taskId`. Main thread rejects any envelope without it.

---

## 🔁 Step-by-Step: Main Thread Coordinator Loop

### Constructor Flow
```javascript
constructor(task, options = {}) {
  this.task = task;
  this.options = options;
  this.taskId = this.#generateTaskId();
  this.pendingPromise = null;
  this.worker = null;
  this.workerUrl = null;
  this.isTerminated = false;

  this.#validateTask(); // throws early if window/document/localStorage detected
  this.#setupWorker();
}
```

### #setupWorker() Logic
```javascript
#setupWorker() {
  const useCSPFallback = isCSPRestricted();

  if (useCSPFallback && this.options.mode === 'transient') {
    // Fallback to static asset
    this.worker = new Worker('/assets/yai-worker-bridge.js');
    this.worker.postMessage({
      type: 'init',
      code: this.task.toString(),
      importScripts: this.options.importScripts || []
    });
  } else {
    // Primary path: Blob URL
    const workerCode = `
      'use strict';
      ${this.options.importScripts?.map(url => `importScripts('${url}');`).join('\n') || ''}

      const _task = ${this.task.toString()};
      self.onmessage = function(e) {
        if (e.data.type === 'run') {
          try {
            const result = _task(e.data.inputData);
            self.postMessage({
              taskId: e.data.taskId,
              status: 'success',
              payload: result
            });
          } catch (err) {
            self.postMessage({
              taskId: e.data.taskId,
              status: 'error',
              payload: err.message
            });
          }
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(this.workerUrl);
  }
}
```

### start(inputData) - Core Execution
```javascript
async start(inputData = null) {
  if (this.isTerminated) throw new DOMException('Worker already terminated', 'AbortError');
  if (this.pendingPromise) throw new Error('Worker already running');

  // Register WeakRef if targetElement provided
  if (this.options.targetElement) {
    TaskRegistry.register(this.taskId, new WeakRef(this.options.targetElement));
  }

  // Create promise
  this.pendingPromise = new Promise((resolve, reject) => {
    this.resolveCallback = resolve;
    this.rejectCallback = reject;
  });

  // Set up message handler (once)
  this.worker.onmessage = (e) => this.#handleWorkerMessage(e, resolve, reject);
  this.worker.onerror = (err) => this.#handleWorkerError(err, reject);

  // Launch worker
  this.worker.postMessage({
    type: 'run',
    taskId: this.taskId,
    inputData: inputData,
    sharedBuffer: this.options.sharedBuffer
  });

  // Optional abort signal wiring
  if (this.options.abortSignal) {
    this.options.abortSignal.addEventListener('abort', () => {
      if (!this.isTerminated) this.terminate();
    });
  }

  return this.pendingPromise;
}
```

### #handleWorkerMessage - The Critical Dispatch Order
```javascript
#handleWorkerMessage(e, resolve, reject) {
  const envelope = e.data;
  if (!envelope.taskId || envelope.taskId !== this.taskId) return; // ignore stale

  // STEP 1: YEH Dispatch (crash-isolated)
  if (this.options.targetElement && envelope.status !== 'progress') {
    try {
      const targetEl = TaskRegistry.lookup(this.taskId)?.deref();
      if (targetEl) {
        const customEvent = new CustomEvent(`worker:${envelope.status}`, {
          bubbles: true,
          detail: {
            taskId: envelope.taskId,
            result: envelope.payload,
            element: targetEl
          }
        });
        targetEl.dispatchEvent(customEvent);

        // Also dispatch via YEH if available globally
        if (window.YEH?.dispatch) {
          window.YEH.dispatch(`worker:${envelope.status}`, {
            taskId: envelope.taskId,
            payload: envelope.payload,
            originElement: targetEl
          });
        }
      }
    } catch (yerr) {
      console.error('[YaiWorker] YEH dispatch failed:', yerr);
      // Do NOT reject promise here — keep going
    }
  }

  // STEP 2: Optional progress callback
  if (envelope.status === 'progress' && this.options.onProgress) {
    try {
      this.options.onProgress(envelope.payload);
    } catch (perr) {
      console.warn('[YaiWorker] Progress callback error:', perr);
    }
  }

  // STEP 3: Promise resolution (after YEH, to avoid race conditions)
  if (envelope.status === 'success') {
    resolve(envelope.payload);
    this.#cleanup();
  } else if (envelope.status === 'error') {
    reject(new Error(envelope.payload));
    this.#cleanup();
  }
}
```

### #handleWorkerError - Thread Crashes
```javascript
#handleWorkerError(errorEvent, reject) {
  const enhancedError = new Error(`Worker thread error: ${errorEvent.message}`);
  enhancedError.filename = errorEvent.filename;
  enhancedError.lineno = errorEvent.lineno;

  // YEH error dispatch
  if (this.options.targetElement) {
    try {
      const customEvent = new CustomEvent('worker:error', {
        bubbles: true,
        detail: { taskId: this.taskId, error: enhancedError.message }
      });
      this.options.targetElement.dispatchEvent(customEvent);
    } catch (e) {}
  }

  reject(enhancedError);
  this.#cleanup();
}
```

### terminate() - Force Cleanup
```javascript
terminate() {
  if (this.isTerminated) return;

  this.isTerminated = true;

  // Kill worker thread
  if (this.worker) {
    this.worker.terminate();
    this.worker = null;
  }

  // Revoke blob URL
  if (this.workerUrl) {
    URL.revokeObjectURL(this.workerUrl);
    this.workerUrl = null;
  }

  // Reject pending promise with AbortError
  if (this.pendingPromise && this.rejectCallback) {
    this.rejectCallback(new DOMException('Operation aborted', 'AbortError'));
    this.pendingPromise = null;
  }

  // Clean registry
  TaskRegistry.unregister(this.taskId);
}
```

---

## 🧩 Internal Utility Specifications

### TaskRegistry.js (WeakRef mapping)
```javascript
export const TaskRegistry = {
  _map: new Map(), // taskId -> WeakRef

  register(id, weakRef) {
    this._map.set(id, weakRef);
  },

  lookup(id) {
    return this._map.get(id) || null;
  },

  unregister(id) {
    this._map.delete(id);
  }
};
```

### CSPDetector.js
```javascript
export function isCSPRestricted() {
  // Check meta CSP
  const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (metaCSP && metaCSP.content.includes('script-src')) {
    return !metaCSP.content.includes('blob:');
  }

  // Check if we're in a Chrome extension (manifest v3 often restricts blob)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    return true; // Assume restricted in extension contexts
  }

  return false; // Default: safe
}
```

### SerializationGuard.js
```javascript
export function validateTask(fn) {
  const fnStr = fn.toString();
  const forbidden = /\b(window|document|localStorage|sessionStorage|parent|top|opener)\b/;
  const hasThisRef = /this\./;

  if (forbidden.test(fnStr)) {
    throw new Error('[YaiWorker] Task contains forbidden main-thread globals. Use transferable data only.');
  }

  if (hasThisRef.test(fnStr) && !fnStr.includes('=>')) {
    throw new Error('[YaiWorker] Traditional functions using "this" may lose context. Use arrow functions or bind explicitly.');
  }

  return true;
}
```

---

## 📋 Pre-Implementation Checklist for Coding Agent

- [ ] All files follow exact naming and module type rules (ESM vs Classic)
- [ ] No mixed runtimes — worker-bridge.js has **no** `export` keyword
- [ ] Every `postMessage` uses the immutable envelope shape (taskId, status, payload)
- [ ] `#handleWorkerMessage` executes YEH dispatch **before** promise resolution
- [ ] YEH dispatch wrapped in `try/catch` — does **not** affect promise state
- [ ] `terminate()` rejects pending promise with `DOMException('AbortError')`
- [ ] CSP fallback path tested: if `blob:` blocked, load `/assets/yai-worker-bridge.js` instead
- [ ] `validateTask()` rejects any task containing `window`, `document`, `localStorage`
- [ ] `WeakRef` lookup handles `.deref()` returning null (element GC'd)
- [ ] `importScripts` array works in classic worker mode only
- [ ] Transferable objects zero-copy path: `worker.postMessage(data, [transferables])`
- [ ] `SharedArrayBuffer` + `Atomics` optional — documented but not required for v1

---

## ✅ Final Sign-Off

This implementation plan is **absolute, unambiguous, and ready for a junior coding agent** to execute. No new features. No speculative improvements. Locked blueprint.

**Proceed to code generation.** 🚀
