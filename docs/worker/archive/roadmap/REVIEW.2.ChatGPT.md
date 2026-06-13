## Unified Implementation Plan: `YaiWorker`

This plan locks the five final decisions: public ES module API, internal classic workers, strict `taskId` envelopes, `WeakRef` DOM traceability, transferables/SAB readiness, isolated YEH dispatch before Promise settlement, hard `AbortError` cancellation, and CSP fallback to `/assets/yai-worker-bridge.js`. The roadmap already requires classic workers, CSP fallback, static validation, WeakRef traceability, transferables/SAB support, crash-isolated event dispatch, and `AbortError` termination.

### 0. Remaining Frictions Resolved

| Friction                                      | Final Resolution                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Classic script vs ES module importability** | The runtime bridge remains a **classic script**. The ES module side contains only a **source factory** that returns a string used for Blob creation. The fallback file `/assets/yai-worker-bridge.js` is the executable classic script. This avoids pretending a classic worker file can also be imported as an ES module.                                                                |
| **CSP fallback limitations**                  | CSP fallback solves **blob script loading**. It cannot bypass environments that also block runtime code compilation via `new Function`. If static fallback cannot compile the serialized task, the bridge returns a normal `{ taskId, status: 'error', payload }` envelope. No silent retry. Existing review material already used a static fallback bridge with runtime reconstruction.  |
| **`taskId` lifetime**                         | `taskId` is generated **per `start()` execution**, not per instance. This keeps the envelope a true execution token and avoids stale DOM mappings in persistent mode.                                                                                                                                                                                                                     |
| **Progress events**                           | `progress` is non-terminal. It calls `onProgress` and dispatches optional `worker:progress`, but never resolves, rejects, or cleans up the Promise.                                                                                                                                                                                                                                       |
| **YEH crash isolation**                       | DOM/YEH dispatch runs before Promise settlement and is wrapped in `try/catch`; dispatch failure is logged and never changes Promise outcome. This matches the roadmap and reviewer consensus.                                                                                                                                                                                             |

---

## 1. Exact File Structure

```text
/src/
├── yai-worker.js
│   └── ES Module. Public API. Exports default class YaiWorker.
│
└── internal/
    ├── TaskRegistry.js
    │   └── ES Module. taskId → WeakRef registry.
    │
    ├── CSPDetector.js
    │   └── ES Module. isCSPRestricted() utility.
    │
    ├── SerializationGuard.js
    │   └── ES Module. validateTask() preflight scanner.
    │
    └── createWorkerBridgeSource.js
        └── ES Module. Returns a classic-worker source string for Blob creation.
        └── This file is NOT a worker runtime.

/assets/
└── yai-worker-bridge.js
    └── Classic script. No import/export. Loaded directly by new Worker(..., { type: 'classic' }).
```

Hard module/runtime rules:

```text
/src/yai-worker.js                         ES Module
/src/internal/TaskRegistry.js              ES Module
/src/internal/CSPDetector.js               ES Module
/src/internal/SerializationGuard.js        ES Module
/src/internal/createWorkerBridgeSource.js  ES Module string factory
/assets/yai-worker-bridge.js               Classic Worker script
```

The public API remains a clean ES module, while the actual worker runtime is always classic, preserving `importScripts()` compatibility. This aligns with the roadmap’s no-mixed-runtime constraint and the reviewers’ classic-worker consensus.

---

## 2. Exact Public API Signature

