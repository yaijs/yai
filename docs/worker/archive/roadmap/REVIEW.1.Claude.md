I've read all three files. The reviews are thorough, but both DeepSeek and Grok overlap heavily on the same four points (serialization edge cases, traceability, error handling, CSP fallback). Let me focus only on what they missed or underspecified, and give you sharp, concrete answers to your three questions.

---

## What The Reviews Missed

Before your three questions — a few genuine gaps neither touched:

**`importScripts` is dead in ES module workers.** Your roadmap mentions it as a Phase 1 option. The moment you use `{ type: 'module' }` in `new Worker(url, { type: 'module' })` — which you likely want for ESM consistency — `importScripts` throws. You need to choose: classic blob workers (with `importScripts` available) or module workers (with static/dynamic `import`, but stricter CORS requirements on the blob origin). Pick one and commit in Phase 1. Classic blob workers are simpler and cover 99% of your use case.

**SharedArrayBuffer is missing from Phase 3.** For true zero-copy *bidirectional* communication (e.g. a live-updating progress buffer), `SharedArrayBuffer` + `Atomics` is the right tool — not `Transferable`. Transferables are one-way ownership transfers. If a persistent worker (Phase 4) needs to write progress that the main thread polls without message overhead, `SharedArrayBuffer` is the right primitive. Needs `COOP`/`COEP` headers, worth at least a note.

**`structuredClone()` doesn't clone functions.** Phase 3 relies on the structured cloning API, but it cannot clone `Function`, `Error`, `DOM nodes`, `WeakMap/WeakSet`, or `Symbol`-keyed properties. If anyone passes an object with method properties as worker data, it silently drops the methods. Your validation helper (which both reviews recommend) should also scan *data* payloads, not just the task function.

---

## Your Three Questions

### 1. Function Serialization Edge Cases

Both reviews covered the obvious ones (closures, `this`, forbidden globals). Here's what they didn't:

**Named vs. anonymous function expressions stringify differently:**
```javascript
// These stringify identically in behavior but differ in name metadata
const fn = function myTask() {}   // → "function myTask() {}"
const fn = () => {}               // → "() => {}"
const fn = async () => {}         // → "async () => {}"
```
Arrow functions are safe to serialize *if* they don't use `this` — but you should normalize them into a consistent wrapper at serialization time rather than trusting the raw `.toString()` output, which is engine-dependent (V8 vs SpiderMonkey handle whitespace and comments differently).

**The `class` case is real:** If someone passes a class method reference — `YaiWorker.run(myObj.heavyMethod)` — it detaches from its prototype. `this` is `undefined` in strict mode, or the global in sloppy mode. Neither is what they want. Your validator should detect method-looking functions (presence of `this` in the body) and warn explicitly.

**Default parameters with object references fail:**
```javascript
// Serializes fine, explodes at runtime in the worker
function task(config = DEFAULT_CONFIG) { ... }
// DEFAULT_CONFIG is a closure reference — gone in the worker
```
Your validator regex should flag identifiers in default parameter positions that aren't literals.

**Recommended validator structure** (tighter than what DeepSeek sketched):
```javascript
static validateTask(fn) {
    const src = fn.toString();
    const forbidden = [
        [/\bwindow\b/, 'window'],
        [/\bdocument\b/, 'document'],
        [/\blocalStorage\b/, 'localStorage'],
        [/\bthis\b/, 'this (detached method?)'],
    ];
    const warnings = forbidden
        .filter(([rx]) => rx.test(src))
        .map(([, name]) => `Forbidden reference: ${name}`);
    if (warnings.length) throw new YaiWorkerValidationError(warnings, src);
}
```

---

### 2. Payload Format for YEH Traceability

Both reviews suggested `workerId` + `elementSelector`. That's correct but incomplete — here's the minimal structure that actually covers all your routing needs without over-engineering:

