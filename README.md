# 🎯 YaiJS Component Library

**Advanced VanillaJS web components built on YEH (YpsilonEventHandler) - the world's first DOM Event Scoping System**

YaiJS delivers enterprise-grade UI components with mathematical O(1) scaling performance. Each component uses a single event listener per container with perfect isolation, enabling infinite nesting without listener proliferation.

[![NPM version](https://img.shields.io/npm/v/@yaijs/core.svg)](https://npmjs.org/package/@yaijs/core)
[![License](https://img.shields.io/npm/l/@yaijs/core.svg)](https://github.com/yaijs/core/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-QuantumType-blueviolet)](https://github.com/yaijs/yai/blob/main/yai-core.d.ts)

## Framework Overview

**Built on YEH (YpsilonEventHandler) Foundation**
- **O(1) Performance:** Single listener per container regardless of complexity
- **Perfect Isolation:** Container-scoped event handling using `:scope >` selectors
- **Zero Memory Leaks:** Automatic cleanup with no listener proliferation
- **Framework Agnostic:** Works with React, Vue, Angular, or Vanilla JS
- **Pure ES6 Modules:** No build pipeline required

**Key Innovation:** Mathematical elegance meets developer experience - enterprise functionality with minimal code.

### Event Delegation Hierarchy

For YaiTabs:
```
• YaiTabs (Root)           → 2 event listeners
  ├─ YaiTabs (nested)      → 0 listeners (inherits)
  │  ├─ YaiTabs (level 3)  → 0 listeners (inherits)
  │  └─ Dynamic YaiTabs    → 0 listeners (inherits)
  └─ YaiTabs (sibling)     → 0 listeners (inherits)
```

## YaiTabs Component

**Complete tabs implementation with advanced features:**
- ✅ **9 Animation Behaviors** - 8 smooth effects (fade, slide-up, zoom, flip, swing, spiral, slice, blur, glitch, warp, elastic) + instant
- ✅ **4 Navigation Positions** - Top, left, right, bottom placement
- ✅ **WCAG 2.1 AA Compliance** - Full ARIA implementation with screen reader support
- ✅ **Keyboard Navigation** - Arrow keys, Home/End, Enter/Space support
- ✅ **Dynamic Content Loading** - Fetch remote content with abort controllers
- ✅ **Container Isolation** - Unique IDs prevent cross-contamination

**[View YaiTabs Documentation →](./tabs/README.md)**

**[Try Live Demo →](https://yaijs.github.io/yai/tabs/Example.html)**

**Quick Start via CDN**

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.1/tabs/yai-tabs.css">
</head>
<body>
    <div data-yai-tabs>
        <nav data-controller>
            <button data-tab-action="open" data-open="1">Tab A</button>
        </nav>
        <div data-content>
            <div data-tab="1">Content A…</div>
        </div>
    </div>

    <!-- Load YEH (required peer dependency) -->
    <script src="https://cdn.jsdelivr.net/npm/@yaijs/yeh@1/yeh.js"></script>

    <!-- Load YaiJS bundle (exposes window.YaiJS) -->
    <script type="module" src="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.1/dist/yai-bundle.js"></script>

    <script type="module">
        // Access components from window.YaiJS
        const { YaiTabs } = window.YaiJS;

        // Initialize with custom config
        const tabs = new YaiTabs({
            defaultBehavior: 'fade',
            autoFocus: true,
            closable: true
        });
    </script>
</body>
</html>
```

## Installation

**NPM Installation (Recommended)**

```bash
npm install @yaijs/yeh @yaijs/core
```

**Individual Components**
```html
<!-- YEH Foundation -->
<script src="https://unpkg.com/@yaijs/yeh@1.0.2/yeh.js"></script>

<!-- Individual Components -->
<script src="https://unpkg.com/@yaijs/core@1.0.0-beta.1/yai-core.js"></script>
<script src="https://unpkg.com/@yaijs/core@1.0.0-beta.1/tabs/yai-tabs.js"></script>
<link rel="stylesheet" href="https://unpkg.com/@yaijs/core@1.0.0-beta.1/tabs/yai-tabs.css">
```

**ES6 Module Import (Modern Development)**

```js
// Import everything
import { YaiCore, YaiTabs, YaiViewport, AutoSwitch } from '@yaijs/core';

// Import specific components
import { YaiTabs } from '@yaijs/core/tabs';
import { YaiViewport } from '@yaijs/core/viewport';
import { AutoSwitch } from '@yaijs/core/autoswitch';

// Import YEH foundation separately
import YEH from '@yaijs/yeh';
```


## YaiJS Utilities

Shared utils.


### AutoSwitch Testing Utility

**Automated component demonstration and testing tool:**

**Component demonstration and validation tool:**
- Automated cycling through interactive elements
- Configurable timing and behavior patterns
- Event-driven architecture with lifecycle hooks
- Emergency abort functionality for testing control
- ~250 lines of testing automation code

#### ES Module

```html
<!-- YEH class, included once, re-used everywhere -->
<script src="https://cdn.jsdelivr.net/npm/@yaijs/yeh@latest/yeh.min.js"></script>
```

```js
import { AutoSwitch } from '@yaijs/core/autoswitch';

// Quick demo setup
const tester = new AutoSwitch({
    target: '#tabs-component',            // Container element selector
    triggerSelector: 'button[data-open]', // Elements to cycle through
    initialTimeout: 1000,                 // Delay before starting (ms)
    timeout: 800,                         // Delay between clicks (ms)
    callbacks: {
        cycleInit: (instance) => console.log('Demo starting...'),
        afterLast: (instance) => console.log('Demo complete!')
    }
});

// Start automated cycling
tester.cycle();

// Stop when needed
tester.stopDemo();

// Or emergency abort
tester.abort();
```

**Chainable Configuration:**
```js
// Fluent API for easy setup
new AutoSwitch()
    .setContainer('#my-component', 'button[role="tab"]')
    .setConfig('timeout', 1200)
    .on('cycleInit', (instance) => instance.container.classList.add('demo-active'))
    .on('afterLast', (instance) => instance.container.classList.remove('demo-active'))
    .cycle();
```

**Key Features:**
- ✅ Automated Element Cycling - Sequentially clicks through interactive elements
- ✅ Smart Container Detection - Filters nested components to avoid conflicts
- ✅ Loading State Awareness - Waits for content loading between interactions
- ✅ Lifecycle Event Hooks - Full callback system for custom behavior
- ✅ Emergency Abort Control - Immediate stop with timeout cleanup
- ✅ Chainable Configuration - Fluent API for easy setup
- ✅ Disabled Element Skipping - Automatically skips non-interactive elements

**Perfect For:**
- Component demos and presentations
- Animation testing and validation
- Automated behavior verification
- Interactive documentation examples

The AutoSwitch utility makes component testing and demonstration effortless with ~250 lines of focused automation code.


---


### YaiViewport — Advanced Viewport Tracking (Observer-free)

YaiViewport is a lightweight, IntersectionObserver-free viewport tracker that runs on the YEH event layer. It tags elements with visibility classes/attributes and emits rich lifecycle hooks for scroll-driven UIs (sticky headers, staged animations, lazy reveals, analytics). It’s designed as a practical alternate to browser observers—particularly useful when you want total control over thresholds, directionality, and hook timing.

**Key Features**
- ✅ Element Visibility Tracking - Track when elements enter/leave viewport
- ✅ Observer-free: Works everywhere without relying on IntersectionObserver.
- ✅ Direction-aware states: visible → leaving(top|bottom) → left(top|bottom) transitions.
- ✅ Declarative styling: Automatic classes and data-* attributes for CSS-only effects.
- ✅ Page-level flags: pageTop, pageEnd, pageScrolled with thresholds.
- ✅ Hook system: Subscribe to page and element lifecycle events with hook(name, fn).
- ✅ YEH integration: Throttled load/resize/scroll/scrollend handling via a single container listener.

[Live Demo on JSFiddle](https://jsfiddle.net/w6je4ck1/)

#### ES Module

```html
<!-- YEH class, included once, re-used everywhere -->
<script src="https://cdn.jsdelivr.net/npm/@yaijs/yeh@latest/yeh.min.js"></script>
```

```js
import YaiViewport from '@yaijs/core/viewport';
// import YaiViewport from 'https://yaijs.github.io/yai/utils/yai-viewport.js';

const viewport = new YaiViewport({
  // optional throttles (ms)
  throttle: { resize: 500, scroll: 250, scrollend: 250 },

  // merge-on-top configuration
  set: {
    selector: {
      // set to null to disable any marker
      pageTop: 'yvp-is-page-top',
      pageEnd: 'yvp-is-page-end',
      pageScrolled: 'yvp-is-scrolled',
      trackDistance: 'data-yvp-position',
      isVisibleAttr: 'data-yvp-is-visible',
      isVisibleClass: 'yvp-is-visible',
      hasBeenVisibleClass: 'yvp-was-visible',
      isLeavingClass: 'yvp-is-leaving',
      isLeavingTopClass: 'yvp-is-leaving-top',
      isLeavingBottomClass: 'yvp-is-leaving-bottom',
      hasLeftClass: 'yvp-has-left',
      hasLeftTopClass: 'yvp-has-left-top',
      hasLeftBottomClass: 'yvp-has-left-bottom',
    }
  },
  threshold: {
    pageTop: 0,
    pageEnd: 50,
    pageScrolled: 0,
    elementVisible: 0,
    elementHidden: 0,
    elementLeaving: 0,
    elementLeft: 0,
    // direction-specific overrides (pixels); null → use global
    elementVisibleTop: null,
    elementVisibleBottom: null,
    elementLeavingTop: null,
    elementLeavingBottom: null,
    elementLeftTop: null,
    elementLeftBottom: null,
  }
});
```
(YEH is a required peer—YaiViewport extends YEH.)

#### Quick Start

```html
<section class="feature" id="hero"></section>
<section class="feature" id="stats"></section>
<section class="feature" id="cta"></section>

<script type="module">
  import YaiViewport from '@yaijs/core/viewport';
  // import YaiViewport from 'https://yaijs.github.io/yai/utils/yai-viewport.js';

  const yvp = new YaiViewport();

  // Track by selector or nodes/arrays
  yvp.track('.feature');

  // React to visibility transitions
  yvp
    .hook('elementVisible', ({ element }) => element.classList.add('fade-in'))
    .hook('elementLeavingTop', ({ element }) => element.classList.add('slide-out-up'))
    .hook('elementLeavingBottom', ({ element }) => element.classList.add('slide-out-down'));
</script>
```

All tracked elements get `data-yvp-is-visible="true|false"` and `yvp-is-visible` while visible; once an element has ever been visible, it receives `yvp-was-visible`. The body is toggled with `yvp-is-page-top`, `yvp-is-page-end`, and `yvp-is-scrolled` based on thresholds.

#### CSS Markers (defaults)

- Body classes:
  - `yvp-is-page-top`, `yvp-is-page-end`, `yvp-is-scrolled`
- Element attribute:
  - `data-yvp-is-visible="true|false"`
- Element classes:
  - `yvp-is-visible`, `yvp-was-visible`
  - `yvp-is-leaving`, `yvp-is-leaving-top`, `yvp-is-leaving-bottom`
  - `yvp-has-left`, `yvp-has-left-top`, `yvp-has-left-bottom`

Distance probe (optional): `data-yvp-position` (rounded px from viewport top).
Set any of these to null in `set.selector` to disable them.

#### Lifecycle Hooks

Register with `viewport.hook(name, fn);` each `fn(context, scrollDirection, instance)` receives:

context: `{ event?, element?, rect?, state?, direction?, scrollY?, viewport?, ... }`
scrollDirection: 'up' | 'down'
instance: the `YaiViewport` instance

**Page hooks**
`pageTop`, `pageEnd`, `pageScrolled`, `afterLoad`, `afterResize`, `afterScroll`

**Element hooks**
`elementVisible`, `elementHidden`, `elementVisibleCheck`,
`elementLeaving`, `elementLeavingTop`, `elementLeavingBottom`,
`elementLeft`, `elementLeftTop`, `elementLeftBottom`

```js
viewport
  .hook('pageEnd',        ({ scrollY }) => console.log('Near bottom @', scrollY))
  .hook('elementVisible', ({ element }) => element.classList.add('in-view'))
  .hook('elementLeftTop', ({ element }) => element.classList.add('left-above'));
```

#### Public API
- `track(elements)`: Track a CSS selector, a single element, or an array/NodeList. Chainable.
- `hook(name, fn)`: Register a lifecycle callback. Chainable.
- `refresh()`: Recompute positions & states (use after DOM mutations). Chainable.
- `destroy()`: Cleanup internal maps and detach YEH listeners.
- Read-only props: `scrollDirection`, `isScrollingUp`, `isScrollingDown`.

#### Thresholds Explained
- Thresholds are pixel buffers that shift the effective viewport edges:
- Visible if: `rect.top < vh + visibleBottom` and `rect.bottom > 0 - visibleTop`
  - `Leaving(top)` when `rect.bottom + leavingTop <= 0`
  - `Leaving(bottom)` when `rect.top - leavingBottom >= vh`
  - `Left(top/bottom)` uses the same form with elementLeft* thresholds.
- Provide *Top/*Bottom for direction-specific control; otherwise the global value is used.

#### Performance Notes
- YEH attaches throttled scroll/resize handlers; tweak throttle for your UX.
- For maximal throughput on heavy pages, consider disabling trackDistance and keep CSS work minimal in hooks.
- If you have many tracked nodes, prefer batching DOM writes in hooks (e.g., toggle a single container class).

#### Browser Notes on YaiViewport
- `scrollend`: If your target browsers lack native `scrollend`, YEH may polyfill/simulate it (or you can rely solely on afterScroll).
- Works in modern ES module environments (same as other Yai components). See supported browsers in the main README.


---


## Browser Compatibility

YaiJS and all components are written in standards-compliant ES6. Modern browsers with ES6 module support are required.

**Supported Browsers:**
- Chrome 61+ (ES6 modules)
- Firefox 60+ (ES6 modules)
- Safari 11+ (ES6 modules)
- Edge 16+ (ES6 modules)

**Legacy Support:**
For older browsers, use any build tool (Webpack, Vite, etc.) with polyfills targeting your required browser support matrix.

## Repository Structure

```
yai/                         // Published at github.com/yaijs/Yai
├── tabs/                    // Complete tabs component
│   ├── yai-tabs.js          // Main component (~1300 LOC)
│   ├── yai-tabs.css         // Styling with 9 animation behaviors
│   ├── yai-tabs.d.ts        // TypeScript definitions
│   ├── Example.html         // Interactive demo
│   ├── README.md            // Component documentation
│   └── dynamic/             // Dynamic content examples
├── utils/
│   ├── auto-switch.js       // Component testing utility (~250 LOC)
│   ├── auto-switch.d.ts     // AutoSwitch TypeScript definitions
│   ├── yai-viewport.js      // Viewport util
│   └── yai-viewport.d.ts    // Viewport util TypeScript definitions
├── yai-core.js              // Shared base class (~700 LOC)
├── yai-core.d.ts            // Core TypeScript definitions
└── README.md                // Yai documentation
```

## Component Architecture

**YaiCore Foundation**
- High-performance DOM element caching with statistics
- Event handler factory with YpsilonEventHandler integration
- Shared utilities (debounce, throttle, deepMerge, etc.)
- Hook system for lifecycle management
- Accessibility utilities and unique ID generation

**Development Philosophy**
> "Mathematical Elegance Meets Developer Experience" - Each component proves that enterprise-grade functionality can be achieved with minimal code through revolutionary O(1) event handling architecture.