```js
/**
 * @typedef {Object} YaiWorkerOptions
 * @property {'transient'|'persistent'} [mode='transient']
 * @property {HTMLElement} [targetElement]
 * @property {string[]} [importScripts=[]]
 * @property {Transferable[]} [transferables=[]]
 * @property {SharedArrayBuffer} [sharedBuffer]
 * @property {(progressPayload: any) => void} [onProgress]
 * @property {AbortSignal} [abortSignal]
 */

/**
 * @typedef {Object} YaiWorkerTaskContext
 * @property {string} taskId
 * @property {SharedArrayBuffer|null} sharedBuffer
 * @property {(payload: any) => void} postProgress
 */

/**
 * User task shape:
 *   function task(inputData, context) {}
 *   async function task(inputData, context) {}
 *
 * The second argument is optional. Existing one-argument functions remain valid.
 */

export default class YaiWorker {
  /**
   * @param {Function|string} task
   * @param {YaiWorkerOptions} [options={}]
   */
  constructor(task, options = {}) {}

  /**
   * One-shot helper. Creates worker, runs task, then terminates/cleans up.
   *
   * @param {Function|string} task
   * @param {any} [inputData=null]
   * @param {YaiWorkerOptions} [options={}]
   * @returns {Promise<any>}
   */
  static run(task, inputData = null, options = {}) {}

  /**
   * Starts one execution.
   *
   * @param {any} [inputData=null]
   * @returns {Promise<any>}
   */
  start(inputData = null) {}

  /**
   * Forcefully terminates active worker execution.
   * Idempotent.
   *
   * Rejects pending Promise with:
   *   new DOMException('Operation aborted', 'AbortError')
   *
   * @returns {void}
   */
  terminate() {}
}
```

Do not add additional public methods. Do not expose internal `taskId` except through event details and envelopes.

---

## 3. Internal Message Payload Envelope

The envelope shape is immutable at the lowest level: worker responses always contain exactly `taskId`, `status`, and `payload`. The roadmap and reviews repeatedly lock this `taskId/status/payload` contract and require stale or malformed messages to be ignored.

### Main Thread → Worker

```js
/**
 * @typedef {Object} YaiWorkerCommand
 * @property {'init'|'run'|'terminate'} type
 * @property {string} [taskId]
 * @property {string} [code]
 * @property {any} [inputData]
 * @property {string[]} [importScripts]
 * @property {SharedArrayBuffer|null} [sharedBuffer]
 */
```

Exact command variants:

```js
// CSP fallback initialization only
{
  type: 'init',
  code: 'function or arrow function source string',
  importScripts: ['https://cdn.example/x.js']
}

// Execution
{
  type: 'run',
  taskId: 'YAI-1',
  inputData: any,
  sharedBuffer: SharedArrayBuffer | null
}

// Optional internal termination signal before hard terminate
{
  type: 'terminate',
  taskId: 'YAI-1'
}
```

### Worker → Main Thread

```js
/**
 * @typedef {Object} YaiWorkerEnvelope
 * @property {string} taskId
 * @property {'success'|'error'|'progress'} status
 * @property {any} payload
 */
```

Exact response examples:

```js
{
  taskId: 'YAI-1',
  status: 'success',
  payload: result
}

{
  taskId: 'YAI-1',
  status: 'error',
  payload: '[YaiWorker] Task failed: message'
}

{
  taskId: 'YAI-1',
  status: 'progress',
  payload: { done: 40, total: 100 }
}
```

Main thread rule:

```js
if (!env || env.taskId !== activeTaskId) return;
```

No envelope mutation. No additional required keys.

---

## 4. Main Thread Coordinator Logic

### `/src/yai-worker.js`

