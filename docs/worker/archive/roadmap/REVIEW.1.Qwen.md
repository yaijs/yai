Based on a synthesis of your roadmap and the three reviews, the foundation is incredibly strong. DeepSeek and Grok correctly identified the major pitfalls, but **Claude’s review provides the critical missing pieces** that elevate this from a "good demo" to a "production-ready utility."

Here are the direct, technical answers to your three questions, incorporating the net-new insights to prevent overlapping advice.

---

### 1. Function Serialization Edge Cases
Beyond the obvious closure and `this` scope loss, you must handle how JavaScript engines stringify functions and the worker environment constraints.

*   **Class Methods & Detached `this`**: If a user passes `YaiWorker.run(myObj.heavyMethod)`, the method detaches from its prototype. In strict mode, `this` becomes `undefined`. Your validator must flag functions containing `\bthis\b` unless explicitly bound.
*   **Default Parameters with Outer References**: `function task(config = DEFAULT_CONFIG) {}` stringifies perfectly but throws a `ReferenceError` in the worker because `DEFAULT_CONFIG` is a closure. Your validator should flag non-literal identifiers in default parameter positions.
*   **Engine-Dependent Stringification**: Arrow functions, named expressions, and async functions stringify differently across V8 and SpiderMonkey. **Solution**: Always wrap the serialized output in a standardized, strict-mode IIFE before Blob creation to normalize execution context:
    ```javascript
    const workerCode = `
      'use strict';
      self.onmessage = function(e) {
        try {
          const task = (${fn.toString()});
          const result = task(e.data.payload);
          self.postMessage({ taskId: e.data.taskId, result });
        } catch (err) {
          self.postMessage({ taskId: e.data.taskId, error: { message: err.message, stack: err.stack } });
        }
      };
    `;
    ```
*   **Classic vs. Module Workers**: As Claude noted, `importScripts` is dead in `{ type: 'module' }` workers. Since you want ultra-lightweight Blob execution, **commit to Classic Workers** for Phase 1. It guarantees broader compatibility, simpler MIME handling, and allows `importScripts` if users absolutely need to pull in a tiny utility script.

### 2. Payload Format for YEH Traceability
DeepSeek and Grok suggested `workerId` + `elementSelector`, but they missed a critical memory leak vector: holding a hard reference to a DOM node pins it in memory, defeating the purpose of off-main-thread garbage collection, especially for persistent workers.

**The Canonical YaiWorker Event Detail Shape:**
Use this exact structure. It provides maximum routing flexibility for YEH while remaining memory-safe.

```javascript
{
  // Identity
  workerId: string,          // Unique per YaiWorker instance (e.g., crypto.randomUUID())
  taskId: string,            // Unique per invocation (crucial for Phase 4 cancellation/debouncing)

  // Initiator (Memory-safe routing)
  initiator: {
    element: WeakRef,        // Prevents memory pinning. Check with .deref() in YEH handler.
    id: string | null,       // element.id at dispatch time
    yaiId: string | null,    // element.dataset.yaiId (your existing convention)
    selector: string | null  // Fallback selector, e.g., '[data-yai-worker="rss-parser"]'
  },

  // Payload
  result: any | null,
  error: { message: string, workerStack: string, taskPreview: string } | null,
  progress: number | null,   // 0–1, for streaming/persistent workers

  // Timing
  timestamp: number,         // performance.now()
  duration: number           // ms from postMessage to onmessage
}
```
**YEH Handler Usage:**
```javascript
YEH.on('worker:success', (e) => {
  const el = e.detail.initiator.element?.deref();
  if (!el) return; // Element was removed from DOM, safely skip
  el.textContent = `Done: ${e.detail.result}`;
});
```

### 3. Promise AND YEH Events Simultaneously
DeepSeek and Grok advised against doing both, fearing "double message traffic" and over-engineering. **Claude is correct to disagree.** You can achieve both with *zero* extra message traffic by resolving the Promise and dispatching the CustomEvent from the **exact same `onmessage` tick** on the main thread.

Here is the cleanest, most robust implementation pattern:

```javascript
class YaiWorker {
  run(taskFn, { data, transfer, target, mode = 'both' } = {}) {
    return new Promise((resolve, reject) => {
      const taskId = crypto.randomUUID();
      const worker = this._spawnWorker(taskFn);

      worker.onmessage = (e) => {
        const detail = this._buildDetail(e.data, target, taskId);

        // 1. Always dispatch the event (for YEH consumers)
        if (mode !== 'promise') {
          try {
            const event = new CustomEvent('worker:success', { bubbles: true, detail });
            (target ?? document).dispatchEvent(event);
          } catch (yehError) {
            console.warn('YEH handler threw, but Promise will still resolve:', yehError);
          }
        }

        // 2. Always resolve the Promise (for await consumers)
        if (mode !== 'event') {
          if (detail.error) reject(detail.error);
          else resolve(detail.result);
        }

        // 3. Auto-terminate if transient
        if (this.options.transient) worker.terminate();
      };

      worker.onerror = (err) => {
        const detail = this._buildErrorDetail(err, target, taskId);
        if (mode !== 'promise') {
          (target ?? document).dispatchEvent(new CustomEvent('worker:error', { bubbles: true, detail }));
        }
        if (mode !== 'event') reject(detail.error);
      };

      worker.postMessage({ taskId, payload: data }, transfer || []);
    });
  }
}
```
**Why this works perfectly:**
1. **No double traffic**: The worker sends *one* message. The main thread processes it once, triggering both APIs synchronously.
2. **The `try/catch` is critical**: If a YEH listener throws an error synchronously, it will bubble up and prevent the Promise from resolving. The `try/catch` isolates the YEH event loop from the Promise resolution.
3. **Flexible API Surface**: Callers can `await YaiWorker.run(...)` for pure logic, or rely entirely on `YEH.on('worker:success', ...)` for DOM updates, or use `'both'` (default) to keep all systems in sync.

---

### Final Pre-Coding Checklist (The "Gotchas" to lock in now)
Before handing this to a coding agent, ensure these three architectural decisions are hardcoded into the spec:
1. **CSP Fallback**: Implement the `isCSPRestricted()` check. If `blob:` is blocked, fall back to a static `/assets/yai-worker-bridge.js` that accepts `{ type: 'init', task: string }` via `postMessage`.
2. **Validation Helper**: Build `YaiWorker.validateTask(fn)` using regex to catch `window`, `document`, `localStorage`, and unsafe `this` usage *before* the worker spawns, throwing a descriptive `YaiWorkerValidationError`.
3. **SharedArrayBuffer Note**: In Phase 3 documentation, explicitly note that while `Transferable` objects are great for one-way massive data dumps, `SharedArrayBuffer` + `Atomics` is the correct primitive for *bidirectional, zero-copy progress streaming* in persistent workers (requires COOP/COEP headers).

This refined roadmap is now airtight, addresses all blind spots, and perfectly fits your <1,000 LOC, zero-dependency constraint. Ready for the coding agent.
