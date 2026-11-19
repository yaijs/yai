# YaiJS examples

`index.html` is the catalogue and the public starting point for runnable examples. It uses YaiTabs plus `data-url` panels itself: the catalogue demonstrates the library while keeping the individual pages focused.

## Directory contract

```text
docs/examples/
├── index.html                     # catalogue application
├── content/                       # small panels loaded by the catalogue only
├── yai-tabs/
│   ├── overview/index.html        # broad, feature-complete Tabs demo
│   ├── benchmark/index.html       # deliberate stress test
│   └── fixtures/                  # HTML fetched by the two Tabs pages
├── yeh/radioactive/index.html
├── yai-worker/index.html
├── yai-toggle/index.html
├── yai-input-utils/index.html
└── reference/import-paths.md
```

The first directory below `examples/` is the public class or module name. A class gets an `index.html` for its primary example; add a named subdirectory only when it has several independently useful scenarios. This prevents a future flat pile of `Example-2-final.html` files.

## Add a new example

1. Put the runnable page in the owning module directory, for example `yai-viewport/index.html` or `yai-tabs/keyboard-navigation/index.html`.
2. Import the checked-out module with a relative path so the example exercises the code in this repository. Do not copy library source into the examples directory.
3. Add one card to the appropriate `content/*.html` catalogue panel. Keep the card short: purpose, what it proves, and one link.
4. Use a fixture only when the demonstration actually fetches HTML. Keep it under that component's `fixtures/` directory and make every `data-url` path explicit.
5. Label intentionally heavy or exploratory material as **Benchmark**, **Fixture**, or **Experimental**. It remains discoverable without becoming the default first impression.

## Boundaries

- `content/` fragments are catalogue content, not standalone pages.
- `yai-tabs/fixtures/` are runtime responses. They must return actual HTML fragments; do not replace them with redirect/link pages.
- Existing published demo URLs outside this directory are not touched by this organisation pass. Any future public-URL migration needs its own tested compatibility plan.

## Local check

Open the catalogue through a static server from the repository root, for example `http://localhost:1178/docs/examples/`. Opening the files directly from disk cannot load ES modules or `data-url` fragments reliably.