```js
import { TaskRegistry } from './internal/TaskRegistry.js';
import { isCSPRestricted } from './internal/CSPDetector.js';
import { validateTask } from './internal/SerializationGuard.js';
import { createWorkerBridgeSource } from './internal/createWorkerBridgeSource.js';

let TASK_COUNTER = 0;

function nextTaskId() {
  TASK_COUNTER += 1;
  return `YAI-${TASK_COUNTER}`;
}

function toTaskSource(task) {
  return typeof task === 'function' ? task.toString() : String(task);
}

export default class YaiWorker {
  #task;
  #taskSource;
  #options;

  #worker = null;
  #workerUrl = null;

  #activeTaskId = null;
  #pendingPromise = null;
  #resolve = null;
  #reject = null;

  #isTerminated = false;
  #abortListener = null;

  constructor(task, options = {}) {
    this.#task = task;
    this.#taskSource = toTaskSource(task);

    this.#options = {
      mode: 'transient',
      importScripts: [],
      transferables: [],
      targetElement: null,
      sharedBuffer: null,
      onProgress: null,
      abortSignal: null,
      ...options
    };

    validateTask(this.#taskSource);
  }

  static run(task, inputData = null, options = {}) {
    const worker = new YaiWorker(task, {
      ...options,
      mode: 'transient'
    });

    return worker.start(inputData).finally(() => {
      worker.terminate();
    });
  }

  start(inputData = null) {
    if (this.#isTerminated) {
      throw new DOMException('Worker already terminated', 'AbortError');
    }

    if (this.#pendingPromise) {
      throw new Error('[YaiWorker] Worker already has an active task.');
    }

    const taskId = nextTaskId();
    this.#activeTaskId = taskId;

    if (this.#options.targetElement) {
      TaskRegistry.register(taskId, new WeakRef(this.#options.targetElement));
    }

    this.#pendingPromise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });

    this.#setupWorker();

    this.#worker.onmessage = (event) => {
      this.#handleWorkerMessage(event);
    };

    this.#worker.onerror = (event) => {
      this.#handleWorkerError(event);
    };

    if (this.#options.abortSignal) {
      if (this.#options.abortSignal.aborted) {
        this.terminate();
        return this.#pendingPromise;
      }

      this.#abortListener = () => {
        this.terminate();
      };

      this.#options.abortSignal.addEventListener('abort', this.#abortListener, {
        once: true
      });
    }

    this.#worker.postMessage(
      {
        type: 'run',
        taskId,
        inputData,
        sharedBuffer: this.#options.sharedBuffer ?? null
      },
      this.#options.transferables ?? []
    );

    return this.#pendingPromise;
  }

  terminate() {
    if (this.#isTerminated) return;

    this.#isTerminated = true;

    if (this.#worker) {
      try {
        this.#worker.postMessage({
          type: 'terminate',
          taskId: this.#activeTaskId
        });
      } catch (_) {}

      this.#worker.terminate();
      this.#worker = null;
    }

    if (this.#workerUrl) {
      URL.revokeObjectURL(this.#workerUrl);
      this.#workerUrl = null;
    }

    if (this.#options.abortSignal && this.#abortListener) {
      this.#options.abortSignal.removeEventListener('abort', this.#abortListener);
      this.#abortListener = null;
    }

    if (this.#activeTaskId) {
      TaskRegistry.unregister(this.#activeTaskId);
    }

    if (this.#reject) {
      this.#reject(new DOMException('Operation aborted', 'AbortError'));
    }

    this.#clearPending();
  }

  #setupWorker() {
    const restricted = isCSPRestricted();

    if (restricted) {
      this.#worker = new Worker('/assets/yai-worker-bridge.js', {
        type: 'classic'
      });

      this.#worker.postMessage({
        type: 'init',
        code: this.#taskSource,
        importScripts: this.#options.importScripts
      });

      return;
    }

    const source = createWorkerBridgeSource({
      taskSource: this.#taskSource,
      importScripts: this.#options.importScripts
    });

    const blob = new Blob([source], {
      type: 'application/javascript'
    });

    this.#workerUrl = URL.createObjectURL(blob);

    this.#worker = new Worker(this.#workerUrl, {
      type: 'classic'
    });
  }

  #handleWorkerMessage(event) {
    const env = event.data;

    if (!env || env.taskId !== this.#activeTaskId) {
      return;
    }

    if (env.status === 'progress') {
      this.#handleProgress(env);
      return;
    }

    this.#dispatchWorkerEvent(env);

    if (env.status === 'success') {
      this.#resolve?.(env.payload);
      this.#cleanupAfterSettlement();
      return;
    }

    if (env.status === 'error') {
      this.#reject?.(new Error(String(env.payload)));
      this.#cleanupAfterSettlement();
    }
  }

  #handleProgress(env) {
    try {
      if (typeof this.#options.onProgress === 'function') {
        this.#options.onProgress(env.payload);
      }
    } catch (err) {
      console.error('[YaiWorker] onProgress handler failed:', err);
    }

    try {
      const ref = TaskRegistry.lookup(env.taskId);
      const originElement = ref?.deref();

      if (!originElement) return;

      const detail = {
        taskId: env.taskId,
        payload: env.payload,
        originElement
      };

      originElement.dispatchEvent(
        new CustomEvent('worker:progress', {
          bubbles: true,
          detail
        })
      );

      if (globalThis.YEH?.dispatch) {
        globalThis.YEH.dispatch('worker:progress', detail);
      }
    } catch (err) {
      console.error('[YaiWorker] progress dispatch failed:', err);
    }
  }

  #dispatchWorkerEvent(env) {
    try {
      const ref = TaskRegistry.lookup(env.taskId);
      const originElement = ref?.deref();

      if (!originElement) return;

      const eventName = `worker:${env.status}`;

      const detail = {
        taskId: env.taskId,
        payload: env.payload,
        originElement
      };

      originElement.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          detail
        })
      );

      if (globalThis.YEH?.dispatch) {
        globalThis.YEH.dispatch(eventName, detail);
      }
    } catch (err) {
      console.error('[YaiWorker] YEH/DOM dispatch failed:', err);
    }
  }

  #handleWorkerError(errorEvent) {
    const err = new Error(
      `[YaiWorker] Worker thread error: ${errorEvent.message || 'Unknown worker error'}`
    );

    err.filename = errorEvent.filename;
    err.lineno = errorEvent.lineno;
    err.colno = errorEvent.colno;

    this.#dispatchWorkerEvent({
      taskId: this.#activeTaskId,
      status: 'error',
      payload: err.message
    });

    this.#reject?.(err);
    this.#cleanupAfterSettlement();
  }

  #cleanupAfterSettlement() {
    if (this.#options.abortSignal && this.#abortListener) {
      this.#options.abortSignal.removeEventListener('abort', this.#abortListener);
      this.#abortListener = null;
    }

    if (this.#activeTaskId) {
      TaskRegistry.unregister(this.#activeTaskId);
    }

    if (this.#options.mode === 'transient') {
      if (this.#worker) {
        this.#worker.terminate();
        this.#worker = null;
      }

      if (this.#workerUrl) {
        URL.revokeObjectURL(this.#workerUrl);
        this.#workerUrl = null;
      }
    }

    this.#clearPending();
  }

  #clearPending() {
    this.#activeTaskId = null;
    this.#pendingPromise = null;
    this.#resolve = null;
    this.#reject = null;
  }
}
```

