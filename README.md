# YaiJS

**Advanced web components with YEH (Yai Event Hub) - Enterprise-grade tabs with O(1) event delegation**

Build deeply nested, event-heavy interfaces with constant-time listener delegation and zero manual lifecycle handling. Everything you need in one package.

[![NPM version](https://img.shields.io/npm/v/@yaijs/core.svg)](https://npmjs.org/package/@yaijs/core)
[![Tests](https://github.com/yaijs/yai/actions/workflows/test.yml/badge.svg)](https://github.com/yaijs/yai/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/@yaijs/core.svg)](https://github.com/yaijs/yai/blob/main/LICENSE)

---

## Why YaiJS?

- **O(1) Event Delegation** – One listener per event type per container, even across 400+ nested components
- **YEH Integrated** – Event hub included directly in `@yaijs/core` package
- **Enterprise Tabs** – Feature-complete with accessibility, dynamic loading, routing, animations
- **Pure ESM** – Works from `file://`, CDN, or bundler with zero build required
- **Event Hub Pattern** – Turn any tab into a complete application event system

---

## Quick Start

### CDN (No Build Required)

[Live on JSFiddle](https://jsfiddle.net/ha40njk9/)

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@latest/tabs/yai-tabs.css">
</head>
<body>
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

    <script type="module">
        import { YaiTabs } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';
        new YaiTabs();
    </script>
</body>
</html>
```

### NPM Installation

```bash
npm install @yaijs/core
```

```javascript
import { YaiTabs, YEH } from '@yaijs/core';

const tabs = new YaiTabs({
    defaultBehavior: 'fade',
    autoFocus: true
});

// Or extend YEH directly for custom event orchestration
class AppBus extends YEH {
    constructor() {
        super({ '#app': ['click', 'input', 'change'] });
    }
}
```

---

## Component Highlights

### YaiTabs

**[Complete Documentation →](https://yaijs.github.io/yai/docs/components/tabs.html)** | **[Live Demo →](https://yaijs.github.io/yai/tabs/Example.html)**

- 9 animation behaviors (fade, slide, zoom, flip, blur, etc.) + instant mode
- 4 navigation positions (top, right, bottom, left)
- WCAG 2.1 AA compliance with full ARIA support
- Hash-based routing with state preservation
- Dynamic content loading via `data-url` with abort controllers
- Touch/swipe navigation (YaiTabsSwipe)
- Built-in hooks: `tabOpened`, `tabReady`, `eventClick`, `eventInput`, etc.

### YEH Event Hub

**[Complete Documentation →](https://yaijs.github.io/yai/docs/yeh/)**

- Scope-aware event delegation
- Automatic target resolution for nested elements
- Built-in throttle/debounce helpers
- Chainable API (`.on().emit()`)
- Multi-handler resolution
- Performance metrics and stats

### Utilities

**[Complete Documentation →](https://yaijs.github.io/yai/docs/utilities/overview.html)**

- **YaiTabsSwipe** – Circular navigation, nested ascend/descend, axis locking
- **YaiViewport** – Observer-free visibility tracking with throttled events
- **YaiAutoSwitch** – Automated tab cycling for demos (bundle-full only)

---

## Event Hub & Hooks

YaiTabs doubles as an application event hub. Add any event type and get automatic hooks:

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': ['click', 'keydown', 'input', 'change', 'submit']
        }
    }
});

// All events automatically available as hooks
tabs.hook('eventClick', ({ event, target, container, action }) => {
    console.log('Click action:', action); // Extracted from data-click
});

tabs.hook('eventInput', ({ event, target, container, action }) => {
    console.log('Input action:', action); // Extracted from data-input
});

tabs.hook('tabOpened', ({ detail }) => {
    console.log('Tab opened:', detail.id);
});
```

**Multiple hooks per event:**

```javascript
tabs
    .hook('tabOpened', (ctx) => trackAnalytics(ctx))
    .hook('tabOpened', (ctx) => updateUI(ctx))
    .hook('tabOpened', (ctx) => loadContent(ctx));
```

See [YaiTabs Documentation](https://yaijs.github.io/yai/docs/components/tabs.html) and [YEH Documentation](https://yaijs.github.io/yai/docs/yeh/) for complete hook catalog.

---

## EventListener Orchestration

Define listener placement declaratively for optimal performance:

```javascript
const tabs = new YaiTabs({
    events: {
        setListener: {
            '[data-yai-tabs]': ['click', 'keydown'],              // Core events
            '[data-yai-forms]': ['change', 'input', 'submit'],    // Form sections only
            '[data-swipe]': [
                'mousedown', 'mousemove', 'mouseup',
                'touchstart', 'touchmove', 'touchend'
            ]  // Swipe-enabled elements only
        }
    }
});
```

**Real-world results** (60 nested components with recursive AJAX loading):

| Approach | Elements | Listeners | Reduction |
|----------|----------|-----------|-----------|
| Without orchestration | 60 | 484+ | baseline |
| **With orchestration** | **12** | **45** | **91%** |

≈439 fewer event listeners while maintaining full functionality!

---

## Available Bundles

```javascript
// Minimal: YaiCore + YaiTabs + YEH
import { YaiTabs } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-core.js';

// Recommended: + YaiTabsSwipe + YaiViewport
import { YaiTabs, YaiTabsSwipe, YaiViewport } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

// Full: + YaiAutoSwitch + YaiSearchAndClick
import { YaiTabs, YaiTabsSwipe, YaiViewport } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-full.js';
```

---

## Documentation

- **[Documentation Hub](https://yaijs.github.io/yai/docs/README.html)** – Complete framework documentation
- **[YaiTabs Guide](https://yaijs.github.io/yai/docs/components/tabs.html)** – Component reference with examples
- **[Utilities Overview](https://yaijs.github.io/yai/docs/utilities/overview.html)** – YaiTabsSwipe, YaiViewport utilities
- **[YEH Event Hub](https://yaijs.github.io/yai/docs/yeh/)** – Event system foundation

---

## Live Examples

- **[Interactive Demo](https://yaijs.github.io/yai/tabs/Example.html)** – 50+ nested components with all features
- **[Performance Benchmark](https://yaijs.github.io/yai/tabs/Benchmark.html)** – Stress test with 400+ nesting levels
- **[JSFiddle](https://jsfiddle.net/tqku5gzj/)** – Quick start playground

---

## Browser Support

- **Modern ES Modules:** Chrome 61+, Firefox 60+, Safari 11+, Edge 16+
- **Tested:** Safari 15.6 (macOS 2015), Chrome 106 (Android), Chrome/Brave/Opera/Firefox (Ubuntu 24.04)
- **Legacy:** Use bundler with polyfills for older browsers

---

## Resources

- **[GitHub Repository](https://github.com/yaijs/yai)** – Source code and issues
- **[NPM Package](https://npmjs.org/package/@yaijs/core)** – Install via npm
- **[Report Issues](https://github.com/yaijs/yai/issues)** – Bug reports and feature requests
- **[GitHub Pages](https://yaijs.github.io/yai/)** – Live documentation site

---

## License

MIT License – Free for personal and commercial use

## Authors

- **Engin Ypsilon** – Architecture & concept
- **Claude-3.5-Sonnet** – Implementation & optimization
- **DeepSeek-V3** – Documentation & examples
- **Grok-2** – Performance analysis
- **ChatGPT** – Design tokens

---

**Happy building!** 🚀
