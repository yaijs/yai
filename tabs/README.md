# YaiTabs

Enterprise-grade tab component with O(1) event scaling, unlimited nesting, and hash-based deep linking. Built on [YpsilonEventHandler](https://github.com/yaijs/yeh) architecture.

**🎯 More Than Tabs - It's an Event Bus!**
YaiTabs doubles as a powerful application event bus. Add listeners for ANY event type (`click`, `input`, `change`, `submit`, etc.) and handle them through hooks - all with just 2 root listeners. Perfect for building complete SPAs within a single tab component.

## Features

**🚀 Performance**
- O(1) listener scaling (2 listeners per root, 0 for nested)
- Handles 70+ nested components without degradation
- ~350KB memory footprint for deep hierarchies

**🎯 Tab Component Capabilities**
- Unlimited nesting depth
- Hash-based URL routing with state preservation
- Dynamic content loading with abort control
- 8 animation behaviors + instant mode
- Full ARIA/WCAG 2.1 AA compliance

**⚡ Event Bus Superpowers**
- Handle ANY event type within tab containers
- Single event system for entire application
- Built-in debouncing and throttling
- Automatic container scoping
- Works seamlessly with dynamic content

**🎨 Customization**
- CSS custom properties theming
- Built-in color schemes (red, blue, light, dark)
- Pre-built themes (default, minimal, pills)
- Component-level scheme inheritance

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://unpkg.com/@yaijs/core@1.0.0-beta.1/tabs/yai-tabs.css">
</head>
<body>
    <div data-yai-tabs>
        <nav data-controller>
            <button data-tab-action="open" data-open="1">Tab 1</button>
            <button data-tab-action="open" data-open="2">Tab 2</button>
        </nav>
        <div data-content>
            <div data-tab="1">Content 1</div>
            <div data-tab="2">Content 2</div>
        </div>
    </div>

    <!-- YaiJS -->
    <script src="https://cdn.jsdelivr.net/npm/@yaijs/yeh"></script>
    <script type="module" src="https://unpkg.com/@yaijs/core@1.0.0-beta.1/dist/yai-bundle.js"></script>

    <script type="module">
        const { YaiTabs } = window.YaiJS;

        const tabs = new YaiTabs({
            defaultBehavior: 'fade',
            autoAccessibility: true
        });
    </script>
</body>
</html>
```

## Architecture

### Event Delegation Hierarchy
```
Root Component      → 2 listeners (click, keydown)
  ├─ Nested L2      → 0 listeners (inherits)
  │  ├─ Nested L3   → 0 listeners (inherits)
  │  └─ Dynamic     → 0 listeners (inherits)
  └─ Sibling        → 0 listeners (inherits)
```

**Key Benefits:**
- Nested components inherit parent's event listeners
- Dynamic content requires no re-initialization
- Performance remains constant regardless of depth
- Automatic cleanup on component removal

### Lifecycle

1. **Page Load**: Components with `[data-yai-tabs]` detected
2. **Initialization**: Root components setup event listeners
3. **Nesting**: Nested components processed as delegates
4. **Dynamic**: New content integrates automatically

## HTML Structure

### Container
```html
<div data-yai-tabs
     data-theme="default"
     data-color-scheme="dark"
     data-color-accent="primary"
     data-behavior="fade"
     data-nav="top"
     data-ref-path="main-tabs">
```

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-yai-tabs` | – | Required component marker |
| `data-theme` | `default`, `minimal`, `pills` | Visual theme variant |
| `data-color-scheme` | `light`, `dark` | Layout color scheme |
| `data-color-accent` | `primary`, `secondary`, `success`, `warning`, `danger`, `funky`, `dark` | Button accent color |
| `data-behavior` | `fade`, `slide-*`, `zoom`, `flip`, `instant` | Animation effect |
| `data-nav` | `top`, `right`, `bottom`, `left` | Navigation position |
| `data-ref-path` | string | Hash parameter key for routing |

**Semantic Color System:**
- `data-color-scheme` - Applies to entire layout (background, text, surfaces)
- `data-color-accent` - Applies to active buttons only
- Colors cascade to nested components but can be overridden per level

### Navigation
```html
<nav data-controller
     data-align="center"
     data-variant="success"
     data-grow
     aria-label="Main Tabs">
```

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-controller` | – | Required nav marker |
| `data-align` | `start`, `center`, `end` | Button alignment |
| `data-variant` | `primary`, `secondary`, `success`, `warning`, `danger`, `funky`, `dark` | Inverts color/background for active button |
| `data-grow` | – | Enable flex-grow on buttons |

### Buttons
```html
<button data-tab-action="open"
        data-open="1"
        data-default
        data-url="/content.html"
        data-url-refresh
        data-delay="500"
        data-min-loading="800">
```

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-tab-action` | `open` | Required action type |
| `data-open` | string/number | Target panel ID |
| `data-default` | – | Initially active tab |
| `data-url` | URL | Dynamic content source |
| `data-url-refresh` | – | Always reload content |
| `data-delay` | ms | Pre-fetch delay |
| `data-min-loading` | ms | Minimum loading duration |

### Content
```html
<div data-content>
    <div data-tab="1" data-spaceless>
        <!-- Panel content -->
    </div>
</div>
```

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-content` | – | Required wrapper |
| `data-tab` | string/number | Panel ID (matches `data-open`) |
| `data-spaceless` | – | Remove default padding |

## Configuration

```js
const tabs = new YaiTabs({
    // Core options
    closable: true,              // Allow closing active tabs
    defaultBehavior: 'fade',     // Default animation
    autoFocus: false,            // Focus first tab on init
    autoAccessibility: true,     // Automatic ARIA attributes
    autoDisambiguate: false,     // Ensure unique IDs across components
    lazyNestedComponents: true,  // Optimize nested initialization

    // Event system configuration
    events: {
        setListener: {
            window: [
                // Required for hash routing
                { type: 'hashchange', debounce: 500 }
            ],
            // Each root component will get following listeners
            // Nested components will use this listeners, too.
            '[data-yai-tabs]': [
                'click',
                'keydown',
                { type: 'change', debounce: 300 },
                { type: 'input', debounce: 500 },
                { type: 'submit' }
            ]
        },
        actionableAttributes: [
            'data-tab-action',
            'data-click',
            'data-input',
            'data-change',
            'data-submit'
        ],
        // Custom event methods, optionally scopable
        methods: {
            submit: {
                handleSubmit(event, target, container) {
                    tabs._executeHook(`eventSubmit`, { event, target, container });
                },
            },
        }
    }
});
```

## Lifecycle Hooks

```js
// Loading states
tabs.hook('setLoading', ({ container, target }) => {
    target.textContent = 'Loading...';
});

tabs.hook('removeLoading', ({ container, target }) => {
    target.textContent = 'Done';
});

// Content lifecycle
tabs.hook('contentReady', ({ content, target, url }) => {
    // Perfect timing for animations
});

tabs.hook('afterLoad', ({ content, url }) => {
    // After all processing complete
});

tabs.hook('eventSubmit', ({ content, url }) => {
    // After submit
});
```

## Event Bus System

**The Game Changer:** YaiTabs is also a complete application event bus!

Add listeners for any event type and handle them through hooks. All events are scoped to their container and work seamlessly with nested tabs and dynamic content.

**Default Events** (built-in handlers): `click`, `keydown`, `change`, `input`, `submit`

**Custom Events**: Any additional event type requires a custom handler in `events.methods`.

### Setup

```js
const tabs = new YaiTabs({
    events: {
        setListener: {
            window: [
                { type: 'hashchange', debounce: 500 }  // Hash routing (internal)
            ],
            '[data-yai-tabs]': [
                'click',                                // Tab navigation + app clicks
                'keydown',                              // Tab keyboard navigation + shortcuts
                { type: 'focus', options: { capture: true } },   // Field activation
                { type: 'change', debounce: 300 },      // Form selects, checkboxes
                { type: 'input', debounce: 500 },       // Live search, filters
                { type: 'submit' }                      // Form submissions
            ]
        },
        actionableAttributes: [
            'data-tab-action',    // Tab controls (required)
            'data-click',         // Custom click actions
            'data-input',         // Input event handlers
            'data-change',        // Change event handlers
            'data-submit',        // Submit event handlers
            'data-focus'          // Focus event handlers
        ],
        // Custom methods for non-default events
        methods: {
            submit: {
                // Required for the submit event
                handleSubmit(event, target, container) {
                    event.preventDefault();
                    event.stopPropagation();
                    tabs._executeHook('eventSubmit', { event, target, container });
                }
            },
            focus: {
                // Required for any additional event
                handleFocus(event, target, container) {
                    tabs._executeHook('eventFocus', { event, target, container });
                }
            }
        }
    }
});
```

> **💡 Need More Events?** Add any event type to `setListener`, then create a corresponding handler in `methods`. Methods can be scoped by event type (as keys) or flat in the object.

### Handle Events via Hooks

```js
// Handle clicks anywhere in tab containers
tabs.hook('eventClick', ({ event, target, container }) => {
    // Delete button
    if (target.matches('[data-action="delete"]')) {
        deleteItem(target.dataset.id, container);
    }

    // Load more button
    if (target.matches('[data-action="loadMore"]')) {
        loadMoreItems(container);
    }

    // Any custom action
    if (target.dataset.action) {
        executeAction(target.dataset.action, target, container);
    }
});

// Live search with automatic debouncing
tabs.hook('eventInput', ({ target, container }) => {
    if (target.matches('[data-live-search]')) {
        performSearch(target.value, container);
    }
});

// Field activation on focus
tabs.hook('eventFocus', ({ target, container }) => {
    if (target.matches('[data-validate]')) {
        showFieldHints(target);
    }
});

// Form submission
tabs.hook('eventSubmit', ({ event, target }) => {
    event.preventDefault();
    const formData = new FormData(target);
    submitForm(formData);
});
```

### Real-World Example

```html
<div data-yai-tabs>
    <div data-tab="dashboard">
        <!-- Live search -->
        <input type="text" data-live-search placeholder="Search...">

        <!-- Action buttons -->
        <button data-action="export">Export</button>
        <button data-action="refresh">Refresh</button>

        <!-- Form -->
        <form data-action="saveSettings">
            <input name="username" data-validate>
            <button type="submit">Save</button>
        </form>

        <!-- Load more -->
        <button data-action="loadMore">Load More Items</button>
    </div>
</div>
```

**Benefits:**
- ⚡ **2 listeners** handle all interactions (not 20, not 200)
- 🎯 **Auto-scoping** - every event knows its container
- ⏱️ **Built-in debouncing** - performance optimized out-of-the-box
- 🔄 **Dynamic content** - works immediately without re-initialization
- 🎨 **Clean code** - centralized event handling, no scattered listeners

## Deep Linking

### Hash Routing
```html
<!-- URL: #styles=1&s-mixed=1&s-m-dark=1&s-2-r=1 -->
<div data-yai-tabs data-ref-path="styles">
    <div data-yai-tabs data-ref-path="s-mixed">
        <div data-yai-tabs data-ref-path="s-m-dark">
            <div data-yai-tabs data-ref-path="s-2-r">
```

### Quick Navigation Links
```html
<a data-yai-ref-path="lvl-1=1|styles=1">Dashboard</a>
<a data-yai-ref-path="lvl-2=2|s-red=2">Settings</a>
```

### Programmatic URLs
```js
// Generate URL for specific tab combination
const url = YaiTabs.reconstructUrlFromRef('s-m-dark', 1);
// Returns: #styles=1&s-mixed=1&s-m-dark=1

// Get full path data
const pathData = YaiTabs.getRefPath('s-2-r');
// Returns: { fullPath: ['styles', 's-mixed', 's-m-dark', 's-2-r'], ... }
```

## Theming

YaiTabs uses a **semantic color system** with three levels of customization:

### 1. Color Scheme (Layout-wide)
Controls background, text, and surface colors for the entire component:

```html
<div data-yai-tabs data-color-scheme="dark">
    <!-- Entire layout uses dark theme -->
</div>
```

**Available schemes:** `light` (default), `dark`

### 2. Color Accent (Button-only)
Controls active button colors without affecting layout:

```html
<div data-yai-tabs data-color-accent="primary">
    <!-- Active buttons use primary accent color -->
</div>
```

**Available accents:** `primary`, `secondary`, `success`, `warning`, `danger`, `funky`, `dark`

### 3. Nav Variant (Inverted buttons)
Inverts color/background for active navigation buttons:

```html
<nav data-controller data-variant="success">
    <!-- Active button: success background, white text -->
</nav>
```

**Available variants:** Same as accents

### Complete Example

```html
<div data-yai-tabs
     data-color-scheme="dark"
     data-color-accent="primary">

    <nav data-controller data-variant="success">
        <button data-tab-action="open" data-open="1">Dashboard</button>
    </nav>

    <div data-content>
        <div data-tab="1">
            <!-- Dark scheme layout + primary accent + success variant button -->
        </div>
    </div>
</div>
```

### CSS Variables

Customize semantic tokens for complete control:

```css
:root {
    /* Layout */
    --yai-tabs-content-padding: 20px;
    --yai-tabs-button-min-height: 42px;

    /* Semantic Colors */
    --yai-tabs-color-primary: #3a59ae;
    --yai-tabs-color-secondary: #7c3aed;
    --yai-tabs-color-success: #059669;
    --yai-tabs-color-warning: #b45309;
    --yai-tabs-color-danger: #dc2626;
    --yai-tabs-color-funky: #c026d3;
    --yai-tabs-color-dark: #171c29;

    /* Layout Colors */
    --yai-tabs-color-text: #49565b;
    --yai-tabs-color-background: #ffffff;
    --yai-tabs-color-surface: #f8fafc;

    /* Animation */
    --yai-tabs-loader-speed: 1.1s;
    --yai-tabs-closed-timeout: .5s;
}

/* Dark Scheme Override */
[data-color-scheme="dark"] {
    --yai-tabs-color-text: #ffffff;
    --yai-tabs-color-background: #252525;
    --yai-tabs-color-surface: #2d2d2d;
}

/* Custom Accent */
[data-color-accent="primary"] {
    --yai-tabs-color-accent: var(--yai-tabs-color-primary);
}
```

### Custom Themes

Create complete visual overrides:

```css
[data-theme="minimal"] {
    box-shadow: none;

    & nav[data-controller] {
        background: transparent;

        & button.active {
            border-bottom: 2px solid var(--yai-tabs-color-accent);
        }
    }
}
```

**Colors cascade:** Set scheme/accent on parent, override on nested components as needed.

## Performance Metrics

| Scenario | Components | Listeners | LCP | Memory |
|----------|------------|-----------|-----|---------|
| Basic | 1 root | 2 | ~0.10s | ~50KB |
| Nested | 20 components | 2 | ~0.10s | ~120KB |
| Deep | 70+ components | 2 | ~0.10s | ~350KB |

## Accessibility

- ✅ WCAG 2.1 AA compliant
- ✅ Full ARIA support: `tablist`, `tab`, `tabpanel`
- ✅ Roving tabindex for keyboard navigation
- ✅ `inert` attribute for hidden panels
- ✅ Keyboard shortcuts: Arrow keys, Home, End, Enter, Space

**Lighthouse Score: 100/100 for Accessibility, SEO and Best Practices**

## Best Practices

1. **Unique IDs**: Use unique `data-open`/`data-tab` pairs or enable `autoDisambiguate`
2. **Hash Routing**: Set `data-ref-path` for deep linkable navigation
3. **Loading States**: Implement hooks for better UX with dynamic content
4. **Theming**: Leverage CSS variables for consistent design
5. **Event Delegation**: Use event hooks instead of multiple listeners

## Advanced Examples

See [ADVANCED.md](./ADVANCED.md) for:
- Single-tab applications
- Event bus patterns
- Analytics integration
- Dynamic form handling
- Breadcrumb navigation

## Resources

- **[Live Demo](https://yaijs.github.io/yai/tabs/Example.html)** - Interactive examples with 20+ nested components
- **[YaiTabs GitHub](https://github.com/yaijs/yai)** - YaiCore, YaiTabs, and components
- **[YEH GitHub](https://github.com/yaijs/yeh)** - YpsilonEventHandler foundation
- **[NPM @yaijs/core](https://www.npmjs.com/package/@yaijs/core)** - YaiTabs package
- **[NPM @yaijs/yeh](https://www.npmjs.com/package/@yaijs/yeh)** - Event handler package

## Authors

**YAI** = **Y**psilon + **AI** 🤖

- **Engin Ypsilon** - Architecture & concept
- **Claude-3.5-Sonnet** - Implementation & optimization
- **DeepSeek-V3** - Documentation & examples
- **Grok-2** - Performance analysis
- **ChatGPT** - Design tokens

---

**License:** MIT | **Version:** 1.0.0-beta.1
