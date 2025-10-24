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
- **EventListener Orchestration:** 52% fewer listeners via selective registration
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
- ✅ **Touch/Swipe Navigation** - Mobile-first swipe gestures with YaiTabsSwype utility
- ✅ **Dynamic Content Loading** - Fetch remote content via `data-url` with abort controllers
- ✅ **Container Isolation** - Unique IDs prevent cross-contamination
- ✅ **Infinite Nesting** - Dynamically loaded nested components instantly become swipable

**[View YaiTabs Documentation →](./tabs/README.md)**

**[View YaiTabsSwype Documentation →](./utils/README.md)**

**[Try Live Demo →](https://yaijs.github.io/yai/tabs/Example.html)** (43 components with recursive AJAX loading)

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

**Per-Container Configuration**

Override global settings on individual containers using data attributes:

```html
<!-- This container allows closable tabs, even if global config says false -->
<div data-yai-tabs data-closable="true">
    <nav data-controller>
        <button data-tab-action="open" data-open="1">Tab 1</button>
        <button data-tab-action="close" data-close="1">×</button>
    </nav>
    <div data-content>
        <div data-tab="1">Content...</div>
    </div>
</div>

<!-- This container disables closable tabs, even if global config says true -->
<div data-yai-tabs data-closable="false">
    <!-- Tabs in this container cannot be closed -->
</div>
```

**Available Data Attributes:**
- `data-closable="true|false"` - Override closable setting per container

## YaiTabsSwype - Touch/Swipe Navigation

**🎯 Mobile-first swipe gestures with advanced boundary behaviors**

YaiTabsSwype adds fluid touch/swipe navigation to YaiTabs with support for infinite nesting and intelligent boundary handling.

### Key Features

- ✅ **2D Swipe Support** - Horizontal and vertical navigation with axis locking
- ✅ **Semantic Directions** - Human-readable left/right/up/down detection
- ✅ **Auto-Axis Detection** - Automatically detect swipe direction from `aria-orientation`
- ✅ **Boundary Behaviors** - Circular navigation, auto-descend into nested tabs, auto-ascend to parent
- ✅ **Infinite Nesting** - Works flawlessly with recursive AJAX-loaded content
- ✅ **Haptic Feedback** - Adaptive haptic feedback for mobile devices
- ✅ **Data-Attribute Config** - Per-container swipe configuration

### Quick Start

```javascript
import YaiTabs from './yai/tabs/yai-tabs.js';
import YaiTabsSwype from './yai/utils/yai-tabs-swype.js';

// Initialize tabs with swipe events
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': ['click', 'keydown'],
            '[data-mousedown]': [
                { type: 'mousedown', debounce: 1 },
                { type: 'mousemove', debounce: 1 },
                { type: 'mouseup', debounce: 1 },
                { type: 'touchstart', debounce: 1 },
                { type: 'touchmove', debounce: 1 },
                { type: 'touchend', debounce: 1 }
            ]
        }
    }
});

// Initialize swype with advanced features
const swype = new YaiTabsSwype({
    axis: 'auto',  // Auto-detect from aria-orientation
    boundaryBehavior: {
        circular: true,            // Loop from last to first tab
        descendIntoNested: true,   // Auto-open nested tabs at boundary
        ascendFromNested: true,    // Switch parent tab when nested boundary reached
        transitionDelay: 100       // Delay before switching (shows parent chain)
    },
    hapticFeedback: 'adaptive',    // Haptic feedback on mobile
    orientationAware: true         // Show orientation hints
})
    .setInstance(tabs)
    .watchHooks();

// Global mouse watch for boundary cleanup
tabs.hook('globalMouseWatch', ({ event, target }) => {
    if (swype.isDragging()) {
        swype.resetDraggingState();
    }
});
```

### Data-Attribute Configuration

Configure swipe behavior per container:

```html
<div data-yai-tabs
     data-mousedown="slyde"
     data-swype-axis="horizontal"
     data-swype-circular="true"
     data-swype-descend="true"
     data-swype-ascend="true"
     data-swype-threshold-mobile="40"
     data-swype-threshold-desktop="40">
    <!-- Tabs with custom swipe config -->
</div>
```

### Boundary Behaviors

**Circular Navigation:**
```
A → B → C → D → E → (loops back to) A
```

**Descend into Nested:**
```
Root:  A  B  C  D  [E]  ← Swiping right at E
                    ↓
Nested:             F  G  H  I  ← Opens F automatically
```

**Ascend from Nested:**
```
Root:  A  B  [C]  D  E  ← Switches to C when nested boundary reached
           ↑
Nested:    F  G  H  [I]  ← Swiping right at I (last nested tab)
```

**Combined with Dynamic Content Loading:**
- Use `data-url` on any tab button to load nested components via AJAX
- Dynamically loaded content becomes **instantly swipable** via hooks
- Example: `mega-tree-full.html` loads a massive nested tree into any tab
- Recursive ascension through all parent levels (static or dynamic)
- Parent chain visibility before switching
- Configurable transition delay for smooth UX

**Example Flow:**
1. Static page has 43 components
2. Swipe through tabs until you reach one with `data-url="dynamic/mega-tree-full.html"`
3. Click loads massive nested tree via AJAX
4. New nested components are **instantly swipable** (no re-initialization needed)
5. Swipe through infinite levels seamlessly

**[View Full YaiTabsSwype Documentation →](./utils/README.md)**

## Event Bus System

**🎯 YaiTabs is more than tabs - it's a complete application event bus!**

### Automatic Event Tunneling

YaiCore automatically generates event handlers for **ANY** event type you add. No boilerplate required!

```js
const tabs = new YaiTabs({
    events: {
        setListener: {
            window: [
                { type: 'hashchange', debounce: 500 } // ✅ Built-in (required)
            ],
            '[data-yai-tabs]': [
                'click',           // ✅ Built-in (required)
                'keydown',         // ✅ Built-in (required)
                'input',           // ✨ Auto-generated!
                'change',          // ✨ Auto-generated!
                'submit',          // ✨ Auto-generated!
                'focus',           // ✨ Auto-generated!
                'mouseover',       // ✨ Auto-generated!
                'myCustomEvent'    // ✨ Auto-generated!
            ]
        }
    }
});

// Hooks are automatically available for ALL events!
tabs.hook('eventFocus', ({ event, target, container, action, context }) => {
    console.log('Focus event:', target);
});

tabs.hook('eventMouseover', ({ event, target, container, action, context }) => {
    // action is extracted from data-mouseover attribute
    if (action === 'preview') showPreview(target);
});

tabs.hook('eventMyCustomEvent', ({ event, target, container, action, context }) => {
    // Your custom event logic here
});
```

**How it works:**
1. Add any event to `setListener`
2. YaiCore automatically creates `event[EventType]` hook
3. Hook receives: `{event, target, container, action, context}`
4. Action is extracted from `data-[eventType]` attribute

### Multiple Hooks Support

**🎯 NEW: Register multiple callbacks for the same event!**

YEH's hook system uses array-based callback storage, allowing you to attach multiple handlers to any hook:

```javascript
// Register multiple handlers for the same hook
tabs
    .hook('tabOpened', (ctx) => {
        console.log('First handler - Analytics');
        trackPageView(ctx.target);
    })
    .hook('tabOpened', (ctx) => {
        console.log('Second handler - UI Updates');
        updateActiveState(ctx.target);
    })
    .hook('tabOpened', (ctx) => {
        console.log('Third handler - Lazy Loading');
        loadDynamicContent(ctx.target);
    });

// All three callbacks execute in registration order!
```

**Helper methods:**
- `tabs.unhook('tabOpened', callback)` - Remove specific callback
- `tabs.clearHooks('tabOpened')` - Clear all callbacks for hook

**Zero boilerplate. Infinite extensibility.** 🚀

### Building Single-Page Applications

Use one YaiTabs container as your entire app shell:

```html
<div data-yai-tabs class="app-shell full-size">
  <div data-tab="main">
    <aside class="sidebar">
      <button data-click="loadDashboard">Dashboard</button>
      <button data-click="loadUsers">Users</button>
      <input data-input="globalSearch" placeholder="Search...">
    </aside>
    <main id="app-content"></main>
  </div>
</div>

<script type="module">
const { YaiTabs } = window.YaiJS;

const tabs = new YaiTabs({
    events: {
        setListener: {
            window: [
                { type: 'hashchange', debounce: 500 }
            ],
            '[data-yai-tabs]': [
                'click',
                'keydown',
                { type: 'input', debounce: 400 }
            ]
        },
        actionableAttributes: [
            'data-tab-action',
            'data-click',
            'data-input',
        ],
    }
});

// All interactions use 4 listeners for entire app
tabs.hook('eventClick', ({ event, target, container, action, context }) => {
    // action is automatically extracted from data-click attribute
    if (action === 'loadDashboard') loadView('dashboard');
    if (action === 'loadUsers') loadView('users');
});

tabs.hook('eventInput', ({ event, target, container, action, context }) => {
    // action is automatically extracted from data-input attribute
    if (action === 'globalSearch') {
        performSearch(target.value);
    }
});

async function loadView(name) {
    const area = document.getElementById('app-content');
    const html = await (await fetch(`/views/${name}.html`)).text();
    area.innerHTML = html;
    // Re-init if dynamic content contains nested tabs
    tabs.initializeAllContainers(area);
}
</script>
```

**Result:** Complete SPA with:
- ✅ 4 event listeners total (not 4 per element!)
- ✅ Automatic debouncing
- ✅ Dynamic content support
- ✅ Zero framework overhead

### Advanced Patterns

**Analytics Integration:**
```js
tabs.on('yai.tabs.tabReady', ({ detail }) => {
    if (!detail.isDefaultInit && detail.isVisible) {
        analytics.track('Tab Viewed', { id: detail.id });
    }
});
```

**Action Dispatcher Pattern:**
```js
const actions = new Map([
    ['save', async ({ target }) => await saveForm(target.form)],
    ['delete', async ({ target }) => await deleteItem(target.dataset.id)],
    ['refresh', async () => await refreshData()]
]);

tabs.hook('eventClick', async ({ event, target, container, action, context }) => {
    const handler = actions.get(action);
    if (handler) await handler({ event, target, container, context });
});
```

**Progressive Enhancement:**
```js
const conn = navigator.connection;
const slow = conn && /(2g|slow-2g)/.test(conn.effectiveType);

const tabs = new YaiTabs({
    defaultBehavior: slow ? 'instant' : 'fade',
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                { type: 'input', debounce: slow ? 1000 : 400 }
            ]
        }
    }
});
```

**[View Advanced Examples →](./tabs/ADVANCED.md)**

---

## 🎼 EventListener Orchestration

**YaiJS uses EventListener Orchestration** - intelligent coordination of event listeners across your application for optimal performance.

### The Concept

Like a symphony orchestra where different instruments play at different times, YaiJS registers event listeners **only where needed**:

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            // Core events - all tabs (essential melody)
            '[data-yai-tabs]': ['click', 'keydown'],

            // Swipe events - only swipeable tabs (optional harmony)
            '[data-swipe]': [
                'mousedown', 'mousemove', 'mouseup',
                'touchstart', 'touchmove', 'touchend'
            ]
        }
    }
});
```

### Performance Results

**Real-world benchmark:** 43 nested tab components with infinite recursive AJAX loading

| Approach | Elements | Listeners | Reduction |
|----------|----------|-----------|-----------|
| Without orchestration | 43 | 352+ | baseline |
| **With orchestration** | **10** | **35** | **🎯 90%** |

**Current Setup** (includes body: 3, window: 6 listeners):
- 📊 Total Elements with Listeners: **10**
- 🔥 Total Event Listeners Found: **35**
- 📈 Average Listeners per Element: **3.50**

**Result:** 317+ fewer event listeners while supporting infinite nesting and dynamic content loading!

### How It Works

**Traditional approach** (all events everywhere):
```javascript
// Every tab container gets every event
'[data-yai-tabs]': [
    'click', 'keydown',
    'change', 'input', 'submit',
    'mousedown', 'mousemove', 'mouseup',
    'touchstart', 'touchmove', 'touchend'
]
// Result: 352 listeners across 32 elements 😰
```

**Orchestrated approach** (selective registration):
```javascript
// Essential events for all tabs
'[data-yai-tabs]': ['click', 'keydown'],

