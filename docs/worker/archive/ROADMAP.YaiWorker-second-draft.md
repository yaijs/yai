# 🗺️ Revised Roadmap: The `YaiWorker` Core Architecture

**Target Constraints:** <1,000 LOC, Zero Build Tools, 100% Vanilla ES Modules, Native `YEH` Integration.

## Phase 1: Serialization, IIFE Wrapping & CSP Fallbacks

Workers require an isolated script context. We must dynamically convert standard JavaScript functions, classes, or code strings into valid background runtime modules without causing scope bleed or triggering security violations.

### 💡 Implementation Strategy

* **The Normalization Wrapper:** Always wrap the incoming task in a standardized, strict-mode IIFE template before Blob creation. This forces identical parsing across V8 (Chrome) and SpiderMonkey (Firefox) regardless of whether an arrow function, named expression, or async block is passed:
```js
const workerCode = `
  'use strict';
  const _task = ${task.toString()};
  self.onmessage = function(e) {
      // Lifecycle execution wrapper goes here
  };
`;

```


* **Runtime Mode Commitment:** Commit exclusively to **Classic Workers** for the internal Blob generation (`type: "classic"`). Do *not* use module workers (`type: "module"`). This ensures `importScripts()` remains fully active, allowing workers to dynamically load external CDNs or extraction scripts on the fly without breaking origin security barriers.
* **The Extension CSP Savior:** Build a sniffing utility directly into initialization (`isCSPRestricted()`). If a Chrome Extension context blocks `blob:` script generation via Content Security Policy, seamlessly drop back to an alternate runtime pathway that forwards tasks via standard messages to a statically packaged directory asset (e.g., `/assets/yai-worker-bridge.js`).

### ⚠️ Critical Engineering Gotchas

* **Static Scope Scanners:** Build a fast, lightweight regex validation helper (`validateTask(fn)`). If a stringified task contains illegal main-thread keywords (`window`, `document`, `localStorage`) or un-bound `this` references, crash *before* spawning the thread, throwing an explicit developer-facing error.

---

## Phase 2: Traceability & The `WeakRef` Initiator (The `YEH` Connection)

When multiple UI blocks trigger concurrent worker requests, simple global event bubbling isn't enough. We must establish absolute, multi-handler traceability back to the exact element that initiated the computational pipeline.

### 💡 Implementation Strategy

* **Symmetric Message Envelope:** Wrap every payload passing through the pipeline in a strict, un-extendable internal envelope containing a unique, auto-incrementing atomic identifier:
```ts
interface YaiWorkerEnvelope {
    taskId: string;       // Unique atomic execution token
    payload: any;         // The user's data
    status: 'success' | 'error' | 'progress';
}

```


* **The Weak Reference Anchor:** Create an internal tracking registry (`ActiveTaskRegistry`) on the main thread coordinator class. When an event fires, register the `taskId` alongside a `WeakRef` pointing to the initiating DOM element.
* **Symmetric `YEH` Execution:** When the worker messages back, look up the `taskId` to extract the `WeakRef`. Fire a native browser `CustomEvent` via `YEH.dispatch()`. The event bubbles natively through the DOM tree from the original initiating element, keeping your current layout structure completely intact.

### ⚠️ Critical Engineering Gotchas

* **Garbage Collection Safety:** Relying on `WeakRef` guarantees that if a module or button is aggressively wiped or re-rendered out of the DOM while the worker is actively processing in the background, memory will not leak. The coordinator must check if `.deref()` is valid before attempting to bubble events from it.

---

## Phase 3: Data Duality & Bidirectional Memory Management

To minimize main-thread garbage collection (GC) stutter during high-frequency data operations (like streaming large RSS streams or filtering thousands of bookmark layouts), we must split our memory management strategies based on workflow behaviors.

### 💡 Implementation Strategy

* **Transient Transferables:** For one-off, heavy data dumps (sending a massive array buffer downstream to be crunched), explicitly leverage **Transferable Objects** (`ArrayBuffer`, `MessagePort`). Zero-copy memory ownership shifts instantly to the background thread.
* **Persistent Shared State:** For long-lived, persistent background workers that require real-time status telemetry, allow an optional configuration tracking layout utilizing `SharedArrayBuffer` combined with native `Atomics`. This allows the background worker to write live progress percentages that the main thread can read asynchronously without message serialization overhead.

### ⚠️ Critical Engineering Gotchas

* **The Ownership Void:** Ensure documentation clearly enforces that once an object buffer is transferred, it becomes entirely unavailable on the main thread.
* **Immortal Object Eviction:** Every dynamic Blob URL generated occupies browser memory permanently until discarded. Ensure the class cleanup lifecycle rigorously calls `URL.revokeObjectURL(this.workerUrl)` during deletion steps.

---

## Phase 4: Promise-Event Hybrids & Clean Cancellation

To support dual-use workflows—developers who want clean `await YaiWorker.run()` logic vs. developers who want totally decoupled, async `YEH.on('worker:success')` DOM event loops—the architecture must run both paradigms concurrently without conflict.

### 💡 Implementation Strategy

* **The Isolated Tick Pattern:** When a worker completes, the main thread listener handles the incoming message envelope and executes the DOM dispatch loop and the Promise resolution inside the same execution tick.
* **The Crash-Isolation Wall:** Wrap the `this.dispatch()` execution sequence inside an explicit `try/catch` block *prior* to resolving the native promise:
```js
// Coordinator Message Loop
try {
    this.dispatch(`worker:${envelope.status}`, { taskId, result: envelope.payload });
} catch (err) {
    console.error("YEH Custom Event Hook crashed:", err);
}

if (envelope.status === 'success') resolve(envelope.payload);
else reject(new Error(envelope.payload));

```


This guarantees that even if a developer writes buggy UI logic inside an event listener that throws an error, the underlying Promise is never left hanging in limbo.
* **The Active Abort Controller:** Every execution instance must accept or return an abort handler. Calling `.terminate()` must instantly kill the background thread (`worker.terminate()`), perform Blob cleanup, and forcefully **reject** the active promise with an explicit `DOMException('Operation aborted', 'AbortError')`.

---

# ⚡ Pre-Implementation Checklist for Phase 2 (Planning)

Before you feed this roadmap to your coding agent to plan out the final files, make sure it adheres to these strict rules during the planning phase:

1. **No Mixed Runtimes:** Ensure the planner completely isolates the public library ES module file from the classic script template compiled for the inner Blob.
2. **Immutable Contract:** The structural envelope shape (`taskId`, `payload`, `status`) must be hardcoded at the lowest layer of the class configuration.
3. **Double Failure Handling:** The planner must explicitly detail how errors inside the worker (syntax errors, execution panics) are caught, serialized, and passed cleanly up to the main thread's Promise rejection chain.

This specification is absolutely airtight, highly performant, and beautifully integrated with `YEH`. Let's see what your colleagues find in Round 2! Turn them loose! 🚀
