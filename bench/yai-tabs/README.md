# YaiTabs deep-tree profiler

`profile.mjs` is a manual jsdom attribution profiler for `tabs/dynamic/mega-tree-full-max.html`. It removes the fixture's intentional delays, recursively injects the real fragment, and reports JavaScript-visible DOM operations by method.

```bash
node bench/yai-tabs/profile.mjs 25
```

Treat the millisecond value as jsdom-only. Parent hops, `contains()`, selector calls, and the listener count are the useful comparative signals. The profiler intentionally monkey-patches DOM and component prototypes, so it is never part of automated tests or production code.
