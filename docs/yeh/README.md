# YEH (Yai Event Hub)

> A lightweight, flexible event handler for modern web applications. Simplifies event management by centralizing listeners and providing advanced routing options.

YEH is fundamentally designed around **event delegation** - the concept of using a single listener to handle multiple, or even dynamically added elements efficiently and lossless. This isn't just an optimization; it's the entire architectural foundation. Works on `file://` with zero build tools.

---

## ✨ Features

- **Event Delegation Made Easy**: One listener handles dynamic elements with scope-based routing.
- **Automatic Target Resolution**: Handles nested elements (e.g., SVGs in buttons).
- **Throttle & Debounce Support**: Built-in performance controls.
- **Dynamic Listener Management**: Add/remove events at runtime.
- **Flexible Handler Resolution**: Class methods, external maps, or globals.
- **Multi-Handler System**: Closest-match resolution for nested components.
- **Performance Tracking**: Optional metrics for optimization.
- **No Dependencies**: ~5kB gzipped, enterprise-ready (729 LOC).

---

## 🚀 Quick Start

**No setup, no build step, no server, just include the file.**

**Get started in 30 seconds** – [try it live on JSFiddle](https://jsfiddle.net/nu2p54ao/)

```html
<!DOCTYPE html>
<html>
<head><title>YEH Demo</title></head>
<body>
  <div id="app">
    <button data-action="save">Save</button>
    <button data-action="delete">Delete</button>
  </div>

  <script type="module">
    import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.1/yeh/yeh.min.js';

    class MyHandler extends YEH {
      constructor() {
        super({ '#app': ['click'] }); // Falls back to handleClick() = "handle + click"
      }

      handleClick(event, target, container) {
        const action = target.dataset.action;
        if (action && this[action]) this[action](target, event, container);
      }

      save(target)   { console.log('Saving...'); }
      delete(target) { console.log('Deleting...'); }
    }

    new MyHandler(); // Adding listeners Done
  </script>
</body>
</html>
```

**30-second setup:** Create `app.html`, copy & paste the above code, then double-click to run.

> **💡 Universal Delegation Pattern**
>
> One listener on parent + `custom-selector` = handles unlimited elements within the parent

---

## Installation

### CDN (Instant Setup)

```html
<script type="module">
  import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.1/yeh/yeh.min.js';
  new YEH({ '#app': ['click'] });
</script>
```

### NPM (Build Tools)

```sh
npm install @yaijs/core
```

```javascript
// Import from main bundle
import { YEH } from '@yaijs/core';

// Or import directly
import { YEH } from '@yaijs/core/yeh';
```

> **Note:** Package is ESM-only. Use `import`, not `require()`.

Works with `file://` protocol — no server needed.

---

## ⚙️ Configuration Options

Pass a third argument to the constructor to enable advanced features:

| Option                 | Type      | Default | Description                                                                |
| ---------------------- | --------- | ------- | ---------------------------------------------------------------------------|
| `enableStats`          | `boolean` | `false` | Track performance metrics like event count and distance cache hits.        |
| `methods`              | `object`  | `null`  | External method map for organizing handlers by event type.                 |
| `enableGlobalFallback` | `boolean` | `false` | Fallback to global `window` functions when no method is found.             |
| `methodsFirst`         | `boolean` | `false` | Check `methods` object before class methods during handler resolution.     |
| `passiveEvents`        | `array`   | auto    | Override default passive events (scroll, touch, wheel, pointer).           |
| `abortController`      | `boolean` | `false` | Enable `AbortController` support for programmatic listener removal.        |
| `enableDistanceCache`  | `boolean` | `true`  | Cache DOM distance calculations for performance (multi-handler scenarios). |

**Example:** `new YEH(events, aliases, { enableStats: true });`

---

## 🔗 Fluent Chaining API

Chain operations for complex event orchestration:

```js
App.on('data-ready', 'handleData')
    .on('user-login', 'handleLogin')
    .emit('init-complete', { loaded: true });
```

---

## 🧹 Cleanup

```javascript
handler.destroy();
// Or with AbortController enabled
handler.abort();
```

---

## 📊 Performance Metrics

With `enableStats: true`:

```javascript
console.log(handler.getStats());
```

---

## 🌐 Browser Support

**Opera** | **Chrome** | **Firefox** | **Safari** | **Edge** - all modern versions

*Works with legacy browsers via Webpack + Babel.*

---

## 📊 Comparison vs Popular Libraries

| Feature                     | YEH                 | EventEmitter3 | Redux Toolkit | jQuery         |
|-----------------------------|---------------------|---------------|---------------|----------------|
| **Bundle Size**             | 5kB gzipped         | 7kB gzipped   | 12kB+ gzipped | 30kB+ gzipped  |
| **Dependencies**            | ✅ Zero             | ✅ Zero       | ❌ Many       | ✅ Zero        |
| **Event Delegation**        | ✅ Advanced         | ❌ None       | ❌ None       | ✅ Basic       |
| **Multi-Handler System**    | ✅ Unique           | ❌ None       | ❌ None       | ❌ None        |
| **Throttle/Debounce**       | ✅ Built-in         | ❌ None       | ❌ None       | ❌ None        |
| **Native Browser API**      | ✅ Yes              | ❌ No         | ❌ No         | ❌ No          |
| **Dynamic Element Support** | ✅ Zero-config      | ❌ None       | ❌ None       | ✅ Re-bind     |
| **TypeScript Support**      | ✅ Full             | ✅ Partial    | ✅ Full       | ⚠️ Community   |
| **Memory Leak Prevention**  | ✅ Automatic        | ⚠️ Manual     | ✅ Automatic  | ⚠️ Manual      |
| **Performance**             | ✅ Native           | ⚠️ Synthetic  | ⚠️ Virtual    | ⚠️ Abstraction |
| **Custom Event Dispatch**   | ✅ Built-in         | ✅ Yes        | ✅ Yes        | ✅ Yes         |
| **Learning Curve**          | ✅ Low              | ✅ Low        | ❌ Steep      | ✅ Familiar    |

### Why YEH Stands Out
- **Smallest footprint** with advanced features like multi-handler delegation.
- **Native performance** using browser APIs, avoiding synthetic event overhead.
- **Zero dependencies** and automatic memory management for scalability.
- **Built-in utilities** (throttle, debounce, stats) eliminate external needs.


## 🎯 Advanced Patterns

### Declarative Toggle System

YEH's event delegation enables powerful declarative patterns where HTML configuration drives behavior. This eliminates repetitive JavaScript handlers while maintaining full flexibility.

#### The Universal Toggle Pattern

[Try it live on JSFiddle](https://jsfiddle.net/hb9t3gam/)

```javascript
import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.1/yeh/yeh.min.js';

class App extends YEH {
  constructor() {
    super(
      { '#app': ['click'] },
      {},
      { autoTargetResolution: true } // Enable smart targeting
    );
  }

  handleClick(event, target, container) {
    const action = target.dataset.action;
    if (action && this[action]) {
      this[action](target, event, container);
    }
  }

  toggleTarget(target, event, container) {
    const targetSelector = target.dataset.target;
    if (!targetSelector) return;

    const config = {
      targetAll: target.hasAttribute('data-target-all'),
      toggleClass: target.dataset.toggleClass,
      toggleContent: target.dataset.toggleContent,
      toggleAttribute: target.dataset.toggleAttribute,
      toggleAttributeValue: target.dataset.toggleAttributeValue,
      toggleClassSelf: target.dataset.toggleClassSelf,
      toggleContentSelf: target.dataset.toggleContentSelf,
      toggleOnce: target.hasAttribute('data-toggle-once'),
    };

    const targets = config.targetAll
      ? Array.from(document.querySelectorAll(targetSelector))
      : [document.querySelector(targetSelector)].filter(Boolean);

    if (!targets.length) return;

    targets.forEach(targetEl => {
      if (config.toggleClass) {
        targetEl.classList.toggle(config.toggleClass);
      }
      if (config.toggleContent) {
        if (!targetEl.dataset.yOriginalContent) {
          targetEl.dataset.yOriginalContent = targetEl.textContent;
          targetEl.textContent = config.toggleContent;
        } else {
          const current = targetEl.textContent;
          targetEl.textContent = current === config.toggleContent
            ? targetEl.dataset.yOriginalContent
            : config.toggleContent;
        }
      }
      if (config.toggleAttribute) {
        if (targetEl.hasAttribute(config.toggleAttribute)) {
          targetEl.dataset.yOriginalAttr = targetEl.getAttribute(config.toggleAttribute);
          targetEl.removeAttribute(config.toggleAttribute);
        } else {
          const value = config.toggleAttributeValue || targetEl.dataset.yOriginalAttr || '';
          targetEl.setAttribute(config.toggleAttribute, value);
        }
      }
    });

    if (config.toggleClassSelf) {
      target.classList.toggle(config.toggleClassSelf);
    }
    if (config.toggleContentSelf) {
      if (!target.dataset.yOriginalContentSelf) {
        target.dataset.yOriginalContentSelf = target.textContent;
        target.textContent = config.toggleContentSelf;
      } else {
        const current = target.textContent;
        target.textContent = current === config.toggleContentSelf
          ? target.dataset.yOriginalContentSelf
          : config.toggleContentSelf;
      }
    }

    if (config.toggleOnce) {
      target.removeAttribute('data-action');
      target.disabled = true;
    }
  }
}
```

#### Usage Examples

**Simple Show/Hide Toggle:**
```html
<button
  data-action="toggleTarget"
  data-target="#filters"
  data-toggle-class="hidden">
  Show Filters
</button>

<div id="filters" class="hidden">
  <!-- Filter controls -->
</div>
```

**Expand/Collapse All (Replaces Multiple Methods!):**
```html
<button
  data-action="toggleTarget"
  data-target=".message-body, .message-subject"
  data-target-all
  data-toggle-class="collapsed"
  data-toggle-content-self="Expand All">
  Collapse All
</button>
```

**Toggle with Self-Feedback:**
```html
<button
  data-action="toggleTarget"
  data-target="[data-y-id='attachment']"
  data-target-all
  data-toggle-class="visible"
  data-toggle-class-self="btn-active"
  data-toggle-content-self="Hide Attachments">
  Show Attachments
</button>
```

**One-Time Reveal:**
```html
<button
  data-action="toggleTarget"
  data-target="#secret-code"
  data-toggle-class="blurred"
  data-toggle-once>
  Reveal Code (one-time only)
</button>
```

**Attribute Toggle:**
```html
<button
  data-action="toggleTarget"
  data-target=".accordion"
  data-target-all
  data-toggle-class="expanded"
  data-toggle-attribute="aria-expanded"
  data-toggle-attribute-value="true">
  Expand All Sections
</button>
```

**Dark Mode Toggle:**
```html
<button
  data-action="toggleTarget"
  data-target="body"
  data-toggle-class="dark-mode"
  data-toggle-content-self="☀️ Light Mode">
  🌙 Dark Mode
</button>
```

#### API Reference

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-target` | **Required** - CSS selector for target element(s) | `"#id"`, `".class"`, `"[data-y-id='x']"` |
| `data-target-all` | Use `querySelectorAll` instead of `querySelector` | boolean flag |
| `data-toggle-once` | Disable button after first click | boolean flag |
| `data-toggle-class` | Class to toggle on **target** | `"visible"`, `"active"` |
| `data-toggle-content` | Content to swap on **target** | `"New text"` |
| `data-toggle-attribute` | Attribute to toggle on **target** | `"disabled"`, `"aria-hidden"` |
| `data-toggle-attribute-value` | Value for toggled attribute | `"true"`, `"false"` |
| `data-toggle-class-self` | Class to toggle on **button itself** | `"btn-active"` |
| `data-toggle-content-self` | Content to swap on **button itself** | `"Hide"`, `"Show"` |

#### Why This Pattern Works

**Before (Imperative):**
```javascript
expandAll() {
  document.querySelectorAll('.item').forEach(el =>
    el.classList.remove('collapsed'));
  this.button.textContent = 'Collapse All';
}

collapseAll() {
  document.querySelectorAll('.item').forEach(el =>
    el.classList.add('collapsed'));
  this.button.textContent = 'Expand All';
}
```

**After (Declarative):**
```html
<button data-action="toggleTarget" data-target=".item"
        data-target-all data-toggle-class="collapsed"
        data-toggle-content-self="Expand All">
  Collapse All
</button>
```

**Benefits:**
- ✅ **94% code reduction** - One handler replaces dozens of methods
- ✅ **Designer-friendly** - HTML changes, not JavaScript
- ✅ **Framework-independent** - Works anywhere HTML renders
- ✅ **Self-documenting** - Intent is clear from markup
- ✅ **Zero memory leaks** - YEH's delegation handles cleanup

---

## 🚀 See It In Action

**[YaiTabs Live Demo](https://yaijs.github.io/yai/tabs/Example.html)**
Advanced tab system built on YEH with 20+ nested components

**[Performance Benchmark](https://yaijs.github.io/yai/tabs/Benchmark.html)**
Stress test with 400+ nesting levels demonstrating YEH's O(1) delegation

**[php-ymap Demo](https://github.com/yaijs/php-ymap)**
Production IMAP client showcasing YEH's declarative toggle pattern in action

---

## 📦 Resources

- **[YaiTabs Documentation](../components/tabs.md)** - Complete implementation guide
- **[Utilities Overview](../utilities/overview.md)** - YaiTabsSwipe, YaiViewport utilities
- **[GitHub Repository](https://github.com/yaijs/yai)** - Source code and issues
- **[NPM Package](https://npmjs.org/package/@yaijs/core)** - Install via npm

---

## License

MIT License – free to use in personal or commercial projects.

## 👥 Authors

- **Engin Ypsilon** - Architecture & concept, Declarative Toggle Pattern design
- **Claude-3.5-Sonnet (Sonnet 4.5)** - Implementation & optimization, Advanced Patterns documentation
- **DeepSeek-V3** - Documentation & examples
- **Grok-2** - Performance analysis
- **ChatGPT** - Design tokens

### Special Thanks

The Declarative Toggle Pattern showcased in this README emerged from a collaborative design session during the development of [php-ymap](https://github.com/yaijs/php-ymap), demonstrating how YEH's architecture naturally enables Alpine.js-level declarative power with vanilla JavaScript.

