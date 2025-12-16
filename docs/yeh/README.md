# YEH (Yai Event Hub)

> Lightweight event delegation library for modern web applications

YEH is fundamentally designed around **event delegation** - using a single listener to handle multiple elements, including dynamically added ones. This isn't just an optimization; it's the entire architectural foundation. Works on `file://` with zero build tools.

**Documentation Status:** Early release - actively being refined

---

## ✨ Core Features

**Built for developers who value speed and simplicity:**

YEH is perfect for **quick prototyping**, **experimental projects**, and **production apps** alike. No build tools, no configuration files, no framework lock-in — just write code and see results instantly.

**Technical Features:**

- **Event Delegation** - One listener handles dynamic elements with scope-based routing
- **Auto Target Resolution** - Handles nested elements correctly (e.g., SVGs in buttons)
- **Throttle & Debounce** - Built-in performance controls
- **Dynamic Listeners** - Add/remove events at runtime
- **Flexible Handlers** - Class methods, external maps, or globals
- **Multi-Handler System** - Closest-match resolution for nested components
- **Hook System** - Zero-cost event observation without DOM listeners

**Developer Experience:**

- **Zero dependencies** - Works standalone, no npm install required
- **Works on `file://`** - No server needed, perfect for local experiments
- **Copy-paste ready** - Full examples that actually run
- **Framework agnostic** - Use with React, Vue, Vanilla, or anything
- **5KB minified** - Lightweight enough for quick prototypes, solid enough for production

---

## 🚀 Quick Start

**No setup, no build step, no server, just include YEH.**

