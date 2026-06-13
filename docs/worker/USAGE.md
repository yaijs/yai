# YaiWorker — Practical Usage Guide

A worker runs your function in a background thread. The main thread stays unblocked. That's it. Everything else in this document is about moving data in and out cleanly.

---

## How data moves

When you call `worker.start(inputData)`, the browser **structured-clones** the data — a deep copy that supports plain objects, arrays, Maps, Sets, ArrayBuffers, Dates, and more, but not functions, DOM nodes, or class instances. The worker gets its own copy and can never mutate your main-thread data directly.

The only way to communicate is:

```
Main thread  ──inputData──▶  Worker (runs task)  ──result──▶  Main thread
```

This constraint is the entire design. Feed it data, get back a result, apply the result yourself.

---

## Pattern 1 — Plain objects (the common case)

Any JSON-like structure passes through fine. Objects, nested objects, arrays, Maps, Sets — all structured-cloned automatically.

```javascript
import YaiWorker from '@yaijs/core/worker';

// One-shot static helper — no instance management needed
const result = await YaiWorker.run(
    (data) => {
        // data is a deep copy — mutate freely
        return data.items
            .filter(item => item.active)
            .sort((a, b) => b.score - a.score)
            .slice(0, data.limit);
    },
    { items: myItems, limit: 10 }
);

console.log(result); // top 10 active items by score
```

The rule: everything going in must be serializable. Everything coming back must be serializable. Functions, class instances, and DOM refs are never serializable — pass their data instead.

---

## Pattern 2 — Progress updates

The task receives `taskId` as its second argument. Post intermediate messages back using it; the `onProgress` callback fires on the main thread without touching the promise.

```javascript
const worker = new YaiWorker(
    async (data, taskId) => {
        const results = [];

        for (let i = 0; i < data.items.length; i++) {
            results.push(heavyProcess(data.items[i]));

            // Report progress every 100 items
            if (i % 100 === 0) {
                self.postMessage({
                    taskId,
                    status: 'progress',
                    payload: { done: i, total: data.items.length }
                });
            }
        }

        return results;
    },
    {
        onProgress: ({ done, total }) => {
            progressBar.style.width = `${(done / total) * 100}%`;
        }
    }
);

const results = await worker.start({ items: largeDataset });
```

Progress messages are fire-and-forget — they never settle the promise and never dispatch a DOM `CustomEvent`. They are only delivered to `onProgress`.

---

## Pattern 3 — Large data (ArrayBuffer transfer)

Structured cloning duplicates memory. For payloads above ~5 MB, encode to `ArrayBuffer` and **transfer** it — the buffer is physically moved to the worker with zero copying. The main thread can no longer access it after the transfer.

```javascript
// Encode your data
const raw    = JSON.stringify(myLargeDataset);
const bytes  = new TextEncoder().encode(raw);
const buffer = bytes.buffer; // ArrayBuffer

const result = await YaiWorker.run(
    (buf) => {
        // Decode inside the worker
        const data = JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));

        // ... heavy computation ...

        return summary; // return only what you need — small result, no re-transfer needed
    },
    buffer,
    { transferables: [buffer] } // zero-copy move
);

// buffer is now detached here — don't touch it
```

Use this when: large image data, raw audio buffers, binary protocol payloads, or any payload where the structured-clone cost shows up in profiling.

---

## Pattern 4 — Persistent worker (stateful across calls)

Set `mode: 'persistent'` and the worker stays alive between `start()` calls. State lives on the worker's global `self` scope.

```javascript
const counter = new YaiWorker(
    async (inputData, taskId) => {
        self.count = (self.count ?? 0) + inputData.increment;
        return self.count;
    },
    { mode: 'persistent' }
);

console.log(await counter.start({ increment: 5  })); // 5
console.log(await counter.start({ increment: 3  })); // 8
console.log(await counter.start({ increment: 10 })); // 18

counter.terminate(); // explicit cleanup required for persistent mode
```