Important execution-order invariants:

```text
1. validateTask() runs before worker creation.
2. Promise callbacks are stored before postMessage(run).
3. taskId is registered before postMessage(run).
4. Worker result arrives.
5. Main thread validates taskId.
6. Progress is handled as non-terminal.
7. Terminal success/error dispatches DOM/YEH event inside try/catch.
8. Promise resolves/rejects only after dispatch attempt.
9. Cleanup unregisters WeakRef and revokes Blob URL in transient mode.
10. terminate() always rejects pending Promise with AbortError.
```

The `start()` sequence follows reviewer consensus: guard active execution, register `WeakRef`, create Promise callbacks, wire message/error handlers, post the `run` command with transferables, then return the Promise.

---

## 5. Blob Source Factory

### `/src/internal/createWorkerBridgeSource.js`

```js
export function createWorkerBridgeSource({ taskSource, importScripts = [] }) {
  const imports = importScripts
    .map((url) => `importScripts(${JSON.stringify(url)});`)
    .join('\n');

  return `
'use strict';

${imports}

var _taskFn = (function () {
  'use strict';
  return (${taskSource});
}());

(function () {
  'use strict';

  self.onmessage = async function (event) {
    var msg = event.data;

    if (!msg || !msg.type) {
      return;
    }

    if (msg.type === 'terminate') {
      self.close();
      return;
    }

    if (msg.type !== 'run') {
      return;
    }

    if (typeof _taskFn !== 'function') {
      self.postMessage({
        taskId: msg.taskId,
        status: 'error',
        payload: '[YaiWorker] Task did not evaluate to a function.'
      });
      return;
    }

    var context = {
      taskId: msg.taskId,
      sharedBuffer: msg.sharedBuffer || null,
      postProgress: function (payload) {
        self.postMessage({
          taskId: msg.taskId,
          status: 'progress',
          payload: payload
        });
      }
    };

    try {
      var result = await _taskFn(msg.inputData, context);

      self.postMessage({
        taskId: msg.taskId,
        status: 'success',
        payload: result
      });
    } catch (err) {
      self.postMessage({
        taskId: msg.taskId,
        status: 'error',
        payload: err && err.message ? err.message : String(err)
      });
    }
  };
}());
`;
}
```