// Form events only where needed
'[data-yai-forms]': ['change', 'input', 'submit'],

// Swipe events only where needed
'.yai-tabs-swype[data-mousedown]': [
    'mousedown', 'mousemove', 'mouseup',
    'touchstart', 'touchmove', 'touchend'
]
// Result: 32 listeners across 8 elements 🎉
// That's 91% fewer listeners!
```

A console script (Chromium based browser only) to get a list with all elements that has listeners assigned to them including stats.

```js
// 🔍 Enhanced Real-World Listener Scanner with Counter
let totalListeners = 0;
const elementsWithListeners = [];

[window, document, ...document.querySelectorAll('*')].filter(el => {
    const listeners = getEventListeners(el);
    return listeners && Object.keys(listeners).length > 0;
}).forEach((el, i) => {
    const elementName = el === window
        ? 'window'
        : el === document ? 'document' : el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ').join('.') : '');

    const listeners = getEventListeners(el);

    // Count total listeners for this element
    let elementListenerCount = 0;
    Object.values(listeners).forEach(eventArray => {
        elementListenerCount += eventArray.length;
    });
    totalListeners += elementListenerCount;

    // Enhanced display format
    console.log(`${i + 1}. ${elementName}:`);
    Object.entries(listeners).forEach(([eventType, eventArray]) => {
        console.log(`  - ${eventType}: ${eventArray.length}`);
    });
    console.log(`  Total: ${elementListenerCount} listeners`);
    console.log('  Raw data:', listeners);
    console.log(''); // Empty line for readability

    elementsWithListeners.push({elementName, count: elementListenerCount, listeners});
});

