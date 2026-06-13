## Roadmap-first assessment

The roadmap direction is technically sound, but Phase 1 currently contains the biggest architectural ambiguity: it says “vanilla ES modules” and also proposes `importScripts` / ES module configuration in one bucket. Those are different worker runtime models. `new Worker(url, { type: "module" })` and classic workers behave differently; `importScripts()` is only for classic workers and throws in module workers. For v1, use **classic Blob workers internally**, while keeping the public YaiWorker library itself as an ES module. That preserves the no-build-tools goal and keeps `importScripts` available for optional dependencies.  ([MDN Web Docs][1])

Also: call it **Blob URL**, not “Blob Data URI”. `URL.createObjectURL(blob)` creates a `blob:` URL, not an inline `data:` URI. That distinction matters for CSP and origin behavior. MDN explicitly notes that `Worker()` can accept same-origin URLs, `blob:` URLs, or `data:` URLs, and that `data:` URLs have opaque origins. ([MDN Web Docs][2])

---

## 1. Function serialization edge cases

The roadmap correctly identifies scope loss from `task.toString()` as the central gotcha, but “document it” is not enough. The reviews already covered closures, `this`, async, generators, and forbidden globals, so the implementation recommendation is: **support only self-contained functions in v1, validate hazards early, and normalize all task execution through one wrapper.**

Key edge cases to explicitly handle:

### Reject or warn on non-callable serialization forms

`Function.prototype.toString()` returns the original source form, not a normalized function declaration. That means these all stringify differently: function declarations, arrows, async arrows, class declarations, method shorthand, getters/setters, generators, bound functions, and native functions. Bound/native functions stringify to native-code forms that cannot be re-evaluated as usable worker task code. ([MDN Web Docs][3])

Treat these as v1 rules:

```js
// allow
function task(data) { return data.x * 2; }
(data) => data.x * 2
async (data) => await fetchSomething(data)

// reject or require advanced mode
class Parser {}
obj.method
function* task() {}
someFn.bind(ctx)
Math.max
```

Classes are especially misleading. `class Parser {}` serializes, but your wrapper cannot call it like a normal task without `new`, and class methods lose prototype context when passed detached.

### Always call the task with explicit arguments

Do not let users rely on `this`, `arguments`, outer constants, or globals. The task contract should be:

```js
task(payload, context)
```

Where `context` is a plain object you control:

```js
{
  taskId,
  workerId,
  now,
  emitProgress
}
```

Inside the generated worker:

```js
const task = (${source});
const result = await task(payload, context);
```

This handles sync and async tasks with one path.

### Add a cheap validator, but do not pretend it is complete

A regex validator is a **hazard detector**, not a proof of safety. Keep it small:

```js
static validateTask(fn) {
  const src = Function.prototype.toString.call(fn);

  const hazards = [
    [/\[native code\]/, "native/bound functions cannot be serialized"],
    [/\bwindow\b/, "window is unavailable in workers"],
    [/\bdocument\b/, "document is unavailable in workers"],
    [/\blocalStorage\b/, "localStorage is not a safe worker dependency"],
    [/\bthis\b/, "this will not behave like the caller context"],
    [/\bsuper\b/, "super requires class/method context"],
    [/\barguments\b/, "arguments is fragile across wrapper styles"],
    [/=\s*[A-Z_$][\w$]*/g, "default parameter may reference outer scope"]
  ];

  const errors = hazards
    .filter(([rx]) => rx.test(src))
    .map(([, msg]) => msg);

  if (errors.length) {
    throw new YaiWorkerValidationError(errors, src.slice(0, 500));
  }

  return src;
}
```

DeepSeek/Grok/Qwen already suggested validation; the missing nuance is that the validator must scan **both** the task source and the `data` payload. Structured clone is used for worker messages, but it does not support arbitrary JavaScript execution objects such as functions or DOM nodes.  ([MDN Web Docs][4])

### Do not serialize object methods as user convenience

This is a trap:

```js
YaiWorker.run(myParser.parse)
```

It will detach from `myParser`. Better force this pattern:

```js
YaiWorker.run((data) => Parser.parse(data), {
  imports: ["/parser.js"], // classic worker importScripts path
  data
});
```

Or for v1, avoid imports entirely and require the function to be self-contained.

---

## 2. Payload format for YEH traceability

The current roadmap payload is too thin:

```js
{
  id: this.id,
  payload: e.data.result,
  originEvent: e.data.originEventId
}
```

That does not reliably tell YEH which element, component, module, action, or invocation produced the result when multiple workers are active.

Use a stable, explicit event detail contract. Avoid relying only on `event.target`, because the original element may be removed before the worker returns.

Recommended `CustomEvent.detail` shape:

```js
{
  type: "success",             // success | error | progress | cancelled
  workerId: "yw_...",          // per worker instance
  taskId: "yt_...",            // per invocation
  eventName: "worker:success",

  initiator: {
    ref: WeakRef<Element> | null, // main-thread only
    id: "submitButton",
    yaiId: "cart-recalc",
    module: "cart",
    action: "recalculate",
    selector: "[data-yai-id='cart-recalc']",
    dataset: {
      yaiId: "cart-recalc",
      module: "cart",
      action: "recalculate"
    },
    originEventId: "evt_...",
    originEventType: "click"
  },

  result: any,
  error: null,

  meta: {
    startedAt: 12345.67,
    endedAt: 12358.91,
    duration: 13.24,
    mode: "transient",
    transferred: true
  }
}
```

Important details:

1. Use **string IDs**, not `Symbol`, for `workerId` and `taskId`. Symbols are poor for debugging, serialization, logging, and persistence.

2. Use `WeakRef` only on the main thread. Do not send it to the worker. The worker receives only cloneable data. The Claude/Qwen reviews correctly point out that hard DOM references can pin removed elements in persistent worker scenarios.

3. Dispatch from the initiating element when it is still connected:

```js
const dispatchTarget =
  target?.isConnected ? target : document;

dispatchTarget.dispatchEvent(
  new CustomEvent("worker:success", {
    bubbles: true,
    detail
  })
);
```

`dispatchEvent()` invokes handlers synchronously and normal capture/bubble rules apply, so handler failures must be isolated from Promise settlement. ([MDN Web Docs][5])

4. Prefer `data-yai-id`, `data-yai-module`, and `data-yai-action` over CSS selectors as the primary routing keys. Selectors are useful as fallback/debug metadata, but not stable enough as identity.

Example YEH handler:

```js
YEH.on("worker:success", "[data-yai-module='cart']", (e) => {
  const { initiator, result } = e.detail;

  if (initiator.module !== "cart") return;
  if (initiator.action !== "recalculate") return;

  const el = initiator.ref?.deref();
  if (!el || !el.isConnected) return;

  el.dataset.workerState = "done";
  el.dispatchEvent(new CustomEvent("cart:recalculated", {
    bubbles: true,
    detail: { result, taskId: e.detail.taskId }
  }));
});
```

---

## 3. Clean Promise + YEH event pattern

DeepSeek argued not to do both by default because it risks conceptual overlap; Claude/Qwen argued that both can be emitted from the same worker message without double traffic. The second position is technically correct, but the API should still make the behavior explicit.

Best pattern:

* `YaiWorker.run()` returns a normal Promise.
* It also emits YEH-compatible events by default **only when a `target` is provided**.
* The worker sends one message.
* The main thread builds one `detail` object.
* Promise settlement and event dispatch happen from the same `onmessage`.

Use this ordering: **settle Promise first, then dispatch event in a guarded block**. That prevents a synchronous YEH handler throw from leaving the Promise unresolved.

```js
class YaiWorker {
  static run(taskFn, {
    data,
    transfer,
    target = null,
    emit = Boolean(target),
    mode = "transient",
    module,
    action
  } = {}) {
    const workerId = crypto.randomUUID();
    const taskId = crypto.randomUUID();
    const startedAt = performance.now();

    const source = YaiWorker.validateTask(taskFn);
    const worker = YaiWorker.#createWorker(source, { workerId, taskId });

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (mode === "transient") {
          worker.terminate();
          YaiWorker.#revokeWorkerUrl(worker);
        }
      };

      worker.onmessage = (event) => {
        const endedAt = performance.now();
        const msg = event.data;

        const detail = {
          type: msg.type || (msg.error ? "error" : "success"),
          eventName: msg.error ? "worker:error" : "worker:success",
          workerId,
          taskId,

          initiator: YaiWorker.#buildInitiator(target, {
            module,
            action
          }),

          result: msg.result ?? null,
          error: msg.error ?? null,

          meta: {
            startedAt,
            endedAt,
            duration: endedAt - startedAt,
            mode,
            transferred: Boolean(transfer?.length)
          }
        };

        if (detail.type === "progress") {
          if (emit) YaiWorker.#safeDispatch(target, "worker:progress", detail);
          return;
        }

        // Promise first: listener bugs must not strand the Promise.
        if (detail.error) reject(detail.error);
        else resolve(detail.result);

        if (emit) {
          YaiWorker.#safeDispatch(
            target,
            detail.error ? "worker:error" : "worker:success",
            detail
          );
        }

        cleanup();
      };

      worker.onerror = (err) => {
        const detail = YaiWorker.#buildErrorDetail(err, {
          workerId,
          taskId,
          target,
          startedAt,
          sourcePreview: source.slice(0, 500)
        });

        reject(detail.error);

        if (emit) {
          YaiWorker.#safeDispatch(target, "worker:error", detail);
        }

        cleanup();
      };

      worker.postMessage({ taskId, workerId, payload: data }, transfer || []);
    });
  }

  static #safeDispatch(target, name, detail) {
    try {
      const dispatchTarget = target?.isConnected ? target : document;
      dispatchTarget.dispatchEvent(new CustomEvent(name, {
        bubbles: true,
        detail
      }));
    } catch (err) {
      console.error("YaiWorker event dispatch failed", err);
    }
  }
}
```

