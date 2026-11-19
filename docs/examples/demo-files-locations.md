# YaiJS HTML demo and fixture inventory

This source inventory informed the examples-only organisation. The copies now live under the module directories listed below; source pages outside `docs/examples/` remain untouched.

## Migration rules

1. Keep the existing public URLs working. They are linked from the README, documentation, and likely external pages.
2. Keep complete, user-facing demo copies in `docs/examples/<class>/<scenario>/`.
3. Keep fetched HTML fragments at a stable runtime URL. A blank placeholder or a page containing a link is not a valid replacement for a `data-url` response.
4. Library source stays in its normal module location. For example, `utils/yai-util.js` remains the implementation; its showcase belongs at `docs/examples/yai-util/index.html`, optionally with a small `example.js` beside it.
5. `docs/examples/index.html` is the central showcase. It links to focused pages rather than duplicating their demonstrations.

## User-facing demos — safe candidates for a later move

| Current path | Purpose | Proposed canonical location | Legacy page strategy |
| --- | --- | --- | --- |
| `tabs/Example.html` | Main YaiTabs demo: nested components, dynamic content, styling, YEH patterns | `docs/examples/yai-tabs/overview/index.html` | Source remains unchanged |
| `tabs/Benchmark.html` | Recursive YaiTabs stress test | `docs/examples/yai-tabs/benchmark/index.html` | Source remains unchanged |
| `worker/Example.html` | YaiWorker self-calibrating progress demo | `docs/examples/yai-worker/index.html` | Source remains unchanged |
| `yeh/RadioActive-YEH.html` | YEH reactivity demonstration | `docs/examples/yeh/radioactive/index.html` | Source remains unchanged |
| `docs/utilities/yai-input-utils.html` | YaiInputUtils interactive demo | `docs/examples/yai-input-utils/index.html` | Source remains unchanged |
| `docs/utilities/yai-toggle/yai-toggle.html` | YaiToggle interactive demo | `docs/examples/yai-toggle/index.html` | Source remains unchanged |

## Runtime fixtures — do not turn into link placeholders

These documents are loaded as HTML content by YaiTabs. They are part of the tabs demonstration's runtime contract rather than catalog entries.

| Current path | Role | Recommended destination/strategy |
| --- | --- | --- |
| `tabs/dynamic/basic-yai-tabs.html` | Small dynamically fetched tabs fragment | Keep its URL, or serve a real redirect that preserves fetched HTML semantics |
| `tabs/dynamic/dynamic-content-1.html` | Dynamic content fixture | Keep stable with the tabs demo fixtures |
| `tabs/dynamic/dynamic-content-2.html` | Dynamic content fixture | Keep stable with the tabs demo fixtures |
| `tabs/dynamic/dynamic-content-3.html` | Dynamic content fixture | Keep stable with the tabs demo fixtures |
| `tabs/dynamic/mega-tree-full.html` | Recursive stress-test fixture | Keep stable with the benchmark fixtures |
| `tabs/dynamic/mega-tree-full-max.html` | Maximum recursive stress-test fixture and profiler input | Keep stable with the benchmark fixtures |

The examples copies now live in `docs/examples/yai-tabs/fixtures/`. Their explicit `data-url` paths were updated only inside the examples copies. The original fixture paths remain unchanged.

## Central showcase shape

```text
docs/examples/
├── index.html                       # catalogue application
├── yai-tabs/
│   ├── overview/index.html
│   ├── benchmark/index.html
│   └── fixtures/                    # runtime HTML responses for copied Tabs pages
├── yeh/radioactive/index.html
├── yai-worker/index.html
├── yai-toggle/index.html
├── yai-input-utils/index.html
└── yai-util/index.html              # future focused utility showcase
```

The catalog should stay an index, not a second all-in-one mega-demo. Each class gets one focused overview page; additional scenarios get their own subdirectory when they become numerous.

## Existing local links to preserve

- `README.md` and the documentation index point to `tabs/Example.html`, `tabs/Benchmark.html`, `worker/Example.html`, and `docs/utilities/yai-input-utils.html`.
- Tabs documentation and the YEH documentation point to the Tabs demo and benchmark.
- `tabs/Example.html` and `tabs/Benchmark.html` link to each other.
- `package.json` currently advertises `tabs/Example.html` as the demo command.

These links deliberately remain unchanged in this examples-only pass.
