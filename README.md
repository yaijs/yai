# 🎯 YaiJS Component Library

**Advanced VanillaJS web components built on YEH (YpsilonEventHandler) - the world's first DOM Event Scoping System**

YaiJS delivers enterprise-grade UI components with mathematical O(1) scaling performance. Each component uses a single event listener per container with perfect isolation, enabling infinite nesting without listener proliferation.

## Framework Overview

**Built on YEH (YpsilonEventHandler) Foundation**
- **O(1) Performance:** Single listener per container regardless of complexity
- **Perfect Isolation:** Container-scoped event handling using `:scope >` selectors
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
- ✅ **Dynamic Content Loading** - Fetch remote content with abort controllers
- ✅ **Container Isolation** - Unique IDs prevent cross-contamination

**[View YaiTabs Documentation →](tabs/README.md)**

**[Try Live Demo →](tabs/Example.html)**

## Quick Start

```html
<!-- CDN via npm -->
<script src="https://cdn.jsdelivr.net/npm/@yaijs/yeh@1.0.0/yeh.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.0/yai-core.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.0/tabs/yai-tabs.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yaijs/core@1.0.0/tabs/yai-tabs.css">

<script>
// Initialize with custom config
const tabs = new YaiTabs({
  defaultBehavior: 'fade',
  autoFocus: true,
  closable: true
});
</script>
```

```bash
# npm installation
npm install @yaijs/yeh @yaijs/core
```

## Browser Compatibility

YaiJS and all components are written in standards-compliant ES6. Modern browsers with ES6 module support are required.

**Supported Browsers:**
- Chrome 61+ (ES6 modules)
- Firefox 60+ (ES6 modules)
- Safari 11+ (ES6 modules)
- Edge 16+ (ES6 modules)

**Legacy Support:**
For older browsers, use any build tool (Webpack, Vite, etc.) with polyfills targeting your required browser support matrix.

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
├── yai-core.js              // Shared base class (~700 LOC)
├── yai-core.d.ts            // Core TypeScript definitions
├── auto-switch.js           // Component testing utility (~250 LOC)
├── auto-switch.d.ts         // AutoSwitch TypeScript definitions
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

