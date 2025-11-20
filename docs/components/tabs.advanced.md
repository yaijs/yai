# YaiTabs Advanced Usage

Advanced patterns and real-world examples for building sophisticated applications with YaiTabs.

---

## Table of Contents

- [SPA Architecture](#spa-architecture)
- [Event Hub Patterns](#event-hub-patterns)
- [State Management](#state-management)
- [Device Detection](#device-detection)
- [Advanced Configuration](#advanced-configuration)

---

## SPA Architecture

Build **complete single-page applications** using YaiTabs as your **router, state manager, and event hub** — no framework required.

### Complete SPA Example

[Live on JSFiddle](https://jsfiddle.net/50c34uyq/)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YAI SPA</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@latest/tabs/yai-tabs.css">
</head>
<body>
    <div
        data-yai-tabs
        data-theme="minimal"
        data-behavior="slide-left"
        data-ref-path="app">

        <!-- Global header (shares event listeners) -->
        <header data-tabs-header>
            <h1><a href="#app=home&section=1">My App</a></h1>
        </header>

        <!-- Main navigation -->
        <nav data-controller>
            <button data-tab-action="open" data-open="home" data-default>Home</button>
            <button data-tab-action="open" data-open="about">About</button>
            <button data-tab-action="open" data-open="settings">Settings</button>
        </nav>

        <!-- Main content (each tab is a "page") -->
        <div data-content>
            <!-- Home page -->
            <div data-tab="home">
                <h2>Welcome</h2>
                <p>Build complete SPAs with YaiTabs.</p>

                <!-- Nested tabs inherit parent's event listeners -->
                <div data-yai-tabs-lazy data-theme="minimal" data-ref-path="section">
                    <nav data-controller>
                        <button data-tab-action="open" data-open="1" data-default>Section A</button>
                        <button data-tab-action="open" data-open="2">Section B</button>
                    </nav>
                    <div data-content>
                        <div data-tab="1">
                            <p>Content A with multiple lines.</p>
                            <p class="ymb-0">This ensures proper content height.</p>
                        </div>
                        <div data-tab="2">
                            <p>Content B with multiple lines.</p>
                            <p class="ymb-0">This ensures proper content height.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- About page -->
            <div data-tab="about">
                <h2>About</h2>
                <p>This page demonstrates event hub capabilities.</p>
                <button data-click="showMetrics" class="yai-btn yai-btn-primary">Show Metrics</button>
            </div>

            <!-- Settings page -->
            <div data-tab="settings">
                <h2>Settings Form</h2>
                <p>Update your preferences below.</p>
                <form data-submit="saveSettings" class="yai-flex">
                    <input type="text" name="username" class="yai-input" data-input="validateUsername" placeholder="Username" autocomplete="username">
                    <button type="submit" class="yai-btn yai-btn-success">Save</button>
                </form>
            </div>
        </div>

        <!-- Global footer (shares event listeners) -->
        <footer data-tabs-footer>
            <button data-click="scrollToTop" class="yai-btn yai-btn-dark">↑ Top</button>
        </footer>
    </div>

    <script type="module">
        import { YaiTabs } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

        const tabs = new YaiTabs({
            events: {
                enableStats: true,
                setListener: {
                    '[data-yai-tabs]': ['click', 'input', 'submit'],
                    'window': [{ type: 'hashchange', debounce: 60 }],
                }
            }
        });

        // Handle all events via hooks
        tabs
            .hook('eventClick', ({ action }) => {
                if (action === 'scrollToTop') window.scrollTo({ top: 0, behavior: 'smooth' });
                if (action === 'showMetrics') console.log('Metrics:', tabs.events.getStats());
            })
            .hook('eventInput', ({ event, target, action }) => {
                if (action === 'validateUsername') {
                    console.log('Validating:', target.value);
                }
            })
            .hook('eventSubmit', ({ event, action }) => {
                if (action === 'saveSettings') {
                    event.preventDefault();
                    console.log('Settings saved');
                }
            });
    </script>
</body>
</html>
```

**Key Concepts:**
- Each tab acts as a separate page/route
- Hash-based routing via `data-ref-path` (URL: `#app=home`)
- Header/footer outside content area share same event listeners
- Nested tabs automatically inherit proper scope
- Single event system for entire application

**Theme Inheritance:**
- `data-color-scheme` and `data-color-accent` cascade to nested components
- `data-theme="minimal"` does NOT cascade - must be explicitly set on each nested component
- `data-theme="default"` cascades normally
- This allows mixing: minimal theme on main nav + default theme in nested tabs

---

## Event Hub Patterns

YaiTabs handles ANY event type with the same O(1) delegation.

### Multi-Event Configuration

**Important:** When using `setListener`, it completely overrides the default listeners. You must manually include required events like `hashchange` for hash routing and `click`/`keydown` for tab navigation.

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            // Different events on different selectors
            '[data-yai-tabs]': ['click', 'keydown'],  // Required for tab navigation
            '[data-yai-forms]': ['input', 'change', 'submit'],
            'window': [
                { type: 'hashchange', debounce: 60 },  // Required for hash routing
            ],
            'body': [
                { type: 'mouseup', handler: 'globalMouseWatch', debounce: 50 }
            ]
        },
        customAttributes: ['data-custom-action']  // Add to whitelist
    }
});
```

### Hook Chaining

Multiple hooks per event for separation of concerns:

```javascript
tabs
    .hook('tabOpened', ({ detail }) => {
        // Analytics tracking
        trackPageView(detail.id);
    })
    .hook('tabOpened', ({ detail }) => {
        // Update UI
        updateBreadcrumbs(detail.id);
    })
    .hook('tabOpened', ({ detail }) => {
        // Load data
        fetchTabContent(detail.id);
    });
```

### Event Scoped Methods

Organize handlers (methods) by event type:

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            'window': [
                { type: 'load', handler: 'handleWindowLoad' },
                { type: 'beforeunload' }
            ]
        },
        methods: {
            load: {
                handleWindowLoad: (event, target) => {
                    console.log('App loaded');
                }
            },
            beforeunload: {
                handleBeforeunload: (event, target) => {
                    // Cleanup or confirmation
                    event.returnValue = 'Unsaved changes';
                }
            }
        }
    }
});
```

---

## State Management

Simple state management pattern for forms and UI.

```javascript
const YaiState = {
    util: {
        Settings: {
            theme: null,
            notifications: null
        }
    },

    /**
     * Parse path string like "Settings[theme]" into components
     * @private
     */
    _parsePath(path) {
        const match = path.match(/^(\w+)\[(\w+)\]$/);
        return match ? { utilName: match[1], propName: match[2] } : null;
    },

    /**
     * Parse state from HTML elements with data-yai-state-util
     * Only reads from form inputs - display elements are read-only
     * Supports path format: data-yai-state-util="Settings[theme]"
     * Fallback to name attribute for form inputs
     */
    parseFromDOM() {
        const stateElements = document.querySelectorAll('[data-yai-state-util]');

        stateElements.forEach(element => {
            // Skip non-form elements (display elements are read-only)
            if (element.tagName !== 'INPUT' && element.tagName !== 'SELECT' && element.tagName !== 'TEXTAREA') {
                return;
            }

            // Use data-yai-state-util value if present, otherwise fallback to name
            const path = element.getAttribute('data-yai-state-util') || element.name || element.id;
            if (!path) return;

            const parsed = this._parsePath(path);
            if (!parsed) return;

            const { utilName, propName } = parsed;
            if (!this.util[utilName]) return;

            // Get typed value based on input type
            let value = element.value;
            switch (element.type) {
                case 'number':   value = parseInt(value, 10) || 0; break;
                case 'checkbox': value = element.checked; break;
                case 'radio':    if (!element.checked) return; break;
            }

            this.util[utilName][propName] = value;
        });
    },

    /**
     * Sync state values to DOM elements
     * @private
     */
    _syncToDOM(utilName, propName, actualValue) {
        const path = `${utilName}[${propName}]`;
        const elements = document.querySelectorAll(
            `[data-yai-state-util="${path}"], [name="${path}"]`
        );
        elements.forEach(element => {
            if (element.type === 'checkbox') {
                // Handle checkbox: convert "on"/"off" strings to boolean
                element.checked = (actualValue === true || actualValue === 'on');
            } else if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                element.value = actualValue;
            } else {
                // Display elements (span, div, label, etc.)
                element.textContent = actualValue;
            }
        });
    },

    /**
     * Sync all state values to their corresponding DOM elements
     * Call this on initialization to populate display elements
     */
    syncToDOM() {
        for (const utilName in this.util) {
            for (const propName in this.util[utilName]) {
                const value = this.util[utilName][propName];
                if (value !== null && value !== undefined) {
                    this._syncToDOM(utilName, propName, value);
                }
            }
        }
    },

    set(utilNameOrPath, propNameOrValue, value) {
        let utilName, propName, actualValue;

        // Check if first param is a path like "Settings[theme]"
        const parsed = this._parsePath(utilNameOrPath);

        if (parsed) {
            // Path format: set('Settings[theme]', 'dark')
            utilName = parsed.utilName;
            propName = parsed.propName;
            actualValue = propNameOrValue;
        } else {
            // Separate format: set('Settings', 'theme', 'dark')
            utilName = utilNameOrPath;
            propName = propNameOrValue;
            actualValue = value;
        }

        if (!this.util[utilName]) {
            console.warn(`YaiState: util "${utilName}" not found`);
            return;
        }

        this.util[utilName][propName] = actualValue;
        this._syncToDOM(utilName, propName, actualValue);
    },

    get(utilNameOrPath, propName) {
        const parsed = this._parsePath(utilNameOrPath);

        if (parsed) {
            // Path format: get('Settings[theme]')
            return this.util[parsed.utilName]?.[parsed.propName];
        } else {
            // Separate format: get('Settings', 'theme')
            return this.util[utilNameOrPath]?.[propName];
        }
    }
};

const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': ['click', 'input']
        }
    }
});

// Initialize state on app load
tabs.hook('afterInit', () => {
    YaiState.parseFromDOM();
    YaiState.syncToDOM(); // Sync state to all display elements
    console.log('Initial state:', YaiState.util.Settings);
});

// Handle state updates
tabs.hook('eventInput', ({ action }) => {
    if (action === 'handleYaiState') {
        YaiState.parseFromDOM();
        console.log('Settings updated:', YaiState.util.Settings);
    }
});
```

**HTML:**
```html
<!-- Form inputs: use name attribute (cleaner for forms) -->
<form>
    <label class="yai-checkbox">
        Notifications
        <input type="checkbox" name="Settings[notifications]"
               data-input="handleYaiState" data-yai-state-util checked>
    </label>
    <select name="Settings[theme]" class="yai-select"
            data-input="handleYaiState" data-yai-state-util>
        <option value="light">Light</option>
        <option value="dark" selected>Dark</option>
    </select>
</form>

<!-- Display elements: use data-yai-state-util with value -->
<header>
    <span>Current theme: <strong data-yai-state-util="Settings[theme]">auto-synced</strong></span>
</header>

<footer>
    <span data-yai-state-util="Settings[theme]">auto-synced</span>
</footer>
```

**Key Points:**
- **Form inputs**: Use `name="Settings[theme]"` + `data-yai-state-util` (marker only)
- **Display elements**: Use `data-yai-state-util="Settings[theme]"` (path in value, read-only)
- `parseFromDOM()` only reads from form inputs - display elements are ignored
- `data-input="handleYaiState"` triggers the event hook (only needed on inputs)
- Hook checks `action === 'handleYaiState'` to process updates
- `querySelectorAll` syncs to ALL matching elements automatically
- Flexible API: `set('Settings', 'theme', 'dark')` or `set('Settings[theme]', 'dark')`
- Same flexibility for `get()`: both formats work
- Display elements auto-update via `textContent` when state changes
- **Initialization**: Call `syncToDOM()` after `parseFromDOM()` to populate all display elements
- **Checkbox handling**: Automatically converts "on"/"off" strings to boolean for `.checked`

---

## Device Detection

Adapt behavior based on device capabilities.

```javascript
import { YaiCore } from '@yaijs/core';

const YaiDevice = YaiCore.getUserPreferences();

// Available properties:
YaiDevice.hasTouch      // Boolean: Touch support detected
YaiDevice.touchDevice   // Boolean: Coarse pointer (touch)
YaiDevice.hasHover      // Boolean: Supports hover
YaiDevice.finePointer   // Boolean: Fine pointer (mouse/trackpad)
YaiDevice.isMobile      // Boolean: Screen width ≤ 768px
YaiDevice.reduceMotion  // Boolean: User prefers reduced motion
YaiDevice.colorScheme   // String: 'dark' or 'light'
```

### Conditional Event Listeners

```javascript
// Touch vs mouse events
const setPointerListener = YaiDevice.hasTouch
    ? ['touchstart', 'touchmove', 'touchend']
    : ['mousedown',  'mousemove', 'mouseup'];

const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': [
                'click',
                ...setPointerListener  // Add appropriate pointer events
            ]
        }
    }
});
```

### Adaptive Swipe Configuration

```javascript
import { YaiTabsSwipe } from '@yaijs/core';

const swipe = new YaiTabsSwipe({
    // Auto-detect axis for mouse, horizontal for touch
    axis: YaiDevice.hasTouch ? 'horizontal' : 'auto',

    boundaryBehavior: {
        circular: true,
        descendIntoNested: YaiDevice.finePointer,  // Only on desktop
        ascendFromNested: true
    }
}).setInstance(tabs).watchHooks();
```

---

## Advanced Configuration

### Complete Enterprise Setup

```javascript
import { YaiTabs, YaiTabsSwipe, YaiViewport, YaiCore } from '@yaijs/core';

const YaiDevice = YaiCore.getUserPreferences();

// Viewport tracking for scroll effects
const viewport = new YaiViewport({
    throttle:  { resize: 500, scroll: 150, scrollend: 150 },
    threshold: { pageTop: 50, pageEnd: 50, pageScrolled: 50 },
});

// Conditional event listeners
const setPointerListener = YaiDevice.hasTouch
    ? ['touchstart', 'touchmove', 'touchend']
    : ['mousedown',  'mousemove', 'mouseup'];

const setBodyWatcher = YaiDevice.hasTouch
    ? [
        { type: 'touchend',    handler: 'globalMouseWatch', debounce: 20 },
        { type: 'touchcancel', handler: 'globalMouseWatch', debounce: 20 }
    ]
    : [
        { type: 'mouseup',     handler: 'globalMouseWatch', debounce: 50 }
    ];

// Enhanced YaiTabs configuration
const tabs = new YaiTabs({
    autoAccessibility: true,
    lazyNestedComponents: true,
    autoFocus: false,
    events: {
        enableDistanceCache: true,       // Performance optimization
        enableHandlerValidation: false,  // Skip validation in production
        setListener: {
            'body': setBodyWatcher,
            'window': [
                { type: 'load', handler: 'handleWindowLoad', options: { once: true } },
                { type: 'beforeunload', capture: true },
                { type: 'hashchange', debounce: 60 },
            ],
            '[data-yai-tabs]': [
                'click', 'keydown', 'submit',
                { type: 'input',  debounce: 750 },
                { type: 'change', debounce: 300 },
                ...setPointerListener,
            ],
        },
        customAttributes: ['data-swipe'],
        methods: {
            load: {
                handleWindowLoad: (event) => {
                    console.log('App initialized');
                }
            },
            beforeunload: {
                handleBeforeunload: (event) => {
                    // Cleanup logic
                }
            }
        }
    },
});

// Swipe navigation
const swipe = new YaiTabsSwipe({
    axis: YaiDevice.hasTouch ? 'horizontal' : 'auto',
    boundaryBehavior: {
        circular: true,
        descendIntoNested: true,
        ascendFromNested: true,
    }
}).setInstance(tabs).watchHooks();

// Event hooks
tabs
    .hook('afterInit', ({ context }) => {
        console.log('Event mappings:', tabs.events.eventMapping);
    })
    .hook('eventClick', ({ action }) => {
        switch(action) {
            case 'reload':
                location.reload();
                break;
            case 'scrollToTop':
                window.scrollTo({ top: 0, behavior: 'smooth' });
                break;
        }
    })
    .hook('globalMouseWatch', () => {
        // Reset swipe state on global pointer release
        if (swipe.isDragging()) swipe.resetDraggingState();
    });
```

### Performance Optimizations

**Distance Cache** - Cache container lookups for repeated events:
```javascript
events: {
    enableDistanceCache: true  // O(1) container lookups after first event
}
```

**Handler Validation** - Disable in production for performance:
```javascript
events: {
    enableHandlerValidation: false  // Skip method existence checks
}
```

**Debouncing/Throttling** - Control event frequency:
```javascript
events: {
    setListener: {
        '[data-yai-tabs]': [
            { type: 'input',  debounce: 750 },   // Wait 750ms after last input
            { type: 'scroll', throttle: 150 },   // Max once per 150ms
        ]
    }
}
```

---

## Resources

- **[YaiTabs Guide](./tabs.md)** - Core component documentation
- **[Utilities Overview](../utilities/overview.md)** - YaiTabsSwipe, YaiViewport
- **[YEH Documentation](../yeh/README.md)** - Event system foundation
- **[Live Demo](https://yaijs.github.io/yai/tabs/Example.html)** - Interactive examples

---

**License:** MIT