// Final summary
console.log(`🎯 SCAN COMPLETE:`);
console.log(`📊 Total Elements with Listeners: ${elementsWithListeners.length}`);
console.log(`🔥 Total Event Listeners Found: ${totalListeners}`);
console.log(`📈 Average Listeners per Element: ${(totalListeners / elementsWithListeners.length).toFixed(2)}`);

// Top listener hotspots
const sorted = elementsWithListeners.sort((a, b) => b.count - a.count).slice(0, 5);
console.log(`🥇 Top 5 Listener Hotspots:`);
sorted.forEach((item, i) => {
    console.log(`${i + 1}. ${item.elementName}: ${item.count} listeners`);
});
```

### Benefits

- 🎯 **Selective Registration** - Events only where needed
- ⚡ **Better Performance** - Fewer listeners = faster event handling
- 💾 **Reduced Memory** - Less overhead per component
- 🎼 **Clear Intent** - Markup shows which features are active
- 🔌 **Progressive Enhancement** - Add features incrementally

### Usage Example

```html
<!-- Basic tab (click + keydown only) -->
<div data-yai-tabs>
    <nav data-controller>
        <button data-open="tab1">Tab 1</button>
    </nav>
    <div data-content>
        <div data-tab="tab1">Basic content</div>
    </div>
