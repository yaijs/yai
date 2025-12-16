# YaiJS Utilities

Utilities that extend YaiTabs functionality. All examples below are working snippets from the [Live Demo](https://yaijs.github.io/yai/tabs/Example.html).

---

## YaiInputUtils

**[Live Demo →](https://yaijs.github.io/yai/docs/utilities/yai-input-utils.html)**

Headless form enhancement utilities that provide validation, character counters, and keyboard shortcut helpers without imposing any UI styling.

**Features:**
- Pre-validation with automatic error classes
- Character counter for inputs with length constraints
- Password visibility toggle helpers
- Input clear utilities
- Global keyboard shortcut detection (`hasActiveInput()`)
- Support for INPUT, TEXTAREA, and SELECT elements
- Custom error messages via `data-error-message`
- Template-based wrapper and label injection
- Event-driven architecture with hooks

**Quick Example:**

```javascript
import { YaiInputUtils } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/utils/yai-input-utils.js';

const inputUtils = new YaiInputUtils({
  appConfig: {
    eventHandler: {
      selector: {
        '#form': [
          { type: 'input', debounce: 300 },
          'click'
        ],
        window: ['keydown']  // Global keyboard shortcuts
      }
    },
    templates: document.getElementById('templates')
  }
});

// Prevent keyboard shortcuts while user is typing
inputUtils.hook('eventkeydown', (target, event) => {
  if (YaiInputUtils.hasActiveInput()) return;

  if (event.key === 's' && event.ctrlKey) {
    event.preventDefault();
    // Save action
  }
});
```

**Available Methods:**
- `preValidation(input, config)` - Validate and add error classes
- `inputCounter(input, container)` - Update character counter
- `togglePassword(target)` - Toggle password visibility
- `clearInput(target)` - Clear input value
- `autoEnhance(input, container)` - Auto-add counters for length-constrained inputs
- `static hasActiveInput()` - Check if user is typing in a form

---

## YaiViewport

Advanced viewport tracking utility with throttled resize/scroll events and visibility detection.

**Features:**
- Observer-free element visibility tracking
- Throttled resize, scroll, and scrollend events
- Customizable thresholds for page position detection
- Automatic element state management

**Example:**

```html
<script type="module">
    import {
        YaiTabs,
        YaiViewport
    } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

    const tabs = new YaiTabs();

    const yViewport = new YaiViewport({
        throttle:  { resize: 500, scroll: 150, scrollend: 150 },
        threshold: { pageTop: 50, pageEnd: 50, pageScrolled: 50 },
    })
    .track(`
        [data-yai-tabs][data-root]
    `)
    .hook('elementVisibleCheck', ({ element, rect, state, isLeaving }) => {
        // Root component is visible, do something
        console.log('Element visible:', element, state);
    });
</script>
```

**Available Hooks:**
- `elementVisibleCheck` - Fires when tracked element visibility changes
- `viewportResize` - Throttled window resize event
- `viewportScroll` - Throttled scroll event
- `viewportScrollend` - Fires when scrolling stops

---

## YaiTabsSwipe

Touch and swipe navigation for tabs with orbital UI patterns and boundary behaviors.

**Features:**
- Touch and mouse swipe support
- Configurable swipe axis (horizontal, vertical, auto)
- Boundary behaviors: circular looping, nested tab navigation
- Auto-detection of touch devices

**Example:**

```html
<script type="module">
    import {
        YaiCore,
        YaiTabs,
        YaiTabsSwipe
    } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

    const YaiDevice = YaiCore.getUserPreferences();

    const tabs = new YaiTabs();

    const yaiSwipe = new YaiTabsSwipe({
        // Lock to horizontal for touch devices to prevent scroll conflicts
        axis: YaiDevice.hasTouch ? 'horizontal' : 'auto',

        // Boundary behaviors
        boundaryBehavior: {
            circular: true,            // Loop from last to first
            descendIntoNested: true,   // Auto-open nested tabs at boundary
            ascendFromNested: true,    // Switch parent tab when nested boundary reached
        }
    })
    .setInstance(tabs)
    .watchHooks();
</script>
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `axis` | `string` | `'auto'` | Swipe direction: `auto`, `horizontal`, `vertical` |
| `threshold` | `number` | `50` | Minimum swipe distance in pixels |
| `boundaryBehavior.circular` | `boolean` | `false` | Enable circular tab navigation |
| `boundaryBehavior.descendIntoNested` | `boolean` | `false` | Auto-open nested tabs at boundaries |
| `boundaryBehavior.ascendFromNested` | `boolean` | `false` | Switch parent tabs when nested boundary reached |

**Device Detection Helper:**

```javascript
const YaiDevice = YaiCore.getUserPreferences();

// Available properties:
YaiDevice.hasTouch      // Boolean: Touch support detected
YaiDevice.touchDevice   // Boolean: Coarse pointer (touch)
YaiDevice.hasHover      // Boolean: Supports hover
YaiDevice.finePointer   // Boolean: Fine pointer (mouse/trackpad)
YaiDevice.isMobile      // Boolean: Screen width ≤ 768px
YaiDevice.reduceMotion  // Boolean: User prefers reduced motion
YaiDevice.highContrast  // Boolean: User prefers high contrast
YaiDevice.darkContrast  // Boolean: Dark mode + high contrast
YaiDevice.dataSaver     // Boolean: User prefers reduced data
YaiDevice.colorScheme   // String: 'dark' or 'light'
```

---

## Bundle Selection Guide

Choose the right bundle for your needs:

```javascript
// Minimal - YaiCore, YaiTabs, YEH
import { YaiTabs } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-core.js';

// Recommended - YaiCore, YaiTabs, YaiTabsSwipe, YaiViewport, YEH
import { YaiTabs, YaiTabsSwipe, YaiViewport } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';

// Full - YaiCore, YaiTabs, YaiTabsSwipe, YaiViewport, YaiAutoSwitch, YaiSearchAndClick, YEH
import { YaiTabs, YaiTabsSwipe, YaiViewport } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-full.js';

// Individual utility imports
import { YaiInputUtils } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/utils/yai-input-utils.js';
import { YaiViewport } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/utils/yai-viewport.js';
import { YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/yeh/yeh.js';
```

---

## Resources

- **[Live Demo](https://yaijs.github.io/yai/tabs/Example.html)** - Interactive examples with all utilities
- **[YaiTabs Documentation](../components/tabs.md)** - Core component guide
- **[GitHub Repository](https://github.com/yaijs/yai)** - Source code and issues


## Author

- **Engin Ypsilon**

---

**License:** MIT
