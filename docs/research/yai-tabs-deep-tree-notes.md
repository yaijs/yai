# YaiTabs deep-tree profiling notes

This note records a contributed jsdom review of the recursive stress fixture. It is deliberately not a change request: the normal YaiTabs demo and automated search-and-click run remain the meaningful browser acceptance tests.

## Confirmed strength

The recursive fixture has 15 tab containers and 295 elements per injection. The listener count remained three (window hashchange, root click, root keydown) at 390 containers / 7,674 elements. That is the intended delegation property: listener cost does not grow with component count.

## What the profiler measures

At 25 injections, the jsdom profiler attributed a deep click mostly to `_updateAriaOrientation` (about 2.27 million parent hops in that run). A root click that reactivates a deep subtree was dominated by `_updateAriaStates`, `_getCached`, and sibling cleanup, including many `contains()` calls. These are operation counts in jsdom; they explain where to investigate if a real-browser regression appears, but they are not browser timing claims.

## Deliberate non-change

No YaiTabs path was altered for this contribution. The reported scenario is intentionally extreme and the user confirmed normal interactive behavior and the Ynforcer stress run are healthy. The manual profiler is retained at [bench/yai-tabs/profile.mjs](../../bench/yai-tabs/profile.mjs) for future before/after comparisons.

## Boundary to keep in mind

YEH's document/window distance priority is a finite value. It only matters when the *same* event hub registers both a document/window listener and an element listener for the same event type at a depth beyond that value; ordinary root-only YaiTabs registration does not hit that condition. If such mixed registrations become a supported use case, add a targeted regression before changing its distance semantics.
