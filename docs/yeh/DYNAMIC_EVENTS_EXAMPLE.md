# YaiInputUtils: Dynamic Event Handler Generation

## The Problem (Before)

Previously, event handlers were hardcoded:

```javascript
class YaiInputUtils extends YEH {
    handleClick()  { this.handleInputProxy('click', ...arguments) }
    handleInput()  { this.handleInputProxy('input', ...arguments) }
    handleChange() { this.handleInputProxy('change', ...arguments) }
    handleSubmit() { this.handleInputProxy('submit', ...arguments) }
    // Had to manually add each event type!
}
```

**Limitations:**
- ❌ Only 4 event types supported
- ❌ Adding new events requires code changes
- ❌ `actionableAttributes` must be manually maintained
- ❌ Not extensible

## The Solution (Now)

Event handlers are **auto-generated from config**:

```javascript
const appConfig = {
    eventHandler: {
        selector: {
            '#app': [
                'click',
                'submit',
                'focus',
                'blur',
                'mouseenter',
                'mouseleave',
                'keydown',
                'keyup',
                'dblclick',
                'contextmenu',
                { type: 'input', debounce: 750 },
                { type: 'change', debounce: 750 },
                { type: 'scroll', throttle: 200 },
                { type: 'resize', throttle: 200 },
                // ... ANY event type!
            ],
        },
        config: {
            autoTargetResolution: true,
            // actionableAttributes auto-generated!
        }
    },
};

const inputUtils = new YaiInputUtils({ appConfig });
```

**What Gets Auto-Generated:**

```javascript
// Methods created automatically:
handleClick()
handleSubmit()
handleFocus()
handleBlur()
handleMouseenter()
handleMouseleave()
handleKeydown()
handleKeyup()
handleDblclick()
handleContextmenu()
handleInput()
handleChange()
handleScroll()
handleResize()

// Attributes created automatically:
actionableAttributes: [
    'data-click',
    'data-submit',
    'data-focus',
    'data-blur',
    'data-mouseenter',
    'data-mouseleave',
    'data-keydown',
    'data-keyup',
    'data-dblclick',
    'data-contextmenu',
    'data-input',
    'data-change',
    'data-scroll',
    'data-resize',
]
```

## Benefits

### ✅ Zero Boilerplate
```javascript
// OLD: Add 3 lines per event type
handleMouseenter() { this.handleInputProxy('mouseenter', ...arguments) }

// NEW: Just add to config
'mouseenter',
```

### ✅ Infinite Extensibility
```html
<!-- Want hover effects? Just add to config -->
<div data-mouseenter="showTooltip" data-mouseleave="hideTooltip">
    Hover me
</div>

<!-- Want keyboard shortcuts? Just add to config -->
<div data-keydown="handleShortcut">
    Press keys
</div>

<!-- Want double-click? Just add to config -->
<button data-dblclick="advancedAction">
    Double-click me
</button>
```

### ✅ Dynamic Content Ready
```javascript
// Inject HTML with any event attribute - it just works!
app.innerHTML += `
    <button data-click="dynamicAction">
        Added at runtime
    </button>
    <input data-focus="trackFocus" data-blur="trackBlur">
`;

// No registration needed - event delegation handles it!
```

### ✅ User Methods Override Generated Ones
```javascript
const appMethods = {
    // Custom implementation overrides auto-generated one
    validateInput: (target, event, container) => {
        console.log('Custom validation', target.value);
    },
};

// Generated handlers for click, submit, change, etc.
// Custom handler for input
```

### ✅ Attributes Auto-Sync with Events
```javascript
// Add 'focus' to events
selector: {
    '#app': ['click', 'focus'],
}

// 'data-focus' automatically added to actionableAttributes
// YEH's auto-target resolution finds data-focus elements
```

## How It Works

```javascript
function createDynamicHandlers(eventSelector) {
    // 1. Scan all event types from config
    Object.entries(eventSelector).forEach(([, events]) => {
        events.forEach(eventConfig => {
            const eventType = typeof eventConfig === 'string'
                ? eventConfig
                : eventConfig.type;

            // 2. Generate handler name
            const handlerName = `handle${capitalize(eventType)}`;

            // 3. Generate attribute name
            const attributeName = `data-${eventType}`;

            // 4. Create method stub
            methods[handlerName] = function(...args) {
                this.handleInputProxy(eventType, ...args);
            };

            // 5. Store attribute
            attributes.push(attributeName);
        });
    });

    // 6. Inject into config BEFORE super()
    eventHandler.config.methods = { ...methods, ...userMethods };
    eventHandler.config.actionableAttributes = attributes;
}
```