Persistent workers are sequential — only one `start()` can be active at a time. For parallel fan-out, create multiple instances.

---

## Pattern 5 — Pre-compiled worker (`workerUrl`)

The dynamic-task approach (serializing a function via `.toString()`, injecting it into a Blob, reconstructing it with `new Function`) is blocked in:

- **Chrome Extension MV3** — CSP propagates to workers, blocking `new Function`
- **Environments with strict `script-src 'self'`** that also block `blob:` URLs

The `workerUrl` option bypasses all of that. You write a regular worker file with your logic pre-compiled, tell YaiWorker where it lives, and YaiWorker handles the rest — message routing, promise wiring, DOM events, `terminate()` cleanup — exactly as normal.

### The worker file contract

Your worker file must speak the YaiWorker envelope protocol:

```javascript
// my-worker.js  (a standard classic script — no import/export)
self.onmessage = async function (e) {
    const msg = e.data;
    if (msg.type !== 'run') return;

    try {
        const result = await myLogic(msg.inputData, msg.sharedBuffer);

        self.postMessage({ taskId: msg.taskId, status: 'success', payload: result });
    } catch (err) {
        self.postMessage({ taskId: msg.taskId, status: 'error', payload: err.message });
    }
};

// Progress (optional)
function reportProgress(taskId, payload) {
    self.postMessage({ taskId, status: 'progress', payload });
}

async function myLogic(data, sharedBuffer) {
    // your pre-compiled logic here
}
```

### Wiring it up

```javascript
const worker = new YaiWorker(null, {
    workerUrl: '/workers/my-worker.js',   // any resolvable URL
    mode: 'persistent',
});

const result = await worker.start(myData);
```

The `task` argument is `null` because the logic already lives in the file. `workerUrl` takes full precedence — no validation, no blob, no CSP check.

---

## Real-world example — WebDAV identity sync (Chrome Extension)

This is the use case that motivated `workerUrl`. A new-tab extension stores Pages, Modules, Tabs, and content locally, and needs to compute a diff against a WebDAV server snapshot. The diff walks large object graphs — exactly the kind of CPU work that blocks UI if run on the main thread.

### 1. The worker file (bundled with the extension)

```javascript
// workers/sync-worker.js
'use strict';

self.onmessage = async function (e) {
    const msg = e.data;
    if (msg.type !== 'run') return;

    try {
        const plan = computeSyncPlan(msg.inputData);
        self.postMessage({ taskId: msg.taskId, status: 'success', payload: plan });
    } catch (err) {
        self.postMessage({ taskId: msg.taskId, status: 'error', payload: err.message });
    }
};

function computeSyncPlan({ local, server }) {
    const toUpload   = [];
    const toDownload = [];
    const conflicts  = [];

    // Build O(1) lookup maps from server snapshot
    const serverIndex = {};
    for (const type of ['pages', 'modules', 'tabs', 'content']) {
        serverIndex[type] = new Map(server[type].map(item => [item.id, item]));
    }

    for (const type of ['pages', 'modules', 'tabs', 'content']) {
        // Items that exist locally
        for (const localItem of local[type]) {
            const serverItem = serverIndex[type].get(localItem.id);

            if (!serverItem) {
                toUpload.push({ type, item: localItem, reason: 'new' });
                continue;
            }

            const localTs  = new Date(localItem.updatedAt).getTime();
            const serverTs = new Date(serverItem.updatedAt).getTime();

            if (localTs > serverTs) {
                toUpload.push({ type, item: localItem, reason: 'newer' });
            } else if (serverTs > localTs) {
                toDownload.push({ type, item: serverItem, reason: 'newer' });
            }

            // Relationship integrity — orphaned tab (parent page deleted on server)
            if (type === 'tabs' && localItem.pageId) {
                if (!serverIndex.pages.has(localItem.pageId)) {
                    conflicts.push({ type, item: localItem, reason: 'orphaned-parent' });
                }
            }
        }

        // Items on server not present locally (new on server, or deleted locally)
        for (const [id, serverItem] of serverIndex[type]) {
            if (!local[type].some(i => i.id === id)) {
                toDownload.push({ type, item: serverItem, reason: 'missing-locally' });
            }
        }
    }

    return { toUpload, toDownload, conflicts };
}
```