**Get started in 30 seconds** – [or try it live on JSFiddle](https://jsfiddle.net/qdwozL0c/)

Using the CDN Demo below obviously requires a internet connection, but the demo itself can be used via `file://` protocol (tested in Opera, Firefox, Brave & Chrome; latest versions, DEC 2025). If installed via npm, it even works offline on `file://` protocol.

```html
<!DOCTYPE html>
<html>
<head><title>YEH Demo</title></head>
<body>
  <div id="app">
    <button data-click="save">Save</button>
    <button data-click="delete">Delete</button>
  </div>

  <script type="module">
    import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.2/yeh/yeh.min.js';

    class MyHandler extends YEH {
      constructor() {
        super({ '#app': ['click'] }); // Falls back to handleClick()
      }

      handleClick(event, target, container) {
        const action = target.dataset[event.type]; // require click data-attribute
        if (action && this[action]) this[action](target, event, container);
      }

      save(target)   { console.log('Saving...'); }
      delete(target) { console.log('Deleting...'); }
    }

    new MyHandler(); // Adding click listeners done. Forever. In this session.
  </script>
</body>
</html>
```

**30-second setup:** Create `app.html`, copy & paste the above code, then double-click to run.

---

> **💡 Universal Delegation Pattern**
>
> One listener on parent + `custom-selector` = handles unlimited elements within the parent

---

## Installation

### CDN (Instant Setup)

```html
<script type="module"> // Standalone version
  import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.2/yeh/yeh.min.js';
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
| `autoTargetResolution` | `boolean` | `false` | Automatically resolve event targets for nested elements (e.g., SVG icons). |

**Example:** `new YEH(events, aliases, { enableStats: true });`

---

## 🔗 API Reference

### Constructor

```javascript
new YEH(
  { '#app': ['click', { type: 'input', debounce: 300 }] }, // Event mapping
  { click: { save: 'handleSave' } }, // Aliases (optional, event type scoped)
  { enableStats: true } // Config (optional)
);
```

### Event System

```javascript
// Subscribe to custom events (adds a DOM listener per .on())
handler.on('data-ready', 'handleData');
handler.on('user-login', (event) => console.log(event.detail));

// Emit custom events (dispatches to document via default)
handler.emit('init-complete', { loaded: true }, document);

// Hook system (zero-cost, no DOM listener)
handler.hook('eventclick', (target) => console.log('clicked', target));

// Chain operations
handler.on('ready', 'init')
       .emit('start', { time: Date.now() });
```

### Cleanup

```javascript
handler.destroy();
// Or with AbortController enabled
handler.abort();
```

### Performance Metrics

With `enableStats: true`:

```javascript
console.log(handler.getStats());
```

---

## 🎯 Advanced Patterns

### Declarative Toggle System

YEH's event delegation enables powerful declarative patterns where HTML configuration drives behavior. This eliminates repetitive JavaScript handlers while maintaining full flexibility.

#### The Universal Toggle Pattern

[Try it live on JSFiddle](https://jsfiddle.net/hb9t3gam/)

```javascript
import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@1.1.2/yeh/yeh.min.js';

class App extends YEH {
  constructor() {
    super(
      { '#app': ['click'] },
      {},
      { autoTargetResolution: true }
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
      targetAll: target.hasAttribute('data-target-all'),           // document.querySelectorAll
      toggleClass: target.dataset.toggleClass,                     // targetElement
      toggleContent: target.dataset.toggleContent,                 // targetElement
      toggleAttribute: target.dataset.toggleAttribute,             // targetElement
      toggleAttributeValue: target.dataset.toggleAttributeValue,   // targetElement
      toggleClassSelf: target.dataset.toggleClassSelf,             // self (trigger)
      toggleContentSelf: target.dataset.toggleContentSelf,         // self
      toggleOnce: target.hasAttribute('data-toggle-once'),         // self
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

// Initialize the app
new App();
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

**Expand/Collapse All:**
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

// Worst case: 2 controller for each togglable; exponentially worsening
```

**After (Declarative):**
```html
<!-- One button to handle them all -->
<button data-click="toggleTarget"
        data-target=".item"
        data-target-all
        data-toggle-class="collapsed"
        data-toggle-content-self="Expand All">
  Collapse All
</button>
```
> First rule: Try Single-handlability, if it fails, alter your approach and try it again.

**Benefits:**
- ✅ **Significant code reduction** - One handler replaces multiple methods
- ✅ **Designer-friendly** - HTML changes, not JavaScript
- ✅ **Framework-independent** - Works anywhere HTML renders
- ✅ **Self-documenting** - Intent is clear from markup

---

## 🌐 Browser Support

**Opera** | **Chrome** | **Firefox** | **Safari** | **Edge** - Latest versions of DEC 2025

*Works with legacy browsers via Webpack + Babel.*

---

## When to Use YEH

### ✅ Good Fit
- Forms with many inputs requiring validation
- Dynamic content (SPAs, AJAX-loaded elements)
- Complex UI with nested interactive elements
- Need consistent debounce/throttle patterns
- Working without build tools or frameworks
- Quick prototyping, dev-friendly setup in minutes

### ❌ Not Needed
- Static pages with 2-3 buttons
- Simple click handlers only
- Already using a framework with built-in event delegation
- Need IE11 support without transpilation

---

## 🚀 See It In Action

**[YaiTabs Live Demo](https://yaijs.github.io/yai/tabs/Example.html)**
Advanced tab system built on YEH with 50+ nested components

**[Performance Benchmark](https://yaijs.github.io/yai/tabs/Benchmark.html)**
Stress test with X nesting levels demonstrating efficient event delegation

**[php-ymap Demo](https://github.com/yaijs/php-ymap)**
A interactive IMAP client demo build on YEH, using 4 event listener for the whole demo:
  - Many "toggle more" buttons
  - LocalStorage for credentials - add/load/remove
  - Mail fetching
    - Listing fetched mails with previews
      - Toggle each mail read/unread
      - Toggle each mail answered/unanswered
    - Modal for full message
    - Nav in modal: `prev - next`
  - All features with CSS animations (opening & closing)

---

## 📦 Resources

- **[Dynamic Events Example](./DYNAMIC_EVENTS_EXAMPLE.md)** - Auto-generate event handlers from config
- **[GitHub Repository](https://github.com/yaijs/yai)** - Source code and issues
- **[NPM Package](https://npmjs.org/package/@yaijs/core)** - Install via npm


## Author

- **Engin Ypsilon**

---

**License:** MIT
