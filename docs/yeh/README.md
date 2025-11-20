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

**Get started in 30 seconds** – [try it live on JSFiddle](https://jsfiddle.net/jyxczakr/)

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
    import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

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
  import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';
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


## 🚀 See It In Action

**[YaiTabs Live Demo](https://yaijs.github.io/yai/tabs/Example.html)**
Advanced tab system built on YEH with 20+ nested components

**[Performance Benchmark](https://yaijs.github.io/yai/tabs/Benchmark.html)**
Stress test with 400+ nesting levels demonstrating YEH's O(1) delegation

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

- **Engin Ypsilon** - Architecture & concept
- **Claude-3.5-Sonnet** - Implementation & optimization
- **DeepSeek-V3** - Documentation & examples
- **Grok-2** - Performance analysis
- **ChatGPT** - Design tokens