This preserves the classic Blob runtime while keeping the public library importable as an ES module.

---

## 6. Static CSP Fallback Worker

### `/assets/yai-worker-bridge.js`

```js
// Classic Worker Script. No import. No export. No top-level await.
(function () {
  'use strict';

  var _taskFn = null;
  var _initError = null;

  self.onmessage = async function (event) {
    var msg = event.data;

    if (!msg || !msg.type) {
      return;
    }

    if (msg.type === 'init') {
      try {
        if (msg.importScripts && msg.importScripts.length) {
          importScripts.apply(self, msg.importScripts);
        }

        _taskFn = (new Function(
          '"use strict"; return (' + msg.code + ');'
        ))();

        _initError = null;
      } catch (err) {
        _taskFn = null;
        _initError = err && err.message ? err.message : String(err);
      }

      return;
    }

    if (msg.type === 'terminate') {
      self.close();
      return;
    }

    if (msg.type !== 'run') {
      return;
    }

    if (_initError) {
      self.postMessage({
        taskId: msg.taskId,
        status: 'error',
        payload: '[YaiWorker] Static fallback failed to initialize task: ' + _initError
      });
      return;
    }

    if (typeof _taskFn !== 'function') {
      self.postMessage({
        taskId: msg.taskId,
        status: 'error',
        payload: '[YaiWorker] Task function is not initialized.'
      });
      return;
    }

    var context = {
      taskId: msg.taskId,
      sharedBuffer: msg.sharedBuffer || null,
      postProgress: function (payload) {
        self.postMessage({
          taskId: msg.taskId,
          status: 'progress',
          payload: payload
        });
      }
    };

    try {
      var result = await _taskFn(msg.inputData, context);

      self.postMessage({
        taskId: msg.taskId,
        status: 'success',
        payload: result
      });
    } catch (err) {
      self.postMessage({
        taskId: msg.taskId,
        status: 'error',
        payload: err && err.message ? err.message : String(err)
      });
    }
  };
}());
```

Worker-loop invariants:

```text
1. Classic script only.
2. No ES module syntax.
3. Accepts init only for static CSP fallback.
4. Accepts run for execution.
5. Always copies msg.taskId into every response envelope.
6. Catches sync and async task failures via await.
7. Sends success/error/progress envelopes only.
8. Does not access DOM globals.
```

The async worker loop is selected because it handles both synchronous and asynchronous task functions transparently, matching the strongest reviewer version.

---

## 7. Internal Utilities

### `/src/internal/TaskRegistry.js`

```js
const registry = new Map();

export const TaskRegistry = {
  register(taskId, weakRef) {
    registry.set(taskId, weakRef);
  },

  lookup(taskId) {
    return registry.get(taskId) ?? null;
  },

  unregister(taskId) {
    registry.delete(taskId);
  }
};
```

This is only a main-thread registry. The worker never sees DOM references.

### `/src/internal/CSPDetector.js`

```js
export function isCSPRestricted() {
  if (typeof chrome !== 'undefined' && chrome?.runtime?.id) {
    return true;
  }

  try {
    const blob = new Blob(['self.close();'], {
      type: 'application/javascript'
    });

    const url = URL.createObjectURL(blob);

    try {
      const worker = new Worker(url, {
        type: 'classic'
      });

      worker.terminate();
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (_) {
    return true;
  }
}
```

The detector answers only one question: “Can this environment create a classic Blob worker?” If false, `/assets/yai-worker-bridge.js` is used.

### `/src/internal/SerializationGuard.js`

```js
const FORBIDDEN_GLOBALS =
  /\b(window|document|localStorage|sessionStorage|parent|top|opener)\b/;

const THIS_REFERENCE =
  /\bthis\b/;

export function validateTask(taskSource) {
  const source = String(taskSource);

  const forbidden = source.match(FORBIDDEN_GLOBALS);
  if (forbidden) {
    throw new Error(
      `[YaiWorker] Task references forbidden main-thread global "${forbidden[0]}". ` +
      'Workers cannot access DOM or storage globals. Pass required data through inputData.'
    );
  }

  if (THIS_REFERENCE.test(source)) {
    throw new Error(
      '[YaiWorker] Task references "this". Serialized worker tasks must be self-contained.'
    );
  }

  return true;
}
```