### 2. Register it in `manifest.json`

```json
{
    "web_accessible_resources": [{
        "resources": ["workers/sync-worker.js"],
        "matches": ["<all_urls>"]
    }]
}
```

### 3. Use it from your extension page

```javascript
import YaiWorker from './vendor/yai-worker.js';

// Create once, reuse across sync cycles
const syncWorker = new YaiWorker(null, {
    workerUrl: chrome.runtime.getURL('workers/sync-worker.js'),
    mode: 'persistent',
    onProgress: ({ phase, done, total }) => {
        statusBar.textContent = `${phase}: ${done}/${total}`;
    }
});

async function syncWithServer() {
    // Fetch both snapshots in parallel — network IO stays on main thread
    const [localExport, serverSnapshot] = await Promise.all([
        localStore.exportAll(),    // { pages, modules, tabs, content }
        webdav.fetchSnapshot(),    // same shape
    ]);

    // Heavy diff runs off-thread — UI stays responsive
    const plan = await syncWorker.start({ local: localExport, server: serverSnapshot });

    // Apply the plan on the main thread — only this part needs DOM/network access
    for (const op of plan.toUpload) {
        await webdav.put(`/${op.type}/${op.item.id}.json`, JSON.stringify(op.item));
    }
    for (const op of plan.toDownload) {
        await localStore.upsert(op.type, op.item);
    }

    // Surface conflicts for manual resolution
    if (plan.conflicts.length > 0) {
        showConflictUI(plan.conflicts);
    }
}

// Cleanup when the tab is closed
window.addEventListener('beforeunload', () => syncWorker.terminate());
```

The split is clear: **the worker only thinks, the main thread only acts**. Network calls, DOM access, and store writes all stay on the main thread where they belong. The worker receives plain data, returns a plain plan, never touches anything external.

### Going further — tombstones and LWW conflict resolution

The sync plan above handles simple cases well but has a blind spot: **deletions**. If you delete a tab locally and the server still has it, `toDownload` will resurrect it on the next sync. The classic fix is a **tombstone** — instead of erasing a deleted record, mark it with a `deleted_at` timestamp and let it stay in the dataset.

Your schema likely already has this. If a record has `deleted_at: null` it's alive; if it has a timestamp it's dead. The worker then applies **Last-Write-Wins (LWW)** across both the `updated_at` and `deleted_at` fields simultaneously:

```javascript
// workers/sync-worker.js — upgraded with tombstone support
'use strict';

self.onmessage = async function (e) {
    const msg = e.data;
    if (msg.type !== 'run') return;

    try {
        const plan = computeSyncPlan(msg.inputData);
        self.postMessage({ taskId: msg.taskId, status: 'success', payload: plan });
    } catch (err) {
        self.postMessage({ taskId: msg.taskId, status: 'error', payload: err.message });
    }
};

function computeSyncPlan({ local, server }) {
    const merged = new Map();

    // Index all local records by stable sync_id
    for (const type of ['pages', 'modules', 'tabs', 'content']) {
        for (const item of local[type]) {
            merged.set(item.sync_id, { type, item });
        }
    }

    // Diff against server using LWW — compare the *latest* of updated_at and deleted_at
    for (const type of ['pages', 'modules', 'tabs', 'content']) {
        for (const remoteItem of server[type]) {
            const existing = merged.get(remoteItem.sync_id);

            if (!existing) {
                // New on server — bring it down (even if it's a tombstone)
                merged.set(remoteItem.sync_id, { type, item: remoteItem });
                continue;
            }

            const localTime  = latestTimestamp(existing.item);
            const remoteTime = latestTimestamp(remoteItem);

            if (remoteTime > localTime) {
                // Server version is newer — use it (tombstone or not)
                merged.set(remoteItem.sync_id, { type, item: remoteItem });
            }
            // If localTime >= remoteTime, local wins — already in map
        }
    }

    // Classify the merged result into operations
    const toUpload   = [];
    const toDownload = [];

    for (const [sync_id, { type, item }] of merged) {
        const existsLocally = local[type].some(i => i.sync_id === sync_id);
        const existsOnServer = server[type].some(i => i.sync_id === sync_id);

        const localItem  = local[type].find(i => i.sync_id === sync_id);
        const serverItem = server[type].find(i => i.sync_id === sync_id);

        if (!existsOnServer) {
            toUpload.push({ type, item });   // local-only → push up
        } else if (!existsLocally) {
            toDownload.push({ type, item }); // server-only → pull down
        } else {
            const localTime  = latestTimestamp(localItem);
            const remoteTime = latestTimestamp(serverItem);

            if (localTime > remoteTime) toUpload.push({ type, item });
            else if (remoteTime > localTime) toDownload.push({ type, item });
            // equal timestamps → no-op
        }
    }

    return { toUpload, toDownload };
}

// The "effective" timestamp of a record is whichever is later: last edit or deletion
function latestTimestamp(item) {
    const updated = item.updated_at ? new Date(item.updated_at).getTime() : 0;
    const deleted = item.deleted_at ? new Date(item.deleted_at).getTime() : 0;
    return Math.max(updated, deleted);
}
```

**Why zombies stay dead:** when you delete a tab locally (`deleted_at` is set), that timestamp becomes the record's "effective time". If it's newer than the server's `updated_at`, the tombstone wins — the server gets the deletion pushed up, not the live record pulled back down.

**What to store locally:** tombstoned records never fully disappear until you run a periodic purge of records where both sides agree `deleted_at` is older than a safe TTL (e.g. 30 days). Until then they participate in every sync normally.

---

## What you cannot pass

| Type | Passable? | Workaround |
|------|-----------|------------|
| Plain object / array | ✅ | — |
| `Map`, `Set`, `Date` | ✅ | — |
| `ArrayBuffer` | ✅ (copy or transfer) | — |
| `SharedArrayBuffer` | ✅ (shared, requires COOP/COEP headers) | — |
| Function | ❌ | Serialize logic into the worker file or inline task |
| DOM element | ❌ | Pass `element.dataset` or `id` instead |
| Class instance | ❌ | Pass its plain data properties instead |
| Circular reference | ❌ | Flatten first |
| `Promise` | ❌ | Await it before passing the resolved value |

---

## What you cannot do inside a task

The worker thread has no DOM. These will throw:

```javascript
// ❌ All forbidden — SerializationGuard rejects these before the worker even spawns
(data) => document.getElementById(data.id)
(data) => window.localStorage.getItem(data.key)
(data) => location.href
```

Pass values instead:

```javascript
// ✅
const itemData = document.getElementById('my-item').dataset;
const result = await YaiWorker.run((data) => transform(data), itemData);
```

---

## Debugging

**"Worker is already running"** — you called `start()` while a previous call was still pending. Use `mode: 'persistent'` and `await` each call, or create a new instance per task.

**"Task references forbidden global"** — `SerializationGuard` caught a DOM reference at construction time. Check the error message for which global (`window`, `document`, etc.) and move that access to the main thread.

**"Task uses `this`"** — switch to an arrow function, or pass `{ allowThis: true }` if you're certain binding isn't needed at runtime.

**Worker is silent / promise never resolves** — make sure your pre-compiled worker file (`workerUrl` path) responds with the exact envelope shape: `{ taskId: msg.taskId, status: 'success', payload: result }`. A missing or wrong `taskId` causes the message to be silently dropped.
