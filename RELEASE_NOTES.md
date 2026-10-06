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
