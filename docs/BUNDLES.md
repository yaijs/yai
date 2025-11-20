# YaiJS Bundle Guide

This document explains the different bundle files available in `@yaijs/core` and when to use each one.

---

## Bundle Comparison

| Bundle File | Size | Includes | Use Case |
|-------------|------|----------|----------|
| **yai-bundle-core.js** | Minimal | YaiCore + YaiTabs + YEH | Basic tabs functionality |
| **yai-bundle.js** | Recommended | + YaiTabsSwipe + YaiViewport | Most projects (includes touch/viewport) |
| **yai-bundle-full.js** | Complete | + YaiAutoSwitch + YaiSearchAndClick | Testing/demos with automation |

---

## What's Included in Each Bundle

### yai-bundle-core.js (Minimal)

**Components:**
- `YaiCore` - Base framework with event handling
- `YaiTabs` - Tab component with routing, ARIA, animations
- `YEH` - Event hub for O(1) event delegation

**When to use:**
- Minimal bundle size is critical
- Only need basic tabs without touch/viewport features
- Building on top of YaiCore for custom components

**CDN Import:**
```javascript
import { YaiTabs, YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-core.js';
```

**NPM Import:**
```javascript
import { YaiTabs, YEH } from '@yaijs/core/bundle-core';
```

---

### yai-bundle.js (Recommended)

**Components:**
- Everything from `yai-bundle-core.js`
- `YaiTabsSwipe` - Touch/swipe navigation with gesture support
- `YaiViewport` - Viewport visibility tracking

**When to use:**
- **Recommended for most projects**
- Need touch/swipe support for mobile devices
- Want viewport-based lazy loading or animations
- Building responsive, mobile-friendly applications

**CDN Import:**
```javascript
import { YaiTabs, YaiTabsSwipe, YaiViewport, YEH } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle.js';
```

**NPM Import:**
```javascript
import { YaiTabs, YaiTabsSwipe, YaiViewport, YEH } from '@yaijs/core';
// or
import { YaiTabs, YaiTabsSwipe, YaiViewport } from '@yaijs/core/bundle';
```

---

### yai-bundle-full.js (Complete)

**Components:**
- Everything from `yai-bundle.js`
- `YaiAutoSwitch` - Automated tab cycling for demos
- `YaiSearchAndClick` - Automated testing utility

**When to use:**
- Building interactive demos or presentations
- Need automated tab switching for showcases
- Creating automated test scenarios
- Development/testing environments

**CDN Import:**
```javascript
import { YaiTabs, YaiTabsSwipe, YaiViewport, YaiAutoSwitch } from 'https://cdn.jsdelivr.net/npm/@yaijs/core@latest/dist/yai-bundle-full.js';
```

**NPM Import:**
```javascript
import { YaiTabs, YaiTabsSwipe, YaiViewport, YaiAutoSwitch } from '@yaijs/core/bundle-full';
```

---

## YEH Integration

**Important:** YEH (Yai Event Hub) is now integrated directly into `@yaijs/core`. All bundles include YEH.

**Before (v1.0.4):**
```bash
npm install @yaijs/yeh @yaijs/core  # Two separate packages
```

**Now (v1.1.0+):**
```bash
npm install @yaijs/core  # YEH included
```

**Import YEH:**
```javascript
// From any bundle
import { YEH } from '@yaijs/core';

// Or from dedicated export
import YEH from '@yaijs/core/yeh';
```

---

## TypeScript Support

All bundles include TypeScript declaration files (.d.ts):

```typescript
import { YaiTabs, YEH } from '@yaijs/core';

const tabs: YaiTabs = new YaiTabs({
    defaultBehavior: 'fade',
    autoFocus: true
});
```

---

## Package.json Exports

The package provides clean export paths:

```json
{
  "exports": {
    ".": "./dist/yai-bundle.js",
    "./bundle": "./dist/yai-bundle.js",
    "./bundle-core": "./dist/yai-bundle-core.js",
    "./bundle-full": "./dist/yai-bundle-full.js",
    "./yeh": "./yeh/yeh.js"
  }
}
```

---

## Quick Decision Guide

**Choose `yai-bundle-core.js` if:**
- ❌ Don't need touch/swipe support
- ❌ Don't need viewport tracking
- ✅ Minimal bundle size is priority

**Choose `yai-bundle.js` if:**
- ✅ Building modern web applications (recommended)
- ✅ Need mobile/touch support
- ✅ Want viewport-based features

**Choose `yai-bundle-full.js` if:**
- ✅ Building demos or presentations
- ✅ Need automated testing utilities
- ❌ Don't care about extra ~10KB for automation tools

---

## Related Documentation

- [YaiTabs Guide](./components/tabs.md) - Complete component reference
- [YaiTabsSwipe](./utilities/overview.md#yaitabsswipe) - Touch/swipe navigation
- [YaiViewport](./utilities/overview.md#yaiviewport) - Viewport tracking
- [YEH Documentation](./yeh/README.md) - Event system foundation

---

**License:** MIT
