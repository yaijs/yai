# YaiJS v1.2.1 Release Notes (upcoming)

## Reliability hardening

This maintenance update strengthens the YEH event lifecycle and YaiWorker
operation protocol without changing the YaiTabs public API.

### YEH

- Listener registrations now retain their own native listener identity, so
  removal stays reliable after elements are detached or reordered.
- A physical browser event is handled once even when matching registrations
  overlap.
- Throttled and debounced handlers recover after user callback errors; their
  timer records cannot become stuck.
- Per-element debouncing no longer merges unnamed inputs, constructor hooks are
  preserved, and listener options are copied before YEH adds its own settings.

### YaiWorker

- Each `start()` operation now has a `runId`; delayed worker replies cannot
  settle a later run on a persistent worker.
- Transient workers clean up their AbortSignal subscription on every terminal
  path, including synchronous `postMessage` failures.
- Blob-worker CSP failures now explain that a pre-compiled `workerUrl` is
  required, and temporary Blob URLs are revoked.
- Relative `importScripts` URLs are resolved against the page URL before the
  Blob worker is created.
- Serialization validation no longer rejects ordinary property names, comments,
  or quoted prose while still rejecting bare DOM-global access.

### Verification

- 162 automated tests passed; 5 existing browser-environment tests remain
  skipped.
- The worker bridge source and published asset are tested for protocol parity.
- Ynforcer completed a dynamic YaiTabs stress run without errors: 122 steps in
  111.82 seconds, across 525 components and 5,201 elements. The page-wide
  listener snapshot was 46 listeners on 12 elements (3.83 average), including
  roughly 5–6 browser-engine listeners in Vivaldi; it is not a per-component
  YaiTabs metric.
- The run reported 98 forced-reflow and 77 long-`setTimeout` warnings. Under
  this workload—60 initial YaiTabs components, then dynamic additions—these are
  diagnostics to monitor, not failures.

## Compatibility

This is a maintenance release. Existing YaiTabs behavior remains unchanged.
Custom pre-compiled workers must echo the documented `runId` in their response
envelopes.

---

# YaiJS v1.2.0 Release Notes

## Correctness and lifecycle release

YaiJS v1.2.0 strengthens cleanup and lifecycle behavior in YEH and YaiWorker.
The YaiTabs API and the Example demo behavior are unchanged.

## Fixed

### YEH debounce cleanup

Removing an event listener or destroying a YEH instance now cancels its pending
debounced callback correctly. Delayed callbacks can no longer run after the
DOM listener that created them has been removed.

### YEH handler failure behavior

Handler and lifecycle-hook exceptions still reach the caller. Configured
`preventDefault()` and propagation handling now run reliably even when a hook
or handler throws. `afterHandleEvent` hooks run only after a successful handler.

### Safe YEH statistics

`getStats()` now returns timer counts instead of live internal Maps, so reading
diagnostics cannot mutate YEH timer state.

### YaiWorker CSP behavior

Serialized function tasks now fail immediately and clearly when a restrictive
CSP blocks Blob workers. The former static-asset fallback could not compile the
serialized task and only failed later inside the worker.

Use a pre-compiled worker with `workerUrl` in CSP-restricted environments:

```js
const worker = new YaiWorker(null, {
  workerUrl: '/workers/my-task.js'
});
```

### YaiWorker AbortSignal lifecycle

Persistent workers now register one external `AbortSignal` listener for the
whole worker lifetime, rather than one per `start()` call. `terminate()` removes
that subscription as part of its idempotent cleanup.

## Packaging and documentation

- The published worker bridge asset is verified against its injected source.
- Package consumers can import the explicit `./yeh/yeh.js` and
  `./worker/yai-worker.js` entry points.
- Documentation now states YEH's closest-handler, single-delivery semantics
  and the default propagation behavior.

## Compatibility

This release is compatible with existing YaiTabs and YEH usage.

The one intentional behavior correction is CSP handling for serialized
`YaiWorker` tasks: code that relied on the non-functional fallback must provide
`workerUrl` instead.

## Verification

- 139 tests passed; 5 existing browser-environment tests remain skipped.
- Verified a packed package can import YEH and YaiWorker source entry points.
- The unminified YaiTabs Example demo remains the recommended integration smoke test.

## Upgrade

```bash
npm install @yaijs/core@1.2.0
```
