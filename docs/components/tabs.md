# YaiTabs

Enterprise-grade tab component with O(1) event delegation, deep nesting support, and hash-based deep linking. Built on [Yai Event Hub](https://yaijs.github.io/yai/docs/yeh/) architecture.

**🎯 More Than Tabs - It's an Event Hub!**
YaiTabs doubles as a powerful application event hub. Add listeners for ANY event type (`click`, `input`, `change`, `submit`, etc.) and handle them through hooks. All listeners are internally delegated and shared from root level as well. Perfect for building complete SPAs within a single tab component. You can throw needed elements into the tab, and remove them without headache. No manual register/unregister - That's the power of Event Delegation - zero manual lifecycle management while providing max flexibility!

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Styling & Theming](#styling--theming)
- [HTML Structure](#html-structure)
  - [Container](#container)
  - [Navigation](#navigation)
  - [Buttons](#buttons)
  - [Content](#content)
- [Performance Metrics](#performance-metrics)
- [Accessibility](#accessibility)
- [Resources](#resources)


## Features

**🚀 Performance**
- O(1) event delegation (listeners only on root level, regardless of depth)
- Tested to 400+ nesting levels (1,530 components, 15,504 elements)
- Production use: 3-20 levels (native-like performance)
- Bottleneck: Browser rendering at 60+ levels, not framework

**🎯 Tab Component Capabilities**
- Deep nesting support (tested to 400+ levels)
- Optional Hash-based URL routing with state preservation (but not that deep)
- Dynamic content loading with abort control
- 8 animation behaviors + instant mode
- Full ARIA/WCAG 2.1 AA compliance

**⚡ Event Hub Superpowers** (The Secret Sauce)
- Handle ANY event type within tab containers with same O(1) event delegation
- Single event system for entire application
- Built-in debouncing and throttling
- Automatic container scoping
- Works seamlessly with dynamic content

**🎨 Customization**
- CSS custom properties theming
- Built-in color accents and variants for buttons
- Built-in color schemes (light, dark)
- Pre-built themes (default, minimal)
- Component-level scheme inheritance

**⌥ Event Delegation Hierarchy**
```
Root Component      → 2 listeners (click, keydown)
  ├─ Nested L2      → 0 listeners (shares root's)
  │  ├─ Nested L3   → 0 listeners (shares root's)
  │  └─ Dynamic     → 0 listeners (shares root's)
  └─ Sibling        → 0 listeners (shares root's)
```

**🎮 Try It Now**
- **[Live Example →](https://yaijs.github.io/yai/tabs/Example.html)** - Full-featured demo with nested tabs, animations, event hub, etc.
- **[Benchmark](https://yaijs.github.io/yai/tabs/Benchmark.html)** – Stresstest

## Quick Start

**Want to try it first?** [JSFiddle Demo →](https://jsfiddle.net/tqku5gzj/)

The examples further below will build up on this quick start.

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@latest/tabs/yai-tabs.css">
</head>
<body>
    <!-- Default Tab Markup -->
    <div data-yai-tabs data-theme="default">
        <nav data-controller>
            <button data-tab-action="open" data-open="1">Tab 1</button>
            <button data-tab-action="open" data-open="2">Tab 2</button>
        </nav>
        <div data-content>
            <div data-tab="1">Content 1</div>
            <div data-tab="2">Content 2</div>
        </div>
    </div>
    <!-- YaiJS (pure ESM) -->
    <script type="module">
        import {
            YaiTabs
        } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

        const tabs = new YaiTabs();
    </script>
</body>
</html>
```

That's all you need to have ARIA-compliant YaiTabs up and running. It uses three default listeners added to `[data-yai-tabs]` initially: `click`, `keydown`, and `hashchange`.

**Accessing Events via Hooks**

These events automatically become available via the YaiTabs hook system, scoped at the component level. Nested components are completely isolated with their own scope, while sharing the listeners added at root level.

Add a test button.

```html
<!-- YaiTabs adds data-attributes for the added events to a whitelist -->
<div data-tab="1"> <button data-click="callHandler">Test</button> </div>
```

And hook in. The scope based architecture makes sure, all events are only fired, when the content section is in focus or active. Opening tabs make them automatically focused, so keydown events are accessible immediately and can be used to navigate the tabs with arrows.

```js
// ...
const tabs = new YaiTabs();

tabs
.hook('eventClick', ({ event, target, container, action, context }) => {
    console.log('Click:', action, context.config)
})
.hook('eventKeydown', ({ event, target, container, context }) => {
    console.log('Key:', event.key)
})
.hook('eventHashchange', ({ event, context }) => {
    console.log('Hash changed', event, context)
})
```

It could look familar to you, because we are mixing up all the goods we like in popular Frameworks.


## Configuration

Customize YaiTabs behavior by passing options to the constructor:

```js
const tabs = new YaiTabs({
    // Animation behavior for tab transitions
    defaultBehavior: 'fade',  // Options: fade, slide-up, zoom, instant, etc.

    // Enable close buttons on tabs
    closable: true,

    // Automatically focus opened tabs (enables keyboard navigation)
    autoFocus: true,

    // Add event listeners for additional interactions
    events: {
        setListener: {
            '[data-yai-tabs]': ['click', 'keydown', 'input', 'change']
        },
        // Use attributes: `<button data-click>`, `<input data-input>`, `<input data-change>`
        // Those attibutes are auto generated for common events. Check `tabs.events.actionableConfig`
    }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `closable` | `boolean` | `false` | Enable close buttons - clicking an active tab button closes the tab |
| `defaultBehavior` | `string` | `'fade'` | Default animation behavior: `fade`, `slide-down`, `slide-up`, `slide-left`, `slide-right`, `blur`, `zoom`, `flip`, `instant` |
| `autoFocus` | `boolean` | `true` | Automatically focus the first container's active tab on initialization |
| `autoAccessibility` | `boolean` | `true` | Enable comprehensive ARIA accessibility setup (roles, labels, states) |
| `autoDisambiguate` | `boolean` | `false` | Automatically make identical `data-open`/`data-tab` values unique to prevent cross-contamination |
| `lazyNestedComponents` | `boolean` | `true` | On init, marks nested tab components as lazy with `data-yai-tabs-lazy` |
| `events.setListener` | `object` | See example | Define which events to listen for and on which selectors |
| `events.actionableAttributes` | `array` | `['data-tab-action']` | Override auto generated attributes that trigger event hooks (e.g., `data-click`, `data-input`) |
| `events.customAttributes` | `array` | `[]` | Add any attributes to auto generated whitelist attributes |

---

## Styling & Theming

YaiTabs comes with built-in themes and extensive customization options.

### Including the Stylesheet

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@latest/tabs/yai-tabs.css">
```

### Built-in Themes

Apply themes using data attributes:

```html
<div data-yai-tabs data-theme="default" data-color-scheme="dark">
    <!-- Your tabs -->
</div>
```

**Available Options:**
- `data-theme`: `default` (feature-rich) or `minimal` (lightweight)
- `data-color-scheme`: `light` or `dark`
- `data-color-accent`: `primary`, `secondary`, `success`, `warning`, `danger`

### Theme Inheritance

Themes cascade down to nested components unless explicitly overridden:

```html
<!-- Parent: dark theme -->
<div data-yai-tabs data-theme="default" data-color-scheme="dark">
    <nav data-controller>...</nav>

    <div data-content>
        <!-- Child: inherits dark theme -->
        <div data-tab="1">
            <div data-yai-tabs>
                <!-- Uses parent's dark theme -->
            </div>
        </div>

        <!-- Child: overrides to light -->
        <div data-tab="2">
            <div data-yai-tabs data-color-scheme="light">
                <!-- Uses light theme -->
            </div>
        </div>
    </div>
</div>
```

### Button Variants

Style tab buttons with data-variant:

```html
<nav data-controller data-variant="primary">
    <button data-tab-action="open" data-open="1">Important</button>
</nav>
```

**Variants:** `primary`, `secondary`, `success`, `warning`, `danger`

### CSS Custom Properties

For advanced customization, override CSS variables:

```css
:root {
    --yai-primary-color: #007bff;
    --yai-border-radius: 8px;
    --yai-tabs-loader-speed: 1.1s;
}
```

Check the CSS for all available variables: [tabs/yai-tabs.css](https://cdn.jsdelivr.net/npm/@yaijs/core@latest/tabs/yai-tabs.css)

---

## HTML Structure

### Container
```html
<div data-yai-tabs
    data-theme="default"
    data-color-scheme="dark"
    data-color-accent="primary"
    data-behavior="fade"
    data-nav="top"
    data-ref-path="main-tabs"
    data-accessibility="false">
    <!-- tabs content -->
</div>
```

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-yai-tabs` | – | Required component marker |
| `data-theme` | `default`, `minimal` | Visual theme variant |
| `data-color-scheme` | `light`, `dark` | Layout color scheme |
| `data-color-accent` | `primary`, `secondary`, `success`, `warning`, `danger` | Button accent color |
| `data-behavior` | `fade`, `slide-down`, `slide-up`, `slide-left`, `slide-right`, `blur`, `zoom`, `flip`, `instant` | Animation effect |
| `data-nav` | `top`, `right`, `bottom`, `left` | Navigation position |
| `data-ref-path` | string | Hash parameter key for routing |
| `data-accessibility` | `false` | Disables auto ARIA attributes when set |

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
| `data-variant` | `primary`, `secondary`, `success`, `warning`, `danger` | Inverts color/background for active button |
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
| `data-inview-default` | – | Initially active tab alternate for nested tabs |
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

---


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

## Resources

- **[Live Demo](https://yaijs.github.io/yai/tabs/Example.html)** - Interactive examples with 50+ nested components
- **[GitHub Repository](https://github.com/yaijs/yai)** - Source code and documentation
- **[NPM Package](https://www.npmjs.com/package/@yaijs/core)** - Install via npm
- **[Next: YaiTabs Advanced Usage](https://yaijs.github.io/yai/docs/components/tabs.advanced.html)** - Advanced patterns and real-world examples

## Authors
- **Engin Ypsilon** - Architecture & concept
- **Claude-3.5-Sonnet** - Implementation & optimization
- **DeepSeek-V3** - Documentation & examples
- **Grok-2** - Performance analysis
- **ChatGPT** - Design tokens

---

**License:** MIT