This follows the roadmap’s requirement to fail before spawning if task source contains DOM globals or unbound `this`.

---

## 8. Transferables and SharedArrayBuffer Contract

### Transferables

Main-thread call path:

```js
const buffer = new ArrayBuffer(1024);

const worker = new YaiWorker(task, {
  transferables: [buffer]
});

await worker.start(buffer);
```

Internal send:

```js
worker.postMessage(command, options.transferables);
```

Contract:

```text
1. Transferables are one-way main → worker.
2. Ownership transfers immediately.
3. Main thread must not read transferred buffers after start().
4. No clone fallback is attempted.
```

### SharedArrayBuffer + Atomics

Task receives `context.sharedBuffer`:

```js
const task = (input, ctx) => {
  const view = new Int32Array(ctx.sharedBuffer);

  Atomics.store(view, 0, 50);
  Atomics.notify(view, 0);

  return input;
};
```

Contract:

```text
1. YaiWorker passes sharedBuffer through the run command.
2. Worker does not interpret the buffer.
3. User task owns Atomics layout.
4. This prepares bidirectional high-frequency progress without forcing a polling API.
```

This implements the roadmap’s data-duality split: transferables for one-off zero-copy data movement, and SAB/Atomics for persistent shared progress state.

---

## 9. Event Contract

Terminal success:

```js
new CustomEvent('worker:success', {
  bubbles: true,
  detail: {
    taskId,
    payload,
    originElement
  }
});
```

Terminal error:

```js
new CustomEvent('worker:error', {
  bubbles: true,
  detail: {
    taskId,
    payload,
    originElement
  }
});
```

Progress:

```js
new CustomEvent('worker:progress', {
  bubbles: true,
  detail: {
    taskId,
    payload,
    originElement
  }
});
```

Dispatch order for success/error:

```text
1. Validate envelope taskId.
2. Lookup WeakRef.
3. deref() origin element.
4. Dispatch CustomEvent from origin element.
5. Optionally call global YEH.dispatch(eventName, detail) if present.
6. Catch/log any dispatch failure.
7. Resolve/reject Promise.
8. Cleanup.
```

The key invariant is that buggy event listeners cannot leave the native Promise hanging.

---

## 10. Final Agent Checklist

```text
[ ] Public API exists only in /src/yai-worker.js.
[ ] Worker runtime is always classic; never use type: 'module'.
[ ] Blob worker uses new Worker(blobUrl, { type: 'classic' }).
[ ] CSP fallback uses new Worker('/assets/yai-worker-bridge.js', { type: 'classic' }).
[ ] taskId is generated per start() execution.
[ ] TaskRegistry stores taskId → WeakRef only.
[ ] Worker responses always use { taskId, status, payload }.
[ ] Main thread ignores missing or mismatched taskId.
[ ] validateTask() runs before worker creation.
[ ] importScripts are injected only into classic worker contexts.
[ ] start() stores resolve/reject before postMessage(run).
[ ] transferables are passed only as postMessage second argument.
[ ] sharedBuffer is passed in command and exposed as context.sharedBuffer.
[ ] progress never settles the Promise.
[ ] success/error dispatch DOM/YEH before Promise settlement.
[ ] dispatch is wrapped in try/catch.
[ ] worker.onerror rejects through the same cleanup path.
[ ] terminate() is idempotent.
[ ] terminate() calls worker.terminate().
[ ] terminate() revokes Blob URL.
[ ] terminate() unregisters TaskRegistry entry.
[ ] terminate() rejects pending Promise with DOMException('Operation aborted', 'AbortError').
[ ] transient mode terminates and revokes after settlement.
[ ] persistent mode keeps the worker alive after settlement but still unregisters the completed taskId.
[ ] static fallback reports initialization failure as an error envelope on run.
```

This is the locked implementation blueprint.