## Real-World Examples

### Tooltip System
```javascript
selector: {
    '#app': ['mouseenter', 'mouseleave'],
}
```

```html
<button data-mouseenter="showTooltip" data-mouseleave="hideTooltip">
    Hover for info
</button>
```

### Keyboard Shortcuts
```javascript
selector: {
    '#app': ['keydown'],
}
```

```html
<div data-keydown="handleShortcut">
    Press Ctrl+S to save
</div>
```

### Form Auto-Save
```javascript
selector: {
    '#app': [
        { type: 'input', debounce: 1000 },
        { type: 'blur', debounce: 100 },
    ],
}
```

```html
<input data-input="autoSave" data-blur="finalSave">
```

### Drag and Drop
```javascript
selector: {
    '#app': ['dragstart', 'dragover', 'drop'],
}
```

```html
<div data-dragstart="handleDrag" data-drop="handleDrop">
    Drag files here
</div>
```

## Performance Impact

**Zero Overhead:**
- Handler generation happens once at construction
- No runtime reflection or dynamic lookups
- Methods are created before `super()`, just like manual methods
- No additional event listeners added

**Listener Count Formula:**
```javascript
Total Listeners =
    (delegation selectors × events per selector) +
    (attribute selectors × matching elements at init)
```

**Example:**
```javascript
selector: {
    '#app': ['click', 'input', 'change', 'submit'],  // = 4 listeners
    '[data-focus]': ['focus'],                        // = N listeners (per element)
}
// Total: 4 + N listeners (where N = elements with data-focus at init)
```

**Key Insight:** Listener count scales with **config size**, not **DOM size**!

## Measuring Listener Efficiency

Use this DevTools console script to audit event listeners on any page:

```javascript
// 🔍 Enhanced Real-World Listener Scanner with Counter
let totalListeners = 0;
const elementsWithListeners = [];

[window, document, ...document.querySelectorAll('*')].filter(el => {
    const listeners = getEventListeners(el);
    return listeners && Object.keys(listeners).length > 0;
}).forEach((el, i) => {
    const elementName = el === window
        ? 'window'
        : el === document ? 'document' : el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '') +
          (el.className ? '.' + el.className.split(' ').join('.') : '');

    const listeners = getEventListeners(el);

    // Count total listeners for this element
    let elementListenerCount = 0;
    Object.values(listeners).forEach(eventArray => {
        elementListenerCount += eventArray.length;
    });
    totalListeners += elementListenerCount;

    // Enhanced display format
    console.log(`${i + 1}. ${elementName}:`);
    Object.entries(listeners).forEach(([eventType, eventArray]) => {
        console.log(`  - ${eventType}: ${eventArray.length}`);
    });
    console.log(`  Total: ${elementListenerCount} listeners`);
    console.log(''); // Empty line for readability

    elementsWithListeners.push({elementName, count: elementListenerCount, listeners});
});

// Final summary
console.log(`🎯 SCAN COMPLETE:`);
console.log(`📊 Total Elements with Listeners: ${elementsWithListeners.length}`);
console.log(`🔥 Total Event Listeners Found: ${totalListeners}`);
console.log(`📈 Average Listeners per Element: ${(totalListeners / elementsWithListeners.length).toFixed(2)}`);

// Top listener hotspots
const sorted = elementsWithListeners.sort((a, b) => b.count - a.count).slice(0, 5);
console.log(`🥇 Top 5 Listener Hotspots:`);
sorted.forEach((item, i) => {
    console.log(`${i + 1}. ${item.elementName}: ${item.count} listeners`);
});
```

## Migration Guide

### Before (Manual)
```javascript
class YaiInputUtils extends YEH {
    handleClick()  { this.handleInputProxy('click', ...arguments) }
    handleInput()  { this.handleInputProxy('input', ...arguments) }
    handleChange() { this.handleInputProxy('change', ...arguments) }
}

const appConfig = {
    eventHandler: {
        config: {
            actionableAttributes: [
                'data-click',
                'data-input',
                'data-change',
            ],
        }
    }
};
```

### After (Auto-Generated)
```javascript
// No manual handler methods needed!

const appConfig = {
    eventHandler: {
        selector: {
            '#app': ['click', 'input', 'change'],
        },
        config: {
            // actionableAttributes auto-generated!
        }
    }
};
```

## Conclusion

This pattern gives you **unlimited event delegation** with **zero boilerplate**:

1. Add event type to config → Handler auto-created
2. Add `data-{event}` to HTML → Attribute auto-recognized
3. Inject dynamic content → Event delegation handles it

**The entire app is event-delegated and ready for dynamic content from day one.**

---

**License:** MIT