```javascript
// Canonical YaiWorker event detail shape
{
    // Identity
    workerId: Symbol | string,      // unique per YaiWorker instance
    taskId: string,                 // unique per invocation (crypto.randomUUID())

    // Initiator — let the caller decide which they need
    initiator: {
        element: WeakRef | null,    // WeakRef to avoid memory pinning
        id: string | null,          // element.id at dispatch time
        yaiId: string | null,       // element.dataset.yaiId (your existing convention)
        selector: string | null,    // e.g. '[data-yai-worker="rss-parser"]'
    },

    // Payload
    result: any | null,
    error: { message, workerStack, taskPreview } | null,
    progress: number | null,        // 0–1, for streaming workers

    // Timing
    timestamp: performance.now(),
    duration: number,               // ms from postMessage to onmessage
}
```

Key decision here: use `WeakRef` for the element reference. Both reviews stored a hard `elementRef` — that pins the DOM node in memory for the lifetime of the worker. `WeakRef` lets it be GC'd if the element is removed, and you can check `initiator.element.deref()` safely. This matters for persistent workers (Phase 4).

For YEH handler routing, the pattern becomes:
```javascript
YEH.on('worker:success', (e) => {
    const el = e.detail.initiator.element?.deref();
    if (!el) return; // element was removed, skip
    // update UI
});
```

---

### 3. Promise AND YEH Events Simultaneously

Both reviews said "don't do both." I disagree with the absolutism — there's a clean pattern that avoids the double-message-traffic problem they warned about.

The trick is: **the Promise resolves from the same `onmessage` handler that dispatches the CustomEvent.** No double messaging. One worker message triggers both, synchronously, on the main thread:

```javascript
class YaiWorker {
    run(taskFn, { data, transfer, target, mode = 'both' } = {}) {
        return new Promise((resolve, reject) => {
            // ... spawn worker ...

            this.worker.onmessage = (e) => {
                const detail = this._buildDetail(e, target);

                // Always dispatch the event (YEH consumers)
                if (mode !== 'promise') {
                    const event = new CustomEvent('worker:success', {
                        bubbles: true,
                        detail
                    });
                    (target ?? document).dispatchEvent(event);
                }

                // Always resolve the Promise (await consumers)
                if (mode !== 'event') {
                    resolve(detail.result);
                }
            };

            this.worker.onerror = (err) => {
                const detail = this._buildErrorDetail(err);
                if (mode !== 'promise') {
                    (target ?? document).dispatchEvent(
                        new CustomEvent('worker:error', { bubbles: true, detail })
                    );
                }
                if (mode !== 'event') reject(detail.error);
            };
        });
    }
}
```

This gives you three modes — `'both'` (default), `'promise'`, `'event'` — with zero extra messages. The `mode` parameter is the only API surface you need. Callers that `await YaiWorker.run(...)` and callers that listen with `YEH.on('worker:success', ...)` can coexist without stepping on each other, because the CustomEvent dispatch and `resolve()` happen in the same tick.

The one real risk: if a YEH handler synchronously throws during the CustomEvent dispatch, it'll propagate before `resolve()` is called. Wrap the dispatch in a `try/catch` that doesn't swallow the error but also doesn't block resolution.

---

## Phase-Level Recommendations (Net New)

- **Phase 1:** Decide classic vs. module workers *now*. Commit to classic for simplicity — you get `importScripts`, broader compat, and simpler blob MIME handling.
- **Phase 2:** `WeakRef` for initiator element. The `taskId` field (UUID per invocation) is what lets you debounce/cancel in Phase 4 — design it in here.
- **Phase 3:** Add a one-paragraph note on `SharedArrayBuffer` for persistent worker progress streams. Even if you don't implement it v1, the architecture shouldn't preclude it.
- **Phase 4:** Your "state locking" concept (`isWorking = true`) needs a cancellation story. What happens to in-flight promises if the user navigates away or the element is removed? A `worker.terminate()` call that also rejects the pending Promise (and dispatches `worker:cancelled`) is cleaner than letting it silently hang.

The roadmap is solid. The four additions above — module vs. classic decision, `WeakRef` initiators, `taskId` for cancellation, and the `mode` API for dual Promise+Event — close the real gaps the other reviews left open.