Worker wrapper:

```js
const workerCode = `
"use strict";

const task = (${source});

self.onmessage = async function(event) {
  const { taskId, workerId, payload } = event.data;

  const context = {
    taskId,
    workerId,
    emitProgress(value, data) {
      self.postMessage({
        type: "progress",
        taskId,
        progress: value,
        data
      });
    }
  };

  try {
    const result = await task(payload, context);
    self.postMessage({ type: "success", taskId, result });
  } catch (err) {
    self.postMessage({
      type: "error",
      taskId,
      error: {
        name: err?.name || "Error",
        message: err?.message || String(err),
        stack: err?.stack || null
      }
    });
  }
};

//# sourceURL=yaiworker-${taskId}.js
`;
```

---

## Phase-level corrections to apply before coding

### Phase 1

Commit to **classic Blob workers** for v1. Module workers can be a later explicit option. `Worker()` defaults to `classic`, and module workers use module semantics, strict mode, and static imports rather than `importScripts`. ([MDN Web Docs][2])

Add a CSP note: the relevant directive is `worker-src`; if absent, browsers fall back through `child-src`, `script-src`, then `default-src`. So the fallback check should not inspect only `script-src`. ([MDN Web Docs][6])

### Phase 2

Replace `payload` with `result`, add `taskId`, add `workerId`, add `initiator`, and standardize event names. The roadmap’s `originEvent` field is the right idea, but it should become `originEventId` plus `originEventType` and sit inside `initiator`.

### Phase 3

Keep structured clone as the default and Transferables as an optimization, but document that transferred `ArrayBuffer` memory is detached from the sender. MDN describes this as moving the memory resource so the original buffer is no longer usable.  ([MDN Web Docs][7])

Add `SharedArrayBuffer` only as a documented advanced path for persistent workers. It requires a secure, cross-origin-isolated environment; without the required isolation, `postMessage()` with `SharedArrayBuffer` can throw. ([MDN Web Docs][8])

### Phase 4

`isWorking = true` is too weak. Add:

```js
status: "idle" | "running" | "cancelled" | "failed" | "completed"
```

And cancellation:

```js
const controller = new AbortController();

YaiWorker.run(task, {
  data,
  target,
  signal: controller.signal
});

controller.abort();
```

On abort, terminate the worker, revoke the Blob URL, reject the Promise, and dispatch `worker:cancelled`.

Also keep `URL.revokeObjectURL()` mandatory cleanup. The roadmap already flags Object URL leakage; MDN states object URLs should be revoked when finished.  ([MDN Web Docs][9])

---

## Minimal public API I would ship

```js
// Pure one-shot computation; Promise only unless target is provided.
const result = await YaiWorker.run(taskFn, { data });

// DOM-integrated one-shot; Promise + YEH event.
const result = await YaiWorker.run(taskFn, {
  data,
  target: button,
  module: "cart",
  action: "recalculate"
});

// Persistent worker controller.
const job = YaiWorker.spawn(taskFn, {
  target: panel,
  module: "rss",
  action: "parse",
  mode: "persistent"
});

job.post(data);
job.terminate();
```

Do **not** make class serialization a v1 feature. Do **not** support both module workers and classic workers in the same implementation path. Do **not** let the worker payload shape remain free-form. Those three constraints will keep the library small enough to stay under 1,000 LOC without becoming fragile.

[1]: https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts "WorkerGlobalScope: importScripts() method - Web APIs | MDN"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker "Worker: Worker() constructor - Web APIs | MDN"
[3]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/toString "Function.prototype.toString() - JavaScript | MDN"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm "The structured clone algorithm - Web APIs | MDN"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent "EventTarget: dispatchEvent() method - Web APIs | MDN"
[6]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src "Content-Security-Policy: worker-src directive - HTTP | MDN"
[7]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects "Transferable objects - Web APIs | MDN"
[8]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer "SharedArrayBuffer - JavaScript | MDN"
[9]: https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static "URL: revokeObjectURL() static method - Web APIs | MDN"
