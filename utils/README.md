# YaiJS Utilities

Standalone utilities that enhance YaiTabs with advanced features.

## Table of Contents

- [YaiTabsSwipe](#YaiTabsSwipe) - Touch/swipe navigation with boundary behaviors
- [YaiAutoSwitch Testing Utility](#yaiautoswitch-testing-utility) - Automated tab switching for demos
- [YaiViewport — Advanced Viewport Tracking](#yaiviewport--advanced-viewport-tracking-observer-free) - Observer-free viewport tracking

---

## YaiTabsSwipe

Swipe/drag navigation utility for YaiTabs that provides mobile-first touch gestures and desktop drag navigation. Works seamlessly at every nesting level with automatic container scoping.

### Features

- **2D Swipe Support**: Horizontal and vertical swipe navigation
- **Axis Auto-Detection**: Automatically detect swipe direction from `aria-orientation`
- **Semantic Directions**: Human-readable direction detection (left/right/up/down)
- **Axis Locking**: Prevents accidental diagonal swipes
- **Boundary Behaviors**: Circular navigation, nested component navigation
- **Visual Feedback**: Real-time drag feedback with transform
- **Configurable Thresholds**: Separate thresholds for mobile and desktop
- **Lifecycle Hooks**: Full control over swipe events

### Installation

```javascript
import YaiTabs from './yai/tabs/yai-tabs.js';
import YaiTabsSwipe from './yai/utils/yai-tabs-swipe.js';

// Initialize tabs with swipe events
const tabs = new YaiTabs({
    events: {
        setListener: {
            '.yai-tabs-swipe[data-mousedown]': [
                { type: 'mousedown', debounce: 1 },
                { type: 'mousemove', debounce: 1 },
                { type: 'mouseup', debounce: 1 },
                { type: 'touchstart', debounce: 1 },
                { type: 'touchmove', debounce: 1 },
                { type: 'touchend', debounce: 1 },
            ]
        }
    }
});

// Initialize swipe utility
const swipe = new YaiTabsSwipe()
    .setInstance(tabs)
    .watchHooks();
```

### Configuration

```javascript
const swipe = new YaiTabsSwipe({
    // Swipe distance thresholds
    threshold: {
        mobile: 30,   // Pixels for touch devices
        desktop: 40,  // Pixels for mouse devices
    },

    // Allowed swipe directions
    // Options: 'horizontal', 'vertical', 'both', 'auto'
    // 'auto' detects from aria-orientation attribute
    axis: 'auto',

    // Minimum movement to determine axis lock
    // Prevents accidental diagonal swipes
    axisLockThreshold: 10,

    // Reverse swipe direction mapping
    // false (default): swipe left/up = next, swipe right/down = prev
    // true: swipe left/up = prev, swipe right/down = next
    reverseDirection: false,

    // Boundary behavior when reaching first/last tab
    boundaryBehavior: {
        // Loop from last to first tab and vice versa
        circular: false,

        // Auto-open first tab of nested component when reaching boundary
        // Example: Swiping right on tab E opens nested tab F
        descendIntoNested: false,

        // Auto-switch to parent's next tab when reaching nested boundary
        // Example: Swiping right on nested tab T switches to parent's next tab
        ascendFromNested: false,
    }
});
```

### Boundary Behaviors

The boundary behaviors create intuitive navigation patterns for deeply nested tab structures.

### Example Structure

```
Root Level:   A B C D E
Nested in E:          F G H I
Nested in I:                J K L M N O
Nested in O:                          P Q R S T
```

### Circular Navigation

When enabled, reaching the last tab loops back to the first tab, and vice versa.

```javascript
boundaryBehavior: {
    circular: true
}
```

**Behavior:**
- Swiping right on tab **T** → loops to tab **A**
- Swiping left on tab **A** → loops to tab **T**

### Descend Into Nested

When enabled, reaching the last tab automatically opens the first tab of any nested component.

```javascript
boundaryBehavior: {
    descendIntoNested: true
}
```

**Behavior:**
- Swiping right on tab **E** → opens nested tab **F**
- Swiping right on tab **I** → opens nested tab **J**
- Swiping right on tab **O** → opens nested tab **P**

### Ascend From Nested

When enabled, reaching a boundary in a nested component switches to the parent's next/prev tab. This behavior **cascades recursively** - if the parent is also at a boundary, it will try the parent's parent, and so on, until reaching the root level.

```javascript
boundaryBehavior: {
    ascendFromNested: true
}
```

**Behavior:**
- Swiping right on nested tab **T** (at boundary) → switches parent **O** to next tab
- If parent **O** is also at boundary → tries grandparent's next tab
- Continues ascending until a tab switch succeeds or root is reached

### Combined Behaviors

You can enable multiple boundary behaviors simultaneously:

```javascript
boundaryBehavior: {
    circular: true,
    descendIntoNested: true,
    ascendFromNested: true
}
```

This creates fluid navigation with intelligent fallback:

**Priority order:**
1. **Ascend** (if in nested component) - tries to switch parent tab, recursively ascends if parent also at boundary
2. **Circular** (at current or reached level) - loops within the level where ascension stopped
3. **Descend** (going forward only) - opens first nested tab if available

**Example:** Swiping right on tab **T** (deepest level, last tab):
1. Tries parent **O**'s next tab → none available
2. Ascends to parent **I**'s next tab → none available
3. Ascends to parent **E**'s next tab → none available
4. Ascends to root level next tab → none available
5. Circular kicks in at root → loops to tab **A**

This ensures you can always navigate out of deeply nested structures!

### Axis Auto-Detection

The `axis: 'auto'` option automatically detects swipe direction from the `aria-orientation` attribute on your tab navigation.

```html
<!-- Horizontal swipe (left/right) -->
<nav data-controller="tabs" aria-orientation="horizontal">
    <button data-open="tab1">Tab 1</button>
    <button data-open="tab2">Tab 2</button>
</nav>

<!-- Vertical swipe (up/down) -->
<nav data-controller="tabs" aria-orientation="vertical">
    <button data-open="tab1">Tab 1</button>
    <button data-open="tab2">Tab 2</button>
</nav>
```

**Benefits:**
- Per-container axis configuration
- Respects existing accessibility markup
- No need to manually configure axis for each container

### Lifecycle Hooks

Control swipe behavior with lifecycle hooks:

```javascript
swipe
    .hook('swipeStart', ({ panel, moveType, startX, startY }) => {
        console.log('Swipe started:', moveType);
    })
    .hook('swipeMove', ({ panel, deltaX, deltaY, semanticDirection }) => {
        console.log('Swiping:', semanticDirection);
    })
    .hook('beforeSwitch', ({ direction, semanticDirection }) => {
        console.log('About to switch:', direction);
        // Return false to cancel the switch
    })
    .hook('afterSwitch', ({ switched, direction }) => {
        console.log('Switch completed:', switched);
    })
    .hook('swipeEnd', ({ absDistance, threshold, switched }) => {
        console.log('Swipe ended:', { absDistance, threshold, switched });
    })
    .hook('dragCancelled', ({ reason }) => {
        console.log('Drag cancelled:', reason);
    });
```

### Hook Context

Each hook receives detailed context information:

- **swipeStart**: `{ panel, moveType, startX, startY, event, target }`
- **swipeMove**: `{ panel, moveType, deltaX, deltaY, semanticDirection, currentX, currentY, event, target }`
- **beforeSwitch**: `{ panel, container, deltaX, deltaY, semanticDirection, moveType, direction, event, target }`
- **afterSwitch**: `{ panel, container, deltaX, deltaY, semanticDirection, moveType, direction, switched, event, target }`
- **swipeEnd**: `{ panel, moveType, deltaX, deltaY, semanticDirection, absDistance, threshold, switched, event, target }`
- **dragCancelled**: `{ reason, draggedElements }`

### Global Mouse Watch

Connect to YaiTabs' `globalMouseWatch` hook to reset dragging state when the mouse leaves the component:

```javascript
tabs.hook('globalMouseWatch', ({ event, target }) => {
    if (swipe.isDragging()) {
        swipe.resetDraggingState();
    }
});
```

### Methods

### `.setInstance(tabs)`

Attach the swipe utility to a YaiTabs instance.

```javascript
swipe.setInstance(tabs);
```

### `.watchHooks()`

Activate swipe navigation by attaching event listeners.

```javascript
swipe.watchHooks();
```

### `.hook(hookName, callback)`

Register a lifecycle callback hook.

```javascript
swipe.hook('afterSwitch', ({ switched }) => {
    console.log('Tab switched:', switched);
});
```

### `.isDragging()`

Check if a drag/swipe is currently in progress.

```javascript
if (swipe.isDragging()) {
    console.log('Currently dragging');
}
```

### `.resetDraggingState()`

Reset all dragging state and clean up DOM.

```javascript
swipe.resetDraggingState();
```

### Complete Example

```javascript
import YaiTabs from './yai/tabs/yai-tabs.js';
import YaiTabsSwipe from './yai/utils/yai-tabs-swipe.js';

const YaiDevice = YaiCore.getUserPreferences();

// Initialize tabs
const tabs = new YaiTabs({
    events: {
        setListener: {
            // For swyping tabs
            // Add a global mouse watch for boundary cleanup
            'body': YaiDevice.hasTouch ? [
                { type: 'touchend',    handler: 'globalMouseWatch', debounce: 20 },
                { type: 'touchcancel', handler: 'globalMouseWatch', debounce: 20 }
            ] : [
                { type: 'mouseup', handler: 'globalMouseWatch', debounce: 50 }
            ],

            // These are reqired for Tabs
            '[data-yai-tabs]': ['click', 'keydown'],

            // For swypable tabs:
            // Select components only once, nesting components don't need listeners
            // YEH will set listeners passive automatically, if device supports it
            '.yai-tabs-swipe[data-mousedown]': YaiDevice.hasTouch
                ? ['touchstart', 'touchmove', 'touchend'] // Touch devices
                : ['mousedown',  'mousemove', 'mouseup'], // Mouse devices
        }
    }
});

// Initialize swipe with advanced features
const swipe = new YaiTabsSwipe({
    // How many pixel in any direction to count as swipe
    threshold: { mobile: 30, desktop: 40 },
    axis: 'auto',  // Auto-detect from aria-orientation
    reverseDirection: false,
    boundaryBehavior: {
        circular: true,           // Loop from last to first
        descendIntoNested: true,  // Auto-open nested tabs
        ascendFromNested: true,   // Switch parent tab at boundary
    }
})
    .setInstance(tabs)
    .hook('beforeSwitch', ({ direction, semanticDirection }) => {
        console.log(`Switching ${direction} (${semanticDirection})`);
    })
    .watchHooks();

// Global mouse watch for boundary cleanup
tabs.hook('globalMouseWatch', ({ event, target }) => {
    if (swipe.isDragging()) {
        swipe.resetDraggingState();
    }
});
```

---

## YaiAutoSwitch Testing Utility

**Automated component demonstration and testing tool:**
- Automated cycling through interactive elements
- Configurable timing and behavior patterns
- Event-driven architecture with lifecycle hooks
- Emergency abort functionality for testing control
- ~250 lines of testing automation code

#### ES Module

```html
<!-- YEH class (pure ESM), included once, re-used everywhere -->
<script type="module">
    import YEH from 'https://cdn.jsdelivr.net/npm/@yaijs/yeh@latest/yeh.js';
    window.YEH = YEH;
</script>
```

```js
import { YaiAutoSwitch } from '@yaijs/core/autoswitch';

// Quick demo setup
const tester = new YaiAutoSwitch({
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
new YaiAutoSwitch()
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

The YaiAutoSwitch utility makes component testing and demonstration effortless with ~250 lines of focused automation code.

---

## YaiViewport — Advanced Viewport Tracking (Observer-free)

YaiViewport is a lightweight, IntersectionObserver-free viewport tracker that runs on the YEH event layer. It tags elements with visibility classes/attributes and emits rich lifecycle hooks for scroll-driven UIs (sticky headers, staged animations, lazy reveals, analytics). It’s designed as a practical alternate to browser observers—particularly useful when you want total control over thresholds, directionality, and hook timing.

**Key Features**
- ✅ Element Visibility Tracking - Track when elements enter/leave viewport
- ✅ Observer-free: Works everywhere without relying on IntersectionObserver.
- ✅ Direction-aware states: visible → leaving(top|bottom) → left(top|bottom) transitions.
- ✅ Declarative styling: Automatic classes and data-* attributes for CSS-only effects.
- ✅ Page-level flags: pageTop, pageEnd, pageScrolled with thresholds.
- ✅ Hook system: Subscribe to page and element lifecycle events with hook(name, fn).
- ✅ YEH integration: Throttled load/resize/scroll/scrollend handling via a single container listener.

#### ES Module

```html
<!-- YEH class (pure ESM), included once, re-used everywhere -->
<script type="module">
    import YEH from 'https://cdn.jsdelivr.net/npm/@yaijs/yeh@latest/yeh.js';
    window.YEH = YEH;
</script>
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

[Live Demo on JSFiddle](https://jsfiddle.net/xyeon5ac/)

```html
<style>
.feature {
  margin: 1rem 0;
  padding: 2rem;
  border: 2px solid red;
  height: 880px;
  opacity: .3;
  transition: all .4s ease-in-out .5s;
}
.feature.yvp-is-visible {
  opacity: 1;
  border-color: rgb(25, 130, 25);
  background-color: rgba(98, 238, 98, 0.665);
}
</style>

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

### TypeScript Support

Full TypeScript definitions are included in `yai-tabs-swipe.d.ts`:

```typescript
import YaiTabsSwipe, { SwipeConfig, BoundaryBehavior } from './yai/utils/yai-tabs-swipe.js';

const config: SwipeConfig = {
    // How many pixel in any direction to count as swipe
    threshold: { mobile: 30, desktop: 40 },
    axis: 'auto',
    boundaryBehavior: {
        circular: true,
        descendIntoNested: true,
        ascendFromNested: false,
    }
};

const swipe = new YaiTabsSwipe(config);
```

### Performance

YaiTabsSwipe uses event delegation through YaiTabs' orchestration system for optimal performance:

- **O(1) scaling** - Performance doesn't degrade with nesting depth
- **Single listener per event type** - No listener proliferation
- **Debounced events** - Prevents excessive handler calls
- **Efficient DOM queries** - Uses `:scope` for container isolation

Even with 20+ nesting levels and 100+ tabs, swipe navigation remains smooth and responsive.

### Browser Support

- Modern browsers with ES6+ support
- Touch events for mobile devices
- Mouse events for desktop
- Pointer events support (future enhancement)

### License

MIT
