# YaiTabs - Advanced Usage

Advanced patterns, real-world examples, and architectural deep-dives for YaiTabs.

## Table of Contents

- [Automatic Event Tunneling](#automatic-event-tunneling) ⚡ NEW
- [Keyboard Navigation API](#keyboard-navigation-api) 🎹 NEW
- [Swipe/Drag Navigation](#swipedrag-navigation) 🎯 NEW
- [Single-Tab Applications](#single-tab-applications)
- [Event Hub Patterns](#event-hub-patterns)
- [Analytics Integration](#analytics-integration)
- [Dynamic Content Management](#dynamic-content-management)
- [Breadcrumb Navigation](#breadcrumb-navigation)
- [State Management](#state-management)
- [Performance Optimization](#performance-optimization)

---

## CDN

```html
<!-- Default styles (required) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.1/tabs/yai-tabs.css">

<!-- Required: YEH Event Handler (peer dependency) -->
<script src="https://cdn.jsdelivr.net/npm/@yaijs/yeh@1/yeh.js"></script>

<!-- YaiJS Bundle: yai-core.js + yai-tabs.js + yai-viewport.js (exposes window.YaiJS) -->
<script type="module" src="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.1/dist/yai-bundle.js"></script>
```

**Usage:**
```js
const { YaiCore, YaiTabs, YaiViewport } = window.YaiJS;
```

---

## Automatic Event Tunneling

**⚡ The Revolutionary Feature:** YaiCore automatically generates event handlers for **ANY** event type you configure. Zero boilerplate required!

### How It Works

When you add an event to `setListener`, YaiCore's `_generateMethodHandlers()` method automatically:

1. Creates a handler function for that event type
2. Extracts `event`, `target`, `container` from arguments
3. Reads `action` from `data-[eventType]` attribute
4. **Tunnels directly to the hook system** via `_executeHook()`
5. Only the root component (data-nesting="0") will get this listeners initially
  - Just to make sure: No element within a root components gets registered.
  - Nested and dynamic content will be handled by the roots listeners.
  - If you remove elements, fine. Removing from Markup is all you need to do.
  - Adding dynamic elements work the same. Just add any and they work.

**Result:** Infinite event extensibility with zero configuration!

```js
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': [
                // Only 3 default events required by YaiTabs:
                'click',           // ✅ Default (required for tab switching)
                'keydown',         // ✅ Default (required for keyboard navigation)
                'hashchange',      // ✅ Default (required for hash routing)

                // All other events are auto-generated with hooks!
                'input',           // ✨ Auto-generated hook: eventInput
                'change',          // ✨ Auto-generated hook: eventChange
                'submit',          // ✨ Auto-generated hook: eventSubmit
                'focus',           // ✨ Auto-generated hook: eventFocus
                'blur',            // ✨ Auto-generated hook: eventBlur
                'mouseover',       // ✨ Auto-generated hook: eventMouseover
                'mouseout',        // ✨ Auto-generated hook: eventMouseout
                'mousedown',       // ✨ Auto-generated hook: eventMousedown
                'mousemove',       // ✨ Auto-generated hook: eventMousemove
                'mouseup',         // ✨ Auto-generated hook: eventMouseup
                'touchstart',      // ✨ Auto-generated hook: eventTouchstart
                'touchmove',       // ✨ Auto-generated hook: eventTouchmove
                'touchend',        // ✨ Auto-generated hook: eventTouchend
                'dragstart',       // ✨ Auto-generated hook: eventDragstart
                'drop',            // ✨ Auto-generated hook: eventDrop
                'scroll',          // ✨ Auto-generated hook: eventScroll
                'resize',          // ✨ Auto-generated hook: eventResize
                'myCustomEvent'    // ✨ Auto-generated hook: eventMyCustomEvent
            ]
        }
    }
});

// Hooks are automatically available for ALL events!
tabs.hook('eventFocus', ({ event, target, container, action, context }) => {
    // action is extracted from data-focus attribute
    if (action === 'highlight') highlightField(target);
    if (action === 'clearErrors') clearFieldErrors(target);
});

tabs.hook('eventBlur', ({ event, target, container, action, context }) => {
    if (action === 'validate') validateField(target);
    if (action === 'save') autoSaveField(target);
});

tabs.hook('eventMouseover', ({ event, target, container, action, context }) => {
    if (action === 'preview') showPreview(target);
    if (action === 'tooltip') showTooltip(target);
});

tabs.hook('eventDragstart', ({ event, target, container, action, context }) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', target.dataset.id);
});

tabs.hook('eventDrop', ({ event, target, container, action, context }) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (action === 'uploadArea') handleFileUpload(id, target);
});
```

### Hook Naming Convention

Hook names follow a simple pattern: `"event" + capitalize(eventType)`

- `'click'` → `tabs.hook('eventClick', ...)`
- `'keydown'` → `tabs.hook('eventKeydown', ...)`
- `'mouseover'` → `tabs.hook('eventMouseover', ...)`
- `'touchstart'` → `tabs.hook('eventTouchstart', ...)`
- `'myCustomEvent'` → `tabs.hook('eventMyCustomEvent', ...)`

**All hooks receive the same signature:**
```javascript
tabs.hook('eventName', ({ event, target, container, action, context }) => {
    // event: The native DOM event
    // target: The element that triggered the event
    // container: The [data-yai-tabs] container (for scoping)
    // action: Extracted from data-[eventType] attribute
    // context: The YaiTabs instance (access to openTab(), etc.)
});
```

### Action Attributes

Actions are extracted from `data-[eventType]` attributes on your HTML elements:

```html
<!-- Focus/Blur actions -->
<input
    data-focus="highlight"
    data-blur="validate"
    placeholder="Email">

<!-- Mouse actions -->
<div
    data-mouseover="preview"
    data-mouseout="hidePreview"
    data-click="openModal">
    Hover me
</div>

<!-- Drag and drop -->
<div
    data-dragstart="itemDrag"
    draggable="true"
    data-id="123">
    Drag me
</div>

<div
    data-drop="uploadArea"
    data-dragover="highlight">
    Drop here
</div>

<!-- Custom events -->
<button data-mycustomevent="specialAction">Custom</button>
```

### Why This Is Revolutionary

**Before (traditional approach):**
```js
// Manual event binding for each interaction
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);
});

document.querySelectorAll('.draggable').forEach(el => {
    el.addEventListener('dragstart', handleDragStart);
});

// Result: N event listeners (grows with DOM size)
```

**After (YaiTabs automatic tunneling):**
```js
// Add event types to config once
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': ['focus', 'blur', 'dragstart', 'drop']
        }
    }
});

// Hooks automatically available
tabs.hook('eventFocus', handleFocus);
tabs.hook('eventBlur', handleBlur);
tabs.hook('eventDragstart', handleDragStart);

// Result: 4 event listeners TOTAL (O(1) scaling)
```

**Benefits:**
- ✅ **O(1) Scaling:** Number of listeners doesn't grow with DOM size
- ✅ **Zero Boilerplate:** No manual handler registration
- ✅ **Dynamic Content:** Works automatically with newly added elements
- ✅ **Infinite Extensibility:** Add any event type instantly
- ✅ **Action-Based:** Semantic `data-*` attributes for clarity

---

## Keyboard Navigation API

Build powerful keyboard shortcuts using automatic event tunneling. Press **1-9** to instantly switch between tabs - works at **every nesting level**!

### Implementation

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                'keydown'  // ✨ Auto-tunnels to eventKeydown hook!
            ]
        }
    }
});

// Keyboard shortcuts: Press 1-9 to switch tabs
tabs.hook('eventKeydown', ({ event, target, container, action, context }) => {
    if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(event.key)) {
        const searchTarget = container.querySelectorAll(`[data-open]`);
        const index = parseInt(event.key, 10) - 1;

        if (searchTarget[index]) {
            const getTargetTab = searchTarget[index];
            if (getTargetTab && !getTargetTab.classList.contains('active')) {
                // Direct API call - no click simulation needed!
                context.openTab(getTargetTab, event, container);
                requestAnimationFrame(() => { context.yaiFocus(getTargetTab) });
            }
        }
    }
});
```

### How It Works

1. **Container Scoping:** Each `container` only sees its own tabs via `querySelectorAll('[data-open]')`
2. **Number Key Mapping:** Keys 1-9 map to array indices 0-8
3. **Direct API Access:** Uses `context.openTab()` to bypass click events entirely
4. **Smart Focus:** `requestAnimationFrame()` ensures focus happens after tab activation
5. **Multi-Level Support:** Works in nested tabs because each container is independent!

### HTML Setup

No special markup needed - just add `keydown` to your events:

```html
<div data-yai-tabs>
    <button data-open="tab1">Tab 1</button>
    <button data-open="tab2">Tab 2</button>
    <button data-open="tab3">Tab 3</button>

    <div data-tab="tab1">
        <!-- Press 1-3 at this level to switch parent tabs -->

        <div data-yai-tabs>
            <button data-open="nested1">Nested 1</button>
            <button data-open="nested2">Nested 2</button>

            <div data-tab="nested1">
                <!-- Press 1-2 here to switch nested tabs! -->
            </div>
        </div>
    </div>
</div>
```

### Advanced: Custom Key Bindings

Extend to support arrow keys, Ctrl+Tab, or custom shortcuts:

##### DEV_ToDo: The keys necessary for correct ARIA are preserved and can't be used

```js
// YaiTabs:516-587 - This keys are preserved for YaiTabs, all other will be tunneled and shared shared.
if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    if (this.config.callable?.eventKeydown) {
        this._executeHook('eventKeydown', { event, target, container, action, context });
    }
    return;
}
```

- Using 1-9 to open tabs using they key as index.
- Theme switcher with 4 extra lines
- The switcher:
  - Click in focused components `d` for `dark` or `l` for `light`
  - To change the cheme for active tab buttons, use `p`, `w`, `s` or `f` (sets `['primary'|'warning'|'success'|'funky'] `it's just a demo)

```javascript
tabs.hook('eventKeydown', ({ event, target, container, action, context }) => {
    // Skip if a form input element is focused
    const activeElement = document.activeElement;
    const formInputs = ['INPUT', 'TEXTAREA', 'SELECT'];
    if (activeElement && formInputs.includes(activeElement.tagName)) {
        return;
    }
    const key = event.key;

    // Number keys 1-9 for tab navigation
    if (key >= '1' && key <= '9') {
        const tab = container.querySelector(`[data-open="${key}"]`);
        tab && context.openTab(tab, event, container);
    }

    // Letter keys for theme toggles
    const themes = { d: 'dark', l: 'light' };
    const accents = { p: 'primary', w: 'warning', s: 'success', f: 'funky' };

    if (themes[key]) container.dataset.colorScheme = themes[key];
    if (accents[key]) container.dataset.colorAccent = accents[key];
})
```

### Why This Is Powerful

- 🎹 **Under 20 lines** for complete keyboard navigation
- 🪆 **Multi-level support** - works in all nested tabs independently
- ⚡ **Zero global state** - container scoping handles everything
- 🎯 **Direct API access** - uses `openTab()` instead of click simulation
- 🔌 **Framework agnostic** - just JavaScript and the hook system

**[See it in action →](https://yaijs.github.io/yai/tabs/Example.html)** *(Press 1-9 to switch tabs!)*

---

## Swipe/Drag Navigation

Add mobile-first swipe gestures and desktop drag navigation to your tabs. Works perfectly at **every nesting level** with automatic container scoping!

### Features

- 📱 **Touch support** - swipe left/right on mobile devices
- 🖱️ **Mouse support** - drag left/right on desktop
- 🎨 **Visual feedback** - live `translateX()` during interaction
- 🪆 **Multi-level nesting** - each tab container independently swipeable
- ⚡ **Smart thresholds** - customizable distance detection
- 🎯 **Container scoped** - no global state conflicts

### Implementation

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                'keydown',
                // Mouse events for desktop drag
                'mousemove',
                'mousedown',
                { type: 'mouseup', debounce: 1 },
                // Touch events for mobile swipe
                { type: 'touchstart', debounce: 1 },
                { type: 'touchmove', debounce: 1 },
                { type: 'touchend', debounce: 1 }
            ]
        }
    }
});

// Shared state for drag/swipe tracking
const slideState = {
    threshold: 80,      // Desktop threshold (px)
    isDragging: false,
    startX: 0,
    currentX: 0,
    startTime: 0
};

// Helper: Get tabs container from any element
const getTabsContainer = (target) => target.closest('[data-yai-tabs]');

// Helper: Get active panel or closest panel
const getTabsPanel = (target) =>
    target.querySelector(':scope > [data-tab].active') || target.closest('[data-tab]');

// Helper: Switch to relative tab (previous/next)
const switchToRelativeTab = (container, offset) => {
    const tabs = Array.from(container.querySelectorAll('[data-open]'));
    const currentIndex = tabs.findIndex(tab => tab.classList.contains('active'));
    const targetIndex = currentIndex + offset;

    if (targetIndex >= 0 && targetIndex < tabs.length) {
        const targetTab = tabs[targetIndex];
        if (targetTab && !targetTab.classList.contains('active')) {
            targetTab.click();
            return true;
        }
    }
    return false;
};

// Desktop: Mouse drag handlers
tabs.hook('eventMousedown', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel) return;

    slideState.isDragging = true;
    slideState.startX = event.clientX;
    slideState.currentX = event.clientX;
    slideState.startTime = Date.now();
    panel.classList.add('dragging');
});

tabs.hook('eventMousemove', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel || !slideState.isDragging) return;

    slideState.currentX = event.clientX;
    const deltaX = slideState.currentX - slideState.startX;
    // Visual feedback with damping
    panel.style.transform = `translateX(${deltaX * 0.5}px)`;
});

tabs.hook('eventMouseup', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel || !slideState.isDragging) return;

    const deltaX = slideState.currentX - slideState.startX;
    const absDistance = Math.abs(deltaX);

    // Reset visual state
    panel.classList.remove('dragging');
    panel.style.transform = '';

    // Switch tab if threshold exceeded
    if (absDistance > slideState.threshold) {
        const container = getTabsContainer(panel);
        if (container) {
            switchToRelativeTab(container, deltaX < 0 ? 1 : -1);
        }
    }

    slideState.isDragging = false;
});

// Mobile: Touch swipe handlers
tabs.hook('eventTouchstart', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel) return;

    slideState.isDragging = true;
    slideState.startX = event.touches[0].clientX;
    slideState.currentX = event.touches[0].clientX;
    slideState.startTime = Date.now();
    panel.classList.add('dragging');
});

tabs.hook('eventTouchmove', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel || !slideState.isDragging) return;

    slideState.currentX = event.touches[0].clientX;
    const deltaX = slideState.currentX - slideState.startX;
    panel.style.transform = `translateX(${deltaX * 0.5}px)`;
});

tabs.hook('eventTouchend', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel || !slideState.isDragging) return;

    const deltaX = slideState.currentX - slideState.startX;
    const absDistance = Math.abs(deltaX);

    panel.classList.remove('dragging');
    panel.style.transform = '';

    // Lower threshold for touch (30px vs 80px)
    if (absDistance > 30) {
        const container = getTabsContainer(target);
        if (container) {
            switchToRelativeTab(container, deltaX < 0 ? 1 : -1);
        }
    }

    slideState.isDragging = false;
});
```

### CSS for Visual Feedback

Add smooth transitions and dragging states:

```css
/* Smooth tab transitions */
[data-tab] {
    transition: transform 0.3s ease-out;
}

/* Disable transitions during drag */
[data-tab].dragging {
    transition: none;
    cursor: grabbing;
}

/* Optional: Add momentum effect */
[data-tab]:not(.dragging) {
    transform: translateX(0) !important;
}
```

### HTML Setup

```html
<div data-yai-tabs>
    <nav data-controller>
        <button data-open="tab1">Tab 1</button>
        <button data-open="tab2">Tab 2</button>
        <button data-open="tab3">Tab 3</button>
    </nav>

    <div data-content>
        <div data-tab="tab1">
            Swipe right to go to Tab 2 →
        </div>
        <div data-tab="tab2">
            ← Swipe left to Tab 1 | Swipe right to Tab 3 →

            <!-- Nested tabs - independently swipeable! -->
            <div data-yai-tabs>
                <nav data-controller>
                    <button data-open="nested1">Nested 1</button>
                    <button data-open="nested2">Nested 2</button>
                </nav>
                <div data-content>
                    <div data-tab="nested1">Swipe within this nested container!</div>
                    <div data-tab="nested2">Each level is independent!</div>
                </div>
            </div>
        </div>
        <div data-tab="tab3">
            ← Swipe left to go to Tab 2
        </div>
    </div>
</div>
```

### How It Works

1. **Event Detection**
   - Desktop: `mousedown` → `mousemove` → `mouseup`
   - Mobile: `touchstart` → `touchmove` → `touchend`

2. **Container Scoping**
   - `getTabsPanel()` finds the active panel or closest panel
   - `getTabsContainer()` finds the parent tabs container
   - Each nesting level operates independently!

3. **Visual Feedback**
   - During drag: `transform: translateX()` with 0.5x damping
   - After release: smooth transition back to position
   - CSS `.dragging` class for custom styling

4. **Smart Threshold**
   - Desktop: 80px movement required (larger for mouse precision)
   - Mobile: 30px movement required (smaller for touch sensitivity)
   - Direction detection: negative deltaX = swipe left (next), positive = swipe right (previous)

5. **Multi-Level Support**
   - Single `slideState` object works for all levels
   - Container scoping isolates each level automatically
   - Can swipe parent tabs, then immediately swipe nested tabs!

### Advanced: Velocity-Based Switching

Add velocity detection for flick gestures:

```javascript
tabs.hook('eventMouseup', ({ event, target }) => {
    const panel = getTabsPanel(target);
    if (!panel || !slideState.isDragging) return;

    const deltaX = slideState.currentX - slideState.startX;
    const deltaTime = Date.now() - slideState.startTime;
    const velocity = Math.abs(deltaX) / deltaTime; // px per ms

    panel.classList.remove('dragging');
    panel.style.transform = '';

    // Switch on distance OR velocity (flick gesture)
    const shouldSwitch =
        Math.abs(deltaX) > slideState.threshold ||
        velocity > 0.5; // Fast flick

    if (shouldSwitch) {
        const container = getTabsContainer(panel);
        if (container) {
            switchToRelativeTab(container, deltaX < 0 ? 1 : -1);
        }
    }

    slideState.isDragging = false;
});
```

### Why This Is Powerful

- 🎯 **~100 lines** for complete swipe/drag navigation
- 📱 **Mobile-first** - works on touch devices out of the box
- 🖱️ **Desktop support** - mouse drag works identically
- 🪆 **Perfect nesting** - each level independently swipeable
- 🎨 **Visual feedback** - live transform during interaction
- ⚡ **Zero dependencies** - no Hammer.js, no Swiper.js needed
- 🔌 **Framework agnostic** - pure YaiJS hooks

**Replace 50KB libraries with 100 lines of code!** 🚀

---

## Single-Tab Applications

Build complete SPAs within a single tab component using event delegation:

```html
<div data-yai-tabs class="app-shell">
    <div data-tab="main">
        <header class="app-header">
            <input type="text" data-action="globalSearch" placeholder="Search...">
        </header>

        <aside class="sidebar">
            <button data-action="loadDashboard">Dashboard</button>
            <button data-action="loadUsers">Users</button>
            <button data-action="loadSettings">Settings</button>
        </aside>

        <main class="content" id="app-content">
            <!-- Dynamic content area -->
        </main>
    </div>
</div>

<script>
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                { type: 'input', debounce: 500 },
                'change',
                'submit',
                'blur',
                'focus'
            ]
        },
        actionableAttributes: ['data-tab-action', 'data-action']
    }
});

// Global search with debouncing
tabs.hook('eventInput', ({ target }) => {
    if (target.matches('[data-action="globalSearch"]')) {
        performGlobalSearch(target.value);
    }
});

// Navigation routing
tabs.hook('eventClick', ({ target }) => {
    const action = target.dataset.action;

    if (action === 'loadDashboard') {
        loadView('dashboard');
    } else if (action === 'loadUsers') {
        loadView('users');
    } else if (action === 'loadSettings') {
        loadView('settings');
    }
});

// Dynamic view loader
async function loadView(viewName) {
    const contentArea = document.getElementById('app-content');
    contentArea.innerHTML = '<div class="loader">Loading...</div>';

    try {
        const response = await fetch(`/views/${viewName}.html`);
        const html = await response.text();
        contentArea.innerHTML = html;

        // Initialize any nested YaiTabs components
        if (html.includes('data-yai-tabs')) {
            tabs.initializeAllContainers(contentArea);
        }
    } catch (error) {
        contentArea.innerHTML = '<p class="error">Failed to load view</p>';
    }
}
</script>
```

---

## Event Hub Patterns

**Super Subscriber**

Monitor all events for debugging, analytics, or logging:

```js
class TabsMonitor {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.eventLog = [];
        this.superSubscribe();
    }

    /**
     * Subscribe to all emitable events
     */
    superSubscribe() {
        const events = this.tabs.config.emitable;

        for (const key in events) {
            this.tabs.on(
                `${this.tabs.config.dispatchName}.${key}`,
                this.handleEvent.bind(this, key)
            );
        }
    }

    handleEvent(eventType, event) {
        const logEntry = {
            type: eventType,
            timestamp: Date.now(),
            detail: event.detail
        };

        this.eventLog.push(logEntry);
        console.log(`[${eventType}]`, event.detail);

        // Send to analytics
        if (this.shouldTrack(eventType)) {
            this.trackEvent(logEntry);
        }
    }

    shouldTrack(eventType) {
        const trackableEvents = ['tabReady', 'tabSwitched', 'contentLoaded'];
        return trackableEvents.includes(eventType);
    }

    trackEvent(logEntry) {
        // Your analytics implementation
        analytics.track(logEntry.type, logEntry.detail);
    }

    getEventHistory(eventType = null) {
        if (eventType) {
            return this.eventLog.filter(e => e.type === eventType);
        }
        return this.eventLog;
    }
}

// Usage
const tabs = new YaiTabs();
const monitor = new TabsMonitor(tabs);

// Later: analyze event history
console.log(monitor.getEventHistory('tabReady'));
```

### Action Dispatcher Pattern

Centralized action handling with middleware support:

```js
class TabsActionDispatcher {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.actions = new Map();
        this.middleware = [];
        this.setupHooks();
    }

    registerAction(actionName, handler) {
        this.actions.set(actionName, handler);
    }

    use(middlewareFn) {
        this.middleware.push(middlewareFn);
    }

    setupHooks() {
        this.tabs.hook('eventClick', ({ event, target, container }) => {
            const action = target.dataset.action;
            if (action) {
                this.dispatch(action, { event, target, container });
            }
        });
    }

    async dispatch(actionName, context) {
        // Run middleware
        for (const mw of this.middleware) {
            const result = await mw(actionName, context);
            if (result === false) return; // Abort
        }

        // Execute action
        const handler = this.actions.get(actionName);
        if (handler) {
            await handler(context);
        } else {
            console.warn(`No handler for action: ${actionName}`);
        }
    }
}

// Usage
const tabs = new YaiTabs();
const dispatcher = new TabsActionDispatcher(tabs);

// Register middleware
dispatcher.use(async (action, context) => {
    console.log(`Executing action: ${action}`);
    // Add authentication check, logging, etc.
    return true; // Continue
});

// Register actions
dispatcher.registerAction('loadDashboard', async ({ container }) => {
    await loadDashboardData(container);
});

dispatcher.registerAction('saveForm', async ({ target, event }) => {
    event.preventDefault();
    const form = target.closest('form');
    await submitFormData(new FormData(form));
});
```

---

## Analytics Integration

### Tab Navigation Tracking

```js
const tabs = new YaiTabs();

// Track tab views
tabs.on('yai.tabs.tabReady', (event) => {
    const { id, refPath, isVisible, isDefaultInit } = event.detail;

    // Only track user-initiated tab changes
    if (!isDefaultInit && isVisible) {
        analytics.track('Tab Viewed', {
            tabId: id,
            refPath: refPath,
            timestamp: Date.now(),
            userAgent: navigator.userAgent
        });
    }
});

// Track tab switches (user navigated away)
tabs.on('yai.tabs.tabSwitched', (event) => {
    analytics.track('Tab Switched', {
        from: event.detail.previousTab,
        to: event.detail.currentTab,
        container: event.detail.container.id
    });
});

// Track dynamic content loads
tabs.on('yai.tabs.contentLoaded', (event) => {
    analytics.track('Dynamic Content Loaded', {
        url: event.detail.url,
        duration: event.detail.loadTime,
        success: event.detail.success
    });
});
```

### Performance Monitoring

```js
tabs.hook('setLoading', ({ container, target }) => {
    target.dataset.loadStart = Date.now();
});

tabs.hook('removeLoading', ({ container, target }) => {
    const loadTime = Date.now() - parseInt(target.dataset.loadStart);
    delete target.dataset.loadStart;

    // Track performance
    analytics.track('Tab Load Performance', {
        tabId: target.dataset.open,
        duration: loadTime,
        slow: loadTime > 1000
    });

    // Alert if slow
    if (loadTime > 2000) {
        console.warn(`Slow tab load: ${loadTime}ms`);
    }
});
```

---

## Dynamic Content Management

### Smart Content Loader with Caching

```js
class SmartContentLoader {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.cache = new Map();
        this.setupHooks();
    }

    setupHooks() {
        this.tabs.hook('setLoading', ({ container, target }) => {
            this.showLoader(container, target);
        });

        this.tabs.hook('removeLoading', ({ container, target }) => {
            this.hideLoader(container, target);
        });

        this.tabs.hook('contentReady', ({ content, target, url }) => {
            if (url) {
                this.cacheContent(url, content.innerHTML);
            }
        });
    }

    showLoader(container, target) {
        target.classList.add('loading');
        target.setAttribute('aria-busy', 'true');

        // Show skeleton loader
        const loader = document.createElement('div');
        loader.className = 'skeleton-loader';
        loader.innerHTML = `
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        `;

        container.appendChild(loader);
    }

    hideLoader(container, target) {
        target.classList.remove('loading');
        target.removeAttribute('aria-busy');

        const loader = container.querySelector('.skeleton-loader');
        if (loader) loader.remove();
    }

    cacheContent(url, html) {
        this.cache.set(url, {
            html,
            timestamp: Date.now()
        });

        // Expire cache after 5 minutes
        setTimeout(() => this.cache.delete(url), 5 * 60 * 1000);
    }

    getCachedContent(url) {
        return this.cache.get(url)?.html;
    }
}

// Usage
const tabs = new YaiTabs();
const loader = new SmartContentLoader(tabs);
```

---

## Breadcrumb Navigation

Generate dynamic breadcrumbs based on active tab hierarchy:

```js
class TabBreadcrumbs {
    constructor(tabsInstance, breadcrumbContainer) {
        this.tabs = tabsInstance;
        this.container = breadcrumbContainer;
        this.setupListeners();
    }

    setupListeners() {
        this.tabs.on('yai.tabs.tabReady', () => {
            this.update();
        });
    }

    update() {
        const crumbs = this.buildCrumbs();
        this.render(crumbs);
    }

    buildCrumbs() {
        const crumbs = [];
        const activeContainers = document.querySelectorAll('[data-yai-tabs].tab-active');

        activeContainers.forEach(container => {
            const refPath = container.dataset.refPath;
            const activeButton = container.querySelector('nav [data-open].active');

            if (refPath && activeButton) {
                crumbs.push({
                    label: activeButton.textContent.trim(),
                    refPath: refPath,
                    tabId: activeButton.dataset.open,
                    url: this.generateUrl(refPath, activeButton.dataset.open)
                });
            }
        });

        return crumbs;
    }

    generateUrl(refPath, tabId) {
        return YaiTabs.reconstructUrlFromRef(refPath, tabId);
    }

    render(crumbs) {
        this.container.innerHTML = crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return `
                <span class="breadcrumb-item ${isLast ? 'active' : ''}">
                    ${isLast ? crumb.label : `<a href="${crumb.url}">${crumb.label}</a>`}
                </span>
                ${!isLast ? '<span class="separator">/</span>' : ''}
            `;
        }).join('');
    }
}

// Usage
const tabs = new YaiTabs();
const breadcrumbs = new TabBreadcrumbs(tabs, document.getElementById('breadcrumbs'));
```

---

## State Management

### URL State Synchronization

```js
class TabStateManager {
    constructor(tabsInstance) {
        this.tabs = tabsInstance;
        this.state = this.parseState();
        this.setupListeners();
    }

    parseState() {
        const hash = this.tabs.parseHash();
        return {
            tabs: hash,
            filters: this.parseFilters(),
            search: new URLSearchParams(window.location.search).get('q') || ''
        };
    }

    parseFilters() {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const filters = {};

        for (const [key, value] of params) {
            if (key.startsWith('filter_')) {
                filters[key.replace('filter_', '')] = value;
            }
        }

        return filters;
    }

    setupListeners() {
        // Sync state when tabs change
        this.tabs.on('yai.tabs.tabReady', () => {
            this.syncState();
        });

        // Sync filters
        this.tabs.hook('eventChange', ({ target }) => {
            if (target.matches('[data-filter]')) {
                this.updateFilter(target.name, target.value);
            }
        });

        // Sync search
        this.tabs.hook('eventInput', ({ target }) => {
            if (target.matches('[data-search]')) {
                this.updateSearch(target.value);
            }
        });
    }

    syncState() {
        this.state.tabs = this.tabs.parseHash();
        this.saveState();
    }

    updateFilter(name, value) {
        this.state.filters[name] = value;
        this.saveState();
    }

    updateSearch(query) {
        this.state.search = query;
        this.saveState();
    }

    saveState() {
        // Build hash from state
        const params = new URLSearchParams();

        // Add tab parameters
        for (const [refPath, tabId] of Object.entries(this.state.tabs)) {
            params.set(refPath, tabId);
        }

        // Add filter parameters
        for (const [name, value] of Object.entries(this.state.filters)) {
            params.set(`filter_${name}`, value);
        }

        // Update URL
        window.history.replaceState(null, '', `#${params.toString()}`);

        // Update search separately
        if (this.state.search) {
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.set('q', this.state.search);
            window.history.replaceState(null, '', `?${searchParams.toString()}#${params.toString()}`);
        }
    }

    restoreState() {
        // Restore filters
        for (const [name, value] of Object.entries(this.state.filters)) {
            const input = document.querySelector(`[data-filter][name="${name}"]`);
            if (input) input.value = value;
        }

        // Restore search
        if (this.state.search) {
            const searchInput = document.querySelector('[data-search]');
            if (searchInput) searchInput.value = this.state.search;
        }
    }
}

// Usage
const tabs = new YaiTabs();
const stateManager = new TabStateManager(tabs);
stateManager.restoreState();
```

---

## Performance Optimization

### Lazy Image Loading

```js
tabs.hook('contentReady', ({ content }) => {
    const images = content.querySelectorAll('img[data-src]');

    images.forEach(img => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });

        observer.observe(img);
    });
});
```

### Progressive Enhancement

```js
// Detect slow connections
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const isSlow = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

const tabs = new YaiTabs({
    defaultBehavior: isSlow ? 'instant' : 'fade', // Disable animations on slow connections
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                'keydown',
                { type: 'input', debounce: isSlow ? 1000 : 500 } // Longer debounce on slow connections
            ]
        }
    }
});

// Prefetch on hover for fast connections
if (!isSlow) {
    tabs.hook('eventMouseenter', ({ target }) => {
        if (target.matches('[data-url]') && !target.dataset.prefetched) {
            fetch(target.dataset.url);
            target.dataset.prefetched = 'true';
        }
    });
}
```

---

## See Also

- [Example.html](https://yaijs.github.io/yai/tabs/Example.html) — Live interactive demo
- [YaiJS README.md](https://github.com/yaijs/yai) - Main documentation
- [YaiTabs README.md](https://github.com/yaijs/yai/tabs) - Source code and components
- [YEH README.md](https://github.com/yaijs/yeh) - Event delegation foundation
- [NPM @yaijs/core](https://www.npmjs.com/package/@yaijs/core) - Package installation
- [NPM @yaijs/yeh](https://www.npmjs.com/package/@yaijs/yeh) - Event handler package