</div>

<!-- Swipeable tab (adds mouse/touch events) -->
<div data-yai-tabs data-swipe>
    <nav data-controller>
        <button data-open="tab1">Tab 1</button>
        <button data-open="tab2">Tab 2</button>
    </nav>
    <div data-content>
        <div data-tab="tab1">Swipe to tab 2 →</div>
        <div data-tab="tab2">← Swipe to tab 1</div>
    </div>
</div>
```

**Each selector acts like a different instrument in the orchestra - playing only when needed for the perfect performance!** 🎭

---

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
import { YaiCore, YaiTabs, YaiViewport, YaiAutoSwitch } from '@yaijs/core';

// Import specific components
import { YaiTabs } from '@yaijs/core/tabs';
import { YaiViewport } from '@yaijs/core/viewport';
import { YaiAutoSwitch } from '@yaijs/core/autoswitch';

// Import YEH foundation separately
import YEH from '@yaijs/yeh';
```


## YaiJS Utilities

Powerful standalone utilities that enhance YaiTabs:

- **[YaiTabsSwype](./utils/README.md#yaitabsswype)** - Touch/swipe navigation with boundary behaviors
- **[YaiAutoSwitch](./utils/README.md#yaiautoswitch-testing-utility)** - Automated tab switching for demos and testing
- **[YaiViewport](./utils/README.md#yaiviewport--advanced-viewport-tracking-observer-free)** - Observer-free viewport tracking

**[View Full Utils Documentation →](./utils/README.md)**


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


### Tested succesfully in

- **macOS**
  - Safari 15.6 (MacBook 2015)
- **Android**
  - Chrome 106
- **Ubuntu (24.04)**
  - Chrome 141
  - Brave 1.83
  - Opera 122
  - Firefox 143


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
│   ├── yai-auto-switch.js   // Component testing utility (~250 LOC)
│   ├── yai-auto-switch.d.ts // YaiAutoSwitch TypeScript definitions
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
